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
import google.generativeai as genai
import httpx
import os
import json
import re
import base64
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def verify_document_with_ai(file_path: str, document_type: str, first_name: str, last_name: str) -> dict:
    """Use Gemini Vision to automatically verify a user document.
    file_path may be a Supabase public URL or a legacy local path.
    """
    if not GEMINI_API_KEY:
        return {"status": "pending", "notes": "Pending admin review.", "rejection_reason": None}

    try:
        # Strip trailing ? that Supabase appends to public URLs
        clean_path = file_path.rstrip('?').rstrip('&')

        # Determine MIME type from the URL/path extension
        suffix = Path(clean_path.split('?')[0]).suffix.lower()
        mime_map = {'.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif'}
        mime_type = mime_map.get(suffix, 'image/jpeg')

        # Fetch file bytes — support both remote URLs and legacy local paths
        if clean_path.startswith('http://') or clean_path.startswith('https://'):
            with httpx.Client(timeout=30) as client:
                resp = client.get(clean_path)
                resp.raise_for_status()
                file_bytes = resp.content
        else:
            full_path = Path(clean_path.lstrip('/'))
            if not full_path.exists():
                return {"status": "pending", "notes": "Pending admin review.", "rejection_reason": None}
            file_bytes = full_path.read_bytes()

        # google-generativeai SDK requires base64-encoded string for inline image data
        file_b64 = base64.b64encode(file_bytes).decode('utf-8')

        model = genai.GenerativeModel('gemini-2.5-flash')
        doc_label = document_type.replace('_', ' ').title()

        prompt = f"""You are a strict document verification officer for Casaligan, a Philippine housekeeping platform.
You must carefully analyze the uploaded image and return ONLY valid JSON — no extra text.

Expected document type: {doc_label}
Registrant name: {first_name} {last_name}

You MUST assess:
1. Is this actually a government-issued or official document? (NOT a photo of a building, person, food, scenery, screenshot, blank paper, or anything else)
2. Is the document legible — text is readable, not blurry, not cut off, not obstructed?
3. Does the name on the document closely match "{first_name} {last_name}"?
4. Is the document expired? (check visible expiry date if any)
5. Does the document type match "{doc_label}"? For Philippine documents this includes:
   - national_id = PhilSys National ID
   - drivers_license = LTO Driver's License
   - passport = Philippine Passport
   - sss_id = SSS / UMID
   - philhealth_id = PhilHealth ID
   - voters_id = COMELEC Voter's ID
   - postal_id = Philippine Postal ID
   - tin_id = BIR TIN ID
   - prc_id = PRC Professional ID
   - barangay_id = Barangay ID or Clearance
   If the uploaded document is a completely different type, set correct_type to false.

BE STRICT:
- If it is NOT a document (random photo, selfie, building, meme, etc.) → is_legitimate: false, confidence: 0
- If text is unreadable → is_legible: false
- If wrong document type → correct_type: false

Return ONLY this JSON:
{{
  "is_legitimate": true,
  "is_legible": true,
  "name_matches": true,
  "is_expired": false,
  "correct_type": true,
  "confidence": 90,
  "notes": "brief summary of what was found",
  "rejection_reason": null
}}"""

        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": file_b64}
        ])

        text = response.text.strip()
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        result = json.loads(text)

        confidence = int(result.get("confidence", 0))
        is_legit = result.get("is_legitimate", False)
        is_legible = result.get("is_legible", False)
        is_expired = result.get("is_expired", False)
        correct_type = result.get("correct_type", True)  # False = wrong document type uploaded

        if confidence >= 85 and is_legit and is_legible and not is_expired and correct_type:
            return {
                "status": "approved",
                "notes": f"AI verified ({confidence}% confidence): {result.get('notes', 'Document looks valid.')}",
                "rejection_reason": None
            }
        elif not is_legit or not is_legible or is_expired or confidence < 50 or not correct_type:
            reason = result.get("rejection_reason") or result.get("notes", "Document failed verification.")
            if not correct_type:
                reason = f"Wrong document type. Expected: {doc_label}. {reason}"
            return {
                "status": "rejected",
                "notes": f"AI rejected ({confidence}% confidence): {result.get('notes', '')}",
                "rejection_reason": reason
            }
        else:
            return {
                "status": "pending",
                "notes": f"AI review ({confidence}% confidence): {result.get('notes', 'Requires admin review.')}",
                "rejection_reason": None
            }

    except Exception as e:
        logger.error(f"AI document verification failed: {type(e).__name__}: {e}")
        return {"status": "pending", "notes": "Pending admin review.", "rejection_reason": None}


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
        gender=user_data.gender,
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

