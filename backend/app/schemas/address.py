from pydantic import BaseModel, ConfigDict
from typing import Optional

class AddressBase(BaseModel):
    region_code: Optional[str] = None
    region_name: str
    province_code: Optional[str] = None
    province_name: str
    city_code: Optional[str] = None
    city_name: str
    barangay_code: Optional[str] = None
    barangay_name: str
    street_address: Optional[str] = None
    subdivision: Optional[str] = None
    zip_code: Optional[str] = None

class AddressCreate(AddressBase):
    pass

class AddressResponse(AddressBase):
    id: int
    user_id: int
    
    model_config = ConfigDict(from_attributes=True)
