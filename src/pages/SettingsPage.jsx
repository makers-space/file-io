import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { authService } from '@/client/auth.client';
import { userService } from '@/client/user.client';
import IntegrationsTab from '@components/IntegrationsTab';
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

    const handleSavePw = async () => {
        if (pwForm.newPassword !== pwForm.confirmPassword) { showError('Passwords do not match'); return; }
        if (pwForm.newPassword.length < 8) { showError('Password must be at least 8 characters'); return; }
        setIsSavingPw(true);
        try {
            await userService.changePassword(user._id, pwForm.currentPassword, pwForm.newPassword);
            showSuccess('Password changed');
            setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to change password');
        } finally {
            setIsSavingPw(false);
        }
    };

    return (
        <Container layout="flex-column" gap="lg">
            {/* Profile */}
            <Container layout="flex-column" gap="md">
                <Typography size="md" weight="semibold">Profile</Typography>
                <Container layout="flex" gap="md" padding="none">
                    <Input label="First Name" value={profileForm.firstName} onChange={e => setProfileForm(p => ({ ...p, firstName: e.target.value }))} flexFill />
                    <Input label="Last Name" value={profileForm.lastName} onChange={e => setProfileForm(p => ({ ...p, lastName: e.target.value }))} flexFill />
                </Container>
                <Input label="Username" value={profileForm.username} onChange={e => setProfileForm(p => ({ ...p, username: e.target.value }))} width="100%" />
                <Input label="Email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} type="email" width="100%" />
                <Input label="Bio" value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))} multiline placeholder="Tell others about yourself…" width="100%" />
                <Button color="primary" onClick={handleSaveProfile} disabled={isSavingProfile} width="100%">
                    <Icon name={isSavingProfile ? 'FiLoader' : 'FiSave'} size="xs" />
                    {isSavingProfile ? 'Saving…' : 'Save Changes'}
                </Button>
            </Container>

            <Divider color="surface" margin="xs" />

            {/* Password */}
            <Container layout="flex-column" gap="md" width="100%">
                <Typography size="md" weight="semibold">Change Password</Typography>
                <Input label="Current Password" value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} type="password" width="100%" />
                <Input label="New Password" value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} type="password" width="100%" />
                <Input label="Confirm New Password" value={pwForm.confirmPassword} onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))} type="password" width="100%" />
                <Button color="primary" onClick={handleSavePw} disabled={isSavingPw || !pwForm.currentPassword || !pwForm.newPassword} width="100%">
                    <Icon name={isSavingPw ? 'FiLoader' : 'FiLock'} size="xs" />
                    {isSavingPw ? 'Saving…' : 'Update Password'}
                </Button>
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
    const [step, setStep] = useState('idle');

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

    const handleSetup = async () => {
        try {
            const res = await authService.setup2FA();
            setQrData(res);
            setStep('setup');
        } catch { showError('Failed to initiate 2FA setup'); }
    };

    const handleVerifySetup = async () => {
        try {
            await authService.verifySetup2FA(verifyToken);
            showSuccess('Two-factor authentication enabled');
            setStep('idle'); setQrData(null); setVerifyToken('');
            load2FAStatus();
        } catch { showError('Invalid token — please try again'); }
    };

    const handleDisable = async () => {
        try {
            await authService.disable2FA(disableForm.password, disableForm.token);
            showSuccess('Two-factor authentication disabled');
            setStep('idle'); setDisableForm({ password: '', token: '' });
            load2FAStatus();
        } catch { showError('Failed to disable 2FA — check your password and token'); }
    };

    const handleGetBackupCodes = async () => {
        try {
            const res = await authService.getBackupCodes(disableForm.password, disableForm.token);
            setBackupCodes(res?.backupCodes || []);
            setStep('backup');
        } catch { showError('Failed to retrieve backup codes'); }
    };

    const isEnabled = status?.enabled;

    return (
        <Container layout="flex-column" gap="lg">
            {/* 2FA */}
            <Container layout="flex-column" gap="md">
                <Container layout="flex" justify="between" align="center">
                    <Typography size="md" weight="semibold">Two-Factor Authentication</Typography>
                    {isLoading2FA
                        ? <CircularProgress size="xs" />
                        : <Badge size="sm" color={isEnabled ? 'success' : 'secondary'}>{isEnabled ? 'Enabled' : 'Disabled'}</Badge>
                    }
                </Container>

                {!isLoading2FA && (
                    <>
                        <Typography size="sm" color="secondary">
                            {isEnabled
                                ? 'Your account is secured with 2FA. You will need your authenticator app to sign in.'
                                : 'Add an extra layer of security by enabling two-factor authentication.'}
                        </Typography>

                        {step === 'idle' && (
                            <Container layout="flex" gap="sm" wrap>
                                {!isEnabled ? (
                                    <Button color="primary" onClick={handleSetup}>
                                        <Icon name="FiShield" size="xs" />Enable 2FA
                                    </Button>
                                ) : (
                                    <>
                                        <Button color="error" onClick={() => setStep('disable')}>
                                            <Icon name="FiShieldOff" size="xs" />Disable 2FA
                                        </Button>
                                        <Button color="secondary" onClick={() => setStep('disable')}>
                                            <Icon name="FiKey" size="xs" />Get Backup Codes
                                        </Button>
                                    </>
                                )}
                            </Container>
                        )}

                        {step === 'setup' && qrData && (
                            <Container layout="flex-column" gap="md">
                                <Typography size="sm" weight="medium">1. Scan this QR code with your authenticator app</Typography>
                                {qrData.qrCode && <img src={qrData.qrCode} alt="2FA QR Code" style={{ width: '180px', height: '180px' }} />}
                                {qrData.secret && (
                                    <Container layout="flex-column" gap="xs">
                                        <Typography size="xs" color="secondary">Manual entry key:</Typography>
                                        <Container backgroundColor="surface" padding="xs">
                                            <Typography size="xs" font="monospace" style={{ userSelect: 'all' }}>{qrData.secret}</Typography>
                                        </Container>
                                    </Container>
                                )}
                                <Typography size="sm" weight="medium">2. Enter the 6-digit code from your app</Typography>
                                <Input value={verifyToken} onChange={e => setVerifyToken(e.target.value)} placeholder="000000" maxLength={6} />
                                <Container layout="flex" gap="sm">
                                    <Button color="primary" onClick={handleVerifySetup} disabled={verifyToken.length !== 6}>Verify & Enable</Button>
                                    <Button color="secondary" onClick={() => { setStep('idle'); setQrData(null); setVerifyToken(''); }}>Cancel</Button>
                                </Container>
                            </Container>
                        )}

                        {step === 'disable' && (
                            <Container layout="flex-column" gap="md">
                                <Typography size="sm" weight="medium">Enter your password and current 2FA code to continue</Typography>
                                <Input label="Password" type="password" value={disableForm.password} onChange={e => setDisableForm(p => ({ ...p, password: e.target.value }))} />
                                <Input label="2FA Code" value={disableForm.token} onChange={e => setDisableForm(p => ({ ...p, token: e.target.value }))} placeholder="000000" maxLength={6} />
                                <Container layout="flex" gap="sm">
                                    <Button color="error" onClick={handleDisable} disabled={!disableForm.password || !disableForm.token}>Disable 2FA</Button>
                                    <Button color="secondary" onClick={handleGetBackupCodes} disabled={!disableForm.password || !disableForm.token}>Get Backup Codes</Button>
                                    <Button color="secondary" onClick={() => { setStep('idle'); setDisableForm({ password: '', token: '' }); }}>Cancel</Button>
                                </Container>
                            </Container>
                        )}

                        {step === 'backup' && backupCodes && (
                            <Container layout="flex-column" gap="md">
                                <Typography size="sm" weight="semibold">Backup Codes</Typography>
                                <Typography size="xs" color="secondary">Save these codes in a safe place. Each can only be used once.</Typography>
                                <Container layout="flex-column" gap="xs" backgroundColor="surface" padding="sm">
                                    {backupCodes.map((code, i) => (
                                        <Typography key={i} size="sm" font="monospace" style={{ userSelect: 'all' }}>{code}</Typography>
                                    ))}
                                </Container>
                                <Button onClick={() => { setStep('idle'); setBackupCodes(null); }}>Done</Button>
                            </Container>
                        )}
                    </>
                )}
            </Container>

            <Divider color="surface" margin="xs" />

            {/* Devices */}
            <Container layout="flex-column" gap="md">
                <Typography size="md" weight="semibold">Trusted Devices</Typography>
                <Typography size="sm" color="secondary">Devices that have signed in to your account</Typography>
                {isLoadingDevices
                    ? <CircularProgress size="sm" />
                    : devices.length === 0
                        ? <Typography size="sm" color="secondary">No device history available</Typography>
                        : (
                            <Container layout="flex-column" gap="sm">
                                {devices.map((d, i) => (
                                    <Card key={i} padding="sm" backgroundColor="surface">
                                        <Container layout="flex" align="center" gap="sm">
                                            <Icon name={d.platform === 'mobile' ? 'FiSmartphone' : 'FiMonitor'} size="sm" color="primary" />
                                            <Container layout="flex-column" gap="xs" flexFill>
                                                <Typography size="sm" weight="medium">
                                                    {[d.browser, d.os].filter(Boolean).join(' on ') || 'Unknown Device'}
                                                </Typography>
                                                <Container layout="flex" gap="md" wrap>
                                                    {d.ipAddress && <Typography size="xs" color="secondary">{d.ipAddress}</Typography>}
                                                    {d.location?.city && <Typography size="xs" color="secondary">{[d.location.city, d.location.country].filter(Boolean).join(', ')}</Typography>}
                                                    {d.lastSeenAt && <Typography size="xs" color="secondary">Last seen {new Date(d.lastSeenAt).toLocaleString()}</Typography>}
                                                </Container>
                                            </Container>
                                        </Container>
                                    </Card>
                                ))}
                            </Container>
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
                <Typography size="md" weight="semibold">Role Elevation</Typography>
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
                <Container layout="flex-column" gap="md">
                    <Typography size="sm" color="secondary">
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
                                    <Typography size="sm" weight="semibold">{info.label}</Typography>
                                    <Typography size="xs" color="secondary">{info.desc}</Typography>
                                </Container>
                            </Card>
                        ))}
                    </Container>
                    <Input
                        label="Reason"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Why do you need this role?"
                        multiline
                        width="100%"
                    />
                    <Button color="primary" onClick={handleRequest} disabled={isSending || !reason.trim()} width="100%">
                        <Icon name={isSending ? 'FiLoader' : 'FiArrowUp'} size="xs" />
                        {isSending ? 'Submitting…' : 'Submit Request'}
                    </Button>
                </Container>
            )}
        </Container>
    );
};

