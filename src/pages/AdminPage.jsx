import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { appService } from '@/client/app.client';
import { cacheService } from '@/client/cache.client';
import { userService } from '@/client/user.client';
import { fileService } from '@/client/file.client';
import { authService } from '@/client/auth.client';
import {
    Page, Container, Card, Button, Typography, Icon, Input, Badge,
    CircularProgress, Select, Switch, Divider, TreeView, PageLoading, ProgressBar, Data
} from '@components/Components';

// ─── Bulk Delete Form ─────────────────────────────────────────────────────────

const BulkDeleteForm = ({ onSubmit, onCancel, onClose }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [forceDelete, setForceDelete] = useState(false);
    const [fileTree, setFileTree] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { error: showError } = useNotification();

    useEffect(() => {
        const loadFileTree = async () => {
            try {
                setIsLoading(true);
                const treeData = await fileService.getFileTree();
                setFileTree(treeData?.tree || []);
            } catch {
                showError('Failed to load file tree');
            } finally {
                setIsLoading(false);
            }
        };
        loadFileTree();
    }, [showError]);

    const handleFileSelect = useCallback((nodeData, isSelected) => {
        const filePath = nodeData.metadata?.filePath || nodeData.id;
        setSelectedFiles(prev =>
            isSelected ? (prev.includes(filePath) ? prev : [...prev, filePath]) : prev.filter(p => p !== filePath)
        );
    }, []);

    const handleSubmit = async () => {
        if (selectedFiles.length === 0) { showError('Please select at least one file to delete'); return; }
        try {
            setIsLoading(true);
            await onSubmit(selectedFiles, { force: forceDelete });
            setSelectedFiles([]);
            setForceDelete(false);
            if (onClose) onClose();
        } catch { /* handled by parent */ } finally { setIsLoading(false); }
    };

    const handleCancel = () => { if (onCancel) onCancel(); if (onClose) onClose(); };

    return (
        <Container layout="flex-column" gap="lg" padding="lg" maxWidth="500px" width="100%">
            <Typography as="h3" size="lg" weight="semibold" color="error">Bulk Delete Files</Typography>
            <Typography size="sm" color="secondary">
                Select files and directories to delete. This action cannot be undone.
            </Typography>
            <Container layout="flex" align="center" gap="sm">
                <Switch checked={forceDelete} onChange={setForceDelete} size="sm" />
                <Typography size="sm">Force delete (bypass normal restrictions)</Typography>
            </Container>
            <Container layout="flex-column" gap="sm">
                <Typography size="sm" weight="semibold">Select files and directories:</Typography>
                {isLoading ? (
                    <Container layout="flex" justify="center" padding="lg"><CircularProgress size="sm" /></Container>
                ) : (
                    <Card padding="md" maxHeight="300px" style={{ overflow: 'auto' }}>
                        <TreeView data={fileTree} multiSelect={true} selectedNodes={selectedFiles} onNodeSelect={handleFileSelect} showIcons={true} />
                    </Card>
                )}
            </Container>
            {selectedFiles.length > 0 && (
                <Container layout="flex-column" gap="sm">
                    <Typography size="sm" weight="semibold">Selected files ({selectedFiles.length}):</Typography>
                    <Card padding="sm" maxHeight="100px" style={{ overflow: 'auto' }}>
                        {selectedFiles.map((fp, i) => <Typography key={i} size="xs" color="secondary">{fp}</Typography>)}
                    </Card>
                </Container>
            )}
            <Container layout="flex" gap="sm" justify="end">
                <Button color="secondary" onClick={handleCancel} disabled={isLoading}>Cancel</Button>
                <Button color="error" onClick={handleSubmit} disabled={isLoading || selectedFiles.length === 0}>
                    {isLoading ? <><CircularProgress size="xs" /> Deleting...</> : <><Icon name="FiTrash2" size="xs" /> Delete {selectedFiles.length} file(s)</>}
                </Button>
            </Container>
        </Container>
    );
};

// ─── Bulk Tag Form ────────────────────────────────────────────────────────────

const BulkTagForm = ({ onSubmit, onCancel, onClose }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [tags, setTags] = useState([]);
    const [newTag, setNewTag] = useState('');
    const [fileTree, setFileTree] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { error: showError } = useNotification();
    const commonTags = ['important', 'archived', 'draft', 'review', 'public', 'private', 'shared'];

    useEffect(() => {
        const loadFileTree = async () => {
            try {
                setIsLoading(true);
                const treeData = await fileService.getFileTree();
                setFileTree(treeData?.tree || []);
            } catch {
                showError('Failed to load file tree');
            } finally {
                setIsLoading(false);
            }
        };
        loadFileTree();
    }, [showError]);

    const handleFileSelect = useCallback((nodeData, isSelected) => {
        const filePath = nodeData.metadata?.filePath || nodeData.id;
        setSelectedFiles(prev =>
            isSelected ? (prev.includes(filePath) ? prev : [...prev, filePath]) : prev.filter(p => p !== filePath)
        );
    }, []);

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags(prev => [...prev, newTag.trim()]);
            setNewTag('');
        }
    };

    const handleSubmit = async () => {
        if (selectedFiles.length === 0) { showError('Please select at least one file'); return; }
        if (tags.length === 0) { showError('Please add at least one tag'); return; }
        try {
            setIsLoading(true);
            await onSubmit(selectedFiles, { tags });
            setSelectedFiles([]); setTags([]);
            if (onClose) onClose();
        } catch { /* handled by parent */ } finally { setIsLoading(false); }
    };

    const handleCancel = () => { if (onCancel) onCancel(); if (onClose) onClose(); };

    return (
        <Container layout="flex-column" gap="lg" padding="lg" maxWidth="500px" width="100%">
            <Typography as="h3" size="lg" weight="semibold" color="tertiary">Bulk Tag Files</Typography>
            <Typography size="sm" color="secondary">Select files and add tags for better organization.</Typography>
            <Container layout="flex-column" gap="md">
                <Typography size="sm" weight="semibold">Tags to add:</Typography>
                <Select
                    multiSelect={true}
                    options={commonTags.map(t => ({ value: t, label: t }))}
                    value={tags}
                    onChange={setTags}
                    placeholder="Select common tags..."
                    label="Common Tags"
                />
                <Container layout="flex" gap="sm" align="end">
                    <Input
                        label="Custom Tag"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        placeholder="Enter custom tag..."
                        onKeyPress={e => e.key === 'Enter' && handleAddTag()}
                    />
                    <Button color="tertiary" size="sm" onClick={handleAddTag} disabled={!newTag.trim() || tags.includes(newTag.trim())}>
                        <Icon name="FiPlus" size="xs" /> Add
                    </Button>
                </Container>
                {tags.length > 0 && (
                    <Container layout="flex" gap="xs">
                        {tags.map((tag, i) => (
                            <Badge key={i} color="tertiary" size="sm" style={{ cursor: 'pointer' }} onClick={() => setTags(prev => prev.filter(t => t !== tag))}>
                                {tag} <Icon name="FiX" size="xs" />
                            </Badge>
                        ))}
                    </Container>
                )}
            </Container>
            <Container layout="flex-column" gap="sm">
                <Typography size="sm" weight="semibold">Select files to tag:</Typography>
                {isLoading ? (
                    <Container layout="flex" justify="center" padding="lg"><CircularProgress size="sm" /></Container>
                ) : (
                    <Card padding="md" maxHeight="200px" style={{ overflow: 'auto' }}>
                        <TreeView data={fileTree} multiSelect={true} selectedNodes={selectedFiles} onNodeSelect={handleFileSelect} showIcons={true} />
                    </Card>
                )}
            </Container>
            <Container layout="flex" gap="sm" justify="end">
                <Button color="secondary" onClick={handleCancel} disabled={isLoading}>Cancel</Button>
                <Button color="tertiary" onClick={handleSubmit} disabled={isLoading || selectedFiles.length === 0 || tags.length === 0}>
                    {isLoading ? <><CircularProgress size="xs" /> Tagging...</> : <><Icon name="FiTag" size="xs" /> Tag {selectedFiles.length} file(s)</>}
                </Button>
            </Container>
        </Container>
    );
};

