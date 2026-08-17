import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useTheme } from '@contexts/ThemeContext';
import { useNotification } from '@contexts/NotificationContext';
import { authService } from '@/client/auth.client';
import { userService } from '@/client/user.client';
import { themeService } from '@/client/theme.client';
import { listFontKeys, getFontFamily, ensureFontsLoaded } from '@/styles/font.registry';
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
    CircularProgress
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

// ─── Appearance Tab (themes & personalisation) ───────────────────────────────

// Swatch fallbacks so built-ins render before the server presets are seeded
const BUILTIN_SWATCHES = {
    modern:  ['#12355B', '#FF570A', '#FFFFFF'],
    dark:    ['#A5D8FF', '#FF570A', '#0C2240'],
    minimal: ['#374151', '#9CA3AF', '#F9FAFB'],
    vibrant: ['#556303', '#BF3100', '#F5BB00'],
    admin:   ['#EEC643', '#83C5BE', '#141414'],
    pink:    ['#CC0C49', '#7663F2', '#FDE8F0'],
};

const COLOR_FIELDS = [
    ['primary', 'Primary'], ['primaryAccent', 'Primary accent'],
    ['secondary', 'Secondary'], ['secondaryAccent', 'Secondary accent'],
    ['tertiary', 'Tertiary'], ['tertiaryAccent', 'Tertiary accent'],
    ['success', 'Success'], ['warning', 'Warning'], ['error', 'Error'],
    ['background', 'Background'], ['surface', 'Surface'], ['surfaceAccent', 'Surface accent'],
    ['border', 'Border'], ['text', 'Text'], ['textContrast', 'Contrast text'],
];

const slugify = (value = '') => value.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50);

const SwatchStrip = ({ colors = [], size = 22 }) => (
    <Container layout="flex" gap="none" padding="none" wrap={false} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)', width: 'fit-content' }}>
        {colors.filter(Boolean).map((color, i) => (
            <Container key={i} padding="none" width={`${size}px`} height={`${size}px`} style={{ background: color }} />
        ))}
    </Container>
);

const themeSwatches = (doc) => {
    const c = doc?.tokens?.colors || {};
    return [c.primary, c.secondary, c.tertiary, c.background, c.surface];
};

// ─── Theme editor (create / edit / fork) ─────────────────────────────────────

const DEFAULT_EDITOR = {
    name: '', slug: '', description: '', visibility: 'private',
    darkMode: false,
    colors: {
        primary: '#12355B', primaryAccent: '#1A4A7A',
        secondary: '#FF570A', secondaryAccent: '#CC4000',
        tertiary: '#A5D8FF', tertiaryAccent: '#70BFFF',
        success: '#1E7A3A', warning: '#E88500', error: '#CC2200',
        background: '#FFFFFF', surface: '#EAF5FF', surfaceAccent: '#C8EAFF',
        border: '#A5D8FF', text: '#12355B', textContrast: '#FFFFFF',
    },
    fonts: { primary: 'urbanist', secondary: 'montserrat-alternates', monospace: 'jetbrains-mono' },
    radii: {
        base: '0.375rem', card: '0.5rem', input: '0.375rem', button: '0.375rem',
        checkbox: '0.25rem', fab: '50%', progress: '9999px', notification: '0.5rem',
    },
};

const RADII_FIELDS = [
    ['base', 'Base'], ['card', 'Cards'], ['input', 'Inputs'], ['button', 'Buttons'],
    ['checkbox', 'Checkboxes'], ['fab', 'FAB'], ['progress', 'Progress bars'], ['notification', 'Notifications'],
];

