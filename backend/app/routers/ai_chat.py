"""AI Chat Router - Gemini-powered worker/job recommendations"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, String, cast
from pydantic import BaseModel
from typing import List, Optional
from app.db import get_db
from app.security import get_current_user
from app.models_v2.user import User
from app.models_v2.worker_employer import Worker
from app.models_v2.forum import ForumPost, ForumPostStatus
from app.models_v2.rating import Rating
from app.models_v2.address import Address
from app.models_v2.package import WorkerPackage
from app.models_v2.category import PackageCategory
from app.models_v2.job_category_mapping import job_category_mapping
import google.generativeai as genai
import os
import json
import re

router = APIRouter()

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class ChatMessage(BaseModel):
    message: str
    conversation_history: List[dict] = []

class WorkerCard(BaseModel):
    worker_id: int
    user_id: int
    name: str
    gender: Optional[str]
    location: str
    avg_rating: float
    total_ratings: int
    skills: List[str]
    packages: List[dict]

class JobCard(BaseModel):
    post_id: int
    title: str
    description: str
    location: str
    budget: float
    house_type: str
    cleaning_type: str
    job_type: str
    categories: List[str]
    employer_name: str
    is_recurring: bool
    schedule: Optional[str]

class ChatResponse(BaseModel):
    message: str
    workers: List[WorkerCard] = []
    jobs: List[JobCard] = []
    is_recommendation: bool = False


def get_worker_recommendations(db: Session, filters: dict, limit: int = 10) -> List[WorkerCard]:
    """Get worker recommendations based on filters"""
    
    # Start with base query
    query = db.query(
        Worker,
        User,
        Address,
        func.coalesce(func.avg(Rating.rating), 0).label('avg_rating'),
        func.count(Rating.review_id).label('rating_count')
    ).join(
        User, Worker.user_id == User.id
    ).outerjoin(
        Address, User.id == Address.user_id
    ).outerjoin(
        Rating, and_(
            Rating.target_user_id == User.id,
            Rating.is_hidden == False
        )
    )
    
    # If skills filter exists, join with packages and categories
    if filters.get('skills') and len(filters['skills']) > 0:
        query = query.join(
            WorkerPackage, Worker.worker_id == WorkerPackage.worker_id
        ).join(
            PackageCategory, WorkerPackage.category_id == PackageCategory.category_id
        ).filter(
            func.lower(PackageCategory.name).in_([s.lower() for s in filters['skills']])
        )
    
    query = query.filter(
        User.is_housekeeper == True,
        User.status == 'active'
    ).group_by(Worker.worker_id, User.id, Address.address_id)
    
    # Apply other filters
    if filters.get('gender'):
        gender_value = filters['gender'].lower()
        # Cast ENUM to text before using lower()
        query = query.filter(func.lower(cast(User.gender, String)) == gender_value)
    
    if filters.get('location'):
        loc = filters['location'].lower()
        query = query.filter(
            or_(
                func.lower(Address.city_name).contains(loc),
                func.lower(Address.province_name).contains(loc),
                func.lower(Address.barangay_name).contains(loc)
            )
        )
    
    if filters.get('min_rating'):
        query = query.having(func.coalesce(func.avg(Rating.rating), 0) >= filters['min_rating'])
    
    results = query.order_by(func.coalesce(func.avg(Rating.rating), 0).desc()).limit(limit).all()
    
    workers = []
    for worker, user, address, avg_rating, rating_count in results:
        # Get worker skills/packages
        packages_data = db.query(WorkerPackage, PackageCategory).join(
            PackageCategory, WorkerPackage.category_id == PackageCategory.category_id
        ).filter(WorkerPackage.worker_id == worker.worker_id).all()
        
        skills = list(set([cat.name for _, cat in packages_data]))
        packages = [{"name": pkg.name, "price": float(pkg.price)} for pkg, _ in packages_data]
        
        location_str = address.city_name if address else "Unknown"
        if address and address.barangay_name:
            location_str = f"{address.barangay_name}, {address.city_name}"
        
        workers.append(WorkerCard(
            worker_id=worker.worker_id,
            user_id=user.id,
            name=f"{user.first_name} {user.last_name}",
            gender=user.gender.value if user.gender else None,
            location=location_str,
            avg_rating=round(float(avg_rating), 2),
            total_ratings=int(rating_count),
            skills=skills,
            packages=packages
        ))
    
    return workers


def get_job_recommendations(db: Session, filters: dict, limit: int = 10) -> List[JobCard]:
    """Get job recommendations based on filters"""
    query = db.query(ForumPost, User).join(
        User, ForumPost.user_id == User.id
    ).filter(
        ForumPost.status == ForumPostStatus.OPEN,
        ForumPost.deleted_at.is_(None)
    )
    
    # Apply filters
    if filters.get('location'):
        loc = filters['location'].lower()
        query = query.filter(func.lower(ForumPost.location).contains(loc))
    
    if filters.get('min_budget'):
        query = query.filter(ForumPost.salary >= filters['min_budget'])
    
    if filters.get('max_budget'):
        query = query.filter(ForumPost.salary <= filters['max_budget'])
    
    if filters.get('job_type'):
        is_longterm = filters['job_type'].lower() in ['longterm', 'long-term', 'long_term']
        query = query.filter(ForumPost.is_longterm == is_longterm)
    
    results = query.order_by(ForumPost.created_at.desc()).limit(limit).all()
    
    jobs = []
    for post, user in results:
        # Parse content JSON for house_type, cleaning_type
        try:
            content_data = json.loads(post.content) if post.content.startswith('{') else {}
        except:
            content_data = {}
        
        # Get categories
        categories = db.query(PackageCategory).join(
            job_category_mapping, PackageCategory.category_id == job_category_mapping.c.category_id
        ).filter(job_category_mapping.c.post_id == post.post_id).all()
        category_names = [cat.name for cat in categories]
        
        schedule_str = None
        if post.is_recurring and post.day_of_week:
            schedule_str = f"{post.day_of_week.capitalize()} {post.start_time}-{post.end_time}"
        
        jobs.append(JobCard(
            post_id=post.post_id,
            title=post.title,
            description=content_data.get('description', post.content[:200]),
            location=post.location,
            budget=float(post.salary),
            house_type=content_data.get('house_type', 'house'),
            cleaning_type=content_data.get('cleaning_type', 'general'),
            job_type='long_term' if post.is_longterm else 'short_term',
            categories=category_names,
            employer_name=f"{user.first_name} {user.last_name}",
            is_recurring=post.is_recurring or False,
            schedule=schedule_str
        ))
    
    return jobs


def extract_filters_from_text(text: str, role: str) -> dict:
    """Extract filter criteria from natural language using Gemini"""
    if not GEMINI_API_KEY:
        return {}
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        if role == "owner":
            prompt = f"""Extract filters for finding housekeepers from this request: "{text}"

