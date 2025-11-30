# 📊 Casaligan Database Documentation

Complete documentation of the database schema, relationships, and data flow.

## 🗂️ Table Overview

| Table | Purpose |
|-------|---------|
| `users` | Core user accounts (both owners and housekeepers) |
| `addresses` | User address information (Philippines PSGC format) |
| `user_documents` | Uploaded verification documents |
| `housekeeper_applications` | Applications to become a housekeeper |
| `workers` | Housekeeper profiles (linked to users) |
| `employers` | House owner profiles (linked to users) |
| `worker_packages` | Service packages offered by workers |
| `forumposts` | Job postings created by employers |
| `interestcheck` | Job applications from workers |
| `contracts` | Accepted job agreements |
| `direct_hires` | Direct bookings (skip job posting) |
| `conversations` | Chat threads between users |
| `messages` | Individual chat messages |
| `ratings` | Star ratings and reviews |
| `notifications` | In-app notifications |
| `reports` | Dispute/complaint reports |
| `payment_schedules` | Scheduled payments for long-term jobs |
| `payment_transactions` | Actual payment records |

---

## 👤 User System

### `users`
The central table for all accounts. A single user can be both a house owner AND a housekeeper.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `email` | VARCHAR | Unique email address |
| `phone_number` | VARCHAR | Unique phone number |
| `password_hash` | VARCHAR | Bcrypt hashed password |
| `first_name`, `last_name` | VARCHAR | User's name |
| `is_owner` | BOOLEAN | Can act as house owner (default: true) |
| `is_housekeeper` | BOOLEAN | Can act as housekeeper (default: false) |
| `active_role` | ENUM | Currently active role ('owner' or 'housekeeper') |
| `status` | ENUM | Account status ('pending', 'active', 'suspended') |

### `addresses`
One-to-one with users. Stores Philippine address using PSGC codes.

| Column | Description |
|--------|-------------|
| `user_id` | Links to users (unique - one address per user) |
| `region_code/name` | Region (e.g., NCR) |
| `province_code/name` | Province |
| `city_code/name` | City/Municipality |
| `barangay_code/name` | Barangay |
| `street_address` | Street, house number |

### `user_documents`
Verification documents uploaded by users (ID, clearances, etc.).

| Column | Description |
|--------|-------------|
| `user_id` | Links to users |
| `document_type` | Type of document (national_id, nbi_clearance, etc.) |
| `file_path` | Path to uploaded file |
| `status` | Verification status ('pending', 'approved', 'rejected') |

### `housekeeper_applications`
When a user wants to become a housekeeper, they submit an application.

| Column | Description |
|--------|-------------|
| `user_id` | Links to users |
| `status` | Application status ('pending', 'approved', 'rejected') |
| `admin_notes` | Notes from admin review |

---

## 👷 Worker & Employer Profiles

### `workers`
Created when a user's housekeeper application is approved.

| Column | Description |
|--------|-------------|
| `worker_id` | Primary key (used throughout the app) |
| `user_id` | Links to users (unique - one worker profile per user) |

### `employers`
Created automatically when a user posts a job or hires someone.

| Column | Description |
|--------|-------------|
| `employer_id` | Primary key |
| `user_id` | Links to users (unique) |

### `worker_packages`
Service packages that workers offer for direct hiring.

| Column | Description |
|--------|-------------|
| `worker_id` | Links to workers |
| `name` | Package name (e.g., "Basic Cleaning") |
| `price` | Cost in PHP |
| `duration_hours` | Estimated hours |
| `services` | JSON array of included services |

---

## 📋 Job Flow (Forum Posts)

This is **Flow 1**: Owner posts a job → Workers apply → Owner accepts → Contract created

```
ForumPost (Job) → InterestCheck (Application) → Contract (Agreement)
```

### `forumposts`
Job postings created by employers.

| Column | Description |
|--------|-------------|
| `post_id` | Primary key |
| `employer_id` | Links to employers |
| `title` | Job title |
| `content` | Job description |
| `location` | Work location |
| `job_type` | 'onetime' or 'longterm' |
| `salary` | Payment amount |
| `status` | Job status (open → ongoing → completed) |
| `completion_proof_url` | Photo proof when job is done |

