"""
Job posting endpoints using ForumPost model
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_
from sqlalchemy.sql import func
from typing import List, Optional
from datetime import datetime, timezone, date
from pydantic import BaseModel
import json
import re
import google.generativeai as genai
from decimal import Decimal
import os
from urllib.parse import urlparse
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Employer, Worker
from app.models_v2.forum import ForumPost, ForumPostStatus, InterestCheck, InterestStatus, JobType, EditResponseStatus
from app.models_v2.contract import Contract, ContractStatus
from app.models_v2.contract_extension import ContractExtension, ExtensionStatus
from app.models_v2.conversation import Conversation
from app.models_v2.payment import PaymentSchedule, PaymentStatus, PaymentTransaction
from app.security import get_current_user
from app.schemas.job import JobPostCreate, JobPostResponse, JobPostUpdate
from app.services.notification_service import (
    notify_job_application,
    notify_application_accepted,
    notify_application_rejected,
    notify_completion_submitted,
    notify_completion_approved,
    notify_payment_sent,
    notify_payment_received,
    notify_user
)
from app.models_v2.notification import NotificationType
from app.services.maya_service import (
    create_checkout,
    retrieve_checkout,
    normalize_checkout_status,
    maya_is_configured,
)
from app.utils.platform_fees import get_post_fee_percentage

router = APIRouter(prefix="/jobs", tags=["jobs"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _is_weekly_recurring_post(post: ForumPost) -> bool:
    if not getattr(post, "is_recurring", False):
        return False
    if (getattr(post, "recurring_status", None) or "active") != "active":
        return False
    return (getattr(post, "frequency", None) or "").lower() == "weekly"


def _ensure_current_week_post_fee_status(db: Session, post: ForumPost) -> bool:
    """
    For active weekly recurring posts, require one owner post-fee payment per ISO week.

    Returns True when post fields were mutated.
    """
    if not _is_weekly_recurring_post(post):
        return False

    current_status = (getattr(post, "post_fee_status", "pending") or "pending").lower()
    if current_status != "paid":
        return False

    paid_at = getattr(post, "post_fee_paid_at", None)
    now_utc = datetime.now(timezone.utc)

    latest_worker_paid_at = db.query(func.max(Contract.paid_at)).filter(
        Contract.post_id == post.post_id,
        Contract.paid_at.isnot(None)
    ).scalar()

    if latest_worker_paid_at and latest_worker_paid_at.tzinfo is None:
        latest_worker_paid_at = latest_worker_paid_at.replace(tzinfo=timezone.utc)

    if paid_at and paid_at.tzinfo is None:
        paid_at = paid_at.replace(tzinfo=timezone.utc)

    # If the previous cycle has already been paid out to worker(s), require the
    # owner's next weekly recurring posting fee before the next cycle proceeds.
    if latest_worker_paid_at and (not paid_at or latest_worker_paid_at > paid_at):
        post.post_fee_status = "pending_owner_weekly"
        post.post_fee_checkout_id = None
        post.post_fee_reference = None
        return True

    if not paid_at or paid_at.isocalendar()[:2] != now_utc.isocalendar()[:2]:
        post.post_fee_status = "pending_owner_weekly"
        post.post_fee_checkout_id = None
        post.post_fee_reference = None
        return True

    return False


def _extract_post_start_date(post: ForumPost) -> Optional[date]:
    raw_start = getattr(post, "start_date", None)
    if raw_start:
        try:
            return datetime.fromisoformat(str(raw_start)).date()
        except ValueError:
            pass

    if post.content and str(post.content).startswith("{"):
        try:
            details = json.loads(post.content)
            maybe_start = details.get("start_date") if isinstance(details, dict) else None
            if maybe_start:
                return datetime.fromisoformat(str(maybe_start)).date()
        except Exception:
            return None

    return None


def _ensure_post_date_reached(post: ForumPost, *, action: str) -> None:
    start_date = _extract_post_start_date(post)
    if not start_date:
        return

    today_utc = datetime.now(timezone.utc).date()
    if today_utc < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot {action} before the scheduled date ({start_date.isoformat()}).",
        )


def _percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    ordered = sorted(values)
    rank = (len(ordered) - 1) * p
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    weight = rank - low
    return ordered[low] * (1 - weight) + ordered[high] * weight


def _median_int(values: List[int], fallback: int = 1) -> int:
    if not values:
        return fallback
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return max(1, ordered[mid])
    return max(1, round((ordered[mid - 1] + ordered[mid]) / 2))


def _extract_post_details(post: ForumPost) -> dict:
    if not post.content:
        return {}
    try:
        parsed = json.loads(post.content)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _build_quick_suggestions(cleaning_type: str, house_type: str, duration_type: str) -> dict:
    cleaning_label = {
        "general": "General Cleaning",
        "deep_cleaning": "Deep Cleaning",
        "move_in_out": "Move In/Out Cleaning",
        "post_construction": "Post-Construction Cleaning",
        "spring_cleaning": "Spring Cleaning",
        "maintenance": "Regular Maintenance",
    }.get(cleaning_type, "Home Cleaning")

    house_label = {
        "house": "House",
        "apartment": "Apartment",
        "condo": "Condo",
        "townhouse": "Townhouse",
        "office": "Office",
        "other": "Property",
    }.get(house_type, "Property")

    duration_label = "Long-term" if duration_type == "long_term" else "Short-term"

    titles = [
        f"{cleaning_label} Needed for {house_label}",
        f"{duration_label} {cleaning_label} Service",
        f"Experienced Housekeeper for {cleaning_label}",
    ]

    descriptions = [
        f"Looking for a reliable housekeeper for {cleaning_label.lower()} in our {house_label.lower()}. Please bring your own cleaning tools if possible.",
        "Main priorities are cleanliness, attention to detail, and punctuality. We prefer someone with relevant experience and good communication.",
        "Please include your availability, nearby location, and experience with similar homes when applying.",
    ]

    checklist = [
        "Sweep and mop all floors",
        "Clean kitchen surfaces and sink",
        "Scrub and disinfect bathroom",
        "Dust furniture and wipe surfaces",
        "Dispose of trash and tidy common areas",
    ]

    return {
        "titles": titles,
        "descriptions": descriptions,
        "checklist": checklist,
    }


def _extract_json_payload(raw_text: str) -> Optional[dict]:
    if not raw_text:
        return None

    text = raw_text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", text, re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(text[start:end + 1])
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def _compute_benchmark_for_ai(
    *,
    db: Session,
    cleaning_type: str,
    house_type: str,
    duration_type: str,
    city_name: Optional[str],
    people_needed: Optional[int],
) -> dict:
    is_long_term = duration_type == "long_term"
    city_query = (city_name or "").strip().lower()

    candidates = db.query(ForumPost).filter(
        ForumPost.deleted_at.is_(None),
        ForumPost.status == ForumPostStatus.COMPLETED,
        ForumPost.is_longterm == is_long_term,
        ForumPost.salary.isnot(None),
    ).order_by(desc(ForumPost.created_at)).limit(500).all()

    def matches(post: ForumPost, mode: str) -> bool:
        details = _extract_post_details(post)
        post_cleaning = (details.get("cleaning_type") or "").strip().lower()
        post_house = (details.get("house_type") or "").strip().lower()
        location_text = ((details.get("location") or post.location or "")).lower()

        if post_cleaning != cleaning_type.strip().lower():
            return False
        if mode == "strict" and post_house and post_house != house_type.strip().lower():
            return False
        if city_query and mode in {"strict", "broad"} and city_query not in location_text:
            return False
        return True

    scope = "strict"
    filtered = [post for post in candidates if matches(post, "strict")]
    if len(filtered) < 8:
        scope = "broad"
        filtered = [post for post in candidates if matches(post, "broad")]
    if len(filtered) < 5:
        scope = "global"
        filtered = [
            post
            for post in candidates
            if _extract_post_details(post).get("cleaning_type", "").strip().lower() == cleaning_type.strip().lower()
        ]

    budgets: List[float] = []
    people_values: List[int] = []
    num_days_values: List[int] = []

    for post in filtered:
        details = _extract_post_details(post)
        budget = _safe_float(post.salary, 0.0)
        if budget > 0:
            budgets.append(budget)

        try:
            people = int(details.get("people_needed", 1))
            if people > 0:
                people_values.append(people)
        except (TypeError, ValueError):
            pass

        try:
            num_days = int(details.get("num_days", 1))
            if num_days > 0:
                num_days_values.append(num_days)
        except (TypeError, ValueError):
            pass

    if not budgets:
        budgets = [500.0, 800.0, 1200.0]

    p25 = round(_percentile(budgets, 0.25), 2)
    p50 = round(_percentile(budgets, 0.50), 2)
    p75 = round(_percentile(budgets, 0.75), 2)

    return {
        "budget": {
            "min": p25,
            "recommended": p50,
            "max": p75,
        },
        "recommended_people_needed": _median_int(people_values, fallback=people_needed or 1),
        "recommended_num_days": _median_int(num_days_values, fallback=1 if duration_type == "short_term" else 14),
        "meta": {
            "sample_size": len(filtered),
            "scope": scope,
            "confidence": "high" if len(filtered) >= 20 else "medium" if len(filtered) >= 8 else "low",
        },
    }


class JobAISuggestRequest(BaseModel):
    mode: Optional[str] = "auto"
    title: Optional[str] = None
    description: Optional[str] = None
    house_type: str
    cleaning_type: str
    duration_type: str
    city_name: Optional[str] = None
    categories: List[str] = []
    budget: Optional[float] = None
    people_needed: Optional[int] = None
    num_days: Optional[int] = None


@router.post("/ai-suggest")
def get_job_ai_suggestions(
    payload: JobAISuggestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-assisted job form suggestions from categories/details or title+description."""
    _ = current_user

    benchmark = _compute_benchmark_for_ai(
        db=db,
        cleaning_type=payload.cleaning_type,
        house_type=payload.house_type,
        duration_type=payload.duration_type,
        city_name=payload.city_name,
        people_needed=payload.people_needed,
    )

    fallback = {
        "source": "fallback",
        "title_options": _build_quick_suggestions(payload.cleaning_type, payload.house_type, payload.duration_type).get("titles", []),
        "description_draft": " ".join(_build_quick_suggestions(payload.cleaning_type, payload.house_type, payload.duration_type).get("descriptions", [])),
        "recommended_budget": benchmark["budget"],
        "recommended_people_needed": benchmark["recommended_people_needed"],
        "recommended_num_days": benchmark["recommended_num_days"],
        "meta": benchmark["meta"],
    }

    if not GEMINI_API_KEY:
        return fallback

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = f"""
You are assisting with a house cleaning job post form.
Generate concise, realistic suggestions.

Input context:
- mode: {payload.mode or 'auto'}
- title: {payload.title or ''}
- description: {payload.description or ''}
- house_type: {payload.house_type}
- cleaning_type: {payload.cleaning_type}
- duration_type: {payload.duration_type}
- city_name: {payload.city_name or ''}
- categories: {payload.categories}

Baseline benchmark guidance:
- budget min/recommended/max: {benchmark['budget']}
- recommended people: {benchmark['recommended_people_needed']}
- recommended days: {benchmark['recommended_num_days']}

Return JSON only with keys:
{{
  "title_options": ["...", "...", "..."],
  "description_draft": "...",
  "recommended_budget": {{"min": number, "recommended": number, "max": number}},
  "recommended_people_needed": number,
  "recommended_num_days": number
}}

Rules:
- Keep titles professional, concise, and human-written.
- Do not use emojis.
- budget values should stay close to baseline benchmark.
- people needed should be between 1 and 10.
- num days: 1-13 for short_term; 14+ for long_term.
"""

        response = model.generate_content(prompt)
        raw_text = getattr(response, "text", "") or ""
        parsed = _extract_json_payload(raw_text)

        if not parsed:
            return fallback

        titles = parsed.get("title_options")
        if not isinstance(titles, list) or not titles:
            titles = fallback["title_options"]

        description_draft = parsed.get("description_draft")
        if not isinstance(description_draft, str) or not description_draft.strip():
            description_draft = fallback["description_draft"]

        budget_obj = parsed.get("recommended_budget") or {}
        min_budget = _safe_float(budget_obj.get("min"), benchmark["budget"]["min"])
        rec_budget = _safe_float(budget_obj.get("recommended"), benchmark["budget"]["recommended"])
        max_budget = _safe_float(budget_obj.get("max"), benchmark["budget"]["max"])

        people = int(_safe_float(parsed.get("recommended_people_needed"), benchmark["recommended_people_needed"]))
        people = max(1, min(10, people))

        suggested_days = int(_safe_float(parsed.get("recommended_num_days"), benchmark["recommended_num_days"]))
        if payload.duration_type == "short_term":
            suggested_days = max(1, min(13, suggested_days))
        else:
            suggested_days = max(14, suggested_days)

        return {
            "source": "ai",
            "title_options": [str(t).strip() for t in titles if str(t).strip()][:5] or fallback["title_options"],
            "description_draft": description_draft.strip(),
            "recommended_budget": {
                "min": round(min_budget, 2),
                "recommended": round(rec_budget, 2),
                "max": round(max_budget, 2),
            },
            "recommended_people_needed": people,
            "recommended_num_days": suggested_days,
            "meta": benchmark["meta"],
        }
    except Exception:
        return fallback


