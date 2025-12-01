"""Address model - Clean version"""
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base

class Address(Base):
    __tablename__ = "addresses"
    
    address_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # PSGC codes and names (both sent by frontend)
    region_code = Column(String, nullable=True)
    region_name = Column(String, nullable=False)
    province_code = Column(String, nullable=True)
    province_name = Column(String, nullable=False)
    city_code = Column(String, nullable=True)
    city_name = Column(String, nullable=False)
    barangay_code = Column(String, nullable=True)
    barangay_name = Column(String, nullable=False)
    street_address = Column(String, nullable=True)
    subdivision = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    
    is_current = Column(String, default=True)
    
    # Relationship
    user = relationship("User", back_populates="address")
    
    def __repr__(self):
        return f"<Address(user_id={self.user_id}, city={self.city})>"
