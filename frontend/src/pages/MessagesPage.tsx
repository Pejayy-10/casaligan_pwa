import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Archive, MessageSquare, Loader2} from 'lucide-react';
import TabBar from '../components/TabBar';
import ConversationList from '../components/ConversationList';
import type { User } from '../types';

export default function MessagesPage() {
  const navigate = useNavigate();
  
  // Initialize user from local storage
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [conversationCount, setConversationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Auth check
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Trigger loading state when tab changes
  useEffect(() => {
    setIsLoading(true);
  }, [activeTab]);

  // Callback to handle data load completion
  const handleConversationCountChange = (count: number) => {
    setConversationCount(count);
    setIsLoading(false);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300 pb-20 relative">
      
      <header className="sticky top-0 z-50 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all pt-14 md:pt-4">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#4B244A]/5 dark:bg-white/10 rounded-xl">
                            <MessageCircle className="w-6 h-6 text-[#4B244A] dark:text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white tracking-tight">
                            Messages
                        </h1>
                    </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-200/50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-white/10">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  activeTab === 'active'
                    ? 'bg-[#EA526F] text-white shadow-md' 
                    : 'text-gray-500 dark:text-white/60 hover:bg-[#EA526F]/10 hover:text-[#EA526F] dark:hover:text-white'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Active</span>
              </button>
              
              <button
                onClick={() => setActiveTab('archived')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                  activeTab === 'archived'
                    ? 'bg-[#EA526F] text-white shadow-md' 
                    : 'text-gray-500 dark:text-white/60 hover:bg-[#EA526F]/10 hover:text-[#EA526F] dark:hover:text-white'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">Archived</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#EA526F] animate-spin mb-4" />
            <p className="text-gray-500 dark:text-white/60 font-medium animate-pulse">
              Messages loading...
            </p>
          </div>
        )}

        {/* Conversation List */}
        <div className={`${isLoading ? 'hidden' : 'block'}`}>
          <ConversationList 
            filter={activeTab} 
            onConversationCountChange={handleConversationCountChange}
          />
        </div>
        
        {/* Footer Count Text */}
        {!isLoading && conversationCount > 0 && (
          <div className="flex justify-center mt-6">
            <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-white/50 text-xs font-medium border border-gray-200 dark:border-white/10">
              {conversationCount} {activeTab} conversation{conversationCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Empty State Fallback */}
        {!isLoading && conversationCount === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <div className="w-16 h-16 bg-[#EA526F]/10 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#EA526F]" />
            </div>
            <p className="text-gray-500 dark:text-white font-medium">No messages found</p>
          </div>
        )}
      </main>

      <TabBar role={user.active_role} />
    </div>
  );
}