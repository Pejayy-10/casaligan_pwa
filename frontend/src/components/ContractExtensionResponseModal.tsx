import { useState } from 'react';
import { Calendar, DollarSign, FileText, X, Check, XCircle, AlertCircle, User } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useConfirmDialog } from './useConfirmDialog';
import { useScrollLock } from '../hooks/useScrollLock';

export interface PendingExtension {
  extension_id: number;
  contract_id: number;
  post_id: number;
  job_title: string;
  current_end_date: string | null;
  proposed_end_date: string;
  proposed_budget: number | null;
  reason: string | null;
  proposed_by_name: string | null;
  status: string;
  created_at: string | null;
}

interface ContractExtensionResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  extension: PendingExtension;
  onSuccess: () => void;
}

export default function ContractExtensionResponseModal({
  isOpen,
  onClose,
  extension,
  onSuccess
}: ContractExtensionResponseModalProps) {
  useScrollLock(isOpen);
  const { confirm, confirmDialog } = useConfirmDialog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleRespond = async (accepted: boolean) => {
    const action = accepted ? 'accept' : 'decline';
    const shouldProceed = await confirm({
      title: accepted ? 'Accept Extension' : 'Decline Extension',
      message: `Are you sure you want to ${action} this contract extension?`,
      confirmLabel: accepted ? 'Accept' : 'Decline',
      tone: accepted ? 'default' : 'danger'
    });
    if (!shouldProceed) return;

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/contract-extensions/${extension.extension_id}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ accepted })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || (accepted ? 'Extension accepted!' : 'Extension declined.'));
        onSuccess();
        onClose();
      } else {
        const data = await response.json();
        setError(data.detail || `Failed to ${action} extension`);
      }
    } catch (err) {
      console.error('Extension response error:', err);
      setError(`Failed to ${action} extension`);
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
            Contract Extension Request
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Job Info */}
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
            <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">{extension.job_title}</h3>
            {extension.proposed_by_name && (
              <p className="text-sm text-[#4B244A]/60 dark:text-white/60 mt-1 flex items-center gap-1">
                <User className="inline w-4 h-4" /> Proposed by: <span className="font-semibold">{extension.proposed_by_name}</span>
              </p>
            )}
            {extension.created_at && (
              <p className="text-xs text-[#4B244A]/50 dark:text-white/50 mt-1">
                Sent on {new Date(extension.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>

          {/* Extension Details */}
          <div className="space-y-3">
            {/* Date Change */}
            <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
              <h4 className="text-sm font-bold text-[#4B244A] dark:text-white mb-2 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-blue-500" /> End Date Change
              </h4>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-xs text-[#4B244A]/60 dark:text-white/60">Current</p>
                  <p className="text-sm font-bold text-[#4B244A] dark:text-white">
                    {extension.current_end_date 
                      ? new Date(extension.current_end_date).toLocaleDateString() 
                      : 'Not set'}
                  </p>
                </div>
                <div className="text-[#EA526F] font-bold text-lg">→</div>
                <div className="text-center">
                  <p className="text-xs text-green-600 dark:text-green-400">Proposed</p>
                  <p className="text-sm font-bold text-green-700 dark:text-green-300">
                    {new Date(extension.proposed_end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Budget Change */}
            {extension.proposed_budget !== null && (
              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <h4 className="text-sm font-bold text-[#4B244A] dark:text-white mb-2 flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-500" /> Updated Budget
                </h4>
                <p className="text-lg font-bold text-green-700 dark:text-green-300">₱{extension.proposed_budget.toLocaleString()}</p>
              </div>
            )}

            {/* Reason */}
            {extension.reason && (
              <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                <h4 className="text-sm font-bold text-[#4B244A] dark:text-white mb-2 flex items-center gap-1">
                  <FileText className="w-4 h-4 text-purple-500" /> Reason
                </h4>
                <p className="text-sm text-[#4B244A]/80 dark:text-white/80 whitespace-pre-wrap">{extension.reason}</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 rounded-xl p-3 border border-red-200 dark:border-red-500/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="bg-yellow-50 dark:bg-yellow-500/10 rounded-xl p-3 border border-yellow-200 dark:border-yellow-500/20">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
              <AlertCircle className="inline w-4 h-4 mr-1" />
              If you accept, your contract end date will be updated. If you decline, the contract remains unchanged.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10 p-5 rounded-b-3xl">
          <div className="flex gap-3">
            <button
              onClick={() => handleRespond(false)}
              disabled={loading}
              className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <XCircle className="w-4 h-4" /> Decline
                </>
              )}
            </button>
            <button
              onClick={() => handleRespond(true)}
              disabled={loading}
              className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Accept Extension
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
