# Admin Authentication Setup

## How It Works

The admin system connects Supabase Auth with the database `admins` table:

1. **Admin logs in** using Supabase Auth (email/password)
2. **System retrieves admin_id** from the database using the logged-in user's email
3. **Admin actions are tracked** using the database admin_id

## Setup Steps

### 1. Ensure Admin Exists in Database

Your admin must exist in both places:
- ✅ Supabase Auth (for login)
- ✅ Database `users` and `admins` tables (for tracking)

Check if your admin exists:
```sql
SELECT u.user_id, u.name, u.email, a.admin_id 
FROM users u
JOIN admins a ON u.user_id = a.user_id
WHERE u.email = 'your-admin-email@example.com';
```

If not found, add the admin to the database:
```sql
-- Get user_id from Supabase Auth users
-- Then insert into admins table
INSERT INTO admins (user_id, admin_actions) 
VALUES (YOUR_USER_ID, 'Full access');
```

### 2. How the System Links Auth to Database

**New File: `lib/supabase/adminQueries.ts`**
- `getAdminId()` - Gets the admin_id for the currently logged-in user
- `isAdmin()` - Checks if current user is an admin

**Updated Files:**
- `lib/supabase/reviewQueries.ts` - All admin actions now use dynamic admin_id
- `lib/supabase/messageQueries.ts` - Conversation restrictions use dynamic admin_id

### 3. What Changed

#### Before:
```typescript
hideReview(reviewId, adminId = 1)  // Hardcoded admin_id
```

#### After:
```typescript
hideReview(reviewId)  // Automatically gets admin_id from logged-in user
```

The function now:
1. Calls `getAdminId()` to get the database admin_id
2. Uses that admin_id to track who performed the action
3. Returns an error if the user is not an admin

## Functions Updated

### Review Actions (reviewQueries.ts)
- ✅ `hideReview()` - Tracks hidden_by_admin_id
- ✅ `warnReviewer()` - Tracks warned_by_admin_id  
- ✅ `restrictReviewer()` - Tracks restricted_by_admin_id

### Message Actions (messageQueries.ts)
- ✅ `restrictConversation()` - Tracks restricted_by_admin_id

## Testing

1. **Login as admin** using Supabase Auth
2. **Perform an action** (hide review, restrict conversation, etc.)
3. **Check the database**:

```sql
-- Check who hid a review
SELECT r.review_id, r.comment, a.admin_id, u.name as admin_name
FROM reviews r
JOIN admins a ON r.hidden_by_admin_id = a.admin_id
JOIN users u ON a.user_id = u.user_id
WHERE r.is_hidden = true;

-- Check who restricted a conversation
SELECT c.conversation_id, c.topic, a.admin_id, u.name as admin_name
FROM conversations c
JOIN admins a ON c.restricted_by_admin_id = a.admin_id
JOIN users u ON a.user_id = u.user_id
WHERE c.status = 'restricted';
```

## Error Handling

If a user is not an admin or not logged in, all admin actions will return:
```typescript
{
  data: null,
  error: Error("Admin not authenticated")
}
```

## Frontend Usage

No changes needed in the frontend! The functions are called the same way:
```typescript
await hideReview(reviewId);  // admin_id is automatically fetched
await restrictConversation(conversationId);  // admin_id is automatically fetched
```