@router.get("/benchmark/suggestions")
def get_job_benchmark_suggestions(
    cleaning_type: str,
    house_type: str,
    duration_type: str,
    city_name: Optional[str] = None,
    people_needed: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get benchmark budget and quick suggestions for job posting using historical completed jobs."""
    _ = current_user

    is_long_term = duration_type == "long_term"
    city_query = (city_name or "").strip().lower()

    candidates = db.query(ForumPost).filter(
        ForumPost.deleted_at.is_(None),
        ForumPost.status == ForumPostStatus.COMPLETED,
        ForumPost.is_longterm == is_long_term,
        ForumPost.salary.isnot(None),
    ).order_by(desc(ForumPost.created_at)).limit(500).all()

    def matches(post: ForumPost, mode: str) -> bool:
        details = _extract_post_details(post)
        post_cleaning = (details.get("cleaning_type") or "").strip().lower()
        post_house = (details.get("house_type") or "").strip().lower()
        location_text = ((details.get("location") or post.location or "")).lower()

        if post_cleaning != cleaning_type.strip().lower():
            return False
        if mode == "strict" and post_house and post_house != house_type.strip().lower():
            return False
        if city_query and mode in {"strict", "broad"} and city_query not in location_text:
            return False
        return True

    scope = "strict"
    filtered = [post for post in candidates if matches(post, "strict")]
    if len(filtered) < 8:
        scope = "broad"
        filtered = [post for post in candidates if matches(post, "broad")]
    if len(filtered) < 5:
        scope = "global"
        filtered = [post for post in candidates if _extract_post_details(post).get("cleaning_type", "").strip().lower() == cleaning_type.strip().lower()]

    budgets: List[float] = []
    people_values: List[int] = []
    num_days_values: List[int] = []

    for post in filtered:
        details = _extract_post_details(post)
        budget = _safe_float(post.salary, 0.0)
        if budget > 0:
            budgets.append(budget)

        try:
            people = int(details.get("people_needed", 1))
            if people > 0:
                people_values.append(people)
        except (TypeError, ValueError):
            pass

        try:
            num_days = int(details.get("num_days", 1))
            if num_days > 0:
                num_days_values.append(num_days)
        except (TypeError, ValueError):
            pass

    if not budgets:
        budgets = [500.0, 800.0, 1200.0]

    p25 = round(_percentile(budgets, 0.25), 2)
    p50 = round(_percentile(budgets, 0.50), 2)
    p75 = round(_percentile(budgets, 0.75), 2)

    recommended_people = _median_int(people_values, fallback=people_needed or 1)
    recommended_days = _median_int(num_days_values, fallback=1 if duration_type == "short_term" else 14)

    sample_size = len(filtered)
    confidence = "high" if sample_size >= 20 else "medium" if sample_size >= 8 else "low"

    return {
        "budget": {
            "min": p25,
            "recommended": p50,
            "max": p75,
        },
        "recommended_people_needed": recommended_people,
        "recommended_num_days": recommended_days,
        "quick_suggestions": _build_quick_suggestions(cleaning_type, house_type, duration_type),
        "meta": {
            "sample_size": sample_size,
            "scope": scope,
            "confidence": confidence,
        },
    }


def _resolve_frontend_base_url(request: Request) -> str:
    origin = (request.headers.get("origin") or "").strip()
    if origin.startswith("http://") or origin.startswith("https://"):
        return origin.rstrip("/")

    referer = (request.headers.get("referer") or "").strip()
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    return os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")


def _calculate_post_fee(amount: float, fee_percentage: Decimal) -> Decimal:
    return (Decimal(str(amount)) * fee_percentage / Decimal("100")).quantize(Decimal("0.01"))


def _normalize_media_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return url
    first_http = url.find("http")
    if first_http == -1:
        return url
    second_http = url.find("http", first_http + 4)
    return url[second_http:] if second_http != -1 else url


def _count_active_applicants(db: Session, post_id: int) -> int:
    return db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.status.notin_([InterestStatus.REJECTED, InterestStatus.CANCELLED]),
        or_(
            InterestCheck.edit_response.is_(None),
            InterestCheck.edit_response != EditResponseStatus.REJECTED,
        ),
    ).count()


def _get_people_needed_from_post(post: ForumPost) -> int:
    """Read people_needed from JSON content with a safe fallback."""
    if not post.content or not post.content.startswith('{'):
        return 1
    try:
        details = json.loads(post.content)
    except Exception:
        return 1
    try:
        return max(1, int(details.get("people_needed", 1)))
    except (TypeError, ValueError):
        return 1


def _sync_job_activation_state(db: Session, post: ForumPost) -> bool:
    """
    Heal stale job/contract states for multi-worker jobs.

    If enough applicants are accepted to satisfy people_needed, the post should be
    ongoing and those accepted workers' contracts should be active.
    """
    has_updates = False
    people_needed = _get_people_needed_from_post(post)

    accepted_interests = db.query(InterestCheck).filter(
        InterestCheck.post_id == post.post_id,
        InterestCheck.status == InterestStatus.ACCEPTED,
    ).all()

    if len(accepted_interests) < people_needed:
        return False

    if post.status == ForumPostStatus.OPEN:
        post.status = ForumPostStatus.ONGOING
        has_updates = True

    accepted_worker_ids = [i.worker_id for i in accepted_interests]
    if not accepted_worker_ids:
        return has_updates

    contracts = db.query(Contract).filter(
        Contract.post_id == post.post_id,
        Contract.worker_id.in_(accepted_worker_ids),
    ).all()

    for contract in contracts:
        if contract.status == ContractStatus.PENDING:
            contract.status = ContractStatus.ACTIVE
            has_updates = True
        if contract.employer_accepted != 1:
            contract.employer_accepted = 1
            has_updates = True

    return has_updates


def _notify_pending_applicants_job_cancelled(db: Session, post: ForumPost) -> None:
    """Notify pending applicants that the job was cancelled by the owner."""
    pending_interests = db.query(InterestCheck).filter(
        InterestCheck.post_id == post.post_id,
        InterestCheck.status == InterestStatus.PENDING,
    ).all()

    if not pending_interests:
        return

    worker_ids = [interest.worker_id for interest in pending_interests]
    workers = db.query(Worker).filter(Worker.worker_id.in_(worker_ids)).all() if worker_ids else []

    for interest in pending_interests:
        interest.status = InterestStatus.CANCELLED

    for worker in workers:
        if not worker.user_id:
            continue
        notify_user(
            db=db,
            user_id=worker.user_id,
            notification_type=NotificationType.SYSTEM,
            title="Job Cancelled",
            message=(
                f"The job '{post.title}' you applied for was cancelled by the house owner."
                + (f" Reason: {post.recurring_cancellation_reason}" if post.recurring_cancellation_reason else "")
            ),
            reference_type="job",
            reference_id=post.post_id,
            commit=False,
        )

def get_or_create_employer(user_id: int, db: Session) -> int:
    """Get or create employer record for user"""
    employer = db.query(Employer).filter(Employer.user_id == user_id).first()
    if not employer:
        employer = Employer(user_id=user_id)
        db.add(employer)
        db.commit()
        db.refresh(employer)
    return employer.employer_id

@router.post("/", response_model=JobPostResponse, status_code=status.HTTP_201_CREATED)
def create_job_post(
    job_data: JobPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new job posting (owners only)"""
    
    # Check if user is an owner
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only house owners can create job posts"
        )
    
    # Get or create employer record
    employer_id = get_or_create_employer(current_user.id, db)
    
    # If the owner provided a new category name, create it and add to category_ids
    if job_data.new_category_name and job_data.new_category_name.strip():
        from app.models_v2.category import PackageCategory
        from sqlalchemy import text as sa_text
        new_cat_name = job_data.new_category_name.strip()
        # Check if a category with this name already exists (case-insensitive)
        existing_cat = db.query(PackageCategory).filter(
            PackageCategory.name.ilike(new_cat_name)
        ).first()
        if existing_cat:
            # Category already exists, just add its ID if not already selected
            if existing_cat.category_id not in job_data.category_ids:
                job_data.category_ids.append(existing_cat.category_id)
        else:
            # Create the new category
            new_category = PackageCategory(
                name=new_cat_name,
                description=f"Custom category added by job owner",
                is_active=True,
            )
            db.add(new_category)
            db.commit()
            db.refresh(new_category)
            job_data.category_ids.append(new_category.category_id)

            # Register as owner-private custom category so it doesn't pollute the admin list
            db.execute(sa_text("""
                CREATE TABLE IF NOT EXISTS owner_custom_categories (
                    category_id INTEGER PRIMARY KEY REFERENCES package_categories(category_id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(
                sa_text("""
                    INSERT INTO owner_custom_categories (category_id, user_id)
                    VALUES (:category_id, :user_id)
                    ON CONFLICT (category_id) DO NOTHING
                """),
                {"category_id": new_category.category_id, "user_id": current_user.id}
            )
            db.commit()
    
    # Store job details as JSON in description field
    job_details = {
        "description": job_data.description,
        "house_type": job_data.house_type,
        "cleaning_type": job_data.cleaning_type,
        "budget": job_data.budget,
        "people_needed": job_data.people_needed,
        "image_urls": job_data.image_urls,
        "duration_type": job_data.duration_type,
        "start_date": job_data.start_date.isoformat() if job_data.start_date else None,
        "end_date": job_data.end_date.isoformat() if job_data.end_date else None,
        "location": job_data.location
    }

    # Validate short-term num_days limit (max 13)
    if job_data.duration_type == "short_term" and job_data.multi_day_schedule:
        if job_data.multi_day_schedule.num_days > 13:
            raise HTTPException(status_code=400, detail="Short-term jobs can have a maximum of 13 days. For 14+ days, use long_term.")

    # Validate long-term end date is at least 14 days from start date
    if job_data.duration_type == "long_term" and job_data.start_date and job_data.end_date:
        from datetime import timedelta
        diff = (job_data.end_date - job_data.start_date).days
        if diff < 14:
            raise HTTPException(status_code=400, detail="Long-term jobs must have an end date at least 14 days after the start date.")

    # Validate long-term payment frequency (only biweekly and monthly allowed)
    if job_data.duration_type == "long_term" and job_data.payment_schedule:
        if job_data.payment_schedule.frequency not in ("biweekly", "monthly"):
            raise HTTPException(status_code=400, detail="Long-term jobs only support biweekly or monthly payment frequency.")
    
    # Multi-day schedule
    num_days = 1
    daily_start_time = None
    daily_end_time = None
    if job_data.multi_day_schedule:
        num_days = job_data.multi_day_schedule.num_days
        daily_start_time = job_data.multi_day_schedule.daily_start_time
        daily_end_time = job_data.multi_day_schedule.daily_end_time
        job_details["num_days"] = num_days
        job_details["daily_start_time"] = daily_start_time
        job_details["daily_end_time"] = daily_end_time
        # Auto-compute end_date for multi-day short-term jobs
        if job_data.start_date and num_days > 1 and not job_data.end_date:
            from datetime import timedelta
            computed_end = job_data.start_date + timedelta(days=num_days - 1)
            job_details["end_date"] = computed_end.isoformat()
    
    # Add payment schedule if provided (for long-term jobs)
    if job_data.payment_schedule:
        job_details["payment_schedule"] = {
            "frequency": job_data.payment_schedule.frequency,
            "payment_amount": job_data.payment_schedule.payment_amount,
            "payment_dates": job_data.payment_schedule.payment_dates,
            "payment_method_preference": job_data.payment_schedule.payment_method_preference
        }
    
    # Handle recurring schedule
    is_recurring = False
    day_of_week = None
    start_time = None
    end_time = None
    frequency = None
    recurring_status = None
    
    if job_data.recurring_schedule and job_data.recurring_schedule.is_recurring:
        is_recurring = True
        day_of_week = job_data.recurring_schedule.day_of_week
        start_time = job_data.recurring_schedule.start_time
        end_time = job_data.recurring_schedule.end_time
        frequency = job_data.recurring_schedule.frequency
        recurring_status = "active"
    
    # Map schema fields to model fields
    job_type = JobType.LONGTERM if job_data.duration_type == "long_term" else JobType.ONETIME
    
    post_fee_percentage = get_post_fee_percentage(db)
    post = ForumPost(
        employer_id=employer_id,
        user_id=current_user.id,
        title=job_data.title,
        content=json.dumps(job_details),
        location=job_data.location or "Not specified",
        job_type=job_type,
        salary=job_data.budget,
        post_fee_percentage=post_fee_percentage,
        post_fee_amount=_calculate_post_fee(job_data.budget, post_fee_percentage),
        post_fee_status="pending",
        category_id=job_data.category_ids[0] if job_data.category_ids else job_data.category_id,  # Keep first category for compatibility
        is_longterm=(job_data.duration_type == "long_term"),
        start_date=job_data.start_date.isoformat() if job_data.start_date else None,
        end_date=job_details.get("end_date") or (job_data.end_date.isoformat() if job_data.end_date else None),
        payment_frequency=job_data.payment_schedule.frequency if job_data.payment_schedule else None,
        payment_amount=job_data.payment_schedule.payment_amount if job_data.payment_schedule else None,
        payment_schedule=json.dumps(job_details.get("payment_schedule")) if job_data.payment_schedule else None,
        status=ForumPostStatus.OPEN,
        is_recurring=is_recurring,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        frequency=frequency,
        recurring_status=recurring_status,
        num_days=num_days,
        daily_start_time=daily_start_time,
        daily_end_time=daily_end_time,
    )
    
    db.add(post)
    db.commit()
    db.refresh(post)
    
    # Assign multiple categories
    if job_data.category_ids:
        from app.models_v2.category import PackageCategory
        categories = db.query(PackageCategory).filter(PackageCategory.category_id.in_(job_data.category_ids)).all()
        post.categories = categories
        db.commit()
    
    return JobPostResponse.from_orm_model(post, current_user, 0)

@router.get("/", response_model=List[JobPostResponse])
def get_job_posts(
    skip: int = 0,
    limit: int = 20,
    status_filter: str = "open",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all job posts (filtered by status, excluding user's own posts)"""
    
    query = db.query(ForumPost).options(
        joinedload(ForumPost.category),
        joinedload(ForumPost.categories)
    ).filter(ForumPost.deleted_at.is_(None))
    
    # Exclude current user's own posts (they can only be owners posting jobs)
    query = query.filter(ForumPost.user_id != current_user.id)

    # Only show published jobs to housekeepers (posting fee paid).
    # Legacy rows with null/empty status are treated as already published.
    query = query.filter(
        or_(
            ForumPost.post_fee_status.is_(None),
            ForumPost.post_fee_status == "",
            ForumPost.post_fee_status == "paid",
        )
    )
    
    if status_filter and status_filter != "all":
        query = query.filter(ForumPost.status == status_filter)
    
    posts = query.order_by(desc(ForumPost.created_at)).offset(skip).limit(limit).all()
    
    result = []
    has_fee_updates = False
    for post in posts:
        if _ensure_current_week_post_fee_status(db, post):
            has_fee_updates = True

        if (getattr(post, 'post_fee_status', 'paid') or 'paid').lower() != 'paid':
            continue

        # Get employer user info
        employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
        employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else current_user
        
        # Count applicants
        applicants_count = _count_active_applicants(db, post.post_id)
        
        result.append(JobPostResponse.from_orm_model(post, employer_user, applicants_count))

    if has_fee_updates:
        db.commit()
    
    return result

@router.get("/my-posts", response_model=List[JobPostResponse])
def get_my_job_posts(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's job posts (owners only)
    
    Args:
        status_filter: Filter by status (open, ongoing, completed, cancelled/closed, all). Default is all.
    """
    
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only house owners can view their job posts"
        )
    
    # Get employer record
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        return []
    
    # Build query with optional status filter
    query = db.query(ForumPost).options(
        joinedload(ForumPost.category),
        joinedload(ForumPost.categories)
    ).filter(
        ForumPost.employer_id == employer.employer_id,
        ForumPost.deleted_at.is_(None)
    )
    
    # Apply status filter if specified
    if status_filter and status_filter.lower() != 'all':
        try:
            # Frontend uses "closed"; model uses "cancelled".
            normalized_filter = 'cancelled' if status_filter.lower() == 'closed' else status_filter.lower()
            filter_status = ForumPostStatus(normalized_filter)
            # When filtering by "ongoing", also include "pending_completion" jobs
            if filter_status == ForumPostStatus.ONGOING:
                query = query.filter(
                    ForumPost.status.in_([ForumPostStatus.ONGOING, ForumPostStatus.PENDING_COMPLETION])
                )
            else:
                query = query.filter(ForumPost.status == filter_status)
        except ValueError:
            # Invalid status, ignore filter
            pass
    
    posts = query.order_by(desc(ForumPost.created_at)).all()
    
    result = []
    has_status_updates = False
    for post in posts:
        if _ensure_current_week_post_fee_status(db, post):
            has_status_updates = True

        if _sync_job_activation_state(db, post):
            has_status_updates = True

        # Auto-heal short-term jobs only after both conditions are satisfied:
        # 1) all assigned workers' work is approved (contract COMPLETED)
        # 2) all payable workers are paid
        if not post.is_longterm and post.status == ForumPostStatus.PENDING_COMPLETION:
            payable_contracts = db.query(Contract).filter(
                Contract.post_id == post.post_id,
                Contract.status.in_([
                    ContractStatus.ACTIVE,
                    ContractStatus.PENDING_COMPLETION,
                    ContractStatus.COMPLETED,
                ]),
            ).all()

            all_work_approved = bool(payable_contracts) and all(
                contract.status == ContractStatus.COMPLETED for contract in payable_contracts
            )
            all_paid = bool(payable_contracts) and all(
                contract.paid_at is not None for contract in payable_contracts
            )

            if all_work_approved and all_paid:
                post.status = ForumPostStatus.COMPLETED
                post.completed_at = datetime.now()
                has_status_updates = True

        applicants_count = _count_active_applicants(db, post.post_id)
        
        # Primary source: accepted applications
        accepted_interests = db.query(InterestCheck).filter(
            InterestCheck.post_id == post.post_id,
            InterestCheck.status == InterestStatus.ACCEPTED
        ).all()

        # Fallback for legacy/misaligned application state: active/completed contracts
        fallback_contracts = db.query(Contract).filter(
            Contract.post_id == post.post_id,
            Contract.status.in_([
                ContractStatus.ACTIVE,
                ContractStatus.PENDING_COMPLETION,
                ContractStatus.COMPLETED,
            ]),
        ).all()

        worker_contract_map = {contract.worker_id: contract for contract in fallback_contracts}
        worker_ids = {interest.worker_id for interest in accepted_interests}
        worker_ids.update(worker_contract_map.keys())
        
        # Build accepted workers list with their info
        accepted_workers_list = []
        pending_payments_count = 0
        
        for worker_id in worker_ids:
            worker = db.query(Worker).filter(Worker.worker_id == worker_id).first()
            if worker:
                worker_user = db.query(User).filter(User.id == worker.user_id).first()
                contract = worker_contract_map.get(worker_id)
                latest_schedule = None
                latest_transaction = None
                payment_status_value = None
                payment_submitted = False

                if contract:
                    latest_schedule = db.query(PaymentSchedule).filter(
                        PaymentSchedule.contract_id == contract.contract_id
                    ).order_by(desc(PaymentSchedule.created_at)).first()

                    if latest_schedule:
                        payment_status_value = (
                            latest_schedule.status.value
                            if hasattr(latest_schedule.status, 'value')
                            else str(latest_schedule.status)
                        )
                        latest_transaction = db.query(PaymentTransaction).filter(
                            PaymentTransaction.schedule_id == latest_schedule.schedule_id
                        ).first()
                        payment_submitted = payment_status_value in {
                            PaymentStatus.SENT.value,
                            PaymentStatus.CONFIRMED.value,
                            PaymentStatus.DISPUTED.value,
                        }

                if worker_user:
                    accepted_workers_list.append({
                        "worker_id": worker.worker_id,
                        "worker_user_id": worker_user.id,
                        "name": f"{worker_user.first_name} {worker_user.last_name}",
                        "contract_id": contract.contract_id if contract else None,
                        "contract_status": contract.status.value if contract and hasattr(contract.status, 'value') else (str(contract.status) if contract else None),
                        "payment_proof_url": _normalize_media_url(
                            latest_transaction.payment_proof_url
                            if latest_transaction and latest_transaction.payment_proof_url
                            else (contract.payment_proof_url if contract else None)
                        ) if contract else None,
                        "payment_status": payment_status_value,
                        "payment_submitted": payment_submitted,
                        "paid_at": contract.paid_at.isoformat() if contract and contract.paid_at else None,
                    })
                
                # Count pending payments for long-term ongoing jobs
                if contract and post.is_longterm and post.status == ForumPostStatus.ONGOING:
                    contract_pending = db.query(PaymentSchedule).filter(
                        PaymentSchedule.contract_id == contract.contract_id,
                        PaymentSchedule.status.in_([PaymentStatus.PENDING, PaymentStatus.OVERDUE])
                    ).count()
                    pending_payments_count += contract_pending
        
        result.append(JobPostResponse.from_orm_model(
            post, current_user, applicants_count, pending_payments_count, accepted_workers_list
        ))

    if has_status_updates:
        db.commit()
    
    return result


@router.get("/my-accepted-jobs", response_model=List[dict])
def get_my_accepted_jobs(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get jobs where current user is the accepted housekeeper
    
    Args:
        status_filter: Filter by job status (ongoing, completed, all). Default is all.
    
    Returns:
        List of jobs with contract and payment information
    """
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can view accepted jobs"
        )
    
    # Get worker record for current user
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        return []
    
    # Get all accepted AND pending interest checks for this worker, ordered by most recent first
    accepted_interests = db.query(InterestCheck).filter(
        InterestCheck.worker_id == worker_record.worker_id,
        InterestCheck.status.in_([InterestStatus.ACCEPTED, InterestStatus.PENDING, InterestStatus.CANCELLED])
    ).order_by(InterestCheck.created_at.desc()).all()
    
    if not accepted_interests:
        return []

    # Keep one canonical application per post for this worker.
    # Prefer ACCEPTED over PENDING to avoid stale pending rows masking active work.
    canonical_interest_by_post = {}
    for interest in accepted_interests:
        existing = canonical_interest_by_post.get(interest.post_id)
        if existing is None:
            canonical_interest_by_post[interest.post_id] = interest
            continue

        existing_status = existing.status.value if hasattr(existing.status, 'value') else str(existing.status)
        new_status = interest.status.value if hasattr(interest.status, 'value') else str(interest.status)
        if existing_status == 'pending' and new_status == 'accepted':
            canonical_interest_by_post[interest.post_id] = interest
        elif existing_status == 'cancelled' and new_status in ('accepted', 'pending'):
            canonical_interest_by_post[interest.post_id] = interest

    accepted_interests = list(canonical_interest_by_post.values())
    
    post_ids = [i.post_id for i in accepted_interests]
    
    # Batch: fetch all job posts at once
    posts = db.query(ForumPost).filter(
        ForumPost.post_id.in_(post_ids),
        ForumPost.deleted_at.is_(None)
    ).all()
    post_map = {p.post_id: p for p in posts}
    
    # Batch: fetch all contracts for this worker + these posts
    contracts = db.query(Contract).filter(
        Contract.post_id.in_(post_ids),
        Contract.worker_id == worker_record.worker_id
    ).all()
    contract_map = {c.post_id: c for c in contracts}
    
    # Batch: fetch all employer records
    employer_ids = list(set(p.employer_id for p in posts if p.employer_id))
    employers = db.query(Employer).filter(Employer.employer_id.in_(employer_ids)).all() if employer_ids else []
    employer_map = {e.employer_id: e for e in employers}
    
    # Batch: fetch all employer users
    employer_user_ids = list(set(e.user_id for e in employers if e.user_id))
    employer_users = db.query(User).filter(User.id.in_(employer_user_ids)).all() if employer_user_ids else []
    employer_user_map = {u.id: u for u in employer_users}
    
    # Batch: fetch all payment schedules for these contracts
    contract_ids = [c.contract_id for c in contracts]
    all_schedules = db.query(PaymentSchedule).filter(
        PaymentSchedule.contract_id.in_(contract_ids)
    ).order_by(PaymentSchedule.due_date).all() if contract_ids else []
    
    schedules_by_contract: dict = {}
    for s in all_schedules:
        schedules_by_contract.setdefault(s.contract_id, []).append(s)

    schedule_ids = [s.schedule_id for s in all_schedules]
    all_transactions = db.query(PaymentTransaction).filter(
        PaymentTransaction.schedule_id.in_(schedule_ids)
    ).order_by(PaymentTransaction.transaction_id.desc()).all() if schedule_ids else []

    latest_tx_by_schedule: dict = {}
    for tx in all_transactions:
        if tx.schedule_id not in latest_tx_by_schedule:
            latest_tx_by_schedule[tx.schedule_id] = tx
    
    # Batch: fetch all pending extensions for these contracts
    all_extensions = db.query(ContractExtension).filter(
        ContractExtension.contract_id.in_(contract_ids),
        ContractExtension.status == ExtensionStatus.PENDING
    ).all() if contract_ids else []
    
    ext_by_contract = {e.contract_id: e for e in all_extensions}
    
    # Batch: fetch proposers for extensions
    proposer_ids = list(set(e.proposed_by for e in all_extensions if e.proposed_by))
    proposers = db.query(User).filter(User.id.in_(proposer_ids)).all() if proposer_ids else []
    proposer_map = {u.id: u for u in proposers}
    
    # Build results
    result = []
    has_status_updates = False
    for interest in accepted_interests:
        post = post_map.get(interest.post_id)
        if not post:
            continue

        if _ensure_current_week_post_fee_status(db, post):
            has_status_updates = True

        if _sync_job_activation_state(db, post):
            has_status_updates = True
        
        contract = contract_map.get(post.post_id)
        
        # Get the application status (pending vs accepted)
        interest_status = interest.status.value if hasattr(interest.status, 'value') else str(interest.status)
        post_status_val = post.status.value if hasattr(post.status, 'value') else str(post.status)
        # Keep cancelled jobs visible to applicants, but no longer as "pending_application".
        if interest_status == 'pending' and post_status_val.lower() == 'cancelled':
            interest_status = 'cancelled'
        edit_response_status = interest.edit_response.value if interest.edit_response and hasattr(interest.edit_response, 'value') else (str(interest.edit_response) if interest.edit_response else None)
        edit_notified_at = interest.edit_notified_at.isoformat() if interest.edit_notified_at else None
        
        # Apply status filter based on CONTRACT status (worker's individual progress)
        if status_filter and status_filter.lower() != 'all':
            # Handle the 'pending_application' filter for pending interests
            if status_filter.lower() == 'pending_application':
                if interest_status != 'pending':
                    continue
            elif interest_status == 'pending':
                # Pending applications only show in 'all' or 'pending_application' filter
                continue
            elif contract:
                contract_status = contract.status.value if hasattr(contract.status, 'value') else str(contract.status)
                if contract_status.lower() != status_filter.lower():
                    if not (status_filter.lower() == 'ongoing' and contract_status.lower() == 'active'):
                        continue
            else:
                if post_status_val.lower() != status_filter.lower():
                    continue
        
        # Employer info
        employer = employer_map.get(post.employer_id)
        employer_user = employer_user_map.get(employer.user_id) if employer and employer.user_id else None
        
        # Payment schedules
        payment_schedules = []
        pending_payments = 0
        total_earned = 0
        next_payment_due = None
        
        if contract:
            for schedule in schedules_by_contract.get(contract.contract_id, []):
                status_val = schedule.status.value if hasattr(schedule.status, 'value') else str(schedule.status)
                transaction = latest_tx_by_schedule.get(schedule.schedule_id)
                payment_schedules.append({
                    "schedule_id": schedule.schedule_id,
                    "due_date": schedule.due_date,
                    "amount": float(schedule.amount),
                    "status": status_val,
                    "payment_proof_url": _normalize_media_url(
                        transaction.payment_proof_url if transaction and transaction.payment_proof_url else contract.payment_proof_url
                    ),
                    "payment_method": transaction.payment_method if transaction else None,
                    "reference_number": transaction.reference_number if transaction else None,
                })
                
                if status_val == "pending":
                    pending_payments += 1
                    if not next_payment_due:
                        next_payment_due = schedule.due_date
                elif status_val == "overdue":
                    pending_payments += 1
                    if not next_payment_due:
                        next_payment_due = schedule.due_date
                elif status_val in {"sent", "confirmed"}:
                    total_earned += float(schedule.amount)
        
        # Parse job details
        job_details = {}
        if post.content and post.content.startswith('{'):
            try:
                job_details = json.loads(post.content)
            except:
                pass

        recurring_details = job_details.get("recurring_schedule") if isinstance(job_details, dict) else None
        if not isinstance(recurring_details, dict):
            recurring_details = {}

        resolved_day_of_week = getattr(post, "day_of_week", None) or recurring_details.get("day_of_week")
        resolved_start_time = getattr(post, "start_time", None) or recurring_details.get("start_time")
        resolved_end_time = getattr(post, "end_time", None) or recurring_details.get("end_time")
        resolved_frequency = getattr(post, "frequency", None) or recurring_details.get("frequency")
        resolved_recurring_status = getattr(post, "recurring_status", None)
        resolved_is_recurring = bool(
            getattr(post, "is_recurring", False)
            or resolved_recurring_status
            or recurring_details.get("is_recurring")
            or resolved_day_of_week
            or resolved_start_time
            or resolved_end_time
            or resolved_frequency
        )
        
        post_status = post_status_val
        
        # Pending extension
        pending_extension = None
        if contract:
            ext = ext_by_contract.get(contract.contract_id)
            if ext:
                proposer = proposer_map.get(ext.proposed_by)
                pending_extension = {
                    "extension_id": ext.extension_id,
                    "proposed_end_date": ext.proposed_end_date,
                    "proposed_budget": float(ext.proposed_budget) if ext.proposed_budget else None,
                    "reason": ext.reason,
                    "proposed_by_name": f"{proposer.first_name} {proposer.last_name}" if proposer else None,
                    "created_at": ext.created_at.isoformat() if ext.created_at else None,
                }

        result.append({
            "post_id": post.post_id,
            "title": post.title,
            "description": job_details.get('description', ''),
            "location": post.location,
            "budget": float(post.salary) if post.salary else 0,
            "status": post_status,
            "post_fee_status": getattr(post, "post_fee_status", "paid"),
            "created_at": post.created_at.isoformat() if post.created_at else None,
            "application_status": interest_status,
            "cancellation_reason": post.recurring_cancellation_reason,
            "is_recurring": resolved_is_recurring,
            "day_of_week": resolved_day_of_week,
            "start_time": resolved_start_time,
            "end_time": resolved_end_time,
            "frequency": resolved_frequency,
            "recurring_status": resolved_recurring_status or ("active" if resolved_is_recurring else None),
            "recurring_cancelled_at": post.recurring_cancelled_at.isoformat() if getattr(post, "recurring_cancelled_at", None) else None,
            "recurring_cancellation_reason": getattr(post, "recurring_cancellation_reason", None),
            "cancelled_by": getattr(post, "cancelled_by", None),
            "edit_response": edit_response_status,
            "edit_notified_at": edit_notified_at,
            "start_date": post.start_date,
            "end_date": post.end_date,
            "is_longterm": post.is_longterm,
            "accepted_at": interest.created_at.isoformat() if interest.created_at else None,
            "employer": {
                "user_id": employer_user.id if employer_user else None,
                "name": f"{employer_user.first_name} {employer_user.last_name}" if employer_user else "Unknown",
                "email": employer_user.email if employer_user else None,
                "phone": employer_user.phone_number if employer_user else None
            },
            "contract": {
                "contract_id": contract.contract_id if contract else None,
                "status": contract.status.value if contract and hasattr(contract.status, 'value') else (str(contract.status) if contract else None)
            } if contract else None,
            "pending_extension": pending_extension,
            "payments": {
                "total_schedules": len(payment_schedules),
                "pending_payments": pending_payments,
                "total_earned": total_earned,
                "next_payment_due": next_payment_due,
                "schedules": payment_schedules
            },
            "multi_day_schedule": {
                "num_days": post.num_days or 1,
                "daily_start_time": post.daily_start_time,
                "daily_end_time": post.daily_end_time,
            } if post.num_days and post.num_days > 1 else None,
            "day_schedules": [
                {
                    "day_schedule_id": ds.day_schedule_id,
                    "day_number": ds.day_number,
                    "work_date": ds.work_date.isoformat() if ds.work_date else None,
                    "start_time": ds.start_time,
                    "end_time": ds.end_time,
                    "status": ds.status or "pending",
                    "owner_confirmed": any(c.role == "owner" for c in ds.completions),
                    "housekeeper_confirmed": any(c.role == "housekeeper" for c in ds.completions),
                }
                for ds in (post.day_schedules if hasattr(post, 'day_schedules') and post.day_schedules else [])
                if ds.worker_id == worker_record.worker_id
            ] if post.num_days and post.num_days > 1 else [],
        })

    if has_status_updates:
        db.commit()
    
    return result


@router.get("/{post_id}", response_model=JobPostResponse)
def get_job_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific job post"""
    
    post = db.query(ForumPost).options(
        joinedload(ForumPost.category),
        joinedload(ForumPost.categories)
    ).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Get employer user info
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else current_user
    
    applicants_count = _count_active_applicants(db, post.post_id)
    
    return JobPostResponse.from_orm_model(post, employer_user, applicants_count)

@router.put("/{post_id}", response_model=JobPostResponse)
def update_job_post(
    post_id: int,
    job_update: JobPostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a job post (owner only)"""
    from app.models_v2.category import PackageCategory
    
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own job posts"
        )
    
    # Store old values to detect ALL changes
    try:
        old_details = json.loads(post.content) if post.content else {}
    except Exception:
        old_details = {}
    old_title = post.title
    old_budget = float(post.salary) if post.salary else old_details.get('budget', 0)
    old_description = old_details.get('description', '')
    old_house_type = old_details.get('house_type', '')
    old_cleaning_type = old_details.get('cleaning_type', '')
    old_people_needed_raw = old_details.get('people_needed', 1)
    try:
        old_people_needed = int(old_people_needed_raw)
    except (TypeError, ValueError):
        old_people_needed = 1
    old_image_urls = old_details.get('image_urls', [])
    old_location = post.location or old_details.get('location', '')
    old_category_id = post.category_id
    old_duration_type = "long_term" if post.is_longterm else "short_term"
    old_start_date = post.start_date or old_details.get('start_date', '')
    old_end_date = post.end_date or old_details.get('end_date', '')
    
    # Check if there are any applicants (pending or accepted) before updating
    existing_applicants = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.status.in_([InterestStatus.PENDING, InterestStatus.ACCEPTED])
    ).all()
    
    has_applicants = len(existing_applicants) > 0
    
    # Build change list BEFORE making updates to detect all changes
    changes = []
    
    # Title change
    if job_update.title and old_title != job_update.title:
        changes.append(f"• Title: '{old_title}' → '{job_update.title}'")
    
    # Budget change
    if job_update.budget and abs(float(job_update.budget) - old_budget) > 0.01:
        changes.append(f"• Budget: ₱{old_budget:,.2f} → ₱{float(job_update.budget):,.2f}")
    
    # Description change
    if job_update.description and old_description != job_update.description:
        old_desc_preview = old_description[:100] + "..." if len(old_description) > 100 else old_description
        new_desc_preview = job_update.description[:100] + "..." if len(job_update.description) > 100 else job_update.description
        changes.append(f"• Description: '{old_desc_preview}' → '{new_desc_preview}'")
    
    # House type change
    if job_update.house_type and old_house_type != job_update.house_type:
        changes.append(f"• House Type: '{old_house_type or 'Not specified'}' → '{job_update.house_type}'")
    
    # Cleaning type change
    if job_update.cleaning_type and old_cleaning_type != job_update.cleaning_type:
        changes.append(f"• Cleaning Type: '{old_cleaning_type or 'Not specified'}' → '{job_update.cleaning_type}'")
    
    # People needed change
    if job_update.people_needed is not None and old_people_needed != int(job_update.people_needed):
        changes.append(f"• People Needed: {old_people_needed} → {job_update.people_needed}")
    
    # Images change
    if job_update.image_urls is not None and len(old_image_urls) != len(job_update.image_urls):
        changes.append(f"• Images: {len(old_image_urls)} image(s) → {len(job_update.image_urls)} image(s)")
    
    # Location change
    if job_update.location and old_location != job_update.location:
        changes.append(f"• Location: '{old_location or 'Not specified'}' → '{job_update.location}'")
    
    # Category change - compare with first new category
    if job_update.category_ids is not None and len(job_update.category_ids) > 0:
        new_category_id = job_update.category_ids[0]
        if old_category_id != new_category_id:
            old_cat = db.query(PackageCategory).filter(PackageCategory.category_id == old_category_id).first() if old_category_id else None
            new_cat = db.query(PackageCategory).filter(PackageCategory.category_id == new_category_id).first() if new_category_id else None
            old_cat_name = old_cat.name if old_cat else 'None'
            new_cat_name = new_cat.name if new_cat else 'None'
            changes.append(f"• Category: '{old_cat_name}' → '{new_cat_name}'")
    
    # Duration type change
    if job_update.duration_type:
        new_duration_type = job_update.duration_type
        if old_duration_type != new_duration_type:
            changes.append(f"• Duration Type: '{old_duration_type}' → '{new_duration_type}'")
    
    # Start date change
    if job_update.start_date:
        new_start_date = job_update.start_date.isoformat() if job_update.start_date else ''
        if old_start_date != new_start_date:
            old_start = old_start_date if old_start_date else 'Not set'
            new_start = new_start_date if new_start_date else 'Not set'
            changes.append(f"• Start Date: {old_start} → {new_start}")
    
    # End date change
    if job_update.end_date:
        new_end_date = job_update.end_date.isoformat() if job_update.end_date else ''
        if old_end_date != new_end_date:
            old_end = old_end_date if old_end_date else 'Not set'
            new_end = new_end_date if new_end_date else 'Not set'
            changes.append(f"• End Date: {old_end} → {new_end}")
    
    # Update fields
    if job_update.title:
        post.title = job_update.title
    
    if job_update.category_id is not None:
        post.category_id = job_update.category_id
    
    if job_update.status:
        post.status = ForumPostStatus(job_update.status)
    
    # If the owner provided a new category name, create it and add to category_ids
    if job_update.new_category_name and job_update.new_category_name.strip():
        from sqlalchemy import text as sa_text
        new_cat_name = job_update.new_category_name.strip()
        existing_cat = db.query(PackageCategory).filter(
            PackageCategory.name.ilike(new_cat_name)
        ).first()
        if existing_cat:
            if job_update.category_ids is None:
                job_update.category_ids = []
            if existing_cat.category_id not in job_update.category_ids:
                job_update.category_ids.append(existing_cat.category_id)
        else:
            new_category = PackageCategory(
                name=new_cat_name,
                description=f"Custom category added by job owner",
                is_active=True,
            )
            db.add(new_category)
            db.commit()
            db.refresh(new_category)
            if job_update.category_ids is None:
                job_update.category_ids = []
            job_update.category_ids.append(new_category.category_id)

            # Register as owner-private custom category
            db.execute(sa_text("""
                CREATE TABLE IF NOT EXISTS owner_custom_categories (
                    category_id INTEGER PRIMARY KEY REFERENCES package_categories(category_id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """))
            db.execute(
                sa_text("""
                    INSERT INTO owner_custom_categories (category_id, user_id)
                    VALUES (:category_id, :user_id)
                    ON CONFLICT (category_id) DO NOTHING
                """),
                {"category_id": new_category.category_id, "user_id": current_user.id}
            )
            db.commit()
    
    # Update categories if provided
    if job_update.category_ids is not None:
        categories = db.query(PackageCategory).filter(PackageCategory.category_id.in_(job_update.category_ids)).all()
        post.categories = categories
        # Update first category for backward compatibility
        if categories:
            post.category_id = categories[0].category_id
    if job_update.location:
        post.location = job_update.location
    
    # Update JSON description with new job details
    if any([
        job_update.description,
        job_update.house_type,
        job_update.cleaning_type,
        job_update.budget,
        job_update.people_needed is not None,
        job_update.image_urls is not None,
        job_update.duration_type,
        job_update.start_date,
        job_update.end_date,
    ]):
        
        try:
            current_details = json.loads(post.content) if post.content else {}
        except Exception:
            current_details = {}
        
        if job_update.description:
            current_details['description'] = job_update.description
        if job_update.house_type:
            current_details['house_type'] = job_update.house_type
        if job_update.cleaning_type:
            current_details['cleaning_type'] = job_update.cleaning_type
        if job_update.budget:
            current_details['budget'] = job_update.budget
            post.salary = job_update.budget
        if job_update.people_needed is not None:
            current_details['people_needed'] = int(job_update.people_needed)
        if job_update.image_urls is not None:
            current_details['image_urls'] = job_update.image_urls
        if job_update.duration_type:
            current_details['duration_type'] = job_update.duration_type
            post.is_longterm = (job_update.duration_type == 'long_term')
        if job_update.start_date:
            current_details['start_date'] = job_update.start_date.isoformat()
            post.start_date = job_update.start_date.isoformat()
        if job_update.end_date:
            current_details['end_date'] = job_update.end_date.isoformat()
            post.end_date = job_update.end_date.isoformat()
        if job_update.location:
            current_details['location'] = job_update.location
        
        post.content = json.dumps(current_details)
    
    # If there are applicants, notify them with detected changes
    if has_applicants:
        # Build change summary message
        if changes:
            change_summary = "The following changes were made:\n" + "\n".join(changes)
        else:
            change_summary = "Job details have been updated (no specific changes detected)"

        # First commit the core update + application edit-response flags.
        # Notification failures should never block the job update itself.
        now = datetime.now(timezone.utc)
        for application in existing_applicants:
            application.edit_response = EditResponseStatus.PENDING
            application.edit_notified_at = now
        db.commit()

        notification_created = 0
        for application in existing_applicants:
            worker = db.query(Worker).filter(Worker.worker_id == application.worker_id).first()
            if not worker:
                continue

            try:
                notify_user(
                    db=db,
                    user_id=worker.user_id,
                    notification_type=NotificationType.JOB_EDITED,
                    title="Job Post Updated ⚠️",
                    message=f"The job '{post.title}' has been updated.\n\n{change_summary}\n\nPlease review and confirm if you want to continue with your application.",
                    reference_type="job",
                    reference_id=post_id,
                    commit=True
                )
                notification_created += 1
            except Exception as e:
                # Keep request successful even if notification insert fails
                db.rollback()
                print(f"Error notifying worker {worker.worker_id}: {e}")
                import traceback
                traceback.print_exc()

        if notification_created:
            print(f"Job edit notifications sent to {notification_created} applicant(s) for job {post_id}")
    else:
        db.commit()
    
    db.refresh(post)
    
    applicants_count = _count_active_applicants(db, post.post_id)
    return JobPostResponse.from_orm_model(post, current_user, applicants_count)

