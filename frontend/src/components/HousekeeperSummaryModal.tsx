import { useState, useEffect } from 'react';
import {
  FileText,
  Home,
  Zap,
  Users,
  Calendar,
  MapPin,
  DollarSign,
  Camera,
  CheckCircle,
  User,
  Receipt,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../config';

interface HousekeeperSummaryData {
  post_id: number;
  title: string;
  description: string;
  house_type: string;
  cleaning_type: string;
  budget: number;
  people_needed: number;
  image_urls: string[];
  location: string;
  duration_type: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  completed_at: string | null;
  employer_name: string;
  employer_email: string | null;
  employer_phone: string | null;
  completion_proof_url: string | null;
  completion_notes: string | null;
  completed_at_contract: string | null;
  payment_proof_url: string | null;
  paid_at: string | null;
  total_paid: number;
  payment_schedule: Array<{
    schedule_id: number;
    due_date: string;
    amount: number;
    status: string;
  }>;
}

interface Props {
  jobId: number;
  onClose: () => void;
}

export default function HousekeeperSummaryModal({ jobId, onClose }: Props) {
  const [data, setData] = useState<HousekeeperSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/housekeeper-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to load summary');
        }
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [jobId]);

  const sectionClass = 'bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10';
  const labelClass = 'text-xs font-bold text-[#4B244A]/70 dark:text-white/70 uppercase tracking-wide mb-2';
  const valueClass = 'text-[#4B244A] dark:text-white text-sm font-medium';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Job Summary
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
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#EA526F]" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-100 dark:bg-red-500/20 rounded-xl text-red-700 dark:text-red-200 text-sm font-medium">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">{data.title}</h3>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                  Completed
                </span>
              </div>

              <div className={sectionClass}>
                <div className={labelClass}>Job details</div>
                <p className={valueClass + ' whitespace-pre-wrap'}>{data.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2.5 py-1 bg-[#EA526F]/10 text-[#EA526F] dark:bg-[#EA526F]/20 rounded-md text-xs font-semibold flex items-center gap-1">
                    <Home className="w-3.5 h-3.5" /> {data.house_type}
                  </span>
                  <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-md text-xs font-semibold flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> {data.cleaning_type}
                  </span>
                  <span className="px-2.5 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 rounded-md text-xs font-semibold flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> ₱{data.budget.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md text-xs font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {data.people_needed} worker(s)
                  </span>
                </div>
                {data.location && (
                  <p className={valueClass + ' mt-2 flex items-center gap-1'}>
                    <MapPin className="w-4 h-4 flex-shrink-0" /> {data.location}
                  </p>
                )}
                {(data.start_date || data.end_date) && (
                  <p className={valueClass + ' mt-1 flex items-center gap-1'}>
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    {data.start_date && new Date(data.start_date).toLocaleDateString()}
                    {data.start_date && data.end_date && ' – '}
                    {data.end_date && new Date(data.end_date).toLocaleDateString()}
                  </p>
                )}
                <p className="text-xs text-[#4B244A]/60 dark:text-white/60 mt-2">
                  Posted {data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'} · Completed{' '}
                  {data.completed_at ? new Date(data.completed_at).toLocaleDateString() : '—'}
                </p>
              </div>

              {data.image_urls && data.image_urls.length > 0 && (
                <div className={sectionClass}>
                  <div className={labelClass + ' flex items-center gap-1'}>
                    <Camera className="w-4 h-4" /> Job photos
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {data.image_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 aspect-square"
                      >
                        <img src={url} alt={`Job ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className={sectionClass}>
                <div className={labelClass + ' flex items-center gap-1'}>
                  <User className="w-4 h-4" /> Employer
                </div>
                <div className="space-y-1">
                  <p className={valueClass}>{data.employer_name}</p>
                  {data.employer_email && (
                    <p className={valueClass + ' text-[#4B244A]/70 dark:text-white/70'}>{data.employer_email}</p>
                  )}
                  {data.employer_phone && (
                    <p className={valueClass + ' text-[#4B244A]/70 dark:text-white/70'}>{data.employer_phone}</p>
                  )}
                </div>
              </div>

              <div className={sectionClass}>
                <div className={labelClass + ' flex items-center gap-1'}>
                  <CheckCircle className="w-4 h-4" /> Your completion
                </div>
                <div className="space-y-2">
                  {data.completion_notes && (
                    <p className={valueClass}>{data.completion_notes}</p>
                  )}
                  {data.completed_at_contract && (
                    <p className="text-xs text-[#4B244A]/60 dark:text-white/60">
                      Completed {new Date(data.completed_at_contract).toLocaleString()}
                    </p>
                  )}
                  {data.completion_proof_url && (
                    <a
                      href={data.completion_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 max-w-[180px]"
                    >
                      <img
                        src={data.completion_proof_url}
                        alt="Completion proof"
                        className="w-full h-24 object-cover"
                      />
                      <span className="text-xs text-[#EA526F] font-medium block py-1 text-center">
                        View proof
                      </span>
                    </a>
                  )}
                </div>
              </div>

              {data.payment_schedule && data.payment_schedule.length > 0 && (
                <div className={sectionClass}>
                  <div className={labelClass + ' flex items-center gap-1'}>
                    <Receipt className="w-4 h-4" /> Payment schedule
                  </div>
                  <ul className="space-y-2">
                    {data.payment_schedule.map((p) => (
                      <li
                        key={p.schedule_id}
                        className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-white/5 last:border-0"
                      >
                        <span className="text-[#4B244A] dark:text-white">
                          {p.due_date}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              p.status === 'confirmed'
                                ? 'text-green-600 dark:text-green-400 font-semibold'
                                : 'text-[#4B244A]/70 dark:text-white/70'
                            }
                          >
                            ₱{p.amount.toLocaleString()}
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-white/10 text-[#4B244A] dark:text-white font-medium">
                            {p.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={sectionClass}>
                <div className={labelClass + ' flex items-center gap-1'}>
                  <Receipt className="w-4 h-4" /> Payment proof
                </div>
                {data.payment_proof_url ? (
                  <div className="space-y-2">
                    <a
                      href={data.payment_proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 max-w-[180px]"
                    >
                      <img
                        src={data.payment_proof_url}
                        alt="Payment proof"
                        className="w-full h-24 object-cover"
                      />
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium block py-1 text-center">
                        View payment proof
                      </span>
                    </a>
                    {data.paid_at && (
                      <p className="text-xs text-[#4B244A]/60 dark:text-white/60">
                        Paid {new Date(data.paid_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={valueClass + ' text-[#4B244A]/70 dark:text-white/70'}>No payment proof available</p>
                )}
              </div>

              <div className="bg-green-100 dark:bg-green-500/20 rounded-xl p-4 border border-green-200 dark:border-green-500/30">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-green-800 dark:text-green-200">Total earned</span>
                  <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                    ₱{data.total_paid.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
