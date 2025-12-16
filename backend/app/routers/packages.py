"""Worker Packages router - CRUD operations for service packages"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.db import get_db
from app.models_v2.user import User
from app.models_v2.worker_employer import Worker
from app.models_v2.package import WorkerPackage
from app.security import get_current_user

router = APIRouter(prefix="/packages", tags=["packages"])


# ============== SCHEMAS ==============

class PackageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    duration_hours: int = 2
    services: List[str] = []
    category_id: int  # Required category


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_hours: Optional[int] = None
    services: Optional[List[str]] = None
    is_active: Optional[bool] = None
    category_id: Optional[int] = None


class PackageResponse(BaseModel):
    package_id: int
    worker_id: int
    name: str
    description: Optional[str]
    price: float
    duration_hours: int
    services: List[str]
    is_active: bool
    category_id: int
    category_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============== HELPER FUNCTIONS ==============

def get_worker_for_user(user_id: int, db: Session) -> Worker:
    """Get worker record for a user, raise if not found"""
    worker = db.query(Worker).filter(Worker.user_id == user_id).first()
    if not worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be a registered housekeeper to manage packages"
        )
    return worker


# ============== WORKER PACKAGE ENDPOINTS ==============

@router.post("/", response_model=PackageResponse)
def create_package(
    package_data: PackageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new service package (housekeeper only)"""
    from app.models_v2.category import PackageCategory
    
    worker = get_worker_for_user(current_user.id, db)
    
    # Verify category exists
    category = db.query(PackageCategory).filter(
        PackageCategory.category_id == package_data.category_id
    ).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    
    package = WorkerPackage(
        worker_id=worker.worker_id,
        title=package_data.name,  # Use name as title
        name=package_data.name,   # Also set name for mobile compatibility
        description=package_data.description,
        price=package_data.price,
        duration_hours=package_data.duration_hours,
        services=package_data.services,
        category_id=package_data.category_id,
        status='active',  # Auto-activate for now
        is_active=True
    )
    
    db.add(package)
    db.commit()
    db.refresh(package)
    
    return PackageResponse(
        package_id=package.package_id,
        worker_id=package.worker_id,
        name=package.name,
        description=package.description,
        price=float(package.price),
        duration_hours=package.duration_hours,
        services=package.services or [],
        is_active=package.is_active,
        category_id=package.category_id,
        category_name=category.name
    )


@router.get("/my-packages", response_model=List[PackageResponse])
def get_my_packages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all packages for the current housekeeper"""
    worker = get_worker_for_user(current_user.id, db)
    
    packages = db.query(WorkerPackage).filter(
        WorkerPackage.worker_id == worker.worker_id
    ).order_by(WorkerPackage.created_at.desc()).all()
    
    return [
        PackageResponse(
            package_id=p.package_id,
            worker_id=p.worker_id,
            name=p.name,
            description=p.description,
            price=float(p.price),
            duration_hours=p.duration_hours,
            services=p.services or [],
            is_active=p.is_active,
            category_id=p.category_id,
            category_name=p.category.name if p.category else None
        )
        for p in packages
    ]


@router.put("/{package_id}", response_model=PackageResponse)
def update_package(
    package_id: int,
    package_data: PackageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a package (owner only)"""
    from app.models_v2.category import PackageCategory
    
    worker = get_worker_for_user(current_user.id, db)
    
    package = db.query(WorkerPackage).filter(
        WorkerPackage.package_id == package_id,
        WorkerPackage.worker_id == worker.worker_id
    ).first()
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )
    
    # Verify category if being updated
    if package_data.category_id is not None:
        category = db.query(PackageCategory).filter(
            PackageCategory.category_id == package_data.category_id
        ).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found"
            )
        package.category_id = package_data.category_id
    
    # Update fields
    if package_data.name is not None:
        package.name = package_data.name
    if package_data.description is not None:
        package.description = package_data.description
    if package_data.price is not None:
        package.price = package_data.price
    if package_data.duration_hours is not None:
        package.duration_hours = package_data.duration_hours
    if package_data.services is not None:
        package.services = package_data.services
    if package_data.is_active is not None:
        package.is_active = package_data.is_active
    
    db.commit()
    db.refresh(package)
    
    return PackageResponse(
        package_id=package.package_id,
        worker_id=package.worker_id,
        name=package.name,
        description=package.description,
        price=float(package.price),
        duration_hours=package.duration_hours,
        services=package.services or [],
        is_active=package.is_active,
        category_id=package.category_id,
        category_name=package.category.name if package.category else None
    )


@router.delete("/{package_id}")
def delete_package(
    package_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a package (owner only)"""
    worker = get_worker_for_user(current_user.id, db)
    
    package = db.query(WorkerPackage).filter(
        WorkerPackage.package_id == package_id,
        WorkerPackage.worker_id == worker.worker_id
    ).first()
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )
    
    db.delete(package)
    db.commit()
    
    return {"message": "Package deleted successfully"}


# ============== PUBLIC ENDPOINTS ==============

@router.get("/worker/{worker_id}", response_model=List[PackageResponse])
def get_worker_packages(
    worker_id: int,
    db: Session = Depends(get_db)
):
    """Get all active packages for a specific worker (public)"""
    packages = db.query(WorkerPackage).filter(
        WorkerPackage.worker_id == worker_id,
        WorkerPackage.is_active == True
    ).order_by(WorkerPackage.price.asc()).all()
    
    return [
        PackageResponse(
            package_id=p.package_id,
            worker_id=p.worker_id,
            name=p.name,
            description=p.description,
            price=float(p.price),
            duration_hours=p.duration_hours,
            services=p.services or [],
            is_active=p.is_active
        )
        for p in packages
    ]
