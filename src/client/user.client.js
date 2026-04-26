/**
 * Direct HTTP calls to server user endpoints
 */

import { sharedAPI as api } from './app.client.js';

export const userService = {
    async getProfile() {
        return await api.get('/auth/me'); // Profile is handled by auth endpoint
    },

    async updateProfile(profileData) {
        // Get current user ID first, then update via users/:id
        const profile = await this.getProfile();
        return await api.put(`/users/${profile.data.user._id}`, profileData);
    },

    async getUsers(params = {}) {
        return await api.get('/users', { params });
    },

    async getPublicUsers(params = {}) {
        return await api.get('/users/public', { params });
    },

    async getUserById(userId) {
        return await api.get(`/users/${userId}`);
    },

    async updateUser(userId, userData) {
        return await api.put(`/users/${userId}`, userData);
    },

    async deleteUser(userId) {
        return await api.delete(`/users/${userId}`);
    },

    async getStats(params = {}) {
        return await api.get('/users/stats/overview', { params });
    },

    async getUserStatsByUserId(userId, params = {}) {
        return await api.get(`/users/${userId}/stats`, { params });
    },

    // Role request management (owner only)
    async getRoleRequests(params = {}) {
        return await api.get('/auth/roles/pending-requests', { params });
    },

    async approveRoleRequest(userId, reason = '') {
        return await api.post(`/auth/roles/approve/${userId}`, { reason });
    },

    async rejectRoleRequest(userId, reason = '') {
        return await api.post(`/auth/roles/reject/${userId}`, { reason });
    },

    async createRoleRequest(roleData) {
        return await api.post('/auth/roles/request-elevation', roleData);
    },

    async getUserFiles(userId, params = {}) {
        return await api.get(`/users/${userId}/files`, { params });
    },

    async changePassword(userId, currentPassword, newPassword) {
        return await api.put(`/users/${userId}/password`, { currentPassword, newPassword });
    },

    // Connection system
    async sendConnectionRequest(userId) {
        return await api.post(`/users/${userId}/connect`);
    },

    async respondToConnection(userId, action) {
        return await api.put(`/users/${userId}/connect`, { action });
    },

    async removeConnection(userId) {
        return await api.delete(`/users/${userId}/connect`);
    },

    async getConnections(userId, params = {}) {
        return await api.get(`/users/${userId}/connections`, { params });
    },

    async getPendingRequests(params = {}) {
        return await api.get('/users/connections/pending', { params });
    },

    async getSentRequests(params = {}) {
        return await api.get('/users/connections/sent', { params });
    },

    async getConnectionCounts(userId) {
        return await api.get(`/users/${userId}/connection-counts`);
    },

    async getConnectionStatus(userId) {
        return await api.get(`/users/${userId}/connection-status`);
    },

    // ==================== STARRED FILES ====================

    async getStarredFiles() {
        return await api.get('/users/starred');
    },

    async starFile(fileId) {
        return await api.post(`/users/starred/${fileId}`);
    },

    async unstarFile(fileId) {
        return await api.delete(`/users/starred/${fileId}`);
    },

    // ==================== GROUP OPERATIONS ====================

    // Group CRUD
    async createGroup(groupData) {
        return await api.post('/users/groups', groupData);
    },

    async getMyGroups(params = {}) {
        return await api.get('/users/groups', { params });
    },

    async discoverGroups(params = {}) {
        return await api.get('/users/groups/discover', { params });
    },

    async getGroup(groupId) {
        return await api.get(`/users/groups/${groupId}`);
    },

    async updateGroup(groupId, updates) {
        return await api.patch(`/users/groups/${groupId}`, updates);
    },

    async deleteGroup(groupId) {
        return await api.delete(`/users/groups/${groupId}`);
    },

    async joinGroup(groupId) {
        return await api.post(`/users/groups/${groupId}/join`);
    },

    async leaveGroup(groupId) {
        return await api.post(`/users/groups/${groupId}/leave`);
    },

    async transferOwnership(groupId, newOwnerId) {
        return await api.patch(`/users/groups/${groupId}/transfer`, { userId: newOwnerId });
    },

    // Member management
    async addMember(groupId, userId, role = 'READ') {
        return await api.post(`/users/groups/${groupId}/members`, { userId, role });
    },

    async updateMemberRole(groupId, userId, newRole) {
        return await api.patch(`/users/groups/${groupId}/members/${userId}`, { role: newRole });
    },

    async removeMember(groupId, userId) {
        return await api.delete(`/users/groups/${groupId}/members/${userId}`);
    }
};

export default userService;
