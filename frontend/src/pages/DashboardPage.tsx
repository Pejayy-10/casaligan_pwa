import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import TabBar from '../components/TabBar';
import StarRating from '../components/StarRating';
import AIChatModal from '../components/AIChatModal';
import apiClient from '../services/api';
import { Briefcase, ClipboardList, MessageCircle, CheckCircle, DollarSign, AlertCircle, Clock, MapPin, Star, ChevronRight, User as UserIcon } from 'lucide-react';
import type { User } from '../types';

interface RatingSummary {
  average_rating: number;
  total_ratings: number;
  rating_breakdown: { [key: number]: number };
}

interface Review {
  rating_id: number;
  rater_id: number;
  rater_name: string;
  stars: number;
  review: string | null;
  created_at: string;
}

interface Analytics {
  jobs_posted?: number;
  jobs_applied?: number;
  messages: number;
  reviews: number;
  completed_jobs?: number;
  total_earnings?: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;
      
      try {
        console.log('Fetching analytics for user:', user.id, 'Role:', user.active_role);
        const response = await apiClient.get('/auth/analytics');
        console.log('Analytics response:', response.data);
        setAnalytics(response.data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        // Set default values to show 0s instead of loading state
        setAnalytics({
          jobs_posted: 0,
          jobs_applied: 0,
          messages: 0,
          reviews: 0,
          completed_jobs: 0,
          total_earnings: 0
        });
      }
    };
    
