"""Direct Hire router - Booking workers directly with packages"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Worker, Employer
from app.models_v2.package import WorkerPackage
from app.models_v2.direct_hire import DirectHire, DirectHireStatus
from app.models_v2.address import Address
from app.models_v2.conversation import Conversation
from app.security import get_current_user
from app.services.notification_service import (
    notify_direct_hire_request,
    notify_direct_hire_accepted,
    notify_direct_hire_rejected,
    notify_direct_hire_completed,
    notify_direct_hire_approved,
    notify_direct_hire_paid
)

router = APIRouter(prefix="/direct-hire", tags=["direct-hire"])


# ============== SCHEMAS ==============

class DirectHireCreate(BaseModel):
    worker_id: int
    package_ids: List[int]
    scheduled_date: date
    scheduled_time: Optional[str] = None
    address_street: Optional[str] = None
    address_barangay: Optional[str] = None
    address_city: Optional[str] = None
    address_province: Optional[str] = None
    address_region: Optional[str] = None
    special_instructions: Optional[str] = None
    use_my_address: bool = True  # If true, use employer's saved address


class DirectHireResponse(BaseModel):
    hire_id: int
    employer_id: int
    worker_id: int
    worker_user_id: int  # Added for ratings
    worker_name: str
    employer_name: str
    package_ids: List[int]
    packages: List[dict]  # Package details
    total_amount: float
    scheduled_date: str
    scheduled_time: Optional[str]
    address_street: Optional[str]
    address_barangay: Optional[str]
    address_city: Optional[str]
    address_province: Optional[str]
    address_region: Optional[str]
    special_instructions: Optional[str]
    status: str
    completion_proof_url: Optional[str]
    completion_notes: Optional[str]
    completed_at: Optional[str]
    payment_method: Optional[str]
    payment_proof_url: Optional[str]
    paid_at: Optional[str]
    created_at: str


class DirectHireStatusUpdate(BaseModel):
    status: str  # accepted, rejected, in_progress, etc.


class CompletionSubmit(BaseModel):
    completion_proof_url: Optional[str] = None
    completion_notes: Optional[str] = None


class PaymentSubmit(BaseModel):
    payment_method: str
    payment_proof_url: Optional[str] = None
    reference_number: Optional[str] = None


# ============== HELPER FUNCTIONS ==============

def get_employer_for_user(user_id: int, db: Session) -> Employer:
    """Get or create employer record for user"""
    employer = db.query(Employer).filter(Employer.user_id == user_id).first()
    if not employer:
        employer = Employer(user_id=user_id)
        db.add(employer)
        db.commit()
        db.refresh(employer)
    return employer


def get_worker_for_user(user_id: int, db: Session) -> Worker:
    """Get worker record for a user"""
    worker = db.query(Worker).filter(Worker.user_id == user_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a registered housekeeper"
        )
    return worker


def hire_to_response(hire: DirectHire, db: Session) -> DirectHireResponse:
    """Convert DirectHire to response with all details"""
    # Get worker and employer names
    worker = db.query(Worker).filter(Worker.worker_id == hire.worker_id).first()
    worker_user = db.query(User).filter(User.id == worker.user_id).first() if worker else None
    worker_name = f"{worker_user.first_name} {worker_user.last_name}" if worker_user else "Unknown"
    
    employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first()
    employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else None
    employer_name = f"{employer_user.first_name} {employer_user.last_name}" if employer_user else "Unknown"
    
    # Get package details
    package_ids = hire.package_ids or []
    packages = []
    if package_ids:
        pkg_records = db.query(WorkerPackage).filter(WorkerPackage.package_id.in_(package_ids)).all()
        packages = [
            {
                "package_id": p.package_id,
                "name": p.name,
                "price": float(p.price),
                "duration_hours": p.duration_hours,
                "services": p.services or []
            }
            for p in pkg_records
        ]
    
    return DirectHireResponse(
        hire_id=hire.hire_id,
        employer_id=hire.employer_id,
        worker_id=hire.worker_id,
        worker_user_id=worker.user_id if worker else 0,
        worker_name=worker_name,
        employer_name=employer_name,
        package_ids=package_ids,
        packages=packages,
        total_amount=float(hire.total_amount),
        scheduled_date=str(hire.scheduled_date),
        scheduled_time=hire.scheduled_time,
        address_street=hire.address_street,
        address_barangay=hire.address_barangay,
        address_city=hire.address_city,
        address_province=hire.address_province,
        address_region=hire.address_region,
        special_instructions=hire.special_instructions,
        status=hire.status.value,
        completion_proof_url=hire.completion_proof_url,
        completion_notes=hire.completion_notes,
        completed_at=str(hire.completed_at) if hire.completed_at else None,
        payment_method=hire.payment_method,
        payment_proof_url=hire.payment_proof_url,
        paid_at=str(hire.paid_at) if hire.paid_at else None,
        created_at=str(hire.created_at)
    )


# ============== EMPLOYER ENDPOINTS ==============

@router.post("/", response_model=DirectHireResponse)
def create_direct_hire(
    hire_data: DirectHireCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a direct hire booking (employer only)"""
    employer = get_employer_for_user(current_user.id, db)
    
    # Validate worker exists
    worker = db.query(Worker).filter(Worker.worker_id == hire_data.worker_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker not found"
        )
    
    # Validate packages exist and belong to worker
    packages = db.query(WorkerPackage).filter(
        WorkerPackage.package_id.in_(hire_data.package_ids),
        WorkerPackage.worker_id == hire_data.worker_id,
        WorkerPackage.is_active == True
    ).all()
    
    if len(packages) != len(hire_data.package_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more packages are invalid or not available"
        )
    
    # Calculate total amount
    total_amount = sum(float(p.price) for p in packages)
    
    # Get address
    address_street = hire_data.address_street
    address_barangay = hire_data.address_barangay
    address_city = hire_data.address_city
    address_province = hire_data.address_province
    address_region = hire_data.address_region
    
    if hire_data.use_my_address:
        user_address = db.query(Address).filter(Address.user_id == current_user.id).first()
        if user_address:
            address_street = user_address.street_address
            address_barangay = user_address.barangay_name
            address_city = user_address.city_name
            address_province = user_address.province_name
            address_region = user_address.region_name
    
    # Create the hire
    hire = DirectHire(
        employer_id=employer.employer_id,
        worker_id=hire_data.worker_id,
        package_ids=hire_data.package_ids,
        total_amount=total_amount,
        scheduled_date=hire_data.scheduled_date,
        scheduled_time=hire_data.scheduled_time,
        address_street=address_street,
        address_barangay=address_barangay,
        address_city=address_city,
        address_province=address_province,
        address_region=address_region,
        special_instructions=hire_data.special_instructions,
        status=DirectHireStatus.PENDING
    )
    
    db.add(hire)
    db.commit()
    db.refresh(hire)
    
    # Send notification to worker about new direct hire request
    employer_name = f"{current_user.first_name} {current_user.last_name}"
    notify_direct_hire_request(
        db=db,
        worker_user_id=worker.user_id,
        employer_name=employer_name,
        hire_id=hire.hire_id
    )
    
    return hire_to_response(hire, db)