@router.delete("/{post_id}")
def delete_job_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a job post (owner only)"""
    
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own job posts"
        )
    
    post.deleted_at = func.now()
    post.status = ForumPostStatus.DELETED
    db.commit()
    
    return {"message": "Job post deleted successfully"}

@router.post("/{post_id}/apply", status_code=status.HTTP_201_CREATED)
def apply_to_job(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Apply to a job post (housekeepers only)"""
    
    # Check if user is a housekeeper
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can apply to jobs"
        )

    # Resolve the worker profile for the current user
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker profile not found for this user"
        )
    
    # Check if job post exists and is open
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.status == ForumPostStatus.OPEN,
        ForumPost.deleted_at.is_(None)
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found or is no longer open"
        )

    if _ensure_current_week_post_fee_status(db, post):
        db.commit()
        db.refresh(post)

    post_fee_status = (getattr(post, 'post_fee_status', 'paid') or 'paid').lower()
    if post_fee_status != 'paid':
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="This recurring job is waiting for the owner's weekly posting fee payment."
        )
    
    # Check if already applied
    existing_application = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == worker_record.worker_id
    ).first()
    
    is_reapplying = False
    
    # If application exists and is not withdrawn, prevent duplicate application
    if existing_application:
        # Allow re-applying if the application was withdrawn (rejected edit or rejected status)
        is_withdrawn = (
            existing_application.status == InterestStatus.REJECTED or
            existing_application.edit_response == EditResponseStatus.REJECTED
        )
        
        if not is_withdrawn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already applied to this job"
            )
        else:
            # Re-apply: Reset the application to pending
            is_reapplying = True
            existing_application.status = InterestStatus.PENDING
            existing_application.edit_response = None
            existing_application.edit_notified_at = None
            existing_application.edit_responded_at = None
            # Use the existing application instead of creating a new one
            interest = existing_application

    # ========== SCHEDULE CONFLICT CHECK (before applying) ==========
    # Block the worker from applying if the job's schedule conflicts
    # with their already-accepted commitments.
    try:
        from app.services.schedule_conflict_service import detect_schedule_conflicts as _apply_dsc
        from datetime import datetime as _dt_apply, timedelta as _td_apply

        _is_recurring = post.is_recurring and getattr(post, 'recurring_status', None) == 'active'
        _recurring_day = post.day_of_week if _is_recurring else None

        _job_start = None
        _job_end = None
        if post.start_date:
            try:
                _job_start = _dt_apply.fromisoformat(post.start_date).date()
                if post.end_date:
                    _job_end = _dt_apply.fromisoformat(post.end_date).date()
            except Exception:
                pass

        _num_days = getattr(post, 'num_days', 1) or 1
        if _job_start and _num_days > 1 and (not _job_end or _job_end == _job_start):
            _job_end = _job_start + _td_apply(days=_num_days - 1)
        if not _job_end:
            _job_end = _job_start

        _daily_start = getattr(post, 'daily_start_time', None) or post.start_time
        _daily_end = getattr(post, 'daily_end_time', None) or post.end_time

        _apply_conflicts = _apply_dsc(
            db=db,
            worker_id=worker_record.worker_id,
            new_job_start_date=_job_start,
            new_job_end_date=_job_end,
            new_job_employer_id=post.employer_id,
            new_job_is_recurring=_is_recurring,
            new_job_recurring_day=_recurring_day,
            new_job_type='job_post',
            new_job_daily_start_time=_daily_start,
            new_job_daily_end_time=_daily_end,
        )

        if _apply_conflicts:
            conflict_titles = ", ".join([c['title'] for c in _apply_conflicts])
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot apply to this job. Your schedule conflicts with: {conflict_titles}"
            )
    except HTTPException:
        raise
    except Exception as e:
        # Non-fatal: allow apply if check fails unexpectedly
        print(f"Warning: Apply conflict check error: {e}")
    
    # Create interest check only if not re-applying
    if not is_reapplying:
        interest = InterestCheck(
            post_id=post_id,
            worker_id=worker_record.worker_id,
            status=InterestStatus.PENDING
        )
        db.add(interest)
    
    # Create contract record (only for new applications, not re-applications)
    if not is_reapplying:
        from app.models_v2.contract import Contract
        import json
        
        try:
            # Get job details for contract
            job_details = json.loads(post.content) if post.content else {}
            contract_terms = {
                "job_title": post.title,
                "job_type": job_details.get("job_type"),
                "location": job_details.get("location"),
                "description": job_details.get("description"),
                "start_date": job_details.get("start_date"),
                "end_date": job_details.get("end_date"),
                "budget": job_details.get("budget"),
                "payment_schedule": job_details.get("payment_schedule"),
                "employer_name": "Employer"  # Will be populated from user data later
            }
            
            contract = Contract(
                post_id=post_id,
                employer_id=post.employer_id,  # Get from the job post
                worker_id=worker_record.worker_id,
                contract_terms=json.dumps(contract_terms),  # Convert dict to JSON string
                worker_accepted=1,  # 1 = accepted (integer, not boolean)
                employer_accepted=0  # 0 = pending
            )
            
            db.add(contract)
        except Exception as e:
            print(f"Warning: Could not create contract: {e}")
            import traceback
            traceback.print_exc()
    
    db.commit()
    db.refresh(interest)
    
    # Notify employer about new application or re-application
    try:
        employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
        if employer:
            employer_user = db.query(User).filter(User.id == employer.user_id).first()
            if employer_user:
                worker_name = f"{current_user.first_name} {current_user.last_name}"
                if is_reapplying:
                    notify_user(
                        db=db,
                        user_id=employer_user.id,
                        notification_type=NotificationType.JOB_APPLICATION,
                        title="Applicant Re-applied",
                        message=f"{worker_name} has re-applied to your job: {post.title}",
                        reference_type="job",
                        reference_id=post_id
                    )
                else:
                    notify_job_application(
                        db=db,
                        employer_user_id=employer_user.id,
                        worker_name=worker_name,
                        job_title=post.title,
                        post_id=post_id
                    )
    except Exception as e:
        print(f"Warning: Could not send notification: {e}")
    
    return {
        "message": "Application submitted successfully" + (" (re-applied)" if is_reapplying else ""),
        "interest_id": interest.interest_id,
        "status": interest.status.value if hasattr(interest.status, 'value') else str(interest.status),
        "is_reapplication": is_reapplying
    }

