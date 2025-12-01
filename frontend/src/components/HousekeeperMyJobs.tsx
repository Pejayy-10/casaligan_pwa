import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

interface AcceptedJob {
  post_id: number;
  title: string;
  description: string;
  location: string;
  budget: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  is_longterm: boolean;
  accepted_at: string | null;
  employer: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  contract: {
    contract_id: number | null;
    status: string | null;
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
    }>;
  };
}

interface Props {
  onShowProgress: (job: AcceptedJob) => void;
  onSubmitCompletion: (job: AcceptedJob) => void;
  onReportUnpaid: (job: AcceptedJob) => void;
  onShowPayments?: (job: AcceptedJob) => void;
}

export default function HousekeeperMyJobs({ onShowProgress, onSubmitCompletion, onReportUnpaid, onShowPayments }: Props) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<AcceptedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'pending_completion' | 'completed'>('all');

  useEffect(() => {
    loadMyJobs();
  }, [statusFilter]);

  const loadMyJobs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/jobs/my-accepted-jobs${statusFilter !== 'all' ? `?status_filter=${statusFilter}` : ''}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
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

  const getStatusColor = (status: string, contractStatus?: string | null) => {
    // Use contract status if available (for individual worker's status)
    const effectiveStatus = contractStatus || status;
    switch (effectiveStatus) {
      case 'active':
      case 'ongoing': return 'bg-blue-500/20 text-blue-300';
      case 'pending_completion': return 'bg-yellow-500/20 text-yellow-300';
      case 'completed': return 'bg-green-500/20 text-green-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusLabel = (status: string, contractStatus?: string | null) => {
    // Use contract status if available (for individual worker's status)
    const effectiveStatus = contractStatus || status;
    switch (effectiveStatus) {
      case 'active':
      case 'ongoing': return '🔄 Ongoing';
      case 'pending_completion': return '⏳ Pending Approval';
      case 'completed': return '✅ Completed';
      default: return effectiveStatus;
    }
  };

  // Get the effective status for a job (use contract status for worker's individual progress)
  const getEffectiveStatus = (job: AcceptedJob): string => {
    return job.contract?.status || job.status;
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#EA526F]"></div>
        <p className="text-white/70 mt-4">Loading your jobs...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status Filter Tabs */}
      <div className="mb-4 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-[#4B244A] shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            📋 All Jobs
          </button>
          <button
            onClick={() => setStatusFilter('ongoing')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === 'ongoing'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            🔄 Ongoing
          </button>
          <button
            onClick={() => setStatusFilter('pending_completion')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === 'pending_completion'
                ? 'bg-yellow-500 text-white shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            ⏳ Pending Approval
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === 'completed'
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            ✅ Completed
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/20">
          <div className="text-6xl mb-4">💼</div>
          <h3 className="text-2xl font-bold text-white mb-2">No Accepted Jobs</h3>
          <p className="text-white/70 mb-6">
            {statusFilter === 'all' 
              ? "You haven't been accepted to any jobs yet. Keep applying!" 
              : `No ${statusFilter.replace('_', ' ')} jobs found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            // Use contract status for individual worker's progress
            const myStatus = getEffectiveStatus(job);
            
            return (
            <div key={job.post_id} className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20">
              {/* Header */}
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white">{job.title}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status, job.contract?.status)}`}>
                  {getStatusLabel(job.status, job.contract?.status)}
                </span>
              </div>

              {/* Description */}
              <p className="text-white/70 mb-4 line-clamp-2">{job.description}</p>

              {/* Job Details */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm font-semibold">
                  💰 ₱{job.budget}
                </span>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-semibold">
                  📍 {job.location}
                </span>
                {job.is_longterm && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-semibold">
                    📆 Long-term
                  </span>
                )}
              </div>

              {/* Employer Info */}
              <div className="bg-white/5 rounded-lg p-3 mb-4">
                <h4 className="text-sm font-semibold text-white/80 mb-2">👤 Employer</h4>
                <div className="text-sm text-white/70 space-y-1">
                  <p>{job.employer.name}</p>
                  {job.employer.phone && <p>📞 {job.employer.phone}</p>}
                  {job.employer.email && <p>✉️ {job.employer.email}</p>}
                </div>
              </div>

              {/* Payment Summary (for long-term jobs) */}
              {job.is_longterm && job.payments && (
                <div className="bg-white/5 rounded-lg p-3 mb-4">
                  <h4 className="text-sm font-semibold text-white/80 mb-2">💳 Payment Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-green-500/10 rounded-lg p-2 text-center">
                      <div className="text-green-300 font-bold">₱{job.payments.total_earned.toLocaleString()}</div>
                      <div className="text-white/60 text-xs">Earned</div>
                    </div>
                    <div className="bg-yellow-500/10 rounded-lg p-2 text-center">
                      <div className="text-yellow-300 font-bold">{job.payments.pending_payments}</div>
                      <div className="text-white/60 text-xs">Pending</div>
                    </div>
                  </div>
                  {job.payments.next_payment_due && (
                    <p className="text-xs text-white/60 mt-2">
                      📅 Next payment due: {new Date(job.payments.next_payment_due).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Date Range */}
              {job.start_date && job.end_date && (
                <div className="text-sm text-white/60 mb-4">
                  📅 {new Date(job.start_date).toLocaleDateString()} - {new Date(job.end_date).toLocaleDateString()}
                </div>
              )}

              {/* Action Buttons - Use myStatus (contract status) for individual worker state */}
              <div className="space-y-2">
                {(myStatus === 'ongoing' || myStatus === 'active') && (
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
                      className="w-full py-2 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-all"
                    >
                      💬 Message Employer
                    </button>
                    <button
                      onClick={() => onShowProgress(job)}
                      className="w-full py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all"
                    >
                      📊 View Progress
                    </button>
                    {/* Show Payment Tracker button for all job types */}
                    {onShowPayments && (
                      <button
                        onClick={() => onShowPayments(job)}
                        className="w-full py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all"
                      >
                        💰 View Payments {job.payments.schedules?.some(s => s.status === 'sent' || s.status === 'SENT') && '(Action Required!)'}
                      </button>
                    )}
                    {/* Only show Submit Completion for short-term jobs */}
                    {!job.is_longterm && (
                      <button
                        onClick={() => onSubmitCompletion(job)}
                        className="w-full py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-all"
                      >
                        ✅ Submit Completion
                      </button>
                    )}
                    {/* For long-term jobs, show info about auto-completion */}
                    {job.is_longterm && (
                      <div className="py-2 text-center text-blue-300 text-sm bg-blue-500/10 rounded-lg">
                        💰 Job completes when all payments are confirmed
                      </div>
                    )}
                    {job.payments.pending_payments > 0 && (
                      <button
                        onClick={() => onReportUnpaid(job)}
                        className="w-full py-2 bg-red-500/80 text-white font-semibold rounded-lg hover:bg-red-600 transition-all"
                      >
                        ⚠️ Report Unpaid
                      </button>
                    )}
                  </>
                )}

                {myStatus === 'pending_completion' && (
                  <div className="py-3 text-center text-yellow-300 font-semibold bg-yellow-500/10 rounded-lg">
                    ⏳ Waiting for owner to approve completion
                  </div>
                )}

                {myStatus === 'completed' && (
                  <div className="py-3 text-center text-green-300 font-semibold bg-green-500/10 rounded-lg">
                    ✅ Job completed! Payment received.
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

export type { AcceptedJob };
