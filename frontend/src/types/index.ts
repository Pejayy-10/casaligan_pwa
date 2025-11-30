export interface UserDocument {
  id: number;
  document_type: string;
  file_path: string;
  notes?: string;
}

export interface User {
  id: number;
  email: string;
  phone_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  is_owner: boolean;
  is_housekeeper: boolean;
  active_role: 'owner' | 'housekeeper';
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
  address?: Address;
  documents?: UserDocument[];
}

export interface Address {
  id: number;
  user_id: number;
  region_code?: string;
  region_name: string;
  province_code?: string;
  province_name: string;
  city_code?: string;
  city_name: string;
  barangay_code?: string;
  barangay_name: string;
  street_address?: string;
  subdivision?: string;
  zip_code?: string;
}

export interface UserProfile extends User {
  address?: Address;
}

export interface RegisterData {
  email: string;
  password: string;
  phone_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AddressData {
  region_code?: string;
  region_name: string;
  province_code?: string;
  province_name: string;
  city_code?: string;
  city_name: string;
  barangay_code?: string;
  barangay_name: string;
  street_address?: string;
  subdivision?: string;
  zip_code?: string;
}

export interface DocumentData {
  document_type: string;
  file_path: string;
  notes?: string;
}

// PSGC Types
export interface PSGCRegion {
  code: string;
  name: string;
}

export interface PSGCProvince {
  code: string;
  name: string;
  regionCode: string;
}

export interface PSGCCity {
  code: string;
  name: string;
  provinceCode: string;
}

export interface PSGCBarangay {
  code: string;
  name: string;
  cityCode: string;
}
