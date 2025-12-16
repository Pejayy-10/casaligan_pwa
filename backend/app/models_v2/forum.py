"""Forum/Jobs models - Clean version"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum

class JobType(str, enum.Enum):
    ONETIME = "onetime"
    LONGTERM = "longterm"
    
    def __str__(self):
        return self.value

class ForumPostStatus(str, enum.Enum):
    OPEN = "open"
    ONGOING = "ongoing"
    PENDING_COMPLETION = "pending_completion"  # Housekeeper submitted proof, waiting for owner approval
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    
    def __str__(self):
        return self.value

class ForumPost(Base):
    """Job postings"""
    __tablename__ = "forumposts"
    
    post_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    employer_id = Column(Integer, ForeignKey("employers.employer_id"), nullable=False)
    category_id = Column(Integer, ForeignKey("package_categories.category_id"), nullable=True)
    
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    job_type = Column(SQLEnum(JobType, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    salary = Column(Numeric, nullable=False)
    status = Column(SQLEnum(ForumPostStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ForumPostStatus.OPEN)
    
    # Long-term job fields
    is_longterm = Column(Boolean, default=False)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    payment_frequency = Column(String, nullable=True)
    payment_amount = Column(Numeric, nullable=True)
    payment_schedule = Column(Text, nullable=True)  # JSON string
    
    # Recurring schedule (for regular/repeating jobs)
    is_recurring = Column(Boolean, default=False, nullable=False)
    day_of_week = Column(String(20), nullable=True)  # e.g., "saturday", "monday"
    start_time = Column(String(10), nullable=True)  # e.g., "09:00"
    end_time = Column(String(10), nullable=True)  # e.g., "11:00"
    frequency = Column(String(20), nullable=True)  # "weekly", "biweekly", "monthly"
    recurring_status = Column(String(20), nullable=True, default="active")  # "active", "cancelled", "paused"
    recurring_cancelled_at = Column(DateTime(timezone=True), nullable=True)
    recurring_cancellation_reason = Column(Text, nullable=True)
    cancelled_by = Column(String(20), nullable=True)  # "employer" or "worker"
    
    # Job completion fields
    completion_proof_url = Column(String, nullable=True)  # Photo/video proof of completion
    completion_notes = Column(Text, nullable=True)  # Notes from housekeeper
    completed_at = Column(DateTime(timezone=True), nullable=True)  # When job was marked completed
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="forum_posts")
    employer = relationship("Employer", back_populates="forum_posts")
    category = relationship("PackageCategory", foreign_keys=[category_id])
    interest_checks = relationship("InterestCheck", back_populates="post")
    contracts = relationship("Contract", back_populates="post")  # Multiple contracts per job (one per worker)

class InterestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    
    def __str__(self):
        return self.value

class InterestCheck(Base):
    """Job applications"""
    __tablename__ = "interestcheck"
    
    interest_id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("forumposts.post_id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False)
    status = Column(SQLEnum(InterestStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=InterestStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    post = relationship("ForumPost", back_populates="interest_checks")
    worker = relationship("Worker", back_populates="interest_checks")
