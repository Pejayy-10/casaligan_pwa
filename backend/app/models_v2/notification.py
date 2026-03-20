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
    JOB_EDITED = "job_edited"                     # Job was edited after application
    COMPLETION_SUBMITTED = "completion_submitted" # Worker submitted completion proof
    COMPLETION_APPROVED = "completion_approved"   # Owner approved your completion
    PAYMENT_SENT = "payment_sent"                 # Owner sent payment
    PAYMENT_RECEIVED = "payment_received"         # Worker confirmed payment
    PAYMENT_REVIEW = "payment_review"             # Payment needs review/confirmation
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
    
    # Contract Extension related
    CONTRACT_EXTENSION_PROPOSED = "contract_extension_proposed"  # Owner proposed extension
    CONTRACT_EXTENSION_ACCEPTED = "contract_extension_accepted"  # Worker accepted extension
    CONTRACT_EXTENSION_REJECTED = "contract_extension_rejected"  # Worker rejected extension
    
    # Schedule Conflict related
    APPLICATION_WITHDRAWN_DUE_TO_CONFLICT = "application_withdrawn_due_to_conflict"  # Your application was withdrawn due to schedule conflict
    APPLICANT_WITHDRAWN_DUE_TO_CONFLICT = "applicant_withdrawn_due_to_conflict"      # Applicant withdrew due to schedule conflict
    DIRECT_HIRE_REJECTED_DUE_TO_CONFLICT = "direct_hire_rejected_due_to_conflict"    # Direct hire request rejected due to conflict
    HIRE_CANCELED_WORKER_ACCEPTED_CONFLICT = "hire_canceled_worker_accepted_conflict" # Hire request canceled, worker accepted conflicting job
    
    # Daily completion related (multi-day jobs)
    DAILY_COMPLETION_SUBMITTED = "daily_completion_submitted"   # Housekeeper confirmed day's work done
    DAILY_COMPLETION_CONFIRMED = "daily_completion_confirmed"   # Owner confirmed day's work done
    DAILY_ALL_CONFIRMED = "daily_all_confirmed"                 # Both parties confirmed – day complete
    
    # Referral related
    HOUSEKEEPER_REFERRAL = "housekeeper_referral" # Homeowner referred a housekeeper to you
    
    # General
    SYSTEM = "system"                             # System notification
    REMINDER = "reminder"                         # General reminder
    
    def __str__(self):
        return self.value


class Notification(Base):
    """User notifications"""
    __tablename__ = "notifications"
    
    notification_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Notification content
    type = Column(SQLEnum(NotificationType, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
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
