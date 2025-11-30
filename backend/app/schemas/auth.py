from pydantic import BaseModel

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

# Import after to avoid circular dependency
from app.schemas.user import UserResponse
TokenResponse.model_rebuild()