    fetchAnalytics();
  }, [user]);

  // Fetch rating summary and reviews for housekeepers
  useEffect(() => {
    const fetchRatingSummary = async () => {
      if (!user) return;
      try {
        const summaryResponse = await apiClient.get(`/ratings/user/${user.id}/summary`);
        setRatingSummary(summaryResponse.data);
      } catch (error) {
        console.error('Failed to fetch rating summary:', error);
      }
    };

    const fetchReviews = async () => {
      if (!user) return;
      try {
        const reviewsResponse = await apiClient.get(`/ratings/user/${user.id}`);
        console.log('Reviews fetched:', reviewsResponse.data);
        // Map backend fields to ensure compatibility
        const mappedReviews = (reviewsResponse.data || []).map((r: any) => ({
          rating_id: r.rating_id,
          rater_id: r.rater_id,
          rater_name: r.rater_name || 'Anonymous',
          stars: r.stars ?? r.rating ?? 0,
          review: r.review ?? r.comment ?? null,
          created_at: r.created_at || '',
        }));
        setReviews(mappedReviews);
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      }
    };
    
    fetchRatingSummary();
    fetchReviews();
  }, [user]);

  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPromptLoading, setLocationPromptLoading] = useState(false);

  const requestLocationForHousekeeper = async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return false;
    }

    return new Promise((resolve) => {
      setLocationPromptLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          // Save GPS coordinates to user's address
          try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(
              `http://127.0.0.1:8000/auth/update-address-gps?latitude=${coords.latitude}&longitude=${coords.longitude}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            
            if (response.ok) {
              console.log('GPS coordinates saved to address');
              setLocationPromptLoading(false);
              resolve(true);
            } else {
              console.error('Failed to save GPS coordinates');
              setLocationPromptLoading(false);
              resolve(false);
            }
          } catch (error) {
            console.error('Error saving GPS coordinates:', error);
            setLocationPromptLoading(false);
            resolve(false);
          }
        },
        (error) => {
          let errorMessage = 'Failed to get your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out.';
              break;
          }
          alert(errorMessage);
          setLocationPromptLoading(false);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleLocationPromptAccept = async () => {
    const success = await requestLocationForHousekeeper();
    if (success) {
      setShowLocationPrompt(false);
      // Refresh user data to get updated address
      const updatedUser = await authService.getCurrentUser();
      if (updatedUser) {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      alert('✓ Location saved! Homeowners can now find you using GPS search.');
    }
  };

  const handleLocationPromptDismiss = () => {
    setShowLocationPrompt(false);
    alert('⚠️ Note: Without GPS location, homeowners may have difficulty finding you when using GPS search. You can enable this later in your profile.');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F4F2F0] dark:bg-slate-950 transition-colors duration-300 pb-24 relative font-sans">
      
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#EA526F]/10 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-400/10 rounded-full blur-[120px]" />
      </div>

      {/* Header / Welcome Section */}
      {/* ADDED: pt-14 for mobile headspace */}
      <header className="relative z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 pt-14 md:pt-6 pb-6 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#4B244A] dark:text-white tracking-tight">
                Welcome back, {user.first_name}!
              </h1>
              <p className="text-[#4B244A]/60 dark:text-white/60 mt-1 font-medium">
                Here's what's happening with your account today.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
                user.active_role === 'owner' 
                  ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/30' 
                  : 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-500/20 dark:text-pink-200 dark:border-pink-500/30'
              }`}>
                {user.active_role === 'owner' ? <Briefcase className="w-3.5 h-3.5 mr-1.5" /> : <UserIcon className="w-3.5 h-3.5 mr-1.5" />}
                {user.active_role === 'owner' ? 'House Owner' : 'Housekeeper'}
              </span>
              
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${
                user.status === 'active'
                  ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-500/20 dark:text-green-200 dark:border-green-500/30'
                  : user.status === 'pending'
                  ? 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-500/30'
                  : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/20 dark:text-red-200 dark:border-red-500/30'
              }`}>
                {user.status === 'active' ? <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> : user.status === 'pending' ? <Clock className="w-3.5 h-3.5 mr-1.5" /> : <AlertCircle className="w-3.5 h-3.5 mr-1.5" />}
                {user.status === 'active' ? 'Active Status' : user.status.charAt(0).toUpperCase() + user.status.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            icon={ClipboardList}
            iconColor="text-blue-600"
            bgColor="bg-blue-100 dark:bg-blue-500/20"
            value={analytics ? (user.active_role === 'owner' ? analytics.jobs_posted?.toString() || '0' : analytics.jobs_applied?.toString() || '0') : '...'}
            label={user.active_role === 'owner' ? 'Jobs Posted' : 'Jobs Applied'}
          />
          <StatCard 
            icon={MessageCircle}
            iconColor="text-purple-600"
            bgColor="bg-purple-100 dark:bg-purple-500/20"
            value={analytics ? analytics.messages.toString() : '...'}
            label="Messages"
          />
          <StatCard 
            icon={Star}
            iconColor="text-yellow-500"
            bgColor="bg-yellow-100 dark:bg-yellow-500/20"
            value={
              ratingSummary && ratingSummary.total_ratings > 0 
                ? ratingSummary.average_rating.toFixed(1)
                : analytics 
                  ? analytics.reviews.toString()
                  : '...'
            }
            label={
              ratingSummary && ratingSummary.total_ratings > 0 
                ? `${ratingSummary.total_ratings} Reviews`
                : analytics && analytics.reviews > 0 
                  ? `${analytics.reviews} Reviews`
                  : 'No Reviews'
            }
          />
          <StatCard 
            icon={user.active_role === 'owner' ? CheckCircle : DollarSign}
            iconColor="text-green-600"
            bgColor="bg-green-100 dark:bg-green-500/20"
            value={analytics ? (user.active_role === 'owner' ? analytics.completed_jobs?.toString() || '0' : `₱${analytics.total_earnings?.toLocaleString() || '0'}`) : '...'}
            label={user.active_role === 'owner' ? 'Completed Jobs' : 'Total Earnings'}
          />
        </div>

        {/* Rating Details Section (Housekeeper Only) */}
        {user.active_role === 'housekeeper' && (
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Rating Breakdown Card */}
            <div className="md:col-span-1 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-white/5 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Rating Overview</h3>
                <span className="p-2 bg-[#EA526F]/10 rounded-full">
                  <Star className="w-5 h-5 text-[#EA526F] fill-current" />
                </span>
              </div>
              
              {ratingSummary && ratingSummary.total_ratings > 0 ? (
                <>
                  <div className="text-center mb-6">
                    <div className="text-5xl font-black text-[#4B244A] dark:text-white tracking-tight">
                      {ratingSummary.average_rating.toFixed(1)}
                    </div>
                    <div className="flex justify-center my-2">
                      <StarRating rating={ratingSummary.average_rating} size="md" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Based on {ratingSummary.total_ratings} review{ratingSummary.total_ratings !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = ratingSummary.rating_breakdown?.[stars] || 0;
                      const percentage = ratingSummary.total_ratings > 0 
                        ? (count / ratingSummary.total_ratings) * 100 
                        : 0;
                      return (
                        <div key={stars} className="flex items-center gap-3 text-sm">
                          <span className="font-bold text-gray-600 dark:text-gray-300 w-3">{stars}</span>
                          <Star className="w-3 h-3 text-gray-400" />
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#EA526F] rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-gray-400 text-xs w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  </div>
                  <div className="text-4xl font-black text-gray-300 dark:text-gray-600 tracking-tight mb-2">0.0</div>
                  <div className="flex justify-center my-2">
                    <StarRating rating={0} size="md" />
                  </div>
                  <p className="text-sm font-medium text-gray-400 dark:text-gray-500">
                    No ratings yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                    Complete jobs to start receiving reviews
                  </p>
                </div>
              )}
            </div>

            {/* Recent Reviews Card */}
            <div className="md:col-span-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 border border-white/60 dark:border-white/5 shadow-lg flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Reviews Received</h3>
                {reviews.length > 3 && (
                  <button className="text-sm font-bold text-[#EA526F] hover:text-[#d4486a] transition-colors flex items-center">
                    View All <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 max-h-[400px] scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <div key={review.rating_id} className="group p-4 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 transition-all hover:shadow-md">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EA526F] to-[#4B244A] flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {review.rater_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                            <h4 className="font-bold text-[#4B244A] dark:text-white truncate">{review.rater_name}</h4>
                            <span className="text-xs font-medium text-gray-400">
                              {new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="flex mb-2">
                            <StarRating rating={review.stars} size="sm" />
                          </div>
                          {review.review ? (
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                              "{review.review}"
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No written comment.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-medium text-gray-500 dark:text-gray-400">No reviews yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Reviews from homeowners will appear here after completing jobs
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Location Prompt Modal */}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-gray-100 dark:border-white/10 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/20 rounded-full flex items-center justify-center mb-5 mx-auto">
              <MapPin className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>
            
            <h3 className="text-xl font-bold text-center text-[#4B244A] dark:text-white mb-3">
              Enable Location Services
            </h3>
            
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-8 leading-relaxed">
              Help homeowners find you by allowing access to your location. This improves your visibility in local searches.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleLocationPromptAccept}
                disabled={locationPromptLoading}
                className="w-full py-3 bg-[#EA526F] hover:bg-[#d64460] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#EA526F]/30 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {locationPromptLoading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" /> Getting Location...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Enable Location
                  </>
                )}
              </button>
              
              <button
                onClick={handleLocationPromptDismiss}
                disabled={locationPromptLoading}
                className="w-full py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 font-bold rounded-xl transition-colors text-sm"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      <AIChatModal />
      <TabBar role={user.active_role} />
    </div>
  );
}

// --- Helper Components ---

function StatCard({ 
  icon: Icon, 
  iconColor, 
  bgColor, 
  value, 
  label 
}: { 
  icon: any, 
  iconColor: string, 
  bgColor: string, 
  value: string, 
  label: string 
}) {
  return (
    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
      <div className={`w-12 h-12 ${bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div>
        <div className="text-2xl font-black text-[#4B244A] dark:text-white tracking-tight">{value}</div>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mt-1">{label}</div>
      </div>
    </div>
  );
}