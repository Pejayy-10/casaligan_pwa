import { useState } from 'react';
import { API_BASE_URL } from '../config';
import { X, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

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
  useScrollLock(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ type: 'accept' | 'reject'; message: string } | null>(null);

  const handleResponse = async (response: 'accept' | 'reject') => {
    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const token = localStorage.getItem('access_token');
      const responseData = await fetch(
        `${API_BASE_URL}/jobs/${jobId}/respond-to-edit?response=${response}`,
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

      // Show success message
      setSuccess({
        type: response,
        message: response === 'accept' 
          ? 'Application updated successfully! Continuing with the edited job.' 
          : 'Application withdrawn successfully.'
      });

      onResponse(response);
      
      // Close modal after showing success message
      setTimeout(() => {
        if (response === 'reject') {
          window.location.reload(); // Refresh for rejected applications
        } else {
          onClose(); // Just close for accepted applications
        }
      }, 2000);
      
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
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                Please review the changes carefully. You can choose to continue with your application or withdraw it.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className={`mb-4 p-4 rounded-lg border ${
              success.type === 'accept' 
                ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30' 
                : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  success.type === 'accept' 
                    ? 'bg-green-500' 
                    : 'bg-blue-500'
                }`}>
                  {success.type === 'accept' ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <XCircle className="w-4 h-4 text-white" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${
                    success.type === 'accept' 
                      ? 'text-green-800 dark:text-green-200' 
                      : 'text-blue-800 dark:text-blue-200'
                  }`}>
                    {success.type === 'accept' ? 'Application Continued' : 'Application Withdrawn'}
                  </p>
                  <p className={`text-xs ${
                    success.type === 'accept' 
                      ? 'text-green-600 dark:text-green-300' 
                      : 'text-blue-600 dark:text-blue-300'
                  }`}>
                    {success.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {success ? (
              <div className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {success.type === 'accept' ? 'Updating Application...' : 'Withdrawing Application...'}
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleResponse('accept')}
                  disabled={loading}
                  className="w-full px-6 py-3 !bg-[#EA526F] !text-white rounded-xl hover:bg-[#d4486a] transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EA526F]/30 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Continue with Application
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => handleResponse('reject')}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 dark:border-white/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      Withdraw Application
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

