"""
Contract Extension endpoints
- Owner proposes an extension for an ongoing contract
- Worker accepts or rejects the extension
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List
import json

from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Employer, Worker
from app.models_v2.forum import ForumPost, ForumPostStatus
from app.models_v2.contract import Contract, ContractStatus
from app.models_v2.contract_extension import ContractExtension, ExtensionStatus
from app.security import get_current_user
from app.services.notification_service import (
    notify_contract_extension_proposed,
    notify_contract_extension_accepted,
    notify_contract_extension_rejected,
)

router = APIRouter(prefix="/contract-extensions", tags=["contract-extensions"])


# ---------- Pydantic Schemas ----------

class ProposeExtensionRequest(BaseModel):
    contract_id: int
    proposed_end_date: str        # ISO date string e.g. "2026-06-30"
    proposed_budget: Optional[float] = None
    reason: Optional[str] = None


class RespondExtensionRequest(BaseModel):
    accepted: bool


class ContractExtensionResponse(BaseModel):
    extension_id: int
    contract_id: int
    proposed_by: int
    proposed_by_name: Optional[str] = None
    proposed_end_date: str
    proposed_budget: Optional[float] = None
    reason: Optional[str] = None
    status: str
    responded_at: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Endpoints ----------

@router.post("/propose", status_code=status.HTTP_201_CREATED)
def propose_extension(
    payload: ProposeExtensionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Owner proposes a contract extension for an ongoing contract.
    Only the employer who owns the job can propose.
    Only contracts with status 'active' (ongoing) can be extended.
    """
    # Must be a houseowner
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only house owners can propose contract extensions"
        )

    # Get the contract
    contract = db.query(Contract).filter(Contract.contract_id == payload.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Contract must be active (ongoing)
    if contract.status != ContractStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Contract extensions can only be proposed for ongoing (active) contracts"
        )

    # Verify the current user is the employer of this contract
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer or employer.employer_id != contract.employer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the employer for this contract"
        )

    # Check if there's already a pending extension for this contract
    existing_pending = db.query(ContractExtension).filter(
        ContractExtension.contract_id == payload.contract_id,
        ContractExtension.status == ExtensionStatus.PENDING
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=400,
            detail="There is already a pending extension request for this contract. Wait for the housekeeper to respond."
        )

    # Create the extension
    extension = ContractExtension(
        contract_id=payload.contract_id,
        proposed_by=current_user.id,
        proposed_end_date=payload.proposed_end_date,
        proposed_budget=payload.proposed_budget,
        reason=payload.reason,
        status=ExtensionStatus.PENDING,
    )
    db.add(extension)
    db.commit()
    db.refresh(extension)

    # Notify the worker (non-fatal — extension is already saved)
    try:
        worker = db.query(Worker).filter(Worker.worker_id == contract.worker_id).first()
        if worker:
            worker_user = db.query(User).filter(User.id == worker.user_id).first()
            post = db.query(ForumPost).filter(ForumPost.post_id == contract.post_id).first()
            if worker_user and post:
                employer_name = f"{current_user.first_name} {current_user.last_name}"
                notify_contract_extension_proposed(
                    db=db,
                    worker_user_id=worker_user.id,
                    employer_name=employer_name,
                    job_title=post.title,
                    new_end_date=payload.proposed_end_date,
                    post_id=post.post_id
                )
    except Exception as e:
        print(f"Warning: Failed to send extension notification: {e}")
        db.rollback()

    return {
        "message": "Contract extension proposed successfully",
        "extension_id": extension.extension_id,
        "status": "pending"
    }


