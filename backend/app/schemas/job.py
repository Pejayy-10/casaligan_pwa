"""
Job posting schemas based on ForumPost model
"""
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime


def _parse_hhmm(value: Optional[str]) -> Optional[int]:
    """Parse HH:MM into minutes since midnight."""
    if not value:
        return None
    try:
        hour, minute = value.split(":")
        h = int(hour)
        m = int(minute)
    except Exception as exc:
        raise ValueError("Time must be in HH:MM format") from exc
    if h < 0 or h > 23 or m < 0 or m > 59:
        raise ValueError("Time must be in HH:MM format")
    return h * 60 + m


def _validate_time_window(start_time: Optional[str], end_time: Optional[str], label: str, min_minutes: int = 60) -> None:
    """Validate non-empty, ordered, and minimum duration between start/end times."""
    start_minutes = _parse_hhmm(start_time)
    end_minutes = _parse_hhmm(end_time)

    if start_minutes is None or end_minutes is None:
        raise ValueError(f"{label}: start time and end time are required")
    if end_minutes <= start_minutes:
        raise ValueError(f"{label}: end time must be later than start time")
    if (end_minutes - start_minutes) < min_minutes:
        raise ValueError(f"{label}: minimum duration is {min_minutes} minutes")

class PaymentScheduleData(BaseModel):
    frequency: str  # weekly, biweekly, monthly, custom
    payment_amount: float
    payment_dates: List[str] = []  # For monthly: ["15", "30"]
    payment_method_preference: str  # gcash, maya, bank_transfer, cash

class RecurringScheduleData(BaseModel):
    """Recurring schedule for regular/repeating jobs"""
    is_recurring: bool = False
    day_of_week: Optional[str] = None  # "monday", "tuesday", ..., "sunday"
    start_time: Optional[str] = None  # "09:00" format
    end_time: Optional[str] = None  # "11:00" format
    frequency: Optional[str] = None  # "weekly", "biweekly", "monthly"

class MultiDayScheduleData(BaseModel):
    """Multi-day schedule with daily working hours"""
    num_days: int = Field(1, ge=1, le=13, description="Number of working days (1-13 for short term)")
    daily_start_time: str = Field(..., description="Daily start time in HH:MM format, e.g. '08:00'")
    daily_end_time: str = Field(..., description="Daily end time in HH:MM format, e.g. '15:00'")

class JobPostCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=20)
    house_type: str  # e.g., "apartment", "house", "condo"
    cleaning_type: str  # e.g., "general", "deep_cleaning", "move_in_out"
    budget: float = Field(..., gt=0)
    people_needed: int = Field(..., ge=1, le=10)
    image_urls: List[str] = []  # URLs to uploaded images
    duration_type: str  # "short_term" or "long_term"
    start_date: Optional[date] = None  # For long_term jobs
    end_date: Optional[date] = None  # For long_term jobs
    location: Optional[str] = None  # Job location (city/address)
    category_id: Optional[int] = None  # Legacy single category (kept for compatibility)
    category_ids: List[int] = []  # Multiple categories from package_categories
    new_category_name: Optional[str] = None  # Allow owner to create a new category if not found
    payment_schedule: Optional[PaymentScheduleData] = None  # For long_term jobs
    recurring_schedule: Optional[RecurringScheduleData] = None  # For recurring jobs
    multi_day_schedule: Optional[MultiDayScheduleData] = None  # For multi-day jobs

    @model_validator(mode="after")
    def validate_dates_and_times(self):
        today = date.today()

        if not self.start_date:
            raise ValueError("Start date is required")
        if self.start_date < today:
            raise ValueError("Start date cannot be in the past")

        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be earlier than start date")

        if self.duration_type == "long_term":
            if not self.end_date:
                raise ValueError("End date is required for long-term jobs")
            if self.end_date == self.start_date:
                raise ValueError("Long-term jobs must span at least 2 days")

        if self.recurring_schedule and self.recurring_schedule.is_recurring:
            if not self.recurring_schedule.day_of_week:
                raise ValueError("Recurring jobs require a day of week")
            if not self.recurring_schedule.frequency:
                raise ValueError("Recurring jobs require a frequency")
            _validate_time_window(
                self.recurring_schedule.start_time,
                self.recurring_schedule.end_time,
                label="Recurring schedule",
                min_minutes=60,
            )

        if self.multi_day_schedule:
            _validate_time_window(
                self.multi_day_schedule.daily_start_time,
                self.multi_day_schedule.daily_end_time,
                label="Daily schedule",
                min_minutes=60,
            )

        return self

