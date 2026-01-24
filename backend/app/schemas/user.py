from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional, Literal
from datetime import datetime

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
