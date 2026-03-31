"""Worker and Employer models - Clean version"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db import Base

class Worker(Base):
    __tablename__ = "workers"
    
    worker_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Professional profile (populated from housekeeper application)
    bio = Column(Text, nullable=True)
    years_experience = Column(Integer, nullable=True)
    skills = Column(Text, nullable=True)          # JSON-encoded list of skill strings
    availability = Column(String, nullable=True)  # 'full_time' | 'part_time' | 'weekends_only'
    
    # Availability toggle - worker can set this to False to go "Inactive" for direct hire
    is_available = Column(Boolean, default=True, nullable=False, server_default='true')

    # Alternate contact number (housekeeper-only, OTP-verified)
    alt_phone_number = Column(String(20), nullable=True)
    alt_phone_verified = Column(Boolean, default=False, nullable=False, server_default='false')
    
    # Relationships
    user = relationship("User", back_populates="worker")
    interest_checks = relationship("InterestCheck", back_populates="worker")
    packages = relationship("WorkerPackage", back_populates="worker")
    direct_hires = relationship("DirectHire", back_populates="worker")
    blocked_dates = relationship("WorkerBlockedDate", back_populates="worker")
    portfolio_photos = relationship("PortfolioPhoto", back_populates="worker", order_by="PortfolioPhoto.created_at.desc()")

class Employer(Base):
    __tablename__ = "employers"
    
    employer_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Relationships
    user = relationship("User", back_populates="employer")
    forum_posts = relationship("ForumPost", back_populates="employer")
    direct_hires = relationship("DirectHire", back_populates="employer")