// ─── Bulk Permissions Form ────────────────────────────────────────────────────

const BulkPermissionsForm = ({ onSubmit, onCancel, onClose }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [readUsers, setReadUsers] = useState([]);
    const [writeUsers, setWriteUsers] = useState([]);
    const [fileTree, setFileTree] = useState([]);
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { error: showError } = useNotification();

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const [treeData, usersData] = await Promise.all([
                    fileService.getFileTree(),
                    userService.getUsers({ limit: 100 })
                ]);
                setFileTree(treeData?.tree || []);
                setUsers(usersData?.users || usersData?.data?.users || []);
            } catch {
                showError('Failed to load data');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [showError]);

    const handleFileSelect = useCallback((nodeData, isSelected) => {
        const filePath = nodeData.metadata?.filePath || nodeData.id;
        setSelectedFiles(prev =>
            isSelected ? (prev.includes(filePath) ? prev : [...prev, filePath]) : prev.filter(p => p !== filePath)
        );
    }, []);

    const handleSubmit = async () => {
        if (selectedFiles.length === 0) { showError('Please select at least one file'); return; }
        const permissions = {};
        if (readUsers.length > 0) permissions.read = readUsers;
        if (writeUsers.length > 0) permissions.write = writeUsers;
        if (Object.keys(permissions).length === 0) { showError('Please select at least one permission to update'); return; }
        try {
            setIsLoading(true);
            await onSubmit(selectedFiles, { permissions });
            setSelectedFiles([]); setReadUsers([]); setWriteUsers([]);
            if (onClose) onClose();
        } catch { /* handled by parent */ } finally { setIsLoading(false); }
    };

    const handleCancel = () => { if (onCancel) onCancel(); if (onClose) onClose(); };

    const userOptions = users.map(u => ({
        value: u._id || u.id,
        label: `${u.firstName} ${u.lastName} (@${u.username})`
    }));

    return (
        <Container layout="flex-column" gap="lg" padding="lg" maxWidth="500px" width="100%">
            <Typography as="h3" size="lg" weight="semibold" color="warning">Bulk Update Permissions</Typography>
            <Typography size="sm" color="secondary">Select files and set read/write permissions for users.</Typography>
            <Container layout="flex-column" gap="md">
                <Select multiSelect={true} options={userOptions} value={readUsers} onChange={setReadUsers} placeholder="Select users with read access..." label="Read Permissions" />
                <Select multiSelect={true} options={userOptions} value={writeUsers} onChange={setWriteUsers} placeholder="Select users with write access..." label="Write Permissions" />
            </Container>
            <Container layout="flex-column" gap="sm">
                <Typography size="sm" weight="semibold">Select files to update:</Typography>
                {isLoading ? (
                    <Container layout="flex" justify="center" padding="lg"><CircularProgress size="sm" /></Container>
                ) : (
                    <Card padding="md" maxHeight="200px" style={{ overflow: 'auto' }}>
                        <TreeView data={fileTree} multiSelect={true} selectedNodes={selectedFiles} onNodeSelect={handleFileSelect} showIcons={true} />
                    </Card>
                )}
            </Container>
            <Container layout="flex" gap="sm" justify="end">
                <Button color="secondary" onClick={handleCancel} disabled={isLoading}>Cancel</Button>
                <Button
                    color="warning"
                    onClick={handleSubmit}
                    disabled={isLoading || selectedFiles.length === 0 || (readUsers.length === 0 && writeUsers.length === 0)}
                >
                    {isLoading ? <><CircularProgress size="xs" /> Updating...</> : <><Icon name="FiUsers" size="xs" /> Update {selectedFiles.length} file(s)</>}
                </Button>
            </Container>
        </Container>
    );
};

// ─── Edit User Form ───────────────────────────────────────────────────────────

const EditUserForm = ({ user, onSave, onCancel }) => {
    const { success: showSuccess, error: showError } = useNotification();
    const [formData, setFormData] = useState({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        username: user.username || '',
        email: user.email || '',
        profilePhoto: user.profilePhoto || '',
        roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : ['USER']),
        active: user.active !== false
    });
    const [isSaving, setIsSaving] = useState(false);

    const set = (field, value) => setFormData(p => ({ ...p, [field]: value }));

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await userService.updateUser(user._id || user.id, formData);
            showSuccess('User updated successfully');
            onSave?.();
        } catch {
            showError('Failed to update user');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Container layout="flex-column" gap="lg" padding="lg">
            <Typography as="h3" size="lg" weight="semibold">Edit: {user.firstName} {user.lastName}</Typography>
            <Container layout="grid" columns="2" gap="md">
                <Input label="First Name" value={formData.firstName} onChange={e => set('firstName', e.target.value)} />
                <Input label="Last Name" value={formData.lastName} onChange={e => set('lastName', e.target.value)} />
            </Container>
            <Input label="Username" value={formData.username} onChange={e => set('username', e.target.value)} />
            <Input label="Email" type="email" value={formData.email} onChange={e => set('email', e.target.value)} />
            <Input label="Profile Photo URL" value={formData.profilePhoto} onChange={e => set('profilePhoto', e.target.value)} />
            <Divider />
            <Select
                label="Roles"
                multiSelect
                value={formData.roles}
                onChange={val => set('roles', val)}
                options={[
                    { value: 'USER', label: 'User' },
                    { value: 'CREATOR', label: 'Creator' },
                    { value: 'SUPER_CREATOR', label: 'Super Creator' },
                    { value: 'ADMIN', label: 'Admin' },
                    { value: 'OWNER', label: 'Owner' }
                ]}
            />
            <Container layout="flex" align="center" gap="sm" padding="none">
                <Switch checked={formData.active} onChange={val => set('active', val)} size="sm" />
                <Typography size="sm">Active account</Typography>
            </Container>
            <Container layout="grid" columns="2" gap="md">
                <Container layout="flex-column" gap="xs" padding="none">
                    <Typography size="xs" color="secondary">Created</Typography>
                    <Typography size="sm">{new Date(user.createdAt).toLocaleString()}</Typography>
                </Container>
                {user.updatedAt && (
                    <Container layout="flex-column" gap="xs" padding="none">
                        <Typography size="xs" color="secondary">Last Updated</Typography>
                        <Typography size="sm">{new Date(user.updatedAt).toLocaleString()}</Typography>
                    </Container>
                )}
            </Container>
            <Container layout="flex" gap="sm" justify="end" padding="none">
                <Button color="secondary" onClick={onCancel} disabled={isSaving}>Cancel</Button>
                <Button color="primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <><CircularProgress size="sm" /> Saving…</> : 'Save Changes'}
                </Button>
            </Container>
        </Container>
    );
};

// ─── Shared presentation helpers ──────────────────────────────────────────────

