import { useState } from 'react';
import { Home, Zap, Users, Calendar, FileText, Camera, User, Clock, RotateCw, Check, AlertTriangle, MapPin } from 'lucide-react';

export interface AcceptedWorker {
  worker_id: number;
  worker_user_id: number;
  name: string;
  contract_id: number;
  contract_status?: string | null;
  payment_proof_url?: string | null;
  paid_at?: string | null;
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
  category_id?: number;
  category_name?: string;
  category_ids?: number[];
  category_names?: string[];
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
  canReapply?: boolean;
  withdrawnDueToConflict?: boolean;
  onStatusRefresh?: () => void;
}

export default function JobDetailModal({ job, onClose, onApply, hasApplied = false, applicationStatus, canReapply = false, withdrawnDueToConflict = false, onStatusRefresh }: JobDetailModalProps) {
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white">{job.title}</h2>
          <button 
             onClick={onClose}
             className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white"
          >
            ×
          </button>
        </div>
      

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* Posted Date */}
          <div className="text-start text-[#4B244A]/60 dark:text-white/30 text-sm">
            Posted on {new Date(job.created_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>

          {/* Budget & Status */}
          <div className="flex items-center justify-between">
            <div className="text-3xl font-bold text-[#EA526F]">₱{job.budget.toLocaleString()}</div>
            <span className={`px-4 py-2 rounded-full text-sm font-bold ${
              job.status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 
              job.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 
              'bg-gray-200 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300'
            }`}>
              {job.status.toUpperCase()}
            </span>
          </div>
          

          {/* Job Details Badges */}
          <div className="flex flex-wrap gap-2">
            <span className="px-4 py-2 bg-white/60 dark:bg-white/10 text-[#4B244A] dark:text-white/90 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/5">
              <Home className="inline w-4 h-4 mr-1" /> {job.house_type}
            </span>
            <span className="px-4 py-2 bg-white/60 dark:bg-white/10 text-[#4B244A] dark:text-white/90 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/5">
              <Zap className="inline w-4 h-4 mr-1" /> {job.cleaning_type}
            </span>
            <span className="px-4 py-2 bg-white/60 dark:bg-white/10 text-[#4B244A] dark:text-white/90 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/5">
              <Users className="inline w-4 h-4 mr-1" /> {job.people_needed} {job.people_needed === 1 ? 'person' : 'people'} needed
            </span>
            <span className="px-4 py-2 bg-white/60 dark:bg-white/10 text-[#4B244A] dark:text-white/90 rounded-lg text-sm font-semibold border border-gray-200 dark:border-white/5">
               {job.duration_type}
            </span>
          </div>

          {/* Duration Details */}
          {(job.start_date || job.end_date) && (
            <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
              <h3 className="text-[#4B244A] dark:text-white font-bold mb-2"><Calendar className="inline w-4 h-4 mr-1" /> Timeline</h3>
              <div className="space-y-2 text-sm">
                {job.start_date && (
                  <p className="text-[#4B244A]/80 dark:text-white/80">
                    <span className="font-semibold">Start Date:</span> <span className="font-bold">{new Date(job.start_date).toLocaleDateString()}</span>
                  </p>
                )}
                {job.end_date && (
                  <p className="text-[#4B244A]/80 dark:text-white/80">
                    <span className="font-semibold">End Date:</span> <span className="font-bold">{new Date(job.end_date).toLocaleDateString()}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
            <h3 className="text-[#4B244A] dark:text-white font-bold mb-2"><FileText className="inline w-4 h-4 mr-1" /> Description</h3>
            <p className="text-[#4B244A]/80 dark:text-white/80 whitespace-pre-wrap break-words">{job.description}</p>
          </div>

          {/* Location */}
          {job.location && (
            <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
              <h3 className="text-[#4B244A] dark:text-white font-bold mb-2"><MapPin className="inline w-4 h-4 mr-1"></MapPin>Location</h3>
              <p className="text-[#4B244A]/80 dark:text-white/80 text-sm">{job.location}</p>
            </div>
          )}

          {/* Images */}
          {job.image_urls && job.image_urls.length > 0 && (
            <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
              <h3 className="text-[#4B244A] dark:text-white font-bold mb-3"><Camera className="inline w-4 h-4 mr-1" /> Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {job.image_urls.map((url, idx) => (
                  <img 
                    key={idx} 
                    src={url} 
                    alt={`Job ${idx + 1}`} 
                    className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-white/20"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Employer Info */}
          <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
            <h3 className="text-[#4B244A] dark:text-white font-bold mb-2"><User className="inline w-4 h-4 mr-1" /> Employer</h3>
            <p className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">{job.employer_name}</p>
             {job.employer_address && <p className="text-[#4B244A]/60 dark:text-white/60 text-sm">{job.employer_address}</p>}
          </div>

          {/* Applicants Counter */}
          <div className="bg-white/50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[#4B244A]/80 dark:text-white/80 text-sm font-medium"><Users className="inline w-4 h-4 mr-1"></Users>Total Applicants</span>
              <span className="text-2xl font-bold text-[#EA526F]">{job.total_applicants}</span>
            </div>
          </div>
        </div>

        {/* Footer - Apply Button */}
        {onApply && (
          <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10 p-6 rounded-b-3xl">
            {hasApplied ? (
              <div className="text-center space-y-3">
                <div className={`inline-flex items-center px-6 py-3 rounded-xl font-bold ${
                  applicationStatus === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' :
                  applicationStatus === 'rejected' || applicationStatus === 'withdrawn' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                }`}>
                  {applicationStatus === 'accepted' ? <><Check className="inline w-4 h-4 mr-1" /> Application Accepted</> :
                   applicationStatus === 'rejected' || applicationStatus === 'withdrawn' ? <>Application Withdrawn</> :
                   <><Clock className="inline w-4 h-4 mr-1" /> Application Pending</>}
                </div>
                {withdrawnDueToConflict && applicationStatus === 'withdrawn' && (
                  <button
                    disabled
                    className="w-full py-3 bg-gray-300 text-gray-600 font-bold text-base rounded-xl cursor-not-allowed"
                  >
                    <AlertTriangle className="inline w-4 h-4 mr-1" /> Cannot Re-apply - Schedule Conflict
                  </button>
                )}
                {canReapply && applicationStatus === 'withdrawn' && !withdrawnDueToConflict && (
                  <button
                    onClick={async () => {
                      await handleApply();
                      if (onStatusRefresh) {
                        onStatusRefresh();
                      }
                    }}
                    disabled={isApplying}
                    className="w-full py-3 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white font-bold text-base rounded-xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EA526F]/30"
                  >
                    {isApplying ? 'Re-applying...' : <><RotateCw className="inline w-4 h-4 mr-1" /> Re-apply to this Job</>}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="w-full py-4 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white font-bold text-lg rounded-xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#EA526F]/30"
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