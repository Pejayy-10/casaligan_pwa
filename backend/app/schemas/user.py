import re
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional, Literal
from datetime import datetime

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

class UserResponse(UserBase):
    id: int
    is_owner: bool
    is_housekeeper: bool
    active_role: str
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('gender', mode='before')
    @classmethod
    def convert_gender_enum(cls, value):
        if value is None:
            return None
        # Convert enum to string value before validation
        return value.value if hasattr(value, 'value') else value

class UserProfileResponse(UserResponse):
    address: Optional["AddressResponse"] = None
    
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

# Avoid circular imports
from app.schemas.address import AddressResponse
UserProfileResponse.model_rebuild()
