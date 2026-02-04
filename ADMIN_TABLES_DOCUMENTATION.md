# Admin Tables Documentation

This document provides a comprehensive overview of all tables in the admin panel, their available actions, and the attributes used in each table.

---

## 1. Employers Table

**Location:** `/users/employers`

**Source Database Tables:**
- `employers` (primary table)
- `users` (joined via user_id)

### Attributes
- `id` (employer_id)
- `user_id`
- `name` (from users table)
- `email` (from users table)
- `status` (from users table: active, banned, restricted)
- `date` (created_at from users table)
- `phone` (phone_number from users table)
- `profile_picture` (from users table)
- `household_size`
- `number_of_children`
- `residence_type`

### Actions
1. **view** - Opens a modal showing employer details
2. **ban** - Bans the employer (sets status to 'banned', soft deletes account)
3. **unban** - Unbans the employer (sets status to 'active', clears deleted_at)
4. **restrict** - Opens a modal to restrict employer with reason (requires reason)
   - Stores: `restriction_reason`, `restricted_at`, `restricted_by_admin_id` in users table
5. **unrestrict** - Unrestricts the employer (sets status to 'active', clears restriction data)

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Ban**: Ban icon (red) - shown when status is not 'banned'
- **Unban**: Ban icon (green) - shown when status is 'banned'
- **Restrict**: ShieldAlert icon (yellow) - shown when status is not 'restricted'
- **Unrestrict**: ShieldAlert icon (blue) - shown when status is 'restricted'

---

## 2. Workers Table

**Location:** `/users/workers`

**Source Database Tables:**
- `workers` (primary table)
- `users` (joined via user_id)
- `worker_skills` (loaded on view)
- `worker_certifications` (loaded on view)
- `worker_languages` (loaded on view)

### Attributes
- `id` (worker_id)
- `user_id`
- `name` (from users table)
- `email` (from users table)
- `status` (from users table: active, banned, restricted)
- `date` (created_at from users table)
- `phone` (phone_number from users table)
- `profile_picture` (from users table)
- `years_experience`
- `bio`

### Additional Details (Loaded on View)
- Skills (from worker_skills table)
- Certifications (from worker_certifications table)
- Languages (from worker_languages table)

### Actions
1. **view** - Opens a modal showing worker details including skills, certifications, and languages
2. **ban** - Bans the worker (sets status to 'banned', soft deletes account)
3. **unban** - Unbans the worker (sets status to 'active', clears deleted_at)
4. **restrict** - Opens a modal to restrict worker with reason (requires reason)
   - Stores: `restriction_reason`, `restricted_at`, `restricted_by_admin_id` in users table
5. **unrestrict** - Unrestricts the worker (sets status to 'active', clears restriction data)

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Ban**: Ban icon (red) - shown when status is not 'banned'
- **Unban**: Ban icon (green) - shown when status is 'banned'
- **Restrict**: ShieldAlert icon (yellow) - shown when status is not 'restricted'
- **Unrestrict**: ShieldAlert icon (blue) - shown when status is 'restricted'

---

## 3. Reviews Table

**Location:** `/reviews`

**Source Database Tables:**
- `reviews` (primary table)
- `users` (joined via reviewer_user_id and target_user_id)
- `notifications` (created for warn action)

### Attributes
- `id` (review_id)
- `reviewer` (reviewer name from users table)
- `reviewerEmail` (reviewer email)
- `reviewerRole` (reviewer role)
- `reviewerId` (reviewer user_id)
- `reviewerStatus` (reviewer status)
- `target` (target user name)
- `targetEmail` (target user email)
- `targetRole` (target user role)
- `targetId` (target user_id)
- `rating` (1-5)
- `feedback` (comment)
- `date` (created_at)
- `isHidden` (boolean)
- `status` (visible/hidden)

