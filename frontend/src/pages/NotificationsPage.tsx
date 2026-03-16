import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, X, Loader2 } from 'lucide-react';
import TabBar from '../components/TabBar';
import JobEditResponseModal from '../components/JobEditResponseModal';
import JobDetailModal from '../components/JobDetailModal';
import ApplicantsListModal from '../components/ApplicantsListModal';
import ApplicationAcceptedModal from '../components/ApplicationAcceptedModal';
import { API_BASE_URL } from '../config';

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

interface AcceptedWorker {
  worker_id: number;
  worker_user_id: number;
  name: string;
  contract_id: number;
}

interface JobPost {
  post_id: number;
  title: string;
  description: string;
  house_type: string;
  cleaning_type: string;
  budget: number;
  people_needed: number;
  image_urls: string[];
  duration_type: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  category_id?: number;
  category_name?: string;
  category_ids?: number[];
  category_names?: string[];
  status: string;
  created_at: string;
  employer_name?: string;
  employer_address?: string;
  total_applicants: number;
  pending_payments?: number;
  accepted_workers?: AcceptedWorker[];
  payment_schedule?: {
    frequency: string;
    payment_amount: number;
    payment_dates: string[];
    payment_method_preference: string;
  };
}

// Owner-specific notification types
const OWNER_ONLY_NOTIFICATIONS = [
  'job_application',
  'job_edited',
  'completion_submitted',
  'direct_hire_request',
  'applicant_withdrawn_due_to_conflict',
  'hire_canceled_worker_accepted_conflict',
];

// Worker/Housekeeper-specific notification types
const HOUSEKEEPER_ONLY_NOTIFICATIONS = [
  'application_accepted',
  'application_rejected',
  'job_started',
  'completion_approved',
  'payment_sent',
  'payment_received',
  'payment_review',
  'payment_due',
  'payment_overdue',
  'direct_hire_accepted',
  'direct_hire_rejected',
  'direct_hire_started',
  'direct_hire_completed',
  'direct_hire_approved',
  'direct_hire_paid',
  'contract_extension_proposed',
  'contract_extension_accepted',
  'contract_extension_rejected',
  'application_withdrawn_due_to_conflict',
  'direct_hire_rejected_due_to_conflict',
];

// Notifications that appear in both roles
const SHARED_NOTIFICATIONS = ['system', 'reminder'];

