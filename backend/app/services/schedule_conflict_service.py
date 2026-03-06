"""Schedule conflict detection and management service"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, date, timedelta
from typing import List, Tuple, Dict, Optional
from app.models_v2.forum import ForumPost, InterestCheck, InterestStatus
from app.models_v2.direct_hire import DirectHire, DirectHireStatus
from app.models_v2.worker_employer import Worker, Employer
from app.models_v2.contract import Contract, ContractStatus
from app.models_v2.notification import Notification, NotificationType
from app.models_v2.user import User


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


def check_day_overlap(day1: str, day2: str) -> bool:
    """Check if two days of week are the same"""
    if not day1 or not day2:
        return False
    
    return day1.lower().strip() == day2.lower().strip()


def get_housekeeper_jobs(
    db: Session,
    worker_id: int,
    exclude_statuses: List[str] = None
) -> List[Dict]:
    """
    Get all active jobs for a housekeeper from all three sources:
    - Job post applications (accepted)
    - Direct hires (accepted/in_progress)
    - Recurring jobs (active)
    
    Returns list of job info with dates and types
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
        post = db.query(ForumPost).filter(ForumPost.post_id == contract.post_id).first()
        if post:
            # For job posts, use start_date
            job_start = parse_date_string(post.start_date)
            job_end = parse_date_string(post.end_date)
            
            jobs.append({
                'type': 'job_post',
                'job_id': post.post_id,
                'contract_id': contract.contract_id,
                'start_date': job_start,
                'end_date': job_end,
                'employer_id': post.employer_id,
                'is_recurring': post.is_recurring,
                'recurring_day': post.day_of_week,
                'title': post.title
            })
    
    # 2. Get accepted/active direct hires
    direct_hires = db.query(DirectHire).filter(
        DirectHire.worker_id == worker_id,
        DirectHire.status.in_([DirectHireStatus.ACCEPTED, DirectHireStatus.IN_PROGRESS])
    ).all()
    
    for hire in direct_hires:
        job_start = hire.scheduled_date if hire.scheduled_date else None
        job_end = job_start  # Direct hire is usually single day, but treat as same-day job
        
        jobs.append({
            'type': 'direct_hire',
            'job_id': hire.hire_id,
            'hire_id': hire.hire_id,
            'start_date': job_start,
            'end_date': job_end,
            'employer_id': hire.employer_id,
            'is_recurring': hire.is_recurring,
            'recurring_day': hire.day_of_week,
            'title': f"Direct hire"
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
    new_job_type: str = 'job_post'  # 'job_post', 'direct_hire', 'recurring'
) -> List[Dict]:
    """
    Check if new job conflicts with any existing jobs.
    
    Returns:
        List of conflicting jobs (empty if no conflicts)
    
    A conflict occurs when:
    1. Same employer: No conflicts allowed (they can manage multiple jobs)
    2. Different employer:
       - For one-time jobs: Start/end dates overlap
       - For recurring jobs: Same day of week
    """
    
    existing_jobs = get_housekeeper_jobs(db, worker_id)
    conflicts = []
    
    # Normalize dates
    new_start = new_job_start_date
    new_end = new_job_end_date if new_job_end_date else new_job_start_date
    
    for existing_job in existing_jobs:
        # RULE: Same employer = no conflict
        if existing_job['employer_id'] == new_job_employer_id:
            continue
        
        # Check for conflicts
        is_conflict = False
        conflict_reason = ""
        
        # Case 1: New job is recurring
        if new_job_is_recurring and new_job_recurring_day:
            # Check if existing job is on same recurring day
            if existing_job['is_recurring'] and existing_job['recurring_day']:
                if check_day_overlap(new_job_recurring_day, existing_job['recurring_day']):
                    is_conflict = True
                    conflict_reason = f"Recurring job conflict on {new_job_recurring_day}"
            # Check if existing one-time job is on same day
            elif existing_job['start_date']:
                if new_job_recurring_day.lower().strip() == existing_job['start_date'].strftime('%A').lower():
                    is_conflict = True
                    conflict_reason = f"Conflicts with existing job on {new_job_recurring_day}"
        
        # Case 2: Existing job is recurring, new is one-time
        elif existing_job['is_recurring'] and existing_job['recurring_day'] and new_start:
            # Check if new job falls on the recurring day
            recurring_day_name = existing_job['recurring_day'].lower().strip()
            if new_start.strftime('%A').lower() == recurring_day_name:
                is_conflict = True
                conflict_reason = f"Conflicts with recurring job on {existing_job['recurring_day']}"
        
        # Case 3: Both are one-time jobs
        elif new_start and new_end and existing_job['start_date'] and existing_job['end_date']:
            if check_dates_overlap(new_start, new_end, existing_job['start_date'], existing_job['end_date']):
                is_conflict = True
                conflict_reason = f"Date range overlaps with existing job"
        
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
    newly_accepted_recurring_day: Optional[str] = None
) -> List[Dict]:
    """
    When a housekeeper accepts a job, withdraw their pending applications
    from conflicting jobs with different employers.
    
    Returns:
        List of withdrawn applications
    """
    conflicts = detect_schedule_conflicts(
        db=db,
        worker_id=worker_id,
        new_job_start_date=newly_accepted_start_date,
        new_job_end_date=newly_accepted_end_date,
        new_job_employer_id=newly_accepted_employer_id,
        new_job_is_recurring=newly_accepted_is_recurring,
        new_job_recurring_day=newly_accepted_recurring_day,
        new_job_type=newly_accepted_job_type
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
                    'job_title': 'Direct Hire',
                    'employer_id': employer.employer_id if employer else None,
                    'employer_user_id': employer.user_id if employer else None,
                    'conflict_reason': conflict['reason']
                })
    
    return withdrawn


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
    new_hire_recurring_day: Optional[str] = None
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
        new_job_end_date=new_hire_date,
        new_job_employer_id=new_hire_employer_id,
        new_job_is_recurring=new_hire_is_recurring,
        new_job_recurring_day=new_hire_recurring_day,
        new_job_type='direct_hire'
    )
    
    if conflicts:
        conflict_details = ", ".join([c['title'] for c in conflicts])
        return True, f"Schedule conflicts with: {conflict_details}"
    
    return False, ""
