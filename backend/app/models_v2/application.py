"""Application model - Clean version"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum

class ApplicationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    
    def __str__(self):
        return self.value

class HousekeeperApplication(Base):
    __tablename__ = "housekeeper_applications"
    
    application_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SQLEnum(ApplicationStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ApplicationStatus.PENDING)
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    # Relationship
    user = relationship("User", back_populates="housekeeper_application")
