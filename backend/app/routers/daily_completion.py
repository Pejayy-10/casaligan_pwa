"""
Daily completion confirmation endpoints for multi-day jobs.

Both the owner and housekeeper must confirm each day's work before:
  • the worker is "freed" for that day (can accept other jobs after daily hours)
  • the next day is unlocked
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, date, timedelta
from pydantic import BaseModel

from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Worker, Employer
from app.models_v2.forum import ForumPost
from app.models_v2.direct_hire import DirectHire
from app.models_v2.contract import Contract
from app.models_v2.job_day_schedule import JobDaySchedule, DailyCompletion
from app.models_v2.notification import Notification, NotificationType
from app.security import get_current_user

router = APIRouter(prefix="/daily-completion", tags=["daily-completion"])


# ==================== SCHEMAS ====================

class DayScheduleResponse(BaseModel):
    day_schedule_id: int
    post_id: Optional[int] = None
    hire_id: Optional[int] = None
    worker_id: int
    work_date: str
    start_time: str
    end_time: str
    day_number: int
    status: str
    owner_confirmed: bool = False
    housekeeper_confirmed: bool = False
    completions: List[dict] = []


class ConfirmDayRequest(BaseModel):
    proof_url: Optional[str] = None
    notes: Optional[str] = None


# ==================== HELPERS ====================

def _build_day_response(ds: JobDaySchedule) -> dict:
    """Build a serialisable dict for a single day schedule."""
    completions = []
    owner_confirmed = False
    housekeeper_confirmed = False
    for c in ds.completions:
        completions.append({
            "completion_id": c.completion_id,
            "confirmed_by": c.confirmed_by,
            "role": c.role,
            "proof_url": c.proof_url,
            "notes": c.notes,
            "confirmed_at": c.confirmed_at.isoformat() if c.confirmed_at else None,
        })
        if c.role == "owner":
            owner_confirmed = True
        if c.role == "housekeeper":
            housekeeper_confirmed = True

    return {
        "day_schedule_id": ds.day_schedule_id,
        "post_id": ds.post_id,
        "hire_id": ds.hire_id,
        "worker_id": ds.worker_id,
        "work_date": str(ds.work_date),
        "start_time": ds.start_time,
        "end_time": ds.end_time,
        "day_number": ds.day_number,
        "status": ds.status,
        "owner_confirmed": owner_confirmed,
        "housekeeper_confirmed": housekeeper_confirmed,
        "completions": completions,
    }


def _create_day_schedules_for_job_post(
    db: Session,
    post: ForumPost,
    worker_id: int,
) -> List[JobDaySchedule]:
    """Generate day schedule rows when a worker is accepted for a multi-day job post."""
    num_days = getattr(post, 'num_days', 1) or 1
    daily_start = getattr(post, 'daily_start_time', None) or post.start_time or "08:00"
    daily_end = getattr(post, 'daily_end_time', None) or post.end_time or "17:00"
    start_date_str = post.start_date
    if not start_date_str:
        return []
    try:
        if isinstance(start_date_str, str):
            from app.services.schedule_conflict_service import parse_date_string
            start = parse_date_string(start_date_str)
        else:
            start = start_date_str
    except Exception:
        return []
    if not start:
        return []

    schedules = []
    for i in range(num_days):
        work_date = start + timedelta(days=i)
        ds = JobDaySchedule(
            post_id=post.post_id,
            worker_id=worker_id,
            work_date=work_date,
            start_time=daily_start,
            end_time=daily_end,
            day_number=i + 1,
            status="pending",
        )
        db.add(ds)
        schedules.append(ds)
    db.commit()
    for s in schedules:
        db.refresh(s)
    return schedules


def _create_day_schedules_for_direct_hire(
    db: Session,
    hire: DirectHire,
) -> List[JobDaySchedule]:
    """Generate day schedule rows for a multi-day direct hire."""
    num_days = getattr(hire, 'num_days', 1) or 1
    daily_start = getattr(hire, 'daily_start_time', None) or hire.start_time or "08:00"
    daily_end = getattr(hire, 'daily_end_time', None) or hire.end_time or "17:00"
    start = hire.scheduled_date
    if not start:
        return []

    schedules = []
    for i in range(num_days):
        work_date = start + timedelta(days=i)
        ds = JobDaySchedule(
            hire_id=hire.hire_id,
            worker_id=hire.worker_id,
            work_date=work_date,
            start_time=daily_start,
            end_time=daily_end,
            day_number=i + 1,
            status="pending",
        )
        db.add(ds)
        schedules.append(ds)
    db.commit()
    for s in schedules:
        db.refresh(s)
    return schedules


# ==================== ENDPOINTS ====================

@router.get("/job/{post_id}/worker/{worker_id}", response_model=List[dict])
def get_job_day_schedules(
    post_id: int,
    worker_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the per-day schedule for a multi-day job post for a specific worker."""
    schedules = (
        db.query(JobDaySchedule)
        .filter(JobDaySchedule.post_id == post_id, JobDaySchedule.worker_id == worker_id)
        .order_by(JobDaySchedule.day_number)
        .all()
    )

    # Auto-create schedules if they don't exist yet (lazy creation)
    if not schedules:
        post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
        if post and (getattr(post, 'num_days', 1) or 1) >= 1:
            schedules = _create_day_schedules_for_job_post(db, post, worker_id)

    return [_build_day_response(ds) for ds in schedules]


