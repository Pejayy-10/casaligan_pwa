from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models_v2.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/debug", tags=["debug"])


@router.delete("/clear-jobs")
def clear_all_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all job posts and related data (keep users)"""
    try:
        from app.models_v2.forum import ForumPost, InterestCheck
        from app.models_v2.payment import PaymentSchedule, PaymentTransaction, CheckIn
        from app.models_v2.contract import Contract
        
        # Delete in order to respect foreign keys
        db.query(CheckIn).delete()
        db.query(PaymentTransaction).delete()
        db.query(PaymentSchedule).delete()
        db.query(Contract).delete()
        db.query(InterestCheck).delete()
        db.query(ForumPost).delete()
        
        db.commit()
        
        return {"message": "All jobs and related data cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear data: {str(e)}")


@router.delete("/clear-payments")
def clear_all_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all payment schedules and transactions"""
    try:
        from app.models_v2.payment import PaymentSchedule, PaymentTransaction
        
        db.query(PaymentTransaction).delete()
        db.query(PaymentSchedule).delete()
        
        db.commit()
        
        return {"message": "All payment data cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear payments: {str(e)}")


@router.delete("/clear-contracts")
def clear_all_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all contracts"""
    try:
        from app.models_v2.contract import Contract
        
        db.query(Contract).delete()
        
        db.commit()
        
        return {"message": "All contracts cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear contracts: {str(e)}")


@router.delete("/clear-checkins")
def clear_all_checkins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all check-ins"""
    try:
        from app.models_v2.payment import CheckIn
        
        db.query(CheckIn).delete()
        
        db.commit()
        
        return {"message": "All check-ins cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear check-ins: {str(e)}")
