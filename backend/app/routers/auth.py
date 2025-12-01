from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.db import get_db
from app.models_v2.user import User, UserStatus
from app.models_v2.address import Address
from app.models_v2.document import UserDocument
from app.models_v2.application import HousekeeperApplication, ApplicationStatus
from app.models_v2.worker_employer import Worker, Employer
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserResponse, UserProfileResponse
from app.schemas.address import AddressCreate, AddressResponse
from app.schemas.document import DocumentCreate, DocumentResponse
from app.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user
)
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user (Step 1: Account & Personal Info) and return access token"""
    
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if phone number already exists
    existing_phone = db.query(User).filter(User.phone_number == user_data.phone_number).first()
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    # Create new user - owners are active by default, housekeepers need approval
    db_user = User(
        email=user_data.email,
        phone_number=user_data.phone_number,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        middle_name=user_data.middle_name,
        last_name=user_data.last_name,
        suffix=user_data.suffix,
        status="active",  # Owners are active immediately
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Auto-create Employer record so users can post jobs immediately
    employer = Employer(user_id=db_user.id)
    db.add(employer)
    db.commit()
    
    # Generate access token for the new user
    access_token = create_access_token(data={"sub": db_user.email})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": db_user
    }

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login and get JWT token"""
    
    # Find user by email
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token (use email as subject, not user.id)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "active_role": user.active_role.value
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user's profile with address"""
    return current_user

@router.post("/register/address", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
def add_address(
    address_data: AddressCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add or update user's address (Step 2: Address)"""
    
    # Check if user already has an address
    existing_address = db.query(Address).filter(Address.user_id == current_user.id).first()
    
    if existing_address:
        # Update existing address
        for key, value in address_data.model_dump().items():
            setattr(existing_address, key, value)
        db.commit()
        db.refresh(existing_address)
        return existing_address
    else:
        # Create new address
        db_address = Address(
            user_id=current_user.id,
            **address_data.model_dump()
        )
        db.add(db_address)
        db.commit()
        db.refresh(db_address)
        return db_address

@router.post("/register/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    document_data: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document (Step 3: Documents)"""
    
    db_document = UserDocument(
        user_id=current_user.id,
        **document_data.model_dump()
    )
    
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    
    return db_document

@router.get("/documents", response_model=List[DocumentResponse])
def get_user_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all documents for the current user"""
    documents = db.query(UserDocument).filter(UserDocument.user_id == current_user.id).all()
    return documents

@router.post("/switch-role")
def switch_role(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Switch between owner and housekeeper roles"""
    
    if not current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not approved as a housekeeper"
        )
    
    # Toggle role - handle both string and enum values
    current_role = current_user.active_role
    if hasattr(current_role, 'value'):
        current_role = current_role.value
    
    if current_role == "owner":
        current_user.active_role = "housekeeper"
    else:
        current_user.active_role = "owner"
    
    db.commit()
    db.refresh(current_user)
    
    new_role = current_user.active_role
    if hasattr(new_role, 'value'):
        new_role = new_role.value
    
    return {"active_role": new_role, "message": f"Switched to {new_role} mode"}

# Housekeeper Application Schemas
class HousekeeperApplicationRequest(BaseModel):
    notes: Optional[str] = None

class HousekeeperApplicationResponse(BaseModel):
    id: int
    status: str
    notes: Optional[str]
    submitted_at: str
    reviewed_at: Optional[str]
    admin_notes: Optional[str]
    
    @classmethod
    def from_orm_model(cls, app: HousekeeperApplication):
        return cls(
            id=app.application_id,
            status=app.status.value,
            notes=app.notes,
            submitted_at=app.submitted_at.isoformat() if app.submitted_at else "",
            reviewed_at=app.reviewed_at.isoformat() if app.reviewed_at else None,
            admin_notes=app.admin_notes
        )

@router.post("/apply-housekeeper", response_model=HousekeeperApplicationResponse)
def apply_housekeeper(
    application_data: HousekeeperApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit application to become a housekeeper"""
    
    # Check if user already has an application
    existing_app = db.query(HousekeeperApplication).filter(
        HousekeeperApplication.user_id == current_user.id
    ).first()
    
    if existing_app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application already exists with status: {existing_app.status.value}"
        )
    
    # Check if user has uploaded required documents
    doc_count = db.query(UserDocument).filter(
        UserDocument.user_id == current_user.id
    ).count()
    
    if doc_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload at least one verification document before applying"
        )
    
    # Create application
    application = HousekeeperApplication(
        user_id=current_user.id,
        status=ApplicationStatus.PENDING,
        notes=application_data.notes
    )
    
    db.add(application)
    db.commit()
    db.refresh(application)
    
    # AUTO-APPROVE FOR DEMO: Simulate processing delay then auto-approve
    import time
    time.sleep(2)  # 2 second delay for demo
    
    application.status = ApplicationStatus.APPROVED
    current_user.is_housekeeper = True
    current_user.status = UserStatus.ACTIVE
    
    # Create Worker record
    worker = Worker(user_id=current_user.id)
    db.add(worker)
    
    db.commit()
    db.refresh(application)
    db.refresh(current_user)
    
    return HousekeeperApplicationResponse.from_orm_model(application)

@router.get("/application-status", response_model=Optional[HousekeeperApplicationResponse])
def get_application_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current housekeeper application status"""
    
    application = db.query(HousekeeperApplication).filter(
        HousekeeperApplication.user_id == current_user.id
    ).first()
    
    if application:
        return HousekeeperApplicationResponse.from_orm_model(application)
    return None

@router.post("/approve-application/{user_id}")
def approve_application(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Approve housekeeper application (for testing - no auth required)"""
    
    application = db.query(HousekeeperApplication).filter(
        HousekeeperApplication.user_id == user_id,
        HousekeeperApplication.status == ApplicationStatus.PENDING
    ).first()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending application found for this user"
        )
    
    # Update application
    application.status = ApplicationStatus.APPROVED
    application.reviewed_at = func.now()
    
    # Update user
    user = db.query(User).filter(User.id == user_id).first()
    user.is_housekeeper = True
    user.status = UserStatus.ACTIVE
    
    # Create Worker record if it doesn't exist
    from app.models_v2.worker_employer import Worker
    existing_worker = db.query(Worker).filter(Worker.user_id == user_id).first()
    if not existing_worker:
        worker = Worker(user_id=user_id)
        db.add(worker)
    
    # Create Employer record if it doesn't exist (users can be both)
    from app.models_v2.worker_employer import Employer
    existing_employer = db.query(Employer).filter(Employer.user_id == user_id).first()
    if not existing_employer:
        employer = Employer(user_id=user_id)
        db.add(employer)
    
    db.commit()
    
    return {"message": "Application approved successfully"}
