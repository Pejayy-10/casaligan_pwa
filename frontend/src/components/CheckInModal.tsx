import { useState } from 'react';

interface CheckInModalProps {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CheckInModal({ jobId, jobTitle, onClose, onSuccess }: CheckInModalProps) {
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get location. Please enter manually or skip.');
          setGettingLocation(false);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
      setGettingLocation(false);
    }
  };

  const handleCheckIn = async () => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          check_in_location: location || null,
          notes: notes || null
        })
      });

      if (response.ok) {
        alert('✅ Checked in successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to check in');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      alert('Failed to check in');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-lg w-full border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/20 px-6 py-4">
          <h2 className="text-2xl font-bold text-white">🕐 Check In</h2>
          <p className="text-white/70 text-sm">{jobTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Current Time */}
          <div className="bg-white/10 rounded-2xl p-4 border border-white/20 text-center">
            <p className="text-white/60 text-sm mb-1">Current Time</p>
            <p className="text-white text-3xl font-bold">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-white/60 text-sm mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Location */}
          <div>
            <label className="block text-white font-semibold mb-2">
              Location (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location or use GPS"
                className="flex-1 px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              />
              <button
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                className="px-4 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50"
              >
                {gettingLocation ? '...' : '📍'}
              </button>
            </div>
            <p className="text-white/50 text-xs mt-1">
              Helps verify you're at the correct location
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-white font-semibold mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any special notes about today's work..."
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
            />
          </div>

          {/* Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
            <p className="text-blue-200 text-sm">
              <strong>💡 Remember:</strong> Make sure to check out when you finish work. 
              The employer will be able to see your check-in time and verify your attendance.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckIn}
              disabled={processing}
              className="flex-1 px-6 py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Checking In...' : '✅ Check In Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Check-out modal component
interface CheckOutModalProps {
  jobId: number;
  jobTitle: string;
  checkinId: number;
  checkInTime: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckOutModal({ jobId, jobTitle, checkinId, checkInTime, onClose, onSuccess }: CheckOutModalProps) {
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState('');

  const calculateHours = () => {
    const checkIn = new Date(checkInTime);
    const now = new Date();
    const diff = now.getTime() - checkIn.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleCheckOut = async () => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://127.0.0.1:8000/jobs/${jobId}/checkin/${checkinId}/checkout`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            notes: notes || null
          })
        }
      );

      if (response.ok) {
        alert('✅ Checked out successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to check out');
      }
    } catch (error) {
      console.error('Check-out error:', error);
      alert('Failed to check out');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-lg w-full border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="border-b border-white/20 px-6 py-4">
          <h2 className="text-2xl font-bold text-white">🏁 Check Out</h2>
          <p className="text-white/70 text-sm">{jobTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Work Duration */}
          <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
            <p className="text-white/60 text-sm mb-2">Work Duration</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/50 text-xs">Checked In</p>
                <p className="text-white font-semibold">
                  {new Date(checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-white/50 text-xs">Total Time</p>
                <p className="text-white text-xl font-bold">{calculateHours()}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-white font-semibold mb-2">
              Work Summary (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Describe what you accomplished today..."
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
            />
          </div>

          {/* Info */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
            <p className="text-green-200 text-sm">
              <strong>✅ Great work!</strong> Your attendance will be recorded and the employer can verify your hours.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckOut}
              disabled={processing}
              className="flex-1 px-6 py-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Checking Out...' : '🏁 Check Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