### Actions
1. **hide** - Hides the review (sets is_hidden to true, records admin_id and timestamp)
2. **unhide** - Unhides the review (sets is_hidden to false, clears admin tracking)
3. **warn** - Opens a modal to warn the reviewer with reason (requires reason)
   - Creates notification for reviewer
   - Updates review with `warned_at` and `warned_by_admin_id`
4. **restrict** - Opens a modal to restrict the reviewer with reason (requires reason)
   - Restricts the reviewer's user account
   - Stores: `restriction_reason`, `restricted_at`, `restricted_by_admin_id` in users table
   - Updates review with `restricted_at` and `restricted_by_admin_id`
5. **unrestrict** - Unrestricts the reviewer (restores account access, clears restriction data)
6. **delete** - Deletes the review (soft delete with deleted_at)

### Action Buttons
- **Hide/Unhide**: Eye icon (gray/green) - toggles based on isHidden status
- **Warn**: Warning triangle icon (yellow)
- **Restrict**: ShieldAlert icon (yellow) - shown when reviewerStatus is not 'restricted'
- **Unrestrict**: ShieldAlert icon (blue) - shown when reviewerStatus is 'restricted'
- **Delete**: Trash icon (red)

---

## 4. Messages/Conversations Table

**Location:** `/messages`

**Source Database Tables:**
- `conversations` (primary table)
- `conversation_participants` (joined to get participants)
- `users` (joined via conversation_participants.user_id)

### Attributes
- `id` (conversation_id)
- `employer` (employer name from participants)
- `employerId` (employer user_id)
- `worker` (worker name from participants)
- `workerId` (worker user_id)
- `lastMessage` (last message content)
- `lastMessageAt` (timestamp of last message)
- `status` (active, restricted)
- `isRestricted` (boolean, true if status is 'restricted')
- `participants` (array of participant users)

### Actions
1. **view** - Opens a modal showing conversation details including participants and last message
2. **restrict** - Opens a modal to restrict conversation with reason (requires reason)
   - Stores: `restriction_reason`, `restricted_at`, `restricted_by_admin_id` in conversations table
   - Sets status to 'restricted'
3. **unrestrict** - Unrestricts the conversation (sets status to 'active', clears restriction data)
4. **delete** - Deletes the conversation (soft delete with deleted_at, sets status to 'closed')

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Restrict**: Prohibited icon (orange) - shown when status is not 'restricted'
- **Unrestrict**: Check circle icon (blue) - shown when status is 'restricted'
- **Delete**: Trash icon (red)

---

## 5. Reports Table

**Location:** `/reports`

**Source Database Tables:**
- `reports` (primary table)
- `users` (joined via reporter_user_id and reported_user_id, also updated for restrict/unrestrict actions)
- `notifications` (created for warn and restrict actions)

### Attributes
- `id` (report_id)
- `report_id`
- `userId` (formatted as "R###")
- `name` (report reason)
- `reporter_name` (reporter user name)
- `reporter_email` (reporter email)
- `reported_user_name` (reported user name)
- `reported_user_email` (reported user email)
- `status` (pending, resolved, dismissed)
- `date` (created_at)
- `created_at`
- `resolved_at`
- `reason` (report reason)
- `description` (report description)
- `reported_to` (reported user name)
- `reported_user` (object with user_id, name, email, status, phone_number, profile_picture)
- `target_user` (same as reported_user, for ActionTable compatibility)

### Actions
1. **view** - Opens a modal showing report details
2. **warn** - Opens a modal to warn the reported user with reason (requires reason)
   - Creates notification for reported user
   - Updates report status to 'resolved'
   - Stores warning reason in `admin_notes`
3. **restrict** - Opens a modal to restrict the reported user with reason (requires reason)
   - Restricts the reported user's account
   - Stores: `restriction_reason`, `restricted_at`, `restricted_by_admin_id` in users table
   - Creates notification for reported user
