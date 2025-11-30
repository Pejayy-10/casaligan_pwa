import { useState } from 'react';

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
  onAccept: () => void;
  onReject: () => void;
}

export default function ContractModal({ 
  jobTitle, 
  jobDetails, 
  employerName,
  onAccept, 
  onReject 
}: ContractModalProps) {
  const [workerSignature, setWorkerSignature] = useState('');
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (!workerSignature.trim()) {
      alert('Please enter your full name to sign the contract');
      return;
    }
    if (!agreed) {
      alert('Please check the agreement box to continue');
      return;
    }
    onAccept();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-br from-[#4B244A] to-[#6B3468] border-b border-white/20 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">📄 Employment Contract</h2>
            <p className="text-white/70 text-sm">Please review and sign the contract</p>
          </div>
        </div>

        {/* Contract Content */}
        <div className="p-6 space-y-6">
          {/* Contract Header */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white text-center mb-2">
              CLEANING SERVICES AGREEMENT
            </h3>
            <p className="text-white/60 text-center text-sm">{currentDate}</p>
          </div>

          {/* Parties */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h4 className="text-lg font-bold text-white mb-3">Parties to this Agreement</h4>
            <div>
              <p className="text-white/60 text-sm">EMPLOYER (Client)</p>
              <p className="text-white font-semibold">{employerName}</p>
            </div>
            <div>
              <p className="text-white/60 text-sm">SERVICE PROVIDER (Housekeeper)</p>
              <p className="text-white font-semibold">[Your Name - To be signed below]</p>
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h4 className="text-lg font-bold text-white mb-3">1. Scope of Work</h4>
            
            <div>
              <p className="text-white/60 text-sm">Position</p>
              <p className="text-white font-semibold">{jobTitle}</p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Service Type</p>
              <p className="text-white">{jobDetails.cleaning_type.replace(/_/g, ' ').toUpperCase()}</p>
            </div>

            <div>
              <p className="text-white/60 text-sm">Property Type</p>
              <p className="text-white">{jobDetails.house_type.toUpperCase()}</p>
            </div>

            {jobDetails.location && (
              <div>
                <p className="text-white/60 text-sm">Location</p>
                <p className="text-white">{jobDetails.location}</p>
              </div>
            )}

            <div>
              <p className="text-white/60 text-sm">Description</p>
              <p className="text-white">{jobDetails.description}</p>
            </div>
          </div>

          {/* Duration */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h4 className="text-lg font-bold text-white mb-3">2. Contract Duration</h4>
            
            {jobDetails.duration_type === 'long_term' ? (
              <>
                <div>
                  <p className="text-white/60 text-sm">Contract Type</p>
                  <p className="text-white font-semibold">LONG-TERM / RECURRING</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/60 text-sm">Start Date</p>
                    <p className="text-white">{jobDetails.start_date ? new Date(jobDetails.start_date).toLocaleDateString() : 'TBD'}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">End Date</p>
                    <p className="text-white">{jobDetails.end_date ? new Date(jobDetails.end_date).toLocaleDateString() : 'TBD'}</p>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-white/60 text-sm">Contract Type</p>
                <p className="text-white font-semibold">SHORT-TERM / ONE-TIME</p>
              </div>
            )}
          </div>

          {/* Compensation */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h4 className="text-lg font-bold text-white mb-3">3. Compensation & Payment Terms</h4>
            
            <div>
              <p className="text-white/60 text-sm">Total Budget</p>
              <p className="text-white font-bold text-xl">₱{jobDetails.budget.toLocaleString()}</p>
            </div>

            {jobDetails.payment_schedule && jobDetails.duration_type === 'long_term' && (
              <div>
                <p className="text-white/60 text-sm">Payment Schedule</p>
                <p className="text-white">{formatPaymentSchedule()}</p>
              </div>
            )}

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mt-3">
              <p className="text-yellow-200 text-sm">
                <strong>Payment Terms:</strong> The employer agrees to pay on the scheduled dates. 
                Payment must be marked with proof of transaction. Service provider can report late payments.
              </p>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h4 className="text-lg font-bold text-white mb-3">4. Terms & Conditions</h4>
            
            <div className="space-y-2 text-white/80 text-sm">
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
          <div className="bg-[#EA526F]/10 border border-[#EA526F]/30 rounded-2xl p-6 space-y-4">
            <h4 className="text-lg font-bold text-white mb-3">5. Digital Signature</h4>
            
            <div>
              <label className="block text-white font-semibold mb-2">
                Type your full name to sign this contract *
              </label>
              <input
                type="text"
                value={workerSignature}
                onChange={(e) => setWorkerSignature(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-5 h-5 rounded"
              />
              <label htmlFor="agree" className="text-white text-sm">
                I have read and agree to all terms and conditions stated in this contract. 
                I understand my responsibilities and the payment terms. I agree to fulfill my duties as described.
              </label>
            </div>

            {workerSignature && agreed && (
              <div className="bg-white/10 border border-white/20 rounded-xl p-4">
                <p className="text-white/60 text-xs">Digital Signature</p>
                <p className="text-white text-xl font-serif italic">{workerSignature}</p>
                <p className="text-white/60 text-xs mt-2">{currentDate}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onReject}
              className="flex-1 px-6 py-4 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
            >
              ❌ Decline Contract
            </button>
            <button
              onClick={handleAccept}
              disabled={!workerSignature.trim() || !agreed}
              className="flex-1 px-6 py-4 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✅ Accept & Sign Contract
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
