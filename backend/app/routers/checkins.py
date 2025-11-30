from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db import get_db
from app.models_v2.payment import CheckIn
from app.models_v2.user import User
from app.routers.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/jobs", tags=["checkins"])


# Pydantic schemas
class CheckInRequest(BaseModel):
    check_in_location: str
    notes: Optional[str] = None


class CheckOutRequest(BaseModel):
    notes: Optional[str] = None


class CheckInResponse(BaseModel):
    checkin_id: int
    check_in_time: str
    check_out_time: Optional[str]
    check_in_location: str
    notes: Optional[str]
    verified_by_employer: bool
    worker_id: int

    class Config:
        from_attributes = True


@router.post("/{job_id}/checkin")
async def check_in(
    job_id: int,
    data: CheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check in to work (housekeeper only)"""
    from app.routers.jobs import ForumPost
    
    # Verify job exists
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if already checked in today
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    existing_checkin = db.query(CheckIn).filter(
        CheckIn.post_id == job_id,
        CheckIn.worker_id == current_user.user_id,
        CheckIn.check_in_time >= today_start,
        CheckIn.check_out_time == None
    ).first()
    
    if existing_checkin:
        raise HTTPException(status_code=400, detail="Already checked in. Please check out first.")
    
    # Create check-in record
    checkin = CheckIn(
        post_id=job_id,
        worker_id=current_user.user_id,
        check_in_time=datetime.now(),
        check_in_location=data.check_in_location,
        notes=data.notes,
        verified_by_employer=False
    )
    
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    
    return {
        "message": "Checked in successfully",
        "checkin_id": checkin.checkin_id,
        "check_in_time": checkin.check_in_time.isoformat()
    }


@router.put("/{job_id}/checkin/{checkin_id}/checkout")
async def check_out(
    job_id: int,
    checkin_id: int,
    data: CheckOutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check out from work (housekeeper only)"""
    # Get check-in record
    checkin = db.query(CheckIn).filter(
        CheckIn.checkin_id == checkin_id,
        CheckIn.post_id == job_id,
        CheckIn.worker_id == current_user.user_id
    ).first()
    
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in record not found")
    
    if checkin.check_out_time:
        raise HTTPException(status_code=400, detail="Already checked out")
    
    # Update check-out time
    checkin.check_out_time = datetime.now()
    if data.notes:
        checkin.notes = f"{checkin.notes}\n\nCheck-out notes: {data.notes}" if checkin.notes else data.notes
    
    db.commit()
    
    # Calculate duration
    duration = checkin.check_out_time - checkin.check_in_time
    hours = duration.total_seconds() / 3600
    
    return {
        "message": "Checked out successfully",
        "check_out_time": checkin.check_out_time.isoformat(),
        "duration_hours": round(hours, 2)
    }


@router.get("/{job_id}/checkins", response_model=List[CheckInResponse])
async def get_checkins(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all check-ins for a job"""
    from app.routers.jobs import ForumPost
    
    # Verify job exists
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get check-ins
    checkins = db.query(CheckIn).filter(
        CheckIn.post_id == job_id
    ).order_by(CheckIn.check_in_time.desc()).all()
    
    result = []
    for c in checkins:
        result.append(CheckInResponse(
            checkin_id=c.checkin_id,
            check_in_time=c.check_in_time.isoformat(),
            check_out_time=c.check_out_time.isoformat() if c.check_out_time else None,
            check_in_location=c.check_in_location,
            notes=c.notes,
            verified_by_employer=c.verified_by_employer,
            worker_id=c.worker_id
        ))
    
    return result


@router.put("/{job_id}/checkin/{checkin_id}/verify")
async def verify_checkin(
    job_id: int,
    checkin_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify a check-in record (owner only)"""
    from app.routers.jobs import ForumPost
    
    # Verify job exists and user is owner
    job = db.query(ForumPost).filter(ForumPost.post_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.employer_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get check-in record
    checkin = db.query(CheckIn).filter(
        CheckIn.checkin_id == checkin_id,
        CheckIn.post_id == job_id
    ).first()
    
    if not checkin:
        raise HTTPException(status_code=404, detail="Check-in record not found")
    
    # Verify check-in
    checkin.verified_by_employer = True
    db.commit()
    
    return {"message": "Check-in verified successfully"}
