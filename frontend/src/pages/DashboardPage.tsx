import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import TabBar from '../components/TabBar';
import StarRating from '../components/StarRating';
import apiClient from '../services/api';
import type { User } from '../types';

interface RatingSummary {
  average_rating: number;
  total_ratings: number;
  rating_breakdown: { [key: number]: number };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fetch rating summary for housekeepers
  useEffect(() => {
    const fetchRatingSummary = async () => {
      if (!user) return;
      
      try {
        const response = await apiClient.get(`/ratings/user/${user.id}/summary`);
        setRatingSummary(response.data);
      } catch (error) {
        console.error('Failed to fetch rating summary:', error);
      }
    };
    
    fetchRatingSummary();
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

  const handleSwitchRole = async () => {
    if (!user) return;
    try {
      const result = await authService.switchRole();
      const updatedUser = { ...user, active_role: result.active_role as 'owner' | 'housekeeper' };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Check if switching to housekeeper
      if (result.active_role === 'housekeeper') {
        // Check if user has GPS coordinates in their address
        const hasGPS = user.address?.latitude && user.address?.longitude;
        
        if (!hasGPS) {
          // Prompt to enable location
          setShowLocationPrompt(true);
        }
      }
    } catch {
      alert('Failed to switch role. You may not have housekeeper privileges yet.');
    }
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
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 pb-24 relative">
      {/* Decorative circles - Fixed position to stay while scrolling */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center">
            <span className="text-lg font-semibold text-[#4B244A] dark:text-white">Dashboard</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-xl p-6 md:p-8 mb-8 border border-white/50 dark:border-white/10 transition-all">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[#4B244A] dark:text-white mb-2">
                Welcome back, {user.first_name}! 👋
              </h2>
              <p className="text-[#4B244A]/70 dark:text-white/70 mb-5 text-sm md:text-base font-medium">
                {user.email} • {user.phone_number}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-[#EA526F] text-white shadow-md shadow-[#EA526F]/20">
                  {user.active_role === 'owner' ? '🏠 House Owner' : '💼 Housekeeper'}
                </span>
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold shadow-sm border border-transparent ${
                    user.status === 'active'
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                      : user.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                  }`}
                >
                  {user.status === 'active' ? '✓ Active' : user.status === 'pending' ? '⏳ Pending' : '⚠ Suspended'}
                </span>
              </div>
            </div>
            {user.is_housekeeper && (
              <button
                onClick={handleSwitchRole}
                className="px-6 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/20 shadow-sm whitespace-nowrap"
              >
                Switch to {user.active_role === 'owner' ? 'Housekeeper' : 'Owner'} Mode
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/50 dark:border-white/10 shadow-lg transition-all hover:scale-[1.02]">
            <div className="text-3xl mb-3">📋</div>
            <div className="text-2xl font-bold text-[#4B244A] dark:text-white">0</div>
            <div className="text-sm font-medium text-[#4B244A]/60 dark:text-white/60">{user.active_role === 'owner' ? 'Jobs Posted' : 'Jobs Applied'}</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/50 dark:border-white/10 shadow-lg transition-all hover:scale-[1.02]">
            <div className="text-3xl mb-3">💬</div>
            <div className="text-2xl font-bold text-[#4B244A] dark:text-white">0</div>
            <div className="text-sm font-medium text-[#4B244A]/60 dark:text-white/60">Messages</div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/50 dark:border-white/10 shadow-lg transition-all hover:scale-[1.02]">
            <div className="text-3xl mb-3">⭐</div>
            <div className="text-2xl font-bold text-[#4B244A] dark:text-white">
              {ratingSummary && ratingSummary.total_ratings > 0 
                ? ratingSummary.average_rating.toFixed(1) 
                : '—'}
            </div>
            <div className="text-sm font-medium text-[#4B244A]/60 dark:text-white/60">
              {ratingSummary && ratingSummary.total_ratings > 0 
                ? `${ratingSummary.total_ratings} Review${ratingSummary.total_ratings !== 1 ? 's' : ''}` 
                : 'No Reviews'}
            </div>
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/50 dark:border-white/10 shadow-lg transition-all hover:scale-[1.02]">
            <div className="text-3xl mb-3">{user.active_role === 'owner' ? '✅' : '💰'}</div>
            <div className="text-2xl font-bold text-[#4B244A] dark:text-white">{user.active_role === 'owner' ? '0' : '₱0'}</div>
            <div className="text-sm font-medium text-[#4B244A]/60 dark:text-white/60">{user.active_role === 'owner' ? 'Completed' : 'Earnings'}</div>
          </div>
        </div>

        {/* Rating Details for Housekeepers */}
        {user.active_role === 'housekeeper' && ratingSummary && ratingSummary.total_ratings > 0 && (
          <div className="mt-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-white/50 dark:border-white/10 shadow-lg">
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-6">⭐ Your Ratings</h3>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Average Rating */}
              <div className="text-center min-w-[150px]">
                <div className="text-5xl font-extrabold text-[#EA526F]">
                  {ratingSummary.average_rating.toFixed(1)}
                </div>
                <div className="mt-2 flex justify-center">
                  <StarRating rating={ratingSummary.average_rating} size="md" />
                </div>
                <div className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-2 font-medium">
                  {ratingSummary.total_ratings} review{ratingSummary.total_ratings !== 1 ? 's' : ''}
                </div>
              </div>
              
              {/* Rating Breakdown */}
              <div className="flex-1 w-full space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingSummary.rating_breakdown?.[stars] || 0;
                  const percentage = ratingSummary.total_ratings > 0 
                    ? (count / ratingSummary.total_ratings) * 100 
                    : 0;
                  return (
                    <div key={stars} className="flex items-center gap-3">
                      <span className="text-[#4B244A] dark:text-white text-sm font-bold w-6">{stars}★</span>
                      <div className="flex-1 h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#EA526F] rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Location Prompt Modal - When switching to housekeeper */}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/10 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="text-4xl">📍</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-2">
                  Enable Location Services
                </h3>
                <p className="text-[#4B244A]/80 dark:text-white/80 text-sm mb-4">
                  To help homeowners find you when they search using GPS location, please allow us to access your current location. 
                  This will save your location so you can be discovered by nearby homeowners.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleLocationPromptAccept}
                    disabled={locationPromptLoading}
                    className="flex-1 px-4 py-2 bg-[#EA526F] hover:bg-[#d64460] text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {locationPromptLoading ? '⏳ Getting Location...' : '✓ Enable Location'}
                  </button>
                  <button
                    onClick={handleLocationPromptDismiss}
                    disabled={locationPromptLoading}
                    className="px-4 py-2 bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-[#4B244A] dark:text-white font-bold rounded-xl transition-all text-sm border border-gray-200 dark:border-white/10 disabled:opacity-50"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <TabBar role={user.active_role} />
    </div>
  );
}