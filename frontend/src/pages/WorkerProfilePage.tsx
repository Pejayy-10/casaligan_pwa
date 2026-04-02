import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Phone, Mail, Calendar, MapPin, Star, Check, Clock, X, MessageCircle, Package, User, Briefcase, AlertTriangle, AlertCircle, ChevronLeft, ChevronDown } from 'lucide-react';
import TabBar from '../components/TabBar';
import StarRating from '../components/StarRating';
import { psgcService } from '../services/psgc';
import { API_BASE_URL } from '../config';
import type { PSGCRegion, PSGCProvince, PSGCCity, PSGCBarangay } from '../types';

interface WorkerPackage {
  package_id: number;
  name: string;
  description: string | null;
  price: number;
  duration_hours: number;
  num_days: number;
  services: string[];
  category_names?: string[];
}

interface Review {
  rating_id: number;
  stars: number;
  review: string | null;
  rater_name: string;
  created_at: string | null;
}

interface PortfolioPhoto {
  id: number;
  image_url: string;
  caption: string | null;
  category: string;
  created_at: string | null;
}

interface WorkerProfile {
  worker_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  bio?: string | null;
  profile_picture?: string | null;
  phone_masked: string | null;
  alt_phone_masked: string | null;
  email_masked: string | null;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  relationship_status?: 'single' | 'married' | 'in_a_relationship' | 'widowed' | 'separated' | 'prefer_not_to_say' | null;
  city: string | null;
  barangay: string | null;
  province: string | null;
  region: string | null;
  member_since: string | null;
  completed_jobs: number;
  is_verified: boolean;
  is_available: boolean;
  average_rating: number;
  total_ratings: number;
  rating_breakdown: { [key: number]: number };
  recent_reviews: Review[];
  packages: WorkerPackage[];
  portfolio_photos?: PortfolioPhoto[];
}

