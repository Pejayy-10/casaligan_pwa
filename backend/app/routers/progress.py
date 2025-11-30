from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.db import get_db
from app.models_v2.payment import PaymentSchedule, PaymentTransaction, CheckIn, PaymentStatus
from app.models_v2.user import User
from app.routers.auth import get_current_user
from pydantic import BaseModel
import json

router = APIRouter(prefix="/jobs", tags=["progress"])


# Pydantic schemas
class RecentCheckIn(BaseModel):
    checkin_id: int
    check_in_time: str
    check_out_time: Optional[str]
    verified: bool


class UpcomingPayment(BaseModel):
    date: str
    amount: float


class JobProgressResponse(BaseModel):
    job_title: str
    start_date: str
    end_date: str
    days_elapsed: int
    days_remaining: int
    total_days: int
    progress_percentage: float
    payment_dates: List[str]
    upcoming_payment: Optional[UpcomingPayment]
    recent_checkins: List[RecentCheckIn]
    total_checkins: int


@router.get("/{job_id}/progress", response_model=JobProgressResponse)
async def get_job_progress(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get job progress data including dates, payments, and check-ins"""
    from app.routers.jobs import ForumPost
    from app.models_v2.contract import Contract
    
    # Verify job exists
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Parse job details to get dates - content is JSON with job details
    try:
        job_details = json.loads(job.content) if job.content else {}
        start_date_str = job_details.get('start_date')
        end_date_str = job_details.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Use default dates if not found
            start_date = datetime.now().date()
            end_date = start_date + timedelta(days=30)
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except Exception as e:
        # Use default dates on error
        start_date = datetime.now().date()
        end_date = start_date + timedelta(days=30)
    
    # Calculate progress
    today = datetime.now().date()
    total_days = (end_date - start_date).days + 1
    days_elapsed = max(0, (today - start_date).days)
    days_remaining = max(0, (end_date - today).days)
    progress_percentage = min(100, (days_elapsed / total_days * 100) if total_days > 0 else 0)
    
    # Get contract for this job
    contract = db.query(Contract).filter(Contract.post_id == job_id).first()
    
    payment_dates = []
    upcoming_payment = None
    recent_checkins = []
    total_checkins = 0
    
    if contract:
        # Get payment schedules for this contract
        schedules = db.query(PaymentSchedule).filter(PaymentSchedule.contract_id == contract.contract_id).all()
        
        if schedules:
            schedule_ids = [s.schedule_id for s in schedules]
            transactions = db.query(PaymentTransaction).filter(
                PaymentTransaction.schedule_id.in_(schedule_ids)
            ).all()
            
            # Sort transactions by due date
            transactions.sort(key=lambda t: t.due_date if isinstance(t.due_date, str) else str(t.due_date))
            
            payment_dates = [t.due_date if isinstance(t.due_date, str) else t.due_date.isoformat() for t in transactions]
            
            # Find upcoming payment
            for t in transactions:
                due_date = datetime.strptime(t.due_date, '%Y-%m-%d').date() if isinstance(t.due_date, str) else t.due_date
                if due_date >= today and t.status in [PaymentStatus.PENDING, PaymentStatus.SENT]:
                    upcoming_payment = UpcomingPayment(
                        date=t.due_date if isinstance(t.due_date, str) else t.due_date.isoformat(),
                        amount=float(t.amount) if t.amount else 0
                    )
                    break
        
        # Get recent check-ins (last 5) via contract_id
        checkins = db.query(CheckIn).filter(
            CheckIn.contract_id == contract.contract_id
        ).order_by(CheckIn.created_at.desc()).limit(5).all()
        
        for c in checkins:
            recent_checkins.append(RecentCheckIn(
                checkin_id=c.checkin_id,
                check_in_time=c.check_in_date if isinstance(c.check_in_date, str) else c.check_in_date.isoformat(),
                check_out_time=None,  # CheckIn model doesn't have check_out_time
                verified=False  # CheckIn model doesn't have verified field
            ))
        
        total_checkins = db.query(CheckIn).filter(CheckIn.contract_id == contract.contract_id).count()
    
    return JobProgressResponse(
        job_title=job.title,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        days_elapsed=days_elapsed,
        days_remaining=days_remaining,
        total_days=total_days,
        progress_percentage=round(progress_percentage, 1),
        payment_dates=payment_dates,
        upcoming_payment=upcoming_payment,
        recent_checkins=recent_checkins,
        total_checkins=total_checkins
    )


# ============== HOUSEKEEPER PROGRESS ENDPOINTS ==============

class PaymentWarning(BaseModel):
    schedule_id: int
    amount: float
    due_date: str
    days_overdue: int
    status: str


class HousekeeperProgressResponse(BaseModel):
    job_title: str
    employer_name: str
    employer_contact: Optional[str] = None
    start_date: str
    end_date: str
    days_elapsed: int
    days_remaining: int
    total_days: int
    progress_percentage: float
    total_earned: float
    pending_amount: float
    payment_warnings: List[PaymentWarning]
    recent_checkins: List[RecentCheckIn]
    total_checkins: int
    can_submit_completion: bool  # True if job is ongoing and near end date


@router.get("/{job_id}/housekeeper-progress", response_model=HousekeeperProgressResponse)
async def get_housekeeper_progress(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get job progress from housekeeper's perspective with payment warnings"""
    from app.routers.jobs import ForumPost
    from app.models_v2.contract import Contract
    from app.models_v2.worker_employer import Worker, Employer
    from app.models_v2.forum import InterestCheck, InterestStatus
    
    # Check if user is housekeeper
    if not current_user.is_housekeeper:
        raise HTTPException(status_code=403, detail="Only housekeepers can access this endpoint")
    
    # Get worker record
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(status_code=400, detail="Worker profile not found")
    
    # Verify job exists
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Verify this worker is assigned to this job
    interest = db.query(InterestCheck).filter(
        InterestCheck.post_id == job_id,
        InterestCheck.worker_id == worker_record.worker_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    ).first()
    
    if not interest:
        raise HTTPException(status_code=403, detail="You are not assigned to this job")
    
    # Get employer info
    employer = db.query(Employer).filter(Employer.employer_id == job.employer_id).first()
    employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else None
    
    # Parse job details
    try:
        job_details = json.loads(job.content) if job.content else {}
        start_date_str = job_details.get('start_date')
        end_date_str = job_details.get('end_date')
        
        if not start_date_str or not end_date_str:
            start_date = datetime.now().date()
            end_date = start_date + timedelta(days=30)
        else:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except:
        start_date = datetime.now().date()
        end_date = start_date + timedelta(days=30)
    
    # Calculate progress
    today = datetime.now().date()
    total_days = (end_date - start_date).days + 1
    days_elapsed = max(0, (today - start_date).days)
    days_remaining = max(0, (end_date - today).days)
    progress_percentage = min(100, (days_elapsed / total_days * 100) if total_days > 0 else 0)
    
    # Get contract
    contract = db.query(Contract).filter(
        Contract.post_id == job_id,
        Contract.worker_id == worker_record.worker_id
    ).first()
    
    total_earned = 0.0
    pending_amount = 0.0
    payment_warnings = []
    recent_checkins = []
    total_checkins = 0
    
    if contract:
        # Get payment schedules
        schedules = db.query(PaymentSchedule).filter(
            PaymentSchedule.contract_id == contract.contract_id
        ).all()
        
        for schedule in schedules:
            status_val = schedule.status.value if hasattr(schedule.status, 'value') else str(schedule.status)
            schedule_amount = float(schedule.amount) if schedule.amount else 0
            
            if status_val == "confirmed":
                total_earned += schedule_amount
            elif status_val == "pending":
                pending_amount += schedule_amount
                
                # Check if payment is overdue using due_date
                if schedule.due_date:
                    try:
                        due_date = datetime.strptime(schedule.due_date, '%Y-%m-%d').date() if isinstance(schedule.due_date, str) else schedule.due_date
                        if due_date < today:
                            days_overdue = (today - due_date).days
                            payment_warnings.append(PaymentWarning(
                                schedule_id=schedule.schedule_id,
                                amount=schedule_amount,
                                due_date=schedule.due_date if isinstance(schedule.due_date, str) else due_date.isoformat(),
                                days_overdue=days_overdue,
                                status=status_val
                            ))
                    except:
                        pass  # Skip if date parsing fails
        
        # Get recent check-ins
        checkins = db.query(CheckIn).filter(
            CheckIn.contract_id == contract.contract_id
        ).order_by(CheckIn.created_at.desc()).limit(5).all()
        
        for c in checkins:
            recent_checkins.append(RecentCheckIn(
                checkin_id=c.checkin_id,
                check_in_time=c.check_in_date if isinstance(c.check_in_date, str) else c.check_in_date.isoformat(),
                check_out_time=None,
                verified=False
            ))
        
        total_checkins = db.query(CheckIn).filter(CheckIn.contract_id == contract.contract_id).count()
    
    # Can submit completion if:
    # 1. Job is ongoing
    # 2. Within 7 days of end date
    # 3. NOT a long-term job (long-term jobs complete automatically when all payments are confirmed)
    job_status = job.status.value if hasattr(job.status, 'value') else str(job.status)
    is_longterm = job.duration_type == "long_term" if hasattr(job, 'duration_type') else False
    can_submit_completion = (
        job_status == "ongoing" and 
        days_remaining <= 7 and
        not is_longterm
    )
    
    return HousekeeperProgressResponse(
        job_title=job.title,
        employer_name=f"{employer_user.first_name} {employer_user.last_name}" if employer_user else "Unknown",
        employer_contact=employer_user.phone_number if employer_user else None,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        days_elapsed=days_elapsed,
        days_remaining=days_remaining,
        total_days=total_days,
        progress_percentage=round(progress_percentage, 1),
        total_earned=total_earned,
        pending_amount=pending_amount,
        payment_warnings=payment_warnings,
        recent_checkins=recent_checkins,
        total_checkins=total_checkins,
        can_submit_completion=can_submit_completion
    )
