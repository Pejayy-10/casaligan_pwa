# Schedule Conflict Feature - Complete Implementation Summary

## Overview
A comprehensive schedule conflict management system has been implemented to prevent housekeepers from double-booking across three job types: Job Posts, Direct Hires, and Recurring Services.

## Feature Behavior

### Three Job Types Covered
1. **Job Posts** - Standard job postings by employers
2. **Direct Hires** - Direct job requests from employers
3. **Recurring Services** - Jobs that repeat weekly/biweekly/monthly

### Key Rules
- ✅ Housekeepers CAN apply/be hired for jobs with same dates (no blocking at application)
- ✅ Once accepted to ANY job, conflicting pending applications are automatically WITHDRAWN
- ✅ Workers CANNOT re-apply to jobs withdrawn due to schedule conflicts
- ✅ Workers CANNOT be hired for jobs that conflict with accepted jobs
- ✅ Same-employer exception: Can have multiple jobs with same employer (assumed they know about it)
- ✅ Recurring day matching: Recurring jobs check if they're on the same day of week

## Affected Endpoints

### 1. Job Posts - Accept Applicant
**Endpoint:** `POST /jobs/{post_id}/start-job`
**Changes Made:**
- When accepting applicants, detects conflicts with:
  - Other pending job applications (same/different dates)
  - Accepted direct hires (same/different dates)
  - Active recurring services (same day of week)
- Automatically withdraws conflicting pending job applications with notifications:
  - `withdrawn_due_to_conflict = TRUE` flag set
  - Notification sent to worker about withdrawn applications
  - Notification sent to other employers about applicant withdrawal

### 2. Direct Hire - Accept Hire
**Endpoint:** `POST /direct_hires/{hire_id}/accept`
**Changes Made:**
- When accepting a direct hire, detects conflicts with:
  - Job post applications (same/different dates)
  - Other accepted jobs or hires
  - Active recurring services
- If conflict with accepted job → Hire is REJECTED (not auto-withdrawn)
- If conflict detected, auto-withdraws pending job applications from OTHER employers:
  - `withdrawn_due_to_conflict = TRUE` flag set
  - Notifications sent to worker and affected employers

### 3. Application Status Check
**Endpoint:** `GET /jobs/application-statuses/bulk`
**Changes Made:**
- Returns per-application info including:
  - `withdrawn_due_to_conflict` - whether withdrawal was due to conflict
  - `can_reapply` - whether worker can re-apply
- Logic for `can_reapply`:
  - FALSE if withdrawn due to explicit conflict flag
  - FALSE if worker has accepted job with overlapping date/day
  - TRUE if rejected for other reasons (e.g., job edit rejection)

## Database Changes

### New Column Added
**Table:** `interestcheck`
**Column:** `withdrawn_due_to_conflict` (BOOLEAN, DEFAULT FALSE)
- Tracks if application withdrawal was due to schedule conflict
- Allows frontend to show "Cannot Re-apply - Schedule Conflict" message

**Migration File:** `backend/migrations/add_withdrawn_due_to_conflict_tracking.sql`
```sql
ALTER TABLE interestcheck 
ADD COLUMN IF NOT EXISTS withdrawn_due_to_conflict BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_interestcheck_withdrawn_due_to_conflict 
ON interestcheck(worker_id, withdrawn_due_to_conflict);
```

## Frontend Changes

### Updated Components

**1. JobDetailModal.tsx**
- Added `withdrawnDueToConflict` prop
- Shows disabled button "Cannot Re-apply - Schedule Conflict" when flag is true
- Regular "Re-apply to this Job" button shown for other withdrawals

**2. JobsPage.tsx**
- Updated TypeScript types to include `withdrawn_due_to_conflict` field
- Passes the flag from backend response to JobDetailModal

**3. Button States**
- ✅ Can Apply: Shows "Apply to this Job" button
- ✅ Pending: Shows "Application Pending" status
- ✅ Accepted: Shows "Application Accepted" status (green)
- ❌ Withdrawn (Conflict): Shows "Cannot Re-apply - Schedule Conflict" (disabled gray button)
- ❌ Withdrawn (Other): Shows "Re-apply to this Job" button
- ❌ Rejected: Shows "Application Rejected" status (red)

## Conflict Detection Logic

### Date Overlapping
- Checks if two date ranges overlap or touch
- Example: Job A (Jan 1-3) conflicts with Job B (Jan 2-4) → Overlapping

### Recurring Day Matching
- Compares day of week for recurring jobs
- Example: Job A (recurring, Monday) conflicts with Job B (recurring, Monday) → Conflict
- Different days have no conflict even if recurring

### Same Employer Exception
- If both jobs are from the same employer, NO conflict is detected
- Assumption: Employer knows about scheduling and wants to assign multiple tasks

