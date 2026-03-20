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
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserProfileResponse
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
import secrets
# smtplib removed — Render blocks outbound SMTP; using Resend HTTP API instead
from pathlib import Path
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ─── Email OTP Store ──────────────────────────────────────────────────────────
# In-memory store: { user_id: { "otp": "123456", "expires_at": datetime } }
# OTPs expire in 10 minutes. Safe for this use-case since they're short-lived.
_otp_store: dict = {}

# ─── Password-Reset OTP Store ─────────────────────────────────────────────────
# Keyed by email (user is NOT authenticated when resetting password)
# { email: { "otp": "123456", "expires_at": datetime, "user_id": int } }
_password_reset_store: dict = {}

OTP_EXPIRY_MINUTES = 10


def _extract_json_payload(text: str) -> dict:
    """Extract and parse JSON object from LLM text output."""
    cleaned = text.strip()
    cleaned = re.sub(r'^```json\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^```\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end != -1 and end > start:
        return json.loads(cleaned[start:end + 1])

    raise ValueError("No JSON object found in model output")


def _run_gemini_document_check(model_name: str, prompt: str, mime_type: str, file_b64: str) -> dict:
    """Run a Gemini vision model and return parsed JSON result."""
    model = genai.GenerativeModel(model_name)
    response = model.generate_content([
        prompt,
        {"mime_type": mime_type, "data": file_b64}
    ])
    text = (response.text or "").strip()
    if not text:
        raise ValueError("Empty response from Gemini")
    return _extract_json_payload(text)

# Email via Brevo HTTP API (https://brevo.com) — works on Render free tier
# SMTP was blocked by Render (OSError 101). Brevo uses HTTPS port 443.
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
FROM_EMAIL    = os.getenv("FROM_EMAIL", "startapp.casaligan@gmail.com")

# ─── Phone OTP Store (Android SMS Gateway) ────────────────────────────────────
# In-memory store: { user_id: { "otp": "123456", "expires_at": datetime } }
_phone_otp_store: dict = {}

# Android SMS Gateway (sms-gate.app) — free, uses your own phone's SIM
# Local: set SMS_GATEWAY_URL to http://192.168.x.x:8080/api/v1
# Cloud relay: set to https://api.sms-gate.app/3rdparty/v1


def _normalize_ph_number(phone: str) -> str:
    """Normalize a Philippine phone number to E.164 format (e.g. +639XXXXXXXXX)."""
    cleaned = ''.join(c for c in phone if c.isdigit())
    if cleaned.startswith('63') and len(cleaned) == 12:
        return '+' + cleaned
    if cleaned.startswith('0') and len(cleaned) == 11:
        return '+63' + cleaned[1:]
    return '+' + cleaned


def _send_phone_otp_sms(phone_number: str, otp: str, first_name: str) -> bool:
    """Send a 6-digit OTP via Android SMS Gateway. Returns True on success."""
    # Read env vars at call time so they're never frozen as empty at import time
    gateway_url      = os.getenv("SMS_GATEWAY_URL", "")
    gateway_user     = os.getenv("SMS_GATEWAY_USER", "")
    gateway_password = os.getenv("SMS_GATEWAY_PASSWORD", "")

    if not gateway_url or not gateway_user or not gateway_password:
        logger.warning("SMS_GATEWAY_URL/USER/PASSWORD not configured — skipping SMS send.")
        return False
    try:
        normalized = _normalize_ph_number(phone_number)
        message = (
            f"Your Casaligan verification code is: {otp}. "
            f"Valid for {OTP_EXPIRY_MINUTES} minutes. Do not share this with anyone."
        )
        # sms-gate.app API endpoint
        url = gateway_url.rstrip('/') + '/message'
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                url,
                auth=(gateway_user, gateway_password),
                json={"phoneNumbers": [normalized], "message": message},
            )
        if resp.status_code in (200, 201, 202):
            logger.info(f"Phone OTP SMS sent to {normalized} via Android SMS Gateway")
            return True
        logger.error(f"SMS Gateway error {resp.status_code}: {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Failed to send phone OTP SMS: {type(e).__name__}: {e}")
        return False


