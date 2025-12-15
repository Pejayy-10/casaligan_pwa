import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import TabBar from '../components/TabBar';
import StarRating from '../components/StarRating';
import { psgcService } from '../services/psgc';
import type { PSGCRegion, PSGCProvince, PSGCCity, PSGCBarangay } from '../types';

interface WorkerPackage {
  package_id: number;
  name: string;
  description: string | null;
  price: number;
  duration_hours: number;
  services: string[];
}

interface Review {
  rating_id: number;
  stars: number;
  review: string | null;
  rater_name: string;
  created_at: string | null;
}

interface WorkerProfile {
  worker_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  phone_masked: string | null;
  email_masked: string | null;
  city: string | null;
  barangay: string | null;
  province: string | null;
  region: string | null;
  member_since: string | null;
  completed_jobs: number;
  is_verified: boolean;
  average_rating: number;
  total_ratings: number;
  rating_breakdown: { [key: number]: number };
  recent_reviews: Review[];
  packages: WorkerPackage[];
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
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [useMyAddress, setUseMyAddress] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Recurring schedule state
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [frequency, setFrequency] = useState('weekly');
  
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
        const response = await fetch(`http://127.0.0.1:8000/direct-hire/worker/${workerId}/profile`);
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
        `http://127.0.0.1:8000/availability/blocked-dates/check/${profile.worker_id}?check_date=${scheduledDate}`
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
    if (isRecurring && (!dayOfWeek || !startTime || !endTime)) {
      alert('Please complete all recurring schedule fields');
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
      
      const requestBody: Record<string, unknown> = {
        worker_id: profile.worker_id,
        package_ids: selectedPackages,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        special_instructions: specialInstructions || null,
        use_my_address: useMyAddress,
        // Include custom address fields when not using registered address
        address_street: useMyAddress ? null : customStreet || null,
        address_barangay: useMyAddress ? null : customBarangay || null,
        address_city: useMyAddress ? null : customCity || null,
        address_province: useMyAddress ? null : customProvince || null,
        address_region: useMyAddress ? null : customRegion || null
      };
      
      // Add recurring schedule if enabled
      if (isRecurring) {
        requestBody.recurring_schedule = {
          is_recurring: true,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          frequency: frequency
        };
      }
      
      const response = await fetch('http://127.0.0.1:8000/direct-hire/', {
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
      <div className="min-h-screen bg-linear-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
          <p className="text-white/70 mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">Worker not found</h2>
          <button onClick={() => navigate(-1)} className="mt-4 px-6 py-3 bg-[#EA526F] rounded-xl">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] pb-20">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-white">Housekeeper Profile</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-full bg-linear-to-br from-[#EA526F] to-[#6B3468] flex items-center justify-center text-3xl text-white font-bold shadow-lg">
              {profile.first_name[0]}{profile.last_name[0]}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">
                {profile.first_name} {profile.last_name}
              </h2>
              {profile.city && (
                <p className="text-white/70">
                  📍 {profile.barangay && `${profile.barangay}, `}{profile.city}
                  {profile.province && `, ${profile.province}`}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {profile.is_verified ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
                    ✓ Verified
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full">
                    ⏳ Pending Verification
                  </span>
                )}
                <span className="px-3 py-1 bg-white/10 text-white/70 text-sm rounded-full">
                  {profile.packages.length} package{profile.packages.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-[#EA526F]">{profile.completed_jobs}</div>
              <div className="text-white/60 text-xs">Jobs Completed</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-[#EA526F]">{profile.packages.length}</div>
              <div className="text-white/60 text-xs">Packages</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              {profile.total_ratings > 0 ? (
                <>
                  <div className="text-2xl font-bold text-[#EA526F]">{profile.average_rating.toFixed(1)}</div>
                  <div className="text-white/60 text-xs">{profile.total_ratings} Review{profile.total_ratings !== 1 ? 's' : ''}</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-white/40">—</div>
                  <div className="text-white/60 text-xs">No Reviews</div>
                </>
              )}
            </div>
          </div>

          {/* Contact Info (masked for privacy) */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <h4 className="text-white font-semibold text-sm mb-2">📋 Profile Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {profile.phone_masked && (
                <div className="flex items-center gap-2 text-white/70">
                  <span>📱</span>
                  <span>{profile.phone_masked}</span>
                </div>
              )}
              {profile.email_masked && (
                <div className="flex items-center gap-2 text-white/70">
                  <span>✉️</span>
                  <span>{profile.email_masked}</span>
                </div>
              )}
              {profile.member_since && (
                <div className="flex items-center gap-2 text-white/70">
                  <span>📅</span>
                  <span>Member since {new Date(profile.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              {profile.region && (
                <div className="flex items-center gap-2 text-white/70">
                  <span>🗺️</span>
                  <span>{profile.region}</span>
                </div>
              )}
            </div>
            <p className="text-white/50 text-xs mt-2 italic">
              Full contact details will be shared after booking confirmation
            </p>
          </div>
        </div>

        {/* Reviews Section */}
        {profile.total_ratings > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">⭐ Reviews</h3>
            
            {/* Rating Summary */}
            <div className="flex items-center gap-6 mb-6 pb-6 border-b border-white/10">
              <div className="text-center">
                <div className="text-4xl font-bold text-[#EA526F]">{profile.average_rating.toFixed(1)}</div>
                <StarRating rating={profile.average_rating} size="md" />
                <div className="text-white/60 text-sm mt-1">{profile.total_ratings} reviews</div>
              </div>
              
              {/* Rating Breakdown */}
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = profile.rating_breakdown?.[stars] || 0;
                  const percentage = profile.total_ratings > 0 ? (count / profile.total_ratings) * 100 : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="text-white/60 text-sm w-6">{stars}★</span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#EA526F] rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-white/40 text-xs w-8">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Recent Reviews */}
            {profile.recent_reviews && profile.recent_reviews.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-white/80 font-semibold">Recent Reviews</h4>
                {profile.recent_reviews.map((review) => (
                  <div key={review.rating_id} className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{review.rater_name}</span>
                      <StarRating rating={review.stars} size="sm" />
                    </div>
                    {review.review && (
                      <p className="text-white/70 text-sm">{review.review}</p>
                    )}
                    {review.created_at && (
                      <p className="text-white/40 text-xs mt-2">
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
          <h3 className="text-xl font-bold text-white mb-4">📦 Service Packages</h3>
          
          {profile.packages.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 text-center">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-white/70">No packages available yet</p>
              <p className="text-white/50 text-sm mt-1">This housekeeper hasn't created any service packages</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {profile.packages.map((pkg) => (
                <div
                  key={pkg.package_id}
                  onClick={() => !isFromApplicants && togglePackage(pkg.package_id)}
                  className={`bg-white/10 backdrop-blur-xl rounded-2xl p-5 border-2 transition-all ${
                    isFromApplicants 
                      ? 'border-white/20 cursor-default' 
                      : selectedPackages.includes(pkg.package_id)
                        ? 'border-[#EA526F] bg-[#EA526F]/20 cursor-pointer'
                        : 'border-white/20 hover:border-white/40 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {!isFromApplicants && (
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedPackages.includes(pkg.package_id)
                            ? 'bg-[#EA526F] border-[#EA526F]'
                            : 'border-white/40'
                        }`}>
                          {selectedPackages.includes(pkg.package_id) && (
                            <span className="text-white text-sm">✓</span>
                          )}
                        </div>
                        )}
                        <h4 className="text-lg font-bold text-white">{pkg.name}</h4>
                      </div>
                      
                      {pkg.description && (
                        <p className="text-white/70 mt-2 ml-9">{pkg.description}</p>
                      )}
                      
                      {pkg.services && pkg.services.length > 0 && (
                        <div className="mt-3 ml-9 flex flex-wrap gap-2">
                          {pkg.services.map((service, idx) => (
                            <span key={idx} className="px-2 py-1 bg-white/10 text-white/70 text-xs rounded-full">
                              {service}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-3 ml-9 flex items-center gap-4 text-sm text-white/60">
                        <span>⏱ ~{pkg.duration_hours} hours</span>
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
              <div className="bg-linear-to-r from-[#4B244A] to-[#6B3468] backdrop-blur-xl rounded-2xl p-4 border border-white/30 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-sm">{selectedPackages.length} package{selectedPackages.length !== 1 ? 's' : ''} selected</p>
                    <p className="text-2xl font-bold text-white">
                      Total: ₱{getSelectedTotal().toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHireModal(true)}
                    className="px-8 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all shadow-lg"
                  >
                    Hire Now 🚀
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Hire Modal */}
      {showHireModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-linear-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
            <div className="p-6 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">📅 Schedule Booking</h3>
                <button onClick={() => setShowHireModal(false)} className="text-white/60 hover:text-white">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Selected Packages Summary */}
              <div className="bg-white/10 rounded-xl p-4">
                <h4 className="text-white font-semibold mb-2">Selected Packages</h4>
                {profile.packages
                  .filter(p => selectedPackages.includes(p.package_id))
                  .map(pkg => (
                    <div key={pkg.package_id} className="flex justify-between text-white/80 text-sm py-1">
                      <span>{pkg.name}</span>
                      <span>₱{pkg.price.toLocaleString()}</span>
                    </div>
                  ))
                }
                <div className="border-t border-white/20 mt-2 pt-2 flex justify-between text-white font-bold">
                  <span>Total</span>
                  <span>₱{getSelectedTotal().toLocaleString()}</span>
                </div>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-white font-semibold mb-2">Scheduled Date *</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-white font-semibold mb-2">Preferred Time</label>
                <select
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                >
                  <option value="06:00">6:00 AM</option>
                  <option value="07:00">7:00 AM</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="13:00">1:00 PM</option>
                  <option value="14:00">2:00 PM</option>
                  <option value="15:00">3:00 PM</option>
                  <option value="16:00">4:00 PM</option>
                </select>
              </div>

              {/* Recurring Schedule Option */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <div>
                    <span className="text-white font-semibold">🔄 Make this a recurring booking</span>
                    <p className="text-white/70 text-xs mt-1">
                      Set a regular schedule (e.g., every Saturday) so you don't need to book again
                    </p>
                  </div>
                </label>
              </div>

              {isRecurring && (
                <div className="bg-white/10 rounded-xl p-4 space-y-4 border border-white/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm">Day of Week *</label>
                      <select
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value)}
                        required={isRecurring}
                        className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
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
                      <label className="block text-white font-semibold mb-2 text-sm">Frequency *</label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        required={isRecurring}
                        className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
                      >
                        <option value="weekly">Every Week</option>
                        <option value="biweekly">Every 2 Weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm">Start Time *</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required={isRecurring}
                        className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-white font-semibold mb-2 text-sm">End Time *</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required={isRecurring}
                        className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-white/60 text-xs">
                    Example: Every Saturday from 9:00 AM to 11:00 AM
                  </p>
                </div>
              )}

              {/* Address */}
              <div>
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMyAddress}
                    onChange={(e) => setUseMyAddress(e.target.checked)}
                    className="w-5 h-5 rounded border-white/30 bg-white/20 text-[#EA526F] focus:ring-[#EA526F]"
                  />
                  <span>Use my registered address</span>
                </label>
              </div>

              {/* Custom Address Form - shown when not using registered address */}
              {!useMyAddress && (
                <div className="bg-white/10 rounded-xl p-4 space-y-3 border border-white/20">
                  <h4 className="text-white font-semibold text-sm flex items-center gap-2">
                    📍 Service Address
                    {loadingAddress && <span className="text-white/50 text-xs">(Loading...)</span>}
                  </h4>
                  
                  {/* Region */}
                  <div>
                    <label className="block text-white/80 text-sm mb-1">Region *</label>
                    <select
                      value={customRegionCode}
                      onChange={handleRegionChange}
                      disabled={loadingAddress}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900">Select Region</option>
                      {regions.map((region) => (
                        <option key={region.code} value={region.code} className="text-gray-900">
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Province */}
                  <div>
                    <label className="block text-white/80 text-sm mb-1">Province *</label>
                    <select
                      value={customProvinceCode}
                      onChange={handleProvinceChange}
                      disabled={!customRegionCode || loadingAddress}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900">Select Province</option>
                      {provinces.map((province) => (
                        <option key={province.code} value={province.code} className="text-gray-900">
                          {province.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* City/Municipality */}
                  <div>
                    <label className="block text-white/80 text-sm mb-1">City/Municipality *</label>
                    <select
                      value={customCityCode}
                      onChange={handleCityChange}
                      disabled={!customProvinceCode || loadingAddress}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900">Select City/Municipality</option>
                      {cities.map((city) => (
                        <option key={city.code} value={city.code} className="text-gray-900">
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Barangay */}
                  <div>
                    <label className="block text-white/80 text-sm mb-1">Barangay *</label>
                    <select
                      value={customBarangayCode}
                      onChange={handleBarangayChange}
                      disabled={!customCityCode || loadingAddress}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900">Select Barangay</option>
                      {barangays.map((barangay) => (
                        <option key={barangay.code} value={barangay.code} className="text-gray-900">
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Street/Landmark - Text field */}
                  <div>
                    <label className="block text-white/80 text-sm mb-1">Street Address / Landmark / Details</label>
                    <textarea
                      value={customStreet}
                      onChange={(e) => setCustomStreet(e.target.value)}
                      placeholder="e.g., 123 Main St, Lot 5 Block 2, near the church, blue gate..."
                      rows={2}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-sm"
                    />
                    <p className="text-white/50 text-xs mt-1">Include landmarks or details to help the worker find your location</p>
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              <div>
                <label className="block text-white font-semibold mb-2">Special Instructions (Optional)</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests or notes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
              </div>

              {/* Submit Button */}
              <button
                onClick={handleHire}
                disabled={submitting || !scheduledDate}
                className="w-full py-4 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '⏳ Sending Request...' : '✓ Confirm Booking Request'}
              </button>

              <p className="text-white/60 text-sm text-center">
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