Return JSON with these optional fields:
- gender: "male" or "female" (only if explicitly mentioned)
- location: city/province/barangay name (if mentioned)
- min_rating: number 1-5 (if quality/rating mentioned)
- skills: array of skills (cleaning, cooking, laundry, etc.)

Only extract what's explicitly or clearly implied. Return empty {{}} if no specific criteria.
Response must be valid JSON only, no extra text."""
        else:  # housekeeper
            prompt = f"""Extract filters for finding jobs from this request: "{text}"

Return JSON with these optional fields:
- location: city/province name (if mentioned)
- min_budget: number (if salary/budget minimum mentioned)
- max_budget: number (if salary/budget maximum mentioned)
- job_type: "short_term" or "long_term" (if duration mentioned)
- cleaning_type: "general", "deep_cleaning", "move_in_out", etc. (if mentioned)

Only extract what's explicitly or clearly implied. Return empty {{}} if no specific criteria.
Response must be valid JSON only, no extra text."""
        
        response = model.generate_content(prompt)
        # Extract JSON from response
        text_response = response.text.strip()
        # Remove markdown code blocks if present
        text_response = re.sub(r'^```json\s*', '', text_response)
        text_response = re.sub(r'\s*```$', '', text_response)
        
        filters = json.loads(text_response)
        return filters
    except Exception as e:
        return {}


def generate_ai_response(user_message: str, role: str, conversation_history: List[dict], 
                        workers: List[WorkerCard] = None, jobs: List[JobCard] = None) -> str:
    """Generate conversational response using Gemini"""
    if not GEMINI_API_KEY:
        if role == "owner":
            return "I'm here to help you find housekeepers! Tell me what you're looking for."
        else:
            return "I'm here to help you find jobs! Tell me what kind of work you prefer."
    
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Build context
        history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in conversation_history[-4:]])
        
        if role == "owner":
            system_context = """You are a helpful AI assistant for Casaligan, a housekeeping service platform.
