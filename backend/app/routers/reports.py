"""
Report endpoints for disputes and complaints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import json

from app.db import get_db
from app.models_v2.user import User
from app.models_v2.report import Report, ReportType, ReportStatus
from app.models_v2.forum import ForumPost, ForumPostStatus
from app.security import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


class CreateReportRequest(BaseModel):
    """Request body for creating a report"""
    report_type: str
    title: str
    reason: str
    description: str
    post_id: Optional[int] = None
    reported_user_id: Optional[int] = None
    evidence_urls: Optional[List[str]] = None


class ReportResponse(BaseModel):
    """Response for a report"""
    report_id: int
    reporter_role: str
    report_type: str
    title: str
    description: str
    post_id: Optional[int]
    reported_user_id: Optional[int]
    evidence_urls: Optional[List[str]]
    status: str
    created_at: str
    
    class Config:
        from_attributes = True


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_report(
    report_data: CreateReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new report (for housekeepers or owners)"""
    
    # Determine reporter role
    active_role = current_user.active_role
    if hasattr(active_role, 'value'):
        active_role = active_role.value
    
    # Validate report type
    try:
        report_type = ReportType(report_data.report_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid report type. Valid types: {[t.value for t in ReportType]}"
        )
    
    # If reporting about a job, validate it exists
    if report_data.post_id:
        post = db.query(ForumPost).filter(ForumPost.post_id == report_data.post_id).first()
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job post not found"
            )

    # Back-job request specific rules
    if report_type == ReportType.BACK_JOB_REQUEST:
        if active_role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only house owners can submit a back job request"
            )
        if not report_data.post_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Back job request requires a related job post"
            )
        if not report_data.reported_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Back job request requires the reported housekeeper"
            )
        if post.status != ForumPostStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Back job request can only be filed after job completion"
            )

        existing_pending = db.query(Report).filter(
            Report.post_id == report_data.post_id,
            Report.report_type == ReportType.BACK_JOB_REQUEST,
            Report.status.in_([ReportStatus.PENDING, ReportStatus.UNDER_REVIEW])
        ).first()
        if existing_pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A back job request for this job is already pending review"
            )
    
    # Create report
    report = Report(
        reporter_id=current_user.id,
        reporter_role=active_role,
        report_type=report_type,
        title=report_data.title,
        reason=report_data.reason,
        description=report_data.description,
        post_id=report_data.post_id,
        reported_user_id=report_data.reported_user_id,
        evidence_urls=json.dumps(report_data.evidence_urls) if report_data.evidence_urls else None,
        status=ReportStatus.PENDING
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {
        "message": "Report submitted successfully. Our team will review this case.",
        "report_id": report.report_id,
        "status": report.status.value
    }


@router.get("/my-reports", response_model=List[dict])
def get_my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all reports submitted by the current user"""
    
    reports = db.query(Report).filter(
        Report.reporter_id == current_user.id
    ).order_by(Report.created_at.desc()).all()
    
    result = []
    for report in reports:
        evidence = []
        if report.evidence_urls:
            try:
                evidence = json.loads(report.evidence_urls)
            except:
                pass
        
        result.append({
            "report_id": report.report_id,
            "report_type": report.report_type.value,
            "title": report.title,
            "description": report.description,
            "post_id": report.post_id,
            "reported_user_id": report.reported_user_id,
            "evidence_urls": evidence,
            "status": report.status.value,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "resolution": report.resolution
        })
    
    return result


class RestrictUserRequest(BaseModel):
    """Request body for restricting a user"""
    restriction_days: Optional[int] = None  # None = permanent restriction
    reason: str


@router.post("/admin/restrict-user/{user_id}")
def restrict_user(
    user_id: int,
    restriction_data: RestrictUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Restrict a user (admin only)
    
    Args:
        user_id: ID of the user to restrict
        restriction_data: Restriction details including days and reason
    
    Returns:
        Success message with restriction details
    """
    # TODO: Add proper admin role check
    # For now, allowing any user (will be restricted by admin panel access)
    
    # Get the user to restrict
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Calculate restriction dates
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    restriction_end = None
    
    if restriction_data.restriction_days:
        restriction_end = now + timedelta(days=restriction_data.restriction_days)
    
    # Apply restriction
    target_user.is_restricted = True
    target_user.restriction_reason = restriction_data.reason
    target_user.restriction_start = now
    target_user.restriction_end = restriction_end
    target_user.restricted_by_admin_id = current_user.id
    
    db.commit()
    
    restriction_type = f"{restriction_data.restriction_days} days" if restriction_data.restriction_days else "permanent"
    
    return {
        "message": f"User {target_user.first_name} {target_user.last_name} has been restricted for {restriction_type}",
        "user_id": user_id,
        "restriction_end": restriction_end.isoformat() if restriction_end else None,
        "reason": restriction_data.reason
    }


@router.post("/admin/unrestrict-user/{user_id}")
def unrestrict_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove restriction from a user (admin only)"""
    # TODO: Add proper admin role check
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not target_user.is_restricted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not currently restricted"
        )
    
    # Remove restriction
    target_user.is_restricted = False
    target_user.restriction_reason = None
    target_user.restriction_start = None
    target_user.restriction_end = None
    target_user.restricted_by_admin_id = None
    
    db.commit()
    
    return {
        "message": f"Restriction lifted for user {target_user.first_name} {target_user.last_name}",
        "user_id": user_id
    }


@router.post("/admin/warn-user/{user_id}")
def warn_user(
    user_id: int,
    warning_message: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a warning to a user (admin only)
    
    This creates a notification for the user about the warning
    """
    # TODO: Add proper admin role check
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Send warning notification
    from app.services.notification_service import notify_user
    from app.models_v2.notification import NotificationType
    
    try:
        notify_user(
            db=db,
            user_id=user_id,
            notification_type=NotificationType.SYSTEM,
            title="⚠️ Warning from Administration",
            message=warning_message,
            reference_type="warning",
            reference_id=None
        )
    except Exception as e:
        print(f"Error sending warning notification: {e}")
    
    return {
        "message": f"Warning sent to user {target_user.first_name} {target_user.last_name}",
        "user_id": user_id
    }


@router.get("/{report_id}")
def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific report (only if you're the reporter or an admin)"""
    
    report = db.query(Report).filter(Report.report_id == report_id).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Check access - only reporter or admin can view
    if report.reporter_id != current_user.id:
        # TODO: Check if user is admin
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this report"
        )
    
    evidence = []
    if report.evidence_urls:
        try:
            evidence = json.loads(report.evidence_urls)
        except:
            pass
    
    return {
        "report_id": report.report_id,
        "reporter_role": report.reporter_role,
        "report_type": report.report_type.value,
        "title": report.title,
        "description": report.description,
        "post_id": report.post_id,
        "reported_user_id": report.reported_user_id,
        "evidence_urls": evidence,
        "status": report.status.value,
        "admin_notes": report.admin_notes,
        "resolution": report.resolution,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "resolved_at": report.resolved_at.isoformat() if report.resolved_at else None
    }


# Admin endpoints (for future use)
@router.get("/admin/all", response_model=List[dict])
def get_all_reports_admin(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all reports (admin only) - for future admin panel"""
    
    # TODO: Add admin role check
    # For now, this is just prepared for future use
    
    query = db.query(Report)
    
    if status_filter:
        try:
            filter_status = ReportStatus(status_filter)
            query = query.filter(Report.status == filter_status)
        except ValueError:
            pass
    
    reports = query.order_by(Report.created_at.desc()).all()
    
    result = []
    for report in reports:
        evidence = []
        if report.evidence_urls:
            try:
                evidence = json.loads(report.evidence_urls)
            except:
                pass
        
        # Get reporter info
        reporter = db.query(User).filter(User.id == report.reporter_id).first()
        
        result.append({
            "report_id": report.report_id,
            "reporter": {
                "id": reporter.id if reporter else None,
                "name": f"{reporter.first_name} {reporter.last_name}" if reporter else "Unknown",
                "role": report.reporter_role
            },
            "report_type": report.report_type.value,
            "title": report.title,
            "description": report.description,
            "post_id": report.post_id,
            "reported_user_id": report.reported_user_id,
            "evidence_urls": evidence,
            "status": report.status.value,
            "created_at": report.created_at.isoformat() if report.created_at else None
        })
    
    return result
