import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TabBar from '../components/TabBar';
import StarRating from '../components/StarRating';
import { authService } from '../services/auth';
import { psgcService } from '../services/psgc';
import type { PSGCRegion, PSGCProvince, PSGCCity, PSGCBarangay } from '../types';

interface WorkerPackage {
  package_id: number;
  name: string;
  price: number;
  duration_hours: number;
  category_id?: number;
  category_name?: string;
}

interface Category {
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface WorkerProfile {
  worker_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  city: string | null;
  barangay: string | null;
  province?: string | null;
  package_count: number;
  packages: WorkerPackage[];
  average_rating: number;
  total_ratings: number;
  proximity_score?: number;
  proximity_label?: string;
}

export default function BrowseWorkersPage() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<WorkerProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState('');
  const [minRating, setMinRating] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<string>('');
  
  // Location filter state
  const [employerLocation, setEmployerLocation] = useState<{
    city: string;
    province: string;
    region: string;
    barangay: string;
  } | null>(null);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  
  // Location editor state
  const [regions, setRegions] = useState<PSGCRegion[]>([]);
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cities, setCities] = useState<PSGCCity[]>([]);
  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('');

  // Load employer's address on mount
  useEffect(() => {
    loadEmployerAddress();
    loadCategories();
  }, []);

  // Load workers when location or filters change
  useEffect(() => {
    if (!locationLoading) {
      loadWorkers();
    }
  }, [employerLocation, minRating, sortBy, locationLoading]);

  // Apply category filter to workers
  useEffect(() => {
    applyCategoryFilter();
  }, [workers, selectedCategory]);

  const loadCategories = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/categories/?active_only=true');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const applyCategoryFilter = () => {
    if (!selectedCategory) {
      setFilteredWorkers(workers);
      return;
    }

    // Filter and sort workers by category
    const workersWithCategory: WorkerProfile[] = [];
    const workersWithoutCategory: WorkerProfile[] = [];

    workers.forEach(worker => {
      const hasCategory = worker.packages.some(pkg => pkg.category_id === selectedCategory);
      if (hasCategory) {
        workersWithCategory.push(worker);
      } else {
        workersWithoutCategory.push(worker);
      }
    });

    // Show workers with the category first, then others
    setFilteredWorkers([...workersWithCategory, ...workersWithoutCategory]);
  };

  const loadEmployerAddress = async () => {
    try {
      setLocationLoading(true);
      const user = await authService.getCurrentUser();
      if (user?.address) {
        setEmployerLocation({
          city: user.address.city_name,
          province: user.address.province_name,
          region: user.address.region_name,
          barangay: user.address.barangay_name || '',
        });
        // Set initial editor values
        setSelectedRegion(user.address.region_code || '');
        setSelectedProvince(user.address.province_code || '');
        setSelectedCity(user.address.city_code || '');
        setSelectedBarangay(user.address.barangay_code || '');
        
        // Load barangays if city is selected
        if (user.address.city_code) {
          try {
            const barangaysData = await psgcService.getBarangays(user.address.city_code);
            setBarangays(barangaysData);
          } catch (error) {
            console.error('Failed to load barangays:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load employer address:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const loadLocationOptions = async () => {
    try {
      const regionsData = await psgcService.getRegions();
      setRegions(regionsData);
      
      if (selectedRegion) {
        const provincesData = await psgcService.getProvinces(selectedRegion);
        setProvinces(provincesData);
      }
      
      if (selectedProvince) {
        const citiesData = await psgcService.getCities(selectedProvince);
        setCities(citiesData);
      }
      
      if (selectedCity) {
        const barangaysData = await psgcService.getBarangays(selectedCity);
        setBarangays(barangaysData);
      }
    } catch (error) {
      console.error('Failed to load location options:', error);
    }
  };

  useEffect(() => {
    if (showLocationEditor) {
      loadLocationOptions();
    }
  }, [showLocationEditor, selectedRegion, selectedProvince, selectedCity]);

  const handleRegionChange = async (regionCode: string) => {
    setSelectedRegion(regionCode);
    setSelectedProvince('');
    setSelectedCity('');
    setCities([]);
    
    if (regionCode) {
      const provincesData = await psgcService.getProvinces(regionCode);
      setProvinces(provincesData);
    }
  };

  const handleProvinceChange = async (provinceCode: string) => {
    setSelectedProvince(provinceCode);
    setSelectedCity('');
    setSelectedBarangay('');
    setBarangays([]);
    
    if (provinceCode) {
      const citiesData = await psgcService.getCities(provinceCode);
      setCities(citiesData);
    }
  };

  const handleCityChange = async (cityCode: string) => {
    setSelectedCity(cityCode);
    setSelectedBarangay('');
    setBarangays([]);
    
    if (cityCode) {
      const barangaysData = await psgcService.getBarangays(cityCode);
      setBarangays(barangaysData);
    }
  };

  const handleSaveLocation = () => {
    const selectedCityObj = cities.find(c => c.code === selectedCity);
    const selectedProvinceObj = provinces.find(p => p.code === selectedProvince);
    const selectedRegionObj = regions.find(r => r.code === selectedRegion);
    const selectedBarangayObj = barangays.find(b => b.code === selectedBarangay);
    
    if (selectedCityObj && selectedProvinceObj && selectedRegionObj) {
      setEmployerLocation({
        city: selectedCityObj.name,
        province: selectedProvinceObj.name,
        region: selectedRegionObj.name,
        barangay: selectedBarangayObj?.name || '',
      });
      setShowLocationEditor(false);
    }
  };

  const loadWorkers = async (city?: string, rating?: number, sort?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (city) params.append('city', city);
      if (rating) params.append('min_rating', rating.toString());
      if (sort) params.append('sort_by', sort);
      
      // Add employer location for proximity sorting
      if (employerLocation) {
        params.append('employer_city', employerLocation.city);
        params.append('employer_province', employerLocation.province);
        if (employerLocation.barangay) {
          params.append('employer_barangay', employerLocation.barangay);
        }
      }
      
      const url = `http://127.0.0.1:8000/direct-hire/workers${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkers(data);
        setFilteredWorkers(data);
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
        {/* Location Filter */}
        {employerLocation && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 mb-4 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm mb-1">Showing workers near:</p>
                <p className="text-white font-semibold">
                  📍 {employerLocation.barangay && `${employerLocation.barangay}, `}{employerLocation.city}, {employerLocation.province}
                </p>
                <p className="text-white/60 text-xs mt-1">
                  Workers in your barangay are shown first, then your city, then your province
                </p>
              </div>
              <button
                onClick={() => setShowLocationEditor(!showLocationEditor)}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all text-sm"
              >
                {showLocationEditor ? 'Cancel' : '✏️ Edit Location'}
              </button>
            </div>
            
            {/* Location Editor */}
            {showLocationEditor && (
              <div className="mt-4 pt-4 border-t border-white/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-white/70 text-sm mb-1 block">Region</label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                    >
                      <option value="" className="text-gray-900">Select Region</option>
                      {regions.map((region) => (
                        <option key={region.code} value={region.code} className="text-gray-900">
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-white/70 text-sm mb-1 block">Province</label>
                    <select
                      value={selectedProvince}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      disabled={!selectedRegion}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900">Select Province</option>
                      {provinces.map((province) => (
                        <option key={province.code} value={province.code} className="text-gray-900">
                          {province.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-white/70 text-sm mb-1 block">City/Municipality</label>
                    <select
                      value={selectedCity}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={!selectedProvince}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900">Select City</option>
                      {cities.map((city) => (
                        <option key={city.code} value={city.code} className="text-gray-900">
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3 mb-3">
                  <div>
                    <label className="text-white/70 text-sm mb-1 block">Barangay</label>
                    <select
                      value={selectedBarangay}
                      onChange={(e) => setSelectedBarangay(e.target.value)}
                      disabled={!selectedCity}
                      className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900">Select Barangay (Optional)</option>
                      {barangays.map((barangay) => (
                        <option key={barangay.code} value={barangay.code} className="text-gray-900">
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={handleSaveLocation}
                  disabled={!selectedCity}
                  className="w-full px-4 py-2 bg-[#EA526F] hover:bg-[#d64460] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Location
                </button>
              </div>
            )}
          </div>
        )}

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
              <span className="text-white/70 text-sm">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : '')}
                className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="" className="text-gray-900">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id} className="text-gray-900">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

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
                <option value="" className="text-gray-900">Default (Nearby First)</option>
                <option value="rating" className="text-gray-900">Highest Rated</option>
                <option value="jobs_completed" className="text-gray-900">Most Jobs</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Info */}
        {selectedCategory && (
          <div className="bg-[#EA526F]/20 backdrop-blur-xl rounded-xl p-3 mb-4 border border-[#EA526F]/30">
            <p className="text-white text-sm">
              🏷️ Filtering by: <span className="font-semibold">{categories.find(c => c.category_id === selectedCategory)?.name}</span>
              {' '}- Workers with this category are shown first
            </p>
          </div>
        )}

        {/* Workers List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-white/70 mt-4">Loading housekeepers...</p>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="text-center py-12 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No housekeepers found</h3>
            <p className="text-white/70">
              {selectedCategory 
                ? `No housekeepers have packages in the selected category` 
                : 'Try a different city or check back later'}
            </p>
          </div>
        ) : selectedCategory && !filteredWorkers.some(w => w.packages.some(p => p.category_id === selectedCategory)) ? (
          <div className="mb-4 bg-yellow-500/20 backdrop-blur-xl rounded-xl p-4 border border-yellow-500/30">
            <p className="text-yellow-200 text-sm">
              ⚠️ No housekeepers with packages in this category. Showing all available housekeepers below.
            </p>
          </div>
        ) : null}
        
        {!loading && filteredWorkers.length > 0 && (
          <div className="grid gap-4">
            {filteredWorkers.map((worker) => {
              const hasSelectedCategory = selectedCategory 
                ? worker.packages.some(p => p.category_id === selectedCategory)
                : false;
              
              return (
              <div
                key={worker.worker_id}
                className={`bg-white/10 backdrop-blur-xl rounded-2xl p-5 border transition-all ${
                  hasSelectedCategory 
                    ? 'border-[#EA526F] ring-2 ring-[#EA526F]/30' 
                    : 'border-white/20 hover:bg-white/20'
                }`}
              >
                {hasSelectedCategory && (
                  <div className="mb-3 inline-block px-3 py-1 bg-[#EA526F]/30 text-[#EA526F] text-xs font-semibold rounded-full border border-[#EA526F]/50">
                    ✓ Has {categories.find(c => c.category_id === selectedCategory)?.name} packages
                  </div>
                )}
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
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-white/70 text-sm">
                            📍 {worker.barangay && `${worker.barangay}, `}{worker.city}
                            {worker.province && `, ${worker.province}`}
                          </p>
                          {worker.proximity_label && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              worker.proximity_label === 'same_barangay'
                                ? 'bg-emerald-500/30 text-emerald-300'
                                : worker.proximity_label === 'same_city' 
                                ? 'bg-green-500/30 text-green-300' 
                                : worker.proximity_label === 'same_province'
                                ? 'bg-yellow-500/30 text-yellow-300'
                                : 'bg-gray-500/30 text-gray-300'
                            }`}>
                              {worker.proximity_label === 'same_barangay'
                                ? '📍 Same Barangay'
                                : worker.proximity_label === 'same_city' 
                                ? '📍 Same City' 
                                : worker.proximity_label === 'same_province'
                                ? '📍 Same Province'
                                : '📍 Other Location'}
                            </span>
                          )}
                        </div>
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
              );
            })}
          </div>
        )}
      </main>

      <TabBar role="owner" />
    </div>
  );
}
