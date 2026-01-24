"""Job-Category mapping table for many-to-many relationship"""
from sqlalchemy import Table, Column, Integer, ForeignKey
from app.db import Base

job_category_mapping = Table(
    'job_category_mapping',
    Base.metadata,
    Column('post_id', Integer, ForeignKey('forumposts.post_id', ondelete='CASCADE'), primary_key=True),
    Column('category_id', Integer, ForeignKey('package_categories.category_id', ondelete='CASCADE'), primary_key=True)
)