4. **unrestrict** - Unrestricts the reported user (restores account access, clears restriction data)
5. **delete** - Resolves the report (sets status to 'resolved', records resolved_at and admin_id)
6. **dismiss** - Dismisses the report (sets status to 'dismissed', records resolved_at and admin_id)

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Warn**: Warning triangle icon (yellow)
- **Restrict**: ShieldAlert icon (yellow) - shown when reported_user status is not 'restricted'
- **Unrestrict**: ShieldAlert icon (blue) - shown when reported_user status is 'restricted'
- **Delete**: Trash icon (green) - marks as resolved
- **Dismiss**: X icon (gray) - dismisses report

---

## 6. Verification Table

**Location:** `/users/verification`

**Source Database Tables:**
- `verifications` (primary table)
- `workers` (joined via worker_id)
- `users` (joined via workers.user_id)
- `verification_logs` (created for approve/reject actions)

### Attributes
- `id` (verification_id)
- `verification_id`
- `worker_id`
- `name` (user name)
- `email` (user email)
- `role` (capitalized role, typically "Worker")
- `status` (pending, accepted, rejected)
- `application_date` (submitted_at timestamp)
- `application_date_formatted` (MM-DD-YYYY format)
- `date` (submitted_at, for backward compatibility)
- `document_type`
- `document_number`
- `submitted_at`
- `reviewed_at`

### Actions
1. **view** - Opens a modal showing verification details including document preview
2. **ban** (mapped to "approve") - Approves the verification
   - Sets status to 'accepted'
   - Records admin_id and reviewed_at
   - Creates verification log entry
3. **restrict** (mapped to "reject") - Rejects the verification
   - Sets status to 'rejected'
   - Records admin_id and reviewed_at
   - Creates verification log entry with reason

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Approve** (ban action): CheckCircle icon (green) - shown when status is 'pending'
- **Reject** (restrict action): XCircle icon (red) - shown when status is 'pending'

---

## 7. Jobs/Forum Posts Table

**Location:** `/jobs`

**Source Database Tables:**
- `forumposts` (primary table)
- `employers` (joined via employer_id)
- `users` (joined via employers.user_id)

### Attributes
- `id` (post_id)
- `title`
- `postedBy` (employer name)
- `postedByEmail` (employer email)
- `date` (created_at)
- `status` (open, closed)
- `description`
- `category`

### Actions
1. **view** - Opens a modal showing job post details
2. **delete** - Deletes the job post (hard delete from forumposts table)

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Delete**: Trash icon (red)

---

## 8. Payments Table

**Location:** `/payments`

**Source Database Tables:**
- `payments` (primary table)
- `contracts` (joined via contract_id)
- `bookings` (joined via contracts.booking_id)
- `schedules` (joined via bookings.schedule_id)
- `packages` (joined via schedules.package_id)
- `workers` (joined via packages.worker_id)
- `employers` (joined via schedules.employer_id)
- `users` (joined via workers.user_id and employers.user_id)
- `payment_methods` (joined via payments.method_id)

### Attributes
- `id` (payment_id)
- `userId` (formatted as "p###")
- `payment_id`
- `employer_name` (employer who made payment)
- `amount_formatted` (formatted as "P###,###")
- `paid_to` (worker name receiving payment)
- `date_formatted` (MM-DD-YYYY format)
- `date` (booking_date or payment_date)
- `status` (pending, completed, overdue)
- `transaction` (payment method formatted)
- `amount` (numeric amount)
- `payment_date`
- `payment_method` (provider name)
- `contract_id`
- `booking_id`

### Actions
1. **view** - Shows payment details in an alert dialog
2. **ban** (mapped to "delete") - Deletes the payment record
3. **restrict** (mapped to "complete") - Marks payment as completed
   - Updates payment status to 'completed'

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Complete Payment** (restrict action): CheckCircle icon (green)
- **Delete Payment** (ban action): Trash icon (red)

---

## 9. Bookings Table

**Location:** `/bookings`

