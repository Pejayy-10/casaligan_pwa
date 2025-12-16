"""Worker Package model for direct hire services"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum


class PackageAvailability(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    
    def __str__(self):
        return self.value


class PackageStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    
    def __str__(self):
        return self.value


class WorkerPackage(Base):
    """Service packages offered by workers for direct hire"""
    __tablename__ = "packages"
    
    package_id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False)
    
    # Package details (both title and name for compatibility)
    title = Column(String, nullable=False)  # Admin web uses this
    name = Column(String(100), nullable=True)  # Mobile app uses this
    description = Column(Text, nullable=True)
    price = Column(Numeric, nullable=False)
    duration_hours = Column(Integer, nullable=True, default=2)  # Estimated hours
    
    # Services included (JSON array of strings)
    # e.g., ["sweeping", "mopping", "bathroom cleaning", "kitchen cleaning"]
    services = Column(JSON, nullable=True, default=list)
    
    # Availability and status (for admin web)
    availability = Column(SQLEnum(PackageAvailability, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=True)
    status = Column(SQLEnum(PackageStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=PackageStatus.ACTIVE)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Category
    category_id = Column(Integer, ForeignKey("package_categories.category_id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    worker = relationship("Worker", back_populates="packages")
    category = relationship("PackageCategory", back_populates="packages")