You help homeowners find and hire housekeepers. Be friendly, conversational, and helpful.
You can answer general questions about the platform, housekeeping services, or just chat.
When showing recommendations, keep responses brief (1-2 sentences).
Use a warm, professional tone."""
            
            if workers:
                prompt = f"""{system_context}

Conversation history:
{history_text}

User: {user_message}

You found {len(workers)} housekeeper{'s' if len(workers) != 1 else ''} matching their request.
Write a brief, enthusiastic response (1-2 sentences) acknowledging their request.
Don't describe the workers - they'll see recommendation cards below."""
            else:
                prompt = f"""{system_context}

Conversation history:
{history_text}

User: {user_message}

Respond naturally and helpfully. If they're asking for recommendations, ask clarifying questions to understand their needs (gender preference, skills needed, location, etc.). 
If they're asking general questions or just chatting, answer helpfully. Keep responses concise (2-3 sentences)."""
        
        else:  # housekeeper
            system_context = """You are a helpful AI assistant for Casaligan, a housekeeping service platform.
You help housekeepers find job opportunities. Be friendly, encouraging, and supportive.
You can answer questions about job searching, the platform, or just chat.
When showing job recommendations, keep responses brief (1-2 sentences).
Use a warm, encouraging tone."""
            
            if jobs:
                prompt = f"""{system_context}

Conversation history:
{history_text}

User: {user_message}

You found {len(jobs)} job opportunity{'ies' if len(jobs) != 1 else 'y'} matching their request.
Write a brief, encouraging response (1-2 sentences) letting them know you've found opportunities.
Don't describe the jobs - they'll see job cards below."""
            else:
                prompt = f"""{system_context}

Conversation history:
{history_text}

User: {user_message}

Respond naturally and helpfully. If they're looking for jobs, ask what they're looking for (location, salary range, job type, etc.).
If they're asking general questions or just chatting, answer supportively. Keep responses concise (2-3 sentences)."""
        
        response = model.generate_content(prompt)
        return response.text.strip()
        
    except Exception as e:
        print(f"AI response error: {e}")
        if role == "owner":
            if workers:
                return f"Great news! I found {len(workers)} housekeeper{'s' if len(workers) != 1 else ''} who match what you're looking for. Check them out below!"
            return "I'm here to help you find the perfect housekeeper! Tell me what you're looking for - maybe specific skills, location, or gender preference?"
        else:
            if jobs:
                return f"Excellent! I found {len(jobs)} job opportunity{'ies' if len(jobs) != 1 else 'y'} for you. Take a look below!"
            return "I'm here to help you find great job opportunities! What kind of work are you interested in? Let me know about location, salary expectations, or job type."


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    request: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """AI-powered chat for worker/job recommendations"""
    
    role = "owner" if current_user.is_owner and current_user.active_role == "owner" else "housekeeper"
    
    # Check if message is asking for recommendations
    asking_for_recommendation = any(keyword in request.message.lower() for keyword in [
        'find', 'look', 'search', 'recommend', 'suggest', 'show', 'get me', 'need'
    ])
    
    workers = []
    jobs = []
    is_recommendation = False
    
    if asking_for_recommendation:
        # Extract filters from natural language
        filters = extract_filters_from_text(request.message, role)
        
        if role == "owner":
            # Find workers
            workers = get_worker_recommendations(db, filters, limit=10)
            is_recommendation = len(workers) > 0
        else:
            # Find jobs
            jobs = get_job_recommendations(db, filters, limit=10)
            is_recommendation = len(jobs) > 0
    
    # Generate AI response
    ai_message = generate_ai_response(
        request.message, 
        role, 
        request.conversation_history,
        workers=workers if workers else None,
        jobs=jobs if jobs else None
    )
    
    return ChatResponse(
        message=ai_message,
        workers=workers,
        jobs=jobs,
        is_recommendation=is_recommendation
    )
