# Job Multiple Categories Setup Guide

## Overview
This feature allows job posts to have multiple categories, just like packages can have multiple categories. Job owners can now select one or more categories when creating or editing job posts.

## Changes Made

### Backend Changes

1. **Database Structure**
   - Created `job_category_mapping` junction table for many-to-many relationship
   - Kept `category_id` column in `forumposts` for backward compatibility

2. **Models** (`backend/app/models_v2/`)
   - `job_category_mapping.py`: New junction table model
   - `forum.py`: Added `categories` relationship to `ForumPost` model

3. **Schemas** (`backend/app/schemas/job.py`)
   - `JobPostCreate`: Added `category_ids: List[int]` field
   - `JobPostResponse`: Added `category_ids` and `category_names` arrays
   - `JobPostUpdate`: Added `category_ids: Optional[List[int]]` field
   - Updated `from_orm_model` to populate category arrays from relationship

4. **Routes** (`backend/app/routers/jobs.py`)
   - `create_job_post`: Now accepts and assigns multiple categories
   - `update_job_post`: Now supports updating multiple categories
   - `get_job_posts`, `get_my_job_posts`, `get_job_post`: Added eager loading for categories relationship

### Frontend Changes

1. **Types** (`frontend/src/components/JobDetailModal.tsx`)
   - Added `category_ids?: number[]` to `JobPost` interface
   - Added `category_names?: string[]` to `JobPost` interface

2. **Create Job Page** (`frontend/src/pages/CreateJobPage.tsx`)
   - Replaced single category dropdown with checkbox list
   - Added `selectedCategories` state to track multiple selections
   - Updated form submission to send `category_ids` array
   - Added validation to require at least one category

3. **Edit Job Modal** (`frontend/src/components/EditJobModal.tsx`)
   - Replaced single category dropdown with checkbox list
   - Added `selectedCategories` state initialized from job data
   - Updated form submission to send `category_ids` array
   - Added validation to require at least one category

4. **Job Listing** (`frontend/src/pages/JobsPage.tsx`)
   - Updated `HousekeeperJobsContent` to display multiple categories as badges
   - Updated category filter to check both `category_id` and `category_ids`
   - Added visual distinction for multiple categories with purple badges

## Database Migration Required

**IMPORTANT:** You must run this SQL migration in Supabase before the feature will work properly.

### Migration File
`database/add_job_multiple_categories.sql`

### Steps to Run Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `database/add_job_multiple_categories.sql`
4. Copy all the SQL content
5. Paste it into the Supabase SQL Editor
6. Click **Run** to execute the migration

### What the Migration Does

1. Creates the `job_category_mapping` table with:
   - `post_id` (references forumposts)
   - `category_id` (references package_categories)
   - Primary key on both columns (prevents duplicates)
   - Indexes for better query performance

2. Migrates existing data:
   - Copies existing single category assignments from `forumposts.category_id` to the junction table
   - Preserves `category_id` column for backward compatibility

## Testing the Feature

### As a House Owner (Creating Jobs)

1. **Create New Job Post**
   - Go to Jobs page
   - Click "Post a Job" or similar button
   - Fill in job details
   - **Select one or more categories using checkboxes**
   - Submit the form
   - Verify the job is created with multiple categories

2. **Edit Existing Job Post**
   - Go to your job posts
   - Click edit on a job
   - **Change category selections using checkboxes**
   - Save changes
   - Verify categories are updated

### As a Housekeeper (Viewing Jobs)

1. **Browse Jobs**
   - Go to Jobs page
   - View job listings
   - **Verify multiple categories are displayed as purple badges**
   - Use category filter to filter jobs
   - Verify jobs with multiple categories appear when filtering by any of their categories

2. **View Job Details**
   - Click on a job to see details
   - Verify all categories are visible

## UI Design

### Category Selection (Create/Edit)
- Checkbox grid layout (1 column on mobile, 2 on tablet, 3 on desktop)
- Each checkbox in a styled card with hover effect
- Visual feedback when selected
- Error message shown if no categories selected

### Category Display (Job Listings)
- Multiple categories shown as purple badges with 🏷️ icon
- Categories displayed above job details (house type, cleaning type, etc.)
- Consistent styling with dark mode support

## Backward Compatibility

The implementation maintains backward compatibility:

1. **Old API Clients**: Can still use single `category_id` field
2. **Database**: Keeps `category_id` column, automatically set to first category in array
3. **Existing Data**: Migration copies existing single categories to junction table

## API Examples

### Create Job with Multiple Categories

```json
POST /jobs/
{
  "title": "Deep Cleaning Needed",
  "description": "3-bedroom house needs deep cleaning",
  "house_type": "house",
  "cleaning_type": "deep_cleaning",
  "budget": 5000,
  "people_needed": 2,
  "duration_type": "short_term",
  "category_ids": [1, 2, 3],  // Multiple categories
  "location": "Quezon City"
}
```

### Response with Multiple Categories

```json
{
  "post_id": 123,
  "title": "Deep Cleaning Needed",
  "category_id": 1,              // First category (backward compatibility)
  "category_name": "General Cleaning",
  "category_ids": [1, 2, 3],     // All categories
  "category_names": [
    "General Cleaning",
    "Deep Cleaning",
    "Move In/Out Cleaning"
  ],
  // ... other fields
}
```

### Update Job Categories

```json
PUT /jobs/123
{
  "category_ids": [2, 4]  // Update to different categories
}
```

## Troubleshooting

### Backend Errors

**Error: "job_category_mapping table does not exist"**
- Solution: Run the database migration in Supabase

**Error: "categories relationship not found"**
- Solution: Restart the backend server to reload model relationships

### Frontend Issues

**Categories not showing checkboxes**
- Solution: Clear browser cache and refresh
- Check if categories API is loading correctly

**Form validation failing**
- Solution: Ensure at least one category is selected before submitting

**Old jobs showing no categories**
- Solution: Run the migration to populate junction table from existing data

## Related Files

### Backend
- `backend/app/models_v2/job_category_mapping.py` - Junction table model
- `backend/app/models_v2/forum.py` - ForumPost model with categories relationship
- `backend/app/schemas/job.py` - Job schemas with category arrays
- `backend/app/routers/jobs.py` - Job endpoints with category handling

### Frontend
- `frontend/src/pages/CreateJobPage.tsx` - Job creation form with category checkboxes
- `frontend/src/components/EditJobModal.tsx` - Job editing modal with category checkboxes
- `frontend/src/pages/JobsPage.tsx` - Job listings with category display
- `frontend/src/components/JobDetailModal.tsx` - JobPost interface definition

### Database
- `database/add_job_multiple_categories.sql` - Migration script

## Next Steps

1. ✅ Run the database migration in Supabase
2. ✅ Restart the backend server
3. ✅ Test creating a job with multiple categories
4. ✅ Test editing job categories
5. ✅ Test category filtering as a housekeeper
6. ✅ Verify mobile responsiveness

## Additional Notes

- The feature mirrors the package multiple categories implementation
- Category selection uses the same styling and behavior as package management
- The category filter for housekeepers now works with jobs that have multiple categories
- All existing functionality is preserved while adding the new multi-category support
