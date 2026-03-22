import { useState } from 'react';
import { Calendar, DollarSign, FileText, X, Send, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface ExtendContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle: string;
  contractId: number;
  currentEndDate?: string | null;
  currentBudget?: number;
  workerName: string;
  onSuccess: () => void;
}

export default function ExtendContractModal({
  isOpen,
  onClose,
  jobTitle,
  contractId,
  currentEndDate,
  currentBudget,
  workerName,
  onSuccess
}: ExtendContractModalProps) {
  const [proposedEndDate, setProposedEndDate] = useState('');
  const [proposedBudget, setProposedBudget] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError('');

    if (!proposedEndDate) {
      setError('Please select a new end date');
      return;
    }

    // Validate that the proposed end date is after the current end date
    if (currentEndDate) {
      const current = new Date(currentEndDate);
      const proposed = new Date(proposedEndDate);
      if (proposed <= current) {
        setError('The new end date must be after the current end date');
        return;
      }
    }

    // Validate proposed date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(proposedEndDate) <= today) {
      setError('The new end date must be in the future');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/contract-extensions/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contract_id: contractId,
          proposed_end_date: proposedEndDate,
          proposed_budget: proposedBudget ? parseFloat(proposedBudget) : null,
          reason: reason.trim() || null
        })
      });

      if (response.ok) {
        alert('Contract extension proposed successfully! The housekeeper will be notified.');
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to propose extension');
      }
    } catch (err) {
      console.error('Extension proposal error:', err);
      setError('Failed to submit extension proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 p-5 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#EA526F]" />
            Extend Contract
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Job Info */}
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
            <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-1">Job</h3>
            <p className="text-[#4B244A] dark:text-white font-bold">{jobTitle}</p>
            <p className="text-sm text-[#4B244A]/60 dark:text-white/60 mt-1">Worker: {workerName}</p>
            {currentEndDate && (
              <p className="text-sm text-[#4B244A]/60 dark:text-white/60">
                Current end date: <span className="font-semibold">{new Date(currentEndDate).toLocaleDateString()}</span>
              </p>
            )}
            {currentBudget !== undefined && currentBudget > 0 && (
              <p className="text-sm text-[#4B244A]/60 dark:text-white/60">
                Current budget: <span className="font-semibold">₱{currentBudget.toLocaleString()}</span>
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-3 border border-red-200 dark:border-red-500/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          {/* Proposed End Date */}
          <div>
            <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">
              <Calendar className="inline w-4 h-4 mr-1" /> New End Date *
            </label>
            <input
              type="date"
              value={proposedEndDate}
              onChange={(e) => setProposedEndDate(e.target.value)}
              min={currentEndDate ? new Date(new Date(currentEndDate).getTime() + 86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-[#4B244A] dark:text-white focus:ring-2 focus:ring-[#EA526F]/30 focus:border-[#EA526F] outline-none transition-all"
            />
          </div>

          {/* Proposed Budget (optional) */}
          <div>
            <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">
              <DollarSign className="inline w-4 h-4 mr-1" /> New Budget (optional)
            </label>
            <input
              type="number"
              value={proposedBudget}
              onChange={(e) => setProposedBudget(e.target.value)}
              placeholder="Leave blank to keep current budget"
              min="0"
              step="0.01"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-[#4B244A] dark:text-white focus:ring-2 focus:ring-[#EA526F]/30 focus:border-[#EA526F] outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-white/30"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">
              <FileText className="inline w-4 h-4 mr-1" /> Reason for Extension (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Need continued help for another month..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-[#4B244A] dark:text-white focus:ring-2 focus:ring-[#EA526F]/30 focus:border-[#EA526F] outline-none transition-all resize-none placeholder:text-gray-400 dark:placeholder:text-white/30"
            />
          </div>

          {/* Info Note */}
          <div className="bg-yellow-50 dark:bg-yellow-500/10 rounded-xl p-3 border border-yellow-200 dark:border-yellow-500/20">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
              <AlertCircle className="inline w-4 h-4 mr-1" />
              The housekeeper will be notified and can choose to accept or decline this extension.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10 p-5 rounded-b-3xl">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !proposedEndDate}
              className="flex-1 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg shadow-[#EA526F]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Propose Extension
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
