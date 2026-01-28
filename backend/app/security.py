from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db

security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    # Bcrypt has a 72 byte limit
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt

def decode_token(token: str) -> dict:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user_email(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """Dependency to get current user email from JWT token"""
    token = credentials.credentials
    payload = decode_token(token)
    user_email: str = payload.get("sub")
    if user_email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return user_email

async def get_current_user(
    user_email: str = Depends(get_current_user_email),
    db: Session = Depends(get_db)
):
    """Dependency to get current user object from database"""
    from app.models_v2.user import User
    from datetime import datetime, timezone
    
    user = db.query(User).filter(User.email == user_email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    # Check if user is restricted
    if user.is_restricted:
        # Check if restriction has expired
        if user.restriction_end:
            now = datetime.now(timezone.utc)
            restriction_end = user.restriction_end
            
            # If restriction_end is naive, make it timezone-aware
            if restriction_end.tzinfo is None:
                from datetime import timezone as dt_timezone
                restriction_end = restriction_end.replace(tzinfo=dt_timezone.utc)
            
            if now >= restriction_end:
                # Restriction has expired, lift it automatically
                user.is_restricted = False
                user.restriction_reason = None
                user.restriction_start = None
                user.restriction_end = None
                user.restricted_by_admin_id = None
                db.commit()
            else:
                # Still restricted
                days_left = (restriction_end - now).days
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Your account has been restricted. Reason: {user.restriction_reason or 'Policy violation'}. Time remaining: {days_left} days. Contact support for assistance.",
                    headers={"X-Account-Status": "restricted"}
                )
        else:
            # Permanent restriction
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your account has been restricted. Reason: {user.restriction_reason or 'Policy violation'}. Contact support for assistance.",
                headers={"X-Account-Status": "restricted"}
            )
    
    return user
