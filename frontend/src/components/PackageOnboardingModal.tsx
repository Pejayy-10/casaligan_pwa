import { useState } from 'react';
import { Check } from 'lucide-react';
import PackageManagement from './PackageManagement';
import { useScrollLock } from '../hooks/useScrollLock';

interface PackageOnboardingModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export default function PackageOnboardingModal({ onClose, onComplete }: PackageOnboardingModalProps) {
  useScrollLock(true);
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

  // --- FORM VIEW ---
  if (showPackageForm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-all">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl transition-all">
          <div className="p-6 border-b border-gray-200 dark:border-white/20 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create Your First Package</h3>
              <button 
                onClick={handlePackageComplete} 
                className="p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-gray-600 dark:text-white/60 dark:hover:text-white"
              >
                ×
              </button>
            </div>
            <p className="text-gray-500 dark:text-white/70 text-sm mt-2">
              Set up your service packages so homeowners can book you directly!
            </p>
          </div>
          
          <div className="p-6">
            <PackageManagement embedded />
            
            <div className="mt-6 flex justify-center">
              <button
                onClick={handlePackageComplete}
                className="px-6 py-3 !bg-[#EA526F] !text-white font-semibold rounded-xl hover:bg-[#d64460] transition-all shadow-md"
              >
                Done Setting Up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- WELCOME VIEW ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-all">
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-gray-200 dark:border-white/20 shadow-2xl overflow-hidden transition-all">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-200/50 dark:hover:bg-white/10 rounded-lg transition-colors text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white z-20"
        >
          ×
        </button>
        
        {/* Header with illustration */}
        <div className="relative p-8 pb-4 text-center">
          <div className="w-16 h-16 bg-pink-100 dark:bg-pink-800/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-pink-600 dark:text-pink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m0 10v10l8 4m0-10l8 4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome, Housekeeper!
          </h2>
          <p className="text-gray-600 dark:text-white/80">
            You're now part of our housekeeper community!
          </p>
        </div>

        {/* Content */}
        <div className="px-8 pb-6">
          <div className="bg-gray-50 dark:bg-white/5 dark:backdrop-blur-xl rounded-2xl p-5 border border-gray-200 dark:border-white/20 mb-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
              </svg>
              Set Up Your Service Packages
            </h3>
            <p className="text-gray-600 dark:text-white/70 text-sm leading-relaxed">
              Create service packages to let homeowners know what you offer and at what price. 
              This makes it easy for them to <strong className="text-gray-900 dark:text-white">hire you directly</strong> without posting a job!
            </p>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-gray-600 dark:text-white/80 text-sm">
                <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span>Get discovered by homeowners in your area</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-white/80 text-sm">
                <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span>Set your own prices and services</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-white/80 text-sm">
                <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span>Receive direct booking requests</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleSetupNow}
              className="w-full py-4 !bg-[#EA526F] !text-white font-bold rounded-xl hover:bg-[#d64460] transition-all shadow-lg shadow-[#EA526F]/20 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Set Up Packages Now
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={handleDoLater}
                className="flex-1 py-3 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/20"
              >
                Do It Later
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 py-3 bg-transparent text-gray-400 dark:text-white/60 font-semibold rounded-xl hover:text-gray-600 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
              >
                Skip for Now
              </button>
            </div>
          </div>

          <p className="text-center text-gray-400 dark:text-white/50 text-xs mt-4">
            You can always manage your packages from your Profile page
          </p>
        </div>
      </div>
    </div>
  );
}