const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatUptime = (seconds = 0) =>
    `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

/** KPI tile — icon plate, value, label */
const StatTile = ({ icon, label, value, caption, accent = 'var(--primary-color)' }) => (
    <Card layout="flex" gap="md" padding="md" hover={false} style={{ alignItems: 'center', minWidth: 0 }}>
        <Container
            layout="flex" align="center" justify="center" padding="none" wrap={false}
            width="40px" height="40px"
            style={{ borderRadius: 10, flexShrink: 0, background: tint(accent, 14) }}
        >
            <Icon name={icon} size="sm" style={{ color: accent }} />
        </Container>
        <Container layout="flex-column" gap="none" padding="none" style={{ minWidth: 0 }}>
            <Typography size="lg" weight="bold" style={{ lineHeight: 1.15 }}>{value}</Typography>
            <Typography size="xxs" color="muted" style={{ whiteSpace: 'nowrap' }}>
                {label}{caption ? ` · ${caption}` : ''}
            </Typography>
        </Container>
    </Card>
);

/** Dense label/value row used across the detail panels */
const MetricRow = ({ label, value, color = 'default', badge = null }) => (
    <Container layout="flex" justify="between" align="center" padding="none" width="100%" wrap={false}>
        <Typography size="xs" color="muted">{label}</Typography>
        {badge || <Typography size="xs" weight="medium" color={color}>{value}</Typography>}
    </Container>
);

/** Titled card used for every detail block */
const Panel = ({ title, actions, children, ...rest }) => (
    <Card layout="flex-column" gap="sm" padding="lg" hover={false} width="100%" style={{ minWidth: 0 }} {...rest}>
        {(title || actions) && (
            <Container layout="flex" justify="between" align="center" padding="none" width="100%" wrap={false}>
                {title && <Typography size="sm" weight="semibold">{title}</Typography>}
                {actions}
            </Container>
        )}
        {children}
    </Card>
);

/** Section intro: title, description and section-level actions */
const SectionHeader = ({ title, description, actions }) => (
    <Container layout="flex" justify="between" align="center" padding="none" width="100%" gap="md" wrap>
        <Container layout="flex-column" gap="none" padding="none" style={{ minWidth: 0 }}>
            <Typography as="h2" size="md" weight="semibold">{title}</Typography>
            {description && <Typography size="xxs" color="muted">{description}</Typography>}
        </Container>
        {actions}
    </Container>
);

const EmptyState = ({ icon, message }) => (
    <Container layout="flex-column" align="center" gap="sm" padding="xl" width="100%">
        <Icon name={icon} size="md" color="secondary" />
        <Typography size="xs" color="muted">{message}</Typography>
    </Container>
);

// ─── Admin Page ───────────────────────────────────────────────────────────────

const AdminPage = () => {
    const navigate = useNavigate();
    const { hasRole } = useAuth();
    const { success: showSuccess, error: showError, info: showInfo } = useNotification();

    const hasAdminAccess = hasRole('ADMIN') || hasRole('OWNER');
    const hasOwnerAccess = hasRole('OWNER');

    const [adminData, setAdminData] = useState({
        health: null,
        cache: null,
        logs: null,
        logStats: null,
        users: null,
        userStats: null,
        files: null,
        appStats: null,
        roleRequests: null,
        errors: []
    });

    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSection, setActiveSection] = useState('overview');
    const [sectionLoading, setSectionLoading] = useState({});
    const sectionDataCache = useRef({});
    const sectionCacheTimeout = useRef({});

    const [clearingCache, setClearingCache] = useState(false);
    const [cacheRefreshed, setCacheRefreshed] = useState(false);
    const [cleanupInfo, setCleanupInfo] = useState(null);
    const [loadingCleanup, setLoadingCleanup] = useState(false);
    const [runningCleanup, setRunningCleanup] = useState(false);

    const [emailTest, setEmailTest] = useState({
        isLoading: false,
        recipient: '',
        template: 'welcome',
        subject: 'Test Email'
    });

    const [activeBulk, setActiveBulk] = useState(null);

    const sections = [
        { id: 'overview', label: 'Overview', icon: 'FiActivity', desc: 'Health & resources' },
        { id: 'cache', label: 'Cache', icon: 'FiDatabase', desc: 'Redis & cleanup' },
        { id: 'files', label: 'Files', icon: 'FiFolder', desc: 'Storage & bulk ops' },
        { id: 'users', label: 'Users', icon: 'FiUsers', desc: 'Accounts & roles' },
        { id: 'logs', label: 'Logs', icon: 'FiFileText', desc: 'Requests & errors' },
        { id: 'email', label: 'Email', icon: 'FiMail', desc: 'Delivery testing' },
        { id: 'appstats', label: 'App Stats', icon: 'FiBarChart2', desc: 'Application metrics' },
        ...(hasOwnerAccess ? [{ id: 'role-requests', label: 'Role Requests', icon: 'FiUserCheck', desc: 'Pending elevations' }] : [])
    ];

    const loadSectionData = useCallback(async (section, forceRefresh = false) => {
        if (sectionLoading[section] && !forceRefresh) return;
        const cacheKey = section;
        const cached = sectionDataCache.current[cacheKey];
        const cacheValid = cached && !forceRefresh && (Date.now() - (sectionCacheTimeout.current[cacheKey] || 0)) < 30000;
        if (cacheValid) return;
        setSectionLoading(prev => ({ ...prev, [section]: true }));
        if (forceRefresh) setRefreshing(true);
        try {
            let data = {};
            switch (section) {
                case 'overview':
                case 'appstats': {
                    const [health, overviewStats] = await Promise.all([
                        appService.getHealth(),
                        appService.getOverviewStats()
                    ]);
                    data = { health, appStats: overviewStats.statistics };
                    break;
                }
                case 'cache': {
                    const cacheStats = await cacheService.getStats();
                    data = { cache: cacheStats.cacheStats };
                    break;
                }
                case 'users': {
                    const [userStatsData, userListData] = await Promise.all([
                        userService.getStats(),
                        userService.getUsers({ limit: 50 })
                    ]);
                    data = {
                        users: userListData.users,
                        userStats: userStatsData.overview
                    };
                    break;
                }
                case 'logs': {
                    const [logsData, logStatsData] = await Promise.all([
                        appService.getLogs({}),
                        appService.getLogStats()
                    ]);
                    data = {
                        logs: logsData.logs,
                        logStats: logStatsData.stats
                    };
                    break;
                }
                case 'files': {
                    const fileStatsResponse = await fileService.getFileStats();
                    const fsd = fileStatsResponse;
                    const fb = (b) => {
                        if (!b || b === 0) return '0 B';
                        const s = ['B', 'KB', 'MB', 'GB', 'TB'];
                        const i = Math.floor(Math.log(b) / Math.log(1024));
                        return `${(b / Math.pow(1024, i)).toFixed(2)} ${s[i]}`;
                    };
                    data = {
                        files: {
                            overview: {
                                totalFiles: fsd?.totalFiles || 0,
                                totalDirectories: fsd?.filesByType?.directories || 0,
                                totalTextFiles: fsd?.filesByType?.textFiles || 0,
                                totalBinaryFiles: fsd?.filesByType?.binaryFiles || 0,
                                totalSize: fsd?.totalSize || 0,
                                humanReadableSize: fb(fsd?.totalSize || 0)
                            },
                            sizeStats: {
                                totalSize: fsd?.sizeStats?.totalSize || 0,
                                avgSize: fsd?.sizeStats?.avgSize || 0,
                                maxSize: fsd?.sizeStats?.maxSize || 0,
                                minSize: fsd?.sizeStats?.minSize || 0
                            },
                            distribution: {
                                byType: fsd?.filesByType?.typeDistribution || [],
                                byUser: fsd?.recentActivity?.topUsers || []
                            },
                            compression: fsd?.compressionStats || null,
                            recentActivity: {
                                recentFiles: fsd?.recentActivity?.recentFiles || 0,
                                timeframe: fsd?.recentActivity?.timeframe || '7 days',
                                topUsers: fsd?.recentActivity?.topUsers || []
                            },
                            meta: fsd?.meta || {}
                        }
                    };
                    break;
                }
                case 'role-requests': {
                    if (hasOwnerAccess) {
                        const response = await authService.getPendingRoleRequests();
                        data = { roleRequests: response.pendingRequests };
                    }
                    break;
                }
                case 'email':
                    return;
                default:
                    return;
            }
            setAdminData(prev => ({ ...prev, ...data }));
            sectionDataCache.current[cacheKey] = data;
            sectionCacheTimeout.current[cacheKey] = Date.now();
            if (forceRefresh) showSuccess(`${section.charAt(0).toUpperCase() + section.slice(1)} data refreshed`);
        } catch {
            showError(`Failed to load ${section} data`);
        } finally {
            setSectionLoading(prev => ({ ...prev, [section]: false }));
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [showError, showSuccess, hasOwnerAccess]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!hasAdminAccess) { setIsLoading(false); return; }
        loadSectionData(activeSection);
    }, [hasAdminAccess, activeSection, loadSectionData]);

    useEffect(() => {
        return () => {
            sectionDataCache.current = {};
            sectionCacheTimeout.current = {};
        };
    }, []);

    const handleClearCache = async () => {
        setClearingCache(true);
        try {
            await cacheService.clearCache();
            showSuccess('Cache cleared successfully');
            if (activeSection === 'cache') await loadSectionData('cache', true);
            setCacheRefreshed(true);
            setTimeout(() => setCacheRefreshed(false), 3000);
        } catch { showError('Failed to clear cache'); }
        finally { setClearingCache(false); }
    };

    const handleGetCleanupInfo = async () => {
        setLoadingCleanup(true);
        try {
            const result = await cacheService.getCleanupStatus();
            setCleanupInfo(result.cleanup);
            showInfo('Cache cleanup information retrieved');
        } catch { showError('Failed to get cache cleanup information'); }
        finally { setLoadingCleanup(false); }
    };

    const handleRunCleanup = async () => {
        setRunningCleanup(true);
        try {
            const result = await cacheService.triggerCleanup();
            showSuccess(`Cache cleanup completed! Cleaned ${result.cleanup?.keysRemoved || 0} keys`);
            await handleGetCleanupInfo();
        } catch { showError('Failed to run cache cleanup'); }
        finally { setRunningCleanup(false); }
    };

    const handleSendTestEmail = async () => {
        if (!emailTest.recipient) { showError('Please enter a recipient email'); return; }
        setEmailTest(prev => ({ ...prev, isLoading: true }));
        try {
            await appService.sendTestEmail({
                to: emailTest.recipient,
                template: emailTest.template,
                subject: emailTest.subject,
                templateData: { firstName: 'Test', lastName: 'User', appName: 'FileIO' }
            });
            showSuccess(`Test email sent to ${emailTest.recipient}`);
            setEmailTest(prev => ({ ...prev, recipient: '' }));
        } catch { showError('Failed to send test email'); }
        finally { setEmailTest(prev => ({ ...prev, isLoading: false })); }
    };

    const handleBulkDelete = async (filePaths, options) => {
        try {
            const result = await fileService.bulkOperation('delete', filePaths, options);
            const { meta } = result;
            if (meta?.summary) {
                const { successful, failed, total } = meta.summary;
                if (successful > 0) showSuccess(`Successfully deleted ${successful} of ${total} files`);
                if (failed > 0) showError(`Failed to delete ${failed} files`);
            } else { showSuccess('Bulk delete completed'); }
            if (activeSection === 'files') await loadSectionData('files', true);
        } catch (error) { showError(`Bulk delete failed: ${error.response?.data?.message || error.message}`); }
    };

    const handleBulkTag = async (filePaths, options) => {
        try {
            const result = await fileService.bulkOperation('addTags', filePaths, options);
            const { meta } = result;
            if (meta?.summary) {
                const { successful, failed, total } = meta.summary;
                if (successful > 0) showSuccess(`Successfully tagged ${successful} of ${total} files`);
                if (failed > 0) showError(`Failed to tag ${failed} files`);
            } else { showSuccess('Bulk tag completed'); }
            if (activeSection === 'files') await loadSectionData('files', true);
        } catch (error) { showError(`Bulk tag failed: ${error.response?.data?.message || error.message}`); }
    };

    const handleBulkPermissions = async (filePaths, options) => {
        try {
            const result = await fileService.bulkOperation('updatePermissions', filePaths, options);
            const { meta } = result;
            if (meta?.summary) {
                const { successful, failed, total } = meta.summary;
                if (successful > 0) showSuccess(`Updated permissions for ${successful} of ${total} files`);
                if (failed > 0) showError(`Failed to update permissions for ${failed} files`);
            } else { showSuccess('Bulk permissions update completed'); }
            if (activeSection === 'files') await loadSectionData('files', true);
        } catch (error) { showError(`Bulk permissions failed: ${error.response?.data?.message || error.message}`); }
    };

    if (!hasAdminAccess) {
        return (
            <Page layout="flex" align="center" justify="center">
                <Container layout="flex-column" align="center" gap="md">
                    <Icon name="FiLock" size="xl" color="error" />
                    <Typography size="xl" weight="bold">Access Denied</Typography>
                    <Typography color="secondary">Admin or Owner role required.</Typography>
                </Container>
            </Page>
        );
    }

    if (isLoading) {
        return <PageLoading message="Loading admin dashboard..." />;
    }

    return (
        <Page layout="flex-column" padding="none" gap="none">
            <Container
                layout="flex-column" gap="lg" padding="none" width="100%" maxWidth="1400px"
                style={{ margin: '0 auto', padding: 'clamp(20px, 3vw, 36px)' }}
            >
                {/* Header */}
                <Container layout="flex" justify="between" align="center" padding="none" width="100%" gap="md" wrap>
                    <Container layout="flex-column" gap="none" padding="none">
                        <Typography size="xs" color="muted" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Administration
                        </Typography>
                        <Typography as="h1" size="xl" weight="bold" style={{ letterSpacing: '-0.015em' }}>
                            Admin Console
                        </Typography>
                    </Container>
                    <Container layout="flex" align="center" gap="sm" padding="none" wrap>
                        <Container layout="flex-column" align="end" gap="none" padding="none">
                            <Badge size="sm" color={adminData.health?.status === 'ok' ? 'success' : 'error'}>
                                {adminData.health?.status === 'ok' ? 'System healthy' : 'System issues'}
                            </Badge>
                            <Typography size="xxs" color="muted">
                                {adminData.health?.timestamp ? `Checked ${new Date(adminData.health.timestamp).toLocaleTimeString()}` : ''}
                            </Typography>
                        </Container>
                        <Button size="sm" color="secondary" onClick={() => loadSectionData(activeSection, true)} disabled={refreshing}>
                            <Icon name="FiRefreshCw" size="xs" />{refreshing ? 'Refreshing…' : 'Refresh'}
                        </Button>
                        <Button size="sm" color="primary" onClick={() => navigate('/dashboard')}>
                            <Icon name="FiGrid" size="xs" />Dashboard
                        </Button>
                    </Container>
                </Container>

                {adminData.errors.length > 0 && (
                    <Card padding="md" hover={false} style={{ borderColor: 'var(--error-color)' }}>
                        <Container layout="flex-column" gap="xs" padding="none">
                            <Typography size="sm" weight="semibold" color="error">Data loading errors</Typography>
                            {adminData.errors.map((err, i) => <Typography key={i} size="xs" color="muted">• {err}</Typography>)}
                        </Container>
                    </Card>
                )}

                {/* Main layout: sidebar + content */}
                <Container layout="flex" gap="lg" align="start" padding="none" width="100%" wrap>
                    {/* Sidebar */}
                    <Card padding="sm" hover={false} style={{ flex: '0 1 240px', minWidth: 200, position: 'sticky', top: 20 }}>
                        <Container layout="flex-column" gap="none" padding="none" width="100%">
                            {sections.map(section => (
                                <Container
                                    key={section.id}
                                    layout="flex" align="center" gap="sm" padding="sm"
                                    hoverable
                                    wrap={false}
                                    onClick={() => setActiveSection(section.id)}
                                    width="100%"
                                    style={activeSection === section.id ? { background: tint('var(--primary-color)', 12), borderRadius: 'var(--border-radius-lg)' } : {}}
                                >
                                    <Icon name={section.icon} size="sm" color={activeSection === section.id ? 'primary' : 'text'} />
                                    <Container layout="flex-column" gap="none" padding="none" style={{ minWidth: 0, overflow: 'hidden' }}>
                                        <Typography size="sm" weight={activeSection === section.id ? 'semibold' : 'medium'} color={activeSection === section.id ? 'primary' : 'default'}>
                                            {section.label}
                                        </Typography>
                                        <Typography size="xxs" color="muted" style={{ display: 'block', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {section.desc}
                                        </Typography>
                                    </Container>
                                </Container>
                            ))}
                        </Container>
                    </Card>

                    {/* Content */}
                    <Container layout="flex-column" gap="md" padding="none" style={{ flex: '1 1 560px', minWidth: 0 }}>

                        {sectionLoading[activeSection] && (
                            <Card layout="flex" padding="xl" hover={false} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                                <CircularProgress size="sm" />
                            </Card>
                        )}

                        {/* ── Overview ── */}
                        {activeSection === 'overview' && !sectionLoading.overview && (
                            <>
                                <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                                    <StatTile icon="FiGlobe" label="Environment" value={adminData.health?.env?.toUpperCase() || '—'}
                                        caption={adminData.health?.system ? `${adminData.health.system.platform} ${adminData.health.system.arch}` : null} />
                                    <StatTile icon="FiClock" label="Uptime" value={formatUptime(adminData.health?.system?.uptime)}
                                        caption={adminData.health?.system?.nodeVersion} accent="var(--success-color)" />
                                    <StatTile icon="FiDatabase" label="Database" value={adminData.health?.database?.status === 'connected' ? 'Connected' : (adminData.health?.database?.status || '—')}
                                        caption={adminData.health?.database?.latencyMs != null ? `${adminData.health.database.latencyMs}ms latency` : null}
                                        accent={adminData.health?.database?.status === 'connected' ? 'var(--success-color)' : 'var(--error-color)'} />
                                    <StatTile icon="FiCpu" label="Heap memory"
                                        value={adminData.health?.system?.memoryUsage ? `${((adminData.health.system.memoryUsage.heapUsed / adminData.health.system.memoryUsage.heapTotal) * 100).toFixed(0)}%` : '—'}
                                        caption={adminData.health?.system?.memoryUsage ? `${(adminData.health.system.memoryUsage.heapUsed / 1048576).toFixed(0)} / ${(adminData.health.system.memoryUsage.heapTotal / 1048576).toFixed(0)} MB` : null}
                                        accent="var(--warning-color)" />
                                </Container>
                                <Container layout="grid" columns={3} gap="md" padding="none" width="100%">
                                    <Panel title="Memory">
                                        {adminData.health?.system?.memoryUsage ? (() => {
                                            const mem = adminData.health.system.memoryUsage;
                                            const pct = mem.heapUsed / mem.heapTotal;
                                            return (
                                                <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                    <ProgressBar value={mem.heapUsed} max={mem.heapTotal} color={pct > 0.8 ? 'error' : pct > 0.6 ? 'warning' : 'success'} showPercentage size="sm" width="100%" />
                                                    <MetricRow label="Heap used" value={`${(mem.heapUsed / 1048576).toFixed(1)} MB`} />
                                                    <MetricRow label="Heap total" value={`${(mem.heapTotal / 1048576).toFixed(1)} MB`} />
                                                    <MetricRow label="RSS" value={`${(mem.rss / 1048576).toFixed(1)} MB`} />
                                                    <MetricRow label="External" value={`${(mem.external / 1048576).toFixed(1)} MB`} />
                                                </Container>
                                            );
                                        })() : <EmptyState icon="FiCpu" message="Memory data not available" />}
                                    </Panel>
                                    <Panel title="System">
                                        {adminData.health?.system ? (
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Platform" value={`${adminData.health.system.platform} (${adminData.health.system.arch})`} />
                                                <MetricRow label="Node.js" value={adminData.health.system.nodeVersion} />
                                                <MetricRow label="Uptime" value={formatUptime(adminData.health.system.uptime)} />
                                                <MetricRow label="Environment" value={adminData.health?.env || '—'} />
                                            </Container>
                                        ) : <EmptyState icon="FiServer" message="System data not available" />}
                                    </Panel>
                                    <Panel title="Database">
                                        {adminData.health?.database ? (
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Status" badge={
                                                    <Badge size="xs" color={adminData.health.database.status === 'connected' ? 'success' : 'error'}>
                                                        {adminData.health.database.status?.toUpperCase()}
                                                    </Badge>} />
                                                <MetricRow label="Connection" value={adminData.health.database.connection} />
                                                <MetricRow label="Latency" value={`${adminData.health.database.latencyMs}ms`} />
                                            </Container>
                                        ) : <EmptyState icon="FiDatabase" message="Database data not available" />}
                                    </Panel>
                                </Container>
                            </>
                        )}

                        {/* ── Cache ── */}
                        {activeSection === 'cache' && !sectionLoading.cache && (
                            <>
                                <SectionHeader
                                    title="Cache management"
                                    description="Redis performance, cleanup service, and emergency controls"
                                    actions={
                                        <Container layout="flex" gap="xs" padding="none" wrap>
                                            <Button size="sm" color="secondary" onClick={handleGetCleanupInfo} disabled={loadingCleanup}>
                                                <Icon name="FiInfo" size="xs" />{loadingCleanup ? 'Loading…' : 'Cleanup status'}
                                            </Button>
                                            <Button size="sm" color="primary" onClick={handleRunCleanup} disabled={runningCleanup || loadingCleanup}>
                                                <Icon name="FiPlay" size="xs" />{runningCleanup ? 'Running…' : 'Run cleanup'}
                                            </Button>
                                            <Button size="sm" color="error" onClick={handleClearCache} disabled={clearingCache}>
                                                <Icon name="FiTrash2" size="xs" />{clearingCache ? 'Clearing…' : 'Clear all'}
                                            </Button>
                                        </Container>
                                    }
                                />
                                {adminData.cache && (
                                    <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                                        <StatTile icon="FiTarget" label="Hit rate" value={`${adminData.cache.cacheHitRate?.toFixed(1) ?? '0'}%`}
                                            accent={adminData.cache.cacheHitRate > 80 ? 'var(--success-color)' : 'var(--warning-color)'}
                                            caption={cacheRefreshed ? 'refreshed' : null} />
                                        <StatTile icon="FiHardDrive" label="Used memory" value={adminData.cache.redisInfo?.memory?.used_memory_human || '—'}
                                            caption={`peak ${adminData.cache.redisInfo?.memory?.used_memory_peak_human || '—'}`} />
                                        <StatTile icon="FiZap" label="Ops / sec" value={adminData.cache.redisInfo?.stats?.instantaneous_ops_per_sec || '0'}
                                            accent="var(--tertiary-accent-color, var(--tertiary-color))" />
                                        <StatTile icon="FiLink" label="Connections" value={adminData.cache.redisInfo?.stats?.total_connections_received ? parseInt(adminData.cache.redisInfo.stats.total_connections_received).toLocaleString() : '—'}
                                            accent="var(--neutral-color)" />
                                    </Container>
                                )}
                                {cleanupInfo && (
                                    <Panel
                                        title="Cleanup service"
                                        actions={
                                            <Button size="xs" color="secondary" onClick={() => setCleanupInfo(null)}>
                                                <Icon name="FiX" size="xs" />Close
                                            </Button>
                                        }
                                    >
                                        <Container layout="grid" columns={2} gap="md" padding="none" width="100%">
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Service" badge={<Badge size="xs" color={cleanupInfo.enabled ? 'success' : 'warning'}>{cleanupInfo.enabled ? 'Active' : 'Disabled'}</Badge>} />
                                                <MetricRow label="Interval" value={cleanupInfo.intervalHours ? `${cleanupInfo.intervalHours}h` : '—'} />
                                                <MetricRow label="Minimum age" value={cleanupInfo.minAgeHours ? `${cleanupInfo.minAgeHours}h` : '—'} />
                                            </Container>
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Last run" value={cleanupInfo.lastRun ? new Date(cleanupInfo.lastRun).toLocaleString() : 'Never'} />
                                                <MetricRow label="Next run" value={cleanupInfo.nextRun ? new Date(cleanupInfo.nextRun).toLocaleString() : '—'} />
                                                <MetricRow label="Keys cleaned" value={cleanupInfo.lastRunStats?.keysRemoved ?? 0} />
                                            </Container>
                                        </Container>
                                    </Panel>
                                )}
                                {adminData.cache && (
                                    <Container layout="grid" columns={2} gap="md" padding="none" width="100%">
                                        <Panel title="Performance">
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Keyspace hits" value={adminData.cache.redisInfo?.stats?.keyspace_hits ? parseInt(adminData.cache.redisInfo.stats.keyspace_hits).toLocaleString() : '—'} />
                                                <MetricRow label="Keyspace misses" value={adminData.cache.redisInfo?.stats?.keyspace_misses ? parseInt(adminData.cache.redisInfo.stats.keyspace_misses).toLocaleString() : '—'} />
                                                <MetricRow label="Expired keys" value={adminData.cache.redisInfo?.stats?.expired_keys ? parseInt(adminData.cache.redisInfo.stats.expired_keys).toLocaleString() : '—'} />
                                                <MetricRow label="Commands processed" value={adminData.cache.redisInfo?.stats?.total_commands_processed ? parseInt(adminData.cache.redisInfo.stats.total_commands_processed).toLocaleString() : '—'} />
                                            </Container>
                                        </Panel>
                                        <Panel title="Memory">
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Used" value={adminData.cache.redisInfo?.memory?.used_memory_human || '—'} />
                                                <MetricRow label="Peak" value={adminData.cache.redisInfo?.memory?.used_memory_peak_human || '—'} />
                                                <MetricRow label="Fragmentation" value={adminData.cache.redisInfo?.memory?.mem_fragmentation_ratio || '—'} />
                                                <MetricRow label="Updated" value={adminData.cache.timestamp ? new Date(adminData.cache.timestamp).toLocaleTimeString() : '—'} />
                                            </Container>
                                        </Panel>
                                    </Container>
                                )}
                            </>
                        )}

                        {/* ── Files ── */}
                        {activeSection === 'files' && !sectionLoading.files && (
                            <>
                                <SectionHeader title="File system" description="Storage analytics and bulk operations" />
                                <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                                    <StatTile icon="FiFile" label="Files" value={(adminData.files?.overview?.totalFiles || 0).toLocaleString()} />
                                    <StatTile icon="FiFolder" label="Directories" value={(adminData.files?.overview?.totalDirectories || 0).toLocaleString()} accent="var(--tertiary-accent-color, var(--tertiary-color))" />
                                    <StatTile icon="FiHardDrive" label="Storage" value={adminData.files?.overview?.humanReadableSize || '0 B'} accent="var(--success-color)" />
                                    <StatTile icon="FiFileText" label="Text / binary" value={`${(adminData.files?.overview?.totalTextFiles || 0).toLocaleString()} / ${(adminData.files?.overview?.totalBinaryFiles || 0).toLocaleString()}`} accent="var(--warning-color)" />
                                </Container>
                                <Container layout="grid" columns={2} gap="md" padding="none" width="100%">
                                    <Panel title="Type distribution">
                                        {adminData.files?.distribution?.byType?.length > 0 ? (
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                {adminData.files.distribution.byType.slice(0, 8).map((type, index) => (
                                                    <MetricRow key={index} label={type._id || 'Unknown'} value={`${type.count} · ${formatBytes(type.totalSize || 0)}`} />
                                                ))}
                                            </Container>
                                        ) : <EmptyState icon="FiPieChart" message="No type distribution data" />}
                                    </Panel>
                                    <Panel title="Storage statistics">
                                        <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                            <MetricRow label="Total" value={formatBytes(adminData.files?.sizeStats?.totalSize || 0)} />
                                            <MetricRow label="Average file" value={formatBytes(adminData.files?.sizeStats?.avgSize || 0)} />
                                            <MetricRow label="Largest file" value={formatBytes(adminData.files?.sizeStats?.maxSize || 0)} />
                                            <MetricRow label="Recent activity" value={`${adminData.files?.recentActivity?.recentFiles || 0} files / ${adminData.files?.recentActivity?.timeframe || '7 days'}`} />
                                        </Container>
                                    </Panel>
                                </Container>
                                <Panel title="Bulk operations">
                                    <Container layout="flex" gap="xs" padding="none" wrap>
                                        <Button size="sm" color="error" selected={activeBulk === 'delete'} onClick={() => setActiveBulk(activeBulk === 'delete' ? null : 'delete')}>
                                            <Icon name="FiTrash2" size="xs" />Delete
                                        </Button>
                                        <Button size="sm" color="secondary" selected={activeBulk === 'tag'} onClick={() => setActiveBulk(activeBulk === 'tag' ? null : 'tag')}>
                                            <Icon name="FiTag" size="xs" />Tag
                                        </Button>
                                        <Button size="sm" color="secondary" selected={activeBulk === 'permissions'} onClick={() => setActiveBulk(activeBulk === 'permissions' ? null : 'permissions')}>
                                            <Icon name="FiUsers" size="xs" />Permissions
                                        </Button>
                                    </Container>
                                    {activeBulk === 'delete' && <BulkDeleteForm onSubmit={handleBulkDelete} onCancel={() => setActiveBulk(null)} onClose={() => setActiveBulk(null)} />}
                                    {activeBulk === 'tag' && <BulkTagForm onSubmit={handleBulkTag} onCancel={() => setActiveBulk(null)} onClose={() => setActiveBulk(null)} />}
                                    {activeBulk === 'permissions' && <BulkPermissionsForm onSubmit={handleBulkPermissions} onCancel={() => setActiveBulk(null)} onClose={() => setActiveBulk(null)} />}
                                </Panel>
                            </>
                        )}

                        {/* ── Users ── */}
                        {activeSection === 'users' && !sectionLoading.users && (
                            <>
                                <SectionHeader title="Users" description="Accounts, roles, and activity — right-click a row to edit" />
                                <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                                    <StatTile icon="FiUsers" label="Total" value={adminData.userStats?.summary?.totalUsers?.toLocaleString() || (Array.isArray(adminData.users) ? adminData.users.length : 0)} />
                                    <StatTile icon="FiUserCheck" label="Active" value={adminData.userStats?.summary?.activeUsers?.toLocaleString() || '—'} accent="var(--success-color)" />
                                    <StatTile icon="FiUserPlus" label="New this week" value={adminData.userStats?.summary?.newThisWeek || 0} accent="var(--tertiary-accent-color, var(--tertiary-color))" />
                                    <StatTile icon="FiShield" label="Admins" value={adminData.userStats?.summary?.adminUsers || 0} accent="var(--warning-color)" />
                                </Container>
                                {adminData.users && Array.isArray(adminData.users) && adminData.users.length > 0 ? (
                                    <Panel title={`All users (${adminData.users.length})`}>
                                        <Data
                                            data={adminData.users}
                                            size="xs"
                                            fieldConfig={{
                                                firstName: { component: Typography, props: { size: 'xs', weight: 'medium' } },
                                                lastName: { component: Typography, props: { size: 'xs', weight: 'medium' } },
                                                username: { component: Typography, props: { size: 'xs', color: 'secondary' } },
                                                email: { component: Typography, props: { size: 'xs', color: 'primary' } },
                                                roles: { component: Badge, props: { size: 'xs' }, transform: (value) => { const role = Array.isArray(value) ? value[0] : value; return { color: role === 'OWNER' ? 'error' : role === 'ADMIN' ? 'warning' : role === 'SUPER_CREATOR' ? 'success' : role === 'CREATOR' ? 'tertiary' : 'default', children: role }; } },
                                                active: { component: Badge, props: { size: 'xs' }, transform: (value) => ({ color: value ? 'success' : 'error', children: value ? 'Active' : 'Inactive' }) },
                                                emailVerified: { component: Badge, props: { size: 'xs' }, transform: (value) => ({ color: value ? 'success' : 'warning', children: value ? 'Verified' : 'Unverified' }) },
                                                createdAt: { component: Typography, props: { size: 'xs', color: 'secondary' }, transform: (value) => ({ children: new Date(value).toLocaleDateString() }) },
                                                lastLogin: { component: Typography, props: { size: 'xs', color: 'muted' }, transform: (value) => ({ children: value ? new Date(value).toLocaleDateString() : 'Never' }) }
                                            }}
                                            exclude={['_id', '__v', 'password', 'resetPasswordToken', 'resetPasswordExpires', 'emailVerificationToken']}
                                            searchable filterable paginated pageSize={25} sortable width="100%"
                                            genie={{ trigger: 'contextmenu', variant: 'modal', content: (user) => (
                                                <EditUserForm user={user} onSave={async () => { await loadSectionData('users', true); document.querySelector('[data-genie-backdrop]')?.click(); }} onCancel={() => { document.querySelector('[data-genie-backdrop]')?.click(); }} />
                                            )}}
                                        />
                                    </Panel>
                                ) : <EmptyState icon="FiUsers" message="No users loaded" />}
                                {adminData.userStats?.roles && (
                                    <Panel title="Role distribution">
                                        <Container layout="grid" columns="auto-sm" gap="md" padding="none" width="100%">
                                            {adminData.userStats.roles.map((roleData) => (
                                                <Container key={roleData.role} layout="flex-column" gap="xs" padding="none" style={{ minWidth: 0 }}>
                                                    <MetricRow label={roleData.role} value={`${roleData.count} · ${roleData.percentage}%`} />
                                                    <ProgressBar value={roleData.count} max={adminData.userStats.summary?.totalUsers || 1} color={roleData.role === 'OWNER' ? 'error' : roleData.role === 'ADMIN' ? 'warning' : 'primary'} size="xs" width="100%" />
                                                </Container>
                                            ))}
                                        </Container>
                                    </Panel>
                                )}
                            </>
                        )}

                        {/* ── Logs ── */}
                        {activeSection === 'logs' && !sectionLoading.logs && (
                            <>
                                <SectionHeader title="Logs" description="Request history, warnings, and errors" />
                                <Container layout="grid" columns="auto-sm" gap="sm" padding="none" width="100%">
                                    <StatTile icon="FiFileText" label="Total logs" value={(adminData.logStats?.overview?.totalLogs || 0).toLocaleString()} />
                                    <StatTile icon="FiCalendar" label="Today" value={(adminData.logStats?.overview?.logsToday || 0).toLocaleString()} accent="var(--success-color)" />
                                    <StatTile icon="FiAlertTriangle" label="Warnings today" value={(adminData.logStats?.warnings?.today || 0).toLocaleString()} accent="var(--warning-color)" />
                                    <StatTile icon="FiAlertOctagon" label="Errors today" value={(adminData.logStats?.errors?.today || 0).toLocaleString()} accent="var(--error-color)" />
                                </Container>
                                {adminData.logStats?.summary && (
                                    <Panel title="Health summary">
                                        <Container layout="grid" columns="auto-sm" gap="md" padding="none" width="100%">
                                            <Container layout="flex-column" gap="xs" padding="none" style={{ minWidth: 0 }}>
                                                <MetricRow label="System health" value={`${adminData.logStats.summary.systemHealth}%`} color={(adminData.logStats.summary.systemHealth || 0) > 95 ? 'success' : 'warning'} />
                                                <ProgressBar value={adminData.logStats.summary.systemHealth || 0} max={100} color={(adminData.logStats.summary.systemHealth || 0) > 95 ? 'success' : (adminData.logStats.summary.systemHealth || 0) > 85 ? 'warning' : 'error'} size="xs" width="100%" />
                                            </Container>
                                            <MetricRow label="Error rate" value={`${adminData.logStats.summary.errorRate}%`} color={(adminData.logStats.summary.errorRate || 0) > 10 ? 'error' : 'default'} />
                                            <MetricRow label="Avg response" value={`${adminData.logStats.summary.avgResponseTime?.toFixed(1)}ms`} />
                                            <MetricRow label="Daily requests" value={adminData.logStats.summary.dailyRequestRate?.toFixed(0)} />
                                        </Container>
                                    </Panel>
                                )}
                                {adminData.logs && adminData.logs.length > 0 ? (
                                    <Panel title={`Request log (${adminData.logs.length})`}>
                                        <Data data={adminData.logs}
                                            size="xs"
                                            fieldConfig={{
                                                timestamp: { component: Typography, props: { size: 'xs', color: 'secondary' }, transform: (value) => ({ children: new Date(value).toLocaleString() }) },
                                                method: { component: Badge, props: { size: 'xs' }, transform: (value) => ({ color: value === 'POST' ? 'primary' : value === 'PUT' || value === 'PATCH' ? 'warning' : value === 'DELETE' ? 'error' : 'default', children: value }) },
                                                url: { component: Typography, props: { size: 'xs' }, truncate: true, maxLength: 80 },
                                                statusCode: { component: Badge, props: { size: 'xs' }, transform: (value) => ({ color: value >= 500 ? 'error' : value >= 400 ? 'warning' : value >= 300 ? 'tertiary' : 'success', children: value }) },
                                                responseTime: { component: Typography, props: { size: 'xs' }, transform: (value) => ({ children: value ? `${value}ms` : '—', color: value > 1000 ? 'error' : value > 500 ? 'warning' : 'default' }) }
                                            }}
                                            exclude={['__v']} searchable filterable paginated pageSize={15} sortable width="100%"
                                        />
                                    </Panel>
                                ) : <EmptyState icon="FiFileText" message="No system logs available" />}
                                {adminData.logStats?.breakdowns?.statusCodes && (
                                    <Panel title="Status codes">
                                        <Container layout="grid" columns="auto-sm" gap="md" padding="none" width="100%">
                                            {adminData.logStats.breakdowns.statusCodes.map((stat, index) => (
                                                <Container key={index} layout="flex-column" gap="xs" padding="none" style={{ minWidth: 0 }}>
                                                    <MetricRow label={String(stat._id)} value={stat.count?.toLocaleString()} />
                                                    <ProgressBar value={stat.count} max={adminData.logStats.overview?.totalLogs || 1} color={String(stat._id).startsWith('2') ? 'success' : String(stat._id).startsWith('4') ? 'warning' : String(stat._id).startsWith('5') ? 'error' : 'primary'} size="xs" width="100%" />
                                                </Container>
                                            ))}
                                        </Container>
                                    </Panel>
                                )}
                            </>
                        )}

                        {/* ── Email ── */}
                        {activeSection === 'email' && (
                            <>
                                <SectionHeader title="Email delivery" description="Send a rendered template to any address to verify SMTP settings" />
                                <Panel title="Send test email">
                                    <Container layout="grid" columns={2} gap="md" padding="none" width="100%">
                                        <Input size="sm" label="Recipient" type="email" value={emailTest.recipient} onChange={e => setEmailTest(prev => ({ ...prev, recipient: e.target.value }))} placeholder="test@example.com" width="100%" />
                                        <Select size="sm" label="Template" value={emailTest.template} onChange={value => setEmailTest(prev => ({ ...prev, template: value }))} width="100%"
                                            options={[{ value: 'welcome', label: 'Welcome Email' }, { value: 'password-reset', label: 'Password Reset' }, { value: 'password-changed', label: 'Password Changed' }, { value: 'security-alert', label: 'Security Alert' }]} />
                                        <Input size="sm" label="Subject" value={emailTest.subject} onChange={e => setEmailTest(prev => ({ ...prev, subject: e.target.value }))} placeholder="Test Email Subject" width="100%" />
                                    </Container>
                                    <Container layout="flex" justify="end" padding="none" width="100%">
                                        <Button size="sm" color="primary" onClick={handleSendTestEmail} disabled={emailTest.isLoading || !emailTest.recipient}>
                                            <Icon name="FiSend" size="xs" />{emailTest.isLoading ? 'Sending…' : 'Send test email'}
                                        </Button>
                                    </Container>
                                </Panel>
                            </>
                        )}

                        {/* ── App Stats ── */}
                        {activeSection === 'appstats' && !sectionLoading.appstats && (
                            <>
                                <SectionHeader title="Application statistics" description="Aggregated application, service, and activity metrics" />
                                {adminData.appStats ? (
                                    <Container layout="grid" columns={2} gap="md" padding="none" width="100%">
                                        <Panel title="Summary">
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Total users" value={adminData.appStats.summary?.totalUsers || 0} />
                                                <MetricRow label="Active users" value={adminData.appStats.summary?.activeUsers || 0} />
                                                <MetricRow label="Total files" value={adminData.appStats.summary?.totalFiles || 0} />
                                                <MetricRow label="Total requests" value={adminData.appStats.summary?.totalRequests || 0} />
                                                <MetricRow label="Error rate" value={`${adminData.appStats.summary?.errorRate || 0}%`} color={(adminData.appStats.summary?.errorRate || 0) > 10 ? 'error' : 'default'} />
                                            </Container>
                                        </Panel>
                                        <Panel title="System">
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Node version" value={adminData.appStats.system?.nodeVersion || '—'} />
                                                <MetricRow label="Platform" value={adminData.appStats.system?.platform || '—'} />
                                                <MetricRow label="Environment" value={adminData.appStats.system?.environment || '—'} />
                                                <MetricRow label="Uptime" value={formatUptime(adminData.appStats.system?.uptime)} />
                                            </Container>
                                        </Panel>
                                        <Panel title="Services">
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Database" badge={<Badge size="xs" color={adminData.appStats.services?.database?.status === 'connected' ? 'success' : 'error'}>{adminData.appStats.services?.database?.status === 'connected' ? 'Connected' : 'Disconnected'}</Badge>} />
                                                <MetricRow label="Cache" badge={<Badge size="xs" color={adminData.appStats.services?.cache?.status === 'connected' ? 'success' : 'error'}>{adminData.appStats.services?.cache?.status === 'connected' ? 'Connected' : 'Disconnected'}</Badge>} />
                                                <MetricRow label="Cache hit rate" value={`${adminData.appStats.services?.cache?.hitRate || 0}%`} />
                                                <MetricRow label="Email" badge={<Badge size="xs" color={adminData.appStats.services?.email?.status === 'configured' ? 'success' : 'warning'}>{adminData.appStats.services?.email?.status === 'configured' ? 'Configured' : 'Not configured'}</Badge>} />
                                            </Container>
                                        </Panel>
                                        <Panel title="Activity">
                                            <Container layout="flex-column" gap="sm" padding="none" width="100%">
                                                <MetricRow label="Avg response time" value={`${Math.round(adminData.appStats.activity?.avgResponseTime || 0)} ms`} />
                                                <MetricRow label="Total errors" value={adminData.appStats.activity?.totalErrors || 0} />
                                                <MetricRow label="Period" value={adminData.appStats.activity?.period || '—'} />
                                            </Container>
                                        </Panel>
                                    </Container>
                                ) : <EmptyState icon="FiBarChart2" message="No application statistics available" />}
                            </>
                        )}

                        {/* ── Role Requests (Owner only) ── */}
                        {activeSection === 'role-requests' && hasOwnerAccess && !sectionLoading['role-requests'] && (
                            <>
                                <SectionHeader
                                    title="Role requests"
                                    description="Right-click a pending request to approve or reject it"
                                    actions={
                                        <Button size="sm" color="secondary" onClick={() => loadSectionData('role-requests', true)}>
                                            <Icon name="FiRefreshCw" size="xs" />Refresh
                                        </Button>
                                    }
                                />
                                {adminData.roleRequests && adminData.roleRequests.length > 0 ? (
                                    <Panel title={`Pending requests (${adminData.roleRequests.length})`}>
                                        <Data data={adminData.roleRequests}
                                            size="xs"
                                            fieldConfig={{
                                                username: { component: Typography, props: { size: 'xs', weight: 'medium' } },
                                                email: { component: Typography, props: { size: 'xs', color: 'secondary' } },
                                                currentRoles: { component: Badge, props: { size: 'xs' }, transform: (value) => { const role = Array.isArray(value) ? value[0] : value; return { color: 'secondary', children: role }; } },
                                                pendingRoles: { component: Badge, props: { size: 'xs' }, transform: (value) => { const role = Array.isArray(value) ? value[0] : value; return { color: role === 'ADMIN' ? 'warning' : role === 'OWNER' ? 'error' : 'tertiary', children: role }; } },
                                                roleApprovalStatus: { component: Badge, props: { size: 'xs' }, transform: (value) => ({ color: value === 'APPROVED' ? 'success' : value === 'REJECTED' ? 'error' : 'tertiary', children: value || 'PENDING' }) }
                                            }}
                                            width="100%"
                                            genie={{ trigger: 'contextmenu', variant: 'menu', content: (item) => item?.roleApprovalStatus === 'PENDING' ? (
                                                <Container layout="flex-column" gap="xs" padding="xs">
                                                    <Typography size="sm" weight="semibold">Actions</Typography>
                                                    <Button size="sm" onClick={async () => { try { await authService.approveRoleRequest(item._id || item.id, {}); showSuccess('Role request approved'); await loadSectionData('role-requests', true); } catch { showError('Failed to approve'); } }}><Icon name="FiCheck" size="xs" /> Approve</Button>
                                                    <Button size="sm" color="error" onClick={async () => { try { const reason = window.prompt('Enter rejection reason (optional):') || ''; await authService.rejectRoleRequest(item._id || item.id, reason); showSuccess('Role request rejected'); await loadSectionData('role-requests', true); } catch { showError('Failed to reject'); } }}><Icon name="FiX" size="xs" /> Reject</Button>
                                                </Container>
                                            ) : <Container padding="xs"><Typography size="xs" color="muted">Already processed</Typography></Container>
                                            }}
                                        />
                                    </Panel>
                                ) : <EmptyState icon="FiUserCheck" message="No pending role requests" />}
                            </>
                        )}
                    </Container>
                </Container>
            </Container>
        </Page>
    );
};

export default AdminPage;

