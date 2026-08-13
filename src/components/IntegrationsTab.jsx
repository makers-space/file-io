import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { integrationService } from '@/client/integration.client';
import {
    Container,
    Card,
    Button,
    Typography,
    Icon,
    Input,
    Badge,
    Divider,
    CircularProgress
} from '@components/Components';

const STATUS_META = {
    verified: { color: 'success',   label: 'Verified',  icon: 'FiCheckCircle' },
    pending:  { color: 'warning',   label: 'Pending verification', icon: 'FiClock' },
    disabled: { color: 'secondary', label: 'Disabled',  icon: 'FiSlash' }
};

const EMPTY_FORM = { name: '', description: '', baseUrl: '', apiKey: '', apiKeyHeader: 'X-Api-Key', scope: 'user' };

// ─── Secret reveal (shown exactly once after create/rotate) ──────────────────

const SecretReveal = ({ secret, onDismiss }) => (
    <Card padding="md" color="warning">
        <Container layout="flex-column" gap="sm">
            <Container layout="flex" align="center" gap="sm">
                <Icon name="FiKey" size="sm" />
                <Typography size="sm" weight="semibold">Signing secret — copy it now, it will not be shown again</Typography>
            </Container>
            <Typography size="xs" color="secondary">
                Configure your external app with this secret so it can verify that deliveries really come from FilesystemOne
                (HMAC-SHA256 signature in the X-FSOne-Signature header).
            </Typography>
            <Container backgroundColor="surface" padding="xs">
                <Typography size="xs" font="monospace" style={{ userSelect: 'all', wordBreak: 'break-all' }}>{secret}</Typography>
            </Container>
            <Container layout="flex" gap="sm">
                <Button size="sm" color="secondary" onClick={() => navigator.clipboard?.writeText(secret)}>
                    <Icon name="FiCopy" size="xs" />Copy
                </Button>
                <Button size="sm" onClick={onDismiss}>Done</Button>
            </Container>
        </Container>
    </Card>
);

// ─── Delivery history ─────────────────────────────────────────────────────────

const DeliveryLog = ({ integrationId }) => {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await integrationService.getDeliveries(integrationId);
                setData(res);
            } catch {
                setData(null);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [integrationId]);

    if (isLoading) return <CircularProgress size="xs" />;
    if (!data) return <Typography size="xs" color="secondary">Delivery history unavailable</Typography>;

    return (
        <Container layout="flex-column" gap="xs">
            <Container layout="flex" gap="md">
                <Typography size="xs" color="secondary">Total: {data.stats?.totalDeliveries ?? 0}</Typography>
                <Typography size="xs" color="secondary">Failed: {data.stats?.failedDeliveries ?? 0}</Typography>
                {data.stats?.lastDeliveryAt && (
                    <Typography size="xs" color="secondary">Last: {new Date(data.stats.lastDeliveryAt).toLocaleString()}</Typography>
                )}
            </Container>
            {(data.deliveries || []).length === 0
                ? <Typography size="xs" color="secondary">No deliveries yet</Typography>
                : (data.deliveries || []).slice(0, 10).map((d, i) => (
                    <Container key={i} layout="flex" align="center" gap="sm" padding="xs" backgroundColor="surface" style={{ borderRadius: '4px' }}>
                        <Icon name={d.success ? 'FiCheck' : 'FiX'} size="xs" color={d.success ? 'success' : 'error'} />
                        <Typography size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filePath}</Typography>
                        <Typography size="xs" color="secondary">{d.event}</Typography>
                        {d.includedContent && <Badge size="sm" color="tertiary">content</Badge>}
                        <Typography size="xs" color="secondary">{d.sentAt ? new Date(d.sentAt).toLocaleString() : ''}</Typography>
                    </Container>
                ))
            }
        </Container>
    );
};

// ─── Single integration card ──────────────────────────────────────────────────

