/**
 * Direct HTTP calls to server app management endpoints
 */

import axios from 'axios';

// Use environment variable with fallback
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// CSRF cookie name (must match server's CSRF_COOKIE_NAME)
const CSRF_COOKIE_NAME = 'csrfToken';

// In-memory CSRF token cache for cross-origin scenarios
// When web app and API are on different domains, JavaScript cannot read cross-domain cookies
// even with httpOnly: false. We cache the token from the response body as a fallback.
let csrfTokenCache = null;

/**
 * Get CSRF token from cookie
 * The server sets this cookie with httpOnly: false so JS can read it
 * Falls back to cached token for cross-origin scenarios
 */
const getCsrfTokenFromCookie = () => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === CSRF_COOKIE_NAME) {
            return decodeURIComponent(value);
        }
    }
    // Fallback to cached token (for cross-origin setups)
    return csrfTokenCache;
};

/**
 * Fetch a fresh CSRF token from the server
 * This will set the cookie which we can then read
 * For cross-origin setups, also caches the token from response body
 */
const fetchCsrfToken = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
            withCredentials: true,
            timeout: 10000
        });
        
        // Try to read from cookie first (same-origin scenario)
        const cookieToken = getCsrfTokenFromCookie();
        if (cookieToken && cookieToken !== csrfTokenCache) {
            csrfTokenCache = cookieToken;
            return cookieToken;
        }

        // Fallback to response body token (cross-origin scenario)
        // Server returns { success: true, message: "...", csrfToken: "..." }
        const responseToken = response?.data?.csrfToken || null;
        if (responseToken) {
            csrfTokenCache = responseToken;
            return responseToken;
        }

        return cookieToken || csrfTokenCache;
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error.message);
        return csrfTokenCache; // Return cached token if fetch fails
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

// Deduplicate concurrent token refresh attempts.
// If multiple requests get a 401 at the same time only one /refresh-token
// call is made; all others wait for that same promise to resolve.
let _refreshPromise = null;

const attemptTokenRefresh = () => {
    if (!_refreshPromise) {
        _refreshPromise = axios
            .post(`${API_BASE_URL}/auth/refresh-token`, {}, {
                withCredentials: true,
                timeout: 10000
            })
            .finally(() => { _refreshPromise = null; });
    }
    return _refreshPromise;
};

const SESSION_ENDED = 'Your session has ended. Please sign in again.';
const SIGN_IN_FIRST = 'Please sign in to continue.';
const NOT_ALLOWED = 'Your account is not allowed to do that.';
const OUR_SIDE = 'Something went wrong on our side. Please try again.';
const TOO_SLOW = 'That took too long. Please try again.';
const TOO_MANY = 'Too many requests. Wait a moment and try again.';

const PLAIN_MESSAGES = {
    'Invalid or expired token': SESSION_ENDED,
    'Token has been revoked': SESSION_ENDED,
    'Password changed. Please log in again.': 'Your password was changed. Please sign in again.',
    'Unauthorized: Authentication required': SIGN_IN_FIRST,
    'Forbidden: Authentication required': SIGN_IN_FIRST,
    'Forbidden: Insufficient permissions': NOT_ALLOWED,
    'User not found': 'We could not find that account.',
    'Account is deactivated': 'This account has been turned off. Contact an administrator.',
    'Something went very wrong!': OUR_SIDE,
    'Server error during authentication': OUR_SIDE,
    'Server error during permission check': OUR_SIDE,
    'Request body is missing or malformed.': 'Some details were missing. Check the form and try again.',
    'Too many requests from this IP, please try again later': TOO_MANY,
    'Too many auth attempts from this IP, please try again later': 'Too many sign-in attempts. Wait a minute and try again.',
    'Request timeout - the server took too long to respond': TOO_SLOW
};

const STATUS_MESSAGES = {
    400: 'Something in that request was not right. Check it and try again.',
    401: SIGN_IN_FIRST,
    403: NOT_ALLOWED,
    404: 'We could not find that.',
    408: TOO_SLOW,
    409: 'That conflicts with something that already exists.',
    413: 'That is too large to send.',
    429: TOO_MANY
};

// Every failed request passes through here, so the UI only ever shows plain words, never a status code.
export const explainError = (error) => {
    if (!error?.isAxiosError || error.code === 'ERR_CANCELED') return error;
    const data = error.response?.data;
    const status = error.response?.status;
    const said = typeof data?.message === 'string' ? data.message.trim() : '';
    let message;
    if (!error.response) {
        message = error.code === 'ECONNABORTED' ? TOO_SLOW : 'We could not reach the server. Check your connection and try again.';
    } else if (said.startsWith('CSRF token')) {
        message = 'This page is out of date. Refresh it and try again.';
    } else {
        message = PLAIN_MESSAGES[said] || said || STATUS_MESSAGES[status] || (status >= 500 ? OUR_SIDE : 'That did not work. Please try again.');
    }
    error.message = message;
    if (data && typeof data === 'object' && !(data instanceof Blob) && !(data instanceof ArrayBuffer)) data.message = message;
    return error;
};

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

        // A refused sign-in is the answer itself, not an expired session to renew.
        const signingIn = /[/]auth[/](login|signup|refresh-token)/.test(originalRequest?.url || '');
        if (error.response?.status === 401 && !originalRequest._retry && !signingIn) {
            // Don't attempt token refresh for auth endpoints (login, signup, etc.)
            const url = originalRequest.url || '';
            const isAuthEndpoint = url.includes('/auth/login') ||
                url.includes('/auth/signup') ||
                url.includes('/auth/refresh-token');

            if (isAuthEndpoint) {
                throw error;
            }

            originalRequest._retry = true;

            try {
                // All concurrent 401s share one refresh call instead of each
                // firing independently, which would trigger reuse-detection on
                // the second call and wipe the cookies.
                await attemptTokenRefresh();

                // Retry original request
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed - clear any stale UI state
                window.dispatchEvent(new CustomEvent('authFailure'));
                throw explainError(refreshError);
            }
        }

        if (error.response?.data?.message) {
            error.message = error.response.data.message;
        }
        throw explainError(error);
    }
);

// Export function to manually refresh CSRF token (useful after login)
export const refreshCsrfToken = fetchCsrfToken;

// Export the shared API instance for use by other services
export { api as sharedAPI };

export const appService = {
    /**
     * Notices the server kept for this person, newest first, with the number not yet read.
     */
    async getNotifications() {
        return await api.get('/notifications');
    },

    async markNotificationsRead(id = null) {
        return await api.post('/notifications/read', id ? { id } : {});
    },

    async clearNotifications(id = null) {
        return await api.delete('/notifications', id ? { params: { id } } : {});
    },

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
    },

    async renderEmailTemplate(templateName, data = {}) {
        return await api.post('/email/template/render', { template: templateName, data });
    },

    async clearLogs() {
        return await api.delete('/logs');
    },

    async getDetailedHealth() {
        return await api.get('/health');
    }
};

export default appService;