### Job Types Checked
When accepting a job, the system checks conflicts with:
1. ✅ Accepted job posts (through contracts)
2. ✅ Accepted direct hires
3. ✅ Accepted recurring services
4. ✅ Pending job applications
5. ✅ Pending direct hires

## Notification Types Added

Four new notification types added to track conflicts:
1. `application_withdrawn_due_to_conflict` - Worker notified their app was withdrawn
2. `applicant_withdrawn_due_to_conflict` - Employer notified applicant withdrew due to conflict
3. `direct_hire_rejected_due_to_conflict` - Employer notified hire was rejected due to conflict
4. `hire_canceled_worker_accepted_conflict` - Employer notified worker accepted conflicting job

## Services Updated

**Schedule Conflict Service** (`backend/app/services/schedule_conflict_service.py`)
- `detect_schedule_conflicts()` - Main conflict detection function
- `get_housekeeper_jobs()` - Retrieves all worker's active jobs
- `withdraw_conflicting_applications()` - Auto-withdraws with flag setting
- `parse_date_string()` - Parses various date formats
- `check_dates_overlap()` - Checks date range overlap
- `check_day_overlap()` - Checks day of week match

**Notification Service** (`backend/app/services/notification_service.py`)
- Functions for each conflict notification type
- Sends notifications to affected workers and employers

## Flow Diagrams

### Scenario 1: Job Post Acceptance with Conflict
```
Worker applies to:
  ├─ Job A (Jan 1, Employer X) → PENDING
  └─ Job B (Jan 1, Employer Y) → PENDING

Employer X accepts worker for Job A:
  ├─ Job A → ACCEPTED
  └─ Job B → REJECTED (withdrawn_due_to_conflict = true)
       ├─ Worker notified: "Your app to Job B withdrawn due to accepting Job A"
       └─ Employer Y notified: "Worker accepted conflicting job"

Worker tries to re-apply to Job B:
  └─ Cannot Re-apply button (disabled)
```

### Scenario 2: Direct Hire Acceptance with Conflict
```
Employer X requests direct hire → PENDING
Worker has pending application to Job Y (same date)

Worker accepts Employer X's direct hire:
  ├─ Hire → ACCEPTED
  └─ Job Y application → REJECTED (withdrawn_due_to_conflict = true)
       ├─ Worker notified: "Your app to Job Y withdrawn due to accepting direct hire"
       └─ Employer Y notified: "Worker accepted conflicting job"
```

### Scenario 3: Recurring Service Conflict
```
Worker has recurring service every Monday with Employer X
Employer Y tries to accept worker for a job on Monday:
  └─ Hire → REJECTED with conflict error
       └─ Worker cannot accept due to existing recurring service
```

## Test Cases

### ✅ Implemented and Working
1. [x] Worker applies to multiple jobs with same date (both remain PENDING)
2. [x] Employer accepts worker for first job → Second app auto-withdrawn
3. [x] Worker sees "Cannot Re-apply" button for withdrawn conflicts
4. [x] Worker can still re-apply to jobs rejected for other reasons
5. [x] Direct hire acceptance auto-withdraws conflicting job apps
6. [x] Same-employer jobs don't create conflicts
7. [x] Recurring jobs check day-of-week conflicts
8. [x] Notifications sent to worker and affected employers
9. [x] Conflict detection works across all 3 job types
10. [x] Employer sees applicant withdrawal notifications

## Files Modified

### Backend Files
1. `backend/app/models_v2/forum.py` - Added `withdrawn_due_to_conflict` field to InterestCheck
2. `backend/app/routers/jobs.py` - Updated `/start-job` endpoint and `/application-statuses/bulk`
3. `backend/app/routers/direct_hire.py` - Updated `/accept` endpoint
4. `backend/app/services/schedule_conflict_service.py` - Set flag when withdrawing
5. `backend/migrations/add_withdrawn_due_to_conflict_tracking.sql` - Migration file

### Frontend Files
1. `frontend/src/components/JobDetailModal.tsx` - Added conflict UI display
2. `frontend/src/pages/JobsPage.tsx` - Updated prop passing and types

### Database Files
1. `database/schema.sql` - Updated interestcheck table definition

## Migration Status
✅ **Completed** - Run `python run_migration.py` to apply database changes

## Known Limitations
1. Conflict detection doesn't prevent creation - only enforcement on acceptance
2. Same-date assumption: System treats same date as conflict (no time slot checking)
3. Manual override: Admin can force-accept conflicting jobs if needed (future feature)

## Future Enhancements
1. Time slot-based conflict detection (e.g., 9-11am doesn't conflict with 2-4pm)
2. Bulk conflict checking for employers
3. Admin override with audit trail
4. Conflict prediction warnings during application
5. Worker availability calendar view
