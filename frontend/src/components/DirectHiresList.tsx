import { useState, useEffect, useRef, type JSX } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { Clock, RotateCw, FileText, CheckCircle, CreditCard, ClipboardList, Calendar, X, Star, Briefcase, Loader2, Cross, MapPin, User } from 'lucide-react';
import RatingModal from './RatingModal';
import DailyCompletionModal from './DailyCompletionModal';
import ReferHousekeeperModal from './ReferHousekeeperModal';
import DirectHireReceiptModal from './DirectHireReceiptModal';
import apiClient from '../services/api';
import { usePayment } from '../context/PaymentContext';

const resolveUploadUrl = (url: string) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
};

interface Package {
  package_id: number;
  name: string;
  price: number;
  duration_hours: number;
  services: string[];
}

interface DirectHire {
  hire_id: number;
  employer_id: number;
  worker_id: number;
  worker_user_id: number;
  worker_name: string;
  employer_name: string;
  package_ids: number[];
  packages: Package[];
  total_amount: number;
  platform_fee_percentage?: number;
  platform_fee_amount?: number;
  platform_fee_status?: string;
  platform_fee_checkout_id?: string | null;
  platform_fee_reference?: string | null;
  platform_fee_paid_at?: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  address_street: string | null;
  address_barangay: string | null;
  address_city: string | null;
  address_province: string | null;
  address_region: string | null;
  special_instructions: string | null;
  status: string;
  completion_proof_url: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  payment_method: string | null;
  payment_proof_url: string | null;
  paid_at: string | null;
  created_at: string;
  is_recurring?: boolean;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  frequency?: string | null;
  recurring_status?: string | null;
  recurring_cancelled_at?: string | null;
  recurring_cancellation_reason?: string | null;
  cancelled_by?: string | null;
  num_days?: number | null;
  daily_start_time?: string | null;
  daily_end_time?: string | null;
  end_date?: string | null;
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
  role: 'owner' | 'housekeeper';
  onClose?: () => void;
}

