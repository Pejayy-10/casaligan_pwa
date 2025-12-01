# How to Create Admin Account

## Option 1: Using Script (Recommended)

### Step 1: Get Your Service Role Key

1. Go to your **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** > **API**
4. Find the **"service_role"** key (keep this secret!)
5. Copy it

### Step 2: Add Service Role Key to .env.local

Open `casaligan_web/.env.local` and add:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Step 3: Run the Script

In your terminal, navigate to `casaligan_web` folder and run:

```bash
npm run create-admin
```

This will create:
- ✅ User in Supabase Auth: `admin@example.com` / `admin`
- ✅ User record in `users` table with `role: 'admin'`
- ✅ Admin record in `admins` table

---

## Option 2: Create Manually in Supabase Dashboard

### Step 1: Create User in Auth

1. Go to **Supabase Dashboard** > **Authentication** > **Users**
2. Click **"Add User"** → **"Create new user"**
3. Enter:
   - **Email**: `admin@example.com`
   - **Password**: `admin`
   - ✅ Check **"Auto Confirm User"**
4. Click **"Create User"**

### Step 2: Get the User ID

1. After creating the user, click on it
2. Copy the **User ID** (UUID)

### Step 3: Create User in Users Table

1. Go to **Table Editor** > **users** table
2. Click **"Insert"** > **"Insert row"**
3. Enter:
   - **user_id**: (paste the User ID from Step 2)
   - **name**: `Admin`
   - **email**: `admin@example.com`
   - **password**: (can be empty or set a password hash if needed)
   - **role**: `admin` (from dropdown)
   - **status**: `active` (from dropdown)
4. Click **"Save"**

### Step 4: Create Admin Record (Optional)

1. Go to **Table Editor** > **admins** table
2. Click **"Insert"** > **"Insert row"**
3. Enter:
   - **user_id**: (same User ID from Step 2)
   - **admin_actions**: `Full access` (or leave empty)
4. Click **"Save"**

---

## Option 3: Use SQL Editor (Quick)

1. Go to **Supabase Dashboard** > **SQL Editor**
2. Click **"New Query"**
3. Paste this SQL (replace with your actual data):

```sql
-- Create user in auth (this creates the auth user)
-- Note: You'll need to use Supabase's auth.admin.createUser API or create manually first

-- After creating the auth user, insert into users table:
INSERT INTO users (user_id, name, email, role, status, created_at)
VALUES (
  'USER_ID_HERE',  -- Replace with actual UUID from auth.users table
  'Admin',
  'admin@example.com',
  'admin',
  'active',
  NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  role = 'admin',
  status = 'active';

-- Create admin record
INSERT INTO admins (user_id, admin_actions)
VALUES (
  'USER_ID_HERE',  -- Same UUID
  'Full access'
)
ON CONFLICT (user_id) DO NOTHING;
```

**Note:** You'll need to create the user in Authentication first, then use the User ID in the SQL.

---

## ✅ After Creating Admin

You can now log in at `/auth` with:
- **Email**: `admin@example.com`
- **Password**: `admin`

---

## 🔒 Security Note

**Important:** After testing, consider:
1. Changing the password to something more secure
2. Enabling 2FA for the admin account
3. Using environment variables for admin credentials in production

