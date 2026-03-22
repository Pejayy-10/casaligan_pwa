"""Multi-day job scheduling models"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class JobDaySchedule(Base):
    """Per-day schedule for multi-day jobs (job posts and direct hires)"""
    __tablename__ = "job_day_schedules"

    day_schedule_id = Column(Integer, primary_key=True, index=True)

    # Polymorphic FK – exactly one should be set
    post_id = Column(Integer, ForeignKey("forumposts.post_id", ondelete="CASCADE"), nullable=True)
    hire_id = Column(Integer, ForeignKey("direct_hires.hire_id", ondelete="CASCADE"), nullable=True)

    worker_id = Column(Integer, ForeignKey("workers.worker_id"), nullable=False)
    work_date = Column(Date, nullable=False)
    start_time = Column(String(10), nullable=False)  # "08:00"
    end_time = Column(String(10), nullable=False)  # "15:00"
    day_number = Column(Integer, nullable=False, default=1)

    # pending | in_progress | pending_completion | completed | skipped
    status = Column(String(30), nullable=False, default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    post = relationship("ForumPost", backref="day_schedules")
    hire = relationship("DirectHire", backref="day_schedules")
    worker = relationship("Worker")
    completions = relationship("DailyCompletion", back_populates="day_schedule", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<JobDaySchedule(id={self.day_schedule_id}, date={self.work_date}, day={self.day_number}, status={self.status})>"


class DailyCompletion(Base):
    """Confirmation record – both owner and housekeeper must confirm each day"""
    __tablename__ = "daily_completions"

    completion_id = Column(Integer, primary_key=True, index=True)
    day_schedule_id = Column(Integer, ForeignKey("job_day_schedules.day_schedule_id", ondelete="CASCADE"), nullable=False)

    confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(20), nullable=False)  # 'owner' | 'housekeeper'

    proof_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    day_schedule = relationship("JobDaySchedule", back_populates="completions")
    user = relationship("User")

    def __repr__(self):
        return f"<DailyCompletion(id={self.completion_id}, schedule={self.day_schedule_id}, role={self.role})>"
