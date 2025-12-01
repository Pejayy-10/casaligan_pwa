"""User model - Clean version"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum

class UserStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    
    def __str__(self):
        return self.value

class UserRole(str, enum.Enum):
    OWNER = "owner"
    HOUSEKEEPER = "housekeeper"
    
    def __str__(self):
        return self.value

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    
    # Personal info
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=False)
    suffix = Column(String, nullable=True)
    
    # Role and status
    is_owner = Column(Boolean, default=True, nullable=False)
    is_housekeeper = Column(Boolean, default=False, nullable=False)
    active_role = Column(SQLEnum(UserRole, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=UserRole.OWNER, nullable=False)
    status = Column(SQLEnum(UserStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=UserStatus.ACTIVE, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - only essential ones
    address = relationship("Address", back_populates="user", uselist=False)
    documents = relationship("UserDocument", back_populates="user")
    housekeeper_application = relationship("HousekeeperApplication", back_populates="user", uselist=False)
    worker = relationship("Worker", back_populates="user", uselist=False)
    employer = relationship("Employer", back_populates="user", uselist=False)
    forum_posts = relationship("ForumPost", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"