export default function DirectHiresList({ role, onClose }: Props) {
  const navigate = useNavigate();
  const { initiatePayment } = usePayment();
  const [hires, setHires] = useState<DirectHire[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingFee, setVerifyingFee] = useState(false);
  const [selectedHire, setSelectedHire] = useState<DirectHire | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Completion state for housekeeper
  const [completionProof, setCompletionProof] = useState('');
  const [completionPreview, setCompletionPreview] = useState<string | null>(null);
  const [uploadingCompletion, setUploadingCompletion] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const completionFileRef = useRef<HTMLInputElement>(null);
  
  // Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingHire, setRatingHire] = useState<DirectHire | null>(null);
  const [ratedHires, setRatedHires] = useState<Set<number>>(new Set());
  
  // Cancel recurring state
  const [showCancelRecurringModal, setShowCancelRecurringModal] = useState(false);
  const [cancelRecurringHire, setCancelRecurringHire] = useState<DirectHire | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  
  // Completion review state for owner
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewHire, setReviewHire] = useState<DirectHire | null>(null);

  // Daily completion modal state
  const [showDailyCompletionModal, setShowDailyCompletionModal] = useState(false);
  const [dailyCompletionHire, setDailyCompletionHire] = useState<DirectHire | null>(null);

  // Refer housekeeper state
  const [showReferModal, setShowReferModal] = useState(false);
  const [referHire, setReferHire] = useState<DirectHire | null>(null);
  const [showReceiptHireId, setShowReceiptHireId] = useState<number | null>(null);

  useEffect(() => {
    loadHires();
  }, [role]);

  useEffect(() => {
    const verifyMayaReturn = async () => {
      const params = new URLSearchParams(window.location.search);
      const hireId = params.get('hire_id');
      if (!hireId) return;

      const housekeeperMayaResult = params.get('maya_result');
      const ownerMayaResult = params.get('maya_owner_result');
      const mayaResult = role === 'housekeeper' ? housekeeperMayaResult : ownerMayaResult;
      if (!mayaResult) return;

      const checkoutKey = role === 'housekeeper'
        ? `direct_hire_checkout_${hireId}`
        : `direct_hire_owner_checkout_${hireId}`;
      const checkoutId = params.get('checkout_id') || localStorage.getItem(checkoutKey);
      const returnAttemptKey = `direct_hire_verify_attempt_${role}_${hireId}_${mayaResult}_${checkoutId || 'missing'}`;

      const clearUrlParams = () => {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, '', cleanPath);
      };

      if (sessionStorage.getItem(returnAttemptKey) === '1') {
        clearUrlParams();
        return;
      }
      sessionStorage.setItem(returnAttemptKey, '1');

      if (mayaResult !== 'success') {
        alert('Maya payment was not completed. You can try again.');
        clearUrlParams();
        await loadHires();
        return;
      }

      if (!checkoutId) {
        alert('Unable to verify payment: missing checkout ID. Please retry payment.');
        clearUrlParams();
        return;
      }

      try {
        setVerifyingFee(true);
        const token = localStorage.getItem('access_token');
        const verifyEndpoint = role === 'housekeeper'
          ? `${API_BASE_URL}/direct-hire/${hireId}/accept/verify`
          : `${API_BASE_URL}/direct-hire/${hireId}/owner-payment/verify`;

        const response = await fetch(verifyEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ checkout_id: checkoutId })
        });

        const result = await response.json();
        if (!response.ok) {
          alert(result.detail || 'Failed to verify Maya payment');
        } else {
          alert(result.message || 'Payment verified successfully');
          localStorage.removeItem(checkoutKey);
        }
      } catch (error) {
        console.error('Maya verify error:', error);
        alert('Failed to verify Maya payment');
      } finally {
        setVerifyingFee(false);
        clearUrlParams();
        await loadHires();
      }
    };

    verifyMayaReturn();
  }, [role]);

  // Check which hires have already been rated
  useEffect(() => {
    const checkRatedHires = async () => {
      if (role !== 'owner') return;
      
      const paidHires = hires.filter(h => h.status === 'paid');
      const alreadyRated = new Set<number>();
      
      for (const hire of paidHires) {
        try {
          const response = await apiClient.get(`/ratings/check/${hire.worker_user_id}?hire_id=${hire.hire_id}`);
          if (response.data.has_rated) {
            alreadyRated.add(hire.hire_id);
          }
        } catch {
          // If check fails, assume not rated
        }
      }
      
      setRatedHires(alreadyRated);
    };
    
    if (hires.length > 0) {
      checkRatedHires();
    }
  }, [hires, role]);

  const loadHires = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const endpoint = role === 'owner' 
        ? `${API_BASE_URL}/direct-hire/my-bookings`
        : `${API_BASE_URL}/direct-hire/my-jobs`;
      
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setHires(data);
      }
    } catch (error) {
      console.error('Failed to load hires:', error);
    } finally {
      setLoading(false);
    }
  };

  // File upload handler for completion proof
  const handleCompletionFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setCompletionPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    try {
      setUploadingCompletion(true);
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'completion');

      const response = await fetch(`${API_BASE_URL}/upload/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setCompletionProof(resolveUploadUrl(data.url));
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to upload image');
        setCompletionPreview(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
      setCompletionPreview(null);
    } finally {
      setUploadingCompletion(false);
    }
  };

  // Handle payment using the unified payment system
  const handlePayment = (hire: DirectHire) => {
    initiatePayment({
      amount: hire.total_amount,
      title: `Payment for Direct Hire #${hire.hire_id}`,
      recipientName: hire.worker_name,
      description: `Payment for ${hire.packages.map(p => p.name).join(', ')}`,
      requireProof: false,
      allowedMethods: ['maya', 'cash'],
      onExternalGatewayPayment: async (method) => {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/direct-hire/${hire.hire_id}/owner-payment/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ payment_method: method })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Unable to start Maya payment');
        }

        if (!result.redirect_url || !result.checkout_id) {
          throw new Error('Maya checkout response is incomplete');
        }

        localStorage.setItem(`direct_hire_owner_checkout_${hire.hire_id}`, String(result.checkout_id));
        window.location.href = String(result.redirect_url);
      },
      onSuccess: async (paymentResult) => {
        try {
          const token = localStorage.getItem('access_token');
          const response = await fetch(`${API_BASE_URL}/direct-hire/${hire.hire_id}/pay`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              payment_method: paymentResult.method,
              payment_proof_url: paymentResult.proofUrl || null,
              reference_number: paymentResult.referenceNumber || null
            })
          });

          if (response.ok) {
            // Don't show rating modal immediately - payment needs worker confirmation first
            alert('Payment submitted successfully! Waiting for worker to confirm receipt.');
            loadHires();
          } else {
            const error = await response.json();
            console.error('Payment error:', error);
            alert(error.detail || 'Failed to record payment');
          }
        } catch (error) {
          console.error('Payment record error:', error);
          alert(`Failed to record payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      onCancel: () => {
        // User cancelled payment
        console.log('Payment cancelled');
      }
    });
  };

  const handleAction = async (hire: DirectHire, action: string) => {
    try {
      setProcessing(true);
      const token = localStorage.getItem('access_token');
      
      const url = `${API_BASE_URL}/direct-hire/${hire.hire_id}/${action}`;
      const method = 'POST';
      let body = null;

      if (action === 'submit-completion') {
        body = JSON.stringify({
          completion_proof_url: completionProof || null,
          completion_notes: completionNotes || null
        });
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Action completed!');
        // Reset completion modal state
        setShowCompletionModal(false);
        setCompletionProof('');
        setCompletionPreview(null);
        setCompletionNotes('');
        // Reset selected hire
        setSelectedHire(null);
        loadHires();
      } else {
        const error = await response.json();
        alert(error.detail || 'Action failed');
      }
    } catch (error) {
      console.error('Action error:', error);
      alert('Action failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleAcceptWithMayaFee = async (hire: DirectHire) => {
    try {
      setProcessing(true);
      const token = localStorage.getItem('access_token');

      const response = await fetch(`${API_BASE_URL}/direct-hire/${hire.hire_id}/accept/initiate-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || 'Unable to start Maya payment');
        return;
      }

      if (!result.redirect_url || !result.checkout_id) {
        alert('Maya checkout response is incomplete');
        return;
      }

      localStorage.setItem(`direct_hire_checkout_${hire.hire_id}`, String(result.checkout_id));
      window.location.href = String(result.redirect_url);
    } catch (error) {
      console.error('Initiate Maya error:', error);
      alert('Unable to start Maya payment');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: JSX.Element; class: string }> = {
      pending: { text: <><Clock className="inline w-3 h-3 mr-1" /> Pending</>, class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' },
      accepted: { text: <>✓ Accepted</>, class: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
      rejected: { text: <>✗ Rejected</>, class: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' },
      in_progress: { text: <><RotateCw className="inline w-3 h-3 mr-1" /> In Progress</>, class: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' },
      pending_completion: { text: <><FileText className="inline w-3 h-3 mr-1" /> Review Needed</>, class: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' },
      completed: { text: <><CheckCircle className="inline w-3 h-3 mr-1" /> Completed</>, class: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' },
      payment_pending: { text: <><CreditCard className="inline w-3 h-3 mr-1" /> Payment Pending Review</>, class: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' },
      paid: { text: <>Paid</>, class: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' },
      cancelled: { text: <><X className="inline w-3 h-3 mr-1" /> Cancelled</>, class: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300' }
    };
    return badges[status] || { text: <>{status}</>, class: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300' };
  };

  const formatPaymentMethodLabel = (method: string | null | undefined) => {
    const normalized = (method || '').toLowerCase();
    if (normalized === 'cash') return 'Cash';
    if (normalized === 'maya') return 'Maya Checkout';
    if (normalized === 'gcash') return 'GCash via Maya Checkout';
    if (normalized === 'bank_transfer') return 'Bank Transfer via Maya Checkout';
    if (!normalized) return '';
    return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Message button - only show for active hire statuses
  const renderMessageButton = (hire: DirectHire) => {
    const canMessage = ['accepted', 'in_progress', 'pending_completion', 'completed', 'payment_pending'].includes(hire.status);
    if (!canMessage) return null;
    
    const otherName = role === 'owner' ? hire.worker_name : hire.employer_name;
    const params = new URLSearchParams({
      hireId: hire.hire_id.toString(),
      name: otherName,
      title: `Hire #${hire.hire_id}`,
    });
    
    return (
      <button
        onClick={() => navigate(`/chat/new?${params.toString()}`)}
        className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 text-sm rounded-lg hover:bg-purple-200 dark:hover:bg-purple-500/30 flex items-center gap-1 font-semibold"
      >
        💬 Message
      </button>
    );
  };

  const handleCancelRecurring = async () => {
    if (!cancelRecurringHire) return;
    
    try {
      setCancelling(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(
        `${API_BASE_URL}/direct-hire/${cancelRecurringHire.hire_id}/cancel-recurring`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            reason: cancellationReason || null
          })
        }
      );
      
      if (response.ok) {
        alert('Recurring booking cancelled successfully');
        setShowCancelRecurringModal(false);
        setCancelRecurringHire(null);
        setCancellationReason('');
        loadHires();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to cancel recurring booking');
      }
    } catch (error) {
      console.error('Cancel recurring error:', error);
      alert('Failed to cancel recurring booking');
    } finally {
      setCancelling(false);
    }
  };

  const renderActionButtons = (hire: DirectHire) => {
    const messageButton = renderMessageButton(hire);
    
    // Cancel recurring button (shown for active recurring hires)
    const cancelRecurringButton = hire.is_recurring && 
      hire.recurring_status === 'active' && 
      ['accepted', 'in_progress', 'pending_completion', 'completed', 'payment_pending', 'paid'].includes(hire.status) ? (
        <button
          onClick={() => {
            setCancelRecurringHire(hire);
            setShowCancelRecurringModal(true);
          }}
          className="px-3 py-1 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300 text-sm rounded-lg hover:bg-orange-200 dark:hover:bg-orange-500/30 font-semibold"
        >
          🛑 Stop Recurring
        </button>
      ) : null;
    
    if (role === 'owner') {
      // Owner actions
      switch (hire.status) {
        case 'pending':
          return (
            <button
              onClick={() => handleAction(hire, 'cancel')}
              disabled={processing}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Cancel
            </button>
          );
        case 'accepted':
        case 'in_progress':
          return (
            <div className="flex flex-wrap gap-2">
              {hire.num_days && hire.num_days > 1 && (
                <button
                  onClick={() => {
                    setDailyCompletionHire(hire);
                    setShowDailyCompletionModal(true);
                  }}
                  className="px-3 py-1 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 font-semibold shadow-sm"
                >
                  📅 Daily Progress
                </button>
              )}
              {messageButton}
            </div>
          );
        case 'pending_completion':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setReviewHire(hire);
                  setShowReviewModal(true);
                }}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-semibold shadow-sm"
              >
                Review & Approve
              </button>
              {messageButton}
            </div>
          );
        case 'completed':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => handlePayment(hire)}
                disabled={processing}
                className="px-3 py-1 bg-[#EA526F] text-white text-sm rounded-lg hover:bg-[#d64460] font-semibold shadow-sm disabled:opacity-50"
              >
                Pay (Maya/Cash)
              </button>
              {messageButton}
            </div>
          );
        case 'payment_pending':
          return (
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-blue-600 dark:text-blue-300 text-sm font-medium">
                <Clock className="inline w-4 h-4 mr-1" /> Waiting for worker to confirm payment
              </div>
              <button
                onClick={() => setShowReceiptHireId(hire.hire_id)}
                className="px-3 py-1 bg-[#4B244A] text-white text-sm rounded-lg hover:bg-[#361a35] font-semibold shadow-sm"
              >
                View Receipt
              </button>
            </div>
          );
        case 'paid':
          // Show Rate button if not already rated, plus Refer button
          return (
            <div className="space-y-2">
              <button
                onClick={() => setShowReceiptHireId(hire.hire_id)}
                className="w-full px-3 py-1 bg-[#4B244A] text-white text-sm rounded-lg hover:bg-[#361a35] font-semibold shadow-sm"
              >
                View Receipt
              </button>
              {!ratedHires.has(hire.hire_id) ? (
                <button
                  onClick={() => {
                    setRatingHire(hire);
                    setShowRatingModal(true);
                  }}
                  className="w-full px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600 font-semibold shadow-sm"
                >
                  <Star className="inline w-4 h-4 mr-1" /> Rate {hire.worker_name}
                </button>
              ) : (
                <span className="block text-green-600 dark:text-green-400 text-sm font-semibold">✓ Rated</span>
              )}
              <button
                onClick={() => {
                  setReferHire(hire);
                  setShowReferModal(true);
                }}
                className="w-full px-3 py-1 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 text-sm rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 font-semibold shadow-sm border border-blue-200 dark:border-blue-500/20 flex items-center justify-center gap-1"
              >
                <User className="w-4 h-4" /> Refer {hire.worker_name}
              </button>
            </div>
          );
        default:
          return null;
      }
    } else {
      // Housekeeper actions
      switch (hire.status) {
        case 'pending':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => handleAcceptWithMayaFee(hire)}
                disabled={processing || verifyingFee}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1"
              >
                {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Accept & Pay 7%
              </button>
              <button
                onClick={() => handleAction(hire, 'reject')}
                disabled={processing || verifyingFee}
                className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 text-sm rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 font-semibold disabled:opacity-50 flex items-center gap-1"
              >
                {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Reject
              </button>
            </div>
          );
        case 'accepted':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(hire, 'start')}
                disabled={processing}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1"
              >
                {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Start Work
              </button>
              {messageButton}
            </div>
          );
        case 'in_progress':
          return (
            <div className="flex flex-wrap gap-2">
              {hire.num_days && hire.num_days > 1 && (
                <button
                  onClick={() => {
                    setDailyCompletionHire(hire);
                    setShowDailyCompletionModal(true);
                  }}
                  className="px-3 py-1 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 font-semibold shadow-sm"
                >
                  📅 Daily Progress
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedHire(hire);
                  setShowCompletionModal(true);
                }}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-semibold shadow-sm"
              >
                Submit Completion
              </button>
              {messageButton}
            </div>
          );
        case 'pending_completion':
        case 'completed':
          return messageButton;
        case 'payment_pending':
          return (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (window.confirm('Confirm that you have received the payment?')) {
                    try {
                      setProcessing(true);
                      const token = localStorage.getItem('access_token');
                      const response = await fetch(`${API_BASE_URL}/direct-hire/${hire.hire_id}/confirm-payment`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      });
                      
                      if (response.ok) {
                        alert('Payment confirmed! You can now rate the employer.');
                        loadHires();
                      } else {
                        const error = await response.json();
                        alert(error.detail || 'Failed to confirm payment');
                      }
                    } catch (error) {
                      console.error('Payment confirmation error:', error);
                      alert('Failed to confirm payment');
                    } finally {
                      setProcessing(false);
                    }
                  }
                }}
                disabled={processing}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1"
              >
                {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'} Confirm Payment Received
              </button>
              {messageButton}
            </div>
          );
        case 'paid':
          return (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowReceiptHireId(hire.hire_id)}
                className="px-3 py-1 bg-[#4B244A] text-white text-sm rounded-lg hover:bg-[#361a35] font-semibold shadow-sm"
              >
                View Receipt
              </button>
              {messageButton}
            </div>
          );
        default:
          return null;
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">

      {/* Content */}
      <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#EA526F]"></div>
            </div>
          ) : hires.length === 0 ? (
            <div className="text-center py-8 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-xl border border-white/50 dark:border-white/10">
              <div className="text-4xl mb-2 opacity-50">📭</div>
              <p className="text-[#4B244A]/70 dark:text-white/70 font-medium">No direct hires yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {hires.map((hire) => {
                const badge = getStatusBadge(hire.status);
                return (
                  <div key={hire.hire_id} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-xl p-4 border border-white/50 dark:border-white/10 shadow-lg hover:scale-[1.01] transition-transform">
                    <div className="flex flex-wrap items-start justify-between mb-3 gap-3">
                      <div className="min-w-0">
                        <h4 className="text-lg font-bold text-[#4B244A] dark:text-white">
                          {role === 'owner' ? hire.worker_name : hire.employer_name}
                        </h4>
                        {role === 'owner' && (
                          <button
                            onClick={() => navigate(`/worker/${hire.worker_id}?from=direct-hire`)}
                            className="mt-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-xs rounded-lg hover:bg-blue-200 dark:hover:bg-blue-500/30 font-semibold flex items-center gap-1"
                          >
                            <User className="w-3 h-3" /> View Profile
                          </button>
                        )}
                        <p className="text-[#4B244A]/60 dark:text-white/60 text-sm font-medium">
                          <Calendar className="inline w-4 h-4 mr-1"></Calendar> {new Date(hire.scheduled_date).toLocaleDateString()}
                          {hire.scheduled_time && ` at ${hire.scheduled_time}`}
                        </p>
                        {hire.is_recurring && (
                          <div className="mt-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-xs rounded-full mr-2 font-bold">
                              <RotateCw className="inline w-4 h-4 mr-1" /> Recurring: Every {hire.day_of_week} ({hire.frequency})
                            </span>
                            {hire.recurring_status === 'cancelled' && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 text-xs rounded-full font-bold">
                                <Cross className="inline w-4 h-4 mr-1"></Cross> Cancelled {hire.cancelled_by === role ? 'by you' : `by ${role === 'owner' ? 'worker' : 'employer'}`}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Multi-day schedule info */}
                        {hire.num_days && hire.num_days > 1 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 text-xs rounded-full font-bold">
                              📅 {hire.num_days} days
                            </span>
                            {hire.daily_start_time && hire.daily_end_time && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 text-xs rounded-full font-bold">
                                🕐 {hire.daily_start_time} – {hire.daily_end_time}
                              </span>
                            )}
                            {hire.day_schedules && hire.day_schedules.length > 0 && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 text-xs rounded-full font-bold">
                                ✅ {hire.day_schedules.filter(d => d.status === 'completed').length}/{hire.day_schedules.length} days done
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className={`inline-flex items-center justify-center w-max px-3 py-1 rounded-full text-sm font-bold ${badge.class}`}>
                        {badge.text}
                      </span>
                    </div>

                    {/* Packages */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {hire.packages.map((pkg) => (
                        <span key={pkg.package_id} className="px-2 py-1 bg-[#EA526F]/10 dark:bg-[#EA526F]/20 text-[#EA526F] dark:text-pink-300 text-sm rounded-full font-semibold">
                          {pkg.name}
                        </span>
                      ))}
                    </div>

                    {/* Location */}
                    {hire.address_city && (
                      <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mb-3 font-medium">
                        <MapPin className="inline w-4 h-4 mr-1"></MapPin> {hire.address_barangay && `${hire.address_barangay}, `}{hire.address_city}
                      </p>
                    )}

                    {/* Special Instructions */}
                    {hire.special_instructions && (
                      <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mb-3 bg-white/50 dark:bg-white/5 rounded p-2 italic">
                        💬 {hire.special_instructions}
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="text-xl font-bold text-[#EA526F]">
                        ₱{hire.total_amount.toLocaleString()}
                        {role === 'housekeeper' && hire.status === 'pending' && (
                          <div className="text-xs font-medium text-[#4B244A]/70 dark:text-white/70 mt-1">
                            Platform fee (7%): ₱{Number(hire.platform_fee_amount || (hire.total_amount * 0.07)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                        {role === 'housekeeper' && hire.payment_method && (
                          <div className="mt-2">
                            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 text-xs rounded-full font-bold">
                              💳 Payment Source: {formatPaymentMethodLabel(hire.payment_method)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        {renderActionButtons(hire)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Completion Modal */}
      {showCompletionModal && selectedHire && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-gray-200 dark:border-white/20 shadow-2xl">
            <div className="p-6 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-xl font-bold text-[#4B244A] dark:text-white"><CheckCircle className="inline w-4 h-4 mr-1" /> Submit Completion</h3>
              <p className="text-[#4B244A]/60 dark:text-white/60 font-medium">For {selectedHire.employer_name}'s booking</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[#4B244A] dark:text-white font-bold mb-2">Completion Proof (Optional)</label>
                <input
                  type="file"
                  ref={completionFileRef}
                  onChange={handleCompletionFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => completionFileRef.current?.click()}
                  disabled={uploadingCompletion}
                  className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-white/30 rounded-lg text-[#4B244A]/70 dark:text-white/70 hover:border-[#EA526F] hover:text-[#EA526F] transition-all flex items-center justify-center gap-2 font-medium"
                >
                  {uploadingCompletion ? (<><Clock className="inline w-4 h-4 mr-1" /> Uploading...</>) : completionProof ? (<><CheckCircle className="inline w-4 h-4 mr-1" /> Uploaded - Click to change</>) : (<><FileText className="inline w-4 h-4 mr-1" /> Click to upload photo of completed work</>)}
                </button>
                <p className="text-[#4B244A]/50 dark:text-white/50 text-xs mt-1 font-medium">
                  Supports: JPEG, PNG, GIF, WebP (max 10MB)
                </p>
                {completionPreview && (
                  <div className="mt-3">
                    <p className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-2 font-bold">Preview:</p>
                    <img 
                      src={completionPreview} 
                      alt="Completion proof preview" 
                      className="w-full h-32 object-cover rounded-xl border border-gray-200 dark:border-white/20"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[#4B244A] dark:text-white font-bold mb-2">Notes (Optional)</label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Any notes about the work done..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/30 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] transition-all"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    setCompletionProof('');
                    setCompletionPreview(null);
                    setCompletionNotes('');
                  }}
                  className="flex-1 py-3 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(selectedHire, 'submit-completion')}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-all shadow-md"
                >
                  {processing ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingHire && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            setRatingHire(null);
            setSelectedHire(null);
            loadHires();
          }}
          onSubmit={async (rating, review) => {
            const response = await apiClient.post('/ratings/', {
              rated_user_id: ratingHire.worker_user_id,
              hire_id: ratingHire.hire_id,
              stars: rating,
              review: review || null
            });
            if (response.status === 200 || response.status === 201) {
              setRatedHires(prev => new Set(prev).add(ratingHire.hire_id));
            } else {
              throw new Error('Failed to submit rating');
            }
          }}
          workerName={ratingHire.worker_name}
          hireId={ratingHire.hire_id}
        />
      )}

      {/* Cancel Recurring Modal */}
      {showCancelRecurringModal && cancelRecurringHire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/20 shadow-2xl">
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">Stop Recurring Service</h3>
            <p className="text-[#4B244A]/70 dark:text-white/70 mb-4 font-medium">
              Are you sure you want to stop this recurring booking? This will prevent future scheduled services.
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
                  setShowCancelRecurringModal(false);
                  setCancelRecurringHire(null);
                  setCancellationReason('');
                }}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white rounded-lg hover:bg-white/80 dark:hover:bg-white/20 disabled:opacity-50 font-bold border border-gray-200 dark:border-white/20"
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

      {/* Completion Review Modal */}
      {showReviewModal && reviewHire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full border border-gray-200 dark:border-white/20 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-2">📋 Review Completed Work</h3>
              <p className="text-[#4B244A]/70 dark:text-white/70 font-medium">
                Review the work completed by {reviewHire.worker_name}
              </p>
            </div>

            {/* Hire Details */}
            <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 mb-4 border border-gray-200 dark:border-white/10">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-lg font-bold text-[#4B244A] dark:text-white">{reviewHire.worker_name}</h4>
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-sm font-medium">
                    📅 {new Date(reviewHire.scheduled_date).toLocaleDateString()}
                    {reviewHire.scheduled_time && ` at ${reviewHire.scheduled_time}`}
                  </p>
                </div>
                <div className="text-xl font-bold text-[#EA526F]">
                  ₱{reviewHire.total_amount.toLocaleString()}
                </div>
              </div>

              {/* Packages */}
              <div className="flex flex-wrap gap-2 mb-3">
                {reviewHire.packages.map((pkg) => (
                  <span key={pkg.package_id} className="px-2 py-1 bg-[#EA526F]/10 dark:bg-[#EA526F]/20 text-[#EA526F] dark:text-pink-300 text-sm rounded-full font-semibold">
                    {pkg.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Completion Proof */}
            {reviewHire.completion_proof_url && (
              <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 mb-4 border border-gray-200 dark:border-white/10">
                <h4 className="text-[#4B244A] dark:text-white font-bold mb-2">📸 Completion Proof</h4>
                <img 
                  src={reviewHire.completion_proof_url} 
                  alt="Completion proof" 
                  className="w-full h-64 object-cover rounded-lg border border-gray-200 dark:border-white/20"
                />
              </div>
            )}

            {/* Completion Notes */}
            {reviewHire.completion_notes && (
              <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 mb-4 border border-gray-200 dark:border-white/10">
                <h4 className="text-[#4B244A] dark:text-white font-bold mb-2"><FileText className="inline w-4 h-4 mr-1" /> Notes from Housekeeper</h4>
                <p className="text-[#4B244A]/80 dark:text-white/80">{reviewHire.completion_notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewHire(null);
                }}
                className="flex-1 px-4 py-3 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleAction(reviewHire, 'approve-completion');
                  setShowReviewModal(false);
                  setReviewHire(null);
                }}
                disabled={processing}
                className="flex-1 px-4 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-all shadow-md"
              >
                {processing ? 'Approving...' : 'Approve & Continue to Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Completion Modal */}
      {showDailyCompletionModal && dailyCompletionHire && (
        <DailyCompletionModal
          hireId={dailyCompletionHire.hire_id}
          jobTitle={`Booking with ${role === 'owner' ? dailyCompletionHire.worker_name : dailyCompletionHire.employer_name}`}
          userRole={role === 'owner' ? 'owner' : 'housekeeper'}
          onClose={() => {
            setShowDailyCompletionModal(false);
            setDailyCompletionHire(null);
          }}
          onDayConfirmed={() => loadHires()}
        />
      )}

      {/* Refer Housekeeper Modal */}
      {referHire && (
        <ReferHousekeeperModal
          isOpen={showReferModal}
          onClose={() => { setShowReferModal(false); setReferHire(null); }}
          workerId={referHire.worker_id}
          workerName={referHire.worker_name}
        />
      )}

      {showReceiptHireId !== null && (
        <DirectHireReceiptModal
          hireId={showReceiptHireId}
          onClose={() => setShowReceiptHireId(null)}
        />
      )}
    </div>
  );
}