import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { Calendar, CreditCard, MapPin, Receipt, User, X } from 'lucide-react';

interface ReceiptPackage {
  package_id: number;
  name: string;
  price: number;
  duration_hours: number;
  num_days: number;
  services: string[];
}

interface DirectHireReceipt {
  hire_id: number;
  status: string;
  employer_name: string;
  worker_name: string;
  scheduled_date: string;
  scheduled_time: string | null;
  location: string;
  packages: ReceiptPackage[];
  total_amount: number;
  payment_method: string | null;
  reference_number: string | null;
  payment_proof_url: string | null;
  paid_at: string | null;
  completion_proof_url: string | null;
  completion_notes: string | null;
  completed_at: string | null;
  platform_fee_amount: number;
  platform_fee_paid_at: string | null;
  generated_at: string;
}

interface Props {
  hireId: number;
  onClose: () => void;
}

const resolveMediaUrl = (url: string | null) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
};

const formatMethod = (method: string | null) => {
  const value = (method || '').toLowerCase();
  if (!value) return 'N/A';
  if (value === 'cash') return 'Cash';
  if (value === 'maya') return 'Maya Checkout';
  if (value === 'gcash') return 'GCash via Maya Checkout';
  if (value === 'bank_transfer') return 'Bank Transfer via Maya Checkout';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function DirectHireReceiptModal({ hireId, onClose }: Props) {
  const [data, setData] = useState<DirectHireReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadReceipt = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/direct-hire/${hireId}/receipt`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Failed to load receipt');
        }

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load receipt');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReceipt();

    return () => {
      cancelled = true;
    };
  }, [hireId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Direct Hire Receipt
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#EA526F]" />
            </div>
          )}

          {!loading && error && (
            <div className="p-4 bg-red-100 dark:bg-red-500/20 rounded-xl text-red-700 dark:text-red-200 text-sm font-medium">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-[#4B244A]/70 dark:text-white/70 font-medium">Receipt #{data.hire_id}</p>
                  <p className="text-lg font-bold text-[#4B244A] dark:text-white">₱{data.total_amount.toLocaleString()}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                  {data.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>

              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-2">
                <p className="text-[#4B244A] dark:text-white text-sm font-semibold flex items-center gap-1"><User className="w-4 h-4" /> {data.employer_name} → {data.worker_name}</p>
                <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(data.scheduled_date).toLocaleDateString()}{data.scheduled_time ? ` at ${data.scheduled_time}` : ''}</p>
                {data.location && <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium flex items-center gap-1"><MapPin className="w-4 h-4" /> {data.location}</p>}
              </div>

              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <p className="text-xs font-bold text-[#4B244A]/70 dark:text-white/70 uppercase tracking-wide mb-2">Services</p>
                <div className="space-y-2">
                  {data.packages.map((item) => (
                    <div key={item.package_id} className="flex items-center justify-between text-sm">
                      <span className="text-[#4B244A] dark:text-white font-medium">{item.name}</span>
                      <span className="text-[#EA526F] font-bold">₱{item.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-2">
                <p className="text-xs font-bold text-[#4B244A]/70 dark:text-white/70 uppercase tracking-wide mb-2">Payment</p>
                <p className="text-[#4B244A] dark:text-white text-sm font-medium flex items-center gap-1"><CreditCard className="w-4 h-4" /> Method: {formatMethod(data.payment_method)}</p>
                <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">Reference: {data.reference_number || 'N/A'}</p>
                <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">Paid at: {data.paid_at ? new Date(data.paid_at).toLocaleString() : 'Pending confirmation'}</p>
                <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">Platform fee: ₱{data.platform_fee_amount.toLocaleString()}</p>
              </div>

              {data.completion_notes && (
                <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                  <p className="text-xs font-bold text-[#4B244A]/70 dark:text-white/70 uppercase tracking-wide mb-2">Completion Notes</p>
                  <p className="text-[#4B244A]/80 dark:text-white/80 text-sm">{data.completion_notes}</p>
                </div>
              )}

              {(data.completion_proof_url || data.payment_proof_url) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.completion_proof_url && (
                    <a href={resolveMediaUrl(data.completion_proof_url)} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                      <img src={resolveMediaUrl(data.completion_proof_url)} alt="Completion proof" className="w-full h-36 object-cover" />
                      <div className="py-1 text-center text-xs font-medium text-[#EA526F]">View Completion Proof</div>
                    </a>
                  )}
                  {data.payment_proof_url && (
                    <a href={resolveMediaUrl(data.payment_proof_url)} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
                      <img src={resolveMediaUrl(data.payment_proof_url)} alt="Payment proof" className="w-full h-36 object-cover" />
                      <div className="py-1 text-center text-xs font-medium text-green-600 dark:text-green-400">View Payment Proof</div>
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
