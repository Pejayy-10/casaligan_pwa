from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import json
from app.db import get_db
from app.models_v2.payment import PaymentSchedule, PaymentTransaction, PaymentStatus, PaymentFrequency
from app.models_v2.user import User
from app.routers.auth import get_current_user
from app.services.notification_service import notify_payment_sent, notify_payment_received
from pydantic import BaseModel

router = APIRouter(prefix="/jobs", tags=["payments"])


# Pydantic schemas
class PaymentTransactionResponse(BaseModel):
    transaction_id: int
    schedule_id: Optional[int] = None
    due_date: str
    amount: float
    status: str
    payment_proof_url: Optional[str]
    payment_method: Optional[str]
    reference_number: Optional[str]
    sent_at: Optional[str]
    confirmed_at: Optional[str]
    dispute_reason: Optional[str]
    worker_id: Optional[int]
    worker_name: Optional[str]

    class Config:
        from_attributes = True


class MarkAsSentRequest(BaseModel):
    payment_proof_url: str
    payment_method: str
    reference_number: str


class ReportIssueRequest(BaseModel):
    dispute_reason: str


# Helper function to generate payment schedules and transactions
def generate_payment_transactions(
    db: Session,
    contract_id: int,
    start_date: datetime,
    end_date: datetime,
    frequency: str,
    payment_amount: float,
    payment_dates: List[int]
):
    """Generate payment schedule records and transactions based on frequency"""
    schedules = []
    current_date = start_date
    
    if frequency == "weekly":
        while current_date <= end_date:
            # Create schedule record
            schedule = PaymentSchedule(
                contract_id=contract_id,
                due_date=current_date.strftime('%Y-%m-%d'),
                amount=payment_amount,
                status=PaymentStatus.PENDING
            )
            db.add(schedule)
            db.flush()  # Get schedule_id
            
            # Create transaction record
            transaction = PaymentTransaction(
                schedule_id=schedule.schedule_id,
                amount_paid=payment_amount,
                status=PaymentStatus.PENDING
            )
            db.add(transaction)
            schedules.append(schedule)
            current_date += timedelta(weeks=1)
    
    elif frequency == "biweekly":
        while current_date <= end_date:
            schedule = PaymentSchedule(
                contract_id=contract_id,
                due_date=current_date.strftime('%Y-%m-%d'),
                amount=payment_amount,
                status=PaymentStatus.PENDING
            )
            db.add(schedule)
            db.flush()
            
            transaction = PaymentTransaction(
                schedule_id=schedule.schedule_id,
                amount_paid=payment_amount,
                status=PaymentStatus.PENDING
            )
            db.add(transaction)
            schedules.append(schedule)
            current_date += timedelta(weeks=2)
    
    elif frequency == "monthly":
        # Use payment_dates (e.g., [15, 30]) for monthly payments
        current_month = start_date.replace(day=1)
        while current_month <= end_date:
            for day in (payment_dates or [15]):  # Default to 15th if not specified
                try:
                    day_int = int(day) if isinstance(day, str) else day
                    payment_date = current_month.replace(day=day_int)
                    if start_date <= payment_date <= end_date:
                        schedule = PaymentSchedule(
                            contract_id=contract_id,
                            due_date=payment_date.strftime('%Y-%m-%d'),
                            amount=payment_amount,
                            status=PaymentStatus.PENDING
                        )
                        db.add(schedule)
                        db.flush()
                        
                        transaction = PaymentTransaction(
                            schedule_id=schedule.schedule_id,
                            amount_paid=payment_amount,
                            status=PaymentStatus.PENDING
                        )
                        db.add(transaction)
                        schedules.append(schedule)
                except ValueError:
                    pass  # Skip invalid dates
            # Move to next month
            if current_month.month == 12:
                current_month = current_month.replace(year=current_month.year + 1, month=1)
            else:
                current_month = current_month.replace(month=current_month.month + 1)
    
    db.commit()
    return schedules