const IntegrationCard = ({ integration, currentUserId, isAdmin, onChanged, onSecret }) => {
    const { success: showSuccess, error: showError } = useNotification();
    const [isBusy, setIsBusy] = useState(false);
    const [showLog, setShowLog] = useState(false);

    const meta = STATUS_META[integration.status] || STATUS_META.pending;
    const isOwner = integration.owner === currentUserId;
    const canManage = isOwner || isAdmin;

    const run = async (fn, successMsg) => {
        setIsBusy(true);
        try {
            const res = await fn();
            if (successMsg) showSuccess(successMsg);
            onChanged();
            return res;
        } catch (err) {
            showError(err?.response?.data?.message || 'Operation failed');
        } finally {
            setIsBusy(false);
        }
    };

    const handleVerify = () => run(async () => {
        await integrationService.verifyIntegration(integration.id);
    }, 'Endpoint verified — you can now send files to it');

    const handleRotate = async () => {
        const res = await run(() => integrationService.rotateSecret(integration.id), 'Signing secret rotated');
        if (res?.signingSecret) onSecret(res.signingSecret);
    };

    const handleDisable = () => run(() => integrationService.disableIntegration(integration.id), 'Integration disabled');
    const handleDelete = () => run(() => integrationService.deleteIntegration(integration.id), 'Integration deleted');

    return (
        <Card padding="md" backgroundColor="surface">
            <Container layout="flex-column" gap="sm">
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="FiLink" size="sm" color="primary" />
                    <Container layout="flex-column" gap="xs" flexFill>
                        <Container layout="flex" align="center" gap="sm">
                            <Typography size="sm" weight="semibold">{integration.name}</Typography>
                            <Badge size="sm" color={meta.color}>{meta.label}</Badge>
                            <Badge size="sm" color={integration.scope === 'global' ? 'primary' : 'tertiary'}>
                                {integration.scope === 'global' ? 'Global' : 'Personal'}
                            </Badge>
                        </Container>
                        <Typography size="xs" color="secondary" font="monospace" style={{ wordBreak: 'break-all' }}>
                            {integration.baseUrl}
                        </Typography>
                        {integration.description && <Typography size="xs" color="secondary">{integration.description}</Typography>}
                        {integration.status === 'pending' && integration.lastVerificationError && (
                            <Typography size="xs" color="error">Last verification attempt: {integration.lastVerificationError}</Typography>
                        )}
                    </Container>
                </Container>

                {canManage && (
                    <Container layout="flex" gap="sm" wrap>
                        {integration.status !== 'disabled' && integration.status !== 'verified' && (
                            <Button size="sm" color="primary" onClick={handleVerify} disabled={isBusy}>
                                <Icon name="FiShield" size="xs" />Verify endpoint
                            </Button>
                        )}
                        <Button size="sm" color="secondary" onClick={() => setShowLog(s => !s)} disabled={isBusy}>
                            <Icon name="FiList" size="xs" />{showLog ? 'Hide history' : 'Delivery history'}
                        </Button>
                        <Button size="sm" color="secondary" onClick={handleRotate} disabled={isBusy}>
                            <Icon name="FiRefreshCw" size="xs" />Rotate secret
                        </Button>
                        {integration.status !== 'disabled' && (
                            <Button size="sm" color="secondary" onClick={handleDisable} disabled={isBusy}>
                                <Icon name="FiSlash" size="xs" />Disable
                            </Button>
                        )}
                        <Button size="sm" color="error" onClick={handleDelete} disabled={isBusy}>
                            <Icon name="FiTrash2" size="xs" />Delete
                        </Button>
                    </Container>
                )}

                {showLog && canManage && (
                    <>
                        <Divider color="surface" margin="xs" />
                        <DeliveryLog integrationId={integration.id} />
                    </>
                )}
            </Container>
        </Card>
    );
};

// ─── Integrations Tab ─────────────────────────────────────────────────────────