**Status Flow:**
```
open → ongoing → pending_completion → completed
         ↓
      cancelled
```

### `interestcheck`
Job applications from workers.

| Column | Description |
|--------|-------------|
| `post_id` | Which job they're applying to |
| `worker_id` | Who is applying |
| `status` | 'pending', 'accepted', 'rejected' |

### `contracts`
Created when an employer accepts a worker's application.

| Column | Description |
|--------|-------------|
| `post_id` | Links to the job |
| `worker_id` | The accepted worker |
| `employer_id` | The employer |
| `status` | Contract status |
| `completion_proof_url` | Worker's proof of completion |
| `payment_proof_url` | Owner's payment proof |

**Note:** One job can have multiple contracts (multiple workers on same job).

---

## 🤝 Direct Hire Flow

This is **Flow 2**: Owner browses workers → Selects packages → Books directly

```
Worker Packages → Direct Hire (Booking)
```

### `direct_hires`
Direct bookings between employers and workers.

| Column | Description |
|--------|-------------|
| `hire_id` | Primary key |
| `employer_id` | Who is hiring |
| `worker_id` | Who is being hired |
| `package_ids` | JSON array of selected package IDs |
| `total_amount` | Total cost |
| `scheduled_date` | When the work should be done |
| `status` | Booking status |
| `completion_proof_url` | Worker's completion proof |
| `payment_proof_url` | Owner's payment proof |

**Status Flow:**
```
pending → accepted → in_progress → pending_completion → completed → paid
    ↓         ↓
 rejected  cancelled
```

---

## 💬 Messaging System

### `conversations`
Chat threads between two users. Each conversation is linked to either a job or direct hire.

| Column | Description |
|--------|-------------|
| `conversation_id` | Primary key |
| `job_id` | Links to forumposts (if job-related) |
| `hire_id` | Links to direct_hires (if hire-related) |
| `participant_ids` | Array of user IDs in the conversation |
| `status` | 'active', 'read_only', 'archived' |

**Constraint:** One conversation per job OR per hire (unique indexes).

### `messages`
Individual messages within a conversation.

| Column | Description |
|--------|-------------|
| `conversation_id` | Links to conversations |
| `sender_id` | Who sent the message |
| `content` | Message text |
| `message_type` | 'text', 'image', 'system' |
| `read_at` | When recipient read it (for read receipts) |

---

## ⭐ Ratings & Reviews

### `ratings`
Star ratings (1-5) with optional text reviews.

| Column | Description |
|--------|-------------|
| `rater_id` | Who gave the rating |
| `rated_user_id` | Who received the rating |
| `post_id` | Related job (optional) |
| `hire_id` | Related direct hire (optional) |
| `stars` | 1-5 stars |
| `review` | Optional text review |

**Rules:**
- Owners rate workers after job completion
- One rating per job/hire per user

---

## 🔔 Notifications

### `notifications`
In-app notifications for various events.

| Column | Description |
|--------|-------------|
| `user_id` | Who receives the notification |
| `type` | Notification type (see below) |
| `title` | Short title |
| `message` | Full message |
| `reference_type` | What it refers to ('job', 'direct_hire', etc.) |
| `reference_id` | ID of the referenced item |
| `is_read` | Whether user has seen it |

**Notification Types:**
- Job: `job_application`, `application_accepted`, `completion_submitted`, etc.
- Direct Hire: `direct_hire_request`, `direct_hire_accepted`, etc.
- Payment: `payment_sent`, `payment_received`, `payment_due`

---

## 🚨 Reports & Disputes

### `reports`
For reporting issues, disputes, or complaints.

| Column | Description |
|--------|-------------|
| `reporter_id` | Who filed the report |
| `reported_user_id` | Who is being reported |
| `post_id` | Related job (optional) |
| `report_type` | Type of issue (unpaid_job, no_show, harassment, etc.) |
| `status` | 'pending', 'under_review', 'resolved', 'dismissed' |
| `evidence_urls` | JSON array of uploaded proof images |

