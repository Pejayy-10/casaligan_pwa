import { useState, useEffect, useCallback } from 'react';

interface JobProgressData {
  job_title: string;
  start_date: string;
  end_date: string;
  days_elapsed: number;
  days_remaining: number;
  total_days: number;
  progress_percentage: number;
  payment_dates: string[];
  upcoming_payment?: { date: string; amount: number };
  recent_checkins: Array<{
    checkin_id: number;
    check_in_time: string;
    check_out_time?: string;
    verified: boolean;
  }>;
  total_checkins: number;
}

interface JobProgressTrackerProps {
  jobId: number;
  onClose: () => void;
  userRole: 'owner' | 'housekeeper';
}

export default function JobProgressTracker({ jobId, onClose, userRole }: JobProgressTrackerProps) {
  const [data, setData] = useState<JobProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const loadProgressData = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const progressData = await response.json();
        setData(progressData);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  const renderCalendar = () => {
    if (!data) return null;

    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    const today = new Date();
    
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    const days = [];
    const startDay = monthStart.getDay();
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }
    
    // Add all days in month
    for (let day = 1; day <= monthEnd.getDate(); day++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      const dateStr = date.toISOString().split('T')[0];
      
      const isToday = date.toDateString() === today.toDateString();
      const isInJobPeriod = date >= startDate && date <= endDate;
      const isPaymentDate = data.payment_dates.includes(dateStr);
      const isPast = date < today;
      
      let bgClass = 'bg-white/5';
      let textClass = 'text-white/40';
      let borderClass = '';
      
      if (isInJobPeriod) {
        bgClass = 'bg-white/10';
        textClass = 'text-white/80';
      }
      if (isToday) {
        borderClass = 'ring-2 ring-[#EA526F]';
        textClass = 'text-[#EA526F] font-bold';
      }
      if (isPaymentDate) {
        bgClass = 'bg-green-500/20';
        textClass = 'text-green-300 font-bold';
      }
      if (isPast && isInJobPeriod) {
        bgClass = 'bg-blue-500/10';
      }
      
      days.push(
        <div
          key={day}
          className={`aspect-square flex flex-col items-center justify-center rounded-lg ${bgClass} ${borderClass} ${textClass} text-sm transition-all cursor-pointer hover:scale-105`}
        >
          <span>{day}</span>
          {isPaymentDate && <span className="text-xs">💰</span>}
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-white/60 text-xs font-semibold py-2">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const changeMonth = (offset: number) => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-[#4B244A] to-[#6B3468] border-b border-white/20 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Job Progress Tracker</h2>
            <button 
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors text-3xl leading-none"
            >
              ×
            </button>
          </div>
          {data && <p className="text-white/70 text-sm">{data.job_title}</p>}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F] mb-4"></div>
              <p className="text-white/70">Loading progress data...</p>
            </div>
          ) : !data ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">❌</div>
              <p className="text-white/70">Failed to load progress data</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-500/20 rounded-2xl p-4 border border-blue-500/30">
                  <p className="text-blue-200 text-sm mb-1">Days Elapsed</p>
                  <p className="text-white text-3xl font-bold">{data.days_elapsed}</p>
                </div>
                <div className="bg-green-500/20 rounded-2xl p-4 border border-green-500/30">
                  <p className="text-green-200 text-sm mb-1">Days Remaining</p>
                  <p className="text-white text-3xl font-bold">{data.days_remaining}</p>
                </div>
                <div className="bg-purple-500/20 rounded-2xl p-4 border border-purple-500/30">
                  <p className="text-purple-200 text-sm mb-1">Total Duration</p>
                  <p className="text-white text-3xl font-bold">{data.total_days} days</p>
                </div>
                <div className="bg-[#EA526F]/20 rounded-2xl p-4 border border-[#EA526F]/30">
                  <p className="text-[#EA526F] text-sm mb-1">Progress</p>
                  <p className="text-white text-3xl font-bold">{data.progress_percentage}%</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-semibold">Overall Progress</span>
                  <span className="text-white/70 text-sm">
                    {new Date(data.start_date).toLocaleDateString()} - {new Date(data.end_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="w-full h-6 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#EA526F] to-[#d4486a] transition-all duration-500"
                    style={{ width: `${data.progress_percentage}%` }}
                  />
                </div>
                <p className="text-white/60 text-xs mt-2 text-center">
                  {data.progress_percentage < 100 ? `${data.days_remaining} days until completion` : 'Job period completed!'}
                </p>
              </div>

              {/* Upcoming Payment */}
              {data.upcoming_payment && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-200 font-semibold mb-1 text-sm sm:text-base">Next Payment</p>
                      <p className="text-white text-sm">
                        Due: {new Date(data.upcoming_payment.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-2xl font-bold">₱{data.upcoming_payment.amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar View */}
              <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="px-3 sm:px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm sm:text-base flex-shrink-0"
                  >
                    ← Prev
                  </button>
                  <h3 className="text-base sm:text-xl font-bold text-white text-center flex-1">
                    {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => changeMonth(1)}
                    className="px-3 sm:px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all text-sm sm:text-base flex-shrink-0"
                  >
                    Next →
                  </button>
                </div>

                {renderCalendar()}

                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-500/10 border border-blue-500/30" />
                    <span className="text-white/70">Past work days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-white/10" />
                    <span className="text-white/70">Upcoming work days</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500/20" />
                    <span className="text-white/70">Payment dates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded ring-2 ring-[#EA526F]" />
                    <span className="text-white/70">Today</span>
                  </div>
                </div>
              </div>

              {/* Recent Check-ins */}
              {data.recent_checkins.length > 0 && (
                <div className="bg-white/10 rounded-2xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">🕐 Recent Check-ins</h3>
                    <span className="text-white/70 text-sm">Total: {data.total_checkins}</span>
                  </div>

                  <div className="space-y-3">
                    {data.recent_checkins.slice(0, 5).map((checkin) => (
                      <div 
                        key={checkin.checkin_id}
                        className="bg-white/5 rounded-xl p-4 border border-white/10"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-semibold mb-1">
                              {new Date(checkin.check_in_time).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                weekday: 'short'
                              })}
                            </p>
                            <p className="text-white/60 text-sm">
                              Check-in: {new Date(checkin.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {checkin.check_out_time && (
                              <p className="text-white/60 text-sm">
                                Check-out: {new Date(checkin.check_out_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            checkin.verified 
                              ? 'bg-green-500/20 text-green-300' 
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {checkin.verified ? '✅ Verified' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legend/Help */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
                <p className="text-blue-200 text-sm">
                  <strong>💡 Tip:</strong> {userRole === 'owner' 
                    ? 'Payment dates are highlighted in green. Click on "Payment Tracker" to manage payments and view proofs.'
                    : 'Green dates are when you should receive payments. Use the Check-in feature daily to track your attendance.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
