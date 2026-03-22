"""Portfolio photos model - Housekeeper portfolio/credential showcase"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class PortfolioPhoto(Base):
    __tablename__ = "portfolio_photos"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False, index=True)
    image_url = Column(String, nullable=False)
    caption = Column(String(255), nullable=True)
    category = Column(String(50), nullable=False, default="general")
    # Categories: 'before_after', 'credentials', 'certification', 'work_sample', 'general'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    worker = relationship("Worker", back_populates="portfolio_photos")

    def __repr__(self):
        return f"<PortfolioPhoto(id={self.id}, worker_id={self.worker_id}, category={self.category})>"