@router.get("/{post_id}/application-status")
def get_application_status(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user has applied to this job"""
    
    if not current_user.is_housekeeper:
        return {"has_applied": False}

    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        return {"has_applied": False}
    
    application = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == worker_record.worker_id
    ).first()
    
    if not application:
        return {"has_applied": False}
    
    # Determine effective status for display
    effective_status = application.status.value if hasattr(application.status, 'value') else str(application.status)
    
    # If edit was rejected, show as withdrawn
    if application.edit_response == EditResponseStatus.REJECTED:
        effective_status = "withdrawn"
    elif application.status == InterestStatus.REJECTED:
        effective_status = "withdrawn"
    
    return {
        "has_applied": True,
        "status": effective_status,
        "original_status": application.status.value if hasattr(application.status, 'value') else str(application.status),
        "applied_at": application.created_at.isoformat(),
        "edit_response": application.edit_response.value if application.edit_response else None,
        "edit_notified_at": application.edit_notified_at.isoformat() if application.edit_notified_at else None,
        "can_reapply": (
            application.status == InterestStatus.REJECTED or
            application.edit_response == EditResponseStatus.REJECTED
        )
    }


@router.get("/application-statuses/bulk")
def get_application_statuses_bulk(
    post_ids: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get application statuses for multiple jobs in a single request.
    post_ids should be a comma-separated list of post IDs."""
    
    if not current_user.is_housekeeper:
        return {}

    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        return {}
    
    try:
        ids = [int(x.strip()) for x in post_ids.split(",") if x.strip()]
    except ValueError:
        return {}
    
    if not ids:
        return {}
    
    # Get worker's accepted applications with dates (to check for conflicts)
    from app.services.schedule_conflict_service import parse_date_string, check_dates_overlap, check_day_overlap
    
    accepted_applications = db.query(InterestCheck).filter(
        InterestCheck.worker_id == worker_record.worker_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    ).all()
    
    # Build list of accepted job dates for conflict checking
    accepted_job_dates = {}
    for accepted_app in accepted_applications:
        accepted_post = db.query(ForumPost).filter(ForumPost.post_id == accepted_app.post_id).first()
        if accepted_post:
            if accepted_post.is_recurring:
                accepted_job_dates[accepted_app.post_id] = {
                    'type': 'recurring',
                    'day': accepted_post.day_of_week
                }
            else:
                start_date = parse_date_string(accepted_post.start_date)
                end_date = parse_date_string(accepted_post.end_date)
                if start_date:
                    accepted_job_dates[accepted_app.post_id] = {
                        'type': 'single',
                        'start': start_date,
                        'end': end_date or start_date
                    }
    
    # Fetch all applications for the requested job posts
    applications = db.query(InterestCheck).filter(
        InterestCheck.post_id.in_(ids),
        InterestCheck.worker_id == worker_record.worker_id
    ).all()
    
    result = {}
    for app in applications:
        effective_status = app.status.value if hasattr(app.status, 'value') else str(app.status)
        
        if app.edit_response == EditResponseStatus.REJECTED:
            effective_status = "withdrawn"
        elif app.status == InterestStatus.REJECTED:
            effective_status = "withdrawn"
        
        # Check if this job conflicts with any accepted job
        has_conflict_with_accepted = False
        if app.status == InterestStatus.REJECTED or app.edit_response == EditResponseStatus.REJECTED:
            # Check if withdrawing was due to conflict
            if app.withdrawn_due_to_conflict:
                has_conflict_with_accepted = True
            else:
                # Also check if there's an accepted job with the same date
                job = db.query(ForumPost).filter(ForumPost.post_id == app.post_id).first()
                if job:
                    job_start = parse_date_string(job.start_date)
                    job_end = parse_date_string(job.end_date)
                    job_is_recurring = job.is_recurring and job.recurring_status == 'active'
                    
                    for accepted_post_id, accepted_info in accepted_job_dates.items():
                        if job_is_recurring and accepted_info['type'] == 'recurring':
                            if check_day_overlap(job.day_of_week, accepted_info['day']):
                                has_conflict_with_accepted = True
                                break
                        elif not job_is_recurring and accepted_info['type'] == 'single':
                            if check_dates_overlap(job_start, job_end or job_start, accepted_info['start'], accepted_info['end']):
                                has_conflict_with_accepted = True
                                break
        
        # Can only re-apply if withdrawn AND NOT due to schedule conflict (with either flag or current accepted jobs)
        can_reapply = (
            (app.status == InterestStatus.REJECTED or app.edit_response == EditResponseStatus.REJECTED)
            and not has_conflict_with_accepted
        )
        
        result[str(app.post_id)] = {
            "has_applied": True,
            "status": effective_status,
            "can_reapply": can_reapply,
            "withdrawn_due_to_conflict": app.withdrawn_due_to_conflict or has_conflict_with_accepted
        }
    
    return result


@router.get("/{post_id}/applicants")
def get_job_applicants(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all applicants for a job post (owner only)"""
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view applicants for your own job posts"
        )
    
    # Get all applicants (excluding rejected/withdrawn applications)
    applications = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id
    ).all()
    
    # Filter out rejected/withdrawn applications in Python to ensure it works correctly
    filtered_applications = []
    for app in applications:
        # Skip if status is REJECTED
        if app.status == InterestStatus.REJECTED:
            continue
        # Skip if edit_response is REJECTED (withdrawn after edit)
        if app.edit_response == EditResponseStatus.REJECTED:
            continue
        filtered_applications.append(app)
    
    applications = filtered_applications
    
    result = []
    for app in applications:
        # Get Worker record first, then User
        worker_record = db.query(Worker).filter(Worker.worker_id == app.worker_id).first()
        if worker_record:
            user = db.query(User).filter(User.id == worker_record.user_id).first()
            if user:
                # Get status value
                status_val = app.status.value if hasattr(app.status, 'value') else str(app.status)
                # Get edit response status
                edit_response_val = app.edit_response.value if app.edit_response and hasattr(app.edit_response, 'value') else (str(app.edit_response) if app.edit_response else None)
                
                result.append({
                    "interest_id": app.interest_id,
                    "worker_id": app.worker_id,
                    "worker_name": f"{user.first_name} {user.last_name}",
                    "worker_email": user.email,
                    "worker_phone": user.phone_number,
                    "status": status_val,
                    "applied_at": app.created_at.isoformat() if app.created_at else "",
                    "edit_response": edit_response_val,  # Add edit response status
                    "edit_notified_at": app.edit_notified_at.isoformat() if app.edit_notified_at else None
                })
    
    return result

@router.post("/{post_id}/respond-to-edit")
def respond_to_job_edit(
    post_id: int,
    response: str,  # "accept" or "reject"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Respond to a job edit (accept or reject the edited job)"""
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can respond to job edits"
        )
    
    if response not in ["accept", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Response must be 'accept' or 'reject'"
        )
    
    # Get worker record
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker profile not found"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Get application
    application = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == worker_record.worker_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You have not applied to this job"
        )
    
    # Check if there's a pending edit response
    if not application.edit_response or application.edit_response != EditResponseStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending job edit to respond to"
        )
    
    # Update response
    now = datetime.now(timezone.utc)
    if response == "accept":
        application.edit_response = EditResponseStatus.ACCEPTED
        application.edit_responded_at = now
        message = f"You have accepted the job changes for '{post.title}'. Your application continues."
    else:  # reject - withdraw the application
        application.edit_response = EditResponseStatus.REJECTED
        application.edit_responded_at = now
        # Withdraw the application by setting status to rejected
        application.status = InterestStatus.REJECTED
        
        # Also update any associated contract to reflect the withdrawal
        try:
            from app.models_v2.contract import Contract, ContractStatus
            contract = db.query(Contract).filter(
                Contract.post_id == post_id,
                Contract.worker_id == worker_record.worker_id
            ).first()
            
            if contract:
                # Update contract status to cancelled/rejected
                try:
                    contract.status = ContractStatus.CANCELLED
                except:
                    # If ContractStatus doesn't have CANCELLED, just mark worker_accepted as 0
                    contract.worker_accepted = 0
        except Exception as e:
            print(f"Warning: Could not update contract for withdrawn application: {e}")
        
        message = f"You have withdrawn your application for '{post.title}' after rejecting the job changes."
    
    # Commit the changes
    db.commit()
    # Refresh to ensure the changes are persisted
    db.refresh(application)
    
    # Notify employer about the response
    try:
        employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
        if employer:
            employer_user = db.query(User).filter(User.id == employer.user_id).first()
            if employer_user:
                worker_name = f"{current_user.first_name} {current_user.last_name}"
                if response == "accept":
                    notify_user(
                        db=db,
                        user_id=employer_user.id,
                        notification_type=NotificationType.SYSTEM,
                        title="Applicant Accepted Job Changes",
                        message=f"{worker_name} has accepted the changes to job '{post.title}' and will continue with their application.",
                        reference_type="job",
                        reference_id=post_id
                    )
                else:  # reject
                    notify_user(
                        db=db,
                        user_id=employer_user.id,
                        notification_type=NotificationType.SYSTEM,
                        title="Applicant Withdrew Application",
                        message=f"{worker_name} has withdrawn their application for '{post.title}' after rejecting the job changes.",
                        reference_type="job",
                        reference_id=post_id
                    )
    except Exception as e:
        print(f"Warning: Could not send notification to employer: {e}")
    
    return {
        "message": message,
        "response": response,
        "post_id": post_id
    }

