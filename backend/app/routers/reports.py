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
from app.models_v2.forum import ForumPost
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
