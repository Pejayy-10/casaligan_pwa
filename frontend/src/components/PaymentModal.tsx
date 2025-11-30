import { useState } from 'react';

interface PaymentModalProps {
  amount: number;
  jobTitle: string;
  onClose: () => void;
  onSuccess: (method: string, referenceNumber: string) => void;
}

export default function PaymentModal({ amount, jobTitle, onClose, onSuccess }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'gcash' | 'maya' | 'cash' | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handlePayment = async () => {
    if (!selectedMethod) return;
    
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock reference number
    const mockRef = `${selectedMethod.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    setReferenceNumber(mockRef);
    setShowSuccess(true);
    
    // Auto-close after showing success
    setTimeout(() => {
      onSuccess(selectedMethod, mockRef);
      onClose();
    }, 2500);
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-md w-full p-8 border border-white/20 shadow-2xl text-center">
          {/* Success Animation */}
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center animate-bounce">
              <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
          <p className="text-white/80 mb-4">Your payment has been processed</p>
          
          <div className="bg-white/10 rounded-xl p-4 mb-4 border border-white/20">
            <p className="text-white/60 text-sm mb-1">Reference Number</p>
            <p className="text-white font-mono text-sm break-all">{referenceNumber}</p>
          </div>
          
          <div className="text-white/60 text-sm">
            Redirecting...
          </div>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-md w-full p-8 border border-white/20 shadow-2xl text-center">
          {/* Processing Animation */}
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto border-4 border-[#EA526F] border-t-transparent rounded-full animate-spin"></div>
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-2">Processing Payment...</h3>
          <p className="text-white/80">Please wait while we process your {selectedMethod?.toUpperCase()} payment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/20 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">💳 Payment</h2>
          <button 
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Job Info */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-white/60 text-sm mb-1">Job</p>
            <p className="text-white font-semibold mb-3">{jobTitle}</p>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Amount to Pay</span>
              <span className="text-3xl font-bold text-[#EA526F]">₱{amount.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <h3 className="text-white font-semibold mb-3">Select Payment Method</h3>
            <div className="space-y-3">
              {/* GCash */}
              <button
                onClick={() => setSelectedMethod('gcash')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  selectedMethod === 'gcash'
                    ? 'border-[#007DFF] bg-[#007DFF]/20'
                    : 'border-white/20 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#007DFF] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    G
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-white font-semibold">GCash</p>
                    <p className="text-white/60 text-sm">Digital wallet payment</p>
                  </div>
                  {selectedMethod === 'gcash' && (
                    <div className="w-6 h-6 bg-[#007DFF] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              {/* Maya */}
              <button
                onClick={() => setSelectedMethod('maya')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  selectedMethod === 'maya'
                    ? 'border-[#00D632] bg-[#00D632]/20'
                    : 'border-white/20 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#00D632] rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    M
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-white font-semibold">Maya</p>
                    <p className="text-white/60 text-sm">Digital wallet payment</p>
                  </div>
                  {selectedMethod === 'maya' && (
                    <div className="w-6 h-6 bg-[#00D632] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>

              {/* Cash */}
              <button
                onClick={() => setSelectedMethod('cash')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  selectedMethod === 'cash'
                    ? 'border-[#EA526F] bg-[#EA526F]/20'
                    : 'border-white/20 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#EA526F] rounded-lg flex items-center justify-center text-white font-bold text-2xl">
                    💵
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-white font-semibold">Cash</p>
                    <p className="text-white/60 text-sm">Pay in person</p>
                  </div>
                  {selectedMethod === 'cash' && (
                    <div className="w-6 h-6 bg-[#EA526F] rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white/10 backdrop-blur-xl border-t border-white/20 p-6">
          <button
            onClick={handlePayment}
            disabled={!selectedMethod}
            className="w-full py-4 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white font-bold text-lg rounded-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedMethod ? `Pay with ${selectedMethod.toUpperCase()}` : 'Select Payment Method'}
          </button>
        </div>
      </div>
    </div>
  );
}
