import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import type { JobPost } from './JobDetailModal';
import { Camera, Edit2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

const resolveUploadUrl = (url: string) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
};

interface EditJobModalProps {
  job: JobPost;
  onClose: () => void;
  onSuccess: (updatedJob?: JobPost) => void;
}

export default function EditJobModal({ job, onClose, onSuccess }: EditJobModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Array<{category_id: number, name: string, description: string | null, is_active: boolean}>>([]);
  
  // Lock background scroll when modal is open
  useScrollLock(true);
  
  const [formData, setFormData] = useState({
    title: job.title,
    description: job.description,
    house_type: job.house_type,
    cleaning_type: job.cleaning_type,
    budget: job.budget.toString(),
    people_needed: job.people_needed.toString(),
    location: job.location || '',
    start_date: job.start_date || '',
    daily_start_time: job.multi_day_schedule?.daily_start_time || job.start_time || '',
    daily_end_time: job.multi_day_schedule?.daily_end_time || job.end_time || '',
  });
  
  const [selectedCategories, setSelectedCategories] = useState<number[]>(
    job.category_ids && job.category_ids.length > 0 
      ? job.category_ids 
      : job.category_id 
        ? [job.category_id] 
        : []
  );
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryDescription, setCustomCategoryDescription] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  
  const [images, setImages] = useState<string[]>(job.image_urls || []);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const token = localStorage.getItem('access_token');
      // Use owner-categories endpoint to include this owner's custom categories
      const response = await fetch(`${API_BASE_URL}/categories/owner-categories?active_only=true`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else {
        // Fallback to public endpoint
        const fallback = await fetch(`${API_BASE_URL}/categories/?active_only=true`);
        if (fallback.ok) {
          const data = await fallback.json();
          setCategories(data);
        }
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleAddCustomCategory = async () => {
    if (!customCategoryName.trim()) {
      alert('Please fill the field');
      return;
    }

    try {
      setAddingCategory(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/categories/owner-custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: customCategoryName.trim(),
          description: customCategoryDescription.trim() || null
        })
      });

      if (response.ok) {
        const newCategory = await response.json();
        setCategories((prev) => {
          if (prev.some((c) => c.category_id === newCategory.category_id)) {
            return prev;
          }
          return [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name));
        });
        setSelectedCategories((prev) =>
          prev.includes(newCategory.category_id) ? prev : [...prev, newCategory.category_id]
        );
        setCustomCategoryName('');
        setCustomCategoryDescription('');
      } else {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to create category');
      }
    } catch (error) {
      console.error('Failed to create custom category:', error);
      alert('Failed to create category');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (images.length >= 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    setUploadingImage(true);
    const token = localStorage.getItem('access_token');
    
    for (let i = 0; i < files.length && images.length + i < 5; i++) {
      const file = files[i];
      const imageFormData = new FormData();
      imageFormData.append('file', file);

      try {
        const response = await fetch(`${API_BASE_URL}/upload/image?category=job`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: imageFormData,
        });

        if (response.ok) {
          const data = await response.json();
          setImages(prev => [...prev, resolveUploadUrl(data.url)]);
        }
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    }
    
    setUploadingImage(false);
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const todayStr = new Date().toISOString().split('T')[0];

    if (!formData.start_date) {
      setError('Please select a job date');
      return;
    }

    if (formData.start_date < todayStr) {
      setError('Job date cannot be in the past');
      return;
    }

    if ((formData.daily_start_time && !formData.daily_end_time) || (!formData.daily_start_time && formData.daily_end_time)) {
      setError('Please provide both start time and end time');
      return;
    }

    if (formData.daily_start_time && formData.daily_end_time) {
      const [startHour, startMinute] = formData.daily_start_time.split(':').map(Number);
      const [endHour, endMinute] = formData.daily_end_time.split(':').map(Number);
      const startMinutes = (startHour * 60) + startMinute;
      const endMinutes = (endHour * 60) + endMinute;

      if (endMinutes <= startMinutes) {
        setError('End time must be later than start time');
        return;
      }

      if ((endMinutes - startMinutes) < 60) {
        setError('Schedule must be at least 1 hour');
        return;
      }

      if (formData.start_date === todayStr) {
        const now = new Date();
        const nowMinutes = (now.getHours() * 60) + now.getMinutes();
        if ((startMinutes - nowMinutes) < 30) {
          setError('For same-day jobs, start time must be at least 30 minutes from now');
          return;
        }
      }
    }
    
    // Validate at least one category is selected
    if (selectedCategories.length === 0) {
      setError('Please select at least one category');
      return;
    }
    
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      
      const updateData = {
        title: formData.title,
        description: formData.description,
        house_type: formData.house_type,
        cleaning_type: formData.cleaning_type,
        budget: parseFloat(formData.budget),
        people_needed: parseInt(formData.people_needed),
        image_urls: images,
        location: formData.location || null,
        category_ids: selectedCategories,
        start_date: formData.start_date,
        end_date: job.duration_type === 'short_term' ? formData.start_date : null,
        multi_day_schedule: (formData.daily_start_time && formData.daily_end_time) ? {
          num_days: job.multi_day_schedule?.num_days || 1,
          daily_start_time: formData.daily_start_time,
          daily_end_time: formData.daily_end_time,
        } : undefined,
      };
      
      const response = await fetch(`${API_BASE_URL}/jobs/${job.post_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update job post');
      }

      const updatedJob = await response.json();
      onSuccess(updatedJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update job post');
    } finally {
      setLoading(false);
    }
  };

  // Shared styles
  const inputClass = "w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]";
  const labelClass = "block text-[#4B244A] dark:text-white font-bold mb-2";
  const optionClass = "text-gray-900 dark:text-gray-900";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10 z-10">
          <div className="flex items-center gap-3">
            <Edit2 className="w-6 h-6 text-[#4B244A] dark:text-white" />
            <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white">Edit Job Post</h2>
          </div>
          <button onClick={onClose} className="text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 rounded-xl p-4">
              <p className="text-red-600 dark:text-red-200 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Job Title */}
          <div>
            <label className={labelClass}>Job Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className={inputClass}
              placeholder="e.g., Deep Cleaning Needed"
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              required
              rows={4}
              className={`${inputClass} resize-none`}
              placeholder="Describe the job details..."
            />
          </div>

          {/* Location */}
          <div>
            <label className={labelClass}>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className={inputClass}
              placeholder="e.g., Quezon City"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Job Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
                min={new Date().toISOString().split('T')[0]}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Start Time</label>
              <input
                type="time"
                name="daily_start_time"
                value={formData.daily_start_time}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>End Time</label>
              <input
                type="time"
                name="daily_end_time"
                value={formData.daily_end_time}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className={labelClass}>Categories * (Select one or more)</label>
            <div className="mb-3 p-3 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
              <p className="text-[#4B244A]/70 dark:text-white/70 text-xs font-medium">Add custom category</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={customCategoryName}
                  onChange={(e) => setCustomCategoryName(e.target.value)}
                  placeholder="Category name"
                  className={`${inputClass} !py-2 text-sm`}
                />
                <input
                  type="text"
                  value={customCategoryDescription}
                  onChange={(e) => setCustomCategoryDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className={`${inputClass} !py-2 text-sm`}
                />
              </div>
              <button
                type="button"
                onClick={handleAddCustomCategory}
                disabled={addingCategory}
                className="px-3 py-2 bg-[#EA526F] text-white text-sm font-bold rounded-lg hover:bg-[#d64460] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingCategory ? 'Adding...' : 'Add Category'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map(cat => (
                <label
                  key={cat.category_id}
                  className="flex items-center p-3 bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl cursor-pointer hover:bg-[#EA526F]/10 dark:hover:bg-[#EA526F]/20 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.category_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCategories([...selectedCategories, cat.category_id]);
                      } else {
                        setSelectedCategories(selectedCategories.filter(id => id !== cat.category_id));
                      }
                    }}
                    className="w-5 h-5 text-[#EA526F] bg-white/50 dark:bg-white/10 border-gray-300 dark:border-white/30 rounded focus:ring-[#EA526F] focus:ring-2"
                  />
                  <span className="ml-3 text-[#4B244A] dark:text-white font-medium">{cat.name}</span>
                </label>
              ))}
            </div>
            {selectedCategories.length === 0 && (
              <p className="text-red-500 text-sm mt-2">Please select at least one category</p>
            )}
          </div>

          {/* House Type and Cleaning Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>House Type *</label>
              <select
                name="house_type"
                value={formData.house_type}
                onChange={handleInputChange}
                required
                className={inputClass}
              >
                <option value="house" className={optionClass}>House</option>
                <option value="apartment" className={optionClass}>Apartment</option>
                <option value="condo" className={optionClass}>Condo</option>
                <option value="office" className={optionClass}>Office</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Cleaning Type *</label>
              <select
                name="cleaning_type"
                value={formData.cleaning_type}
                onChange={handleInputChange}
                required
                className={inputClass}
              >
                <option value="general" className={optionClass}>General Cleaning</option>
                <option value="deep" className={optionClass}>Deep Cleaning</option>
                <option value="move-in" className={optionClass}>Move-in Cleaning</option>
                <option value="move-out" className={optionClass}>Move-out Cleaning</option>
              </select>
            </div>
          </div>

          {/* Budget and People Needed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Budget (₱) *</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                className={inputClass}
                placeholder="5000"
              />
            </div>

            <div>
              <label className={labelClass}>People Needed *</label>
              <input
                type="number"
                name="people_needed"
                value={formData.people_needed}
                onChange={handleInputChange}
                required
                min="1"
                max="10"
                className={inputClass}
              />
            </div>
          </div>

          {/* Images */}
          <div>
            <label className={labelClass}>Job Images (Optional)</label>
            <div className="space-y-3 mt-2">
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {images.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={url} 
                        alt={`Job ${idx + 1}`} 
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-white/20"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {images.length < 5 && (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 dark:border-white/30 rounded-xl p-6 text-center hover:border-gray-400 dark:hover:border-white/50 transition-colors bg-white/50 dark:bg-white/5">
                    {uploadingImage ? (
                      <div className="text-[#4B244A]/70 dark:text-white/70 font-medium">Uploading...</div>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 mx-auto mb-2 text-[#4B244A]/50 dark:text-white/50" />
                        <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">Click to upload images</p>
                        <p className="text-[#4B244A]/50 dark:text-white/50 text-xs mt-1">{images.length}/5 images</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={uploadingImage || images.length >= 5}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EA526F]/30"
            >
              {loading ? 'Updating...' : 'Update Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
