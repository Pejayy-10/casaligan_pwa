import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth';
import type { RegisterData } from '../types';

export default function RegisterStep1Page() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    phone_number: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Register user - this now returns and stores the token automatically
      await authService.register(formData);
      
      // Navigate to address step
      navigate('/register/address');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error && 'response' in err 
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail 
        : 'Registration failed. Please try again.';
      setError(errorMessage || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Shared styles
  const inputClass = "w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none disabled:opacity-50";
  const labelClass = "block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2";

  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4 overflow-y-auto transition-colors duration-300 relative">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none fixed">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-2xl w-full relative z-10 my-8">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/50 dark:border-white/10 transition-all">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl md:text-3xl font-bold text-[#4B244A] dark:text-white">Create Account</h1>
              <div className="text-sm text-[#4B244A]/70 dark:text-white/70 font-medium">Step 1 of 3</div>
            </div>
            {/* Progress Bar */}
            <div className="flex gap-2">
              <div className="flex-1 h-2 bg-[#EA526F] rounded-full shadow-md shadow-[#EA526F]/30"></div>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-white/20 rounded-full"></div>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-white/20 rounded-full"></div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-500/20 backdrop-blur-sm border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-white text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className={labelClass}>
                  First Name *
                </label>
                <input
                  type="text"
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className={inputClass}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="middle_name" className={labelClass}>
                  Middle Name
                </label>
                <input
                  type="text"
                  id="middle_name"
                  value={formData.middle_name}
                  onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  className={inputClass}
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="last_name" className={labelClass}>
                  Last Name *
                </label>
                <input
                  type="text"
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className={inputClass}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="suffix" className={labelClass}>
                  Suffix (Jr., Sr., III)
                </label>
                <input
                  type="text"
                  id="suffix"
                  value={formData.suffix}
                  onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
                  className={inputClass}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Email *
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
                placeholder="email@example.com"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="phone_number" className={labelClass}>
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+639XXXXXXXXX"
                className={inputClass}
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Password *
              </label>
              <input
                type="password"
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={inputClass}
                placeholder="Minimum 8 characters"
                disabled={loading}
                required
                minLength={8}
              />
            </div>

            <div>
              <label htmlFor="confirm_password" className={labelClass}>
                Confirm Password *
              </label>
              <input
                type="password"
                id="confirm_password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter password"
                disabled={loading}
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30 mt-6"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Account...
                </div>
              ) : 'Continue to Address'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#4B244A]/80 dark:text-white/80 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-[#EA526F] hover:text-[#d4486a] font-bold transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}