import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-400 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-6000"></div>
      </div>

      <div className="max-w-5xl w-full relative z-10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-16 border border-white/50 dark:border-white/10 transition-all">
        <div className="text-center">
          <div className="mb-6 inline-block">
             {/* Logo placeholder or Icon */}
             <span className="text-6xl">🏠</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-[#4B244A] dark:text-white mb-6 tracking-tight">
            Casaligan
          </h1>
          <p className="text-xl md:text-2xl text-[#4B244A]/70 dark:text-white/70 mb-12 max-w-2xl mx-auto font-medium">
            Your trusted platform connecting housekeepers with house owners in the Philippines.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-8 bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-white/40 dark:border-white/10 hover:transform hover:scale-105 transition-all shadow-lg">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="font-bold text-lg text-[#4B244A] dark:text-white mb-2">Find Help</h3>
              <p className="text-[#4B244A]/70 dark:text-white/60 text-sm">Connect with verified housekeepers in your area quickly and easily.</p>
            </div>
            <div className="p-8 bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-white/40 dark:border-white/10 hover:transform hover:scale-105 transition-all shadow-lg">
              <div className="text-4xl mb-4">💼</div>
              <h3 className="font-bold text-lg text-[#4B244A] dark:text-white mb-2">Earn Money</h3>
              <p className="text-[#4B244A]/70 dark:text-white/60 text-sm">Offer your housekeeping services and grow your income on your terms.</p>
            </div>
            <div className="p-8 bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-2xl border border-white/40 dark:border-white/10 hover:transform hover:scale-105 transition-all shadow-lg">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="font-bold text-lg text-[#4B244A] dark:text-white mb-2">Safe & Secure</h3>
              <p className="text-[#4B244A]/70 dark:text-white/60 text-sm">Verified profiles and secure payment system for peace of mind.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/register"
              className="w-full sm:w-auto px-10 py-4 bg-[#EA526F] text-white font-bold text-lg rounded-xl hover:bg-[#d4486a] transition-all shadow-lg shadow-[#EA526F]/30 hover:shadow-[#EA526F]/50 active:scale-95"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-10 py-4 bg-transparent text-[#4B244A] dark:text-white font-bold text-lg rounded-xl border-2 border-[#4B244A] dark:border-white/50 hover:bg-[#4B244A]/10 dark:hover:bg-white/10 transition-all active:scale-95"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}