@router.get("/my-bookings", response_model=List[DirectHireResponse])
def get_my_bookings(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all direct hire bookings made by the current employer"""
    employer = get_employer_for_user(current_user.id, db)
    
    query = db.query(DirectHire).filter(DirectHire.employer_id == employer.employer_id)
    
    if status_filter:
        try:
            status_enum = DirectHireStatus(status_filter)
            query = query.filter(DirectHire.status == status_enum)
        except ValueError:
            pass
    
    hires = query.order_by(DirectHire.created_at.desc()).all()
    
    return [hire_to_response(h, db) for h in hires]


@router.post("/{hire_id}/approve-completion")
def approve_completion(
    hire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve worker's completion and proceed to payment"""
    employer = get_employer_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.employer_id == employer.employer_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if hire.status != DirectHireStatus.PENDING_COMPLETION:
        raise HTTPException(status_code=400, detail="Work completion not submitted yet")
    
    hire.status = DirectHireStatus.COMPLETED
    db.commit()
    
    # Send notification to worker that completion was approved
    worker = db.query(Worker).filter(Worker.worker_id == hire.worker_id).first()
    if worker:
        employer_name = f"{current_user.first_name} {current_user.last_name}"
        notify_direct_hire_approved(
            db=db,
            worker_user_id=worker.user_id,
            employer_name=employer_name,
            hire_id=hire.hire_id
        )
    
    return {"message": "Completion approved. Please proceed to payment.", "status": "completed"}


@router.post("/{hire_id}/pay", response_model=DirectHireResponse)
def submit_payment(
    hire_id: int,
    payment_data: PaymentSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit payment for a completed direct hire"""
    employer = get_employer_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.employer_id == employer.employer_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if hire.status != DirectHireStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Work must be completed before payment")
    
    # Validate reference number for non-cash
    if payment_data.payment_method != 'cash' and not payment_data.reference_number:
        raise HTTPException(status_code=400, detail="Reference number required for non-cash payments")
    
    hire.payment_method = payment_data.payment_method
    hire.payment_proof_url = payment_data.payment_proof_url
    hire.reference_number = payment_data.reference_number
    hire.paid_at = func.now()
    hire.status = DirectHireStatus.PAID
    
    db.commit()
    db.refresh(hire)
    
    # Send notification to worker about payment
    worker = db.query(Worker).filter(Worker.worker_id == hire.worker_id).first()
    if worker:
        employer_name = f"{current_user.first_name} {current_user.last_name}"
        notify_direct_hire_paid(
            db=db,
            worker_user_id=worker.user_id,
            employer_name=employer_name,
            amount=float(hire.total_amount),
            hire_id=hire.hire_id
        )
    
    return hire_to_response(hire, db)


@router.post("/{hire_id}/cancel")
def cancel_booking(
    hire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a pending booking (employer only)"""
    employer = get_employer_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.employer_id == employer.employer_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if hire.status not in [DirectHireStatus.PENDING, DirectHireStatus.ACCEPTED]:
        raise HTTPException(status_code=400, detail="Cannot cancel a booking that is already in progress or completed")
    
    hire.status = DirectHireStatus.CANCELLED
    db.commit()
    
    return {"message": "Booking cancelled"}


# ============== WORKER ENDPOINTS ==============

@router.get("/my-jobs", response_model=List[DirectHireResponse])
def get_my_direct_jobs(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all direct hire jobs for the current worker"""
    worker = get_worker_for_user(current_user.id, db)
    
    query = db.query(DirectHire).filter(DirectHire.worker_id == worker.worker_id)
    
    if status_filter:
        try:
            status_enum = DirectHireStatus(status_filter)
            query = query.filter(DirectHire.status == status_enum)
        except ValueError:
            pass
    
    hires = query.order_by(DirectHire.created_at.desc()).all()
    
    return [hire_to_response(h, db) for h in hires]


@router.post("/{hire_id}/accept")
def accept_hire(
    hire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a direct hire request (worker only)"""
    worker = get_worker_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.worker_id == worker.worker_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Hire request not found")
    
    if hire.status != DirectHireStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only accept pending requests")
    
    hire.status = DirectHireStatus.ACCEPTED
    db.commit()
    
    # Send notification to employer that worker accepted
    employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first()
    if employer:
        worker_name = f"{current_user.first_name} {current_user.last_name}"
        notify_direct_hire_accepted(
            db=db,
            employer_user_id=employer.user_id,
            worker_name=worker_name,
            hire_id=hire.hire_id
        )
        
        # Auto-create conversation for both parties
        # Check if conversation already exists for this hire
        existing_conv = db.query(Conversation).filter(
            Conversation.hire_id == hire.hire_id
        ).first()
        
        if not existing_conv:
            # Create conversation with both employer and worker as participants
            conversation = Conversation(
                hire_id=hire.hire_id,
                participant_ids=[employer.user_id, current_user.id],
                status='active'
            )
            db.add(conversation)
            db.commit()
    
    return {"message": "Hire request accepted", "status": "accepted"}


@router.post("/{hire_id}/reject")
def reject_hire(
    hire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a direct hire request (worker only)"""
    worker = get_worker_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.worker_id == worker.worker_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Hire request not found")
    
    if hire.status != DirectHireStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only reject pending requests")
    
    hire.status = DirectHireStatus.REJECTED
    db.commit()
    
    # Send notification to employer that worker rejected
    employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first()
    if employer:
        worker_name = f"{current_user.first_name} {current_user.last_name}"
        notify_direct_hire_rejected(
            db=db,
            employer_user_id=employer.user_id,
            worker_name=worker_name,
            hire_id=hire.hire_id
        )
    
    return {"message": "Hire request rejected", "status": "rejected"}


@router.post("/{hire_id}/start")
def start_work(
    hire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark work as started (worker only)"""
    worker = get_worker_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.worker_id == worker.worker_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Hire not found")
    
    if hire.status != DirectHireStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Hire must be accepted first")
    
    hire.status = DirectHireStatus.IN_PROGRESS
    db.commit()
    
    return {"message": "Work started", "status": "in_progress"}


@router.post("/{hire_id}/submit-completion")
def submit_completion(
    hire_id: int,
    completion_data: CompletionSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit work completion (worker only)"""
    worker = get_worker_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.worker_id == worker.worker_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Hire not found")
    
    if hire.status != DirectHireStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Work must be in progress to submit completion")
    
    hire.completion_proof_url = completion_data.completion_proof_url
    hire.completion_notes = completion_data.completion_notes
    hire.completed_at = func.now()
    hire.status = DirectHireStatus.PENDING_COMPLETION
    db.commit()
    
    # Send notification to employer that worker submitted completion
    employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first()
    if employer:
        worker_name = f"{current_user.first_name} {current_user.last_name}"
        notify_direct_hire_completed(
            db=db,
            employer_user_id=employer.user_id,
            worker_name=worker_name,
            hire_id=hire.hire_id
        )
    
    return {"message": "Completion submitted for approval", "status": "pending_completion"}


@router.post("/{hire_id}/confirm-payment")
def confirm_payment_received(
    hire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm payment received (worker only) - for cash payments"""
    worker = get_worker_for_user(current_user.id, db)
    
    hire = db.query(DirectHire).filter(
        DirectHire.hire_id == hire_id,
        DirectHire.worker_id == worker.worker_id
    ).first()
    
    if not hire:
        raise HTTPException(status_code=404, detail="Hire not found")
    
    # For direct hires, employer marks as paid after completion
    # Worker can confirm if needed
    if hire.status == DirectHireStatus.COMPLETED:
        hire.paid_at = func.now()
        hire.status = DirectHireStatus.PAID
        db.commit()
        return {"message": "Payment confirmed", "status": "paid"}
    
    return {"message": "No action needed", "status": hire.status.value}


# ============== PUBLIC ENDPOINTS ==============

@router.get("/workers", response_model=List[dict])
def browse_workers(
    city: Optional[str] = None,
    min_rating: Optional[float] = None,
    sort_by: Optional[str] = None,  # "rating", "jobs_completed"
    db: Session = Depends(get_db)
):
    """Browse available workers with their packages"""
    from app.models_v2.application import HousekeeperApplication, ApplicationStatus
    from app.models_v2.rating import Rating
    from sqlalchemy import func
    
    # Get all approved housekeepers
    query = db.query(Worker).join(
        User, Worker.user_id == User.id
    ).join(
        HousekeeperApplication, HousekeeperApplication.user_id == User.id
    ).filter(
        HousekeeperApplication.status == ApplicationStatus.APPROVED,
        User.is_housekeeper == True
    )
    
    workers = query.all()
    
    result = []
    for worker in workers:
        user = db.query(User).filter(User.id == worker.user_id).first()
        address = db.query(Address).filter(Address.user_id == worker.user_id).first()
        
        # Filter by city if specified
        if city and address and address.city_name and address.city_name.lower() != city.lower():
            continue
        
        # Get rating summary for this worker
        ratings = db.query(Rating).filter(Rating.rated_user_id == user.id).all()
        avg_rating = round(sum(r.stars for r in ratings) / len(ratings), 1) if ratings else 0.0
        total_ratings = len(ratings)
        
        # Filter by minimum rating if specified
        if min_rating and avg_rating < min_rating:
            continue
        
        # Get active packages
        packages = db.query(WorkerPackage).filter(
            WorkerPackage.worker_id == worker.worker_id,
            WorkerPackage.is_active == True
        ).all()
        
        result.append({
            "worker_id": worker.worker_id,
            "user_id": worker.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "city": address.city_name if address else None,
            "barangay": address.barangay_name if address else None,
            "package_count": len(packages),
            "average_rating": avg_rating,
            "total_ratings": total_ratings,
            "packages": [
                {
                    "package_id": p.package_id,
                    "name": p.name,
                    "price": float(p.price),
                    "duration_hours": p.duration_hours
                }
                for p in packages
            ]
        })
    
    # Sort results
    if sort_by == "rating":
        result.sort(key=lambda x: x["average_rating"], reverse=True)
    elif sort_by == "jobs_completed":
        result.sort(key=lambda x: x["total_ratings"], reverse=True)
    
    return result


@router.get("/worker/{worker_id}/profile")
def get_worker_profile(
    worker_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed worker profile with packages and ratings"""
    from app.models_v2.rating import Rating
    
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    user = db.query(User).filter(User.id == worker.user_id).first()
    address = db.query(Address).filter(Address.user_id == worker.user_id).first()
    
    # Get active packages
    packages = db.query(WorkerPackage).filter(
        WorkerPackage.worker_id == worker_id,
        WorkerPackage.is_active == True
    ).order_by(WorkerPackage.price.asc()).all()
    
    # Get completed direct hires count
    completed_hires = db.query(DirectHire).filter(
        DirectHire.worker_id == worker_id,
        DirectHire.status == DirectHireStatus.PAID
    ).count()
    
    # Get rating summary
    ratings = db.query(Rating).filter(Rating.rated_user_id == user.id).all()
    avg_rating = round(sum(r.stars for r in ratings) / len(ratings), 1) if ratings else 0.0
    total_ratings = len(ratings)
    
    # Calculate rating breakdown
    rating_breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for r in ratings:
        rating_breakdown[r.stars] += 1
    
    # Get recent reviews (last 5)
    recent_reviews = []
    for r in sorted(ratings, key=lambda x: x.created_at, reverse=True)[:5]:
        rater = db.query(User).filter(User.id == r.rater_id).first()
        recent_reviews.append({
            "rating_id": r.rating_id,
            "stars": r.stars,
            "review": r.review,
            "rater_name": f"{rater.first_name} {rater.last_name[0]}." if rater else "Anonymous",
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    
    # Mask phone number for privacy (show last 4 digits)
    phone_masked = None
    if user.phone_number:
        phone_masked = "****" + user.phone_number[-4:] if len(user.phone_number) >= 4 else "****"
    
    return {
        "worker_id": worker.worker_id,
        "user_id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone_masked": phone_masked,
        "email_masked": user.email.split('@')[0][:3] + "***@" + user.email.split('@')[1] if '@' in user.email else None,
        "city": address.city_name if address else None,
        "barangay": address.barangay_name if address else None,
        "province": address.province_name if address else None,
        "region": address.region_name if address else None,
        "member_since": str(user.created_at.date()) if user.created_at else None,
        "completed_jobs": completed_hires,
        "is_verified": user.status.value == "active",
        "average_rating": avg_rating,
        "total_ratings": total_ratings,
        "rating_breakdown": rating_breakdown,
        "recent_reviews": recent_reviews,
        "packages": [
            {
                "package_id": p.package_id,
                "name": p.name,
                "description": p.description,
                "price": float(p.price),
                "duration_hours": p.duration_hours,
                "services": p.services or []
            }
            for p in packages
        ]
    }
