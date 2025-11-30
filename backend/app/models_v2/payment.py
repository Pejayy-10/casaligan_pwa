"""Payment models - Clean version"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum

class PaymentFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    CONFIRMED = "confirmed"
    DISPUTED = "disputed"
    OVERDUE = "overdue"

class PaymentSchedule(Base):
    """Payment schedule configuration for long-term jobs"""
    __tablename__ = "payment_schedules"
    
    schedule_id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.contract_id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=True)  # Reference to worker for easier queries
    worker_name = Column(String, nullable=True)  # Cached worker name for display
    
    # Individual payment due date and amount
    due_date = Column(String, nullable=False)  # YYYY-MM-DD
    amount = Column(Numeric, nullable=False)
    status = Column(SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    contract = relationship("Contract", back_populates="payment_schedules")
    transaction = relationship("PaymentTransaction", back_populates="schedule", uselist=False)

class PaymentTransaction(Base):
    """Actual payment transactions with proof"""
    __tablename__ = "payment_transactions"
    
    transaction_id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("payment_schedules.schedule_id"), nullable=False, unique=True)
    
    # Payment details
    amount_paid = Column(Numeric, nullable=False)
    payment_method = Column(String, nullable=True)  # GCash, PayMaya, etc
    reference_number = Column(String, nullable=True)
    proof_url = Column(String, nullable=True)  # Screenshot/proof of payment
    
    # Status tracking
    status = Column(SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Dispute handling
    dispute_reason = Column(Text, nullable=True)
    dispute_resolved = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    schedule = relationship("PaymentSchedule", back_populates="transaction")
    
    # Convenience properties to get data from schedule
    @property
    def due_date(self):
        return self.schedule.due_date if self.schedule else None
    
    @property
    def amount(self):
        return self.schedule.amount if self.schedule else self.amount_paid

class CheckIn(Base):
    """Daily check-ins for job tracking"""
    __tablename__ = "checkins"
    
    checkin_id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.contract_id"), nullable=False)
    
    check_in_date = Column(String, nullable=False)  # YYYY-MM-DD
    notes = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

