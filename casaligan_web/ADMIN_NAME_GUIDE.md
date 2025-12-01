# Admin Name and Profile Guide

## How Admin Name is Fetched

The admin name comes from **Supabase Auth User Metadata**, not from the database.

### Data Flow:

1. **Login**: You log in with `admin@example.com` 
2. **Auth User**: Supabase Auth stores your user information
3. **User Metadata**: The name is stored in `user.user_metadata.name`
4. **Fallback**: If no name is set, it uses the email username part (`admin` from `admin@example.com`)

### Where to Set the Admin Name:

You have 2 options:

#### Option 1: Update via Profile Page (Frontend)
1. Go to Admin Profile page
2. Click "Edit Profile"
3. Change the name field
4. Click "Save Changes"
5. This updates `user_metadata.name` in Supabase Auth

#### Option 2: Update via Supabase Dashboard
1. Go to Supabase Dashboard → Authentication → Users
2. Find the user with email `admin@example.com`
3. Click on the user
4. Scroll to "User Metadata" section
5. Add or update the JSON:
   ```json
   {
     "name": "Your Admin Name",
     "phone_number": "09658692499"
   }
   ```
6. Save

## Current Name Display

Looking at your screenshot, it shows:
- **Name**: `imadmin`

This is because:
- `user.user_metadata.name` is set to `"imadmin"`
- OR no name is set, so it's using `user.email.split('@')[0]` which gives `"admin"` → but looks like metadata has `"imadmin"`

## To Change the Name:

### Method 1: Use the Edit Profile Button
```
1. Click "Edit Profile" button
2. Type the new name you want (e.g., "John Admin" or "Administrator")
3. Click "Save Changes"
4. The page will reload and show the new name
```

### Method 2: Via Supabase SQL Editor
```sql
-- This won't work because Auth data is not in regular tables
-- You must use the dashboard or the profile update function
```

## Why Email Update Might Not Work

Email updates in Supabase require email confirmation by default. Here's what happens:

1. You call `updateAdminEmail("newemail@example.com")`
2. Supabase sends a confirmation email to `newemail@example.com`
3. User must click the confirmation link
4. Only then is the email actually changed

### To Test Email Update:
1. Make sure you have access to the new email inbox
2. Check Supabase settings: Authentication → Email Templates
3. You might want to disable email confirmation for testing (not recommended for production)

## Debugging

The code now includes console.log statements. Check browser console (F12) to see:
- `Profile data:` - Shows what data is loaded
- `Updating profile with:` - Shows what data is being sent
- `Update result:` - Shows the response from Supabase

## Important Notes

✅ **Profile name, phone, picture** → Stored in Supabase Auth `user_metadata`
✅ **Email** → Stored in Supabase Auth `email` field (requires confirmation)
✅ **Password** → Stored in Supabase Auth (encrypted)
✅ **Admin ID** → Stored in database `admins` table
✅ **Admin actions count** → Stored in database `admins` table

The system does NOT use the database `users` table for admin profile information anymore.
