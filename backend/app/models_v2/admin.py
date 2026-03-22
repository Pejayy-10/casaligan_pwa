"""Admin model"""
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base


class Admin(Base):
    """Admin users with elevated privileges"""
    __tablename__ = "admins"
    
    admin_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    admin_actions = Column(String, nullable=True)
    
    # Relationships
    user = relationship("User", backref="admin")
