import { useState } from 'react';
import { X, Loader2, Check} from 'lucide-react';

interface ContractModalProps {
  jobTitle: string;
  jobDetails: {
    description: string;
    house_type: string;
    cleaning_type: string;
    budget: number;
    location?: string;
    duration_type: string;
    start_date?: string;
    end_date?: string;
    payment_schedule?: {
      frequency: string;
      payment_amount: number;
      payment_dates: string[];
      payment_method_preference: string;
    };
  };
  employerName: string;
  workerName?: string;
  onAccept: () => void | Promise<void>;
  onReject: () => void;
}

export default function ContractModal({ 
  jobTitle, 
  jobDetails, 
  employerName,
  workerName,
  onAccept, 
  onReject 
}: ContractModalProps) {
  const [workerSignature, setWorkerSignature] = useState(workerName || '');
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    if (!workerSignature.trim()) {
      alert('Please enter your full name to sign the contract');
      return;
    }
    if (!agreed) {
      alert('Please check the agreement box to continue');
      return;
    }
    try {
      setAccepting(true);
      await onAccept();
    } finally {
      setAccepting(false);
    }
  };

  const formatPaymentSchedule = () => {
    if (!jobDetails.payment_schedule) return 'To be discussed';
    
    const { frequency, payment_amount, payment_dates, payment_method_preference } = jobDetails.payment_schedule;
    
    let schedule = '';
    switch (frequency) {
      case 'weekly':
        schedule = `Every week: ₱${payment_amount.toLocaleString()}`;
        break;
      case 'biweekly':
        schedule = `Every 2 weeks: ₱${payment_amount.toLocaleString()}`;
        break;
      case 'monthly':
        schedule = `Monthly on day ${payment_dates.join(' and ')}: ₱${payment_amount.toLocaleString()}`;
        break;
      case 'custom':
        schedule = `Custom schedule: ₱${payment_amount.toLocaleString()} per payment`;
        break;
    }
    
    return `${schedule} via ${payment_method_preference.toUpperCase()}`;
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Shared styles
  const cardStyle = "bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm";
  const labelStyle = "text-[#4B244A]/60 dark:text-white/60 text-sm font-medium";
  const valueStyle = "text-[#4B244A] dark:text-white font-semibold";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#4B244A] dark:text-white">Employment Contract</h2>
            <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">Please review and sign the contract</p>
          </div>
        </div>

        {/* Contract Content */}
        <div className="p-6 space-y-6">
          {/* Contract Header */}
          <div className={cardStyle}>
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white text-center mb-2">
              CLEANING SERVICES AGREEMENT
            </h3>
            <p className="text-[#4B244A]/60 dark:text-white/60 text-center text-sm font-medium">{currentDate}</p>
          </div>

          {/* Parties */}
          <div className={`${cardStyle} space-y-3`}>
            <h4 className="text-lg font-bold text-[#4B244A] dark:text-white mb-3">Parties to this Agreement</h4>
            <div>
              <p className={labelStyle}>EMPLOYER (Client)</p>
              <p className={valueStyle}>{employerName}</p>
            </div>
            <div>
              <p className={labelStyle}>SERVICE PROVIDER (Housekeeper)</p>
              <p className={valueStyle}>{workerName || '[Your Name - To be signed below]'}</p>
            </div>
          </div>

          {/* Job Details */}
          <div className={`${cardStyle} space-y-4`}>
            <h4 className="text-lg font-bold text-[#4B244A] dark:text-white mb-3">1. Scope of Work</h4>
            
            <div>
              <p className={labelStyle}>Position</p>
              <p className={valueStyle}>{jobTitle}</p>
            </div>

            <div>
              <p className={labelStyle}>Service Type</p>
              <p className="text-[#4B244A] dark:text-white">{jobDetails.cleaning_type.replace(/_/g, ' ').toUpperCase()}</p>
            </div>

            <div>
              <p className={labelStyle}>Property Type</p>
              <p className="text-[#4B244A] dark:text-white">{jobDetails.house_type.toUpperCase()}</p>
            </div>

            {jobDetails.location && (
              <div>
                <p className={labelStyle}>Location</p>
                <p className="text-[#4B244A] dark:text-white">{jobDetails.location}</p>
              </div>
            )}

            <div>
              <p className={labelStyle}>Description</p>
              <p className="text-[#4B244A] dark:text-white">{jobDetails.description}</p>
            </div>
          </div>

          {/* Duration */}
          <div className={`${cardStyle} space-y-3`}>
            <h4 className="text-lg font-bold text-[#4B244A] dark:text-white mb-3">2. Contract Duration</h4>
            
            {jobDetails.duration_type === 'long_term' ? (
              <>
                <div>
                  <p className={labelStyle}>Contract Type</p>
                  <p className={valueStyle}>LONG-TERM / RECURRING</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={labelStyle}>Start Date</p>
                    <p className="text-[#4B244A] dark:text-white">{jobDetails.start_date ? new Date(jobDetails.start_date).toLocaleDateString() : 'TBD'}</p>
                  </div>
                  <div>
                    <p className={labelStyle}>End Date</p>
                    <p className="text-[#4B244A] dark:text-white">{jobDetails.end_date ? new Date(jobDetails.end_date).toLocaleDateString() : 'TBD'}</p>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className={labelStyle}>Contract Type</p>
                <p className={valueStyle}>SHORT-TERM / ONE-TIME</p>
              </div>
            )}
          </div>

          {/* Compensation */}
          <div className={`${cardStyle} space-y-3`}>
            <h4 className="text-lg font-bold text-[#4B244A] dark:text-white mb-3">3. Compensation & Payment Terms</h4>
            
            <div>
              <p className={labelStyle}>Total Budget</p>
              <p className="text-[#4B244A] dark:text-white font-bold text-xl">₱{jobDetails.budget.toLocaleString()}</p>
            </div>

            {jobDetails.payment_schedule && jobDetails.duration_type === 'long_term' && (
              <div>
                <p className={labelStyle}>Payment Schedule</p>
                <p className="text-[#4B244A] dark:text-white">{formatPaymentSchedule()}</p>
              </div>
            )}

            <div className="bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl p-3 mt-3">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm font-medium">
                <strong>Payment Terms:</strong> The employer agrees to pay on the scheduled dates. 
                Payment must be marked with proof of transaction. Service provider can report late payments.
              </p>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className={`${cardStyle} space-y-3`}>
            <h4 className="text-lg font-bold text-[#4B244A] dark:text-white mb-3">4. Terms & Conditions</h4>
            
            <div className="space-y-2 text-[#4B244A]/80 dark:text-white/80 text-sm font-medium">
              <p>• The service provider agrees to perform the cleaning services as described above.</p>
              <p>• The employer agrees to provide access to the property and necessary cleaning supplies (unless otherwise agreed).</p>
              <p>• Payment must be made according to the agreed schedule.</p>
              <p>• Either party may terminate this agreement with 7 days written notice.</p>
              <p>• The service provider is responsible for their own safety during work hours.</p>
              <p>• Both parties agree to maintain confidentiality regarding property access and personal information.</p>
              <p>• Disputes should be resolved through the platform's mediation system.</p>
              {jobDetails.duration_type === 'long_term' && (
                <>
                  <p>• Check-in/check-out system must be used to track attendance.</p>
                  <p>• Late payments beyond 3 days may result in suspension of services.</p>
                </>
              )}
            </div>
          </div>

          {/* Signature Section */}
          <div className="bg-[#EA526F]/10 dark:bg-[#EA526F]/20 border border-[#EA526F]/20 dark:border-[#EA526F]/30 rounded-2xl p-6 space-y-4">
            <h4 className="text-lg font-bold text-[#4B244A] dark:text-white mb-3">5. Digital Signature</h4>
            
            <div>
              <label className="block text-[#4B244A] dark:text-white font-bold mb-2 text-sm">
                Type your full name to sign this contract *
              </label>
              <input
                type="text"
                value={workerSignature}
                onChange={(e) => setWorkerSignature(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F] transition-all font-medium"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-8 h-8 rounded border-gray-300 dark:border-white/30 text-[#EA526F] focus:ring-[#EA526F]"
              />
              <label htmlFor="agree" className="text-[#4B244A] dark:text-white text-sm font-medium">
                I have read and agree to all terms and conditions stated in this contract. 
                I understand my responsibilities and the payment terms. I agree to fulfill my duties as described.
              </label>
            </div>

            {workerSignature && agreed && (
              <div className="bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <p className="text-[#4B244A]/60 dark:text-white/60 text-xs font-bold uppercase tracking-wider">Digital Signature</p>
                <p className="text-[#4B244A] dark:text-white text-xl font-serif italic mt-1">{workerSignature}</p>
                <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-2 font-medium">{currentDate}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onReject}
              disabled={accepting}
              className="flex-1 px-6 py-4 bg-red-100 text-red-700 dark:bg-red-600 dark:text-white font-bold rounded-xl hover:bg-red-200 dark:hover:bg-red-700 transition-all border border-red-200 dark:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Decline Contract
            </button>
            <button
              onClick={handleAccept}
              disabled={!workerSignature.trim() || !agreed || accepting}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white font-bold rounded-xl hover:from-[#d4486a] hover:to-[#c2375b] transition-all shadow-lg shadow-[#EA526F]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  Accept & Sign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}