@router.get("/job/{post_id}/my-schedule", response_model=List[dict])
def get_my_job_day_schedules(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the per-day schedule for a multi-day job post for the current housekeeper.
    Automatically resolves worker_id from the authenticated user."""
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    schedules = (
        db.query(JobDaySchedule)
        .filter(JobDaySchedule.post_id == post_id, JobDaySchedule.worker_id == worker.worker_id)
        .order_by(JobDaySchedule.day_number)
        .all()
    )

    if not schedules:
        post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
        if post and (getattr(post, 'num_days', 1) or 1) >= 1:
            schedules = _create_day_schedules_for_job_post(db, post, worker.worker_id)

    return [_build_day_response(ds) for ds in schedules]


@router.get("/hire/{hire_id}", response_model=List[dict])
def get_hire_day_schedules(
    hire_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the per-day schedule for a multi-day direct hire."""
    schedules = (
        db.query(JobDaySchedule)
        .filter(JobDaySchedule.hire_id == hire_id)
        .order_by(JobDaySchedule.day_number)
        .all()
    )

    if not schedules:
        hire = db.query(DirectHire).filter(DirectHire.hire_id == hire_id).first()
        if hire and (getattr(hire, 'num_days', 1) or 1) >= 1:
            schedules = _create_day_schedules_for_direct_hire(db, hire)

    return [_build_day_response(ds) for ds in schedules]


@router.post("/{day_schedule_id}/confirm")
def confirm_day_completion(
    day_schedule_id: int,
    data: ConfirmDayRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Confirm a single day's work.
    
    The caller's role (owner vs housekeeper) is auto-detected.
    When both parties have confirmed, the day status becomes 'completed'
    and the next day is unlocked.
    """
    ds = db.query(JobDaySchedule).filter(JobDaySchedule.day_schedule_id == day_schedule_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Day schedule not found")

    if ds.status == "completed":
        raise HTTPException(status_code=400, detail="This day is already completed")

    # Determine the caller's role
    role: Optional[str] = None
    other_user_id: Optional[int] = None

    if ds.post_id:
        post = db.query(ForumPost).filter(ForumPost.post_id == ds.post_id).first()
        employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first() if post else None
        if employer and employer.user_id == current_user.id:
            role = "owner"
            worker = db.query(Worker).filter(Worker.worker_id == ds.worker_id).first()
            other_user_id = worker.user_id if worker else None
        else:
            worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
            if worker and worker.worker_id == ds.worker_id:
                role = "housekeeper"
                other_user_id = employer.user_id if employer else None
    elif ds.hire_id:
        hire = db.query(DirectHire).filter(DirectHire.hire_id == ds.hire_id).first()
        employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first() if hire else None
        if employer and employer.user_id == current_user.id:
            role = "owner"
            worker = db.query(Worker).filter(Worker.worker_id == ds.worker_id).first()
            other_user_id = worker.user_id if worker else None
        else:
            worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
            if worker and worker.worker_id == ds.worker_id:
                role = "housekeeper"
                other_user_id = employer.user_id if employer else None

    if not role:
        raise HTTPException(status_code=403, detail="You are not part of this job")

    # Check for duplicate confirmation
    existing = (
        db.query(DailyCompletion)
        .filter(
            DailyCompletion.day_schedule_id == day_schedule_id,
            DailyCompletion.role == role,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"You have already confirmed day {ds.day_number}")

    # Ensure previous days are completed (sequential unlock)
    if ds.day_number > 1:
        prev = (
            db.query(JobDaySchedule)
            .filter(
                JobDaySchedule.worker_id == ds.worker_id,
                JobDaySchedule.day_number == ds.day_number - 1,
                (
                    (JobDaySchedule.post_id == ds.post_id) if ds.post_id
                    else (JobDaySchedule.hire_id == ds.hire_id)
                ),
            )
            .first()
        )
        if prev and prev.status != "completed":
            raise HTTPException(
                status_code=400,
                detail=f"Day {ds.day_number - 1} must be completed before confirming day {ds.day_number}"
            )

    # Save confirmation
    dc = DailyCompletion(
        day_schedule_id=day_schedule_id,
        confirmed_by=current_user.id,
        role=role,
        proof_url=data.proof_url,
        notes=data.notes,
    )
    db.add(dc)

    # Update day schedule status
    if ds.status == "pending":
        ds.status = "pending_completion"

    # Check if both parties have now confirmed
    all_confirmations = (
        db.query(DailyCompletion)
        .filter(DailyCompletion.day_schedule_id == day_schedule_id)
        .all()
    )
    # Include the one we just added
    roles_confirmed = {c.role for c in all_confirmations}
    roles_confirmed.add(role)

    both_confirmed = "owner" in roles_confirmed and "housekeeper" in roles_confirmed

    if both_confirmed:
        ds.status = "completed"

    db.commit()

    # ---------- Notifications ----------
    job_label = ""
    if ds.post_id:
        post = db.query(ForumPost).filter(ForumPost.post_id == ds.post_id).first()
        job_label = post.title if post else f"Job #{ds.post_id}"
    elif ds.hire_id:
        job_label = f"Direct Hire #{ds.hire_id}"

    # Notify the other party
    if other_user_id:
        if role == "housekeeper":
            ntype = NotificationType.DAILY_COMPLETION_SUBMITTED
            title = f"Day {ds.day_number} Confirmed by Housekeeper"
            message = f"The housekeeper has confirmed completion of Day {ds.day_number} for '{job_label}'. Please review and confirm."
        else:
            ntype = NotificationType.DAILY_COMPLETION_CONFIRMED
            title = f"Day {ds.day_number} Confirmed by Owner"
            message = f"The owner has confirmed Day {ds.day_number} for '{job_label}'."

        n = Notification(
            user_id=other_user_id,
            type=ntype,
            title=title,
            message=message,
            reference_type="day_schedule",
            reference_id=day_schedule_id,
        )
        db.add(n)

    # If both confirmed, send a "day complete" notification to both
    if both_confirmed:
        for uid in [current_user.id, other_user_id]:
            if uid:
                n = Notification(
                    user_id=uid,
                    type=NotificationType.DAILY_ALL_CONFIRMED,
                    title=f"Day {ds.day_number} Complete ✅",
                    message=f"Both parties confirmed Day {ds.day_number} of '{job_label}'. "
                            + ("The next day is now unlocked." if ds.day_number < (getattr(ds, '_total_days', 999)) else "All days complete!"),
                    reference_type="day_schedule",
                    reference_id=day_schedule_id,
                )
                db.add(n)

    db.commit()

    return {
        "message": f"Day {ds.day_number} confirmed by {role}",
        "day_status": ds.status,
        "both_confirmed": both_confirmed,
    }


@router.get("/worker/available-after-hours")
def check_worker_available_after_hours(
    worker_id: int,
    check_date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Check what hours a worker is busy on a given date.
    Returns busy time slots so the caller can see when the worker is free.
    """
    try:
        target_date = date.fromisoformat(check_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    busy_slots = (
        db.query(JobDaySchedule)
        .filter(
            JobDaySchedule.worker_id == worker_id,
            JobDaySchedule.work_date == target_date,
            JobDaySchedule.status.notin_(["completed", "skipped"]),
        )
        .order_by(JobDaySchedule.start_time)
        .all()
    )

    return {
        "worker_id": worker_id,
        "date": check_date,
        "busy_slots": [
            {
                "start_time": s.start_time,
                "end_time": s.end_time,
                "status": s.status,
                "post_id": s.post_id,
                "hire_id": s.hire_id,
            }
            for s in busy_slots
        ],
    }
