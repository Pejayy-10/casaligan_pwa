import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import StarRating from '../components/StarRating';

interface WorkerPackage {
  package_id: number;
  name: string;
  price: number;
  duration_hours: number;
}

interface WorkerProfile {
  worker_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  city: string | null;
  barangay: string | null;
  package_count: number;
  packages: WorkerPackage[];
  average_rating: number;
  total_ratings: number;
}

export default function BrowseWorkersPage() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState('');
  const [minRating, setMinRating] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<string>('');

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async (city?: string, rating?: number, sort?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (city) params.append('city', city);
      if (rating) params.append('min_rating', rating.toString());
      if (sort) params.append('sort_by', sort);
      
      const url = `http://127.0.0.1:8000/direct-hire/workers${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setWorkers(data);
      }
    } catch (error) {
      console.error('Failed to load workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadWorkers(
      searchCity.trim() || undefined, 
      minRating || undefined,
      sortBy || undefined
    );
  };

  const handleFilterChange = (newRating: number | '', newSort: string) => {
    setMinRating(newRating);
    setSortBy(newSort);
    loadWorkers(
      searchCity.trim() || undefined,
      newRating || undefined,
      newSort || undefined
    );
  };

  const handleViewProfile = (workerId: number) => {
    navigate(`/worker/${workerId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] pb-20">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="text-white/80 hover:text-white">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-white">Browse Housekeepers</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Search by city..."
              className="flex-1 px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-[#EA526F] text-white font-semibold rounded-xl hover:bg-[#d64460] transition-all"
            >
              🔍 Search
            </button>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-sm">Min Rating:</span>
              <select
                value={minRating}
                onChange={(e) => handleFilterChange(e.target.value ? Number(e.target.value) : '', sortBy)}
                className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="" className="text-gray-900">Any</option>
                <option value="4" className="text-gray-900">4+ Stars</option>
                <option value="3" className="text-gray-900">3+ Stars</option>
                <option value="2" className="text-gray-900">2+ Stars</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-sm">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => handleFilterChange(minRating, e.target.value)}
                className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="" className="text-gray-900">Default</option>
                <option value="rating" className="text-gray-900">Highest Rated</option>
                <option value="jobs_completed" className="text-gray-900">Most Jobs</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workers List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-white/70 mt-4">Loading housekeepers...</p>
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No housekeepers found</h3>
            <p className="text-white/70">Try a different city or check back later</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workers.map((worker) => (
              <div
                key={worker.worker_id}
                className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#EA526F] to-[#6B3468] flex items-center justify-center text-2xl text-white font-bold shadow-lg">
                      {worker.first_name[0]}{worker.last_name[0]}
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {worker.first_name} {worker.last_name}
                      </h3>
                      
                      {/* Rating Display */}
                      <div className="flex items-center gap-2 mt-1">
                        <StarRating 
                          rating={worker.average_rating || 0} 
                          size="sm" 
                          showValue={worker.total_ratings > 0}
                        />
                        {worker.total_ratings > 0 ? (
                          <span className="text-white/60 text-sm">
                            ({worker.total_ratings} {worker.total_ratings === 1 ? 'review' : 'reviews'})
                          </span>
                        ) : (
                          <span className="text-white/50 text-sm italic">No reviews yet</span>
                        )}
                      </div>
                      
                      {worker.city && (
                        <p className="text-white/70 text-sm mt-1">
                          📍 {worker.barangay && `${worker.barangay}, `}{worker.city}
                        </p>
                      )}
                      
                      {/* Package Summary */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {worker.packages.slice(0, 3).map((pkg) => (
                          <span
                            key={pkg.package_id}
                            className="px-3 py-1 bg-[#EA526F]/20 text-[#EA526F] text-sm rounded-full"
                          >
                            {pkg.name} - ₱{pkg.price.toLocaleString()}
                          </span>
                        ))}
                        {worker.packages.length > 3 && (
                          <span className="px-3 py-1 bg-white/10 text-white/70 text-sm rounded-full">
                            +{worker.packages.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewProfile(worker.worker_id)}
                    className="px-4 py-2 bg-[#EA526F] text-white font-semibold rounded-xl hover:bg-[#d64460] transition-all whitespace-nowrap"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <TabBar role="owner" />
    </div>
  );
}
