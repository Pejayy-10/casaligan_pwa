import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import TabBar from '../components/TabBar';
import NotificationBell from '../components/NotificationBell';
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

  const handleSwitchRole = async () => {
    if (!user) return;
    try {
      const result = await authService.switchRole();
      const updatedUser = { ...user, active_role: result.active_role as 'owner' | 'housekeeper' };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch {
      alert('Failed to switch role. You may not have housekeeper privileges yet.');
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] pb-20">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="w-10"></div> {/* Spacer for centering */}
            <img src="/logo.png" alt="Casaligan" className="h-12 object-contain" />
            <NotificationBell 
              onNavigate={(referenceType) => {
                if (referenceType === 'job' || referenceType === 'direct_hire') {
                  navigate('/jobs');
                }
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 mb-8 border border-white/20">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                Welcome back, {user.first_name}! 👋
              </h2>
              <p className="text-white/80 mb-4 text-sm md:text-base">
                {user.email} • {user.phone_number}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-[#EA526F] text-white shadow-lg">
                  {user.active_role === 'owner' ? '🏠 House Owner' : '💼 Housekeeper'}
                </span>
                <span
                  className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${
                    user.status === 'active'
                      ? 'bg-green-500 text-white'
                      : user.status === 'pending'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {user.status === 'active' ? '✓ Active' : user.status === 'pending' ? '⏳ Pending' : '⚠ Suspended'}
                </span>
              </div>
            </div>
            {user.is_housekeeper && (
              <button
                onClick={handleSwitchRole}
                className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/30 transition-all border border-white/30 shadow-lg whitespace-nowrap"
              >
                Switch to {user.active_role === 'owner' ? 'Housekeeper' : 'Owner'} Mode
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-sm text-white/70">{user.active_role === 'owner' ? 'Jobs Posted' : 'Jobs Applied'}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
            <div className="text-3xl mb-2">💬</div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-sm text-white/70">Messages</div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
            <div className="text-3xl mb-2">⭐</div>
            <div className="text-2xl font-bold text-white">
              {ratingSummary && ratingSummary.total_ratings > 0 
                ? ratingSummary.average_rating.toFixed(1) 
                : '—'}
            </div>
            <div className="text-sm text-white/70">
              {ratingSummary && ratingSummary.total_ratings > 0 
                ? `${ratingSummary.total_ratings} Review${ratingSummary.total_ratings !== 1 ? 's' : ''}` 
                : 'No Reviews'}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
            <div className="text-3xl mb-2">{user.active_role === 'owner' ? '✅' : '💰'}</div>
            <div className="text-2xl font-bold text-white">{user.active_role === 'owner' ? '0' : '₱0'}</div>
            <div className="text-sm text-white/70">{user.active_role === 'owner' ? 'Completed' : 'Earnings'}</div>
          </div>
        </div>

        {/* Rating Details for Housekeepers */}
        {user.active_role === 'housekeeper' && ratingSummary && ratingSummary.total_ratings > 0 && (
          <div className="mt-6 bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">⭐ Your Ratings</h3>
            
            <div className="flex items-center gap-6">
              {/* Average Rating */}
              <div className="text-center">
                <div className="text-4xl font-bold text-[#EA526F]">
                  {ratingSummary.average_rating.toFixed(1)}
                </div>
                <StarRating rating={ratingSummary.average_rating} size="md" />
                <div className="text-white/60 text-sm mt-1">
                  {ratingSummary.total_ratings} review{ratingSummary.total_ratings !== 1 ? 's' : ''}
                </div>
              </div>
              
              {/* Rating Breakdown */}
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingSummary.rating_breakdown?.[stars] || 0;
                  const percentage = ratingSummary.total_ratings > 0 
                    ? (count / ratingSummary.total_ratings) * 100 
                    : 0;
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
          </div>
        )}
      </main>

      <TabBar role={user.active_role} />
    </div>
  );
}
