import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useTheme } from '@contexts/ThemeContext';
import { useNotification } from '@contexts/NotificationContext';
import { authService } from '@/client/auth.client';
import { userService } from '@/client/user.client';
import { themeService } from '@/client/theme.client';
import { listFontKeys, ensureFontsLoaded } from '@/styles/font.registry';
import { integrationService } from '@/client/integration.client';
import {
    Page,
    Container,
    Card,
    Button,
    Typography,
    Icon,
    Input,
    Badge,
    Divider,
    Select,
    Switch,
    Data,
    CircularProgress,
    ButtonGroup
} from '@components/Components';

// ─── Account Tab (Profile + Password) ────────────────────────────────────────

const AccountTab = ({ user }) => {
    const { success: showSuccess, error: showError } = useNotification();

    const [profileForm, setProfileForm] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        username: user?.username || '',
        email: user?.email || '',
        bio: user?.bio || ''
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [isSavingPw, setIsSavingPw] = useState(false);

    const handleSaveProfile = async () => {
        setIsSavingProfile(true);
        try {
            await userService.updateProfile(profileForm);
            showSuccess('Profile updated');
        } catch {
            showError('Failed to update profile');
        } finally {
            setIsSavingProfile(false);
        }
    };

    const [isSendingVerify, setIsSendingVerify] = useState(false);
    const handleSendVerification = async () => {
        setIsSendingVerify(true);
        try {
            await authService.sendVerificationEmail();
            showSuccess('Verification email sent — check your inbox');
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to send verification email');
        } finally {
            setIsSendingVerify(false);
        }
    };

    const handleSavePw = async () => {
        if (pwForm.newPassword !== pwForm.confirmPassword) { showError('Passwords do not match'); return; }
        if (pwForm.newPassword.length < 8) { showError('Password must be at least 8 characters'); return; }
        setIsSavingPw(true);
        try {
            await userService.changePassword(user._id || user.id, pwForm.currentPassword, pwForm.newPassword);
            showSuccess('Password changed');
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to change password');
        } finally {
            setIsSavingPw(false);
        }
    };

    return (
        <Container layout="flex-column" gap="lg" width="100%" maxWidth="560px" margin="auto">
            {/* Profile */}
            <Container layout="flex-column" gap="sm" width="100%">
                <Typography size="sm" weight="semibold">Profile</Typography>
                <Container layout="flex" gap="sm" padding="none" width="100%">
                    <Input size="sm" label="First Name" value={profileForm.firstName} onChange={e => setProfileForm(p => ({ ...p, firstName: e.target.value }))} flexFill />
                    <Input size="sm" label="Last Name" value={profileForm.lastName} onChange={e => setProfileForm(p => ({ ...p, lastName: e.target.value }))} flexFill />
                </Container>
                <Input size="sm" label="Username" value={profileForm.username} onChange={e => setProfileForm(p => ({ ...p, username: e.target.value }))} width="100%" />
                <Input size="sm" label="Email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} type="email" width="100%" />
                <Container layout="flex" align="center" gap="sm" padding="none" width="100%">
                    <Badge size="xs" color={user?.emailVerified ? 'success' : 'warning'}>
                        {user?.emailVerified ? 'Email verified' : 'Email not verified'}
                    </Badge>
                    {!user?.emailVerified && (
                        <Button size="xxs" color="secondary" onClick={handleSendVerification} disabled={isSendingVerify}>
                            <Icon name="FiMail" size="xs" />
                            {isSendingVerify ? 'Sending…' : 'Send verification email'}
                        </Button>
                    )}
                </Container>
                <Input size="sm" label="Bio" value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} multiline placeholder="Tell others about yourself…" width="100%" />
                <Container layout="flex" justify="end" padding="none" width="100%">
                    <Button size="sm" color="primary" onClick={handleSaveProfile} disabled={isSavingProfile}>
                        <Icon name={isSavingProfile ? 'FiLoader' : 'FiSave'} size="xs" />
                        {isSavingProfile ? 'Saving…' : 'Save Changes'}
                    </Button>
                </Container>
            </Container>

            <Divider color="surface" margin="xs" />

            {/* Password */}
            <Container layout="flex-column" gap="sm" width="100%">
                <Typography size="sm" weight="semibold">Change Password</Typography>
                <Input size="sm" label="Current Password" value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} type="password" width="100%" />
                <Input size="sm" label="New Password" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} type="password" width="100%" />
                <Input size="sm" label="Confirm New Password" value={pwForm.confirmPassword} onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))} type="password" width="100%" />
                <Container layout="flex" justify="end" padding="none" width="100%">
                    <Button size="sm" color="primary" onClick={handleSavePw} disabled={isSavingPw || !pwForm.currentPassword || !pwForm.newPassword}>
                        <Icon name={isSavingPw ? 'FiLoader' : 'FiLock'} size="xs" />
                        {isSavingPw ? 'Saving…' : 'Update Password'}
                    </Button>
                </Container>
            </Container>
        </Container>
    );
};

// ─── Security Tab (2FA + Devices) ────────────────────────────────────────────

