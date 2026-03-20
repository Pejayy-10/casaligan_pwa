"""Package Categories router - CRUD operations for category management"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
import re
from typing import List, Optional
from pydantic import BaseModel
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Worker
from app.models_v2.category import PackageCategory
from app.security import get_current_user

router = APIRouter(prefix="/categories", tags=["categories"])

CUSTOM_CATEGORY_MARKER = "[HK_CUSTOM:"
CUSTOM_CATEGORY_REGEX = re.compile(r"\[HK_CUSTOM:(\d+)\]")


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


def _custom_marker(user_id: int) -> str:
    return f"{CUSTOM_CATEGORY_MARKER}{user_id}]"


def _extract_marker_user_id(description: Optional[str]) -> Optional[int]:
    if not description:
        return None
    match = CUSTOM_CATEGORY_REGEX.search(description)
    if not match:
        return None
    return int(match.group(1))


def _is_custom_category(category: PackageCategory) -> bool:
    return _extract_marker_user_id(category.description) is not None


def _is_custom_for_user(category: PackageCategory, user_id: int) -> bool:
    owner_id = _extract_marker_user_id(category.description)
    return owner_id == user_id


def _clean_description(description: Optional[str]) -> Optional[str]:
    if not description:
        return None
    cleaned = CUSTOM_CATEGORY_REGEX.sub("", description).strip()
    return cleaned or None


def _ensure_custom_category_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS housekeeper_custom_categories (
            category_id INTEGER PRIMARY KEY REFERENCES package_categories(category_id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS owner_custom_categories (
            category_id INTEGER PRIMARY KEY REFERENCES package_categories(category_id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


def _get_custom_category_ids(db: Session, user_id: Optional[int] = None) -> set[int]:
    if user_id is None:
        rows = db.execute(text("SELECT category_id FROM housekeeper_custom_categories")).fetchall()
    else:
        rows = db.execute(
            text("SELECT category_id FROM housekeeper_custom_categories WHERE user_id = :user_id"),
            {"user_id": user_id}
        ).fetchall()
    return {int(row[0]) for row in rows}


def _get_owner_custom_category_ids(db: Session, user_id: Optional[int] = None) -> set[int]:
    """Get category IDs created by owners (private to each owner)."""
    if user_id is None:
        rows = db.execute(text("SELECT category_id FROM owner_custom_categories")).fetchall()
    else:
        rows = db.execute(
            text("SELECT category_id FROM owner_custom_categories WHERE user_id = :user_id"),
            {"user_id": user_id}
        ).fetchall()
    return {int(row[0]) for row in rows}


def _migrate_legacy_custom_markers(db: Session):
    legacy_categories = db.query(PackageCategory).filter(
        PackageCategory.description.isnot(None)
    ).all()

    for category in legacy_categories:
        owner_id = _extract_marker_user_id(category.description)
        if owner_id is None:
            continue

        db.execute(
            text("""
                INSERT INTO housekeeper_custom_categories (category_id, user_id)
                VALUES (:category_id, :user_id)
                ON CONFLICT (category_id) DO NOTHING
            """),
            {"category_id": category.category_id, "user_id": owner_id}
        )

        category.description = _clean_description(category.description)

    db.commit()


def _to_category_response(category: PackageCategory) -> CategoryResponse:
    return CategoryResponse(
        category_id=category.category_id,
        name=category.name,
        description=_clean_description(category.description),
        is_active=category.is_active,
        created_at=category.created_at.isoformat() if category.created_at else "",
        updated_at=category.updated_at.isoformat() if category.updated_at else None
    )


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


def check_worker_access(user: User, db: Session):
    """Check if user is a registered worker/housekeeper"""
    worker = db.query(Worker).filter(Worker.user_id == user.id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Housekeeper access required"
        )
    return worker


# ============== PUBLIC ENDPOINTS ==============

@router.get("/", response_model=List[CategoryResponse])
def get_all_categories(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    """Get all categories (public endpoint for fetching in package creation)"""
    _ensure_custom_category_table(db)
    _migrate_legacy_custom_markers(db)
    custom_category_ids = _get_custom_category_ids(db)
    owner_custom_ids = _get_owner_custom_category_ids(db)

    query = db.query(PackageCategory)
    
    if active_only:
        query = query.filter(PackageCategory.is_active == True)
    
    categories = query.order_by(PackageCategory.name).all()
    # Exclude housekeeper and owner private categories from the public list
    excluded_ids = custom_category_ids | owner_custom_ids
    if excluded_ids:
        categories = [cat for cat in categories if cat.category_id not in excluded_ids]
    
    return [_to_category_response(cat) for cat in categories]


@router.get("/my-categories", response_model=List[CategoryResponse])
def get_my_categories(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get global categories + current housekeeper custom categories"""
    check_worker_access(current_user, db)
    _ensure_custom_category_table(db)
    _migrate_legacy_custom_markers(db)

    all_custom_ids = _get_custom_category_ids(db)
    my_custom_ids = _get_custom_category_ids(db, current_user.id)
    all_owner_custom_ids = _get_owner_custom_category_ids(db)

    query = db.query(PackageCategory)
    if active_only:
        query = query.filter(PackageCategory.is_active == True)

    all_categories = query.order_by(PackageCategory.name).all()
    visible_categories = []
    for category in all_categories:
        cat_id = category.category_id
        is_legacy_custom = _is_custom_category(category)
        is_mine_legacy = _is_custom_for_user(category, current_user.id)

        # Hide owner custom categories from housekeepers
        if cat_id in all_owner_custom_ids:
            continue

        if cat_id in my_custom_ids or is_mine_legacy:
            visible_categories.append(category)
            continue

        if cat_id not in all_custom_ids and not is_legacy_custom:
            visible_categories.append(category)

    return [_to_category_response(cat) for cat in visible_categories]


