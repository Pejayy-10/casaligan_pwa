import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { RotateCw, Clock, CheckCircle, Briefcase, DollarSign, User, Phone, Mail, CreditCard, Calendar, BarChart2, AlertTriangle, ClipboardList } from 'lucide-react';
import ContractExtensionResponseModal, { type PendingExtension } from './ContractExtensionResponseModal';

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
    }>;
  };
}

interface Props {
  onShowProgress: (job: AcceptedJob) => void;
  onSubmitCompletion: (job: AcceptedJob) => void;
  onReportUnpaid: (job: AcceptedJob) => void;
  onShowPayments?: (job: AcceptedJob) => void;
  onReportEmployer?: (job: AcceptedJob) => void;
  reportedUsers?: Set<string>;
}

export default function HousekeeperMyJobs({ onShowProgress, onSubmitCompletion, onReportUnpaid, onShowPayments, onReportEmployer, reportedUsers }: Props) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<AcceptedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'pending_completion' | 'completed'>('all');
  const [showExtensionResponse, setShowExtensionResponse] = useState<PendingExtension | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    loadMyJobs(!initialLoadDone.current);
  }, [statusFilter]);

  // Listen for external events that should trigger a refresh (e.g. after submitting completion)
  useEffect(() => {
    const handleRefresh = () => loadMyJobs();
    window.addEventListener('my-jobs-updated', handleRefresh);
    return () => window.removeEventListener('my-jobs-updated', handleRefresh);
  }, [statusFilter]);

  const loadMyJobs = async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${API_BASE_URL}/jobs/my-accepted-jobs${statusFilter !== 'all' ? `?status_filter=${statusFilter}` : ''}`,
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
      initialLoadDone.current = true;
    }
  };

  const getStatusColor = (status: string, contractStatus?: string | null) => {
    // Use contract status if available (for individual worker's status)
    const effectiveStatus = contractStatus || status;
    switch (effectiveStatus) {
      case 'active':
      case 'ongoing': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
      case 'pending_completion': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300';
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string, contractStatus?: string | null) => {
    // Use contract status if available (for individual worker's status)
    const effectiveStatus = contractStatus || status;
    switch (effectiveStatus) {
      case 'active':
      case 'ongoing': return '<RotateCw className="inline w-4 h-4 mr-1" /> Ongoing';
      case 'pending_completion': return '<Clock className="inline w-4 h-4 mr-1" /> Pending Approval';
      case 'completed': return '<CheckCircle className="inline w-4 h-4 mr-1" /> Completed';
      default: return effectiveStatus;
    }
  };

  // Get the effective status for a job (use contract status for worker's individual progress)
  const getEffectiveStatus = (job: AcceptedJob): string => {
    return job.contract?.status || job.status;
  };

  // Check if job has payment pending confirmation (payment sent but not confirmed by worker)
  const hasPendingPaymentConfirmation = (job: AcceptedJob): boolean => {
    return job.payments?.schedules?.some(s => s.status === 'sent' || s.status === 'SENT') || false;
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#EA526F]"></div>
        <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading your jobs...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status Filter Tabs */}
      <div className="mb-6 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-white/10">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-[#4B244A] text-[#4B244A] dark:text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <ClipboardList className="inline w-4 h-4 mr-1" /> All Jobs
          </button>
          <button
            onClick={() => setStatusFilter('ongoing')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'ongoing'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <RotateCw className="inline w-4 h-4 mr-1" /> Ongoing
          </button>
          <button
            onClick={() => setStatusFilter('pending_completion')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusFilter === 'pending_completion'
                ? 'bg-yellow-500 text-white shadow-md'
                : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
          >
            <Clock className="inline w-4 h-4 mr-1" /> Pending
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
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
          <h3 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">No Accepted Jobs</h3>
          <p className="text-[#4B244A]/70 dark:text-white/70 mb-6 font-medium">
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
            <div key={job.post_id} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/50 dark:border-white/10 shadow-lg transition-all">
              {/* Header */}
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-[#4B244A] dark:text-white">{job.title}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(job.status, job.contract?.status)}`}>
                  {getStatusLabel(job.status, job.contract?.status)}
                </span>
              </div>

              {/* Description */}
              <p className="text-[#4B244A]/70 dark:text-white/70 mb-4 line-clamp-2">{job.description}</p>

              {/* Job Details */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 rounded-lg text-sm font-semibold">
                  <DollarSign className="inline w-4 h-4 mr-1" /> ₱{job.budget}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 rounded-lg text-sm font-semibold">
                  📍 {job.location}
                </span>
                {job.is_longterm && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 rounded-lg text-sm font-semibold">
                    📆 Long-term
                  </span>
                )}
              </div>

              {/* Employer Info */}
              <div className="bg-white/50 dark:bg-white/5 rounded-lg p-3 mb-4 border border-gray-200 dark:border-white/10">
                <h4 className="text-sm font-bold text-[#4B244A] dark:text-white mb-2"><User className="inline w-4 h-4 mr-1" /> Employer</h4>
                <div className="text-sm text-[#4B244A]/70 dark:text-white/70 space-y-1 font-medium">
                  <p>{job.employer.name}</p>
                  {job.employer.phone && <p><Phone className="inline w-4 h-4 mr-1" />{job.employer.phone}</p>}
                  {job.employer.email && <p><Mail className="inline w-4 h-4 mr-1" />{job.employer.email}</p>}
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

              {/* Action Buttons - Use myStatus (contract status) for individual worker state */}
              <div className="space-y-2">                {/* Show payment confirmation if payment is sent but not confirmed */}
                {hasPendingPaymentConfirmation(job) && (
                  <>
                    <div className="py-3 text-center text-blue-700 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/30">
                      <DollarSign className="inline w-4 h-4 mr-1" /> Payment Sent - Review Required!
                    </div>
                    <button
                      onClick={async () => {
                        if (window.confirm('Confirm that you have received the payment?')) {
                          try {
                            const token = localStorage.getItem('access_token');
                            // Get the transaction_id from the payment schedule with 'sent' status
                            const sentPayment = job.payments.schedules.find(s => s.status === 'sent' || s.status === 'SENT');
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
                    <button
                      onClick={() => onShowProgress(job)}
                      className="w-full py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-all shadow-md"
                    >
                      <BarChart2 className="inline w-4 h-4 mr-1" /> View Progress
                    </button>
                    {/* Show Payment Tracker button for all job types */}
                    {onShowPayments && (
                      <button
                        onClick={() => onShowPayments(job)}
                        className="w-full py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all shadow-md"
                      >
                        <DollarSign className="inline w-4 h-4 mr-1" /> View Payments {job.payments.schedules?.some(s => s.status === 'sent' || s.status === 'SENT') && '(Action Required!)'}
                      </button>
                    )}
                    {/* Only show Submit Completion for short-term jobs */}
                    {!job.is_longterm && (
                      <button
                        onClick={() => onSubmitCompletion(job)}
                        className="w-full py-2 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 transition-all shadow-md"
                      >
                        <CheckCircle className="inline w-4 h-4 mr-1" /> Submit Completion
                      </button>
                    )}
                    {/* For long-term jobs, show info about auto-completion */}
                    {job.is_longterm && (
                      <div className="py-2 text-center text-blue-700 dark:text-blue-300 text-sm bg-blue-100 dark:bg-blue-500/10 rounded-lg font-medium">
                        <DollarSign className="inline w-4 h-4 mr-1" /> Job completes when all payments are confirmed
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

                {myStatus === 'completed' && !hasPendingPaymentConfirmation(job) && (
                  <>
                    <div className="py-3 text-center text-green-700 dark:text-green-300 font-bold bg-green-100 dark:bg-green-500/10 rounded-lg">
                      <CheckCircle className="inline w-4 h-4 mr-1" /> Job completed! Payment received.
                    </div>
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
                          🚨 Report House Owner
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          );
          })}
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
    </div>
  );
}

export type { AcceptedJob };