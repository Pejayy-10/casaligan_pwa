import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Navigate to login after 2.5 seconds
    const timer = setTimeout(() => {
      navigate('/login');
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-6000"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo container */}
        <div className="mb-12 animate-bounce-slow">
          <div className="w-40 h-40 md:w-48 md:h-48 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center border-4 border-white/20 shadow-2xl overflow-hidden">
            <img src="/logo.png" alt="Casaligan Logo" className="w-36 h-36 md:w-44 md:h-44 object-contain" />
          </div>
        </div>

        <p className="text-white/80 text-lg md:text-xl mb-8 animate-fade-in animation-delay-500">
          Your Trusted Housekeeping Platform
        </p>

        {/* Loading spinner */}
        <div className="flex flex-col items-center animate-fade-in animation-delay-1000">
          <svg className="animate-spin h-10 w-10 text-[#EA526F]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-white/60 text-sm mt-4">Loading...</p>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-white/50 text-xs animate-fade-in animation-delay-1500">
        © 2025 Casaligan. All rights reserved.
      </div>
    </div>
  );
}