@router.put("/{post_id}/applicants/{interest_id}")
def update_applicant_status(
    post_id: int,
    interest_id: int,
    status_update: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject an applicant (owner only). Accepting is done via start-job endpoint."""
    
    # Only allow rejection through this endpoint now
    if status_update not in ["rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /start-job endpoint to accept applicants"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage applicants for your own job posts"
        )
    
    # Update application status
    application = db.query(InterestCheck).filter(
        InterestCheck.interest_id == interest_id,
        InterestCheck.post_id == post_id
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )
    
    application.status = InterestStatus.REJECTED
    db.commit()
    
    # Notify worker about rejection
    try:
        worker = db.query(Worker).filter(Worker.worker_id == application.worker_id).first()
        if worker:
            notify_application_rejected(
                db=db,
                worker_user_id=worker.user_id,
                job_title=post.title,
                post_id=post_id
            )
    except Exception as e:
        print(f"Warning: Could not send rejection notification: {e}")
    
    return {
        "message": "Applicant rejected",
        "interest_id": interest_id,
        "status": "rejected"
    }


class StartJobRequest(BaseModel):
    """Request body for starting a job with selected applicants"""
    selected_applicants: List[int]  # List of interest_ids


@router.post("/{post_id}/start-job")
def start_job(
    post_id: int,
    request: StartJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a job by accepting selected applicants and transitioning to ONGOING status"""
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only manage your own job posts"
        )

    if _ensure_current_week_post_fee_status(db, post):
        db.commit()
        db.refresh(post)

    post_fee_status = (getattr(post, 'post_fee_status', 'paid') or 'paid').lower()
    if post_fee_status != 'paid':
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Please pay this week's posting fee before starting or continuing this recurring job."
        )

    _ensure_post_date_reached(post, action="start this job")
    
    try:
        job_details = {}
        if post.content and post.content.startswith('{'):
            try:
                job_details = json.loads(post.content)
            except Exception:
                job_details = {}

        people_needed = _get_people_needed_from_post(post)

        # Normalize and validate selected ids before mutating state.
        selected_interest_ids = request.selected_applicants or []
        if len(set(selected_interest_ids)) != len(selected_interest_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Duplicate applicants selected. Please select each applicant only once.",
            )

        already_accepted = db.query(InterestCheck).filter(
            InterestCheck.post_id == post_id,
            InterestCheck.status == InterestStatus.ACCEPTED,
        ).count()

        total_workers = already_accepted + len(selected_interest_ids)
        if total_workers != people_needed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Must select exactly {people_needed} workers. Currently have {already_accepted} accepted + {len(selected_interest_ids)} selected = {total_workers}",
            )

        selected_applications = db.query(InterestCheck).filter(
            InterestCheck.post_id == post_id,
            InterestCheck.interest_id.in_(selected_interest_ids),
        ).all() if selected_interest_ids else []

        selected_map = {app.interest_id: app for app in selected_applications}
        missing_ids = [interest_id for interest_id in selected_interest_ids if interest_id not in selected_map]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Some selected applicants are invalid for this job: {missing_ids}",
            )

        workers_by_id = {
            w.worker_id: w
            for w in db.query(Worker).filter(
                Worker.worker_id.in_([app.worker_id for app in selected_applications])
            ).all()
        }
        worker_user_ids = [w.user_id for w in workers_by_id.values() if w and w.user_id]
        worker_users_by_user_id = {
            u.id: u
            for u in db.query(User).filter(User.id.in_(worker_user_ids)).all()
        } if worker_user_ids else {}

        # Validate all selected applicants up-front to avoid partial acceptance.
        for interest_id in selected_interest_ids:
            application = selected_map[interest_id]
            worker = workers_by_id.get(application.worker_id)
            worker_user = worker_users_by_user_id.get(worker.user_id) if worker else None
            worker_name = f"{worker_user.first_name} {worker_user.last_name}" if worker_user else f"Worker #{application.worker_id}"

            if application.status != InterestStatus.PENDING:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot accept {worker_name}. Application is already {application.status.value}.",
                )

            if application.edit_response == EditResponseStatus.PENDING:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot accept {worker_name}. They have a pending response to the job edit. Please wait for them to respond before accepting.",
                )

        # Import conflict service
        from app.services.schedule_conflict_service import (
            detect_schedule_conflicts,
            withdraw_conflicting_applications,
            notify_withdrawal_to_housekeeper,
            notify_withdrawal_to_employers,
        )
        from app.services.notification_service import notify_application_withdrawn_due_to_conflict, notify_applicant_withdrawn_due_to_conflict

        accepted_workers = []
        accepted_worker_user_ids = set()
        for interest_id in selected_interest_ids:
            application = selected_map[interest_id]
            worker = workers_by_id.get(application.worker_id)
            worker_user = worker_users_by_user_id.get(worker.user_id) if worker else None
            worker_name = f"{worker_user.first_name} {worker_user.last_name}" if worker_user else f"Worker #{application.worker_id}"

            application.status = InterestStatus.ACCEPTED
            accepted_workers.append(worker_name)

            # ========== COMPREHENSIVE SCHEDULE CONFLICT HANDLING ==========
            # Withdraws conflicting pending job-post applications AND rejects
            # conflicting pending direct hires for this worker.
            if worker and worker_user:
                try:
                    is_recurring = post.is_recurring and post.recurring_status == 'active'
                    recurring_day = post.day_of_week if is_recurring else None

                    job_start_date = None
                    job_end_date = None
                    if post.start_date:
                        try:
                            from datetime import datetime
                            job_start_date = datetime.fromisoformat(post.start_date).date()
                            if post.end_date:
                                job_end_date = datetime.fromisoformat(post.end_date).date()
                            else:
                                job_end_date = job_start_date
                        except Exception:
                            pass

                    # Compute end date from num_days if not set
                    post_num_days = getattr(post, 'num_days', 1) or 1
                    if job_start_date and post_num_days > 1 and (not job_end_date or job_end_date == job_start_date):
                        from datetime import timedelta as _td
                        job_end_date = job_start_date + _td(days=post_num_days - 1)

                    post_daily_start = getattr(post, 'daily_start_time', None) or post.start_time
                    post_daily_end = getattr(post, 'daily_end_time', None) or post.end_time

                    withdrawn = withdraw_conflicting_applications(
                        db=db,
                        worker_id=application.worker_id,
                        newly_accepted_job_type='job_post',
                        newly_accepted_job_id=post.post_id,
                        newly_accepted_start_date=job_start_date,
                        newly_accepted_end_date=job_end_date,
                        newly_accepted_employer_id=post.employer_id,
                        newly_accepted_is_recurring=is_recurring,
                        newly_accepted_recurring_day=recurring_day,
                        newly_accepted_daily_start_time=post_daily_start,
                        newly_accepted_daily_end_time=post_daily_end,
                    )

                    if withdrawn:
                        # Notify the worker about all withdrawn items
                        notify_withdrawal_to_housekeeper(
                            db=db,
                            worker_user_id=worker_user.id,
                            newly_accepted_job_title=post.title,
                            withdrawn_applications=withdrawn
                        )
                        # Notify each affected employer
                        notify_withdrawal_to_employers(
                            db=db,
                            withdrawn_applications=withdrawn,
                            worker_name=worker_name,
                            accepted_job_title=post.title
                        )
                except Exception as e:
                    print(f"Warning: Conflict detection error: {e}")

            # Notify worker that they've been accepted
            if worker_user:
                accepted_worker_user_ids.add(worker_user.id)
                try:
                    notify_application_accepted(
                        db=db,
                        worker_user_id=worker_user.id,
                        job_title=post.title,
                        post_id=post_id
                    )
                except Exception as e:
                    print(f"Warning: Could not send acceptance notification: {e}")

            contract = db.query(Contract).filter(
                Contract.post_id == post_id,
                Contract.worker_id == application.worker_id
            ).first()

            if contract:
                contract.status = ContractStatus.ACTIVE
                contract.employer_accepted = 1

            duration_type = job_details.get('duration_type', 'short_term')
            is_actually_longterm = post.is_longterm and duration_type == 'long_term'

            if is_actually_longterm:
                try:
                    payment_schedule_data = job_details.get('payment_schedule')

                    if contract and payment_schedule_data:
                        from app.models_v2.payment import PaymentSchedule, PaymentStatus
                        from datetime import datetime, timedelta

                        start_date = datetime.strptime(job_details.get('start_date'), '%Y-%m-%d') if job_details.get('start_date') else datetime.now()
                        end_date = datetime.strptime(job_details.get('end_date'), '%Y-%m-%d') if job_details.get('end_date') else (datetime.now() + timedelta(days=365))

                        payment_amount = float(payment_schedule_data.get('payment_amount', job_details.get('budget', 0)))
                        frequency = payment_schedule_data.get('frequency', 'monthly')
                        payment_dates = payment_schedule_data.get('payment_dates', ['15', '30'])

                        payments_created = 0
                        created_dates = set()
                        is_recurring = post.is_recurring and post.recurring_status == 'active'

                        if is_recurring:
                            first_due_date = start_date
                            date_str = first_due_date.strftime('%Y-%m-%d')
                            schedule = PaymentSchedule(
                                contract_id=contract.contract_id,
                                worker_id=application.worker_id,
                                worker_name=worker_name,
                                due_date=date_str,
                                amount=payment_amount,
                                status=PaymentStatus.PENDING
                            )
                            db.add(schedule)
                            payments_created += 1
                            print(f"DEBUG: Created FIRST payment schedule for recurring service - {worker_name} (due: {date_str})")

                        elif frequency == 'monthly':
                            current_month = start_date.replace(day=1)
                            while current_month <= end_date:
                                for day_str in payment_dates:
                                    try:
                                        day = int(day_str)
                                        try:
                                            payment_date = current_month.replace(day=min(day, 28))
                                        except ValueError:
                                            payment_date = current_month.replace(day=28)

                                        date_str = payment_date.strftime('%Y-%m-%d')

                                        if start_date <= payment_date <= end_date and date_str not in created_dates:
                                            schedule = PaymentSchedule(
                                                contract_id=contract.contract_id,
                                                worker_id=application.worker_id,
                                                worker_name=worker_name,
                                                due_date=date_str,
                                                amount=payment_amount,
                                                status=PaymentStatus.PENDING
                                            )
                                            db.add(schedule)
                                            created_dates.add(date_str)
                                            payments_created += 1
                                    except ValueError:
                                        pass

                                if current_month.month == 12:
                                    current_month = current_month.replace(year=current_month.year + 1, month=1, day=1)
                                else:
                                    current_month = current_month.replace(month=current_month.month + 1, day=1)

                        elif frequency == 'weekly':
                            current_date = start_date
                            while current_date <= end_date:
                                date_str = current_date.strftime('%Y-%m-%d')
                                if date_str not in created_dates:
                                    schedule = PaymentSchedule(
                                        contract_id=contract.contract_id,
                                        worker_id=application.worker_id,
                                        worker_name=worker_name,
                                        due_date=date_str,
                                        amount=payment_amount,
                                        status=PaymentStatus.PENDING
                                    )
                                    db.add(schedule)
                                    created_dates.add(date_str)
                                    payments_created += 1
                                current_date += timedelta(days=7)

                        elif frequency == 'biweekly':
                            current_date = start_date
                            while current_date <= end_date:
                                date_str = current_date.strftime('%Y-%m-%d')
                                if date_str not in created_dates:
                                    schedule = PaymentSchedule(
                                        contract_id=contract.contract_id,
                                        worker_id=application.worker_id,
                                        worker_name=worker_name,
                                        due_date=date_str,
                                        amount=payment_amount,
                                        status=PaymentStatus.PENDING
                                    )
                                    db.add(schedule)
                                    created_dates.add(date_str)
                                    payments_created += 1
                                current_date += timedelta(days=14)

                        else:
                            date_str = end_date.strftime('%Y-%m-%d')
                            schedule = PaymentSchedule(
                                contract_id=contract.contract_id,
                                worker_id=application.worker_id,
                                worker_name=worker_name,
                                due_date=date_str,
                                amount=payment_amount,
                                status=PaymentStatus.PENDING
                            )
                            db.add(schedule)
                            payments_created += 1

                        print(f"DEBUG: Created {payments_created} payment schedules for {worker_name}")
                        if payments_created <= 0:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Unable to create long-term payment schedule. Please review payment settings and try again."
                            )
                    elif contract:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Missing payment schedule for long-term job. Please edit the job and set long-term payment schedule."
                        )
                except HTTPException:
                    raise
                except Exception as e:
                    print(f"ERROR creating payment schedule for {worker_name}: {e}")
                    import traceback
                    traceback.print_exc()
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to initialize long-term payment schedule. Please try again."
                    )

        # Keep exactly one conversation per job and include all accepted participants.
        try:
            existing_conv = db.query(Conversation).filter(
                Conversation.job_id == post_id
            ).first()

            participant_ids = {current_user.id}
            participant_ids.update(accepted_worker_user_ids)

            # Include already-accepted workers so conversation remains complete for multi-worker jobs.
            all_accepted_worker_ids = [row.worker_id for row in db.query(InterestCheck).filter(
                InterestCheck.post_id == post_id,
                InterestCheck.status == InterestStatus.ACCEPTED,
            ).all()]
            if all_accepted_worker_ids:
                accepted_workers_rows = db.query(Worker).filter(
                    Worker.worker_id.in_(all_accepted_worker_ids)
                ).all()
                participant_ids.update(
                    row.user_id for row in accepted_workers_rows if row and row.user_id
                )

            if existing_conv:
                if existing_conv.participant_ids:
                    participant_ids.update(existing_conv.participant_ids)
                existing_conv.participant_ids = sorted(participant_ids)
                existing_conv.status = 'active'
            else:
                conversation = Conversation(
                    job_id=post_id,
                    participant_ids=sorted(participant_ids),
                    status='active'
                )
                db.add(conversation)
        except Exception as e:
            print(f"Warning: Could not create/update job conversation: {e}")

        if _sync_job_activation_state(db, post):
            pass
        else:
            post.status = ForumPostStatus.ONGOING

        # Ensure already-accepted workers are not left with pending contracts.
        accepted_worker_ids = [row.worker_id for row in db.query(InterestCheck).filter(
            InterestCheck.post_id == post_id,
            InterestCheck.status == InterestStatus.ACCEPTED,
        ).all()]
        if accepted_worker_ids:
            accepted_contracts = db.query(Contract).filter(
                Contract.post_id == post_id,
                Contract.worker_id.in_(accepted_worker_ids),
            ).all()
            for contract in accepted_contracts:
                if contract.status == ContractStatus.PENDING:
                    contract.status = ContractStatus.ACTIVE
                if contract.employer_accepted != 1:
                    contract.employer_accepted = 1

        db.commit()

        return {
            "message": f"Job started with {len(accepted_worker_ids)} worker(s)!",
            "post_id": post_id,
            "status": "ongoing",
            "accepted_workers": accepted_workers
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start job: {str(e)}"
        )


