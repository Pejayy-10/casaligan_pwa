import { useState, useEffect } from 'react';
import { usePayment } from '../context/PaymentContext';

interface WorkerCompletion {
  contract_id: number;
  worker_id: number;
  worker_user_id: number;
  worker_name: string;
  status: string;
  completion_proof_url: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  payment_proof_url: string | null;
  paid_at: string | null;
}

interface CompletionDetails {
  post_id: number;
  title: string;
  status: string;
  duration_type: string;
  budget: number;
  workers: WorkerCompletion[];
  // Legacy fields
  completion_proof_url: string | null;
  completion_notes: string | null;
  completed_at: string | null;
}

interface Props {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
  onApproved: () => void;
}

export default function CompletionReviewModal({ jobId, jobTitle, onClose, onApproved }: Props) {
  const [details, setDetails] = useState<CompletionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingWorker, setProcessingWorker] = useState<number | null>(null);
  const { initiatePayment } = usePayment();

  useEffect(() => {
    loadDetails();
  }, [jobId]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/completion-details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDetails(data);
      }
    } catch (error) {
      console.error('Load details error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWorker = async (worker: WorkerCompletion) => {
    // For short-term jobs, show payment modal first - don't approve until payment is done
    if (details?.duration_type === 'short_term') {
      initiatePayment({
        title: jobTitle,
        amount: details?.budget || 0,
        description: `Payment for ${jobTitle}`,
        recipientName: worker.worker_name,
        requireProof: true,
        onSuccess: async (paymentData) => {
          await handleConfirmPayment(worker, paymentData);
        },
        onCancel: () => {
          // Payment cancelled - job stays pending_completion
        }
      });
      return;
    }
    
    // For long-term jobs, approve immediately (they have payment schedules)
    try {
      setProcessingWorker(worker.contract_id);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/approve-completion?contract_id=${worker.contract_id}`, 
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        // Reload details to reflect changes
        await loadDetails();
        
        // If all workers are completed, close modal
        if (result.all_completed) {
          onApproved();
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to approve completion');
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert('Failed to approve completion');
    } finally {
      setProcessingWorker(null);
    }
  };

  const handleConfirmPayment = async (worker: WorkerCompletion, paymentData: any) => {
    try {
      setProcessingWorker(worker.contract_id);
      const token = localStorage.getItem('access_token');
      
      // First, approve the completion
      const approveResponse = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/approve-completion?contract_id=${worker.contract_id}`, 
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!approveResponse.ok) {
        const error = await approveResponse.json();
        alert(error.detail || 'Failed to approve completion');
        setProcessingWorker(null);
        return;
      }
      
      // Then record the payment
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/record-short-term-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: details?.budget || 0,
          proof_url: paymentData.proofUrl,
          contract_id: worker.contract_id,
          payment_method: paymentData.method,
          reference_number: paymentData.referenceNumber
        })
      });

      if (response.ok) {
        // Reload details to show updated payment status
        await loadDetails();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to record payment');
    } finally {
      setProcessingWorker(null);
    }
  };

  const getWorkerStatusBadge = (worker: WorkerCompletion) => {
    if (worker.paid_at) {
      return { text: '💰 Paid', class: 'bg-green-500/20 text-green-300' };
    }
    if (worker.status === 'completed') {
      return { text: '✅ Approved', class: 'bg-blue-500/20 text-blue-300' };
    }
    if (worker.status === 'pending_completion') {
      return { text: '⏳ Awaiting Approval', class: 'bg-yellow-500/20 text-yellow-300' };
    }
    if (worker.status === 'active') {
      return { text: '🔄 In Progress', class: 'bg-gray-500/20 text-gray-300' };
    }
    return { text: worker.status, class: 'bg-gray-500/20 text-gray-300' };
  };

  // Payment modal is handled by PaymentContext now - no custom UI needed
  
   return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-[#E8E4E1]/95 dark:bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">📋 Review Job Completion</h2>
            <button 
              onClick={onClose} 
              className="text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white transition-colors text-2xl"
            >
              ✕
            </button>
          </div>
          <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-1 font-medium">{jobTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
              <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading details...</p>
            </div>
          ) : details ? (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className="flex items-center justify-between bg-white/50 dark:bg-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <div>
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-sm font-medium">Job Status</p>
                  <p className="text-[#4B244A] dark:text-white font-bold capitalize">{details.status.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-sm font-medium">Budget per Worker</p>
                  <p className="text-[#EA526F] font-bold text-xl">₱{details.budget?.toLocaleString()}</p>
                </div>
              </div>

              {/* Workers List */}
              <div>
                <h3 className="text-[#4B244A] dark:text-white font-bold mb-3">
                  👷 Housekeepers ({details.workers?.length || 0})
                </h3>
                
                {details.workers?.length === 0 ? (
                  <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 text-center text-[#4B244A]/60 dark:text-white/60 border border-gray-200 dark:border-white/10">
                    No housekeepers assigned yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {details.workers?.map((worker) => {
                      const statusBadge = getWorkerStatusBadge(worker);
                      
                      return (
                        <div key={worker.contract_id} className="bg-white/60 dark:bg-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/10 shadow-sm">
                          {/* Worker Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#EA526F] flex items-center justify-center text-white font-bold shadow-md">
                                {worker.worker_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-[#4B244A] dark:text-white font-bold">{worker.worker_name}</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge.class}`}>
                                  {statusBadge.text}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Completion Proof */}
                          {worker.completion_proof_url && (
                            <div className="mb-3">
                              <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mb-2 font-medium">📷 Proof of Completion</p>
                              <img 
                                src={worker.completion_proof_url} 
                                alt="Completion proof" 
                                className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-white/20"
                              />
                            </div>
                          )}

                          {/* Completion Notes */}
                          {worker.completion_notes && (
                            <div className="mb-3 bg-white/50 dark:bg-white/5 rounded-lg p-3 border border-gray-100 dark:border-white/5">
                              <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mb-1 font-bold">📝 Notes</p>
                              <p className="text-[#4B244A]/80 dark:text-white/80 text-sm">{worker.completion_notes}</p>
                            </div>
                          )}

                          {/* Action Button */}
                          {worker.status === 'pending_completion' && (
                            <button
                              onClick={() => handleApproveWorker(worker)}
                              disabled={processingWorker === worker.contract_id}
                              className="w-full py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 shadow-md"
                            >
                              {processingWorker === worker.contract_id ? 'Approving...' : '✅ Approve & Pay'}
                            </button>
                          )}

                          {/* Status Messages */}
                          {worker.status === 'active' && (
                            <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-2 font-medium">
                              Still working on the job...
                            </div>
                          )}

                          {worker.paid_at && (
                            <div className="bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-2 text-center">
                              <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                                ✅ Paid on {new Date(worker.paid_at).toLocaleDateString()}
                              </p>
                            </div>
                          )}

                          {worker.status === 'completed' && !worker.paid_at && details.duration_type === 'short_term' && (
                            <button
                              onClick={() => {
                                initiatePayment({
                                  title: jobTitle,
                                  amount: details?.budget || 0,
                                  description: `Payment for ${jobTitle}`,
                                  recipientName: worker.worker_name,
                                  requireProof: true,
                                  onSuccess: async (paymentData) => {
                                    await handleConfirmPayment(worker, paymentData);
                                  },
                                  onCancel: () => {}
                                });
                              }}
                              className="w-full py-2 bg-[#EA526F] text-white font-bold rounded-lg hover:bg-[#d4486a] transition-all shadow-md"
                            >
                              💰 Pay Now
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-800 dark:text-blue-300 text-sm font-medium">
                  💡 Review each housekeeper's work and approve individually. 
                  {details.duration_type === 'short_term' 
                    ? ' Payment screen will appear after each approval.' 
                    : ' For long-term jobs, payments follow the payment schedule.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-[#4B244A]/60 dark:text-white/60 font-medium">No completion details found</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}