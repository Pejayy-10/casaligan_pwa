"""Direct Hire model for booking workers directly"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, JSON, Enum as SQLEnum, Date, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum


class DirectHireStatus(str, enum.Enum):
    PENDING = "pending"           # Waiting for worker to accept
    ACCEPTED = "accepted"         # Worker accepted, waiting for scheduled date
    IN_PROGRESS = "in_progress"   # Work is being done
    PENDING_COMPLETION = "pending_completion"  # Worker submitted completion
    COMPLETED = "completed"       # Owner approved, ready for payment
    PAID = "paid"                 # Payment confirmed
    CANCELLED = "cancelled"       # Cancelled by either party
    REJECTED = "rejected"         # Worker rejected the hire
    
    def __str__(self):
        return self.value


class DirectHire(Base):
    """Direct hire bookings between employers and workers"""
    __tablename__ = "direct_hires"
    
    hire_id = Column(Integer, primary_key=True, index=True)
    employer_id = Column(Integer, ForeignKey("employers.employer_id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False)
    
    # Selected packages (JSON array of package_ids)
    package_ids = Column(JSON, nullable=False, default=list)
    
    # Pricing
    total_amount = Column(Numeric(10, 2), nullable=False)
    
    # Scheduling
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(String(10), nullable=True)  # e.g., "09:00"
    
    # Recurring schedule (for regular/repeating bookings)
    is_recurring = Column(Boolean, default=False, nullable=False)
    day_of_week = Column(String(20), nullable=True)  # e.g., "saturday", "monday"
    start_time = Column(String(10), nullable=True)  # e.g., "09:00"
    end_time = Column(String(10), nullable=True)  # e.g., "11:00"
    frequency = Column(String(20), nullable=True)  # "weekly", "biweekly", "monthly"
    recurring_status = Column(String(20), nullable=True, default="active")  # "active", "cancelled", "paused"
    recurring_cancelled_at = Column(DateTime(timezone=True), nullable=True)
    recurring_cancellation_reason = Column(Text, nullable=True)
    cancelled_by = Column(String(20), nullable=True)  # "employer" or "worker"
    
    # Location (can be different from employer's address)
    address_street = Column(String, nullable=True)
    address_barangay = Column(String, nullable=True)
    address_city = Column(String, nullable=True)
    address_province = Column(String, nullable=True)
    address_region = Column(String, nullable=True)
    
    # Notes
    special_instructions = Column(Text, nullable=True)
    
    # Status
    status = Column(SQLEnum(DirectHireStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=DirectHireStatus.PENDING)
    
    # Completion tracking
    completion_proof_url = Column(String, nullable=True)
    completion_notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Payment tracking
    payment_method = Column(String, nullable=True)
    payment_proof_url = Column(String, nullable=True)
    reference_number = Column(String, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employer = relationship("Employer", back_populates="direct_hires")
    worker = relationship("Worker", back_populates="direct_hires")