export default function WorkerProfilePage() {
  const navigate = useNavigate();
  const { workerId } = useParams<{ workerId: string }>();
  const [searchParams] = useSearchParams();
  const isFromApplicants = searchParams.get('from') === 'applicants';
  
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackages, setSelectedPackages] = useState<number[]>([]);
  const [showHireModal, setShowHireModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [useMyAddress, setUseMyAddress] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Recurring schedule state
  const [isRecurring, setIsRecurring] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [frequency, setFrequency] = useState('weekly');
  const [conflictingDays, setConflictingDays] = useState<string[]>([]);
  const [conflictCheckLoading, setConflictCheckLoading] = useState(false);
  
  // Custom address fields (when not using registered address)
  const [customStreet, setCustomStreet] = useState('');
  const [customBarangay, setCustomBarangay] = useState('');
  const [customBarangayCode, setCustomBarangayCode] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [customCityCode, setCustomCityCode] = useState('');
  const [customProvince, setCustomProvince] = useState('');
  const [customProvinceCode, setCustomProvinceCode] = useState('');
  const [customRegion, setCustomRegion] = useState('');
  const [customRegionCode, setCustomRegionCode] = useState('');
  
  // PSGC dropdown data
  const [regions, setRegions] = useState<PSGCRegion[]>([]);
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cities, setCities] = useState<PSGCCity[]>([]);
  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);
  const [loadingAddress, setLoadingAddress] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/direct-hire/worker/${workerId}/profile`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
  }, [workerId]);

  // Load regions when custom address form is shown
  useEffect(() => {
    if (!useMyAddress && regions.length === 0) {
      loadRegions();
    }
  }, [useMyAddress, regions.length]);

  const loadRegions = async () => {
    try {
      setLoadingAddress(true);
      const data = await psgcService.getRegions();
      setRegions(data);
    } catch (error) {
      console.error('Failed to load regions:', error);
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleRegionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regionCode = e.target.value;
    const region = regions.find(r => r.code === regionCode);
    
    setCustomRegionCode(regionCode);
    setCustomRegion(region?.name || '');
    setCustomProvinceCode('');
    setCustomProvince('');
    setCustomCityCode('');
    setCustomCity('');
    setCustomBarangayCode('');
    setCustomBarangay('');
    setProvinces([]);
    setCities([]);
    setBarangays([]);

    if (regionCode) {
      try {
        setLoadingAddress(true);
        const data = await psgcService.getProvinces(regionCode);
        setProvinces(data);
      } catch (error) {
        console.error('Failed to load provinces:', error);
      } finally {
        setLoadingAddress(false);
      }
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceCode = e.target.value;
    const province = provinces.find(p => p.code === provinceCode);
    
    setCustomProvinceCode(provinceCode);
    setCustomProvince(province?.name || '');
    setCustomCityCode('');
    setCustomCity('');
    setCustomBarangayCode('');
    setCustomBarangay('');
    setCities([]);
    setBarangays([]);

    if (provinceCode) {
      try {
        setLoadingAddress(true);
        const data = await psgcService.getCities(provinceCode);
        setCities(data);
      } catch (error) {
        console.error('Failed to load cities:', error);
      } finally {
        setLoadingAddress(false);
      }
    }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityCode = e.target.value;
    const city = cities.find(c => c.code === cityCode);
    
    setCustomCityCode(cityCode);
    setCustomCity(city?.name || '');
    setCustomBarangayCode('');
    setCustomBarangay('');
    setBarangays([]);

    if (cityCode) {
      try {
        setLoadingAddress(true);
        const data = await psgcService.getBarangays(cityCode);
        setBarangays(data);
      } catch (error) {
        console.error('Failed to load barangays:', error);
      } finally {
        setLoadingAddress(false);
      }
    }
  };

  const handleBarangayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const barangayCode = e.target.value;
    const barangay = barangays.find(b => b.code === barangayCode);
    
    setCustomBarangayCode(barangayCode);
    setCustomBarangay(barangay?.name || '');
  };

  const togglePackage = (packageId: number) => {
    setSelectedPackages(prev =>
      prev.includes(packageId)
        ? prev.filter(id => id !== packageId)
        : [...prev, packageId]
    );
  };

  const getSelectedTotal = () => {
    if (!profile) return 0;
    return profile.packages
      .filter(p => selectedPackages.includes(p.package_id))
      .reduce((sum, p) => sum + p.price, 0);
  };

  const handleHire = async () => {
    if (!profile || selectedPackages.length === 0) return;
    
    if (!scheduledDate) {
      alert('Please select a date');
      return;
    }

    // Check if the selected date is blocked
    try {
      const checkResponse = await fetch(
        `${API_BASE_URL}/availability/blocked-dates/check/${profile.worker_id}?check_date=${scheduledDate}`
      );
      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.is_blocked) {
          const reasonMsg = checkData.reason ? ` (${checkData.reason})` : '';
          alert(`This worker is not available on ${new Date(scheduledDate).toLocaleDateString()}. The date is blocked${reasonMsg}. Please select a different date.`);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
      // Continue with hire attempt - backend will also check
    }

    // Validate recurring schedule if enabled
    if (isRecurring && (daysOfWeek.length === 0 || !startTime)) {
      alert('Please select at least one day of week and a start time for recurring booking');
      return;
    }

    // Validate start time for one-time bookings
    if (!isRecurring && !startTime) {
      alert('Please select a start time');
      return;
    }

    // Validate custom address if not using registered address
    if (!useMyAddress && (!customRegion || !customProvince || !customCity || !customBarangay)) {
      alert('Please complete all address fields (Region, Province, City, and Barangay)');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('access_token');
      
      // Derive num_days and duration from the selected packages (set by the housekeeper)
      const selectedPkgs = profile.packages.filter(p => selectedPackages.includes(p.package_id));
      const maxNumDays = Math.max(...selectedPkgs.map(p => p.num_days || 1));
      const maxDuration = selectedPkgs.length > 0 ? Math.max(...selectedPkgs.map(p => p.duration_hours || 2)) : 2;

      // Compute end time from start time + package duration
      const [sH, sM] = startTime.split(':').map(Number);
      const computedEndH = Math.min(sH + maxDuration, 23);
      const computedEndTime = `${computedEndH.toString().padStart(2, '0')}:${(sM || 0).toString().padStart(2, '0')}`;

      const requestBody: Record<string, unknown> = {
        worker_id: profile.worker_id,
        package_ids: selectedPackages,
        scheduled_date: scheduledDate,
        scheduled_time: isRecurring ? null : startTime,
        special_instructions: specialInstructions || null,
        use_my_address: useMyAddress,
        // Include custom address fields when not using registered address
        address_street: useMyAddress ? null : customStreet || null,
        address_barangay: useMyAddress ? null : customBarangay || null,
        address_city: useMyAddress ? null : customCity || null,
        address_province: useMyAddress ? null : customProvince || null,
        address_region: useMyAddress ? null : customRegion || null,
        // Multi-day scheduling (derived from package settings)
        num_days: maxNumDays,
        daily_start_time: isRecurring ? null : startTime,
        daily_end_time: isRecurring ? null : computedEndTime
      };
      
      // Add recurring schedule if enabled
      if (isRecurring) {
        const [rH, rM] = startTime.split(':').map(Number);
        const recurEndH = Math.min(rH + maxDuration, 23);
        const recurEndTime = `${recurEndH.toString().padStart(2, '0')}:${(rM || 0).toString().padStart(2, '0')}`;

        requestBody.recurring_schedule = {
          is_recurring: true,
          day_of_week: daysOfWeek.join(','),
          start_time: startTime,
          end_time: recurEndTime,
          frequency: frequency
        };
      }
      
      const response = await fetch(`${API_BASE_URL}/direct-hire/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        alert('✓ Booking request sent! The housekeeper will review your request.');
        navigate('/jobs');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Hire error:', error);
      alert('Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
          <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 flex items-center justify-center">
        <div className="text-center text-[#4B244A] dark:text-white">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">Worker not found</h2>
          <button onClick={() => navigate(-1)} className="mt-4 px-6 py-3 bg-[#EA526F] text-white font-bold rounded-xl shadow-lg hover:bg-[#d64460] transition-all">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 pb-20 relative">
      {/* Decorative circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all safe-area-top">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
                  <button 
                      onClick={() => navigate(-1)} 
                      className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white transition-colors active:scale-95"
                  >
                      <ChevronDown className="w-6 h-6 rotate-90" />
                  </button>
                  <h1 className="text-xl font-bold text-[#4B244A] dark:text-white tracking-tight">Housekeeper Profile</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6 pb-32">
        {/* Profile Header */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/50 dark:border-white/10 shadow-xl transition-all">
          <div className="flex flex-col items-center gap-4 mb-4 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#EA526F] to-[#6B3468] dark:from-[#EA526F] dark:to-[#d4486a] flex items-center justify-center text-3xl text-white font-bold shadow-lg overflow-hidden">
              {profile.profile_picture ? (
                <img src={profile.profile_picture} alt={`${profile.first_name} ${profile.last_name}`} className="w-full h-full object-cover" />
              ) : (
                <>{profile.first_name[0]}{profile.last_name[0]}</>
              )}
            </div>
            <div className="w-full">
              <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">
                {profile.first_name} {profile.last_name}
              </h2>
              {profile.city && (
                <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">
                  <MapPin className="inline w-4 h-4 mr-1" />{profile.barangay && `${profile.barangay}, `}{profile.city}
                  {profile.province && `, ${profile.province}`}
                </p>
              )}
              {profile.gender && (
                <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium mt-1">
                  {profile.gender === 'male' && '👨 Male'}
                  {profile.gender === 'female' && '👩 Female'}
                  {profile.gender === 'other' && '⚧️ Other'}
                  {profile.gender === 'prefer_not_to_say' && '🙋 Prefer not to say'}
                </p>
              )}
              {profile.relationship_status && (
                <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium mt-1">
                  {profile.relationship_status === 'single' && 'Relationship status: Single'}
                  {profile.relationship_status === 'married' && 'Relationship status: Married'}
                  {profile.relationship_status === 'in_a_relationship' && 'Relationship status: In a relationship'}
                  {profile.relationship_status === 'widowed' && 'Relationship status: Widowed'}
                  {profile.relationship_status === 'separated' && 'Relationship status: Separated'}
                  {profile.relationship_status === 'prefer_not_to_say' && 'Relationship status: Prefer not to say'}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                {profile.is_verified ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 text-sm font-bold rounded-full">
                    <Check className="inline w-4 h-4 mr-1" /> Verified
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 text-sm font-bold rounded-full">
                    <Clock className="inline w-4 h-4 mr-1" /> Pending Verification
                  </span>
                )}
                {/* Availability badge */}
                {profile.is_available ? (
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 text-sm font-bold rounded-full">
                    ✅ Available for Hire
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-white/50 text-sm font-bold rounded-full">
                    🚫 Currently Inactive
                  </span>
                )}
                <span className="px-3 py-1 bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70 text-sm font-bold rounded-full">
                  {profile.packages.length} package{profile.packages.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/50 dark:bg-white/10 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
              <div className="text-2xl font-bold text-[#EA526F]">{profile.completed_jobs}</div>
              <div className="text-[#4B244A]/60 dark:text-white/60 text-xs font-bold">Jobs Completed</div>
            </div>
            <div className="bg-white/50 dark:bg-white/10 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
              <div className="text-2xl font-bold text-[#EA526F]">{profile.packages.length}</div>
              <div className="text-[#4B244A]/60 dark:text-white/60 text-xs font-bold">Packages</div>
            </div>
            <div className="bg-white/50 dark:bg-white/10 rounded-xl p-3 text-center border border-gray-100 dark:border-white/5">
              {profile.total_ratings > 0 ? (
                <>
                  <div className="text-2xl font-bold text-[#EA526F]">{profile.average_rating.toFixed(1)}</div>
                  <div className="text-[#4B244A]/60 dark:text-white/60 text-xs font-bold">{profile.total_ratings} Review{profile.total_ratings !== 1 ? 's' : ''}</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-gray-300 dark:text-white/40">—</div>
                  <div className="text-[#4B244A]/60 dark:text-white/60 text-xs font-bold">No Reviews</div>
                </>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white/40 dark:bg-white/5 rounded-xl p-4 space-y-2 border border-white/40 dark:border-white/10">
            <h4 className="text-[#4B244A] dark:text-white font-bold text-sm mb-2">📋 Profile Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-medium">
              {profile.phone_masked && (
                <div className="flex items-center gap-2 text-[#4B244A]/70 dark:text-white/70">
                  <Phone className="w-4 h-4" />
                  <span>{profile.phone_masked}</span>
                </div>
              )}
              {profile.alt_phone_masked && (
                <div className="flex items-center gap-2 text-[#4B244A]/70 dark:text-white/70">
                  <Phone className="w-4 h-4 opacity-60" />
                  <span>{profile.alt_phone_masked} <span className="text-xs opacity-60">(alt)</span></span>
                </div>
              )}
              {profile.email_masked && (
                <div className="flex items-center gap-2 text-[#4B244A]/70 dark:text-white/70">
                  <Mail className="w-4 h-4" />
                  <span>{profile.email_masked}</span>
                </div>
              )}
              {profile.member_since && (
                <div className="flex items-center gap-2 text-[#4B244A]/70 dark:text-white/70">
                  <Calendar className="w-4 h-4" />
                  <span>Member since {new Date(profile.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              {profile.region && (
                <div className="flex items-center gap-2 text-[#4B244A]/70 dark:text-white/70">
                  <MapPin className="w-4 h-4" />
                  <span>{profile.region}</span>
                </div>
              )}
            </div>
          </div>

          {profile.bio && (
            <div className="mt-4 bg-white/40 dark:bg-white/5 rounded-xl p-4 border border-white/40 dark:border-white/10">
              <h4 className="text-[#4B244A] dark:text-white font-bold text-sm mb-2">📝 Bio</h4>
              <p className="text-sm text-[#4B244A]/80 dark:text-white/80 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}
        </div>

        {/* Portfolio Section */}
        {profile.portfolio_photos && profile.portfolio_photos.length > 0 && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">
              <span className="inline-block mr-2">📸</span> Portfolio &amp; Credentials
            </h3>

            {/* ── Credentials & Certifications Section ── */}
            {(() => {
              const credentialPhotos = profile.portfolio_photos!.filter(p => p.category === 'credentials' || p.category === 'certification');
              if (credentialPhotos.length === 0) return null;
              return (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">📋</span>
                    <h4 className="text-[#4B244A] dark:text-white font-bold text-sm">Credentials &amp; Certifications</h4>
                    <span className="ml-auto px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-full">
                      {credentialPhotos.length} photo{credentialPhotos.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {credentialPhotos.map(photo => (
                      <div key={photo.id} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          const overlay = document.createElement('div');
                          overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:16px;';
                          overlay.onclick = () => overlay.remove();
                          const img = document.createElement('img');
                          img.src = photo.image_url;
                          img.style.cssText = 'max-width:100%;max-height:90vh;border-radius:12px;object-fit:contain;';
                          overlay.appendChild(img);
                          if (photo.caption) {
                            const cap = document.createElement('p');
                            cap.textContent = photo.caption;
                            cap.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:white;background:rgba(0,0,0,0.6);padding:8px 16px;border-radius:8px;font-size:14px;max-width:80%;text-align:center;';
                            overlay.appendChild(cap);
                          }
                          document.body.appendChild(overlay);
                        }}
                      >
                        <img src={photo.image_url} alt={photo.caption || 'Credential'} className="w-full h-32 object-cover" />
                        <div className="p-2">
                          <span className="inline-block px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-full uppercase">
                            {photo.category.replace('_', ' ')}
                          </span>
                          {photo.caption && (
                            <p className="text-[#4B244A]/70 dark:text-white/70 text-xs mt-1 truncate">{photo.caption}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Work Sample Section ── */}
            {(() => {
              const workPhotos = profile.portfolio_photos!.filter(p => p.category === 'work_sample' || p.category === 'before_after' || p.category === 'general');
              if (workPhotos.length === 0) return null;
              return (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🧹</span>
                    <h4 className="text-[#4B244A] dark:text-white font-bold text-sm">Work Sample</h4>
                    <span className="ml-auto px-2 py-0.5 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold rounded-full">
                      {workPhotos.length} photo{workPhotos.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {workPhotos.map(photo => (
                      <div key={photo.id} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          const overlay = document.createElement('div');
                          overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:16px;';
                          overlay.onclick = () => overlay.remove();
                          const img = document.createElement('img');
                          img.src = photo.image_url;
                          img.style.cssText = 'max-width:100%;max-height:90vh;border-radius:12px;object-fit:contain;';
                          overlay.appendChild(img);
                          if (photo.caption) {
                            const cap = document.createElement('p');
                            cap.textContent = photo.caption;
                            cap.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:white;background:rgba(0,0,0,0.6);padding:8px 16px;border-radius:8px;font-size:14px;max-width:80%;text-align:center;';
                            overlay.appendChild(cap);
                          }
                          document.body.appendChild(overlay);
                        }}
                      >
                        <img src={photo.image_url} alt={photo.caption || 'Work sample'} className="w-full h-32 object-cover" />
                        <div className="p-2">
                          <span className="inline-block px-2 py-0.5 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold rounded-full uppercase">
                            {photo.category.replace('_', ' ')}
                          </span>
                          {photo.caption && (
                            <p className="text-[#4B244A]/70 dark:text-white/70 text-xs mt-1 truncate">{photo.caption}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Reviews Section */}
        {profile.total_ratings > 0 && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4"><Star className="inline w-5 h-5 mr-2" /> Reviews</h3>
            
            {/* Rating Summary */}
            <div className="flex items-center gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-white/10">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#EA526F]">{profile.average_rating.toFixed(1)}</div>
                <StarRating rating={profile.average_rating} size="md" />
                <div className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-1 font-medium">{profile.total_ratings} reviews</div>
              </div>
              
              {/* Rating Breakdown */}
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = profile.rating_breakdown?.[stars] || 0;
                  const percentage = profile.total_ratings > 0 ? (count / profile.total_ratings) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="text-[#4B244A]/60 dark:text-white/60 text-sm font-bold w-6">{stars}★</span>
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#EA526F] rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-[#4B244A]/40 dark:text-white/40 text-xs font-medium w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Recent Reviews */}
            {profile.recent_reviews && profile.recent_reviews.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-[#4B244A]/80 dark:text-white/80 font-bold">Recent Reviews</h4>
                {profile.recent_reviews.map((review) => (
                  <div key={review.rating_id} className="bg-white/40 dark:bg-white/5 rounded-xl p-4 border border-white/40 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#4B244A] dark:text-white font-bold">{review.rater_name}</span>
                      <StarRating rating={review.stars} size="sm" />
                    </div>
                    {review.review && (
                      <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">{review.review}</p>
                    )}
                    {review.created_at && (
                      <p className="text-[#4B244A]/40 dark:text-white/40 text-xs mt-2 font-medium">
                        {new Date(review.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Packages Section */}
        <div className="mb-6">
<h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4"><Package className="inline w-5 h-5 mr-2" /> Service Packages</h3>

          {/* Inactive notice */}
          {!isFromApplicants && !profile.is_available && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700 dark:text-red-300">This housekeeper is currently inactive</p>
                <p className="text-xs text-red-500/80 dark:text-red-400/80">They are not accepting direct hire requests at this time.</p>
              </div>
            </div>
          )}
          
          {profile.packages.length === 0 ? (
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/50 dark:border-white/10 text-center shadow-lg">
              <p className="text-[#4B244A]/70 dark:text-white/70 font-medium">No packages available yet</p>
              <p className="text-[#4B244A]/50 dark:text-white/50 text-sm mt-1 font-medium">This housekeeper hasn't created any service packages</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {profile.packages.map((pkg) => (
                <div
                  key={pkg.package_id}
                  onClick={() => !isFromApplicants && profile.is_available && togglePackage(pkg.package_id)}
                  className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border-2 transition-all shadow-lg ${
                    isFromApplicants
                      ? 'border-white/50 dark:border-white/10 cursor-default'
                      : !profile.is_available
                        ? 'border-white/50 dark:border-white/10 opacity-60 cursor-not-allowed'
                        : selectedPackages.includes(pkg.package_id)
                          ? 'border-[#EA526F] bg-[#EA526F]/10 dark:bg-[#EA526F]/20 cursor-pointer'
                          : 'border-white/50 dark:border-white/10 hover:border-white/80 dark:hover:border-white/30 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {!isFromApplicants && (
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedPackages.includes(pkg.package_id)
                            ? 'bg-[#EA526F] border-[#EA526F]'
                            : 'border-gray-300 dark:border-white/40'
                        }`}>
                          {selectedPackages.includes(pkg.package_id) && (
                            <span className="text-white text-sm">✓</span>
                          )}
                        </div>
                        )}
                        <h4 className="text-lg font-bold text-[#4B244A] dark:text-white">{pkg.name}</h4>
                      </div>
                      
                      {pkg.description && (
                        <p className="text-[#4B244A]/70 dark:text-white/70 mt-2 ml-9 text-sm font-medium">{pkg.description}</p>
                      )}
                      
                      {pkg.services && pkg.services.length > 0 && (
                        <div className="mt-3 ml-9 flex flex-wrap gap-2">
                          {pkg.services.map((service, idx) => (
                            <span key={idx} className="px-2 py-1 bg-white/50 dark:bg-white/10 text-[#4B244A]/70 dark:text-white/70 text-xs font-bold rounded-full">
                              {service}
                            </span>
                          ))}
                        </div>
                      )}

                      {pkg.category_names && pkg.category_names.length > 0 && (
                        <div className="mt-2 ml-9 flex flex-wrap gap-1">
                          {pkg.category_names.map((cat, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-[#4B244A]/10 dark:bg-white/10 text-[#4B244A]/70 dark:text-white/60 text-xs font-bold rounded-full">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-3 ml-9 flex items-center gap-4 text-sm text-[#4B244A]/60 dark:text-white/60 font-medium">
                        <span>⏱ ~{pkg.duration_hours} hrs/day</span>
                        <span>📆 {pkg.num_days || 1} day{(pkg.num_days || 1) > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#EA526F]">
                        ₱{pkg.price.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Summary & Hire Button */}
        {!isFromApplicants && selectedPackages.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white/90 dark:bg-[#4B244A]/90 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 dark:border-white/30 shadow-2xl flex items-center justify-between">
                <div>
                  <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">{selectedPackages.length} package{selectedPackages.length !== 1 ? 's' : ''} selected</p>
                  <p className="text-2xl font-bold text-[#4B244A] dark:text-white">
                    Total: ₱{getSelectedTotal().toLocaleString()}
                  </p>
                </div>
                {profile.is_available ? (
                  <button
                    onClick={() => setShowHireModal(true)}
                    className="px-8 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all shadow-lg shadow-[#EA526F]/30"
                  >
                    Hire Now
                  </button>
                ) : (
                  <div className="flex flex-col items-end">
                    <button
                      disabled
                      className="px-8 py-3 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-bold rounded-xl cursor-not-allowed"
                    >
                      Hire Now
                    </button>
                    <span className="text-xs text-red-500 dark:text-red-400 font-medium mt-1">Housekeeper is currently inactive</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Hire Modal */}
      {showHireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl relative">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 bg-[#E8E4E1]/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#4B244A] dark:text-white"><Calendar className="inline w-5 h-5 mr-2" /> Schedule Booking</h3>
                 <button onClick={() => setShowHireModal(false)} className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white">×</button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Selected Packages Summary */}
              <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <h4 className="text-[#4B244A] dark:text-white font-bold mb-3">Selected Packages</h4>
                {profile.packages
                  .filter(p => selectedPackages.includes(p.package_id))
                  .map(pkg => (
                    <div key={pkg.package_id} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-b-0 border-gray-200 dark:border-white/10">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[#4B244A] dark:text-white font-bold text-sm">{pkg.name}</span>
                        <span className="text-[#EA526F] font-bold text-sm ml-2 shrink-0">₱{pkg.price.toLocaleString()}</span>
                      </div>
                      {pkg.description && (
                        <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mb-1">{pkg.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-[#4B244A]/60 dark:text-white/60 font-medium mb-2">
                        <span>⏱ ~{pkg.duration_hours} hrs/day</span>
                        <span>📆 {pkg.num_days || 1} day{(pkg.num_days || 1) > 1 ? 's' : ''}</span>
                      </div>
                      {pkg.services && pkg.services.length > 0 && (
                        <div>
                          <p className="text-[#4B244A]/50 dark:text-white/50 text-[10px] font-bold uppercase tracking-wide mb-1">Services Included</p>
                          <div className="flex flex-wrap gap-1">
                            {pkg.services.map((service, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-[#EA526F]/10 dark:bg-[#EA526F]/20 text-[#EA526F] dark:text-pink-300 text-[10px] font-bold rounded-full">
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {pkg.category_names && pkg.category_names.length > 0 && (
                        <div className="mt-1">
                          <p className="text-[#4B244A]/50 dark:text-white/50 text-[10px] font-bold uppercase tracking-wide mb-1">Categories</p>
                          <div className="flex flex-wrap gap-1">
                            {pkg.category_names.map((cat, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-[#4B244A]/10 dark:bg-white/10 text-[#4B244A] dark:text-white/80 text-[10px] font-bold rounded-full">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                }
                <div className="border-t border-gray-300 dark:border-white/20 mt-2 pt-2 flex justify-between text-[#4B244A] dark:text-white font-bold">
                  <span>Total</span>
                  <span>₱{getSelectedTotal().toLocaleString()}</span>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-[#4B244A] dark:text-white font-bold mb-2">Scheduled Date *</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScheduledDate(val);
                    if (val) {
                      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                      // Parse as local date to avoid UTC offset shifting the day
                      const [y, mo, d] = val.split('-').map(Number);
                      const detectedDay = days[new Date(y, mo - 1, d).getDay()];
                      // Auto-set the detected day; keep any extra days the user already selected
                      setDaysOfWeek(prev => prev.includes(detectedDay) ? prev : [detectedDay, ...prev.filter(d => d !== detectedDay)]);
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
                {scheduledDate && daysOfWeek.length > 0 && (
                  <p className="text-[#4B244A]/50 dark:text-white/50 text-xs mt-1 font-medium">
                    📅 {daysOfWeek.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                  </p>
                )}
              </div>

              {/* Start Time (one-time bookings) */}
              {!isRecurring && (
                <div>
                  <label className="block text-[#4B244A] dark:text-white font-bold mb-2">Start Time *</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                  />
                </div>
              )}

              {/* Estimated End Time (one-time bookings) */}
              {!isRecurring && (
                <div>
                  <label className="block text-[#4B244A] dark:text-white font-bold mb-2">Estimated End Time</label>
                  <div className="w-full px-4 py-3 bg-gray-100/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-[#4B244A]/70 dark:text-white/70 text-sm">
                    {(() => {
                      const selectedPkgs = profile.packages.filter(p => selectedPackages.includes(p.package_id));
                      const maxDuration = selectedPkgs.length > 0 ? Math.max(...selectedPkgs.map(p => p.duration_hours || 2)) : 2;
                      const [h, m] = startTime.split(':').map(Number);
                      const endH = Math.min(h + maxDuration, 23);
                      const displayH = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH;
                      const ampm = endH >= 12 ? 'PM' : 'AM';
                      return `~${displayH}:${(m || 0).toString().padStart(2, '0')} ${ampm} (${maxDuration} hrs based on package)`;
                    })()}
                  </div>
                  <p className="text-[#4B244A]/50 dark:text-white/50 text-[10px] mt-1 italic font-medium">
                    Auto-calculated from the package duration set by the housekeeper
                  </p>
                </div>
              )}

              {/* Recurring Schedule Option */}
              <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#EA526F] focus:ring-[#EA526F]"
                  />
                  <div>
                    <span className="text-blue-800 dark:text-blue-200 font-bold">🔄 Make this a recurring booking</span>
                    <p className="text-blue-600 dark:text-blue-300/70 text-xs mt-1 font-medium">
                      Set a regular schedule (e.g., every Saturday) so you don't need to book again
                    </p>
                  </div>
                </label>
              </div>

              {isRecurring && (
                <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 space-y-4 border border-gray-200 dark:border-white/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[#4B244A] dark:text-white font-bold mb-2 text-sm">
                        Days of Week *
                        {scheduledDate && daysOfWeek.length > 0 && (
                          <span className="ml-2 text-[10px] font-bold text-green-600 dark:text-green-400 normal-case">
                            ✓ {daysOfWeek.length === 1 ? 'Auto-detected from date' : `${daysOfWeek.length} days selected`}
                          </span>
                        )}
                      </label>
                      <p className="text-[#4B244A]/60 dark:text-white/60 text-[11px] mb-2 font-medium">
                        The day from your scheduled date is auto-selected. You can add more days for the recurring schedule.
                      </p>
                      {conflictingDays.length > 0 && (
                        <div className="mb-3 p-2 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-400/50 rounded-lg">
                          <p className="text-red-700 dark:text-red-300 text-[11px] font-bold">
                            ⚠️ Schedule conflict detected on: {conflictingDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                          </p>
                          <p className="text-red-600 dark:text-red-300/80 text-[10px] mt-1">
                            These days conflict with existing jobs. Please remove conflicting days or adjust your schedule.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                        {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map((day) => {
                          const isChecked = daysOfWeek.includes(day);
                          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                          const detectedDay = scheduledDate ? (() => { const [y,mo,d] = scheduledDate.split('-').map(Number); return days[new Date(y,mo-1,d).getDay()]; })() : '';
                          const isAutoDetected = day === detectedDay;
                          return (
                            <label
                              key={day}
                              className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl border-2 cursor-pointer transition-all select-none text-center relative
                                ${conflictingDays.includes(day)
                                  ? 'border-red-500 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 font-bold'
                                  : isChecked
                                  ? 'border-[#EA526F] bg-[#EA526F]/10 dark:bg-[#EA526F]/20 text-[#EA526F] dark:text-pink-300 font-bold'
                                  : 'border-gray-200 dark:border-white/20 bg-white/40 dark:bg-white/5 text-[#4B244A]/60 dark:text-white/50 hover:border-[#EA526F]/50'
                                }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={isChecked}
                                onChange={async () => {
                                  if (isAutoDetected && isChecked && daysOfWeek.length === 1) return; // keep at least auto-detected
                                  const updated = daysOfWeek.includes(day) 
                                    ? daysOfWeek.filter((d: string) => d !== day) 
                                    : [...daysOfWeek, day];
                                  setDaysOfWeek(updated);
                                  
                                  // Check for conflicts on the new days if we have a scheduled date and start time
                                  if (isRecurring && scheduledDate && startTime && updated.length > 0) {
                                    setConflictCheckLoading(true);
                                    try {
                                      const selectedPkgs = profile?.packages.filter((p: any) => selectedPackages.includes(p.package_id)) || [];
                                      const maxDuration = selectedPkgs.length > 0 ? Math.max(...selectedPkgs.map((p: any) => p.duration_hours || 2)) : 2;
                                      const [h, m] = startTime.split(':').map(Number);
                                      const endH = Math.min(h + maxDuration, 23);
                                      const endTime = `${endH.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
                                      
                                      const response = await fetch(
                                        `${API_BASE_URL}/direct-hire/check-conflicts/${profile?.worker_id}?` + new URLSearchParams({
                                          scheduled_date: scheduledDate,
                                          days_of_week: updated.join(','),
                                          start_time: startTime,
                                          end_time: endTime
                                        }),
                                        { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } }
                                      );
                                      if (response.ok) {
                                        const data = await response.json();
                                        setConflictingDays(data.conflicting_days || []);
                                      }
                                    } catch (error) {
                                      console.error('Conflict check error:', error);
                                    } finally {
                                      setConflictCheckLoading(false);
                                    }
                                  }
                                }}
                              />
                              <span className="text-[11px] font-bold leading-tight capitalize">
                                {day.slice(0,3).charAt(0).toUpperCase() + day.slice(0,3).slice(1)}
                              </span>
                              {conflictingDays.includes(day) && (
                                <span className="text-[8px] text-red-500 dark:text-red-300 font-bold leading-tight">⚠️conflict</span>
                              )}
                              {isAutoDetected && !conflictingDays.includes(day) && (
                                <span className="text-[8px] text-green-500 dark:text-green-400 font-bold leading-tight">auto</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[#4B244A] dark:text-white font-bold mb-2 text-sm">Frequency *</label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        required={isRecurring}
                        className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
                      >
                        <option value="weekly" className="text-gray-900">Every Week</option>
                        <option value="biweekly" className="text-gray-900">Every 2 Weeks</option>
                        <option value="monthly" className="text-gray-900">Monthly</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-[#4B244A] dark:text-white font-bold mb-2 text-sm">Preferred Start Time *</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required={isRecurring}
                        className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[#4B244A] dark:text-white font-bold mb-2 text-sm">Estimated End Time</label>
                      <div className="w-full px-4 py-3 bg-gray-100/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-[#4B244A]/70 dark:text-white/70 text-sm">
                        {(() => {
                          const selectedPkgs = profile.packages.filter(p => selectedPackages.includes(p.package_id));
                          const maxDuration = selectedPkgs.length > 0 ? Math.max(...selectedPkgs.map(p => p.duration_hours || 2)) : 2;
                          const [h, m] = startTime.split(':').map(Number);
                          const endH = Math.min(h + maxDuration, 23);
                          const endTimeStr = `${endH.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
                          const displayH = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH;
                          const ampm = endH >= 12 ? 'PM' : 'AM';
                          return `~${displayH}:${(m || 0).toString().padStart(2, '0')} ${ampm} (${maxDuration} hrs based on package)`;
                        })()}
                      </div>
                      <p className="text-[#4B244A]/50 dark:text-white/50 text-[10px] mt-1 italic font-medium">
                        Auto-calculated from the package duration set by the housekeeper
                      </p>
                    </div>
                  </div>
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">
                    Example: Every Tuesday &amp; Saturday starting at 9:00 AM
                  </p>
                </div>
              )}

              {/* Address */}
              <div>
                <label className="flex items-center gap-2 text-[#4B244A] dark:text-white cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={useMyAddress}
                    onChange={(e) => setUseMyAddress(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 dark:border-white/30 text-[#EA526F] focus:ring-[#EA526F]"
                  />
                  <span>Use my registered address</span>
                </label>
              </div>

              {/* Custom Address Form - shown when not using registered address */}
              {!useMyAddress && (
                <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-white/20">
                  <h4 className="text-[#4B244A] dark:text-white font-bold text-sm flex items-center gap-2">
                    📍 Service Address
                    {loadingAddress && <span className="text-[#4B244A]/50 dark:text-white/50 text-xs font-normal">(Loading...)</span>}
                  </h4>
                  
                  {/* Region */}
                  <div>
                    <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm mb-1 font-bold">Region *</label>
                    <select
                      value={customRegionCode}
                      onChange={handleRegionChange}
                      disabled={loadingAddress}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select Region</option>
                      {regions.map((region) => (
                        <option key={region.code} value={region.code} className="text-gray-900 dark:text-gray-900">
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Province */}
                  <div>
                    <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm mb-1 font-bold">Province *</label>
                    <select
                      value={customProvinceCode}
                      onChange={handleProvinceChange}
                      disabled={!customRegionCode || loadingAddress}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select Province</option>
                      {provinces.map((province) => (
                        <option key={province.code} value={province.code} className="text-gray-900 dark:text-gray-900">
                          {province.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* City/Municipality */}
                  <div>
                    <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm mb-1 font-bold">City/Municipality *</label>
                    <select
                      value={customCityCode}
                      onChange={handleCityChange}
                      disabled={!customProvinceCode || loadingAddress}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select City/Municipality</option>
                      {cities.map((city) => (
                        <option key={city.code} value={city.code} className="text-gray-900 dark:text-gray-900">
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Barangay */}
                  <div>
                    <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm mb-1 font-bold">Barangay *</label>
                    <select
                      value={customBarangayCode}
                      onChange={handleBarangayChange}
                      disabled={!customCityCode || loadingAddress}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select Barangay</option>
                      {barangays.map((barangay) => (
                        <option key={barangay.code} value={barangay.code} className="text-gray-900 dark:text-gray-900">
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Street/Landmark - Text field */}
                  <div>
                    <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm mb-1 font-bold">Street Address / Landmark / Details</label>
                    <textarea
                      value={customStreet}
                      onChange={(e) => setCustomStreet(e.target.value)}
                      placeholder="e.g., 123 Main St, Lot 5 Block 2, near the church, blue gate..."
                      rows={2}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
                    />
                    <p className="text-[#4B244A]/50 dark:text-white/50 text-xs mt-1 font-medium">Include landmarks or details to help the worker find your location</p>
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              <div>
                <label className="block text-[#4B244A] dark:text-white font-bold mb-2">Special Instructions (Optional)</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests or notes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleHire}
                disabled={submitting || !scheduledDate || conflictingDays.length > 0}
                className="w-full py-4 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EA526F]/30"
              >
                {submitting ? '⏳ Sending Request...' : conflictingDays.length > 0 ? '❌ Resolve Schedule Conflicts First' : '✓ Confirm Booking Request'}
              </button>

              <p className="text-[#4B244A]/60 dark:text-white/60 text-sm text-center font-medium">
                The housekeeper will review and accept/reject your booking request
              </p>
            </div>
          </div>
        </div>
      )}

      <TabBar role="owner" />
    </div>
  );
}