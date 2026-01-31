import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import TabBar from '../components/TabBar';
import JobEditResponseModal from '../components/JobEditResponseModal';
import api from '../services/api';
import type { User } from '../types';

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
  const navigate = useNavigate();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [showJobEditModal, setShowJobEditModal] = useState<{
    jobId: number;
    jobTitle: string;
    message: string;
  } | null>(null);

  const fetchNotifications = async () => {
    try {
      const response = await api.get<Notification[]>('/notifications/');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [user, navigate]);

  const markAsRead = async (notificationId: number) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setMarkAllLoading(true);
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkAllLoading(false);
    }
  };

  const deleteNotification = async (
    notificationId: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${notificationId}`);
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

    if (
      notification.type === 'job_edited' &&
      notification.reference_type === 'job' &&
      notification.reference_id
    ) {
      setShowJobEditModal({
        jobId: notification.reference_id,
        jobTitle:
          notification.title
            .replace(' ⚠️', '')
            .replace('Job Post Updated', '')
            .trim() || 'Job',
        message: notification.message,
      });
      return;
    }

    if (notification.reference_type && notification.reference_id) {
      if (notification.reference_type === 'job' || notification.reference_type === 'direct_hire') {
        navigate('/jobs');
      } else if (notification.reference_type === 'conversation') {
        navigate(`/chat/${notification.reference_id}`);
      }
    }
  };

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

  const getTypeColor = (type: string) => {
    if (type === 'job_edited') return 'text-yellow-600 dark:text-yellow-400';
    if (
      type.includes('ACCEPTED') ||
      type.includes('APPROVED') ||
      type.includes('CONFIRMED')
    )
      return 'text-green-500';
    if (
      type.includes('REJECTED') ||
      type.includes('CANCELLED')
    )
      return 'text-red-500';
    if (type.includes('PAYMENT')) return 'text-yellow-500';
    return 'text-blue-500';
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 pb-20 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white">
              🔔 Notifications
            </h1>
            {notifications.some((n) => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                disabled={markAllLoading}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                <CheckCheck size={18} />
                Mark all read
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 shadow-xl min-h-[50vh] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#EA526F] border-t-transparent"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-16 text-center text-gray-500 dark:text-white/50">
              <Bell size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm mt-1">We&apos;ll notify you when something happens.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {notifications.map((notification) => (
                <li
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                    !notification.is_read
                      ? 'bg-blue-50/50 dark:bg-blue-500/10'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 flex-shrink-0">
                      {!notification.is_read ? (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
                      ) : (
                        <div className="w-2.5 h-2.5 bg-gray-300 dark:bg-white/20 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-bold text-sm ${getTypeColor(
                          notification.type
                        )}`}
                      >
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-white/70 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white/40 mt-1 font-medium">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                        onClick={(e) =>
                          deleteNotification(notification.notification_id, e)
                        }
                        className="p-1.5 text-gray-400 dark:text-white/40 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <TabBar role={user.active_role} />

      {showJobEditModal && (
        <JobEditResponseModal
          jobId={showJobEditModal.jobId}
          jobTitle={showJobEditModal.jobTitle}
          message={showJobEditModal.message}
          onClose={() => setShowJobEditModal(null)}
          onResponse={() => {
            fetchNotifications();
          }}
        />
      )}
    </div>
  );
}
