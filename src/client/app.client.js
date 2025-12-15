/**
 * Direct HTTP calls to server app management endpoints
 */

import axios from 'axios';

// Use environment variable with fallback
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// Create shared axios instance with token refresh capability
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 30000
});

// Add token refresh interceptor
api.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                // Attempt to refresh token
                await axios.post(`${API_BASE_URL}/auth/refresh-token`, {}, {
                    withCredentials: true,
                    timeout: 10000
                });
                
                // Retry original request
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed, dispatch auth failure
                window.dispatchEvent(new CustomEvent('authFailure'));
                throw refreshError;
            }
        }
        
        throw error;
    }
);

// Export the shared API instance for use by other services
export { api as sharedAPI };

export const appService = {
    async submitContactForm(data) {
        return api.post('/contact', data);
    },

    async getHealth() {
        return await api.get('/health');
    },

    async getStats() {
        return await api.get('/stats/performance');
    },

    async getPerformanceStats() {
        return await api.get('/stats/performance');
    },

    async getOverviewStats() {
        return await api.get('/stats/overview');
    },

    async getLogs(params = {}) {
        return await api.get('/logs', { params });
    },

    async getLogStats(params = {}) {
        return await api.get('/logs/stats', { params });
    },

    async sendTestEmail(emailData) {
        return await api.post('/email/test', emailData);
    }
};

export default appService;
