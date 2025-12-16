/**
 * Direct HTTP calls to server app management endpoints
 */

import axios from 'axios';

// Use environment variable with fallback
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// CSRF cookie name (must match server's CSRF_COOKIE_NAME)
const CSRF_COOKIE_NAME = 'csrfToken';

/**
 * Get CSRF token from cookie
 * The server sets this cookie with httpOnly: false so JS can read it
 */
const getCsrfTokenFromCookie = () => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === CSRF_COOKIE_NAME) {
            return decodeURIComponent(value);
        }
    }
    return null;
};

/**
 * Fetch a fresh CSRF token from the server
 * This will set the cookie which we can then read
 */
const fetchCsrfToken = async () => {
    try {
        await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
            withCredentials: true,
            timeout: 10000
        });
        // The server sets the cookie, we read it from there
        return getCsrfTokenFromCookie();
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error.message);
        return null;
    }
};

// Initialize CSRF token on module load
fetchCsrfToken();

// Create shared axios instance with token refresh capability
const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 30000
});

// Add request interceptor to include CSRF token
api.interceptors.request.use(
    async (config) => {
        // Include CSRF token for state-changing requests
        const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        if (stateChangingMethods.includes(config.method?.toUpperCase())) {
            // First try to get token from cookie
            let token = getCsrfTokenFromCookie();
            
            // If no cookie token, fetch a new one
            if (!token) {
                token = await fetchCsrfToken();
            }
            
            if (token) {
                config.headers['X-CSRF-Token'] = token;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add token refresh interceptor
api.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const originalRequest = error.config;
        
        // Handle CSRF token errors - refresh token and retry
        if (error.response?.status === 403 && 
            error.response?.data?.message?.includes('CSRF') && 
            !originalRequest._csrfRetry) {
            originalRequest._csrfRetry = true;
            await fetchCsrfToken();
            const token = getCsrfTokenFromCookie();
            if (token) {
                originalRequest.headers['X-CSRF-Token'] = token;
            }
            return api(originalRequest);
        }
        
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

// Export function to manually refresh CSRF token (useful after login)
export const refreshCsrfToken = fetchCsrfToken;

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
