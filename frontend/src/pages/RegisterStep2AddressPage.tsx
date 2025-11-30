import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { psgcService } from '../services/psgc';
import type { AddressData, PSGCRegion, PSGCProvince, PSGCCity, PSGCBarangay } from '../types';

export default function RegisterStep2AddressPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<AddressData>({
    region_code: '',
    region_name: '',
    province_code: '',
    province_name: '',
    city_code: '',
    city_name: '',
    barangay_code: '',
    barangay_name: '',
    street_address: '',
    subdivision: '',
    zip_code: '',
  });

  const [regions, setRegions] = useState<PSGCRegion[]>([]);
  const [provinces, setProvinces] = useState<PSGCProvince[]>([]);
  const [cities, setCities] = useState<PSGCCity[]>([]);
  const [barangays, setBarangays] = useState<PSGCBarangay[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      const data = await psgcService.getRegions();
      setRegions(data);
    } catch (err) {
      console.error('Failed to load regions', err);
      setError('Failed to load regions');
    }
  };

  const handleRegionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regionCode = e.target.value;
    const region = regions.find(r => r.code === regionCode);
    
    setFormData({
      ...formData,
      region_code: regionCode,
      region_name: region?.name || '',
      province_code: '',
      province_name: '',
      city_code: '',
      city_name: '',
      barangay_code: '',
      barangay_name: '',
    });

    setProvinces([]);
    setCities([]);
    setBarangays([]);

    if (regionCode) {
      try {
        const data = await psgcService.getProvinces(regionCode);
        setProvinces(data);
      } catch (err) {
        console.error('Failed to load provinces', err);
        setError('Failed to load provinces');
      }
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceCode = e.target.value;
    const province = provinces.find(p => p.code === provinceCode);
    
    setFormData({
      ...formData,
      province_code: provinceCode,
      province_name: province?.name || '',
      city_code: '',
      city_name: '',
      barangay_code: '',
      barangay_name: '',
    });

    setCities([]);
    setBarangays([]);

    if (provinceCode) {
      try {
        const data = await psgcService.getCities(provinceCode);
        setCities(data);
      } catch (err) {
        console.error('Failed to load cities', err);
        setError('Failed to load cities');
      }
    }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cityCode = e.target.value;
    const city = cities.find(c => c.code === cityCode);
    
    setFormData({
      ...formData,
      city_code: cityCode,
      city_name: city?.name || '',
      barangay_code: '',
      barangay_name: '',
    });

    setBarangays([]);

    if (cityCode) {
      try {
        const data = await psgcService.getBarangays(cityCode);
        setBarangays(data);
      } catch (err) {
        console.error('Failed to load barangays', err);
        setError('Failed to load barangays');
      }
    }
  };

  const handleBarangayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const barangayCode = e.target.value;
    const barangay = barangays.find(b => b.code === barangayCode);
    
    setFormData({
      ...formData,
      barangay_code: barangayCode,
      barangay_name: barangay?.name || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.addAddress(formData);
      navigate('/register/documents');
    } catch (err: unknown) {
      const errorDetail =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      setError(typeof errorDetail === 'string' ? errorDetail : 'Failed to save address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4B244A] via-[#6B3468] to-[#4B244A] flex items-center justify-center p-4">
      {/* Decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#EA526F] rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-6000"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Glass morphism card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white">Address Information</h1>
              <div className="text-sm text-white/80">Step 2 of 3</div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 h-2 bg-[#EA526F] rounded-full"></div>
              <div className="flex-1 h-2 bg-[#EA526F] rounded-full"></div>
              <div className="flex-1 h-2 bg-white/30 rounded-full"></div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl text-white text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="region" className="block text-sm font-medium text-white/90 mb-2">
                Region *
              </label>
              <select
                id="region"
                value={formData.region_code}
                onChange={handleRegionChange}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all"
                required
                disabled={loading}
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
              <label htmlFor="province" className="block text-sm font-medium text-white/90 mb-2">
                Province *
              </label>
              <select
                id="province"
                value={formData.province_code}
                onChange={handleProvinceChange}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all disabled:opacity-50"
                required
                disabled={!formData.region_code || loading}
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
              <label htmlFor="city" className="block text-sm font-medium text-white/90 mb-2">
                City/Municipality *
              </label>
              <select
                id="city"
                value={formData.city_code}
                onChange={handleCityChange}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all disabled:opacity-50"
                required
                disabled={!formData.province_code || loading}
              >
                <option value="" className="text-gray-900">Select City/Municipality</option>
                {cities.map((city) => (
                  <option key={city.code} value={city.code} className="text-gray-900">
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="barangay" className="block text-sm font-medium text-white/90 mb-2">
                Barangay *
              </label>
              <select
                id="barangay"
                value={formData.barangay_code}
                onChange={handleBarangayChange}
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all disabled:opacity-50"
                required
                disabled={!formData.city_code || loading}
              >
                <option value="" className="text-gray-900">Select Barangay</option>
                {barangays.map((barangay) => (
                  <option key={barangay.code} value={barangay.code} className="text-gray-900">
                    {barangay.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="street_address" className="block text-sm font-medium text-white/90 mb-2">
                Street Address
              </label>
              <input
                type="text"
                id="street_address"
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                placeholder="House/Unit No., Street Name"
                className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all"
                disabled={loading}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="subdivision" className="block text-sm font-medium text-white/90 mb-2">
                  Subdivision/Village
                </label>
                <input
                  type="text"
                  id="subdivision"
                  value={formData.subdivision}
                  onChange={(e) => setFormData({ ...formData, subdivision: e.target.value })}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="zip_code" className="block text-sm font-medium text-white/90 mb-2">
                  Zip Code
                </label>
                <input
                  type="text"
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:ring-2 focus:ring-[#EA526F] focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#EA526F] text-white font-semibold rounded-xl hover:bg-[#d4486a] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#EA526F]/30"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </div>
              ) : (
                'Continue to Documents'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
