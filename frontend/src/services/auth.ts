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
    return response.data;
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

  async applyHousekeeper(notes?: string): Promise<{ message: string }> {
    const body = notes ? { notes } : {};
    const response = await apiClient.post<{ message: string }>('/auth/apply-housekeeper', body);
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
};
