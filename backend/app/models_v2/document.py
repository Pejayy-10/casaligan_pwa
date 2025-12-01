"""Document models - Clean version"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum

class DocumentType(str, enum.Enum):
    NATIONAL_ID = "national_id"
    DRIVERS_LICENSE = "drivers_license"
    PASSPORT = "passport"
    BARANGAY_CLEARANCE = "barangay_clearance"
    NBI_CLEARANCE = "nbi_clearance"
    POLICE_CLEARANCE = "police_clearance"
    MEDICAL_CERTIFICATE = "medical_certificate"
    
    def __str__(self):
        return self.value

class UserDocument(Base):
    __tablename__ = "user_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_type = Column(SQLEnum(DocumentType, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(String, default="pending", nullable=False)
    notes = Column(String, nullable=True)
    rejection_reason = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationship
    user = relationship("User", back_populates="documents")
