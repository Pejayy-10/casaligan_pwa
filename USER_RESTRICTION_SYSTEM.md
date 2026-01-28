# User Restriction System Guide

## Overview
The user restriction system allows admins to temporarily or permanently restrict users who violate platform policies. When restricted, users are immediately blocked from accessing the platform and logged out if currently active.

## Features Implemented

### 1. Database Schema
Added restriction fields to the `users` table:
- `is_restricted`: Boolean flag indicating if user is restricted
- `restriction_reason`: Reason for the restriction
- `restriction_start`: When the restriction started
- `restriction_end`: When it expires (NULL = permanent)
- `restricted_by_admin_id`: Admin who applied the restriction

### 2. Automatic Restriction Check
Every API request checks if the user is restricted:
- ✅ Expired restrictions are automatically lifted
- ❌ Active restrictions return HTTP 403 with details
- 📱 Frontend receives `X-Account-Status: restricted` header
- 🔐 User is automatically logged out

### 3. Admin Endpoints

#### Restrict User
**POST** `/reports/admin/restrict-user/{user_id}`

Request body:
```json
{
  "restriction_days": 7,  // Optional: null or omit for permanent
  "reason": "Multiple reports of unprofessional behavior"
}
```

Response:
```json
{
  "message": "User John Doe has been restricted for 7 days",
  "user_id": 123,
  "restriction_end": "2026-02-04T10:30:00Z",
  "reason": "Multiple reports of unprofessional behavior"
}
```

#### Unrestrict User
**POST** `/reports/admin/unrestrict-user/{user_id}`

Response:
```json
{
  "message": "Restriction lifted for user John Doe",
  "user_id": 123
}
```

#### Warn User
**POST** `/reports/admin/warn-user/{user_id}`

Query parameter: `warning_message`

Sends a notification to the user without restricting them.

## How It Works

### 1. Admin Restricts User
When an admin restricts a user from the admin panel:
```
Admin clicks "Restrict" → Selects duration (e.g., 7 days) → Enters reason → Confirms
```

### 2. User Gets Blocked
If the user is currently logged in:
1. Next API call checks restriction status
2. Returns HTTP 403 with error message
3. Frontend detects the restriction
4. Shows popup: "Your account has been restricted. Reason: [reason]. Time remaining: X days"
5. User is automatically logged out
6. Redirected to login page

### 3. User Tries to Login
If a restricted user tries to login:
- Login succeeds (JWT issued)
- First API call after login triggers restriction check
- User sees restriction popup and is logged out

### 4. Automatic Expiry
When restriction period ends:
- User's next API call checks `restriction_end`
- If expired, restriction is automatically lifted
- User can use the platform normally

## Frontend Implementation Needed

### 1. Admin Panel - Restrict User Modal
```jsx
// In admin reports page
<Button onClick={() => setShowRestrictModal(true)}>Restrict</Button>

<Modal show={showRestrictModal}>
  <h3>Restrict User: {userName}</h3>
  
  <Select name="duration">
    <option value="1">1 Day</option>
    <option value="3">3 Days</option>
    <option value="7">7 Days</option>
    <option value="14">14 Days</option>
    <option value="30">30 Days</option>
    <option value="">Permanent</option>
  </Select>
  
  <TextArea name="reason" placeholder="Reason for restriction..." />
  
  <Button onClick={handleRestrict}>Confirm Restriction</Button>
</Modal>
```

### 2. API Service
```typescript
// services/adminService.ts
export const restrictUser = async (userId: number, days: number | null, reason: string) => {
  const response = await api.post(`/reports/admin/restrict-user/${userId}`, {
    restriction_days: days,
    reason: reason
  });
  return response.data;
};

export const unrestrictUser = async (userId: number) => {
  const response = await api.post(`/reports/admin/unrestrict-user/${userId}`);
  return response.data;
};

export const warnUser = async (userId: number, message: string) => {
  const response = await api.post(`/reports/admin/warn-user/${userId}?warning_message=${encodeURIComponent(message)}`);
  return response.data;
};
```

### 3. API Interceptor (Handle Restricted Accounts)
```typescript
// services/api.ts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      const accountStatus = error.response.headers['x-account-status'];
      
      if (accountStatus === 'restricted') {
        // Show restriction popup
        showRestrictedAccountModal(error.response.data.detail);
        
        // Clear auth data
        localStorage.removeItem('token');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      }
    }
    return Promise.reject(error);
  }
);
```

### 4. Restriction Popup Component
```tsx
// components/RestrictedAccountModal.tsx
const RestrictedAccountModal = ({ message, onClose }) => {
  return (
    <Modal isOpen={true} canClose={false}>
      <div className="text-center p-6">
        <div className="text-red-500 text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold mb-4">Account Restricted</h2>
        <p className="text-gray-600 mb-4">{message}</p>
        <p className="text-sm text-gray-500">
          You will be logged out automatically...
        </p>
      </div>
    </Modal>
  );
};
```

## Database Migration

Run the migration SQL to add the restriction fields:

```bash
# Using psql
psql -h your-host -U your-username -d your-database -f backend/migrations/add_user_restrictions.sql

# Or on Supabase Dashboard
# Go to SQL Editor and run the contents of add_user_restrictions.sql
```

## Testing

### Test Temporary Restriction (1 day)
```bash
# 1. Restrict user for 1 day
curl -X POST http://localhost:8000/reports/admin/restrict-user/123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restriction_days": 1, "reason": "Test restriction"}'

# 2. Try to use API as that user (should fail)
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer USER_TOKEN"

# Response: 403 - Account restricted
```

### Test Permanent Restriction
```bash
curl -X POST http://localhost:8000/reports/admin/restrict-user/123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Permanent ban for policy violation"}'
```

### Test Unrestrict
```bash
curl -X POST http://localhost:8000/reports/admin/unrestrict-user/123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Admin Panel Integration

Add to your admin reports page:

```tsx
// pages/admin/reports/[id].tsx
const ReportDetailPage = () => {
  const handleRestrictUser = async () => {
    const days = restrictionDays || null; // null = permanent
    await restrictUser(reportedUserId, days, restrictionReason);
    toast.success('User has been restricted');
  };

  return (
    <div>
      <h2>Report #{reportId}</h2>
      <p>Reported User: {reportedUserName}</p>
      
      <div className="actions">
        <button onClick={() => setShowWarnModal(true)}>
          ⚠️ Warn User
        </button>
        
        <button onClick={() => setShowRestrictModal(true)}>
          🚫 Restrict User
        </button>
        
        <button onClick={() => dismissReport()}>
          ✅ Dismiss Report
        </button>
      </div>
    </div>
  );
};
```

## Notes

- Restrictions are checked on **every API request** using the `get_current_user` dependency
- Expired restrictions are **automatically lifted** when the user makes their next request
- Frontend must handle the 403 error and show appropriate UI
- Consider adding a "View Restriction History" feature for admins
- Add email notification when user is restricted/unrestricted

## Future Enhancements

- [ ] Add restriction history table to track all restrictions
- [ ] Send email notifications when user is restricted
- [ ] Add "Appeal Restriction" feature for users
- [ ] Show restriction status in admin user list
- [ ] Add restriction statistics to admin dashboard
- [ ] Implement escalating restriction periods (1st offense: 3 days, 2nd: 7 days, etc.)
