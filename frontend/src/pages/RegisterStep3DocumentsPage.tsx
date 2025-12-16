import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function RegisterStep3DocumentsPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    document_type: 'national_id',
    file_path: '',
    notes: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Shared styles from the design system
  const inputClass = "w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none disabled:opacity-50";
  const labelClass = "block text-sm font-bold text-[#4B244A] dark:text-white/90 mb-2";

  const documentTypes = [
    { value: 'national_id', label: 'National ID' },
    { value: 'passport', label: 'Passport' },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'voters_id', label: "Voter's ID" },
    { value: 'postal_id', label: 'Postal ID' },
    { value: 'other', label: 'Other' },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please upload an image or PDF file');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    setError('');
    
    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
    
    // Upload file to backend
    try {
      setUploading(true);
      const token = localStorage.getItem('access_token');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('document_type', formData.document_type);
      
      const response = await fetch('http://127.0.0.1:8000/upload/document', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: uploadFormData
      });
      
      if (response.ok) {
        const data = await response.json();
        setFormData({ ...formData, file_path: `http://127.0.0.1:8000${data.url}` });
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to upload file');
        setPreviewUrl('');
        setSelectedFile(null);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file. Please try again.');
      setPreviewUrl('');
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.file_path) {
      setError('Please upload a document');
      return;
    }

    setLoading(true);

    try {
      await authService.uploadDocument(formData);
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorDetail =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setError(typeof errorDetail === 'string' ? errorDetail : 'Failed to upload document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300 relative overflow-y-auto">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none fixed">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-400 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-6000"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10 my-8">
        {/* Glass morphism card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/50 dark:border-white/10 transition-all">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl md:text-3xl font-bold text-[#4B244A] dark:text-white">Document Verification</h1>
              <div className="text-sm text-[#4B244A]/70 dark:text-white/70 font-medium">Step 3 of 3</div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-2 bg-[#EA526F] rounded-full"></div>
              <div className="flex-1 h-2 bg-[#EA526F] rounded-full"></div>
              <div className="flex-1 h-2 bg-[#EA526F] rounded-full shadow-md shadow-[#EA526F]/30"></div>
            </div>
          </div>

          <div className="mb-6 p-4 bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/40 dark:border-white/10 rounded-xl">
            <p className="text-sm text-[#4B244A] dark:text-white/90">
              📄 Upload a valid government-issued ID for verification. This helps keep our platform safe and trusted.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 dark:bg-red-500/20 backdrop-blur-sm border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-white text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="document_type" className={labelClass}>
                Document Type *
              </label>
              <select
                id="document_type"
                value={formData.document_type}
                onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                className={inputClass}
                required
                disabled={loading}
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value} className="text-gray-900 dark:text-gray-900">
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="file" className={labelClass}>
                Upload Document *
              </label>
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className={`${inputClass} file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#EA526F] file:text-white hover:file:bg-[#d4486a] file:cursor-pointer`}
                required
                disabled={loading || uploading}
              />
              
              {/* Upload status */}
              {uploading && (
                <div className="mt-2 flex items-center text-[#4B244A]/80 dark:text-white/80 text-sm">
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading document...
                </div>
              )}
              
              {/* Image Preview */}
              {previewUrl && !uploading && (
                <div className="mt-4 p-4 bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl">
                  <p className="text-sm text-[#4B244A] dark:text-white/90 mb-3 font-medium">Document Preview: {formData.file_path && '✅ Uploaded'}</p>
                  <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <img 
                      src={previewUrl} 
                      alt="Document preview" 
                      className="w-full h-auto max-h-96 object-contain"
                    />
                  </div>
                  <p className="mt-3 text-sm text-[#4B244A]/70 dark:text-white/70">
                    ✓ {selectedFile?.name} ({((selectedFile?.size ?? 0) / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              )}
              
              {formData.file_path && !previewUrl && (
                <p className="mt-2 text-sm text-[#4B244A]/80 dark:text-white/80">✓ File selected: {selectedFile?.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="notes" className={labelClass}>
                Additional Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Any additional information about your document"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d4486a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30 mt-6"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </div>
              ) : (
                'Submit & Complete'
              )}
            </button>
          </form>

          <div className="mt-6 p-4 bg-white/40 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-white/40 dark:border-white/10">
            <p className="text-xs text-[#4B244A]/80 dark:text-white/80">
              🔒 Your documents are securely stored and will only be used for verification purposes. 
              We respect your privacy and follow strict data protection guidelines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}