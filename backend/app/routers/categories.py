"""Package Categories router - CRUD operations for category management (Admin)"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.category import PackageCategory
from app.security import get_current_user

router = APIRouter(prefix="/categories", tags=["categories"])


# ============== SCHEMAS ==============

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    category_id: int
    name: str
    description: Optional[str]
    is_active: bool
    created_at: str
    updated_at: Optional[str]

    class Config:
        from_attributes = True


# ============== HELPER FUNCTIONS ==============

def check_admin_access(user: User, db: Session):
    """Check if user has admin access"""
    from app.models_v2.admin import Admin
    admin = db.query(Admin).filter(Admin.user_id == user.id).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return admin


# ============== PUBLIC ENDPOINTS ==============

@router.get("/", response_model=List[CategoryResponse])
def get_all_categories(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """Get all categories (public endpoint for fetching in package creation)"""
    query = db.query(PackageCategory)
    
    if active_only:
        query = query.filter(PackageCategory.is_active == True)
    
    categories = query.order_by(PackageCategory.name).all()
    
    return [
        CategoryResponse(
            category_id=cat.category_id,
            name=cat.name,
            description=cat.description,
            is_active=cat.is_active,
            created_at=cat.created_at.isoformat() if cat.created_at else "",
            updated_at=cat.updated_at.isoformat() if cat.updated_at else None
        )
        for cat in categories
    ]


# ============== ADMIN ENDPOINTS ==============

@router.post("/", response_model=CategoryResponse)
def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new category (admin only)"""
    check_admin_access(current_user, db)
    
    # Check if category name already exists
    existing = db.query(PackageCategory).filter(
        PackageCategory.name == category_data.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )
    
    category = PackageCategory(
        name=category_data.name,
        description=category_data.description,
        is_active=category_data.is_active
    )
    
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return CategoryResponse(
        category_id=category.category_id,
        name=category.name,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at.isoformat(),
        updated_at=category.updated_at.isoformat() if category.updated_at else None
    )


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a category (admin only)"""
    check_admin_access(current_user, db)
    
    category = db.query(PackageCategory).filter(
        PackageCategory.category_id == category_id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    # Check if new name conflicts with existing
    if category_data.name and category_data.name != category.name:
        existing = db.query(PackageCategory).filter(
            PackageCategory.name == category_data.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category with this name already exists"
            )
    
    # Update fields
    if category_data.name is not None:
        category.name = category_data.name
    if category_data.description is not None:
        category.description = category_data.description
    if category_data.is_active is not None:
        category.is_active = category_data.is_active
    
    db.commit()
    db.refresh(category)
    
    return CategoryResponse(
        category_id=category.category_id,
        name=category.name,
        description=category.description,
        is_active=category.is_active,
        created_at=category.created_at.isoformat(),
        updated_at=category.updated_at.isoformat() if category.updated_at else None
    )


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a category (admin only)"""
    check_admin_access(current_user, db)
    
    category = db.query(PackageCategory).filter(
        PackageCategory.category_id == category_id
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    # Check if category is being used by any packages
    if category.packages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete category. It is being used by {len(category.packages)} package(s)"
        )
    
    db.delete(category)
    db.commit()
    
    return {"message": "Category deleted successfully"}
