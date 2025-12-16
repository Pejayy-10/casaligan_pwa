import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import ConversationList from '../components/ConversationList';
import type { User } from '../types';

export default function MessagesPage() {
  const navigate = useNavigate();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [conversationCount, setConversationCount] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null;

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
          <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white">💬 Messages</h1>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4 p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-white/10 w-fit">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-[#4B244A] text-[#4B244A] dark:text-white shadow-md'
                  : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'archived'
                  ? 'bg-white dark:bg-[#4B244A] text-[#4B244A] dark:text-white shadow-md'
                  : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              Archived
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-4 border border-white/50 dark:border-white/10 shadow-xl min-h-[60vh]">
          <ConversationList 
            filter={activeTab} 
            onConversationCountChange={setConversationCount}
          />
        </div>
        
        {conversationCount > 0 && (
          <p className="text-[#4B244A]/50 dark:text-white/50 text-sm text-center mt-4 font-medium">
            {conversationCount} conversation{conversationCount !== 1 ? 's' : ''}
          </p>
        )}
      </main>

      <TabBar role={user.active_role} />
    </div>
  );
}