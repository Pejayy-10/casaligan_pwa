# Database-Based Authentication Setup Guide

## Overview
The system now uses **database-based authentication** instead of Supabase Auth. All user credentials are stored in the `users` table.

## Setup Steps

### 1. Add Password Column to Users Table

Run this SQL in Supabase SQL Editor:

```sql
-- Add password_hash column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

### 2. Set Admin Password

Run this SQL to set the admin password to `admin123`:

```sql
-- Update admin user with hashed password
UPDATE users 
SET password_hash = '$2b$10$Om3Igu8qZMzAcwxKL1hqaOnRQUOetyuCX1eM8lafl/q0KJPGSAABm',
    email = 'admin@gmail.com',
    name = 'Admin',
    role = 'admin',
    status = 'active'
WHERE user_id = 1;

-- Make sure admin entry exists
INSERT INTO admins (admin_id, user_id, admin_actions, created_at)
VALUES (1, 1, 0, NOW())
ON CONFLICT (admin_id) DO NOTHING;
```

### 3. Login Credentials

- **Email**: `admin@gmail.com`
- **Password**: `admin123`

**⚠️ IMPORTANT: Change this password after first login!**

## How It Works

### Authentication Flow:
1. User enters email and password
2. System queries `users` table for matching email
3. Password is verified using bcrypt
4. User data is stored in localStorage
5. Admin role is checked in `admins` table

### Profile Updates:
- **Name, Phone, Picture**: Updates `users` table directly
- **Email**: Updates `users` table, no confirmation needed
- **Password**: Hashes new password with bcrypt, updates `users` table

## Key Files

- `lib/supabase/auth.ts` - Main authentication functions
- `lib/supabase/adminQueries.ts` - Admin-specific queries
- `lib/supabase/adminProfileQueries.ts` - Profile management

## Security Notes

1. ✅ Passwords are hashed with bcrypt (10 salt rounds)
2. ✅ No plaintext passwords stored
3. ✅ Session stored in localStorage
4. ✅ Admin role verified on each request
5. ⚠️ For production, consider:
   - HTTP-only cookies instead of localStorage
   - JWT tokens with expiration
   - Rate limiting on login attempts
   - Account lockout after failed attempts

## Generating New Password Hashes

To create a password hash for new users:

```bash
cd casaligan_web
node scripts/generate-password-hash.js
```

Then update the script to hash your desired password and run it.

## Migration from Supabase Auth

If you have existing users in Supabase Auth:
1. Export user list from Supabase Dashboard
2. Generate password hashes for each user
3. Insert into `users` table with hashed passwords
4. Notify users to reset their passwords

## Troubleshooting

### "User not found" error:
- Check if user exists in `users` table
- Verify email matches exactly
- Check if `status = 'active'`

### "Invalid password" error:
- Password hash may be incorrect
- Regenerate hash using the script
- Update database with new hash

### "Not authorized as admin" error:
- Check if user has `role = 'admin'` in `users` table
- Verify entry exists in `admins` table with matching `user_id`

## Next Steps

1. Run the SQL commands above
2. Test login with `admin@gmail.com` / `admin123`
3. Change the password after first login
4. Create additional admin users as needed
