"""
Job posting endpoints using ForumPost model
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from sqlalchemy.sql import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import json
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Employer, Worker
from app.models_v2.forum import ForumPost, ForumPostStatus, InterestCheck, InterestStatus, JobType
from app.models_v2.contract import Contract
from app.models_v2.conversation import Conversation
from app.models_v2.payment import PaymentSchedule, PaymentStatus, PaymentTransaction
from app.security import get_current_user
from app.schemas.job import JobPostCreate, JobPostResponse, JobPostUpdate
from app.services.notification_service import (
    notify_job_application,
    notify_application_accepted,
    notify_application_rejected,
    notify_completion_submitted,
    notify_completion_approved,
    notify_payment_sent,
    notify_payment_received
)

router = APIRouter(prefix="/jobs", tags=["jobs"])

def get_or_create_employer(user_id: int, db: Session) -> int:
    """Get or create employer record for user"""
    employer = db.query(Employer).filter(Employer.user_id == user_id).first()
    if not employer:
        employer = Employer(user_id=user_id)
        db.add(employer)
        db.commit()
        db.refresh(employer)
    return employer.employer_id

@router.post("/", response_model=JobPostResponse, status_code=status.HTTP_201_CREATED)
def create_job_post(
    job_data: JobPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new job posting (owners only)"""
    
    # Check if user is an owner
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only house owners can create job posts"
        )
    
    # Get or create employer record
    employer_id = get_or_create_employer(current_user.id, db)
    
    # Store job details as JSON in description field
    job_details = {
        "description": job_data.description,
        "house_type": job_data.house_type,
        "cleaning_type": job_data.cleaning_type,
        "budget": job_data.budget,
        "people_needed": job_data.people_needed,
        "image_urls": job_data.image_urls,
        "duration_type": job_data.duration_type,
        "start_date": job_data.start_date.isoformat() if job_data.start_date else None,
        "end_date": job_data.end_date.isoformat() if job_data.end_date else None,
        "location": job_data.location
    }
    
    # Add payment schedule if provided (for long-term jobs)
    if job_data.payment_schedule:
        job_details["payment_schedule"] = {
            "frequency": job_data.payment_schedule.frequency,
            "payment_amount": job_data.payment_schedule.payment_amount,
            "payment_dates": job_data.payment_schedule.payment_dates,
            "payment_method_preference": job_data.payment_schedule.payment_method_preference
        }
    
    # Handle recurring schedule
    is_recurring = False
    day_of_week = None
    start_time = None
    end_time = None
    frequency = None
    recurring_status = None
    
    if job_data.recurring_schedule and job_data.recurring_schedule.is_recurring:
        is_recurring = True
        day_of_week = job_data.recurring_schedule.day_of_week
        start_time = job_data.recurring_schedule.start_time
        end_time = job_data.recurring_schedule.end_time
        frequency = job_data.recurring_schedule.frequency
        recurring_status = "active"
    
    # Map schema fields to model fields
    job_type = JobType.LONGTERM if job_data.duration_type == "long_term" else JobType.ONETIME
    
    post = ForumPost(
        employer_id=employer_id,
        user_id=current_user.id,
        title=job_data.title,
        content=json.dumps(job_details),
        location=job_data.location or "Not specified",
        job_type=job_type,
        salary=job_data.budget,
        category_id=job_data.category_id,
        is_longterm=(job_data.duration_type == "long_term"),
        start_date=job_data.start_date.isoformat() if job_data.start_date else None,
        end_date=job_data.end_date.isoformat() if job_data.end_date else None,
        payment_frequency=job_data.payment_schedule.frequency if job_data.payment_schedule else None,
        payment_amount=job_data.payment_schedule.payment_amount if job_data.payment_schedule else None,
        payment_schedule=json.dumps(job_details.get("payment_schedule")) if job_data.payment_schedule else None,
        status=ForumPostStatus.OPEN,
        is_recurring=is_recurring,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        frequency=frequency,
        recurring_status=recurring_status
    )
    
    db.add(post)
    db.commit()
    db.refresh(post)
    
    return JobPostResponse.from_orm_model(post, current_user, 0)

