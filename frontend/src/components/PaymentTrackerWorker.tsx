import { useState, useEffect, useCallback } from 'react';

interface Payment {
  transaction_id: number;
  schedule_id?: number;
  due_date: string;
  amount: number;
  status: 'pending' | 'sent' | 'confirmed' | 'overdue' | 'disputed';
  payment_proof_url?: string;
  payment_method?: string;
  reference_number?: string;
  sent_at?: string;
  confirmed_at?: string;
  dispute_reason?: string;
}

interface PaymentTrackerWorkerProps {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
}

export default function PaymentTrackerWorker({ jobId, jobTitle, onClose }: PaymentTrackerWorkerProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/my-payments`, {
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

  const handleConfirmPayment = async (transactionId: number) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/payments/${transactionId}/confirm`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        alert('Payment confirmed successfully!');
        loadPayments();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to confirm payment');
      }
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      alert('Failed to confirm payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReportIssue = async () => {
    if (!selectedPayment || !disputeReason.trim()) {
      alert('Please provide a reason for reporting');
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/payments/${selectedPayment.transaction_id}/report`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ dispute_reason: disputeReason })
        }
      );

      if (response.ok) {
        alert('Payment issue reported. Admin will review.');
        setShowReportModal(false);
        setSelectedPayment(null);
        setDisputeReason('');
        loadPayments();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to report issue');
      }
    } catch (error) {
      console.error('Failed to report issue:', error);
      alert('Failed to report issue');
    } finally {
      setProcessing(false);
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
            <h2 className="text-2xl font-bold text-white">💵 My Payments</h2>
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
            </div>
          ) : (
            <div className="space-y-4">
              {/* Payment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Total Earned', amount: payments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + p.amount, 0), color: 'bg-green-500/20' },
                  { label: 'Awaiting Confirmation', amount: payments.filter(p => p.status === 'sent').reduce((sum, p) => sum + p.amount, 0), color: 'bg-blue-500/20' },
                  { label: 'Pending', amount: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0), color: 'bg-yellow-500/20' }
                ].map((stat) => (
                  <div key={stat.label} className={`${stat.color} rounded-2xl p-4 border border-white/20`}>
                    <p className="text-white/70 text-sm">{stat.label}</p>
                    <p className="text-white text-2xl font-bold">₱{stat.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Payments List */}
              {payments.map((payment) => {
                const overdue = isOverdue(payment);
                return (
                  <div 
                    key={payment.transaction_id}
                    className={`bg-white/10 backdrop-blur-xl rounded-2xl p-5 border ${
                      overdue ? 'border-red-500/50' : 'border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(overdue ? 'overdue' : payment.status)}`}>
                          {(overdue ? 'OVERDUE' : payment.status).toUpperCase()}
                        </span>
                        <p className="text-white/60 text-sm mt-2">
                          Due: {new Date(payment.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white text-2xl font-bold">₱{payment.amount.toLocaleString()}</p>
                      </div>
                    </div>

                    {payment.status === 'pending' && !overdue && (
                      <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                        <p className="text-yellow-200 text-sm">
                          ⏳ Waiting for employer to send payment...
                        </p>
                      </div>
                    )}

                    {overdue && payment.status === 'pending' && (
                      <div className="mt-3 space-y-2">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                          <p className="text-red-200 text-sm">
                            ⚠️ <strong>Payment is overdue!</strong> Expected by {new Date(payment.due_date).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowReportModal(true);
                          }}
                          className="w-full px-4 py-2 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-all"
                        >
                          🚨 Report Payment Issue
                        </button>
                      </div>
                    )}

                    {payment.status === 'sent' && (
                      <div className="mt-3 space-y-3">
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                          <p className="text-blue-200 text-sm">
                            📤 <strong>Payment sent by employer!</strong> Sent on {payment.sent_at && new Date(payment.sent_at).toLocaleDateString()}
                          </p>
                        </div>

                        {payment.payment_proof_url && (
                          <div>
                            <p className="text-white font-semibold mb-2">Proof of Payment:</p>
                            <img 
                              src={payment.payment_proof_url} 
                              alt="Payment proof" 
                              className="w-full h-64 object-cover rounded-xl border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(payment.payment_proof_url, '_blank')}
                            />
                            <p className="text-white/70 text-sm mt-2">
                              <strong>Method:</strong> {payment.payment_method?.toUpperCase()}<br/>
                              <strong>Reference:</strong> {payment.reference_number}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirmPayment(payment.transaction_id)}
                            disabled={processing}
                            className="flex-1 px-4 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                          >
                            ✅ Confirm Received
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowReportModal(true);
                            }}
                            disabled={processing}
                            className="flex-1 px-4 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50"
                          >
                            ⚠️ Report Issue
                          </button>
                        </div>
                      </div>
                    )}

                    {payment.status === 'confirmed' && (
                      <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                        <p className="text-green-200 text-sm">
                          ✅ <strong>Payment confirmed!</strong> Received on {payment.confirmed_at && new Date(payment.confirmed_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {payment.dispute_reason && (
                      <div className="mt-3 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
                        <p className="text-orange-200 text-sm">
                          <strong>🚨 Issue Reported:</strong> {payment.dispute_reason}
                          <br/>Admin is reviewing this case.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Report Issue Modal */}
      {showReportModal && selectedPayment && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-lg w-full border border-white/20 shadow-2xl">
            <div className="border-b border-white/20 px-6 py-4">
              <h3 className="text-xl font-bold text-white">🚨 Report Payment Issue</h3>
              <p className="text-white/70 text-sm">For payment due: {new Date(selectedPayment.due_date).toLocaleDateString()}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-white font-semibold mb-2">Describe the issue *</label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={5}
                  placeholder="e.g., Payment not received, incorrect amount, wrong method used..."
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
                />
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                <p className="text-yellow-200 text-xs">
                  <strong>Note:</strong> This will notify the platform admin who will investigate the issue and mediate between you and the employer.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowReportModal(false);
                    setSelectedPayment(null);
                    setDisputeReason('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportIssue}
                  disabled={processing || !disputeReason.trim()}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? 'Reporting...' : '🚨 Submit Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
