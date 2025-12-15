import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Payment types
export type PaymentMethod = 'gcash' | 'maya' | 'cash' | 'bank_transfer';

export interface PaymentRequest {
  amount: number;
  title: string;
  description?: string;
  recipientName?: string;
  // Callback context - what to do after payment
  onSuccess: (paymentDetails: PaymentResult) => void;
  onCancel?: () => void;
  // Optional: require proof upload
  requireProof?: boolean;
  // Optional: allowed payment methods (defaults to all)
  allowedMethods?: PaymentMethod[];
}

export interface PaymentResult {
  method: PaymentMethod;
  referenceNumber: string;
  proofUrl?: string;
  paidAt: string;
}

interface PaymentContextType {
  initiatePayment: (request: PaymentRequest) => void;
  isPaymentModalOpen: boolean;
}

const PaymentContext = createContext<PaymentContextType | null>(null);

export function usePayment() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
}

// Payment method configurations
const PAYMENT_METHODS: Record<PaymentMethod, { name: string; color: string; icon: string; description: string }> = {
  gcash: {
    name: 'GCash',
    color: '#007DFF',
    icon: 'G',
    description: 'Digital wallet payment'
  },
  maya: {
    name: 'Maya',
    color: '#00D632',
    icon: 'M',
    description: 'Digital wallet payment'
  },
  cash: {
    name: 'Cash',
    color: '#EA526F',
    icon: '💵',
    description: 'Pay in person'
  },
  bank_transfer: {
    name: 'Bank Transfer',
    color: '#6B5B95',
    icon: '🏦',
    description: 'Direct bank transfer'
  }
};

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<PaymentRequest | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [step, setStep] = useState<'select' | 'proof' | 'processing' | 'success'>('select');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setSelectedMethod(null);
    setStep('select');
    setProofUrl(null);
    setProofPreview(null);
    setReferenceNumber('');
    setUploading(false);
  }, []);

  const initiatePayment = useCallback((request: PaymentRequest) => {
    resetState();
    setCurrentRequest(request);
    setIsOpen(true);
  }, [resetState]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    currentRequest?.onCancel?.();
    setTimeout(resetState, 300); // Reset after animation
  }, [currentRequest, resetState]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'payment');

      const response = await fetch('http://127.0.0.1:8000/upload/image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setProofUrl(`http://127.0.0.1:8000${data.url}`);
      } else {
        alert('Failed to upload proof');
        setProofPreview(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload proof');
      setProofPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleProceedToProof = () => {
    if (!selectedMethod) return;
    
    if (currentRequest?.requireProof && selectedMethod !== 'cash') {
      setStep('proof');
    } else {
      handleProcessPayment();
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedMethod || !currentRequest) return;
    
    setStep('processing');
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate reference number
    const ref = `${selectedMethod.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setReferenceNumber(ref);
    setStep('success');
    
    // Auto-complete after showing success
    setTimeout(() => {
      const result: PaymentResult = {
        method: selectedMethod,
        referenceNumber: ref,
        proofUrl: proofUrl || undefined,
        paidAt: new Date().toISOString()
      };
      currentRequest.onSuccess(result);
      setIsOpen(false);
      setTimeout(resetState, 300);
    }, 2500);
  };

  const allowedMethods = currentRequest?.allowedMethods || (['gcash', 'maya', 'cash', 'bank_transfer'] as PaymentMethod[]);

  return (
    <PaymentContext.Provider value={{ initiatePayment, isPaymentModalOpen: isOpen }}>
      {children}
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />
      
      {/* Payment Modal */}
      {isOpen && currentRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
            
            {/* SUCCESS STATE */}
            {step === 'success' && (
              <div className="p-8 text-center">
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
                
                <div className="text-white/60 text-sm">Redirecting...</div>
              </div>
            )}
            
            {/* PROCESSING STATE */}
            {step === 'processing' && (
              <div className="p-8 text-center">
                <div className="mb-6">
                  <div className="w-24 h-24 mx-auto border-4 border-[#EA526F] border-t-transparent rounded-full animate-spin"></div>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-2">Processing Payment...</h3>
                <p className="text-white/80">
                  Please wait while we process your {PAYMENT_METHODS[selectedMethod!]?.name} payment
                </p>
              </div>
            )}
            
            {/* PROOF UPLOAD STATE */}
            {step === 'proof' && (
              <>
                <div className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/20 p-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setStep('select')}
                      className="text-white/70 hover:text-white transition-colors"
                    >
                      ←
                    </button>
                    <h2 className="text-xl font-bold text-white">Upload Payment Proof</h2>
                  </div>
                  <button onClick={handleClose} className="text-white/70 hover:text-white text-3xl">×</button>
                </div>
                
                <div className="p-6 space-y-6">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: PAYMENT_METHODS[selectedMethod!]?.color }}
                      >
                        {PAYMENT_METHODS[selectedMethod!]?.icon}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{PAYMENT_METHODS[selectedMethod!]?.name}</p>
                        <p className="text-white/60 text-sm">₱{currentRequest.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Upload Area */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/30 rounded-xl p-8 text-center cursor-pointer hover:border-white/50 transition-all"
                  >
                    {proofPreview ? (
                      <div className="space-y-3">
                        <img 
                          src={proofPreview} 
                          alt="Payment proof" 
                          className="max-h-48 mx-auto rounded-lg"
                        />
                        <p className="text-green-400 text-sm">✓ Proof uploaded</p>
                        <p className="text-white/60 text-xs">Tap to change</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-4xl">📷</div>
                        <p className="text-white font-semibold">Upload Screenshot</p>
                        <p className="text-white/60 text-sm">Take a screenshot of your payment confirmation</p>
                      </div>
                    )}
                  </div>
                  
                  {uploading && (
                    <div className="text-center text-white/60">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent mr-2"></div>
                      Uploading...
                    </div>
                  )}
                </div>
                
                <div className="sticky bottom-0 bg-white/10 backdrop-blur-xl border-t border-white/20 p-6">
                  <button
                    onClick={handleProcessPayment}
                    disabled={!proofUrl || uploading}
                    className="w-full py-4 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white font-bold text-lg rounded-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Confirm Payment'}
                  </button>
                </div>
              </>
            )}
            
            {/* SELECT METHOD STATE */}
            {step === 'select' && (
              <>
                <div className="sticky top-0 bg-white/10 backdrop-blur-xl border-b border-white/20 p-6 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">💳 Payment</h2>
                  <button onClick={handleClose} className="text-white/70 hover:text-white text-3xl">×</button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Payment Info */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-white/60 text-sm mb-1">{currentRequest.description || 'Payment for'}</p>
                    <p className="text-white font-semibold mb-3">{currentRequest.title}</p>
                    {currentRequest.recipientName && (
                      <p className="text-white/70 text-sm mb-3">To: {currentRequest.recipientName}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Amount to Pay</span>
                      <span className="text-3xl font-bold text-[#EA526F]">₱{currentRequest.amount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <h3 className="text-white font-semibold mb-3">Select Payment Method</h3>
                    <div className="space-y-3">
                      {allowedMethods.map((method) => {
                        const config = PAYMENT_METHODS[method];
                        return (
                          <button
                            key={method}
                            onClick={() => setSelectedMethod(method)}
                            className={`w-full p-4 rounded-xl border-2 transition-all ${
                              selectedMethod === method
                                ? `border-[${config.color}] bg-[${config.color}]/20`
                                : 'border-white/20 bg-white/5 hover:bg-white/10'
                            }`}
                            style={selectedMethod === method ? { 
                              borderColor: config.color, 
                              backgroundColor: `${config.color}20` 
                            } : {}}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
                                style={{ backgroundColor: config.color }}
                              >
                                {config.icon}
                              </div>
                              <div className="text-left flex-1">
                                <p className="text-white font-semibold">{config.name}</p>
                                <p className="text-white/60 text-sm">{config.description}</p>
                              </div>
                              {selectedMethod === method && (
                                <div 
                                  className="w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: config.color }}
                                >
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 bg-white/10 backdrop-blur-xl border-t border-white/20 p-6">
                  <button
                    onClick={handleProceedToProof}
                    disabled={!selectedMethod}
                    className="w-full py-4 bg-gradient-to-r from-[#EA526F] to-[#d4486a] text-white font-bold text-lg rounded-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedMethod 
                      ? (currentRequest.requireProof && selectedMethod !== 'cash' 
                          ? `Continue with ${PAYMENT_METHODS[selectedMethod].name}` 
                          : `Pay with ${PAYMENT_METHODS[selectedMethod].name}`)
                      : 'Select Payment Method'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PaymentContext.Provider>
  );
}
