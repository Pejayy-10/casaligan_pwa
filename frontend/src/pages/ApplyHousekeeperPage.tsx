import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { API_BASE_URL } from '../config';
import TabBar from '../components/TabBar';
import type { User } from '../types';
import { CheckCircle2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

// ─── Constants ────────────────────────────────────────────────────────────────

const SKILLS = [
  { value: 'general_housekeeping', label: 'General Housekeeping' },
  { value: 'cleaning', label: 'House Cleaning' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'laundry', label: 'Laundry & Ironing' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'elderly_care', label: 'Elderly Care' },
  { value: 'pet_care', label: 'Pet Care' },
  { value: 'organizing', label: 'Organizing' },
  { value: 'gardening', label: 'Gardening' },
  { value: 'dishwashing', label: 'Dishwashing' },
];

const HOUSEKEEPER_DOC_TYPES = [
  { value: 'nbi_clearance', label: 'NBI Clearance' },
  { value: 'police_clearance', label: 'Police Clearance' },
  { value: 'barangay_clearance', label: 'Barangay Clearance' },
  { value: 'medical_certificate', label: 'Medical Certificate' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'voters_id', label: "Voter's ID" },
  { value: 'postal_id', label: 'Postal ID' },
  { value: 'other', label: 'Other' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocResult {
  id: number;
  status: 'approved' | 'pending' | 'rejected';
  notes?: string;
  rejection_reason?: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  const labels = ['Professional Info', 'Document 1', 'Document 2', 'Portfolio', 'Phone Verify'];
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#4B244A] dark:text-white font-bold text-2xl">Become a Housekeeper</span>
        <span className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">Step {current} of {total}</span>
      </div>
      <div className="flex gap-1.5 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
              i + 1 <= current ? 'bg-[#EA526F]' : 'bg-gray-200 dark:bg-white/20'
            }`}
          />
        ))}
      </div>
      <p className="text-[#4B244A]/70 dark:text-white/70 text-sm">{labels[current - 1]}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ApplyHousekeeperPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // Step navigation
  const [step, setStep] = useState(1);
  const [globalError, setGlobalError] = useState('');

  // Step 1: Professional info
  const [bio, setBio] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [availability, setAvailability] = useState('');
  const [step1Error, setStep1Error] = useState('');

  // Step 2: Primary clearance document
  const [nbiDocType, setNbiDocType] = useState('nbi_clearance');
  const [nbiResult, setNbiResult] = useState<DocResult | null>(null);
  const [nbiUploading, setNbiUploading] = useState(false);
  const [nbiError, setNbiError] = useState('');
  const nbiFileRef = useRef<HTMLInputElement>(null);

  // Step 3: Secondary document
  const [secDocType, setSecDocType] = useState('barangay_clearance');
  const [secResult, setSecResult] = useState<DocResult | null>(null);
  const [secUploading, setSecUploading] = useState(false);
  const [secError, setSecError] = useState('');
  const secFileRef = useRef<HTMLInputElement>(null);

  // Step 4: Portfolio photos (optional)
  const [portfolioPhotos, setPortfolioPhotos] = useState<Array<{ url: string; caption: string; category: string }>>([]);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioError, setPortfolioError] = useState('');
  const portfolioFileRef = useRef<HTMLInputElement>(null);
  const [portfolioCategory, setPortfolioCategory] = useState('work_sample');
  const [portfolioCaption, setPortfolioCaption] = useState('');

  // Step 5: Phone OTP
  const [phoneVerified, setPhoneVerified] = useState(() => {
    const u = localStorage.getItem('user');
    return u ? (JSON.parse(u)?.phone_verified === true) : false;
  });
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);

  // Lock background scroll when page/modal is open
  useScrollLock(true);

  // ── Guards ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) navigate('/login');
    if (user?.is_housekeeper) setSubmitted(true); // Already a housekeeper
  }, [user, navigate]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  // Upload a document file, run AI check, return DocResult
  const uploadDoc = async (
    file: File,
    docType: string,
    setUploading: (v: boolean) => void,
    setError: (v: string) => void
  ): Promise<DocResult | null> => {
    setUploading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');

      // 1. Upload binary file to storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);
      const uploadRes = await fetch(`${API_BASE_URL}/upload/document`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        setError(err.detail || 'Upload failed. Please try again.');
        return null;
      }
      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.url?.startsWith('http')
        ? uploadData.url
        : `${API_BASE_URL}${uploadData.url}`;

      // 2. Save to user_documents and run AI check
      const docData = await authService.uploadDocument({ document_type: docType, file_path: fileUrl });
      return {
        id: docData.id,
        status: docData.status as DocResult['status'],
        notes: docData.notes,
        rejection_reason: docData.rejection_reason,
      };
    } catch (e) {
      setError('Upload error. Please try again.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handleStep1Next = () => {
    setStep1Error('');
    if (selectedSkills.length === 0) { setStep1Error('Please select at least one skill.'); return; }
    if (!availability) { setStep1Error('Please select your availability.'); return; }
    setStep(2);
  };

  const handleNbiFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNbiResult(null);
    const result = await uploadDoc(file, nbiDocType, setNbiUploading, setNbiError);
    if (result) setNbiResult(result);
    if (nbiFileRef.current) nbiFileRef.current.value = '';
  };

  const handleSecFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSecResult(null);
    const result = await uploadDoc(file, secDocType, setSecUploading, setSecError);
    if (result) setSecResult(result);
    if (secFileRef.current) secFileRef.current.value = '';
  };

  const handlePortfolioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const res = await fetch(`${API_BASE_URL}/upload/image?category=portfolio`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setPortfolioPhotos(prev => [...prev, {
            url: data.url,
            caption: portfolioCaption,
            category: portfolioCategory,
          }]);
        }
      }
    } catch {
      setPortfolioError('Failed to upload. Please try again.');
    } finally {
      setPortfolioUploading(false);
      if (portfolioFileRef.current) portfolioFileRef.current.value = '';
    }
  };

  const removePortfolioPhoto = (index: number) => {
    setPortfolioPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    setOtpError('');
    try {
      const res = await authService.sendPhoneOTP();
      setOtpSent(true);
      setCountdown(60);
      setDevOtp(res.dev_otp || '');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setOtpError(msg || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) newOtp[i] = digits[i] || '';
    setOtp(newOtp);
    const nextEmpty = newOtp.findIndex(d => !d);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) { setOtpError('Enter all 6 digits.'); return; }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      await authService.verifyPhoneOTP(code);
      setPhoneVerified(true);
      // Refresh user in state
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setOtpError(msg || 'Incorrect code. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async () => {
    setGlobalError('');
    setSubmitting(true);
    try {
      const res = await authService.applyHousekeeper({
        bio: bio.trim() || undefined,
        years_experience: yearsExp ? parseInt(yearsExp) : undefined,
        skills: selectedSkills,
        availability,
        nbi_document_id: nbiResult?.id,
        secondary_document_id: secResult?.id,
      });
      setApproved(res.is_housekeeper);
      setSubmitted(true);
      // Refresh user from storage (applyHousekeeper already updates it)
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));

      // Save portfolio photos if any were uploaded and user is now a housekeeper
      if (portfolioPhotos.length > 0 && res.is_housekeeper) {
        try {
          const token = localStorage.getItem('access_token');
          await fetch(`${API_BASE_URL}/portfolio/bulk`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(portfolioPhotos.map(p => ({
              image_url: p.url,
              caption: p.caption || null,
              category: p.category,
            }))),
          });
        } catch {
          // Portfolio save failure is non-critical; they can add later from profile
          console.warn('Portfolio photos could not be saved. User can add them later from profile.');
        }
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGlobalError(msg || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Status badge helper ────────────────────────────────────────────────────

  const DocStatusBadge = ({ result }: { result: DocResult }) => {
    if (result.status === 'approved') {
      return (
        <div className="mt-3 p-3 bg-green-500/20 border border-green-500/40 rounded-xl">
          <p className="text-green-300 font-semibold text-sm">✅ Document verified successfully!</p>
          {result.notes && <p className="text-green-200/70 text-xs mt-1">{result.notes}</p>}
        </div>
      );
    }
    if (result.status === 'pending') {
      return (
        <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-xl">
          <p className="text-yellow-300 font-semibold text-sm">⏳ Document uploaded. Admin will review it shortly.</p>
          {result.notes && <p className="text-yellow-200/70 text-xs mt-1">{result.notes}</p>}
        </div>
      );
    }
    // rejected
    return (
      <div className="mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-xl">
        <p className="text-red-300 font-semibold text-sm">❌ Document rejected — please re-upload.</p>
        {result.rejection_reason && (
          <p className="text-red-200/70 text-xs mt-1">{result.rejection_reason}</p>
        )}
        <p className="text-[#4B244A]/60 dark:text-white/50 text-xs mt-2">Upload a different photo of the same document.</p>
      </div>
    );
  };

  if (!user) return null;

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputClass = 'w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-[#4B244A]/40 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] transition-all';
  const labelClass = 'block text-[#4B244A] dark:text-white/90 font-semibold text-sm mb-2';

  // ── Already housekeeper or submitted ──────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4 pb-24 transition-colors duration-300 relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#EA526F]/20 dark:bg-[#EA526F]/30 rounded-full blur-[100px] animate-blob will-change-transform" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] bg-teal-400/20 dark:bg-teal-500/20 rounded-full blur-[100px] animate-blob animation-delay-4000 will-change-transform" />
          <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-purple-400/15 dark:bg-purple-600/20 rounded-full blur-[80px] animate-blob animation-delay-2000 will-change-transform" />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-yellow-200/20 dark:bg-amber-500/10 rounded-full blur-[90px] animate-blob animation-delay-6000 will-change-transform" />
        </div>
        <div className="relative z-10 w-full max-w-md text-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/50 dark:border-white/10 shadow-2xl">
          {approved || user.is_housekeeper ? (
            <>
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">Welcome, Housekeeper!</h2>
              <p className="text-[#4B244A]/70 dark:text-white/70 mb-6">Your application has been approved. You can now switch to Housekeeper mode and start accepting jobs.</p>
              <button
                onClick={() => navigate('/profile')}
                className="w-full py-3 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg"
              >
                Go to Profile
              </button>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">Application Submitted!</h2>
              <p className="text-[#4B244A] dark:text-white/70 mb-2">Your application is now under review. We'll notify you once it's approved.</p>
              <p className="text-[#4B244A]/50 dark:text-white/50 text-sm mb-6">This usually takes 1–2 business days.</p>
              <button
                onClick={() => navigate('/profile')}
                className="w-full py-3 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg"
              >
                Go to Profile
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
  // ── Main wizard ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4 pt-16 pb-16 overflow-y-auto transition-colors duration-300 relative">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#EA526F]/20 dark:bg-[#EA526F]/30 rounded-full blur-[100px] animate-blob will-change-transform" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] bg-teal-400/20 dark:bg-teal-500/20 rounded-full blur-[100px] animate-blob animation-delay-4000 will-change-transform" />
        <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-purple-400/15 dark:bg-purple-600/20 rounded-full blur-[80px] animate-blob animation-delay-2000 will-change-transform" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-yellow-200/20 dark:bg-amber-500/10 rounded-full blur-[90px] animate-blob animation-delay-6000 will-change-transform" />
      </div>

      <main className="relative z-10 w-full max-w-2xl">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/50 dark:border-white/10 shadow-2xl">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="text-[#4B244A]/50 hover:text-[#4B244A]/80 dark:text-white/60 dark:hover:text-white/80 text-sm transition-colors"
            >
              ✕
            </button>
          </div>
          <StepBar current={step} total={5} />

          {globalError && (
            <div className="mb-4 p-3 bg-red-300/20 border border-red-500/40 rounded-xl">
              <p className="text-red-400 text-sm">{globalError}</p>
            </div>
          )}

          {/* ── Step 1: Professional Info ── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Skills */}
              <div>
                <label className={labelClass}>Skills / Services Offered <span className="text-[#EA526F]">*</span></label>
                <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mb-3">Select all that apply.</p>
                <div className="grid grid-cols-2 gap-2">
                  {SKILLS.map(skill => (
                    <button
                      key={skill.value}
                      type="button"
                      onClick={() => toggleSkill(skill.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all border ${
                        selectedSkills.includes(skill.value)
                          ? 'bg-[#EA526F]/30 border-[#EA526F] text-white'
                          : 'bg-white/5 border-white/20 text-[#4B244A]/70 dark:text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {selectedSkills.includes(skill.value) ? '✓ ' : ''}{skill.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div>
                <label className={labelClass}>Availability <span className="text-[#EA526F]">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'full_time', label: 'Full-time' },
                    { value: 'part_time', label: 'Part-time' },
                    { value: 'weekends_only', label: 'Weekends' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAvailability(opt.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                        availability === opt.value
                          ? 'bg-[#EA526F]/30 border-[#EA526F] text-white'
                          : 'bg-white/5 border-white/20 text-[#4B244A]/70 dark:text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {availability === opt.value ? '✓ ' : ''}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Years of experience */}
              <div>
                <label className={labelClass}>Years of Experience (Optional)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={yearsExp}
                  onChange={e => setYearsExp(e.target.value)}
                  placeholder="E.g. 3"
                  className={inputClass}
                />
              </div>

              {/* Bio */}
              <div>
                <label className={labelClass}>About Yourself (Optional)</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  placeholder="Tell house owners about your experience, work style, and what makes you a great housekeeper..."
                  className={`${inputClass} resize-none`}
                />
              </div>

              {step1Error && (
                <p className="text-red-300 text-sm font-medium">{step1Error}</p>
              )}

              <button
                type="button"
                onClick={handleStep1Next}
                className="w-full py-3.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg shadow-[#EA526F]/30"
              >
                Next →
              </button>
            </div>
          )}

          {/* ── Step 2: Primary Clearance Document ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-500 text-sm font-semibold mb-1">Primary Verification Document</p>
                <p className="text-blue-400/80 dark:text-blue-200/70 text-xs">
                  Upload any accepted verification document. Your name must match your registered name: <strong className="text-blue-500 dark:text-white font-semibold">{user.first_name} {user.last_name}</strong>.
                  Our AI (Gemini Vision) will verify the document automatically.
                </p>
              </div>

              {/* Document type selector */}
              <div>
                <label className={labelClass}>Document Type <span className="text-[#EA526F]">*</span></label>
                <select
                  value={nbiDocType}
                  onChange={(e) => { setNbiDocType(e.target.value); setNbiResult(null); setNbiError(''); }}
                  className={inputClass}
                >
                  {HOUSEKEEPER_DOC_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value} className="text-gray-900 dark:text-gray-900">
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* File upload */}
              <div>
                <label className={labelClass}>Upload {HOUSEKEEPER_DOC_TYPES.find(d => d.value === nbiDocType)?.label} <span className="text-[#EA526F]">*</span></label>
                <input
                  type="file"
                  ref={nbiFileRef}
                  onChange={handleNbiFile}
                  accept="image/*,.pdf"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => nbiFileRef.current?.click()}
                  disabled={nbiUploading}
                  className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
                    nbiUploading
                      ? 'border-white/20 text-[#4B244A]/40 dark:text-white/40 cursor-wait'
                      : nbiResult?.status === 'approved'
                      ? 'border-green-500/50 text-green-300 hover:border-green-400'
                      : nbiResult?.status === 'rejected'
                      ? 'border-red-500/50 text-red-300 hover:border-red-400'
                      : 'border-white/20 text-[#4B244A]/60 dark:text-white/60 hover:border-[#EA526F] hover:text-[#EA526F]'
                  }`}
                >
                  {nbiUploading ? (
                    <>
                      <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-sm font-medium">Uploading & verifying…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">
                        {nbiResult?.status === 'approved' ? '✅' : nbiResult?.status === 'rejected' ? '❌' : '📄'}
                      </span>
                      <span className="text-sm font-medium">
                        {nbiResult ? 'Click to re-upload' : `Click to upload ${HOUSEKEEPER_DOC_TYPES.find(d => d.value === nbiDocType)?.label}`}
                      </span>
                      <span className="text-xs opacity-60">JPEG, PNG, PDF — max 10MB</span>
                    </>
                  )}
                </button>
                {nbiError && <p className="mt-2 text-red-300 text-sm">{nbiError}</p>}
                {nbiResult && <DocStatusBadge result={nbiResult} />}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 !bg-black/30 !text-white dark:text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20">
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!nbiResult || nbiResult.status === 'rejected'}
                  onClick={() => setStep(3)}
                  className="flex-1 py-3 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Secondary Document ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-500 text-sm font-semibold mb-1">Supporting Document</p>
                <p className="text-blue-400/80 dark:text-blue-200/70 text-xs">
                  Upload one more document to complete your verification. Any of the options below are accepted.
                </p>
              </div>

              {/* Document type selector */}
              <div>
                <label className={labelClass}>Document Type <span className="text-[#EA526F]">*</span></label>
                <select
                  value={secDocType}
                  onChange={(e) => { setSecDocType(e.target.value); setSecResult(null); setSecError(''); }}
                  className={inputClass}
                >
                  {HOUSEKEEPER_DOC_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value} className="text-gray-900 dark:text-gray-900">
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* File upload */}
              <div>
                <label className={labelClass}>Upload {HOUSEKEEPER_DOC_TYPES.find(d => d.value === secDocType)?.label} <span className="text-[#EA526F]">*</span></label>
                <input ref={secFileRef} type="file" onChange={handleSecFile} accept="image/*,.pdf" className="hidden" />
                <button
                  type="button"
                  onClick={() => secFileRef.current?.click()}
                  disabled={secUploading}
                  className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${
                    secUploading
                      ? 'border-white/20 text-[#4B244A]/40 dark:text-white/40 cursor-wait'
                      : secResult?.status === 'approved'
                      ? 'border-green-500/50 text-green-300 hover:border-green-400'
                      : secResult?.status === 'rejected'
                      ? 'border-red-500/50 text-red-300 hover:border-red-400'
                      : 'border-white/20 text-[#4B244A]/60 dark:text-white/60 hover:border-[#EA526F] hover:text-[#EA526F]'
                  }`}
                >
                  {secUploading ? (
                    <>
                      <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-sm font-medium">Uploading & verifying…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">{secResult?.status === 'approved' ? '✅' : secResult?.status === 'rejected' ? '❌' : '📄'}</span>
                      <span className="text-sm font-medium">
                        {secResult ? 'Click to re-upload' : `Click to upload ${HOUSEKEEPER_DOC_TYPES.find(d => d.value === secDocType)?.label}`}
                      </span>
                      <span className="text-xs opacity-60">JPEG, PNG, PDF — max 10MB</span>
                    </>
                  )}
                </button>
                {secError && <p className="mt-2 text-red-300 text-sm">{secError}</p>}
                {secResult && <DocStatusBadge result={secResult} />}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 !bg-black/30 !text-white dark:text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20">
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={!secResult || secResult.status === 'rejected'}
                  onClick={() => setStep(4)}
                  className="flex-1 py-3 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Portfolio Photos (Optional) ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                <p className="text-purple-500 text-sm font-semibold mb-1">📸 Build Your Portfolio (Optional)</p>
                <p className="text-purple-400/80 dark:text-purple-200/70 text-xs">
                  Upload photos to market yourself to homeowners. You can skip this and add them later from your profile.
                </p>
              </div>

              {/* ── Section 1: Credentials ── */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📋</span>
                  <div>
                    <h4 className="text-[#4B244A] dark:text-white font-bold text-sm">Credentials &amp; Certifications</h4>
                    <p className="text-[#4B244A]/50 dark:text-white/50 text-xs">Certificates, training diplomas, IDs, awards, etc.</p>
                  </div>
                </div>

                {/* Caption for credentials */}
                <input
                  type="text"
                  value={portfolioCategory === 'credentials' || portfolioCategory === 'certification' ? portfolioCaption : ''}
                  onChange={e => { setPortfolioCaption(e.target.value); }}
                  onFocus={() => { if (portfolioCategory !== 'credentials' && portfolioCategory !== 'certification') setPortfolioCategory('credentials'); }}
                  placeholder="E.g. TESDA certificate for housekeeping"
                  className={`${inputClass} !py-2 text-sm`}
                  maxLength={255}
                />

                {/* Category sub-picker */}
                <div className="flex gap-2">
                  {[
                    { value: 'credentials', label: '📋 Credentials' },
                    { value: 'certification', label: '🏆 Certification' },
                  ].map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setPortfolioCategory(cat.value)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                        portfolioCategory === cat.value
                          ? 'bg-[#EA526F]/30 border-[#EA526F] text-white'
                          : 'bg-white/5 border-white/20 text-[#4B244A]/70 dark:text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {portfolioCategory === cat.value ? '✓ ' : ''}{cat.label}
                    </button>
                  ))}
                </div>

                {/* Upload for credentials */}
                <button
                  type="button"
                  onClick={() => { if (portfolioCategory !== 'credentials' && portfolioCategory !== 'certification') setPortfolioCategory('credentials'); portfolioFileRef.current?.click(); }}
                  disabled={portfolioUploading}
                  className={`w-full py-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                    portfolioUploading
                      ? 'border-white/20 text-[#4B244A]/40 dark:text-white/40 cursor-wait'
                      : 'border-purple-300/40 dark:border-purple-500/30 text-[#4B244A]/60 dark:text-white/60 hover:border-purple-400 hover:text-purple-500'
                  }`}
                >
                  {portfolioUploading && (portfolioCategory === 'credentials' || portfolioCategory === 'certification') ? (
                    <>
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-xs font-medium">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">📄</span>
                      <span className="text-xs font-medium">Upload credential photos</span>
                    </>
                  )}
                </button>

                {/* Credential photos */}
                {portfolioPhotos.filter(p => p.category === 'credentials' || p.category === 'certification').length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {portfolioPhotos.map((photo, i) => (photo.category === 'credentials' || photo.category === 'certification') && (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-white/20 bg-white/5">
                        <img src={photo.url} alt={photo.caption || 'Credential'} className="w-full h-20 object-cover" />
                        <button type="button" onClick={() => removePortfolioPhoto(i)} className="absolute top-1 right-1 p-0.5 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                          <p className="text-white text-[9px] truncate">{photo.caption || photo.category.replace('_', ' ')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Section 2: Work Sample ── */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🧹</span>
                  <div>
                    <h4 className="text-[#4B244A] dark:text-white font-bold text-sm">Work Sample</h4>
                    <p className="text-[#4B244A]/50 dark:text-white/50 text-xs">Photos of your cleaning work, results, etc.</p>
                  </div>
                </div>

                {/* Caption for work */}
                <input
                  type="text"
                  value={portfolioCategory === 'work_sample' ? portfolioCaption : ''}
                  onChange={e => { setPortfolioCaption(e.target.value); }}
                  onFocus={() => { if (portfolioCategory !== 'work_sample') setPortfolioCategory('work_sample'); }}
                  placeholder="E.g. Kitchen deep clean result"
                  className={`${inputClass} !py-2 text-sm`}
                  maxLength={255}
                />

                {/* Upload for work sample */}
                <button
                  type="button"
                  onClick={() => { setPortfolioCategory('work_sample'); portfolioFileRef.current?.click(); }}
                  disabled={portfolioUploading}
                  className={`w-full py-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                    portfolioUploading
                      ? 'border-white/20 text-[#4B244A]/40 dark:text-white/40 cursor-wait'
                      : 'border-teal-300/40 dark:border-teal-500/30 text-[#4B244A]/60 dark:text-white/60 hover:border-teal-400 hover:text-teal-500'
                  }`}
                >
                  {portfolioUploading && portfolioCategory === 'work_sample' ? (
                    <>
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-xs font-medium">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🧹</span>
                      <span className="text-xs font-medium">Upload work photos</span>
                    </>
                  )}
                </button>

                {/* Work photos */}
                {portfolioPhotos.filter(p => p.category === 'work_sample').length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {portfolioPhotos.map((photo, i) => photo.category === 'work_sample' && (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-white/20 bg-white/5">
                        <img src={photo.url} alt={photo.caption || 'Work'} className="w-full h-20 object-cover" />
                        <button type="button" onClick={() => removePortfolioPhoto(i)} className="absolute top-1 right-1 p-0.5 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                          <p className="text-white text-[9px] truncate">{photo.caption || 'work sample'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hidden file input shared by both sections */}
              <input
                ref={portfolioFileRef}
                type="file"
                onChange={handlePortfolioFile}
                accept="image/*"
                multiple
                className="hidden"
              />

              {portfolioError && <p className="text-red-300 text-sm">{portfolioError}</p>}

              {portfolioPhotos.length > 0 && (
                <p className="text-[#4B244A]/50 dark:text-white/50 text-xs text-center">
                  {portfolioPhotos.length}/20 photos uploaded
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(3)} className="flex-1 py-3 !bg-black/30 !text-white dark:text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="flex-1 py-3 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg"
                >
                  {portfolioPhotos.length === 0 ? 'Skip & Continue →' : 'Next →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Phone OTP ── */}
          {step === 5 && (
            <div className="space-y-5">
              {phoneVerified ? (
                // Phone already verified — show submit button
                <div className="space-y-5">
                  <div className="p-5 bg-green-200/0 border border-green-500/40 rounded-2xl text-center">
                    <CheckCircle2 className="mx-auto mb-2 text-green-400" size={32} />
                    <p className="text-green-500 font-bold text-lg">Phone Verified!</p>
                    <p className="text-green-400 text-sm mt-1">{user.phone_number}</p>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(4)} className="flex-1 py-3 !bg-black/30 !text-white dark:text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20">
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 py-3 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg disabled:opacity-50"
                    >
                      {submitting ? 'Submitting…' : 'Submit Application'}
                    </button>
                  </div>
                </div>
              ) : (
                // OTP verification flow
              <div className="space-y-5">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-500 text-sm font-semibold mb-1">Verify Your Phone Number</p>
                <p className="text-blue-400/80 dark:text-blue-200/70 text-xs">
                  We'll send a one-time code to <strong className="text-[#4B244A] dark:text-white font-semibold">{user.phone_number}</strong>. This verifies that you're the owner of this number.
                </p>
              </div>

                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      className="w-full py-3.5 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg disabled:opacity-50"
                    >
                      {sendingOtp ? 'Sending…' : `Send OTP to ${user.phone_number}`}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-center text-[#4B244A]/70 dark:text-white/70 text-sm">Enter the 6-digit code sent to <strong className="text-[#4B244A] dark:text-white font-semibold">{user.phone_number}</strong></p>

                      {/* 6-digit input */}
                      <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            ref={el => { otpRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 bg-white/10 text-[#4B244A] dark:text-white focus:outline-none transition-all ${
                              digit ? 'border-[#EA526F] bg-[#EA526F]/20' : 'border-[#EA526F]/30 focus:border-[#EA526F]'
                            }`}
                          />
                        ))}
                      </div>

                      {devOtp && (
                        <div className="p-2 bg-yellow-500/20 border border-yellow-500/40 rounded-lg text-center">
                          <p className="text-yellow-500 text-xs">SMS not configured — Dev OTP: <strong className="font-mono text-base">{devOtp}</strong></p>
                        </div>
                      )}

                      {otpError && <p className="text-center text-red-300 text-sm">{otpError}</p>}

                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otp.join('').length < 6}
                        className="w-full py-3.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg disabled:opacity-50"
                      >
                        {verifyingOtp ? 'Verifying…' : 'Verify Code'}
                      </button>

                      {/* Resend */}
                      <div className="text-center">
                        {countdown > 0 ? (
                          <p className="text-[#4B244A]/40 dark:text-white/40 text-sm">Resend in {countdown}s</p>
                        ) : (
                          <button type="button" onClick={handleSendOtp} disabled={sendingOtp} className="text-[#EA526F] text-sm font-medium hover:underline disabled:opacity-50">
                            Resend code
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {otpError && !otpSent && <p className="text-red-300 text-sm text-center">{otpError}</p>}

                  <button type="button" onClick={() => setStep(4)} className="w-full py-3 !bg-black/30 !text-white dark:text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20">
                    ← Back
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
