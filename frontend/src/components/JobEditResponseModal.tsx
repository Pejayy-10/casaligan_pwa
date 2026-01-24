import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface JobEditResponseModalProps {
  jobId: number;
  jobTitle: string;
  message: string;
  onClose: () => void;
  onResponse: (response: 'accept' | 'reject') => void;
}

export default function JobEditResponseModal({
  jobId,
  jobTitle,
  message,
  onClose,
  onResponse
}: JobEditResponseModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResponse = async (response: 'accept' | 'reject') => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const responseData = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/respond-to-edit?response=${response}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!responseData.ok) {
        const errorData = await responseData.json();
        throw new Error(errorData.detail || 'Failed to submit response');
      }

      onResponse(response);
      
      // If rejected, refresh the page to show updated status
      if (response === 'reject') {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-500/10 dark:to-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 dark:bg-yellow-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">
              Job Post Updated
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-[#4B244A] dark:text-white mb-3">
              {jobTitle}
            </h3>
            
            {/* Display changes in a formatted way */}
            <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-4 mb-4 border border-gray-200 dark:border-white/10">
              <h4 className="text-sm font-bold text-[#4B244A] dark:text-white mb-2">
                Changes Made:
              </h4>
              <div className="space-y-2 text-sm text-gray-700 dark:text-white/80">
                {message.split('\n').filter(line => line.trim() && line.startsWith('•')).map((change, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">•</span>
                    <span className="flex-1">{change.substring(1).trim()}</span>
                  </div>
                ))}
                {!message.includes('•') && (
                  <p className="text-gray-600 dark:text-white/70 italic">{message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              ⚠️ Please review the changes carefully. You can choose to continue with your application or withdraw it.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => handleResponse('reject')}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Withdraw Application'}
            </button>
            <button
              onClick={() => handleResponse('accept')}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#EA526F] text-white rounded-lg hover:bg-[#d4486a] transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Continue Application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

