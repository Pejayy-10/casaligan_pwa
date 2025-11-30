import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import NotificationBell from '../components/NotificationBell';
import JobDetailModal, { type JobPost } from '../components/JobDetailModal';
import ApplicantsListModal from '../components/ApplicantsListModal';
import PaymentModal from '../components/PaymentModal';
import ContractModal from '../components/ContractModal';
import PaymentTrackerOwner from '../components/PaymentTrackerOwner';
import PaymentTrackerWorker from '../components/PaymentTrackerWorker';
import JobProgressTracker from '../components/JobProgressTracker';
import CheckInModal from '../components/CheckInModal';
import HousekeeperMyJobs, { type AcceptedJob } from '../components/HousekeeperMyJobs';
import HousekeeperProgressModal from '../components/HousekeeperProgressModal';
import JobCompletionModal from '../components/JobCompletionModal';
import ReportUnpaidModal from '../components/ReportUnpaidModal';
import CompletionReviewModal from '../components/CompletionReviewModal';
import PackageManagement from '../components/PackageManagement';
import DirectHiresList from '../components/DirectHiresList';
import type { User } from '../types';

export default function JobsPage() {
  const navigate = useNavigate();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [applicationStatuses, setApplicationStatuses] = useState<Record<number, { has_applied: boolean; status?: string }>>({});
  const [showApplicants, setShowApplicants] = useState<JobPost | null>(null);
  const [showPayment, setShowPayment] = useState<{ jobTitle: string; amount: number; workerName: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'ongoing' | 'completed' | 'closed'>('all');
  const [showContract, setShowContract] = useState<JobPost | null>(null);
  const [showPaymentTracker, setShowPaymentTracker] = useState<JobPost | null>(null);
  const [showProgressTracker, setShowProgressTracker] = useState<JobPost | null>(null);
  const [showCheckIn, setShowCheckIn] = useState<JobPost | null>(null);
  
  // Housekeeper-specific states
  const [housekeeperView, setHousekeeperView] = useState<'find' | 'my-jobs'>('find');
  const [showHousekeeperProgress, setShowHousekeeperProgress] = useState<AcceptedJob | null>(null);
  const [showJobCompletion, setShowJobCompletion] = useState<AcceptedJob | null>(null);
  const [showReportUnpaid, setShowReportUnpaid] = useState<AcceptedJob | null>(null);
  const [showCompletionReview, setShowCompletionReview] = useState<JobPost | null>(null);
  const [showHousekeeperPayments, setShowHousekeeperPayments] = useState<AcceptedJob | null>(null);
  
  // Direct hire states
  const [showPackageManagement, setShowPackageManagement] = useState(false);
  const [showDirectHires, setShowDirectHires] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const endpoint = user?.active_role === 'owner' 
        ? `http://127.0.0.1:8000/jobs/my-posts${statusFilter !== 'all' ? `?status_filter=${statusFilter}` : ''}`
        : 'http://127.0.0.1:8000/jobs/?status_filter=open';
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data);
        
        // Load application statuses for housekeepers
        if (user?.active_role === 'housekeeper') {
          const statuses: Record<number, { has_applied: boolean; status?: string }> = {};
          for (const job of data) {
            try {
              const statusResponse = await fetch(`http://127.0.0.1:8000/jobs/${job.post_id}/application-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                statuses[job.post_id] = statusData;
              }
            } catch (err) {
              console.error(`Failed to load status for job ${job.post_id}`, err);
            }
          }
          setApplicationStatuses(statuses);
        }
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      loadJobs();
    }
  }, [user, navigate, loadJobs, statusFilter]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] pb-20">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {user.active_role === 'owner' 
                  ? '📋 My Job Posts' 
                  : housekeeperView === 'find' 
                    ? '🎯 Find Jobs' 
                    : '💼 My Accepted Jobs'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              {user.active_role === 'owner' && (
                <>
                  <button 
                    onClick={() => navigate('/browse-workers')}
                    className="px-4 py-2 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition-all border border-white/30 text-sm"
                  >
                    👤 Hire Directly
                  </button>
                  <button 
                    onClick={() => setShowDirectHires(true)}
                    className="px-4 py-2 bg-blue-500/80 text-white font-semibold rounded-xl hover:bg-blue-600 transition-all text-sm"
                  >
                    📋 Direct Bookings
                  </button>
                  <button 
                    onClick={() => navigate('/jobs/create')}
                    className="px-4 py-2 bg-[#EA526F] text-white font-semibold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg text-sm"
                  >
                    + New Job
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Housekeeper View Toggle */}
          {user.active_role === 'housekeeper' && (
            <div className="mt-3 sm:mt-4 space-y-3">
              {/* Direct Hire Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPackageManagement(true)}
                  className="flex-1 py-2 px-3 bg-[#EA526F] text-white text-sm font-semibold rounded-lg hover:bg-[#d4486a] transition-all"
                >
                  📦 My Packages
                </button>
                <button
                  onClick={() => setShowDirectHires(true)}
                  className="flex-1 py-2 px-3 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-all"
                >
                  🎯 Direct Jobs
                </button>
              </div>
              
              {/* View Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setHousekeeperView('find')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    housekeeperView === 'find'
                      ? 'bg-[#EA526F] text-white shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  🎯 Find Jobs
                </button>
                <button
                  onClick={() => setHousekeeperView('my-jobs')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    housekeeperView === 'my-jobs'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  💼 My Jobs
                </button>
              </div>
            </div>
          )}
          
          {/* Status Filter Tabs - Owner Only */}
          {user.active_role === 'owner' && (
            <div className="mt-3 sm:mt-4 overflow-x-auto pb-2 -mx-3 sm:mx-0 px-3 sm:px-0">
              <div className="flex gap-2 min-w-max">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    statusFilter === 'all'
                      ? 'bg-white text-[#4B244A] shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  📋 All Jobs
                </button>
                <button
                  onClick={() => setStatusFilter('open')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    statusFilter === 'open'
                      ? 'bg-green-500 text-white shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  ✅ Open
                </button>
                <button
                  onClick={() => setStatusFilter('ongoing')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    statusFilter === 'ongoing'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  🔄 Ongoing
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    statusFilter === 'completed'
                      ? 'bg-purple-500 text-white shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  ✔️ Completed
                </button>
                <button
                  onClick={() => setStatusFilter('closed')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    statusFilter === 'closed'
                      ? 'bg-gray-500 text-white shadow-lg'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  🔒 Closed
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {loading && housekeeperView === 'find' ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-white/70 mt-4">Loading jobs...</p>
          </div>
        ) : user.active_role === 'owner' ? (
          <OwnerJobsContent 
            jobs={jobs} 
            navigate={navigate} 
            onViewApplicants={setShowApplicants}
            onShowPaymentTracker={setShowPaymentTracker}
            onShowProgressTracker={setShowProgressTracker}
            onShowCompletionReview={setShowCompletionReview}
          />
        ) : housekeeperView === 'my-jobs' ? (
          <HousekeeperMyJobs
            onShowProgress={setShowHousekeeperProgress}
            onSubmitCompletion={setShowJobCompletion}
            onReportUnpaid={setShowReportUnpaid}
            onShowPayments={setShowHousekeeperPayments}
          />
        ) : (
          <HousekeeperJobsContent jobs={jobs} onSelectJob={setSelectedJob} />
        )}
      </main>

      <TabBar role={user.active_role} />
      
      {/* Job Detail Modal */}
      {selectedJob && !showContract && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApply={async () => {
            // Show contract instead of applying directly
            setShowContract(selectedJob);
          }}
          hasApplied={applicationStatuses[selectedJob.post_id]?.has_applied}
          applicationStatus={applicationStatuses[selectedJob.post_id]?.status}
        />
      )}
      
      {/* Contract Modal */}
      {showContract && (
        <ContractModal
          jobTitle={showContract.title}
          jobDetails={{
            description: showContract.description,
            house_type: showContract.house_type,
            cleaning_type: showContract.cleaning_type,
            budget: showContract.budget,
            location: showContract.location,
            duration_type: showContract.duration_type,
            start_date: showContract.start_date,
            end_date: showContract.end_date,
            payment_schedule: showContract.payment_schedule
          }}
          employerName={showContract.employer_name || 'Employer'}
          onAccept={async () => {
            try {
              const token = localStorage.getItem('access_token');
              const response = await fetch(`http://127.0.0.1:8000/jobs/${showContract.post_id}/apply`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (response.ok) {
                alert('Contract accepted! Application submitted successfully!');
                setShowContract(null);
                setSelectedJob(null);
                
                // Fetch updated application status
                const statusResponse = await fetch(`http://127.0.0.1:8000/jobs/${showContract.post_id}/application-status`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();
                  setApplicationStatuses(prev => ({
                    ...prev,
                    [showContract.post_id]: statusData
                  }));
                }
                
                // Reload jobs to update applicant count
                loadJobs();
              } else {
                const errorData = await response.json();
                alert(errorData.detail || 'Failed to apply to job');
              }
            } catch (error) {
              console.error('Apply error:', error);
              alert('Failed to apply to job');
            }
          }}
          onReject={() => {
            setShowContract(null);
            setSelectedJob(null);
          }}
        />
      )}
      
      {/* Applicants List Modal */}
      {showApplicants && (
        <ApplicantsListModal
          jobId={showApplicants.post_id}
          jobTitle={showApplicants.title}
          peopleNeeded={showApplicants.people_needed}
          onClose={() => setShowApplicants(null)}
          onJobStarted={() => {
            // Job started - refresh the list to show updated status
            setShowApplicants(null);
            loadJobs();
          }}
        />
      )}
      
      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          amount={showPayment.amount}
          jobTitle={showPayment.jobTitle}
          onClose={() => setShowPayment(null)}
          onSuccess={(method, refNumber) => {
            alert(`Payment successful!\n\nWorker: ${showPayment.workerName}\nMethod: ${method.toUpperCase()}\nReference: ${refNumber}\n\nJob is now in progress!`);
            setShowPayment(null);
            loadJobs(); // Refresh to update job status
          }}
        />
      )}
      
      {/* Payment Tracker Modal */}
      {showPaymentTracker && (
        user?.active_role === 'owner' ? (
          <PaymentTrackerOwner
            jobId={showPaymentTracker.post_id}
            jobTitle={showPaymentTracker.title}
            onClose={() => setShowPaymentTracker(null)}
          />
        ) : (
          <PaymentTrackerWorker
            jobId={showPaymentTracker.post_id}
            jobTitle={showPaymentTracker.title}
            onClose={() => setShowPaymentTracker(null)}
          />
        )
      )}
      
      {/* Job Progress Tracker Modal */}
      {showProgressTracker && (
        <JobProgressTracker
          jobId={showProgressTracker.post_id}
          onClose={() => setShowProgressTracker(null)}
          userRole={user?.active_role as 'owner' | 'housekeeper'}
        />
      )}
      
      {/* Check In Modal */}
      {showCheckIn && (
        <CheckInModal
          jobId={showCheckIn.post_id}
          jobTitle={showCheckIn.title}
          onClose={() => setShowCheckIn(null)}
          onSuccess={() => {
            alert('Checked in successfully!');
            setShowCheckIn(null);
          }}
        />
      )}
      
      {/* Housekeeper Progress Modal */}
      {showHousekeeperProgress && (
        <HousekeeperProgressModal
          jobId={showHousekeeperProgress.post_id}
          onClose={() => setShowHousekeeperProgress(null)}
          onSubmitCompletion={() => {
            setShowHousekeeperProgress(null);
            setShowJobCompletion(showHousekeeperProgress);
          }}
        />
      )}
      
      {/* Housekeeper Payment Tracker Modal */}
      {showHousekeeperPayments && (
        <PaymentTrackerWorker
          jobId={showHousekeeperPayments.post_id}
          jobTitle={showHousekeeperPayments.title}
          onClose={() => setShowHousekeeperPayments(null)}
        />
      )}
      
      {/* Job Completion Modal */}
      {showJobCompletion && (
        <JobCompletionModal
          jobId={showJobCompletion.post_id}
          jobTitle={showJobCompletion.title}
          onClose={() => setShowJobCompletion(null)}
          onSuccess={() => {
            alert('Job completion submitted! Waiting for owner approval.');
            setShowJobCompletion(null);
          }}
        />
      )}
      
      {/* Report Unpaid Modal */}
      {showReportUnpaid && (
        <ReportUnpaidModal
          jobId={showReportUnpaid.post_id}
          jobTitle={showReportUnpaid.title}
          pendingPayments={showReportUnpaid.payments.pending_payments}
          onClose={() => setShowReportUnpaid(null)}
          onSuccess={() => {
            alert('Report submitted successfully. Our team will review this case.');
            setShowReportUnpaid(null);
          }}
        />
      )}
      
      {/* Owner Completion Review Modal */}
      {showCompletionReview && (
        <CompletionReviewModal
          jobId={showCompletionReview.post_id}
          jobTitle={showCompletionReview.title}
          onClose={() => setShowCompletionReview(null)}
          onApproved={() => {
            alert('Job completion approved! Job is now marked as completed.');
            setShowCompletionReview(null);
            loadJobs();
          }}
        />
      )}
      
      {/* Package Management Modal (Housekeeper) */}
      {showPackageManagement && (
        <PackageManagement onClose={() => setShowPackageManagement(false)} />
      )}
      
      {/* Direct Hires List Modal */}
      {showDirectHires && (
        <DirectHiresList 
          role={user?.active_role as 'owner' | 'housekeeper'} 
          onClose={() => setShowDirectHires(false)} 
        />
      )}
    </div>
  );
}

