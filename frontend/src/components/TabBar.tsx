import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';

interface TabBarProps {
  role: 'owner' | 'housekeeper';
}

export default function TabBar({ role }: TabBarProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/messages/unread-count');
        setUnreadCount(response.data.unread_count || 0);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    // Fetch initially
    fetchUnreadCount();

    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/10 backdrop-blur-xl border-t border-white/20 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-around h-16">
          {/* Home Tab */}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-all ${
                isActive ? 'text-[#EA526F]' : 'text-white/70 hover:text-white'
              }`
            }
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Home</span>
          </NavLink>

          {/* Jobs Tab */}
          <NavLink
            to="/jobs"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-all ${
                isActive ? 'text-[#EA526F]' : 'text-white/70 hover:text-white'
              }`
            }
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">
              {role === 'owner' ? 'My Jobs' : 'Find Jobs'}
            </span>
          </NavLink>

          {/* Messages Tab */}
          <NavLink
            to="/messages"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-all relative ${
                isActive ? 'text-[#EA526F]' : 'text-white/70 hover:text-white'
              }`
            }
          >
            <div className="relative">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-[#EA526F] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">Messages</span>
          </NavLink>

          {/* Profile Tab */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-full transition-all ${
                isActive ? 'text-[#EA526F]' : 'text-white/70 hover:text-white'
              }`
            }
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium">Profile</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