---

## 💰 Payment System (Long-term Jobs)

For long-term jobs with scheduled payments.

### `payment_schedules`
Scheduled payment dates for contracts.

| Column | Description |
|--------|-------------|
| `contract_id` | Links to contracts |
| `due_date` | When payment is due |
| `amount` | Amount due |
| `status` | 'pending', 'sent', 'confirmed', 'overdue' |

### `payment_transactions`
Actual payment records.

| Column | Description |
|--------|-------------|
| `schedule_id` | Links to payment_schedules |
| `amount_paid` | Actual amount paid |
| `payment_method` | GCash, bank transfer, etc. |
| `payment_proof_url` | Screenshot/receipt |
| `confirmed_by_worker` | Worker confirmed receipt |

---

## 🔗 Entity Relationship Diagram

```
                              ┌─────────────┐
                              │   users     │
                              └──────┬──────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
   ┌──────────┐               ┌──────────┐               ┌──────────────┐
   │ addresses│               │ workers  │               │  employers   │
   │ (1:1)    │               │ (1:1)    │               │  (1:1)       │
   └──────────┘               └────┬─────┘               └──────┬───────┘
                                   │                            │
                    ┌──────────────┼──────────────┐             │
                    │              │              │             │
                    ▼              ▼              ▼             ▼
            ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐
            │  packages  │  │ contracts  │  │interests │  │forumposts│
            │            │  │            │  │          │  │  (jobs)  │
            └─────┬──────┘  └────────────┘  └──────────┘  └────┬─────┘
                  │                                             │
                  ▼                                             │
          ┌─────────────┐         ┌─────────────────────────────┘
          │direct_hires │         │
          └──────┬──────┘         │
                 │                │
                 └────────┬───────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  conversations  │
                 └────────┬────────┘
                          │
                          ▼
                   ┌──────────┐
                   │ messages │
                   └──────────┘
```

---

## 📊 Status Enums Reference

### User Status
| Value | Meaning |
|-------|---------|
| `pending` | Just registered, awaiting verification |
| `active` | Verified and can use the app |
| `suspended` | Account suspended by admin |

### Job Status (`forumposts`)
| Value | Meaning |
|-------|---------|
| `open` | Accepting applications |
| `ongoing` | Work in progress |
| `pending_completion` | Worker submitted proof, awaiting approval |
| `completed` | Job finished |
| `cancelled` | Job cancelled |

### Direct Hire Status
| Value | Meaning |
|-------|---------|
| `pending` | Waiting for worker to accept |
| `accepted` | Worker accepted, waiting for scheduled date |
| `in_progress` | Work is being done |
| `pending_completion` | Worker submitted completion proof |
| `completed` | Owner approved completion |
| `paid` | Payment confirmed |
| `cancelled` | Cancelled by either party |
| `rejected` | Worker rejected the hire |

---

## 🔄 Complete User Journey

### As House Owner:
1. Register → `users` created with `is_owner=true`
2. Add address → `addresses` created
3. Post job → `employers` + `forumposts` created
4. Review applications → read `interestcheck`
5. Accept worker → `contracts` created
6. Approve completion → update `contracts.status`
7. Submit payment → update `contracts.payment_proof_url`
8. Rate worker → `ratings` created

### As Housekeeper:
1. Register → `users` created
2. Apply to be housekeeper → `housekeeper_applications` created
3. Get approved → `workers` created, `is_housekeeper=true`
4. Create packages → `worker_packages` created
5. Apply to jobs → `interestcheck` created
6. Get accepted → `contracts` created
7. Submit completion → update `contracts.completion_proof_url`
8. Receive payment → update `contracts.paid_at`

### Direct Hire Flow:
1. Owner browses workers → read `workers` + `worker_packages`
2. Owner books worker → `direct_hires` created
3. Worker accepts → update `direct_hires.status`
4. Work completed → update proof fields
5. Payment confirmed → `direct_hires.status = 'paid'`
6. Both can chat → `conversations` + `messages`