@router.get("/", response_model=List[JobPostResponse])
def get_job_posts(
    skip: int = 0,
    limit: int = 20,
    status_filter: str = "open",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all job posts (filtered by status)"""
    
    query = db.query(ForumPost).options(
        joinedload(ForumPost.category)
    ).filter(ForumPost.deleted_at.is_(None))
    
    if status_filter and status_filter != "all":
        query = query.filter(ForumPost.status == status_filter)
    
    posts = query.order_by(desc(ForumPost.created_at)).offset(skip).limit(limit).all()
    
    result = []
    for post in posts:
        # Get employer user info
        employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
        employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else current_user
        
        # Count applicants
        applicants_count = db.query(InterestCheck).filter(InterestCheck.post_id == post.post_id).count()
        
        result.append(JobPostResponse.from_orm_model(post, employer_user, applicants_count))
    
    return result

@router.get("/my-posts", response_model=List[JobPostResponse])
def get_my_job_posts(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's job posts (owners only)
    
    Args:
        status_filter: Filter by status (open, closed, all). Default is all.
    """
    
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only house owners can view their job posts"
        )
    
    # Get employer record
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        return []
    
    # Build query with optional status filter
    query = db.query(ForumPost).filter(
        ForumPost.employer_id == employer.employer_id,
        ForumPost.deleted_at.is_(None)
    )
    
    # Apply status filter if specified
    if status_filter and status_filter.lower() != 'all':
        try:
            filter_status = ForumPostStatus(status_filter.lower())
            query = query.filter(ForumPost.status == filter_status)
        except ValueError:
            # Invalid status, ignore filter
            pass
    
    posts = query.order_by(desc(ForumPost.created_at)).all()
    
    result = []
    for post in posts:
        applicants_count = db.query(InterestCheck).filter(InterestCheck.post_id == post.post_id).count()
        
        # Get ACCEPTED workers from InterestCheck (not all contracts)
        accepted_interests = db.query(InterestCheck).filter(
            InterestCheck.post_id == post.post_id,
            InterestCheck.status == InterestStatus.ACCEPTED
        ).all()
        
        # Build accepted workers list with their info
        accepted_workers_list = []
        pending_payments_count = 0
        
        for interest in accepted_interests:
            worker = db.query(Worker).filter(Worker.worker_id == interest.worker_id).first()
            if worker:
                worker_user = db.query(User).filter(User.id == worker.user_id).first()
                # Get the contract for this worker
                contract = db.query(Contract).filter(
                    Contract.post_id == post.post_id,
                    Contract.worker_id == interest.worker_id
                ).first()
                if worker_user:
                    accepted_workers_list.append({
                        "worker_id": worker.worker_id,
                        "worker_user_id": worker_user.id,
                        "name": f"{worker_user.first_name} {worker_user.last_name}",
                        "contract_id": contract.contract_id if contract else None
                    })
                
                # Count pending payments for long-term ongoing jobs
                if contract and post.is_longterm and post.status == ForumPostStatus.ONGOING:
                    contract_pending = db.query(PaymentSchedule).filter(
                        PaymentSchedule.contract_id == contract.contract_id,
                        PaymentSchedule.status == PaymentStatus.PENDING
                    ).count()
                    pending_payments_count += contract_pending
        
        result.append(JobPostResponse.from_orm_model(
            post, current_user, applicants_count, pending_payments_count, accepted_workers_list
        ))
    
    return result


