import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Briefcase } from 'lucide-react';
import DirectHiresList from '../components/DirectHiresList';
import { type User } from '../types';

export default function DirectHiresPage() {
  const navigate = useNavigate();

  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F4F2F0] dark:bg-slate-950 transition-colors duration-300 pb-24 relative font-sans">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all shadow-sm pt-14 md:pt-4">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#4B244A] dark:text-white font-bold text-sm"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white tracking-tight flex items-center gap-2">
            {user?.active_role === 'owner' ? (
              <><ClipboardList className="w-6 h-6" /> My Direct Bookings</>
            ) : (
              <><Briefcase className="w-6 h-6" /> Direct Hire Jobs</>
            )}
          </h1>
          {/* placeholder to balance flex */}
          <div className="w-12" />
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <DirectHiresList role={user.active_role as 'owner' | 'housekeeper'} />
      </main>
    </div>
  );
}
