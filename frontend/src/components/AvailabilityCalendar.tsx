import { useState, useEffect } from 'react';
import apiClient from '../services/api';

interface BlockedDate {
  blocked_date_id: number;
  worker_id: number;
  blocked_date: string;
  reason: string | null;
  created_at: string;
}

interface Props {
  onClose: () => void;
}

export default function AvailabilityCalendar({ onClose }: Props) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [blockReason, setBlockReason] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadBlockedDates();
  }, []);

  const loadBlockedDates = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/availability/blocked-dates');
      if (response.data.blocked_dates) {
        setBlockedDates(response.data.blocked_dates);
      }
    } catch (error) {
      console.error('Failed to load blocked dates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockDate = async () => {
    if (!selectedDate) return;

    try {
      setProcessing(true);
      await apiClient.post('/availability/blocked-dates', {
        blocked_date: selectedDate,
        reason: blockReason || null
      });
      
      alert('Date blocked successfully');
      setShowBlockModal(false);
      setSelectedDate('');
      setBlockReason('');
      loadBlockedDates();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to block date');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnblockDate = async (blockedDateId: number) => {
    if (!confirm('Are you sure you want to unblock this date?')) return;

    try {
      await apiClient.delete(`/availability/blocked-dates/${blockedDateId}`);
      alert('Date unblocked successfully');
      loadBlockedDates();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to unblock date');
    }
  };

  const isDateBlocked = (date: Date): boolean => {
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.some(bd => bd.blocked_date === dateStr);
  };

  const isDatePast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const getBlockedDateInfo = (date: Date): BlockedDate | undefined => {
    const dateStr = date.toISOString().split('T')[0];
    return blockedDates.find(bd => bd.blocked_date === dateStr);
  };

  const handleDateClick = (date: Date) => {
    if (isDatePast(date)) return;
    
    if (isDateBlocked(date)) {
      const blockedInfo = getBlockedDateInfo(date);
      if (blockedInfo) {
        if (confirm(`This date is blocked${blockedInfo.reason ? ` (${blockedInfo.reason})` : ''}. Unblock it?`)) {
          handleUnblockDate(blockedInfo.blocked_date_id);
        }
      }
    } else {
      setSelectedDate(date.toISOString().split('T')[0]);
      setShowBlockModal(true);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-gray-200 dark:border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#E8E4E1]/90 dark:bg-slate-900/90 backdrop-blur-md p-6 border-b border-gray-200 dark:border-white/10 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">📅 Manage Availability</h2>
            <button onClick={onClose} className="text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white text-2xl transition-colors">✕</button>
          </div>
          <p className="text-[#4B244A]/70 dark:text-white/70 text-sm mt-2 font-medium">
            Click on a date to block/unblock it. Blocked dates prevent employers from directly hiring you.
          </p>
        </div>

        {/* Calendar */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
              <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading calendar...</p>
            </div>
          ) : (
            <>
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="px-4 py-2 bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-[#4B244A] dark:text-white rounded-lg transition-all font-bold border border-gray-200 dark:border-white/10"
                >
                  ← Previous
                </button>
                <h3 className="text-xl font-bold text-[#4B244A] dark:text-white">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <button
                  onClick={() => navigateMonth('next')}
                  className="px-4 py-2 bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-[#4B244A] dark:text-white rounded-lg transition-all font-bold border border-gray-200 dark:border-white/10"
                >
                  Next →
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {/* Day Headers */}
                {dayNames.map(day => (
                  <div key={day} className="text-center text-[#4B244A]/70 dark:text-white/70 font-bold text-sm py-2">
                    {day}
                  </div>
                ))}
                
                {/* Calendar Days */}
                {days.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="aspect-square"></div>;
                  }
                  
                  const isBlocked = isDateBlocked(date);
                  const isPast = isDatePast(date);
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDateClick(date)}
                      disabled={isPast}
                      className={`aspect-square rounded-lg transition-all text-sm font-bold shadow-sm ${
                        isPast
                          ? 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-white/30 cursor-not-allowed'
                          : isBlocked
                          ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/30 border-2 border-red-200 dark:border-red-500/50'
                          : isToday
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 border-2 border-blue-200 dark:border-blue-500/50'
                          : 'bg-white/60 dark:bg-white/10 text-[#4B244A] dark:text-white hover:bg-white/90 dark:hover:bg-white/20'
                      }`}
                      title={
                        isPast
                          ? 'Past date'
                          : isBlocked
                          ? `Blocked${getBlockedDateInfo(date)?.reason ? `: ${getBlockedDateInfo(date)?.reason}` : ''}`
                          : 'Click to block this date'
                      }
                    >
                      {date.getDate()}
                      {isBlocked && <span className="block text-xs">🚫</span>}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-sm text-[#4B244A]/70 dark:text-white/70 mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/60 dark:bg-white/10 rounded border border-gray-200 dark:border-white/10"></div>
                  <span className="font-medium">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-100 dark:bg-red-500/30 rounded border border-red-200 dark:border-red-400"></div>
                  <span className="font-medium">Blocked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-100 dark:bg-blue-500/30 rounded border border-blue-200 dark:border-blue-400"></div>
                  <span className="font-medium">Today</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-200 dark:bg-white/5 rounded border border-transparent"></div>
                  <span className="font-medium">Past</span>
                </div>
              </div>

              {/* Blocked Dates List */}
              {blockedDates.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-[#4B244A] dark:text-white font-bold mb-3">Blocked Dates:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {blockedDates.map(bd => (
                      <div
                        key={bd.blocked_date_id}
                        className="bg-white/50 dark:bg-white/10 rounded-lg p-3 flex items-center justify-between border border-gray-200 dark:border-white/10"
                      >
                        <div>
                          <p className="text-[#4B244A] dark:text-white font-bold">
                            {new Date(bd.blocked_date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          {bd.reason && (
                            <p className="text-[#4B244A]/70 dark:text-white/60 text-sm font-medium">Reason: {bd.reason}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnblockDate(bd.blocked_date_id)}
                          className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 text-sm font-bold shadow-sm"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Block Date Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-gray-200 dark:border-white/20 shadow-2xl">
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-4">Block Date</h3>
            <p className="text-[#4B244A]/70 dark:text-white/70 mb-4 font-medium">
              Block <strong>{new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</strong> to prevent employers from directly hiring you on this date.
            </p>
            
            <div className="mb-4">
              <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm mb-2 font-bold">
                Reason (optional - e.g., "Personal", "Holiday", "Already booked")
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full px-4 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/30 rounded-lg text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setSelectedDate('');
                  setBlockReason('');
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white rounded-lg hover:bg-white/80 dark:hover:bg-white/20 disabled:opacity-50 font-bold border border-gray-200 dark:border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockDate}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-bold shadow-lg shadow-red-500/30"
              >
                {processing ? 'Blocking...' : 'Block Date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}