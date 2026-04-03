"""Portfolio router - CRUD for housekeeper portfolio/credential photos"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Worker
from app.models_v2.portfolio import PortfolioPhoto
from app.security import get_current_user

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

MAX_PORTFOLIO_PHOTOS = 20  # Max photos per worker


# ── Schemas ───────────────────────────────────────────────────────────────────

class PortfolioPhotoCreate(BaseModel):
    image_url: str
    caption: Optional[str] = None
    category: str = "general"  # 'work_sample_before', 'work_sample_after', 'before_after', 'credentials', 'certification', 'work_sample', 'general'


class PortfolioPhotoResponse(BaseModel):
    id: int
    worker_id: int
    image_url: str
    caption: Optional[str]
    category: str
    created_at: Optional[str]

    class Config:
        from_attributes = True


class PortfolioPhotoUpdate(BaseModel):
    caption: Optional[str] = None
    category: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=List[PortfolioPhotoResponse])
def get_my_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get portfolio photos for the currently logged-in housekeeper"""
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        return []

    photos = db.query(PortfolioPhoto).filter(
        PortfolioPhoto.worker_id == worker.worker_id
    ).order_by(PortfolioPhoto.created_at.desc()).all()

    return [
        PortfolioPhotoResponse(
            id=p.id,
            worker_id=p.worker_id,
            image_url=p.image_url,
            caption=p.caption,
            category=p.category,
            created_at=p.created_at.isoformat() if p.created_at else None
        )
        for p in photos
    ]


@router.get("/worker/{worker_id}", response_model=List[PortfolioPhotoResponse])
def get_worker_portfolio(
    worker_id: int,
    db: Session = Depends(get_db)
):
    """Get portfolio photos for a specific worker (public, for owners to view)"""
    worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    photos = db.query(PortfolioPhoto).filter(
        PortfolioPhoto.worker_id == worker_id
    ).order_by(PortfolioPhoto.created_at.desc()).all()

    return [
        PortfolioPhotoResponse(
            id=p.id,
            worker_id=p.worker_id,
            image_url=p.image_url,
            caption=p.caption,
            category=p.category,
            created_at=p.created_at.isoformat() if p.created_at else None
        )
        for p in photos
    ]


@router.post("/", response_model=PortfolioPhotoResponse, status_code=201)
def add_portfolio_photo(
    data: PortfolioPhotoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a photo to the housekeeper's portfolio"""
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be a registered housekeeper to add portfolio photos."
        )

    # Check max limit
    count = db.query(PortfolioPhoto).filter(
        PortfolioPhoto.worker_id == worker.worker_id
    ).count()
    if count >= MAX_PORTFOLIO_PHOTOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_PORTFOLIO_PHOTOS} portfolio photos allowed."
        )

    # Validate category
    valid_categories = ['work_sample_before', 'work_sample_after', 'before_after', 'credentials', 'certification', 'work_sample', 'general']
    if data.category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )

    photo = PortfolioPhoto(
        worker_id=worker.worker_id,
        image_url=data.image_url,
        caption=data.caption,
        category=data.category,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return PortfolioPhotoResponse(
        id=photo.id,
        worker_id=photo.worker_id,
        image_url=photo.image_url,
        caption=photo.caption,
        category=photo.category,
        created_at=photo.created_at.isoformat() if photo.created_at else None,
    )


@router.post("/bulk", response_model=List[PortfolioPhotoResponse], status_code=201)
def add_portfolio_photos_bulk(
    photos: List[PortfolioPhotoCreate],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add multiple photos to the housekeeper's portfolio at once (used during registration)"""
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        # During registration, the worker record may not exist yet
        # Allow saving if user is_housekeeper or has a pending application
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must be a registered housekeeper to add portfolio photos."
        )

    existing_count = db.query(PortfolioPhoto).filter(
        PortfolioPhoto.worker_id == worker.worker_id
    ).count()

    if existing_count + len(photos) > MAX_PORTFOLIO_PHOTOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adding these would exceed the limit of {MAX_PORTFOLIO_PHOTOS} photos. You currently have {existing_count}."
        )

    valid_categories = ['work_sample_before', 'work_sample_after', 'before_after', 'credentials', 'certification', 'work_sample', 'general']
    created = []
    for p in photos:
        cat = p.category if p.category in valid_categories else 'general'
        photo = PortfolioPhoto(
            worker_id=worker.worker_id,
            image_url=p.image_url,
            caption=p.caption,
            category=cat,
        )
        db.add(photo)
        created.append(photo)

    db.commit()
    for photo in created:
        db.refresh(photo)

    return [
        PortfolioPhotoResponse(
            id=photo.id,
            worker_id=photo.worker_id,
            image_url=photo.image_url,
            caption=photo.caption,
            category=photo.category,
            created_at=photo.created_at.isoformat() if photo.created_at else None,
        )
        for photo in created
    ]


@router.put("/{photo_id}", response_model=PortfolioPhotoResponse)
def update_portfolio_photo(
    photo_id: int,
    data: PortfolioPhotoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update caption or category of a portfolio photo"""
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=403, detail="Not a housekeeper")

    photo = db.query(PortfolioPhoto).filter(
        PortfolioPhoto.id == photo_id,
        PortfolioPhoto.worker_id == worker.worker_id
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if data.caption is not None:
        photo.caption = data.caption
    if data.category is not None:
        valid_categories = ['work_sample_before', 'work_sample_after', 'before_after', 'credentials', 'certification', 'work_sample', 'general']
        if data.category not in valid_categories:
            raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}")
        photo.category = data.category

    db.commit()
    db.refresh(photo)

    return PortfolioPhotoResponse(
        id=photo.id,
        worker_id=photo.worker_id,
        image_url=photo.image_url,
        caption=photo.caption,
        category=photo.category,
        created_at=photo.created_at.isoformat() if photo.created_at else None,
    )


@router.delete("/{photo_id}")
def delete_portfolio_photo(
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a portfolio photo"""
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=403, detail="Not a housekeeper")

    photo = db.query(PortfolioPhoto).filter(
        PortfolioPhoto.id == photo_id,
        PortfolioPhoto.worker_id == worker.worker_id
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    db.delete(photo)
    db.commit()

    return {"message": "Photo deleted successfully"}
