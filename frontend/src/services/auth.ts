import apiClient from './api';
import type { 
  RegisterData, 
  LoginData, 
  TokenResponse, 
  User, 
  UserProfile,
  AddressData,
  Address
} from '../types';

export const authService = {
  async register(data: RegisterData): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/auth/register', data);
    const { access_token, user } = response.data;
    
    // Store token and user in localStorage (auto-login after registration)
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  async login(data: LoginData): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/auth/login', data);
    const { access_token, user } = response.data;
    
    // Store token and user in localStorage
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  async getCurrentUser(): Promise<UserProfile> {
    const response = await apiClient.get<UserProfile>('/auth/me');
    
    // Update user in localStorage to keep it fresh
    const userData = response.data;
    localStorage.setItem('user', JSON.stringify(userData));
    
    return userData;
  },

  async checkRestrictionStatus(): Promise<void> {
    try {
      // Try to get current user - this will trigger 403 if restricted
      await this.getCurrentUser();
    } catch (error: any) {
      // Error is already handled by the API interceptor
      // which shows popup and logs out the user
      throw error;
    }
  },

  async addAddress(data: AddressData): Promise<Address> {
    const response = await apiClient.post<Address>('/auth/register/address', data);
    return response.data;
  },

  async uploadDocument(data: { document_type: string; file_path: string; notes?: string }) {
    const response = await apiClient.post('/auth/register/documents', data);
    return response.data;
  },

  async switchRole(): Promise<{ active_role: string }> {
    const response = await apiClient.post<{ active_role: string }>('/auth/switch-role');
    
    // Update user in localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      user.active_role = response.data.active_role;
      localStorage.setItem('user', JSON.stringify(user));
    }
    
    return response.data;
  },

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },

  getCurrentUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  async applyHousekeeper(data: {
    bio?: string;
    years_experience?: number;
    skills?: string[];
    availability?: string;
    nbi_document_id?: number;
    secondary_document_id?: number;
    notes?: string;
  }): Promise<{ id: number; status: string; is_housekeeper: boolean }> {
    const response = await apiClient.post('/auth/apply-housekeeper', data);
    // If approved, update localStorage
    if (response.data.is_housekeeper) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.is_housekeeper = true;
        localStorage.setItem('user', JSON.stringify(user));
      }
    }
    return response.data;
  },

  async sendPhoneOTP(): Promise<{ message: string; dev_otp?: string }> {
    const response = await apiClient.post('/auth/send-phone-otp');
    return response.data;
  },

  async verifyPhoneOTP(otp: string): Promise<{ message: string; phone_verified: boolean }> {
    const response = await apiClient.post('/auth/verify-phone-otp', { otp });
    // Update localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      user.phone_verified = true;
      localStorage.setItem('user', JSON.stringify(user));
    }
    return response.data;
  },

  async getApplicationStatus(): Promise<{
    id: number;
    status: string;
    notes?: string;
    submitted_at: string;
    reviewed_at?: string;
    admin_notes?: string;
  } | null> {
    const response = await apiClient.get('/auth/application-status');
    return response.data;
  },

  async updateProfile(data: { first_name?: string; middle_name?: string; last_name?: string; suffix?: string; profile_picture?: string }): Promise<UserProfile> {
    const response = await apiClient.put<UserProfile>('/auth/profile', data);
    const updatedUser = response.data;
    localStorage.setItem('user', JSON.stringify(updatedUser));
    return updatedUser;
  },

  async uploadProfilePicture(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<{ url: string }>('/upload/image?category=profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.url;
  },
};