// ─── SettingsPage ─────────────────────────────────────────────────────────────

const TABS = [
    { id: 'account',      label: 'Account',      icon: 'FiUser' },
    { id: 'security',     label: 'Security',     icon: 'FiShield' },
    { id: 'roles',        label: 'Roles',        icon: 'FiBriefcase' },
    { id: 'integrations', label: 'Integrations', icon: 'FiLink' },
];

const SettingsPage = () => {
    const { user } = useAuth();
    const [tab, setTab] = useState('account');

    const renderTab = () => {
        switch (tab) {
            case 'account':      return <AccountTab user={user} />;
            case 'security':     return <SecurityTab />;
            case 'roles':        return <RoleTab user={user} />;
            case 'integrations': return <IntegrationsTab />;
            default:             return null;
        }
    };

    return (
        <Page layout="flex-column" padding="xl" align="center">
            <Container layout="flex-column" gap="lg" width="100%" maxWidth="1000px">
                <Typography size="lg" weight="bold">Settings</Typography>

                <Container layout="flex" gap="lg" align="start">
                    {/* Sidebar nav */}
                    <Card padding="sm" style={{ minWidth: '220px' }}>
                        <Container layout="flex-column" gap="xs" padding="none">
                            {TABS.map(t => (
                                <Button
                                    key={t.id}
                                    color="primary"
                                    selected={tab === t.id}
                                    onClick={() => setTab(t.id)}
                                    width="100%"
                                >
                                    <Icon name={t.icon} size="xs" />
                                    {t.label}
                                </Button>
                            ))}
                        </Container>
                    </Card>

                    {/* Content card */}
                    <Card padding="lg" flexFill>
                        {renderTab()}
                    </Card>
                </Container>
            </Container>
        </Page>
    );
};

export default SettingsPage;
