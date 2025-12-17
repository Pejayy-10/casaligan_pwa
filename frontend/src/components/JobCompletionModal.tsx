import { useState, useRef } from 'react';

interface Props {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function JobCompletionModal({ jobId, jobTitle, onClose, onSuccess }: Props) {
  const [proofUrl, setProofUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      setUploading(true);
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'completion');

      const response = await fetch('http://127.0.0.1:8000/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setProofUrl(`http://127.0.0.1:8000${data.url}`);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to upload image');
        setPreviewImage(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
      setPreviewImage(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`http://127.0.0.1:8000/jobs/${jobId}/submit-completion`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proof_url: proofUrl || null,
          notes: notes || null
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to submit completion');
      }
    } catch (error) {
      console.error('Submit completion error:', error);
      alert('Failed to submit completion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#E8E4E1] dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/20 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-[#E8E4E1]/95 dark:bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">✅ Submit Job Completion</h2>
            <button
              onClick={onClose}
              className="text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white transition-colors text-2xl"
            >
              ✕
            </button>
          </div>
          <p className="text-[#4B244A]/70 dark:text-white/70 text-sm mt-1 font-medium">{jobTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
              📋 Submit proof of job completion. Once submitted, the owner will review and approve your work.
            </p>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm font-bold mb-2">
              📷 Upload Proof Photo
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-white/30 rounded-lg text-[#4B244A]/70 dark:text-white/70 hover:border-[#EA526F] hover:text-[#EA526F] transition-all flex items-center justify-center gap-2 font-medium bg-white/50 dark:bg-white/5"
            >
              {uploading ? (
                <>
                  <span className="animate-spin">⏳</span> Uploading...
                </>
              ) : (
                <>
                  📤 Click to select image from device
                </>
              )}
            </button>
            <p className="text-[#4B244A]/50 dark:text-white/50 text-xs mt-1 font-medium">
              Supports: JPEG, PNG, GIF, WebP (max 10MB)
            </p>
          </div>

          {/* Preview */}
          {previewImage && (
            <div>
              <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm font-bold mb-2">
                Preview {proofUrl && '✅'}
              </label>
              <div className="relative group">
                <img
                  src={previewImage}
                  alt="Completion proof"
                  className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-white/20"
                />
                <button
                  onClick={() => {
                    setPreviewImage(null);
                    setProofUrl('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[#4B244A]/80 dark:text-white/80 text-sm font-bold mb-2">
              📝 Completion Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the work completed, any notes for the owner..."
              rows={4}
              className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#EA526F] resize-none transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white font-bold rounded-xl hover:bg-white/80 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {submitting ? 'Submitting...' : '✅ Submit Completion'}
          </button>
        </div>
      </div>
    </div>
  );
}