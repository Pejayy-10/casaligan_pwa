import { useState } from 'react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reportData: {
    reportType: string;
    title: string;
    reason: string;
    description: string;
    evidenceUrls?: string[];
  }) => Promise<void>;
  reportedUserName: string;
  reportedUserRole: 'housekeeper' | 'owner';
}

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  reportedUserName,
  reportedUserRole,
}) => {
  const [reportType, setReportType] = useState('');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const reportTypes = [
    { value: 'unpaid_job', label: 'Unpaid Job' },
    { value: 'non_completion', label: 'Job Not Completed' },
    { value: 'poor_quality', label: 'Poor Quality Work' },
    { value: 'no_show', label: 'No Show' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'scam', label: 'Scam/Fraud' },
    { value: 'other', label: 'Other' },
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const newPreviews: string[] = [];
    const newFiles: File[] = [];

    for (const file of files) {
      if (evidenceFiles.length + newFiles.length >= 5) {
        alert('Maximum 5 evidence files allowed');
        break;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        newPreviews.push(ev.target?.result as string);
        if (newPreviews.length === files.length || newFiles.length >= 5) {
          setEvidencePreviews([...evidencePreviews, ...newPreviews]);
          setEvidenceFiles([...evidenceFiles, ...newFiles]);
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
      newFiles.push(file);
    }
  };

  const removeEvidence = (index: number) => {
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== index));
    setEvidencePreviews(evidencePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!reportType) {
      setError('Please select a report type');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a detailed description');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload evidence files if any
      const evidenceUrls: string[] = [];
      if (evidenceFiles.length > 0) {
        const token = localStorage.getItem('access_token');
        for (const file of evidenceFiles) {
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
            evidenceUrls.push(`http://127.0.0.1:8000${data.url}`);
          }
        }
      }

      await onSubmit({
        reportType,
        title: title.trim(),
        reason: reason.trim(),
        description: description.trim(),
        evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      });

      // Reset form
      setReportType('');
      setTitle('');
      setReason('');
      setDescription('');
      setEvidenceFiles([]);
      setEvidencePreviews([]);
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit report';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReportType('');
    setTitle('');
    setReason('');
    setDescription('');
    setEvidenceFiles([]);
    setEvidencePreviews([]);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Report {reportedUserRole === 'housekeeper' ? 'Housekeeper' : 'House Owner'}</h2>
          <p className="text-gray-500 mt-1">Report {reportedUserName}</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type <span className="text-red-500">*</span>
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Select a type</option>
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              maxLength={100}
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Main reason for this report"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed information about what happened..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence (Optional - Max 5 files)
            </label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-all">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {uploading ? 'Uploading...' : 'Upload Screenshots/Photos'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={uploading || evidenceFiles.length >= 5}
                className="hidden"
              />
            </label>
            {evidencePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {evidencePreviews.map((preview, idx) => (
                  <div key={idx} className="relative">
                    <img src={preview} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                    <button
                      onClick={() => removeEvidence(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-800 text-sm">
              ℹ️ Your report will be reviewed by our admin team. False reports may result in account restrictions.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !reportType || !title.trim() || !reason.trim() || !description.trim()}
            className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
