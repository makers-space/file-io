/**
 * Console File Service - Complete I    getDocumentName(filePath) {
        // Use direct normalized path as document name - standard Yjs pattern
        return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
    },ace to Server File System
 * 
 * This service provides a simple, comprehensive interface to the server's file system
 * layer with full Yjs collaborative editing support and efficient error handling.
 * 
 * ARCHITECTURE OVERVIEW:
 * - HTTP API: File metadata, CRUD operations, directory management
 * - WebSocket (Yjs): Real-time collaborative editing for text files
 * - MongoDB: File metadata + GridFS for binaries + Yjs documents collection
 * 
 * FILE TYPE HANDLING:
 * - Text Files: Collaborative editing via Yjs with MongoDB persistence
 * - Binary Files: Traditional GridFS storage with versioning
 * - Directories: Metadata-only with hierarchical structure support
 */

import { sharedAPI as api } from './app.client.js';
import { authService } from './auth.client.js';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Global collaborative document management
const documentProviders = new Map(); // filePath -> { ydoc, provider, connectionState }

const connectionConfig = {
    wsUrl: `${import.meta.env.VITE_WS_BASE_URL}/yjs`,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
};

// =============================================================================
// NOTIFICATION WEBSOCKET CLIENT (Internal)
// =============================================================================

/**
 * Internal WebSocket client for file operation notifications
 * Handles real-time updates when files are shared/unshared between users
 */
class FileNotificationClient {
    constructor() {
        this.ws = null;
        this.eventListeners = new Map();
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectInterval = 3000;
        this.isConnecting = false;
        this.shouldReconnect = true;
    }

    async connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;

        try {
            // Use shared getAuthToken from fileService
            const token = await fileService.getAuthToken();
            if (!token) {
                this.isConnecting = false;
                return;
            }

            const wsUrl = `${import.meta.env.VITE_WS_BASE_URL}/notifications?token=${encodeURIComponent(token)}`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.reconnectAttempts = 0;
                this.isConnecting = false;
            };

            this.ws.onmessage = (event) => {
                try {
                    const notification = JSON.parse(event.data);
                    this.handleNotification(notification);
                } catch (error) {
                    console.error('Error parsing notification:', error);
                }
            };

            this.ws.onclose = (event) => {
                this.isConnecting = false;
                this.ws = null;
                
                if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (error) => {
                this.isConnecting = false;
            };

        } catch (error) {
            this.isConnecting = false;
            if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    handleNotification(notification) {
    this.emit(notification.type, notification.data);
    }

    on(eventType, callback) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        
        // Only add if not already present
        const listeners = this.eventListeners.get(eventType);
        if (!listeners.has(callback)) {
            listeners.add(callback);
            
            // Connect if needed
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.connect();
            }
        }
    }

    off(eventType, callback) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                this.eventListeners.delete(eventType);
            }
        }
    }

    emit(eventType, data) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in notification listener:', error);
                }
            });
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
    }
}

// Create internal notification client
const notificationClient = new FileNotificationClient();

