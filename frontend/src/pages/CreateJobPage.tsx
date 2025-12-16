import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import type { User } from '../types';

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    house_type: 'house',
    cleaning_type: 'general',
    budget: '',
    people_needed: '1',
    duration_type: 'short_term',
    job_date: '', // For short-term one-time jobs
    start_date: '',
    end_date: '',
    location: '',
    category_id: '',
    // Payment schedule fields
    payment_frequency: 'monthly',
    payment_amount: '',
    payment_dates: ['15', '30'], // For monthly payments
    payment_method_preference: 'gcash',
    // Recurring schedule fields
    is_recurring: false,
    day_of_week: '',
    start_time: '',
    end_time: '',
    frequency: 'weekly'
  });
  
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categories, setCategories] = useState<Array<{category_id: number, name: string, description: string | null, is_active: boolean}>>([]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (!user.is_owner) {
      navigate('/dashboard');
    } else {
      loadCategories();
    }
  }, [user, navigate]);

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
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('http://127.0.0.1:8000/upload/image?category=job', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          // Store full URL for preview, but we'll send relative URL to backend
          setImages(prev => [...prev, `http://127.0.0.1:8000${data.url}`]);
        } else {
          console.error('Failed to upload image');
        }
      } catch (err) {
        console.error('Error uploading image:', err);
      }
    }
    
    setUploadingImage(false);
    e.target.value = ''; // Reset input
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
      
      const jobData: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        house_type: formData.house_type,
        cleaning_type: formData.cleaning_type,
        budget: parseFloat(formData.budget),
        people_needed: parseInt(formData.people_needed),
        image_urls: images,
        duration_type: formData.duration_type,
        location: formData.location || null,
        category_id: parseInt(formData.category_id)
      };
      
      // For short-term jobs, use job_date as both start and end date
      if (formData.duration_type === 'short_term') {
        jobData.start_date = formData.job_date || null;
        jobData.end_date = formData.job_date || null;
      } else {
        jobData.start_date = formData.start_date || null;
        jobData.end_date = formData.end_date || null;
      }
      
      // Add payment schedule for long-term jobs
      if (formData.duration_type === 'long_term') {
        jobData.payment_schedule = {
          frequency: formData.payment_frequency,
          payment_amount: parseFloat(formData.payment_amount),
          payment_dates: formData.payment_dates,
          payment_method_preference: formData.payment_method_preference
        };
      }
      
      // Add recurring schedule if enabled
      if (formData.is_recurring) {
        jobData.recurring_schedule = {
          is_recurring: true,
          day_of_week: formData.day_of_week,
          start_time: formData.start_time,
          end_time: formData.end_time,
          frequency: formData.frequency
        };
      }
      
      const response = await fetch('http://127.0.0.1:8000/jobs/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(jobData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create job post');
      }

      alert('Job posted successfully!');
      navigate('/jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job post');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  // Shared styles
  const inputClass = "w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]";
  const labelClass = "block text-[#4B244A] dark:text-white font-bold mb-2";
  const cardClass = "bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 border border-white/50 dark:border-white/10 shadow-lg";
  // Added class for options to ensure visibility in dropdowns
  const optionClass = "text-gray-900 dark:text-gray-900";

  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 pb-20 relative">
      {/* Decorative circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center">
          <button onClick={() => navigate('/jobs')} className="text-[#4B244A] dark:text-white mr-4 hover:opacity-70 transition-opacity">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white">📝 Post a Job</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 rounded-xl p-4">
              <p className="text-red-600 dark:text-red-200 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Basic Info Card */}
          <div className={cardClass}>
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Job Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  minLength={5}
                  placeholder="e.g., Deep Cleaning Needed for 2-Bedroom Condo"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  minLength={20}
                  rows={4}
                  placeholder="Describe the cleaning job, special requirements, access instructions, etc."
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Job Details Card */}
          <div className={cardClass}>
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">Job Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Location *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Quezon City, Metro Manila or specific barangay"
                  className={inputClass}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>House Type *</label>
                  <select
                    name="house_type"
                    value={formData.house_type}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    <option value="house" className={optionClass}>House</option>
                    <option value="apartment" className={optionClass}>Apartment</option>
                    <option value="condo" className={optionClass}>Condominium</option>
                    <option value="townhouse" className={optionClass}>Townhouse</option>
                    <option value="office" className={optionClass}>Office</option>
                    <option value="other" className={optionClass}>Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Cleaning Type *</label>
                  <select
                    name="cleaning_type"
                    value={formData.cleaning_type}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    <option value="general" className={optionClass}>General Cleaning</option>
                    <option value="deep_cleaning" className={optionClass}>Deep Cleaning</option>
                    <option value="move_in_out" className={optionClass}>Move In/Out Cleaning</option>
                    <option value="post_construction" className={optionClass}>Post-Construction Cleaning</option>
                    <option value="spring_cleaning" className={optionClass}>Spring Cleaning</option>
                    <option value="maintenance" className={optionClass}>Regular Maintenance</option>
                  </select>
                </div>

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

                <div>
                  <label className={labelClass}>Budget (₱) *</label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    required
                    min="100"
                    step="50"
                    placeholder="5000"
                    className={inputClass}
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
          </div>

          {/* Images Card */}
          <div className={cardClass}>
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">📷 Area Photos (Optional)</h2>
            <p className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-4">Add up to 5 photos of the area to be cleaned</p>
            
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-center gap-2 px-6 py-4 bg-white/50 dark:bg-white/10 backdrop-blur-sm border-2 border-dashed border-gray-300 dark:border-white/30 rounded-xl text-[#4B244A] dark:text-white cursor-pointer hover:bg-white/80 dark:hover:bg-white/20 transition-all font-medium">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {uploadingImage ? 'Uploading...' : `Upload Photos (${images.length}/5)`}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={images.length >= 5 || uploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mt-4">
                {images.map((url, index) => (
                  <div key={index} className="relative bg-white/50 dark:bg-white/10 rounded-lg p-2 border border-gray-200 dark:border-white/10">
                    <img src={url} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duration Card */}
          <div className={cardClass}>
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">Duration</h2>
            
            <div>
              <label className={labelClass}>Job Duration *</label>
              <select
                name="duration_type"
                value={formData.duration_type}
                onChange={handleInputChange}
                className={inputClass}
              >
                <option value="short_term" className={optionClass}>Short Term (One-time)</option>
                <option value="long_term" className={optionClass}>Long Term (Recurring)</option>
              </select>
            </div>

            {/* Date picker for short-term jobs */}
            {formData.duration_type === 'short_term' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className={labelClass}>Job Date *</label>
                  <input
                    type="date"
                    name="job_date"
                    value={formData.job_date}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'short_term'}
                    min={new Date().toISOString().split('T')[0]}
                    className={inputClass}
                  />
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-1">When should the housekeeper come?</p>
                </div>
                
                {/* Recurring Schedule Option */}
                <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 dark:border-white/30 text-[#EA526F] focus:ring-[#EA526F]"
                    />
                    <div>
                      <span className="text-blue-800 dark:text-white font-bold">🔄 Make this a recurring job</span>
                      <p className="text-blue-600 dark:text-white/70 text-xs mt-1 font-medium">
                        Set a regular schedule (e.g., every Saturday) so you don't need to post again
                      </p>
                    </div>
                  </label>
                </div>
                
                {formData.is_recurring && (
                  <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 space-y-4 border border-gray-200 dark:border-white/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Day of Week *</label>
                        <select
                          name="day_of_week"
                          value={formData.day_of_week}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className={inputClass}
                        >
                          <option value="" className={optionClass}>Select day</option>
                          <option value="monday" className={optionClass}>Monday</option>
                          <option value="tuesday" className={optionClass}>Tuesday</option>
                          <option value="wednesday" className={optionClass}>Wednesday</option>
                          <option value="thursday" className={optionClass}>Thursday</option>
                          <option value="friday" className={optionClass}>Friday</option>
                          <option value="saturday" className={optionClass}>Saturday</option>
                          <option value="sunday" className={optionClass}>Sunday</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className={labelClass}>Frequency *</label>
                        <select
                          name="frequency"
                          value={formData.frequency}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className={inputClass}
                        >
                          <option value="weekly" className={optionClass}>Every Week</option>
                          <option value="biweekly" className={optionClass}>Every 2 Weeks</option>
                          <option value="monthly" className={optionClass}>Monthly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className={labelClass}>Start Time *</label>
                        <input
                          type="time"
                          name="start_time"
                          value={formData.start_time}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className={inputClass}
                        />
                      </div>
                      
                      <div>
                        <label className={labelClass}>End Time *</label>
                        <input
                          type="time"
                          name="end_time"
                          value={formData.end_time}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">
                      Example: Every Saturday from 9:00 AM to 11:00 AM
                    </p>
                  </div>
                )}
              </div>
            )}

            {formData.duration_type === 'long_term' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={labelClass}>Start Date *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'long_term'}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>End Date *</label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'long_term'}
                    min={formData.start_date}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment Schedule Card - Only for Long Term Jobs */}
          {formData.duration_type === 'long_term' && (
            <div className={cardClass}>
              <h2 className="text-xl font-bold text-[#4B244A] dark:text-white mb-2">💰 Payment Schedule</h2>
              <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mb-4 font-medium">Set up how and when you'll pay your housekeeper</p>
              
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Payment Frequency *</label>
                  <select
                    name="payment_frequency"
                    value={formData.payment_frequency}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    <option value="weekly" className={optionClass}>Weekly - Every week</option>
                    <option value="biweekly" className={optionClass}>Bi-weekly - Every 2 weeks</option>
                    <option value="monthly" className={optionClass}>Monthly - Once a month</option>
                    <option value="custom" className={optionClass}>Custom - Specific dates</option>
                  </select>
                </div>

                {/* Payment Explanation Box */}
                <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 mb-4">
                  <p className="text-blue-800 dark:text-blue-200 text-sm font-bold mb-2">💡 How Payment Works (Per Person)</p>
                  <p className="text-blue-700 dark:text-blue-200/80 text-xs font-medium">
                    The budget you set is <strong>PER HOUSEKEEPER</strong>. If you need {formData.people_needed} housekeeper(s) 
                    and set ₱{formData.payment_amount || '0'} per payment, each housekeeper receives ₱{formData.payment_amount || '0'} on each payment date.
                  </p>
                  {parseInt(formData.people_needed) > 1 && formData.payment_amount && (
                    <p className="text-orange-600 dark:text-yellow-300 text-xs mt-2 font-bold">
                      <strong>Total per payment date:</strong> ₱{parseInt(formData.payment_amount) * parseInt(formData.people_needed)} 
                      ({formData.people_needed} workers × ₱{formData.payment_amount})
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Payment Amount per Person per Schedule (₱) *</label>
                  <input
                    type="number"
                    name="payment_amount"
                    value={formData.payment_amount}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'long_term'}
                    min="100"
                    step="50"
                    placeholder="e.g., 2500 per person per payment"
                    className={inputClass}
                  />
                  <p className="text-[#4B244A]/60 dark:text-white/50 text-xs mt-1 font-medium">
                    Amount each housekeeper receives on each payment date
                  </p>
                </div>

                {formData.payment_frequency === 'monthly' && (
                  <div>
                    <label className={labelClass}>Payment Dates (Day of Month)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.payment_dates.includes('15')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, payment_dates: [...formData.payment_dates, '15'].sort()});
                            } else {
                              setFormData({...formData, payment_dates: formData.payment_dates.filter(d => d !== '15')});
                            }
                          }}
                          className="w-5 h-5 rounded border-gray-300 dark:border-white/30 text-[#EA526F] focus:ring-[#EA526F]"
                        />
                        <label className="text-[#4B244A] dark:text-white font-medium">15th of month</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.payment_dates.includes('30')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, payment_dates: [...formData.payment_dates, '30'].sort()});
                            } else {
                              setFormData({...formData, payment_dates: formData.payment_dates.filter(d => d !== '30')});
                            }
                          }}
                          className="w-5 h-5 rounded border-gray-300 dark:border-white/30 text-[#EA526F] focus:ring-[#EA526F]"
                        />
                        <label className="text-[#4B244A] dark:text-white font-medium">30th/End of month</label>
                      </div>
                    </div>
                    <p className="text-[#4B244A]/60 dark:text-white/50 text-xs mt-2 font-medium">
                      Select when you'll pay during the month. You can choose both dates for twice-monthly payments.
                    </p>
                  </div>
                )}

                {(formData.payment_frequency === 'weekly' || formData.payment_frequency === 'biweekly') && (
                  <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
                    <p className="text-blue-800 dark:text-blue-200 text-sm">
                      <strong>📅 Payment Schedule:</strong> Payments will be calculated automatically based on your start and end dates.
                      {formData.payment_frequency === 'weekly' ? ' You\'ll pay every 7 days.' : ' You\'ll pay every 14 days.'}
                    </p>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Preferred Payment Method</label>
                  <select
                    name="payment_method_preference"
                    value={formData.payment_method_preference}
                    onChange={handleInputChange}
                    className={inputClass}
                  >
                    <option value="gcash" className={optionClass}>GCash</option>
                    <option value="maya" className={optionClass}>Maya (PayMaya)</option>
                    <option value="bank_transfer" className={optionClass}>Bank Transfer</option>
                    <option value="cash" className={optionClass}>Cash</option>
                  </select>
                  <p className="text-[#4B244A]/60 dark:text-white/50 text-xs mt-1 font-medium">
                    Housekeepers will see your preferred payment method
                  </p>
                </div>

                <div className="bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-4">
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    <strong>⚠️ Important:</strong> You'll need to upload proof of payment (receipt/screenshot) when marking payments as sent. Housekeepers can confirm receipt or report issues.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="flex-1 px-6 py-4 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg shadow-[#EA526F]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Posting...' : '📮 Post Job'}
            </button>
          </div>
        </form>
      </main>

      <TabBar role={user.active_role} />
    </div>
  );
}