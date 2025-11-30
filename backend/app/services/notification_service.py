"""Notification service - Helper functions to create notifications from other modules"""
from sqlalchemy.orm import Session
from app.models_v2.notification import Notification, NotificationType


def notify_user(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    reference_type: str = None,
    reference_id: int = None,
    commit: bool = True
) -> Notification:
    """
    Create and store a notification for a user.
    
    Args:
        db: Database session
        user_id: The user to notify
        notification_type: Type of notification (from NotificationType enum)
        title: Short title for the notification
        message: Detailed message
        reference_type: Optional - type of related entity ('job', 'direct_hire', etc.)
        reference_id: Optional - ID of the related entity
        commit: Whether to commit immediately (default True)
    
    Returns:
        The created Notification object
    """
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id
    )
    db.add(notification)
    
    if commit:
        db.commit()
        db.refresh(notification)
    
    return notification


# ============== CONVENIENCE FUNCTIONS ==============

# Flow 1: Job/Contract Notifications

def notify_job_application(db: Session, employer_user_id: int, worker_name: str, job_title: str, post_id: int):
    """Notify employer when a worker applies to their job"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.JOB_APPLICATION,
        title="New Job Application",
        message=f"{worker_name} applied to your job: {job_title}",
        reference_type="job",
        reference_id=post_id
    )


def notify_application_accepted(db: Session, worker_user_id: int, job_title: str, post_id: int):
    """Notify worker when their application is accepted"""
    return notify_user(
        db=db,
        user_id=worker_user_id,
        notification_type=NotificationType.APPLICATION_ACCEPTED,
        title="Application Accepted! 🎉",
        message=f"Your application for '{job_title}' has been accepted!",
        reference_type="job",
        reference_id=post_id
    )


def notify_application_rejected(db: Session, worker_user_id: int, job_title: str, post_id: int):
    """Notify worker when their application is rejected"""
    return notify_user(
        db=db,
        user_id=worker_user_id,
        notification_type=NotificationType.APPLICATION_REJECTED,
        title="Application Update",
        message=f"Your application for '{job_title}' was not selected.",
        reference_type="job",
        reference_id=post_id
    )


def notify_completion_submitted(db: Session, employer_user_id: int, worker_name: str, job_title: str, post_id: int):
    """Notify employer when a worker submits completion proof"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.COMPLETION_SUBMITTED,
        title="Completion Proof Submitted 📋",
        message=f"{worker_name} has submitted completion proof for '{job_title}'. Please review.",
        reference_type="job",
        reference_id=post_id
    )


def notify_completion_approved(db: Session, worker_user_id: int, job_title: str, post_id: int):
    """Notify worker when their completion is approved"""
    return notify_user(
        db=db,
        user_id=worker_user_id,
        notification_type=NotificationType.COMPLETION_APPROVED,
        title="Work Approved! ✅",
        message=f"Your work on '{job_title}' has been approved!",
        reference_type="job",
        reference_id=post_id
    )


def notify_payment_sent(db: Session, worker_user_id: int, job_title: str, amount: float, post_id: int):
    """Notify worker when employer sends payment"""
    return notify_user(
        db=db,
        user_id=worker_user_id,
        notification_type=NotificationType.PAYMENT_SENT,
        title="Payment Sent! 💰",
        message=f"Payment of ₱{amount:,.2f} for '{job_title}' has been sent.",
        reference_type="job",
        reference_id=post_id
    )


def notify_payment_received(db: Session, employer_user_id: int, worker_name: str, job_title: str, post_id: int):
    """Notify employer when worker confirms payment"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.PAYMENT_RECEIVED,
        title="Payment Confirmed ✓",
        message=f"{worker_name} confirmed payment for '{job_title}'.",
        reference_type="job",
        reference_id=post_id
    )


def notify_payment_due(db: Session, employer_user_id: int, worker_name: str, job_title: str, amount: float, post_id: int):
    """Notify employer about upcoming payment due"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.PAYMENT_DUE,
        title="Payment Due Soon 📅",
        message=f"Payment of ₱{amount:,.2f} to {worker_name} for '{job_title}' is due.",
        reference_type="job",
        reference_id=post_id
    )


# Flow 2: Direct Hire Notifications

def notify_direct_hire_request(db: Session, worker_user_id: int, employer_name: str, hire_id: int):
    """Notify worker of new direct hire request"""
    return notify_user(
        db=db,
        user_id=worker_user_id,
        notification_type=NotificationType.DIRECT_HIRE_REQUEST,
        title="New Booking Request! 📬",
        message=f"{employer_name} wants to book your services.",
        reference_type="direct_hire",
        reference_id=hire_id
    )


def notify_direct_hire_accepted(db: Session, employer_user_id: int, worker_name: str, hire_id: int):
    """Notify employer when worker accepts hire"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.DIRECT_HIRE_ACCEPTED,
        title="Booking Accepted! ✅",
        message=f"{worker_name} accepted your booking request.",
        reference_type="direct_hire",
        reference_id=hire_id
    )


def notify_direct_hire_rejected(db: Session, employer_user_id: int, worker_name: str, hire_id: int):
    """Notify employer when worker rejects hire"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.DIRECT_HIRE_REJECTED,
        title="Booking Declined",
        message=f"{worker_name} declined your booking request.",
        reference_type="direct_hire",
        reference_id=hire_id
    )


def notify_direct_hire_started(db: Session, employer_user_id: int, worker_name: str, hire_id: int):
    """Notify employer when worker starts the job"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.DIRECT_HIRE_STARTED,
        title="Work Started! 🔄",
        message=f"{worker_name} has started working on your booking.",
        reference_type="direct_hire",
        reference_id=hire_id
    )


def notify_direct_hire_completed(db: Session, employer_user_id: int, worker_name: str, hire_id: int):
    """Notify employer when worker submits completion"""
    return notify_user(
        db=db,
        user_id=employer_user_id,
        notification_type=NotificationType.DIRECT_HIRE_COMPLETED,
        title="Work Completed! 📋",
        message=f"{worker_name} has completed the job and submitted proof. Please review.",
        reference_type="direct_hire",
        reference_id=hire_id
    )


def notify_direct_hire_approved(db: Session, worker_user_id: int, employer_name: str, hire_id: int):
    """Notify worker when employer approves completion"""
    return notify_user(
        db=db,
        user_id=worker_user_id,
        notification_type=NotificationType.DIRECT_HIRE_APPROVED,
        title="Work Approved! ✅",
        message=f"{employer_name} approved your completed work.",
        reference_type="direct_hire",
        reference_id=hire_id
    )


def notify_direct_hire_paid(db: Session, worker_user_id: int, employer_name: str, amount: float, hire_id: int):
    """Notify worker when payment is confirmed"""
    return notify_user(
        db=db,
        user_id=worker_user_id,
        notification_type=NotificationType.DIRECT_HIRE_PAID,
        title="Payment Received! 💰",
        message=f"Payment of ₱{amount:,.2f} from {employer_name} has been confirmed.",
        reference_type="direct_hire",
        reference_id=hire_id
    )