export const fileService = {
    // =============================================================================
    // DOCUMENT NAME GENERATION (consistent with server)
    // =============================================================================
    
    /**
     * Get document name from file path (must match server-side document identification)
     * @param {string} filePath - File path to normalize
     * @returns {string} Document name that matches server's MongoDB storage key
     */
    getDocumentName(filePath) {
        // Normalize the path
        let normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
        
        // Ensure it starts with /
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        
        // Server stores documents with 'yjs/' prefix in MongoDB
        // Server extracts from URL '/yjs/dirname/filename' -> 'yjs/dirname/filename'
        // So we need to return 'yjs/dirname/filename' format
        return 'yjs' + normalizedPath;
    },

    // =============================================================================
    // AUTHENTICATION HELPERS
    // =============================================================================
    
    /**
     * Get current authentication token for WebSocket connections
     * WebSocket connections may not automatically include HTTP-only cookies
     */
    async getAuthToken() {
        try {
            // Try to get access token from cookie (if stored as non-HTTP-only)
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                acc[key] = value;
                return acc;
            }, {});
            
            if (cookies.accessToken) {
                return cookies.accessToken;
            }
            
            // If no accessible token, make a request to get one specifically for WebSocket
            const response = await api.get('/auth/ws-token');
            return response.token;
        } catch (error) {
            return null;
        }
    },

    // =============================================================================
    // SYSTEM INFORMATION ENDPOINTS
    // =============================================================================

    /**
     * Get file system health status
     * @returns {Promise<object>} Health status
     */
    async getHealth() {
        return await api.get('/files/health');
    },

    /**
     * Get supported file types and extensions
     * @returns {Promise<object>} Supported types information
     */
    async getSupportedTypes() {
        return await api.get('/files/types');
    },

    /**
     * Get file system statistics
     * @returns {Promise<object>} File system stats
     */
    async getFileSystemStats() {
        return await api.get('/files/stats');
    },

    /**
     * Get file tree structure (alias for getDirectoryTree for AdminPage compatibility)
     * @param {string} rootPath - Root directory path (default: '/')
     * @param {object} options - Tree options (maxDepth, type filter, etc.)
     * @returns {Promise<object>} Directory tree structure
     */
    async getFileTree(rootPath = '/', options = {}) {
        return await this.getDirectoryTree(rootPath, options);
    },

    /**
     * Get comprehensive file statistics (alias for getFileSystemStats for AdminPage compatibility)
     * @returns {Promise<object>} Comprehensive file statistics
     */
    async getFileStats() {
        return await this.getFileSystemStats();
    },

    // =============================================================================
    // CORE PATH UTILITIES
    // =============================================================================

    /**
     * Normalize file path to ensure consistent Unix-style absolute paths
     * @param {string} filePath - File path to normalize
     * @returns {string} Normalized path
     */
    normalizePath(filePath) {
        if (!filePath) return '/';
        
        // Convert to Unix-style path
        let normalized = filePath.replace(/\\/g, '/');
        
        // Ensure absolute path
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        
        // Remove duplicate slashes and trailing slash (except root)
        normalized = normalized.replace(/\/+/g, '/');
        if (normalized !== '/' && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        
        return normalized;
    },

    /**
     * Extract display name from path or node
     * @param {string|object} pathOrNode - File path or node object
     * @returns {string} Display name
     */
    getDisplayName(pathOrNode) {
        if (typeof pathOrNode === 'string') {
            const normalized = this.normalizePath(pathOrNode);
            return normalized === '/' ? 'Root' : normalized.split('/').pop();
        }
        
        if (pathOrNode?.fileName) return pathOrNode.fileName;
        if (pathOrNode?.name) return pathOrNode.name;
        if (pathOrNode?.filePath) return this.getDisplayName(pathOrNode.filePath);
        
        return 'Unknown';
    },

    /**
     * Get parent directory path
     * @param {string} filePath - File path
     * @returns {string} Parent directory path
     */
    getParentPath(filePath) {
        const normalized = this.normalizePath(filePath);
        if (normalized === '/') return null;
        
        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash === 0 ? '/' : normalized.substring(0, lastSlash);
    },

    /**
     * Determine file type from path or extension
     * @param {string} filePath - File path
     * @returns {string} File type: 'directory', 'text', or 'binary'
     */
    getFileType(filePath) {
        const normalized = this.normalizePath(filePath);
        
        // Directory check
        if (normalized.endsWith('/')) return 'directory';
        
        // Extract extension
        const fileName = normalized.split('/').pop();
        const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
        
        // Binary file extensions
        const binaryExtensions = [
            // Images
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff',
            // Videos
            'mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'm4v',
            // Audio
            'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma',
            // Documents
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
            // Archives
            'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
            // Executables
            'exe', 'dll', 'bin', 'dmg', 'iso', 'msi',
            // Databases
            'db', 'sqlite', 'mdb', 'accdb',
            // Design
            'psd', 'ai', 'indd', 'sketch', 'fig'
        ];
        
        return binaryExtensions.includes(extension) ? 'binary' : 'text';
    },

    // =============================================================================
    // HTTP API OPERATIONS (File Metadata & CRUD)
    // =============================================================================

    /**
     * Create a new file with content
     * @param {string} filePath - Absolute file path
     * @param {string} content - File content
     * @param {string} description - File description
     * @returns {Promise<object>} Created file metadata
     */
    async createFile(filePath, content = '', description = '') {
        return await api.post('/files', {
            filePath: this.normalizePath(filePath),
            content,
            description
        });
    },

    /**
     * Create a new directory
     * @param {string} dirPath - Absolute directory path
     * @param {string} description - Directory description
     * @returns {Promise<object>} Created directory metadata
     */
    async createDirectory(dirPath, description = '') {
        return await api.post('/files/directory', {
            dirPath: this.normalizePath(dirPath),
            description
        });
    },

    /**
     * Get file or directory metadata
     * @param {string} filePath - Absolute file path
     * @returns {Promise<object>} File metadata
     */
    async getMetadata(filePath) {
        const encodedPath = encodeURIComponent(this.normalizePath(filePath));
        return await api.get(`/files/${encodedPath}/metadata`);
    },

    /**
     * Get file content (for binary files - text files use Yjs)
     * @param {string} filePath - Absolute file path
     * @returns {Promise<object>} File content response
     */
    async getContent(filePath) {
        const encodedPath = encodeURIComponent(this.normalizePath(filePath));
        return await api.get(`/files/${encodedPath}/content`);
    },

    /**
     * Update file content (for binary files - text files auto-save via Yjs)
     * @param {string} filePath - Absolute file path
     * @param {string|Buffer} content - New content
     * @param {object} options - Update options (message, etc.)
     * @returns {Promise<object>} Update response
     */
    async updateContent(filePath, content, options = {}) {
        const encodedPath = encodeURIComponent(this.normalizePath(filePath));
        const payload = { content, ...options };
        return await api.put(`/files/${encodedPath}/content`, payload);
    },

    /**
     * Delete a file or directory
     * @param {string} filePath - Absolute file path
     * @returns {Promise<object>} Deletion response
     */
    async deleteFile(filePath) {
        const encodedPath = encodeURIComponent(this.normalizePath(filePath));
        return await api.delete(`/files/${encodedPath}`);
    },

    /**
     * Move file or directory
     * @param {string} sourcePath - Source path
     * @param {string} destinationPath - Destination directory path
     * @returns {Promise<object>} Move response
     */
    async moveFile(sourcePath, destinationPath) {
        return await api.post('/files/move', {
            sourcePath: this.normalizePath(sourcePath),
            destinationPath: this.normalizePath(destinationPath)
        });
    },

    /**
     * Copy file or directory
     * @param {string} sourcePath - Source path
     * @param {string} destinationPath - Destination directory path
     * @returns {Promise<object>} Copy response
     */
    async copyFile(sourcePath, destinationPath) {
        return await api.post('/files/copy', {
            sourcePath: this.normalizePath(sourcePath),
            destinationPath: this.normalizePath(destinationPath)
        });
    },

    /**
     * Rename file or directory
     * @param {string} filePath - Current file path
     * @param {string} newName - New file name
     * @returns {Promise<object>} Rename response
     */
    async renameFile(filePath, newName) {
        const encodedPath = encodeURIComponent(this.normalizePath(filePath));
        return await api.post(`/files/${encodedPath}/rename`, {
            newName: newName.trim()
        });
    },

    // =============================================================================
    // DIRECTORY & TREE OPERATIONS
    // =============================================================================

    /**
     * Get directory contents
     * @param {string} dirPath - Directory path (default: '/')
     * @param {object} options - Query options (recursive, type filter, etc.)
     * @returns {Promise<object>} Directory contents
     */
    async getDirectoryContents(dirPath = '/', options = {}) {
        const normalizedPath = this.normalizePath(dirPath);
        const params = {
            filePath: normalizedPath,
            ...options
        };

        return await api.get('/files/directory/contents', { params });
    },

    /**
     * Get directory tree structure
     * @param {string} rootPath - Root directory path (default: '/')
     * @param {object} options - Tree options (maxDepth, type filter, etc.)
     * @returns {Promise<object>} Directory tree
     */
    async getDirectoryTree(rootPath = '/', options = {}) {
        const normalizedPath = this.normalizePath(rootPath);
        const params = {
            rootPath: normalizedPath,
            ...options
        };

        return await api.get('/files/tree', { params });
    },

    /**
     * Get directory statistics
     * @param {string} dirPath - Directory path
     * @returns {Promise<object>} Directory stats (size, file count, etc.)
     */
    async getDirectoryStats(dirPath) {
        const normalizedPath = this.normalizePath(dirPath);
        const params = { filePath: normalizedPath };
        
        return await api.get('/files/directory/stats', { params });
    },

    // =============================================================================
    // FILE LISTING & SEARCH
    // =============================================================================

    /**
     * List files with filtering and pagination
     * @param {object} options - Query options (type, search, pagination, etc.)
     * @returns {Promise<object>} File listing
     */
    async listFiles(options = {}) {
        return await api.get('/files', { params: options });
    },

    /**
     * Search files by name or content
     * @param {string} query - Search query
     * @param {object} options - Search options (type filter, path filter, etc.)
     * @returns {Promise<object>} Search results
     */
    async searchFiles(query, options = {}) {
        const params = {
            search: query,
            ...options
        };
        
        return await api.get('/files', { params });
    },

    // =============================================================================
    // FILE SHARING & PERMISSIONS
    // =============================================================================

    /**
     * Share file with users
     * @param {string} filePath - File path to share
     * @param {string[]} userIds - Array of user IDs to share with
     * @param {string} permission - Permission level ('read' or 'write')
     * @returns {Promise<object>} Share response
     */
    async shareFile(filePath, userIds, permission = 'read') {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.post(`/files/${encodedPath}/share`, {
            userIds,
            permission
        });
    },

    /**
     * Get active collaborators for a file
     * @param {string} filePath - File path
     * @returns {Promise<object>} Active collaborators
     */
    async getCollaborators(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.get(`/files/${encodedPath}/collaborators`);
    },

    /**
     * Get file sharing information
     * @param {string} filePath - File path
     * @returns {Promise<object>} File sharing info
     */
    async getFileSharing(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.get(`/files/${encodedPath}/share`);
    },

    /**
     * Remove users from file permissions (unshare)
     * @param {string} filePath - File path
     * @param {string[]} userIds - Array of user IDs to remove
     * @param {string} permission - Permission level to remove ('read', 'write', or 'both')
     * @returns {Promise<object>} Unshare response
     */
    async unshareFile(filePath, userIds, permission = 'both') {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.delete(`/files/${encodedPath}/share`, {
            data: {
                userIds,
                permission
            }
        });
    },

    // =============================================================================
    // FILE UPLOAD & DOWNLOAD
    // =============================================================================

    /**
     * Upload files (handles multiple files)
     * @param {FileList|File[]} files - Files to upload
     * @param {string} targetPath - Target directory path
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<object>} Upload response
     */
    async uploadFiles(files, targetPath = '/', onProgress = null) {
        const normalizedPath = this.normalizePath(targetPath);
        const formData = new FormData();
        
        Array.from(files).forEach((file, index) => {
            formData.append('files', file);
        });

        const config = {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        };

        if (onProgress) {
            config.onUploadProgress = progressEvent => {
                const percentCompleted = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                );
                onProgress(percentCompleted);
            };
        }

        return await api.post('/files/upload', formData, config);
    },

    /**
     * Download file
     * @param {string} filePath - File path to download
     * @returns {Promise<Blob>} File blob for download
     */
    async downloadFile(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        const response = await api.get(`/files/${encodedPath}/download`, {
            responseType: 'blob'
        });
        
        return response;
    },

    /**
     * Get streaming URL for video/audio files
     * Returns direct URL for HTTP range request streaming (RFC 7233)
     * 
     * How it works:
     * 1. Browser makes requests with Range headers (e.g., "Range: bytes=0-1023")
     * 2. Server responds with HTTP 206 Partial Content
     * 3. Native <video>/<audio> elements handle seeking and buffering automatically
     * 
     * Authentication:
     * - Components auto-detect same-origin URLs and use crossOrigin="use-credentials"
     * - External URLs use crossOrigin="anonymous"
     * 
     * @param {string} filePath - File path
     * @returns {string} Direct URL for streaming
     */
    getStreamingUrl(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
        
        return `${baseUrl}/files/${encodedPath}/download`;
    },

    // =============================================================================
    // YJS COLLABORATIVE EDITING
    // =============================================================================

    /**
     * Connect to collaborative document
     * @param {string} filePath - File path
     * @param {object} options - Connection options
     * @returns {Promise<object>} Document connection { ydoc, provider, ytext }
     */
    async connectToDocument(filePath, options = {}) {
        const normalizedPath = this.normalizePath(filePath);
        
        // Always disconnect from any existing connection first
        if (documentProviders.has(normalizedPath)) {
            await this.disconnectFromDocument(normalizedPath);
        }

        try {
            // Create new Yjs document
            const ydoc = new Y.Doc();
            
            // Get authentication token for WebSocket connection
            const authToken = await this.getAuthToken();
            
            // Create WebSocket provider with authentication
            // WebsocketProvider(baseUrl, roomName, doc) connects to baseUrl/roomName
            // Server extracts docName from URL: req.url.slice(1).split('?')[0]
            // For URL '/yjs/dirname/filename', server gets 'yjs/dirname/filename'
            const docName = this.getDocumentName(normalizedPath); // Returns 'yjs/dirname/filename'
            const baseWsUrl = connectionConfig.wsUrl.replace('/yjs', ''); // 'ws://localhost:8080'
            
            // Create WebSocket provider with document name as roomName
            const providerOptions = {
                connect: true,
                ...options
            };
            
            // Add auth token to WebSocket connection params if available
            if (authToken) {
                providerOptions.params = { token: authToken };
            }
            
            const provider = new WebsocketProvider(baseWsUrl, docName, ydoc, providerOptions);

            // Get text content for collaborative editing
            const ytext = ydoc.getText('content');

            const connection = {
                ydoc,
                provider,
                ytext,
                filePath: normalizedPath,
                connected: false,
                lastSync: null
            };

            // Set up connection event handlers
            provider.on('status', event => {
                connection.connected = event.status === 'connected';
                if (connection.connected) {
                    connection.lastSync = new Date();
                }
            });

            provider.on('sync', synced => {
                if (synced) {
                    connection.lastSync = new Date();
                }
            });

            // Store connection
            documentProviders.set(normalizedPath, connection);
            
            return connection;
        } catch (error) {
            throw new Error(`Failed to connect to document: ${error.message}`);
        }
    },

    /**
     * Disconnect from collaborative document
     * @param {string} filePath - File path
     * @returns {Promise<void>}
     */
    async disconnectFromDocument(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const connection = documentProviders.get(normalizedPath);
        
        if (connection) {
            try {
                // Clean up WebSocket provider
                if (connection.provider) {
                    connection.provider.disconnect();
                    connection.provider.destroy();
                }
                
                // Clean up Yjs document
                if (connection.ydoc) {
                    connection.ydoc.destroy();
                }
            } catch (error) {
                // Ignore disconnect errors
            }
            
            // Always remove from cache, even if cleanup failed
            documentProviders.delete(normalizedPath);
        }
    },

    // =============================================================================
    // BULK OPERATIONS
    // =============================================================================

    /**
     * Perform bulk operations on multiple files
     * @param {string} operation - Operation type ('delete', 'move', 'copy', 'tag')
     * @param {string[]} filePaths - Array of file paths
     * @param {object} options - Operation-specific options
     * @returns {Promise<object>} Bulk operation response
     */
    async bulkOperation(operation, filePaths, options = {}) {
        const normalizedPaths = filePaths.map(path => this.normalizePath(path));
        
        return await api.post('/files/bulk', {
            operation,
            filePaths: normalizedPaths,
            ...options
        });
    },

    // =============================================================================
    // SYSTEM & UTILITY OPERATIONS
    // =============================================================================

    /**
     * Publish a file version
     * @param {string} filePath - File path
     * @param {string} message - Version message
     * @returns {Promise<object>} Publish response
     */
    async publishFileVersion(filePath, message = 'Published version') {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.post(`/files/${encodedPath}/publish`, {
            message
        });
    },

    /**
     * Get file version history
     * @param {string} filePath - File path
     * @returns {Promise<object>} Version history
     */
    async getFileVersions(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.get(`/files/${encodedPath}/versions`);
    },

    /**
     * Load specific file version
     * @param {string} filePath - File path
     * @param {number} versionNumber - Version number to load
     * @returns {Promise<object>} Version content
     */
    async loadFileVersion(filePath, versionNumber) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.get(`/files/${encodedPath}/versions/${versionNumber}`);
    },

    /**
     * Delete specific file version
     * @param {string} filePath - File path
     * @param {number} versionNumber - Version number to delete
     * @returns {Promise<object>} Delete response
     */
    async deleteFileVersion(filePath, versionNumber) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        return await api.delete(`/files/${encodedPath}/versions/${versionNumber}`);
    },

    async downloadFileVersion(filePath, versionNumber) {
        const normalizedPath = this.normalizePath(filePath);
        const encodedPath = encodeURIComponent(normalizedPath);
        
        const response = await api.get(`/files/${encodedPath}/versions/${versionNumber}/download`, {
            responseType: 'blob'
        });
        
        return response;
    },

    // =============================================================================
    // SYSTEM & UTILITY OPERATIONS
    // =============================================================================

    /**
     * Get demo files
     * @returns {Promise<object>} Demo files
     */
    async getDemoFiles() {
        return await api.get('/files/demo');
    },

    // NOTE: Compression statistics are included in getFileStats() response
    // No separate endpoint needed

    // NOTE: Admin statistics are included in getFileStats() response
    // The /files/admin/stats endpoint is just an alias for /files/stats

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Check if file is text-based for collaborative editing
     * @param {string} filePath - File path
     * @returns {boolean} True if file is text-based
     */
    isTextFile(filePath) {
        return this.getFileType(filePath) === 'text';
    },

    /**
     * Check if file is binary
     * @param {string} filePath - File path
     * @returns {boolean} True if file is binary
     */
    isBinaryFile(filePath) {
        return this.getFileType(filePath) === 'binary';
    },

    /**
     * Check if path is a directory
     * @param {string} filePath - File path
     * @returns {boolean} True if path is directory
     */
    isDirectory(filePath) {
        return this.getFileType(filePath) === 'directory';
    },

    /**
     * Get file extension
     * @param {string} filePath - File path
     * @returns {string|null} File extension (without dot) or null
     */
    getFileExtension(filePath) {
        const fileName = this.getDisplayName(filePath);
        const lastDot = fileName.lastIndexOf('.');
        return lastDot === -1 ? null : fileName.substring(lastDot + 1).toLowerCase();
    },

    /**
     * Validate file path format
     * @param {string} filePath - File path to validate
     * @returns {boolean} True if path is valid
     */
    isValidPath(filePath) {
        if (!filePath || typeof filePath !== 'string') return false;
        
        const normalized = this.normalizePath(filePath);
        
        // Check for invalid characters and patterns
        return /^\/[^\0]*$/.test(normalized) && 
               !normalized.includes('//') && 
               (normalized === '/' || !normalized.endsWith('/'));
    },

    // =============================================================================
    // REAL-TIME NOTIFICATIONS
    // =============================================================================

    /**
     * Subscribe to file operation notifications
     * @param {Function} callback - Callback to handle notifications
     * @param {Object} options - Options for notification handling
     */
    onFileNotification(callback, options = {}) {
        const { showToast = false } = options;

        // Handle file operations
        const fileEvents = [
            { event: 'file:created', action: 'created', icon: '📁' },
            { event: 'file:deleted', action: 'deleted', icon: '🗑️' },
            { event: 'file:renamed', action: 'renamed', icon: '✏️' },
            { event: 'file:moved', action: 'moved', icon: '📦' },
            { event: 'file:shared', action: 'shared', icon: '🤝' },
            { event: 'file:unshared', action: 'unshared', icon: '🚫' },
            { event: 'directory:created', action: 'directory_created', icon: '📁' },
            { event: 'version:published', action: 'version_published', icon: '📦' }
        ];

        const eventCallbacks = [];

        fileEvents.forEach(({ event, action, icon }) => {
            const eventCallback = (data) => {
                if (showToast && window.showNotification) {
                    let message;
                    if (action === 'renamed') {
                        message = `${icon} File renamed to ${data.newFileName}`;
                    } else if (action === 'moved') {
                        message = `${icon} ${data.fileName} moved to new location`;
                    } else if (action === 'shared') {
                        const userCount = Array.isArray(data.sharedWith) ? data.sharedWith.length : 1;
                        message = `${icon} ${data.fileName} shared with ${userCount} user${userCount !== 1 ? 's' : ''}`;
                    } else if (action === 'unshared') {
                        message = `${icon} Sharing removed from ${data.fileName}`;
                    } else {
                        message = `${icon} ${data.fileName} ${action.replace('_', ' ')}`;
                    }
                    window.showNotification(message, 'info');
                }
                
                if (callback) {
                    callback(action, data);
                }
            };
            
            eventCallbacks.push({ event, callback: eventCallback });
            notificationClient.on(event, eventCallback);
        });

        // Return cleanup function
        return () => {
            eventCallbacks.forEach(({ event, callback }) => {
                notificationClient.off(event, callback);
            });
        };
    },


};

// Export default for easier importing
export default fileService;
