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

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (!user.is_owner) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

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
        category: 'cleaning'
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

  return (
    <div className="min-h-screen bg-linear-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] pb-20">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center">
          <button onClick={() => navigate('/jobs')} className="text-white mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">📝 Post a Job</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Basic Info Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Basic Information</h2>
            
            <div>
              <label className="block text-white font-semibold mb-2">Job Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                minLength={5}
                placeholder="e.g., Deep Cleaning Needed for 2-Bedroom Condo"
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              />
            </div>

            <div>
              <label className="block text-white font-semibold mb-2">Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                minLength={20}
                rows={4}
                placeholder="Describe the cleaning job, special requirements, access instructions, etc."
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
              />
            </div>
          </div>

          {/* Job Details Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Job Details</h2>
            
            <div>
              <label className="block text-white font-semibold mb-2">Location *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                placeholder="e.g., Quezon City, Metro Manila or specific barangay"
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2">House Type *</label>
                <select
                  name="house_type"
                  value={formData.house_type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                >
                  <option value="house">House</option>
                  <option value="apartment">Apartment</option>
                  <option value="condo">Condominium</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="office">Office</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Cleaning Type *</label>
                <select
                  name="cleaning_type"
                  value={formData.cleaning_type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                >
                  <option value="general">General Cleaning</option>
                  <option value="deep_cleaning">Deep Cleaning</option>
                  <option value="move_in_out">Move In/Out Cleaning</option>
                  <option value="post_construction">Post-Construction Cleaning</option>
                  <option value="spring_cleaning">Spring Cleaning</option>
                  <option value="maintenance">Regular Maintenance</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Budget (₱) *</label>
                <input
                  type="number"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  required
                  min="100"
                  step="50"
                  placeholder="5000"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">People Needed *</label>
                <input
                  type="number"
                  name="people_needed"
                  value={formData.people_needed}
                  onChange={handleInputChange}
                  required
                  min="1"
                  max="10"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
              </div>
            </div>
          </div>

          {/* Images Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">📷 Area Photos (Optional)</h2>
            <p className="text-white/70 text-sm mb-4">Add up to 5 photos of the area to be cleaned</p>
            
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-center gap-2 px-6 py-4 bg-white/20 backdrop-blur-sm border-2 border-dashed border-white/30 rounded-xl text-white cursor-pointer hover:bg-white/30 transition-all">
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
              <div className="grid grid-cols-2 gap-3">
                {images.map((url, index) => (
                  <div key={index} className="relative bg-white/10 rounded-lg p-2">
                    <img src={url} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
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
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Duration</h2>
            
            <div>
              <label className="block text-white font-semibold mb-2">Job Duration *</label>
              <select
                name="duration_type"
                value={formData.duration_type}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="short_term">Short Term (One-time)</option>
                <option value="long_term">Long Term (Recurring)</option>
              </select>
            </div>

            {/* Date picker for short-term jobs */}
            {formData.duration_type === 'short_term' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-white font-semibold mb-2">Job Date *</label>
                  <input
                    type="date"
                    name="job_date"
                    value={formData.job_date}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'short_term'}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                  />
                  <p className="text-white/60 text-sm mt-1">When should the housekeeper come?</p>
                </div>
                
                {/* Recurring Schedule Option */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_recurring}
                      onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <span className="text-white font-semibold">🔄 Make this a recurring job</span>
                      <p className="text-white/70 text-xs mt-1">
                        Set a regular schedule (e.g., every Saturday) so you don't need to post again
                      </p>
                    </div>
                  </label>
                </div>
                
                {formData.is_recurring && (
                  <div className="bg-white/10 rounded-xl p-4 space-y-4 border border-white/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white font-semibold mb-2">Day of Week *</label>
                        <select
                          name="day_of_week"
                          value={formData.day_of_week}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                        >
                          <option value="">Select day</option>
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-white font-semibold mb-2">Frequency *</label>
                        <select
                          name="frequency"
                          value={formData.frequency}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                        >
                          <option value="weekly">Every Week</option>
                          <option value="biweekly">Every 2 Weeks</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-white font-semibold mb-2">Start Time *</label>
                        <input
                          type="time"
                          name="start_time"
                          value={formData.start_time}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-white font-semibold mb-2">End Time *</label>
                        <input
                          type="time"
                          name="end_time"
                          value={formData.end_time}
                          onChange={handleInputChange}
                          required={formData.is_recurring}
                          className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                        />
                      </div>
                    </div>
                    <p className="text-white/60 text-xs">
                      Example: Every Saturday from 9:00 AM to 11:00 AM
                    </p>
                  </div>
                )}
              </div>
            )}

            {formData.duration_type === 'long_term' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-white font-semibold mb-2">Start Date *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'long_term'}
                    className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                  />
                </div>
                <div>
                  <label className="block text-white font-semibold mb-2">End Date *</label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'long_term'}
                    min={formData.start_date}
                    className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment Schedule Card - Only for Long Term Jobs */}
          {formData.duration_type === 'long_term' && (
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
              <h2 className="text-xl font-bold text-white mb-2">💰 Payment Schedule</h2>
              <p className="text-white/60 text-sm mb-4">Set up how and when you'll pay your housekeeper</p>
              
              <div>
                <label className="block text-white font-semibold mb-2">Payment Frequency *</label>
                <select
                  name="payment_frequency"
                  value={formData.payment_frequency}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                >
                  <option value="weekly">Weekly - Every week</option>
                  <option value="biweekly">Bi-weekly - Every 2 weeks</option>
                  <option value="monthly">Monthly - Once a month</option>
                  <option value="custom">Custom - Specific dates</option>
                </select>
              </div>

              {/* Payment Explanation Box */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                <p className="text-blue-200 text-sm font-semibold mb-2">💡 How Payment Works (Per Person)</p>
                <p className="text-blue-200/80 text-xs">
                  The budget you set is <strong>PER HOUSEKEEPER</strong>. If you need {formData.people_needed} housekeeper(s) 
                  and set ₱{formData.payment_amount || '0'} per payment, each housekeeper receives ₱{formData.payment_amount || '0'} on each payment date.
                </p>
                {parseInt(formData.people_needed) > 1 && formData.payment_amount && (
                  <p className="text-yellow-300 text-xs mt-2">
                    <strong>Total per payment date:</strong> ₱{parseInt(formData.payment_amount) * parseInt(formData.people_needed)} 
                    ({formData.people_needed} workers × ₱{formData.payment_amount})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Payment Amount per Person per Schedule (₱) *</label>
                <input
                  type="number"
                  name="payment_amount"
                  value={formData.payment_amount}
                  onChange={handleInputChange}
                  required={formData.duration_type === 'long_term'}
                  min="100"
                  step="50"
                  placeholder="e.g., 2500 per person per payment"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
                <p className="text-white/50 text-xs mt-1">
                  Amount each housekeeper receives on each payment date
                </p>
              </div>

              {formData.payment_frequency === 'monthly' && (
                <div>
                  <label className="block text-white font-semibold mb-2">Payment Dates (Day of Month)</label>
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
                        className="w-5 h-5 rounded"
                      />
                      <label className="text-white">15th of month</label>
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
                        className="w-5 h-5 rounded"
                      />
                      <label className="text-white">30th/End of month</label>
                    </div>
                  </div>
                  <p className="text-white/50 text-xs mt-2">
                    Select when you'll pay during the month. You can choose both dates for twice-monthly payments.
                  </p>
                </div>
              )}

              {(formData.payment_frequency === 'weekly' || formData.payment_frequency === 'biweekly') && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-200 text-sm">
                    <strong>📅 Payment Schedule:</strong> Payments will be calculated automatically based on your start and end dates.
                    {formData.payment_frequency === 'weekly' ? ' You\'ll pay every 7 days.' : ' You\'ll pay every 14 days.'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-white font-semibold mb-2">Preferred Payment Method</label>
                <select
                  name="payment_method_preference"
                  value={formData.payment_method_preference}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                >
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya (PayMaya)</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                </select>
                <p className="text-white/50 text-xs mt-1">
                  Housekeepers will see your preferred payment method
                </p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-yellow-200 text-sm">
                  <strong>⚠️ Important:</strong> You'll need to upload proof of payment (receipt/screenshot) when marking payments as sent. Housekeepers can confirm receipt or report issues.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="flex-1 px-6 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all"
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
