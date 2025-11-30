from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class DocumentCreate(BaseModel):
    document_type: str
    file_path: str
    notes: Optional[str] = None

class DocumentResponse(BaseModel):
    id: int
    user_id: int
    document_type: str
    file_path: str
    status: str
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    uploaded_at: datetime
    reviewed_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
