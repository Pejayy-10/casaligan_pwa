# 📁 Casaligan PWA - Project Structure Analysis

This document provides a comprehensive guide to the project structure, helping you understand where to place new files or edit existing ones.

## 🏗️ Overall Architecture

The project is a **full-stack application** with three main components:
1. **Backend** - FastAPI (Python) REST API
2. **Frontend** - React + TypeScript PWA (Mobile App)
3. **Casaligan Web** - Next.js Admin Dashboard

---

## 📂 Root Directory Structure

```
casaligan_pwa/
├── backend/              # FastAPI Backend API
├── frontend/             # React PWA (Mobile App)
├── casaligan_web/        # Next.js Admin Dashboard
├── database/             # Database schemas and migrations
├── merged_schema.sql  # Complete database schema
├── README.md            # Main project documentation
└── .gitignore           # Git ignore rules
```

---

## 🔧 Backend Structure (`backend/`)

### Purpose
FastAPI REST API that handles all business logic, database operations, and serves as the backend for both the mobile app and admin dashboard.

### Key Files & Directories

#### **Entry Point**
- `backend/app/main.py` - FastAPI application entry point, CORS configuration, router registration

#### **Core Configuration**
- `backend/app/config.py` - Application configuration (database URLs, JWT secrets, etc.)
- `backend/app/db.py` - Database connection and session management
- `backend/app/security.py` - JWT authentication, password hashing utilities

#### **Models** (`backend/app/models_v2/`)
Database models (SQLAlchemy ORM):
- `user.py` - User model
- `worker_employer.py` - Worker/Employer relationships
- `job.py` - Job postings
- `application.py` - Job applications
- `direct_hire.py` - Direct hire contracts
- `contract.py` - Contract management
- `conversation.py` - Messaging conversations
- `document.py` - User documents
- `package.py` - Worker service packages
- `payment.py` - Payment records
- `rating.py` - Ratings and reviews
- `report.py` - User reports
- `notification.py` - Notifications
- `address.py` - Address management
- `forum.py` - Forum posts (if applicable)

**When to edit:** Add new database models here when creating new features.

#### **Routers** (`backend/app/routers/`)
API endpoint handlers - each file represents a feature domain:
- `auth.py` - Authentication endpoints (`/auth/*`)
- `jobs.py` - Job posting endpoints (`/jobs/*`)
- `direct_hire.py` - Direct hire endpoints (`/direct-hires/*`)
- `messaging.py` - Messaging endpoints (`/messages/*`)
- `payments.py` - Payment endpoints (`/payments/*`)
- `packages.py` - Package endpoints (`/packages/*`)
- `ratings.py` - Rating endpoints (`/ratings/*`)
- `reports.py` - Report endpoints (`/reports/*`)
- `notifications.py` - Notification endpoints (`/notifications/*`)
- `upload.py` - File upload endpoints (`/upload/*`)
- `checkins.py` - Check-in endpoints (`/checkins/*`)
- `progress.py` - Progress tracking endpoints (`/progress/*`)
- `debug.py` - Debug/testing endpoints

**When to edit:** 
- Add new API endpoints in the appropriate router file
- Create a new router file for a new feature domain

#### **Schemas** (`backend/app/schemas/`)
Pydantic schemas for request/response validation:
- `auth.py` - Authentication schemas (login, register)
- `user.py` - User schemas
- `job.py` - Job schemas
- `address.py` - Address schemas
- `document.py` - Document schemas

**When to edit:** Add new request/response models here when creating new endpoints.

#### **Services** (`backend/app/services/`)
Business logic layer (optional, for complex operations):
- `notification_service.py` - Notification business logic

**When to edit:** Extract complex business logic here to keep routers clean.

#### **Migrations**
- `backend/alembic/` - Alembic migration files
- `backend/migrations/` - SQL migration scripts
- `backend/alembic.ini` - Alembic configuration

**When to edit:** Create new migration files when changing database schema.

