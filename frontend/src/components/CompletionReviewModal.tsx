import { useState, useEffect } from 'react';

interface WorkerCompletion {
  contract_id: number;
  worker_id: number;
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
  const [payingWorker, setPayingWorker] = useState<WorkerCompletion | null>(null);
  const [paymentProof, setPaymentProof] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

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
        
        // For short-term jobs, show payment screen
        if (details?.duration_type === 'short_term') {
          setPayingWorker(worker);
        } else {
          // Reload details to reflect changes
          await loadDetails();
          
          // If all workers are completed, close modal
          if (result.all_completed) {
            onApproved();
          }
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

  const handlePaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingProof(true);
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://127.0.0.1:8000/upload/image?category=payment', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentProof(`http://127.0.0.1:8000${data.url}`);
      } else {
        alert('Failed to upload payment proof');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload payment proof');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!payingWorker) return;
    
    try {
      setProcessingWorker(payingWorker.contract_id);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/record-short-term-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: details?.budget || 0,
          proof_url: paymentProof,
          contract_id: payingWorker.contract_id,
          payment_method: paymentMethod,
          reference_number: paymentMethod !== 'cash' ? referenceNumber : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Payment to ${payingWorker.worker_name} recorded!`);
        setPayingWorker(null);
        setPaymentProof(null);
        setPaymentMethod('gcash');
        setReferenceNumber('');
        
        // If backend says all are paid, close immediately
        if (result.job_completed || result.all_paid) {
          onApproved();
          return;
        }
        
        // Otherwise reload details to reflect changes
        await loadDetails();
        
        // Double-check if all workers are now completed/paid
        const updatedDetails = await (await fetch(`http://127.0.0.1:8000/jobs/${jobId}/completion-details`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })).json();
        
        const allPaid = updatedDetails.workers.every((w: WorkerCompletion) => w.paid_at);
        if (allPaid) {
          onApproved();
        }
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

  // Payment screen for a specific worker
  if (payingWorker) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">💰 Pay {payingWorker.worker_name}</h2>
              <button onClick={() => {
                setPayingWorker(null);
                setPaymentProof(null);
                setPaymentMethod('gcash');
                setReferenceNumber('');
              }} className="text-white/60 hover:text-white">✕</button>
            </div>
            <p className="text-white/60 text-sm mt-1">{jobTitle}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-green-300">✅ {payingWorker.worker_name}'s work approved!</p>
            </div>

            <div className="bg-white/10 rounded-xl p-6 text-center">
              <p className="text-white/60 text-sm mb-2">Amount to Pay</p>
              <p className="text-4xl font-bold text-[#EA526F]">₱{details?.budget?.toLocaleString()}</p>
              <p className="text-white/50 text-sm mt-2">per housekeeper</p>
            </div>

            {/* Payment Method Selection */}
            <div>
              <label className="block text-white font-semibold mb-2">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="gcash">GCash</option>
                <option value="maya">Maya (PayMaya)</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            {/* Reference Number - only for non-cash payments */}
            {paymentMethod !== 'cash' && (
              <div>
                <label className="block text-white font-semibold mb-2">Reference Number *</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Enter transaction reference number"
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                />
              </div>
            )}

            <div>
              <label className="block text-white font-semibold mb-2">Upload Payment Proof (Optional)</label>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white/20 border-2 border-dashed border-white/30 rounded-xl text-white cursor-pointer hover:bg-white/30 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {uploadingProof ? 'Uploading...' : paymentProof ? 'Change Proof' : 'Upload Screenshot'}
                <input type="file" accept="image/*" onChange={handlePaymentProofUpload} disabled={uploadingProof} className="hidden" />
              </label>
              {paymentProof && (
                <div className="mt-3 bg-white/10 rounded-lg p-2">
                  <img src={paymentProof} alt="Payment proof" className="w-full h-32 object-cover rounded" />
                </div>
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-300 text-sm">
                💡 Pay via GCash, bank transfer, cash, etc. and upload proof for your records.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => {
                setPayingWorker(null);
                setPaymentProof(null);
                setPaymentMethod('gcash');
                setReferenceNumber('');
              }} className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all">
                Pay Later
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={processingWorker === payingWorker.contract_id || (paymentMethod !== 'cash' && !referenceNumber.trim())}
                className="flex-1 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
              >
                {processingWorker === payingWorker.contract_id ? 'Processing...' : '✅ Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">📋 Review Job Completion</h2>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">✕</button>
          </div>
          <p className="text-white/60 text-sm mt-1">{jobTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
              <p className="text-white/70 mt-4">Loading details...</p>
            </div>
          ) : details ? (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className="flex items-center justify-between bg-white/10 rounded-xl p-4">
                <div>
                  <p className="text-white/60 text-sm">Job Status</p>
                  <p className="text-white font-semibold capitalize">{details.status.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-sm">Budget per Worker</p>
                  <p className="text-[#EA526F] font-bold text-xl">₱{details.budget?.toLocaleString()}</p>
                </div>
              </div>

              {/* Workers List */}
              <div>
                <h3 className="text-white font-semibold mb-3">
                  👷 Housekeepers ({details.workers?.length || 0})
                </h3>
                
                {details.workers?.length === 0 ? (
                  <div className="bg-white/10 rounded-xl p-4 text-center text-white/60">
                    No housekeepers assigned yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {details.workers?.map((worker) => {
                      const statusBadge = getWorkerStatusBadge(worker);
                      
                      return (
                        <div key={worker.contract_id} className="bg-white/10 rounded-xl p-4 border border-white/10">
                          {/* Worker Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#EA526F] flex items-center justify-center text-white font-bold">
                                {worker.worker_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-white font-semibold">{worker.worker_name}</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge.class}`}>
                                  {statusBadge.text}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Completion Proof */}
                          {worker.completion_proof_url && (
                            <div className="mb-3">
                              <p className="text-white/60 text-sm mb-2">📷 Proof of Completion</p>
                              <img 
                                src={worker.completion_proof_url} 
                                alt="Completion proof" 
                                className="w-full h-40 object-cover rounded-lg border border-white/20"
                              />
                            </div>
                          )}

                          {/* Completion Notes */}
                          {worker.completion_notes && (
                            <div className="mb-3 bg-white/5 rounded-lg p-3">
                              <p className="text-white/60 text-sm mb-1">📝 Notes</p>
                              <p className="text-white/80 text-sm">{worker.completion_notes}</p>
                            </div>
                          )}

                          {/* Action Button */}
                          {worker.status === 'pending_completion' && (
                            <button
                              onClick={() => handleApproveWorker(worker)}
                              disabled={processingWorker === worker.contract_id}
                              className="w-full py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all disabled:opacity-50"
                            >
                              {processingWorker === worker.contract_id ? 'Approving...' : '✅ Approve & Pay'}
                            </button>
                          )}

                          {/* Status Messages */}
                          {worker.status === 'active' && (
                            <div className="text-center text-gray-400 text-sm py-2">
                              Still working on the job...
                            </div>
                          )}

                          {worker.paid_at && (
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
                              <p className="text-green-300 text-sm">
                                ✅ Paid on {new Date(worker.paid_at).toLocaleDateString()}
                              </p>
                            </div>
                          )}

                          {worker.status === 'completed' && !worker.paid_at && details.duration_type === 'short_term' && (
                            <button
                              onClick={() => setPayingWorker(worker)}
                              className="w-full py-2 bg-[#EA526F] text-white font-semibold rounded-lg hover:bg-[#d4486a] transition-all"
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
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  💡 Review each housekeeper's work and approve individually. 
                  {details.duration_type === 'short_term' 
                    ? ' Payment screen will appear after each approval.' 
                    : ' For long-term jobs, payments follow the payment schedule.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-white/60">No completion details found</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
