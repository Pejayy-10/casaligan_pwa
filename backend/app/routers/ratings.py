"""Rating router - API endpoints for ratings and reviews"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.rating import Rating
from app.models_v2.worker_employer import Worker
from app.security import get_current_user

router = APIRouter(prefix="/ratings", tags=["ratings"])


# ============== SCHEMAS ==============

class RatingCreate(BaseModel):
    rated_user_id: int
    stars: int = Field(..., ge=1, le=5)
    review: Optional[str] = None
    post_id: Optional[int] = None
    hire_id: Optional[int] = None


class RatingResponse(BaseModel):
    rating_id: int
    rater_id: int
    rater_name: str
    rated_user_id: int
    stars: int
    review: Optional[str]
    post_id: Optional[int]
    hire_id: Optional[int]
    created_at: str

    class Config:
        from_attributes = True


class RatingSummary(BaseModel):
    average_rating: float
    total_ratings: int
    rating_breakdown: dict  # {5: count, 4: count, ...}


# ============== ENDPOINTS ==============

@router.post("/", response_model=RatingResponse)
def create_rating(
    rating_data: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a rating for a user (after job completion)"""
    
    # Can't rate yourself
    if rating_data.rated_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot rate yourself"
        )
    
    # Check if rated user exists
    rated_user = db.query(User).filter(User.id == rating_data.rated_user_id).first()
    if not rated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if already rated this job/hire
    existing_query = db.query(Rating).filter(
        Rating.reviewer_user_id == current_user.id,
        Rating.target_user_id == rating_data.rated_user_id
    )
    
    if rating_data.post_id:
        existing_query = existing_query.filter(Rating.post_id == rating_data.post_id)
    elif rating_data.hire_id:
        existing_query = existing_query.filter(Rating.hire_id == rating_data.hire_id)
    
    if existing_query.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already rated this user for this job"
        )
    
    # Create rating
    rating = Rating(
        reviewer_user_id=current_user.id,
        target_user_id=rating_data.rated_user_id,
        rating=rating_data.stars,
        comment=rating_data.review,
        post_id=rating_data.post_id,
        hire_id=rating_data.hire_id
    )
    
    db.add(rating)
    db.commit()
    db.refresh(rating)
    
    rater_name = f"{current_user.first_name} {current_user.last_name}"
    
    return RatingResponse(
        rating_id=rating.review_id,
        rater_id=current_user.id,
        rater_name=rater_name,
        rated_user_id=rating.target_user_id,
        stars=rating.rating,
        review=rating.comment,
        post_id=rating.post_id,
        hire_id=rating.hire_id,
        created_at=rating.created_at.isoformat() if rating.created_at else ""
    )


@router.get("/user/{user_id}", response_model=List[RatingResponse])
def get_user_ratings(
    user_id: int,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get all ratings for a specific user"""
    
    ratings = db.query(Rating).filter(
        Rating.target_user_id == user_id
    ).order_by(Rating.created_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for rating in ratings:
        rater = db.query(User).filter(User.id == rating.reviewer_user_id).first()
        rater_name = f"{rater.first_name} {rater.last_name}" if rater else "Anonymous"
        
        result.append(RatingResponse(
            rating_id=rating.review_id,
            rater_id=rating.reviewer_user_id,
            rater_name=rater_name,
            rated_user_id=rating.target_user_id,
            stars=rating.rating,
            review=rating.comment,
            post_id=rating.post_id,
            hire_id=rating.hire_id,
            created_at=rating.created_at.isoformat() if rating.created_at else ""
        ))
    
    return result


@router.get("/user/{user_id}/summary", response_model=RatingSummary)
def get_user_rating_summary(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get rating summary (average + breakdown) for a user"""
    
    # Get all ratings for this user
    ratings = db.query(Rating).filter(Rating.target_user_id == user_id).all()
    
    if not ratings:
        return RatingSummary(
            average_rating=0.0,
            total_ratings=0,
            rating_breakdown={5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        )
    
    # Calculate average
    total = sum(r.rating for r in ratings)
    average = total / len(ratings)
    
    # Calculate breakdown
    breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for r in ratings:
        breakdown[r.rating] += 1
    
    return RatingSummary(
        average_rating=round(average, 1),
        total_ratings=len(ratings),
        rating_breakdown=breakdown
    )


@router.get("/check/{rated_user_id}")
def check_if_rated(
    rated_user_id: int,
    post_id: Optional[int] = None,
    hire_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user has already rated a specific user for a job/hire"""
    
    query = db.query(Rating).filter(
        Rating.reviewer_user_id == current_user.id,
        Rating.target_user_id == rated_user_id
    )
    
    if post_id:
        query = query.filter(Rating.post_id == post_id)
    elif hire_id:
        query = query.filter(Rating.hire_id == hire_id)
    
    existing = query.first()
    
    return {
        "has_rated": existing is not None,
        "rating": existing.rating if existing else None
    }


@router.delete("/{rating_id}")
def delete_rating(
    rating_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a rating (only the rater can delete their own rating)"""
    
    rating = db.query(Rating).filter(Rating.review_id == rating_id).first()
    
    if not rating:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rating not found"
        )
    
    if rating.reviewer_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own ratings"
        )
    
    db.delete(rating)
    db.commit()
    
    return {"message": "Rating deleted successfully"}
