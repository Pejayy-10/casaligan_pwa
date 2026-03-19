import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, ClipboardList, Briefcase, MapPin, FileText, CheckCircle, Clock, AlertCircle, Package, Pencil, Camera, X, Loader2, Cake, Mail, Phone, Image, Shield, RefreshCw, ArrowRight } from 'lucide-react';
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

  // Portfolio state
  const [showPortfolioManagement, setShowPortfolioManagement] = useState(false);
  const [portfolioPhotos, setPortfolioPhotos] = useState<Array<{ id: number; image_url: string; caption: string | null; category: string; created_at: string | null }>>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioCategory, setPortfolioCategory] = useState('credentials');
  const [portfolioCaption, setPortfolioCaption] = useState('');
  const [portfolioError, setPortfolioError] = useState('');
  const portfolioFileRef = useRef<HTMLInputElement>(null);

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

  // Email & phone edit state
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // OTP verification modal state
  const [showEmailOtp, setShowEmailOtp] = useState(false);
  const [showPhoneOtp, setShowPhoneOtp] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [otpDevCode, setOtpDevCode] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const openEditProfile = () => {
    if (!user) return;
    setEditFirstName(user.first_name);
    setEditMiddleName(user.middle_name || '');
    setEditLastName(user.last_name);
    setEditSuffix(user.suffix || '');
    setEditEmail(user.email);
    // Strip +63 prefix for display
    setEditPhone(user.phone_number?.startsWith('+63') ? user.phone_number.slice(3) : user.phone_number || '');
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

  // Format Philippine phone for display
  const formatPhilippinePhone = (digits: string) => {
    const onlyDigits = digits.replace(/\D/g, '').slice(0, 10);
    const part1 = onlyDigits.slice(0, 3);
    const part2 = onlyDigits.slice(3, 6);
    const part3 = onlyDigits.slice(6, 10);
    return [part1, part2, part3].filter(Boolean).join(' ');
  };

  const isGmail = (email: string) => /^[^\s@]+@gmail\.com$/i.test(email.trim());
  const isPhilippinePhone = (phone: string) => {
    const raw = phone.replace(/\D/g, '').trim();
    return /^\d{10}$/.test(raw);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editFirstName.trim() || !editLastName.trim()) {
      setEditError('First name and last name are required.');
      return;
    }

    // Validate email if changed
    const emailLower = editEmail.trim().toLowerCase();
    const emailChanged = emailLower !== user.email;
    if (emailChanged && !isGmail(emailLower)) {
      setEditError('Only Gmail addresses are allowed (e.g. yourname@gmail.com)');
      return;
    }

    // Validate phone if changed
    const phoneRaw = editPhone.replace(/\D/g, '').trim();
    const fullPhone = `+63${phoneRaw}`;
    const phoneChanged = fullPhone !== user.phone_number;
    if (phoneChanged && !isPhilippinePhone(editPhone)) {
      setEditError('Enter 10 digits after +63 (e.g. 912 345 6789)');
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

      const updates: { first_name?: string; middle_name?: string; last_name?: string; suffix?: string; profile_picture?: string; email?: string; phone_number?: string } = {};
      if (editFirstName.trim() !== user.first_name) updates.first_name = editFirstName.trim();
      if (editMiddleName.trim() !== (user.middle_name || '')) updates.middle_name = editMiddleName.trim();
      if (editLastName.trim() !== user.last_name) updates.last_name = editLastName.trim();
      if (editSuffix.trim() !== (user.suffix || '')) updates.suffix = editSuffix.trim();
      if (pictureUrl !== user.profile_picture) updates.profile_picture = pictureUrl;
      if (emailChanged) updates.email = emailLower;
      if (phoneChanged) updates.phone_number = fullPhone;

      if (Object.keys(updates).length === 0) {
        setShowEditProfile(false);
        return;
      }

      const updatedUser = await authService.updateProfile(updates);
      setUser(updatedUser as User);
      setShowEditProfile(false);

      // If email was changed, prompt email OTP verification
      if (emailChanged) {
        setTimeout(() => {
          setOtpDigits(['', '', '', '', '', '']);
          setOtpError('');
          setOtpSuccess(false);
          setOtpDevCode('');
          setShowEmailOtp(true);
          sendEmailOtp();
        }, 300);
      }
      // If phone was changed, prompt phone OTP verification
      if (phoneChanged) {
        setTimeout(() => {
          setOtpDigits(['', '', '', '', '', '']);
          setOtpError('');
          setOtpSuccess(false);
          setOtpDevCode('');
          setShowPhoneOtp(true);
          sendPhoneOtp();
        }, emailChanged ? 600 : 300);
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── OTP helpers ───────────────────────────────────────────────────────────
  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const timer = setTimeout(() => setOtpResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpResendCooldown]);

  const sendEmailOtp = async () => {
    setOtpSending(true);
    setOtpError('');
    setOtpDevCode('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/auth/send-email-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.detail || 'Failed to send verification code.');
      } else {
        setOtpResendCooldown(60);
        if (data.dev_otp) setOtpDevCode(data.dev_otp);
      }
    } catch {
      setOtpError('Could not connect to the server.');
    } finally {
      setOtpSending(false);
    }
  };

  const sendPhoneOtp = async () => {
    setOtpSending(true);
    setOtpError('');
    setOtpDevCode('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/auth/send-phone-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.detail || 'Failed to send verification code.');
      } else {
        setOtpResendCooldown(60);
        if (data.dev_otp) setOtpDevCode(data.dev_otp);
      }
    } catch {
      setOtpError('Could not connect to the server.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleOtpDigitChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    setOtpError('');
    if (digit && idx < 5) {
      otpInputRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[idx]) {
        const next = [...otpDigits];
        next[idx] = '';
        setOtpDigits(next);
      } else if (idx > 0) {
        otpInputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      otpInputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      otpInputRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = text[i] || '';
    setOtpDigits(next);
    const focusIdx = Math.min(text.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  const handleVerifyEmailOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length < 6) { setOtpError('Please enter the complete 6-digit code.'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/auth/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update user in storage
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const u = JSON.parse(userStr);
          u.email_verified = true;
          localStorage.setItem('user', JSON.stringify(u));
          setUser(u);
        }
        setOtpSuccess(true);
        setTimeout(() => { setShowEmailOtp(false); setOtpSuccess(false); }, 1500);
      } else {
        setOtpError(data.detail || 'Verification failed.');
        setOtpDigits(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch {
      setOtpError('Could not connect to the server.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length < 6) { setOtpError('Please enter the complete 6-digit code.'); return; }
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/auth/verify-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (res.ok) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const u = JSON.parse(userStr);
          u.phone_verified = true;
          localStorage.setItem('user', JSON.stringify(u));
          setUser(u);
        }
        setOtpSuccess(true);
        setTimeout(() => { setShowPhoneOtp(false); setOtpSuccess(false); }, 1500);
      } else {
        setOtpError(data.detail || 'Verification failed.');
        setOtpDigits(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch {
      setOtpError('Could not connect to the server.');
    } finally {
      setOtpLoading(false);
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

  // Fetch portfolio photos when showing portfolio management
  const fetchPortfolio = async () => {
    setLoadingPortfolio(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/portfolio/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolioPhotos(data);
      }
    } catch {
      console.error('Failed to load portfolio');
    } finally {
      setLoadingPortfolio(false);
    }
  };

  useEffect(() => {
    if (showPortfolioManagement && user?.is_housekeeper) {
      fetchPortfolio();
    }
  }, [showPortfolioManagement]);

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (portfolioPhotos.length + files.length > 20) {
      setPortfolioError('Maximum 20 portfolio photos allowed.');
      return;
    }
    setPortfolioUploading(true);
    setPortfolioError('');
    try {
      const token = localStorage.getItem('access_token');
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) continue;
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(`${API_BASE_URL}/upload/image?category=portfolio`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          // Save to portfolio
          const saveRes = await fetch(`${API_BASE_URL}/portfolio/`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image_url: uploadData.url,
              caption: portfolioCaption || null,
              category: portfolioCategory,
            }),
          });
          if (saveRes.ok) {
            const saved = await saveRes.json();
            setPortfolioPhotos(prev => [saved, ...prev]);
          }
        }
      }
      setPortfolioCaption('');
    } catch {
      setPortfolioError('Failed to upload. Please try again.');
    } finally {
      setPortfolioUploading(false);
      if (portfolioFileRef.current) portfolioFileRef.current.value = '';
    }
  };

  const handleDeletePortfolioPhoto = async (photoId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/portfolio/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPortfolioPhotos(prev => prev.filter(p => p.id !== photoId));
      }
    } catch {
      console.error('Failed to delete photo');
    }
  };

  const [switchingRole, setSwitchingRole] = useState(false);

  const handleSwitchRole = async () => {
    if (!user || switchingRole) return;
    setSwitchingRole(true);
    try {
      const result = await authService.switchRole();
      const updatedUser = { ...user, active_role: result.active_role as 'owner' | 'housekeeper' };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      // Update user_role for easy access in other components
      localStorage.setItem('user_role', result.active_role);
      
      // Dispatch event so NotificationBell and NotificationsPage can update
      window.dispatchEvent(new Event('role-changed'));
      
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
      <header className="relative z-10 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all safe-area-top">
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

                    <div className="mt-4 space-y-1 text-sm text-[#4B244A]/70 dark:text-white/70 font-medium text-center sm:text-left">
                        <p className="flex items-center justify-center sm:justify-start gap-1.5">
                          <Mail className="w-4 h-4" />
                          {user.email}
                          {user.email_verified === false && (
                            <span className="ml-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full border border-amber-200 dark:border-amber-500/30">Unverified</span>
                          )}
                          {user.email_verified === true && (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-1" />
                          )}
                        </p>
                        <p className="flex items-center justify-center sm:justify-start gap-1.5">
                          <Phone className="w-4 h-4" />
                          {user.phone_number}
                          {user.phone_verified === false && (
                            <span className="ml-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full border border-amber-200 dark:border-amber-500/30">Unverified</span>
                          )}
                          {user.phone_verified === true && (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-1" />
                          )}
                        </p>
                        {user.birthday && (
                          <p className="flex items-center justify-center sm:justify-start gap-1.5">
                            <Cake className="w-4 h-4" />
                            {(() => {
                              const bday = new Date(user.birthday);
                              const today = new Date();
                              let age = today.getFullYear() - bday.getFullYear();
                              const m = today.getMonth() - bday.getMonth();
                              if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) age--;
                              return `${age} years old`;
                            })()}
                          </p>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Verification Warning Banner */}
        {(user.email_verified === false || user.phone_verified === false) && (
          <div className="bg-amber-50 dark:bg-amber-500/10 backdrop-blur-xl rounded-2xl p-5 border border-amber-200 dark:border-amber-500/20 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 dark:text-amber-200 text-sm">Verification Required</h3>
                <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mt-1">
                  {user.email_verified === false && user.phone_verified === false
                    ? 'Your email and phone number need to be verified.'
                    : user.email_verified === false
                    ? 'Your email address needs to be verified.'
                    : 'Your phone number needs to be verified.'}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {user.email_verified === false && (
                    <button
                      onClick={() => {
                        setOtpDigits(['', '', '', '', '', '']);
                        setOtpError('');
                        setOtpSuccess(false);
                        setOtpDevCode('');
                        setShowEmailOtp(true);
                        sendEmailOtp();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" /> Verify Email
                    </button>
                  )}
                  {user.phone_verified === false && (
                    <button
                      onClick={() => {
                        setOtpDigits(['', '', '', '', '', '']);
                        setOtpError('');
                        setOtpSuccess(false);
                        setOtpDevCode('');
                        setShowPhoneOtp(true);
                        sendPhoneOtp();
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" /> Verify Phone
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
                            className="w-full py-2.5 !bg-[#EA526F] hover:bg-[#d4486a] !text-white font-bold rounded-xl shadow-lg shadow-[#EA526F]/20 transition-all text-sm"
                        >
                            Apply Now
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-4">
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

        {/* Housekeeper Portfolio */}
        {user.is_housekeeper && user.active_role === 'housekeeper' && (
            <div className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10 rounded-2xl p-6 border border-purple-500/20 dark:border-purple-500/30">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500 rounded-lg text-white shadow-md">
                            <Image className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-[#4B244A] dark:text-white">My Portfolio</h3>
                            <p className="text-xs text-[#4B244A]/60 dark:text-white/60">Showcase your work &amp; credentials</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPortfolioManagement(true)}
                        className="px-4 py-2 bg-white dark:bg-white/10 text-purple-600 dark:text-white font-bold text-sm rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-white/20 transition-colors"
                    >
                        Manage
                    </button>
                </div>
                <p className="text-sm text-[#4B244A]/70 dark:text-white/70">
                    Upload before &amp; after photos, certifications, and work samples to market yourself to homeowners.
                </p>
            </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
            {user.is_housekeeper && (
                <button
                    onClick={handleSwitchRole}
                    disabled={switchingRole}
                    className="w-full py-3.5 !bg-[#E7467B] !text-white border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="w-full py-3.5 bg-gradient-to-br from-[#EA526F]/5 to-[#4B244A]/5 dark:from-[#EA526F]/10 dark:to-[#4B244A]/10 rounded-2xl p-6 border border-[#EA526F]/20 dark:border-[#EA526F]/30"
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

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-white/10 pt-2">
                <p className="text-xs font-semibold text-[#4B244A]/50 dark:text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Contact Info (requires re-verification)
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">
                  Email <span className="text-red-500">*</span>
                  {user.email_verified && editEmail.trim().toLowerCase() === user.email && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">✓ Verified</span>
                  )}
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]/50 focus:border-[#EA526F] transition-all text-sm"
                  placeholder="yourname@gmail.com"
                />
                {editEmail.trim().toLowerCase() !== user.email && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Changing email will require OTP re-verification
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">
                  Phone Number <span className="text-red-500">*</span>
                  {user.phone_verified && `+63${editPhone.replace(/\D/g, '')}` === user.phone_number && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">✓ Verified</span>
                  )}
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-3 rounded-l-xl border border-r-0 border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/10 text-[#4B244A] dark:text-white text-sm font-medium">
                    +63
                  </span>
                  <input
                    type="tel"
                    value={formatPhilippinePhone(editPhone)}
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 px-4 py-3 rounded-r-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]/50 focus:border-[#EA526F] transition-all text-sm"
                    placeholder="912 345 6789"
                    inputMode="numeric"
                  />
                </div>
                {`+63${editPhone.replace(/\D/g, '')}` !== user.phone_number && editPhone.replace(/\D/g, '').length > 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Changing phone will require SMS OTP re-verification
                  </p>
                )}
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

      {/* ─── Email OTP Verification Modal ─── */}
      {showEmailOtp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-gray-200 dark:border-white/20 shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#EA526F]" />
                Verify New Email
              </h3>
              <button onClick={() => setShowEmailOtp(false)} className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {otpSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-lg font-bold text-[#4B244A] dark:text-white">Email Verified!</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#4B244A]/70 dark:text-white/60 text-center">
                    We sent a 6-digit code to <strong className="text-[#4B244A] dark:text-white">{user?.email}</strong>
                  </p>

                  {otpDevCode && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl text-center">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                        ⚙️ Dev mode — Your code: <strong>{otpDevCode}</strong>
                      </p>
                    </div>
                  )}

                  {otpError && (
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm text-center">
                      {otpError}
                    </div>
                  )}

                  <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpInputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white ${
                          d ? 'border-[#EA526F] ring-2 ring-[#EA526F]/30' : 'border-gray-300 dark:border-white/20 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20'
                        }`}
                        disabled={otpLoading}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleVerifyEmailOtp}
                    disabled={!otpDigits.every(d => d !== '') || otpLoading}
                    className="w-full py-3 bg-[#EA526F] hover:bg-[#d4486a] text-white font-bold rounded-xl shadow-lg shadow-[#EA526F]/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <>Verify <ArrowRight className="w-4 h-4" /></>}
                  </button>

                  <div className="text-center">
                    {otpResendCooldown > 0 ? (
                      <p className="text-sm text-[#4B244A]/50 dark:text-white/40">Resend in <span className="font-semibold text-[#EA526F]">{otpResendCooldown}s</span></p>
                    ) : (
                      <button onClick={sendEmailOtp} disabled={otpSending} className="text-sm text-[#EA526F] font-semibold hover:underline disabled:opacity-50 flex items-center gap-1 mx-auto">
                        {otpSending ? <><RefreshCw className="w-3 h-3 animate-spin" /> Sending…</> : 'Resend code'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Phone OTP Verification Modal ─── */}
      {showPhoneOtp && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-gray-200 dark:border-white/20 shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-[#EA526F]" />
                Verify New Phone
              </h3>
              <button onClick={() => setShowPhoneOtp(false)} className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {otpSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-lg font-bold text-[#4B244A] dark:text-white">Phone Verified!</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#4B244A]/70 dark:text-white/60 text-center">
                    We sent a 6-digit code to <strong className="text-[#4B244A] dark:text-white">{user?.phone_number}</strong>
                  </p>

                  {otpDevCode && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl text-center">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                        ⚙️ Dev mode — Your code: <strong>{otpDevCode}</strong>
                      </p>
                    </div>
                  )}

                  {otpError && (
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm text-center">
                      {otpError}
                    </div>
                  )}

                  <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                    {otpDigits.map((d, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpInputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white ${
                          d ? 'border-[#EA526F] ring-2 ring-[#EA526F]/30' : 'border-gray-300 dark:border-white/20 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20'
                        }`}
                        disabled={otpLoading}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleVerifyPhoneOtp}
                    disabled={!otpDigits.every(d => d !== '') || otpLoading}
                    className="w-full py-3 bg-[#EA526F] hover:bg-[#d4486a] text-white font-bold rounded-xl shadow-lg shadow-[#EA526F]/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <>Verify <ArrowRight className="w-4 h-4" /></>}
                  </button>

                  <div className="text-center">
                    {otpResendCooldown > 0 ? (
                      <p className="text-sm text-[#4B244A]/50 dark:text-white/40">Resend in <span className="font-semibold text-[#EA526F]">{otpResendCooldown}s</span></p>
                    ) : (
                      <button onClick={sendPhoneOtp} disabled={otpSending} className="text-sm text-[#EA526F] font-semibold hover:underline disabled:opacity-50 flex items-center gap-1 mx-auto">
                        {otpSending ? <><RefreshCw className="w-3 h-3 animate-spin" /> Sending…</> : 'Resend code'}
                      </button>
                    )}
                  </div>
                </>
              )}
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

      {/* Portfolio Management Modal */}
      {showPortfolioManagement && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col border border-gray-200 dark:border-white/20 shadow-2xl relative sm:m-4">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10 flex justify-between items-center rounded-t-3xl shrink-0">
              <div>
                <h3 className="text-xl font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
                  <Image className="w-5 h-5 text-purple-500" />
                  My Portfolio
                </h3>
                <p className="text-xs text-[#4B244A]/60 dark:text-white/60 mt-1">Showcase your work to homeowners</p>
              </div>
              <button
                onClick={() => setShowPortfolioManagement(false)}
                aria-label="Close"
                className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Upload section */}
              <div className="space-y-4">
                <h4 className="font-bold text-[#4B244A] dark:text-white text-sm">Add New Photos</h4>
                
                {/* Category selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#4B244A]/70 dark:text-white/70 mb-2">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'credentials', label: '📋 Credentials & Certifications' },
                      { value: 'work_sample', label: '🧹 Work Sample' },
                    ].map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setPortfolioCategory(cat.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium text-left transition-all border ${
                          portfolioCategory === cat.value
                            ? 'bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300'
                            : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-[#4B244A]/70 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/10'
                        }`}
                      >
                        {portfolioCategory === cat.value ? '✓ ' : ''}{cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption */}
                <div>
                  <label className="block text-xs font-semibold text-[#4B244A]/70 dark:text-white/70 mb-2">Caption (Optional)</label>
                  <input
                    type="text"
                    value={portfolioCaption}
                    onChange={e => setPortfolioCaption(e.target.value)}
                    placeholder="E.g. Kitchen deep clean — before and after"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#4B244A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    maxLength={255}
                  />
                </div>

                {/* Upload button */}
                <div>
                  <input
                    ref={portfolioFileRef}
                    type="file"
                    onChange={handlePortfolioUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => portfolioFileRef.current?.click()}
                    disabled={portfolioUploading}
                    className="w-full py-6 border-2 border-dashed border-purple-300 dark:border-purple-500/30 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                  >
                    {portfolioUploading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                        <span className="text-sm font-medium text-purple-500">Uploading…</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-purple-400" />
                        <span className="text-sm font-medium text-[#4B244A]/70 dark:text-white/70">Click to upload photos</span>
                        <span className="text-xs text-[#4B244A]/40 dark:text-white/40">JPEG, PNG, WebP — max 10MB each</span>
                      </>
                    )}
                  </button>
                  {portfolioError && <p className="mt-2 text-red-500 text-sm">{portfolioError}</p>}
                </div>
              </div>

              {/* Existing photos */}
              <div>
                <h4 className="font-bold text-[#4B244A] dark:text-white text-sm mb-3">
                  Your Photos ({portfolioPhotos.length}/20)
                </h4>
                {loadingPortfolio ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  </div>
                ) : portfolioPhotos.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                    <Image className="w-10 h-10 mx-auto text-gray-300 dark:text-white/20 mb-2" />
                    <p className="text-[#4B244A]/50 dark:text-white/50 text-sm">No portfolio photos yet</p>
                    <p className="text-[#4B244A]/30 dark:text-white/30 text-xs mt-1">Upload photos to showcase your work</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* ── Credentials & Certifications ── */}
                    {portfolioPhotos.filter(p => p.category === 'credentials' || p.category === 'certification').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">📋</span>
                          <span className="text-[#4B244A] dark:text-white font-bold text-xs">Credentials &amp; Certifications</span>
                          <span className="ml-auto px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-full">
                            {portfolioPhotos.filter(p => p.category === 'credentials' || p.category === 'certification').length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {portfolioPhotos.filter(p => p.category === 'credentials' || p.category === 'certification').map(photo => (
                            <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                              <img src={photo.image_url} alt={photo.caption || 'Credential'} className="w-full h-32 object-cover" />
                              <button
                                type="button"
                                onClick={() => handleDeletePortfolioPhoto(photo.id)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="p-2">
                                {photo.caption && (
                                  <p className="text-[#4B244A]/70 dark:text-white/70 text-xs truncate">{photo.caption}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Work Sample ── */}
                    {portfolioPhotos.filter(p => p.category === 'work_sample' || p.category === 'before_after').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">🧹</span>
                          <span className="text-[#4B244A] dark:text-white font-bold text-xs">Work Sample</span>
                          <span className="ml-auto px-2 py-0.5 bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold rounded-full">
                            {portfolioPhotos.filter(p => p.category === 'work_sample' || p.category === 'before_after').length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {portfolioPhotos.filter(p => p.category === 'work_sample' || p.category === 'before_after').map(photo => (
                            <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                              <img src={photo.image_url} alt={photo.caption || 'Work Sample'} className="w-full h-32 object-cover" />
                              <button
                                type="button"
                                onClick={() => handleDeletePortfolioPhoto(photo.id)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500/90 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              <div className="p-2">
                                {photo.caption && (
                                  <p className="text-[#4B244A]/70 dark:text-white/70 text-xs truncate">{photo.caption}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Sticky bottom Done button */}
            <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 rounded-b-3xl">
              <button
                type="button"
                onClick={() => setShowPortfolioManagement(false)}
                className="w-full py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
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