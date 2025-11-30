import { useState } from 'react';
import PackageManagement from './PackageManagement';

interface PackageOnboardingModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export default function PackageOnboardingModal({ onClose, onComplete }: PackageOnboardingModalProps) {
  const [showPackageForm, setShowPackageForm] = useState(false);

  const handleSkip = () => {
    // Mark as skipped in localStorage so we don't show again
    localStorage.setItem('package_onboarding_skipped', 'true');
    onClose();
  };

  const handleDoLater = () => {
    // Don't mark as skipped - we can show a reminder later
    onClose();
  };

  const handleSetupNow = () => {
    setShowPackageForm(true);
  };

  const handlePackageComplete = () => {
    localStorage.setItem('package_onboarding_completed', 'true');
    onComplete();
  };

  if (showPackageForm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
          <div className="p-6 border-b border-white/20">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">📦 Create Your First Package</h3>
              <button onClick={handlePackageComplete} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-white/70 text-sm mt-2">
              Set up your service packages so homeowners can book you directly!
            </p>
          </div>
          
          <div className="p-6">
            <PackageManagement embedded />
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={handlePackageComplete}
                className="px-6 py-3 bg-[#EA526F] text-white font-semibold rounded-xl hover:bg-[#d64460] transition-all"
              >
                Done Setting Up ✓
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-lg w-full border border-white/20 shadow-2xl overflow-hidden">
        {/* Header with illustration */}
        <div className="relative p-8 pb-4 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome, Housekeeper!
          </h2>
          <p className="text-white/80">
            You're now part of our housekeeper community!
          </p>
        </div>

        {/* Content */}
        <div className="px-8 pb-6">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 mb-6">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-2xl">📦</span>
              Set Up Your Service Packages
            </h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Create service packages to let homeowners know what you offer and at what price. 
              This makes it easy for them to <strong className="text-white">hire you directly</strong> without posting a job!
            </p>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <span className="text-green-400">✓</span>
                <span>Get discovered by homeowners in your area</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <span className="text-green-400">✓</span>
                <span>Set your own prices and services</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <span className="text-green-400">✓</span>
                <span>Receive direct booking requests</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleSetupNow}
              className="w-full py-4 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all shadow-lg shadow-[#EA526F]/30 flex items-center justify-center gap-2"
            >
              <span className="text-xl">🚀</span>
              Set Up Packages Now
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={handleDoLater}
                className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
              >
                ⏰ Do It Later
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 py-3 bg-transparent text-white/60 font-semibold rounded-xl hover:text-white hover:bg-white/10 transition-all"
              >
                Skip for Now
              </button>
            </div>
          </div>

          <p className="text-center text-white/50 text-xs mt-4">
            You can always manage your packages from your Profile page
          </p>
        </div>
      </div>
    </div>
  );
}