def _build_otp_email_html(otp: str, first_name: str) -> str:
    """Build a professionally designed HTML email for OTP verification."""
    # Render each OTP digit as its own styled box
    digit_boxes = "".join(
        f'<td style="padding:0 5px;">'
        f'<div style="width:52px;height:64px;line-height:64px;text-align:center;'
        f'background:#ffffff;border:2px solid #E8D5E8;border-radius:12px;'
        f'font-size:36px;font-weight:900;color:#4B244A;'
        f'font-family:\'Courier New\',monospace;'
        f'box-shadow:0 4px 12px rgba(75,36,74,0.10);">{d}</div>'
        f'</td>'
        for d in otp
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Verify your Casaligan account</title>
</head>
<body style="margin:0;padding:0;background:#F0EBF4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EBF4;padding:48px 16px;">
  <tr>
    <td align="center">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:24px;
                    overflow:hidden;box-shadow:0 12px 48px rgba(75,36,74,0.14);">

        <!-- ═══ HEADER ═══ -->
        <tr>
          <td style="background:linear-gradient(150deg,#4B244A 0%,#7B3F7A 50%,#EA526F 100%);
                     padding:52px 40px 44px;text-align:center;position:relative;">

            <!-- Logo mark -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
              <tr>
                <td align="center"
                    style="width:68px;height:68px;background:rgba(255,255,255,0.18);
                           border-radius:20px;border:2px solid rgba(255,255,255,0.30);">
                  <span style="font-size:34px;line-height:68px;">🏠</span>
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 6px;color:#ffffff;font-size:32px;font-weight:800;
                       letter-spacing:-0.5px;">Casaligan</h1>
            <p style="margin:0;color:rgba(255,255,255,0.70);font-size:13px;
                      letter-spacing:2.5px;text-transform:uppercase;font-weight:500;">
              Trusted Housekeeping Platform
            </p>

            <!-- Decorative arc at bottom of header -->
            <div style="position:absolute;bottom:-1px;left:0;right:0;height:28px;
                        background:#ffffff;border-radius:50% 50% 0 0 / 100% 100% 0 0;">
            </div>
          </td>
        </tr>

        <!-- ═══ BODY ═══ -->
        <tr>
          <td style="padding:44px 48px 36px;">

            <!-- Greeting -->
            <p style="margin:0 0 6px;color:#EA526F;font-size:13px;font-weight:700;
                      text-transform:uppercase;letter-spacing:2px;">Email Verification</p>
            <h2 style="margin:0 0 16px;color:#2D1A2D;font-size:24px;font-weight:800;
                       line-height:1.3;">
              Hi {first_name}, let's confirm<br/>your email address 👋
            </h2>
            <p style="margin:0 0 32px;color:#6B5B6E;font-size:15px;line-height:1.7;">
              Enter the 6-digit code below in the Casaligan app to verify your account.
              This code expires in <strong style="color:#4B244A;">{OTP_EXPIRY_MINUTES} minutes</strong>.
            </p>

            <!-- OTP Digit Boxes -->
            <table cellpadding="0" cellspacing="0"
                   style="margin:0 auto 12px;background:linear-gradient(135deg,#FDF5FF,#FFF0F3);
                          border-radius:20px;padding:28px 24px;">
              <tr>
                <td>
                  <p style="margin:0 0 20px;text-align:center;color:#9C7FA0;font-size:11px;
                             font-weight:700;letter-spacing:3px;text-transform:uppercase;">
                    Your one-time code
                  </p>
                  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>{digit_boxes}</tr>
                  </table>
                  <p style="margin:18px 0 0;text-align:center;color:#C0A8C4;font-size:12px;">
                    ⏱ Valid for {OTP_EXPIRY_MINUTES} minutes only
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ═══ SECURITY NOTICE ═══ -->
        <tr>
          <td style="padding:0 48px 32px;">
            <table cellpadding="0" cellspacing="0" width="100%"
                   style="background:#FFF8F0;border:1px solid #F5DFC0;border-radius:14px;
                          overflow:hidden;">
              <tr>
                <td style="width:6px;background:linear-gradient(180deg,#F0A500,#EA526F);">
                </td>
                <td style="padding:16px 18px;">
                  <p style="margin:0;color:#7A5500;font-size:13px;line-height:1.6;">
                    <strong>🔒 Security reminder:</strong> Never share this code with anyone.
                    Casaligan staff will <em>never</em> ask for your verification code.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ IGNORE NOTICE ═══ -->
        <tr>
          <td style="padding:0 48px 40px;">
            <p style="margin:0;color:#B0A0B4;font-size:13px;line-height:1.6;text-align:center;">
              Didn't request this? You can safely ignore this email.<br/>
              Your account won't be created without completing verification.
            </p>
          </td>
        </tr>

        <!-- ═══ DIVIDER ═══ -->
        <tr>
          <td style="padding:0 40px;">
            <hr style="border:none;border-top:1px solid #F0EBF0;margin:0;"/>
          </td>
        </tr>

        <!-- ═══ FOOTER ═══ -->
        <tr>
          <td style="padding:24px 40px 36px;text-align:center;">
            <p style="margin:0 0 4px;color:#4B244A;font-size:14px;font-weight:700;">Casaligan</p>
            <p style="margin:0 0 10px;color:#C0B0C4;font-size:12px;">
              Zamboanga City, Philippines
            </p>
            <p style="margin:0;color:#D0C0D4;font-size:11px;">
              © 2026 Casaligan. All rights reserved.<br/>
              This is an automated message — please do not reply.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td>
  </tr>
</table>

</body>
</html>"""


def _send_otp_email(to_email: str, otp: str, first_name: str) -> bool:
    """Send the OTP verification email via Brevo HTTP API. Returns True on success."""
    brevo_api_key = os.getenv("BREVO_API_KEY", "")
    from_email    = os.getenv("FROM_EMAIL", "startapp.casaligan@gmail.com")
    if not brevo_api_key:
        logger.warning("BREVO_API_KEY not configured — skipping email send.")
        return False
    try:
        plain_text = (
            f"Hi {first_name},\n\n"
            f"Your Casaligan email verification code is: {otp}\n\n"
            f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
            "If you did not create an account, please ignore this email.\n\n"
            "— The Casaligan Team"
        )
        payload = {
            "sender": {"name": "Casaligan", "email": from_email},
            "to": [{"email": to_email}],
            "subject": f"{otp} is your Casaligan verification code",
            "textContent": plain_text,
            "htmlContent": _build_otp_email_html(otp, first_name),
        }
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": brevo_api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if resp.status_code in (200, 201):
            logger.info(f"OTP email sent to {to_email} via Brevo")
            return True
        logger.error(f"Brevo error {resp.status_code}: {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Failed to send OTP email to {to_email}: {type(e).__name__}: {e}")
        return False




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

        doc_label = document_type.replace('_', ' ').title()

        prompt = f"""You are a strict document verification officer for Casaligan, a Philippine housekeeping platform.
You must carefully analyze the uploaded image and return ONLY valid JSON — no extra text.

Expected document type: {doc_label}
Registrant name: {first_name} {last_name}

You MUST assess ALL of the following:

1. IS IT A DOCUMENT AT ALL?
   - Must be a real government-issued or official document.
   - If it is a photo of a building, a person, food, scenery, a meme, a social media post, a chat screenshot, an app screenshot, or anything that is NOT a document → is_legitimate: false, confidence: 0.

2. IS IT A DIRECT PHOTO OR A SCREENSHOT?
   - REJECT if the image shows a document displayed on a phone/tablet/computer screen (visible status bar, browser chrome, app UI, device bezels, or screen glare around the document).
   - REJECT if it is a photo of another photo of a document (printed or on screen).
   - Only ACCEPT if the document was photographed directly — the physical card/paper fills most of the frame with no surrounding device UI.
   - Set is_screenshot: true and is_legitimate: false if it appears to be shown on a screen.

3. IS IT LEGIBLE?
   - Text must be readable. Blurry, heavily cropped, or obstructed documents → is_legible: false.

4. NAME MATCH?
   - Does the name on the document closely match "{first_name} {last_name}"?
   - Set name_matches: false if name is clearly different or unreadable.

5. IS IT EXPIRED?
   - Check visible expiry date. Set is_expired: true if expired.

6. IS IT THE CORRECT DOCUMENT TYPE: {doc_label}?
   Philippine document types:
   - national_id = PhilSys National ID (card with QR code, PSA branding)
   - drivers_license = LTO Driver's License
   - passport = Philippine Passport (dark blue booklet)
   - sss_id = SSS / UMID card
   - philhealth_id = PhilHealth ID card
   - voters_id = COMELEC Voter's ID
   - postal_id = Philippine Postal ID
   - tin_id = BIR TIN ID
   - prc_id = PRC Professional ID
   - barangay_id = Barangay ID or Clearance
   Set correct_type: false if the document is clearly a different type.

Return ONLY this JSON, no extra text:
{{
  "is_legitimate": true,
  "is_legible": true,
  "is_screenshot": false,
  "name_matches": true,
  "is_expired": false,
  "correct_type": true,
  "confidence": 90,
  "notes": "brief summary of what was found",
  "rejection_reason": null
}}"""

        # Try primary model first, then fallback model for robustness.
        result = None
        verification_errors = []
        for model_name in ("gemini-2.5-flash", "gemini-1.5-flash"):
            try:
                result = _run_gemini_document_check(model_name, prompt, mime_type, file_b64)
                break
            except Exception as model_error:
                verification_errors.append(f"{model_name}: {type(model_error).__name__}")

        if not result:
            logger.warning(f"AI verification fell back to manual review. Errors: {verification_errors}")
            return {"status": "pending", "notes": "Pending admin review.", "rejection_reason": None}

        confidence = int(result.get("confidence", 0))
        is_legit = result.get("is_legitimate", False)
        is_legible = result.get("is_legible", False)
        is_expired = result.get("is_expired", False)
        correct_type = result.get("correct_type", True)
        is_screenshot = result.get("is_screenshot", False)
        name_matches = result.get("name_matches", True)

        # Hard reject conditions — any one of these fails the document
        hard_reject = not is_legit or is_screenshot or is_expired or not correct_type or not name_matches

        if hard_reject:
            reason = result.get("rejection_reason") or result.get("notes", "Document failed verification.")
            if is_screenshot:
                reason = f"Screenshots are not accepted. Please upload a direct photo of your physical document. {reason}"
            elif not is_legit:
                reason = f"Image does not appear to be a valid document. {reason}"
            elif not name_matches:
                reason = f"Name on document does not match your registered name. {reason}"
            elif not correct_type:
                reason = f"Wrong document type. Expected: {doc_label}. {reason}"
            elif is_expired:
                reason = f"Document appears to be expired. {reason}"
            return {
                "status": "rejected",
                "notes": f"AI rejected ({confidence}% confidence): {result.get('notes', '')}",
                "rejection_reason": reason
            }
        elif confidence >= 75 and is_legible:
            return {
                "status": "approved",
                "notes": f"AI verified ({confidence}% confidence): {result.get('notes', 'Document looks valid.')}",
                "rejection_reason": None
            }
        else:
            # Legible but lower confidence or unreadable — send to admin
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
        relationship_status=user_data.relationship_status,
        birthday=user_data.birthday,
        status="active",  # Owners are active immediately
        email_verified=False,  # Must verify email after document approval
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
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile with address"""
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    setattr(current_user, "bio", worker.bio if worker else None)
    return current_user


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile (name, profile picture, email, phone).
    
    If email is changed, email_verified is set to False (must re-verify).
    If phone_number is changed, phone_verified is set to False (must re-verify).
    """
    data = update_data.model_dump(exclude_unset=True)

    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    # Check if email is being changed
    new_email = data.get("email")
    if new_email and new_email != current_user.email:
        # Check if new email is already taken by another user
        existing = db.query(User).filter(User.email == new_email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already registered to another account."
            )
        current_user.email = new_email
        current_user.email_verified = False
        data.pop("email")  # Already handled
    elif "email" in data:
        data.pop("email")  # Same email, skip

    # Check if phone number is being changed
    new_phone = data.get("phone_number")
    if new_phone and new_phone != current_user.phone_number:
        # Check if new phone is already taken by another user
        existing = db.query(User).filter(User.phone_number == new_phone, User.id != current_user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This phone number is already registered to another account."
            )
        current_user.phone_number = new_phone
        current_user.phone_verified = False
        data.pop("phone_number")  # Already handled
    elif "phone_number" in data:
        data.pop("phone_number")  # Same phone, skip

    bio_value = data.pop("bio", None) if "bio" in data else None

    for key, value in data.items():
        setattr(current_user, key, value)

    if "bio" in update_data.model_fields_set:
        if not current_user.is_housekeeper:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only housekeepers can update bio"
            )

        worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
        if not worker:
            worker = Worker(user_id=current_user.id)
            db.add(worker)
        worker.bio = bio_value.strip() if isinstance(bio_value, str) else None

    current_user.updated_at = func.now()
    db.commit()
    db.refresh(current_user)
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    setattr(current_user, "bio", worker.bio if worker else None)
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


# ─── Email OTP Endpoints ──────────────────────────────────────────────────────

class OTPRequest(BaseModel):
    pass  # Uses the authenticated user's email


class OTPVerifyRequest(BaseModel):
    otp: str


@router.post("/send-email-otp")
def send_email_otp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate and send a 6-digit OTP to the authenticated user's email."""
    # Refresh from DB to get latest email_verified status (e.g. after profile edit)
    db.refresh(current_user)

    if getattr(current_user, "email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified."
        )

    otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    _otp_store[current_user.id] = {"otp": otp, "expires_at": expires_at}

    sent = _send_otp_email(
        to_email=current_user.email,
        otp=otp,
        first_name=current_user.first_name
    )

    # In dev / when SMTP not configured, surface the OTP in the response
    # so the feature can still be tested without email setup.
    response: dict = {"message": "Verification code sent to your email.", "email": current_user.email}
    if not sent:
        response["dev_otp"] = otp  # Remove in production after SMTP is confirmed
    return response


@router.post("/verify-email-otp")
def verify_email_otp(
    body: OTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify the 6-digit OTP and mark the user's email as verified."""
    db.refresh(current_user)
    if getattr(current_user, "email_verified", False):
        return {"message": "Email already verified.", "email_verified": True}

    entry = _otp_store.get(current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP found. Please request a new verification code."
        )

    if datetime.utcnow() > entry["expires_at"]:
        del _otp_store[current_user.id]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    if body.otp.strip() != entry["otp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please try again."
        )

    # Mark email as verified
    try:
        from sqlalchemy import text
        db.execute(
            text("UPDATE users SET email_verified = TRUE WHERE id = :uid"),
            {"uid": current_user.id}
        )
        db.commit()
    except Exception as e:
        logger.error(f"Failed to set email_verified for user {current_user.id}: {e}")
        # Non-fatal — we still clear the OTP and return success

    # Clear the used OTP
    del _otp_store[current_user.id]

    return {"message": "Email verified successfully.", "email_verified": True}


# ─── Phone OTP Endpoints ──────────────────────────────────────────────────────

class PhoneOTPVerifyRequest(BaseModel):
    otp: str


@router.post("/send-phone-otp")
def send_phone_otp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate and send a 6-digit OTP to the authenticated user's phone number."""
    # Refresh from DB to get latest phone_verified status (e.g. after profile edit)
    db.refresh(current_user)

    otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    _phone_otp_store[current_user.id] = {"otp": otp, "expires_at": expires_at}

    sms_sent = _send_phone_otp_sms(
        phone_number=current_user.phone_number,
        otp=otp,
        first_name=current_user.first_name,
    )

    response: dict = {"message": f"OTP sent to {current_user.phone_number}"}
    if not sms_sent:
        # Dev/fallback: expose OTP when SMS is not configured
        response["dev_otp"] = otp
        response["message"] = "SMS not configured — use dev_otp for testing."
    return response


@router.post("/verify-phone-otp")
def verify_phone_otp(
    body: PhoneOTPVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify the 6-digit phone OTP and mark the user's phone as verified."""
    db.refresh(current_user)
    if getattr(current_user, "phone_verified", False):
        return {"message": "Phone already verified.", "phone_verified": True}

    entry = _phone_otp_store.get(current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No OTP found. Please request a new verification code."
        )

    if datetime.utcnow() > entry["expires_at"]:
        del _phone_otp_store[current_user.id]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new one."
        )

    if body.otp.strip() != entry["otp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code. Please try again."
        )

    # Mark phone as verified
    try:
        from sqlalchemy import text
        db.execute(
            text("UPDATE users SET phone_verified = TRUE WHERE id = :uid"),
            {"uid": current_user.id}
        )
        db.commit()
    except Exception as e:
        logger.error(f"Failed to set phone_verified for user {current_user.id}: {e}")

    del _phone_otp_store[current_user.id]
    return {"message": "Phone verified successfully.", "phone_verified": True}


# ─── Forgot / Reset Password ─────────────────────────────────────────────────

def _build_password_reset_email_html(otp: str, first_name: str) -> str:
    """Build HTML email for password reset OTP."""
    digit_boxes = "".join(
        f'<td style="padding:0 5px;">'
        f'<div style="width:52px;height:64px;line-height:64px;text-align:center;'
        f'background:#ffffff;border:2px solid #E8D5E8;border-radius:12px;'
        f'font-size:36px;font-weight:900;color:#4B244A;'
        f'font-family:\'Courier New\',monospace;'
        f'box-shadow:0 4px 12px rgba(75,36,74,0.10);">{d}</div>'
        f'</td>'
        for d in otp
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F0EBF4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EBF4;padding:48px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;background:#ffffff;border-radius:24px;
                  overflow:hidden;box-shadow:0 12px 48px rgba(75,36,74,0.14);">
      <tr>
        <td style="background:linear-gradient(150deg,#4B244A 0%,#7B3F7A 50%,#EA526F 100%);
                   padding:52px 40px 44px;text-align:center;position:relative;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
            <tr><td align="center"
                    style="width:68px;height:68px;background:rgba(255,255,255,0.18);
                           border-radius:20px;border:2px solid rgba(255,255,255,0.30);">
              <span style="font-size:34px;line-height:68px;">🔑</span>
            </td></tr>
          </table>
          <h1 style="margin:0 0 6px;color:#ffffff;font-size:32px;font-weight:800;">Casaligan</h1>
          <p style="margin:0;color:rgba(255,255,255,0.70);font-size:13px;letter-spacing:2.5px;
                    text-transform:uppercase;font-weight:500;">Password Reset</p>
          <div style="position:absolute;bottom:-1px;left:0;right:0;height:28px;
                      background:#ffffff;border-radius:50% 50% 0 0 / 100% 100% 0 0;"></div>
        </td>
      </tr>
      <tr>
        <td style="padding:44px 48px 36px;">
          <p style="margin:0 0 6px;color:#EA526F;font-size:13px;font-weight:700;
                    text-transform:uppercase;letter-spacing:2px;">Password Reset</p>
          <h2 style="margin:0 0 16px;color:#2D1A2D;font-size:24px;font-weight:800;line-height:1.3;">
            Hi {first_name}, let's reset<br/>your password 🔐
          </h2>
          <p style="margin:0 0 32px;color:#6B5B6E;font-size:15px;line-height:1.7;">
            Enter the 6-digit code below in the Casaligan app to reset your password.
            This code expires in <strong style="color:#4B244A;">{OTP_EXPIRY_MINUTES} minutes</strong>.
          </p>
          <table cellpadding="0" cellspacing="0"
                 style="margin:0 auto 12px;background:linear-gradient(135deg,#FDF5FF,#FFF0F3);
                        border-radius:20px;padding:28px 24px;">
            <tr><td>
              <p style="margin:0 0 20px;text-align:center;color:#9C7FA0;font-size:11px;
                        font-weight:700;letter-spacing:3px;text-transform:uppercase;">
                Your reset code
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>{digit_boxes}</tr>
              </table>
              <p style="margin:18px 0 0;text-align:center;color:#C0A8C4;font-size:12px;">
                ⏱ Valid for {OTP_EXPIRY_MINUTES} minutes only
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 48px 32px;">
          <table cellpadding="0" cellspacing="0" width="100%"
                 style="background:#FFF8F0;border:1px solid #F5DFC0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="width:6px;background:linear-gradient(180deg,#F0A500,#EA526F);"></td>
              <td style="padding:16px 18px;">
                <p style="margin:0;color:#7A5500;font-size:13px;line-height:1.6;">
                  <strong>🔒 Security reminder:</strong> If you did not request a password reset,
                  please ignore this email. Your password will remain unchanged.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #F0EBF0;margin:0;"/></td></tr>
      <tr>
        <td style="padding:24px 40px 36px;text-align:center;">
          <p style="margin:0 0 4px;color:#4B244A;font-size:14px;font-weight:700;">Casaligan</p>
          <p style="margin:0;color:#D0C0D4;font-size:11px;">
            © 2026 Casaligan. All rights reserved.<br/>
            This is an automated message — please do not reply.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _send_password_reset_email(to_email: str, otp: str, first_name: str) -> bool:
    """Send password-reset OTP email via Brevo HTTP API."""
    brevo_api_key = os.getenv("BREVO_API_KEY", "")
    from_email = os.getenv("FROM_EMAIL", "startapp.casaligan@gmail.com")
    if not brevo_api_key:
        logger.warning("BREVO_API_KEY not configured — skipping password reset email.")
        return False
    try:
        plain_text = (
            f"Hi {first_name},\n\n"
            f"Your Casaligan password reset code is: {otp}\n\n"
            f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
            "If you did not request this, please ignore this email.\n\n"
            "— The Casaligan Team"
        )
        payload = {
            "sender": {"name": "Casaligan", "email": from_email},
            "to": [{"email": to_email}],
            "subject": f"{otp} is your Casaligan password reset code",
            "textContent": plain_text,
            "htmlContent": _build_password_reset_email_html(otp, first_name),
        }
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": brevo_api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if resp.status_code in (200, 201):
            logger.info(f"Password reset email sent to {to_email} via Brevo")
            return True
        logger.error(f"Brevo error {resp.status_code}: {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Failed to send password reset email: {type(e).__name__}: {e}")
        return False


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Send a 6-digit OTP to the user's email for password reset."""
    email = body.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()

    # Always return success to prevent email enumeration attacks
    generic_msg = "If an account with that email exists, a reset code has been sent."

    if not user:
        return {"message": generic_msg}

    otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    _password_reset_store[email] = {
        "otp": otp,
        "expires_at": expires_at,
        "user_id": user.id,
    }

    sent = _send_password_reset_email(
        to_email=user.email,
        otp=otp,
        first_name=user.first_name,
    )

    response: dict = {"message": generic_msg}
    if not sent:
        # Dev fallback: expose OTP when email is not configured
        response["dev_otp"] = otp
    return response


@router.post("/reset-password")
def reset_password(
    body: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """Verify the OTP and set a new password."""
    email = body.email.strip().lower()

    entry = _password_reset_store.get(email)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No reset code found. Please request a new one."
        )

    if datetime.utcnow() > entry["expires_at"]:
        del _password_reset_store[email]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code has expired. Please request a new one."
        )

    if body.otp.strip() != entry["otp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect reset code. Please try again."
        )

    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters."
        )

    # Update the password
    user = db.query(User).filter(User.id == entry["user_id"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user.password_hash = get_password_hash(body.new_password)
    db.commit()

    # Clear the used OTP
    del _password_reset_store[email]

    return {"message": "Password reset successfully. You can now log in with your new password."}


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

# ─── Housekeeper Application ─────────────────────────────────────────────────

class HousekeeperApplicationRequest(BaseModel):
    # Professional info
    bio: Optional[str] = None
    years_experience: Optional[int] = None
    skills: Optional[List[str]] = []          # e.g. ["cleaning", "cooking", "laundry"]
    availability: Optional[str] = None        # 'full_time' | 'part_time' | 'weekends_only'
    # Documents uploaded during wizard (IDs from user_documents table)
    nbi_document_id: Optional[int] = None
    secondary_document_id: Optional[int] = None
    # Legacy / no-op field kept for compatibility
    notes: Optional[str] = None


class HousekeeperApplicationResponse(BaseModel):
    id: int
    status: str
    notes: Optional[str]
    bio: Optional[str]
    years_experience: Optional[int]
    skills: Optional[str]
    availability: Optional[str]
    submitted_at: str
    reviewed_at: Optional[str]
    admin_notes: Optional[str]
    is_housekeeper: bool = False

    @classmethod
    def from_orm_model(cls, app: HousekeeperApplication, is_housekeeper: bool = False):
        return cls(
            id=app.application_id,
            status=str(app.status.value) if hasattr(app.status, 'value') else str(app.status),
            notes=app.notes,
            bio=app.bio,
            years_experience=app.years_experience,
            skills=app.skills,
            availability=app.availability,
            submitted_at=app.submitted_at.isoformat() if app.submitted_at else "",
            reviewed_at=app.reviewed_at.isoformat() if app.reviewed_at else None,
            admin_notes=app.admin_notes,
            is_housekeeper=is_housekeeper,
        )


def _approve_housekeeper(user_id: int, application: HousekeeperApplication, db: Session):
    """Shared helper: approve a housekeeper application and create/update Worker record."""
    import json as _json
    application.status = ApplicationStatus.APPROVED
    application.reviewed_at = datetime.utcnow()

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_housekeeper = True
        user.status = UserStatus.ACTIVE

    existing_worker = db.query(Worker).filter(Worker.user_id == user_id).first()
    if existing_worker:
        existing_worker.bio = application.bio
        existing_worker.years_experience = application.years_experience
        existing_worker.skills = application.skills
        existing_worker.availability = application.availability
    else:
        new_worker = Worker(
            user_id=user_id,
            bio=application.bio,
            years_experience=application.years_experience,
            skills=application.skills,
            availability=application.availability,
        )
        db.add(new_worker)

    existing_employer = db.query(Employer).filter(Employer.user_id == user_id).first()
    if not existing_employer:
        db.add(Employer(user_id=user_id))

    db.commit()


@router.post("/apply-housekeeper", response_model=HousekeeperApplicationResponse)
def apply_housekeeper(
    application_data: HousekeeperApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit application to become a housekeeper (multi-step wizard final step)."""
    import json as _json

    # ── Already approved? ──────────────────────────────────────────────────
    if current_user.is_housekeeper:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a registered housekeeper."
        )

    # ── Check phone was verified this session ──────────────────────────────
    if not getattr(current_user, "phone_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your phone number before submitting."
        )

    # ── Handle existing application (allow re-apply after rejection) ───────
    existing_app = db.query(HousekeeperApplication).filter(
        HousekeeperApplication.user_id == current_user.id
    ).first()
    if existing_app:
        app_status = str(existing_app.status.value) if hasattr(existing_app.status, 'value') else str(existing_app.status)
        if app_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your application is already under review."
            )
        if app_status == "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Application already approved."
            )
        # Rejected — delete old and allow fresh submission
        db.delete(existing_app)
        db.commit()

    # ── Validate primary document (if provided) ──────────────────────────
    nbi_doc = None
    if application_data.nbi_document_id:
        nbi_doc = db.query(UserDocument).filter(
            UserDocument.id == application_data.nbi_document_id,
            UserDocument.user_id == current_user.id
        ).first()
        if not nbi_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primary document not found or does not belong to you."
            )

    # ── Validate secondary document (if provided) ──────────────────────────
    sec_doc = None
    if application_data.secondary_document_id:
        sec_doc = db.query(UserDocument).filter(
            UserDocument.id == application_data.secondary_document_id,
            UserDocument.user_id == current_user.id
        ).first()
        if not sec_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Secondary document not found or does not belong to you."
            )

    # ── Re-run AI check on documents if still pending ─────────────────────
    for doc in [d for d in [nbi_doc, sec_doc] if d is not None]:
        if doc.status == "pending":
            ai_result = verify_document_with_ai(
                file_path=doc.file_path,
                document_type=doc.document_type,
                first_name=current_user.first_name,
                last_name=current_user.last_name,
            )
            doc.status = ai_result["status"]
            doc.notes = ai_result["notes"]
            if ai_result["rejection_reason"]:
                doc.rejection_reason = ai_result["rejection_reason"]
            if ai_result["status"] in ("approved", "rejected"):
                doc.reviewed_at = datetime.utcnow()
    db.commit()
    if nbi_doc: db.refresh(nbi_doc)
    if sec_doc: db.refresh(sec_doc)

    # ── Encode skills as JSON string ───────────────────────────────────────
    skills_json = _json.dumps(application_data.skills or [])

    # ── Create application record ──────────────────────────────────────────
    application = HousekeeperApplication(
        user_id=current_user.id,
        status=ApplicationStatus.PENDING,
        notes=application_data.notes,
        bio=application_data.bio,
        years_experience=application_data.years_experience,
        skills=skills_json,
        availability=application_data.availability,
        nbi_document_id=application_data.nbi_document_id,
        secondary_doc_id=application_data.secondary_document_id,
        phone_verified=True,
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    # ── Auto-approve if both provided docs passed AI ─────────────────────
    both_approved = (
        (nbi_doc is None or nbi_doc.status == "approved") and
        (sec_doc is None or sec_doc.status == "approved") and
        (nbi_doc is not None or sec_doc is not None)  # at least one doc provided
    )
    if both_approved:
        _approve_housekeeper(current_user.id, application, db)
        db.refresh(application)

    return HousekeeperApplicationResponse.from_orm_model(
        application,
        is_housekeeper=both_approved
    )


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
    from app.models_v2.direct_hire import DirectHire, DirectHireStatus
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

        # Include paid direct-hire earnings
        paid_direct_hires = db.query(DirectHire).filter(
            DirectHire.worker_id == worker_id,
            DirectHire.status == DirectHireStatus.PAID,
            DirectHire.paid_at.isnot(None)
        ).all()

        for hire in paid_direct_hires:
            try:
                total_earnings += float(hire.total_amount or 0)
            except Exception:
                pass
        
        analytics = {
            "jobs_applied": jobs_applied,
            "messages": messages,
            "reviews": reviews,
            "total_earnings": total_earnings
        }
    
    return analytics