@router.put("/{extension_id}/respond")
def respond_to_extension(
    extension_id: int,
    payload: RespondExtensionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Worker accepts or rejects a contract extension.
    Only the worker on the contract can respond.
    """
    # Must be a housekeeper
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can respond to contract extensions"
        )

    # Get the extension
    extension = db.query(ContractExtension).filter(
        ContractExtension.extension_id == extension_id
    ).first()
    if not extension:
        raise HTTPException(status_code=404, detail="Extension request not found")

    if extension.status != ExtensionStatus.PENDING:
        raise HTTPException(status_code=400, detail="This extension request has already been responded to")

    # Get the contract
    contract = db.query(Contract).filter(Contract.contract_id == extension.contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Verify the current user is the worker on this contract
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker or worker.worker_id != contract.worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the worker on this contract"
        )

    now = datetime.now(timezone.utc)

    if payload.accepted:
        # Accept the extension
        extension.status = ExtensionStatus.ACCEPTED
        extension.responded_at = now
        extension.updated_at = now

        # Update the job post's end_date
        post = db.query(ForumPost).filter(ForumPost.post_id == contract.post_id).first()
        if post:
            post.end_date = extension.proposed_end_date
            post.updated_at = now

            # Update budget if proposed
            if extension.proposed_budget is not None:
                post.salary = extension.proposed_budget

            # Also update the JSON content field so end_date stays in sync
            if post.content and post.content.startswith('{'):
                try:
                    content_data = json.loads(post.content)
                    content_data["end_date"] = extension.proposed_end_date
                    if extension.proposed_budget is not None:
                        content_data["budget"] = float(extension.proposed_budget)
                    post.content = json.dumps(content_data)
                except (json.JSONDecodeError, TypeError):
                    pass

            # Also update contract_terms if they contain end_date
            if contract.contract_terms:
                try:
                    terms = json.loads(contract.contract_terms)
                    terms["end_date"] = extension.proposed_end_date
                    if extension.proposed_budget is not None:
                        terms["budget"] = float(extension.proposed_budget)
                    contract.contract_terms = json.dumps(terms)
                except (json.JSONDecodeError, TypeError):
                    pass

            contract.updated_at = now

        db.commit()

        # Notify the employer (non-fatal — extension already accepted)
        try:
            employer = db.query(Employer).filter(Employer.employer_id == contract.employer_id).first()
            if employer and post:
                employer_user = db.query(User).filter(User.id == employer.user_id).first()
                if employer_user:
                    worker_name = f"{current_user.first_name} {current_user.last_name}"
                    notify_contract_extension_accepted(
                        db=db,
                        employer_user_id=employer_user.id,
                        worker_name=worker_name,
                        job_title=post.title,
                        post_id=post.post_id
                    )
        except Exception as e:
            print(f"Warning: Failed to send extension accepted notification: {e}")
            db.rollback()

        return {"message": "Contract extension accepted. The contract end date has been updated.", "status": "accepted"}
    else:
        # Reject the extension
        extension.status = ExtensionStatus.REJECTED
        extension.responded_at = now
        extension.updated_at = now

        db.commit()

        # Notify the employer (non-fatal — rejection already saved)
        try:
            post = db.query(ForumPost).filter(ForumPost.post_id == contract.post_id).first()
            employer = db.query(Employer).filter(Employer.employer_id == contract.employer_id).first()
            if employer and post:
                employer_user = db.query(User).filter(User.id == employer.user_id).first()
                if employer_user:
                    worker_name = f"{current_user.first_name} {current_user.last_name}"
                    notify_contract_extension_rejected(
                        db=db,
                        employer_user_id=employer_user.id,
                        worker_name=worker_name,
                        job_title=post.title,
                        post_id=post.post_id
                    )
        except Exception as e:
            print(f"Warning: Failed to send extension rejected notification: {e}")
            db.rollback()

        return {"message": "Contract extension declined.", "status": "rejected"}


@router.get("/contract/{contract_id}", response_model=List[ContractExtensionResponse])
def get_extensions_for_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all extension requests for a contract.
    Both the employer and the worker on the contract can view.
    """
    contract = db.query(Contract).filter(Contract.contract_id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Verify the user is either the employer or the worker
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()

    is_employer = employer and employer.employer_id == contract.employer_id
    is_worker = worker and worker.worker_id == contract.worker_id

    if not is_employer and not is_worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a party to this contract"
        )

    extensions = db.query(ContractExtension).filter(
        ContractExtension.contract_id == contract_id
    ).order_by(desc(ContractExtension.created_at)).all()

    result = []
    for ext in extensions:
        proposer = db.query(User).filter(User.id == ext.proposed_by).first()
        result.append(ContractExtensionResponse(
            extension_id=ext.extension_id,
            contract_id=ext.contract_id,
            proposed_by=ext.proposed_by,
            proposed_by_name=f"{proposer.first_name} {proposer.last_name}" if proposer else None,
            proposed_end_date=ext.proposed_end_date,
            proposed_budget=float(ext.proposed_budget) if ext.proposed_budget else None,
            reason=ext.reason,
            status=ext.status.value if hasattr(ext.status, 'value') else str(ext.status),
            responded_at=ext.responded_at.isoformat() if ext.responded_at else None,
            created_at=ext.created_at.isoformat() if ext.created_at else None,
        ))

    return result


@router.get("/my-pending")
def get_my_pending_extensions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all pending extension requests for the current worker.
    Used by housekeeper to see extensions they need to respond to.
    """
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only housekeepers can view pending extension requests"
        )

    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        return []

    # Find all active contracts for this worker
    active_contracts = db.query(Contract).filter(
        Contract.worker_id == worker.worker_id,
        Contract.status == ContractStatus.ACTIVE
    ).all()

    if not active_contracts:
        return []

    contract_ids = [c.contract_id for c in active_contracts]

    # Get pending extensions for these contracts
    pending_extensions = db.query(ContractExtension).filter(
        ContractExtension.contract_id.in_(contract_ids),
        ContractExtension.status == ExtensionStatus.PENDING
    ).order_by(desc(ContractExtension.created_at)).all()

    result = []
    for ext in pending_extensions:
        contract = next((c for c in active_contracts if c.contract_id == ext.contract_id), None)
        post = db.query(ForumPost).filter(ForumPost.post_id == contract.post_id).first() if contract else None
        proposer = db.query(User).filter(User.id == ext.proposed_by).first()

        result.append({
            "extension_id": ext.extension_id,
            "contract_id": ext.contract_id,
            "post_id": contract.post_id if contract else None,
            "job_title": post.title if post else "Unknown",
            "current_end_date": post.end_date if post else None,
            "proposed_end_date": ext.proposed_end_date,
            "proposed_budget": float(ext.proposed_budget) if ext.proposed_budget else None,
            "reason": ext.reason,
            "proposed_by_name": f"{proposer.first_name} {proposer.last_name}" if proposer else None,
            "status": ext.status.value if hasattr(ext.status, 'value') else str(ext.status),
            "created_at": ext.created_at.isoformat() if ext.created_at else None,
        })

    return result