@router.put("/{post_id}/status")
def update_job_status(
    post_id: int,
    new_status: str,
    cancel_reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update job status (owner only). Allowed transitions: open->cancelled, ongoing->completed"""
    
    # Validate status
    valid_statuses = ["ongoing", "completed", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be one of: {', '.join(valid_statuses)}"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update status for your own job posts"
        )
    
    # Validate status transitions
    current_status = post.status.value
    allowed_transitions = {
        "open": ["cancelled"],  # Can cancel open jobs
        "ongoing": ["completed"],  # Can complete ongoing jobs
        "pending_completion": ["completed"],  # Can complete from pending
        "completed": [],  # Cannot transition from completed
        "cancelled": []  # Cannot transition from cancelled
    }
    
    if new_status not in allowed_transitions.get(current_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{current_status}' to '{new_status}'"
        )
    
    if new_status == "cancelled":
        reason = (cancel_reason or "").strip()
        if not reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancellation reason is required"
            )
        post.recurring_cancellation_reason = reason
        post.recurring_cancelled_at = datetime.now(timezone.utc)
        post.cancelled_by = "employer"

    # Update status
    post.status = ForumPostStatus(new_status)

    if new_status == "cancelled":
        _notify_pending_applicants_job_cancelled(db, post)

    db.commit()
    
    return {
        "message": f"Job status updated to {new_status}",
        "post_id": post_id,
        "status": new_status
    }


@router.post("/{post_id}/repost", response_model=JobPostResponse, status_code=status.HTTP_201_CREATED)
def repost_job_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new job post by cloning an existing finished job (owners only).

    This lets owners quickly repost a completed/cancelled job with the same details.
    """
    # Find original post
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()

    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )

    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only repost your own job posts"
        )

    # Only allow reposting finished jobs
    finished_statuses = {ForumPostStatus.COMPLETED, ForumPostStatus.CANCELLED}
    current_status = post.status if isinstance(post.status, ForumPostStatus) else ForumPostStatus(str(post.status))
    if current_status not in finished_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed or cancelled jobs can be reposted"
        )

    # Clone the job fields; keep the same details but reset status and timestamps
    post_fee_percentage = get_post_fee_percentage(db)
    new_post = ForumPost(
        employer_id=post.employer_id,
        user_id=current_user.id,
        title=post.title,
        content=post.content,
        location=post.location,
        job_type=post.job_type,
        salary=post.salary,
        post_fee_percentage=post_fee_percentage,
        post_fee_amount=_calculate_post_fee(float(post.salary or 0), post_fee_percentage),
        post_fee_status="pending",
        category_id=post.category_id,
        is_longterm=post.is_longterm,
        start_date=post.start_date,
        end_date=post.end_date,
        payment_frequency=getattr(post, "payment_frequency", None),
        payment_amount=getattr(post, "payment_amount", None),
        payment_schedule=getattr(post, "payment_schedule", None),
        status=ForumPostStatus.OPEN,
        is_recurring=getattr(post, "is_recurring", False),
        day_of_week=getattr(post, "day_of_week", None),
        start_time=getattr(post, "start_time", None),
        end_time=getattr(post, "end_time", None),
        frequency=getattr(post, "frequency", None),
        recurring_status=getattr(post, "recurring_status", None)
    )

    db.add(new_post)
    db.flush()  # Get post_id before assigning relationships

    # Copy category relationships if present (multi-category)
    if hasattr(post, "categories") and post.categories:
        new_post.categories = post.categories[:]  # shallow copy list

    db.commit()
    db.refresh(new_post)

    # Build response using employer user info
    employer_user = db.query(User).filter(User.id == employer.user_id).first() or current_user

    return JobPostResponse.from_orm_model(new_post, employer_user, applicants_count=0, pending_payments_count=0, accepted_workers_list=[])


class JobPostFeeInitiateResponse(BaseModel):
    post_id: int
    checkout_id: str
    redirect_url: str
    post_fee_amount: float


class JobPostFeeVerifyRequest(BaseModel):
    checkout_id: str