@router.get("/my-accepted-jobs", response_model=List[dict])
def get_my_accepted_jobs(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get jobs where current user is the accepted housekeeper
    
    Args:
        status_filter: Filter by job status (ongoing, completed, all). Default is all.
    
    Returns:
        List of jobs with contract and payment information
    """
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can view accepted jobs"
        )
    
    # Get worker record for current user
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        return []
    
    # Get all accepted interest checks for this worker
    query = db.query(InterestCheck).filter(
        InterestCheck.worker_id == worker_record.worker_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    )
    
    accepted_interests = query.all()
    
    if not accepted_interests:
        return []
    
    result = []
    for interest in accepted_interests:
        # Get the job post
        post = db.query(ForumPost).filter(
            ForumPost.post_id == interest.post_id,
            ForumPost.deleted_at.is_(None)
        ).first()
        
        if not post:
            continue
        
        # Get contract first (needed for status filtering)
        contract = db.query(Contract).filter(
            Contract.post_id == post.post_id,
            Contract.worker_id == worker_record.worker_id
        ).first()
        
        # Apply status filter based on CONTRACT status (worker's individual progress)
        if status_filter and status_filter.lower() != 'all':
            # Use contract status if available, otherwise job status
            if contract:
                contract_status = contract.status.value if hasattr(contract.status, 'value') else str(contract.status)
                if contract_status.lower() != status_filter.lower():
                    # Also check if 'active' should match 'ongoing'
                    if not (status_filter.lower() == 'ongoing' and contract_status.lower() == 'active'):
                        continue
            else:
                post_status = post.status.value if hasattr(post.status, 'value') else str(post.status)
                if post_status.lower() != status_filter.lower():
                    continue
        
        # Get employer info
        employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
        employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else None
        
        # Get payment schedules for this contract (contract already queried above)
        payment_schedules = []
        pending_payments = 0
        total_earned = 0
        next_payment_due = None
        
        if contract:
            schedules = db.query(PaymentSchedule).filter(
                PaymentSchedule.contract_id == contract.contract_id
            ).order_by(PaymentSchedule.due_date).all()
            
            for schedule in schedules:
                status_val = schedule.status.value if hasattr(schedule.status, 'value') else str(schedule.status)
                payment_schedules.append({
                    "schedule_id": schedule.schedule_id,
                    "due_date": schedule.due_date,
                    "amount": float(schedule.amount),
                    "status": status_val
                })
                
                if status_val == "pending":
                    pending_payments += 1
                    if not next_payment_due:
                        next_payment_due = schedule.due_date
                elif status_val == "confirmed":
                    total_earned += float(schedule.amount)
        
        # Parse job details
        job_details = {}
        if post.content and post.content.startswith('{'):
            try:
                job_details = json.loads(post.content)
            except:
                pass
        
        post_status = post.status.value if hasattr(post.status, 'value') else str(post.status)
        
        result.append({
            "post_id": post.post_id,
            "title": post.title,
            "description": job_details.get('description', ''),
            "location": post.location,
            "budget": float(post.salary) if post.salary else 0,
            "status": post_status,
            "start_date": post.start_date,
            "end_date": post.end_date,
            "is_longterm": post.is_longterm,
            "accepted_at": interest.created_at.isoformat() if interest.created_at else None,
            "employer": {
                "user_id": employer_user.id if employer_user else None,
                "name": f"{employer_user.first_name} {employer_user.last_name}" if employer_user else "Unknown",
                "email": employer_user.email if employer_user else None,
                "phone": employer_user.phone_number if employer_user else None
            },
            "contract": {
                "contract_id": contract.contract_id if contract else None,
                "status": contract.status.value if contract and hasattr(contract.status, 'value') else (str(contract.status) if contract else None)
            } if contract else None,
            "payments": {
                "total_schedules": len(payment_schedules),
                "pending_payments": pending_payments,
                "total_earned": total_earned,
                "next_payment_due": next_payment_due,
                "schedules": payment_schedules
            }
        })
    
    return result


@router.get("/{post_id}", response_model=JobPostResponse)
def get_job_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific job post"""
    
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Get employer user info
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else current_user
    
    applicants_count = db.query(InterestCheck).filter(InterestCheck.post_id == post.post_id).count()
    
    return JobPostResponse.from_orm_model(post, employer_user, applicants_count)

@router.put("/{post_id}", response_model=JobPostResponse)
def update_job_post(
    post_id: int,
    job_update: JobPostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a job post (owner only)"""
    
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own job posts"
        )
    
    # Update fields
    if job_update.title:
        post.title = job_update.title
    
    if job_update.category_id is not None:
        post.category_id = job_update.category_id
    
    if job_update.status:
        post.status = ForumPostStatus(job_update.status)
    
    # Update JSON description with new job details
    if any([job_update.description, job_update.house_type, job_update.cleaning_type, 
            job_update.budget, job_update.people_needed, job_update.image_urls,
            job_update.duration_type, job_update.start_date, job_update.end_date]):
        
        current_details = json.loads(post.content) if post.content else {}
        
        if job_update.description:
            current_details['description'] = job_update.description
        if job_update.house_type:
            current_details['house_type'] = job_update.house_type
        if job_update.cleaning_type:
            current_details['cleaning_type'] = job_update.cleaning_type
        if job_update.budget:
            current_details['budget'] = job_update.budget
            post.salary = job_update.budget
        if job_update.people_needed:
            current_details['people_needed'] = job_update.people_needed
        if job_update.image_urls is not None:
            current_details['image_urls'] = job_update.image_urls
        if job_update.duration_type:
            current_details['duration_type'] = job_update.duration_type
            post.is_longterm = (job_update.duration_type == 'long_term')
        if job_update.start_date:
            current_details['start_date'] = job_update.start_date.isoformat()
            post.start_date = job_update.start_date.isoformat()
        if job_update.end_date:
            current_details['end_date'] = job_update.end_date.isoformat()
            post.end_date = job_update.end_date.isoformat()
        
        post.content = json.dumps(current_details)
    
    db.commit()
    db.refresh(post)
    
    applicants_count = db.query(InterestCheck).filter(InterestCheck.post_id == post.post_id).count()
    return JobPostResponse.from_orm_model(post, current_user, applicants_count)

@router.delete("/{post_id}")
def delete_job_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a job post (owner only)"""
    
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own job posts"
        )
    
    post.deleted_at = func.now()
    post.status = ForumPostStatus.DELETED
    db.commit()
    
    return {"message": "Job post deleted successfully"}

@router.post("/{post_id}/apply", status_code=status.HTTP_201_CREATED)
def apply_to_job(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply to a job post (housekeepers only)"""
    
    # Check if user is a housekeeper
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can apply to jobs"
        )

    # Resolve the worker profile for the current user
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker profile not found for this user"
        )
    
    # Check if job post exists and is open
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.status == ForumPostStatus.OPEN,
        ForumPost.deleted_at.is_(None)
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found or is no longer open"
        )
    
    # Check if already applied
    existing_application = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == worker_record.worker_id
    ).first()
    
    if existing_application:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already applied to this job"
        )
    
    # Create interest check
    interest = InterestCheck(
        post_id=post_id,
        worker_id=worker_record.worker_id,
        status=InterestStatus.PENDING
    )
    
    db.add(interest)
    
    # Create contract record
    from app.models_v2.contract import Contract
    import json
    
    try:
        # Get job details for contract
        job_details = json.loads(post.content) if post.content else {}
        contract_terms = {
            "job_title": post.title,
            "job_type": job_details.get("job_type"),
            "location": job_details.get("location"),
            "description": job_details.get("description"),
            "start_date": job_details.get("start_date"),
            "end_date": job_details.get("end_date"),
            "budget": job_details.get("budget"),
            "payment_schedule": job_details.get("payment_schedule"),
            "employer_name": "Employer"  # Will be populated from user data later
        }
        
        contract = Contract(
            post_id=post_id,
            employer_id=post.employer_id,  # Get from the job post
            worker_id=worker_record.worker_id,
            contract_terms=json.dumps(contract_terms),  # Convert dict to JSON string
            worker_accepted=1,  # 1 = accepted (integer, not boolean)
            employer_accepted=0  # 0 = pending
        )
        
        db.add(contract)
    except Exception as e:
        print(f"Warning: Could not create contract: {e}")
        import traceback
        traceback.print_exc()
    
    db.commit()
    db.refresh(interest)
    
    # Notify employer about new application
    try:
        employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
        if employer:
            employer_user = db.query(User).filter(User.id == employer.user_id).first()
            if employer_user:
                worker_name = f"{current_user.first_name} {current_user.last_name}"
                notify_job_application(
                    db=db,
                    employer_user_id=employer_user.id,
                    worker_name=worker_name,
                    job_title=post.title,
                    post_id=post_id
                )
    except Exception as e:
        print(f"Warning: Could not send notification: {e}")
    
    return {
        "message": "Application submitted successfully",
        "interest_id": interest.interest_id,
        "status": interest.status
    }

@router.get("/{post_id}/application-status")
def get_application_status(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user has applied to this job"""
    
    if not current_user.is_housekeeper:
        return {"has_applied": False}

    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        return {"has_applied": False}
    
    application = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == worker_record.worker_id
    ).first()
    
    if not application:
        return {"has_applied": False}
    
    return {
        "has_applied": True,
        "status": application.status,
        "applied_at": application.created_at.isoformat()
    }

@router.get("/{post_id}/applicants")
def get_job_applicants(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all applicants for a job post (owner only)"""
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view applicants for your own job posts"
        )
    
    # Get all applicants
    applications = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id
    ).all()
    
    result = []
    for app in applications:
        # Get Worker record first, then User
        worker_record = db.query(Worker).filter(Worker.worker_id == app.worker_id).first()
        if worker_record:
            user = db.query(User).filter(User.id == worker_record.user_id).first()
            if user:
                # Get status value
                status_val = app.status.value if hasattr(app.status, 'value') else str(app.status)
                result.append({
                    "interest_id": app.interest_id,
                    "worker_id": app.worker_id,
                    "worker_name": f"{user.first_name} {user.last_name}",
                    "worker_email": user.email,
                    "worker_phone": user.phone_number,
                    "status": status_val,
                    "applied_at": app.created_at.isoformat() if app.created_at else ""
                })
    
    return result

@router.put("/{post_id}/applicants/{interest_id}")
def update_applicant_status(
    post_id: int,
    interest_id: int,
    status_update: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject an applicant (owner only). Accepting is done via start-job endpoint."""
    
    # Only allow rejection through this endpoint now
    if status_update not in ["rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /start-job endpoint to accept applicants"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage applicants for your own job posts"
        )
    
    # Update application status
    application = db.query(InterestCheck).filter(
        InterestCheck.interest_id == interest_id,
        InterestCheck.post_id == post_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    application.status = InterestStatus.REJECTED
    db.commit()
    
    # Notify worker about rejection
    try:
        worker = db.query(Worker).filter(Worker.worker_id == application.worker_id).first()
        if worker:
            notify_application_rejected(
                db=db,
                worker_user_id=worker.user_id,
                job_title=post.title,
                post_id=post_id
            )
    except Exception as e:
        print(f"Warning: Could not send rejection notification: {e}")
    
    return {
        "message": "Applicant rejected",
        "interest_id": interest_id,
        "status": "rejected"
    }


class StartJobRequest(BaseModel):
    """Request body for starting a job with selected applicants"""
    selected_applicants: List[int]  # List of interest_ids


@router.post("/{post_id}/start-job")
def start_job(
    post_id: int,
    request: StartJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a job by accepting selected applicants and transitioning to ONGOING status"""
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage your own job posts"
        )
    
    # Get job details to check people_needed
    job_details = {}
    if post.content and post.content.startswith('{'):
        try:
            job_details = json.loads(post.content)
        except:
            pass
    
    people_needed = job_details.get('people_needed', 1)
    
    # Count already accepted workers
    already_accepted = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    ).count()
    
    # Validate selected count
    total_workers = already_accepted + len(request.selected_applicants)
    if total_workers != people_needed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Must select exactly {people_needed} workers. Currently have {already_accepted} accepted + {len(request.selected_applicants)} selected = {total_workers}"
        )
    
    # Accept all selected applicants
    accepted_workers = []
    for interest_id in request.selected_applicants:
        application = db.query(InterestCheck).filter(
            InterestCheck.interest_id == interest_id,
            InterestCheck.post_id == post_id
        ).first()
        
        if not application:
            continue
            
        if application.status != InterestStatus.PENDING:
            continue
        
        # Accept this applicant
        application.status = InterestStatus.ACCEPTED
        
        # Get worker info
        worker = db.query(Worker).filter(Worker.worker_id == application.worker_id).first()
        worker_user = db.query(User).filter(User.id == worker.user_id).first() if worker else None
        worker_name = f"{worker_user.first_name} {worker_user.last_name}" if worker_user else "Worker"
        accepted_workers.append(worker_name)
        
        # Notify worker that they've been accepted
        if worker_user:
            try:
                notify_application_accepted(
                    db=db,
                    worker_user_id=worker_user.id,
                    job_title=post.title,
                    post_id=post_id
                )
            except Exception as e:
                print(f"Warning: Could not send acceptance notification: {e}")
            
            # Auto-create conversation for job owner and accepted worker
            try:
                existing_conv = db.query(Conversation).filter(
                    Conversation.job_id == post_id,
                    Conversation.participant_ids.contains([current_user.id, worker_user.id])
                ).first()
                
                if not existing_conv:
                    # Create conversation with owner and this worker as participants
                    conversation = Conversation(
                        job_id=post_id,
                        participant_ids=[current_user.id, worker_user.id],
                        status='active'
                    )
                    db.add(conversation)
            except Exception as e:
                print(f"Warning: Could not create conversation: {e}")
        
        # Update contract status to ACTIVE
        from app.models_v2.contract import ContractStatus
        contract = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.worker_id == application.worker_id
        ).first()
        
        if contract:
            contract.status = ContractStatus.ACTIVE
            contract.employer_accepted = 1  # Owner has accepted
        
        # Create payment schedules for this worker ONLY for long-term jobs
        # Double-check both is_longterm flag AND duration_type from job details
        duration_type = job_details.get('duration_type', 'short_term')
        is_actually_longterm = post.is_longterm and duration_type == 'long_term'
        
        if is_actually_longterm:
            try:
                payment_schedule_data = job_details.get('payment_schedule')
                
                # Find the contract for this worker (already queried above)
                if contract and payment_schedule_data:
                    from app.models_v2.payment import PaymentSchedule, PaymentStatus
                    from datetime import datetime, timedelta
                    
                    start_date = datetime.strptime(job_details.get('start_date'), '%Y-%m-%d') if job_details.get('start_date') else datetime.now()
                    end_date = datetime.strptime(job_details.get('end_date'), '%Y-%m-%d') if job_details.get('end_date') else (datetime.now() + timedelta(days=365))
                    
                    payment_amount = float(payment_schedule_data.get('payment_amount', job_details.get('budget', 0)))
                    frequency = payment_schedule_data.get('frequency', 'monthly')
                    payment_dates = payment_schedule_data.get('payment_dates', ['15', '30'])
                    
                    payments_created = 0
                    created_dates = set()  # Track created dates to prevent duplicates
                    
                    if frequency == 'monthly':
                        # Generate all payment dates between start and end
                        current_month = start_date.replace(day=1)
                        while current_month <= end_date:
                            for day_str in payment_dates:
                                try:
                                    day = int(day_str)
                                    # Handle months with fewer days
                                    try:
                                        payment_date = current_month.replace(day=min(day, 28))
                                    except ValueError:
                                        payment_date = current_month.replace(day=28)
                                    
                                    date_str = payment_date.strftime('%Y-%m-%d')
                                    
                                    # Only create if within range AND not already created
                                    if start_date <= payment_date <= end_date and date_str not in created_dates:
                                        schedule = PaymentSchedule(
                                            contract_id=contract.contract_id,
                                            worker_id=application.worker_id,
                                            worker_name=worker_name,
                                            due_date=date_str,
                                            amount=payment_amount,
                                            status=PaymentStatus.PENDING
                                        )
                                        db.add(schedule)
                                        created_dates.add(date_str)
                                        payments_created += 1
                                except ValueError:
                                    pass
                            
                            # Move to next month
                            if current_month.month == 12:
                                current_month = current_month.replace(year=current_month.year + 1, month=1, day=1)
                            else:
                                current_month = current_month.replace(month=current_month.month + 1, day=1)
                    
                    elif frequency == 'weekly':
                        current_date = start_date
                        while current_date <= end_date:
                            date_str = current_date.strftime('%Y-%m-%d')
                            if date_str not in created_dates:
                                schedule = PaymentSchedule(
                                    contract_id=contract.contract_id,
                                    worker_id=application.worker_id,
                                    worker_name=worker_name,
                                    due_date=date_str,
                                    amount=payment_amount,
                                    status=PaymentStatus.PENDING
                                )
                                db.add(schedule)
                                created_dates.add(date_str)
                                payments_created += 1
                            current_date += timedelta(days=7)
                    
                    elif frequency == 'biweekly':
                        current_date = start_date
                        while current_date <= end_date:
                            date_str = current_date.strftime('%Y-%m-%d')
                            if date_str not in created_dates:
                                schedule = PaymentSchedule(
                                    contract_id=contract.contract_id,
                                    worker_id=application.worker_id,
                                    worker_name=worker_name,
                                    due_date=date_str,
                                    amount=payment_amount,
                                    status=PaymentStatus.PENDING
                                )
                                db.add(schedule)
                                created_dates.add(date_str)
                                payments_created += 1
                            current_date += timedelta(days=14)
                    
                    else:
                        # One-time or custom - single payment at end
                        date_str = end_date.strftime('%Y-%m-%d')
                        schedule = PaymentSchedule(
                            contract_id=contract.contract_id,
                            worker_id=application.worker_id,
                            worker_name=worker_name,
                            due_date=date_str,
                            amount=payment_amount,
                            status=PaymentStatus.PENDING
                        )
                        db.add(schedule)
                        payments_created += 1
                    
                    print(f"DEBUG: Created {payments_created} payment schedules for {worker_name}")
            except Exception as e:
                print(f"ERROR creating payment schedule for {worker_name}: {e}")
                import traceback
                traceback.print_exc()
    
    # Transition job to ONGOING
    post.status = ForumPostStatus.ONGOING
    db.commit()
    
    return {
        "message": f"Job started with {len(accepted_workers)} worker(s)!",
        "post_id": post_id,
        "status": "ongoing",
        "accepted_workers": accepted_workers
    }


@router.put("/{post_id}/status")
def update_job_status(
    post_id: int,
    new_status: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update job status (owner only). Allowed transitions: open->cancelled, ongoing->completed"""
    
    # Validate status
    valid_statuses = ["ongoing", "completed", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be one of: {', '.join(valid_statuses)}"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update status for your own job posts"
        )
    
    # Validate status transitions
    current_status = post.status.value
    allowed_transitions = {
        "open": ["cancelled"],  # Can cancel open jobs
        "ongoing": ["completed"],  # Can complete ongoing jobs
        "pending_completion": ["completed"],  # Can complete from pending
        "completed": [],  # Cannot transition from completed
        "cancelled": []  # Cannot transition from cancelled
    }
    
    if new_status not in allowed_transitions.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{current_status}' to '{new_status}'"
        )
    
    # Update status
    post.status = ForumPostStatus(new_status)
    db.commit()
    
    return {
        "message": f"Job status updated to {new_status}",
        "post_id": post_id,
        "status": new_status
    }


# ============== HOUSEKEEPER JOB COMPLETION ENDPOINTS ==============

class JobCompletionRequest(BaseModel):
    """Request body for job completion"""
    proof_url: Optional[str] = None  # URL to proof image/video
    notes: Optional[str] = None  # Notes from housekeeper


@router.post("/{post_id}/submit-completion")
def submit_job_completion(
    post_id: int,
    completion_data: JobCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Housekeeper submits proof of job completion
    
    This marks the worker's CONTRACT as pending_completion (not the whole job).
    Job moves to pending_completion when at least one worker has submitted.
    """
    from app.models_v2.contract import ContractStatus
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can submit job completion"
        )
    
    # Get worker record
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker profile not found"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check if job is ongoing or pending_completion (others may have submitted)
    if post.status not in [ForumPostStatus.ONGOING, ForumPostStatus.PENDING_COMPLETION]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only complete jobs that are ongoing. Current status: {post.status.value}"
        )
    
    # For long-term jobs, completion is handled automatically when all payments are confirmed
    # Housekeepers should NOT manually submit completion proofs
    if post.is_longterm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Long-term jobs are completed automatically when all scheduled payments are confirmed. You don't need to submit a completion proof."
        )
    
    # Get this worker's contract for this job
    contract = db.query(Contract).filter(
        Contract.post_id == post_id,
        Contract.worker_id == worker_record.worker_id
    ).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this job"
        )
    
    # Check if already submitted
    if contract.status == ContractStatus.PENDING_COMPLETION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted completion for this job"
        )
    
    if contract.status == ContractStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your work on this job has already been completed"
        )
    
    # Update this worker's contract with completion details
    contract.status = ContractStatus.PENDING_COMPLETION
    contract.completion_proof_url = completion_data.proof_url
    contract.completion_notes = completion_data.notes
    contract.completed_at = func.now()
    
    # Update job status to pending_completion if not already
    if post.status == ForumPostStatus.ONGOING:
        post.status = ForumPostStatus.PENDING_COMPLETION
    
    db.commit()
    
    # Send notification to owner about job completion submission
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if employer:
        worker_name = f"{current_user.first_name} {current_user.last_name}"
        notify_completion_submitted(
            db=db,
            employer_user_id=employer.user_id,
            worker_name=worker_name,
            job_title=post.title,
            post_id=post_id
        )
    
    return {
        "message": "Job completion submitted successfully. Waiting for owner approval.",
        "post_id": post_id,
        "contract_id": contract.contract_id,
        "status": "pending_completion"
    }


@router.post("/{post_id}/approve-completion")
def approve_job_completion(
    post_id: int,
    contract_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Owner approves job completion for a specific worker or all workers
    
    If contract_id is provided, approves only that worker.
    If not provided (legacy), approves all pending workers.
    Job completes when ALL workers are approved.
    """
    from app.models_v2.contract import ContractStatus
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only approve completion for your own job posts"
        )
    
    # Check if job is pending completion
    if post.status != ForumPostStatus.PENDING_COMPLETION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is not pending completion. Current status: {post.status.value}"
        )
    
    if contract_id:
        # Approve specific worker
        contract = db.query(Contract).filter(
            Contract.contract_id == contract_id,
            Contract.post_id == post_id
        ).first()
        
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        
        if contract.status != ContractStatus.PENDING_COMPLETION:
            raise HTTPException(
                status_code=400,
                detail="This worker has not submitted completion proof yet"
            )
        
        # Mark this contract as completed (but not paid yet for short-term)
        contract.status = ContractStatus.COMPLETED
        db.commit()
        
        # Send notification to worker that their completion was approved
        worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
        if worker:
            notify_completion_approved(
                db=db,
                worker_user_id=worker.user_id,
                job_title=post.title,
                post_id=post_id
            )
        
        # Check if ALL contracts are now completed
        all_contracts = db.query(Contract).filter(Contract.post_id == post_id).all()
        all_completed = all(c.status == ContractStatus.COMPLETED for c in all_contracts)
        
        if all_completed:
            post.status = ForumPostStatus.COMPLETED
            post.completed_at = func.now()
            db.commit()
        
        return {
            "message": "Worker completion approved!",
            "contract_id": contract_id,
            "all_completed": all_completed,
            "status": "completed" if all_completed else "pending_completion"
        }
    else:
        # Legacy: approve all pending contracts
        contracts = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.status == ContractStatus.PENDING_COMPLETION
        ).all()
        
        for contract in contracts:
            contract.status = ContractStatus.COMPLETED
            # Send notification to each worker
            worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
            if worker:
                notify_completion_approved(
                    db=db,
                    worker_user_id=worker.user_id,
                    job_title=post.title,
                    post_id=post_id
                )
        
        # Check if ALL contracts are now completed
        all_contracts = db.query(Contract).filter(Contract.post_id == post_id).all()
        all_completed = all(c.status == ContractStatus.COMPLETED for c in all_contracts)
        
        if all_completed:
            post.status = ForumPostStatus.COMPLETED
            post.completed_at = func.now()
        
        db.commit()
        
        return {
            "message": "Job completion approved!",
            "post_id": post_id,
            "status": "completed" if all_completed else "pending_completion"
        }


@router.get("/{post_id}/completion-details")
def get_completion_details(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get job completion details (for owner to review proof from all workers)"""
    from app.models_v2.contract import ContractStatus
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership (owner can view) or worker assignment
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    is_owner = employer and employer.user_id == current_user.id
    
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    is_worker = False
    if worker_record:
        contract = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.worker_id == worker_record.worker_id
        ).first()
        is_worker = contract is not None
    
    if not is_owner and not is_worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this job's completion details"
        )
    
    # Get all contracts and their completion status
    contracts = db.query(Contract).filter(Contract.post_id == post_id).all()
    
    workers_completion = []
    for contract in contracts:
        worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
        worker_user = db.query(User).filter(User.id == worker.user_id).first() if worker else None
        
        workers_completion.append({
            "contract_id": contract.contract_id,
            "worker_id": contract.worker_id,
            "worker_user_id": worker_user.id if worker_user else None,
            "worker_name": f"{worker_user.first_name} {worker_user.last_name}" if worker_user else "Unknown",
            "status": contract.status.value if hasattr(contract.status, 'value') else str(contract.status),
            "completion_proof_url": contract.completion_proof_url,
            "completion_notes": contract.completion_notes,
            "completed_at": contract.completed_at.isoformat() if contract.completed_at else None,
            "payment_proof_url": contract.payment_proof_url,
            "paid_at": contract.paid_at.isoformat() if contract.paid_at else None
        })
    
    # Parse budget from content
    import json
    custom_fields = {}
    if post.content and post.content.startswith('{'):
        try:
            custom_fields = json.loads(post.content)
        except:
            pass
    
    budget = float(post.salary) if post.salary else custom_fields.get('budget', 0)
    
    return {
        "post_id": post.post_id,
        "title": post.title,
        "status": post.status.value,
        "duration_type": "long_term" if post.is_longterm else "short_term",
        "budget": budget,
        "workers": workers_completion,
        # Legacy fields for backward compatibility
        "completion_proof_url": post.completion_proof_url,
        "completion_notes": post.completion_notes,
        "completed_at": post.completed_at.isoformat() if post.completed_at else None
    }


class ShortTermPaymentRequest(BaseModel):
    """Request body for short-term job payment"""
    amount: float
    proof_url: Optional[str] = None
    contract_id: Optional[int] = None  # For paying specific worker
    payment_method: Optional[str] = "cash"  # gcash, maya, bank_transfer, cash
    reference_number: Optional[str] = None


@router.post("/{post_id}/record-short-term-payment")
def record_short_term_payment(
    post_id: int,
    payment_data: ShortTermPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record payment for a short-term job (owner only)
    
    If contract_id is provided, records payment for that specific worker.
    Otherwise records for first contract (legacy behavior).
    """
    from app.models_v2.contract import ContractStatus
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only record payments for your own jobs"
        )
    
    # Get contract for this job
    if payment_data.contract_id:
        contract = db.query(Contract).filter(
            Contract.contract_id == payment_data.contract_id,
            Contract.post_id == post_id
        ).first()
    else:
        contract = db.query(Contract).filter(Contract.post_id == post_id).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No contract found for this job"
        )
    
    # Update contract with payment info
    contract.payment_proof_url = payment_data.proof_url
    contract.paid_at = func.now()
    
    # Create a payment schedule entry for this short-term job
    worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
    worker_user = db.query(User).filter(User.id == worker.user_id).first() if worker else None
    worker_name = f"{worker_user.first_name} {worker_user.last_name}" if worker_user else "Worker"
    
    payment = PaymentSchedule(
        contract_id=contract.contract_id,
        due_date=func.now(),
        amount=payment_data.amount,
        status=PaymentStatus.CONFIRMED,  # CONFIRMED = payment completed
        worker_id=contract.worker_id,
        worker_name=worker_name
    )
    
    db.add(payment)
    db.flush()  # Get the schedule_id
    
    # Create a transaction record with payment details
    transaction = PaymentTransaction(
        schedule_id=payment.schedule_id,
        amount_paid=payment_data.amount,
        payment_method=payment_data.payment_method,
        reference_number=payment_data.reference_number,
        payment_proof_url=payment_data.proof_url,  # Match database column name
        paid_at=func.now(),  # Match database column name
        confirmed_at=func.now(),
        confirmed_by_worker=False
    )
    db.add(transaction)
    
    # For short-term jobs, check if ALL workers are now paid
    # If so, mark job as completed
    all_contracts = db.query(Contract).filter(Contract.post_id == post_id).all()
    all_paid = all(c.paid_at is not None for c in all_contracts)
    
    if all_paid:
        post.status = ForumPostStatus.COMPLETED
        post.completed_at = func.now()
    
    db.commit()
    
    # Send notification to worker about payment (for short-term, owner records payment directly)
    if worker and worker_user:
        notify_payment_sent(
            db=db,
            worker_user_id=worker_user.id,
            job_title=post.title,
            amount=payment_data.amount,
            post_id=post_id
        )
    
    return {
        "message": f"Payment to {worker_name} recorded successfully",
        "post_id": post_id,
        "contract_id": contract.contract_id,
        "amount": payment_data.amount,
        "status": "paid",
        "all_paid": all_paid,
        "job_completed": all_paid
    }


