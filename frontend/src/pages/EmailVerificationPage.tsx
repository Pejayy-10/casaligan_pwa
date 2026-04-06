import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Mail, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';

export default function EmailVerificationPage() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [devOtp, setDevOtp] = useState(''); // Only shown if SMTP not configured
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Read the user's email from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        setUserEmail(u.email || '');
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Auto-send OTP when the page first loads (only if not already verified)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.email_verified === true) {
          navigate('/dashboard');
          return;
        }
      }
    } catch { /* ignore */ }
    sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const sendOtp = async () => {
    setSending(true);
    setError('');
    setDevOtp('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/auth/send-email-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.detail?.includes('already verified')) {
          // Already verified — just go to dashboard
          navigate('/dashboard');
          return;
        }
        setError(data.detail || 'Failed to send verification code.');
      } else {
        setResendCooldown(60);
        if (data.dev_otp) {
          setDevOtp(data.dev_otp);
        }
      }
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDigitChange = (idx: number, val: string) => {
    // Only allow single digits
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError('');

    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits];
        next[idx] = '';
        setDigits(next);
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = text[i] || '';
    }
    setDigits(next);
    // Focus last filled or next empty
    const focusIdx = Math.min(text.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length < 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/auth/verify-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update localStorage immediately so ProtectedRoute doesn't re-redirect
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const u = JSON.parse(userStr);
            u.email_verified = true;
            localStorage.setItem('user', JSON.stringify(u));
          }
        } catch { /* ignore */ }
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 1800);
      } else {
        setError(data.detail || 'Verification failed. Please try again.');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setSkipLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/auth/skip-email-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const u = JSON.parse(userStr);
            u.email_verified = true;
            localStorage.setItem('user', JSON.stringify(u));
          }
        } catch { /* ignore */ }
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 1800);
      } else {
        setError(data.detail || 'Skip failed. Please try again.');
      }
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setSkipLoading(false);
    }
  };

  const obscureEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
  };

  const isComplete = digits.every((d) => d !== '');

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-64 h-64 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
        </div>
        <div className="relative z-10 text-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl p-10 border border-white/50 dark:border-white/10 max-w-sm w-full">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">Email Verified!</h2>
          <p className="text-[#4B244A]/70 dark:text-white/60 mb-1">Your account is all set.</p>
          <p className="text-sm text-[#4B244A]/50 dark:text-white/40">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  // ── Main OTP screen ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none fixed">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-4000" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-400 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-6000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/50 dark:border-white/10">

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-[#EA526F] to-[#4B244A] rounded-2xl flex items-center justify-center shadow-lg shadow-[#EA526F]/30">
              <Mail className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-[#4B244A] dark:text-white mb-2">
            Verify your email
          </h1>
          <p className="text-center text-[#4B244A]/70 dark:text-white/60 text-sm mb-1">
            We sent a 6-digit code to
          </p>
          <p className="text-center font-semibold text-[#4B244A] dark:text-white text-sm mb-6">
            {obscureEmail(userEmail)}
          </p>

          {/* Dev OTP hint (only if SMTP not configured) */}
          {devOtp && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl text-center">
              <p className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                ⚙️ Dev mode — SMTP not configured. Your code is: <strong>{devOtp}</strong>
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-white text-sm text-center">
              {error}
            </div>
          )}

          {/* 6-digit OTP inputs */}
          <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
            {digits.map((d, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
                  bg-white/50 dark:bg-white/10
                  text-[#4B244A] dark:text-white
                  ${d
                    ? 'border-[#EA526F] ring-2 ring-[#EA526F]/30'
                    : 'border-gray-300 dark:border-white/20 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20'
                  }
                `}
                disabled={loading}
              />
            ))}
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={!isComplete || loading}
            className="w-full py-3.5 bg-gradient-to-r from-[#EA526F] to-[#d4486a] !text-white font-bold rounded-xl transition-all shadow-lg shadow-[#EA526F]/30 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                Verify & Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Resend */}
          <div className="mt-5 text-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-[#4B244A]/50 dark:text-white/40">
                Resend code in <span className="font-semibold text-[#EA526F]">{resendCooldown}s</span>
              </p>
            ) : (
              <button
                onClick={sendOtp}
                disabled={sending}
                className="text-sm text-[#EA526F] font-semibold hover:underline disabled:opacity-50 flex items-center gap-1 mx-auto"
              >
                {sending ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> Sending…</>
                ) : (
                  'Resend code'
                )}
              </button>
            )}
          </div>

          {/* Testing-only skip button */}
          <div className="mt-4 pt-4 border-t border-dashed border-gray-300 dark:border-white/10">
            <p className="text-center text-xs text-gray-400 dark:text-white/30 mb-2 font-medium">
              ⚙️ Testing only
            </p>
            <button
              onClick={handleSkip}
              disabled={skipLoading}
              className="w-full py-2 rounded-xl text-xs font-bold border border-dashed border-gray-300 dark:border-white/20 text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-white/60 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {skipLoading ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /> Skipping…</>
              ) : (
                'Skip Email Verification'
              )}
            </button>
          </div>

          {/* Step indicator */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#4B244A]/60 dark:text-white/40">Almost done!</span>
              <span className="text-xs text-[#4B244A]/60 dark:text-white/40">Final step</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-1.5 bg-[#EA526F] rounded-full" />
              <div className="flex-1 h-1.5 bg-[#EA526F] rounded-full" />
              <div className="flex-1 h-1.5 bg-[#EA526F] rounded-full" />
              <div className="flex-1 h-1.5 bg-[#EA526F]/40 rounded-full" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
