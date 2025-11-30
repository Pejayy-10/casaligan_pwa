"""Notification model for in-app notifications"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum


class NotificationType(str, enum.Enum):
    # Job/Contract related (Flow 1)
    JOB_APPLICATION = "job_application"           # Worker applied to your job
    APPLICATION_ACCEPTED = "application_accepted" # Your application was accepted
    APPLICATION_REJECTED = "application_rejected" # Your application was rejected
    JOB_STARTED = "job_started"                   # Worker started the job
    COMPLETION_SUBMITTED = "completion_submitted" # Worker submitted completion proof
    COMPLETION_APPROVED = "completion_approved"   # Owner approved your completion
    PAYMENT_SENT = "payment_sent"                 # Owner sent payment
    PAYMENT_RECEIVED = "payment_received"         # Worker confirmed payment
    PAYMENT_DUE = "payment_due"                   # Payment is due (long-term)
    PAYMENT_OVERDUE = "payment_overdue"           # Payment is overdue
    
    # Direct Hire related (Flow 2)
    DIRECT_HIRE_REQUEST = "direct_hire_request"   # New direct hire request
    DIRECT_HIRE_ACCEPTED = "direct_hire_accepted" # Worker accepted your hire
    DIRECT_HIRE_REJECTED = "direct_hire_rejected" # Worker rejected your hire
    DIRECT_HIRE_STARTED = "direct_hire_started"   # Worker started direct hire job
    DIRECT_HIRE_COMPLETED = "direct_hire_completed"   # Worker submitted completion
    DIRECT_HIRE_APPROVED = "direct_hire_approved"     # Owner approved completion
    DIRECT_HIRE_PAID = "direct_hire_paid"             # Payment confirmed
    
    # General
    SYSTEM = "system"                             # System notification
    REMINDER = "reminder"                         # General reminder


class Notification(Base):
    """User notifications"""
    __tablename__ = "notifications"
    
    notification_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Notification content
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Reference to related entity (optional)
    reference_type = Column(String(50), nullable=True)  # 'job', 'direct_hire', 'contract', etc.
    reference_id = Column(Integer, nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    user = relationship("User", back_populates="notifications")
    
    def __repr__(self):
        return f"<Notification(id={self.notification_id}, user={self.user_id}, type={self.type})>"
