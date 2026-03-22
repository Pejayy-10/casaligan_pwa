import { useState, useEffect } from 'react';
import { X, Search, Check, Loader2, Users, Send } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Owner {
  user_id: number;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workerId: number;
  workerName: string;
}

export default function ReferHousekeeperModal({ isOpen, onClose, workerId, workerName }: Props) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOwners, setSelectedOwners] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadOwners();
      setSelectedOwners(new Set());
      setSent(false);
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        loadOwners(search);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [search, isOpen]);

  const loadOwners = async (searchTerm?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`${API_BASE_URL}/referrals/owners?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setOwners(data);
      }
    } catch (error) {
      console.error('Failed to load owners:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOwner = (userId: number) => {
    setSelectedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleRefer = async () => {
    if (selectedOwners.size === 0) return;

    try {
      setSending(true);
      const token = localStorage.getItem('access_token');

      const response = await fetch(`${API_BASE_URL}/referrals/refer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          worker_id: workerId,
          target_owner_ids: Array.from(selectedOwners),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSent(true);
        // Auto-close after success
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to send referral');
      }
    } catch (error) {
      console.error('Referral error:', error);
      alert('Failed to send referral');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const resolveProfilePic = (url: string | null) => {
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-gray-200 dark:border-white/20 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">
              Refer {workerName}
            </h3>
            <p className="text-xs text-[#4B244A]/60 dark:text-white/60 mt-0.5">
              Select homeowners to refer this housekeeper to
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-white/50" />
          </button>
        </div>

        {/* Success message */}
        {sent ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-lg font-bold text-[#4B244A] dark:text-white mb-2">
                Referral Sent!
              </h4>
              <p className="text-sm text-[#4B244A]/70 dark:text-white/70">
                {selectedOwners.size} homeowner{selectedOwners.size > 1 ? 's' : ''} will be notified about {workerName}.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search homeowners..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#EA526F]/50"
                />
              </div>
            </div>

            {/* Owner List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#EA526F]" />
                </div>
              ) : owners.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-10 h-10 text-gray-300 dark:text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-white/50">
                    {search ? 'No homeowners found matching your search' : 'No other homeowners available'}
                  </p>
                </div>
              ) : (
                owners.map((owner) => {
                  const isSelected = selectedOwners.has(owner.user_id);
                  const profilePic = resolveProfilePic(owner.profile_picture);

                  return (
                    <button
                      key={owner.user_id}
                      onClick={() => toggleOwner(owner.user_id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                        isSelected
                          ? 'bg-[#EA526F]/10 dark:bg-[#EA526F]/20 border-[#EA526F]/30 dark:border-[#EA526F]/40'
                          : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {profilePic ? (
                          <img
                            src={profilePic}
                            alt={`${owner.first_name} ${owner.last_name}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-[#4B244A] dark:text-white">
                            {owner.first_name[0]}{owner.last_name[0]}
                          </span>
                        )}
                      </div>

                      {/* Name */}
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-[#4B244A] dark:text-white">
                          {owner.first_name} {owner.last_name}
                        </p>
                      </div>

                      {/* Checkbox */}
                      <div
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-[#EA526F] border-[#EA526F]'
                            : 'border-gray-300 dark:border-white/30'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-white/10 flex-shrink-0">
              <button
                onClick={handleRefer}
                disabled={selectedOwners.size === 0 || sending}
                className="w-full py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Refer to {selectedOwners.size > 0 ? `${selectedOwners.size} Homeowner${selectedOwners.size > 1 ? 's' : ''}` : 'Selected'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