@router.get("/owner-categories", response_model=List[CategoryResponse])
def get_owner_categories(
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get admin/global categories + current owner's own custom categories.
    Owner custom categories are private – only the owner who created them can see them."""
    _ensure_custom_category_table(db)
    _migrate_legacy_custom_markers(db)

    # All private category IDs (housekeeper + owner)
    all_hk_custom_ids = _get_custom_category_ids(db)
    all_owner_custom_ids = _get_owner_custom_category_ids(db)
    my_owner_custom_ids = _get_owner_custom_category_ids(db, current_user.id)

    query = db.query(PackageCategory)
    if active_only:
        query = query.filter(PackageCategory.is_active == True)

    all_categories = query.order_by(PackageCategory.name).all()
    visible_categories = []
    for category in all_categories:
        cat_id = category.category_id

        # Always show this owner's own custom categories
        if cat_id in my_owner_custom_ids:
            visible_categories.append(category)
            continue

        # Hide other owners' custom categories
        if cat_id in all_owner_custom_ids:
            continue

        # Hide housekeeper custom categories
        if cat_id in all_hk_custom_ids:
            continue

        # Legacy marker check
        if _is_custom_category(category):
            continue

        # It's a global/admin category – show it
        visible_categories.append(category)

    return [_to_category_response(cat) for cat in visible_categories]


# ============== ADMIN ENDPOINTS ==============

@router.post("/custom", response_model=CategoryResponse)
def create_custom_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new custom category (housekeeper only, testing/prototype support)"""
    check_worker_access(current_user, db)
    _ensure_custom_category_table(db)
    _migrate_legacy_custom_markers(db)

    normalized_name = category_data.name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name is required"
        )

    existing = db.query(PackageCategory).filter(
        PackageCategory.name.ilike(normalized_name)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )

    category = PackageCategory(
        name=normalized_name,
        description=category_data.description.strip() if category_data.description else None,
        is_active=True
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    db.execute(
        text("""
            INSERT INTO housekeeper_custom_categories (category_id, user_id)
            VALUES (:category_id, :user_id)
            ON CONFLICT (category_id) DO NOTHING
        """),
        {"category_id": category.category_id, "user_id": current_user.id}
    )
    db.commit()

    return _to_category_response(category)


@router.post("/owner-custom", response_model=CategoryResponse)
def create_owner_custom_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new custom category (owner/employer only, private to the owner)"""
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only house owners can create custom categories from job posts"
        )
    _ensure_custom_category_table(db)

    normalized_name = category_data.name.strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category name is required"
        )

    existing = db.query(PackageCategory).filter(
        PackageCategory.name.ilike(normalized_name)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )

    category = PackageCategory(
        name=normalized_name,
        description=category_data.description.strip() if category_data.description else None,
        is_active=True
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    db.execute(
        text("""
            INSERT INTO owner_custom_categories (category_id, user_id)
            VALUES (:category_id, :user_id)
            ON CONFLICT (category_id) DO NOTHING
        """),
        {"category_id": category.category_id, "user_id": current_user.id}
    )
    db.commit()

    return _to_category_response(category)


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
    
    return _to_category_response(category)


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
    
    return _to_category_response(category)


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
