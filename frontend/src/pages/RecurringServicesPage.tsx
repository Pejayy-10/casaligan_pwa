import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import type { User } from '../types';
import apiClient from '../services/api';

interface RecurringJobPost {
  post_id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  is_recurring: boolean;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  frequency: string | null;
  recurring_status: string | null;
  recurring_cancelled_at: string | null;
  recurring_cancellation_reason: string | null;
  cancelled_by: string | null;
}

interface RecurringDirectHire {
  hire_id: number;
  worker_name?: string;
  employer_name?: string;
  total_amount: number;
  scheduled_date: string;
  status: string;
  created_at: string;
  is_recurring: boolean;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  frequency: string | null;
  recurring_status: string | null;
  recurring_cancelled_at: string | null;
  recurring_cancellation_reason: string | null;
  cancelled_by: string | null;
}

export default function RecurringServicesPage() {
  const navigate = useNavigate();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const [recurringJobs, setRecurringJobs] = useState<RecurringJobPost[]>([]);
  const [recurringHires, setRecurringHires] = useState<RecurringDirectHire[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ type: 'job' | 'hire'; id: number } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadRecurringServices();
  }, [filter]);

  const loadRecurringServices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');

      // Load recurring job posts
      const jobsResponse = await fetch('http://127.0.0.1:8000/jobs/my-posts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (jobsResponse.ok) {
        const allJobs = await jobsResponse.json();
        const recurring = allJobs.filter((job: any) => 
          job.recurring_schedule?.is_recurring === true || job.recurring_status !== null
        ).map((job: any) => ({
          post_id: job.post_id,
          title: job.title,
          description: job.description,
          status: job.status,
          created_at: job.created_at,
          is_recurring: job.recurring_schedule?.is_recurring || false,
          day_of_week: job.recurring_schedule?.day_of_week || null,
          start_time: job.recurring_schedule?.start_time || null,
          end_time: job.recurring_schedule?.end_time || null,
          frequency: job.recurring_schedule?.frequency || null,
          recurring_status: job.recurring_status || null,
          recurring_cancelled_at: job.recurring_cancelled_at || null,
          recurring_cancellation_reason: job.recurring_cancellation_reason || null,
          cancelled_by: job.cancelled_by || null,
        }));
        setRecurringJobs(recurring);
      }

      // Load recurring direct hires
      const endpoint = user?.active_role === 'owner' 
        ? 'http://127.0.0.1:8000/direct-hire/my-bookings'
        : 'http://127.0.0.1:8000/direct-hire/my-jobs';
      
      const hiresResponse = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (hiresResponse.ok) {
        const allHires = await hiresResponse.json();
        const recurring = allHires.filter((hire: any) => hire.is_recurring === true);
        setRecurringHires(recurring);
      }
    } catch (error) {
      console.error('Failed to load recurring services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRecurring = async () => {
    if (!cancelTarget) return;

    try {
      setCancelling(true);
      const token = localStorage.getItem('access_token');
      
      const endpoint = cancelTarget.type === 'job'
        ? `http://127.0.0.1:8000/jobs/${cancelTarget.id}/cancel-recurring`
        : `http://127.0.0.1:8000/direct-hire/${cancelTarget.id}/cancel-recurring`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: cancellationReason || null
        })
      });

      if (response.ok) {
        alert('Recurring service cancelled successfully');
        setShowCancelModal(false);
        setCancelTarget(null);
        setCancellationReason('');
        loadRecurringServices();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to cancel recurring service');
      }
    } catch (error) {
      console.error('Cancel recurring error:', error);
      alert('Failed to cancel recurring service');
    } finally {
      setCancelling(false);
    }
  };

  const formatSchedule = (dayOfWeek: string | null, startTime: string | null, endTime: string | null, frequency: string | null) => {
    if (!dayOfWeek || !startTime || !endTime || !frequency) return 'N/A';
    
    const day = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    return `Every ${day} from ${startTime} to ${endTime} (${frequency})`;
  };

  const filteredJobs = filter === 'all' 
    ? recurringJobs 
    : filter === 'active'
    ? recurringJobs.filter(job => job.recurring_status === 'active')
    : recurringJobs.filter(job => job.recurring_status === 'cancelled');

  const filteredHires = filter === 'all'
    ? recurringHires
    : filter === 'active'
    ? recurringHires.filter(hire => hire.recurring_status === 'active')
    : recurringHires.filter(hire => hire.recurring_status === 'cancelled');

  const allServices = [
    ...filteredJobs.map(job => ({ type: 'job' as const, data: job })),
    ...filteredHires.map(hire => ({ type: 'hire' as const, data: hire }))
  ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 pb-20 relative">
      {/* Decorative circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="text-[#4B244A]/80 dark:text-white/80 hover:text-[#4B244A] dark:hover:text-white transition-colors">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-[#4B244A] dark:text-white">🔄 Recurring Services</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {/* Filter Tabs */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-white/50 dark:border-white/10 shadow-lg">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'all'
                  ? 'bg-white dark:bg-[#4B244A] text-[#4B244A] dark:text-white shadow-md'
                  : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              All ({allServices.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'active'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              Active ({filteredJobs.filter(j => j.recurring_status === 'active').length + filteredHires.filter(h => h.recurring_status === 'active').length})
            </button>
            <button
              onClick={() => setFilter('cancelled')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                filter === 'cancelled'
                  ? 'bg-red-500 text-white shadow-md'
                  : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
              }`}
            >
              Cancelled ({filteredJobs.filter(j => j.recurring_status === 'cancelled').length + filteredHires.filter(h => h.recurring_status === 'cancelled').length})
            </button>
          </div>
        </div>

        {/* Services List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading recurring services...</p>
          </div>
        ) : allServices.length === 0 ? (
          <div className="text-center py-12 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/10 shadow-lg">
            <div className="text-6xl mb-4 opacity-50">🔄</div>
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-2">No recurring services found</h3>
            <p className="text-[#4B244A]/70 dark:text-white/70 mb-6">
              {filter === 'active' 
                ? 'You don\'t have any active recurring services'
                : filter === 'cancelled'
                ? 'You don\'t have any cancelled recurring services'
                : 'Create a recurring job or direct hire to see it here'}
            </p>
            {filter === 'all' && (
              <button 
                onClick={() => navigate('/jobs/create')}
                className="px-6 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg"
              >
                Create Recurring Service
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {allServices.map((service) => {
              const isJob = service.type === 'job';
              const data = service.data;
              const isActive = data.recurring_status === 'active';
              const isCancelled = data.recurring_status === 'cancelled';

              return (
                <div
                  key={isJob ? `job-${data.post_id}` : `hire-${data.hire_id}`}
                  className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/50 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-all shadow-lg"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">
                          {isJob ? '📋' : '💼'}
                        </span>
                        <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">
                          {isJob ? (data as RecurringJobPost).title : `Direct Hire #${(data as RecurringDirectHire).hire_id}`}
                        </h3>
                      </div>
                      
                      {isJob && (
                        <p className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-2 line-clamp-2">
                          {(data as RecurringJobPost).description}
                        </p>
                      )}

                      <div className="space-y-1 mb-3">
                        <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">
                          📅 Schedule: {formatSchedule(data.day_of_week, data.start_time, data.end_time, data.frequency)}
                        </p>
                        {isJob && (
                          <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">
                            Status: {(data as RecurringJobPost).status}
                          </p>
                        )}
                        {!isJob && (
                          <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">
                            {user?.active_role === 'owner' 
                              ? `Worker: ${(data as RecurringDirectHire).worker_name}`
                              : `Employer: ${(data as RecurringDirectHire).employer_name}`
                            }
                          </p>
                        )}
                        {!isJob && (
                          <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">
                            Amount: ₱{(data as RecurringDirectHire).total_amount.toLocaleString()}
                          </p>
                        )}
                      </div>

                      {isCancelled && (
                        <div className="mt-3 p-3 bg-red-100 dark:bg-red-500/20 rounded-lg border border-red-200 dark:border-red-500/30">
                          <p className="text-red-700 dark:text-red-300 text-sm font-bold mb-1">
                            ❌ Cancelled {data.cancelled_by === user?.active_role ? 'by you' : `by ${user?.active_role === 'owner' ? 'worker' : 'employer'}`}
                          </p>
                          {data.recurring_cancelled_at && (
                            <p className="text-red-600 dark:text-red-300/70 text-xs">
                              On {new Date(data.recurring_cancelled_at).toLocaleDateString()}
                            </p>
                          )}
                          {data.recurring_cancellation_reason && (
                            <p className="text-red-600 dark:text-red-300/70 text-xs mt-1">
                              Reason: {data.recurring_cancellation_reason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                      isActive 
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' 
                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                    }`}>
                      {isActive ? '🟢 Active' : '🔴 Cancelled'}
                    </span>
                  </div>

                  {isActive && (
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setCancelTarget({
                            type: isJob ? 'job' : 'hire',
                            id: isJob ? (data as RecurringJobPost).post_id : (data as RecurringDirectHire).hire_id
                          });
                          setShowCancelModal(true);
                        }}
                        className="px-4 py-2 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 text-sm rounded-lg hover:bg-orange-200 dark:hover:bg-orange-500/30 transition-all font-semibold"
                      >
                        🛑 Stop Recurring
                      </button>
                      {isJob && (
                        <button
                          onClick={() => navigate(`/jobs?post=${(data as RecurringJobPost).post_id}`)}
                          className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-sm rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-all font-semibold"
                        >
                          View Job
                        </button>
                      )}
                      {!isJob && (
                        <button
                          onClick={() => navigate('/jobs')}
                          className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-sm rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-all font-semibold"
                        >
                          View Direct Hire
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cancel Recurring Modal */}
      {showCancelModal && cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/20 shadow-2xl">
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">Stop Recurring Service</h3>
            <p className="text-[#4B244A]/70 dark:text-white/70 mb-4 font-medium">
              Are you sure you want to stop this recurring service? This will prevent future scheduled services.
            </p>
            
            <div className="mb-4">
              <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm mb-2 font-bold">
                Reason (optional - e.g., dispute, no longer needed, etc.)
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                className="w-full px-4 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/30 rounded-lg text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelTarget(null);
                  setCancellationReason('');
                }}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white rounded-lg hover:bg-white/80 dark:hover:bg-white/30 disabled:opacity-50 font-bold border border-gray-200 dark:border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleCancelRecurring}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-bold shadow-md"
              >
                {cancelling ? 'Cancelling...' : 'Stop Recurring'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TabBar role={user?.active_role || 'owner'} />
    </div>
  );
}