"""Notification router - API endpoints for notifications"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.notification import Notification, NotificationType
from app.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ============== SCHEMAS ==============

class NotificationResponse(BaseModel):
    notification_id: int
    type: str
    title: str
    message: str
    reference_type: Optional[str]
    reference_id: Optional[int]
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True


class NotificationCountResponse(BaseModel):
    unread_count: int
    total_count: int


# ============== HELPER FUNCTION ==============

def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[int] = None
) -> Notification:
    """Helper function to create a notification"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


# ============== ENDPOINTS ==============

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's notifications"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    
    return [
        NotificationResponse(
            notification_id=n.notification_id,
            type=n.type.value,
            title=n.title,
            message=n.message,
            reference_type=n.reference_type,
            reference_id=n.reference_id,
            is_read=n.is_read,
            created_at=n.created_at.isoformat() if n.created_at else ""
        )
        for n in notifications
    ]


@router.get("/count", response_model=NotificationCountResponse)
def get_notification_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get notification counts"""
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    
    total_count = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).count()
    
    return NotificationCountResponse(
        unread_count=unread_count,
        total_count=total_count
    )


@router.post("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read"""
    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = func.now()
    db.commit()
    
    return {"message": "Notification marked as read"}


@router.post("/read-all")
def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        "is_read": True,
        "read_at": func.now()
    })
    db.commit()
    
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification"""
    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted"}


@router.delete("/")
def clear_all_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete all notifications for user"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).delete()
    db.commit()
    
    return {"message": "All notifications cleared"}