const SecurityTab = () => {
    const { success: showSuccess, error: showError } = useNotification();

    // 2FA state
    const [status, setStatus] = useState(null);
    const [isLoading2FA, setIsLoading2FA] = useState(true);
    const [qrData, setQrData] = useState(null);
    const [verifyToken, setVerifyToken] = useState('');
    const [disableForm, setDisableForm] = useState({ password: '', token: '' });
    const [backupCodes, setBackupCodes] = useState(null);

    // Devices state
    const [devices, setDevices] = useState([]);
    const [isLoadingDevices, setIsLoadingDevices] = useState(true);

    const load2FAStatus = useCallback(async () => {
        setIsLoading2FA(true);
        try {
            const res = await authService.get2FAStatus();
            setStatus(res);
        } catch {
            // non-critical
        } finally {
            setIsLoading2FA(false);
        }
    }, []);

    useEffect(() => {
        load2FAStatus();
        (async () => {
            setIsLoadingDevices(true);
            try {
                const res = await authService.getDevices();
                setDevices(res?.devices || []);
            } catch {
                // non-critical
            } finally {
                setIsLoadingDevices(false);
            }
        })();
    }, [load2FAStatus]);

    const setupInFlight = React.useRef(false);
    const handleSetup = async () => {
        // One secret per setup session: a second concurrent call would
        // overwrite the cached secret while the first QR is on screen
        if (setupInFlight.current) return;
        setupInFlight.current = true;
        try {
            const res = await authService.setup2FA();
            setQrData(res);
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to initiate 2FA setup');
        } finally {
            setupInFlight.current = false;
        }
    };

    const handleVerifySetup = async () => {
        try {
            const res = await authService.verifySetup2FA(verifyToken);
            showSuccess('Two-factor authentication enabled — save your backup codes');
            // Surface the one-time backup codes in the Backup Codes genie
            setBackupCodes(res?.backupCodes || null);
            setQrData(null); setVerifyToken('');
            load2FAStatus();
        } catch (err) {
            showError(err?.response?.data?.message || 'Invalid token — please try again');
        }
    };

    const handleDisable = async () => {
        try {
            await authService.disable2FA(disableForm.password, disableForm.token);
            showSuccess('Two-factor authentication disabled');
            setDisableForm({ password: '', token: '' });
            load2FAStatus();
        } catch { showError('Failed to disable 2FA — check your password and token'); }
    };

    const handleGetBackupCodes = async () => {
        try {
            const res = await authService.getBackupCodes(disableForm.password, disableForm.token);
            setBackupCodes(res?.backupCodes || []);
        } catch { showError('Failed to retrieve backup codes'); }
    };

    const isEnabled = status?.enabled;

    const credentialFields = (
        <>
            <Input size="sm" label="Password" type="password" value={disableForm.password}
                onChange={e => setDisableForm(p => ({ ...p, password: e.target.value }))} width="100%" />
            <Input size="sm" label="2FA Code" value={disableForm.token} placeholder="000000" maxLength={6}
                onChange={e => setDisableForm(p => ({ ...p, token: e.target.value }))} width="100%" />
        </>
    );

    const setupGenie = (
        <Container layout="flex-column" gap="sm" padding="md" width="300px">
            {!qrData ? (
                <Container layout="flex" align="center" gap="sm" padding="none">
                    <CircularProgress size="xs" />
                    <Typography size="xs" color="secondary">Preparing setup…</Typography>
                </Container>
            ) : (
                <>
                    <Typography size="xs" weight="medium">1. Scan this QR code with your authenticator app</Typography>
                    {qrData.qrCode && <img src={qrData.qrCode} alt="2FA QR Code" style={{ width: 160, height: 160, alignSelf: 'center' }} />}
                    {qrData.manualEntryKey && (
                        <>
                            <Typography size="xxs" color="secondary">Manual entry key:</Typography>
                            <Container backgroundColor="surface" padding="xs" width="100%">
                                <Typography size="xxs" font="monospace" style={{ userSelect: 'all', wordBreak: 'break-all' }}>{qrData.manualEntryKey}</Typography>
                            </Container>
                        </>
                    )}
                    <Typography size="xs" weight="medium">2. Enter the 6-digit code from your app</Typography>
                    <Input size="sm" value={verifyToken} onChange={e => setVerifyToken(e.target.value)} placeholder="000000" maxLength={6} width="100%" />
                    <Button size="sm" color="primary" onClick={handleVerifySetup} disabled={verifyToken.length !== 6} width="100%">
                        Verify & Enable
                    </Button>
                </>
            )}
        </Container>
    );

    const disableGenie = (
        <Container layout="flex-column" gap="sm" padding="md" width="280px">
            <Typography size="xs" weight="medium">Confirm with your password and current code</Typography>
            {credentialFields}
            <Button size="sm" color="error" onClick={handleDisable} disabled={!disableForm.password || !disableForm.token} width="100%">
                Disable 2FA
            </Button>
        </Container>
    );

    const backupGenie = (
        <Container layout="flex-column" gap="sm" padding="md" width="280px">
            {backupCodes ? (
                <>
                    <Typography size="xs" weight="semibold">Backup codes</Typography>
                    <Typography size="xxs" color="secondary">Each code can be used once — store them safely.</Typography>
                    <Container layout="flex-column" gap="none" backgroundColor="surface" padding="sm" width="100%">
                        {backupCodes.map((code, i) => (
                            <Typography key={i} size="xs" font="monospace" style={{ userSelect: 'all' }}>{code}</Typography>
                        ))}
                    </Container>
                    <Button size="sm" color="secondary" onClick={() => setBackupCodes(null)} width="100%">Done</Button>
                </>
            ) : (
                <>
                    <Typography size="xs" weight="medium">Confirm with your password and current code</Typography>
                    {credentialFields}
                    <Button size="sm" color="primary" onClick={handleGetBackupCodes} disabled={!disableForm.password || !disableForm.token} width="100%">
                        Get codes
                    </Button>
                </>
            )}
        </Container>
    );

    return (
        <Container layout="flex-column" gap="lg" width="100%" maxWidth="760px" margin="auto">
            {/* 2FA */}
            <Container layout="flex-column" gap="sm" width="100%">
                <Container layout="flex" justify="between" align="center" width="100%" wrap={false}>
                    <Container layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                        <Typography size="sm" weight="semibold">Two-Factor Authentication</Typography>
                        {isLoading2FA
                            ? <CircularProgress size="xs" />
                            : <Badge size="sm" color={isEnabled ? 'success' : 'secondary'}>{isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                        }
                    </Container>
                    {!isLoading2FA && (
                        <Container layout="flex" gap="sm" padding="none" wrap={false}>
                            {!isEnabled ? (
                                <Button
                                    size="sm" color="primary" genie={setupGenie} genieTrigger="click"
                                    onGenieShow={() => { if (!qrData) handleSetup(); }}
                                >
                                    <Icon name="FiShield" size="xs" />Enable 2FA
                                </Button>
                            ) : (
                                <>
                                    <Button size="sm" color="error" genie={disableGenie} genieTrigger="click">
                                        <Icon name="FiShieldOff" size="xs" />Disable 2FA
                                    </Button>
                                    <Button size="sm" color="secondary" genie={backupGenie} genieTrigger="click">
                                        <Icon name="FiKey" size="xs" />Backup Codes
                                    </Button>
                                </>
                            )}
                        </Container>
                    )}
                </Container>

                {!isLoading2FA && (
                    <Typography size="xs" color="secondary">
                        {isEnabled
                            ? 'Your account is secured with 2FA. You will need your authenticator app to sign in.'
                            : 'Add an extra layer of security by enabling two-factor authentication.'}
                    </Typography>
                )}
            </Container>

            <Divider color="surface" margin="xs" />

            {/* Devices */}
            <Container layout="flex-column" gap="sm" width="100%">
                <Typography size="sm" weight="semibold">Trusted Devices</Typography>
                <Typography size="xs" color="secondary">Devices that have signed in to your account</Typography>
                {isLoadingDevices
                    ? <CircularProgress size="sm" />
                    : devices.length === 0
                        ? <Typography size="xs" color="secondary">No device history available</Typography>
                        : (
                            <Data
                                data={devices.map(d => ({
                                    device: [d.browser, d.os].filter(Boolean).join(' on ') || 'Unknown Device',
                                    ipAddress: d.ipAddress || '—',
                                    location: [d.location?.city, d.location?.country].filter(Boolean).join(', ') || '—',
                                    lastSeen: d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—'
                                }))}
                                variant="table"
                                size="xxs"
                                sortable={false}
                                searchable={false}
                                filterable={false}
                                paginated={false}
                                width="100%"
                            />
                        )
                }
            </Container>
        </Container>
    );
};

// ─── Role Elevation Tab ───────────────────────────────────────────────────────

const RoleTab = ({ user }) => {
    const { success: showSuccess, error: showError } = useNotification();
    const { reloadUser } = useAuth();
    const [selectedRole, setSelectedRole] = useState('CREATOR');
    const [reason, setReason] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleRequest = async () => {
        if (!reason.trim()) {
            showError('Please provide a reason for the role request');
            return;
        }
        setIsSending(true);
        try {
            await authService.requestRoleElevation([selectedRole], reason);
            showSuccess('Role elevation request submitted');
            setReason('');
            await reloadUser();
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to submit role request');
        } finally {
            setIsSending(false);
        }
    };

    const ROLE_INFO = {
        CREATOR: { label: 'Creator', desc: 'Allows creating and sharing public content.' },
        ADMIN: { label: 'Admin', desc: 'Manage users and moderate content.' },
        OWNER: { label: 'Owner', desc: 'Full platform access.' }
    };

    const isPending = user?.roleApprovalStatus === 'PENDING';
    const isRejected = user?.roleApprovalStatus === 'REJECTED';

    return (
        <Container layout="flex-column" gap="md">
            <Container layout="flex" justify="between" align="center">
                <Typography size="sm" weight="semibold">Role Elevation</Typography>
                <Container layout="flex" gap="sm">
                    {user?.roles?.map(r => (
                        <Badge key={r} size="sm" color={r === 'OWNER' ? 'primary' : r === 'ADMIN' ? 'warning' : r === 'CREATOR' ? 'tertiary' : 'secondary'}>{r}</Badge>
                    ))}
                </Container>
            </Container>

            {isPending && (
                <Card padding="md" color="warning">
                    <Container layout="flex" align="center" gap="sm">
                        <Icon name="FiClock" size="sm" />
                        <Container layout="flex-column" gap="xs">
                            <Typography size="sm" weight="semibold">Request pending approval</Typography>
                            <Typography size="xs" color="secondary">
                                Requested: {user.pendingRoles?.join(', ')}
                            </Typography>
                            {user.roleApprovalRequest?.reason && (
                                <Typography size="xs" color="secondary">
                                    Reason: {user.roleApprovalRequest.reason}
                                </Typography>
                            )}
                        </Container>
                    </Container>
                </Card>
            )}

            {isRejected && (
                <Card padding="md" color="error">
                    <Container layout="flex" align="center" gap="sm">
                        <Icon name="FiXCircle" size="sm" />
                        <Container layout="flex-column" gap="xs">
                            <Typography size="sm" weight="semibold">Previous request was rejected</Typography>
                            {user.roleApprovalRequest?.reason && (
                                <Typography size="xs" color="secondary">Reason: {user.roleApprovalRequest.reason}</Typography>
                            )}
                        </Container>
                    </Container>
                </Card>
            )}

            {!isPending && (
                <Container layout="flex-column" gap="sm">
                    <Typography size="xs" color="secondary">
                        Request access to a higher role. Your request will be reviewed by an administrator.
                    </Typography>
                    <Container layout="flex" gap="sm" align="stretch">
                        {Object.entries(ROLE_INFO).map(([role, info]) => (
                            <Card
                                key={role}
                                padding="sm"
                                flexFill
                                style={{ cursor: 'pointer', border: selectedRole === role ? '2px solid var(--primary-color)' : '2px solid transparent' }}
                                onClick={() => setSelectedRole(role)}
                            >
                                <Container layout="flex-column" gap="xs">
                                    <Typography size="xs" weight="semibold">{info.label}</Typography>
                                    <Typography size="xs" color="secondary">{info.desc}</Typography>
                                </Container>
                            </Card>
                        ))}
                    </Container>
                    <Input
                        size="sm"
                        label="Reason"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Why do you need this role?"
                        multiline
                        width="100%"
                    />
                    <Container layout="flex" justify="end" padding="none" width="100%">
                        <Button size="sm" color="primary" onClick={handleRequest} disabled={isSending || !reason.trim()}>
                            <Icon name={isSending ? 'FiLoader' : 'FiArrowUp'} size="xs" />
                            {isSending ? 'Submitting…' : 'Submit Request'}
                        </Button>
                    </Container>
                </Container>
            )}
        </Container>
    );
};

// ─── Integrations Tab (external apps) ────────────────────────────────────────

const STATUS_META = {
    verified: { color: 'success',   label: 'Verified',  icon: 'FiCheckCircle' },
    pending:  { color: 'warning',   label: 'Pending verification', icon: 'FiClock' },
    disabled: { color: 'secondary', label: 'Disabled',  icon: 'FiSlash' }
};

const EMPTY_FORM = { name: '', description: '', baseUrl: '', apiKey: '', apiKeyHeader: 'X-Api-Key', scope: 'user' };

// ─── Secret reveal (shown exactly once after create/rotate) ──────────────────

const SecretReveal = ({
    secret,
    onDismiss,
    title = 'Signing secret — copy it now, it will not be shown again',
    description = 'Configure your external app with this secret so it can verify that deliveries really come from FilesystemOne (HMAC-SHA256 signature in the X-FSOne-Signature header).'
}) => (
    <Card padding="md" color="warning">
        <Container layout="flex-column" gap="sm">
            <Container layout="flex" align="center" gap="sm">
                <Icon name="FiKey" size="sm" />
                <Typography size="sm" weight="semibold">{title}</Typography>
            </Container>
            <Typography size="xs" color="secondary">
                {description}
            </Typography>
            <Container backgroundColor="surface" padding="xs">
                <Typography size="xs" font="monospace" style={{ userSelect: 'all', wordBreak: 'break-all' }}>{secret}</Typography>
            </Container>
            <Container layout="flex">
                <ButtonGroup spaced selectable={false} justify="start">
                    <Button size="sm" color="secondary" onClick={() => navigator.clipboard?.writeText(secret)}>
                        <Icon name="FiCopy" size="xs" />Copy
                    </Button>
                    <Button size="sm" onClick={onDismiss}>Done</Button>
                </ButtonGroup>
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
                        <Typography size="xs" truncate style={{ flex: 1 }}>{d.filePath}</Typography>
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
    const [showInbound, setShowInbound] = useState(false);
    const [grantInput, setGrantInput] = useState('');

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
        if (res?.signingSecret) onSecret({ secret: res.signingSecret });
    };

    const handleDisable = () => run(() => integrationService.disableIntegration(integration.id), 'Integration disabled');
    const handleDelete = () => run(() => integrationService.deleteIntegration(integration.id), 'Integration deleted');

    const handleIssueInboundKey = async () => {
        const res = await run(() => integrationService.issueInboundKey(integration.id), 'Inbound API key issued');
        if (res?.inboundKey) {
            onSecret({
                secret: res.inboundKey,
                title: 'Inbound API key — copy it now, it will not be shown again',
                description: 'The external app sends this key in the X-FSOne-Key header to pull granted files from FilesystemOne (GET /api/v1/integrations/external/files?path=…&content=true).'
            });
        }
    };

    const handleAddGrant = () => {
        const path = grantInput.trim();
        if (!path.startsWith('/')) { showError('Grant paths must start with /'); return; }
        const next = [...(integration.grants || []), { path, access: 'read' }];
        run(() => integrationService.setGrants(integration.id, next), `Granted read access to ${path}`);
        setGrantInput('');
    };

    const handleRemoveGrant = (path) => {
        const next = (integration.grants || []).filter(g => g.path !== path);
        run(() => integrationService.setGrants(integration.id, next), `Removed grant for ${path}`);
    };

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
                        <Button size="sm" color="secondary" onClick={() => setShowInbound(s => !s)} disabled={isBusy}>
                            <Icon name="FiDownload" size="xs" />{showInbound ? 'Hide inbound' : 'Inbound access'}
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

                {showInbound && canManage && (
                    <>
                        <Divider color="surface" margin="xs" />
                        <Container layout="flex-column" gap="sm" padding="none">
                            <Container layout="flex" align="center" justify="between" padding="none" wrap gap="sm">
                                <Container layout="flex-column" gap="none" padding="none">
                                    <Typography size="sm" weight="semibold">Inbound access</Typography>
                                    <Typography size="xs" color="secondary">
                                        Let this app pull granted files with its API key — access is limited to the paths below.
                                    </Typography>
                                </Container>
                                <Button size="xs" color="primary" onClick={handleIssueInboundKey} disabled={isBusy}>
                                    <Icon name="FiKey" size="xs" />
                                    {integration.inboundKeyIssuedAt ? 'Rotate inbound key' : 'Issue inbound key'}
                                </Button>
                            </Container>

                            {integration.inboundKeyIssuedAt && (
                                <Typography size="xs" color="secondary">
                                    Key issued {new Date(integration.inboundKeyIssuedAt).toLocaleString()}
                                    {integration.inboundStats?.totalRequests > 0 &&
                                        ` · ${integration.inboundStats.totalRequests} request${integration.inboundStats.totalRequests === 1 ? '' : 's'} (${integration.inboundStats.deniedRequests || 0} denied)`}
                                </Typography>
                            )}

                            <Container layout="flex" gap="xs" padding="none" wrap>
                                {(integration.grants || []).length === 0 && (
                                    <Typography size="xs" color="secondary">No grants yet — the app cannot read anything until you add a path.</Typography>
                                )}
                                {(integration.grants || []).map(g => (
                                    <Badge key={g.path} size="sm" color="tertiary">
                                        <Container layout="flex" align="center" gap="xs" padding="none" wrap={false}>
                                            <Typography as="span" size="xs" font="monospace">{g.path}</Typography>
                                            <Icon name="FiX" size="xs" style={{ cursor: 'pointer' }} onClick={() => handleRemoveGrant(g.path)} />
                                        </Container>
                                    </Badge>
                                ))}
                            </Container>

                            <Container layout="flex" gap="sm" padding="none" align="center" wrap={false}>
                                <Input
                                    placeholder="/folder/or/file/path"
                                    value={grantInput}
                                    onChange={e => setGrantInput(e.target.value)}
                                    width="100%"
                                    flexFill
                                />
                                <Button size="sm" color="secondary" onClick={handleAddGrant} disabled={isBusy || !grantInput.trim()}>
                                    <Icon name="FiPlus" size="xs" />Grant
                                </Button>
                            </Container>
                        </Container>
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
            setRevealedSecret({ secret: res.signingSecret });
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
                    <Typography size="sm" weight="semibold">External App Integrations</Typography>
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
                <SecretReveal {...revealedSecret} onDismiss={() => setRevealedSecret(null)} />
            )}

            {/* Registration form */}
            {showForm && (
                <Card padding="md" backgroundColor="surface">
                    <Container layout="flex-column" gap="md">
                        <Typography size="sm" weight="semibold">Register external endpoint</Typography>
                        <Input size="sm" label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My other app" width="100%" />
                        <Input size="sm" label="Endpoint URL (HTTPS)" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder="https://my-app.example.com/api/v1/fsone/receive" width="100%" />
                        <Input size="sm" label="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} width="100%" />
                        <Container layout="flex" gap="md">
                            <Input size="sm" label="API key (optional)" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} type="password" flexFill />
                            <Input size="sm" label="API key header" value={form.apiKeyHeader} onChange={e => setForm(f => ({ ...f, apiKeyHeader: e.target.value }))} flexFill />
                        </Container>
                        {isAdmin && (
                            <Container layout="flex" gap="sm" align="center">
                                <Typography size="xs" color="secondary">Scope:</Typography>
                                <Button size="sm" color="primary" selected={form.scope === 'user'} onClick={() => setForm(f => ({ ...f, scope: 'user' }))}>Personal</Button>
                                <Button size="sm" color="primary" selected={form.scope === 'global'} onClick={() => setForm(f => ({ ...f, scope: 'global' }))}>Global (all users)</Button>
                            </Container>
                        )}
                        <Container layout="flex">
                            <ButtonGroup spaced selectable={false} justify="start">
                                <Button color="primary" onClick={handleCreate} disabled={isSubmitting}>
                                    <Icon name={isSubmitting ? 'FiLoader' : 'FiPlus'} size="xs" />
                                    {isSubmitting ? 'Registering…' : 'Register'}
                                </Button>
                                <Button color="secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} disabled={isSubmitting}>Cancel</Button>
                            </ButtonGroup>
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

// ─── Appearance Tab (themes & personalisation) ───────────────────────────────

const failText = (error, fallback) => error?.response?.data?.message || fallback;

const Section = ({ title, note, action, children }) => (
    <Container layout="flex-column" gap="sm" padding="none" width="100%">
        <Container layout="flex" justify="between" align="center" gap="sm" padding="none" width="100%">
            <Container layout="flex-column" gap="none" padding="none">
                <Typography as="h3" size="sm" weight="semibold">{title}</Typography>
                {note && <Typography size="xs" color="muted">{note}</Typography>}
            </Container>
            {action}
        </Container>
        {children}
    </Container>
);

const BUILT_IN = ['modern', 'dark', 'minimal', 'vibrant', 'admin', 'pink'];
const COLOR_FIELDS = [
    ['primary', 'Primary'], ['primaryAccent', 'Primary accent'],
    ['secondary', 'Secondary'], ['secondaryAccent', 'Secondary accent'],
    ['tertiary', 'Tertiary'], ['tertiaryAccent', 'Tertiary accent'],
    ['success', 'Success'], ['warning', 'Warning'], ['error', 'Error'],
    ['background', 'Background'], ['surface', 'Surface'], ['surfaceAccent', 'Surface accent'],
    ['border', 'Border'], ['text', 'Text'], ['textContrast', 'Contrast text']
];
const RADII_FIELDS = [
    ['base', 'Base'], ['card', 'Cards'], ['input', 'Inputs'], ['button', 'Buttons'],
    ['checkbox', 'Checkboxes'], ['fab', 'Round buttons'], ['progress', 'Progress bars'], ['notification', 'Notifications']
];
const NEW_THEME = {
    name: '', slug: '', description: '', visibility: 'private', darkMode: false,
    colors: {
        primary: '#12355B', primaryAccent: '#1A4A7A', secondary: '#FF570A', secondaryAccent: '#CC4000',
        tertiary: '#A5D8FF', tertiaryAccent: '#70BFFF', success: '#1E7A3A', warning: '#E88500', error: '#CC2200',
        background: '#FFFFFF', surface: '#EAF5FF', surfaceAccent: '#C8EAFF', border: '#A5D8FF', text: '#12355B', textContrast: '#FFFFFF'
    },
    fonts: { primary: 'urbanist', secondary: 'montserrat-alternates', monospace: 'jetbrains-mono' },
    radii: { base: '0.375rem', card: '0.5rem', input: '0.375rem', button: '0.375rem', checkbox: '0.25rem', fab: '50%', progress: '9999px', notification: '0.5rem' }
};
const slugify = (value = '') => value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50);
const idOf = (doc) => doc.id || doc._id;
const fontOptions = (kind) => listFontKeys(kind).map((key) => ({ value: key, label: key }));

const Swatches = ({ colors }) => (
    <Container layout="flex" gap="none" padding="none" wrap={false}>
        {colors.filter(Boolean).map((color, index) => (
            <Input key={index} type="color" size="xxs" width="26px" value={color} disabled aria-label={`Colour ${color}`} />
        ))}
    </Container>
);
const swatchesOf = (doc) => {
    const colors = doc?.tokens?.colors || {};
    return [colors.primary, colors.secondary, colors.tertiary, colors.background, colors.surface];
};

const ThemePreview = ({ theme }) => (
    <Container theme={theme} layout="flex" align="center" gap="xs" padding="sm" width="100%" backgroundColor="background" wrap={false}>
        <Button size="xxs" color="primary">Aa</Button>
        <Button size="xxs" color="secondary">Aa</Button>
        <Badge size="xs" color="tertiary">Tag</Badge>
        <Typography size="xxs" color="muted">Sample text</Typography>
    </Container>
);

const ThemeEditor = ({ initial, editingId, onSaved, onCancel }) => {
    const { success, error: notifyError } = useNotification();
    const [form, setForm] = useState(initial || NEW_THEME);
    const [slugTouched, setSlugTouched] = useState(Boolean(editingId));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        ensureFontsLoaded(listFontKeys());
    }, []);

    const part = (group, key, value) => setForm((now) => ({ ...now, [group]: { ...now[group], [key]: value } }));

    const save = async () => {
        if (!form.name.trim() || !form.slug.trim()) {
            notifyError('A theme needs a name and a short name.');
            return;
        }
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            slug: form.slug,
            description: form.description.trim(),
            visibility: form.visibility,
            tokens: { darkMode: form.darkMode, colors: form.colors, fonts: form.fonts, ...(form.radii ? { radii: form.radii } : {}) },
            ...(form.forkedFrom ? { forkedFrom: form.forkedFrom } : {})
        };
        try {
            const result = editingId ? await themeService.updateTheme(editingId, payload) : await themeService.createTheme(payload);
            success(editingId ? 'Theme updated.' : 'Theme created.');
            onSaved(result.theme);
        } catch (error) {
            notifyError(failText(error, 'The theme could not be saved.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card layout="flex-column" gap="sm" padding="md" hover={false} shadow={false} borderColor="primary" width="100%">
            <Container layout="flex" align="center" justify="between" gap="sm" padding="none" width="100%">
                <Typography size="sm" weight="semibold">
                    {editingId ? 'Edit theme' : form.forkedFrom ? `Copy of ${form.forkedFromName || 'theme'}` : 'New theme'}
                </Typography>
                <Swatches colors={[form.colors.primary, form.colors.secondary, form.colors.tertiary, form.colors.background, form.colors.surface]} />
            </Container>
            <Container layout="grid" columns={2} gap="sm" padding="none" width="100%">
                <Input
                    size="sm"
                    label="Name"
                    value={form.name}
                    width="100%"
                    onChange={(event) => {
                        const name = event.target.value;
                        setForm((now) => ({ ...now, name, slug: slugTouched ? now.slug : slugify(name) }));
                    }}
                />
                <Input
                    size="sm"
                    label="Short name (used in links)"
                    value={form.slug}
                    width="100%"
                    onChange={(event) => { setSlugTouched(true); setForm((now) => ({ ...now, slug: slugify(event.target.value) })); }}
                />
            </Container>
            <Input size="sm" label="Description (optional)" value={form.description} width="100%" onChange={(event) => setForm((now) => ({ ...now, description: event.target.value }))} />
            <Container layout="flex" gap="md" align="end" padding="none">
                <Select
                    label="Who can see it"
                    width="260px"
                    options={[
                        { value: 'private', label: 'Private: only you' },
                        { value: 'unlisted', label: 'Unlisted: anyone with the link' },
                        { value: 'public', label: 'Public: listed for everyone' }
                    ]}
                    value={form.visibility}
                    onChange={(value) => setForm((now) => ({ ...now, visibility: value }))}
                />
                <Switch label="Dark theme" checked={form.darkMode} onChange={(event) => setForm((now) => ({ ...now, darkMode: event.target.checked }))} />
            </Container>

            <Divider color="surface" margin="xs" />
            <Typography size="xs" weight="semibold">Colours</Typography>
            <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                {COLOR_FIELDS.map(([key, label]) => (
                    <Container key={key} layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                        <Input type="color" size="sm" width="48px" value={form.colors[key] || '#000000'} onChange={(event) => part('colors', key, event.target.value)} aria-label={label} />
                        <Container layout="flex-column" gap="none" padding="none" minWidth="0">
                            <Typography size="xs" weight="medium">{label}</Typography>
                            <Typography size="xxs" color="muted" font="monospace">{form.colors[key]}</Typography>
                        </Container>
                    </Container>
                ))}
            </Container>

            <Divider color="surface" margin="xs" />
            <Typography size="xs" weight="semibold">Fonts</Typography>
            <Container layout="grid" columns={3} gap="sm" padding="none" width="100%">
                <Select label="Main text" options={fontOptions('sans')} value={form.fonts.primary} onChange={(value) => part('fonts', 'primary', value)} width="100%" />
                <Select label="Headings" options={fontOptions()} value={form.fonts.secondary} onChange={(value) => part('fonts', 'secondary', value)} width="100%" />
                <Select label="Code" options={fontOptions('mono')} value={form.fonts.monospace} onChange={(value) => part('fonts', 'monospace', value)} width="100%" />
            </Container>

            <Divider color="surface" margin="xs" />
            <Typography size="xs" weight="semibold">Corners</Typography>
            <Typography size="xxs" color="muted">Any CSS length works: 0 for sharp, 9999px for pills, 50% for circles.</Typography>
            <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                {RADII_FIELDS.map(([key, label]) => (
                    <Input key={key} size="sm" label={label} value={form.radii?.[key] ?? ''} placeholder={NEW_THEME.radii[key]} onChange={(event) => part('radii', key, event.target.value)} width="100%" />
                ))}
            </Container>

            <Container layout="flex" gap="xs" padding="none">
                <Button size="sm" disabled={saving} onClick={save}><Icon name="FiSave" size="xs" />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create theme'}</Button>
                <Button size="sm" color="secondary" disabled={saving} onClick={onCancel}>Cancel</Button>
            </Container>
        </Card>
    );
};

const ThemeCard = ({ doc, applied, onApply, onFork, onEdit, onDelete }) => (
    <Card layout="flex-column" gap="xs" padding="sm" hover={false} shadow={false} minWidth="0" borderColor={applied ? 'primary' : null}>
        <Container layout="flex" align="center" gap="xs" padding="none" width="100%" wrap={false}>
            <Typography size="sm" weight="semibold" truncate>{doc.name}</Typography>
            {applied && <Badge size="xs" color="success">In use</Badge>}
            {!doc.isPreset && doc.visibility && doc.visibility !== 'private' && <Badge size="xs" color="tertiary">{doc.visibility}</Badge>}
        </Container>
        {doc.description && <Typography size="xs" color="muted" truncate>{doc.description}</Typography>}
        <Swatches colors={swatchesOf(doc)} />
        <Container layout="flex" gap="xs" padding="none">
            <Button size="xs" disabled={applied} onClick={onApply}><Icon name="FiCheck" size="xs" />{applied ? 'In use' : 'Use'}</Button>
            {onFork && <Button size="xs" color="secondary" onClick={onFork}><Icon name="FiCopy" size="xs" />Copy</Button>}
            {onEdit && <Button size="xs" color="secondary" onClick={onEdit}><Icon name="FiEdit2" size="xs" />Edit</Button>}
            {onDelete && <Button size="xs" color="error" onClick={onDelete}><Icon name="FiTrash2" size="xs" />Delete</Button>}
        </Container>
    </Card>
);

const AppearanceTab = ({ user }) => {
    const { currentTheme, switchTheme, applyCustomTheme, clearCustomTheme, customTheme, themes } = useTheme();
    const { success, error: notifyError } = useNotification();
    const [presets, setPresets] = useState([]);
    const [mine, setMine] = useState([]);
    const [shared, setShared] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editor, setEditor] = useState(null);
    const canCreate = ['CREATOR', 'SUPER_CREATOR', 'ADMIN', 'OWNER'].some((name) => (user?.roles || []).includes(name));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [presetResult, mineResult, publicResult] = await Promise.all([
                themeService.getPresets().catch(() => ({ themes: [] })),
                themeService.getMyThemes().catch(() => ({ themes: [] })),
                themeService.getPublicThemes({ limit: 12 }).catch(() => ({ themes: [] }))
            ]);
            setPresets(presetResult.themes || []);
            setMine(mineResult.themes || []);
            const own = new Set((mineResult.themes || []).map((doc) => String(idOf(doc))));
            setShared((publicResult.themes || []).filter((doc) => !own.has(String(idOf(doc)))));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const draftFrom = (doc, fork) => {
        const tokens = doc.tokens || {};
        return {
            name: fork ? `${doc.name} (copy)` : doc.name,
            slug: fork ? slugify(`${doc.slug}-copy`) : doc.slug,
            description: doc.description || '',
            visibility: fork ? 'private' : doc.visibility || 'private',
            darkMode: Boolean(tokens.darkMode),
            colors: { ...NEW_THEME.colors, ...(tokens.colors || {}) },
            fonts: { ...NEW_THEME.fonts, ...(tokens.fonts || {}) },
            radii: { ...NEW_THEME.radii, ...(tokens.radii || {}) },
            ...(fork ? { forkedFrom: idOf(doc), forkedFromName: doc.name } : {})
        };
    };
    const openFork = (doc) => setEditor({ initial: draftFrom(doc, true), editingId: null });
    const openEdit = (doc) => setEditor({ initial: draftFrom(doc, false), editingId: idOf(doc) });

    const remove = async (doc) => {
        try {
            await themeService.deleteTheme(idOf(doc));
            success(`Theme "${doc.name}" deleted.`);
            if (customTheme?.slug === doc.slug) clearCustomTheme();
            load();
        } catch (error) {
            notifyError(failText(error, 'The theme could not be deleted.'));
        }
    };

    const saved = (theme) => {
        setEditor(null);
        load();
        if (theme && customTheme && theme.slug === customTheme.slug) applyCustomTheme(theme);
    };

    const usingCustom = (doc) => customTheme?.slug === doc.slug && currentTheme === `custom-${doc.slug}`;
    const applyDoc = (doc) => {
        applyCustomTheme(doc);
        success(`Theme "${doc.name}" is in use.`);
    };

    return (
        <Container layout="flex-column" gap="md" padding="none" width="100%">
            <Section title="Built-in themes" note="Use one as it is, or copy it as the start of your own.">
                <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                    {BUILT_IN.map((slug) => {
                        const preset = presets.find((doc) => doc.slug === slug);
                        const applied = currentTheme === slug;
                        return (
                            <Card key={slug} layout="flex-column" gap="xs" padding="sm" hover={false} shadow={false} minWidth="0" borderColor={applied ? 'primary' : null}>
                                <Container layout="flex" align="center" justify="between" padding="none" width="100%" wrap={false}>
                                    <Typography size="sm" weight="semibold">{themes?.[slug]?.name || slug}</Typography>
                                    {applied && <Badge size="xs" color="success">In use</Badge>}
                                </Container>
                                <ThemePreview theme={slug} />
                                <Container layout="flex" gap="xs" padding="none" wrap={false}>
                                    <Button size="xs" disabled={applied} onClick={() => switchTheme(slug)}><Icon name="FiCheck" size="xs" />{applied ? 'In use' : 'Use'}</Button>
                                    {canCreate && preset && <Button size="xs" color="secondary" onClick={() => openFork(preset)}><Icon name="FiCopy" size="xs" />Copy</Button>}
                                </Container>
                            </Card>
                        );
                    })}
                </Container>
            </Section>

            <Divider color="surface" margin="xs" />

            <Section
                title="My themes"
                note={canCreate ? null : 'Making your own themes needs a Creator role or above. Ask for one under Roles.'}
                action={canCreate && !editor ? (
                    <Button size="sm" onClick={() => setEditor({ initial: null, editingId: null })}><Icon name="FiPlus" size="xs" />New theme</Button>
                ) : null}
            >
                {editor && <ThemeEditor initial={editor.initial} editingId={editor.editingId} onSaved={saved} onCancel={() => setEditor(null)} />}
                {loading && <CircularProgress size="sm" />}
                {!loading && mine.length === 0 && !editor && <Typography size="xs" color="muted">No themes of your own yet.</Typography>}
                {!loading && mine.length > 0 && (
                    <Container layout="grid" columns="auto" gap="sm" padding="none" width="100%">
                        {mine.map((doc) => (
                            <ThemeCard
                                key={idOf(doc)}
                                doc={doc}
                                applied={usingCustom(doc)}
                                onApply={() => applyDoc(doc)}
                                onFork={canCreate ? () => openFork(doc) : null}
                                onEdit={canCreate ? () => openEdit(doc) : null}
                                onDelete={canCreate ? () => remove(doc) : null}
                            />
                        ))}
                    </Container>
                )}
            </Section>

            {shared.length > 0 && (
                <>
                    <Divider color="surface" margin="xs" />
                    <Section title="Shared themes" note="Public themes made by other people.">
                        <Container layout="grid" columns="auto" gap="sm" padding="none" width="100%">
                            {shared.map((doc) => (
                                <ThemeCard key={idOf(doc)} doc={doc} applied={usingCustom(doc)} onApply={() => applyDoc(doc)} onFork={canCreate ? () => openFork(doc) : null} />
                            ))}
                        </Container>
                    </Section>
                </>
            )}
        </Container>
    );
};

