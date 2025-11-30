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

  return (
    <div className="min-h-screen bg-linear-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] pb-20">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">💼 Apply as Housekeeper</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/20">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Become a Housekeeper</h2>
            <p className="text-white/80">
              Join our platform as a verified housekeeper. Your application will be reviewed and you'll be notified once approved.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-2">Requirements:</h3>
              <ul className="text-white/80 text-sm space-y-1">
                <li>✓ Valid ID document uploaded</li>
                <li>✓ Complete address information</li>
                <li>✓ Active account status</li>
              </ul>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-white font-semibold mb-2">
                Additional Information (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tell us about your experience, availability, or any other relevant information..."
                rows={5}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
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
              className="w-full px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all"
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
