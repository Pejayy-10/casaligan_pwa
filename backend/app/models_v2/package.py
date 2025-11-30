"""Worker Package model for direct hire services"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class WorkerPackage(Base):
    """Service packages offered by workers for direct hire"""
    __tablename__ = "worker_packages"
    
    package_id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False)
    
    # Package details
    name = Column(String(100), nullable=False)  # e.g., "Basic Cleaning", "Deep Clean", "Weekly Service"
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    duration_hours = Column(Integer, nullable=False, default=2)  # Estimated hours
    
    # Services included (JSON array of strings)
    # e.g., ["sweeping", "mopping", "bathroom cleaning", "kitchen cleaning"]
    services = Column(JSON, nullable=True, default=list)
    
    # Availability
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    worker = relationship("Worker", back_populates="packages")
