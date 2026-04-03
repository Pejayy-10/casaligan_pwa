import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Filter, Star, ChevronDown, Navigation, X } from 'lucide-react';
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
  gender?: string | null;
  relationship_status?: string | null;
  city: string | null;
  barangay: string | null;
  province?: string | null;
  package_count: number;
  packages: WorkerPackage[];
  average_rating: number;
  total_ratings: number;
  proximity_score?: number;
  proximity_label?: string;
  distance_km?: number | null;
  is_available?: boolean;
}

const getProximityBadgeStyle = (label?: string) => {
  switch (label) {
    case 'same_barangay':
      return 'bg-emerald-100 text-emerald-700';
    case 'same_city':
      return 'bg-green-50 text-green-700';
    case 'same_province':
      return 'bg-blue-50 text-blue-700';
    case 'different_city':
      return 'bg-amber-50 text-amber-700';
    case 'different_province':
      return 'bg-orange-100 text-orange-700';
    case 'no_gps_coordinates':
    case 'no_address':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getProximityBadgeText = (label?: string) => {
  switch (label) {
    case 'same_barangay':
      return 'Neighbor';
    case 'same_city':
      return 'Same City';
    case 'same_province':
      return 'Same Province';
    case 'different_city':
      return 'Different City';
    case 'different_province':
      return 'Different Province';
    case 'no_gps_coordinates':
      return 'No GPS';
    case 'no_address':
      return 'No Address';
    default:
      return 'Location';
  }
};

export default function BrowseWorkersPage() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<WorkerProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [searchCity, setSearchCity] = useState('');
  const [searchName, setSearchName] = useState('');
  const [sexFilter, setSexFilter] = useState<string>('');
  const [relationshipFilter, setRelationshipFilter] = useState<string>('');
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

    const hasAskedBefore = localStorage.getItem('location_permission_asked');
    if (hasAskedBefore) {
      setLocationPermissionAsked(true);
      return;
    }

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
      const response = await fetch(`${API_BASE_URL}/categories/?active_only=true`);
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

  const loadWorkers = async (
    city?: string,
    rating?: number,
    sort?: string,
    name?: string,
    sex?: string,
    relationshipStatus?: string
  ) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (city) params.append('city', city);
      if (name) params.append('name', name);
      if (sex) params.append('sex', sex);
      if (relationshipStatus) params.append('relationship_status', relationshipStatus);
      if (rating) params.append('min_rating', rating.toString());
      if (sort) params.append('sort_by', sort);
      
      // Add GPS location if available and enabled
      if (useGPSLocation && gpsLocation) {
        params.append('employer_latitude', gpsLocation.latitude.toString());
        params.append('employer_longitude', gpsLocation.longitude.toString());
        if (employerLocation) {
          params.append('employer_city', employerLocation.city);
          params.append('employer_province', employerLocation.province);
          if (employerLocation.barangay) {
            params.append('employer_barangay', employerLocation.barangay);
          }
        }
      }
      else if (employerLocation && !useGPSLocation) {
        params.append('employer_city', employerLocation.city);
        params.append('employer_province', employerLocation.province);
        if (employerLocation.barangay) {
          params.append('employer_barangay', employerLocation.barangay);
        }
      }
      
      const url = `${API_BASE_URL}/direct-hire/workers${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
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
      sortBy || undefined,
      searchName.trim() || undefined,
      sexFilter || undefined,
      relationshipFilter || undefined
    );
  };

  const handleFilterChange = (
    newRating: number | '',
    newSort: string,
    newSex: string = sexFilter,
    newRelationship: string = relationshipFilter
  ) => {
    setMinRating(newRating);
    setSortBy(newSort);
    setSexFilter(newSex);
    setRelationshipFilter(newRelationship);
    loadWorkers(
      searchCity.trim() || undefined,
      newRating || undefined,
      newSort || undefined,
      searchName.trim() || undefined,
      newSex || undefined,
      newRelationship || undefined
    );
  };

  const formatRelationshipStatus = (value?: string | null): string => {
    if (!value) return 'Not specified';
    return value
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
        
        try {
          const token = localStorage.getItem('access_token');
          await fetch(
            `${API_BASE_URL}/auth/update-address-gps?latitude=${coords.latitude}&longitude=${coords.longitude}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } catch (error) {
          console.warn('Error saving GPS coordinates to address:', error);
        }
      },
      (error) => {
        let errorMessage = 'Failed to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied.';
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
    <div className="min-h-screen bg-[#F4F2F0] dark:bg-slate-950 transition-colors duration-300 pb-24 relative font-sans">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#EA526F]/10 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Unified Header */}
      <header className="relative z-10 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all safe-area-top">
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
              
              {/* Top Row: Navigation & Title */}
              <div className="flex items-center gap-3">
                  <button 
                      onClick={() => navigate(-1)} 
                      className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white transition-colors active:scale-95"
                  >
                      <ChevronDown className="w-6 h-6 rotate-90" />
                  </button>
                  <h1 className="text-xl font-bold text-[#4B244A] dark:text-white tracking-tight">Browse Housekeepers</h1>
              </div>
      
              {/* Middle Row: Location Controls */}
              <div className="bg-gray-50/80 dark:bg-slate-900/50 rounded-2xl p-2 border border-gray-100 dark:border-white/5 shadow-inner">
                  <div className="grid grid-cols-2 gap-1 mb-2">
                      <button
                          onClick={() => handleLocationModeChange(false)}
                          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                              !useGPSLocation
                              ? '!bg-[#E7467B] !text-white dark:bg-slate-700 text-[#4B244A] dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5'
                          }`}
                      >
                          <MapPin className="w-3.5 h-3.5" /> Saved Address
                      </button>
                      <button
                          onClick={() => {
                              if (!gpsLocation) requestGPSLocation();
                              else handleLocationModeChange(true);
                          }}
                          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                              useGPSLocation
                              ? '!bg-[#E7467B] !text-white dark:bg-slate-700 text-[#EA526F] dark:text-[#EA526F] shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5'
                          }`}
                      >
                          <Navigation className={`w-3.5 h-3.5 ${useGPSLocation ? 'fill-current' : ''}`} /> 
                          {gpsLoading ? 'Locating...' : 'GPS Location'}
                      </button>
                  </div>
      
                  {/* Location Text Display */}
                  <div className="flex items-center justify-between px-2 pb-0.5">
                          <div className="flex-1 min-w-0 mr-3">
                          {useGPSLocation && gpsLocation ? (
                              <p className="text-xs font-bold text-[#4B244A] dark:text-white truncate flex items-center gap-1.5 animate-in fade-in">
                                  <Navigation className="w-3 h-3 text-[#EA526F]" /> 
                                  <span className="truncate">Current GPS Position</span>
                              </p>
                          ) : employerLocation ? (
                              <p className="text-xs font-bold text-[#4B244A] dark:text-white truncate flex items-center gap-1.5 animate-in fade-in">
                                  <MapPin className="w-3 h-3 text-[#EA526F]" /> 
                                  <span className="truncate">
                                      {employerLocation.barangay && `${employerLocation.barangay}, `}{employerLocation.city}
                                  </span>
                              </p>
                          ) : (
                              <p className="text-xs text-gray-500 italic">No location set</p>
                          )}
                      </div>
                      
                      {!useGPSLocation && (
                          <button
                              onClick={() => setShowLocationEditor(!showLocationEditor)}
                              className="text-[10px] font-bold text-[#EA526F] bg-[#EA526F]/5 hover:bg-[#EA526F]/10 px-2.5 py-1 rounded-lg transition-colors uppercase tracking-wide border border-[#EA526F]/20"
                          >
                              {showLocationEditor ? 'Close' : 'Change'}
                          </button>
                      )}
                  </div>
      
                  {/* Manual Location Editor Dropdowns */}
                  {showLocationEditor && !useGPSLocation && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-white/10 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-200">
                              <select 
                              value={selectedRegion} 
                              onChange={(e) => handleRegionChange(e.target.value)}
                              className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] outline-none transition-all"
                          >
                              <option value="">Region</option>
                              {regions.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                          </select>
                          <select 
                              value={selectedProvince} 
                              onChange={(e) => handleProvinceChange(e.target.value)}
                              disabled={!selectedRegion}
                              className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] outline-none disabled:opacity-50 transition-all"
                          >
                                  <option value="">Province</option>
                                  {provinces.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                          </select>
                          <select 
                              value={selectedCity} 
                              onChange={(e) => handleCityChange(e.target.value)}
                              disabled={!selectedProvince}
                              className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] outline-none disabled:opacity-50 transition-all"
                          >
                                  <option value="">City</option>
                                  {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                          </select>
                              <select 
                              value={selectedBarangay} 
                              onChange={(e) => setSelectedBarangay(e.target.value)}
                              disabled={!selectedCity}
                              className="w-full p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] outline-none disabled:opacity-50 transition-all"
                          >
                                  <option value="">Barangay</option>
                                  {barangays.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                          </select>
                          <button 
                              onClick={handleSaveLocation}
                              disabled={!selectedCity}
                              className="col-span-2 py-2 bg-[#4B244A] text-white text-xs font-bold rounded-xl hover:bg-[#381b37] transition-all disabled:opacity-50 shadow-sm"
                          >
                              Update Location
                          </button>
                      </div>
                  )}
                  
                  {gpsError && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-500/20 flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5 flex-shrink-0" /> {gpsError}
                      </div>
                  )}
              </div>
      
              {/* Bottom Row: Search & Filters */}
              <div className="space-y-3 pt-1">
                  {/* Search Input - Uniform Height */}
                  <div className="flex gap-2">
                      <div className="relative group flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#EA526F] transition-colors" />
                          </div>
                          <input
                              type="text"
                              value={searchName}
                              onChange={(e) => setSearchName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                              className="block w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] transition-all"
                              placeholder="Search by name..."
                          />
                      </div>
                      <div className="relative group flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <MapPin className="h-4 w-4 text-gray-400 group-focus-within:text-[#EA526F] transition-colors" />
                          </div>
                          <input
                              type="text"
                              value={searchCity}
                              onChange={(e) => setSearchCity(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                              className="block w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EA526F]/20 focus:border-[#EA526F] transition-all"
                              placeholder="Search city or area..."
                          />
                      </div>
                  </div>
      
                  {/* Scrollable Filters - Customized Dropdown Look */}
                  <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                      {/* Category Dropdown */}
                      <div className="relative flex-shrink-0 group">
                          <select
                              value={selectedCategory}
                              onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : '')}
                              className="cursor-pointer appearance-none pl-3.5 pr-9 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-[#4B244A] dark:text-white shadow-sm hover:border-[#EA526F]/50 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20 outline-none transition-all"
                          >
                              <option value="">All Categories</option>
                              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.name}</option>)}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-hover:text-[#EA526F] transition-colors pointer-events-none" />
                      </div>
      
                      {/* Rating Filter */}
                      <div className="relative flex-shrink-0 group">
                          <select
                              value={minRating}
                              onChange={(e) => handleFilterChange(e.target.value ? Number(e.target.value) : '', sortBy)}
                              className="cursor-pointer appearance-none pl-3.5 pr-9 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-[#4B244A] dark:text-white shadow-sm hover:border-[#EA526F]/50 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20 outline-none transition-all"
                          >
                              <option value="">Rating: Any</option>
                              <option value="4">4+ Stars</option>
                              <option value="3">3+ Stars</option>
                              <option value="2">2+ Stars</option>
                          </select>
                          <Star className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-hover:text-yellow-400 transition-colors pointer-events-none fill-current" />
                      </div>
      
                          {/* Sort Filter */}
                      <div className="relative flex-shrink-0 group">
                          <select
                              value={sortBy}
                              onChange={(e) => handleFilterChange(minRating, e.target.value)}
                              className="cursor-pointer appearance-none pl-3.5 pr-9 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-[#4B244A] dark:text-white shadow-sm hover:border-[#EA526F]/50 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20 outline-none transition-all"
                          >
                              <option value="">Sort: Default</option>
                              <option value="rating">Highest Rated</option>
                              <option value="jobs_completed">Most Jobs</option>
                          </select>
                          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-hover:text-[#EA526F] transition-colors pointer-events-none" />
                      </div>

                          {/* Sex Filter */}
                          <div className="relative flex-shrink-0 group">
                            <select
                              value={sexFilter}
                              onChange={(e) => handleFilterChange(minRating, sortBy, e.target.value, relationshipFilter)}
                              className="cursor-pointer appearance-none pl-3.5 pr-9 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-[#4B244A] dark:text-white shadow-sm hover:border-[#EA526F]/50 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20 outline-none transition-all"
                            >
                              <option value="">Sex: Any</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                              <option value="prefer_not_to_say">Prefer not to say</option>
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-hover:text-[#EA526F] transition-colors pointer-events-none" />
                          </div>

                          {/* Relationship Status Filter */}
                          <div className="relative flex-shrink-0 group">
                            <select
                              value={relationshipFilter}
                              onChange={(e) => handleFilterChange(minRating, sortBy, sexFilter, e.target.value)}
                              className="cursor-pointer appearance-none pl-3.5 pr-9 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm font-semibold text-[#4B244A] dark:text-white shadow-sm hover:border-[#EA526F]/50 focus:border-[#EA526F] focus:ring-2 focus:ring-[#EA526F]/20 outline-none transition-all"
                            >
                              <option value="">Relationship: Any</option>
                              <option value="single">Single</option>
                              <option value="married">Married</option>
                              <option value="in_a_relationship">In a relationship</option>
                              <option value="widowed">Widowed</option>
                              <option value="separated">Separated</option>
                              <option value="prefer_not_to_say">Prefer not to say</option>
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-hover:text-[#EA526F] transition-colors pointer-events-none" />
                          </div>
                  </div>
              </div>
          </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 space-y-6">
        
        {/* 3. Workers List (Filtered) */}
        {loading ? (
           <div className="flex flex-col items-center justify-center py-20">
             <div className="w-12 h-12 border-4 border-[#EA526F]/30 border-t-[#EA526F] rounded-full animate-spin"></div>
             <p className="mt-4 text-gray-500 font-medium">Finding housekeepers...</p>
           </div>
        ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-20 px-6 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-[#4B244A] dark:text-white">No housekeepers found</h3>
                <p className="text-gray-500 mt-2 text-sm">
                    {selectedCategory 
                    ? "Try removing the category filter or changing your location." 
                    : "There are no housekeepers in this area yet."}
                </p>
                <button 
                  onClick={() => {
                    setSelectedCategory('');
                    setSearchCity('');
                    setSearchName('');
                    setSexFilter('');
                    setRelationshipFilter('');
                    setMinRating('');
                    setSortBy('');
                    loadWorkers();
                  }}
                    className="mt-4 text-[#EA526F] font-bold text-sm hover:underline"
                >
                    Clear all filters
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredWorkers.map((worker) => {
                     const hasSelectedCategory = selectedCategory 
                         ? worker.packages.some(p => p.category_ids && p.category_ids.includes(selectedCategory as number))
                         : false;

                     return (
                        <div 
                            key={worker.worker_id}
                            className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                                hasSelectedCategory 
                                ? 'border-[#EA526F] ring-1 ring-[#EA526F]/20' 
                                : 'border-gray-200 dark:border-white/5 hover:border-[#EA526F]/30'
                            }`}
                        >
                            {/* Proximity Badge (Absolute Top Right) */}
                            <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                {worker.distance_km !== null && worker.distance_km !== undefined ? (
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 flex items-center gap-1">
                                        <Navigation className="w-3 h-3 fill-current" /> {worker.distance_km} km
                                    </span>
                                ) : worker.proximity_label && (
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                    getProximityBadgeStyle(worker.proximity_label)
                                    }`}>
                                        <MapPin className="w-3 h-3" />
                                    {getProximityBadgeText(worker.proximity_label)}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-start gap-4">
                                {/* Avatar */}
                                <div className="relative">
                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#EA526F] to-[#4B244A] flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-md group-hover:shadow-lg transition-all">
                                        {worker.first_name[0]}{worker.last_name[0]}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-1 shadow-sm">
                                        <div className="w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 bg-green-500"></div>
                                    </div>
                                </div>

                                {/* Main Info */}
                                <div className="flex-1 min-w-0 pr-16">
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                          {worker.first_name} {worker.last_name}
                                      </h3>
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{worker.average_rating.toFixed(1)}</span>
                                        <span className="text-xs text-gray-500">({worker.total_ratings} reviews)</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                        {worker.barangay && `${worker.barangay}, `}{worker.city}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                                        Sex: {worker.gender ? worker.gender.replace(/_/g, ' ') : 'Not specified'}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                                        Relationship: {formatRelationshipStatus(worker.relationship_status)}
                                      </span>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-gray-100 dark:bg-white/5 my-4"></div>

                            {/* Packages */}
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Starting Packages</p>
                                <div className="flex flex-wrap gap-2">
                                    {worker.packages.slice(0, 3).map((pkg) => (
                                        <div key={pkg.package_id} className="px-3 py-1.5 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg flex items-center gap-2 group-hover:border-[#EA526F]/20 transition-colors">
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{pkg.name}</span>
                                            <span className="text-xs font-bold text-[#EA526F]">₱{pkg.price}</span>
                                        </div>
                                    ))}
                                    {worker.packages.length > 3 && (
                                        <span className="px-2 py-1.5 text-xs font-medium text-gray-400">
                                            +{worker.packages.length - 3} more
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={() => handleViewProfile(worker.worker_id)}
                                className="mt-4 w-full py-2.5 !bg-[#4B244A] hover:bg-[#381b37] !text-white text-sm font-bold rounded-xl transition-all shadow-md group-hover:shadow-lg flex items-center justify-center gap-2"
                            >
                                View Profile
                            </button>
                        </div>
                     );
                })}
            </div>
        )}
      </main>

      <TabBar role="owner" />

       {/* Permission Modal */}
       {showLocationPrompt && !locationPermissionAsked && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                    <Navigation className="w-6 h-6 text-blue-600 dark:text-blue-400 fill-current" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Use your location?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                    We can show you housekeepers closest to you by accessing your GPS location.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={handleLocationPromptDismiss}
                        className="flex-1 py-3 text-gray-600 dark:text-gray-300 font-bold text-sm bg-gray-100 dark:bg-white/5 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Not Now
                    </button>
                    <button 
                        onClick={handleLocationPromptAccept}
                        className="flex-1 py-3 text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all"
                    >
                        Allow Access
                    </button>
                </div>
            </div>
         </div>
       )}
    </div>
  );
}