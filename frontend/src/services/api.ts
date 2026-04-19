import axios from 'axios';
import { API_BASE_URL } from '../config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '');
    const isAuthEndpoint = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].some((path) => requestUrl.includes(path));

    // Check if user is restricted (403 error with restriction header or detail)
    if (error.response?.status === 403) {
      const accountStatus = error.response.headers['x-account-status'];
      const errorDetail = error.response.data?.detail || '';
      
      // Check if this is a restriction error
      if (accountStatus === 'restricted' || errorDetail.includes('restricted') || errorDetail.includes('Restriction')) {
        // Extract the message from the error
        let message = 'Your account has been restricted. Please contact support for assistance.';
        
        // Try to extract a more specific message from the error detail
        if (errorDetail) {
          message = errorDetail;
        }
        
        // Dispatch custom event for restriction
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('account-restricted', { 
            detail: { message } 
          }));
          
          // Clear token and user data immediately
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
        }
        
        return Promise.reject(error);
      }
    }
    
    if (error.response?.status === 401) {
      // For expected auth failures (like invalid login), let the caller handle the error.
      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      // Unauthorized - clear token and redirect to login for protected routes.
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
