"""Report models for disputes and complaints"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum


class ReportType(str, enum.Enum):
    UNPAID_JOB = "unpaid_job"  # Housekeeper reports owner didn't pay
    NON_COMPLETION = "non_completion"  # Owner reports housekeeper didn't complete job
    POOR_QUALITY = "poor_quality"  # Owner reports poor quality work
    NO_SHOW = "no_show"  # Owner reports housekeeper didn't show up
    HARASSMENT = "harassment"  # Either party reports harassment
    SCAM = "scam"  # Either party reports scam attempt
    OTHER = "other"
    
    def __str__(self):
        return self.value


class ReportStatus(str, enum.Enum):
    PENDING = "pending"  # Report submitted, awaiting review
    UNDER_REVIEW = "under_review"  # Admin is reviewing
    RESOLVED = "resolved"  # Issue resolved
    DISMISSED = "dismissed"  # Report dismissed (invalid)
    ESCALATED = "escalated"  # Escalated to higher authority
    
    def __str__(self):
        return self.value


class Report(Base):
    """Reports/complaints from users about jobs or other users"""
    __tablename__ = "reports"
    
    report_id = Column(Integer, primary_key=True, index=True)
    
    # Who submitted the report
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reporter_role = Column(String, nullable=False)  # 'housekeeper' or 'owner'
    
    # Who is being reported (optional - for user reports)
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Related job (optional - for job-related reports)
    post_id = Column(Integer, ForeignKey("forumposts.post_id"), nullable=True)
    
    # Report details
    report_type = Column(SQLEnum(ReportType, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    
    # Evidence/proof
    evidence_urls = Column(Text, nullable=True)  # JSON array of image URLs
    
    # Status tracking
    status = Column(SQLEnum(ReportStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=ReportStatus.PENDING)
    
    # Admin handling
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_notes = Column(Text, nullable=True)
    resolution = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id], backref="reports_submitted")
    reported_user = relationship("User", foreign_keys=[reported_user_id], backref="reports_received")
    admin = relationship("User", foreign_keys=[admin_id])
