import { useState, useEffect, useCallback } from 'react';

interface Applicant {
  interest_id: number;
  worker_id: number;
  worker_name: string;
  worker_email: string;
  worker_phone: string;
  status: string;
  applied_at: string;
}

interface ApplicantsListModalProps {
  jobId: number;
  jobTitle: string;
  peopleNeeded: number;
  onClose: () => void;
  onJobStarted?: () => void;
}

export default function ApplicantsListModal({ jobId, jobTitle, peopleNeeded, onClose, onJobStarted }: ApplicantsListModalProps) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<number>>(new Set());
  const [startingJob, setStartingJob] = useState(false);

  // Count already accepted workers (from previous selections)
  const alreadyAcceptedCount = applicants.filter(a => a.status === 'accepted').length;
  const pendingApplicants = applicants.filter(a => a.status === 'pending');
  
  // Total selected = already accepted + newly toggled
  const totalSelected = alreadyAcceptedCount + selectedWorkers.size;
  const canStartJob = totalSelected === peopleNeeded;
  const needMoreSelections = totalSelected < peopleNeeded;

  const loadApplicants = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/applicants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setApplicants(data);
      }
    } catch (error) {
      console.error('Failed to load applicants:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  const toggleWorker = (interestId: number) => {
    setSelectedWorkers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(interestId)) {
        newSet.delete(interestId);
      } else {
        // Only allow selecting up to the remaining needed
        const remainingNeeded = peopleNeeded - alreadyAcceptedCount;
        if (newSet.size < remainingNeeded) {
          newSet.add(interestId);
        }
      }
      return newSet;
    });
  };

  const handleStartJob = async () => {
    if (!canStartJob) return;
    
    setStartingJob(true);
    try {
      const token = localStorage.getItem('access_token');
      
      // Get the interest_ids of selected workers
      const selectedInterestIds = Array.from(selectedWorkers);
      
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/start-job`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selected_applicants: selectedInterestIds
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`🎉 Job Started!\n\n${result.message}\n\nAccepted workers: ${result.accepted_workers.join(', ')}`);
        
        if (onJobStarted) {
          onJobStarted();
        }
        onClose();
      } else {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to start job');
      }
    } catch (error) {
      console.error('Failed to start job:', error);
      alert('Failed to start job');
    } finally {
      setStartingJob(false);
    }
  };

  const handleReject = async (interestId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/applicants/${interestId}?status_update=rejected`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        // Update local state
        setApplicants(applicants.map(app =>
          app.interest_id === interestId ? { ...app, status: 'rejected' } : app
        ));
        // Remove from selected if was selected
        setSelectedWorkers(prev => {
          const newSet = new Set(prev);
          newSet.delete(interestId);
          return newSet;
        });
      } else {
        const errorData = await response.json();
        alert(errorData.detail || 'Failed to reject applicant');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Failed to reject applicant');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/20 p-6 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white">👥 Select Housekeepers</h2>
            <button 
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors text-3xl leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-white/70 text-sm mb-3">{jobTitle}</p>
          
          {/* Selection Status */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-[#EA526F]/20 text-[#EA526F] rounded-full text-sm font-semibold">
              Need: {peopleNeeded} {peopleNeeded === 1 ? 'person' : 'people'}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              canStartJob 
                ? 'bg-green-500/20 text-green-300' 
                : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              Selected: {totalSelected}/{peopleNeeded}
            </span>
            {alreadyAcceptedCount > 0 && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-semibold">
                Already Hired: {alreadyAcceptedCount}
              </span>
            )}
          </div>

          {/* Instructions */}
          {needMoreSelections && pendingApplicants.length > 0 && (
            <p className="text-yellow-300/80 text-sm mt-3 flex items-center gap-2">
              <span className="text-lg">👆</span>
              Toggle {peopleNeeded - totalSelected} more {peopleNeeded - totalSelected === 1 ? 'person' : 'people'} to start the job
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F] mb-4"></div>
              <p className="text-white/70">Loading applicants...</p>
            </div>
          ) : applicants.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-white/70">No applicants yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Already Accepted Workers */}
              {applicants.filter(a => a.status === 'accepted').map((applicant) => (
                <div 
                  key={applicant.interest_id}
                  className="bg-green-500/20 backdrop-blur-xl rounded-2xl p-4 border-2 border-green-400/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white text-xl">
                      ✓
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{applicant.worker_name}</h3>
                      <p className="text-green-200 text-sm">✓ Already Hired</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pending Applicants with Toggle */}
              {pendingApplicants.map((applicant) => {
                const isSelected = selectedWorkers.has(applicant.interest_id);
                const canSelect = selectedWorkers.size < (peopleNeeded - alreadyAcceptedCount);
                
                return (
                  <div 
                    key={applicant.interest_id}
                    className={`backdrop-blur-xl rounded-2xl p-4 border-2 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-green-500/20 border-green-400/50' 
                        : 'bg-white/10 border-white/20 hover:border-white/40'
                    }`}
                    onClick={() => (isSelected || canSelect) && toggleWorker(applicant.interest_id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Toggle Circle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected || canSelect) toggleWorker(applicant.interest_id);
                        }}
                        disabled={!isSelected && !canSelect}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-green-500 text-white' 
                            : canSelect
                              ? 'bg-white/20 text-white/50 hover:bg-white/30'
                              : 'bg-white/10 text-white/30 cursor-not-allowed'
                        }`}
                      >
                        {isSelected ? '✓' : '○'}
                      </button>
                      
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">{applicant.worker_name}</h3>
                        <p className="text-white/70 text-sm">📧 {applicant.worker_email}</p>
                        <p className="text-white/70 text-sm">📞 {applicant.worker_phone}</p>
                        <p className="text-white/60 text-xs mt-2">
                          Applied: {new Date(applicant.applied_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      {/* Reject Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Reject ${applicant.worker_name}?`)) {
                            handleReject(applicant.interest_id);
                          }
                        }}
                        className="px-3 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-all text-sm"
                        title="Reject this applicant"
                      >
                        ✗
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Rejected Applicants */}
              {applicants.filter(a => a.status === 'rejected').map((applicant) => (
                <div 
                  key={applicant.interest_id}
                  className="bg-red-500/10 backdrop-blur-xl rounded-2xl p-4 border border-red-400/20 opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/30 flex items-center justify-center text-red-300 text-xl">
                      ✗
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white/70 mb-1">{applicant.worker_name}</h3>
                      <p className="text-red-300/70 text-sm">Rejected</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start Job Button - Only shows when exact number is selected */}
        {canStartJob && selectedWorkers.size > 0 && (
          <div className="sticky bottom-0 p-6 bg-gradient-to-t from-[#4B244A] to-transparent pt-12">
            <button
              onClick={handleStartJob}
              disabled={startingJob}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {startingJob ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                  Starting Job...
                </>
              ) : (
                <>
                  🚀 Start Job with {selectedWorkers.size} Selected {selectedWorkers.size === 1 ? 'Person' : 'People'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
