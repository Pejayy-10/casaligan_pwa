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
    <div className="min-h-screen bg-gradient-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] pb-20">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">💬 Messages</h1>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-white text-[#4B244A]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'archived'
                  ? 'bg-white text-[#4B244A]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Archived
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-4 border border-white/20">
          <ConversationList 
            filter={activeTab} 
            onConversationCountChange={setConversationCount}
          />
        </div>
        
        {conversationCount > 0 && (
          <p className="text-white/50 text-sm text-center mt-4">
            {conversationCount} conversation{conversationCount !== 1 ? 's' : ''}
          </p>
        )}
      </main>

      <TabBar role={user.active_role} />
    </div>
  );
}