// ─── SettingsPage ─────────────────────────────────────────────────────────────

const TABS = [
    { id: 'appearance',   label: 'Appearance',   icon: 'FiDroplet',   desc: 'Themes and personalisation' },
    { id: 'account',      label: 'Account',      icon: 'FiUser',      desc: 'Profile and password' },
    { id: 'security',     label: 'Security',     icon: 'FiShield',    desc: '2FA and devices' },
    { id: 'roles',        label: 'Roles',        icon: 'FiBriefcase', desc: 'Access levels' },
    { id: 'integrations', label: 'Integrations', icon: 'FiLink',      desc: 'Connect external apps' },
];

const SettingsPage = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const urlTab = searchParams.get('tab');
    const tab = TABS.some(t => t.id === urlTab) ? urlTab : 'appearance';
    const setTab = (id) => setSearchParams({ tab: id }, { replace: true });

    const active = TABS.find(t => t.id === tab);

    const renderTab = () => {
        switch (tab) {
            case 'appearance':   return <AppearanceTab user={user} />;
            case 'account':      return <AccountTab user={user} />;
            case 'security':     return <SecurityTab />;
            case 'roles':        return <RoleTab user={user} />;
            case 'integrations': return <IntegrationsTab />;
            default:             return null;
        }
    };

    return (
        <Page layout="flex-column" padding="none" gap="none" background="diagonal" backgroundFade="bottom">
            <Container
                layout="flex-column" gap="lg" padding="none" width="100%" maxWidth="1200px"
                style={{ margin: '0 auto', padding: 'clamp(20px, 3vw, 36px)' }}
            >
                {/* Header */}
                <Container layout="flex-column" gap="none" padding="none">
                    <Typography size="xs" color="muted" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {user?.username}
                    </Typography>
                    <Typography as="h1" size="xl" weight="bold" animation="blur" animationDuration={700} style={{ letterSpacing: '-0.015em' }}>
                        Settings
                    </Typography>
                </Container>

                <Container layout="flex" gap="lg" align="start" padding="none" width="100%" wrap>
                    {/* Sidebar nav */}
                    <Card padding="sm" hover={false} style={{ flex: '0 1 250px', minWidth: 210, position: 'sticky', top: 20 }}>
                        <Container layout="flex-column" gap="none" padding="none" width="100%">
                            {TABS.map(t => (
                                <Container
                                    key={t.id}
                                    layout="flex" align="center" gap="sm" padding="sm"
                                    hoverable
                                    wrap={false}
                                    onClick={() => setTab(t.id)}
                                    width="100%"
                                    style={tab === t.id ? { background: 'color-mix(in srgb, var(--primary-color) 12%, transparent)', borderRadius: 'var(--border-radius-lg)' } : {}}
                                >
                                    <Icon name={t.icon} size="sm" color={tab === t.id ? 'primary' : 'text'} />
                                    <Container layout="flex-column" gap="none" padding="none" style={{ minWidth: 0 }}>
                                        <Typography size="sm" weight={tab === t.id ? 'semibold' : 'medium'} color={tab === t.id ? 'primary' : 'default'}>
                                            {t.label}
                                        </Typography>
                                        <Typography size="xxs" color="muted" truncate>{t.desc}</Typography>
                                    </Container>
                                </Container>
                            ))}
                        </Container>
                    </Card>

                    {/* Content */}
                    <Container layout="flex-column" gap="md" padding="none" style={{ flex: '1 1 480px', minWidth: 0 }}>
                        <Card layout="flex-column" gap="md" padding="lg" hover={false} width="100%">
                            <Container layout="flex" align="center" gap="sm" padding="none">
                                <Icon name={active.icon} size="sm" color="primary" />
                                <Typography as="h2" size="md" weight="semibold">{active.label}</Typography>
                            </Container>
                            <Divider margin="none" />
                            {renderTab()}
                        </Card>
                    </Container>
                </Container>
            </Container>
        </Page>
    );
};

export default SettingsPage;
