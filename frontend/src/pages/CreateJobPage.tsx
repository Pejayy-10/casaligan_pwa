import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { FileText, ImageIcon, RotateCw, DollarSign, ChevronDown } from 'lucide-react';
import TabBar from '../components/TabBar';
import { psgcService } from '../services/psgc';
import type { User, PSGCRegion, PSGCProvince, PSGCCity, PSGCBarangay } from '../types';

type JobBenchmarkSuggestions = {
  budget: {
    min: number;
    recommended: number;
    max: number;
  };
  recommended_people_needed: number;
  recommended_num_days: number;
  quick_suggestions: {
    titles: string[];
    descriptions: string[];
    checklist: string[];
  };
  meta: {
    sample_size: number;
    scope: string;
    confidence: 'high' | 'medium' | 'low';
  };
};

type JobAISuggestions = {
  source: 'ai' | 'fallback';
  title_options: string[];
  description_draft: string;
  recommended_budget: {
    min: number;
    recommended: number;
    max: number;
  };
  recommended_people_needed: number;
  recommended_num_days: number;
  meta?: {
    sample_size: number;
    scope: string;
    confidence: 'high' | 'medium' | 'low';
  };
};

const MIN_SAME_DAY_LEAD_MINUTES = 30;

const resolveUploadUrl = (url: string) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
};

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
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
    frequency: 'weekly',
    // Multi-day schedule fields
    num_days: '1',
    daily_start_time: '',
    daily_end_time: '',
    // Accommodation
    accommodation_type: 'stay_out'
  });
  
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryDescription, setCustomCategoryDescription] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categories, setCategories] = useState<Array<{category_id: number, name: string, description: string | null, is_active: boolean}>>([]);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkSuggestions, setBenchmarkSuggestions] = useState<JobBenchmarkSuggestions | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<JobAISuggestions | null>(null);
  const [regions, setRegions] = useState<PSGCRegion[]>([]);
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cities, setCities] = useState<PSGCCity[]>([]);
  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);
  const [locationData, setLocationData] = useState({
    region_code: '',
    region_name: '',
    province_code: '',
    province_name: '',
    city_code: '',
    city_name: '',
    barangay_code: '',
    barangay_name: '',
    street_address: '',
    subdivision: '',
    zip_code: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (!user.is_owner) {
      navigate('/dashboard');
    } else {
      loadCategories();
      loadRegions();
    }
  }, [user, navigate]);

  useEffect(() => {
    const shouldFetch = !!formData.cleaning_type && !!formData.house_type && !!formData.duration_type;
    if (!shouldFetch) {
      setBenchmarkSuggestions(null);
      return;
    }

    const timeout = setTimeout(() => {
      fetchBenchmarkSuggestions();
    }, 300);

    return () => clearTimeout(timeout);
  }, [formData.cleaning_type, formData.house_type, formData.duration_type, locationData.city_name]);

  useEffect(() => {
    const hasCategoryContext = selectedCategories.length > 0 && !!formData.cleaning_type && !!formData.house_type;
    const hasTextContext = formData.title.trim().length >= 8 && formData.description.trim().length >= 20;

    if (!hasCategoryContext && !hasTextContext) {
      setAiSuggestions(null);
      return;
    }

    const timeout = setTimeout(() => {
      fetchAISuggestions();
    }, 700);

    return () => clearTimeout(timeout);
  }, [
    selectedCategories,
    categories,
    formData.title,
    formData.description,
    formData.house_type,
    formData.cleaning_type,
    formData.duration_type,
    formData.people_needed,
    formData.num_days,
    locationData.city_name,
  ]);

  const fetchBenchmarkSuggestions = async () => {
    try {
      setBenchmarkLoading(true);
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({
        cleaning_type: formData.cleaning_type,
        house_type: formData.house_type,
        duration_type: formData.duration_type,
      });
      if (locationData.city_name) {
        params.append('city_name', locationData.city_name);
      }
      params.append('people_needed', formData.people_needed || '1');

      const response = await fetch(`${API_BASE_URL}/jobs/benchmark/suggestions?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setBenchmarkSuggestions(data);
      }
    } catch (benchmarkError) {
      console.error('Failed to fetch benchmark suggestions:', benchmarkError);
      setBenchmarkSuggestions(null);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  const fetchAISuggestions = async () => {
    try {
      setAiLoading(true);
      const token = localStorage.getItem('access_token');
      const selectedCategoryNames = categories
        .filter((cat) => selectedCategories.includes(cat.category_id))
        .map((cat) => cat.name);

      const hasTextContext = formData.title.trim().length >= 8 && formData.description.trim().length >= 20;
      const hasCategoryContext = selectedCategoryNames.length > 0;
      const mode = hasTextContext && hasCategoryContext
        ? 'auto'
        : hasTextContext
          ? 'from_text'
          : 'from_categories';

      const response = await fetch(`${API_BASE_URL}/jobs/ai-suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode,
          title: formData.title,
          description: formData.description,
          house_type: formData.house_type,
          cleaning_type: formData.cleaning_type,
          duration_type: formData.duration_type,
          city_name: locationData.city_name || undefined,
          categories: selectedCategoryNames,
          budget: formData.budget ? Number(formData.budget) : undefined,
          people_needed: formData.people_needed ? Number(formData.people_needed) : undefined,
          num_days: formData.num_days ? Number(formData.num_days) : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data);
      }
    } catch (aiError) {
      console.error('Failed to fetch AI suggestions:', aiError);
      setAiSuggestions(null);
    } finally {
      setAiLoading(false);
    }
  };

  const loadRegions = async () => {
    try {
      const data = await psgcService.getRegions();
      setRegions(data);
    } catch (error) {
      console.error('Failed to load regions:', error);
    }
  };

  const handleRegionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regionCode = e.target.value;
    const region = regions.find((r) => r.code === regionCode);

    setLocationData((prev) => ({
      ...prev,
      region_code: regionCode,
      region_name: region?.name || '',
      province_code: '',
      province_name: '',
      city_code: '',
      city_name: '',
      barangay_code: '',
      barangay_name: '',
    }));

    setProvinces([]);
    setCities([]);
    setBarangays([]);

    if (regionCode) {
      try {
        const data = await psgcService.getProvinces(regionCode);
        setProvinces(data);
      } catch (error) {
        console.error('Failed to load provinces:', error);
      }
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceCode = e.target.value;
    const province = provinces.find((p) => p.code === provinceCode);

    setLocationData((prev) => ({
      ...prev,
      province_code: provinceCode,
      province_name: province?.name || '',
      city_code: '',
      city_name: '',
      barangay_code: '',
      barangay_name: '',
    }));

    setCities([]);
    setBarangays([]);

    if (provinceCode) {
      try {
        const data = await psgcService.getCities(provinceCode);
        setCities(data);
      } catch (error) {
        console.error('Failed to load cities:', error);
      }
    }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityCode = e.target.value;
    const city = cities.find((c) => c.code === cityCode);

    setLocationData((prev) => ({
      ...prev,
      city_code: cityCode,
      city_name: city?.name || '',
      barangay_code: '',
      barangay_name: '',
    }));

    setBarangays([]);

    if (cityCode) {
      try {
        const data = await psgcService.getBarangays(cityCode);
        setBarangays(data);
      } catch (error) {
        console.error('Failed to load barangays:', error);
      }
    }
  };

  const handleBarangayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const barangayCode = e.target.value;
    const barangay = barangays.find((b) => b.code === barangayCode);
    setLocationData((prev) => ({
      ...prev,
      barangay_code: barangayCode,
      barangay_name: barangay?.name || '',
    }));
  };

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
        // Fallback to public endpoint if owner-categories fails (e.g. no token)
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
      alert('Please enter a category name');
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
    if (fieldErrors[e.target.name]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[e.target.name];
        return next;
      });
    }
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
        const response = await fetch(`${API_BASE_URL}/upload/image?category=job`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          // Store full URL for preview, but we'll send relative URL to backend
          setImages(prev => [...prev, resolveUploadUrl(data.url)]);
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

  const parseTimeToMinutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return (h * 60) + m;
  };

  const validateDateAndTimeRules = (): Record<string, string> => {
    const todayStr = new Date().toISOString().split('T')[0];

    const minDurationMinutes = 60;
    const errors: Record<string, string> = {};

    if (formData.duration_type === 'short_term') {
      if (!formData.job_date) errors.job_date = 'Job date is required.';
      if (formData.job_date && formData.job_date < todayStr) errors.job_date = 'Job date cannot be in the past.';
    }

    if (formData.duration_type === 'long_term') {
      if (!formData.start_date) {
        errors.start_date = 'Start date is required.';
      }
      if (formData.start_date && formData.start_date < todayStr) {
        errors.start_date = 'Start date cannot be in the past.';
      }
    }

    if (!formData.is_recurring && (formData.daily_start_time || formData.daily_end_time)) {
      if (!formData.daily_start_time || !formData.daily_end_time) {
        if (!formData.daily_start_time) errors.daily_start_time = 'Daily start time is required.';
        if (!formData.daily_end_time) errors.daily_end_time = 'Daily end time is required.';
      }
      if (formData.daily_start_time && formData.daily_end_time) {
        const dailyStart = parseTimeToMinutes(formData.daily_start_time);
        const dailyEnd = parseTimeToMinutes(formData.daily_end_time);
        if (dailyEnd <= dailyStart) {
          errors.daily_end_time = 'Daily end time must be later than daily start time.';
        } else if ((dailyEnd - dailyStart) < minDurationMinutes) {
          errors.daily_end_time = 'Daily schedule must be at least 1 hour.';
        }
      }
    }

    if (formData.is_recurring) {
      if (!formData.day_of_week) errors.day_of_week = 'Please select the recurring day of week.';
      if (!formData.start_time || !formData.end_time) {
        if (!formData.start_time) errors.start_time = 'Recurring start time is required.';
        if (!formData.end_time) errors.end_time = 'Recurring end time is required.';
      }
      if (formData.start_time && formData.end_time) {
        const recurringStart = parseTimeToMinutes(formData.start_time);
        const recurringEnd = parseTimeToMinutes(formData.end_time);
        if (recurringEnd <= recurringStart) {
          errors.end_time = 'Recurring end time must be later than recurring start time.';
        } else if ((recurringEnd - recurringStart) < minDurationMinutes) {
          errors.end_time = 'Recurring schedule must be at least 1 hour.';
        }
      }
    }

    const selectedStartDate = formData.duration_type === 'short_term' ? formData.job_date : formData.start_date;
    const selectedStartTime = formData.is_recurring ? formData.start_time : formData.daily_start_time;

    if (selectedStartDate === todayStr && selectedStartTime) {
      const now = new Date();
      const startMinutes = parseTimeToMinutes(selectedStartTime);
      const nowMinutes = (now.getHours() * 60) + now.getMinutes();
      const minutesUntilStart = startMinutes - nowMinutes;

      if (minutesUntilStart < MIN_SAME_DAY_LEAD_MINUTES) {
        const message = `For same-day jobs, start time must be at least ${MIN_SAME_DAY_LEAD_MINUTES} minutes from now.`;
        if (formData.is_recurring) {
          errors.start_time = message;
        } else {
          errors.daily_start_time = message;
        }
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    
    // Validate at least one category is selected
    if (selectedCategories.length === 0) {
      setError('Please select at least one category');
      return;
    }

    if (!locationData.region_code || !locationData.province_code || !locationData.city_code || !locationData.barangay_code) {
      setFieldErrors({ location: 'Please select complete location details (region, province, city/municipality, barangay).' });
      return;
    }

    const validationErrors = validateDateAndTimeRules();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    // Validate short-term num_days limit
    if (formData.duration_type === 'short_term') {
      const numDays = parseInt(formData.num_days) || 1;
      if (numDays > 13) {
        setFieldErrors({ num_days: 'Short-term jobs can have a maximum of 13 days. For 14+ days, please select Long Term.' });
        return;
      }
    }
    
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const locationParts = [
        locationData.street_address?.trim(),
        locationData.subdivision?.trim(),
        locationData.barangay_name,
        locationData.city_name,
        locationData.province_name,
      ].filter(Boolean);
      const formattedLocation = locationParts.join(', ');
      
      // For long-term jobs, use payment_amount as the budget (salary per cycle)
      const effectiveBudget = formData.duration_type === 'long_term'
        ? parseFloat(formData.payment_amount) || 0
        : parseFloat(formData.budget);

      const jobData: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        house_type: formData.house_type,
        cleaning_type: formData.cleaning_type,
        budget: effectiveBudget,
        people_needed: parseInt(formData.people_needed),
        image_urls: images,
        duration_type: formData.duration_type,
        location: formattedLocation || null,
        category_ids: selectedCategories,
        accommodation_type: formData.accommodation_type,
      };
      
      // For short-term jobs, use job_date as both start and end date
      if (formData.duration_type === 'short_term') {
        jobData.start_date = formData.job_date || null;
        jobData.end_date = formData.job_date || null;
      } else {
        // Long-term: only start_date; no end_date — runs until owner cancels the contract
        jobData.start_date = formData.start_date || null;
        jobData.end_date = null;
      }
      
      // Add payment schedule for long-term jobs
      if (formData.duration_type === 'long_term') {
        // No end date for open-ended contracts — payment_amount is the fixed per-cycle amount
        const perCycleAmount = parseFloat(formData.payment_amount) || 0;
        jobData.payment_schedule = {
          frequency: formData.payment_frequency,
          payment_amount: perCycleAmount,
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
      
      // Add multi-day schedule if num_days > 1 or daily times are specified
      const numDays = parseInt(formData.num_days) || 1;
      if (!formData.is_recurring && numDays >= 1 && formData.daily_start_time && formData.daily_end_time) {
        jobData.multi_day_schedule = {
          num_days: numDays,
          daily_start_time: formData.daily_start_time,
          daily_end_time: formData.daily_end_time
        };
      }
      
      const response = await fetch(`${API_BASE_URL}/jobs/`, {
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
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#EA526F]/10 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-400/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all safe-area-top">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-4">
          <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white transition-colors active:scale-95"
          >
          <ChevronDown className="w-6 h-6 rotate-90" />
          </button>
          <h1 className="text-xl font-bold text-[#4B244A] dark:text-white tracking-tight">
            Post a Job
          </h1>
          {/* placeholder to balance flex */}
          <div className="w-12" />
        </div>
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
              <div className="md:col-span-2 space-y-3">
                <label className={labelClass}>Location *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={locationData.region_code}
                    onChange={handleRegionChange}
                    className={inputClass}
                  >
                    <option value="" className={optionClass}>Select Region</option>
                    {regions.map((region) => (
                      <option key={region.code} value={region.code} className={optionClass}>{region.name}</option>
                    ))}
                  </select>
                  <select
                    value={locationData.province_code}
                    onChange={handleProvinceChange}
                    disabled={!locationData.region_code}
                    className={inputClass}
                  >
                    <option value="" className={optionClass}>Select Province</option>
                    {provinces.map((province) => (
                      <option key={province.code} value={province.code} className={optionClass}>{province.name}</option>
                    ))}
                  </select>
                  <select
                    value={locationData.city_code}
                    onChange={handleCityChange}
                    disabled={!locationData.province_code}
                    className={inputClass}
                  >
                    <option value="" className={optionClass}>Select City/Municipality</option>
                    {cities.map((city) => (
                      <option key={city.code} value={city.code} className={optionClass}>{city.name}</option>
                    ))}
                  </select>
                  <select
                    value={locationData.barangay_code}
                    onChange={handleBarangayChange}
                    disabled={!locationData.city_code}
                    className={inputClass}
                  >
                    <option value="" className={optionClass}>Select Barangay</option>
                    {barangays.map((barangay) => (
                      <option key={barangay.code} value={barangay.code} className={optionClass}>{barangay.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={locationData.street_address}
                    onChange={(e) => setLocationData((prev) => ({ ...prev, street_address: e.target.value }))}
                    placeholder="Street address (optional)"
                    className={inputClass}
                  />
                  <input
                    type="text"
                    value={locationData.subdivision}
                    onChange={(e) => setLocationData((prev) => ({ ...prev, subdivision: e.target.value }))}
                    placeholder="Subdivision/Village (optional)"
                    className={inputClass}
                  />
                </div>
                {fieldErrors.location && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.location}</p>
                )}
                {locationData.barangay_name && locationData.city_name && locationData.province_name && (
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">
                    Selected location: {[locationData.barangay_name, locationData.city_name, locationData.province_name].filter(Boolean).join(', ')}
                  </p>
                )}
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

                {/* Accommodation Type */}
                <div className="md:col-span-2">
                  <label className={labelClass}>Housekeeper Accommodation *</label>
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mb-3">
                    Specify whether the housekeeper will live in your home or commute daily.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Stay Out */}
                    <label
                      className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all
                        ${formData.accommodation_type === 'stay_out'
                          ? 'border-[#EA526F] bg-[#EA526F]/12 dark:bg-[#EA526F]/25 shadow-sm'
                          : 'border-gray-200 dark:border-white/20 bg-white/50 dark:bg-white/5 hover:border-[#EA526F]/50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="accommodation_type"
                        value="stay_out"
                        checked={formData.accommodation_type === 'stay_out'}
                        onChange={handleInputChange}
                        className="mt-0.5 w-4 h-4 text-[#EA526F] border-gray-300 focus:ring-[#EA526F]"
                      />
                      <div>
                        <p className="font-bold text-sm text-[#4B244A] dark:text-white">
                          Stay Out
                        </p>
                        <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-1">
                          Housekeeper commutes and does not live at the property.
                        </p>
                      </div>
                    </label>

                    {/* Stay In */}
                    <label
                      className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all
                        ${formData.accommodation_type === 'stay_in'
                          ? 'border-[#EA526F] bg-[#EA526F]/12 dark:bg-[#EA526F]/25 shadow-sm'
                          : 'border-gray-200 dark:border-white/20 bg-white/50 dark:bg-white/5 hover:border-[#EA526F]/50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="accommodation_type"
                        value="stay_in"
                        checked={formData.accommodation_type === 'stay_in'}
                        onChange={handleInputChange}
                        className="mt-0.5 w-4 h-4 text-[#EA526F] border-gray-300 focus:ring-[#EA526F]"
                      />
                      <div>
                        <p className="font-bold text-sm text-[#4B244A] dark:text-white">
                          Stay In
                        </p>
                        <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-1">
                          Housekeeper lives at the property and is provided accommodation.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2 p-4 sm:p-5 bg-linear-to-br from-white/70 to-purple-50 dark:from-slate-900/70 dark:to-purple-500/10 border border-purple-200/70 dark:border-purple-500/30 rounded-2xl shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-purple-700 dark:text-purple-200 text-sm font-bold">Smart Suggestions</p>
                      <p className="text-[#4B244A]/70 dark:text-white/70 text-xs">Suggestions are assistive only and won’t overwrite fields unless you apply them.</p>
                    </div>
                    {benchmarkLoading && <span className="text-purple-600 dark:text-purple-300 text-xs font-semibold">Updating...</span>}
                  </div>

                  {benchmarkSuggestions ? (
                    <div className="space-y-4">
                      <p className="text-purple-700 dark:text-purple-200 text-xs leading-relaxed">
                        Based on {benchmarkSuggestions.meta.sample_size} similar completed jobs • Scope: {benchmarkSuggestions.meta.scope} • Confidence: {benchmarkSuggestions.meta.confidence}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="p-3 bg-white/80 dark:bg-white/5 border border-purple-200/80 dark:border-purple-500/20 rounded-xl">
                          <p className="text-[#4B244A] dark:text-white text-[11px] font-semibold uppercase tracking-wide">Budget range</p>
                          <p className="text-[#4B244A]/85 dark:text-white/85 text-sm font-bold mt-1">₱{Math.round(benchmarkSuggestions.budget.min)} - ₱{Math.round(benchmarkSuggestions.budget.max)}</p>
                        </div>
                        <div className="p-3 bg-white/80 dark:bg-white/5 border border-purple-200/80 dark:border-purple-500/20 rounded-xl">
                          <p className="text-[#4B244A] dark:text-white text-[11px] font-semibold uppercase tracking-wide">Recommended workers</p>
                          <p className="text-[#4B244A]/85 dark:text-white/85 text-sm font-bold mt-1">{benchmarkSuggestions.recommended_people_needed} worker(s)</p>
                        </div>
                        <div className="p-3 bg-white/80 dark:bg-white/5 border border-purple-200/80 dark:border-purple-500/20 rounded-xl">
                          <p className="text-[#4B244A] dark:text-white text-[11px] font-semibold uppercase tracking-wide">Recommended days</p>
                          <p className="text-[#4B244A]/85 dark:text-white/85 text-sm font-bold mt-1">{Math.max(1, Math.min(13, benchmarkSuggestions.recommended_num_days))} day(s)</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          ...(prev.duration_type !== 'long_term'
                            ? { budget: String(Math.round(benchmarkSuggestions.budget.recommended)) }
                            : {}),
                          people_needed: String(benchmarkSuggestions.recommended_people_needed),
                          ...(formData.duration_type === 'short_term'
                            ? { num_days: String(Math.max(1, Math.min(13, benchmarkSuggestions.recommended_num_days))) }
                            : {}),
                        }))}
                        className="w-full p-3.5 bg-[#EA526F] text-white text-sm font-bold rounded-xl hover:bg-[#d64460] transition-colors shadow-sm"
                      >
                        Apply all recommended values
                      </button>

                      <div className="space-y-2">
                        <p className="text-[#4B244A] dark:text-white text-xs font-semibold">Quick title ideas</p>
                        <div className="flex flex-wrap gap-2">
                          {benchmarkSuggestions.quick_suggestions.titles.map((title, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, title }))}
                              className="px-3 py-1.5 text-xs bg-white/90 dark:bg-white/10 border border-purple-200/80 dark:border-purple-500/20 rounded-full text-[#4B244A] dark:text-white hover:bg-white dark:hover:bg-white/20 transition-colors"
                            >
                              {title}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[#4B244A] dark:text-white text-xs font-semibold">Quick description starter</p>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            description: benchmarkSuggestions.quick_suggestions.descriptions.join(' '),
                          }))}
                          className="w-full text-left p-3 bg-white/80 dark:bg-white/5 border border-blue-200/80 dark:border-blue-500/20 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                        >
                          <p className="text-[#4B244A]/80 dark:text-white/80 text-xs">Apply a pre-filled description based on similar jobs</p>
                        </button>
                      </div>

                      <div className="pt-3 border-t border-blue-200/70 dark:border-blue-500/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[#4B244A] dark:text-white text-xs font-semibold">AI assistant suggestions</p>
                          {aiLoading && <span className="text-[#4B244A]/70 dark:text-white/70 text-xs font-semibold">Analyzing...</span>}
                        </div>

                        {aiSuggestions ? (
                          <div className="space-y-2.5 p-3 bg-white/60 dark:bg-white/5 border border-blue-200/60 dark:border-blue-500/20 rounded-xl">
                            <p className="text-[#4B244A]/70 dark:text-white/70 text-xs">
                              Source: {aiSuggestions.source === 'ai' ? 'AI-generated' : 'Smart fallback'}
                            </p>

                            {aiSuggestions.title_options?.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {aiSuggestions.title_options.map((title, idx) => (
                                  <button
                                    key={`ai-title-${idx}`}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, title }))}
                                    className="px-3 py-1.5 text-xs bg-white/90 dark:bg-white/10 border border-blue-200/80 dark:border-blue-500/20 rounded-full text-[#4B244A] dark:text-white hover:bg-white dark:hover:bg-white/20 transition-colors"
                                  >
                                    {title}
                                  </button>
                                ))}
                              </div>
                            )}

                            {!!aiSuggestions.description_draft && (
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, description: aiSuggestions.description_draft }))}
                                className="w-full text-left p-3 bg-white/80 dark:bg-white/5 border border-blue-200/80 dark:border-blue-500/20 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-colors"
                              >
                                <p className="text-[#4B244A]/80 dark:text-white/80 text-xs">Use AI description draft</p>
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-[#4B244A]/70 dark:text-white/70 text-xs">
                            Select categories or type title and description to get AI suggestions.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-blue-700 dark:text-blue-200 text-xs">Suggestions will appear after selecting house type and cleaning type.</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>Categories * (Select one or more)</label>
                  <div className="mb-3 p-3 bg-white/40 dark:bg-slate-800/40 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                    <p className="text-[#4B244A]/70 dark:text-white/70 text-xs font-medium">Add custom category</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        placeholder="Category name"
                        className={`${inputClass} py-2! text-sm`}
                      />
                      <input
                        type="text"
                        value={customCategoryDescription}
                        onChange={(e) => setCustomCategoryDescription(e.target.value)}
                        placeholder="Description (optional)"
                        className={`${inputClass} py-2! text-sm`}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

                {formData.duration_type !== 'long_term' && (
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
                  {(aiSuggestions || benchmarkSuggestions) && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <p className="text-[#4B244A]/70 dark:text-white/70">
                        Suggested: ₱{Math.round(aiSuggestions?.recommended_budget?.recommended ?? benchmarkSuggestions?.budget.recommended ?? 0).toLocaleString()} (range ₱{Math.round(aiSuggestions?.recommended_budget?.min ?? benchmarkSuggestions?.budget.min ?? 0).toLocaleString()} - ₱{Math.round(aiSuggestions?.recommended_budget?.max ?? benchmarkSuggestions?.budget.max ?? 0).toLocaleString()})
                      </p>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, budget: String(Math.round(aiSuggestions?.recommended_budget?.recommended ?? benchmarkSuggestions?.budget.recommended ?? 0)) }))}
                        className="shrink-0 px-2.5 py-1 rounded-md bg-[#EA526F] text-white font-semibold hover:bg-[#d64460] transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
                )}

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
                  {(aiSuggestions || benchmarkSuggestions) && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <p className="text-[#4B244A]/70 dark:text-white/70">
                        Suggested: {aiSuggestions?.recommended_people_needed ?? benchmarkSuggestions?.recommended_people_needed ?? 1} worker(s)
                      </p>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, people_needed: String(aiSuggestions?.recommended_people_needed ?? benchmarkSuggestions?.recommended_people_needed ?? 1) }))}
                        className="shrink-0 px-2.5 py-1 rounded-md bg-[#EA526F] text-white font-semibold hover:bg-[#d64460] transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Images Card */}
          <div className={cardClass}>
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">Area Photos (Optional)</h2>
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
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    duration_type: val,
                    // Clear recurring state when switching to long-term
                    ...(val === 'long_term' ? { is_recurring: false, day_of_week: '' } : {})
                  }));
                }}
                className={inputClass}
              >
                <option value="short_term" className={optionClass}>Short Term (1–13 days)</option>
                <option value="long_term" className={optionClass}>Long Term (open-ended, until cancelled)</option>
              </select>
            </div>

            {/* Date picker for short-term jobs */}
            {formData.duration_type === 'short_term' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className={labelClass}>Job Date (Start Date) *</label>
                  <input
                    type="date"
                    name="job_date"
                    value={formData.job_date}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (fieldErrors.job_date) setFieldErrors(prev => { const n = { ...prev }; delete n.job_date; return n; });
                      // Auto-detect the day and set it as the first recurring day
                      if (val && formData.is_recurring) {
                        const weekDays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                        const [y, mo, d] = val.split('-').map(Number);
                        const detected = weekDays[new Date(y, mo - 1, d).getDay()];
                        const current = formData.day_of_week ? formData.day_of_week.split(',').map(d => d.trim()).filter(Boolean) : [];
                        const next = current.includes(detected) ? current : [detected, ...current];
                        setFormData(prev => ({ ...prev, job_date: val, day_of_week: next.join(',') }));
                      } else {
                        setFormData(prev => ({ ...prev, job_date: val }));
                      }
                    }}
                    required={formData.duration_type === 'short_term'}
                    min={new Date().toISOString().split('T')[0]}
                    className={inputClass}
                  />
                  {fieldErrors.job_date && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.job_date}</p>
                  )}
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-1">When should the housekeeper start?</p>
                </div>

                {/* Multi-Day Schedule Section */}
                {!formData.is_recurring && (
                <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-xl p-4 space-y-3">
                  <h3 className="text-purple-800 dark:text-white font-bold text-sm">Job Duration & Daily Hours</h3>
                  <p className="text-purple-600 dark:text-white/70 text-xs font-medium">
                    Specify how many days this job will take and the working hours per day.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Number of Days *</label>
                      <input
                        type="number"
                        name="num_days"
                        value={formData.num_days}
                        onChange={handleInputChange}
                        min="1"
                        max="13"
                        className={inputClass}
                      />
                      {fieldErrors.num_days && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.num_days}</p>
                      )}
                      <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-1">
                        Short-term jobs can be up to 13 days. For 14+ days, select Long Term.
                      </p>
                      {(aiSuggestions || benchmarkSuggestions) && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <p className="text-[#4B244A]/70 dark:text-white/70">
                            Suggested: {Math.max(1, Math.min(13, aiSuggestions?.recommended_num_days ?? benchmarkSuggestions?.recommended_num_days ?? 1))} day(s)
                          </p>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, num_days: String(Math.max(1, Math.min(13, aiSuggestions?.recommended_num_days ?? benchmarkSuggestions?.recommended_num_days ?? 1))) }))}
                            className="shrink-0 px-2.5 py-1 rounded-md bg-[#EA526F] text-white font-semibold hover:bg-[#d64460] transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Start Time *</label>
                      <input
                        type="time"
                        name="daily_start_time"
                        value={formData.daily_start_time}
                        onChange={handleInputChange}
                        required
                        className={inputClass}
                      />
                      {fieldErrors.daily_start_time && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.daily_start_time}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>End Time *</label>
                      <input
                        type="time"
                        name="daily_end_time"
                        value={formData.daily_end_time}
                        onChange={handleInputChange}
                        required
                        className={inputClass}
                      />
                      {fieldErrors.daily_end_time && (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.daily_end_time}</p>
                      )}
                    </div>
                  </div>
                  {parseInt(formData.num_days) > 1 && formData.job_date && (
                    <div className="bg-white/60 dark:bg-white/5 rounded-lg p-3 text-xs">
                      <p className="text-purple-800 dark:text-purple-200 font-bold mb-1">
                        Schedule Preview
                      </p>
                      {Array.from({ length: Math.min(parseInt(formData.num_days), 7) }, (_, i) => {
                        const d = new Date(formData.job_date);
                        d.setDate(d.getDate() + i);
                        return (
                          <p key={i} className="text-purple-700 dark:text-purple-300/80">
                            Day {i + 1}: {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {formData.daily_start_time && formData.daily_end_time
                              ? ` • ${formData.daily_start_time} – ${formData.daily_end_time}`
                              : ''}
                          </p>
                        );
                      })}
                      {parseInt(formData.num_days) > 7 && (
                        <p className="text-purple-500 dark:text-purple-400/60 mt-1">
                          ... and {parseInt(formData.num_days) - 7} more days
                        </p>
                      )}
                    </div>
                  )}
                  {parseInt(formData.num_days) > 1 && (
                    <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3">
                      <p className="text-blue-700 dark:text-blue-200 text-xs font-medium">
                        <strong>Multi-day jobs:</strong> Both you and the housekeeper must confirm each day's work is done before the next day is unlocked. The housekeeper can accept other jobs outside these hours.
                      </p>
                    </div>
                  )}
                </div>
                )}
                
                {/* Recurring Schedule Option */}
                <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_recurring}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData((prev) => ({
                          ...prev,
                          is_recurring: checked,
                          ...(checked
                            ? {
                                num_days: '1',
                                daily_start_time: '',
                                daily_end_time: ''
                              }
                            : {})
                        }));
                        if (checked) {
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.num_days;
                            delete next.daily_start_time;
                            delete next.daily_end_time;
                            return next;
                          });
                        }
                      }}
                      className="w-5 h-5 rounded border-gray-300 dark:border-white/30 text-[#EA526F] focus:ring-[#EA526F]"
                    />
                    <div>
                      <span className="text-blue-800 dark:text-white font-bold">Make this a recurring job</span>
                      <p className="text-blue-600 dark:text-white/70 text-xs mt-1 font-medium">
                        Set a regular schedule (e.g., every Saturday) so you don't need to post again
                      </p>
                    </div>
                  </label>
                </div>
                
                {formData.is_recurring && (
                  <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 space-y-4 border border-gray-200 dark:border-white/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className={labelClass}>
                          Days of Week *
                          {formData.day_of_week && (
                            <span className="ml-2 text-[10px] font-bold text-green-600 dark:text-green-400 normal-case">
                              ✓ {formData.day_of_week.split(',').length === 1 ? 'Auto-detected from date' : `${formData.day_of_week.split(',').length} days selected`}
                            </span>
                          )}
                        </label>
                        <p className="text-[#4B244A]/60 dark:text-white/60 text-[11px] mb-2 font-medium">
                          The day from your job date is auto-selected. You can add more days for the recurring schedule.
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                          {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map((day) => {
                            const selected = formData.day_of_week ? formData.day_of_week.split(',').map(d => d.trim()) : [];
                            const isChecked = selected.includes(day);
                            const dateVal = formData.duration_type === 'short_term' ? formData.job_date : formData.start_date;
                            const weekDays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                            const detectedDay = dateVal ? (() => { const [y,mo,d] = dateVal.split('-').map(Number); return weekDays[new Date(y,mo-1,d).getDay()]; })() : '';
                            const isAutoDetected = day === detectedDay;
                            return (
                              <label
                                key={day}
                                className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl border-2 cursor-pointer transition-all select-none text-center
                                  ${isChecked
                                    ? 'border-[#EA526F] bg-[#EA526F]/10 dark:bg-[#EA526F]/20 text-[#EA526F] dark:text-pink-300 font-bold'
                                    : 'border-gray-200 dark:border-white/20 bg-white/40 dark:bg-white/5 text-[#4B244A]/60 dark:text-white/50 hover:border-[#EA526F]/50'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={isChecked}
                                  onChange={() => {
                                    const current = formData.day_of_week ? formData.day_of_week.split(',').map(d => d.trim()).filter(Boolean) : [];
                                    if (isAutoDetected && isChecked && current.length === 1) return;
                                    const next = current.includes(day)
                                      ? current.filter(d => d !== day)
                                      : [...current, day];
                                    if (fieldErrors.day_of_week) setFieldErrors(prev => { const n = { ...prev }; delete n.day_of_week; return n; });
                                    setFormData(prev => ({ ...prev, day_of_week: next.join(',') }));
                                  }}
                                />
                                <span className="text-[11px] font-bold leading-tight capitalize">
                                  {day.slice(0,3).charAt(0).toUpperCase() + day.slice(0,3).slice(1)}
                                </span>
                                {isAutoDetected && (
                                  <span className="text-[8px] text-green-500 dark:text-green-400 font-bold leading-tight">auto</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        {fieldErrors.day_of_week && (
                          <p className="text-red-500 text-sm mt-1">{fieldErrors.day_of_week}</p>
                        )}
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
                        {fieldErrors.start_time && (
                          <p className="text-red-500 text-sm mt-1">{fieldErrors.start_time}</p>
                        )}
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
                        {fieldErrors.end_time && (
                          <p className="text-red-500 text-sm mt-1">{fieldErrors.end_time}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">
                      Example: Every Tuesday &amp; Saturday from 9:00 AM to 11:00 AM
                    </p>
                  </div>
                )}
              </div>
            )}

            {formData.duration_type === 'long_term' && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelClass}>Start Date *</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setFormData(prev => {
                        // Auto-detect recurring day from start date
                        let updatedDayOfWeek = prev.day_of_week;
                        if (newStart && prev.is_recurring) {
                          const weekDays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                          const [y, mo, d] = newStart.split('-').map(Number);
                          const detected = weekDays[new Date(y, mo - 1, d).getDay()];
                          const current = prev.day_of_week ? prev.day_of_week.split(',').map(d => d.trim()).filter(Boolean) : [];
                          updatedDayOfWeek = current.includes(detected) ? current.join(',') : [detected, ...current].join(',');
                        }
                        return { ...prev, start_date: newStart, day_of_week: updatedDayOfWeek };
                      });
                      if (fieldErrors.start_date) setFieldErrors(prev => { const n = { ...prev }; delete n.start_date; return n; });
                    }}
                    required={formData.duration_type === 'long_term'}
                    min={new Date().toISOString().split('T')[0]}
                    className={inputClass}
                  />
                  {fieldErrors.start_date && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.start_date}</p>
                  )}
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-1">
                    When should the housekeeper start?
                  </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4">
                  <p className="text-amber-800 dark:text-amber-200 text-sm font-bold mb-1">📋 Open-ended Contract</p>
                  <p className="text-amber-700 dark:text-amber-200/80 text-xs font-medium">
                    Long-term jobs have no end date. The contract continues until you (the owner) choose to cancel it. Payment is made on your chosen schedule for as long as the contract is active.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Schedule Card - Only for Long Term Jobs */}
          {formData.duration_type === 'long_term' && (
            <div className={cardClass}>
              <h2 className="text-xl font-bold text-[#4B244A] dark:text-white mb-2">Payment Schedule</h2>
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
                    <option value="biweekly" className={optionClass}>Bi-weekly — Every 2 weeks</option>
                    <option value="monthly" className={optionClass}>Monthly — Once a month</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    Salary per {formData.payment_frequency === 'biweekly' ? 'bi-weekly cycle (₱)' : 'month (₱)'} *
                  </label>
                  <input
                    type="number"
                    name="payment_amount"
                    value={formData.payment_amount}
                    onChange={handleInputChange}
                    required={formData.duration_type === 'long_term'}
                    min="100"
                    step="50"
                    placeholder={formData.payment_frequency === 'biweekly' ? 'e.g. 3500' : 'e.g. 7000'}
                    className={inputClass}
                  />
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-1">
                    This is the fixed amount you will pay per housekeeper every {formData.payment_frequency === 'biweekly' ? '2 weeks' : 'month'}.
                  </p>
                </div>

                {/* Payment Explanation Box */}
                <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-800 dark:text-blue-200 text-sm font-bold mb-2">How Payment Works</p>
                  <p className="text-blue-700 dark:text-blue-200/80 text-xs font-medium">
                    Since this is an open-ended contract, the salary you set above is the fixed amount paid {formData.payment_frequency === 'biweekly' ? 'every 14 days' : 'once a month'} per housekeeper until you cancel the contract.
                  </p>
                  {parseInt(formData.people_needed) > 1 && formData.payment_amount && (
                    <p className="text-orange-600 dark:text-yellow-300 text-xs mt-2 font-bold">
                      Total per cycle for all workers: ₱{(parseFloat(formData.payment_amount) * parseInt(formData.people_needed)).toLocaleString()}
                      ({formData.people_needed} workers × ₱{parseFloat(formData.payment_amount).toLocaleString()})
                    </p>
                  )}
                </div>

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
                    <strong>Important:</strong> You'll need to upload proof of payment (receipt/screenshot) when marking payments as sent. Housekeepers can confirm receipt or report issues.
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
              className="flex-1 px-6 py-4 bg-black/20! text-white! font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 bg-[#EA526F]! text-white! font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg shadow-[#EA526F]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Posting...' : 'Post Job'}
            </button>
          </div>
        </form>
      </main>

      <TabBar role={user.active_role} />
    </div>
  );
}