const ThemeEditor = ({ initial, editingId, onSaved, onCancel }) => {
    const { error: showError, success: showSuccess } = useNotification();
    const [form, setForm] = useState(initial || DEFAULT_EDITOR);
    const [slugTouched, setSlugTouched] = useState(!!editingId);
    const [isSaving, setIsSaving] = useState(false);

    // Load every registry font once so the pickers can preview them
    useEffect(() => { ensureFontsLoaded(listFontKeys()); }, []);

    const setColor = (key, value) => setForm(f => ({ ...f, colors: { ...f.colors, [key]: value } }));
    const setFont = (key, value) => setForm(f => ({ ...f, fonts: { ...f.fonts, [key]: value } }));
    const setRadius = (key, value) => setForm(f => ({ ...f, radii: { ...f.radii, [key]: value } }));

    const handleSave = async () => {
        if (!form.name.trim() || !form.slug.trim()) { showError('Name and slug are required'); return; }
        setIsSaving(true);
        const payload = {
            name: form.name.trim(),
            slug: form.slug,
            description: form.description.trim(),
            visibility: form.visibility,
            tokens: {
                darkMode: form.darkMode,
                colors: form.colors,
                fonts: form.fonts,
                ...(form.radii ? { radii: form.radii } : {}),
            },
            ...(form.forkedFrom ? { forkedFrom: form.forkedFrom } : {}),
        };
        try {
            const res = editingId
                ? await themeService.updateTheme(editingId, payload)
                : await themeService.createTheme(payload);
            showSuccess(editingId ? 'Theme updated' : 'Theme created');
            onSaved(res.theme);
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to save theme');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card layout="flex-column" gap="md" padding="lg" hover={false} width="100%">
            <Container layout="flex" align="center" justify="between" padding="none" width="100%">
                <Typography size="sm" weight="semibold">
                    {editingId ? 'Edit theme' : form.forkedFrom ? `Fork of ${form.forkedFromName || 'theme'}` : 'New theme'}
                </Typography>
                <SwatchStrip colors={[form.colors.primary, form.colors.secondary, form.colors.tertiary, form.colors.background, form.colors.surface]} />
            </Container>

            <Container layout="grid" columns={2} gap="md" padding="none" width="100%">
                <Input label="Name" value={form.name} width="100%"
                    onChange={e => {
                        const name = e.target.value;
                        setForm(f => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                    }} />
                <Input label="Slug" value={form.slug} width="100%"
                    onChange={e => { setSlugTouched(true); setForm(f => ({ ...f, slug: slugify(e.target.value) })); }} />
            </Container>
            <Input label="Description (optional)" value={form.description} width="100%"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

            <Container layout="flex" gap="lg" align="end" padding="none" wrap>
                <Select
                    label="Visibility"
                    options={[
                        { value: 'private', label: 'Private — only you' },
                        { value: 'unlisted', label: 'Unlisted — anyone with the link' },
                        { value: 'public', label: 'Public — listed in the gallery' },
                    ]}
                    value={form.visibility}
                    onChange={val => setForm(f => ({ ...f, visibility: val }))}
                    width="260px"
                />
                <Container layout="flex" align="center" gap="sm" padding="none">
                    <Switch checked={form.darkMode} onChange={e => setForm(f => ({ ...f, darkMode: e.target.checked }))} />
                    <Typography size="sm">Dark theme</Typography>
                </Container>
            </Container>

            <Divider margin="xs" />
            <Typography size="sm" weight="semibold">Colors</Typography>
            <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                {COLOR_FIELDS.map(([key, label]) => (
                    <Container key={key} layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                        <Input
                            type="color"
                            value={form.colors[key] || '#000000'}
                            onChange={e => setColor(key, e.target.value)}
                            width="52px"
                            aria-label={label}
                            style={{ flex: '0 0 auto' }}
                        />
                        <Container layout="flex-column" gap="none" padding="none" flexFill style={{ minWidth: 0, textAlign: 'left' }}>
                            <Typography size="xs" weight="medium">{label}</Typography>
                            <Typography size="xs" color="muted" font="monospace">{form.colors[key]}</Typography>
                        </Container>
                    </Container>
                ))}
            </Container>

            <Divider margin="xs" />
            <Typography size="sm" weight="semibold">Fonts</Typography>
            <Container layout="grid" columns={3} gap="md" padding="none" width="100%">
                <Select label="Primary" options={listFontKeys('sans').map(k => ({ value: k, label: k, style: { fontFamily: getFontFamily(k) } }))}
                    value={form.fonts.primary} onChange={val => setFont('primary', val)} width="100%" />
                <Select label="Display / headings" options={listFontKeys().map(k => ({ value: k, label: k, style: { fontFamily: getFontFamily(k) } }))}
                    value={form.fonts.secondary} onChange={val => setFont('secondary', val)} width="100%" />
                <Select label="Monospace" options={listFontKeys('mono').map(k => ({ value: k, label: k, style: { fontFamily: getFontFamily(k) } }))}
                    value={form.fonts.monospace} onChange={val => setFont('monospace', val)} width="100%" />
            </Container>

            <Divider margin="xs" />
            <Typography size="sm" weight="semibold">Corners</Typography>
            <Typography size="xxs" color="muted">
                Border radii — any CSS length works (0 for sharp, 9999px for pills, 50% for circles).
            </Typography>
            <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                {RADII_FIELDS.map(([key, label]) => (
                    <Input
                        key={key}
                        size="sm"
                        label={label}
                        value={form.radii?.[key] ?? ''}
                        onChange={e => setRadius(key, e.target.value)}
                        placeholder={DEFAULT_EDITOR.radii[key]}
                        width="100%"
                    />
                ))}
            </Container>

            <Container layout="flex" gap="sm" padding="none">
                <Button color="primary" onClick={handleSave} disabled={isSaving}>
                    <Icon name={isSaving ? 'FiLoader' : 'FiSave'} size="xs" />
                    {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Create theme'}
                </Button>
                <Button color="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
            </Container>
        </Card>
    );
};

// ─── Theme list card ─────────────────────────────────────────────────────────

const ThemeCard = ({ doc, isApplied, onApply, onFork, onEdit, onDelete }) => (
    <Card layout="flex-column" gap="sm" padding="md" hover={false} style={{ minWidth: 0 }}>
        <Container layout="flex" align="center" gap="xs" padding="none" width="100%" wrap={false}>
            <Typography size="sm" weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</Typography>
            {isApplied && <Badge size="xs" color="success">Applied</Badge>}
            {doc.isPreset && <Badge size="xs" color="secondary">Built-in</Badge>}
            {!doc.isPreset && doc.visibility && doc.visibility !== 'private' && (
                <Badge size="xs" color="tertiary">{doc.visibility}</Badge>
            )}
        </Container>
        {doc.description && (
            <Typography size="xs" color="muted" style={{ display: 'block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.description}
            </Typography>
        )}
        <SwatchStrip colors={themeSwatches(doc)} />
        <Container layout="flex" gap="xs" padding="none" wrap>
            <Button size="xs" color="primary" onClick={onApply} disabled={isApplied}>
                <Icon name="FiCheck" size="xs" />{isApplied ? 'Applied' : 'Apply'}
            </Button>
            {onFork && (
                <Button size="xs" color="secondary" onClick={onFork}>
                    <Icon name="FiCopy" size="xs" />Fork
                </Button>
            )}
            {onEdit && (
                <Button size="xs" color="secondary" onClick={onEdit}>
                    <Icon name="FiEdit2" size="xs" />Edit
                </Button>
            )}
            {onDelete && (
                <Button size="xs" color="error" onClick={onDelete}>
                    <Icon name="FiTrash2" size="xs" />Delete
                </Button>
            )}
        </Container>
    </Card>
);



const AppearanceTab = () => {
    const { user } = useAuth();
    const { currentTheme, switchTheme, applyCustomTheme, clearCustomTheme, customTheme, themes } = useTheme();
    const { success: showSuccess, error: showError } = useNotification();

    const [presets, setPresets] = useState([]);
    const [myThemes, setMyThemes] = useState([]);
    const [publicThemes, setPublicThemes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editor, setEditor] = useState(null); // { initial, editingId }

    const roles = user?.roles || [];
    const canCreate = ['CREATOR', 'SUPER_CREATOR', 'ADMIN', 'OWNER'].some(r => roles.includes(r));

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const [presetRes, mineRes, publicRes] = await Promise.all([
                themeService.getPresets().catch(() => ({ themes: [] })),
                themeService.getMyThemes().catch(() => ({ themes: [] })),
                themeService.getPublicThemes({ limit: 12 }).catch(() => ({ themes: [] })),
            ]);
            setPresets(presetRes.themes || []);
            setMyThemes(mineRes.themes || []);
            const mineIds = new Set((mineRes.themes || []).map(t => (t.id || t._id).toString()));
            setPublicThemes((publicRes.themes || []).filter(t => !mineIds.has((t.id || t._id).toString())));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openFork = (doc) => {
        const t = doc.tokens || {};
        setEditor({
            initial: {
                name: `${doc.name} (fork)`,
                slug: slugify(`${doc.slug}-fork`),
                description: doc.description || '',
                visibility: 'private',
                darkMode: !!t.darkMode,
                colors: { ...DEFAULT_EDITOR.colors, ...(t.colors || {}) },
                fonts: { ...DEFAULT_EDITOR.fonts, ...(t.fonts || {}) },
                radii: { ...DEFAULT_EDITOR.radii, ...(t.radii || {}) },
                forkedFrom: doc.id || doc._id,
                forkedFromName: doc.name,
            },
            editingId: null,
        });
    };

    const openEdit = (doc) => {
        const t = doc.tokens || {};
        setEditor({
            initial: {
                name: doc.name,
                slug: doc.slug,
                description: doc.description || '',
                visibility: doc.visibility || 'private',
                darkMode: !!t.darkMode,
                colors: { ...DEFAULT_EDITOR.colors, ...(t.colors || {}) },
                fonts: { ...DEFAULT_EDITOR.fonts, ...(t.fonts || {}) },
                radii: { ...DEFAULT_EDITOR.radii, ...(t.radii || {}) },
            },
            editingId: doc.id || doc._id,
        });
    };

    const handleDelete = async (doc) => {
        try {
            await themeService.deleteTheme(doc.id || doc._id);
            showSuccess(`Theme "${doc.name}" deleted`);
            if (customTheme?.slug === doc.slug) clearCustomTheme();
            load();
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to delete theme');
        }
    };

    const handleSaved = (theme) => {
        setEditor(null);
        load();
        if (theme && customTheme && (theme.slug === customTheme.slug)) {
            applyCustomTheme(theme); // re-apply so edits show immediately
        }
    };

    const appliedCustomSlug = customTheme?.slug;

    return (
        <Container layout="flex-column" gap="lg" padding="none" width="100%">
            {/* Built-in themes */}
            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                <Typography size="sm" weight="semibold">Built-in themes</Typography>
                <Typography size="sm" color="muted">
                    The six App Base themes. Apply one directly, or fork it as a starting point for your own.
                </Typography>
                <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                    {Object.entries(BUILTIN_SWATCHES).map(([slug, swatches]) => {
                        const preset = presets.find(p => p.slug === slug);
                        const applied = currentTheme === slug;
                        return (
                            <Card key={slug} layout="flex-column" gap="sm" padding="md" hover={false} style={{ minWidth: 0 }}>
                                <Container layout="flex" align="center" justify="between" padding="none" width="100%" wrap={false}>
                                    <Typography size="sm" weight="semibold">{themes[slug]?.name || slug}</Typography>
                                    {applied && <Badge size="xs" color="success">Applied</Badge>}
                                </Container>
                                <SwatchStrip colors={preset ? themeSwatches(preset) : swatches} />
                                <Container layout="flex" gap="xs" padding="none" wrap={false}>
                                    <Button size="xs" color="primary" onClick={() => switchTheme(slug)} disabled={applied}>
                                        <Icon name="FiCheck" size="xs" />{applied ? 'Applied' : 'Apply'}
                                    </Button>
                                    {canCreate && preset && (
                                        <Button size="xs" color="secondary" onClick={() => openFork(preset)}>
                                            <Icon name="FiCopy" size="xs" />Fork
                                        </Button>
                                    )}
                                </Container>
                            </Card>
                        );
                    })}
                </Container>
            </Container>

            <Divider margin="xs" />

            {/* My themes */}
            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                <Container layout="flex" align="center" justify="between" padding="none" width="100%">
                    <Typography size="sm" weight="semibold">My themes</Typography>
                    {canCreate && !editor && (
                        <Button size="sm" color="primary" onClick={() => setEditor({ initial: null, editingId: null })}>
                            <Icon name="FiPlus" size="xs" />New theme
                        </Button>
                    )}
                </Container>
                {!canCreate && (
                    <Card padding="sm" hover={false} backgroundColor="surface">
                        <Container layout="flex" align="center" gap="sm" padding="none">
                            <Icon name="FiStar" size="xs" color="warning" />
                            <Typography size="xs" color="muted">
                                Creating custom themes requires a Creator account or above — request an upgrade in the Roles tab.
                            </Typography>
                        </Container>
                    </Card>
                )}

                {editor && (
                    <ThemeEditor
                        initial={editor.initial}
                        editingId={editor.editingId}
                        onSaved={handleSaved}
                        onCancel={() => setEditor(null)}
                    />
                )}

                {isLoading ? (
                    <CircularProgress size="sm" />
                ) : myThemes.length === 0 && !editor ? (
                    <Typography size="xs" color="muted">
                        No custom themes yet — create one from scratch or fork a built-in.
                    </Typography>
                ) : (
                    <Container layout="grid" columns={2} gap="sm" padding="none" width="100%">
                        {myThemes.map(doc => (
                            <ThemeCard
                                key={doc.id || doc._id}
                                doc={doc}
                                isApplied={appliedCustomSlug === doc.slug && currentTheme === `custom-${doc.slug}`}
                                onApply={() => { applyCustomTheme(doc); showSuccess(`Theme "${doc.name}" applied`); }}
                                onFork={canCreate ? () => openFork(doc) : null}
                                onEdit={canCreate ? () => openEdit(doc) : null}
                                onDelete={canCreate ? () => handleDelete(doc) : null}
                            />
                        ))}
                    </Container>
                )}
            </Container>

            {/* Community gallery */}
            {publicThemes.length > 0 && (
                <>
                    <Divider margin="xs" />
                    <Container layout="flex-column" gap="sm" padding="none" width="100%">
                        <Typography size="sm" weight="semibold">Community themes</Typography>
                        <Typography size="sm" color="muted">Public themes shared by other users.</Typography>
                        <Container layout="grid" columns={2} gap="sm" padding="none" width="100%">
                            {publicThemes.map(doc => (
                                <ThemeCard
                                    key={doc.id || doc._id}
                                    doc={doc}
                                    isApplied={appliedCustomSlug === doc.slug && currentTheme === `custom-${doc.slug}`}
                                    onApply={() => { applyCustomTheme(doc); showSuccess(`Theme "${doc.name}" applied`); }}
                                    onFork={canCreate ? () => openFork(doc) : null}
                                />
                            ))}
                        </Container>
                    </Container>
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
            case 'appearance':   return <AppearanceTab />;
            case 'account':      return <AccountTab user={user} />;
            case 'security':     return <SecurityTab />;
            case 'roles':        return <RoleTab user={user} />;
            case 'integrations': return <IntegrationsTab />;
            default:             return null;
        }
    };

    return (
        <Page layout="flex-column" padding="none" gap="none">
            <Container
                layout="flex-column" gap="lg" padding="none" width="100%" maxWidth="1200px"
                style={{ margin: '0 auto', padding: 'clamp(20px, 3vw, 36px)' }}
            >
                {/* Header */}
                <Container layout="flex-column" gap="none" padding="none">
                    <Typography size="xs" color="muted" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {user?.username}
                    </Typography>
                    <Typography as="h1" size="xl" weight="bold" style={{ letterSpacing: '-0.015em' }}>
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
                                        <Typography size="xxs" color="muted" style={{ display: 'block', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</Typography>
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
