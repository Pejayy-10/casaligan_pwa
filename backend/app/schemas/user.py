import re
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional, Literal
from datetime import datetime, date

# Gmail-only and Philippines mobile validation
GMAIL_DOMAIN = "gmail.com"


class UserBase(BaseModel):
    email: EmailStr
    phone_number: str
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    suffix: Optional[str] = None
    gender: Optional[Literal['male', 'female', 'other', 'prefer_not_to_say']] = None
    birthday: Optional[date] = None

    @field_validator("first_name", "middle_name", "last_name", "suffix", mode="before")
    @classmethod
    def normalize_names(cls, v: Optional[str]) -> Optional[str]:
        """Normalize name fields to start with an uppercase letter."""
        if v is None:
            return None
        value = v.strip()
        if not value:
            return None
        # Capitalize first letter, lowercase the rest (e.g., "kei" -> "Kei")
        return value.capitalize()


class UserCreate(UserBase):
    password: str

    @field_validator("email")
    @classmethod
    def email_must_be_gmail(cls, v: str) -> str:
        if not v:
            raise ValueError("Email is required")
        v_lower = v.strip().lower()
        if not v_lower.endswith("@" + GMAIL_DOMAIN):
            raise ValueError("Only Gmail addresses are allowed (e.g. yourname@gmail.com)")
        return v_lower

    @field_validator("phone_number")
    @classmethod
    def phone_must_be_philippines(cls, v: str) -> str:
        if not v:
            raise ValueError("Phone number is required")
        raw = re.sub(r"[\s\-]", "", v.strip())
        if not raw:
            raise ValueError("Phone number is required")
        # Philippines mobile: 10 digits (e.g. 9XX XXX XXXX). Accept +639XXXXXXXXX or 09XXXXXXXXX (11 digits)
        digits_only: Optional[str] = None
        if raw.startswith("+63"):
            rest = raw[3:].lstrip()
            if rest.startswith("0"):
                rest = rest[1:]
            digits_only = rest if rest.isdigit() and len(rest) == 10 else None
        elif raw.startswith("09") and len(raw) == 11 and raw[2:].isdigit():
            digits_only = raw[1:]
        elif raw.startswith("9") and len(raw) == 10 and raw.isdigit():
            digits_only = raw
        if digits_only:
            return "+63" + digits_only
        if raw.startswith("09") and len(raw) != 11:
            raise ValueError("09 number must be 11 digits (09 + 9 digits). You entered %d digits. Example: 09123456789" % len(raw))
        raise ValueError("Use a Philippine number: 09 + 9 digits (11 total, e.g. 09123456789) or +639XXXXXXXXX")

class UserUpdate(BaseModel):
    """Schema for updating user profile fields (name, profile picture, email, phone)."""
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    suffix: Optional[str] = None
    profile_picture: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def email_must_be_gmail_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v_lower = v.strip().lower()
        if not v_lower:
            return None
        if not v_lower.endswith("@" + GMAIL_DOMAIN):
            raise ValueError("Only Gmail addresses are allowed (e.g. yourname@gmail.com)")
        return v_lower

    @field_validator("phone_number", mode="before")
    @classmethod
    def phone_must_be_philippines_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        raw = re.sub(r"[\s\-]", "", v.strip())
        if not raw:
            return None
        digits_only: Optional[str] = None
        if raw.startswith("+63"):
            rest = raw[3:].lstrip()
            if rest.startswith("0"):
                rest = rest[1:]
            digits_only = rest if rest.isdigit() and len(rest) == 10 else None
        elif raw.startswith("09") and len(raw) == 11 and raw[2:].isdigit():
            digits_only = raw[1:]
        elif raw.startswith("9") and len(raw) == 10 and raw.isdigit():
            digits_only = raw
        if digits_only:
            return "+63" + digits_only
        raise ValueError("Use a Philippine number: 09 + 9 digits (11 total, e.g. 09123456789) or +639XXXXXXXXX")


class UserResponse(UserBase):
    id: int
    is_owner: bool
    is_housekeeper: bool
    active_role: str
    status: str
    created_at: datetime
    profile_picture: Optional[str] = None
    age: Optional[int] = None
    email_verified: Optional[bool] = None  # None = grandfathered user, False = unverified, True = verified
    phone_verified: Optional[bool] = None  # None = pre-housekeeper flow, True = verified
    bio: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('gender', mode='before')
    @classmethod
    def convert_gender_enum(cls, value):
        if value is None:
            return None
        # Convert enum to string value before validation
        return value.value if hasattr(value, 'value') else value

    def model_post_init(self, __context):
        """Auto-calculate age from birthday"""
        if self.birthday and self.age is None:
            today = date.today()
            bday = self.birthday
            age = today.year - bday.year
            if (today.month, today.day) < (bday.month, bday.day):
                age -= 1
            object.__setattr__(self, 'age', age)

class UserProfileResponse(UserResponse):
    address: Optional["AddressResponse"] = None
    
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

# Avoid circular imports
from app.schemas.address import AddressResponse
UserProfileResponse.model_rebuild()
