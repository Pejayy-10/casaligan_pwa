import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { Eye, EyeOff, Check, X } from 'lucide-react';
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
    gender: undefined,
    relationship_status: undefined,
    birthday: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone_number?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isGmail = (email: string) => /^[^\s@]+@gmail\.com$/i.test(email.trim());
  const formatPhilippinePhone = (digits: string) => {
    const onlyDigits = digits.replace(/\D/g, '').slice(0, 10);
    const part1 = onlyDigits.slice(0, 3);
    const part2 = onlyDigits.slice(3, 6);
    const part3 = onlyDigits.slice(6, 10);
    return [part1, part2, part3].filter(Boolean).join(' ');
  };

  const isPhilippinePhone = (phone: string) => {
    const raw = phone.replace(/\D/g, '').trim();
    return /^\d{10}$/.test(raw);
  };
  const getPhoneError = (phone: string) => {
    const raw = phone.replace(/\D/g, '').trim();
    if (!raw) return 'Phone number is required';
    if (raw.length !== 10) return 'Enter 10 digits after +63 (e.g. 912 345 6789)';
    return 'Enter 10 digits after +63 (e.g. 912 345 6789)';
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Strong password validation
    if (formData.password.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one number');
      return;
    }

    // Birthday validation - must be at least 18 years old
    if (!formData.birthday) {
      setError('Date of birth is required');
      return;
    }
    const bday = new Date(formData.birthday);
    const today = new Date();
    let age = today.getFullYear() - bday.getFullYear();
    const m = today.getMonth() - bday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) age--;
    if (age < 18) {
      setError('You must be at least 18 years old to register');
      return;
    }

    const errors: { email?: string; phone_number?: string } = {};
    if (!isGmail(formData.email)) {
      errors.email = 'Only Gmail addresses are allowed (e.g. yourname@gmail.com)';
    }
    if (!isPhilippinePhone(formData.phone_number)) {
      errors.phone_number = getPhoneError(formData.phone_number);
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please fix the fields below.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        phone_number: formData.phone_number ? `+63${formData.phone_number}` : formData.phone_number,
        middle_name: formData.middle_name?.trim() || undefined,
        suffix: formData.suffix?.trim() || undefined,
        birthday: formData.birthday || undefined,
      };
      await authService.register(payload);
      
      // Navigate to address step
      navigate('/register/address');
    } catch (err: unknown) {
      const axioErr = err as { response?: { status?: number; data?: { detail?: string | Array<{ loc?: string[]; msg?: string }> } } };
      const detail = axioErr.response?.data?.detail;
      if (Array.isArray(detail)) {
        const errors: { email?: string; phone_number?: string } = {};
        for (const item of detail) {
          const loc = item.loc?.join('.') ?? '';
          const msg = item.msg ?? '';
          if (loc.includes('email')) errors.email = msg;
          else if (loc.includes('phone')) errors.phone_number = msg;
        }
        setFieldErrors(errors);
        setError('Please fix the fields below.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Registration failed. Please try again.');
      }
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
                  Middle Name (optional)
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
                  Suffix (optional, e.g. Jr., Sr., III)
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
              <label htmlFor="gender" className={labelClass}>
                Gender
              </label>
              <select
                id="gender"
                value={formData.gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as RegisterData['gender'] })}
                className={inputClass}
                disabled={loading}
              >
                <option value="">Select gender (optional)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label htmlFor="relationship_status" className={labelClass}>
                Relationship Status
              </label>
              <select
                id="relationship_status"
                value={formData.relationship_status || ''}
                onChange={(e) => setFormData({ ...formData, relationship_status: e.target.value as RegisterData['relationship_status'] })}
                className={inputClass}
                disabled={loading}
              >
                <option value="">Select relationship status (optional)</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="in_a_relationship">In a relationship</option>
                <option value="widowed">Widowed</option>
                <option value="separated">Separated</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div>
              <label htmlFor="birthday" className={labelClass}>
                Date of Birth *
              </label>
              <input
                type="date"
                id="birthday"
                value={formData.birthday || ''}
                onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                className={inputClass}
                disabled={loading}
                required
              />
              <p className="mt-1 text-xs text-[#4B244A]/60 dark:text-white/60 font-medium">
                You must be at least 18 years old to register
              </p>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                Email *
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={`${inputClass} ${fieldErrors.email ? 'border-red-500 dark:border-red-400' : ''}`}
                placeholder="yourname@gmail.com"
                disabled={loading}
                required
              />
              <p className="mt-1 text-xs text-[#4B244A]/60 dark:text-white/60 font-medium">
                Only Gmail accounts allowed (e.g. yourname@gmail.com)
              </p>
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone_number" className={labelClass}>
                Phone Number *
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-700 dark:text-white/70 font-bold">+63</span>
                <input
                  type="tel"
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => {
                    const formatted = formatPhilippinePhone(e.target.value);
                    setFormData({ ...formData, phone_number: formatted });
                    if (fieldErrors.phone_number) setFieldErrors((prev) => ({ ...prev, phone_number: undefined }));
                  }}
                  placeholder="912 345 6789"
                  className={`${inputClass} pl-16 ${fieldErrors.phone_number ? 'border-red-500 dark:border-red-400' : ''}`}
                  disabled={loading}
                  required
                />
              </div>
              {fieldErrors.phone_number && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400 font-medium">{fieldErrors.phone_number}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`${inputClass} pr-12`}
                  placeholder="Minimum 12 characters"
                  disabled={loading}
                  required
                  minLength={12}
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
              {/* Password strength indicators */}
              {formData.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {formData.password.length >= 12 ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                    <span className={formData.password.length >= 12 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>At least 12 characters</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {/[A-Z]/.test(formData.password) ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                    <span className={/[A-Z]/.test(formData.password) ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>At least one uppercase letter</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {/[0-9]/.test(formData.password) ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-400" />}
                    <span className={/[0-9]/.test(formData.password) ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>At least one number</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm_password" className={labelClass}>
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirm_password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputClass} pr-12`}
                  placeholder="Re-enter password"
                  disabled={loading}
                  required
                  minLength={12}
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
              disabled={loading}
              className="w-full py-3.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30 mt-6"
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