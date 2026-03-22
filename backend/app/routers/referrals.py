"""Referral router - API endpoints for referring housekeepers to other homeowners"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db import get_db
from app.models_v2.user import User, UserStatus
from app.models_v2.worker_employer import Worker
from app.security import get_current_user
from app.services.notification_service import notify_housekeeper_referral

router = APIRouter(prefix="/referrals", tags=["referrals"])


# ============== SCHEMAS ==============

class OwnerListItem(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    profile_picture: Optional[str] = None

    class Config:
        from_attributes = True


class ReferralRequest(BaseModel):
    worker_id: int
    target_owner_ids: List[int]


class ReferralResponse(BaseModel):
    message: str
    sent_count: int


# ============== ENDPOINTS ==============

@router.get("/owners", response_model=List[OwnerListItem])
def list_owners(
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all active homeowners (excluding the current user) for referral selection"""
    query = db.query(User).filter(
        User.is_owner == True,
        User.status == UserStatus.ACTIVE,
        User.id != current_user.id
    )

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term))
        )

    owners = query.order_by(User.first_name, User.last_name).limit(50).all()

    return [
        OwnerListItem(
            user_id=owner.id,
            first_name=owner.first_name,
            last_name=owner.last_name,
            profile_picture=owner.profile_picture
        )
        for owner in owners
    ]


@router.post("/refer", response_model=ReferralResponse)
def refer_housekeeper(
    request: ReferralRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refer a housekeeper to one or more homeowners"""
    # Verify the worker exists
    worker = db.query(Worker).filter(Worker.worker_id == request.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Get the worker's user record for their name
    worker_user = db.query(User).filter(User.id == worker.user_id).first()
    if not worker_user:
        raise HTTPException(status_code=404, detail="Worker user not found")

    worker_name = f"{worker_user.first_name} {worker_user.last_name}"
    referrer_name = f"{current_user.first_name} {current_user.last_name}"

    sent_count = 0
    for target_owner_id in request.target_owner_ids:
        # Verify target is a valid active owner and not the current user
        target = db.query(User).filter(
            User.id == target_owner_id,
            User.is_owner == True,
            User.status == UserStatus.ACTIVE
        ).first()

        if target and target.id != current_user.id:
            notify_housekeeper_referral(
                db=db,
                target_owner_user_id=target.id,
                referrer_name=referrer_name,
                worker_name=worker_name,
                worker_id=worker.worker_id
            )
            sent_count += 1

    if sent_count == 0:
        raise HTTPException(status_code=400, detail="No valid homeowners found to refer to")

    return ReferralResponse(
        message=f"Housekeeper referred to {sent_count} homeowner(s) successfully!",
        sent_count=sent_count
    )
