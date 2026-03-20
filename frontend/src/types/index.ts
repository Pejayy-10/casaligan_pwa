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
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birthday?: string;
  profile_picture?: string;
  is_owner: boolean;
  is_housekeeper: boolean;
  active_role: 'owner' | 'housekeeper';
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  bio?: string | null;
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
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birthday?: string;
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

// Multi-day scheduling types
export interface MultiDaySchedule {
  num_days: number;
  daily_start_time: string;
  daily_end_time: string;
}

export interface DaySchedule {
  day_schedule_id: number;
  post_id?: number;
  hire_id?: number;
  worker_id: number;
  work_date: string;
  start_time: string;
  end_time: string;
  day_number: number;
  status: 'pending' | 'in_progress' | 'pending_completion' | 'completed' | 'skipped';
  owner_confirmed: boolean;
  housekeeper_confirmed: boolean;
  completions: DailyCompletionRecord[];
}

export interface DailyCompletionRecord {
  completion_id: number;
  confirmed_by: number;
  role: 'owner' | 'housekeeper';
  proof_url?: string;
  notes?: string;
  confirmed_at?: string;
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
