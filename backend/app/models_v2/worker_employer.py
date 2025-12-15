"""Worker and Employer models - Clean version"""
from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base

class Worker(Base):
    __tablename__ = "workers"
    
    worker_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Relationships
    user = relationship("User", back_populates="worker")
    interest_checks = relationship("InterestCheck", back_populates="worker")
    packages = relationship("WorkerPackage", back_populates="worker")
    direct_hires = relationship("DirectHire", back_populates="worker")
    blocked_dates = relationship("WorkerBlockedDate", back_populates="worker")

class Employer(Base):
    __tablename__ = "employers"
    
    employer_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Relationships
    user = relationship("User", back_populates="employer")
    forum_posts = relationship("ForumPost", back_populates="employer")
    direct_hires = relationship("DirectHire", back_populates="employer")

