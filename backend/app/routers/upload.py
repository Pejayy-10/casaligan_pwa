"""
File upload endpoints for images and documents
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
from datetime import datetime
from pathlib import Path

from app.db import get_db
from app.models_v2.user import User
from app.security import get_current_user

router = APIRouter(prefix="/upload", tags=["upload"])

# Create uploads directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

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
        URL to access the uploaded image
    """
    
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: JPEG, PNG, GIF, WebP"
        )
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is 10MB"
        )
    
    # Create category subdirectory
    category_dir = UPLOAD_DIR / category
    category_dir.mkdir(exist_ok=True)
    
    # Generate unique filename
    filename = generate_unique_filename(file.filename or "image.jpg")
    file_path = category_dir / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return URL (relative path that can be served by the static file server)
    return {
        "url": f"/uploads/{category}/{filename}",
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
        URL to access the uploaded document
    """
    
    # Validate file type
    if file.content_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, PDF"
        )
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is 10MB"
        )
    
    # Create user-specific subdirectory for documents
    user_dir = UPLOAD_DIR / "documents" / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    filename = generate_unique_filename(file.filename or "document.jpg")
    file_path = user_dir / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Return URL
    return {
        "url": f"/uploads/documents/{current_user.id}/{filename}",
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
        List of URLs for uploaded images
    """
    
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files can be uploaded at once"
        )
    
    results = []
    
    for file in files:
        # Validate file type
        if file.content_type not in ALLOWED_IMAGE_TYPES:
            continue  # Skip invalid files
        
        # Read file content
        content = await file.read()
        
        # Skip files that are too large
        if len(content) > MAX_FILE_SIZE:
            continue
        
        # Create category subdirectory
        category_dir = UPLOAD_DIR / category
        category_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        filename = generate_unique_filename(file.filename or "image.jpg")
        file_path = category_dir / filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(content)
        
        results.append({
            "url": f"/uploads/{category}/{filename}",
            "filename": filename,
            "size": len(content)
        })
    
    return {"uploaded": results, "count": len(results)}