function isNotificationVisibleForRole(notificationType: string, role: 'owner' | 'housekeeper'): boolean {
  if (SHARED_NOTIFICATIONS.includes(notificationType)) {
    return true;
  }
  
  if (role === 'owner') {
    return OWNER_ONLY_NOTIFICATIONS.includes(notificationType);
  } else {
    return HOUSEKEEPER_ONLY_NOTIFICATIONS.includes(notificationType);
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'housekeeper'>('owner');
  const [showJobEditModal, setShowJobEditModal] = useState<{ jobId: number; jobTitle: string; message: string } | null>(null);
  const [showApplicationAcceptedModal, setShowApplicationAcceptedModal] = useState<{ jobId: number } | null>(null);
  const [showJobDetailModal, setShowJobDetailModal] = useState<{ jobId: number } | null>(null);
  const [showApplicantsModal, setShowApplicantsModal] = useState<{ jobId: number; jobTitle: string } | null>(null);
  const [jobDetail, setJobDetail] = useState<JobPost | null>(null);
  const [loadingJobDetail, setLoadingJobDetail] = useState(false);
  const navigate = useNavigate();

  const getToken = () => localStorage.getItem('access_token');

  const getCurrentRole = () => {
    const role = localStorage.getItem('user_role') as 'owner' | 'housekeeper' | null;
    return role || 'owner';
  };

  const fetchJobDetail = async (jobId: number) => {
    const token = getToken();
    if (!token) return null;

    try {
      setLoadingJobDetail(true);
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setJobDetail(data);
        return data;
      }
    } catch (error) {
      console.error('Error fetching job detail:', error);
    } finally {
      setLoadingJobDetail(false);
    }
    return null;
  };

  useEffect(() => {
    // Get user role
    const role = getCurrentRole();
    setUserRole(role);

    fetchNotifications();

    // Listen for role changes
    const handleRoleChanged = () => {
      const newRole = getCurrentRole();
      setUserRole(newRole);
      fetchNotifications();
    };
    window.addEventListener('role-changed', handleRoleChanged);

    return () => {
      window.removeEventListener('role-changed', handleRoleChanged);
    };
  }, []);

  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter notifications based on current user role
        const currentRole = getCurrentRole();
        const filteredNotifications = data.filter((notif: Notification) =>
          isNotificationVisibleForRole(notif.type, currentRole)
        );
        setNotifications(filteredNotifications);
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
      await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
      // Notify other components (e.g. TabBar) to refresh their unread count
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setMarkingAllRead(true);
      await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      // Notify other components (e.g. TabBar) to refresh their unread count
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    const token = getToken();
    if (!token) return;

    try {
      setDeletingId(notificationId);
      await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.filter((n) => n.notification_id !== notificationId)
      );
      // Notify other components (e.g. TabBar) to refresh their unread count
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.notification_id);
    }

    // Special handling for job_edited notifications
    if (notification.type === 'job_edited' && notification.reference_type === 'job' && notification.reference_id) {
      setShowJobEditModal({
        jobId: notification.reference_id,
        jobTitle: notification.title.replace(' ⚠️', '').replace('Job Post Updated', '').trim() || 'Job',
        message: notification.message
      });
      return;
    }

    // Handle job-related notifications
    if (notification.reference_type === 'job' && notification.reference_id) {
      if (notification.type === 'application_accepted') {
        // Show application accepted modal
        setShowApplicationAcceptedModal({ jobId: notification.reference_id });
      } else if (notification.type === 'job_application') {
        // Show applicants modal for new job application
        setShowApplicantsModal({
          jobId: notification.reference_id,
          jobTitle: notification.title.replace('New Job Application', '').trim() || 'Job'
        });
      } else {
        // For other job-related notifications, show job detail
        setShowJobDetailModal({ jobId: notification.reference_id });
        fetchJobDetail(notification.reference_id);
      }
      return;
    }

    if (notification.reference_type && notification.reference_id) {
      switch (notification.reference_type) {
        case 'chat':
          navigate(`/chat/${notification.reference_id}`);
          break;
        case 'contract':
          navigate(`/dashboard`);
          break;
        default:
          navigate(`/dashboard`); // Fallback
          break;
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300 pb-24 relative">
      
      {/* Header */}
      <header className="relative z-10 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all safe-area-top">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            
            {/* Title Section */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#4B244A]/5 dark:bg-white/10 rounded-xl">
                <Bell className="w-6 h-6 text-[#4B244A] dark:text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white tracking-tight">
                Notifications
              </h1>
            </div>

            {/* Action Button */}
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAllRead}
                className="text-sm text-[#E7467B] dark:text-[#EA526F] hover:text-gray-700 dark:hover:text-white transition-colors font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {markingAllRead ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Mark all as read
              </button>
            )}
          </div>
        </div>
      </header>

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
                className={`p-4 rounded-xl transition-all cursor-pointer border ${
                  notification.is_read
                    ? // Read Styles
                      'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'
                    : // Unread Styles
                      'bg-[#EA526F]/5 dark:bg-[#EA526F]/10 border-[#EA526F]/30 dark:border-[#EA526F]/30 hover:bg-[#EA526F]/10 dark:hover:bg-[#EA526F]/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-[#E7467B] dark:bg-[#EA526F] flex-shrink-0 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-white/70 text-sm line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-gray-400 dark:text-white/40 text-xs mt-2 font-medium">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {notification.is_read ? (
                      <CheckCheck className="w-4 h-4 text-gray-400 dark:text-white/30" />
                    ) : (
                      <Check className="w-4 h-4 text-[#E7467B] dark:text-[#EA526F]" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.notification_id);
                      }}
                      disabled={deletingId === notification.notification_id}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                      aria-label="Delete notification"
                    >
                      {deletingId === notification.notification_id ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <X className="w-4 h-4 text-gray-400 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Edit Response Modal */}
      {showJobEditModal && (
        <JobEditResponseModal
          jobId={showJobEditModal.jobId}
          jobTitle={showJobEditModal.jobTitle}
          message={showJobEditModal.message}
          onClose={() => setShowJobEditModal(null)}
          onResponse={() => setShowJobEditModal(null)}
        />
      )}

      {/* Application Accepted Modal */}
      {showApplicationAcceptedModal && (
        <ApplicationAcceptedModal
          jobId={showApplicationAcceptedModal.jobId}
          onClose={() => setShowApplicationAcceptedModal(null)}
        />
      )}

      {/* Job Detail Modal - for other job notifications */}
      {showJobDetailModal && jobDetail && (
        <JobDetailModal
          job={jobDetail}
          onClose={() => {
            setShowJobDetailModal(null);
            setJobDetail(null);
          }}
        />
      )}

      {/* Applicants List Modal - for new job application notifications */}
      {showApplicantsModal && (
        <ApplicantsListModal
          jobId={showApplicantsModal.jobId}
          jobTitle={showApplicantsModal.jobTitle}
          peopleNeeded={1}
          onClose={() => setShowApplicantsModal(null)}
        />
      )}

      <TabBar role={userRole} />
    </div>
  );
}
