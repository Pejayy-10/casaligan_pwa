import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import TabBar from '../components/TabBar';
import PackageManagement from '../components/PackageManagement';
import PackageOnboardingModal from '../components/PackageOnboardingModal';
import type { User } from '../types';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [application, setApplication] = useState<{
    id: number;
    status: string;
    notes?: string;
    submitted_at: string;
    reviewed_at?: string;
    admin_notes?: string;
  } | null>(null);
  const [loadingApplication, setLoadingApplication] = useState(true);
  // Check onboarding status once on mount
  const [showPackageOnboarding, setShowPackageOnboarding] = useState(() => {
    const stored = localStorage.getItem('user');
    const currentUser = stored ? JSON.parse(stored) : null;
    if (currentUser?.is_housekeeper && currentUser?.active_role === 'housekeeper') {
      const skipped = localStorage.getItem('package_onboarding_skipped');
      const completed = localStorage.getItem('package_onboarding_completed');
      const shown = localStorage.getItem('package_onboarding_shown_session');
      if (!skipped && !completed && !shown) {
        localStorage.setItem('package_onboarding_shown_session', 'true');
        return true;
      }
    }
    return false;
  });
  const [showPackageManagement, setShowPackageManagement] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      // Fetch application status
      const fetchApplicationStatus = () => {
        authService.getApplicationStatus()
          .then(app => {
            setApplication(app);
            // Check latest user state from localStorage
            const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;
            // If application was approved and user becomes housekeeper, refresh user data
            if (app && app.status === 'approved' && currentUser && !currentUser.is_housekeeper) {
              // Refresh user data to get updated is_housekeeper status
              const refreshUser = async () => {
                try {
                  const response = await fetch('http://127.0.0.1:8000/auth/me', {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                  });
                  if (response.ok) {
                    const updatedUser = await response.json();
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                  }
                } catch (error) {
                  console.error('Error refreshing user data:', error);
                }
              };
              refreshUser();
            }
          })
          .catch(() => setApplication(null))
          .finally(() => setLoadingApplication(false));
      };

      fetchApplicationStatus();

      // Poll for application status every 10 seconds if application is pending
      const interval = setInterval(() => {
        // Always check latest user state from localStorage
        const currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;
        console.log('[Polling] Current user is_housekeeper:', currentUser?.is_housekeeper);
        if (currentUser && !currentUser.is_housekeeper) {
          authService.getApplicationStatus()
            .then(app => {
              console.log('[Polling] Application status:', app?.status);
              setApplication(app);
              // If application was approved, refresh user data
              if (app && app.status === 'approved') {
                console.log('[Polling] Application approved! Fetching latest user data...');
                const refreshUser = async () => {
                  try {
                    const response = await fetch('http://127.0.0.1:8000/auth/me', {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                      }
                    });
                    if (response.ok) {
                      const updatedUser = await response.json();
                      console.log('[Polling] Updated user from API:', updatedUser);
                      console.log('[Polling] is_housekeeper value:', updatedUser.is_housekeeper);
                      setUser(updatedUser);
                      localStorage.setItem('user', JSON.stringify(updatedUser));
                    } else {
                      console.error('[Polling] Failed to fetch user:', response.status);
                    }
                  } catch (error) {
                    console.error('Error refreshing user data:', error);
                  }
                };
                refreshUser();
              }
            })
            .catch(() => setApplication(null));
        }
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [navigate]);

  const handleSwitchRole = async () => {
    if (!user) return;
    try {
      const result = await authService.switchRole();
      const updatedUser = { ...user, active_role: result.active_role as 'owner' | 'housekeeper' };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Check if switching to housekeeper for the first time
      if (result.active_role === 'housekeeper') {
        const skipped = localStorage.getItem('package_onboarding_skipped');
        const completed = localStorage.getItem('package_onboarding_completed');
        
        if (!skipped && !completed) {
          setShowPackageOnboarding(true);
        }
      }
    } catch {
      alert('Failed to switch role. You may not have housekeeper privileges yet.');
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const clearAllJobs = async () => {
    if (!confirm('⚠️ This will delete ALL job posts, applications, payments, contracts, and check-ins. Users will not be affected. Continue?')) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:8000/debug/clear-jobs', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('✓ All jobs and related data cleared successfully');
      } else {
        alert('✗ Failed to clear data');
      }
    } catch (error) {
      console.error('Clear jobs error:', error);
      alert('✗ Failed to clear data');
    }
  };

  const clearPayments = async () => {
    if (!confirm('⚠️ This will delete ALL payment schedules and transactions. Continue?')) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:8000/debug/clear-payments', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('✓ All payment data cleared successfully');
      } else {
        alert('✗ Failed to clear payments');
      }
    } catch (error) {
      console.error('Clear payments error:', error);
      alert('✗ Failed to clear payments');
    }
  };

  const clearContracts = async () => {
    if (!confirm('⚠️ This will delete ALL contracts. Continue?')) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:8000/debug/clear-contracts', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('✓ All contracts cleared successfully');
      } else {
        alert('✗ Failed to clear contracts');
      }
    } catch (error) {
      console.error('Clear contracts error:', error);
      alert('✗ Failed to clear contracts');
    }
  };

  const clearCheckIns = async () => {
    if (!confirm('⚠️ This will delete ALL check-ins. Continue?')) return;
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:8000/debug/clear-checkins', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('✓ All check-ins cleared successfully');
      } else {
        alert('✗ Failed to clear check-ins');
      }
    } catch (error) {
      console.error('Clear check-ins error:', error);
      alert('✗ Failed to clear check-ins');
    }
  };

  if (!user) return null;

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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-[#4B244A] dark:text-white">👤 Profile</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {/* Profile Info Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-4 sm:p-6 border border-white/50 dark:border-white/10 shadow-xl transition-all">
          <div className="flex items-center space-x-3 sm:space-x-4 mb-4 sm:mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#EA526F] rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-bold flex-shrink-0 shadow-lg">
              {user.first_name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold text-[#4B244A] dark:text-white break-words">
                {user.first_name} {user.middle_name} {user.last_name} {user.suffix}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-bold bg-[#EA526F] text-white shadow-md">
                  {user.active_role === 'owner' ? '🏠 House Owner' : '💼 Housekeeper'}
                </span>
                <span
                  className={`px-2 sm:px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center text-[#4B244A]/80 dark:text-white/80 text-sm sm:text-base font-medium">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="break-all">{user.email}</span>
            </div>
            <div className="flex items-center text-[#4B244A]/80 dark:text-white/80 text-sm sm:text-base font-medium">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {user.phone_number}
            </div>
          </div>
        </div>

        {/* Housekeeper Application Status Card */}
        {!loadingApplication && !user.is_housekeeper && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
            <h3 className="text-base sm:text-lg font-bold text-[#4B244A] dark:text-white mb-3 flex items-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Housekeeper Application
            </h3>
            
            {application ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#4B244A]/80 dark:text-white/80 font-medium">Status:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      application.status === 'approved'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                        : application.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                    }`}
                  >
                    {application.status === 'approved' ? '✓ Approved' : 
                     application.status === 'pending' ? '⏳ Pending' : 
                     '✗ Rejected'}
                  </span>
                </div>
                <div className="text-[#4B244A]/70 dark:text-white/70 text-sm">
                  <p>Submitted: {new Date(application.submitted_at).toLocaleDateString()}</p>
                  {application.reviewed_at && (
                    <p>Reviewed: {new Date(application.reviewed_at).toLocaleDateString()}</p>
                  )}
                </div>
                {application.notes && (
                  <div className="bg-gray-100 dark:bg-white/10 rounded-lg p-3">
                    <p className="text-[#4B244A]/80 dark:text-white/80 text-sm"><strong>Your Note:</strong> {application.notes}</p>
                  </div>
                )}
                {application.admin_notes && (
                  <div className="bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/50 rounded-lg p-3">
                    <p className="text-blue-800 dark:text-blue-200 text-sm"><strong>Admin Note:</strong> {application.admin_notes}</p>
                  </div>
                )}
                {application.status === 'approved' && (
                  <div className="bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/50 rounded-lg p-3">
                    <p className="text-green-800 dark:text-green-200 text-sm">
                      🎉 Congratulations! Your application has been approved. You can now switch to housekeeper mode.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">
                  Apply to become a housekeeper and start offering your services on our platform.
                </p>
                <button
                  onClick={() => navigate('/apply-housekeeper')}
                  className="w-full px-6 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg shadow-[#EA526F]/30"
                >
                  Apply as Housekeeper
                </button>
              </div>
            )}
          </div>
        )}

        {/* Address Card */}
        {user.address && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
            <h3 className="text-base sm:text-lg font-bold text-[#4B244A] dark:text-white mb-3 flex items-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Address
            </h3>
            <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">
              {user.address.region_name}, {user.address.province_name}, {user.address.city_name}, {user.address.barangay_name}
            </p>
          </div>
        )}

        {/* Documents Card */}
        {user.documents && user.documents.length > 0 && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
            <h3 className="text-base sm:text-lg font-bold text-[#4B244A] dark:text-white mb-3 flex items-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Documents
            </h3>
            <div className="space-y-2">
              {user.documents.map((doc: { id: number; document_type: string }) => (
                <div key={doc.id} className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">
                  • {doc.document_type}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Packages Section - Housekeeper Only */}
        {user.is_housekeeper && user.active_role === 'housekeeper' && (
          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base sm:text-lg font-bold text-[#4B244A] dark:text-white flex items-center">
                <span className="mr-2">📦</span>
                My Service Packages
              </h3>
              <button
                onClick={() => setShowPackageManagement(true)}
                className="px-3 py-1.5 bg-[#EA526F] text-white text-sm font-bold rounded-lg hover:bg-[#d64460] transition-all shadow-md"
              >
                Manage
              </button>
            </div>
            <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">
              Create and manage your service packages so homeowners can hire you directly. 
              Packages help showcase your services and pricing.
            </p>
            <button
              onClick={() => setShowPackageManagement(true)}
              className="mt-3 w-full py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <span>📋</span>
              View & Edit Packages
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {user.is_housekeeper && (
            <button
              onClick={handleSwitchRole}
              className="w-full px-6 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/20 shadow-md"
            >
              Switch to {user.active_role === 'owner' ? 'Housekeeper' : 'Owner'} Mode
            </button>
          )}
          
          {/* Debug/Testing Actions */}
          <div className="bg-red-50 dark:bg-red-500/10 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-red-200 dark:border-red-500/30 shadow-md">
            <h3 className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-200 mb-2 sm:mb-3">🛠️ Testing Tools (Temporary)</h3>
            <div className="space-y-2">
              <button
                onClick={clearAllJobs}
                className="w-full px-3 sm:px-4 py-2 bg-red-100 text-red-700 dark:bg-red-500/80 dark:text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-red-200 dark:hover:bg-red-600 transition-all"
              >
                🗑️ Clear All Jobs & Related Data
              </button>
              <button
                onClick={clearPayments}
                className="w-full px-3 sm:px-4 py-2 bg-orange-100 text-orange-700 dark:bg-orange-500/80 dark:text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-orange-200 dark:hover:bg-orange-600 transition-all"
              >
                💸 Clear Payments Only
              </button>
              <button
                onClick={clearContracts}
                className="w-full px-3 sm:px-4 py-2 bg-yellow-100 text-yellow-700 dark:bg-yellow-500/80 dark:text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-600 transition-all"
              >
                📄 Clear Contracts Only
              </button>
              <button
                onClick={clearCheckIns}
                className="w-full px-3 sm:px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-500/80 dark:text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-blue-200 dark:hover:bg-blue-600 transition-all"
              >
                📍 Clear Check-Ins Only
              </button>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
          >
            Logout
          </button>
        </div>
      </main>

      {/* Package Onboarding Modal */}
      {showPackageOnboarding && (
        <PackageOnboardingModal
          onClose={() => setShowPackageOnboarding(false)}
          onComplete={() => setShowPackageOnboarding(false)}
        />
      )}

      {/* Package Management Modal */}
      {showPackageManagement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl relative">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-[#E8E4E1]/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#4B244A] dark:text-white">📦 My Service Packages</h3>
                <button 
                  onClick={() => setShowPackageManagement(false)} 
                  className="text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white text-xl transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-1 font-medium">Create packages that house owners can book directly</p>
            </div>
            <div className="p-6">
              <PackageManagement embedded />
            </div>
          </div>
        </div>
      )}

      <TabBar role={user.active_role} />
    </div>
  );
}