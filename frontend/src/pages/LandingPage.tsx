import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl p-8 md:p-12">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">Casaligan</h1>
          <p className="text-xl text-gray-600 mb-8">
            Your trusted platform connecting housekeepers with house owners in the Philippines
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 bg-blue-50 rounded-lg">
              <div className="text-3xl mb-3">🏠</div>
              <h3 className="font-semibold text-lg mb-2">Find Help</h3>
              <p className="text-gray-600 text-sm">Connect with verified housekeepers in your area</p>
            </div>
            <div className="p-6 bg-purple-50 rounded-lg">
              <div className="text-3xl mb-3">💼</div>
              <h3 className="font-semibold text-lg mb-2">Earn Money</h3>
              <p className="text-gray-600 text-sm">Offer your housekeeping services and grow your income</p>
            </div>
            <div className="p-6 bg-indigo-50 rounded-lg">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-semibold text-lg mb-2">Safe & Secure</h3>
              <p className="text-gray-600 text-sm">Verified profiles and secure payment system</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
