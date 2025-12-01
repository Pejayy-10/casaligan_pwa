# Matching Analytics - Setup Guide

## Overview
The matching analytics feature tracks employer-worker matches with success/failure status, match scores, and notes. This helps analyze matching patterns and improve the matching algorithm.

## Database Setup

### Step 1: Create the matching_records table
Run the following script in your Supabase SQL editor:

```bash
casaligan_web/scripts/create-matching-records-table.sql
```

This creates:
- `matching_records` table with all necessary columns
- Indexes for optimized queries
- Foreign key relationships to employers, workers, and packages

### Step 2: Add sample data
Run the sample data script:

```bash
casaligan_web/scripts/create-sample-matching-records.sql
```

This creates 25 sample matching records with:
- Mix of successful and failed matches
- Various match scores (68.50% to 95.60%)
- Realistic notes explaining match outcomes
- Date range from September to November 2025

## Table Schema

```sql
CREATE TABLE public.matching_records (
  match_id SERIAL PRIMARY KEY,
  employer_id INTEGER NOT NULL,
  worker_id INTEGER NOT NULL,
  package_id INTEGER,
  match_score NUMERIC(5,2),
  match_date TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'matched',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Columns:
- **match_id**: Unique identifier for each match record
- **employer_id**: Reference to the employer
- **worker_id**: Reference to the worker (housekeeper)
- **package_id**: Reference to the package (optional)
- **match_score**: Match quality score (0-100)
- **match_date**: When the match occurred
- **status**: Match outcome ('successful', 'failed', 'matched')
- **notes**: Additional information about the match
- **created_at**: Record creation timestamp

## Features

### Matching Records Table
The matching analytics page displays a comprehensive table with:

**Columns:**
- Employer name
- Housekeeper (worker) name
- Match date
- Status (with color-coded badges)
- Notes/Reason
- Actions (Delete button)

**Functionality:**
- Search by employer name, worker name, package, or notes
- Filter by status (All, Successful, Failed)
- Pagination (10 records per page)
- Delete match records with confirmation
- Real-time data from database

### Status Badges
- **Successful**: Green badge - Match resulted in hiring/booking
- **Failed**: Red badge - Match did not result in hiring

### Actions
- **Delete Match Record**: Removes the matching record from the database
  - Shows confirmation dialog before deletion
  - Immediately refreshes the table after deletion

## Backend API

Located in: `lib/supabase/matchingQueries.ts`

### Functions:

1. **getMatchingRecords(limit, offset, status?)**
   - Fetches matching records with employer, worker, and package details
   - Supports pagination and status filtering
   - Returns formatted records with flattened structure

2. **getMatchingRecordById(matchId)**
   - Fetches a single matching record by ID
   - Includes all related data

3. **deleteMatchingRecord(matchId)**
   - Deletes a matching record from the database
   - Returns true on success, throws error on failure

4. **getMatchingStats()**
   - Returns statistics: total matches, successful, failed, average score

5. **getMatchingAnalytics(startDate?, endDate?)**
   - Returns time-series data for charts
   - Groups matches by date with success/failure counts

## Usage

### Viewing Matching Records
1. Navigate to "Matching Analytics" in the admin dashboard
2. View analytics charts at the top
3. Scroll down to see the matching records table
4. Use search and filters to find specific records

### Deleting Records
1. Find the record you want to delete
2. Click the red trash icon in the Actions column
3. Confirm the deletion in the dialog
4. The table will refresh automatically

### Searching and Filtering
- **Search**: Type in the search bar to filter by employer, worker, package, or notes
- **Status Filter**: Use the dropdown to show only successful or failed matches
- **Pagination**: Navigate through pages using the < and > buttons

## Sample Data Explanation

The sample data includes realistic scenarios:

**Successful Matches:**
- "Hired for stay-in" - Full-time employment
- "Weekend work only" - Part-time arrangement
- "Part-time nanny" - Child care services
- "Full-time housekeeping" - Regular housekeeping
- "Premium service package" - High-end services

**Failed Matches:**
- "Decline by employer" - Employer rejected the match
- "Schedule conflict" - Timing didn't work
- "Worker declined" - Worker rejected the offer
- "Budget constraints" - Price too high
- "Location too far" - Distance issue
- "Qualifications mismatch" - Skills don't align

## Troubleshooting

### Table not showing data
1. Verify the table was created: Check Supabase Table Editor
2. Run the sample data script
3. Check browser console for errors
4. Verify Supabase connection in `.env.local`

### Delete not working
1. Check Supabase policies allow DELETE operations
2. Verify admin authentication
3. Check browser console for error messages

### Search not working
1. Verify data exists in the table
2. Check that column names match the query
3. Try refreshing the page

## Future Enhancements

Potential additions:
- Export matching records to CSV
- Advanced filtering (date range, match score range)
- Match record details modal
- Bulk delete functionality
- Match analytics dashboard improvements
- Integration with ML matching algorithm
