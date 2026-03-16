import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Briefcase, ChevronDown } from 'lucide-react';
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
      <header className="relative z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all shadow-sm safe-area-top">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-4">
          <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white transition-colors active:scale-95"
          >
          <ChevronDown className="w-6 h-6 rotate-90" />
          </button>
          <h1 className="text-xl font-bold text-[#4B244A] dark:text-white tracking-tight">
            {user?.active_role === 'owner' ? (
              <> My Direct Bookings</>
            ) : (
              <>Direct Hire Jobs</>
            )}
          </h1>
          {/* placeholder to balance flex */}
          <div className="w-12" />
        </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto">
        <DirectHiresList role={user.active_role as 'owner' | 'housekeeper'} />
      </main>
    </div>
  );
}
