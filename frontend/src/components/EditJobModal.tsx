import { useState, useEffect } from 'react';
import type { JobPost } from './JobDetailModal';

interface EditJobModalProps {
  job: JobPost;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditJobModal({ job, onClose, onSuccess }: EditJobModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Array<{category_id: number, name: string, description: string | null, is_active: boolean}>>([]);
  
  const [formData, setFormData] = useState({
    title: job.title,
    description: job.description,
    house_type: job.house_type,
    cleaning_type: job.cleaning_type,
    budget: job.budget.toString(),
    people_needed: job.people_needed.toString(),
    location: job.location || '',
    category_id: job.category_id?.toString() || '',
  });
  
  const [images, setImages] = useState<string[]>(job.image_urls || []);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/categories/?active_only=true');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
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
        const response = await fetch('http://127.0.0.1:8000/upload/image?category=job', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: imageFormData,
        });

        if (response.ok) {
          const data = await response.json();
          setImages(prev => [...prev, `http://127.0.0.1:8000${data.url}`]);
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
        category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
      };
      
      const response = await fetch(`http://127.0.0.1:8000/jobs/${job.post_id}`, {
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

      onSuccess();
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
      <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20">
        {/* Header */}
        <div className="sticky top-0 bg-[#E8E4E1]/90 dark:bg-slate-900/90 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10 z-10">
          <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white">✏️ Edit Job Post</h2>
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

          {/* Basic Information */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/50 dark:border-white/10 shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Basic Information</h3>
            
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
          </div>

          {/* Job Details */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/50 dark:border-white/10 shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Job Details</h3>
            
            <div>
              <label className={labelClass}>Category *</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleInputChange}
                required
                className={inputClass}
              >
                <option value="" className={optionClass}>Select a category...</option>
                {categories.map(cat => (
                  <option key={cat.category_id} value={cat.category_id} className={optionClass}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            
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
          </div>

          {/* Images */}
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/50 dark:border-white/10 shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-[#4B244A] dark:text-white mb-2">Job Images (Optional)</h3>
            <div className="space-y-3">
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
                        <div className="text-4xl mb-2 opacity-50">📸</div>
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
