import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCw, X, ClipboardList, Briefcase, Calendar, ChevronDown, CheckCircle } from 'lucide-react';
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
  
  function FilterTab({ 
    active, 
    onClick, 
    icon: Icon, 
    label, 
    activeColor = "bg-white dark:bg-[#4B244A] text-[#4B244A] dark:text-white"
}: { 
    active: boolean, 
    onClick: () => void, 
    icon: any, 
    label: string,
    activeColor?: string 
}) {
    return (
        <button
            onClick={onClick}
            // Added: flex-1, w-full, justify-center
            className={`flex-1 w-full justify-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                active
                    ? `${activeColor} shadow-sm`
                    : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}
  
  

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
  const countActive = recurringJobs.filter(j => j.recurring_status === 'active').length + recurringHires.filter(h => h.recurring_status === 'active').length;
  const countCancelled = recurringJobs.filter(j => j.recurring_status === 'cancelled').length + recurringHires.filter(h => h.recurring_status === 'cancelled').length;
  const countAll = recurringJobs.length + recurringHires.length;

return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 pb-20 relative font-sans">
      {/* Decorative circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      {/* HEADER (Sticky with Navigation & Filters) */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all shadow-sm pt-14 md:pt-4">
        <div className="max-w-4xl mx-auto px-4 py-3 space-y-4">
          
          {/* Row 1: Navigation & Title */}
          <div className="flex items-center gap-3">
                  <button 
                      onClick={() => navigate(-1)} 
                      className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white transition-colors active:scale-95"
                  >
                      <ChevronDown className="w-6 h-6 rotate-90" />
                  </button>
                  <h1 className="text-xl font-bold text-[#4B244A] dark:text-white tracking-tight">Recurring Services</h1>
          </div>

          {/* Row 2: Filter Tabs (Scrollable) */}
          <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
            <div className="flex gap-1.5 w-full p-1.5 bg-gray-100/80 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-white/5">
                <FilterTab 
                    active={filter === 'all'} 
                    onClick={() => setFilter('all')} 
                    icon={ClipboardList} 
                    label={`All (${countAll})`} 
                />
                <FilterTab 
                    active={filter === 'active'} 
                    onClick={() => setFilter('active')} 
                    icon={CheckCircle} 
                    label={`Active (${countActive})`} 
                    activeColor="bg-green-500 text-white"
                />
                <FilterTab 
                    active={filter === 'cancelled'} 
                    onClick={() => setFilter('cancelled')} 
                    icon={X} 
                    label={`Cancelled (${countCancelled})`} 
                    activeColor="bg-red-500 text-white"
                />
            </div>
          </div>
          
        </div>
      </header>

      {/* MAIN CONTENT (Scrollable List) */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading recurring services...</p>
          </div>
        ) : allServices.length === 0 ? (
          <div className="text-center py-20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/10 shadow-lg">
            <div className="text-6xl mb-4 opacity-50">🔄</div>
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-2">No Recurring Services</h3>
            <p className="text-[#4B244A]/70 dark:text-white/70">
              {filter === 'all' 
                ? "You don't have any recurring service contracts yet." 
                : `No ${filter} recurring services found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Direct Hires List */}
            {filteredHires.map((hire) => (
              <div key={`hire-${hire.hire_id}`} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">{hire.package_name || 'Direct Hire'}</h3>
                    <p className="text-sm text-[#4B244A]/70 dark:text-white/70 font-medium">
                      Worker: <span className="text-[#4B244A] dark:text-white">{hire.worker_name}</span>
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    hire.recurring_status === 'active' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' 
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                  }`}>
                    {hire.recurring_status ? hire.recurring_status.toUpperCase() : 'UNKNOWN'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-gray-50 dark:bg-white/5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Frequency</p>
                    <p className="font-bold text-[#4B244A] dark:text-white capitalize flex items-center">
                      <RotateCw className="w-3.5 h-3.5 mr-1.5 text-[#EA526F]" />
                      {hire.frequency || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Next Service</p>
                    <p className="font-bold text-[#4B244A] dark:text-white flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      {hire.scheduled_date ? new Date(hire.scheduled_date).toLocaleDateString() : 'TBD'}
                    </p>
                  </div>
                </div>

                {hire.recurring_status === 'active' && (
                  <button 
                    onClick={() => {
                      setCancelTarget({ id: hire.hire_id, type: 'hire' });
                      setShowCancelModal(true);
                    }}
                    className="w-full py-2.5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    Cancel Service
                  </button>
                )}
              </div>
            ))}

            {/* Job Posts List */}
            {filteredJobs.map((job) => (
              <div key={`job-${job.post_id}`} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">{job.title}</h3>
                    <p className="text-sm text-[#4B244A]/70 dark:text-white/70 font-medium">Posted Job</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    job.recurring_status === 'active' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' 
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                  }`}>
                    {job.recurring_status ? job.recurring_status.toUpperCase() : 'UNKNOWN'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-gray-50 dark:bg-white/5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Frequency</p>
                    <p className="font-bold text-[#4B244A] dark:text-white capitalize flex items-center">
                      <RotateCw className="w-3.5 h-3.5 mr-1.5 text-[#EA526F]" />
                      {job.frequency || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Schedule</p>
                    <p className="font-bold text-[#4B244A] dark:text-white flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                      {job.day_of_week || 'TBD'}
                    </p>
                  </div>
                </div>

                {job.recurring_status === 'active' && (
                  <button 
                    onClick={() => {
                      setCancelTarget({ id: job.post_id, type: 'job' });
                      setShowCancelModal(true);
                    }}
                    className="w-full py-2.5 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    Cancel Service
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cancel Recurring Modal */}
      {showCancelModal && cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/20 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-4 mx-auto">
                <X className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-center text-[#4B244A] dark:text-white mb-2">Stop Recurring Service</h3>
            <p className="text-center text-[#4B244A]/70 dark:text-white/70 mb-6 font-medium text-sm">
              Are you sure you want to stop this recurring service? This will prevent future scheduled services.
            </p>
            
            <div className="mb-4">
              <label className="block text-[#4B244A]/80 dark:text-white/80 text-xs uppercase font-bold mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
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
                className="flex-1 px-4 py-3 bg-white dark:bg-white/5 text-[#4B244A] dark:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50 font-bold border border-gray-200 dark:border-white/10 text-sm transition-colors"
              >
                Keep Service
              </button>
              <button
                onClick={handleCancelRecurring}
                disabled={cancelling}
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 font-bold shadow-lg shadow-red-500/30 text-sm transition-all"
              >
                {cancelling ? 'Stopping...' : 'Stop Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TabBar role={user?.active_role || 'owner'} />
    </div>
  );
}