# ============== PAYMENT REPORTING ENDPOINTS ==============

class ReportUnpaidRequest(BaseModel):
    """Request body for reporting unpaid job"""
    reason: str
    days_overdue: Optional[int] = None
    evidence_urls: Optional[List[str]] = None

@router.post("/{post_id}/report-unpaid")
def report_unpaid_job(
    post_id: int,
    report_data: ReportUnpaidRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Housekeeper reports that owner hasn't paid for the job"""
    from app.models_v2.report import Report, ReportType, ReportStatus
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can report unpaid jobs"
        )
    
    # Get worker record
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker profile not found"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Get the employer/owner for this job
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    owner_user_id = employer.user_id if employer else None
    
    # Check if this worker is assigned to this job
    interest = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == worker_record.worker_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    ).first()
    
    if not interest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this job"
        )
    
    # Create report in database
    days_info = f" ({report_data.days_overdue} days overdue)" if report_data.days_overdue else ""
    report = Report(
        reporter_id=current_user.id,
        reporter_role="housekeeper",
        reported_user_id=owner_user_id,
        post_id=post_id,
        report_type=ReportType.UNPAID_JOB,
        title=f"Unpaid Job: {post.title}",
        description=f"{report_data.reason}{days_info}",
        evidence_urls=json.dumps(report_data.evidence_urls) if report_data.evidence_urls else None,
        status=ReportStatus.PENDING
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {
        "message": "Report submitted successfully. Our team will review this case.",
        "report_id": report.report_id,
        "post_id": post_id,
        "status": "pending"
    }


class ReportNonPerformanceRequest(BaseModel):
    """Request body for reporting housekeeper non-performance"""
    worker_id: int
    reason: str
    report_type: str = "non_completion"  # non_completion, poor_quality, no_show
    evidence_urls: Optional[List[str]] = None

class CancelRecurringJobRequest(BaseModel):
    reason: Optional[str] = None  # Reason for cancellation

@router.post("/{post_id}/cancel-recurring", response_model=JobPostResponse)
def cancel_recurring_job(
    post_id: int,
    cancel_data: CancelRecurringJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel/stop a recurring job posting (employer or worker)"""
    from datetime import datetime
    
    # Get the job post
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Job post not found")
    
    # Check if it's a recurring job
    if not post.is_recurring:
        raise HTTPException(
            status_code=400,
            detail="This is not a recurring job"
        )
    
    # Check if already cancelled
    if hasattr(post, 'recurring_status') and post.recurring_status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="This recurring job is already cancelled"
        )
    
    # Verify user has permission
    # Employer can always cancel their own job
    is_employer = post.user_id == current_user.id
    
    # Worker can cancel if they have an accepted application/contract
    is_worker = False
    if not is_employer:
        from app.models_v2.contract import Contract, ContractStatus
        contract = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.status == ContractStatus.ACTIVE
        ).first()
        if contract:
            worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
            if worker and worker.user_id == current_user.id:
                is_worker = True
    
    if not (is_employer or is_worker):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to cancel this job"
        )
    
    # Determine who cancelled
    cancelled_by_role = "employer" if is_employer else "worker"
    
    # Update recurring status
    post.recurring_status = "cancelled"
    post.recurring_cancelled_at = datetime.now()
    post.recurring_cancellation_reason = cancel_data.reason
    post.cancelled_by = cancelled_by_role
    
    db.commit()
    db.refresh(post)
    
    # Get employer user for response
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else current_user
    
    return JobPostResponse.from_orm_model(post, employer_user, 0)

@router.post("/{post_id}/report-non-performance")
def report_non_performance(
    post_id: int,
    report_data: ReportNonPerformanceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Owner reports that housekeeper didn't perform the job properly"""
    from app.models_v2.report import Report, ReportType, ReportStatus
    
    # Check if job exists and user is owner
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the job owner can report non-performance"
        )
    
    # Verify the worker is assigned to this job
    worker = db.query(Worker).filter(Worker.worker_id == report_data.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    interest = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == report_data.worker_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    ).first()
    
    if not interest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This worker is not assigned to this job"
        )
    
    # Map report type string to enum
    type_mapping = {
        "non_completion": ReportType.NON_COMPLETION,
        "poor_quality": ReportType.POOR_QUALITY,
        "no_show": ReportType.NO_SHOW
    }
    report_type_enum = type_mapping.get(report_data.report_type, ReportType.NON_COMPLETION)
    
    # Get worker's user ID
    worker_user_id = worker.user_id
    
    # Create report
    report = Report(
        reporter_id=current_user.id,
        reporter_role="owner",
        reported_user_id=worker_user_id,
        post_id=post_id,
        report_type=report_type_enum,
        title=f"Worker Issue: {post.title}",
        description=report_data.reason,
        evidence_urls=json.dumps(report_data.evidence_urls) if report_data.evidence_urls else None,
        status=ReportStatus.PENDING
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {
        "message": "Report submitted successfully. Our team will review this case.",
        "report_id": report.report_id,
        "post_id": post_id,
        "status": "pending"
    }

