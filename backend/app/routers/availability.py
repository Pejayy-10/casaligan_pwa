"""Worker availability/blocked dates endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Worker
from app.models_v2.availability import WorkerBlockedDate
from app.security import get_current_user

router = APIRouter(prefix="/availability", tags=["availability"])

# ============== SCHEMAS ==============

class BlockedDateCreate(BaseModel):
    blocked_date: date
    reason: Optional[str] = None

class BlockedDateResponse(BaseModel):
    blocked_date_id: int
    worker_id: int
    blocked_date: str
    reason: Optional[str] = None
    created_at: str

class BlockedDateListResponse(BaseModel):
    blocked_dates: List[BlockedDateResponse]

# ============== HELPER FUNCTIONS ==============

def get_worker_for_user(user_id: int, db: Session) -> Worker:
    """Get worker record for user"""
    worker = db.query(Worker).filter(Worker.user_id == user_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker record not found. Please apply to become a housekeeper first."
        )
    return worker

# ============== ENDPOINTS ==============

@router.get("/blocked-dates", response_model=BlockedDateListResponse)
def get_my_blocked_dates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all blocked dates for the current worker"""
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can manage blocked dates"
        )
    
    worker = get_worker_for_user(current_user.id, db)
    
    blocked_dates = db.query(WorkerBlockedDate).filter(
        WorkerBlockedDate.worker_id == worker.worker_id,
        WorkerBlockedDate.blocked_date >= date.today()  # Only show future dates
    ).order_by(WorkerBlockedDate.blocked_date.asc()).all()
    
    return BlockedDateListResponse(
        blocked_dates=[
            BlockedDateResponse(
                blocked_date_id=bd.blocked_date_id,
                worker_id=bd.worker_id,
                blocked_date=bd.blocked_date.isoformat(),
                reason=bd.reason,
                created_at=bd.created_at.isoformat() if bd.created_at else ""
            )
            for bd in blocked_dates
        ]
    )

@router.post("/blocked-dates", response_model=BlockedDateResponse, status_code=status.HTTP_201_CREATED)
def block_date(
    date_data: BlockedDateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Block a date - make worker unavailable for direct hire on this date"""
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can block dates"
        )
    
    # Check if date is in the past
    if date_data.blocked_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot block dates in the past"
        )
    
    worker = get_worker_for_user(current_user.id, db)
    
    # Check if date is already blocked
    existing = db.query(WorkerBlockedDate).filter(
        WorkerBlockedDate.worker_id == worker.worker_id,
        WorkerBlockedDate.blocked_date == date_data.blocked_date
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This date is already blocked"
        )
    
    # Create blocked date
    blocked_date = WorkerBlockedDate(
        worker_id=worker.worker_id,
        blocked_date=date_data.blocked_date,
        reason=date_data.reason
    )
    
    db.add(blocked_date)
    db.commit()
    db.refresh(blocked_date)
    
    return BlockedDateResponse(
        blocked_date_id=blocked_date.blocked_date_id,
        worker_id=blocked_date.worker_id,
        blocked_date=blocked_date.blocked_date.isoformat(),
        reason=blocked_date.reason,
        created_at=blocked_date.created_at.isoformat() if blocked_date.created_at else ""
    )

@router.delete("/blocked-dates/{blocked_date_id}")
def unblock_date(
    blocked_date_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unblock a date - make worker available again for this date"""
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can unblock dates"
        )
    
    worker = get_worker_for_user(current_user.id, db)
    
    # Find the blocked date
    blocked_date = db.query(WorkerBlockedDate).filter(
        WorkerBlockedDate.blocked_date_id == blocked_date_id,
        WorkerBlockedDate.worker_id == worker.worker_id
    ).first()
    
    if not blocked_date:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Blocked date not found"
        )
    
    db.delete(blocked_date)
    db.commit()
    
    return {"message": "Date unblocked successfully"}

@router.get("/blocked-dates/check/{worker_id}")
def check_if_date_blocked(
    worker_id: int,
    check_date: date,
    db: Session = Depends(get_db)
):
    """Check if a specific date is blocked for a worker (public endpoint for employers)"""
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    blocked = db.query(WorkerBlockedDate).filter(
        WorkerBlockedDate.worker_id == worker_id,
        WorkerBlockedDate.blocked_date == check_date
    ).first()
    
    return {
        "is_blocked": blocked is not None,
        "reason": blocked.reason if blocked else None
    }

