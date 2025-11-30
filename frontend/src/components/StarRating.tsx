import React from 'react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  showCount?: boolean;
  count?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  showValue = false,
  showCount = false,
  count = 0,
  interactive = false,
  onChange,
}) => {
  const [hoverRating, setHoverRating] = React.useState(0);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const handleClick = (index: number) => {
    if (interactive && onChange) {
      onChange(index);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (interactive) {
      setHoverRating(index);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[...Array(maxRating)].map((_, index) => {
          const starIndex = index + 1;
          const isFilled = starIndex <= displayRating;
          const isPartial = !isFilled && starIndex - 0.5 <= displayRating;

          return (
            <button
              key={index}
              type="button"
              className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} focus:outline-none`}
              onClick={() => handleClick(starIndex)}
              onMouseEnter={() => handleMouseEnter(starIndex)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive}
            >
              <svg
                className={`${sizeClasses[size]} ${isFilled || isPartial ? 'text-yellow-400' : 'text-gray-300'}`}
                fill={isFilled ? 'currentColor' : isPartial ? 'url(#half)' : 'none'}
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <defs>
                  <linearGradient id="half">
                    <stop offset="50%" stopColor="currentColor" />
                    <stop offset="50%" stopColor="transparent" />
                  </linearGradient>
                </defs>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className={`${textSizeClasses[size]} text-gray-700 font-medium ml-1`}>
          {rating.toFixed(1)}
        </span>
      )}
      {showCount && count > 0 && (
        <span className={`${textSizeClasses[size]} text-gray-500 ml-1`}>
          ({count} {count === 1 ? 'review' : 'reviews'})
        </span>
      )}
    </div>
  );
};

export default StarRating;
