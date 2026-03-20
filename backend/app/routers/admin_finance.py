from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models_v2.admin import Admin
from app.models_v2.direct_hire import DirectHire
from app.models_v2.forum import ForumPost
from app.models_v2.user import User
from app.security import get_current_user
from app.utils.platform_fees import (
    get_platform_fee_settings,
    update_platform_fee_settings,
)

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])


class PlatformFeeSettingsResponse(BaseModel):
    post_fee_percentage: float
    direct_hire_fee_percentage: float


class PlatformFeeSettingsUpdateRequest(BaseModel):
    post_fee_percentage: float = Field(ge=0, le=100)
    direct_hire_fee_percentage: float = Field(ge=0, le=100)


class RevenueSummaryResponse(BaseModel):
    post_fees_revenue: float
    direct_hire_fees_revenue: float
    total_platform_wallet: float


class AdminFinanceOverviewResponse(BaseModel):
    settings: PlatformFeeSettingsResponse
    revenue: RevenueSummaryResponse


def _require_admin(db: Session, user: User) -> None:
    admin = db.query(Admin).filter(Admin.user_id == user.id).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def _to_float(value) -> float:
    try:
        return float(Decimal(str(value or 0)).quantize(Decimal("0.01")))
    except Exception:
        return 0.0


@router.get("/settings", response_model=PlatformFeeSettingsResponse)
def get_fee_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(db, current_user)
    settings = get_platform_fee_settings(db)
    return PlatformFeeSettingsResponse(
        post_fee_percentage=float(settings["post_fee_percentage"]),
        direct_hire_fee_percentage=float(settings["direct_hire_fee_percentage"]),
    )


@router.put("/settings", response_model=PlatformFeeSettingsResponse)
def update_fee_settings(
    payload: PlatformFeeSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(db, current_user)
    settings = update_platform_fee_settings(
        db,
        post_fee_percentage=payload.post_fee_percentage,
        direct_hire_fee_percentage=payload.direct_hire_fee_percentage,
    )
    db.commit()

    return PlatformFeeSettingsResponse(
        post_fee_percentage=float(settings["post_fee_percentage"]),
        direct_hire_fee_percentage=float(settings["direct_hire_fee_percentage"]),
    )


@router.get("/revenue-summary", response_model=RevenueSummaryResponse)
def get_revenue_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(db, current_user)

    post_fees = db.query(func.coalesce(func.sum(ForumPost.post_fee_amount), 0)).filter(
        func.lower(func.coalesce(ForumPost.post_fee_status, "pending")) == "paid"
    ).scalar()

    direct_hire_fees = db.query(func.coalesce(func.sum(DirectHire.platform_fee_amount), 0)).filter(
        func.lower(func.coalesce(DirectHire.platform_fee_status, "pending")) == "paid"
    ).scalar()

    post_fees_revenue = _to_float(post_fees)
    direct_hire_fees_revenue = _to_float(direct_hire_fees)

    return RevenueSummaryResponse(
        post_fees_revenue=post_fees_revenue,
        direct_hire_fees_revenue=direct_hire_fees_revenue,
        total_platform_wallet=round(post_fees_revenue + direct_hire_fees_revenue, 2),
    )


@router.get("/overview", response_model=AdminFinanceOverviewResponse)
def get_admin_finance_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(db, current_user)

    settings = get_platform_fee_settings(db)

    post_fees = db.query(func.coalesce(func.sum(ForumPost.post_fee_amount), 0)).filter(
        func.lower(func.coalesce(ForumPost.post_fee_status, "pending")) == "paid"
    ).scalar()

    direct_hire_fees = db.query(func.coalesce(func.sum(DirectHire.platform_fee_amount), 0)).filter(
        func.lower(func.coalesce(DirectHire.platform_fee_status, "pending")) == "paid"
    ).scalar()

    post_fees_revenue = _to_float(post_fees)
    direct_hire_fees_revenue = _to_float(direct_hire_fees)

    return AdminFinanceOverviewResponse(
        settings=PlatformFeeSettingsResponse(
            post_fee_percentage=float(settings["post_fee_percentage"]),
            direct_hire_fee_percentage=float(settings["direct_hire_fee_percentage"]),
        ),
        revenue=RevenueSummaryResponse(
            post_fees_revenue=post_fees_revenue,
            direct_hire_fees_revenue=direct_hire_fees_revenue,
            total_platform_wallet=round(post_fees_revenue + direct_hire_fees_revenue, 2),
        ),
    )
