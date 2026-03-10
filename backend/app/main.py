from dotenv import load_dotenv
load_dotenv()  # Load .env file before anything else

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from app.routers import auth, jobs, payments, checkins, progress, debug, upload, reports, packages, direct_hire, notifications, ratings, messaging, availability, categories, contract_extensions

try:
    from app.routers import ai_chat
    _has_ai_chat = True
except ModuleNotFoundError as e:
    if "google" in str(e).lower():
        _has_ai_chat = False
        print("Note: AI chat disabled (install google-generativeai to enable)")
    else:
        raise

app = FastAPI(title="Casaligan API", version="1.0.0")

# CORS is critical for the Frontend to talk to the Backend
origins = [
    "http://localhost:5173", # Vite default
    "http://localhost:5174", # Vite alternate port
    "http://127.0.0.1:5173", # Vite alternate
    "http://127.0.0.1:5174", # Vite alternate port
    "http://localhost:8100", # Ionic/Capacitor default
    "http://localhost:3000", # Next.js default (Admin web)
    "http://127.0.0.1:3000", # Next.js alternate
    "capacitor://localhost", # Mobile app origin
    "http://10.213.89.2:5173", # Network IP for mobile testing
    "https://localhost", # HTTPS
    "https://capacitor", # Capacitor HTTPS
    # Production URLs
    "https://casaligan-main.vercel.app", # Vercel frontend
    "https://admin.casaligan.site", # Admin panel
    "https://casaligan.site", # Main domain
    "https://www.casaligan.site", # WWW subdomain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(payments.router)
app.include_router(checkins.router)
app.include_router(progress.router)
app.include_router(debug.router)
app.include_router(upload.router)
app.include_router(reports.router)
app.include_router(packages.router)
app.include_router(categories.router)
app.include_router(direct_hire.router)
app.include_router(notifications.router)
app.include_router(ratings.router)
app.include_router(messaging.router)
app.include_router(availability.router)
app.include_router(contract_extensions.router)
if _has_ai_chat:
    app.include_router(ai_chat.router)

@app.on_event("startup")
async def startup_event():
    """Database already created via SQL - just verify connection and run safe migrations"""
    try:
        from app.db import engine
        from sqlalchemy import text
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✓ Database connection verified")

        # Safe column additions — IF NOT EXISTS means these are idempotent
        migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE",
            # Housekeeper application — professional info & doc refs
            "ALTER TABLE housekeeper_applications ADD COLUMN IF NOT EXISTS bio TEXT",
            "ALTER TABLE housekeeper_applications ADD COLUMN IF NOT EXISTS years_experience INTEGER",
            "ALTER TABLE housekeeper_applications ADD COLUMN IF NOT EXISTS skills TEXT",
            "ALTER TABLE housekeeper_applications ADD COLUMN IF NOT EXISTS availability VARCHAR",
            "ALTER TABLE housekeeper_applications ADD COLUMN IF NOT EXISTS nbi_document_id INTEGER",
            "ALTER TABLE housekeeper_applications ADD COLUMN IF NOT EXISTS secondary_doc_id INTEGER",
            "ALTER TABLE housekeeper_applications ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE",
            # Worker profile — professional info
            "ALTER TABLE workers ADD COLUMN IF NOT EXISTS bio TEXT",
            "ALTER TABLE workers ADD COLUMN IF NOT EXISTS years_experience INTEGER",
            "ALTER TABLE workers ADD COLUMN IF NOT EXISTS skills TEXT",
            "ALTER TABLE workers ADD COLUMN IF NOT EXISTS availability VARCHAR",
        ]
        with engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                    print(f"✓ Migration applied: {sql[:60]}...")
                except Exception as me:
                    print(f"⚠ Migration skipped (already exists or unsupported): {me}")
    except Exception as e:
        print(f"⚠ Warning: Could not connect to database: {e}")
        print("  The application will start but database operations may fail.")

@app.get("/")
def read_root():
    return {"message": "Casaligan Backend is Online!", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "ok", "app": "Casaligan"}
