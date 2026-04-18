"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Category {
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
    show: false, title: "", message: "", isError: false,
  });
  
  // Form state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showFormModal || categoryToDelete || alertModal.show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showFormModal, categoryToDelete, alertModal.show]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('package_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      if (data) setCategories(data);
    } catch (error: any) {
      console.error('Failed to load categories:', error);
      setAlertModal({ show: true, title: "Loading Error", message: error.message || "Failed to load categories", isError: true });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsActive(true);
    setEditingCategory(null);
    setShowFormModal(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setIsActive(category.is_active);
    setShowFormModal(true);
  };

  const handleAddNew = () => {
    resetForm();
    setShowFormModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setAlertModal({ show: true, title: "Missing Information", message: "Please enter a category name.", isError: true });
      return;
    }

    try {
      setSubmitting(true);
      const supabase = createClient();
      
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive
      };

      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('package_categories')
          .update(payload)
          .eq('category_id', editingCategory.category_id);
        
        if (error) throw error;
        setAlertModal({ show: true, title: "Success", message: "Category updated successfully.", isError: false });
      } else {
        // Create new category
        const { error } = await supabase
          .from('package_categories')
          .insert([payload]);
        
        if (error) throw error;
        setAlertModal({ show: true, title: "Success", message: "Category created successfully.", isError: false });
      }

      resetForm();
      loadCategories();
    } catch (error: any) {
      console.error('Save error:', error);
      setAlertModal({ show: true, title: "Save Error", message: error.message || "Failed to save category.", isError: true });
    } finally {
      setSubmitting(false);
    }
  };

<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
  const showDeleteModalForCategory = (category: Category) => {
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirmed = async () => {
=======
  const executeDelete = async () => {
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
    if (!categoryToDelete) return;

    try {
      setSubmitting(true);
      const supabase = createClient();
      const { error } = await supabase
        .from('package_categories')
        .delete()
        .eq('category_id', categoryId);

      if (error) throw error;
<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
      setShowDeleteModal(false);
      setCategoryToDelete(null);
=======
      
      setAlertModal({ show: true, title: "Success", message: "Category deleted successfully.", isError: false });
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
      loadCategories();
    } catch (error: any) {
      console.error('Delete error:', error);
      setAlertModal({ show: true, title: "Deletion Error", message: error.message || "Failed to delete category. It may be in use by packages.", isError: true });
    } finally {
      setSubmitting(false);
      setCategoryToDelete(null);
    }
  };

  return (
<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage platform configuration and categories</p>
      </div>

      {/* Category Management Section */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Package Categories</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage categories for service packages
              </p>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#4B244A] text-white rounded-lg hover:bg-[#6B3468] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            )}
=======
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage platform configuration and service categories</p>
      </div>

      <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-4">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div>
            <h3 className="text-base font-semibold text-foreground">Package Categories</h3>
            <p className="text-sm text-muted-foreground">Add, edit, or remove categories available for service packages</p>
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
          </div>
          <button
            onClick={handleAddNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
        <div className="p-6">
          {/* Category Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingCategory ? 'Edit Category' : 'New Category'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name *
=======
        {/* Categories List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 rounded-xl bg-muted/10 border border-border/50">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-foreground font-medium">No categories yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first category to organize packages</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div
                key={category.category_id}
                className={`flex flex-col justify-between p-5 border rounded-xl transition-all ${
                  category.is_active 
                    ? 'border-border bg-background shadow-sm hover:border-primary/50' 
                    : 'border-border/50 bg-muted/10 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-foreground text-lg leading-tight break-words">{category.name}</h3>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      category.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {category.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {category.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">{category.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic opacity-50">No description provided</p>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Added: {new Date(category.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(category)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/30 transition-colors"
                      title="Edit Category"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCategoryToDelete(category)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-danger/10 text-danger hover:bg-danger/30 transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==============================================
          FORM MODAL (ADD / EDIT)
          ============================================== */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !submitting && resetForm()}>
          <div className="bg-background border border-border rounded-2xl max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h2>
              <button 
                onClick={resetForm}
                disabled={submitting}
                className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    Category Name <span className="text-danger">*</span>
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., General Cleaning, Deep Cleaning"
                    required
<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-foreground/50"
=======
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
                  />
                </div>

                <div>
<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
                  <label className="block text-sm font-medium text-foreground/70 mb-2">
=======
                  <label className="block text-sm font-semibold text-foreground mb-2">
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this category..."
                    rows={3}
<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-foreground/50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-[#4B244A] border-gray-300 rounded focus:ring-[#4B244A]"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Active (visible to housekeepers)
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2 bg-[#4B244A] text-white rounded-lg hover:bg-[#6B3468] transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
=======
                    disabled={submitting}
                    className="w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                  />
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
                </div>

<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4B244A]"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📁</div>
              <p className="text-gray-500">No categories yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first category to organize packages</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.category_id}
                  className={`p-4 border rounded-lg transition-all ${
                    category.is_active 
                      ? 'border-gray-200 bg-white' 
                      : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{category.name}</h3>
                        {!category.is_active && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Created: {new Date(category.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.category_id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
=======
                <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-xl border border-border/50">
                  <div className="relative flex items-start">
                    <div className="flex h-6 items-center">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        disabled={submitting}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 cursor-pointer"
                      />
                    </div>
                    <div className="ml-3 text-sm leading-6">
                      <label htmlFor="isActive" className="font-medium text-foreground cursor-pointer">
                        Active Status
                      </label>
                      <p className="text-muted-foreground text-xs">If active, this category will be visible to housekeepers when creating packages.</p>
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10 rounded-b-2xl">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 min-w-[120px]"
                >
                  {submitting ? 'Saving...' : (
                    <>
                      <Check className="w-4 h-4" />
                      {editingCategory ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
      </div>

      {showDeleteModal && categoryToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Delete category?</h2>
                <p className="text-sm text-foreground/70 mt-1">
                  This will fail if any packages are using it.
                  Are you sure you want to continue?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-muted-foreground hover:text-foreground text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-lg bg-danger text-white hover:bg-danger/90"
              >
                Delete
=======
      )}

      {/* ==============================================
          CONFIRMATION MODALS
          ============================================== */}

      {/* Delete Category Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !submitting && setCategoryToDelete(null)}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Are you sure you want to delete the category <span className="font-semibold text-foreground">"{categoryToDelete.name}"</span>?
            </p>
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-6">
              <p className="text-xs text-danger leading-relaxed">
                <strong>Warning:</strong> This action cannot be undone. If any active service packages are currently using this category, the deletion will fail.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                disabled={submitting} 
                onClick={() => setCategoryToDelete(null)} 
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                disabled={submitting} 
                onClick={executeDelete} 
                className="px-4 py-2 text-sm rounded-md bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Delete Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Feedback Modal */}
      {alertModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-danger" : ""}`}>
              {alertModal.title}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">{alertModal.message}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setAlertModal({ ...alertModal, show: false })} 
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
<<<<<<< Updated upstream:app/(shell)/settings/page.tsx
}

=======
}
>>>>>>> Stashed changes:casaligan_web/app/(shell)/settings/page.tsx
