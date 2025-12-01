# Worker Sample Data Setup

This document explains how to add sample worker data to your Supabase database.

## Prerequisites

Make sure you have already added the 'banned' and 'restricted' status values to your user_status enum:

```sql
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'banned';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'restricted';
```

## How to Add Sample Workers

1. Go to your Supabase Dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file: `scripts/create-sample-workers.sql`
5. Copy the entire SQL script
6. Paste it into the SQL Editor
7. Click **Run** or press `Ctrl+Enter`

## What This Script Creates

The script will create **5 sample workers** with the following:

### Worker 1: Maria Santos
- **Status:** Active
- **Experience:** 5 years
- **Skills:** Cooking, Cleaning, Laundry
- **Certifications:** First Aid Certificate, Food Handler Certificate
- **Languages:** English, Filipino

### Worker 2: John Cruz
- **Status:** Active
- **Experience:** 8 years
- **Skills:** Driver, House Management, Gardening
- **Certifications:** Driving License, First Aid Certificate
- **Languages:** English, Tagalog

### Worker 3: Ana Reyes
- **Status:** Active
- **Experience:** 15 years
- **Skills:** Child Care, Elderly Care, Cooking
- **Certifications:** Child Care Training, Elderly Care Training, CPR Certified
- **Languages:** English, Filipino, Cebuano

### Worker 4: Pedro Garcia
- **Status:** Restricted (for testing unrestrict feature)
- **Experience:** 4 years
- **Skills:** Cleaning, Ironing, Pet Care
- **Certifications:** Housekeeping Certificate
- **Languages:** Filipino, Tagalog

### Worker 5: Lisa Fernandez
- **Status:** Banned (for testing unban feature)
- **Experience:** 3 years
- **Skills:** Cleaning, Laundry, Ironing
- **Certifications:** Housekeeping Certificate
- **Languages:** English, Filipino

## What the Script Also Creates

The script automatically creates supporting data if it doesn't exist:

- **Skills:** 10 different skills (Cooking, Cleaning, Child Care, etc.)
- **Certifications:** 7 certifications (First Aid, CPR, Driving License, etc.)
- **Languages:** 7 languages (English, Filipino, Tagalog, etc.)
- **Religions:** 5 religions (Roman Catholic, Protestant, Islam, etc.)
- **Location data:** Sample province, city, barangay, and addresses

## Testing the Features

After running the script, you can test:

1. **View Worker Details:** Click the eye icon to see worker info, skills, certifications, and languages
2. **Ban/Unban:** Test banning Maria Santos, then unban her
3. **Restrict/Unrestrict:** Test with Pedro Garcia who is already restricted
4. **Instant Updates:** Notice the table updates without page reload

## Notes

- All sample workers use dummy email addresses
- Password hashes are placeholder values (not real passwords)
- Phone numbers are in Philippine format
- The script is safe to run multiple times (uses INSERT with conflict handling)
