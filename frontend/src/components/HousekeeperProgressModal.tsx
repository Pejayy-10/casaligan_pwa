import { useState, useEffect } from 'react';

interface PaymentWarning {
  schedule_id: number;
  amount: number;
  due_date: string;
  days_overdue: number;
  status: string;
}

interface CheckIn {
  checkin_id: number;
  check_in_time: string;
  check_out_time: string | null;
  verified: boolean;
}

interface HousekeeperProgress {
  job_title: string;
  employer_name: string;
  employer_contact: string | null;
  start_date: string;
  end_date: string;
  days_elapsed: number;
  days_remaining: number;
  total_days: number;
  progress_percentage: number;
  total_earned: number;
  pending_amount: number;
  payment_warnings: PaymentWarning[];
  recent_checkins: CheckIn[];
  total_checkins: number;
  can_submit_completion: boolean;
}

interface Props {
  jobId: number;
  onClose: () => void;
  onSubmitCompletion: () => void;
}

export default function HousekeeperProgressModal({ jobId, onClose, onSubmitCompletion }: Props) {
  const [progress, setProgress] = useState<HousekeeperProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProgress();
  }, [jobId]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/housekeeper-progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to load progress');
      }
    } catch (err) {
      console.error('Load progress error:', err);
      setError('Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-[#E8E4E1]/95 dark:bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">📊 Job Progress</h2>
            <button
              onClick={onClose}
              className="text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          {progress && <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-1 font-medium">{progress.job_title}</p>}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
              <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading progress...</p>
            </div>
          ) : error ? (
            <div className="bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-center">
              <p className="text-red-600 dark:text-red-300 font-medium">{error}</p>
            </div>
          ) : progress ? (
            <div className="space-y-6">
              {/* Progress Bar */}
              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <div className="flex justify-between text-sm text-[#4B244A]/80 dark:text-white/70 mb-2 font-bold">
                  <span>Progress</span>
                  <span>{progress.progress_percentage}%</span>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#EA526F] to-pink-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress.progress_percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[#4B244A]/60 dark:text-white/50 mt-2 font-medium">
                  <span>Start: {new Date(progress.start_date).toLocaleDateString()}</span>
                  <span>End: {new Date(progress.end_date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Days Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/50 dark:bg-white/10 rounded-xl p-3 text-center border border-gray-200 dark:border-white/10">
                  <div className="text-2xl font-bold text-[#4B244A] dark:text-white">{progress.days_elapsed}</div>
                  <div className="text-xs text-[#4B244A]/60 dark:text-white/60 font-bold">Days Worked</div>
                </div>
                <div className="bg-white/50 dark:bg-white/10 rounded-xl p-3 text-center border border-gray-200 dark:border-white/10">
                  <div className="text-2xl font-bold text-[#4B244A] dark:text-white">{progress.days_remaining}</div>
                  <div className="text-xs text-[#4B244A]/60 dark:text-white/60 font-bold">Days Left</div>
                </div>
                <div className="bg-white/50 dark:bg-white/10 rounded-xl p-3 text-center border border-gray-200 dark:border-white/10">
                  <div className="text-2xl font-bold text-[#4B244A] dark:text-white">{progress.total_days}</div>
                  <div className="text-xs text-[#4B244A]/60 dark:text-white/60 font-bold">Total Days</div>
                </div>
              </div>

              {/* Earnings Summary */}
              <div className="bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-500/20 dark:to-blue-500/20 rounded-xl p-4 border border-green-200 dark:border-green-500/30">
                <h3 className="text-sm font-bold text-[#4B244A] dark:text-white/90 mb-3">💰 Earnings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                      ₱{progress.total_earned.toLocaleString()}
                    </div>
                    <div className="text-xs text-green-800/70 dark:text-white/60 font-medium">Total Earned</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">
                      ₱{progress.pending_amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-yellow-800/70 dark:text-white/60 font-medium">Pending</div>
                  </div>
                </div>
              </div>

              {/* Payment Warnings */}
              {progress.payment_warnings.length > 0 && (
                <div className="bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-300 mb-3">⚠️ Overdue Payments</h3>
                  <div className="space-y-2">
                    {progress.payment_warnings.map((warning) => (
                      <div key={warning.schedule_id} className="flex justify-between items-center text-sm">
                        <span className="text-red-800/80 dark:text-white/70 font-medium">
                          ₱{warning.amount.toLocaleString()} - Due {new Date(warning.due_date).toLocaleDateString()}
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          {warning.days_overdue} days overdue
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employer Info */}
              <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <h3 className="text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2">👤 Employer</h3>
                <p className="text-[#4B244A]/80 dark:text-white font-medium">{progress.employer_name}</p>
                {progress.employer_contact && (
                  <p className="text-[#4B244A]/60 dark:text-white/60 text-sm mt-1">📞 {progress.employer_contact}</p>
                )}
              </div>

              {/* Recent Check-ins */}
              {progress.recent_checkins.length > 0 && (
                <div className="bg-white/50 dark:bg-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                  <h3 className="text-sm font-bold text-[#4B244A] dark:text-white/90 mb-3">
                    📍 Recent Check-ins ({progress.total_checkins} total)
                  </h3>
                  <div className="space-y-2">
                    {progress.recent_checkins.map((checkin) => (
                      <div key={checkin.checkin_id} className="flex justify-between items-center bg-white/60 dark:bg-white/5 rounded-lg px-3 py-2 border border-gray-100 dark:border-white/5">
                        <span className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">
                          {new Date(checkin.check_in_time).toLocaleString()}
                        </span>
                        {checkin.verified && (
                          <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓ Verified</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Completion Button */}
              {progress.can_submit_completion && (
                <div className="bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4">
                  <p className="text-green-800 dark:text-green-300 text-sm mb-3 font-medium">
                    🎉 You're near the end date! You can now submit job completion.
                  </p>
                  <button
                    onClick={onSubmitCompletion}
                    className="w-full py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-all shadow-md"
                  >
                    ✅ Submit Job Completion
                  </button>
                </div>
              )}
            </div>
          ) : null}
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