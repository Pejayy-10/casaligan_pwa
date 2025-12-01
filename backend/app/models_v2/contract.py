"""Contract model - Clean version"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum

class ContractStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    PENDING_COMPLETION = "pending_completion"  # Worker submitted, waiting for owner approval
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    
    def __str__(self):
        return self.value

class Contract(Base):
    __tablename__ = "contracts"
    
    contract_id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("forumposts.post_id"), nullable=False)  # Multiple contracts per job allowed
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False)
    employer_id = Column(Integer, ForeignKey("employers.employer_id"), nullable=False)
    
    contract_terms = Column(Text, nullable=True)  # JSON string
    status = Column(SQLEnum(ContractStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ContractStatus.PENDING)
    
    # Acceptance tracking
    worker_accepted = Column(Integer, default=0)  # 0=pending, 1=accepted, -1=rejected
    employer_accepted = Column(Integer, default=0)
    
    # Completion tracking (per worker)
    completion_proof_url = Column(String, nullable=True)
    completion_notes = Column(Text, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    payment_proof_url = Column(String, nullable=True)  # Owner's payment proof for this worker
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    post = relationship("ForumPost", back_populates="contracts")
    worker = relationship("Worker")
    payment_schedules = relationship("PaymentSchedule", back_populates="contract")
