"""Worker availability/blocked dates model"""
from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base

class WorkerBlockedDate(Base):
    """Blocked dates for workers - dates when they are unavailable for direct hire"""
    __tablename__ = "worker_blocked_dates"
    
    blocked_date_id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False)
    blocked_date = Column(Date, nullable=False)
    reason = Column(String, nullable=True)  # Optional reason for blocking (e.g., "Personal", "Holiday", "Already booked")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    worker = relationship("Worker", back_populates="blocked_dates")
    
    def __repr__(self):
        return f"<WorkerBlockedDate(worker_id={self.worker_id}, date={self.blocked_date})>"

