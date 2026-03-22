"""Package-Category mapping model for many-to-many relationship"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base

# Association table for package-category many-to-many relationship
package_category_mapping = Table(
    'package_category_mappings',
    Base.metadata,
    Column('package_id', Integer, ForeignKey('packages.package_id', ondelete='CASCADE'), primary_key=True),
    Column('category_id', Integer, ForeignKey('package_categories.category_id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now())
)
