import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, ClipboardList, Briefcase, MapPin, FileText, CheckCircle, Clock, AlertCircle, Package, Pencil, Camera, X, Loader2 } from 'lucide-react';
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

  // Profile edit state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editMiddleName, setEditMiddleName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editSuffix, setEditSuffix] = useState('');
  const [editProfilePic, setEditProfilePic] = useState<string | undefined>(undefined);
  const [previewPic, setPreviewPic] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openEditProfile = () => {
    if (!user) return;
    setEditFirstName(user.first_name);
    setEditMiddleName(user.middle_name || '');
    setEditLastName(user.last_name);
    setEditSuffix(user.suffix || '');
    setEditProfilePic(user.profile_picture);
    setPreviewPic(null);
    setSelectedFile(null);
    setEditError('');
    setShowEditProfile(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setEditError('Image must be less than 10MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setEditError('Only JPEG, PNG, WebP, or GIF images are allowed');
      return;
    }
    setSelectedFile(file);
    setPreviewPic(URL.createObjectURL(file));
    setEditError('');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      setEditError('First name and last name are required.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      let pictureUrl = editProfilePic;

      // Upload new picture first if selected
      if (selectedFile) {
        pictureUrl = await authService.uploadProfilePicture(selectedFile);
      }

      const updates: { first_name?: string; middle_name?: string; last_name?: string; suffix?: string; profile_picture?: string } = {};
      if (editFirstName.trim() !== user.first_name) updates.first_name = editFirstName.trim();
      if (editMiddleName.trim() !== (user.middle_name || '')) updates.middle_name = editMiddleName.trim();
      if (editLastName.trim() !== user.last_name) updates.last_name = editLastName.trim();
      if (editSuffix.trim() !== (user.suffix || '')) updates.suffix = editSuffix.trim();
      if (pictureUrl !== user.profile_picture) updates.profile_picture = pictureUrl;

      if (Object.keys(updates).length === 0) {
        setShowEditProfile(false);
        return;
      }

      const updatedUser = await authService.updateProfile(updates);
      setUser(updatedUser as User);
      setShowEditProfile(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
                  const response = await fetch(`${API_BASE_URL}/auth/me`, {
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
                    const response = await fetch(`${API_BASE_URL}/auth/me`, {
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

  const [switchingRole, setSwitchingRole] = useState(false);

  const handleSwitchRole = async () => {
    if (!user || switchingRole) return;
    setSwitchingRole(true);
    try {
      const result = await authService.switchRole();
      const updatedUser = { ...user, active_role: result.active_role as 'owner' | 'housekeeper' };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Check if switching to housekeeper
      if (result.active_role === 'housekeeper') {
        // Check if switching to housekeeper for the first time (package onboarding)
        const skipped = localStorage.getItem('package_onboarding_skipped');
        const completed = localStorage.getItem('package_onboarding_completed');
        
        if (!skipped && !completed) {
          setShowPackageOnboarding(true);
        }
      }
    } catch {
      alert('Failed to switch role. You may not have housekeeper privileges yet.');
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
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

      {/* Header (Original Structure Preserved) */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all shadow-sm pt-14 md:pt-4">
        <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#4B244A]/5 dark:bg-white/10 rounded-xl">
                            <UserIcon className="w-6 h-6 text-[#4B244A] dark:text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white tracking-tight">
                            Profile
                        </h1>
                    </div>
                </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8 space-y-6">
        
        {/* Profile Card */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/60 dark:border-white/5 shadow-lg relative overflow-hidden"> 
            <button
              onClick={openEditProfile}
              className="absolute top-4 right-4 z-20 p-2 bg-white/80 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm transition-all"
              title="Edit Profile"
            >
              <Pencil className="w-4 h-4 text-[#4B244A] dark:text-white" />
            </button>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
                {user.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover shadow-xl border-4 border-white dark:border-slate-800"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#EA526F] to-[#4B244A] flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-white dark:border-slate-800">
                    {user.first_name.charAt(0)}
                  </div>
                )}
                
                <div className="text-center sm:text-left flex-1">
                    <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white">
                        {user.first_name} {user.middle_name} {user.last_name} {user.suffix}
                    </h2>
                    
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            user.active_role === 'owner' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/30' 
                            : 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/20 dark:text-pink-200 dark:border-pink-500/30'
                        }`}>
                            {user.active_role === 'owner' ? 'House Owner' : 'Housekeeper'}
                        </span>
                        
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            user.status === 'active' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-200' : 
                            user.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-200' :
                            'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-200'
                        }`}>
                            {user.status === 'active' ? 'Active Account' : user.status === 'pending' ? 'Pending Approval' : 'Suspended'}
                        </span>
                    </div>

                    <div className="mt-4 space-y-1 text-sm text-[#4B244A]/70 dark:text-white/70 font-medium">
                        <p>{user.email}</p>
                        <p>{user.phone_number}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Application Status Card (If pending or rejected) */}
        {!loadingApplication && !user.is_housekeeper && (
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl p-6 border border-white/60 dark:border-white/5 shadow-md">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400">
                        <ClipboardList className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Housekeeper Application</h3>
                </div>

                {application ? (
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">Status</span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                application.status === 'approved' ? 'bg-green-100 text-green-700' :
                                application.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                                {application.status.toUpperCase()}
                            </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                            <p>Submitted: {new Date(application.submitted_at).toLocaleDateString()}</p>
                            {application.reviewed_at && <p>Reviewed: {new Date(application.reviewed_at).toLocaleDateString()}</p>}
                        </div>
                        
                        {(application.notes || application.admin_notes) && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10 space-y-2">
                                {application.notes && <p className="text-sm text-gray-500 italic">" {application.notes} "</p>}
                                {application.admin_notes && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-700 dark:text-blue-300">
                                        <strong>Admin:</strong> {application.admin_notes}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-[#4B244A]/60 dark:text-white/60 mb-4 text-sm">Join our team of housekeepers and start earning.</p>
                        <button
                            onClick={() => navigate('/apply-housekeeper')}
                            className="w-full py-2.5 bg-[#EA526F] hover:bg-[#d4486a] text-white font-bold rounded-xl shadow-lg shadow-[#EA526F]/20 transition-all text-sm"
                        >
                            Apply Now
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Info Grid */}
        <div className="grid md:grid-cols-2 gap-4">
            {/* Address */}
            {user.address && (
                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-orange-50 dark:bg-orange-500/20 rounded-lg text-orange-600 dark:text-orange-400">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-[#4B244A] dark:text-white">Address</h3>
                    </div>
                    <p className="text-sm text-[#4B244A]/70 dark:text-white/70 pl-11">
                        {user.address.region_name}, {user.address.province_name}<br/>
                        {user.address.city_name}, {user.address.barangay_name}
                    </p>
                </div>
            )}

            {/* Documents */}
            {user.documents && user.documents.length > 0 && (
                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-purple-50 dark:bg-purple-500/20 rounded-lg text-purple-600 dark:text-purple-400">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-[#4B244A] dark:text-white">Documents</h3>
                    </div>
                    <ul className="text-sm text-[#4B244A]/70 dark:text-white/70 pl-11 space-y-1">
                        {user.documents.map((doc: any) => (
                            <li key={doc.id} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                                {doc.document_type}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>

        {/* Housekeeper Package Manager */}
        {user.is_housekeeper && user.active_role === 'housekeeper' && (
            <div className="bg-gradient-to-br from-[#EA526F]/5 to-[#4B244A]/5 dark:from-[#EA526F]/10 dark:to-[#4B244A]/10 rounded-2xl p-6 border border-[#EA526F]/20 dark:border-[#EA526F]/30">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#EA526F] rounded-lg text-white shadow-md">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-[#4B244A] dark:text-white">Service Packages</h3>
                            <p className="text-xs text-[#4B244A]/60 dark:text-white/60">Manage your offerings</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPackageManagement(true)}
                        className="px-4 py-2 bg-white dark:bg-white/10 text-[#EA526F] dark:text-white font-bold text-sm rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-white/20 transition-colors"
                    >
                        Manage
                    </button>
                </div>
                <p className="text-sm text-[#4B244A]/70 dark:text-white/70">
                    Create packages to allow homeowners to book you directly with predefined services and prices.
                </p>
            </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
            {user.is_housekeeper && (
                <button
                    onClick={handleSwitchRole}
                    disabled={switchingRole}
                    className="w-full py-3.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {switchingRole ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Switching...
                      </>
                    ) : (
                      <>
                        <Briefcase className="w-4 h-4" />
                        Switch to {user.active_role === 'owner' ? 'Housekeeper' : 'Owner'} Mode
                      </>
                    )}
                </button>
            )}
            
            <button
                onClick={handleLogout}
                className="w-full py-3.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
            >
                Logout
            </button>
        </div>

      </main>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#EA526F]" />
                Edit Profile
              </h3>
              <button
                onClick={() => setShowEditProfile(false)}
                className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  {(previewPic || editProfilePic) ? (
                    <img
                      src={previewPic || editProfilePic}
                      alt="Profile"
                      className="w-28 h-28 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-lg"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#EA526F] to-[#4B244A] flex items-center justify-center text-white text-4xl font-bold border-4 border-white dark:border-slate-700 shadow-lg">
                      {user.first_name.charAt(0)}
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-[#EA526F] hover:bg-[#d4486a] text-white rounded-full shadow-lg transition-colors border-2 border-white dark:border-slate-700"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tap the camera icon to change your photo</p>
              </div>

              {/* First Name */}
              <div>
                <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]/50 focus:border-[#EA526F] transition-all text-sm"
                  placeholder="First name"
                />
              </div>

              {/* Middle Name */}
              <div>
                <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">Middle Name</label>
                <input
                  type="text"
                  value={editMiddleName}
                  onChange={(e) => setEditMiddleName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]/50 focus:border-[#EA526F] transition-all text-sm"
                  placeholder="Middle name (optional)"
                />
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]/50 focus:border-[#EA526F] transition-all text-sm"
                  placeholder="Last name"
                />
              </div>

              {/* Suffix */}
              <div>
                <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">Suffix</label>
                <input
                  type="text"
                  value={editSuffix}
                  onChange={(e) => setEditSuffix(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]/50 focus:border-[#EA526F] transition-all text-sm"
                  placeholder="e.g. Jr., Sr., III (optional)"
                />
              </div>

              {/* Error */}
              {editError && (
                <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {editError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditProfile(false)}
                  disabled={saving}
                  className="flex-1 py-3 bg-gray-100 dark:bg-white/5 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex-1 py-3 bg-[#EA526F] hover:bg-[#d4486a] text-white font-bold rounded-xl shadow-lg shadow-[#EA526F]/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Package Onboarding Modal */}
      {showPackageOnboarding && (
        <PackageOnboardingModal
          onClose={() => setShowPackageOnboarding(false)}
          onComplete={() => setShowPackageOnboarding(false)}
        />
      )}

      {/* Package Management Modal */}
      {showPackageManagement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl relative">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10 flex justify-between items-center">
              <div>
                  <h3 className="text-xl font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
                      <Package className="w-5 h-5 text-[#EA526F]" />
                      My Service Packages
                  </h3>
              </div>
              <button
                onClick={() => setShowPackageManagement(false)}
                aria-label="Close"
                className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60"
              >
                <span className="sr-only">Close</span>
                ×
              </button>
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