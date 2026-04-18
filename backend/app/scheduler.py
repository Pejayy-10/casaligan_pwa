"""
Background scheduler for Casaligan.

Jobs:
- promote_in_queue_jobs: Runs every day at midnight (server local time).
  Finds all forumposts with status='in_queue' whose start_date has been
  reached and flips them to 'ongoing'.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone
from sqlalchemy import text

# Lazy import to avoid circular dependencies at module load time
_scheduler: BackgroundScheduler | None = None


def promote_in_queue_jobs() -> None:
    """
    Sweeps the DB for in_queue jobs whose start_date has arrived and
    promotes them to 'ongoing'.  Runs inside its own DB session so it
    is fully independent of any request context.
    """
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        result = db.execute(
            text("""
                UPDATE forumposts
                SET    status     = 'ongoing',
                       updated_at = NOW()
                WHERE  status     = 'in_queue'
                AND    start_date IS NOT NULL
                AND    start_date::date <= CURRENT_DATE
            """)
        )
        db.commit()
        promoted = result.rowcount
        if promoted:
            print(f"[scheduler] ✓ Promoted {promoted} in_queue job(s) to ongoing "
                  f"at {datetime.now(timezone.utc).isoformat()}")
        else:
            print(f"[scheduler] ✓ No in_queue jobs to promote "
                  f"at {datetime.now(timezone.utc).isoformat()}")
    except Exception as e:
        db.rollback()
        print(f"[scheduler] ✗ Error promoting in_queue jobs: {e}")
    finally:
        db.close()


def start_scheduler() -> None:
    """Start the APScheduler background scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return  # Already running (e.g. uvicorn reload)

    _scheduler = BackgroundScheduler(timezone="UTC")

    # Run once at midnight UTC every day
    _scheduler.add_job(
        promote_in_queue_jobs,
        trigger=CronTrigger(hour=0, minute=0, second=0, timezone="UTC"),
        id="promote_in_queue_jobs",
        name="Promote in_queue → ongoing when start_date arrives",
        replace_existing=True,
    )

    # Also run immediately on startup to catch any jobs that were missed
    # while the server was down
    _scheduler.add_job(
        promote_in_queue_jobs,
        trigger="date",          # run-once, right now
        id="promote_in_queue_jobs_startup",
        name="Startup sweep: promote overdue in_queue jobs",
        replace_existing=True,
    )

    _scheduler.start()
    print("[scheduler] ✓ Background scheduler started (daily midnight UTC sweep)")


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler on app shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("[scheduler] Scheduler stopped")
