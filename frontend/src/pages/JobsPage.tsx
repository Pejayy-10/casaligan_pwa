import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, ClipboardList, Users, UserPlus, BookOpen, Package, Calendar, AlertTriangle, CheckCircle, Clock, AlertCircle, RotateCw, Folder, Home, DollarSign, Users as UsersIcon, Mail, Eye, Edit2, Tag, MapPin, Star, Check, X, ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import TabBar from '../components/TabBar';
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
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import EditJobModal from '../components/EditJobModal';
import JobSummaryModal from '../components/JobSummaryModal';
import RatingModal from '../components/RatingModal';
import ReportModal from '../components/ReportModal';
import ExtendContractModal from '../components/ExtendContractModal';
import ReferHousekeeperModal from '../components/ReferHousekeeperModal';
import apiClient from '../services/api';
import type { User } from '../types';

export default function JobsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsFilterLoading, setJobsFilterLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [applicationStatuses, setApplicationStatuses] = useState<Record<number, { has_applied: boolean; status?: string; can_reapply?: boolean; withdrawn_due_to_conflict?: boolean }>>({});
  const [showApplicants, setShowApplicants] = useState<JobPost | null>(null);
  const [showPayment, setShowPayment] = useState<{ jobTitle: string; amount: number; workerName: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'ongoing' | 'completed' | 'closed'>(() => {
    const tabParam = searchParams.get('tab');
    return (tabParam as 'all' | 'open' | 'ongoing' | 'completed' | 'closed') || 'all';
  });
  const [showContract, setShowContract] = useState<JobPost | null>(null);
  const [showPaymentTracker, setShowPaymentTracker] = useState<JobPost | null>(null);
  const [showProgressTracker, setShowProgressTracker] = useState<JobPost | null>(null);
  const [showCheckIn, setShowCheckIn] = useState<JobPost | null>(null);
  
  // Housekeeper-specific states
  const [housekeeperView, setHousekeeperView] = useState<'find' | 'my-jobs'>(() => {
    const viewParam = searchParams.get('view');
    return (viewParam as 'find' | 'my-jobs') || 'find';
  });
  const [showHousekeeperProgress, setShowHousekeeperProgress] = useState<AcceptedJob | null>(null);
  const [showJobCompletion, setShowJobCompletion] = useState<AcceptedJob | null>(null);
  const [showReportUnpaid, setShowReportUnpaid] = useState<AcceptedJob | null>(null);
  const [showCompletionReview, setShowCompletionReview] = useState<JobPost | null>(null);
  const [showSummaryJobId, setShowSummaryJobId] = useState<number | null>(null);
  const [showHousekeeperPayments, setShowHousekeeperPayments] = useState<AcceptedJob | null>(null);
  
  // Category filter for housekeeper jobs
  const [categories, setCategories] = useState<Array<{category_id: number, name: string, description: string | null, is_active: boolean}>>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [filteredJobs, setFilteredJobs] = useState<JobPost[]>([]);
  
  // Direct hire states
  const [showPackageManagement, setShowPackageManagement] = useState(false);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  
  // Edit job state
  const [showEditJob, setShowEditJob] = useState<JobPost | null>(null);
  
  // Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingJobData, setRatingJobData] = useState<{ job: JobPost; worker: any } | null>(null);
  const [ratedContracts, setRatedContracts] = useState<Set<number>>(new Set());
  
  // Report state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportJobData, setReportJobData] = useState<{ job: JobPost; worker: any } | null>(null);
  const [reportedUsers, setReportedUsers] = useState<Set<string>>(new Set()); // "postId-userId"
  
  // Housekeeper report state
  const [showHousekeeperReportModal, setShowHousekeeperReportModal] = useState(false);
  const [housekeeperReportData, setHousekeeperReportData] = useState<AcceptedJob | null>(null);
  
  // Contract extension state
  const [showExtendContract, setShowExtendContract] = useState<{ job: JobPost; worker: any } | null>(null);

  // Referral state
  const [showReferModal, setShowReferModal] = useState(false);
  const [referWorkerData, setReferWorkerData] = useState<{ workerId: number; workerName: string } | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      if (user?.active_role === 'owner') {
        setJobsFilterLoading(true);
      }
      const token = localStorage.getItem('access_token');
      const endpoint = user?.active_role === 'owner' 
        ? `${API_BASE_URL}/jobs/my-posts${statusFilter !== 'all' ? `?status_filter=${statusFilter}` : ''}`
        : `${API_BASE_URL}/jobs/?status_filter=open`;
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data);
        setFilteredJobs(data);
        
        // Load application statuses for housekeepers in a single bulk request
        if (user?.active_role === 'housekeeper' && data.length > 0) {
          try {
            const postIds = data.map((job: JobPost) => job.post_id).join(',');
            const statusResponse = await fetch(`${API_BASE_URL}/jobs/application-statuses/bulk?post_ids=${postIds}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (statusResponse.ok) {
              const bulkStatuses = await statusResponse.json();
              const statuses: Record<number, { has_applied: boolean; status?: string; can_reapply?: boolean; withdrawn_due_to_conflict?: boolean }> = {};
              for (const job of data) {
                const s = bulkStatuses[String(job.post_id)];
                statuses[job.post_id] = s || { has_applied: false };
              }
              setApplicationStatuses(statuses);
            }
          } catch (err) {
            console.error('Failed to load application statuses', err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
      setJobsFilterLoading(false);
    }
  }, [user, statusFilter]);

  const handleOwnerStatusFilterChange = (nextFilter: 'all' | 'open' | 'ongoing' | 'completed' | 'closed') => {
    if (statusFilter === nextFilter) return;
    setJobsFilterLoading(true);
    setStatusFilter(nextFilter);
  };

  const loadReports = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/reports/my-reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const reports = await response.json();
        const reportedSet = new Set<string>();
        reports.forEach((report: any) => {
          if (report.post_id && report.reported_user_id) {
            reportedSet.add(`${report.post_id}-${report.reported_user_id}`);
          }
        });
        setReportedUsers(reportedSet);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  }, []);

  const loadRatings = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/ratings/my-ratings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const ratings = await response.json();
        const ratedSet = new Set<number>();
        ratings.forEach((rating: any) => {
          if (rating.contract_id) {
            ratedSet.add(rating.contract_id);
          }
        });
        setRatedContracts(ratedSet);
      }
    } catch (error) {
      console.error('Failed to load ratings:', error);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories/?active_only=true`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const applyCategoryFilter = useCallback(() => {
    if (!selectedCategory) {
      setFilteredJobs(jobs);
      return;
    }

    // Filter and sort jobs by category (support multiple categories)
    const jobsWithCategory: JobPost[] = [];
    const jobsWithoutCategory: JobPost[] = [];

    jobs.forEach(job => {
      // Check if job has the selected category (either in category_id or category_ids array)
      const hasCategory = job.category_id === selectedCategory || 
                           (job.category_ids && job.category_ids.includes(selectedCategory));
      
      if (hasCategory) {
        jobsWithCategory.push(job);
      } else {
        jobsWithoutCategory.push(job);
      }
    });

    // Show jobs with the category first, then others
    setFilteredJobs([...jobsWithCategory, ...jobsWithoutCategory]);
  }, [jobs, selectedCategory]);

  const handlePayPostFee = useCallback(async (job: JobPost) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/jobs/${job.post_id}/post-fee/initiate-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (!response.ok) {
        alert(result.detail || 'Failed to start post fee payment');
        return;
      }

      if (result.checkout_id) {
        localStorage.setItem(`job_post_fee_checkout_${job.post_id}`, result.checkout_id);
      }

      window.location.href = result.redirect_url;
    } catch (error) {
      console.error('Failed to initiate post fee payment:', error);
      alert('Failed to start post fee payment');
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      loadJobs();
      loadReports();
      loadRatings();
      if (user.active_role === 'housekeeper') {
        loadCategories();
      }
    }
  }, [user, navigate, loadJobs, loadReports, loadRatings, loadCategories, statusFilter]);

  useEffect(() => {
    if (!user || user.active_role !== 'owner') return;

    const postResult = searchParams.get('maya_post_result');
    const postId = searchParams.get('post_id');
    const shortResult = searchParams.get('maya_short_payment_result');
    const shortPostId = searchParams.get('post_id');
    const shortContractId = searchParams.get('contract_id');
    const longResult = searchParams.get('maya_long_payment_result');
    const longPostId = searchParams.get('post_id');
    const longScheduleId = searchParams.get('schedule_id');

    if (!postResult && !shortResult && !longResult) return;

    const clearMayaParams = () => {
      const next = new URLSearchParams(searchParams);
      ['maya_post_result', 'maya_short_payment_result', 'maya_long_payment_result', 'post_id', 'contract_id', 'schedule_id', 'checkout_id'].forEach((key) => next.delete(key));
      setSearchParams(next, { replace: true });
    };

    const run = async () => {
      const token = localStorage.getItem('access_token');
      const checkoutFromUrl = searchParams.get('checkout_id');

      if (postResult) {
        const checkoutKey = `job_post_fee_checkout_${postId}`;
        const checkoutId = checkoutFromUrl || (postId ? localStorage.getItem(checkoutKey) : null);
        const attemptKey = `jobs_post_fee_verify_${postId}_${postResult}_${checkoutId || 'missing'}`;

        if (sessionStorage.getItem(attemptKey) !== '1') {
          sessionStorage.setItem(attemptKey, '1');
          if (postResult !== 'success') {
            alert('Post fee payment was not completed. You can try again.');
          } else if (!postId || !checkoutId) {
            alert('Unable to verify post fee payment. Please retry.');
          } else {
            try {
              const response = await fetch(`${API_BASE_URL}/jobs/${postId}/post-fee/verify`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ checkout_id: checkoutId })
              });
              const result = await response.json();
              if (!response.ok) {
                alert(result.detail || 'Failed to verify post fee payment');
              } else {
                alert(result.message || 'Post published successfully');
                localStorage.removeItem(checkoutKey);
              }
            } catch (error) {
              console.error('Post fee verify failed:', error);
              alert('Failed to verify post fee payment');
            }
          }
        }
      }

      if (shortResult) {
        const checkoutKey = `short_term_checkout_${shortPostId}_${shortContractId}`;
        const checkoutId = checkoutFromUrl || localStorage.getItem(checkoutKey);
        const attemptKey = `jobs_short_verify_${shortPostId}_${shortContractId}_${shortResult}_${checkoutId || 'missing'}`;

        if (sessionStorage.getItem(attemptKey) !== '1') {
          sessionStorage.setItem(attemptKey, '1');
          if (shortResult !== 'success') {
            alert('Maya payment was not completed. You can try again.');
          } else if (!shortPostId || !shortContractId || !checkoutId) {
            alert('Unable to verify payment: missing checkout ID. Please retry payment.');
          } else {
            try {
              const response = await fetch(`${API_BASE_URL}/jobs/${shortPostId}/short-term-payment/verify`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contract_id: Number(shortContractId), checkout_id: checkoutId })
              });
              const result = await response.json();
              if (!response.ok) {
                alert(result.detail || 'Failed to verify Maya payment');
              } else {
                alert(result.message || 'Payment submitted! Waiting for housekeeper confirmation.');
                localStorage.removeItem(checkoutKey);
              }
            } catch (error) {
              console.error('Short-term Maya verify failed:', error);
              alert('Failed to verify Maya payment');
            }
          }
        }
      }

      if (longResult) {
        const checkoutKey = `long_term_checkout_${longPostId}_${longScheduleId}`;
        const checkoutId = checkoutFromUrl || localStorage.getItem(checkoutKey);
        const attemptKey = `jobs_long_verify_${longPostId}_${longScheduleId}_${longResult}_${checkoutId || 'missing'}`;

        if (sessionStorage.getItem(attemptKey) !== '1') {
          sessionStorage.setItem(attemptKey, '1');
          if (longResult !== 'success') {
            alert('Maya payment was not completed. You can try again.');
          } else if (!longPostId || !longScheduleId || !checkoutId) {
            alert('Unable to verify payment: missing checkout ID. Please retry payment.');
          } else {
            try {
              const response = await fetch(`${API_BASE_URL}/jobs/${longPostId}/payments/${longScheduleId}/verify`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ checkout_id: checkoutId })
              });
              const result = await response.json();
              if (!response.ok) {
                alert(result.detail || 'Failed to verify Maya payment');
              } else {
                alert(result.message || 'Payment submitted! Waiting for housekeeper confirmation.');
                localStorage.removeItem(checkoutKey);
              }
            } catch (error) {
              console.error('Long-term Maya verify failed:', error);
              alert('Failed to verify Maya payment');
            }
          }
        }
      }

      clearMayaParams();
      await loadJobs();
    };

    run();
  }, [user, searchParams, setSearchParams, loadJobs]);

  // Apply category filter when jobs or selected category changes
  useEffect(() => {
    if (user?.active_role === 'housekeeper') {
      applyCategoryFilter();
    }
  }, [jobs, selectedCategory, applyCategoryFilter, user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F4F2F0] dark:bg-slate-950 transition-colors duration-300 pb-24 relative font-sans">
      
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#EA526F]/10 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-400/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all safe-area-top">
        <div className="max-w-7xl mx-auto px-4 py-4">
          
          {user.active_role === 'owner' ? (
            /* --- OWNER VIEW HEADER (Cleaned Up Layout) --- */
            <div className="space-y-5">
                
                {/* 1. Top Row: Title & Primary Action */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#4B244A]/5 dark:bg-white/10 rounded-xl">
                            <ClipboardList className="w-6 h-6 text-[#4B244A] dark:text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#4B244A] dark:text-white tracking-tight">
                            My Job Posts
                        </h1>
                    </div>
                    
                    <button 
                        onClick={() => navigate('/jobs/create')}
                        className="group flex items-center gap-2 px-5 py-2.5 !bg-[#E7467B] !text-white font-bold rounded-xl hover:!bg-[#CC3E71] transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                        <span className="text-lg leading-none group-hover:rotate-90 transition-transform duration-300">+</span> 
                        <span>New Job</span>
                    </button>
                </div>

                {/* 2. Secondary Actions Grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button 
                        onClick={() => navigate('/browse-workers')}
                        className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/50 dark:bg-slate-900/50 text-[#4B244A] dark:text-white font-medium rounded-xl border border-gray-200/60 dark:border-white/10 hover:border-[#4B244A]/30 dark:hover:border-white/30 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs sm:text-sm group text-center"
                    >
                        <div className="p-1.5 rounded-lg bg-[#4B244A]/5 dark:bg-white/5 group-hover:bg-[#4B244A]/10 dark:group-hover:bg-white/10 transition-colors">
                            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-[#4B244A] dark:text-white" />
                        </div>
                        <span className="leading-tight">Hire Directly</span>
                    </button>
                
                    <button 
                        onClick={() => navigate('/direct-hires')}
                        className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/50 dark:bg-slate-900/50 text-[#4B244A] dark:text-white font-medium rounded-xl border border-gray-200/60 dark:border-white/10 hover:border-[#4B244A]/30 dark:hover:border-white/30 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs sm:text-sm group text-center"
                    >
                        <div className="p-1.5 rounded-lg bg-[#4B244A]/5 dark:bg-white/5 group-hover:bg-[#4B244A]/10 dark:group-hover:bg-white/10 transition-colors">
                            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#4B244A] dark:text-white" />
                        </div>
                        <span className="leading-tight">Direct Bookings</span>
                    </button>
                
                    <button 
                        onClick={() => navigate('/recurring-services')}
                        className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/50 dark:bg-slate-900/50 text-[#4B244A] dark:text-white font-medium rounded-xl border border-gray-200/60 dark:border-white/10 hover:border-[#4B244A]/30 dark:hover:border-white/30 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs sm:text-sm group text-center"
                    >
                        <div className="p-1.5 rounded-lg bg-[#4B244A]/5 dark:bg-white/5 group-hover:bg-[#4B244A]/10 dark:group-hover:bg-white/10 transition-colors">
                            <RotateCw className="w-4 h-4 sm:w-5 sm:h-5 text-[#4B244A] dark:text-white" />
                        </div>
                        <span className="leading-tight">Manage Recurring</span>
                    </button>
                </div>

                {/* 3. Status Filters (Segmented Control) */}
                <div className="space-y-2">
                    
                    <div className="overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                        <div className="flex gap-1.5 min-w-max p-1.5 bg-gray-100/80 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-white/5">
                            <FilterTab 
                                active={statusFilter === 'all'} 
                              onClick={() => handleOwnerStatusFilterChange('all')} 
                                icon={ClipboardList} 
                                label="All Jobs" 
                            />
                            <FilterTab 
                                active={statusFilter === 'open'} 
                              onClick={() => handleOwnerStatusFilterChange('open')} 
                                icon={CheckCircle} 
                                label="Open" 
                                activeColor="bg-green-500 text-white"
                            />
                            <FilterTab 
                                active={statusFilter === 'ongoing'} 
                              onClick={() => handleOwnerStatusFilterChange('ongoing')} 
                                icon={RotateCw} 
                                label="Ongoing" 
                                activeColor="bg-blue-500 text-white"
                            />
                            <FilterTab 
                                active={statusFilter === 'completed'} 
                              onClick={() => handleOwnerStatusFilterChange('completed')} 
                                icon={Check} 
                                label="Completed" 
                                activeColor="bg-purple-500 text-white"
                            />
                            <FilterTab 
                                active={statusFilter === 'closed'} 
                              onClick={() => handleOwnerStatusFilterChange('closed')} 
                                icon={X} 
                                label="Closed" 
                                activeColor="bg-gray-500 text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>
          ) : (
            /* --- HOUSEKEEPER VIEW HEADER --- */
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between sm:flex-row items-center sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {housekeeperView === 'find' ? (
                            <Briefcase className="w-6 h-6 text-[#4B244A] dark:text-white" />
                        ) : (
                            <Users className="w-6 h-6 text-[#4B244A] dark:text-white" />
                        )}
                        <h1 className="text-xl sm:text-2xl font-bold text-[#4B244A] dark:text-white">
                            {housekeeperView === 'find' ? 'Find Jobs' : 'My Accepted Jobs'}
                        </h1>
                    </div>
                    
                        <button
                        onClick={() => setShowPackageManagement(true)}
                          className="group flex items-center gap-2 px-5 py-2.5 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center">
                            <Package className="w-4 h-4 mr-1.5" /> Packages
                        </button>
                    
                </div>

                {/* Housekeeper Actions */}
                <div className="space-y-3">

                    <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => navigate('/recurring-services')}
                          className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/50 dark:bg-slate-900/50 text-[#4B244A] dark:text-white font-medium rounded-xl border border-gray-200/60 dark:border-white/10 hover:border-[#4B244A]/30 dark:hover:border-white/30 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs sm:text-sm group text-center"
                        >
                          <div className="p-1.5 rounded-lg bg-[#4B244A]/5 dark:bg-white/5 group-hover:bg-[#4B244A]/10 dark:group-hover:bg-white/10 transition-colors">
                            <RotateCw className="w-4 h-4 sm:w-5 sm:h-5 text-[#4B244A] dark:text-white" />
                          </div>
                        <span className="leading-tight">Manage Recurring</span>
                        </button>
                        <button onClick={() => navigate('/direct-hires')}
                          className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/50 dark:bg-slate-900/50 text-[#4B244A] dark:text-white font-medium rounded-xl border border-gray-200/60 dark:border-white/10 hover:border-[#4B244A]/30 dark:hover:border-white/30 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs sm:text-sm group text-center">
                          <div className="p-1.5 rounded-lg bg-[#4B244A]/5 dark:bg-white/5 group-hover:bg-[#4B244A]/10 dark:group-hover:bg-white/10 transition-colors">
                            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-[#4B244A] dark:text-white" />
                          </div>
                        <span className="leading-tight">Direct Jobs</span>
                        </button>
                        <button onClick={() => setShowAvailabilityCalendar(true)}
                          className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-white/50 dark:bg-slate-900/50 text-[#4B244A] dark:text-white font-medium rounded-xl border border-gray-200/60 dark:border-white/10 hover:border-[#4B244A]/30 dark:hover:border-white/30 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs sm:text-sm group text-center">
                          <div className="p-1.5 rounded-lg bg-[#4B244A]/5 dark:bg-white/5 group-hover:bg-[#4B244A]/10 dark:group-hover:bg-white/10 transition-colors">
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#4B244A] dark:text-white" />
                          </div>
                          <span className="leading-tight">Availability</span>
                        </button>
                    </div>

                    <div className="flex gap-2 bg-gray-100/80 dark:bg-slate-800/50 p-1.5 rounded-xl border border-gray-200 dark:border-white/10">
                        <button onClick={() => setHousekeeperView('find')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${housekeeperView === 'find' ? 'bg-[#EA526F] text-white shadow-md' : 'text-[#4B244A] dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'}`}>
                            Find Jobs
                        </button>
                        <button onClick={() => setHousekeeperView('my-jobs')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${housekeeperView === 'my-jobs' ? 'bg-[#EA526F]  text-white shadow-md' : 'text-[#4B244A] dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'}`}>
                            My Jobs
                        </button>
                    </div>
                    
                    {/* Category Filter */}
                    {housekeeperView === 'find' && (
                        <div className="mt-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : '')}
                                className="w-full appearance-none px-4 py-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-white shadow-sm hover:border-[#EA526F]/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] transition-all cursor-pointer"
                            >
                                <option value="">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {user.active_role === 'owner' && loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading your job posts...</p>
          </div>
        ) : loading && housekeeperView === 'find' ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading jobs...</p>
          </div>
        ) : user.active_role === 'owner' ? (
          <OwnerJobsContent 
            jobs={jobs} 
            navigate={navigate} 
            onViewApplicants={setShowApplicants}
            onPayPostFee={handlePayPostFee}
            onEditJob={setShowEditJob}
            onShowPaymentTracker={setShowPaymentTracker}
            onShowProgressTracker={setShowProgressTracker}
            onShowCompletionReview={setShowCompletionReview}
            onShowSummary={(job) => setShowSummaryJobId(job.post_id)}
            onRateWorker={(job, worker) => {
              setRatingJobData({ job, worker });
              setShowRatingModal(true);
            }}
            ratedContracts={ratedContracts}
            reportedUsers={reportedUsers}
            onReportWorker={(job, worker) => {
              setReportJobData({ job, worker });
              setShowReportModal(true);
            }}
            onExtendContract={(job, worker) => {
              setShowExtendContract({ job, worker });
            }}
            onReferWorker={(worker) => {
              setReferWorkerData({ workerId: worker.worker_id, workerName: worker.name });
              setShowReferModal(true);
            }}
          />
        ) : (
          <>
            {/* Keep both views mounted but toggle visibility so data persists across tab switches */}
            <div className={housekeeperView === 'my-jobs' ? 'block' : 'hidden'}>
              <HousekeeperMyJobs
                onShowProgress={setShowHousekeeperProgress}
                onSubmitCompletion={setShowJobCompletion}
                onReportUnpaid={setShowReportUnpaid}
                onShowPayments={setShowHousekeeperPayments}
                reportedUsers={reportedUsers}
                initialStatusFilter={statusFilter as any}
                onReportEmployer={(job) => {
                  setHousekeeperReportData(job);
                  setShowHousekeeperReportModal(true);
                }}
              />
            </div>
            <div className={housekeeperView === 'find' ? 'block' : 'hidden'}>
              <HousekeeperJobsContent 
                jobs={filteredJobs} 
                onSelectJob={setSelectedJob} 
                selectedCategory={selectedCategory}
                categories={categories}
              />
            </div>
          </>
        )}
      </main>

      <TabBar role={user.active_role} />
      
      {/* --- MODALS (Unchanged logic) --- */}
      {selectedJob && !showContract && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApply={async () => { setShowContract(selectedJob); }}
          hasApplied={applicationStatuses[selectedJob.post_id]?.has_applied}
          applicationStatus={applicationStatuses[selectedJob.post_id]?.status}
          canReapply={applicationStatuses[selectedJob.post_id]?.can_reapply || false}
          withdrawnDueToConflict={applicationStatuses[selectedJob.post_id]?.withdrawn_due_to_conflict || false}
          onStatusRefresh={async () => {
            const token = localStorage.getItem('access_token');
            if (token && selectedJob) {
                try {
                    const statusResponse = await fetch(`${API_BASE_URL}/jobs/${selectedJob.post_id}/application-status`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        setApplicationStatuses(prev => ({ ...prev, [selectedJob.post_id]: statusData }));
                    }
                } catch (err) { console.error(err); }
            }
          }}
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
          workerName={user ? `${user.first_name}${user.middle_name ? ' ' + user.middle_name : ''} ${user.last_name}${user.suffix ? ' ' + user.suffix : ''}`.trim() : ''}
          onAccept={async () => {
            try {
              const token = localStorage.getItem('access_token');
              const response = await fetch(`${API_BASE_URL}/jobs/${showContract.post_id}/apply`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                alert('Contract accepted! Application submitted successfully!');
                setShowContract(null);
                setSelectedJob(null);
                const statusResponse = await fetch(`${API_BASE_URL}/jobs/${showContract.post_id}/application-status`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    setApplicationStatuses(prev => ({ ...prev, [showContract.post_id]: statusData }));
                }
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
          onReject={() => { setShowContract(null); setSelectedJob(null); }}
        />
      )}
      
      {/* Applicants List Modal */}
      {showApplicants && (
        <ApplicantsListModal
          jobId={showApplicants.post_id}
          jobTitle={showApplicants.title}
          peopleNeeded={showApplicants.people_needed}
          onClose={() => setShowApplicants(null)}
          onJobStarted={() => { setShowApplicants(null); loadJobs(); }}
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
            loadJobs();
          }}
        />
      )}
      
      {/* Payment Tracker Modal */}
      {showPaymentTracker && (
        user?.active_role === 'owner' ? (
          <PaymentTrackerOwner jobId={showPaymentTracker.post_id} jobTitle={showPaymentTracker.title} onClose={() => setShowPaymentTracker(null)} />
        ) : (
          <PaymentTrackerWorker jobId={showPaymentTracker.post_id} jobTitle={showPaymentTracker.title} onClose={() => setShowPaymentTracker(null)} />
        )
      )}
      
      {/* Job Progress Tracker Modal */}
      {showProgressTracker && (
        <JobProgressTracker jobId={showProgressTracker.post_id} onClose={() => setShowProgressTracker(null)} userRole={user?.active_role as 'owner' | 'housekeeper'} />
      )}
      
      {/* Check In Modal */}
      {showCheckIn && (
        <CheckInModal jobId={showCheckIn.post_id} jobTitle={showCheckIn.title} onClose={() => setShowCheckIn(null)} onSuccess={() => { alert('Checked in successfully!'); setShowCheckIn(null); window.dispatchEvent(new Event('my-jobs-updated')); }} />
      )}
      
      {/* Housekeeper Progress Modal */}
      {showHousekeeperProgress && showHousekeeperProgress.is_longterm && (
        <HousekeeperProgressModal jobId={showHousekeeperProgress.post_id} onClose={() => setShowHousekeeperProgress(null)} onSubmitCompletion={() => { setShowHousekeeperProgress(null); setShowJobCompletion(showHousekeeperProgress); }} />
      )}
      
      {/* Housekeeper Payment Tracker Modal */}
      {showHousekeeperPayments && showHousekeeperPayments.is_longterm && (
        <PaymentTrackerWorker jobId={showHousekeeperPayments.post_id} jobTitle={showHousekeeperPayments.title} onClose={() => setShowHousekeeperPayments(null)} />
      )}
      
      {/* Job Completion Modal */}
      {showJobCompletion && (
        <JobCompletionModal jobId={showJobCompletion.post_id} jobTitle={showJobCompletion.title} onClose={() => setShowJobCompletion(null)} onSuccess={() => { alert('Job completion submitted! Waiting for owner approval.'); setShowJobCompletion(null); window.dispatchEvent(new Event('my-jobs-updated')); }} />
      )}
      
      {/* Report Unpaid Modal */}
      {showReportUnpaid && (
        <ReportUnpaidModal jobId={showReportUnpaid.post_id} jobTitle={showReportUnpaid.title} pendingPayments={showReportUnpaid.payments.pending_payments} onClose={() => setShowReportUnpaid(null)} onSuccess={() => { alert('Report submitted successfully. Our team will review this case.'); setShowReportUnpaid(null); window.dispatchEvent(new Event('my-jobs-updated')); }} />
      )}
      
      {/* Owner Completion Review Modal */}
      {showCompletionReview && (
        <CompletionReviewModal jobId={showCompletionReview.post_id} jobTitle={showCompletionReview.title} onClose={() => setShowCompletionReview(null)} onApproved={() => { alert('Job completion approved! Job is now marked as completed.'); setShowCompletionReview(null); loadJobs(); }} />
      )}
      
      {/* Package Management Modal (Housekeeper) */}
      {showPackageManagement && ( <PackageManagement onClose={() => setShowPackageManagement(false)} /> )}
      
      {/* Direct Hires List Modal */}
      
      {/* Availability Calendar Modal */}
      {showAvailabilityCalendar && ( <AvailabilityCalendar onClose={() => setShowAvailabilityCalendar(false)} /> )}
      
      {/* Job Summary Modal (completed jobs) */}
      {showSummaryJobId !== null && (
        <JobSummaryModal jobId={showSummaryJobId} onClose={() => setShowSummaryJobId(null)} />
      )}

      {/* Edit Job Modal */}
      {showEditJob && (
        <EditJobModal
          job={showEditJob}
          onClose={() => setShowEditJob(null)}
          onSuccess={(updatedJob) => {
            setShowEditJob(null);
            if (updatedJob) {
              setJobs((prev) => prev.map((job) => job.post_id === updatedJob.post_id ? updatedJob : job));
              setFilteredJobs((prev) => prev.map((job) => job.post_id === updatedJob.post_id ? updatedJob : job));
            }
            loadJobs();
            alert('Job updated successfully!');
          }}
        />
      )}
      
      {/* Rating Modal */}
      {ratingJobData && (
        <RatingModal
          isOpen={showRatingModal}
          onClose={() => { setShowRatingModal(false); setRatingJobData(null); }}
          onSubmit={async (rating, review) => {
            try {
              const response = await apiClient.post('/ratings/', {
                rated_user_id: ratingJobData.worker.worker_user_id,
                contract_id: ratingJobData.worker.contract_id,
                post_id: ratingJobData.job.post_id,
                stars: rating,
                review: review || null
              });
              if (response.status === 200 || response.status === 201) {
                setRatedContracts(prev => new Set(prev).add(ratingJobData.worker.contract_id));
                // Reload ratings from backend to ensure persistence
                loadRatings();
              }
            } catch (err: any) {
              // If backend says already rated, mark as rated in frontend too
              if (err?.response?.status === 400 && err?.response?.data?.detail?.includes('already rated')) {
                setRatedContracts(prev => new Set(prev).add(ratingJobData.worker.contract_id));
                loadRatings();
                throw new Error('You have already rated this housekeeper for this job.');
              }
              throw err;
            }
          }}
          workerName={ratingJobData.worker.name}
        />
      )}
      
      {/* Report Modal */}
      {reportJobData && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => { setShowReportModal(false); setReportJobData(null); }}
          onSubmit={async (reportData) => {
            const response = await apiClient.post('/reports/', {
              reported_user_id: reportJobData.worker.worker_user_id,
              post_id: reportJobData.job.post_id,
              report_type: reportData.reportType,
              title: reportData.title,
              reason: reportData.reason,
              description: reportData.description,
              evidence_urls: reportData.evidenceUrls || []
            });
            if (response.status === 200 || response.status === 201) {
              setReportedUsers(prev => new Set(prev).add(`${reportJobData.job.post_id}-${reportJobData.worker.worker_user_id}`));
              alert('Report submitted successfully. Our team will review this case.');
              loadJobs();
            } else { throw new Error('Failed to submit report'); }
          }}
          reportedUserName={reportJobData.worker.name}
          reportedUserRole="housekeeper"
        />
      )}
      
      {/* Extend Contract Modal */}
      {showExtendContract && (
        <ExtendContractModal
          isOpen={true}
          onClose={() => setShowExtendContract(null)}
          jobTitle={showExtendContract.job.title}
          contractId={showExtendContract.worker.contract_id}
          currentEndDate={showExtendContract.job.end_date}
          currentBudget={showExtendContract.job.budget}
          workerName={showExtendContract.worker.name}
          onSuccess={() => { setShowExtendContract(null); loadJobs(); }}
        />
      )}
      
      {/* Housekeeper Report Modal */}
      {housekeeperReportData && (
        <ReportModal
          isOpen={showHousekeeperReportModal}
          onClose={() => { setShowHousekeeperReportModal(false); setHousekeeperReportData(null); }}
          onSubmit={async (reportData) => {
            const response = await apiClient.post('/reports/', {
              reported_user_id: housekeeperReportData.employer.user_id,
              post_id: housekeeperReportData.post_id,
              report_type: reportData.reportType,
              title: reportData.title,
              reason: reportData.reason,
              description: reportData.description,
              evidence_urls: reportData.evidenceUrls || []
            });
            if (response.status === 200 || response.status === 201) {
              setReportedUsers(prev => new Set(prev).add(`${housekeeperReportData.post_id}-${housekeeperReportData.employer.user_id}`));
              alert('Report submitted successfully. Our team will review this case.');
              window.dispatchEvent(new Event('my-jobs-updated'));
            } else { throw new Error('Failed to submit report'); }
          }}
          reportedUserName={housekeeperReportData.employer.name}
          reportedUserRole="owner"
        />
      )}

      {/* Refer Housekeeper Modal */}
      {referWorkerData && (
        <ReferHousekeeperModal
          isOpen={showReferModal}
          onClose={() => { setShowReferModal(false); setReferWorkerData(null); }}
          workerId={referWorkerData.workerId}
          workerName={referWorkerData.workerName}
        />
      )}
    </div>
  );
}

// --- SUBCOMPONENTS ---

function FilterTab({ 
    active, 
    onClick, 
    icon: Icon, 
    label, 
    activeColor = "bg-white dark:bg-[#4B244A] text-[#4B244A] dark:text-white"
}: { 
    active: boolean, 
    onClick: () => void, 
    icon: any, 
    label: string,
    activeColor?: string 
}) {
    return (
        <button
            onClick={onClick}
            type="button"
            aria-pressed={active}
            aria-current={active ? 'true' : undefined}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                active
                    ? `${activeColor} shadow-md ring-2 ring-[#4B244A]/30 dark:ring-white/30 ring-offset-2 ring-offset-gray-100 dark:ring-offset-slate-800`
                    : 'text-[#4B244A]/70 dark:text-white/70 hover:bg-white/50 dark:hover:bg-white/10'
            }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}

function OwnerJobsContent({ 
  jobs, 
  navigate, 
  onViewApplicants,
  onPayPostFee,
  onShowPaymentTracker,
  onShowProgressTracker,
  onShowCompletionReview,
  onShowSummary,
  onEditJob,
  onRateWorker,
  ratedContracts,
  reportedUsers,
  onReportWorker,
  onExtendContract,
  onReferWorker
}: { 
  jobs: JobPost[]; 
  navigate: (path: string) => void;
  onViewApplicants: (job: JobPost) => void;
  onPayPostFee: (job: JobPost) => void;
  onShowPaymentTracker: (job: JobPost) => void;
  onShowProgressTracker: (job: JobPost) => void;
  onShowCompletionReview: (job: JobPost) => void;
  onShowSummary: (job: JobPost) => void;
  onEditJob: (job: JobPost) => void;
  onRateWorker: (job: JobPost, worker: any) => void;
  ratedContracts: Set<number>;
  reportedUsers: Set<string>;
  onReportWorker: (job: JobPost, worker: any) => void;
  onExtendContract: (job: JobPost, worker: any) => void;
  onReferWorker: (worker: any) => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{
    postId: number;
    title: string;
    reason: string;
    error: string | null;
    submitting: boolean;
  } | null>(null);
  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(jobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = jobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to page 1 when jobs list changes
  useEffect(() => { setCurrentPage(1); }, [jobs.length]);

  const handleStatusUpdate = async (postId: number, newStatus: string, cancelReason?: string): Promise<boolean> => {
    try {
      setActionLoading(`status-${postId}`);
      const token = localStorage.getItem('access_token');
      let endpoint = `${API_BASE_URL}/jobs/${postId}/status?new_status=${newStatus}`;

      if (newStatus === 'cancelled') {
        const trimmedReason = (cancelReason || '').trim();
        if (!trimmedReason) {
          return false;
        }
        endpoint += `&cancel_reason=${encodeURIComponent(trimmedReason)}`;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert(`Job status updated to ${newStatus.toUpperCase()}!`);
        window.location.reload(); // Refresh to update UI
        return true;
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to update job status');
        return false;
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update job status');
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const handleRepost = async (postId: number) => {
    if (!confirm('Repost this job with the same details?')) return;

    try {
      setActionLoading(`repost-${postId}`);
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/jobs/${postId}/repost`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Job reposted successfully! A new job post was created with the same details.');
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to repost job');
      }
    } catch (error) {
      console.error('Failed to repost job:', error);
      alert('Failed to repost job');
    } finally {
      setActionLoading(null);
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-12 text-center flex items-center flex-col border border-white/50 dark:border-white/10 shadow-xl">
        <div className="text-6xl mb-4"><ClipboardList className="w-16 h-16" /></div>
        <h3 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">No Job Posts Yet</h3>
        <p className="text-[#4B244A]/70 dark:text-white/70 mb-6">Create your first job post to find housekeepers</p>
        <button 
          onClick={() => navigate('/jobs/create')}
          className="px-6 py-3 !bg-[#4B244A] !text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg"
        >
          Create Your First Job Post
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paginatedJobs.map((job) => {
        const isPostFeePending = (job.post_fee_status || 'paid').toLowerCase() !== 'paid';
        return (
        <div key={job.post_id} className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 border transition-all shadow-sm ${
          isPostFeePending
            ? 'border-amber-300 dark:border-amber-500/40 opacity-85'
            : 'border-white/60 dark:border-white/10 hover:border-[#EA526F]/30 dark:hover:border-[#EA526F]/30 hover:shadow-md'
        }`}>
          {(() => {
            const workers = job.accepted_workers || [];
            const hasWorkerPaymentSubmitted = (worker: any) => {
              const status = (worker?.payment_status || '').toLowerCase();
              return Boolean(
                worker?.payment_proof_url ||
                worker?.payment_submitted ||
                status === 'sent' ||
                status === 'confirmed'
              );
            };
            const needsOwnerReviewOrPayment = workers.some((worker: any) => (
              (worker.contract_status === 'pending_completion' && !hasWorkerPaymentSubmitted(worker) && !worker.paid_at) ||
              (worker.contract_status === 'completed' && !hasWorkerPaymentSubmitted(worker) && !worker.paid_at)
            ));
            const awaitingWorkerConfirmation = workers.some((worker: any) => (
              hasWorkerPaymentSubmitted(worker) && !worker.paid_at
            ));

            return (
              <>
          {isPostFeePending && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300 px-3 py-2 text-xs font-semibold">
              Unpublished: pay ₱{Number(job.post_fee_amount || 0).toLocaleString()} ({Number(job.post_fee_percentage || 7)}%) to publish this short-term post.
            </div>
          )}
          <div className="flex items-start justify-between mb-3 gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-[#4B244A] dark:text-white break-words min-w-0">{job.title}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
              isPostFeePending ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
              job.status === 'open' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 
              job.status === 'ongoing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
              job.status === 'pending_completion' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' :
              job.status === 'completed' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' : 
              'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300'
            }`}>
              {isPostFeePending ? 'UNPUBLISHED' : (job.status === 'pending_completion' ? 'PENDING APPROVAL' : job.status.toUpperCase())}
            </span>
          </div>
          
          <p className="text-[#4B244A]/70 dark:text-white/70 mb-4 line-clamp-2 text-sm break-words whitespace-normal">{job.description}</p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2.5 py-1 bg-[#EA526F]/10 text-[#EA526F] dark:bg-[#EA526F]/20 dark:text-[#EA526F] rounded-md text-xs font-semibold flex items-center">
              <Home className="w-3.5 h-3.5 mr-1" /> {job.house_type}
            </span>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 rounded-md text-xs font-semibold flex items-center">
              🧹 {job.cleaning_type}
            </span>
            <span className="px-2.5 py-1 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300 rounded-md text-xs font-semibold flex items-center">
              <DollarSign className="w-3.5 h-3.5 mr-1" /> ₱{job.budget}
            </span>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300 rounded-md text-xs font-semibold flex items-center">
              <UsersIcon className="w-3.5 h-3.5 mr-1" /> {job.people_needed} needed
            </span>
          </div>
          
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
            <div className="flex items-center gap-4 text-xs text-[#4B244A]/50 dark:text-white/50 font-medium">
               <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> {new Date(job.created_at).toLocaleDateString()}</span>
               <span className="flex items-center"><UsersIcon className="w-3.5 h-3.5 mr-1" /> {job.total_applicants} Applicants</span>
            </div>
          </div>

          {/* Accepted Workers Section */}
          {job.accepted_workers && job.accepted_workers.length > 0 && (
            <div className="mt-4 bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-gray-100 dark:border-white/5">
                <div className="text-xs font-bold text-[#4B244A]/70 dark:text-white/70 mb-2 uppercase tracking-wide">Accepted Housekeepers</div>
                <div className="flex flex-wrap gap-2">
                    {job.accepted_workers.map((worker) => (
                        <div key={worker.worker_id} className="flex items-center gap-2 bg-white dark:bg-black/20 pl-2 pr-1 py-1 rounded-lg border border-gray-200 dark:border-white/10 shadow-sm">
                            <span className="text-xs font-bold text-[#4B244A] dark:text-white">{worker.name}</span>
                            {job.status === 'ongoing' && (
                                <button
                                    onClick={() => {
                                        const params = new URLSearchParams({
                                            jobId: job.post_id.toString(),
                                            name: worker.name,
                                            title: job.title,
                                        });
                                        navigate(`/chat/new?${params.toString()}`);
                                    }}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors"
                                    title="Chat"
                                >
                                    <Mail className="w-3 h-3 text-[#EA526F]" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 grid grid-cols-1 gap-2">
             {isPostFeePending && (
               <button
                onClick={() => onPayPostFee(job)}
                className="w-full py-2.5 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 transition-all shadow-md"
               >
                Pay 7% to Publish (Maya)
               </button>
             )}

             {job.status === 'open' && !isPostFeePending && job.total_applicants > 0 && (
                <button onClick={() => onViewApplicants(job)} className="w-full py-2 bg-[#4B244A] text-white text-sm font-bold rounded-lg hover:bg-[#361a35] transition-all">
                    View Applicants ({job.total_applicants})
                </button>
             )}
             
             {/* Review Completion & Pay button for pending_completion jobs */}
             {job.status === 'pending_completion' && needsOwnerReviewOrPayment && (
                <button
                  onClick={() => onShowCompletionReview(job)}
                  className="w-full py-2.5 bg-[#EA526F] text-white text-sm font-bold rounded-lg hover:bg-[#d4486a] transition-all shadow-lg flex items-center justify-center gap-2 animate-pulse"
                >
                  <CheckCircle className="w-4 h-4" /> Review Completion & Pay
                </button>
             )}

             {job.status === 'pending_completion' && !needsOwnerReviewOrPayment && awaitingWorkerConfirmation && (
               <>
                 <div className="w-full py-2.5 bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-sm font-bold rounded-lg border border-blue-200 dark:border-blue-500/30 flex items-center justify-center gap-2">
                   <Clock className="w-4 h-4" /> Payment Sent - Waiting for Housekeeper Confirmation
                 </div>
                 {onShowSummary && (
                   <button
                     onClick={() => onShowSummary(job)}
                     className="w-full py-2 bg-[#4B244A] text-white text-sm font-bold rounded-lg hover:bg-[#361a35] transition-all shadow-md flex items-center justify-center gap-2"
                   >
                     <FileText className="w-4 h-4" /> View Receipt
                   </button>
                 )}
               </>
             )}

             {job.status === 'pending_completion' && !needsOwnerReviewOrPayment && !awaitingWorkerConfirmation && (
               <button
                 onClick={() => onShowCompletionReview(job)}
                 className="w-full py-2.5 bg-[#4B244A] text-white text-sm font-bold rounded-lg hover:bg-[#361a35] transition-all shadow-md flex items-center justify-center gap-2"
               >
                 <Eye className="w-4 h-4" /> View Completion Status
               </button>
             )}
             
             {/* Dynamic Action Button based on status */}
             {job.status === 'ongoing' && job.duration_type === 'long_term' && (
                 <button
                    onClick={() => onShowPaymentTracker(job)}
                    className={`w-full py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                        job.pending_payments && job.pending_payments > 0 
                        ? 'bg-red-500 text-white hover:bg-red-600' 
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                 >
                    {job.pending_payments && job.pending_payments > 0 
                      ? <><AlertCircle className="w-4 h-4" /> Pay Now ({job.pending_payments})</>
                      : 'Payment Tracker'}
                 </button>
             )}
             
             {/* Extend Contract button for ongoing jobs with accepted workers */}
             {job.status === 'ongoing' && job.accepted_workers && job.accepted_workers.length > 0 && (
                job.accepted_workers.map((worker) => (
                  <button
                    key={`extend-${worker.worker_id}`}
                    onClick={() => onExtendContract(job, worker)}
                    className="w-full py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 bg-purple-500 text-white hover:bg-purple-600"
                  >
                    <Calendar className="w-4 h-4" /> Extend Contract — {worker.name}
                  </button>
                ))
             )}
             
             {/* Edit/Cancel actions for open jobs */}
             {job.status === 'open' && (
                 <div className="grid grid-cols-2 gap-2 mt-2">
                    <button onClick={() => onEditJob(job)} className="py-2 bg-gray text-gray-700 dark:bg-white/10 dark :text-white text-sm font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-white/20">
                        Edit
                    </button>
                    <button 
                        onClick={() => {
                          setCancelModal({
                            postId: job.post_id,
                            title: job.title,
                            reason: '',
                            error: null,
                            submitting: false,
                          });
                        }} 
                        disabled={actionLoading === `status-${job.post_id}`}
                        className="py-2 bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white text-sm font-bold rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                        {actionLoading === `status-${job.post_id}` ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</> : 'Cancel'}
                    </button>
                 </div>
             )}

             {/* Summary button for completed jobs */}
             {job.status === 'completed' && onShowSummary && (
               <button
                 onClick={() => onShowSummary(job)}
                 className="mt-2 w-full py-2 bg-[#4B244A] text-white text-sm font-bold rounded-lg hover:bg-[#361a35] transition-all shadow-md flex items-center justify-center gap-2"
               >
                 <FileText className="w-4 h-4" /> Summary
               </button>
             )}

             {/* Rate & Report buttons for completed jobs */}
             {job.status === 'completed' && job.accepted_workers && job.accepted_workers.length > 0 && (
               <div className="space-y-2 mt-2">
                 {job.accepted_workers.map((worker) => (
                   <div key={`rate-${worker.worker_id}`}>
                     <div className="flex gap-2">
                       {ratedContracts.has(worker.contract_id) ? (
                         <div className="flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20">
                           <CheckCircle className="w-4 h-4" />
                           Rated {worker.name} ✓
                         </div>
                       ) : (
                         <button
                           onClick={() => onRateWorker(job, worker)}
                           className="flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm bg-yellow-400 text-[#4B244A] hover:bg-yellow-500"
                         >
                           <Star className="w-4 h-4" />
                           Rate {worker.name}
                         </button>
                       )}
                       {!reportedUsers.has(`${job.post_id}-${worker.worker_user_id}`) && (
                         <button
                           onClick={() => onReportWorker(job, worker)}
                           className="py-2 px-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1 bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:bg-white/5 dark:text-white/40 dark:hover:bg-red-900/20 dark:hover:text-red-400 shadow-sm"
                           title={`Report ${worker.name}`}
                         >
                           <AlertTriangle className="w-4 h-4" />
                         </button>
                       )}
                     </div>
                     {/* Refer Housekeeper button */}
                     <button
                       onClick={() => onReferWorker(worker)}
                       className="mt-1 w-full py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20"
                     >
                       <Users className="w-4 h-4" />
                       Refer {worker.name}
                     </button>
                   </div>
                 ))}
               </div>
             )}

             {/* Repost button for finished jobs */}
             {(job.status === 'completed' || job.status === 'cancelled') && (
               <button
                 onClick={() => handleRepost(job.post_id)}
                 disabled={actionLoading === `repost-${job.post_id}`}
                 className="mt-2 w-full py-2 bg-[#EA526F] text-white text-sm font-bold rounded-lg hover:bg-[#d4486a] transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1"
               >
                 {actionLoading === `repost-${job.post_id}` ? <><Loader2 className="w-4 h-4 animate-spin" /> Reposting...</> : 'Repost Job'}
               </button>
             )}
          </div>
              </>
            );
          })()}
        </div>
      )})}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === 1}
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-[#4B244A] dark:text-white">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">Cancel Job</h3>
              <p className="mt-1 text-sm text-[#4B244A]/70 dark:text-white/70">
                Tell the housekeeper why you are cancelling "{cancelModal.title}".
              </p>
            </div>

            <div className="p-5 space-y-3">
              <label className="block text-sm font-semibold text-[#4B244A] dark:text-white">
                Cancellation reason
              </label>
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((prev) => prev ? { ...prev, reason: e.target.value, error: null } : prev)}
                rows={4}
                maxLength={400}
                placeholder="Example: We already found a helper nearby and no longer need this post."
                className="w-full rounded-xl border border-gray-300 dark:border-white/20 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#4B244A] dark:text-white outline-none focus:ring-2 focus:ring-[#EA526F]/40 focus:border-[#EA526F]"
              />
              <div className="flex items-center justify-between text-xs text-[#4B244A]/60 dark:text-white/60">
                <span>{cancelModal.error ? <span className="text-red-600 dark:text-red-400">{cancelModal.error}</span> : 'Reason is required.'}</span>
                <span>{cancelModal.reason.length}/400</span>
              </div>
            </div>

            <div className="p-5 pt-0 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCancelModal(null)}
                disabled={cancelModal.submitting}
                className="py-2.5 rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                Keep Job
              </button>
              <button
                type="button"
                onClick={async () => {
                  const reason = cancelModal.reason.trim();
                  if (!reason) {
                    setCancelModal((prev) => prev ? { ...prev, error: 'Please enter a cancellation reason.' } : prev);
                    return;
                  }

                  setCancelModal((prev) => prev ? { ...prev, submitting: true, error: null } : prev);
                  const ok = await handleStatusUpdate(cancelModal.postId, 'cancelled', reason);
                  if (!ok) {
                    setCancelModal((prev) => prev ? { ...prev, submitting: false } : prev);
                  }
                }}
                disabled={cancelModal.submitting}
                className="py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelModal.submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</> : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HousekeeperJobsContent({ 
  jobs, 
  onSelectJob,
  selectedCategory,
  categories
}: { 
  jobs: JobPost[]; 
  onSelectJob: (job: JobPost) => void;
  selectedCategory: number | '';
  categories: Array<{category_id: number, name: string, description: string | null, is_active: boolean}>;
}) {
  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(jobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = jobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to page 1 when jobs list changes
  useEffect(() => { setCurrentPage(1); }, [jobs.length, selectedCategory]);

  if (jobs.length === 0) {
    return (
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/50 dark:border-white/10 shadow-xl">
        <div className="text-6xl mb-4"><Briefcase className="w-16 h-16" /></div>
        <h3 className="text-2xl font-bold text-[#4B244A] dark:text-white mb-2">No Jobs Available</h3>
        <p className="text-[#4B244A]/70 dark:text-white/70 mb-6">Check back later for new job opportunities</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paginatedJobs.map((job) => {
        const hasSelectedCategory = selectedCategory && (
          job.category_id === selectedCategory || 
          (job.category_ids && job.category_ids.includes(selectedCategory))
        );
        
        return (
          <div 
            key={job.post_id} 
            className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border transition-all hover:bg-white/80 dark:hover:bg-slate-900/80 shadow-lg ${
              hasSelectedCategory 
                ? 'border-[#EA526F] ring-2 ring-[#EA526F]/30' 
                : 'border-white/50 dark:border-white/10'
            }`}
          >
            {hasSelectedCategory && (
              <div className="w-full appearance-none px-4 py-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-white shadow-sm hover:border-[#EA526F]/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] transition-all cursor-pointer">
                <CheckCircle className="inline w-4 h-4 mr-1" /> Matches {categories.find(c => c.category_id === selectedCategory)?.name}
              </div>
            )}
            <div className="flex items-start justify-between mb-3 gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-[#4B244A] dark:text-white">{job.title}</h3>
              <span className="px-4 py-2 bg-[#359126/10 dark:bg-[#359126]/20 !text-[#359126] dark:text-[#359126] rounded-full text-md font-bold whitespace-nowrap">
                ₱{job.budget}
              </span>
            </div>
          
            <p className="text-[#4B244A]/70 dark:text-white/70 mb-4 text-sm sm:text-base">{job.description}</p>
          
            {/* Display multiple categories */}
            {job.category_names && job.category_names.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {job.category_names.map((categoryName, idx) => (
                  <span key={idx} className="mb-3 inline-block px-3 py-1 bg-[#EA526F]/10 dark:bg-[#EA526F]/30 text-[#EA526F] dark:text-pink-300 text-xs font-bold rounded-full border border-[#EA526F]/30">
                    <Tag className="inline w-4 h-4 mr-1" /> {categoryName}
                  </span>
                ))}
              </div>
            )}
          
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
              <span className="px-2 sm:px-3 py-1 bg-white/50 dark:bg-white/10 text-[#4B244A]/80 dark:text-white/80 rounded-lg text-xs sm:text-sm font-medium">
                🏠 {job.house_type}
              </span>
              <span className="px-2 sm:px-3 py-1 bg-white/50 dark:bg-white/10 text-[#4B244A]/80 dark:text-white/80 rounded-lg text-xs sm:text-sm font-medium">
                🧹 {job.cleaning_type}
              </span>
              <span className="px-2 sm:px-3 py-1 bg-white/50 dark:bg-white/10 text-[#4B244A]/80 dark:text-white/80 rounded-lg text-xs sm:text-sm font-medium">
                👥 {job.people_needed} needed
              </span>
              <span className="px-2 sm:px-3 py-1 bg-white/50 dark:bg-white/10 text-[#4B244A]/80 dark:text-white/80 rounded-lg text-xs sm:text-sm font-medium">
                ⏱️ {job.duration_type}
              </span>
            </div>
          
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs sm:text-sm text-[#4B244A]/60 dark:text-white/60 space-y-1 font-medium">
                <p><MapPin className="inline w-4 h-4 mr-1" /> {job.employer_address}</p>
                <p><Users className="inline w-4 h-4 mr-1" /> {job.employer_name}</p>
              </div>
              <button 
                onClick={() => onSelectJob(job)}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 !bg-[#4B244A] !text-white text-sm sm:text-base font-bold rounded-lg hover:bg-[#d4486a] transition-all shadow-lg flex items-center justify-center gap-2"
              >
                View Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === 1}
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-[#4B244A] dark:text-white">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white disabled:opacity-30 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}