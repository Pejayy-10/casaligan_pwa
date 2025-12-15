import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RatingModal from './RatingModal';
import apiClient from '../services/api';
import { usePayment } from '../context/PaymentContext';

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
}

interface Props {
  role: 'owner' | 'housekeeper';
  onClose: () => void;
}

export default function DirectHiresList({ role, onClose }: Props) {
  const navigate = useNavigate();
  const { initiatePayment } = usePayment();
  const [hires, setHires] = useState<DirectHire[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    loadHires();
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
        ? 'http://127.0.0.1:8000/direct-hire/my-bookings'
        : 'http://127.0.0.1:8000/direct-hire/my-jobs';
      
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

      const response = await fetch('http://127.0.0.1:8000/upload/image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setCompletionProof(`http://127.0.0.1:8000${data.url}`);
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
      requireProof: true, // Force payment proof upload and reference number
      onSuccess: async (paymentResult) => {
        try {
          const token = localStorage.getItem('access_token');
          const response = await fetch(`http://127.0.0.1:8000/direct-hire/${hire.hire_id}/pay`, {
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
            // Show rating modal after successful payment
            setSelectedHire(hire);
            setRatingHire(hire);
            setShowRatingModal(true);
            loadHires();
          } else {
            const error = await response.json();
            alert(error.detail || 'Failed to record payment');
          }
        } catch (error) {
          console.error('Payment record error:', error);
          alert('Failed to record payment');
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
      
      const url = `http://127.0.0.1:8000/direct-hire/${hire.hire_id}/${action}`;
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; class: string }> = {
      pending: { text: '⏳ Pending', class: 'bg-yellow-500/20 text-yellow-300' },
      accepted: { text: '✓ Accepted', class: 'bg-blue-500/20 text-blue-300' },
      rejected: { text: '✗ Rejected', class: 'bg-red-500/20 text-red-300' },
      in_progress: { text: '🔄 In Progress', class: 'bg-purple-500/20 text-purple-300' },
      pending_completion: { text: '📝 Review Needed', class: 'bg-orange-500/20 text-orange-300' },
      completed: { text: '✅ Completed', class: 'bg-green-500/20 text-green-300' },
      paid: { text: '💰 Paid', class: 'bg-green-500/20 text-green-300' },
      cancelled: { text: '🚫 Cancelled', class: 'bg-gray-500/20 text-gray-300' }
    };
    return badges[status] || { text: status, class: 'bg-gray-500/20 text-gray-300' };
  };

  // Message button - only show for active hire statuses
  const renderMessageButton = (hire: DirectHire) => {
    const canMessage = ['accepted', 'in_progress', 'pending_completion', 'completed'].includes(hire.status);
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
        className="px-3 py-1 bg-purple-500/20 text-purple-300 text-sm rounded-lg hover:bg-purple-500/30 flex items-center gap-1"
      >
        💬 Message
      </button>
    );
  };

  const renderActionButtons = (hire: DirectHire) => {
    const messageButton = renderMessageButton(hire);
    
    if (role === 'owner') {
      // Owner actions
      switch (hire.status) {
        case 'pending':
          return (
            <button
              onClick={() => handleAction(hire, 'cancel')}
              className="px-3 py-1 bg-red-500/20 text-red-300 text-sm rounded-lg hover:bg-red-500/30"
            >
              Cancel
            </button>
          );
        case 'accepted':
        case 'in_progress':
          return messageButton;
        case 'pending_completion':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(hire, 'approve-completion')}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
              >
                Approve Work
              </button>
              {messageButton}
            </div>
          );
        case 'completed':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => handlePayment(hire)}
                className="px-3 py-1 bg-[#EA526F] text-white text-sm rounded-lg hover:bg-[#d64460]"
              >
                Pay Now
              </button>
              {messageButton}
            </div>
          );
        case 'paid':
          // Show Rate button if not already rated
          if (!ratedHires.has(hire.hire_id)) {
            return (
              <button
                onClick={() => {
                  setRatingHire(hire);
                  setShowRatingModal(true);
                }}
                className="px-3 py-1 bg-yellow-500 text-white text-sm rounded-lg hover:bg-yellow-600"
              >
                ⭐ Rate
              </button>
            );
          }
          return <span className="text-green-400 text-sm">✓ Rated</span>;
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
                onClick={() => handleAction(hire, 'accept')}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
              >
                Accept
              </button>
              <button
                onClick={() => handleAction(hire, 'reject')}
                className="px-3 py-1 bg-red-500/20 text-red-300 text-sm rounded-lg hover:bg-red-500/30"
              >
                Reject
              </button>
            </div>
          );
        case 'accepted':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(hire, 'start')}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
              >
                Start Work
              </button>
              {messageButton}
            </div>
          );
        case 'in_progress':
          return (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedHire(hire);
                  setShowCompletionModal(true);
                }}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600"
              >
                Submit Completion
              </button>
              {messageButton}
            </div>
          );
        case 'pending_completion':
        case 'completed':
          return messageButton;
        default:
          return null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-[#4B244A] to-[#6B3468] p-6 border-b border-white/20 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {role === 'owner' ? '📋 My Direct Bookings' : '💼 Direct Hire Jobs'}
            </h2>
            <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#EA526F]"></div>
            </div>
          ) : hires.length === 0 ? (
            <div className="text-center py-8 bg-white/10 rounded-xl">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-white/70">No direct hires yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {hires.map((hire) => {
                const badge = getStatusBadge(hire.status);
                return (
                  <div key={hire.hire_id} className="bg-white/10 rounded-xl p-4 border border-white/20">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-lg font-bold text-white">
                          {role === 'owner' ? hire.worker_name : hire.employer_name}
                        </h4>
                        <p className="text-white/60 text-sm">
                          📅 {new Date(hire.scheduled_date).toLocaleDateString()}
                          {hire.scheduled_time && ` at ${hire.scheduled_time}`}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${badge.class}`}>
                        {badge.text}
                      </span>
                    </div>

                    {/* Packages */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {hire.packages.map((pkg) => (
                        <span key={pkg.package_id} className="px-2 py-1 bg-[#EA526F]/20 text-[#EA526F] text-sm rounded-full">
                          {pkg.name}
                        </span>
                      ))}
                    </div>

                    {/* Location */}
                    {hire.address_city && (
                      <p className="text-white/60 text-sm mb-3">
                        📍 {hire.address_barangay && `${hire.address_barangay}, `}{hire.address_city}
                      </p>
                    )}

                    {/* Special Instructions */}
                    {hire.special_instructions && (
                      <p className="text-white/60 text-sm mb-3 bg-white/10 rounded p-2">
                        💬 {hire.special_instructions}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold text-[#EA526F]">
                        ₱{hire.total_amount.toLocaleString()}
                      </div>
                      {renderActionButtons(hire)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Completion Modal */}
      {showCompletionModal && selectedHire && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-lg w-full border border-white/20 shadow-2xl">
            <div className="p-6 border-b border-white/20">
              <h3 className="text-xl font-bold text-white">✅ Submit Completion</h3>
              <p className="text-white/60">For {selectedHire.employer_name}'s booking</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-white font-semibold mb-2">Completion Proof (Optional)</label>
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
                  className="w-full py-4 border-2 border-dashed border-white/30 rounded-lg text-white/70 hover:border-[#EA526F] hover:text-[#EA526F] transition-all flex items-center justify-center gap-2"
                >
                  {uploadingCompletion ? '⏳ Uploading...' : completionProof ? '✅ Uploaded - Click to change' : '📤 Click to upload photo of completed work'}
                </button>
                <p className="text-white/50 text-xs mt-1">
                  Supports: JPEG, PNG, GIF, WebP (max 10MB)
                </p>
                {completionPreview && (
                  <div className="mt-3">
                    <p className="text-white/70 text-sm mb-2">Preview:</p>
                    <img 
                      src={completionPreview} 
                      alt="Completion proof preview" 
                      className="w-full h-32 object-cover rounded-xl border border-white/20"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Notes (Optional)</label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Any notes about the work done..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
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
                  className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(selectedHire, 'submit-completion')}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50"
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
    </div>
  );
}