**Source Database Tables:**
- `bookings` (primary table)
- `schedules` (joined via schedule_id)
- `packages` (joined via schedules.package_id)
- `workers` (joined via packages.worker_id)
- `employers` (joined via schedules.employer_id)
- `users` (joined via workers.user_id and employers.user_id)

### Attributes
- `booking_id`
- `worker_name`
- `worker_email`
- `worker_phone`
- `employer_name`
- `employer_email`
- `employer_phone`
- `package_title`
- `package_description`
- `package_price`
- `status` (pending, confirmed, completed, cancelled)
- `booking_date`
- `schedule_date` (available_date)
- `start_time`
- `end_time`
- `duration` (calculated from start/end time)
- `location`
- `notes`

### Actions
1. **view** - Opens BookingDetailsModal showing full booking details
2. **cancel** - Cancels the booking (sets status to 'cancelled')
   - Only shown when status is not 'completed' and not 'cancelled'
3. **delete** - Deletes the booking (hard delete)
   - Only shown when status is 'cancelled'

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Cancel**: X icon (red) - shown when status is not 'completed' and not 'cancelled'
- **Delete**: Trash icon (red) - shown when status is 'cancelled'

---

## 10. Activity Log Table

**Location:** `/activity-log`

**Source Database Tables:**
- Aggregated from multiple tables (no single activity_logs table):
  - `forumposts` (job post activities)
  - `messages` (message activities)
  - `verification_logs` (verification activities)
  - `payments` (payment activities)
  - `packages` (package activities)
  - `bookings` (booking activities)
  - `reviews` (review activities)
- Related joins: `employers`, `workers`, `users` (for user information)

### Attributes
- `id` (activity_id)
- `activity_id`
- `user_type` (capitalized: Employer, Worker, Admin)
- `user_name`
- `action`
- `timestamp` (ISO timestamp)
- `timestamp_formatted` (MM-DD-YYYY HH:MMAM/PM format)
- `details` (truncated to 3 words for table display)
- `details_full` (full details for view action)
- `entity_type`
- `entity_id`
- `user_id`

### Actions
1. **view** - Shows full activity details in an alert dialog
2. **delete** - Deletes the activity log record (hard delete)

### Action Buttons
- **View**: Eye icon (blue/primary)
- **Delete**: Trash icon (red)

---

## Common Action Patterns

### Restriction Actions
All restriction actions now require a reason to be provided via a modal:
- **Employers**: `restrictEmployer(userId, reason)`
- **Workers**: `restrictWorker(userId, reason)`
- **Reviews**: `restrictReviewer(reviewId, userId, reason)`
- **Messages**: `restrictConversation(conversationId, reason)`
- **Reports**: `restrictReportedUser(reportId, reason)`

### Warning Actions
Warning actions require a reason:
- **Reviews**: `warnReviewer(reviewId, reason)`
- **Reports**: `warnReportedUser(reportId, reason)`

### Database Fields for Restrictions
- `users.restriction_reason` (text)
- `users.restricted_at` (timestamp)
- `users.restricted_by_admin_id` (integer, FK to admins)
- `conversations.restriction_reason` (text)

### Status Values
- **User Status**: `active`, `banned`, `restricted`, `inactive`
- **Report Status**: `pending`, `resolved`, `dismissed`
- **Review Status**: `visible`, `hidden` (based on is_hidden)
- **Conversation Status**: `active`, `restricted`, `closed`
- **Verification Status**: `pending`, `accepted`, `rejected`
- **Booking Status**: `pending`, `confirmed`, `completed`, `cancelled`
- **Payment Status**: `pending`, `completed`, `overdue`
- **Job Status**: `open`, `closed`

---

## Notes

- All restriction actions store the admin who performed the action via `restricted_by_admin_id`
- All restriction actions require a reason to be entered in a modal before execution
- Warning actions also require a reason and create notifications for the affected users
- Most delete actions are soft deletes (set `deleted_at` timestamp) except for jobs and activity logs
- The ActionTable component handles the display of action buttons based on row status and actionType

