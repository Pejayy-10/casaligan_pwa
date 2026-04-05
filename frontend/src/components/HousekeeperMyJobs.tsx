import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { RotateCw, Clock, CheckCircle, Briefcase, DollarSign, User, Phone, Mail, CreditCard, Calendar, BarChart2, AlertTriangle, ClipboardList, ChevronLeft, ChevronRight, Flag, FileText, X, Check, Loader2, AlertCircle, MapPin, Home } from 'lucide-react';
import { createPortal } from 'react-dom';
import ContractExtensionResponseModal, { type PendingExtension } from './ContractExtensionResponseModal';
import HousekeeperSummaryModal from './HousekeeperSummaryModal';
import DailyCompletionModal from './DailyCompletionModal';
import { useConfirmDialog } from './useConfirmDialog';
import { JobsPageSkeleton } from './Skeleton';

interface AcceptedJob {
  post_id: number;
  title: string;
  description: string;
  location: string;
  accommodation_type?: string | null;
  budget: number;
  status: string;
  post_fee_status?: string | null;
  application_status?: string;
  cancellation_reason?: string | null;
  recurring_cancellation_reason?: string | null;
  cancelled_by?: string | null;
  edit_response?: string | null;
  edit_notified_at?: string | null;
  start_date: string | null;
  end_date: string | null;
  is_longterm: boolean;
  accepted_at: string | null;
  // Mutual cancellation fields
  cancel_requested_by?: string | null;   // "employer" | "worker"
  cancel_request_reason?: string | null;
  cancel_requested_at?: string | null;
  employer: {
    user_id: number | null;
    name: string;
    email: string | null;
    phone: string | null;
  };
  contract: {
    contract_id: number | null;
    status: string | null;
  } | null;
  pending_extension: {
    extension_id: number;
    proposed_end_date: string;
    proposed_budget: number | null;
    reason: string | null;
    proposed_by_name: string | null;
    created_at: string | null;
  } | null;
  payments: {
    total_schedules: number;
    pending_payments: number;
    total_earned: number;
    next_payment_due: string | null;
    schedules: Array<{
      schedule_id: number;
      due_date: string;
      amount: number;
      status: string;
      payment_proof_url?: string | null;
      payment_method?: string | null;
      reference_number?: string | null;
    }>;
  };
  multi_day_schedule?: {
    num_days: number;
    daily_start_time: string | null;
    daily_end_time: string | null;
  } | null;
  day_schedules?: Array<{
    day_schedule_id: number;
    day_number: number;
    work_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    owner_confirmed: boolean;
    housekeeper_confirmed: boolean;
  }>;
}

interface Props {
  onShowProgress: (job: AcceptedJob) => void;
  onSubmitCompletion: (job: AcceptedJob) => void;
  onReportUnpaid: (job: AcceptedJob) => void;
  onShowPayments?: (job: AcceptedJob) => void;
  onReportEmployer?: (job: AcceptedJob) => void;
  reportedUsers?: Set<string>;
  initialStatusFilter?: 'all' | 'pending_application' | 'ongoing' | 'pending_completion' | 'completed';
}