@router.post("/{post_id}/post-fee/initiate-payment", response_model=JobPostFeeInitiateResponse)
async def initiate_post_fee_payment(
    post_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only house owners can pay posting fee")

    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found")

    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only pay fee for your own posts")

    if not maya_is_configured():
        raise HTTPException(status_code=500, detail="Maya sandbox is not configured on backend")

    current_fee_status = (getattr(post, 'post_fee_status', 'pending') or 'pending').lower()
    if current_fee_status == 'paid':
        raise HTTPException(status_code=400, detail="Posting fee already paid")

    fee_amount = Decimal(str(getattr(post, 'post_fee_amount', 0) or 0))
    if fee_amount <= 0:
        post_fee_percentage = get_post_fee_percentage(db)
        fee_amount = _calculate_post_fee(float(post.salary or 0), post_fee_percentage)
        post.post_fee_amount = fee_amount
        post.post_fee_percentage = post_fee_percentage
        db.commit()
        db.refresh(post)

    frontend_base_url = _resolve_frontend_base_url(request)
    success_url = f"{frontend_base_url}/jobs?maya_post_result=success&post_id={post.post_id}"
    failure_url = f"{frontend_base_url}/jobs?maya_post_result=failure&post_id={post.post_id}"
    cancel_url = f"{frontend_base_url}/jobs?maya_post_result=cancel&post_id={post.post_id}"

    reference_number = f"JPF-{post.post_id}-{int(datetime.utcnow().timestamp())}"

    try:
        checkout = await create_checkout(
            amount=fee_amount,
            reference_number=reference_number,
            success_url=success_url,
            failure_url=failure_url,
            cancel_url=cancel_url,
            buyer_first_name=current_user.first_name,
            buyer_last_name=current_user.last_name,
            buyer_email=current_user.email,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to create Maya checkout: {exc}") from exc

    checkout_id = checkout.get("checkoutId") or checkout.get("id")
    redirect_url = checkout.get("redirectUrl")
    if not checkout_id or not redirect_url:
        raise HTTPException(status_code=502, detail="Invalid Maya checkout response")

    post.post_fee_checkout_id = str(checkout_id)
    post.post_fee_reference = reference_number
    post.post_fee_status = "pending"
    db.commit()

    return JobPostFeeInitiateResponse(
        post_id=post.post_id,
        checkout_id=str(checkout_id),
        redirect_url=str(redirect_url),
        post_fee_amount=float(fee_amount),
    )


@router.post("/{post_id}/post-fee/verify")
async def verify_post_fee_payment(
    post_id: int,
    payload: JobPostFeeVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found")

    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only verify fee for your own posts")

    try:
        checkout = await retrieve_checkout(payload.checkout_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to verify Maya checkout: {exc}") from exc

    payment_status = normalize_checkout_status(checkout)

    post.post_fee_checkout_id = payload.checkout_id
    post.post_fee_reference = checkout.get("requestReferenceNumber") or post.post_fee_reference

    if payment_status == "paid":
        post.post_fee_status = "paid"
        post.post_fee_paid_at = func.now()
        db.commit()
        return {
            "message": "Posting fee paid. Job is now published.",
            "status": "paid"
        }

    if payment_status in {"failed", "cancelled"}:
        post.post_fee_status = payment_status
        db.commit()
        return {
            "message": "Posting fee payment was not completed.",
            "status": payment_status
        }

    post.post_fee_status = "pending"
    db.commit()
    return {
        "message": "Posting fee payment is still pending.",
        "status": "pending"
    }


# ============== HOUSEKEEPER JOB COMPLETION ENDPOINTS ==============

class JobCompletionRequest(BaseModel):
    """Request body for job completion"""
    proof_url: Optional[str] = None  # URL to proof image/video
    notes: Optional[str] = None  # Notes from housekeeper


@router.post("/{post_id}/submit-completion")
def submit_job_completion(
    post_id: int,
    completion_data: JobCompletionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Housekeeper submits proof of job completion
    
    This marks the worker's CONTRACT as pending_completion (not the whole job).
    Job moves to pending_completion when at least one worker has submitted.
    """
    from app.models_v2.contract import ContractStatus
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can submit job completion"
        )
    
    # Get worker record
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker profile not found"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check if job is ongoing or pending_completion (others may have submitted)
    if post.status not in [ForumPostStatus.ONGOING, ForumPostStatus.PENDING_COMPLETION]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only complete jobs that are ongoing. Current status: {post.status.value}"
        )

    _ensure_post_date_reached(post, action="submit completion")
    
    # For long-term jobs, completion is handled automatically when all payments are confirmed
    # Housekeepers should NOT manually submit completion proofs
    if post.is_longterm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Long-term jobs are completed automatically when all scheduled payments are confirmed. You don't need to submit a completion proof."
        )

    if _ensure_current_week_post_fee_status(db, post):
        db.commit()
        db.refresh(post)

    post_fee_status = (getattr(post, 'post_fee_status', 'paid') or 'paid').lower()
    if post_fee_status != 'paid':
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Cannot submit completion proof yet. The owner must pay this week's recurring posting fee first."
        )
    
    # Get this worker's contract for this job
    contract = db.query(Contract).filter(
        Contract.post_id == post_id,
        Contract.worker_id == worker_record.worker_id
    ).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this job"
        )
    
    # Check if already submitted
    if contract.status == ContractStatus.PENDING_COMPLETION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted completion for this job"
        )
    
    if contract.status == ContractStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your work on this job has already been completed"
        )
    
    # Update this worker's contract with completion details
    contract.status = ContractStatus.PENDING_COMPLETION
    contract.completion_proof_url = completion_data.proof_url
    contract.completion_notes = completion_data.notes
    contract.completed_at = func.now()
    
    # Update job status to pending_completion if not already
    if post.status == ForumPostStatus.ONGOING:
        post.status = ForumPostStatus.PENDING_COMPLETION
    
    db.commit()
    
    # Send notification to owner about job completion submission
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if employer:
        worker_name = f"{current_user.first_name} {current_user.last_name}"
        notify_completion_submitted(
            db=db,
            employer_user_id=employer.user_id,
            worker_name=worker_name,
            job_title=post.title,
            post_id=post_id
        )
    
    return {
        "message": "Job completion submitted successfully. Waiting for owner approval.",
        "post_id": post_id,
        "contract_id": contract.contract_id,
        "status": "pending_completion"
    }


@router.post("/{post_id}/approve-completion")
def approve_job_completion(
    post_id: int,
    contract_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Owner approves job completion for a specific worker or all workers
    
    If contract_id is provided, approves only that worker.
    If not provided (legacy), approves all pending workers.
    Job completes when ALL workers are approved.
    """
    from app.models_v2.contract import ContractStatus
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only approve completion for your own job posts"
        )
    
    # Check if job is pending completion
    if post.status != ForumPostStatus.PENDING_COMPLETION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is not pending completion. Current status: {post.status.value}"
        )

    _ensure_post_date_reached(post, action="approve completion")
    
    if contract_id:
        # Approve specific worker
        contract = db.query(Contract).filter(
            Contract.contract_id == contract_id,
            Contract.post_id == post_id
        ).first()
        
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        
        if contract.status != ContractStatus.PENDING_COMPLETION:
            raise HTTPException(
                status_code=400,
                detail="This worker has not submitted completion proof yet"
            )
        
        # Mark this contract as completed (but not paid yet for short-term)
        contract.status = ContractStatus.COMPLETED
        db.commit()
        
        # Send notification to worker that their completion was approved
        worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
        if worker:
            notify_completion_approved(
                db=db,
                worker_user_id=worker.user_id,
                job_title=post.title,
                post_id=post_id
            )
        
        # Check if ALL contracts are now completed
        all_contracts = db.query(Contract).filter(Contract.post_id == post_id).all()
        all_completed = all(c.status == ContractStatus.COMPLETED for c in all_contracts)
        
        # For long-term jobs, complete immediately when all workers are approved.
        # For short-term jobs, complete only when all approved workers are also paid.
        if all_completed and post.is_longterm:
            post.status = ForumPostStatus.COMPLETED
            post.completed_at = func.now()
            db.commit()
        elif all_completed and not post.is_longterm:
            payable_contracts = db.query(Contract).filter(
                Contract.post_id == post_id,
                Contract.status.in_([
                    ContractStatus.ACTIVE,
                    ContractStatus.PENDING_COMPLETION,
                    ContractStatus.COMPLETED,
                ]),
            ).all()
            all_paid = bool(payable_contracts) and all(c.paid_at is not None for c in payable_contracts)

            if all_paid:
                post.status = ForumPostStatus.COMPLETED
                post.completed_at = func.now()
                db.commit()
        
        return {
            "message": "Worker completion approved!",
            "contract_id": contract_id,
            "all_completed": all_completed,
            "status": "completed" if (all_completed and post.is_longterm) else "pending_completion"
        }
    else:
        # Legacy: approve all pending contracts
        contracts = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.status == ContractStatus.PENDING_COMPLETION
        ).all()
        
        for contract in contracts:
            contract.status = ContractStatus.COMPLETED
            # Send notification to each worker
            worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
            if worker:
                notify_completion_approved(
                    db=db,
                    worker_user_id=worker.user_id,
                    job_title=post.title,
                    post_id=post_id
                )
        
        # Check if ALL contracts are now completed
        all_contracts = db.query(Contract).filter(Contract.post_id == post_id).all()
        all_completed = all(c.status == ContractStatus.COMPLETED for c in all_contracts)
        
        # For long-term jobs, complete immediately when all workers are approved.
        # For short-term jobs, complete only when all approved workers are also paid.
        if all_completed and post.is_longterm:
            post.status = ForumPostStatus.COMPLETED
            post.completed_at = func.now()
        elif all_completed and not post.is_longterm:
            payable_contracts = db.query(Contract).filter(
                Contract.post_id == post_id,
                Contract.status.in_([
                    ContractStatus.ACTIVE,
                    ContractStatus.PENDING_COMPLETION,
                    ContractStatus.COMPLETED,
                ]),
            ).all()
            all_paid = bool(payable_contracts) and all(c.paid_at is not None for c in payable_contracts)

            if all_paid:
                post.status = ForumPostStatus.COMPLETED
                post.completed_at = func.now()
        
        db.commit()
        
        return {
            "message": "Job completion approved!",
            "post_id": post_id,
            "status": "completed" if (all_completed and post.is_longterm) else "pending_completion"
        }


@router.get("/{post_id}/completion-details")
def get_completion_details(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get job completion details (for owner to review proof from all workers)"""
    from app.models_v2.contract import ContractStatus
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Check ownership (owner can view) or worker assignment
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    is_owner = employer and employer.user_id == current_user.id
    
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    is_worker = False
    if worker_record:
        contract = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.worker_id == worker_record.worker_id
        ).first()
        is_worker = contract is not None
    
    if not is_owner and not is_worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this job's completion details"
        )
    
    # Get all contracts and their completion status
    contracts = db.query(Contract).filter(Contract.post_id == post_id).all()
    
    workers_completion = []
    for contract in contracts:
        worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
        worker_user = db.query(User).filter(User.id == worker.user_id).first() if worker else None
        
        workers_completion.append({
            "contract_id": contract.contract_id,
            "worker_id": contract.worker_id,
            "worker_user_id": worker_user.id if worker_user else None,
            "worker_name": f"{worker_user.first_name} {worker_user.last_name}" if worker_user else "Unknown",
            "status": contract.status.value if hasattr(contract.status, 'value') else str(contract.status),
            "completion_proof_url": _normalize_media_url(contract.completion_proof_url),
            "completion_notes": contract.completion_notes,
            "completed_at": contract.completed_at.isoformat() if contract.completed_at else None,
            "payment_proof_url": _normalize_media_url(contract.payment_proof_url),
            "paid_at": contract.paid_at.isoformat() if contract.paid_at else None
        })
    
    # Parse budget from content
    import json
    custom_fields = {}
    if post.content and post.content.startswith('{'):
        try:
            custom_fields = json.loads(post.content)
        except:
            pass
    
    budget = float(post.salary) if post.salary else custom_fields.get('budget', 0)
    
    return {
        "post_id": post.post_id,
        "title": post.title,
        "status": post.status.value,
        "duration_type": "long_term" if post.is_longterm else "short_term",
        "budget": budget,
        "workers": workers_completion,
        # Legacy fields for backward compatibility
        "completion_proof_url": post.completion_proof_url,
        "completion_notes": post.completion_notes,
        "completed_at": post.completed_at.isoformat() if post.completed_at else None
    }


@router.get("/{post_id}/summary")
def get_job_summary(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get full job summary for a completed job (owner only): details, images, workers, completion proofs, total paid."""
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found")

    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the job owner can view the summary")

    allow_pending_short_term_receipt = False
    if not post.is_longterm and post.status == ForumPostStatus.PENDING_COMPLETION:
        payable_contracts = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.status.in_([
                ContractStatus.ACTIVE,
                ContractStatus.PENDING_COMPLETION,
                ContractStatus.COMPLETED,
            ]),
        ).all()

        for contract in payable_contracts:
            submitted_schedule = db.query(PaymentSchedule).filter(
                PaymentSchedule.contract_id == contract.contract_id,
                PaymentSchedule.status.in_([PaymentStatus.SENT, PaymentStatus.CONFIRMED]),
            ).first()
            if submitted_schedule:
                allow_pending_short_term_receipt = True
                break

    if post.status != ForumPostStatus.COMPLETED and not allow_pending_short_term_receipt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Summary is only available after payment submission for this job"
        )

    job_details = {}
    if post.content and post.content.startswith("{"):
        try:
            job_details = json.loads(post.content)
        except Exception:
            pass

    budget = float(post.salary) if post.salary else job_details.get("budget", 0)
    contracts = db.query(Contract).filter(Contract.post_id == post_id).all()

    workers_summary = []
    total_amount_paid = 0
    payments_list = []

    for contract in contracts:
        worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
        worker_user = db.query(User).filter(User.id == worker.user_id).first() if worker else None
        worker_name = f"{worker_user.first_name} {worker_user.last_name}" if worker_user else "Unknown"

        schedules = db.query(PaymentSchedule).filter(
            PaymentSchedule.contract_id == contract.contract_id
        ).order_by(PaymentSchedule.due_date).all()

        worker_total = 0
        for s in schedules:
            status_val = s.status.value if hasattr(s.status, "value") else str(s.status)
            amount_float = float(s.amount)
            payments_list.append({
                "worker_name": worker_name,
                "due_date": s.due_date,
                "amount": amount_float,
                "status": status_val,
                "schedule_id": s.schedule_id,
            })
            if status_val in {"sent", "confirmed"}:
                worker_total += amount_float
                total_amount_paid += amount_float

        workers_summary.append({
            "contract_id": contract.contract_id,
            "worker_id": contract.worker_id,
            "worker_name": worker_name,
            "completion_proof_url": _normalize_media_url(contract.completion_proof_url),
            "completion_notes": contract.completion_notes,
            "completed_at": contract.completed_at.isoformat() if contract.completed_at else None,
            "payment_proof_url": _normalize_media_url(contract.payment_proof_url),
            "paid_at": contract.paid_at.isoformat() if contract.paid_at else None,
            "total_paid_for_worker": worker_total,
        })

    return {
        "post_id": post.post_id,
        "title": post.title,
        "description": job_details.get("description", ""),
        "house_type": job_details.get("house_type", "house"),
        "cleaning_type": job_details.get("cleaning_type", "general"),
        "budget": budget,
        "people_needed": job_details.get("people_needed", 1),
        "image_urls": job_details.get("image_urls", []),
        "location": post.location or job_details.get("location", ""),
        "duration_type": "long_term" if post.is_longterm else "short_term",
        "start_date": post.start_date or job_details.get("start_date"),
        "end_date": post.end_date or job_details.get("end_date"),
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "completed_at": post.completed_at.isoformat() if post.completed_at else None,
        "payment_schedule": job_details.get("payment_schedule"),
        "workers": workers_summary,
        "payments": payments_list,
        "total_amount_paid": total_amount_paid,
    }


@router.get("/{post_id}/housekeeper-summary")
def get_housekeeper_summary(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get job summary for a housekeeper (worker) for a completed job: job details, images, completion proof, payment proof, total paid."""
    post = db.query(ForumPost).filter(
        ForumPost.post_id == post_id,
        ForumPost.deleted_at.is_(None)
    ).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found")

    # Find the contract for this user (housekeeper)
    contract = db.query(Contract).filter(
        Contract.post_id == post_id,
        Contract.worker_id == db.query(Worker).filter(Worker.user_id == current_user.id).with_entities(Worker.worker_id).scalar()
    ).first()
    
    if not contract:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You did not work on this job")

    allow_pending_short_term_receipt = False
    if not post.is_longterm and post.status == ForumPostStatus.PENDING_COMPLETION:
        submitted_schedule = db.query(PaymentSchedule).filter(
            PaymentSchedule.contract_id == contract.contract_id,
            PaymentSchedule.status.in_([PaymentStatus.SENT, PaymentStatus.CONFIRMED]),
        ).first()
        allow_pending_short_term_receipt = submitted_schedule is not None

    if post.status != ForumPostStatus.COMPLETED and not allow_pending_short_term_receipt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Summary is only available after payment submission for this job"
        )

    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else None
    employer_name = f"{employer_user.first_name} {employer_user.last_name}" if employer_user else "Unknown"

    job_details = {}
    if post.content and post.content.startswith("{"):
        try:
            job_details = json.loads(post.content)
        except Exception:
            pass

    budget = float(post.salary) if post.salary else job_details.get("budget", 0)

    # Get payment schedules for this worker
    schedules = db.query(PaymentSchedule).filter(
        PaymentSchedule.contract_id == contract.contract_id
    ).order_by(PaymentSchedule.due_date).all()

    total_paid = 0
    payment_schedule = []
    for s in schedules:
        status_val = s.status.value if hasattr(s.status, "value") else str(s.status)
        amount_float = float(s.amount)
        payment_schedule.append({
            "schedule_id": s.schedule_id,
            "due_date": s.due_date,
            "amount": amount_float,
            "status": status_val,
        })
        if status_val in {"sent", "confirmed"}:
            total_paid += amount_float

    latest_payment_tx = db.query(PaymentTransaction).join(
        PaymentSchedule,
        PaymentTransaction.schedule_id == PaymentSchedule.schedule_id,
    ).filter(
        PaymentSchedule.contract_id == contract.contract_id,
        PaymentTransaction.payment_proof_url.isnot(None),
    ).order_by(
        desc(PaymentTransaction.paid_at),
        desc(PaymentTransaction.transaction_id),
    ).first()

    payment_proof_url = (
        latest_payment_tx.payment_proof_url
        if latest_payment_tx and latest_payment_tx.payment_proof_url
        else contract.payment_proof_url
    )
    paid_at_value = (
        latest_payment_tx.paid_at
        if latest_payment_tx and latest_payment_tx.paid_at
        else contract.paid_at
    )

    return {
        "post_id": post.post_id,
        "title": post.title,
        "description": job_details.get("description", ""),
        "house_type": job_details.get("house_type", "house"),
        "cleaning_type": job_details.get("cleaning_type", "general"),
        "budget": budget,
        "people_needed": job_details.get("people_needed", 1),
        "image_urls": job_details.get("image_urls", []),
        "location": post.location or job_details.get("location", ""),
        "duration_type": "long_term" if post.is_longterm else "short_term",
        "start_date": post.start_date or job_details.get("start_date"),
        "end_date": post.end_date or job_details.get("end_date"),
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "completed_at": post.completed_at.isoformat() if post.completed_at else None,
        "employer_name": employer_name,
        "employer_email": employer_user.email if employer_user else None,
        "employer_phone": employer_user.phone_number if employer_user else None,
        "completion_proof_url": _normalize_media_url(contract.completion_proof_url),
        "completion_notes": contract.completion_notes,
        "completed_at_contract": contract.completed_at.isoformat() if contract.completed_at else None,
        "payment_proof_url": _normalize_media_url(payment_proof_url),
        "paid_at": paid_at_value.isoformat() if paid_at_value else None,
        "total_paid": total_paid,
        "payment_schedule": payment_schedule,
    }


class ShortTermPaymentRequest(BaseModel):
    """Request body for short-term job payment"""
    amount: float
    proof_url: Optional[str] = None
    contract_id: Optional[int] = None  # For paying specific worker
    payment_method: Optional[str] = "cash"  # gcash, maya, bank_transfer, cash
    reference_number: Optional[str] = None


class ShortTermDigitalPaymentInitiateRequest(BaseModel):
    contract_id: int
    payment_method: str = "maya"


class ShortTermDigitalPaymentVerifyRequest(BaseModel):
    contract_id: int
    checkout_id: str


def _record_short_term_payment_submission(
    *,
    post: ForumPost,
    contract: Contract,
    amount: float,
    payment_method: str,
    proof_url: Optional[str],
    reference_number: Optional[str],
    db: Session,
):
    from app.models_v2.contract import ContractStatus

    contract.payment_proof_url = proof_url
    if contract.status == ContractStatus.PENDING_COMPLETION:
        contract.status = ContractStatus.COMPLETED

    worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
    worker_user = db.query(User).filter(User.id == worker.user_id).first() if worker else None
    worker_name = f"{worker_user.first_name} {worker_user.last_name}" if worker_user else "Worker"

    payment = PaymentSchedule(
        contract_id=contract.contract_id,
        due_date=func.now(),
        amount=amount,
        status=PaymentStatus.SENT,
        worker_id=contract.worker_id,
        worker_name=worker_name,
    )

    db.add(payment)
    db.flush()

    transaction = PaymentTransaction(
        schedule_id=payment.schedule_id,
        amount_paid=amount,
        payment_method=payment_method,
        reference_number=reference_number,
        payment_proof_url=proof_url,
        paid_at=func.now(),
        confirmed_at=None,
        confirmed_by_worker=False,
    )
    db.add(transaction)

    payable_contracts = db.query(Contract).filter(
        Contract.post_id == post.post_id,
        Contract.status.in_([
            ContractStatus.ACTIVE,
            ContractStatus.PENDING_COMPLETION,
            ContractStatus.COMPLETED,
        ]),
    ).all()
    all_paid = bool(payable_contracts) and all(c.paid_at is not None for c in payable_contracts)

    if all_paid:
        post.status = ForumPostStatus.COMPLETED
        post.completed_at = func.now()

    db.commit()

    if worker and worker_user:
        notify_user(
            db=db,
            user_id=worker_user.id,
            notification_type=NotificationType.PAYMENT_REVIEW,
            title="Payment Submitted - Review Required 💰",
            message=f"Payment of ₱{amount:,.2f} for '{post.title}' has been submitted. Please review and confirm.",
            reference_type="job",
            reference_id=post.post_id,
        )

    return {
        "worker_name": worker_name,
        "all_paid": all_paid,
    }


@router.post("/{post_id}/short-term-payment/initiate-payment")
async def initiate_short_term_digital_payment(
    post_id: int,
    request: Request,
    payload: ShortTermDigitalPaymentInitiateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.payment_method.lower() != "maya":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only maya is supported for digital short-term payout."
        )

    post = db.query(ForumPost).filter(ForumPost.post_id == post_id, ForumPost.deleted_at.is_(None)).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found")

    _ensure_post_date_reached(post, action="continue this job")

    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only pay for your own jobs"
        )

    contract = db.query(Contract).filter(
        Contract.contract_id == payload.contract_id,
        Contract.post_id == post_id,
    ).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    if contract.paid_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This worker has already confirmed payment."
        )

    try:
        amount = Decimal(str(post.salary or 0)).quantize(Decimal("0.01"))
    except Exception:
        amount = Decimal("0.00")

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payout amount. Please set a valid job budget first."
        )

    if not maya_is_configured():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Maya is not configured. Please set MAYA_PUBLIC_KEY and MAYA_SECRET_KEY."
        )

    frontend_base_url = _resolve_frontend_base_url(request)
    success_url = f"{frontend_base_url}/jobs?maya_short_payment_result=success&post_id={post_id}&contract_id={contract.contract_id}"
    failure_url = f"{frontend_base_url}/jobs?maya_short_payment_result=failure&post_id={post_id}&contract_id={contract.contract_id}"
    cancel_url = f"{frontend_base_url}/jobs?maya_short_payment_result=cancel&post_id={post_id}&contract_id={contract.contract_id}"

    reference_number = f"SHORT-PAY-{post_id}-{contract.contract_id}-{int(datetime.now(timezone.utc).timestamp())}"

    try:
        checkout = await create_checkout(
            amount=amount,
            reference_number=reference_number,
            success_url=success_url,
            failure_url=failure_url,
            cancel_url=cancel_url,
            buyer_first_name=current_user.first_name,
            buyer_last_name=current_user.last_name,
            buyer_email=current_user.email,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    checkout_id = checkout.get("checkoutId")
    redirect_url = checkout.get("redirectUrl")
    if not checkout_id or not redirect_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Maya checkout did not return checkoutId/redirectUrl."
        )

    return {
        "checkout_id": checkout_id,
        "redirect_url": redirect_url,
        "reference_number": reference_number,
        "amount": float(amount),
    }


@router.post("/{post_id}/short-term-payment/verify")
async def verify_short_term_digital_payment(
    post_id: int,
    payload: ShortTermDigitalPaymentVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id, ForumPost.deleted_at.is_(None)).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job post not found")

    _ensure_post_date_reached(post, action="continue this job")

    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only verify payments for your own jobs"
        )

    contract = db.query(Contract).filter(
        Contract.contract_id == payload.contract_id,
        Contract.post_id == post_id,
    ).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    existing_tx = (
        db.query(PaymentTransaction)
        .join(PaymentSchedule, PaymentSchedule.schedule_id == PaymentTransaction.schedule_id)
        .filter(
            PaymentSchedule.contract_id == contract.contract_id,
            PaymentTransaction.reference_number == payload.checkout_id,
        )
        .first()
    )
    if existing_tx:
        return {
            "message": "Payment already submitted and awaiting worker confirmation.",
            "post_id": post_id,
            "contract_id": contract.contract_id,
            "status": "payment_pending",
            "already_processed": True,
        }

    try:
        checkout = await retrieve_checkout(payload.checkout_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    status_normalized = normalize_checkout_status(checkout)
    if status_normalized != "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Checkout is not paid yet (status: {status_normalized})."
        )

    try:
        amount = Decimal(str(post.salary or 0)).quantize(Decimal("0.01"))
    except Exception:
        amount = Decimal("0.00")

    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payout amount. Please set a valid job budget first."
        )

    result = _record_short_term_payment_submission(
        post=post,
        contract=contract,
        amount=float(amount),
        payment_method="maya",
        proof_url=None,
        reference_number=payload.checkout_id,
        db=db,
    )

    return {
        "message": f"Payment to {result['worker_name']} submitted successfully. Waiting for worker confirmation.",
        "post_id": post_id,
        "contract_id": contract.contract_id,
        "amount": float(amount),
        "status": "payment_pending",
        "all_paid": result["all_paid"],
    }


@router.post("/{post_id}/record-short-term-payment")
def record_short_term_payment(
    post_id: int,
    payment_data: ShortTermPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record payment for a short-term job (owner only)
    
    If contract_id is provided, records payment for that specific worker.
    Otherwise records for first contract (legacy behavior).
    """
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )

    _ensure_post_date_reached(post, action="continue this job")
    
    # Check ownership
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only record payments for your own jobs"
        )
    
    # Get contract for this job
    if payment_data.contract_id:
        contract = db.query(Contract).filter(
            Contract.contract_id == payment_data.contract_id,
            Contract.post_id == post_id
        ).first()
    else:
        contract = db.query(Contract).filter(Contract.post_id == post_id).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No contract found for this job"
        )
    result = _record_short_term_payment_submission(
        post=post,
        contract=contract,
        amount=payment_data.amount,
        payment_method=payment_data.payment_method or "cash",
        proof_url=payment_data.proof_url,
        reference_number=payment_data.reference_number,
        db=db,
    )
    
    return {
        "message": f"Payment to {result['worker_name']} submitted successfully. Waiting for worker confirmation.",
        "post_id": post_id,
        "contract_id": contract.contract_id,
        "amount": payment_data.amount,
        "status": "payment_pending",
        "all_paid": result["all_paid"],
        "job_completed": False  # Not completed until worker confirms
    }