const IntegrationsTab = () => {
    const { user } = useAuth();
    const { success: showSuccess, error: showError } = useNotification();

    const [integrations, setIntegrations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [revealedSecret, setRevealedSecret] = useState(null);

    const currentUserId = user?._id || user?.id;
    const roles = user?.roles || [];
    const isAdmin = roles.includes('ADMIN') || roles.includes('OWNER');
    const canCreatePersonal = isAdmin || roles.includes('CREATOR') || roles.includes('SUPER_CREATOR');

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await integrationService.getIntegrations();
            setIntegrations(res.integrations || []);
        } catch {
            showError('Failed to load integrations');
        } finally {
            setIsLoading(false);
        }
    }, [showError]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!form.name.trim() || !form.baseUrl.trim()) {
            showError('Name and endpoint URL are required');
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await integrationService.createIntegration({
                name: form.name.trim(),
                description: form.description.trim(),
                baseUrl: form.baseUrl.trim(),
                apiKey: form.apiKey.trim() || undefined,
                apiKeyHeader: form.apiKeyHeader.trim() || 'X-Api-Key',
                scope: form.scope
            });
            showSuccess('Integration registered — verify the endpoint to start sending files');
            setRevealedSecret(res.signingSecret);
            setForm(EMPTY_FORM);
            setShowForm(false);
            load();
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to register integration');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Container layout="flex-column" gap="lg">
            {/* Feature explanation */}
            <Container layout="flex-column" gap="sm">
                <Container layout="flex" justify="between" align="center">
                    <Typography size="md" weight="semibold">External App Integrations</Typography>
                    {canCreatePersonal && !showForm && (
                        <Button size="sm" color="primary" onClick={() => setShowForm(true)}>
                            <Icon name="FiPlus" size="xs" />Add integration
                        </Button>
                    )}
                </Container>
                <Typography size="sm" color="secondary">
                    You have full access to API file sharing: connect your other applications and send them any file
                    you can read — content and metadata — straight from FilesystemOne. Every endpoint is verified with a
                    signed challenge before it can receive anything, and every delivery is HMAC-signed and
                    checksummed so your apps can trust what arrives.
                </Typography>
                <Container layout="flex" gap="md" wrap>
                    <Container layout="flex" align="center" gap="xs">
                        <Icon name="FiShield" size="xs" color="success" />
                        <Typography size="xs" color="secondary">Challenge-verified endpoints</Typography>
                    </Container>
                    <Container layout="flex" align="center" gap="xs">
                        <Icon name="FiLock" size="xs" color="success" />
                        <Typography size="xs" color="secondary">HMAC-signed deliveries</Typography>
                    </Container>
                    <Container layout="flex" align="center" gap="xs">
                        <Icon name="FiHash" size="xs" color="success" />
                        <Typography size="xs" color="secondary">SHA-256 content checksums</Typography>
                    </Container>
                </Container>
                {!canCreatePersonal && (
                    <Card padding="sm" color="warning">
                        <Container layout="flex" align="center" gap="sm">
                            <Icon name="FiStar" size="xs" />
                            <Typography size="xs">
                                Registering your own endpoints requires a Creator account or above — request an upgrade in the
                                Roles tab. You can still export files through the global integrations below.
                            </Typography>
                        </Container>
                    </Card>
                )}
            </Container>

            {revealedSecret && (
                <SecretReveal secret={revealedSecret} onDismiss={() => setRevealedSecret(null)} />
            )}

            {/* Registration form */}
            {showForm && (
                <Card padding="md" backgroundColor="surface">
                    <Container layout="flex-column" gap="md">
                        <Typography size="sm" weight="semibold">Register external endpoint</Typography>
                        <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My other app" width="100%" />
                        <Input label="Endpoint URL (HTTPS)" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://my-app.example.com/api/v1/fsone/receive" width="100%" />
                        <Input label="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} width="100%" />
                        <Container layout="flex" gap="md">
                            <Input label="API key (optional)" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} type="password" flexFill />
                            <Input label="API key header" value={form.apiKeyHeader} onChange={e => setForm(f => ({ ...f, apiKeyHeader: e.target.value }))} flexFill />
                        </Container>
                        {isAdmin && (
                            <Container layout="flex" gap="sm" align="center">
                                <Typography size="xs" color="secondary">Scope:</Typography>
                                <Button size="sm" color="primary" selected={form.scope === 'user'} onClick={() => setForm(f => ({ ...f, scope: 'user' }))}>Personal</Button>
                                <Button size="sm" color="primary" selected={form.scope === 'global'} onClick={() => setForm(f => ({ ...f, scope: 'global' }))}>Global (all users)</Button>
                            </Container>
                        )}
                        <Container layout="flex" gap="sm">
                            <Button color="primary" onClick={handleCreate} disabled={isSubmitting}>
                                <Icon name={isSubmitting ? 'FiLoader' : 'FiPlus'} size="xs" />
                                {isSubmitting ? 'Registering…' : 'Register'}
                            </Button>
                            <Button color="secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} disabled={isSubmitting}>Cancel</Button>
                        </Container>
                    </Container>
                </Card>
            )}

            <Divider color="surface" margin="xs" />

            {/* Integration list */}
            {isLoading
                ? <CircularProgress size="sm" />
                : integrations.length === 0
                    ? (
                        <Container layout="flex-column" align="center" gap="sm" padding="md">
                            <Icon name="FiLink" size="md" color="secondary" />
                            <Typography size="sm" color="secondary">No integrations yet</Typography>
                            {canCreatePersonal && (
                                <Typography size="xs" color="secondary">Register your first endpoint to start sending files to your other apps.</Typography>
                            )}
                        </Container>
                    )
                    : (
                        <Container layout="flex-column" gap="sm">
                            {integrations.map(integration => (
                                <IntegrationCard
                                    key={integration.id}
                                    integration={integration}
                                    currentUserId={currentUserId}
                                    isAdmin={isAdmin}
                                    onChanged={load}
                                    onSecret={setRevealedSecret}
                                />
                            ))}
                        </Container>
                    )
            }
        </Container>
    );
};

export default IntegrationsTab;
