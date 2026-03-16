'use client';

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
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

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
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsActive(true);
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setIsActive(category.is_active);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a category name');
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
      } else {
        // Create new category
        const { error } = await supabase
          .from('package_categories')
          .insert([payload]);
        
        if (error) throw error;
      }

      resetForm();
      loadCategories();
    } catch (error: any) {
      console.error('Save error:', error);
      alert(error.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const showDeleteModalForCategory = (category: Category) => {
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!categoryToDelete) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('package_categories')
        .delete()
        .eq('category_id', categoryToDelete.category_id);

      if (error) throw error;
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      loadCategories();
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(error.message || 'Failed to delete category. It may be in use by packages.');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-foreground/70 mt-2">Manage platform configuration and categories</p>
      </div>

      <div className="bg-muted rounded-lg shadow-md ring-1 ring-border">
        <div className="border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Package Categories</h2>
              <p className="text-sm text-foreground/70 mt-1">
                Manage categories for service packages
              </p>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-6 bg-background rounded-lg ring-1 ring-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {editingCategory ? 'Edit Category' : 'New Category'}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-foreground/70 hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., General Cleaning, Deep Cleaning, Laundry"
                    required
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-foreground/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground/70 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this category..."
                    rows={3}
                    className="w-full px-4 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-foreground/50"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-secondary border-border rounded focus:ring-secondary"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-foreground/70">
                    Active (visible to housekeepers)
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 border border-border text-foreground hover:bg-background/80 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📁</div>
              <p className="text-foreground/70">No categories yet</p>
              <p className="text-sm text-foreground/60 mt-1">Create your first category to organize packages</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.category_id}
                  className={`p-4 border rounded-lg transition-all ${
                    category.is_active
                      ? 'border-border bg-background'
                      : 'border-border bg-muted/70 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{category.name}</h3>
                        {!category.is_active && (
                          <span className="px-2 py-0.5 bg-border text-foreground/70 text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-foreground/70 mt-1">{category.description}</p>
                      )}
                      <p className="text-xs text-foreground/60 mt-2">
                        Created: {new Date(category.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => showDeleteModalForCategory(category)}
                        className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Delete"
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
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

