import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
} as const;

export const apiClient: AxiosInstance = axios.create(API_CONFIG);

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  },
);

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: any) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  },
);

// Helper types for API responses
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  error?: string;
  statusCode: number;
}

// Helper function to handle API calls with proper error handling
export const apiCall = async <T>(request: () => Promise<AxiosResponse<T>>): Promise<T> => {
  try {
    const response = await request();
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw error.response.data as ApiError;
    }
    throw {
      message: error.message || 'An unexpected error occurred',
      statusCode: error.response?.status || 500,
    } as ApiError;
  }
};

export default apiClient;
