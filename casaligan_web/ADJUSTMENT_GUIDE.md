# Adjustment Guide: Matching Your Database Schema

## What I Mean by "Adjust Table/Column Names"

I wrote the code with **generic/example table and column names** because I don't know your actual Supabase database structure. You'll need to update these to match what you actually have in your database.

---

## 1. **Table Names** - These are guesses!

### In `lib/supabase/queries.ts`, I used:

```typescript
// Line 14: I'm querying a table called 'users'
supabase.from('users').select('*', ...)

// Line 31: I'm querying a table called 'workers'  
supabase.from('workers').select('*', ...)

// Line 49: I'm querying a table called 'employers'
supabase.from('employers').select('*', ...)

// Line 67: I'm querying a table called 'bookings'
supabase.from('bookings').select('*', ...)
```

### ❓ Your actual table names might be different!

**Examples:**
- Maybe your table is called `kasambahay_workers` instead of `workers`
- Maybe it's called `worker_profiles` instead of `workers`
- Maybe it's `employer_accounts` instead of `employers`
- Maybe it's `job_postings` instead of `jobs`
- Maybe it's `reservations` instead of `bookings`

**How to find your table names:**
1. Go to your Supabase Dashboard
2. Click on "Table Editor" in the left sidebar
3. You'll see all your table names listed there

**What to change:**
- Open `lib/supabase/queries.ts`
- Replace `'workers'` with your actual table name (e.g., `'kasambahay_workers'`)
- Replace `'employers'` with your actual table name
- Replace `'users'`, `'jobs'`, `'bookings'` with your actual table names

---

## 2. **Column Names** - These are also guesses!

### In `app/(shell)/users/workers/page.tsx`, I'm mapping columns like:

```typescript
const rows = workers.map((worker: any) => ({
  id: worker.id,                                    // ✅ Probably correct
  name: worker.name ||                              // ❓ Does this column exist?
       worker.full_name ||                          // ❓ Or maybe this one?
       `${worker.first_name} ${worker.last_name}` || // ❓ Or split like this?
       "N/A",
  email: worker.email,                              // ❓ Is it 'email' or 'email_address'?
  status: worker.status ||                          // ❓ Is it 'status' or 'account_status'?
            worker.verification_status || 
            "pending",
  date: worker.created_at,                          // ❓ Is it 'created_at' or 'date_created'?
  phone: worker.phone ||                            // ❓ Is it 'phone' or 'phone_number'?
           worker.phone_number || 
           "N/A",
}));
```

### ❓ Your actual column names might be different!

**Examples:**
- Maybe your column is `full_name` instead of `name`
- Maybe it's `email_address` instead of `email`
- Maybe it's `mobile_phone` instead of `phone`
- Maybe it's `date_created` instead of `created_at`
- Maybe it's `account_status` instead of `status`

**How to find your column names:**
1. Go to Supabase Dashboard > Table Editor
2. Click on a table (e.g., your workers table)
3. You'll see all the column names at the top

**What to change:**
- Open `app/(shell)/users/workers/page.tsx`
- Update the field mappings to match your actual column names
- Remove any `|| worker.other_name` alternatives that don't exist in your database

---

## 3. "The Code Handles Missing Data" - What This Means

### Error Handling Built-In

Look at the queries - they have error handling:

```typescript
// In queries.ts
const { data, error, count } = await supabase.from('workers').select('*', ...)

if (error) {
  console.error('Error fetching workers:', error)  // Logs error to console
  return { data: [], count: 0, error }             // Returns empty array instead of crashing
}

return { data: data || [], count: count || 0, error: null }
```

### What happens if table doesn't exist?

**If your table is missing:**
- ❌ Supabase returns an error: `"relation 'workers' does not exist"`
- ✅ The code catches this error
- ✅ Returns `{ data: [], count: 0 }` (empty array)
- ✅ Your page still loads, but shows 0 workers
- ✅ You'll see the error in your browser console/server logs

**So the app won't crash**, but it also won't show any data until you:
1. Create the tables in Supabase, OR
2. Update the table names in the code to match existing tables

---

## 📋 Quick Checklist

To make everything work, you need to:

### Step 1: Check Your Supabase Database
1. Open Supabase Dashboard
2. Go to Table Editor
3. Note down your actual table names and column names

### Step 2: Update Table Names
- [ ] Open `lib/supabase/queries.ts`
- [ ] Change `'users'` → your actual users table name
- [ ] Change `'workers'` → your actual workers table name  
- [ ] Change `'employers'` → your actual employers table name
- [ ] Change `'jobs'` → your actual jobs table name
- [ ] Change `'bookings'` → your actual bookings table name
- [ ] Change `'activity_logs'` → your actual activity logs table name (if exists)

### Step 3: Update Column Mappings
- [ ] Open `app/(shell)/users/workers/page.tsx`
- [ ] Update field mappings to match your `workers` table columns
- [ ] Open `app/(shell)/users/employers/page.tsx`
- [ ] Update field mappings to match your `employers` table columns

### Step 4: Test
- [ ] Run your app: `npm run dev`
- [ ] Check browser console for any errors
- [ ] Verify data shows up correctly

---

## 🐛 Example: If Your Tables Are Different

**Let's say your actual Supabase tables are:**
- `kasambahay_workers` (not `workers`)
- `employer_accounts` (not `employers`)
- `job_postings` (not `jobs`)

**Then in `queries.ts`, you'd change:**

```typescript
// BEFORE (my guess):
.from('workers')

// AFTER (your actual table):
.from('kasambahay_workers')
```

**And if your worker table has columns like:**
- `full_name` (not `name`)
- `mobile_phone` (not `phone`)
- `account_status` (not `status`)

**Then in `workers/page.tsx`, you'd change:**

```typescript
// BEFORE (my guess):
name: worker.name || worker.full_name || ...

// AFTER (your actual column):
name: worker.full_name || "N/A",

// BEFORE:
phone: worker.phone || worker.phone_number || "N/A"

// AFTER:
phone: worker.mobile_phone || "N/A"
```

---

## 💡 Need Help?

If you're not sure what your table/column names are:
1. Check your Supabase Dashboard > Table Editor
2. Or check your database schema SQL files if you have them
3. Or run a test query in Supabase SQL Editor: `SELECT * FROM your_table_name LIMIT 1;`

The code is flexible enough to handle errors gracefully, but you'll need to adjust the names to match your actual database structure!

