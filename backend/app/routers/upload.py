"""
File upload endpoints for images and documents — stores files in Supabase Storage.
Buckets required (public):
  • uploads   — for images (profile pics, job photos, proof of completion, etc.)
  • documents — for registration documents, IDs, certificates, etc.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import os
import uuid
from datetime import datetime
from pathlib import Path

from supabase import create_client, Client

from app.db import get_db
from app.models_v2.user import User
from app.security import get_current_user

router = APIRouter(prefix="/upload", tags=["upload"])

# Supabase Storage client (uses service role key so it can write to any bucket)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

def get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Storage service is not configured."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Allowed file types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_DOCUMENT_TYPES = {"image/jpeg", "image/png", "application/pdf", "image/gif", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename with timestamp and UUID"""
    ext = Path(original_filename).suffix.lower()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    return f"{timestamp}_{unique_id}{ext}"


def upload_to_supabase(bucket: str, storage_path: str, content: bytes, content_type: str) -> str:
    """Upload bytes to a Supabase Storage bucket and return the public URL."""
    supabase = get_supabase()
    supabase.storage.from_(bucket).upload(
        path=storage_path,
        file=content,
        file_options={"content-type": content_type, "upsert": "true"}
    )
    public_url = supabase.storage.from_(bucket).get_public_url(storage_path)
    return public_url


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    category: str = "general",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload an image file (for job posts, proof of completion, etc.)
    
    Args:
        file: The image file to upload
        category: Category for organization (job, completion, payment, profile, document)
    
    Returns:
        Supabase public URL to access the uploaded image
    """
    
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed. Allowed types: JPEG, PNG, GIF, WebP"
        )
    
    content = await file.read()
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )
    
    filename = generate_unique_filename(file.filename or "image.jpg")
    storage_path = f"{category}/{filename}"

    public_url = upload_to_supabase("uploads", storage_path, content, file.content_type)

    return {
        "url": public_url,
        "filename": filename,
        "size": len(content),
        "content_type": file.content_type
    }


@router.post("/document")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = "id",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document file (for registration documents, IDs, etc.)
    
    Args:
        file: The document file to upload
        document_type: Type of document (id, certificate, proof, etc.)
    
    Returns:
        Supabase public URL to access the uploaded document
    """
    
    # Validate file type
    if file.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, PDF"
        )
    
    content = await file.read()
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )
    
    filename = generate_unique_filename(file.filename or "document.jpg")
    storage_path = f"{current_user.id}/{filename}"

    public_url = upload_to_supabase("documents", storage_path, content, file.content_type)

    return {
        "url": public_url,
        "filename": filename,
        "size": len(content),
        "content_type": file.content_type,
        "document_type": document_type
    }


@router.post("/multiple")
async def upload_multiple_images(
    files: list[UploadFile] = File(...),
    category: str = "general",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload multiple image files at once
    
    Args:
        files: List of image files to upload
        category: Category for organization
    
    Returns:
        List of Supabase public URLs for uploaded images
    """
    
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files can be uploaded at once"
        )
    
    results = []
    
    for file in files:
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            continue  # Skip invalid files
        
        content = await file.read()
        
        if len(content) > MAX_FILE_SIZE:
            continue
        
        filename = generate_unique_filename(file.filename or "image.jpg")
        storage_path = f"{category}/{filename}"

        try:
            public_url = upload_to_supabase("uploads", storage_path, content, file.content_type)
            results.append({
                "url": public_url,
                "filename": filename,
                "size": len(content)
            })
        except Exception:
            continue  # Skip failed uploads and continue with the rest
    
    return {"uploaded": results, "count": len(results)}