@router.post("/update-address-gps")
def update_address_gps(
    latitude: float,
    longitude: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update GPS coordinates for current user's address
    
    This endpoint allows users to update their address GPS coordinates
    for location-based services. Useful when users want to enable GPS
    location search.
    """
    address = db.query(Address).filter(Address.user_id == current_user.id).first()
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found. Please add an address first."
        )
    
    address.latitude = latitude
    address.longitude = longitude
    db.commit()
    db.refresh(address)
    
    return {
        "message": "GPS coordinates updated successfully",
        "address": {
            "address_id": address.address_id,
            "city": address.city_name,
            "province": address.province_name,
            "barangay": address.barangay_name,
            "latitude": address.latitude,
            "longitude": address.longitude
        }
    }


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

    # Run AI verification
    ai_result = verify_document_with_ai(
        file_path=db_document.file_path,
        document_type=db_document.document_type,
        first_name=current_user.first_name,
        last_name=current_user.last_name
    )
    db_document.status = ai_result["status"]
    db_document.notes = ai_result["notes"]
    if ai_result["rejection_reason"]:
        db_document.rejection_reason = ai_result["rejection_reason"]
    if ai_result["status"] in ("approved", "rejected"):
        db_document.reviewed_at = datetime.utcnow()
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
    
    # Application stays as PENDING - admin must approve via verification page
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


@router.get("/analytics")
def get_user_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard analytics for the current user based on their active role"""
    from app.models_v2.forum import ForumPost, InterestCheck
    from app.models_v2.contract import Contract, ContractStatus
    from app.models_v2.conversation import Conversation
    from app.models_v2.rating import Rating
    from app.models_v2.worker_employer import Worker, Employer
    from sqlalchemy import and_, or_
    
    analytics = {}
    
    if current_user.active_role == 'owner':
        # Get or create employer record
        employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
        if not employer:
            employer = Employer(user_id=current_user.id)
            db.add(employer)
            db.commit()
            db.refresh(employer)
        employer_id = employer.employer_id
        
        # Jobs Posted (count all posts by this employer)
        jobs_posted = db.query(ForumPost).filter(
            ForumPost.employer_id == employer_id,
            ForumPost.deleted_at.is_(None)
        ).count()
        
        # Messages (conversations where user is a participant)
        messages = db.query(Conversation).filter(
            Conversation.participant_ids.contains([current_user.id])
        ).count()
        
        # Reviews received (count ratings where this user is the target)
        reviews = db.query(Rating).filter(
            Rating.target_user_id == current_user.id,
            Rating.deleted_at.is_(None)
        ).count()
        
        # Completed Jobs (count contracts where employer has completed jobs)
        completed_jobs = db.query(Contract).filter(
            Contract.employer_id == employer_id,
            Contract.status == ContractStatus.COMPLETED
        ).count()
        
        analytics = {
            "jobs_posted": jobs_posted,
            "messages": messages,
            "reviews": reviews,
            "completed_jobs": completed_jobs
        }
    
    else:  # housekeeper
        # Get or create worker record
        worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
        if not worker:
            worker = Worker(user_id=current_user.id)
            db.add(worker)
            db.commit()
            db.refresh(worker)
        worker_id = worker.worker_id
        
        # Jobs Applied (count interest checks submitted by this worker)
        jobs_applied = db.query(InterestCheck).filter(
            InterestCheck.worker_id == worker_id
        ).count()
        
        # Messages (conversations where user is a participant)
        messages = db.query(Conversation).filter(
            Conversation.participant_ids.contains([current_user.id])
        ).count()
        
        # Reviews received (count ratings where this user is the target)
        reviews = db.query(Rating).filter(
            Rating.target_user_id == current_user.id,
            Rating.deleted_at.is_(None)
        ).count()
        
        # Total Earnings (sum of completed and paid contracts)
        total_earnings = 0
        completed_contracts = db.query(Contract).filter(
            Contract.worker_id == worker_id,
            Contract.status == ContractStatus.COMPLETED,
            Contract.paid_at.isnot(None)
        ).all()
        
        # Calculate earnings from contract_terms JSON
        import json
        for contract in completed_contracts:
            if contract.contract_terms:
                try:
                    terms = json.loads(contract.contract_terms)
                    # Handle both budget and payment_amount fields
                    amount = terms.get('budget') or terms.get('payment_amount') or 0
                    total_earnings += float(amount)
                except:
                    pass
        
        analytics = {
            "jobs_applied": jobs_applied,
            "messages": messages,
            "reviews": reviews,
            "total_earnings": total_earnings
        }
    
    return analytics
