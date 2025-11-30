# Casaligan - Gig Platform for Housekeepers

A trusted gig platform connecting housekeepers with house owners in the Philippines.

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database operations
- **PostgreSQL** - Database (hosted on Supabase)
- **JWT** - Authentication
- **Pydantic** - Data validation

### Frontend
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **Konsta UI** - Mobile-friendly components

## Project Structure

```
casaligan_capacitor/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Configuration settings
│   │   ├── db.py                # Database connection
│   │   ├── security.py          # Auth & JWT utilities
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── address.py
│   │   │   └── document.py
│   │   ├── schemas/             # Pydantic schemas
│   │   │   ├── user.py
│   │   │   ├── auth.py
│   │   │   ├── address.py
│   │   │   └── document.py
│   │   └── routers/             # API routes
│   │       └── auth.py
│   ├── .env                     # Environment variables
│   ├── requirements.txt         # Python dependencies
│   └── venv/                    # Virtual environment
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main app with routing
│   │   ├── config.ts            # API configuration
│   │   ├── types/               # TypeScript types
│   │   ├── services/            # API services
│   │   │   ├── api.ts           # Axios client
│   │   │   ├── auth.ts          # Auth service
│   │   │   └── psgc.ts          # Philippines address API
│   │   ├── components/
│   │   │   └── ProtectedRoute.tsx
│   │   └── pages/
│   │       ├── LandingPage.tsx
│   │       ├── LoginPage.tsx
│   │       ├── RegisterStep1Page.tsx
│   │       ├── RegisterStep2AddressPage.tsx
│   │       ├── RegisterStep3DocumentsPage.tsx
│   │       └── DashboardPage.tsx
│   ├── .env                     # Environment variables
│   ├── package.json
│   └── vite.config.ts
│
└── Docs/
    ├── CASALIGAN_CONTEXT.md
    ├── CODING_RULES.md
    └── PHASES.md
```

## Setup Instructions

### Backend Setup

1. Navigate to backend folder:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Configure `.env` file (already set up):
```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
```

4. Run the backend:
```bash
python -m uvicorn app.main:app --reload --port 8000
```

Backend will run at: http://127.0.0.1:8000

### Frontend Setup

1. Navigate to frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure `.env` file (already set up):
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

4. Run the frontend:
```bash
pnpm dev
```

Frontend will run at: http://localhost:5173

## Features Implemented (Phase 0-4)

### ✅ Authentication & Authorization
- User registration (multi-step)
- Login with JWT tokens
- Protected routes
- Password hashing with bcrypt

### ✅ User Management
- User roles (Owner/Housekeeper)
- Role switching capability
- User profiles with personal info

### ✅ Address System
- Philippines PSGC integration
- Cascading dropdowns (Region → Province → City → Barangay)
- Complete address data capture

### ✅ Document Verification
- Document upload system
- Multiple document types supported
- Verification status tracking

### ✅ Dashboard
- Role-based dashboards
- Owner dashboard with job management placeholders
- Housekeeper dashboard with job board placeholders

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile
- `POST /auth/register/address` - Add/update user address
- `POST /auth/register/documents` - Upload document
- `GET /auth/documents` - Get user documents
- `POST /auth/switch-role` - Switch between owner/housekeeper roles

### Health Check
- `GET /` - API status
- `GET /health` - Health check

## Development Status

**Completed:** Phases 0-4
- ✅ Backend structure with FastAPI
- ✅ Database models (User, Address, Document)
- ✅ Authentication with JWT
- ✅ Frontend structure with React + Vite
- ✅ Tailwind CSS v4 integration
- ✅ All registration pages (3 steps)
- ✅ Login page
- ✅ Role-based dashboards
- ✅ PSGC address integration

**Next Steps:** Phases 5-9
- Job board and matching system
- Messaging and notifications
- Payment and subscriptions
- Admin panel
- Deployment and production setup

## Notes

- All users start as **house owners** by default
- Housekeepers require additional verification and admin approval
- The frontend uses localStorage for token management
- PSGC API provides Philippines address data (regions, provinces, cities, barangays)
- Database tables are auto-created on backend startup

## Package Manager

Always use `pnpm` for frontend operations (never npm or yarn).
