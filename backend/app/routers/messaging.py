from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import re

from app.db import get_db
from app.security import get_current_user
from app.models_v2.user import User
from app.models_v2.conversation import Conversation, Message, ConversationStatus
from app.models_v2.direct_hire import DirectHire, DirectHireStatus
from app.models_v2.forum import ForumPost

router = APIRouter(prefix="/messages", tags=["Messages"])


MESSAGE_POLICY_STRIKE_LIMIT = 3
MESSAGE_POLICY_BLOCK_MINUTES = 30
PROFANITY_WORDS = {
    "fuck", "shit", "bitch", "asshole", "motherfucker",
    "putangina", "gago", "tanga", "bobo", "ulol", "bwisit"
}
PERSONAL_INFO_PATTERNS = [
    ("email", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", re.IGNORECASE)),
    ("phone", re.compile(r"(\+?63\s?\d{3}\s?\d{3}\s?\d{4})|(\b09\d{9}\b)")),
    ("social_media", re.compile(r"\b(?:facebook|fb\.com|instagram|ig\b|telegram|whatsapp|viber|messenger)\b", re.IGNORECASE)),
    ("external_link", re.compile(r"https?://|www\.", re.IGNORECASE)),
]


# ============== SCHEMAS ==============

class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"


class MessageResponse(BaseModel):
    message_id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    message_type: str
    sent_at: str
    read_at: Optional[str]
    is_mine: bool


class ConversationCreate(BaseModel):
    hire_id: Optional[int] = None
    job_id: Optional[int] = None


class ConversationResponse(BaseModel):
    conversation_id: int
    job_id: Optional[int]
    hire_id: Optional[int]
    title: str
    status: str
    participant_ids: List[int]
    participant_names: List[str]
    other_participant_name: str
    last_message: Optional[str]
    last_message_time: Optional[str]
    unread_count: int
    created_at: str


class ConversationDetailResponse(BaseModel):
    conversation_id: int
    job_id: Optional[int]
    hire_id: Optional[int]
    title: str
    status: str
    participant_ids: List[int]
    participant_names: List[str]
    can_send_messages: bool
    messages: List[MessageResponse]


# ============== HELPER FUNCTIONS ==============

def get_conversation_title(conv: Conversation, db: Session) -> str:
    """Generate a title for the conversation based on job/hire"""
    if conv.title:
        return conv.title
    
    if conv.hire_id:
        hire = db.query(DirectHire).filter(DirectHire.hire_id == conv.hire_id).first()
        if hire:
            return f"Direct Hire #{hire.hire_id}"
    
    if conv.job_id:
        job = db.query(ForumPost).filter(ForumPost.post_id == conv.job_id).first()
        if job:
            return job.title or f"Job #{job.post_id}"
    
    return "Conversation"


def get_participant_names(participant_ids: List[int], db: Session) -> List[str]:
    """Get names for all participants"""
    users = db.query(User).filter(User.id.in_(participant_ids)).all()
    user_map = {u.id: f"{u.first_name} {u.last_name}" for u in users}
    return [user_map.get(pid, "Unknown") for pid in participant_ids]


def can_send_messages(conv: Conversation) -> bool:
    """Check if messages can be sent in this conversation"""
    return conv.status == 'active'


def _ensure_message_policy_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS messaging_policy_violations (
            user_id INTEGER PRIMARY KEY,
            violation_count INTEGER NOT NULL DEFAULT 0,
            blocked_until TIMESTAMPTZ NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    db.commit()


def _detect_policy_violations(content: str) -> List[str]:
    normalized_content = content.lower()
    violations: List[str] = []

    if any(re.search(rf"\b{re.escape(word)}\b", normalized_content) for word in PROFANITY_WORDS):
        violations.append("offensive language")

    for violation_type, pattern in PERSONAL_INFO_PATTERNS:
        if pattern.search(content):
            if violation_type in {"email", "phone", "social_media", "external_link"}:
                violations.append("personal contact information")
                break

    return violations


def _get_policy_state(db: Session, user_id: int):
    row = db.execute(
        text("""
            SELECT violation_count, blocked_until
            FROM messaging_policy_violations
            WHERE user_id = :user_id
        """),
        {"user_id": user_id}
    ).mappings().first()
    return row


def _record_policy_violation(db: Session, user_id: int):
    now_utc = datetime.now(timezone.utc)
    row = _get_policy_state(db, user_id)

    if not row:
        violation_count = 1
        blocked_until = None
        db.execute(
            text("""
                INSERT INTO messaging_policy_violations (user_id, violation_count, blocked_until, updated_at)
                VALUES (:user_id, :violation_count, :blocked_until, NOW())
            """),
            {
                "user_id": user_id,
                "violation_count": violation_count,
                "blocked_until": blocked_until,
            }
        )
        db.commit()
        return {
            "violation_count": violation_count,
            "blocked_until": blocked_until,
            "strikes_remaining": MESSAGE_POLICY_STRIKE_LIMIT - violation_count,
        }

    current_count = int(row["violation_count"] or 0)
    new_count = current_count + 1
    blocked_until = None

    if new_count >= MESSAGE_POLICY_STRIKE_LIMIT:
        blocked_until = now_utc + timedelta(minutes=MESSAGE_POLICY_BLOCK_MINUTES)
        new_count = 0

    db.execute(
        text("""
            UPDATE messaging_policy_violations
            SET violation_count = :violation_count,
                blocked_until = :blocked_until,
                updated_at = NOW()
            WHERE user_id = :user_id
        """),
        {
            "user_id": user_id,
            "violation_count": new_count,
            "blocked_until": blocked_until,
        }
    )
    db.commit()

    return {
        "violation_count": new_count,
        "blocked_until": blocked_until,
        "strikes_remaining": MESSAGE_POLICY_STRIKE_LIMIT - new_count,
    }


def check_conversation_status(conv: Conversation, db: Session):
    """Update conversation status based on job/hire status"""
    if conv.status == 'archived':
        return
    
    should_be_read_only = False
    
    if conv.hire_id:
        hire = db.query(DirectHire).filter(DirectHire.hire_id == conv.hire_id).first()
        if hire and hire.status in [DirectHireStatus.PAID, DirectHireStatus.CANCELLED]:
            should_be_read_only = True
    
    if conv.job_id:
        job = db.query(ForumPost).filter(ForumPost.post_id == conv.job_id).first()
        if job and job.status in ['completed', 'cancelled', 'closed']:
            should_be_read_only = True
    
    if should_be_read_only and conv.status == 'active':
        conv.status = 'read_only'
        db.commit()


# ============== ENDPOINTS ==============

@router.post("/conversations", response_model=ConversationResponse)
def create_or_get_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new conversation or get existing one for a job/hire"""
    
    if not data.hire_id and not data.job_id:
        raise HTTPException(status_code=400, detail="Either hire_id or job_id is required")
    
    # Check for existing conversation where current user is a participant
    if data.hire_id:
        existing = db.query(Conversation).filter(
            Conversation.hire_id == data.hire_id,
            Conversation.participant_ids.contains([current_user.id])
        ).first()
    else:
        # For jobs, find conversation with current user as participant
        existing = db.query(Conversation).filter(
            Conversation.job_id == data.job_id,
            Conversation.participant_ids.contains([current_user.id])
        ).first()
    
    if existing:
        return conversation_to_response(existing, current_user.id, db)
    
    # Create new conversation
    participant_ids = []
    
    if data.hire_id:
        hire = db.query(DirectHire).filter(DirectHire.hire_id == data.hire_id).first()
        if not hire:
            raise HTTPException(status_code=404, detail="Direct hire not found")
        
        # Only allow if hire is accepted or beyond
        if hire.status == DirectHireStatus.PENDING:
            raise HTTPException(status_code=400, detail="Cannot message until hire is accepted")
        
        # Get employer and worker user IDs
        from app.models_v2.worker_employer import Employer, Worker
        
        employer = db.query(Employer).filter(Employer.employer_id == hire.employer_id).first()
        worker = db.query(Worker).filter(Worker.worker_id == hire.worker_id).first()
        
        if employer and worker:
            participant_ids = [employer.user_id, worker.user_id]
    
    elif data.job_id:
        from app.models_v2.worker_employer import Employer, Worker
        from app.models_v2.forum import InterestCheck, InterestStatus
        
        job = db.query(ForumPost).filter(ForumPost.post_id == data.job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Get job owner
        employer = db.query(Employer).filter(Employer.employer_id == job.employer_id).first()
        if not employer:
            raise HTTPException(status_code=404, detail="Job owner not found")
        
        # Check if current user is the employer or an accepted worker
        if current_user.id == employer.user_id:
            # Owner is trying to message - need to find which worker
            # This shouldn't happen via frontend flow, but handle it
            raise HTTPException(status_code=400, detail="Please select a specific worker to message")
        else:
            # Worker is trying to message the employer
            # Verify this worker is accepted for this job
            worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
            if not worker:
                raise HTTPException(status_code=403, detail="Only accepted workers can message")
            
            accepted = db.query(InterestCheck).filter(
                InterestCheck.post_id == data.job_id,
                InterestCheck.worker_id == worker.worker_id,
                InterestCheck.status == InterestStatus.ACCEPTED
            ).first()
            
            if not accepted:
                raise HTTPException(status_code=403, detail="You must be accepted for this job to message")
            
            participant_ids = [employer.user_id, current_user.id]
    
    if current_user.id not in participant_ids:
        raise HTTPException(status_code=403, detail="You are not part of this job/hire")
    
    conversation = Conversation(
        job_id=data.job_id,
        hire_id=data.hire_id,
        participant_ids=participant_ids,
        status='active'
    )
    
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    
    # Add system message
    system_message = Message(
        conversation_id=conversation.conversation_id,
        sender_id=current_user.id,
        content="Conversation started",
        message_type="system"
    )
    db.add(system_message)
    db.commit()
    
    return conversation_to_response(conversation, current_user.id, db)


@router.get("/conversations", response_model=List[ConversationResponse])
def get_my_conversations(
    status: Optional[str] = None,
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all conversations for the current user"""
    
    # Find conversations where user is a participant
    query = db.query(Conversation).filter(
        Conversation.participant_ids.contains([current_user.id])
    )
    
    # Filter by status if provided
    if status:
        valid_statuses = ['active', 'read_only', 'archived']
        if status in valid_statuses:
            query = query.filter(Conversation.status == status)
    elif not include_archived:
        # By default, exclude archived conversations
        query = query.filter(Conversation.status != ConversationStatus.ARCHIVED)
    
    conversations = query.order_by(Conversation.updated_at.desc()).all()
    
    if not conversations:
        return []
    
    # Update status for each conversation based on job/hire status
    for conv in conversations:
        check_conversation_status(conv, db)
    
    conv_ids = [c.conversation_id for c in conversations]
    
    # Batch: collect all participant IDs and fetch users in one query
    all_participant_ids = set()
    for c in conversations:
        all_participant_ids.update(c.participant_ids)
    users = db.query(User).filter(User.id.in_(all_participant_ids)).all()
    user_map = {u.id: f"{u.first_name} {u.last_name}" for u in users}
    
    # Batch: fetch all job/hire titles in one query each
    job_ids = [c.job_id for c in conversations if c.job_id]
    hire_ids = [c.hire_id for c in conversations if c.hire_id]
    
    job_title_map: dict = {}
    if job_ids:
        jobs = db.query(ForumPost.post_id, ForumPost.title).filter(ForumPost.post_id.in_(job_ids)).all()
        job_title_map = {j.post_id: (j.title or f"Job #{j.post_id}") for j in jobs}
    
    hire_title_map: dict = {}
    if hire_ids:
        hires = db.query(DirectHire.hire_id).filter(DirectHire.hire_id.in_(hire_ids)).all()
        hire_title_map = {h.hire_id: f"Direct Hire #{h.hire_id}" for h in hires}
    
    # Batch: get last message for each conversation using a subquery
    from sqlalchemy.orm import aliased
    last_msg_subq = (
        db.query(
            Message.conversation_id,
            func.max(Message.message_id).label("max_id")
        )
        .filter(
            Message.conversation_id.in_(conv_ids),
            Message.deleted_at.is_(None)
        )
        .group_by(Message.conversation_id)
        .subquery()
    )
    last_messages_rows = (
        db.query(Message)
        .join(last_msg_subq, and_(
            Message.message_id == last_msg_subq.c.max_id
        ))
        .all()
    )
    last_msg_map = {m.conversation_id: m for m in last_messages_rows}
    
    # Batch: get unread counts per conversation in one query
    unread_rows = (
        db.query(
            Message.conversation_id,
            func.count(Message.message_id).label("cnt")
        )
        .filter(
            Message.conversation_id.in_(conv_ids),
            Message.sender_id != current_user.id,
            Message.read_at.is_(None),
            Message.deleted_at.is_(None)
        )
        .group_by(Message.conversation_id)
        .all()
    )
    unread_map = {row.conversation_id: row.cnt for row in unread_rows}
    
    # Build responses without extra queries
    results = []
    for conv in conversations:
        participant_names = [user_map.get(pid, "Unknown") for pid in conv.participant_ids]
        other_names = [user_map.get(pid, "Unknown") for pid in conv.participant_ids if pid != current_user.id]
        other_participant_name = ", ".join(other_names) if other_names else "Unknown"
        
        # Title
        title = conv.title
        if not title:
            if conv.hire_id and conv.hire_id in hire_title_map:
                title = hire_title_map[conv.hire_id]
            elif conv.job_id and conv.job_id in job_title_map:
                title = job_title_map[conv.job_id]
            else:
                title = "Conversation"
        
        last_msg = last_msg_map.get(conv.conversation_id)
        unread_count = unread_map.get(conv.conversation_id, 0)
        
        results.append(ConversationResponse(
            conversation_id=conv.conversation_id,
            job_id=conv.job_id,
            hire_id=conv.hire_id,
            title=title,
            status=conv.status if isinstance(conv.status, str) else conv.status.value,
            participant_ids=conv.participant_ids,
            participant_names=participant_names,
            other_participant_name=other_participant_name,
            last_message=last_msg.content if last_msg else None,
            last_message_time=last_msg.sent_at.isoformat() if last_msg and last_msg.sent_at else None,
            unread_count=unread_count,
            created_at=conv.created_at.isoformat() if conv.created_at else ""
        ))
    
    return results


@router.post("/conversations/{conversation_id}/archive")
def archive_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Archive a conversation"""
    conversation = db.query(Conversation).filter(
        Conversation.conversation_id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user.id not in conversation.participant_ids:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    conversation.status = ConversationStatus.ARCHIVED
    conversation.archived_at = func.now()
    db.commit()
    
    return {"message": "Conversation archived"}


@router.post("/conversations/{conversation_id}/unarchive")
def unarchive_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unarchive a conversation"""
    conversation = db.query(Conversation).filter(
        Conversation.conversation_id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user.id not in conversation.participant_ids:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    conversation.status = ConversationStatus.ACTIVE
    conversation.archived_at = None
    db.commit()
    
    return {"message": "Conversation unarchived"}


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific conversation with messages"""
    
    conversation = db.query(Conversation).filter(
        Conversation.conversation_id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user.id not in conversation.participant_ids:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    # Check and update status
    check_conversation_status(conversation, db)
    
    # Get messages
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.deleted_at.is_(None)
    ).order_by(Message.sent_at.asc()).all()
    
    # Mark messages as read
    unread_messages = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id != current_user.id,
        Message.read_at.is_(None)
    ).all()
    
    for msg in unread_messages:
        msg.read_at = func.now()
    db.commit()
    
    participant_names = get_participant_names(conversation.participant_ids, db)
    
    return ConversationDetailResponse(
        conversation_id=conversation.conversation_id,
        job_id=conversation.job_id,
        hire_id=conversation.hire_id,
        title=get_conversation_title(conversation, db),
        status=conversation.status.value,
        participant_ids=conversation.participant_ids,
        participant_names=participant_names,
        can_send_messages=can_send_messages(conversation),
        messages=[message_to_response(m, current_user.id, db) for m in messages]
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
def send_message(
    conversation_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message in a conversation"""
    
    conversation = db.query(Conversation).filter(
        Conversation.conversation_id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user.id not in conversation.participant_ids:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")

    _ensure_message_policy_table(db)
    policy_state = _get_policy_state(db, current_user.id)
    now_utc = datetime.now(timezone.utc)
    if policy_state and policy_state["blocked_until"] and policy_state["blocked_until"] > now_utc:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "MESSAGE_POLICY_BLOCKED",
                "security_message": "Casaligan Security: Your chat is temporarily blocked due to repeated policy violations.",
                "blocked_until": policy_state["blocked_until"].isoformat(),
            }
        )
    
    # Check status
    check_conversation_status(conversation, db)
    
    if not can_send_messages(conversation):
        raise HTTPException(status_code=400, detail="This conversation is read-only")
    
    if not message_data.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    violations = _detect_policy_violations(message_data.content.strip())
    if violations:
        violation_state = _record_policy_violation(db, current_user.id)
        blocked_until = violation_state.get("blocked_until")
        if blocked_until:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "MESSAGE_POLICY_BLOCKED",
                    "security_message": "Casaligan Security: Message not sent. Repeated violations triggered a temporary chat block.",
                    "violations": violations,
                    "blocked_until": blocked_until.isoformat(),
                }
            )

        raise HTTPException(
            status_code=400,
            detail={
                "code": "MESSAGE_POLICY_VIOLATION",
                "security_message": "Casaligan Security: Message not sent because it contains restricted content.",
                "violations": violations,
                "strikes_remaining": violation_state.get("strikes_remaining", 0),
                "warning": "If violations continue, chat will be temporarily blocked."
            }
        )
    
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=message_data.content.strip(),
        message_type=message_data.message_type
    )
    
    db.add(message)
    
    # Update conversation timestamp
    conversation.updated_at = func.now()
    
    db.commit()
    db.refresh(message)
    
    return message_to_response(message, current_user.id, db)


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: int,
    since: Optional[str] = None,  # ISO timestamp to get messages after
    limit: int = Query(default=50, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages in a conversation (for polling)"""
    
    conversation = db.query(Conversation).filter(
        Conversation.conversation_id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if current_user.id not in conversation.participant_ids:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    query = db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.deleted_at.is_(None)
    )
    
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
            query = query.filter(Message.sent_at > since_dt)
        except ValueError:
            pass
    
    messages = query.order_by(Message.sent_at.asc()).limit(limit).all()
    
    # Mark as read
    for msg in messages:
        if msg.sender_id != current_user.id and not msg.read_at:
            msg.read_at = func.now()
    db.commit()
    
    return [message_to_response(m, current_user.id, db) for m in messages]


@router.get("/unread-count")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total unread message count for the user"""
    
    # Get conversation IDs where user is a participant
    conv_ids = [
        c.conversation_id for c in
        db.query(Conversation.conversation_id).filter(
            Conversation.participant_ids.contains([current_user.id])
        ).all()
    ]
    
    if not conv_ids:
        return {"unread_count": 0}
    
    # Single query to count all unread messages across all conversations
    total_unread = db.query(func.count(Message.message_id)).filter(
        Message.conversation_id.in_(conv_ids),
        Message.sender_id != current_user.id,
        Message.read_at.is_(None),
        Message.deleted_at.is_(None)
    ).scalar() or 0
    
    return {"unread_count": total_unread}


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a message (only sender can delete)"""
    
    message = db.query(Message).filter(Message.message_id == message_id).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    
    message.deleted_at = func.now()
    message.content = "[Message deleted]"
    db.commit()
    
    return {"message": "Message deleted"}


# ============== RESPONSE BUILDERS ==============

def conversation_to_response(conv: Conversation, current_user_id: int, db: Session) -> ConversationResponse:
    """Convert conversation to response"""
    
    participant_names = get_participant_names(conv.participant_ids, db)
    
    # Get other participant name
    other_names = []
    for i, pid in enumerate(conv.participant_ids):
        if pid != current_user_id:
            other_names.append(participant_names[i])
    other_participant_name = ", ".join(other_names) if other_names else "Unknown"
    
    # Get last message
    last_message = db.query(Message).filter(
        Message.conversation_id == conv.conversation_id,
        Message.deleted_at.is_(None)
    ).order_by(Message.sent_at.desc()).first()
    
    # Count unread
    unread_count = db.query(Message).filter(
        Message.conversation_id == conv.conversation_id,
        Message.sender_id != current_user_id,
        Message.read_at.is_(None),
        Message.deleted_at.is_(None)
    ).count()
    
    return ConversationResponse(
        conversation_id=conv.conversation_id,
        job_id=conv.job_id,
        hire_id=conv.hire_id,
        title=get_conversation_title(conv, db),
        status=conv.status if isinstance(conv.status, str) else conv.status.value,
        participant_ids=conv.participant_ids,
        participant_names=participant_names,
        other_participant_name=other_participant_name,
        last_message=last_message.content if last_message else None,
        last_message_time=last_message.sent_at.isoformat() if last_message and last_message.sent_at else None,
        unread_count=unread_count,
        created_at=conv.created_at.isoformat() if conv.created_at else ""
    )


def message_to_response(msg: Message, current_user_id: int, db: Session) -> MessageResponse:
    """Convert message to response"""
    
    sender = db.query(User).filter(User.id == msg.sender_id).first()
    sender_name = f"{sender.first_name} {sender.last_name}" if sender else "Unknown"
    
    return MessageResponse(
        message_id=msg.message_id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_name=sender_name,
        content=msg.content,
        message_type=msg.message_type,
        sent_at=msg.sent_at.isoformat() if msg.sent_at else "",
        read_at=msg.read_at.isoformat() if msg.read_at else None,
        is_mine=msg.sender_id == current_user_id
    )
