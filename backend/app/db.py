from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Configure engine for Supabase Transaction Pooler (pgbouncer)
# Disable prepared statements since pgbouncer doesn't support them
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # Verify connections before using them
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,  # Recycle connections after 1 hour
    connect_args={
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000"  # 30 second statement timeout
    },
    execution_options={
        "isolation_level": "AUTOCOMMIT"  # Better for connection poolers
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
