import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Check, CheckCheck } from 'lucide-react';

interface Notification {
  notification_id: number;
  type: string;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: number | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  onNavigate?: (referenceType: string, referenceId: number) => void;
}

export default function NotificationBell({ onNavigate }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Get token fresh each time to ensure we have the latest
  const getToken = () => localStorage.getItem('access_token');

  // Fetch notifications
  const fetchNotifications = async () => {
    const token = getToken();
    console.log('fetchNotifications called, token exists:', !!token);
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    const token = getToken();
    console.log('fetchUnreadCount called, token exists:', !!token);
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/notifications/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('fetchUnreadCount response:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Mark single notification as read
  const markAsRead = async (notificationId: number) => {
    const token = getToken();
    if (!token) return;
    
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev => 
        prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const token = getToken();
    if (!token) return;
    
    setLoading(true);
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
    setLoading(false);
  };

  // Delete notification
  const deleteNotification = async (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = getToken();
    if (!token) return;
    
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const notif = notifications.find(n => n.notification_id === notificationId);
      if (notif && !notif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.notification_id);
    }
    
    if (onNavigate && notification.reference_type && notification.reference_id) {
      onNavigate(notification.reference_type, notification.reference_id);
      setIsOpen(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the button and the dropdown
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Fetch on mount and poll every 30 seconds
  useEffect(() => {
    console.log('NotificationBell mounted, fetching...');
    fetchUnreadCount();
    fetchNotifications();
    
    const interval = setInterval(() => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    }, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen) {
      console.log('Dropdown opened, fetching notifications...');
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Format time ago
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Get icon color based on notification type
  const getTypeColor = (type: string) => {
    if (type.includes('ACCEPTED') || type.includes('APPROVED') || type.includes('CONFIRMED')) {
      return 'text-green-500';
    }
    if (type.includes('REJECTED') || type.includes('CANCELLED')) {
      return 'text-red-500';
    }
    if (type.includes('PAYMENT')) {
      return 'text-yellow-500';
    }
    return 'text-blue-500';
  };

  // Calculate dropdown position when opening
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
    setIsOpen(!isOpen);
  };

   // Dropdown content to be rendered in portal
  const dropdownContent = isOpen ? (
    <div 
      ref={dropdownRef}
      className="fixed w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-h-[80vh] flex flex-col backdrop-blur-xl transition-all"
      style={{ 
        top: dropdownPosition.top, 
        right: dropdownPosition.right,
        zIndex: 999999 
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-t-2xl">
        <h3 className="font-bold text-[#4B244A] dark:text-white">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={loading}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 font-semibold"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500 dark:text-white/50">
            <Bell size={40} className="mx-auto mb-2 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.notification_id}
              onClick={() => handleNotificationClick(notification)}
              className={`px-4 py-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                !notification.is_read ? 'bg-blue-50 dark:bg-blue-500/10' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Indicator dot */}
                <div className="mt-1.5">
                  {!notification.is_read ? (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  ) : (
                    <div className="w-2.5 h-2.5 bg-gray-300 dark:bg-white/20 rounded-full" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${getTypeColor(notification.type)}`}>
                    {notification.title}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-white/70 mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-1 font-medium">
                    {timeAgo(notification.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!notification.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.notification_id);
                      }}
                      className="p-1.5 text-gray-400 dark:text-white/40 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={(e) => deleteNotification(notification.notification_id, e)}
                    className="p-1.5 text-gray-400 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-white/50 text-center font-medium">
            Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative p-2 text-[#4B244A] dark:text-white hover:bg-[#4B244A]/10 dark:hover:bg-white/10 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1 shadow-sm border border-white dark:border-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown rendered via Portal to escape z-index stacking context */}
      {createPortal(dropdownContent, document.body)}
    </div>
  );
}