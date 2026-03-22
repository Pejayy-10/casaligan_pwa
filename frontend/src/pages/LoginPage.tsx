import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, Lock } from 'lucide-react';
import logoUrl from '/logo.png';

type ForgotStep = 'email' | 'otp' | 'newPassword';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login(formData);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Login failed'
        : 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForgotState = () => {
    setShowForgot(false);
    setForgotStep('email');
    setForgotEmail('');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    try {
      await authService.forgotPassword(forgotEmail.trim());
      setForgotStep('otp');
      setForgotSuccess('A reset code has been sent to your email.');
    } catch (err: unknown) {
      const msg = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to send reset code.'
        : 'Failed to send reset code. Please try again.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotOtp.trim()) {
      setForgotError('Please enter the reset code.');
      return;
    }
    setForgotSuccess('');
    setForgotStep('newPassword');
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (forgotNewPassword.length < 6) {
      setForgotError('Password must be at least 6 characters.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    try {
      const result = await authService.resetPassword(forgotEmail.trim(), forgotOtp.trim(), forgotNewPassword);
      setForgotSuccess(result.message);
      setTimeout(() => resetForgotState(), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to reset password.'
        : 'Failed to reset password. Please try again.';
      setForgotError(msg);
    } finally {
      setForgotLoading(false);
    }
  };

   return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#EA526F]/20 dark:bg-[#EA526F]/30 rounded-full blur-[100px] animate-blob will-change-transform"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] bg-teal-400/20 dark:bg-teal-500/20 rounded-full blur-[100px] animate-blob animation-delay-4000 will-change-transform"></div>
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-purple-400/15 dark:bg-purple-600/20 rounded-full blur-[80px] animate-blob animation-delay-2000 will-change-transform"></div>
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-yellow-200/20 dark:bg-amber-500/10 rounded-full blur-[90px] animate-blob animation-delay-6000 will-change-transform"></div>
    </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo (outside of card) */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <img src={logoUrl} alt="Casaligan Logo" className="w-60 h-20 md:w-56 md:h-56 object-contain" />
          </div>
        </div>

        {/* Glass morphism card */}
        <div className="bg-white/60 dark:bg-slate-950/20 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-10 border border-white/50 dark:border-white/10 transition-all">
          {/* Title */}
          <div className="text-center mb-6">
            <p className="text-[#4B244A] dark:text-white/90 text-lg font-bold">Welcome back!</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-500/20 backdrop-blur-sm border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-white text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none"
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 pr-12 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/50 hover:text-[#4B244A] dark:hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm text-[#4B244A]/70 dark:text-white/80 hover:text-[#EA526F] dark:hover:text-[#EA526F] transition-colors font-medium"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[#4B244A]/80 dark:text-white/80 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#EA526F] hover:text-[#d4486a] font-bold transition-colors">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link to="/" className="text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white text-sm transition-colors font-medium">
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/50 dark:border-white/10 relative">
            {/* Close / Back */}
            <button
              type="button"
              onClick={forgotStep === 'email' ? resetForgotState : () => {
                setForgotError('');
                setForgotSuccess('');
                if (forgotStep === 'newPassword') setForgotStep('otp');
                else if (forgotStep === 'otp') setForgotStep('email');
              }}
              className="absolute top-4 left-4 p-2 text-[#4B244A]/60 dark:text-white/60 hover:text-[#EA526F] transition-colors rounded-xl hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Step indicator */}
            <div className="flex justify-center gap-2 mb-6 mt-2">
              {(['email', 'otp', 'newPassword'] as ForgotStep[]).map((step, i) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all ${
                    i <= ['email', 'otp', 'newPassword'].indexOf(forgotStep)
                      ? 'w-8 bg-[#EA526F]'
                      : 'w-8 bg-gray-200 dark:bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Step: Email */}
            {forgotStep === 'email' && (
              <form onSubmit={handleForgotSendOtp} className="space-y-5">
                <div className="text-center mb-2">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#EA526F]/10 rounded-2xl flex items-center justify-center">
                    <Mail className="w-8 h-8 text-[#EA526F]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">Forgot Password?</h2>
                  <p className="text-sm text-[#4B244A]/60 dark:text-white/60 mt-1">Enter your email to receive a reset code</p>
                </div>

                {forgotError && (
                  <div className="p-3 bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-white text-sm">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2">Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none"
                    placeholder="Enter your email"
                    required
                    disabled={forgotLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30"
                >
                  {forgotLoading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>
            )}

            {/* Step: OTP */}
            {forgotStep === 'otp' && (
              <form onSubmit={handleForgotVerifyOtp} className="space-y-5">
                <div className="text-center mb-2">
                  <div className="w-16 h-16 mx-auto mb-4 !bg-[#EA526F]/10 rounded-2xl flex items-center justify-center">
                    <KeyRound className="w-8 h-8 text-[#EA526F]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">Enter Reset Code</h2>
                  <p className="text-sm text-[#4B244A]/60 dark:text-white/60 mt-1">
                    Check your email <span className="font-semibold text-[#EA526F]">{forgotEmail}</span>
                  </p>
                </div>

                {forgotSuccess && (
                  <div className="p-3 bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-xl text-green-700 dark:text-green-300 text-sm">
                    {forgotSuccess}
                  </div>
                )}
                {forgotError && (
                  <div className="p-3 bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-white text-sm">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2">6-Digit Code</label>
                  <input
                    type="text"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="------"
                    maxLength={6}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] active:scale-95 transition-all shadow-lg shadow-[#EA526F]/30"
                >
                  Verify Code
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setForgotError('');
                    setForgotLoading(true);
                    try {
                      await authService.forgotPassword(forgotEmail.trim());
                      setForgotSuccess('A new reset code has been sent.');
                    } catch {
                      setForgotError('Failed to resend. Please try again.');
                    } finally {
                      setForgotLoading(false);
                    }
                  }}
                  disabled={forgotLoading}
                  className="w-full text-sm text-[#4B244A]/70 dark:text-white/70 hover:text-[#EA526F] transition-colors font-medium disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending...' : "Didn't receive a code? Resend"}
                </button>
              </form>
            )}

            {/* Step: New Password */}
            {forgotStep === 'newPassword' && (
              <form onSubmit={handleForgotResetPassword} className="space-y-5">
                <div className="text-center mb-2">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#EA526F]/10 rounded-2xl flex items-center justify-center">
                    <Lock className="w-8 h-8 text-[#EA526F]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">Set New Password</h2>
                  <p className="text-sm text-[#4B244A]/60 dark:text-white/60 mt-1">Choose a strong password</p>
                </div>

                {forgotError && (
                  <div className="p-3 bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-white text-sm">
                    {forgotError}
                  </div>
                )}
                {forgotSuccess && (
                  <div className="p-3 bg-green-100 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-xl text-green-700 dark:text-green-300 text-sm">
                    {forgotSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none"
                      placeholder="At least 6 characters"
                      required
                      disabled={forgotLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/50 hover:text-[#4B244A] dark:hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none"
                      placeholder="Re-enter your password"
                      required
                      disabled={forgotLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/50 hover:text-[#4B244A] dark:hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30"
                >
                  {forgotLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}