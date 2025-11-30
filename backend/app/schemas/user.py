from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    phone_number: str
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    suffix: Optional[str] = None

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

class UserProfileResponse(UserResponse):
    address: Optional["AddressResponse"] = None
    
    model_config = ConfigDict(from_attributes=True)

# Avoid circular imports
from app.schemas.address import AddressResponse
UserProfileResponse.model_rebuild()