export default function HousekeeperMyJobs({ onShowProgress, onSubmitCompletion, onReportUnpaid, onShowPayments, onReportEmployer, reportedUsers, initialStatusFilter }: Props) {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [jobs, setJobs] = useState<AcceptedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_application' | 'ongoing' | 'pending_completion' | 'completed'>(initialStatusFilter || 'all');
  const [showExtensionResponse, setShowExtensionResponse] = useState<PendingExtension | null>(null);
  const [showSummaryJobId, setShowSummaryJobId] = useState<number | null>(null);
  const [proofModal, setProofModal] = useState<{
    url: string;
    jobTitle: string;
  } | null>(null);
  const [showDailyCompletion, setShowDailyCompletion] = useState<AcceptedJob | null>(null);
  const [requestCancelModal, setRequestCancelModal] = useState<{
    postId: number;
    title: string;
    reason: string;
    error: string | null;
    submitting: boolean;
  } | null>(null);
  const [respondCancelModal, setRespondCancelModal] = useState<{
    postId: number;
    title: string;
    requestReason: string;
    rejectReason: string;
    error: string | null;
    submitting: boolean;
  } | null>(null);
  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(jobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = jobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    loadMyJobs(true);
    setCurrentPage(1);
  }, [statusFilter]);

  // Listen for external events that should trigger a refresh (e.g. after submitting completion)
  useEffect(() => {
    const handleRefresh = () => loadMyJobs();
    window.addEventListener('my-jobs-updated', handleRefresh);
    return () => window.removeEventListener('my-jobs-updated', handleRefresh);
  }, [statusFilter]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const loadMyJobs = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${API_BASE_URL}/jobs/my-accepted-jobs${statusFilter !== 'all' ? `?status_filter=${statusFilter}` : ''}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: 'no-store'
        }
      );

      if (response.ok) {
        const data = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.error('Failed to load my jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilterChange = (nextFilter: 'all' | 'pending_application' | 'ongoing' | 'pending_completion' | 'completed') => {
    if (statusFilter === nextFilter) return;
    setLoading(true);
    setStatusFilter(nextFilter);
  };

  const handleRequestCancellation = async (postId: number, reason: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/jobs/${postId}/request-cancellation`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (response.ok) {
        alert('Cancellation request submitted. The house owner must approve before the contract ends.');
        await loadMyJobs();
        return true;
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to submit cancellation request');
        return false;
      }
    } catch {
      alert('Failed to submit cancellation request');
      return false;
    }
  };

  const handleRespondCancellation = async (postId: number, action: 'approve' | 'reject', reason?: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/jobs/${postId}/respond-cancellation`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      if (response.ok) {
        const data = await response.json();
        alert(data.message || (action === 'approve' ? 'Contract cancelled.' : 'Cancellation request rejected.'));
        await loadMyJobs();
        return true;
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to respond to cancellation request');
        return false;
      }
    } catch {
      alert('Failed to respond to cancellation request');
      return false;
    }
  };

  const respondToEdit = async (job: AcceptedJob, response: 'accept' | 'reject') => {
    try {
      const token = localStorage.getItem('access_token');
      const responseData = await fetch(
        `${API_BASE_URL}/jobs/${job.post_id}/respond-to-edit?response=${response}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!responseData.ok) {
        const errorData = await responseData.json();
        alert(errorData.detail || 'Failed to submit response');
        return;
      }

      alert(
        response === 'accept'
          ? 'You accepted the updated job details. Your application will continue.'
          : 'You withdrew your application for this edited job.'
      );

      loadMyJobs().catch((err) => console.error('Failed to reload jobs:', err));
    } catch (error) {
      console.error('Failed to respond to job edit:', error);
      alert('Failed to submit response');
    }
  };

  const handleCancelPendingApplication = async (job: AcceptedJob) => {
    const shouldCancel = await confirm({
      title: 'Cancel Application',
      message: 'Are you sure you want to cancel this application? You can apply again later if the job is still open.',
      confirmLabel: 'Cancel Application',
      tone: 'danger'
    });

    if (!shouldCancel) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/jobs/${job.post_id}/withdraw-application`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to cancel application');
        return;
      }

      setJobs((prev) => prev.filter((existingJob) => existingJob.post_id !== job.post_id));
      setSuccessMessage(`Application cancelled for "${job.title}".`);
      if (currentPage > 1 && (jobs.length - 1) <= (currentPage - 1) * ITEMS_PER_PAGE) {
        setCurrentPage((p) => Math.max(1, p - 1));
      }
      window.dispatchEvent(new Event('my-jobs-updated'));
    } catch (error) {
      console.error('Failed to cancel application:', error);
      alert('Failed to cancel application');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'ongoing': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
      case 'pending_application': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300';
      case 'pending_completion': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300';
      case 'pending_cancellation': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300';
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
      case 'ongoing': return <><RotateCw className="inline w-4 h-4 mr-1" /> Ongoing</>;
      case 'pending_completion': return <><Clock className="inline w-4 h-4 mr-1" /> Pending Approval</>;
      case 'pending_cancellation': return <><AlertCircle className="inline w-4 h-4 mr-1" /> Cancel Pending</>;
      case 'completed': return <><CheckCircle className="inline w-4 h-4 mr-1" /> Completed</>;
      case 'cancelled': return <><AlertTriangle className="inline w-4 h-4 mr-1" /> Cancelled</>;
      default: return status;
    }
  };

  // Get the effective status for a job (use contract status for worker's individual progress)
  const getEffectiveStatus = (job: AcceptedJob): string => {
    if (job.status === 'cancelled') return 'cancelled';
    if (job.status === 'pending_cancellation') return 'pending_cancellation';
    if (job.application_status === 'pending') return 'pending_application';
    return job.contract?.status || job.status;
  };

  // Check if job has payment pending confirmation (payment sent but not confirmed by worker)
  const hasPendingPaymentConfirmation = (job: AcceptedJob): boolean => {
    return job.payments?.schedules?.some(s => s.status === 'sent' || s.status === 'SENT') || false;
  };

  const getSentPayment = (job: AcceptedJob) => {
    return job.payments?.schedules?.find(s => s.status === 'sent' || s.status === 'SENT');
  };

  if (loading) {
    return (
      <JobsPageSkeleton />
    );
  }

  return (
    <div>
      {successMessage && (
        <div className="mb-4 rounded-xl border border-green-200 dark:border-green-500/30 bg-green-100 dark:bg-green-500/15 px-4 py-3 text-sm font-bold text-green-700 dark:text-green-300">
          <CheckCircle className="inline w-4 h-4 mr-1" /> {successMessage}
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-white/10">
          <button
            onClick={() => handleStatusFilterChange('all')}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-[#4B244A] text-[#4B244A] dark:text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <ClipboardList className="inline w-4 h-4 mr-1" /> All Jobs
          </button>
          <button
            onClick={() => handleStatusFilterChange('pending_application')}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'pending_application'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <Clock className="inline w-4 h-4 mr-1" /> Applied
          </button>
          <button
            onClick={() => handleStatusFilterChange('ongoing')}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'ongoing'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <RotateCw className="inline w-4 h-4 mr-1" /> Ongoing
          </button>
          <button
            onClick={() => handleStatusFilterChange('pending_completion')}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'pending_completion'
                ? 'bg-yellow-500 text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <Clock className="inline w-4 h-4 mr-1" /> Pending
          </button>
          <button
            onClick={() => handleStatusFilterChange('completed')}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'completed'
                ? 'bg-green-500 text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <CheckCircle className="inline w-4 h-4 mr-1" /> Completed
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/50 dark:border-white/10 shadow-lg">
          <div className="flex justify-center mb-4 opacity-50"><Briefcase className="w-16 h-16" /></div>
          <h3 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">No Jobs Found</h3>
          <p className="text-[#4B244A]/70 dark:text-white/70 mb-6 font-medium">
            {statusFilter === 'all' 
              ? "You haven't applied to or been accepted to any jobs yet. Start applying!" 
              : statusFilter === 'pending_application'
              ? "You have no pending applications."
              : `No ${statusFilter.replace('_', ' ')} jobs found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedJobs.map((job) => {
            // Use contract status for individual worker's progress
            const myStatus = getEffectiveStatus(job);
            const ownerWeeklyFeeDue = (job.post_fee_status || '').toLowerCase() === 'pending_owner_weekly';
            
            return (
            <div key={job.post_id} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
              {/* Header */}
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-[#4B244A] dark:text-white">{job.title}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(myStatus)}`}>
                  {myStatus === 'pending_application' ? 'Pending' : getStatusLabel(myStatus)}
                </span>
              </div>

              {/* Description */}
              <p className="text-[#4B244A]/70 dark:text-white/70 mb-4 line-clamp-2">{job.description}</p>

              {/* Job Details */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 rounded-lg text-sm font-semibold">
                  ₱{job.budget}
                </span>
                <span className={`px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                  (job.accommodation_type || 'stay_out') === 'stay_in'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                }`}>
                  {(job.accommodation_type || 'stay_out') === 'stay_in' ? (
                    <>
                      <Home className="w-3.5 h-3.5" /> Stay In
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5" /> Stay Out
                    </>
                  )}
                </span>
                {job.is_longterm && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 rounded-lg text-sm font-semibold">
                    Long-term
                  </span>
                )}
                {job.multi_day_schedule && job.multi_day_schedule.num_days > 1 && (
                  <span className="px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 rounded-lg text-sm font-semibold">
                    {job.multi_day_schedule.num_days} days
                    {job.multi_day_schedule.daily_start_time && job.multi_day_schedule.daily_end_time && 
                      ` (${job.multi_day_schedule.daily_start_time}–${job.multi_day_schedule.daily_end_time})`}
                  </span>
                )}
              </div>

              {/* Employer Info */}
              <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 mb-4 border border-gray-200 dark:border-white/10">
                <div className="text-sm text-[#4B244A]/70 dark:text-white/70 space-y-1 font-medium">
                  <h4 className="text-sm font-bold text-[#4B244A] dark:text-white mb-2"><User className="inline w-4 h-4 mr-1" /> {job.employer.name}</h4>
                  {job.employer.phone && <p><Phone className="inline w-4 h-4 mr-1" />{job.employer.phone}</p>}
                  {job.employer.email && <p><Mail className="inline w-4 h-4 mr-1" />{job.employer.email}</p>}
                  <p className="pt-3 text-md font-bold text-[#EA526F] dark:text-[#FF7A99] flex items-center gap-2 border-t border-gray-300 dark:border-white/10">
                    <MapPin className="w-10 h-10"></MapPin> {job.location}
                  </p>
                </div>
              </div>

              {/* Payment Summary (for long-term jobs) */}
              {job.is_longterm && job.payments && (
                <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 mb-4 border border-gray-200 dark:border-white/10">
                  <h4 className="text-sm font-bold text-[#4B244A] dark:text-white mb-2"><CreditCard className="inline w-4 h-4 mr-1" /> Payment Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-green-100 dark:bg-green-500/10 rounded-lg p-2 text-center border border-green-200 dark:border-transparent">
                      <div className="text-green-700 dark:text-green-300 font-bold">₱{job.payments.total_earned.toLocaleString()}</div>
                      <div className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">Earned</div>
                    </div>
                    <div className="bg-yellow-100 dark:bg-yellow-500/10 rounded-lg p-2 text-center border border-yellow-200 dark:border-transparent">
                      <div className="text-yellow-700 dark:text-yellow-300 font-bold">{job.payments.pending_payments}</div>
                      <div className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium">Pending</div>
                    </div>
                  </div>
                  {job.payments.next_payment_due && (
                    <p className="text-xs text-[#4B244A]/60 dark:text-white/60 mt-2 font-medium">
                      <Calendar className="inline w-4 h-4 mr-1" /> Next payment due: {new Date(job.payments.next_payment_due).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Date Range */}
              {job.start_date && job.end_date && (
                <div className="text-sm text-[#4B244A]/60 dark:text-white/60 mb-4 font-medium">
                  <Calendar className="inline w-4 h-4 mr-1" /> {new Date(job.start_date).toLocaleDateString()} - {new Date(job.end_date).toLocaleDateString()}
                </div>
              )}

              {/* Pending Extension Request Banner */}
              {job.pending_extension && (myStatus === 'ongoing' || myStatus === 'active') && (
                <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4 mb-4 border-2 border-purple-300 dark:border-purple-500/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300">Contract Extension Proposed</h4>
                  </div>
                  <p className="text-sm text-[#4B244A]/80 dark:text-white/80">
                    <span className="font-semibold">{job.pending_extension.proposed_by_name || 'Your employer'}</span> wants to extend this contract until{' '}
                    <span className="font-bold text-purple-700 dark:text-purple-300">{new Date(job.pending_extension.proposed_end_date).toLocaleDateString()}</span>
                    {job.pending_extension.proposed_budget !== null && (
                      <> with a new budget of <span className="font-bold text-green-700 dark:text-green-300">₱{job.pending_extension.proposed_budget.toLocaleString()}</span></>  
                    )}
                  </p>
                  {job.pending_extension.reason && (
                    <p className="text-xs text-[#4B244A]/60 dark:text-white/60 italic">"{job.pending_extension.reason}"</p>
                  )}
                  <button
                    onClick={() => {
                      setShowExtensionResponse({
                        extension_id: job.pending_extension!.extension_id,
                        contract_id: job.contract?.contract_id || 0,
                        post_id: job.post_id,
                        job_title: job.title,
                        current_end_date: job.end_date,
                        proposed_end_date: job.pending_extension!.proposed_end_date,
                        proposed_budget: job.pending_extension!.proposed_budget,
                        reason: job.pending_extension!.reason,
                        proposed_by_name: job.pending_extension!.proposed_by_name,
                        status: 'pending',
                        created_at: job.pending_extension!.created_at,
                      });
                    }}
                    className="w-full py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-all shadow-md text-sm"
                  >
                    📋 Review Extension Request
                  </button>
                </div>
              )}

              {/* Pending Application Banner */}
              {myStatus === 'pending_application' && (
                <>
                  {job.edit_response === 'pending' ? (
                    <div className="mb-4 space-y-3">
                      <div className="py-2 px-3 text-yellow-800 dark:text-yellow-200 font-semibold bg-yellow-100 dark:bg-yellow-500/10 rounded-lg border border-yellow-200 dark:border-yellow-500/30 flex items-center gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">Job was edited. Please respond to continue.</span>
                      </div>
                      {job.edit_notified_at && (
                        <div className="text-xs text-yellow-700 dark:text-yellow-300 text-center font-medium">
                          Notified: {new Date(job.edit_notified_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={async () => {
                            const shouldContinue = await confirm({
                              title: 'Continue Application',
                              message: 'Continue with this edited job?',
                              confirmLabel: 'Continue'
                            });
                            if (shouldContinue) {
                              respondToEdit(job, 'accept');
                            }
                          }}
                          className="w-full py-2 !bg-[#EA526F] !text-white font-bold rounded-lg hover:bg-[#d4486a] transition-all shadow-md"
                        >
                          ✓ Continue Application
                        </button>
                        <button
                          onClick={async () => {
                            const shouldWithdraw = await confirm({
                              title: 'Withdraw Application',
                              message: 'Withdraw your application for this edited job?',
                              confirmLabel: 'Withdraw',
                              tone: 'danger'
                            });
                            if (shouldWithdraw) {
                              respondToEdit(job, 'reject');
                            }
                          }}
                          className="w-full py-2 bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-white font-bold rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition-all shadow-md"
                        >
                          ✕ Withdraw Application
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 space-y-2">
                      <div className="py-3 text-center text-xs text-orange-700 dark:text-orange-300 font-bold bg-orange-100 dark:bg-orange-500/10 rounded-lg border border-orange-200 dark:border-orange-500/30">
                        <Clock className="inline w-4 h-4 mr-1" /> Waiting for house owner to accept your application
                      </div>
                      <button
                        onClick={() => handleCancelPendingApplication(job)}
                        className="w-full py-2 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 font-bold rounded-lg hover:bg-red-200 dark:hover:bg-red-500/25 transition-all border border-red-200 dark:border-red-500/30"
                      >
                        <X className="inline w-4 h-4 mr-1" /> Cancel Application
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Action Buttons - Use myStatus (contract status) for individual worker state */}
              <div className="space-y-2">                {/* Show payment confirmation if payment is sent but not confirmed */}
                {hasPendingPaymentConfirmation(job) && (
                  <>
                    {getSentPayment(job)?.payment_proof_url && (
                      <button
                        onClick={() => {
                          const proofUrl = getSentPayment(job)?.payment_proof_url;
                          if (!proofUrl) return;
                          setProofModal({
                            url: proofUrl,
                            jobTitle: job.title,
                          });
                        }}
                        className="w-full py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-all shadow-md"
                      >
                        <CreditCard className="inline w-4 h-4 mr-1" /> View Owner Payment Proof
                      </button>
                    )}
                    <div className="py-3 text-center text-blue-700 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/30">
                      <DollarSign className="inline w-4 h-4 mr-1" /> Payment Sent - Review Required!
                    </div>
                    <button
                      onClick={() => setShowSummaryJobId(job.post_id)}
                      className="w-full py-2 bg-[#4B244A] text-white font-bold rounded-lg hover:bg-[#361a35] transition-all shadow-md"
                    >
                      <FileText className="inline w-4 h-4 mr-1" /> View Summary & Receipt
                    </button>
                    <button
                      onClick={async () => {
                        const shouldConfirm = await confirm({
                          title: 'Confirm Payment',
                          message: 'Confirm that you have received the payment?',
                          confirmLabel: 'Yes, Confirm'
                        });
                        if (shouldConfirm) {
                          try {
                            const token = localStorage.getItem('access_token');
                            // Get the transaction_id from the payment schedule with 'sent' status
                            const sentPayment = getSentPayment(job);
                            if (!sentPayment) {
                              alert('No pending payment found');
                              return;
                            }
                            
                            const response = await fetch(
                              `${API_BASE_URL}/jobs/${job.post_id}/payments/${sentPayment.schedule_id}/confirm`,
                              {
                                method: 'PUT',
                                headers: { 'Authorization': `Bearer ${token}` }
                              }
                            );
                            
                            if (response.ok) {
                              alert('Payment confirmed successfully!');
                              // Reload jobs list (errors here don't affect confirmation success)
                              loadMyJobs().catch(err => console.error('Failed to reload jobs:', err));
                            } else {
                              const error = await response.json();
                              alert(error.detail || 'Failed to confirm payment');
                            }
                          } catch (error) {
                            console.error('Payment confirmation error:', error);
                            alert('Failed to confirm payment');
                          }
                        }
                      }}
                      className="w-full py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all shadow-md"
                    >
                      ✓ Confirm Payment Received
                    </button>
                  </>
                )}
                                {(myStatus === 'ongoing' || myStatus === 'active') && !hasPendingPaymentConfirmation(job) && (
                  <>
                    {/* Message Employer Button */}
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          jobId: job.post_id.toString(),
                          name: job.employer.name,
                          title: job.title,
                        });
                        navigate(`/chat/new?${params.toString()}`);
                      }}
                      className="w-full py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition-all shadow-md"
                    >
                      💬 Message Employer
                    </button>
                    {/* Daily Progress Button for multi-day jobs */}
                    {job.multi_day_schedule && job.multi_day_schedule.num_days > 1 && (
                      <button
                        onClick={() => setShowDailyCompletion(job)}
                        className="w-full py-2 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-600 transition-all shadow-md"
                      >
                        📅 Daily Progress ({job.day_schedules?.filter(d => d.status === 'completed').length || 0}/{job.multi_day_schedule.num_days} days)
                      </button>
                    )}
                    {/* Long-term only actions */}
                    {job.is_longterm && (
                      <button
                        onClick={() => onShowProgress(job)}
                        className="w-full py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-all shadow-md"
                      >
                        <BarChart2 className="inline w-4 h-4 mr-1" /> View Progress
                      </button>
                    )}
                    {job.is_longterm && onShowPayments && (
                      <button
                        onClick={() => onShowPayments(job)}
                        className="w-full py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all shadow-md"
                      >
                        <DollarSign className="inline w-4 h-4 mr-1" /> View Payments {job.payments.schedules?.some(s => s.status === 'sent' || s.status === 'SENT') && '(Action Required!)'}
                      </button>
                    )}
                    {/* Only show Submit Completion for short-term jobs */}
                    {!job.is_longterm && !ownerWeeklyFeeDue && (
                      <button
                        onClick={() => onSubmitCompletion(job)}
                        className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 transition-all shadow-md"
                      >
                        <CheckCircle className="inline w-4 h-4 mr-1" /> Submit Completion
                      </button>
                    )}
                    {!job.is_longterm && ownerWeeklyFeeDue && (
                      <div className="py-2 text-center text-amber-700 dark:text-amber-300 text-sm bg-amber-100 dark:bg-amber-500/10 rounded-lg font-medium border border-amber-200 dark:border-amber-500/20">
                        <Clock className="inline w-4 h-4 mr-1" /> Waiting for owner to pay this week's recurring posting fee
                      </div>
                    )}
                    {/* For long-term jobs, show info about auto-completion */}
                    {job.is_longterm && (
                      <div className="py-2 text-center text-blue-700 dark:text-blue-300 text-sm bg-blue-100 dark:bg-blue-500/10 rounded-lg font-medium">
                        <DollarSign className="inline w-4 h-4 mr-1" /> Job completes when all payments are confirmed
                      </div>
                    )}

                    {/* ── Mutual Cancellation UI (long-term only) ── */}
                    {job.is_longterm && !job.cancel_requested_by && (
                      <button
                        onClick={() => setRequestCancelModal({
                          postId: job.post_id,
                          title: job.title,
                          reason: '',
                          error: null,
                          submitting: false,
                        })}
                        className="w-full py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-500/30"
                      >
                        <X className="inline w-4 h-4" /> Request Contract Cancellation
                      </button>
                    )}

                    {/* Worker requested — waiting for owner */}
                    {job.is_longterm && job.cancel_requested_by === 'worker' && (
                      <div className="rounded-xl border-2 border-orange-300 dark:border-orange-500/40 bg-orange-50 dark:bg-orange-500/10 p-3 space-y-1">
                        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-bold text-sm">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          Cancellation Requested — Awaiting Owner Approval
                        </div>
                        {job.cancel_request_reason && (
                          <p className="text-xs text-orange-700/80 dark:text-orange-200/70 italic">Your reason: "{job.cancel_request_reason}"</p>
                        )}
                      </div>
                    )}

                    {/* Owner requested — worker must approve or reject */}
                    {job.is_longterm && job.cancel_requested_by === 'employer' && (
                      <div className="rounded-xl border-2 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-bold text-sm">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          House Owner Wants to End the Contract
                        </div>
                        {job.cancel_request_reason && (
                          <p className="text-xs text-red-700/80 dark:text-red-200/70 italic">Reason: "{job.cancel_request_reason}"</p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={async () => {
                              const sure = await confirm({
                                title: 'Approve Contract Cancellation',
                                message: 'Are you sure you want to end this contract? This cannot be undone.',
                                confirmLabel: 'Yes, End Contract',
                                tone: 'danger'
                              });
                              if (sure) await handleRespondCancellation(job.post_id, 'approve');
                            }}
                            className="py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
                          >
                            <Check className="w-4 h-4" /> Accept & End
                          </button>
                          <button
                            onClick={() => setRespondCancelModal({
                              postId: job.post_id,
                              title: job.title,
                              requestReason: job.cancel_request_reason || '',
                              rejectReason: '',
                              error: null,
                              submitting: false,
                            })}
                            className="py-2 rounded-lg bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-white text-sm font-bold hover:bg-gray-300 dark:hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {job.payments.pending_payments > 0 && (
                      <button
                        onClick={() => onReportUnpaid(job)}
                        className="w-full py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-all shadow-md"
                      >
                        <AlertTriangle className="inline w-4 h-4 mr-1" /> Report Unpaid
                      </button>
                    )}
                  </>
                )}

                {myStatus === 'pending_completion' && (
                  <div className="py-3 text-center text-yellow-700 dark:text-yellow-300 font-bold bg-yellow-100 dark:bg-yellow-500/10 rounded-lg">
                    <Clock className="inline w-4 h-4 mr-1" /> Waiting for owner to approve completion
                  </div>
                )}

                {myStatus === 'cancelled' && (
                  <div className="py-3 text-center text-red-700 dark:text-red-300 font-bold bg-red-100 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/30">
                    <AlertTriangle className="inline w-4 h-4 mr-1" /> This recurring job was cancelled
                    {job.cancelled_by ? ` by ${job.cancelled_by}.` : '.'}
                    {(job.recurring_cancellation_reason || job.cancellation_reason) && (
                      <div className="mt-2 text-sm font-medium text-red-700/90 dark:text-red-200/90">
                        Reason: {job.recurring_cancellation_reason || job.cancellation_reason}
                      </div>
                    )}
                  </div>
                )}

                {myStatus === 'completed' && !hasPendingPaymentConfirmation(job) && (
                  <>
                    <div className="py-3 text-center text-green-700 dark:text-green-300 font-bold bg-green-100 dark:bg-green-500/10 rounded-lg">
                      <CheckCircle className="inline w-4 h-4 mr-1" /> Job completed! Payment received.
                    </div>
                    <button
                      onClick={() => setShowSummaryJobId(job.post_id)}
                      className="w-full py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-all shadow-md"
                    >
                      <FileText className="inline w-4 h-4 mr-1" /> {job.is_longterm ? 'View Job Summary' : 'View Summary & Receipt'}
                    </button>
                    {onReportEmployer && (
                      reportedUsers?.has(`${job.post_id}-${job.employer.user_id}`) ? (
                        <div className="py-2 text-center text-orange-700 dark:text-orange-300 font-bold bg-orange-100 dark:bg-orange-500/10 rounded-lg">
                          ✓ You reported this house owner. Wait for admin review.
                        </div>
                      ) : (
                        <button
                          onClick={() => onReportEmployer(job)}
                          className="w-full py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-all shadow-md"
                        >
                          <Flag className="inline w-4 h-4 mr-1" /> Report House Owner
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === 1}
                className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-[#4B244A] dark:text-white">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contract Extension Response Modal */}
      {showExtensionResponse && (
        <ContractExtensionResponseModal
          isOpen={true}
          onClose={() => setShowExtensionResponse(null)}
          extension={showExtensionResponse}
          onSuccess={() => {
            setShowExtensionResponse(null);
            loadMyJobs();
          }}
        />
      )}

      {/* Payment Proof Modal */}
      {proofModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-120 flex items-start sm:items-center justify-center p-4 pt-20 sm:pt-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl max-h-[calc(100dvh-6rem)] sm:max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Owner Payment Proof</h3>
                <p className="text-xs text-[#4B244A]/60 dark:text-white/60 font-medium">{proofModal.jobTitle}</p>
              </div>
              <button
                onClick={() => setProofModal(null)}
                className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <img
                src={proofModal.url}
                alt="Owner payment proof"
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg border border-gray-200 dark:border-white/20 bg-gray-50 dark:bg-slate-800"
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Housekeeper Summary Modal */}
      {showSummaryJobId !== null && (
        <HousekeeperSummaryModal jobId={showSummaryJobId} onClose={() => setShowSummaryJobId(null)} />
      )}

      {/* Daily Completion Modal */}
      {showDailyCompletion && (
        <DailyCompletionModal
          postId={showDailyCompletion.post_id}
          jobTitle={showDailyCompletion.title}
          userRole="housekeeper"
          onClose={() => setShowDailyCompletion(null)}
          onDayConfirmed={() => loadMyJobs()}
        />
      )}

      {/* ── Request Cancellation Modal (Worker initiates) ── */}
      {requestCancelModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-4 pt-20 sm:pt-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Request Contract Cancellation</h3>
              <p className="mt-1 text-sm text-[#4B244A]/70 dark:text-white/70">
                You are requesting to end the long-term contract for "<span className="font-semibold">{requestCancelModal.title}</span>".
                The house owner must approve before the contract is cancelled.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-sm font-semibold text-[#4B244A] dark:text-white">Reason for cancellation</label>
              <textarea
                value={requestCancelModal.reason}
                onChange={(e) => setRequestCancelModal(prev => prev ? { ...prev, reason: e.target.value, error: null } : prev)}
                rows={4}
                maxLength={400}
                placeholder="Explain why you want to end this contract..."
                className="w-full rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#4B244A] dark:text-white outline-none focus:ring-2 focus:ring-[#EA526F]/40 focus:border-[#EA526F]"
              />
              <div className="flex items-center justify-between text-xs text-[#4B244A]/60 dark:text-white/60">
                <span>{requestCancelModal.error ? <span className="text-red-600 dark:text-red-400">{requestCancelModal.error}</span> : 'Reason is required.'}</span>
                <span>{requestCancelModal.reason.length}/400</span>
              </div>
            </div>
            <div className="p-5 pt-0 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRequestCancelModal(null)}
                disabled={requestCancelModal.submitting}
                className="py-2.5 rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Keep Contract
              </button>
              <button
                type="button"
                disabled={requestCancelModal.submitting}
                onClick={async () => {
                  const reason = requestCancelModal.reason.trim();
                  if (!reason) {
                    setRequestCancelModal(prev => prev ? { ...prev, error: 'Please enter a reason.' } : prev);
                    return;
                  }
                  setRequestCancelModal(prev => prev ? { ...prev, submitting: true, error: null } : prev);
                  const ok = await handleRequestCancellation(requestCancelModal.postId, reason);
                  if (ok) setRequestCancelModal(null);
                  else setRequestCancelModal(prev => prev ? { ...prev, submitting: false } : prev);
                }}
                className="py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {requestCancelModal.submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : 'Send Request'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Respond to Cancellation Modal (Worker rejects owner's request) ── */}
      {respondCancelModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-4 pt-20 sm:pt-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Reject Cancellation Request</h3>
              <p className="mt-1 text-sm text-[#4B244A]/70 dark:text-white/70">
                You are rejecting the owner's request to end "<span className="font-semibold">{respondCancelModal.title}</span>". Please provide a reason.
              </p>
              {respondCancelModal.requestReason && (
                <p className="mt-2 text-xs text-[#4B244A]/60 dark:text-white/60 italic">Owner's reason: "{respondCancelModal.requestReason}"</p>
              )}
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-sm font-semibold text-[#4B244A] dark:text-white">Your reason for rejecting</label>
              <textarea
                value={respondCancelModal.rejectReason}
                onChange={(e) => setRespondCancelModal(prev => prev ? { ...prev, rejectReason: e.target.value, error: null } : prev)}
                rows={3}
                maxLength={400}
                placeholder="Explain why the contract should continue..."
                className="w-full rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#4B244A] dark:text-white outline-none focus:ring-2 focus:ring-[#EA526F]/40 focus:border-[#EA526F]"
              />
              {respondCancelModal.error && <p className="text-xs text-red-600 dark:text-red-400">{respondCancelModal.error}</p>}
            </div>
            <div className="p-5 pt-0 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRespondCancelModal(null)}
                disabled={respondCancelModal.submitting}
                className="py-2.5 rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={respondCancelModal.submitting}
                onClick={async () => {
                  const reason = respondCancelModal.rejectReason.trim();
                  if (!reason) {
                    setRespondCancelModal(prev => prev ? { ...prev, error: 'Please enter a reason for rejecting.' } : prev);
                    return;
                  }
                  setRespondCancelModal(prev => prev ? { ...prev, submitting: true, error: null } : prev);
                  const ok = await handleRespondCancellation(respondCancelModal.postId, 'reject', reason);
                  if (ok) setRespondCancelModal(null);
                  else setRespondCancelModal(prev => prev ? { ...prev, submitting: false } : prev);
                }}
                className="py-2.5 rounded-lg bg-gray-700 text-white font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {respondCancelModal.submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Rejecting...</> : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDialog}
    </div>
  );
}

export type { AcceptedJob };