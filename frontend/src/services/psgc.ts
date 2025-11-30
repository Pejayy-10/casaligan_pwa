import axios from 'axios';
import type { PSGCRegion, PSGCProvince, PSGCCity, PSGCBarangay } from '../types';

const PSGC_API_BASE = 'https://psgc.cloud/api';

export const psgcService = {
  async getRegions(): Promise<PSGCRegion[]> {
    try {
      const response = await axios.get(`${PSGC_API_BASE}/regions/`);
      return response.data.map((item: { code: string; name: string }) => ({
        code: item.code,
        name: item.name,
      }));
    } catch {
      // Fallback to basic Philippine regions
      return [
        { code: '130000000', name: 'National Capital Region (NCR)' },
        { code: '010000000', name: 'Region I (Ilocos Region)' },
        { code: '020000000', name: 'Region II (Cagayan Valley)' },
        { code: '030000000', name: 'Region III (Central Luzon)' },
        { code: '040000000', name: 'Region IV-A (CALABARZON)' },
        { code: '170000000', name: 'Region IV-B (MIMAROPA)' },
        { code: '050000000', name: 'Region V (Bicol Region)' },
        { code: '060000000', name: 'Region VI (Western Visayas)' },
        { code: '070000000', name: 'Region VII (Central Visayas)' },
        { code: '080000000', name: 'Region VIII (Eastern Visayas)' },
        { code: '090000000', name: 'Region IX (Zamboanga Peninsula)' },
        { code: '100000000', name: 'Region X (Northern Mindanao)' },
        { code: '110000000', name: 'Region XI (Davao Region)' },
        { code: '120000000', name: 'Region XII (SOCCSKSARGEN)' },
        { code: '160000000', name: 'Region XIII (Caraga)' },
        { code: '140000000', name: 'Autonomous Region in Muslim Mindanao (ARMM)' },
        { code: '150000000', name: 'Cordillera Administrative Region (CAR)' },
      ];
    }
  },

  async getProvinces(regionCode: string): Promise<PSGCProvince[]> {
    const response = await axios.get(`${PSGC_API_BASE}/regions/${regionCode}/provinces/`);
    return response.data.map((item: { code: string; name: string; regionCode: string }) => ({
      code: item.code,
      name: item.name,
      regionCode: item.regionCode,
    }));
  },

  async getCities(provinceCode: string): Promise<PSGCCity[]> {
    const response = await axios.get(`${PSGC_API_BASE}/provinces/${provinceCode}/cities-municipalities/`);
    return response.data.map((item: { code: string; name: string; provinceCode: string }) => ({
      code: item.code,
      name: item.name,
      provinceCode: item.provinceCode,
    }));
  },

  async getBarangays(cityCode: string): Promise<PSGCBarangay[]> {
    const response = await axios.get(`${PSGC_API_BASE}/cities-municipalities/${cityCode}/barangays/`);
    return response.data.map((item: { code: string; name: string; cityCode?: string; municipalityCode?: string }) => ({
      code: item.code,
      name: item.name,
      cityCode: item.cityCode || item.municipalityCode || '',
    }));
  },
};
