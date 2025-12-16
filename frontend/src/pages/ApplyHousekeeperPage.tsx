import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import TabBar from '../components/TabBar';
import type { User } from '../types';

export default function ApplyHousekeeperPage() {
  const navigate = useNavigate();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.applyHousekeeper(notes);
      alert('Application submitted successfully! We will review your application and notify you once approved.');
      navigate('/profile');
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to submit application. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

   // Shared styles
  const inputClass = "w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none";
  const labelClass = "block text-[#4B244A] dark:text-white font-bold mb-2";

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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white">💼 Apply as Housekeeper</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/50 dark:border-white/10 shadow-xl transition-all">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">Become a Housekeeper</h2>
            <p className="text-[#4B244A]/70 dark:text-white/80">
              Join our platform as a verified housekeeper. Your application will be reviewed and you'll be notified once approved.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 rounded-xl p-4">
                <p className="text-red-600 dark:text-red-200 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/50 rounded-xl p-4">
              <h3 className="text-blue-800 dark:text-blue-200 font-bold mb-2">Requirements:</h3>
              <ul className="text-blue-700 dark:text-blue-200/80 text-sm space-y-1 font-medium">
                <li>✓ Valid ID document uploaded</li>
                <li>✓ Complete address information</li>
                <li>✓ Active account status</li>
              </ul>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className={labelClass}>
                Additional Information (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tell us about your experience, availability, or any other relevant information..."
                rows={5}
                className={inputClass}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg shadow-[#EA526F]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="w-full px-6 py-3 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/10"
            >
              Cancel
            </button>
          </form>
        </div>
      </main>

      <TabBar role={user.active_role} />
    </div>
  );
}