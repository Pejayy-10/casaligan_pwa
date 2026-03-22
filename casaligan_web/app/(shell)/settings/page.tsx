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

  const handleDelete = async (categoryId: number) => {
    if (!confirm('Are you sure you want to delete this category? This will fail if any packages are using it.')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('package_categories')
        .delete()
        .eq('category_id', categoryId);

      if (error) throw error;
      loadCategories();
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(error.message || 'Failed to delete category. It may be in use by packages.');
    }
  };

  return (
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
          </div>
        </div>

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
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., General Cleaning, Deep Cleaning, Laundry"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4B244A]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this category..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4B244A]"
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
                </div>
              </div>
            </form>
          )}

          {/* Categories List */}
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