@router.get("/{job_id}/payments", response_model=List[PaymentTransactionResponse])
async def get_payments_for_owner(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payment schedules for a job (owner view) - grouped by worker"""
    from app.routers.jobs import ForumPost
    from app.models_v2.contract import Contract
    from app.models_v2.worker_employer import Worker
    
    # Verify job exists and user is the owner
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get employer to check ownership
    from app.models_v2.worker_employer import Employer
    employer = db.query(Employer).filter(Employer.employer_id == job.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view payments for this job")
    
    # Get ALL contracts for this job (one per worker)
    contracts = db.query(Contract).filter(Contract.post_id == job_id).all()
    if not contracts:
        return []
    
    # Get all payment schedules for all contracts
    all_schedules = []
    for contract in contracts:
        schedules = db.query(PaymentSchedule).filter(
            PaymentSchedule.contract_id == contract.contract_id
        ).all()
        
        for s in schedules:
            all_schedules.append(s)
    
    if not all_schedules:
        return []
    
    # Check for overdue payments
    today = datetime.now().date()
    for schedule in all_schedules:
        due_date = datetime.strptime(schedule.due_date, '%Y-%m-%d').date() if isinstance(schedule.due_date, str) else schedule.due_date
        if schedule.status == PaymentStatus.PENDING and due_date < today:
            schedule.status = PaymentStatus.OVERDUE
    db.commit()
    
    # Format response - return schedules as payment entries
    result = []
    for s in all_schedules:
        # Get associated transaction if any
        transaction = db.query(PaymentTransaction).filter(
            PaymentTransaction.schedule_id == s.schedule_id
        ).first()
        
        result.append(PaymentTransactionResponse(
            transaction_id=transaction.transaction_id if transaction else s.schedule_id,  # Use schedule_id as fallback
            schedule_id=s.schedule_id,
            due_date=s.due_date if isinstance(s.due_date, str) else s.due_date.strftime('%Y-%m-%d'),
            amount=float(s.amount) if s.amount else 0,
            status=s.status.value if hasattr(s.status, 'value') else str(s.status),
            payment_proof_url=transaction.payment_proof_url if transaction else None,
            payment_method=transaction.payment_method if transaction else None,
            reference_number=transaction.reference_number if transaction else None,
            sent_at=transaction.paid_at.isoformat() if transaction and transaction.paid_at else None,
            confirmed_at=transaction.confirmed_at.isoformat() if transaction and transaction.confirmed_at else None,
            dispute_reason=transaction.notes if transaction and transaction.notes and 'DISPUTE:' in transaction.notes else None,
            worker_id=s.worker_id,
            worker_name=s.worker_name or "Worker"
        ))
    
    # Sort by due date, then by worker name
    result.sort(key=lambda t: (t.due_date, t.worker_name or ""))
    
    return result


@router.get("/{job_id}/my-payments", response_model=List[PaymentTransactionResponse])
async def get_my_payments(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payment transactions for a job (housekeeper view) - only their payments"""
    from app.routers.jobs import ForumPost
    from app.models_v2.contract import Contract
    from app.models_v2.worker_employer import Worker
    
    # Verify job exists
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get the worker profile for the current user
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=403, detail="Worker profile not found")
    
    # Get the contract for THIS worker on this job
    contract = db.query(Contract).filter(
        Contract.post_id == job_id,
        Contract.worker_id == worker.worker_id
    ).first()
    if not contract:
        return []
    
    # Get payment schedules for this contract
    schedules = db.query(PaymentSchedule).filter(PaymentSchedule.contract_id == contract.contract_id).all()
    if not schedules:
        return []
    
    # Create lookup for schedule -> amount and due_date
    schedule_amount_map = {s.schedule_id: float(s.amount) if s.amount else 0 for s in schedules}
    schedule_date_map = {s.schedule_id: s.due_date for s in schedules}
    
    # Get all transactions for all schedules
    schedule_ids = [s.schedule_id for s in schedules]
    transactions = db.query(PaymentTransaction).filter(
        PaymentTransaction.schedule_id.in_(schedule_ids)
    ).all()
    
    # Create a map of schedule_id -> transaction
    transaction_map = {t.schedule_id: t for t in transactions}
    
    # Mark overdue payments based on schedule status
    today = datetime.now().date()
    for schedule in schedules:
        due_date = datetime.strptime(schedule.due_date, '%Y-%m-%d').date() if isinstance(schedule.due_date, str) else schedule.due_date
        if schedule.status == PaymentStatus.PENDING and due_date < today:
            schedule.status = PaymentStatus.OVERDUE
    db.commit()
    
    # Build response from schedules (not just transactions)
    # This ensures we show all payments including short-term ones without transactions
    result = []
    for schedule in schedules:
        transaction = transaction_map.get(schedule.schedule_id)
        due_date_str = schedule.due_date if isinstance(schedule.due_date, str) else schedule.due_date.strftime('%Y-%m-%d')
        
        result.append(PaymentTransactionResponse(
            transaction_id=transaction.transaction_id if transaction else schedule.schedule_id,
            schedule_id=schedule.schedule_id,
            due_date=due_date_str,
            amount=float(schedule.amount) if schedule.amount else 0,
            status=schedule.status.value if hasattr(schedule.status, 'value') else str(schedule.status),
            payment_proof_url=transaction.payment_proof_url if transaction else None,
            payment_method=transaction.payment_method if transaction else None,
            reference_number=transaction.reference_number if transaction else None,
            sent_at=transaction.paid_at.isoformat() if transaction and transaction.paid_at else None,
            confirmed_at=transaction.confirmed_at.isoformat() if transaction and transaction.confirmed_at else None,
            dispute_reason=transaction.notes if transaction and transaction.notes and 'DISPUTE:' in transaction.notes else None,
            worker_id=worker.worker_id,
            worker_name=f"{current_user.first_name} {current_user.last_name}"
        ))
    
    # Sort by due date
    result.sort(key=lambda r: r.due_date)
    
    return result


