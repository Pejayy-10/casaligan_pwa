import { useState } from 'react';

export interface AcceptedWorker {
  worker_id: number;
  name: string;
  contract_id: number;
}

export interface JobPost {
  post_id: number;
  title: string;
  description: string;
  house_type: string;
  cleaning_type: string;
  budget: number;
  people_needed: number;
  image_urls: string[];
  duration_type: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  status: string;
  created_at: string;
  employer_name?: string;
  employer_address?: string;
  total_applicants: number;
  pending_payments?: number;  // Number of unpaid payments
  accepted_workers?: AcceptedWorker[];  // List of accepted housekeepers
  payment_schedule?: {
    frequency: string;
    payment_amount: number;
    payment_dates: string[];
    payment_method_preference: string;
  };
}

interface JobDetailModalProps {
  job: JobPost;
  onClose: () => void;
  onApply?: (jobId: number) => Promise<void>;
  hasApplied?: boolean;
  applicationStatus?: string;
}

export default function JobDetailModal({ job, onClose, onApply, hasApplied = false, applicationStatus }: JobDetailModalProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!onApply) return;
    setIsApplying(true);
    try {
      await onApply(job.post_id);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/20 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{job.title}</h2>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Budget & Status */}
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-[#EA526F]">₱{job.budget.toLocaleString()}</div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
              job.status === 'open' ? 'bg-green-500/20 text-green-300' : 
              job.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' : 
              'bg-gray-500/20 text-gray-300'
            }`}>
              {job.status.toUpperCase()}
            </span>
          </div>

          {/* Job Details Badges */}
          <div className="flex flex-wrap gap-2">
            <span className="px-4 py-2 bg-white/10 text-white/90 rounded-lg text-sm font-semibold">
              🏠 {job.house_type}
            </span>
            <span className="px-4 py-2 bg-white/10 text-white/90 rounded-lg text-sm font-semibold">
              🧹 {job.cleaning_type}
            </span>
            <span className="px-4 py-2 bg-white/10 text-white/90 rounded-lg text-sm font-semibold">
              👥 {job.people_needed} {job.people_needed === 1 ? 'person' : 'people'} needed
            </span>
            <span className="px-4 py-2 bg-white/10 text-white/90 rounded-lg text-sm font-semibold">
              ⏱️ {job.duration_type}
            </span>
          </div>

          {/* Duration Details */}
          {job.duration_type === 'long_term' && job.start_date && job.end_date && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-2">📅 Duration</h3>
              <p className="text-white/80 text-sm">
                From <span className="font-semibold">{new Date(job.start_date).toLocaleDateString()}</span> to{' '}
                <span className="font-semibold">{new Date(job.end_date).toLocaleDateString()}</span>
              </p>
            </div>
          )}

          {/* Description */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-2">📝 Description</h3>
            <p className="text-white/80 whitespace-pre-wrap">{job.description}</p>
          </div>

          {/* Location */}
          {job.location && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-2">📍 Location</h3>
              <p className="text-white/80 text-sm">{job.location}</p>
            </div>
          )}

          {/* Images */}
          {job.image_urls && job.image_urls.length > 0 && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h3 className="text-white font-semibold mb-3">📸 Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {job.image_urls.map((url, idx) => (
                  <img 
                    key={idx} 
                    src={url} 
                    alt={`Job ${idx + 1}`} 
                    className="w-full h-32 object-cover rounded-lg border border-white/20"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Employer Info */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-2">👤 Employer</h3>
            <p className="text-white/80 text-sm">{job.employer_name}</p>
            {job.employer_address && <p className="text-white/60 text-sm">📍 {job.employer_address}</p>}
          </div>

          {/* Applicants Counter */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white/80 text-sm">Total Applicants</span>
              <span className="text-2xl font-bold text-[#EA526F]">{job.total_applicants}</span>
            </div>
          </div>

          {/* Posted Date */}
          <div className="text-center text-white/60 text-sm">
            Posted on {new Date(job.created_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>

        {/* Footer - Apply Button */}
        {onApply && (
          <div className="sticky bottom-0 bg-white/10 backdrop-blur-xl border-t border-white/20 p-6">
            {hasApplied ? (
              <div className="text-center">
                <div className={`inline-flex items-center px-6 py-3 rounded-xl font-semibold ${
                  applicationStatus === 'accepted' ? 'bg-green-500/20 text-green-300' :
                  applicationStatus === 'rejected' ? 'bg-red-500/20 text-red-300' :
                  'bg-yellow-500/20 text-yellow-300'
                }`}>
                  {applicationStatus === 'accepted' ? '✓ Application Accepted' :
                   applicationStatus === 'rejected' ? '✗ Application Rejected' :
                   '⏳ Application Pending'}
                </div>
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="w-full py-4 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white font-bold text-lg rounded-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? 'Applying...' : 'Apply Now'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
