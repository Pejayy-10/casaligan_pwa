import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
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
  category_ids: number[];
  category_names: string[];
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
  distance_km?: number | null;  // Distance in kilometers for GPS-based search
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
  
  // GPS location state
  const [useGPSLocation, setUseGPSLocation] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  
  // Location editor state
  const [regions, setRegions] = useState<PSGCRegion[]>([]);
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cities, setCities] = useState<PSGCCity[]>([]);
  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('');

  // Load employer's address on mount and check location permission
  useEffect(() => {
    loadEmployerAddress();
    loadCategories();
    checkLocationPermission();
  }, []);

  // Check if location permission has been granted or denied
  const checkLocationPermission = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    // Check if we've already asked for permission (stored in localStorage)
    const hasAskedBefore = localStorage.getItem('location_permission_asked');
    if (hasAskedBefore) {
      setLocationPermissionAsked(true);
      return;
    }

    // Show prompt after a short delay to let the page load
    setTimeout(() => {
      setShowLocationPrompt(true);
    }, 1000);
  };

  // Load workers when location or filters change
  useEffect(() => {
    if (!locationLoading) {
      loadWorkers();
    }
  }, [employerLocation, minRating, sortBy, locationLoading, useGPSLocation, gpsLocation]);

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
      const hasCategory = worker.packages.some(pkg => 
        pkg.category_ids && pkg.category_ids.includes(selectedCategory as number)
      );
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
      
      // Add GPS location if available and enabled
      if (useGPSLocation && gpsLocation) {
        params.append('employer_latitude', gpsLocation.latitude.toString());
        params.append('employer_longitude', gpsLocation.longitude.toString());
        // Also send saved address for fallback matching with workers who don't have GPS coordinates
        if (employerLocation) {
          params.append('employer_city', employerLocation.city);
          params.append('employer_province', employerLocation.province);
          if (employerLocation.barangay) {
            params.append('employer_barangay', employerLocation.barangay);
          }
        }
      }
      // Otherwise, use address-based location
      else if (employerLocation && !useGPSLocation) {
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
        console.log('Workers loaded:', data.length, 'workers found');
        console.log('GPS Location:', useGPSLocation ? gpsLocation : 'Not using GPS');
        console.log('Employer Location:', employerLocation);
        setWorkers(data);
        setFilteredWorkers(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load workers:', response.status, errorData);
        setGpsError(`Failed to load workers: ${response.status} ${errorData.detail || ''}`);
      }
    } catch (error) {
      console.error('Failed to load workers:', error);
      setGpsError('Failed to load workers. Please check your connection.');
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

  const requestGPSLocation = async () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);
    setShowLocationPrompt(false);
    setLocationPermissionAsked(true);
    localStorage.setItem('location_permission_asked', 'true');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        setGpsLocation(coords);
        setUseGPSLocation(true);
        setGpsLoading(false);
        
        // Save GPS coordinates to user's address in database
        try {
          const token = localStorage.getItem('access_token');
          const response = await fetch(
            `http://127.0.0.1:8000/auth/update-address-gps?latitude=${coords.latitude}&longitude=${coords.longitude}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (response.ok) {
            console.log('GPS coordinates saved to address');
          } else {
            console.warn('Failed to save GPS coordinates to address, but location is still available for this session');
          }
        } catch (error) {
          console.warn('Error saving GPS coordinates to address:', error);
          // Don't show error to user - GPS still works for this session
        }
      },
      (error) => {
        let errorMessage = 'Failed to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location access in your browser settings to find nearby housekeepers.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setGpsError(errorMessage);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleLocationPromptAccept = () => {
    requestGPSLocation();
  };

  const handleLocationPromptDismiss = () => {
    setShowLocationPrompt(false);
    setLocationPermissionAsked(true);
    localStorage.setItem('location_permission_asked', 'true');
  };

  const handleLocationModeChange = (useGPS: boolean) => {
    setUseGPSLocation(useGPS);
    if (!useGPS) {
      setGpsLocation(null);
      setGpsError(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8E4E1] dark:bg-slate-950 transition-colors duration-300 pb-20 relative">
      {/* Decorative circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#EA526F] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="text-[#4B244A]/80 dark:text-white/80 hover:text-[#4B244A] dark:hover:text-white transition-colors">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-[#4B244A] dark:text-white">Browse Housekeepers</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {/* Location Permission Prompt */}
        {showLocationPrompt && !locationPermissionAsked && (
          <div className="bg-blue-50 dark:bg-blue-500/20 backdrop-blur-xl rounded-2xl p-5 mb-4 border border-blue-200 dark:border-blue-500/30 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="text-3xl"><MapPin className="w-8 h-8" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#4B244A] dark:text-white mb-2">
                  Enable Location Services
                </h3>
                <p className="text-[#4B244A]/80 dark:text-white/80 text-sm mb-4">
                  Allow us to access your location to find the nearest housekeepers based on your current position. 
                  This helps you discover housekeepers closest to you for faster service.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleLocationPromptAccept}
                    className="px-4 py-2 bg-[#EA526F] hover:bg-[#d64460] text-white font-bold rounded-xl transition-all text-sm"
                  >
                    ✓ Enable Location
                  </button>
                  <button
                    onClick={handleLocationPromptDismiss}
                    className="px-4 py-2 bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-[#4B244A] dark:text-white font-bold rounded-xl transition-all text-sm border border-gray-200 dark:border-white/10"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Location Filter */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 mb-4 border border-white/50 dark:border-white/10 shadow-lg">
          {/* Location Mode Toggle */}
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-[#4B244A]/70 dark:text-white/70 text-sm font-bold">Location Mode:</span>
              <button
                onClick={() => handleLocationModeChange(false)}
                className={`px-4 py-2 rounded-xl transition-all text-sm font-bold border ${
                  !useGPSLocation
                    ? 'bg-[#EA526F] text-white border-[#EA526F]'
                    : 'bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white border-gray-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/20'
                }`}
              >
                <MapPin className="inline w-4 h-4 mr-1" /> Saved Address
              </button>
              <button
                onClick={() => {
                  if (!gpsLocation) {
                    requestGPSLocation();
                  } else {
                    handleLocationModeChange(true);
                  }
                }}
                disabled={gpsLoading}
                className={`px-4 py-2 rounded-xl transition-all text-sm font-bold border ${
                  useGPSLocation
                    ? 'bg-[#EA526F] text-white border-[#EA526F]'
                    : 'bg-white/50 dark:bg-white/10 text-[#4B244A] dark:text-white border-gray-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {gpsLoading ? '⏳ Getting Location...' : gpsLocation ? '📱 Use GPS Location' : '📱 Enable GPS Location'}
              </button>
            </div>
          </div>

          {/* GPS Error Message */}
          {gpsError && (
            <div className="mb-3 p-3 bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 rounded-xl">
              <p className="text-red-700 dark:text-red-300 text-sm font-medium">{gpsError}</p>
            </div>
          )}

          {/* Location Display */}
          {useGPSLocation && gpsLocation ? (
            <div>
              <p className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-1 font-medium">Showing workers near your current location:</p>
              <p className="text-[#4B244A] dark:text-white font-bold">
                📱 GPS Location (Lat: {gpsLocation.latitude.toFixed(6)}, Lng: {gpsLocation.longitude.toFixed(6)})
              </p>
              <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-1">
                Workers are sorted by distance from your current location
              </p>
            </div>
          ) : employerLocation ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-1 font-medium">Showing workers near:</p>
                <p className="text-[#4B244A] dark:text-white font-bold">
                  <MapPin className="inline w-4 h-4 mr-1" /> {employerLocation.barangay && `${employerLocation.barangay}, `}{employerLocation.city}, {employerLocation.province}
                </p>
                <p className="text-[#4B244A]/60 dark:text-white/60 text-xs mt-1">
                  Workers in your barangay are shown first, then your city, then your province
                </p>
              </div>
              <button
                onClick={() => setShowLocationEditor(!showLocationEditor)}
                className="px-4 py-2 bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-[#4B244A] dark:text-white rounded-xl transition-all text-sm font-bold border border-gray-200 dark:border-white/10"
              >
                {showLocationEditor ? 'Cancel' : '✏️ Edit Location'}
              </button>
            </div>
          ) : null}
             
          {/* Location Editor */}
          {showLocationEditor && !useGPSLocation && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-1 block font-bold">Region</label>
                    <select
                      value={selectedRegion}
                      onChange={(e) => handleRegionChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select Region</option>
                      {regions.map((region) => (
                        <option key={region.code} value={region.code} className="text-gray-900 dark:text-gray-900">
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-1 block font-bold">Province</label>
                    <select
                      value={selectedProvince}
                      onChange={(e) => handleProvinceChange(e.target.value)}
                      disabled={!selectedRegion}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select Province</option>
                      {provinces.map((province) => (
                        <option key={province.code} value={province.code} className="text-gray-900 dark:text-gray-900">
                          {province.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-1 block font-bold">City/Municipality</label>
                    <select
                      value={selectedCity}
                      onChange={(e) => handleCityChange(e.target.value)}
                      disabled={!selectedProvince}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select City</option>
                      {cities.map((city) => (
                        <option key={city.code} value={city.code} className="text-gray-900 dark:text-gray-900">
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3 mb-3">
                  <div>
                    <label className="text-[#4B244A]/70 dark:text-white/70 text-sm mb-1 block font-bold">Barangay</label>
                    <select
                      value={selectedBarangay}
                      onChange={(e) => setSelectedBarangay(e.target.value)}
                      disabled={!selectedCity}
                      className="w-full px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F] disabled:opacity-50"
                    >
                      <option value="" className="text-gray-900 dark:text-gray-900">Select Barangay (Optional)</option>
                      {barangays.map((barangay) => (
                        <option key={barangay.code} value={barangay.code} className="text-gray-900 dark:text-gray-900">
                          {barangay.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={handleSaveLocation}
                  disabled={!selectedCity}
                  className="w-full px-4 py-2 bg-[#EA526F] hover:bg-[#d64460] text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  Save Location
                </button>
              </div>
            )}
          </div>

        {/* Search Bar */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-white/50 dark:border-white/10 shadow-lg">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Search by city..."
              className="flex-1 px-4 py-3 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-xl text-[#4B244A] dark:text-white placeholder-gray-400 dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all shadow-md"
            >
              🔍 Search
            </button>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[#4B244A]/70 dark:text-white/70 text-sm font-bold">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : '')}
                className="px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="" className="text-gray-900 dark:text-gray-900">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id} className="text-gray-900 dark:text-gray-900">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#4B244A]/70 dark:text-white/70 text-sm font-bold">Min Rating:</span>
              <select
                value={minRating}
                onChange={(e) => handleFilterChange(e.target.value ? Number(e.target.value) : '', sortBy)}
                className="px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="" className="text-gray-900 dark:text-gray-900">Any</option>
                <option value="4" className="text-gray-900 dark:text-gray-900">4+ Stars</option>
                <option value="3" className="text-gray-900 dark:text-gray-900">3+ Stars</option>
                <option value="2" className="text-gray-900 dark:text-gray-900">2+ Stars</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[#4B244A]/70 dark:text-white/70 text-sm font-bold">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => handleFilterChange(minRating, e.target.value)}
                className="px-3 py-2 bg-white/50 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-lg text-[#4B244A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
              >
                <option value="" className="text-gray-900 dark:text-gray-900">Default (Nearby First)</option>
                <option value="rating" className="text-gray-900 dark:text-gray-900">Highest Rated</option>
                <option value="jobs_completed" className="text-gray-900 dark:text-gray-900">Most Jobs</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Info */}
        {selectedCategory && (
          <div className="bg-[#EA526F]/10 dark:bg-[#EA526F]/20 backdrop-blur-xl rounded-xl p-3 mb-4 border border-[#EA526F]/30 dark:border-[#EA526F]/40 shadow-sm">
            <p className="text-[#EA526F] dark:text-pink-300 text-sm font-medium">
              🏷️ Filtering by: <span className="font-bold">{categories.find(c => c.category_id === selectedCategory)?.name}</span>
              {' '}- Workers with this category are shown first
            </p>
          </div>
        )}

        {/* Workers List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#EA526F]"></div>
            <p className="text-[#4B244A]/70 dark:text-white/70 mt-4 font-medium">Loading housekeepers...</p>
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="text-center py-12 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/50 dark:border-white/10 shadow-lg">
            <div className="text-6xl mb-4 opacity-50">🔍</div>
            <h3 className="text-xl font-bold text-[#4B244A] dark:text-white mb-2">No housekeepers found</h3>
            <p className="text-[#4B244A]/70 dark:text-white/70">
              {selectedCategory 
                ? `No housekeepers have packages in the selected category` 
                : 'Try a different city or check back later'}
            </p>
          </div>
        ) : selectedCategory && !filteredWorkers.some(w => w.packages.some(p => p.category_ids && p.category_ids.includes(selectedCategory as number))) ? (
          <div className="mb-4 bg-yellow-100 dark:bg-yellow-500/20 backdrop-blur-xl rounded-xl p-4 border border-yellow-200 dark:border-yellow-500/30">
            <p className="text-yellow-700 dark:text-yellow-200 text-sm font-medium">
              ⚠️ No housekeepers with packages in this category. Showing all available housekeepers below.
            </p>
          </div>
        ) : null}
        
        {!loading && filteredWorkers.length > 0 && (
          <div className="grid gap-4">
            {filteredWorkers.map((worker) => {
              const hasSelectedCategory = selectedCategory 
                ? worker.packages.some(p => p.category_ids && p.category_ids.includes(selectedCategory as number))
                : false;
              
              return (
              <div
                key={worker.worker_id}
                className={`bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border transition-all shadow-lg ${
                  hasSelectedCategory 
                    ? 'border-[#EA526F] ring-2 ring-[#EA526F]/30' 
                    : 'border-white/50 dark:border-white/10 hover:bg-white/80 dark:hover:bg-slate-900/80'
                }`}
              >
                {hasSelectedCategory && (
                  <div className="mb-3 inline-block px-3 py-1 bg-[#EA526F]/10 dark:bg-[#EA526F]/20 text-[#EA526F] dark:text-pink-300 text-xs font-bold rounded-full border border-[#EA526F]/30">
                    ✓ Has {categories.find(c => c.category_id === selectedCategory)?.name} packages
                  </div>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#EA526F] to-[#6B3468] dark:from-[#EA526F] dark:to-[#d4486a] flex items-center justify-center text-2xl text-white font-bold shadow-md">
                      {worker.first_name[0]}{worker.last_name[0]}
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-[#4B244A] dark:text-white">
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
                          <span className="text-[#4B244A]/60 dark:text-white/60 text-sm font-medium">
                            ({worker.total_ratings} {worker.total_ratings === 1 ? 'review' : 'reviews'})
                          </span>
                        ) : (
                          <span className="text-[#4B244A]/50 dark:text-white/50 text-sm italic">No reviews yet</span>
                        )}
                      </div>
                      
                      {worker.city && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[#4B244A]/70 dark:text-white/70 text-sm font-medium">
                            <MapPin className="inline w-4 h-4 mr-1" />{worker.barangay && `${worker.barangay}, `}{worker.city}
                            {worker.province && `, ${worker.province}`}
                          </p>
                          {worker.distance_km !== null && worker.distance_km !== undefined ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/30 dark:text-blue-300">
                              <MapPin className="inline w-3 h-3 mr-1" />{worker.distance_km} km away
                            </span>
                          ) : worker.proximity_label && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              worker.proximity_label === 'same_barangay'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-300'
                                : worker.proximity_label === 'same_city' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-500/30 dark:text-green-300' 
                                : worker.proximity_label === 'same_province'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-500/30 dark:text-gray-300'
                            }`}>
                              {worker.proximity_label === 'same_barangay'
                                ? <><MapPin className="inline w-3 h-3 mr-1" />Same Barangay</>
                                : worker.proximity_label === 'same_city' 
                                ? <><MapPin className="inline w-3 h-3 mr-1" />Same City</> 
                                : worker.proximity_label === 'same_province'
                                ? <><MapPin className="inline w-3 h-3 mr-1" />Same Province</>
                                : <><MapPin className="inline w-3 h-3 mr-1" />Other Location</>}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Package Summary */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {worker.packages.slice(0, 3).map((pkg) => (
                          <span
                            key={pkg.package_id}
                            className="px-3 py-1 bg-[#EA526F]/10 dark:bg-[#EA526F]/20 text-[#EA526F] dark:text-pink-300 text-sm rounded-full font-medium"
                          >
                            {pkg.name} - ₱{pkg.price.toLocaleString()}
                          </span>
                        ))}
                        {worker.packages.length > 3 && (
                          <span className="px-3 py-1 bg-gray-100 dark:bg-white/10 text-[#4B244A]/70 dark:text-white/70 text-sm rounded-full font-medium">
                            +{worker.packages.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewProfile(worker.worker_id)}
                    className="px-4 py-2 bg-[#EA526F] text-white font-bold rounded-xl hover:bg-[#d64460] transition-all whitespace-nowrap shadow-md"
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