# ============== PAYMENT REPORTING ENDPOINTS ==============

class ReportUnpaidRequest(BaseModel):
    """Request body for reporting unpaid job"""
    reason: str
    days_overdue: Optional[int] = None
    evidence_urls: Optional[List[str]] = None

@router.post("/{post_id}/report-unpaid")
def report_unpaid_job(
    post_id: int,
    report_data: ReportUnpaidRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Housekeeper reports that owner hasn't paid for the job"""
    from app.models_v2.report import Report, ReportType, ReportStatus
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can report unpaid jobs"
        )
    
    # Get worker record
    worker_record = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Worker profile not found"
        )
    
    # Check if job exists
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    # Get the employer/owner for this job
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    owner_user_id = employer.user_id if employer else None
    
    # Check if this worker is assigned to this job
    interest = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == worker_record.worker_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    ).first()
    
    if not interest:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this job"
        )
    
    # Create report in database
    days_info = f" ({report_data.days_overdue} days overdue)" if report_data.days_overdue else ""
    report = Report(
        reporter_id=current_user.id,
        reporter_role="housekeeper",
        reported_user_id=owner_user_id,
        post_id=post_id,
        report_type=ReportType.UNPAID_JOB,
        title=f"Unpaid Job: {post.title}",
        description=f"{report_data.reason}{days_info}",
        evidence_urls=json.dumps(report_data.evidence_urls) if report_data.evidence_urls else None,
        status=ReportStatus.PENDING
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {
        "message": "Report submitted successfully. Our team will review this case.",
        "report_id": report.report_id,
        "post_id": post_id,
        "status": "pending"
    }


class ReportNonPerformanceRequest(BaseModel):
    """Request body for reporting housekeeper non-performance"""
    worker_id: int
    reason: str
    report_type: str = "non_completion"  # non_completion, poor_quality, no_show
    evidence_urls: Optional[List[str]] = None

class CancelRecurringJobRequest(BaseModel):
    reason: Optional[str] = None  # Reason for cancellation

@router.post("/{post_id}/cancel-recurring", response_model=JobPostResponse)
def cancel_recurring_job(
    post_id: int,
    cancel_data: CancelRecurringJobRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel/stop a recurring job posting (employer or worker)"""
    from datetime import datetime
    
    # Get the job post
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Job post not found")
    
    # Check if it's a recurring job
    if not post.is_recurring:
        raise HTTPException(
            status_code=400,
            detail="This is not a recurring job"
        )
    
    # Check if already cancelled
    if hasattr(post, 'recurring_status') and post.recurring_status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="This recurring job is already cancelled"
        )
    
    # Verify user has permission
    # Employer can always cancel their own job
    is_employer = post.user_id == current_user.id
    
    # Worker can cancel if they have an accepted application/contract
    is_worker = False
    if not is_employer:
        from app.models_v2.contract import Contract, ContractStatus
        contract = db.query(Contract).filter(
            Contract.post_id == post_id,
            Contract.status == ContractStatus.ACTIVE
        ).first()
        if contract:
            worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
            if worker and worker.user_id == current_user.id:
                is_worker = True
    
    if not (is_employer or is_worker):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to cancel this job"
        )
    
    # Determine who cancelled
    cancelled_by_role = "employer" if is_employer else "worker"
    cancellation_reason = (cancel_data.reason or "Cancelled from recurring services page").strip()
    
    # Update recurring status metadata
    post.recurring_status = "cancelled"
    post.recurring_cancelled_at = datetime.now()
    post.recurring_cancellation_reason = cancellation_reason
    post.cancelled_by = cancelled_by_role

    # Keep jobs page consistent by reflecting cancellation at job lifecycle level.
    if post.status != ForumPostStatus.COMPLETED:
        post.status = ForumPostStatus.CANCELLED

    # Cancel worker contracts that are still in-progress for this recurring post.
    from app.models_v2.contract import Contract, ContractStatus
    active_contracts = db.query(Contract).filter(
        Contract.post_id == post_id,
        Contract.status.in_([
            ContractStatus.PENDING,
            ContractStatus.ACTIVE,
            ContractStatus.PENDING_COMPLETION,
        ])
    ).all()
    for contract in active_contracts:
        contract.status = ContractStatus.CANCELLED

    # Mark related applications as cancelled so worker job lists are aligned.
    applications_to_cancel = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.status.in_([InterestStatus.PENDING, InterestStatus.ACCEPTED])
    ).all()
    for application in applications_to_cancel:
        application.status = InterestStatus.CANCELLED
    
    db.commit()
    db.refresh(post)
    
    # Get employer user for response
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    employer_user = db.query(User).filter(User.id == employer.user_id).first() if employer else current_user
    
    return JobPostResponse.from_orm_model(post, employer_user, 0)

@router.post("/{post_id}/report-non-performance")
def report_non_performance(
    post_id: int,
    report_data: ReportNonPerformanceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Owner reports that housekeeper didn't perform the job properly"""
    from app.models_v2.report import Report, ReportType, ReportStatus
    
    # Check if job exists and user is owner
    post = db.query(ForumPost).filter(ForumPost.post_id == post_id).first()
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job post not found"
        )
    
    employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
    if not employer or employer.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the job owner can report non-performance"
        )
    
    # Verify the worker is assigned to this job
    worker = db.query(Worker).filter(Worker.worker_id == report_data.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    interest = db.query(InterestCheck).filter(
        InterestCheck.post_id == post_id,
        InterestCheck.worker_id == report_data.worker_id,
        InterestCheck.status == InterestStatus.ACCEPTED
    ).first()
    
    if not interest:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This worker is not assigned to this job"
        )
    
    # Map report type string to enum
    type_mapping = {
        "non_completion": ReportType.NON_COMPLETION,
        "poor_quality": ReportType.POOR_QUALITY,
        "no_show": ReportType.NO_SHOW
    }
    report_type_enum = type_mapping.get(report_data.report_type, ReportType.NON_COMPLETION)
    
    # Get worker's user ID
    worker_user_id = worker.user_id
    
    # Create report
    report = Report(
        reporter_id=current_user.id,
        reporter_role="owner",
        reported_user_id=worker_user_id,
        post_id=post_id,
        report_type=report_type_enum,
        title=f"Worker Issue: {post.title}",
        description=report_data.reason,
        evidence_urls=json.dumps(report_data.evidence_urls) if report_data.evidence_urls else None,
        status=ReportStatus.PENDING
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {
        "message": "Report submitted successfully. Our team will review this case.",
        "report_id": report.report_id,
        "post_id": post_id,
        "status": "pending"
    }

