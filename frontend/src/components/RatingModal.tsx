import React, { useState } from 'react';
import StarRating from './StarRating';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number, review: string) => Promise<void>;
  workerName: string;
  hireId?: number;
  postId?: number;
}

const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  workerName,
}) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(rating, review);
      // Reset form
      setRating(0);
      setReview('');
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit rating';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setReview('');
    setError(null);
    onClose();
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#E8E4E1] dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-white/50 dark:border-white/10 transition-all">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-[#4B244A]/60 dark:text-white/60 hover:text-[#4B244A] dark:hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#EA526F]/10 dark:bg-[#EA526F]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#EA526F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#4B244A] dark:text-white">Rate Your Experience</h2>
          <p className="text-[#4B244A]/70 dark:text-white/70 mt-1 text-sm font-medium">How was your experience with {workerName}?</p>
        </div>

        {/* Star Rating */}
        <div className="flex flex-col items-center mb-6">
          <StarRating
            rating={rating}
            size="lg"
            interactive
            onChange={setRating}
          />
          {rating > 0 && (
            <span className="text-lg font-bold text-[#EA526F] mt-2">
              {ratingLabels[rating]}
            </span>
          )}
        </div>

        {/* Review textarea */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-[#4B244A] dark:text-white mb-2">
            Write a review (optional)
          </label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Share your experience with this housekeeper..."
            className="w-full px-4 py-3 bg-white/50 dark:bg-white/10 backdrop-blur-sm border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all outline-none resize-none"
            rows={4}
            maxLength={500}
          />
          <div className="text-right text-xs text-[#4B244A]/50 dark:text-white/50 mt-1 font-medium">
            {review.length}/500
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-[#4B244A] dark:text-white rounded-xl font-bold hover:bg-white/80 dark:hover:bg-white/20 transition-all"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="flex-1 px-4 py-3 bg-[#EA526F] text-white rounded-xl font-bold hover:bg-[#d64460] disabled:bg-gray-300 dark:disabled:bg-white/10 disabled:text-gray-500 dark:disabled:text-white/50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30 active:scale-95"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </div>
            ) : (
              'Submit Rating'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;