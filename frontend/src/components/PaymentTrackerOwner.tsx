import { useState, useEffect, useCallback, useRef } from 'react';

interface Payment {
  transaction_id: number;
  due_date: string;
  amount: number;
  status: 'pending' | 'sent' | 'confirmed' | 'overdue' | 'disputed';
  payment_proof_url?: string;
  payment_method?: string;
  reference_number?: string;
  sent_at?: string;
  confirmed_at?: string;
  disputed_at?: string;
  dispute_reason?: string;
  worker_id?: number;
  worker_name: string;
}

interface PaymentTrackerOwnerProps {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
}

export default function PaymentTrackerOwner({ jobId, jobTitle, onClose }: PaymentTrackerOwnerProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Report worker state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportWorkerId, setReportWorkerId] = useState<number | null>(null);
  const [reportWorkerName, setReportWorkerName] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportType, setReportType] = useState('non_completion');
  const [reportingWorker, setReportingWorker] = useState(false);

  const handleReportWorker = async () => {
    if (!reportWorkerId || !reportReason.trim()) {
      alert('Please provide a reason for the report');
      return;
    }

    setReportingWorker(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/report-non-performance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          worker_id: reportWorkerId,
          reason: reportReason,
          report_type: reportType
        })
      });

      if (response.ok) {
        alert('Report submitted successfully. Our team will review this case.');
        setShowReportModal(false);
        setReportWorkerId(null);
        setReportWorkerName('');
        setReportReason('');
        setReportType('non_completion');
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Failed to report worker:', error);
      alert('Failed to submit report');
    } finally {
      setReportingWorker(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setUploadingProof(true);
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'payment');

      const response = await fetch('http://127.0.0.1:8000/upload/image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setProofUrl(`http://127.0.0.1:8000${data.url}`);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to upload image');
        setPreviewImage(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
      setPreviewImage(null);
    } finally {
      setUploadingProof(false);
    }
  };

  const loadPayments = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/payments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleMarkAsSent = async () => {
    if (!selectedPayment || !proofUrl.trim()) {
      alert('Please enter proof of payment URL');
      return;
    }
    
    // Reference number is required for non-cash payments
    if (paymentMethod !== 'cash' && !referenceNumber.trim()) {
      alert('Please enter reference number');
      return;
    }

    setUploadingProof(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/payments/${selectedPayment.transaction_id}/mark-sent`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            payment_proof_url: proofUrl,
            payment_method: paymentMethod,
            reference_number: referenceNumber
          })
        }
      );

      if (response.ok) {
        alert('Payment marked as sent successfully!');
        setSelectedPayment(null);
        setProofUrl('');
        setReferenceNumber('');
        loadPayments();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to mark payment as sent');
      }
    } catch (error) {
      console.error('Failed to mark payment:', error);
      alert('Failed to mark payment as sent');
    } finally {
      setUploadingProof(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'sent':
        return 'bg-blue-500/20 text-blue-300';
      case 'confirmed':
        return 'bg-green-500/20 text-green-300';
      case 'overdue':
        return 'bg-red-500/20 text-red-300';
      case 'disputed':
        return 'bg-orange-500/20 text-orange-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'sent':
        return '📤';
      case 'confirmed':
        return '✅';
      case 'overdue':
        return '⚠️';
      case 'disputed':
        return '🚨';
      default:
        return '❓';
    }
  };

  const isOverdue = (payment: Payment) => {
    if (payment.status === 'pending') {
      return new Date(payment.due_date) < new Date();
    }
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-[#4B244A] to-[#6B3468] border-b border-white/20 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white">💰 Payment Tracker</h2>
            <button 
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors text-3xl leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-white/70 text-sm">{jobTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F] mb-4"></div>
              <p className="text-white/70">Loading payment schedule...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-white/70">No payment schedule found</p>
              <p className="text-white/50 text-sm mt-2">This may be a short-term job without scheduled payments</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Payment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total', count: payments.length, color: 'bg-white/10' },
                  { label: 'Pending', count: payments.filter(p => p.status === 'pending').length, color: 'bg-yellow-500/20' },
                  { label: 'Confirmed', count: payments.filter(p => p.status === 'confirmed').length, color: 'bg-green-500/20' },
                  { label: 'Overdue', count: payments.filter(p => isOverdue(p)).length, color: 'bg-red-500/20' }
                ].map((stat) => (
                  <div key={stat.label} className={`${stat.color} rounded-2xl p-4 border border-white/20`}>
                    <p className="text-white/70 text-sm">{stat.label}</p>
                    <p className="text-white text-2xl font-bold">{stat.count}</p>
                  </div>
                ))}
              </div>

              {/* Group payments by worker */}
              {(() => {
                const workerNames = [...new Set(payments.map(p => p.worker_name))];
                return workerNames.map((workerName) => {
                  const workerPayments = payments.filter(p => p.worker_name === workerName);
                  const workerTotal = workerPayments.reduce((sum, p) => sum + p.amount, 0);
                  const workerPending = workerPayments.filter(p => p.status === 'pending' || isOverdue(p)).length;
                  const workerConfirmed = workerPayments.filter(p => p.status === 'confirmed').length;
                  const workerId = workerPayments[0]?.worker_id;
                  
                  return (
                    <div key={workerName} className="bg-white/5 rounded-2xl border border-white/20 overflow-hidden">
                      {/* Worker Header */}
                      <div className="bg-gradient-to-r from-[#EA526F]/20 to-transparent px-5 py-4 border-b border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#EA526F] flex items-center justify-center text-white font-bold">
                              {workerName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-white font-bold text-lg">{workerName}</h3>
                              <p className="text-white/60 text-sm">
                                {workerPayments.length} payments • {workerConfirmed} confirmed
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-white/60 text-sm">Total Budget</p>
                              <p className="text-white font-bold text-xl">₱{workerTotal.toLocaleString()}</p>
                            </div>
                            {workerId && (
                              <button
                                onClick={() => {
                                  setReportWorkerId(workerId);
                                  setReportWorkerName(workerName);
                                  setShowReportModal(true);
                                }}
                                className="px-3 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-all text-sm"
                                title="Report issue with this worker"
                              >
                                🚨 Report
                              </button>
                            )}
                          </div>
                        </div>
                        {workerPending > 0 && (
                          <div className="mt-3 bg-yellow-500/20 text-yellow-200 text-sm px-3 py-2 rounded-lg">
                            ⚠️ {workerPending} payment{workerPending > 1 ? 's' : ''} pending
                          </div>
                        )}
                      </div>

                      {/* Worker's Payments */}
                      <div className="p-4 space-y-3">
                        {workerPayments.map((payment) => {
                          const overdue = isOverdue(payment);
                          return (
                            <div 
                              key={payment.transaction_id}
                              className={`bg-white/10 backdrop-blur-xl rounded-xl p-4 border ${
                                overdue ? 'border-red-500/50' : 'border-white/20'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(overdue ? 'overdue' : payment.status)}`}>
                                      {getStatusIcon(overdue ? 'overdue' : payment.status)} {(overdue ? 'OVERDUE' : payment.status).toUpperCase()}
                                    </span>
                                    {payment.dispute_reason && (
                                      <span className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-semibold">
                                        🚨 DISPUTED
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-white/60 text-sm">Due: {new Date(payment.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-white text-xl font-bold">₱{payment.amount.toLocaleString()}</p>
                                </div>
                              </div>

                              {payment.status === 'pending' && (
                                <button
                                  onClick={() => setSelectedPayment(payment)}
                                  className="w-full mt-2 px-4 py-2 bg-[#EA526F] text-white font-semibold rounded-lg hover:bg-[#d4486a] transition-all text-sm"
                                >
                                  📤 Mark Payment as Sent
                                </button>
                              )}

                              {payment.status === 'sent' && (
                                <div className="mt-2 bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                                  <p className="text-blue-200 text-xs">
                                    <strong>Waiting for confirmation...</strong> Sent on {payment.sent_at && new Date(payment.sent_at).toLocaleDateString()}
                                  </p>
                                </div>
                              )}

                              {payment.status === 'confirmed' && (
                                <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                                  <p className="text-green-200 text-xs">
                                    <strong>✅ Payment confirmed!</strong> {payment.confirmed_at && new Date(payment.confirmed_at).toLocaleDateString()}
                                  </p>
                                </div>
                              )}

                              {payment.dispute_reason && (
                                <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                                  <p className="text-red-200 text-xs">
                                    <strong>⚠️ Dispute:</strong> {payment.dispute_reason}
                                  </p>
                                </div>
                              )}

                              {payment.payment_proof_url && (
                                <div className="mt-2">
                                  <p className="text-white/70 text-xs mb-1">Proof of Payment:</p>
                                  <img 
                                    src={payment.payment_proof_url} 
                                    alt="Payment proof" 
                                    className="w-full h-32 object-cover rounded-lg border border-white/20"
                                  />
                                  <p className="text-white/50 text-xs mt-1">
                                    Method: {payment.payment_method?.toUpperCase()} | Ref: {payment.reference_number}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Upload Proof Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-lg w-full border border-white/20 shadow-2xl">
            <div className="border-b border-white/20 px-6 py-4">
              <h3 className="text-xl font-bold text-white">Upload Payment Proof</h3>
              <p className="text-white/70 text-sm">For payment due: {new Date(selectedPayment.due_date).toLocaleDateString()}</p>
            </div>

            <div className="p-6 space-y-4">
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
                <label className="block text-white font-semibold mb-2">Proof of Payment *</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingProof}
                  className="w-full py-4 border-2 border-dashed border-white/30 rounded-lg text-white/70 hover:border-[#EA526F] hover:text-[#EA526F] transition-all flex items-center justify-center gap-2"
                >
                  {uploadingProof ? '⏳ Uploading...' : '📤 Click to upload payment receipt'}
                </button>
                <p className="text-white/50 text-xs mt-1">
                  Supports: JPEG, PNG, GIF, WebP (max 10MB)
                </p>
              </div>

              {previewImage && (
                <div>
                  <p className="text-white/70 text-sm mb-2">Preview: {proofUrl && '✅ Uploaded'}</p>
                  <div className="relative">
                    <img 
                      src={previewImage} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-xl border border-white/20"
                    />
                    <button
                      onClick={() => {
                        setPreviewImage(null);
                        setProofUrl('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setSelectedPayment(null);
                    setProofUrl('');
                    setReferenceNumber('');
                    setPreviewImage(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkAsSent}
                  disabled={uploadingProof || !proofUrl.trim() || !referenceNumber.trim()}
                  className="flex-1 px-4 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingProof ? 'Uploading...' : '✅ Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Worker Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🚨</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Report Issue</h3>
                  <p className="text-sm text-gray-500">Report a problem with {reportWorkerName}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What happened? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Describe the issue (e.g., did not show up for work, left early without notice, poor quality work...)"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#EA526F] focus:outline-none transition-colors resize-none"
                    rows={4}
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">⚠️ Note:</span> Reports are reviewed by our team. 
                    False reports may result in account restrictions. Only report genuine issues.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setReportWorkerId(null);
                    setReportWorkerName('');
                    setReportReason('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportWorker}
                  disabled={reportingWorker || !reportReason.trim()}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reportingWorker ? 'Submitting...' : '📝 Submit Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
