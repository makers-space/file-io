/**
 * Direct HTTP calls to server external integration endpoints
 * (sending file content/metadata to verified external APIs)
 */

import { sharedAPI as api } from './app.client.js';

export const integrationService = {
    /** List integrations visible to the current user (global + own) */
    async getIntegrations() {
        return await api.get('/integrations');
    },

    /** Get a single integration (never includes secrets) */
    async getIntegration(integrationId) {
        return await api.get(`/integrations/${integrationId}`);
    },

    /**
     * Register a new external endpoint.
     * scope: 'user' (personal) or 'global' (admins only)
     * Returns { integration, signingSecret } — the secret is shown exactly once.
     */
    async createIntegration({ name, description, baseUrl, apiKey, apiKeyHeader, scope = 'user' }) {
        return await api.post('/integrations', { name, description, baseUrl, apiKey, apiKeyHeader, scope });
    },

    /** Update name/description/URL/API key. URL changes reset verification. */
    async updateIntegration(integrationId, updates) {
        return await api.patch(`/integrations/${integrationId}`, updates);
    },

    /** Disable an integration (blocks all deliveries) */
    async disableIntegration(integrationId) {
        return await api.patch(`/integrations/${integrationId}`, { status: 'disabled' });
    },

    async deleteIntegration(integrationId) {
        return await api.delete(`/integrations/${integrationId}`);
    },

    /** Run the signed challenge/response verification handshake */
    async verifyIntegration(integrationId) {
        return await api.post(`/integrations/${integrationId}/verify`);
    },

    /** Rotate the HMAC signing secret — returns { signingSecret } once */
    async rotateSecret(integrationId) {
        return await api.post(`/integrations/${integrationId}/rotate-secret`);
    },

    /** Send a file's metadata (and optionally content) to a verified endpoint */
    async sendFile(integrationId, filePath, { includeContent = false, event = 'file.export' } = {}) {
        return await api.post(`/integrations/${integrationId}/send`, { filePath, includeContent, event });
    },

    /** Recent delivery log + stats (owner/admin only) */
    async getDeliveries(integrationId) {
        return await api.get(`/integrations/${integrationId}/deliveries`);
    },

    /** Issue or rotate the inbound pull API key — returns { inboundKey } once */
    async issueInboundKey(integrationId) {
        return await api.post(`/integrations/${integrationId}/inbound-key`);
    },

    /** Replace the read-only path grants for inbound pulls: [{ path: '/folder' }] */
    async setGrants(integrationId, grants) {
        return await api.put(`/integrations/${integrationId}/grants`, { grants });
    }
};

export default integrationService;
