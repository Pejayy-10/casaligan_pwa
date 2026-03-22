# AI Chat Feature - Setup Instructions

## Overview
The AI Chat feature uses **Google Gemini AI** to provide intelligent housekeeper/job recommendations through natural language conversations.

## Features
- **For House Owners**: Find housekeepers by describing preferences (gender, location, skills, ratings)
- **For Housekeepers**: Find job opportunities by describing preferences (location, budget, job type)
- Conversational AI interface with card-based results
- Floating chat button on dashboard (bottom-right)
- Real-time matching from your database

## Setup

### 1. Get Gemini API Key (FREE)

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"** or **"Create API Key"**
4. Copy the generated API key

### 2. Add API Key to Backend

Edit `backend/.env` and replace the placeholder:

```env
GEMINI_API_KEY="your-actual-api-key-here"
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Restart Backend

Stop and restart your FastAPI backend server to load the new dependency.

## Usage

### For House Owners
Click the sparkle icon (✨) in the bottom-right of the dashboard and try:
- "Find me a female housekeeper in Manila"
- "I need someone experienced with good ratings"
- "Show me housekeepers who do deep cleaning"

### For Housekeepers
Click the sparkle icon (✨) and try:
- "Find me a job in Quezon City with good pay"
- "I'm looking for long-term work"
- "Show me jobs that pay more than ₱500"

## How It Works

1. **Natural Language Processing**: Gemini AI extracts filter criteria from user messages
2. **Database Matching**: Backend queries your actual database for workers/jobs
3. **Smart Results**: Returns relevant matches with details (ratings, location, skills, budget)
4. **Interactive Cards**: Click any result card to view full profile or job details

## API Endpoints

- `POST /chat` - AI chat endpoint
  - Request: `{ message: string, conversation_history: array }`
  - Response: `{ message: string, workers: array, jobs: array, is_recommendation: boolean }`

## Matching Criteria

### Worker Matching
- Gender
- Location (city, province, barangay)
- Minimum rating
- Skills/packages

### Job Matching
- Location
- Budget range
- Job type (short-term/long-term)
- House type, cleaning type
- Recurring schedule

## Free Tier Limits

Google Gemini Free Tier:
- 60 requests per minute
- Perfect for your use case!
- No credit card required

## Troubleshooting

**"AI not responding"**
- Check GEMINI_API_KEY is set correctly in backend/.env
- Verify backend can access google-generativeai package
- Check backend logs for errors

**"No matches found"**
- AI will respond conversationally even with no matches
- Try broader search criteria
- Check if workers/jobs exist in database

## Future Enhancements

You can later add:
- Age filter (add age field to users table)
- Religion filter (add religion field to users table)
- Experience level filter
- Availability filter
- Distance-based matching (using GPS coordinates)
