"""
Schedule conflict detection and management service.

Covers every combination:
  • Job-posting  ↔ Job-posting
  • Job-posting  ↔ Direct-hire
  • Job-posting  ↔ Recurring (job-posting or direct-hire)
  • Direct-hire  ↔ Direct-hire
  • Direct-hire  ↔ Recurring
  • Recurring    ↔ Recurring
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta, time
from typing import List, Tuple, Dict, Optional
from app.models_v2.forum import ForumPost, InterestCheck, InterestStatus
from app.models_v2.direct_hire import DirectHire, DirectHireStatus
from app.models_v2.worker_employer import Worker, Employer
from app.models_v2.contract import Contract, ContractStatus
from app.models_v2.notification import Notification, NotificationType
from app.models_v2.user import User

import logging
logger = logging.getLogger(__name__)


class ScheduleConflictError(Exception):
    """Custom exception for schedule conflicts"""
    pass


def parse_date_string(date_str: str) -> Optional[date]:
    """Parse various date string formats"""
    if not date_str:
        return None
    
    if isinstance(date_str, date):
        return date_str
    
    try:
        # Try ISO format (YYYY-MM-DD)
        return datetime.fromisoformat(date_str).date()
    except (ValueError, AttributeError):
        return None


def parse_time_string(time_str: str) -> Optional[time]:
    """Parse a time string like '08:00' or '15:30' into a time object"""
    if not time_str:
        return None
    try:
        parts = time_str.strip().split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


def check_dates_overlap(
    start1: date,
    end1: date,
    start2: date,
    end2: date
) -> bool:
    """
    Check if two date ranges overlap.
    Returns True if they overlap or touch.
    """
    if not all([start1, end1, start2, end2]):
        return False
    
    # Ensure start <= end for both ranges
    if start1 > end1:
        start1, end1 = end1, start1
    if start2 > end2:
        start2, end2 = end2, start2
    
    # Check for overlap: either start1 <= start2 < end1 or start2 <= start1 < end2
    return not (end1 < start2 or end2 < start1)


def check_times_overlap(
    start1: Optional[str],
    end1: Optional[str],
    start2: Optional[str],
    end2: Optional[str],
) -> bool:
    """
    Check if two daily time ranges overlap.
    If either side has no time info we assume full-day occupation (= always overlaps).
    """
    t1_start = parse_time_string(start1)
    t1_end = parse_time_string(end1)
    t2_start = parse_time_string(start2)
    t2_end = parse_time_string(end2)

    # If any side lacks time info, treat as full-day → overlaps
    if t1_start is None or t1_end is None or t2_start is None or t2_end is None:
        return True

    # No overlap if one ends before the other starts
    return not (t1_end <= t2_start or t2_end <= t1_start)


def check_day_overlap(day1: str, day2: str) -> bool:
    """
    Check if two day-of-week values share at least one common day.
    Both may be single values ("tuesday") or comma-separated ("tuesday,saturday").
    """
    if not day1 or not day2:
        return False

    days1 = {d.strip().lower() for d in day1.split(',') if d.strip()}
    days2 = {d.strip().lower() for d in day2.split(',') if d.strip()}
    return bool(days1 & days2)


def get_days_set(day_str: Optional[str]) -> set:
    """Return a set of lowercase day names from a comma-separated string."""
    if not day_str:
        return set()
    return {d.strip().lower() for d in day_str.split(',') if d.strip()}


def get_housekeeper_jobs(
    db: Session,
    worker_id: int,
    exclude_statuses: List[str] = None,
    exclude_job_id: Optional[int] = None,
    exclude_job_type: Optional[str] = None,
) -> List[Dict]:
    """
    Get all active jobs for a housekeeper from all three sources:
    - Job post applications (accepted)
    - Direct hires (accepted/in_progress/pending_completion/payment_pending)
    - Recurring jobs (active)
    
    Parameters:
        exclude_job_id:   ID of a job to omit (e.g. to avoid self-matching)
        exclude_job_type: 'job_post' | 'direct_hire'  (must accompany exclude_job_id)
    
    Returns list of job info with dates, times, and types
    """
    if exclude_statuses is None:
        exclude_statuses = ["completed", "paid", "cancelled", "rejected"]
    
    jobs = []
    
    # 1. Get accepted job post applications (through contracts)
    contracts = db.query(Contract).filter(
        Contract.worker_id == worker_id,
        Contract.status.notin_([ContractStatus.COMPLETED, ContractStatus.CANCELLED])
    ).all()
    
    for contract in contracts:
        # Skip self
        if exclude_job_type == 'job_post' and exclude_job_id and contract.post_id == exclude_job_id:
            continue

        post = db.query(ForumPost).filter(ForumPost.post_id == contract.post_id).first()
        if post:
            # For job posts, use start_date
            job_start = parse_date_string(post.start_date)
            job_end = parse_date_string(post.end_date)
            
            # If multi-day, compute end date from start + num_days
            num_days = getattr(post, 'num_days', 1) or 1
            if job_start and num_days > 1 and not job_end:
                job_end = job_start + timedelta(days=num_days - 1)
            elif not job_end:
                job_end = job_start
            
            jobs.append({
                'type': 'job_post',
                'job_id': post.post_id,
                'contract_id': contract.contract_id,
                'start_date': job_start,
                'end_date': job_end,
                'daily_start_time': getattr(post, 'daily_start_time', None) or post.start_time,
                'daily_end_time': getattr(post, 'daily_end_time', None) or post.end_time,
                'num_days': num_days,
                'employer_id': post.employer_id,
                'is_recurring': post.is_recurring,
                'recurring_day': post.day_of_week,
                'title': post.title
            })
    
    # 2. Get accepted/active direct hires (including pending_completion & payment_pending — they still occupy the slot)
    active_statuses = [
        DirectHireStatus.ACCEPTED,
        DirectHireStatus.IN_PROGRESS,
        DirectHireStatus.PENDING_COMPLETION,
        DirectHireStatus.PAYMENT_PENDING,
    ]
    direct_hires = db.query(DirectHire).filter(
        DirectHire.worker_id == worker_id,
        DirectHire.status.in_(active_statuses)
    ).all()
    
    for hire in direct_hires:
        # Skip self
        if exclude_job_type == 'direct_hire' and exclude_job_id and hire.hire_id == exclude_job_id:
            continue

        job_start = hire.scheduled_date if hire.scheduled_date else None
        num_days = getattr(hire, 'num_days', 1) or 1
        job_end = getattr(hire, 'end_date', None)
        if job_start and num_days > 1 and not job_end:
            job_end = job_start + timedelta(days=num_days - 1)
        elif not job_end:
            job_end = job_start
        
        jobs.append({
            'type': 'direct_hire',
            'job_id': hire.hire_id,
            'hire_id': hire.hire_id,
            'start_date': job_start,
            'end_date': job_end,
            'daily_start_time': getattr(hire, 'daily_start_time', None) or hire.start_time,
            'daily_end_time': getattr(hire, 'daily_end_time', None) or hire.end_time,
            'num_days': num_days,
            'employer_id': hire.employer_id,
            'is_recurring': hire.is_recurring,
            'recurring_day': hire.day_of_week,
            'title': f"Direct hire #{hire.hire_id}"
        })
    
    return jobs


def detect_schedule_conflicts(
    db: Session,
    worker_id: int,
    new_job_start_date: Optional[date],
    new_job_end_date: Optional[date],
    new_job_employer_id: int,
    new_job_is_recurring: bool = False,
    new_job_recurring_day: Optional[str] = None,
    new_job_type: str = 'job_post',  # 'job_post', 'direct_hire', 'recurring'
    new_job_daily_start_time: Optional[str] = None,
    new_job_daily_end_time: Optional[str] = None,
    exclude_job_id: Optional[int] = None,
    exclude_job_type: Optional[str] = None,
    check_same_employer: bool = False,
) -> List[Dict]:
    """
    Check if new job conflicts with any existing jobs.
    
    Parameters:
        exclude_job_id / exclude_job_type:
            Exclude a specific job from the existing-jobs list so it cannot
            self-match (e.g. when withdrawing conflicting apps after accepting).
        check_same_employer:
            If True, do NOT skip same-employer jobs (useful at application time
            to warn about real conflicts).
    
    Returns:
        List of conflicting jobs (empty if no conflicts)
    
    A conflict occurs when:
    1. Different employer (unless check_same_employer=True):
       - For one-time jobs: Start/end dates overlap AND time ranges overlap
       - For recurring jobs: Same day of week AND time ranges overlap
       - Cross-type: recurring day falls inside one-time range AND times overlap
    """
    
    existing_jobs = get_housekeeper_jobs(
        db, worker_id,
        exclude_job_id=exclude_job_id,
        exclude_job_type=exclude_job_type,
    )
    conflicts = []
    
    # Normalize dates
    new_start = new_job_start_date
    new_end = new_job_end_date if new_job_end_date else new_job_start_date
    
    for existing_job in existing_jobs:
        # RULE: Same employer = no conflict (unless explicitly checking all)
        if not check_same_employer and existing_job['employer_id'] == new_job_employer_id:
            continue
        
        # Check for conflicts
        is_conflict = False
        conflict_reason = ""
        
        # Case 1: New job is recurring
        if new_job_is_recurring and new_job_recurring_day:
            new_days = get_days_set(new_job_recurring_day)
            # Check if existing job is also recurring and shares a day
            if existing_job['is_recurring'] and existing_job['recurring_day']:
                shared_days = new_days & get_days_set(existing_job['recurring_day'])
                if shared_days:
                    if check_times_overlap(
                        new_job_daily_start_time, new_job_daily_end_time,
                        existing_job.get('daily_start_time'), existing_job.get('daily_end_time')
                    ):
                        is_conflict = True
                        conflict_reason = f"Recurring job conflict on {', '.join(sorted(shared_days))} with overlapping hours"
            # Check if existing one-time job falls on any of the new recurring days
            elif existing_job['start_date']:
                existing_day_name = existing_job['start_date'].strftime('%A').lower()
                if existing_day_name in new_days:
                    if check_times_overlap(
                        new_job_daily_start_time, new_job_daily_end_time,
                        existing_job.get('daily_start_time'), existing_job.get('daily_end_time')
                    ):
                        is_conflict = True
                        conflict_reason = f"Conflicts with existing job on {existing_day_name} during overlapping hours"

        # Case 2: Existing job is recurring, new is one-time
        elif existing_job['is_recurring'] and existing_job['recurring_day'] and new_start:
            # Check if new job date range contains any of the existing recurring days
            existing_days = get_days_set(existing_job['recurring_day'])
            check_end = new_end if new_end else new_start
            current_date = new_start
            while current_date <= check_end:
                if current_date.strftime('%A').lower() in existing_days:
                    if check_times_overlap(
                        new_job_daily_start_time, new_job_daily_end_time,
                        existing_job.get('daily_start_time'), existing_job.get('daily_end_time')
                    ):
                        is_conflict = True
                        conflict_reason = f"Conflicts with recurring job on {existing_job['recurring_day']} during overlapping hours"
                        break
                current_date += timedelta(days=1)
        
        # Case 3: Both are one-time jobs
        elif new_start and new_end and existing_job['start_date'] and existing_job['end_date']:
            if check_dates_overlap(new_start, new_end, existing_job['start_date'], existing_job['end_date']):
                # Dates overlap – now check if the daily time windows also overlap
                if check_times_overlap(
                    new_job_daily_start_time, new_job_daily_end_time,
                    existing_job.get('daily_start_time'), existing_job.get('daily_end_time')
                ):
                    is_conflict = True
                    conflict_reason = f"Date range overlaps with existing job during overlapping hours"
                else:
                    # Same dates but different hours – no conflict!
                    conflict_reason = ""
        
        if is_conflict:
            conflicts.append({
                'job_id': existing_job['job_id'],
                'type': existing_job['type'],
                'title': existing_job['title'],
                'start_date': existing_job['start_date'],
                'end_date': existing_job['end_date'],
                'recurring_day': existing_job.get('recurring_day'),
                'reason': conflict_reason,
                'contract_id': existing_job.get('contract_id'),
                'hire_id': existing_job.get('hire_id')
            })
    
    return conflicts


def withdraw_conflicting_applications(
    db: Session,
    worker_id: int,
    newly_accepted_job_type: str,
    newly_accepted_job_id: int,
    newly_accepted_start_date: Optional[date],
    newly_accepted_end_date: Optional[date],
    newly_accepted_employer_id: int,
    newly_accepted_is_recurring: bool = False,
    newly_accepted_recurring_day: Optional[str] = None,
    newly_accepted_daily_start_time: Optional[str] = None,
    newly_accepted_daily_end_time: Optional[str] = None,
) -> List[Dict]:
    """
    When a housekeeper accepts a job, withdraw their pending applications
    and reject their pending direct-hire requests that conflict.

    Uses exclude_job_id to avoid self-matching after the hire's status has
    already been flipped to ACCEPTED.
    
    Returns:
        List of withdrawn / rejected items
    """
    # --- 1. Detect conflicts against ACTIVE jobs (skip self) ---
    conflicts = detect_schedule_conflicts(
        db=db,
        worker_id=worker_id,
        new_job_start_date=newly_accepted_start_date,
        new_job_end_date=newly_accepted_end_date,
        new_job_employer_id=newly_accepted_employer_id,
        new_job_is_recurring=newly_accepted_is_recurring,
        new_job_recurring_day=newly_accepted_recurring_day,
        new_job_type=newly_accepted_job_type,
        new_job_daily_start_time=newly_accepted_daily_start_time,
        new_job_daily_end_time=newly_accepted_daily_end_time,
        exclude_job_id=newly_accepted_job_id,
        exclude_job_type=newly_accepted_job_type,
    )
    
    withdrawn = []
    
    for conflict in conflicts:
        # For job posts: withdraw pending interest checks
        if conflict['type'] == 'job_post':
            interest = db.query(InterestCheck).filter(
                InterestCheck.post_id == conflict['job_id'],
                InterestCheck.worker_id == worker_id,
                InterestCheck.status == InterestStatus.PENDING
            ).first()
            
            if interest:
                interest.status = InterestStatus.REJECTED
                interest.withdrawn_due_to_conflict = True
                db.commit()
                
                # Get job and employer info
                post = db.query(ForumPost).filter(ForumPost.post_id == conflict['job_id']).first()
                employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
                
                withdrawn.append({
                    'job_id': post.post_id,
                    'job_title': post.title,
                    'employer_id': employer.employer_id if employer else None,
                    'employer_user_id': employer.user_id if employer else None,
                    'conflict_reason': conflict['reason']
                })
        
        # For direct hires: cancel pending requests
        elif conflict['type'] == 'direct_hire':
            hire = db.query(DirectHire).filter(
                DirectHire.hire_id == conflict['job_id'],
                DirectHire.worker_id == worker_id,
                DirectHire.status == DirectHireStatus.PENDING
            ).first()
            
            if hire:
                hire.status = DirectHireStatus.REJECTED
                db.commit()
                
                employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first()
                
                withdrawn.append({
                    'job_id': hire.hire_id,
                    'job_title': f'Direct Hire #{hire.hire_id}',
                    'employer_id': employer.employer_id if employer else None,
                    'employer_user_id': employer.user_id if employer else None,
                    'conflict_reason': conflict['reason']
                })
    
    # --- 2. Also reject PENDING direct hires that conflict ---
    # (get_housekeeper_jobs only returns accepted/in-progress hires;
    #  pending hires are not there yet, so we check them separately)
    pending_hires = db.query(DirectHire).filter(
        DirectHire.worker_id == worker_id,
        DirectHire.status == DirectHireStatus.PENDING,
    ).all()

    for hire in pending_hires:
        # Don't reject the one we just accepted
        if newly_accepted_job_type == 'direct_hire' and hire.hire_id == newly_accepted_job_id:
            continue
        # Same employer → skip
        if hire.employer_id == newly_accepted_employer_id:
            continue

        # Build the pending hire's schedule parameters
        ph_start = hire.scheduled_date
        ph_num_days = getattr(hire, 'num_days', 1) or 1
        ph_end = getattr(hire, 'end_date', None)
        if ph_start and ph_num_days > 1 and not ph_end:
            ph_end = ph_start + timedelta(days=ph_num_days - 1)
        if not ph_end:
            ph_end = ph_start

        ph_is_recurring = hire.is_recurring
        ph_recurring_day = hire.day_of_week if ph_is_recurring else None
        ph_daily_start = getattr(hire, 'daily_start_time', None) or hire.start_time
        ph_daily_end = getattr(hire, 'daily_end_time', None) or hire.end_time

        if _two_jobs_conflict(
            newly_accepted_start_date, newly_accepted_end_date,
            newly_accepted_is_recurring, newly_accepted_recurring_day,
            newly_accepted_daily_start_time, newly_accepted_daily_end_time,
            ph_start, ph_end,
            ph_is_recurring, ph_recurring_day,
            ph_daily_start, ph_daily_end,
        ):
            hire.status = DirectHireStatus.REJECTED
            db.commit()

            employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first()
            withdrawn.append({
                'job_id': hire.hire_id,
                'job_title': f'Direct Hire #{hire.hire_id}',
                'employer_id': employer.employer_id if employer else None,
                'employer_user_id': employer.user_id if employer else None,
                'conflict_reason': 'Pending hire rejected due to schedule conflict with newly accepted job'
            })

    # --- 3. Also withdraw PENDING job-post applications that conflict ---
    pending_interests = db.query(InterestCheck).filter(
        InterestCheck.worker_id == worker_id,
        InterestCheck.status == InterestStatus.PENDING,
    ).all()

    # Collect IDs already handled above so we don't double-process
    already_handled_post_ids = {w['job_id'] for w in withdrawn if 'job_title' in w and 'Direct Hire' not in w.get('job_title', '')}

    for interest in pending_interests:
        if interest.post_id in already_handled_post_ids:
            continue

        post = db.query(ForumPost).filter(ForumPost.post_id == interest.post_id).first()
        if not post:
            continue

        # Skip same employer
        if post.employer_id == newly_accepted_employer_id:
            continue

        # Skip the job we just got accepted to
        if newly_accepted_job_type == 'job_post' and post.post_id == newly_accepted_job_id:
            continue

        pp_start = parse_date_string(post.start_date)
        pp_end = parse_date_string(post.end_date)
        pp_num_days = getattr(post, 'num_days', 1) or 1
        if pp_start and pp_num_days > 1 and not pp_end:
            pp_end = pp_start + timedelta(days=pp_num_days - 1)
        if not pp_end:
            pp_end = pp_start

        pp_is_recurring = post.is_recurring
        pp_recurring_day = post.day_of_week if pp_is_recurring else None
        pp_daily_start = getattr(post, 'daily_start_time', None) or post.start_time
        pp_daily_end = getattr(post, 'daily_end_time', None) or post.end_time

        if _two_jobs_conflict(
            newly_accepted_start_date, newly_accepted_end_date,
            newly_accepted_is_recurring, newly_accepted_recurring_day,
            newly_accepted_daily_start_time, newly_accepted_daily_end_time,
            pp_start, pp_end,
            pp_is_recurring, pp_recurring_day,
            pp_daily_start, pp_daily_end,
        ):
            interest.status = InterestStatus.REJECTED
            interest.withdrawn_due_to_conflict = True
            db.commit()

            employer = db.query(Employer).filter(Employer.employer_id == post.employer_id).first()
            withdrawn.append({
                'job_id': post.post_id,
                'job_title': post.title,
                'employer_id': employer.employer_id if employer else None,
                'employer_user_id': employer.user_id if employer else None,
                'conflict_reason': 'Application withdrawn due to schedule conflict with newly accepted job'
            })

    return withdrawn


# ========== Internal helpers ==========

def _two_jobs_conflict(
    start_a: Optional[date], end_a: Optional[date],
    a_recurring: bool, a_recurring_day: Optional[str],
    a_start_time: Optional[str], a_end_time: Optional[str],
    start_b: Optional[date], end_b: Optional[date],
    b_recurring: bool, b_recurring_day: Optional[str],
    b_start_time: Optional[str], b_end_time: Optional[str],
) -> bool:
    """
    Pure-logic check: do two jobs conflict?
    Covers all combos: recurring↔recurring, recurring↔one-time, one-time↔one-time.
    """
    # Case 1: Both recurring — conflict if any days overlap AND times overlap
    if a_recurring and a_recurring_day and b_recurring and b_recurring_day:
        if check_day_overlap(a_recurring_day, b_recurring_day):
            return check_times_overlap(a_start_time, a_end_time, b_start_time, b_end_time)
        return False

    # Case 2: A is recurring, B is one-time
    if a_recurring and a_recurring_day and start_b:
        a_days = get_days_set(a_recurring_day)
        b_end_safe = end_b or start_b
        cur = start_b
        while cur <= b_end_safe:
            if cur.strftime('%A').lower() in a_days:
                if check_times_overlap(a_start_time, a_end_time, b_start_time, b_end_time):
                    return True
            cur += timedelta(days=1)
        return False

    # Case 3: B is recurring, A is one-time
    if b_recurring and b_recurring_day and start_a:
        b_days = get_days_set(b_recurring_day)
        a_end_safe = end_a or start_a
        cur = start_a
        while cur <= a_end_safe:
            if cur.strftime('%A').lower() in b_days:
                if check_times_overlap(a_start_time, a_end_time, b_start_time, b_end_time):
                    return True
            cur += timedelta(days=1)
        return False

    # Case 4: Both one-time
    if start_a and start_b:
        a_end_safe = end_a or start_a
        b_end_safe = end_b or start_b
        if check_dates_overlap(start_a, a_end_safe, start_b, b_end_safe):
            return check_times_overlap(a_start_time, a_end_time, b_start_time, b_end_time)

    return False


def notify_withdrawal_to_housekeeper(
    db: Session,
    worker_user_id: int,
    newly_accepted_job_title: str,
    withdrawn_applications: List[Dict]
):
    """Notify housekeeper about withdrawn applications"""
    if not withdrawn_applications:
        return
    
    withdrawn_titles = ", ".join([w['job_title'] for w in withdrawn_applications])
    
    notification = Notification(
        user_id=worker_user_id,
        type=NotificationType.APPLICATION_WITHDRAWN_DUE_TO_CONFLICT,
        title="Application Withdrawn - Schedule Conflict",
        message=f"Your applications for {withdrawn_titles} have been withdrawn because you accepted '{newly_accepted_job_title}' which conflicts with the schedule.",
        reference_type="conflict_withdrawal",
        reference_id=None
    )
    db.add(notification)
    db.commit()


def notify_withdrawal_to_employers(
    db: Session,
    withdrawn_applications: List[Dict],
    worker_name: str,
    accepted_job_title: str
):
    """Notify employers about withdrawn applications from their job posts"""
    for withdrawal in withdrawn_applications:
        if not withdrawal['employer_user_id']:
            continue
        
        notification = Notification(
            user_id=withdrawal['employer_user_id'],
            type=NotificationType.APPLICANT_WITHDRAWN_DUE_TO_CONFLICT,
            title="Applicant Withdrawn - Schedule Conflict",
            message=f"{worker_name} has withdrawn their application for '{withdrawal['job_title']}' because they accepted another job ('{accepted_job_title}') that conflicts with the schedule.",
            reference_type="job",
            reference_id=withdrawal['job_id']
        )
        db.add(notification)
    
    db.commit()


def check_and_handle_direct_hire_conflicts(
    db: Session,
    worker_id: int,
    new_hire_date: date,
    new_hire_employer_id: int,
    new_hire_is_recurring: bool = False,
    new_hire_recurring_day: Optional[str] = None,
    new_hire_end_date: Optional[date] = None,
    new_hire_daily_start_time: Optional[str] = None,
    new_hire_daily_end_time: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Check if a direct hire conflicts with existing jobs.
    
    Returns:
        (has_conflict, conflict_message)
    """
    conflicts = detect_schedule_conflicts(
        db=db,
        worker_id=worker_id,
        new_job_start_date=new_hire_date,
        new_job_end_date=new_hire_end_date or new_hire_date,
        new_job_employer_id=new_hire_employer_id,
        new_job_is_recurring=new_hire_is_recurring,
        new_job_recurring_day=new_hire_recurring_day,
        new_job_type='direct_hire',
        new_job_daily_start_time=new_hire_daily_start_time,
        new_job_daily_end_time=new_hire_daily_end_time,
    )
    
    if conflicts:
        conflict_details = ", ".join([c['title'] for c in conflicts])
        return True, f"Schedule conflicts with: {conflict_details}"
    
    return False, ""