@router.put("/{job_id}/payments/{schedule_id}/mark-sent")
async def mark_payment_as_sent(
    job_id: int,
    schedule_id: int,
    data: MarkAsSentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark payment as sent with proof (owner only)
    
    This works with schedule_id - creates a transaction if needed.
    """
    from app.routers.jobs import ForumPost
    from app.models_v2.worker_employer import Employer
    
    # Verify job exists and user is the owner
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    employer = db.query(Employer).filter(Employer.employer_id == job.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get the payment schedule
    schedule = db.query(PaymentSchedule).filter(
        PaymentSchedule.schedule_id == schedule_id
    ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Payment schedule not found")
    
    # Check if transaction already exists for this schedule
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.schedule_id == schedule_id
    ).first()
    
    if not transaction:
        # Create a new transaction (similar to short-term payment pattern)
        transaction = PaymentTransaction(
            schedule_id=schedule_id,
            amount_paid=schedule.amount,
            payment_proof_url=data.payment_proof_url,
            payment_method=data.payment_method,
            reference_number=data.reference_number,
            paid_at=datetime.now()
        )
        db.add(transaction)
    else:
        # Update existing transaction
        transaction.payment_proof_url = data.payment_proof_url
        transaction.payment_method = data.payment_method
        transaction.reference_number = data.reference_number
        transaction.paid_at = datetime.now()
    
    # Update the schedule status (this is where status is tracked)
    schedule.status = PaymentStatus.SENT
    
    db.commit()
    
    # Send notification to worker about payment sent
    from app.models_v2.worker_employer import Worker
    if schedule.worker_id:
        worker = db.query(Worker).filter(Worker.worker_id == schedule.worker_id).first()
        if worker:
            notify_payment_sent(
                db=db,
                worker_user_id=worker.user_id,
                job_title=job.title,
                amount=float(schedule.amount) if schedule.amount else 0,
                post_id=job_id
            )
    
    return {"message": "Payment marked as sent successfully"}


@router.put("/{job_id}/payments/{identifier}/confirm")
async def confirm_payment_received(
    job_id: int,
    identifier: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Confirm payment received (housekeeper only)
    
    The identifier can be either transaction_id or schedule_id.
    When all payments for a long-term job are confirmed, the job automatically completes.
    """
    from app.routers.jobs import ForumPost, ForumPostStatus
    from app.models_v2.contract import Contract
    
    # Verify job exists
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Try to find by transaction_id first, then by schedule_id
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.transaction_id == identifier
    ).first()
    
    if transaction:
        # Found by transaction_id - get the schedule
        schedule = db.query(PaymentSchedule).filter(
            PaymentSchedule.schedule_id == transaction.schedule_id
        ).first()
    else:
        # Try finding by schedule_id
        schedule = db.query(PaymentSchedule).filter(
            PaymentSchedule.schedule_id == identifier
        ).first()
        
        if schedule:
            transaction = db.query(PaymentTransaction).filter(
                PaymentTransaction.schedule_id == schedule.schedule_id
            ).first()
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Payment schedule not found")
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment has not been sent yet")
    
    # Check schedule status (status is tracked on schedule, not transaction)
    if schedule.status == PaymentStatus.CONFIRMED:
        return {"message": "Payment already confirmed", "job_completed": False}
    
    if schedule.status != PaymentStatus.SENT:
        raise HTTPException(status_code=400, detail="Payment has not been marked as sent")
    
    # Update transaction confirmation and schedule status
    transaction.confirmed_at = datetime.now()
    transaction.confirmed_by_worker = True
    schedule.status = PaymentStatus.CONFIRMED
    
    # Check if this is a recurring service and create next payment schedule
    is_recurring = job.is_recurring and getattr(job, 'recurring_status', 'active') == 'active'
    
    if is_recurring:
        # Get the contract to access payment schedule data
        from app.models_v2.contract import Contract
        contract = db.query(Contract).filter(Contract.contract_id == schedule.contract_id).first()
        
        if contract:
            # Get job details to find payment amount and frequency
            job_details = {}
            if job.content and job.content.startswith('{'):
                try:
                    job_details = json.loads(job.content)
                except:
                    pass
            
            payment_schedule_data = job_details.get('payment_schedule', {})
            payment_amount = float(payment_schedule_data.get('payment_amount', job_details.get('budget', 0)))
            
            # Use recurring frequency if available, otherwise use payment schedule frequency
            recurring_frequency = job.frequency or payment_schedule_data.get('frequency', 'weekly')
            
            # Calculate next payment due date based on frequency
            current_due_date = datetime.strptime(schedule.due_date, '%Y-%m-%d') if isinstance(schedule.due_date, str) else schedule.due_date
            if isinstance(current_due_date, str):
                current_due_date = datetime.strptime(current_due_date, '%Y-%m-%d')
            
            next_due_date = current_due_date
            
            if recurring_frequency == 'weekly':
                next_due_date = current_due_date + timedelta(weeks=1)
            elif recurring_frequency == 'biweekly':
                next_due_date = current_due_date + timedelta(weeks=2)
            elif recurring_frequency == 'monthly':
                # Add one month
                if current_due_date.month == 12:
                    next_due_date = current_due_date.replace(year=current_due_date.year + 1, month=1)
                else:
                    next_due_date = current_due_date.replace(month=current_due_date.month + 1)
            else:
                # Default to weekly
                next_due_date = current_due_date + timedelta(weeks=1)
            
            # Check if we should create next payment (check end_date if exists)
            should_create_next = True
            if job.end_date:
                try:
                    end_date = datetime.strptime(job.end_date, '%Y-%m-%d') if isinstance(job.end_date, str) else job.end_date
                    if isinstance(end_date, str):
                        end_date = datetime.strptime(end_date, '%Y-%m-%d')
                    if next_due_date > end_date:
                        should_create_next = False
                except:
                    pass
            
            # Check if next payment schedule already exists
            existing_next = db.query(PaymentSchedule).filter(
                PaymentSchedule.contract_id == schedule.contract_id,
                PaymentSchedule.due_date == next_due_date.strftime('%Y-%m-%d'),
                PaymentSchedule.status != PaymentStatus.CONFIRMED
            ).first()
            
            if should_create_next and not existing_next:
                # Create next payment schedule for recurring service
                next_schedule = PaymentSchedule(
                    contract_id=schedule.contract_id,
                    worker_id=schedule.worker_id,
                    worker_name=schedule.worker_name,
                    due_date=next_due_date.strftime('%Y-%m-%d'),
                    amount=payment_amount,
                    status=PaymentStatus.PENDING
                )
                db.add(next_schedule)
                print(f"DEBUG: Created next payment schedule for recurring service - due: {next_due_date.strftime('%Y-%m-%d')}")
    
    db.commit()
    
    # Send notification to owner about payment received by worker
    from app.models_v2.worker_employer import Employer
    employer = db.query(Employer).filter(Employer.employer_id == job.employer_id).first()
    if employer:
        worker_name = f"{current_user.first_name} {current_user.last_name}"
        notify_payment_received(
            db=db,
            employer_user_id=employer.user_id,
            worker_name=worker_name,
            job_title=job.title,
            post_id=job_id
        )
    
    # Check if job should auto-complete (long-term jobs only)
    # For recurring services, don't auto-complete - they continue until cancelled
    if job.is_longterm and not is_recurring:
        # Check if all payment schedules are confirmed
        all_schedules = db.query(PaymentSchedule).join(Contract).filter(
            Contract.post_id == job_id
        ).all()
        
        all_confirmed = all(s.status == PaymentStatus.CONFIRMED for s in all_schedules)
        
        if all_confirmed:
            job.status = ForumPostStatus.COMPLETED
            job.completed_at = datetime.now()
            
            # Mark all contracts as completed
            from app.models_v2.contract import ContractStatus
            contracts = db.query(Contract).filter(Contract.post_id == job_id).all()
            for contract in contracts:
                contract.status = ContractStatus.COMPLETED
            
            db.commit()
            
            return {
                "message": "Payment confirmed! Job has been completed.",
                "job_completed": True
            }
    
    return {"message": "Payment confirmed successfully", "job_completed": False}


@router.put("/{job_id}/payments/{transaction_id}/report")
async def report_payment_issue(
    job_id: int,
    transaction_id: int,
    data: ReportIssueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Report issue with payment (housekeeper only)"""
    from app.routers.jobs import ForumPost
    
    # Verify job exists
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get transaction
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.transaction_id == transaction_id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get the schedule to update its status
    schedule = db.query(PaymentSchedule).filter(
        PaymentSchedule.schedule_id == transaction.schedule_id
    ).first()
    
    # Update schedule status and add note to transaction
    if schedule:
        schedule.status = PaymentStatus.DISPUTED
    transaction.notes = f"DISPUTE: {data.dispute_reason}"
    
    db.commit()
    
    return {"message": "Issue reported successfully"}
