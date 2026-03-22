import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { CheckCircle, Clock, Lock, Upload, X, AlertTriangle } from 'lucide-react';

interface DaySchedule {
  day_schedule_id: number;
  post_id?: number;
  hire_id?: number;
  worker_id: number;
  work_date: string;
  start_time: string;
  end_time: string;
  day_number: number;
  status: string;
  owner_confirmed: boolean;
  housekeeper_confirmed: boolean;
  completions: Array<{
    completion_id: number;
    confirmed_by: number;
    role: string;
    proof_url?: string;
    notes?: string;
    confirmed_at?: string;
  }>;
}

interface DailyCompletionModalProps {
  // Provide either postId+workerId OR hireId
  postId?: number;
  workerId?: number;
  hireId?: number;
  jobTitle: string;
  userRole: 'owner' | 'housekeeper';
  onClose: () => void;
  onDayConfirmed?: () => void;
}

export default function DailyCompletionModal({
  postId,
  workerId,
  hireId,
  jobTitle,
  userRole,
  onClose,
  onDayConfirmed,
}: DailyCompletionModalProps) {
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [error, setError] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  useEffect(() => {
    loadDaySchedules();
  }, []);

  const loadDaySchedules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      let url = '';
      if (hireId) {
        url = `${API_BASE_URL}/daily-completion/hire/${hireId}`;
      } else if (postId && workerId) {
        url = `${API_BASE_URL}/daily-completion/job/${postId}/worker/${workerId}`;
      } else if (postId) {
        // Use the convenience endpoint that resolves worker_id from auth token
        url = `${API_BASE_URL}/daily-completion/job/${postId}/my-schedule`;
      } else {
        setError('Missing job or hire information');
        return;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setDaySchedules(data);
      } else {
        setError('Failed to load day schedules');
      }
    } catch (err) {
      setError('Failed to load day schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProof(true);
    const token = localStorage.getItem('access_token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload/image?category=completion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProofUrl(data.url);
      }
    } catch {
      // silently fail
    } finally {
      setUploadingProof(false);
    }
  };

  const handleConfirmDay = async (dayScheduleId: number) => {
    try {
      setConfirming(dayScheduleId);
      setError('');
      const token = localStorage.getItem('access_token');

      const response = await fetch(`${API_BASE_URL}/daily-completion/${dayScheduleId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proof_url: proofUrl || null,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        setNotes('');
        setProofUrl('');
        await loadDaySchedules();
        onDayConfirmed?.();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to confirm day');
      }
    } catch {
      setError('Failed to confirm day');
    } finally {
      setConfirming(null);
    }
  };

  const getStatusBadge = (day: DaySchedule) => {
    if (day.status === 'completed') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
          <CheckCircle className="w-3 h-3 mr-1" /> Completed
        </span>
      );
    }
    if (day.status === 'pending_completion') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
          <Clock className="w-3 h-3 mr-1" /> Awaiting Confirmation
        </span>
      );
    }
    if (day.status === 'pending') {
      // Check if previous day is complete or if this is day 1
      const prevDay = daySchedules.find(d => d.day_number === day.day_number - 1);
      if (day.day_number > 1 && prevDay && prevDay.status !== 'completed') {
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400">
            <Lock className="w-3 h-3 mr-1" /> Locked
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
          <Clock className="w-3 h-3 mr-1" /> Ready
        </span>
      );
    }
    return null;
  };

  const canConfirm = (day: DaySchedule) => {
    if (day.status === 'completed') return false;
    // Check if already confirmed by current role
    if (userRole === 'owner' && day.owner_confirmed) return false;
    if (userRole === 'housekeeper' && day.housekeeper_confirmed) return false;
    // Check sequential unlock
    if (day.day_number > 1) {
      const prevDay = daySchedules.find(d => d.day_number === day.day_number - 1);
      if (prevDay && prevDay.status !== 'completed') return false;
    }
    return true;
  };

  const completedCount = daySchedules.filter(d => d.status === 'completed').length;
  const totalDays = daySchedules.length;
  const progress = totalDays > 0 ? (completedCount / totalDays) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 p-5 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-[#4B244A] dark:text-white">Daily Progress</h2>
            <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-medium mt-0.5">{jobTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        {totalDays > 0 && (
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-[#4B244A] dark:text-white">
                {completedCount} / {totalDays} Days Complete
              </span>
              <span className="text-sm font-bold text-[#EA526F]">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#EA526F] to-green-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-3">
          {error && (
            <div className="bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/50 rounded-xl p-3">
              <p className="text-red-600 dark:text-red-200 text-sm font-medium flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" /> {error}
              </p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#EA526F] mx-auto" />
              <p className="text-[#4B244A]/60 dark:text-white/60 mt-3 text-sm">Loading schedule...</p>
            </div>
          ) : daySchedules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#4B244A]/60 dark:text-white/60 text-sm">No day schedules found for this job.</p>
            </div>
          ) : (
            daySchedules.map((day) => (
              <div
                key={day.day_schedule_id}
                className={`rounded-xl p-4 border transition-all ${
                  day.status === 'completed'
                    ? 'bg-green-50/60 dark:bg-green-500/5 border-green-200 dark:border-green-500/20'
                    : canConfirm(day)
                    ? 'bg-white/60 dark:bg-white/5 border-blue-200 dark:border-blue-500/20'
                    : 'bg-gray-50/60 dark:bg-white/5 border-gray-200 dark:border-white/10 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-[#4B244A] dark:text-white">
                      Day {day.day_number}
                    </span>
                    <span className="text-xs text-[#4B244A]/60 dark:text-white/60 ml-2">
                      {new Date(day.work_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {getStatusBadge(day)}
                </div>

                <div className="text-xs text-[#4B244A]/70 dark:text-white/70 font-medium mb-2">
                  🕐 {day.start_time} – {day.end_time}
                </div>

                {/* Confirmation Status */}
                <div className="flex gap-2 mb-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      day.owner_confirmed
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
                    }`}
                  >
                    {day.owner_confirmed ? '✅' : '⬜'} Owner
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      day.housekeeper_confirmed
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/50'
                    }`}
                  >
                    {day.housekeeper_confirmed ? '✅' : '⬜'} Housekeeper
                  </span>
                </div>

                {/* Confirm button & inputs */}
                {canConfirm(day) && (
                  <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-white/10 pt-3">
                    <textarea
                      placeholder="Notes (optional)"
                      value={confirming === day.day_schedule_id ? notes : ''}
                      onChange={(e) => {
                        setConfirming(day.day_schedule_id);
                        setNotes(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-sm bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-[#EA526F] resize-none"
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 px-3 py-1.5 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-xs font-medium text-[#4B244A] dark:text-white cursor-pointer hover:bg-white/80 dark:hover:bg-white/20 transition-colors">
                        <Upload className="w-3 h-3" />
                        {uploadingProof ? 'Uploading...' : proofUrl ? 'Photo ✓' : 'Add Proof'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProofUpload}
                          disabled={uploadingProof}
                        />
                      </label>
                      <button
                        onClick={() => handleConfirmDay(day.day_schedule_id)}
                        disabled={confirming === day.day_schedule_id && confirming !== null && confirming !== day.day_schedule_id}
                        className="flex-1 px-3 py-1.5 bg-gradient-to-r from-[#EA526F] to-green-500 !text-white text-xs font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {confirming === day.day_schedule_id ? 'Confirming...' : `✓ Confirm Day ${day.day_number}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
