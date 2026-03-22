# Package Category Management System

This feature allows admins to manage package categories and requires housekeepers to select a category when creating service packages.

## Features Implemented

### 1. **Admin Settings Page**
- Navigate to **Settings** in the admin sidebar
- Full CRUD operations for categories:
  - ✅ Create new categories
  - ✅ Edit existing categories
  - ✅ Delete categories (only if not in use)
  - ✅ Toggle active/inactive status

### 2. **Category Management**
- Categories include:
  - Name (required, unique)
  - Description (optional)
  - Active status (controls visibility to housekeepers)
- Only active categories appear in the package creation form

### 3. **Package Creation (Housekeeper)**
- Category selection is now **required** when creating packages
- Dropdown shows only active categories
- Categories are fetched from admin-managed list
- Package displays category badge in the list view

## Database Changes

Run the migration script to set up the database:

```sql
-- Execute this in your Supabase SQL Editor
-- File: database/add_package_categories.sql
```

The migration will:
1. Create `package_categories` table
2. Populate with 7 default categories:
   - General Cleaning
   - Deep Cleaning
   - Laundry Services
   - Kitchen Cleaning
   - Bathroom Cleaning
   - Window Cleaning
   - Organization
3. Add `category_id` column to `packages` table
4. Set up foreign key relationship
5. Update existing packages to use default category

## API Endpoints

### Category Management (Admin)

```typescript
// Get all categories
GET /categories/
GET /categories/?active_only=true  // Only active categories

// Create category (Admin only)
POST /categories/
{
  "name": "Category Name",
  "description": "Optional description",
  "is_active": true
}

// Update category (Admin only)
PUT /categories/{category_id}
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_active": false
}

// Delete category (Admin only)
DELETE /categories/{category_id}
// Note: Will fail if packages are using this category
```

### Package Creation (Updated)

```typescript
// Create package - now requires category_id
POST /packages/
{
  "name": "Package Name",
  "description": "Description",
  "price": 500,
  "duration_hours": 2,
  "services": ["Service 1", "Service 2"],
  "category_id": 1  // Required!
}

// Response includes category info
{
  "package_id": 1,
  "worker_id": 123,
  "name": "Package Name",
  "category_id": 1,
  "category_name": "General Cleaning",
  ...
}
```

## Usage Guide

### For Admins

1. **Add Categories**:
   - Go to Settings → Package Categories
   - Click "Add Category"
   - Fill in name and optional description
   - Set active status

2. **Manage Categories**:
   - Edit: Click the edit icon on any category
   - Delete: Click the trash icon (only if unused)
   - Toggle Status: Edit and change "Active" checkbox

3. **Best Practices**:
   - Keep category names clear and concise
   - Use descriptions to clarify what belongs in each category
   - Don't delete categories with existing packages
   - Deactivate instead of deleting to preserve data

### For Housekeepers

1. **Creating Packages**:
   - Open Package Management
   - Click "Add New Package"
   - **Select a category** from dropdown (required)
   - Fill in other details
   - Submit

2. **If No Categories Available**:
   - Contact admin to add categories
   - Cannot create packages without categories

## Files Modified/Created

### Backend
- ✅ `backend/app/models_v2/category.py` - New category model
- ✅ `backend/app/models_v2/package.py` - Updated with category relationship
- ✅ `backend/app/routers/categories.py` - New category CRUD endpoints
- ✅ `backend/app/routers/packages.py` - Updated to require category
- ✅ `backend/app/main.py` - Registered category router

### Frontend (Mobile)
- ✅ `frontend/src/components/PackageManagement.tsx` - Updated with category dropdown

### Admin Web
- ✅ `casaligan_web/app/(shell)/settings/page.tsx` - New settings page
- ✅ `casaligan_web/app/ui/Shell.tsx` - Added Settings menu item

### Database
- ✅ `database/add_package_categories.sql` - Migration script

## Testing Checklist

- [ ] Run database migration
- [ ] Restart backend server
- [ ] Test admin category creation
- [ ] Test admin category editing
- [ ] Test admin category deletion (with/without packages)
- [ ] Test housekeeper package creation with category
- [ ] Verify category appears in package list
- [ ] Test category dropdown shows only active categories
- [ ] Test validation when no category selected

## Troubleshooting

**Issue**: Backend error "Category not found"
- **Solution**: Run the database migration to create categories

**Issue**: No categories in dropdown
- **Solution**: Admin needs to create categories in Settings page

**Issue**: Cannot delete category
- **Solution**: Category is in use by packages. Deactivate instead.

**Issue**: Old packages missing category
- **Solution**: Migration script assigns default category. Edit to update.

## Future Enhancements

Potential improvements:
- Category icons/images
- Category ordering/sorting
- Category usage statistics
- Bulk category assignment for packages
- Category-based filtering in package search
