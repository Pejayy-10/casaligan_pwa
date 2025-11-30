import { useState, useRef } from 'react';

interface Props {
  jobId: number;
  jobTitle: string;
  pendingPayments: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReportUnpaidModal({ jobId, jobTitle, pendingPayments, onClose, onSuccess }: Props) {
  const [reason, setReason] = useState('');
  const [daysOverdue, setDaysOverdue] = useState<number | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) continue;

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImages(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);

      // Upload file
      try {
        setUploading(true);
        const token = localStorage.getItem('access_token');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'evidence');

        const response = await fetch('http://127.0.0.1:8000/upload/image', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          setEvidenceUrls(prev => [...prev, `http://127.0.0.1:8000${data.url}`]);
        }
      } catch (error) {
        console.error('Upload error:', error);
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeEvidence = (index: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
    setEvidenceUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for the report');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/report-unpaid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason,
          days_overdue: daysOverdue || null,
          evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Report error:', error);
      alert('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#4B244A] to-[#6B3468] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">⚠️ Report Unpaid Job</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <p className="text-white/60 text-sm mt-1">{jobTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-300 text-sm">
              📢 You have <strong>{pendingPayments}</strong> pending payment(s) for this job. 
              If the owner hasn't paid as agreed, you can report the issue here.
            </p>
          </div>

          {/* Days Overdue */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-2">
              📅 How many days overdue? (Optional)
            </label>
            <input
              type="number"
              min="1"
              value={daysOverdue || ''}
              onChange={(e) => setDaysOverdue(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 7"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-2">
              📝 Reason for Report <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the payment issue..."
              rows={4}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none"
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-2">
              📷 Upload Evidence (Optional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-3 border-2 border-dashed border-white/30 rounded-lg text-white/70 hover:border-[#EA526F] hover:text-[#EA526F] transition-all flex items-center justify-center gap-2"
            >
              {uploading ? '⏳ Uploading...' : '📤 Add evidence photos'}
            </button>
            {previewImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {previewImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img src={img} alt={`Evidence ${index + 1}`} className="w-16 h-16 object-cover rounded-lg" />
                    <button
                      onClick={() => removeEvidence(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Reasons */}
          <div>
            <label className="block text-white/80 text-sm font-semibold mb-2">
              Quick Select
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'Payment is overdue',
                'Owner is unresponsive',
                'Partial payment only',
                'Owner refuses to pay'
              ].map((quickReason) => (
                <button
                  key={quickReason}
                  onClick={() => setReason(quickReason)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    reason === quickReason
                      ? 'bg-red-500 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {quickReason}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading || !reason.trim()}
            className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : '⚠️ Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
