import { useState, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface User {
  id: number;
  active_role: 'owner' | 'housekeeper';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  workers?: WorkerCard[];
  jobs?: JobCard[];
}

interface WorkerCard {
  worker_id: number;
  user_id: number;
  name: string;
  gender: string | null;
  location: string;
  avg_rating: number;
  total_ratings: number;
  skills: string[];
  packages: Array<{ name: string; price: number }>;
}

interface JobCard {
  post_id: number;
  title: string;
  description: string;
  location: string;
  budget: number;
  house_type: string;
  cleaning_type: string;
  job_type: string;
  categories: string[];
  employer_name: string;
  is_recurring: boolean;
  schedule: string | null;
}

export default function AIChatModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Get user role from localStorage
  const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) as User : null;
  const userRole = user?.active_role || 'owner';

  const initialMessage = userRole === 'owner'
    ? "👋 Looking for a housekeeper? Describe the ideal person for you, and I'll find the best matches!"
    : "👋 Looking for a job? Tell me what kind of work you prefer, and I'll find the perfect opportunities for you!";

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([...newMessages, {
          role: 'assistant',
          content: data.message,
          workers: data.workers || [],
          jobs: data.jobs || []
        }]);
      } else {
        setMessages([...newMessages, {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting. Please try again."
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, {
        role: 'assistant',
        content: "Sorry, something went wrong. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white rounded-full p-4 shadow-2xl hover:shadow-xl transition-all hover:scale-110 group"
        title="AI Assistant"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  return (
    <div className="fixed z-50
      bottom-20 left-3 right-3
      md:bottom-8 md:left-auto md:right-8 md:w-[380px]
      h-[460px] md:h-[520px] max-h-[75vh]
      bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-white/10"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6" />
          <div>
            <h3 className="font-bold">AI Assistant</h3>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-white/20 rounded-lg p-1 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Initial message */}
        {messages.length === 0 && (
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-pink-200 dark:border-pink-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">{initialMessage}</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx}>
            {/* Message bubble */}
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl p-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>

            {/* Worker cards */}
            {msg.workers && msg.workers.length > 0 && (
              <div className="mt-3 space-y-2">
                {msg.workers.map((worker) => (
                  <div
                    key={worker.worker_id}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => window.location.href = `/worker/${worker.worker_id}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#4B244A] dark:text-white">{worker.name}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">📍 {worker.location}</p>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-500">
                        <span className="text-sm font-bold">★ {worker.avg_rating.toFixed(1)}</span>
                        <span className="text-xs text-gray-500">({worker.total_ratings})</span>
                      </div>
                    </div>
                    {worker.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {worker.skills.slice(0, 3).map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Job cards */}
            {msg.jobs && msg.jobs.length > 0 && (
              <div className="mt-3 space-y-2">
                {msg.jobs.map((job) => (
                  <div
                    key={job.post_id}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => window.location.href = `/jobs?post_id=${job.post_id}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-[#4B244A] dark:text-white">{job.title}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">by {job.employer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-green-600 dark:text-green-400">₱{job.budget.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">{job.job_type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{job.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">📍 {job.location}</span>
                      {job.is_recurring && job.schedule && (
                        <span className="text-purple-600 dark:text-purple-400">🔄 {job.schedule}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-white/20 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white p-2 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