function OwnerJobsContent({ 
  jobs, 
  navigate, 
  onViewApplicants,
  onShowPaymentTracker,
  onShowProgressTracker,
  onShowCompletionReview
}: { 
  jobs: JobPost[]; 
  navigate: (path: string) => void;
  onViewApplicants: (job: JobPost) => void;
  onShowPaymentTracker: (job: JobPost) => void;
  onShowProgressTracker: (job: JobPost) => void;
  onShowCompletionReview: (job: JobPost) => void;
}) {
  const handleStatusUpdate = async (postId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/jobs/${postId}/status?new_status=${newStatus}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert(`Job status updated to ${newStatus.toUpperCase()}!`);
        window.location.reload(); // Refresh to update UI
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to update job status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update job status');
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/20">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Job Posts Yet</h3>
        <p className="text-white/70 mb-6">Create your first job post to find housekeepers</p>
        <button 
          onClick={() => navigate('/jobs/create')}
          className="px-6 py-3 bg-[#EA526F] text-white font-semibold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg"
        >
          Create Your First Job Post
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.post_id} className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20 hover:bg-white/15 transition-all">
          <div className="flex items-start justify-between mb-3 gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-white break-words">{job.title}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              job.status === 'open' ? 'bg-green-500/20 text-green-300' : 
              job.status === 'ongoing' ? 'bg-blue-500/20 text-blue-300' :
              job.status === 'pending_completion' ? 'bg-yellow-500/20 text-yellow-300' :
              job.status === 'completed' ? 'bg-purple-500/20 text-purple-300' : 
              'bg-gray-500/20 text-gray-300'
            }`}>
              {job.status === 'pending_completion' ? 'PENDING APPROVAL' : job.status.toUpperCase()}
            </span>
          </div>
          
          <p className="text-white/70 mb-4 line-clamp-2">{job.description}</p>
          
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <span className="px-2 sm:px-3 py-1 bg-[#EA526F]/20 text-[#EA526F] rounded-lg text-xs sm:text-sm font-semibold">
              🏠 {job.house_type}
            </span>
            <span className="px-2 sm:px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs sm:text-sm font-semibold">
              🧹 {job.cleaning_type}
            </span>
            <span className="px-2 sm:px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-xs sm:text-sm font-semibold">
              💰 ₱{job.budget}
            </span>
            <span className="px-2 sm:px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs sm:text-sm font-semibold">
              👥 {job.people_needed} {job.people_needed === 1 ? 'person' : 'people'}
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs sm:text-sm text-white/60">
            <span>📅 {new Date(job.created_at).toLocaleDateString()}</span>
            <span>📬 {job.total_applicants} {job.total_applicants === 1 ? 'applicant' : 'applicants'}</span>
          </div>
          
          {/* Show accepted housekeepers */}
          {job.accepted_workers && job.accepted_workers.length > 0 && (
            <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
              <p className="text-green-300 text-sm font-semibold mb-2">
                👷 Accepted Housekeepers ({job.accepted_workers.length}/{job.people_needed}):
              </p>
              <div className="flex flex-wrap gap-2">
                {job.accepted_workers.map((worker) => (
                  <span 
                    key={worker.worker_id}
                    className="px-3 py-1 bg-green-500/20 text-green-200 rounded-full text-sm font-medium"
                  >
                    {worker.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Action buttons based on status */}
          <div className="mt-3 sm:mt-4 space-y-2">
            {job.status === 'open' && job.total_applicants > 0 && (
              <button
                onClick={() => onViewApplicants(job)}
                className="w-full py-2 bg-[#EA526F] text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-[#d4486a] transition-all"
              >
                View Applicants ({job.total_applicants})
              </button>
            )}
            
            {job.status === 'open' && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to cancel this job?')) {
                    handleStatusUpdate(job.post_id, 'cancelled');
                  }
                }}
                className="w-full py-2 bg-gray-500 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-gray-600 transition-all"
              >
                🔒 Cancel Job
              </button>
            )}
            
            {job.status === 'ongoing' && (
              <>
                {/* Warning for unpaid payments on long-term jobs */}
                {job.duration_type === 'long_term' && job.pending_payments && job.pending_payments > 0 && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <p className="text-red-300 font-semibold">
                          {job.pending_payments} Unpaid Payment{job.pending_payments > 1 ? 's' : ''}!
                        </p>
                        <p className="text-red-300/80 text-sm">
                          Please pay your housekeeper to avoid issues.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Only show Payment Tracker for long-term jobs */}
                {job.duration_type === 'long_term' && (
                  <button
                    onClick={() => onShowPaymentTracker(job)}
                    className={`w-full py-2 text-white text-sm sm:text-base font-semibold rounded-lg transition-all ${
                      job.pending_payments && job.pending_payments > 0 
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {job.pending_payments && job.pending_payments > 0 
                      ? `💰 Pay Now (${job.pending_payments} pending)` 
                      : 'Payment Tracker'}
                  </button>
                )}
                {/* Only show Progress Tracker for long-term jobs */}
                {job.duration_type === 'long_term' && (
                  <button
                    onClick={() => onShowProgressTracker(job)}
                    className="w-full py-2 bg-blue-500 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-blue-600 transition-all"
                  >
                    Job Progress
                  </button>
                )}
                {/* For short-term jobs, show info about waiting for housekeeper to complete */}
                {job.duration_type === 'short_term' && (
                  <div className="py-2 text-center text-blue-300 text-sm">
                    ⏳ Waiting for housekeeper to complete and submit proof
                  </div>
                )}
              </>
            )}
            
            {job.status === 'pending_completion' && (
              <>
                <button
                  onClick={() => onShowCompletionReview(job)}
                  className="w-full py-2 bg-yellow-500 text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-yellow-600 transition-all"
                >
                  📋 Review Completion
                </button>
                <div className="py-2 text-center text-yellow-300 text-sm">
                  ⏳ Housekeeper has submitted completion proof
                </div>
              </>
            )}
            
            {job.status === 'completed' && (
              <div className="py-2 text-center text-green-300 font-semibold">
                ✔️ Job Completed
              </div>
            )}
            
            {(job.status === 'closed' || job.status === 'cancelled') && (
              <div className="py-2 text-center text-gray-400 font-semibold">
                🔒 Job Cancelled
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function HousekeeperJobsContent({ 
  jobs, 
  onSelectJob 
}: { 
  jobs: JobPost[]; 
  onSelectJob: (job: JobPost) => void;
}) {
  if (jobs.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/20">
        <div className="text-6xl mb-4">🎯</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Jobs Available</h3>
        <p className="text-white/70 mb-6">Check back later for new job opportunities</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.post_id} className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20 hover:bg-white/15 transition-all">
          <div className="flex items-start justify-between mb-3 gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-white">{job.title}</h3>
            <span className="px-3 py-1 bg-[#EA526F]/20 text-[#EA526F] rounded-full text-xs font-semibold whitespace-nowrap">
              ₱{job.budget}
            </span>
          </div>
          
          <p className="text-white/70 mb-4 text-sm sm:text-base">{job.description}</p>
          
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
            <span className="px-2 sm:px-3 py-1 bg-white/10 text-white/80 rounded-lg text-xs sm:text-sm">
              🏠 {job.house_type}
            </span>
            <span className="px-2 sm:px-3 py-1 bg-white/10 text-white/80 rounded-lg text-xs sm:text-sm">
              🧹 {job.cleaning_type}
            </span>
            <span className="px-2 sm:px-3 py-1 bg-white/10 text-white/80 rounded-lg text-xs sm:text-sm">
              👥 {job.people_needed} needed
            </span>
            <span className="px-2 sm:px-3 py-1 bg-white/10 text-white/80 rounded-lg text-xs sm:text-sm">
              ⏱️ {job.duration_type}
            </span>
          </div>
          
          {job.image_urls && job.image_urls.length > 0 && (
            <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto pb-2">
              {job.image_urls.slice(0, 3).map((url, idx) => (
                <img 
                  key={idx} 
                  src={url} 
                  alt={`Job ${idx + 1}`} 
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg border border-white/20 flex-shrink-0"
                />
              ))}
              {job.image_urls.length > 3 && (
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/10 rounded-lg border border-white/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-white/70 text-xs sm:text-sm font-semibold">+{job.image_urls.length - 3}</span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs sm:text-sm text-white/60 space-y-1">
              <p>📍 {job.employer_address}</p>
              <p>👤 {job.employer_name}</p>
            </div>
            <button 
              onClick={() => onSelectJob(job)}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-[#EA526F] text-white text-sm sm:text-base font-semibold rounded-lg hover:bg-[#d4486a] transition-all shadow-lg"
            >
              View Details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
