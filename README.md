# 🏠 Casaligan - Home Services Platform

A trusted gig platform connecting housekeepers with house owners in the Philippines. Built as a Progressive Web App (PWA) with mobile-first design.

## ✨ Features

- **Multi-role System** - Users can be both house owners and housekeepers
- **Direct Hiring** - Browse worker profiles and hire directly
- **Job Posting** - Create job listings for housekeeping services
- **Real-time Messaging** - In-app chat between owners and workers
- **Package System** - Workers can create service packages with pricing
- **Ratings & Reviews** - 5-star rating system with text reviews
- **Progress Tracking** - Track job status from accepted to paid
- **Payment Verification** - Upload payment proofs (GCash, bank transfer)
- **Notifications** - Real-time notifications for job updates
- **Mobile-First Design** - Optimized for mobile with Capacitor support

## 🛠 Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database operations
- **PostgreSQL** - Database (Supabase)
- **JWT** - Authentication
- **Cloudinary** - Image uploads

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **React Router v6** - Navigation
- **Capacitor** - Native mobile app support
- **Lucide React** - Icons

## 📋 Prerequisites

Before you begin, ensure you have installed:

- **Python 3.11+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **pnpm** - Package manager for frontend

### Installing pnpm

```bash
# Using npm (comes with Node.js)
npm install -g pnpm

# Or using Corepack (recommended, comes with Node.js 16.13+)
corepack enable
corepack prepare pnpm@latest --activate

# Verify installation
pnpm --version
```

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Pejayy-10/casaligan_pwa.git
cd casaligan_pwa
```

### 2. Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your database credentials
# (see Environment Variables section below)

# Run the backend server
python -m uvicorn app.main:app --reload --port 8000
```

Backend will run at: **http://localhost:8000**

API Documentation: **http://localhost:8000/docs**

### 3. Frontend Setup

```bash
# Navigate to frontend folder (from project root)
cd frontend

# Install dependencies using pnpm (NOT npm or yarn!)
pnpm install

# Create .env file
# (see Environment Variables section below)

# Run the development server
pnpm dev
```

Frontend will run at: **http://localhost:5173**

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
```

## 📱 Mobile Development (Capacitor)

```bash
cd frontend

# Build the web app
pnpm build

# Sync with native projects
pnpm cap sync

# Open in Android Studio
pnpm cap open android

# Or run directly on device
pnpm cap run android
```

## 📁 Project Structure

```
casaligan_pwa/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Configuration
│   │   ├── db.py                # Database connection
│   │   ├── security.py          # JWT & auth utilities
│   │   ├── models_v2/           # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── routers/             # API routes
│   │   └── services/            # Business logic
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/               # Page components
│   │   ├── components/          # Reusable components
│   │   ├── services/            # API services
│   │   └── types/               # TypeScript types
│   ├── android/                 # Capacitor Android project
│   └── package.json
│
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user
- `POST /auth/switch-role` - Switch role

### Jobs
- `GET /jobs` - List jobs
- `POST /jobs` - Create job
- `POST /jobs/{id}/apply` - Apply to job

### Direct Hires
- `POST /direct-hires` - Create direct hire
- `GET /direct-hires` - List hires
- `POST /direct-hires/{id}/accept` - Accept hire

### Messaging
- `GET /messages/conversations` - List conversations
- `POST /messages/conversations` - Start conversation
- `GET /messages/conversations/{id}/messages` - Get messages
- `POST /messages/conversations/{id}/messages` - Send message

### Ratings
- `POST /ratings` - Submit rating
- `GET /ratings/worker/{id}` - Get worker ratings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is for educational purposes.

## 👥 Authors

- **Pejayy-10** - Initial work

---

⭐ Star this repo if you find it helpful!