#### **Other**
- `backend/requirements.txt` - Python dependencies
- `backend/uploads/` - Uploaded files (documents, images)
- `backend/venv/` - Python virtual environment (don't commit)

---

## 📱 Frontend Structure (`frontend/`)

### Purpose
React + TypeScript Progressive Web App (PWA) for mobile users (housekeepers and house owners).

### Key Files & Directories

#### **Entry Points**
- `frontend/src/main.tsx` - React application entry point
- `frontend/src/App.tsx` - Main app component with routing
- `frontend/index.html` - HTML template
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/capacitor.config.ts` - Capacitor (mobile) configuration

#### **Pages** (`frontend/src/pages/`)
Page components (one per route):
- `LandingPage.tsx` - Landing/home page
- `LoginPage.tsx` - Login page
- `RegisterStep1Page.tsx` - Registration step 1
- `RegisterStep2AddressPage.tsx` - Registration step 2 (address)
- `RegisterStep3DocumentsPage.tsx` - Registration step 3 (documents)
- `DashboardPage.tsx` - User dashboard
- `JobsPage.tsx` - Job listings page
- `CreateJobPage.tsx` - Create job posting
- `BrowseWorkersPage.tsx` - Browse worker profiles
- `WorkerProfilePage.tsx` - Worker profile details
- `ApplyHousekeeperPage.tsx` - Apply as housekeeper
- `MessagesPage.tsx` - Messages list
- `ChatPage.tsx` - Individual chat
- `ProfilePage.tsx` - User profile
- `SplashPage.tsx` - Splash screen

**When to edit:** 
- Add new pages here for new routes
- Edit existing pages to modify UI/functionality

#### **Components** (`frontend/src/components/`)
Reusable UI components:
- `TabBar.tsx` - Bottom navigation bar
- `ProtectedRoute.tsx` - Route protection wrapper
- `NotificationBell.tsx` - Notification icon/bell
- `JobDetailModal.tsx` - Job details modal
- `JobProgressTracker.tsx` - Job progress UI
- `PaymentModal.tsx` - Payment handling modal
- `PaymentTrackerOwner.tsx` - Payment tracking (owner view)
- `PaymentTrackerWorker.tsx` - Payment tracking (worker view)
- `RatingModal.tsx` - Rating submission modal
- `StarRating.tsx` - Star rating component
- `ChatModal.tsx` - Chat interface modal
- `ConversationList.tsx` - Conversation list
- `DirectHiresList.tsx` - Direct hires list
- `HousekeeperMyJobs.tsx` - Worker's job list
- `HousekeeperProgressModal.tsx` - Worker progress modal
- `PackageManagement.tsx` - Package management UI
- `PackageOnboardingModal.tsx` - Package creation modal
- `CheckInModal.tsx` - Check-in modal
- `ContractModal.tsx` - Contract modal
- `JobCompletionModal.tsx` - Job completion modal
- `CompletionReviewModal.tsx` - Completion review modal
- `ApplicantsListModal.tsx` - Job applicants list
- `ReportUnpaidModal.tsx` - Report unpaid job modal

**When to edit:** 
- Add new reusable components here
- Modify existing components for UI changes

#### **Services** (`frontend/src/services/`)
API communication and utilities:
- `api.ts` - Axios client configuration (base API client)
- `auth.ts` - Authentication service functions
- `psgc.ts` - Philippine Standard Geographic Code service

**When to edit:** 
- Add new API service functions here
- Create new service files for new API domains

#### **Types** (`frontend/src/types/`)
TypeScript type definitions:
- `index.ts` - Shared TypeScript interfaces/types

**When to edit:** Add new TypeScript types/interfaces here.

#### **Configuration**
- `frontend/src/config.ts` - Frontend configuration (API URLs, etc.)

#### **Styling**
- `frontend/src/index.css` - Global styles
- `frontend/src/App.css` - App-specific styles

#### **Mobile (Android)**
- `frontend/android/` - Capacitor Android project
- **Don't edit manually** - Use `pnpm cap sync` after changes

#### **Other**
- `frontend/package.json` - Node.js dependencies
- `frontend/public/` - Static assets (images, icons)

---

## 🌐 Casaligan Web Structure (`casaligan_web/`)

### Purpose
Next.js admin dashboard for managing the platform (admin users only).

### Key Files & Directories

#### **Entry Points**
- `casaligan_web/app/layout.tsx` - Root layout
- `casaligan_web/app/page.tsx` - Home page
- `casaligan_web/middleware.ts` - Next.js middleware (auth, routing)
- `casaligan_web/next.config.ts` - Next.js configuration

#### **Pages** (`casaligan_web/app/`)
Next.js App Router structure:

**Auth Pages:**
- `app/auth/page.tsx` - Admin login page
- `app/clear-auth/page.tsx` - Clear auth/logout

**Admin Dashboard Pages** (`app/(shell)/`):
- `app/(shell)/page.tsx` - Dashboard home
- `app/(shell)/layout.tsx` - Dashboard layout with sidebar
- `app/(shell)/dashboard-client.tsx` - Dashboard client component
- `app/(shell)/users/workers/page.tsx` - Workers management
- `app/(shell)/users/employers/page.tsx` - Employers management
- `app/(shell)/users/verification/page.tsx` - User verification
- `app/(shell)/jobs/page.tsx` - Jobs management
- `app/(shell)/bookings/page.tsx` - Bookings management
- `app/(shell)/messages/page.tsx` - Messages management
- `app/(shell)/payments/page.tsx` - Payments management
- `app/(shell)/reviews/page.tsx` - Reviews management
- `app/(shell)/reports/page.tsx` - Reports management
- `app/(shell)/notifications/page.tsx` - Notifications
- `app/(shell)/security/page.tsx` - Security settings
- `app/(shell)/activity-log/page.tsx` - Activity log
- `app/(shell)/matching-analytics/page.tsx` - Matching analytics

**When to edit:** Add new admin pages here.

#### **Components** (`casaligan_web/app/components/`)
Admin dashboard components:
- `Shell.tsx` - Main shell/layout component
- `Workers.tsx` - Workers table/management
- `Employers.tsx` - Employers table/management
- `Verification.tsx` - Verification UI
- `Messages.tsx` - Messages UI
- `Reports.tsx` - Reports UI
- `Security.tsx` - Security settings UI
- `ActivityLog.tsx` - Activity log UI
- `MatchingAnalytics.tsx` - Analytics UI
- `FilterBar.tsx` - Filter bar component
- `SearchBar.tsx` - Search bar component
- `TableShell.tsx` - Table wrapper component
- `ActionTable.tsx` - Action table component
- Various chart components (BarChart, PieChart, etc.)

**When to edit:** Add new admin UI components here.

#### **Supabase Integration** (`casaligan_web/lib/supabase/`)
Supabase client and queries:
- `client.ts` - Supabase client setup
- `server.ts` - Server-side Supabase client
- `auth.ts` - Authentication functions
- `queries.ts` - General database queries
- `workerQueries.ts` - Worker-specific queries
- `employerQueries.ts` - Employer-specific queries
- `adminQueries.ts` - Admin-specific queries
- `booking.ts` - Booking queries
- `messageQueries.ts` - Message queries
- `paymentsqueries.ts` - Payment queries
- `reportsqueries.ts` - Report queries
- `reviewQueries.ts` - Review queries
- `verficationQueries.ts` - Verification queries
- `activityLogQueries.ts` - Activity log queries
- `matchingQueries.ts` - Matching analytics queries
- `adminProfileQueries.ts` - Admin profile queries
- `middleware.ts` - Middleware utilities

**When to edit:** Add new database queries here.

#### **Contexts** (`casaligan_web/app/contexts/`)
React contexts:
- `AdminProfileContext.tsx` - Admin profile context

**When to edit:** Add new contexts for shared state.

#### **UI Components** (`casaligan_web/app/ui/`)
- `Shell.tsx` - Shell component

#### **Scripts** (`casaligan_web/scripts/`)
Database setup and utility scripts:
- SQL scripts for database setup
- JavaScript scripts for admin creation, password hashing, etc.

**When to edit:** Add new setup/utility scripts here.

#### **Documentation**
- Various `.md` files for setup instructions

#### **Other**
- `casaligan_web/package.json` - Node.js dependencies
- `casaligan_web/public/` - Static assets (SVG icons)

---

## 🗄️ Database Structure (`database/`)

### Purpose
Database schemas, migrations, and documentation.

### Key Files
- `database/schema.sql` - Main database schema
- `database/add_document_types.sql` - Document types migration
- `database/cleanup_location_tables.sql` - Location cleanup
- `database/fix_worker_packages.sql` - Package fixes
- `database/DATABASE_DOCS.md` - Database documentation

**When to edit:** 
- Add new SQL migration files here
- Update schema.sql for new tables/columns

---

## 📝 Quick Reference: Where to Edit/Add Files

### Adding a New API Endpoint
1. **Backend Router**: Add endpoint in `backend/app/routers/[feature].py`
2. **Backend Schema**: Add request/response schemas in `backend/app/schemas/[feature].py`
3. **Backend Model**: Add database model in `backend/app/models_v2/[model].py` (if needed)
4. **Frontend Service**: Add API call in `frontend/src/services/[service].ts`
5. **Frontend Page/Component**: Use the service in `frontend/src/pages/` or `frontend/src/components/`

### Adding a New Frontend Page
1. Create page in `frontend/src/pages/[PageName].tsx`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link in `frontend/src/components/TabBar.tsx` (if needed)

### Adding a New Database Table
1. Create model in `backend/app/models_v2/[model].py`
2. Create migration in `backend/migrations/` or use Alembic
3. Update `database/schema.sql` (if maintaining SQL schema)

### Adding a New Admin Dashboard Page
1. Create page in `casaligan_web/app/(shell)/[page-name]/page.tsx`
2. Add component in `casaligan_web/app/components/[Component].tsx` (if needed)
3. Add query functions in `casaligan_web/lib/supabase/[queries].ts`
4. Add navigation link in `casaligan_web/app/(shell)/layout.tsx`

### Adding a New Reusable Component
- **Frontend**: `frontend/src/components/[Component].tsx`
- **Admin Web**: `casaligan_web/app/components/[Component].tsx`

### Configuration Changes
- **Backend Config**: `backend/app/config.py`
- **Frontend Config**: `frontend/src/config.ts`
- **Environment Variables**: `.env` files (not in repo, see README.md)

---

## 🔗 Key Relationships

### Backend → Frontend
- Backend API serves data to frontend via REST endpoints
- Frontend calls backend using `frontend/src/services/api.ts`

### Backend → Database
- Backend uses SQLAlchemy models (`backend/app/models_v2/`) to interact with PostgreSQL
- Database schema defined in `database/schema.sql`

### Casaligan Web → Database
- Admin dashboard uses Supabase client (`casaligan_web/lib/supabase/`) to query database directly
- Can also call backend API if needed

---

## 🚀 Development Workflow

1. **Backend Changes**: Edit files in `backend/app/`, restart FastAPI server
2. **Frontend Changes**: Edit files in `frontend/src/`, Vite hot-reloads automatically
3. **Admin Web Changes**: Edit files in `casaligan_web/app/`, Next.js hot-reloads automatically
4. **Database Changes**: Create migration, update models, run migration

---

## 📌 Important Notes

- **Never commit**: `node_modules/`, `venv/`, `.env` files
- **Backend runs on**: `http://localhost:8000`
- **Frontend runs on**: `http://localhost:5173`
- **Admin Web runs on**: `http://localhost:3000` (typical Next.js port)
- **Use pnpm** for frontend package management (not npm/yarn)
- **Use Python venv** for backend dependencies

---

This structure analysis should help you navigate the codebase and know exactly where to place or edit files for any new features or modifications!

