from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum


class ConversationStatus(str, enum.Enum):
    ACTIVE = "active"
    READ_ONLY = "read_only"
    ARCHIVED = "archived"
    
    def __str__(self):
        return self.value


class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(Integer, primary_key=True, index=True)
    
    # Link to job or direct hire (one of these should be set)
    job_id = Column(Integer, ForeignKey("forumposts.post_id"), nullable=True)
    hire_id = Column(Integer, ForeignKey("direct_hires.hire_id"), nullable=True)
    
    # Participants (array of user IDs)
    participant_ids = Column(ARRAY(Integer), nullable=False)
    
    # Conversation metadata
    title = Column(String(255), nullable=True)  # Optional custom title
    status = Column(SQLEnum(ConversationStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]), default=ConversationStatus.ACTIVE)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    archived_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    messages = relationship("Message", back_populates="conversation", order_by="Message.sent_at")


class Message(Base):
    __tablename__ = "messages"

    message_id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.conversation_id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Message content
    content = Column(Text, nullable=False)
    message_type = Column(String(50), default="text")  # text, image, system
    
    # Timestamps
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)  # When recipient read it
    
    # Soft delete
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
