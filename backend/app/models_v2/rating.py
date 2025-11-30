"""Rating model for user reviews and ratings"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Float, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Rating(Base):
    """User ratings and reviews"""
    __tablename__ = "ratings"
    
    rating_id = Column(Integer, primary_key=True, index=True)
    
    # Who gave the rating
    rater_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Who received the rating
    rated_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # What job/hire this rating is for (one of these should be set)
    post_id = Column(Integer, ForeignKey("forumposts.post_id"), nullable=True)
    hire_id = Column(Integer, ForeignKey("direct_hires.hire_id"), nullable=True)
    
    # Rating details
    stars = Column(Integer, nullable=False)  # 1-5 stars
    review = Column(Text, nullable=True)  # Optional review text
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Constraints
    __table_args__ = (
        CheckConstraint('stars >= 1 AND stars <= 5', name='check_stars_range'),
    )
    
    # Relationships
    rater = relationship("User", foreign_keys=[rater_id], backref="ratings_given")
    rated_user = relationship("User", foreign_keys=[rated_user_id], backref="ratings_received")
