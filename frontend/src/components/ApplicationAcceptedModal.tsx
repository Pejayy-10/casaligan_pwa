import { useState, useEffect } from 'react';
import { X, User, FileText, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface JobInfo {
  post_id: number;
  title: string;
  description: string;
  budget: number;
  start_date?: string;
  end_date?: string;
  employer_name?: string;
  status: string;
}

interface ApplicationAcceptedModalProps {
  jobId: number;
  onClose: () => void;
}

export default function ApplicationAcceptedModal({ jobId, onClose }: ApplicationAcceptedModalProps) {
  const [jobInfo, setJobInfo] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobInfo();
  }, [jobId]);

  const fetchJobInfo = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setJobInfo(data);
      }
    } catch (error) {
      console.error('Error fetching job info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-8 border border-gray-200 dark:border-white/20 shadow-2xl">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E7467B] dark:border-[#EA526F]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!jobInfo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-8 border border-gray-200 dark:border-white/20 shadow-2xl">
          <p className="text-gray-600 dark:text-white/70 text-center">Unable to load job details</p>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-[#E7467B] text-white rounded-lg font-medium hover:bg-[#E7467B]/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-500 to-emerald-600 p-8 flex items-center justify-between z-10 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-white" />
            <h2 className="text-3xl font-bold text-white">Congratulations!</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Main Message */}
          <div className="text-center space-y-2">
            <p className="text-xl text-gray-600 dark:text-white/80">
              Your application has been <span className="font-bold text-green-600 dark:text-green-400">accepted!</span>
            </p>
            <p className="text-gray-500 dark:text-white/60">Here are the job details:</p>
          </div>

          {/* Job Details Card */}
          <div className="bg-gradient-to-br from-[#4B244A]/5 to-[#E7467B]/5 dark:from-white/10 dark:to-white/5 rounded-2xl p-6 space-y-5 border border-gray-200 dark:border-white/10">
            
            {/* Job Title */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">Job Title</p>
              <p className="text-2xl font-bold text-[#4B244A] dark:text-white">{jobInfo.title}</p>
            </div>

            {/* Owner Name */}
            {jobInfo.employer_name && (
              <div className="flex items-start gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
                <User className="w-5 h-5 text-[#E7467B] dark:text-[#EA526F] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">Posted by</p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-white/90">{jobInfo.employer_name}</p>
                </div>
              </div>
            )}

            {/* Budget */}
            <div className="flex items-start gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">Budget</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">₱{jobInfo.budget.toLocaleString()}</p>
              </div>
            </div>

            {/* Start Date */}
            {jobInfo.start_date && (
              <div className="flex items-start gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
                <Calendar className="w-5 h-5 text-[#E7467B] dark:text-[#EA526F] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">Start Date</p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-white/90">{formatDate(jobInfo.start_date)}</p>
                </div>
              </div>
            )}

            {/* End Date */}
            {jobInfo.end_date && (
              <div className="flex items-start gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
                <Calendar className="w-5 h-5 text-[#E7467B] dark:text-[#EA526F] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">End Date</p>
                  <p className="text-lg font-semibold text-gray-700 dark:text-white/90">{formatDate(jobInfo.end_date)}</p>
                </div>
              </div>
            )}

            {/* Description */}
            {jobInfo.description && (
              <div className="flex items-start gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
                <FileText className="w-5 h-5 text-[#E7467B] dark:text-[#EA526F] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-gray-700 dark:text-white/80 leading-relaxed">{jobInfo.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-shadow"
            >
              Got it, thanks!
            </button>
          </div>

          {/* Footer Message */}
          <p className="text-center text-sm text-gray-500 dark:text-white/50">
            Check your dashboard to see more details or contact the job owner if you have questions.
          </p>
        </div>
      </div>
    </div>
  );
}
