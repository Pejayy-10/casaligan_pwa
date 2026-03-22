# Supabase Integration Setup

This document explains what has been set up and what you need to configure in your Supabase database.

## ✅ What's Been Implemented

### 1. **Authentication**
- ✅ Sign-in page (`/auth`) with Supabase authentication
- ✅ Form validation and error handling
- ✅ Session management with cookies
- ✅ Middleware protection for all admin routes
- ✅ Automatic redirect to `/auth` if not authenticated

### 2. **Supabase Client Utilities**
- ✅ `lib/supabase/client.ts` - For client components (browser)
- ✅ `lib/supabase/server.ts` - For server components (reads session from cookies)
- ✅ `lib/supabase/middleware.ts` - For middleware session management
- ✅ `lib/supabase/queries.ts` - Common database query functions

### 3. **Data Fetching**
- ✅ Dashboard page fetches real stats (users, jobs, bookings)
- ✅ Workers page fetches and displays workers from database
- ✅ Employers page fetches and displays employers from database

## 📋 Database Schema Requirements

You need to create these tables in your Supabase database:

### 1. `users` table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. `workers` table
```sql
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  phone_number TEXT,
  status TEXT,
  verification_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. `employers` table
```sql
CREATE TABLE employers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  phone_number TEXT,
  company_name TEXT,
  company TEXT,
  status TEXT,
  verification_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. `jobs` table
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 5. `bookings` table
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 6. `activity_logs` table (optional)
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT,
  user_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Configuration Steps

### 1. Update Table Names
Edit `lib/supabase/queries.ts` and update the table names to match your actual Supabase schema:
- `users` → your actual users table name
- `workers` → your actual workers table name
- `employers` → your actual employers table name
- `jobs` → your actual jobs table name
- `bookings` → your actual bookings table name

### 2. Update Field Names
In the page files (`workers/page.tsx`, `employers/page.tsx`), adjust the field mappings to match your database columns:
```typescript
const rows = workers.map((worker: any) => ({
  id: worker.id,
  name: worker.name || worker.full_name || ... // Update based on your schema
  // ... other fields
}));
```

### 3. Create Admin User
In Supabase Dashboard:
1. Go to Authentication > Users
2. Click "Add User" → "Create new user"
3. Set email and password for your admin account
4. Use this to sign in at `/auth`

### 4. Row Level Security (RLS)
Configure RLS policies in Supabase:
1. Go to Authentication > Policies
2. For admin operations, you may want to:
   - Disable RLS for admin tables (not recommended for production)
   - OR create policies that allow authenticated admin users to read/write
   - OR use the service role key for admin operations (set in `.env.local`)

### 5. Service Role Key (Optional)
For admin operations that bypass RLS:
1. Go to Supabase Dashboard > Settings > API
2. Copy the "service_role" key (keep this secret!)
3. Add to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## 📝 Usage Examples

### Server Component (Recommended)
```typescript
import { getWorkers } from "@/lib/supabase/queries";

export default async function MyPage() {
  const { data, count } = await getWorkers();
  return <div>Workers: {count}</div>;
}
```

### Client Component
```typescript
'use client'
import { createClient } from "@/lib/supabase/client";

export default function MyClientComponent() {
  const supabase = createClient();
  // Use for real-time subscriptions, interactive queries
}
```

### API Route
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from('users').select();
  return NextResponse.json(data);
}
```

## 🔐 Security Notes

1. **Never expose service role key** - Only use in server-side code, never in client components
2. **Use RLS policies** - Configure proper Row Level Security for your tables
3. **Validate admin access** - Consider adding role-based access control
4. **Protect sensitive operations** - Use the service role key only for admin operations that need elevated permissions

## 🐛 Troubleshooting

### "relation does not exist" error
- Check that table names in `queries.ts` match your Supabase schema
- Verify tables are created in your Supabase database

### "permission denied" error
- Check RLS policies in Supabase Dashboard
- Ensure your user is authenticated
- Consider using service role key for admin operations

### Authentication not working
- Verify `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Check that user exists in Supabase Auth
- Check browser console for errors

## 🚀 Next Steps

1. Create the database tables in Supabase
2. Update table/column names in `queries.ts` and page files
3. Create an admin user in Supabase Auth
4. Test sign-in at `/auth`
5. Configure RLS policies as needed
6. Add more queries as needed for other pages (bookings, payments, etc.)

