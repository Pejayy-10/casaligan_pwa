import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import TabBar from '../components/TabBar';

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'housekeeper'>('owner');
  const navigate = useNavigate();

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const getToken = () => localStorage.getItem('access_token');

  useEffect(() => {
    // Get user role
    const role = localStorage.getItem('user_role') as 'owner' | 'housekeeper' | null;
    if (role) setUserRole(role);

    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    const token = getToken();
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const token = getToken();
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/mark-all-read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    const token = getToken();
    if (!token) return;

    try {
      await fetch(`${API_BASE}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.filter((n) => n.notification_id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.notification_id);
    }

    if (notification.reference_type && notification.reference_id) {
      switch (notification.reference_type) {
        case 'job':
          navigate(`/jobs`);
          break;
        case 'chat':
          navigate(`/chat/${notification.reference_id}`);
          break;
        case 'contract':
          navigate(`/dashboard`);
          break;
        default:
          break;
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-[#E7467B] dark:text-[#EA526F]" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Notifications
              </h1>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-[#E7467B] dark:text-[#EA526F] hover:text-gray-700 dark:hover:text-white transition-colors font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E7467B] dark:border-[#EA526F] mx-auto"></div>
            <p className="text-gray-600 dark:text-white/70 mt-4">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 dark:text-white/30 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-white/70">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.notification_id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-4 rounded-lg transition-all cursor-pointer border ${
                  notification.is_read
                    ? 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10'
                    : 'bg-blue-50 dark:bg-white/15 border-blue-200 dark:border-white/30 hover:bg-blue-100 dark:hover:bg-white/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#E7467B] dark:bg-[#EA526F] flex-shrink-0"></span>
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-white/70 text-sm line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-gray-500 dark:text-white/50 text-xs mt-2">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {notification.is_read ? (
                      <CheckCheck className="w-4 h-4 text-gray-400 dark:text-white/50" />
                    ) : (
                      <Check className="w-4 h-4 text-[#E7467B] dark:text-[#EA526F]" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.notification_id);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded transition-colors"
                      aria-label="Delete notification"
                    >
                      <X className="w-4 h-4 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TabBar role={userRole} />
    </div>
  );
}