class JobPostResponse(BaseModel):
    post_id: int
    employer_id: int
    title: str
    description: str
    house_type: str
    cleaning_type: str
    budget: float
    people_needed: int
    image_urls: List[str]
    duration_type: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_ids: List[int] = []
    category_names: List[str] = []
    status: str
    post_fee_percentage: float = 7.0
    post_fee_amount: float = 0.0
    post_fee_status: str = "paid"
    post_fee_checkout_id: Optional[str] = None
    post_fee_reference: Optional[str] = None
    post_fee_paid_at: Optional[str] = None
    created_at: str
    payment_schedule: Optional[dict] = None  # Payment schedule data
    recurring_schedule: Optional[dict] = None  # Recurring schedule data
    recurring_status: Optional[str] = None  # "active", "cancelled", "paused"
    recurring_cancelled_at: Optional[str] = None
    recurring_cancellation_reason: Optional[str] = None
    cancelled_by: Optional[str] = None  # "employer" or "worker"
    
    # Multi-day schedule info
    multi_day_schedule: Optional[dict] = None  # { num_days, daily_start_time, daily_end_time }
    day_schedules: List[dict] = []  # per-day status for multi-day jobs
    
    # Employer info
    employer_name: str
    employer_address: Optional[str] = None
    
    # Application stats
    total_applicants: int = 0
    
    # Payment stats (for long-term jobs)
    pending_payments: int = 0
    
    # Accepted workers info
    accepted_workers: List[dict] = []
    
    @classmethod
    def from_orm_model(cls, post, employer_user, applicants_count: int = 0, pending_payments_count: int = 0, accepted_workers_list: List[dict] = None):
        # Parse JSON fields if stored as JSON string in content field
        import json
        
        custom_fields = {}
        if post.content:
            try:
                parsed = json.loads(post.content)
                if isinstance(parsed, dict):
                    custom_fields = parsed
            except Exception:
                pass
        
        # Map job_type enum to duration_type string
        duration_type = "long_term" if post.is_longterm else "short_term"
        
        # Build multi-day schedule info
        num_days = getattr(post, 'num_days', None) or custom_fields.get('num_days', 1)
        daily_start = getattr(post, 'daily_start_time', None) or custom_fields.get('daily_start_time')
        daily_end = getattr(post, 'daily_end_time', None) or custom_fields.get('daily_end_time')
        multi_day_schedule = None
        if num_days and num_days > 1 and daily_start and daily_end:
            multi_day_schedule = {
                "num_days": num_days,
                "daily_start_time": daily_start,
                "daily_end_time": daily_end,
            }
        elif daily_start and daily_end:
            # Even single-day jobs can have time ranges
            multi_day_schedule = {
                "num_days": num_days or 1,
                "daily_start_time": daily_start,
                "daily_end_time": daily_end,
            }
        
        # Build per-day schedules if available
        day_schedules_list = []
        if hasattr(post, 'day_schedules') and post.day_schedules:
            for ds in sorted(post.day_schedules, key=lambda d: d.day_number):
                day_schedules_list.append({
                    "day_schedule_id": ds.day_schedule_id,
                    "day_number": ds.day_number,
                    "work_date": str(ds.work_date),
                    "start_time": ds.start_time,
                    "end_time": ds.end_time,
                    "status": ds.status,
                    "worker_id": ds.worker_id,
                })
        
        return cls(
            post_id=post.post_id,
            employer_id=post.employer_id,
            title=post.title,
            description=custom_fields.get('description', post.content or ''),
            house_type=custom_fields.get('house_type', 'house'),
            cleaning_type=custom_fields.get('cleaning_type', 'general'),
            budget=float(post.salary) if post.salary else custom_fields.get('budget', 0.0),
            people_needed=custom_fields.get('people_needed', 1),
            image_urls=custom_fields.get('image_urls', []),
            duration_type=duration_type,
            start_date=custom_fields.get('start_date') or post.start_date,
            end_date=post.end_date or custom_fields.get('end_date'),
            location=custom_fields.get('location') or post.location,
            category_id=post.category_id,
            category_name=post.category.name if post.category else None,
            category_ids=[cat.category_id for cat in post.categories] if hasattr(post, 'categories') and post.categories else [],
            category_names=[cat.name for cat in post.categories] if hasattr(post, 'categories') and post.categories else [],
            status=post.status.value if hasattr(post.status, 'value') else post.status,
            post_fee_percentage=float(getattr(post, 'post_fee_percentage', 7.0) or 7.0),
            post_fee_amount=float(getattr(post, 'post_fee_amount', 0.0) or 0.0),
            post_fee_status=(getattr(post, 'post_fee_status', None) or 'paid'),
            post_fee_checkout_id=getattr(post, 'post_fee_checkout_id', None),
            post_fee_reference=getattr(post, 'post_fee_reference', None),
            post_fee_paid_at=(post.post_fee_paid_at.isoformat() if getattr(post, 'post_fee_paid_at', None) else None),
            created_at=post.created_at.isoformat() if post.created_at else '',
            payment_schedule=custom_fields.get('payment_schedule'),
            recurring_schedule={
                "is_recurring": post.is_recurring if hasattr(post, 'is_recurring') else False,
                "day_of_week": post.day_of_week if hasattr(post, 'day_of_week') else None,
                "start_time": post.start_time if hasattr(post, 'start_time') else None,
                "end_time": post.end_time if hasattr(post, 'end_time') else None,
                "frequency": post.frequency if hasattr(post, 'frequency') else None,
            } if (hasattr(post, 'is_recurring') and post.is_recurring) else None,
            recurring_status=getattr(post, 'recurring_status', None),
            recurring_cancelled_at=str(post.recurring_cancelled_at) if hasattr(post, 'recurring_cancelled_at') and post.recurring_cancelled_at else None,
            recurring_cancellation_reason=getattr(post, 'recurring_cancellation_reason', None),
            cancelled_by=getattr(post, 'cancelled_by', None),
            multi_day_schedule=multi_day_schedule,
            day_schedules=day_schedules_list,
            employer_name=f"{employer_user.first_name} {employer_user.last_name}",
            employer_address=f"{employer_user.address.city_name}, {employer_user.address.province_name}" if employer_user.address else None,
            total_applicants=applicants_count,
            pending_payments=pending_payments_count,
            accepted_workers=accepted_workers_list or []
        )

class JobPostUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    house_type: Optional[str] = None
    cleaning_type: Optional[str] = None
    budget: Optional[float] = None
    people_needed: Optional[int] = None
    image_urls: Optional[List[str]] = None
    duration_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    location: Optional[str] = None
    category_id: Optional[int] = None
    category_ids: Optional[List[int]] = None
    new_category_name: Optional[str] = None  # Allow owner to create a new category if not found
    status: Optional[str] = None  # "open", "closed"
    multi_day_schedule: Optional[MultiDayScheduleData] = None
