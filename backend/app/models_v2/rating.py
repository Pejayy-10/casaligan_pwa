"""Rating model for user reviews and ratings"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Text, CheckConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Rating(Base):
    """User ratings and reviews - uses reviews table with generated columns"""
    __tablename__ = "reviews"
    
    review_id = Column(Integer, primary_key=True, index=True)
    
    # Actual columns that can be inserted
    reviewer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.contract_id"), nullable=True)
    post_id = Column(Integer, ForeignKey("forumposts.post_id"), nullable=True)
    hire_id = Column(Integer, ForeignKey("direct_hires.hire_id"), nullable=True)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    comment = Column(Text, nullable=True)  # Optional review text
    
    # Admin moderation fields
    is_hidden = Column(Boolean, default=False)
    hidden_at = Column(DateTime(timezone=True), nullable=True)
    hidden_by_admin_id = Column(Integer, nullable=True)
    warned_at = Column(DateTime(timezone=True), nullable=True)
    warned_by_admin_id = Column(Integer, nullable=True)
    restricted_at = Column(DateTime(timezone=True), nullable=True)
    restricted_by_admin_id = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
    )
    
    # Relationships
    rater = relationship("User", foreign_keys=[reviewer_user_id], backref="ratings_given")
    rated_user = relationship("User", foreign_keys=[target_user_id], backref="ratings_received")
