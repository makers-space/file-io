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
        { id: 'overview', label: 'System Overview' },
        { id: 'cache', label: 'Cache Management' },
        { id: 'files', label: 'File Statistics' },
        { id: 'users', label: 'User Statistics' },
        { id: 'logs', label: 'Log Analysis' },
        { id: 'email', label: 'Email Testing' },
        { id: 'appstats', label: 'Application Statistics' },
        ...(hasOwnerAccess ? [{ id: 'role-requests', label: 'Role Requests' }] : [])
    ];

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

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
        <Page layout="flex-column" gap="lg" padding="lg">

            {/* Header Bar */}
            <Container layout="flex" justify="between" align="center" gap="md" width="100%">
                <Container layout="flex" gap="sm" align="center">
                    <Button color="secondary" onClick={() => loadSectionData(activeSection, true)} disabled={refreshing}>
                        {refreshing ? 'Refreshing...' : 'Refresh Data'}
                    </Button>
                    <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
                </Container>
                <Container layout="flex-column" align="end" gap="xs">
                    <Badge size="lg" color={adminData.health?.status === 'ok' ? 'success' : 'error'}>{adminData.health?.status === 'ok' ? '🟢 System Healthy' : '🔴 System Issues'}</Badge>
                    <Typography size="xs" color="secondary">
                        Last check: {adminData.health?.timestamp ? new Date(adminData.health.timestamp).toLocaleTimeString() : 'Unknown'}
                    </Typography>
                </Container>
            </Container>

            {/* Section Navigation */}
            <Container layout="flex" justify="center" width="100%">
                <Card padding="md">
                    <Container layout="flex" gap="sm" justify="center">
                        {sections.map(section => (
                            <Button key={section.id} size="sm" onClick={() => setActiveSection(section.id)}>
                                {section.label}
                            </Button>
                        ))}
                    </Container>
                </Card>
            </Container>

            {adminData.errors.length > 0 && (
                <Card color="error" padding="md">
                    <Typography weight="semibold" marginBottom="sm">Data Loading Errors:</Typography>
                    {adminData.errors.map((err, i) => <Typography key={i} size="sm" marginBottom="xs">• {err}</Typography>)}
                </Card>
            )}

            {/* Overview Section */}
            {activeSection === 'overview' && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Typography as="h2" size="2xl" weight="semibold">System Overview</Typography>
                    <Container layout="grid" columns="4" gap="md">
                        <Card padding="md" color="tertiary">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">Environment</Typography>
                                <Typography size="xl" weight="bold">{adminData.health?.env?.toUpperCase() || 'Unknown'}</Typography>
                                <Typography size="xs" color="secondary">Platform: {adminData.health?.system?.platform} ({adminData.health?.system?.arch})</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="success">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">System Uptime</Typography>
                                <Typography size="xl" weight="bold">
                                    {adminData.health?.system?.uptime ? `${Math.floor(adminData.health.system.uptime / 3600)}h ${Math.floor((adminData.health.system.uptime % 3600) / 60)}m` : '0h 0m'}
                                </Typography>
                                <Typography size="xs" color="secondary">Node.js {adminData.health?.system?.nodeVersion}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">Database</Typography>
                                <Typography size="xl" weight="bold">{adminData.health?.database?.status?.toUpperCase() || 'Unknown'}</Typography>
                                <Typography size="xs" color="secondary">Latency: {adminData.health?.database?.latencyMs}ms</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="warning">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">Heap Memory</Typography>
                                <Typography size="xl" weight="bold">
                                    {adminData.health?.system?.memoryUsage ? (() => { const m = adminData.health.system.memoryUsage; return `${((m.heapUsed / m.heapTotal) * 100).toFixed(1)}%`; })() : 'N/A'}
                                </Typography>
                                <Typography size="xs" color="secondary">
                                    {adminData.health?.system?.memoryUsage ? (() => { const m = adminData.health.system.memoryUsage; return `${(m.heapUsed / 1024 / 1024).toFixed(1)}MB / ${(m.heapTotal / 1024 / 1024).toFixed(1)}MB`; })() : 'Unavailable'}
                                </Typography>
                            </Container>
                        </Card>
                    </Container>
                    <Container layout="grid" columns="3" gap="md">
                        <Card padding="lg">
                            <Typography weight="semibold" size="lg" marginBottom="md">Memory Breakdown</Typography>
                            {adminData.health?.system?.memoryUsage ? (() => {
                                const mem = adminData.health.system.memoryUsage;
                                const heapPercent = mem.heapUsed / mem.heapTotal;
                                return (
                                    <Container layout="flex-column" gap="md">
                                        <Container layout="flex-column" gap="xs">
                                            <Container layout="flex" justify="space-between">
                                                <Typography size="sm">Heap Memory:</Typography>
                                                <Typography size="sm" weight="medium">{(mem.heapUsed / 1024 / 1024).toFixed(2)} MB / {(mem.heapTotal / 1024 / 1024).toFixed(2)} MB</Typography>
                                            </Container>
                                            <ProgressBar value={mem.heapUsed} max={mem.heapTotal} variant={heapPercent > 0.8 ? 'error' : heapPercent > 0.6 ? 'warning' : 'success'} showPercentage={true} size="sm" />
                                        </Container>
                                        <Container layout="flex-column" gap="sm">
                                            <Container layout="flex" justify="space-between"><Typography size="sm">RSS:</Typography><Typography size="sm" weight="medium">{(mem.rss / 1024 / 1024).toFixed(2)} MB</Typography></Container>
                                            <Container layout="flex" justify="space-between"><Typography size="sm">External:</Typography><Typography size="sm" weight="medium">{(mem.external / 1024 / 1024).toFixed(2)} MB</Typography></Container>
                                        </Container>
                                    </Container>
                                );
                            })() : <Typography size="sm" color="secondary">Memory data not available</Typography>}
                        </Card>
                        <Card padding="lg">
                            <Typography weight="semibold" size="lg" marginBottom="md">CPU &amp; System Information</Typography>
                            {adminData.health?.system ? (
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Platform:</Typography><Typography size="sm" weight="medium">{adminData.health.system.platform} ({adminData.health.system.arch})</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Node.js:</Typography><Typography size="sm" weight="medium">{adminData.health.system.nodeVersion}</Typography></Container>
                                    <Container layout="flex" justify="space-between">
                                        <Typography size="sm">Uptime:</Typography>
                                        <Typography size="sm" weight="medium">{Math.floor(adminData.health.system.uptime / 3600)}h {Math.floor((adminData.health.system.uptime % 3600) / 60)}m {Math.floor(adminData.health.system.uptime % 60)}s</Typography>
                                    </Container>
                                </Container>
                            ) : <Typography size="sm" color="secondary">System data not available</Typography>}
                        </Card>
                        <Card padding="lg">
                            <Typography weight="semibold" size="lg" marginBottom="md">Database Connection</Typography>
                            {adminData.health?.database ? (
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm">Status:</Typography><Badge size="sm" color={adminData.health.database.status === 'connected' ? 'success' : 'error'}>{adminData.health.database.status?.toUpperCase()}</Badge></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Type:</Typography><Typography size="sm" weight="medium">{adminData.health.database.connection}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Latency:</Typography><Typography size="sm" weight="medium">{adminData.health.database.latencyMs}ms</Typography></Container>
                                </Container>
                            ) : <Typography size="sm" color="secondary">Database data not available</Typography>}
                        </Card>
                    </Container>
                </Container>
            )}

            {/* Cache Section */}
            {activeSection === 'cache' && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Container layout="flex" justify="between" width="100%" gap="md">
                        <Container layout="flex-column">
                            <Typography as="h2" size="2xl" weight="semibold">Cache Management</Typography>
                            <Typography size="sm" marginTop="xs">Manage cached data and view cleanup service status</Typography>
                        </Container>
                        <Container layout="flex" gap="sm">
                            <Button color="tertiary" onClick={handleGetCleanupInfo} disabled={loadingCleanup}>{loadingCleanup ? 'Loading...' : 'Check Cleanup Status'}</Button>
                            <Button color="success" onClick={handleRunCleanup} disabled={runningCleanup || loadingCleanup}>{runningCleanup ? 'Running Cleanup...' : 'Run Cleanup Now'}</Button>
                            <Button color="warning" onClick={handleClearCache} disabled={clearingCache}>{clearingCache ? 'Clearing Cache...' : 'Clear All Cache Data'}</Button>
                        </Container>
                    </Container>
                    <Card padding="lg" color="tertiary" width="100%">
                        <Container layout="grid" columns="3" gap="lg">
                            <Container layout="flex-column" gap="sm"><Typography weight="semibold" size="sm" color="info">Check Cleanup Status</Typography><Typography size="sm">View the automated cleanup service configuration and statistics.</Typography></Container>
                            <Container layout="flex-column" gap="sm"><Typography weight="semibold" size="sm" color="success">Run Cleanup Now (Conservative)</Typography><Typography size="sm">Manually trigger conservative cleanup that removes expired entries.</Typography></Container>
                            <Container layout="flex-column" gap="sm"><Typography weight="semibold" size="sm" color="warning">Clear All Cache Data (Emergency)</Typography><Typography size="sm">Immediately removes ALL cached data using Redis flushAll.</Typography></Container>
                        </Container>
                    </Card>
                    {cleanupInfo && (
                        <Card padding="lg" color="success" width="100%">
                            <Container layout="flex" align="center" justify="space-between" marginBottom="md">
                                <Container layout="flex" align="center" gap="sm"><Icon name="FiClock" color="success" /><Typography weight="semibold">Cache Cleanup Service Status</Typography></Container>
                                <Button color="tertiary" size="sm" onClick={() => setCleanupInfo(null)}><Icon name="FiX" size="xs" /> Close</Button>
                            </Container>
                            <Container layout="grid" columns="2" gap="lg">
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Service Enabled:</Typography><Typography size="sm" weight="medium" color={cleanupInfo.enabled ? 'success' : 'warning'}>{cleanupInfo.enabled ? 'Active' : 'Disabled'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Interval:</Typography><Typography size="sm" weight="medium">{cleanupInfo.intervalHours ? `${cleanupInfo.intervalHours} hours` : 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Min Age:</Typography><Typography size="sm" weight="medium">{cleanupInfo.minAgeHours ? `${cleanupInfo.minAgeHours} hours` : 'N/A'}</Typography></Container>
                                </Container>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Last Run:</Typography><Typography size="sm" weight="medium">{cleanupInfo.lastRun ? new Date(cleanupInfo.lastRun).toLocaleString() : 'Never'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Next Scheduled:</Typography><Typography size="sm" weight="medium">{cleanupInfo.nextRun ? new Date(cleanupInfo.nextRun).toLocaleString() : 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Keys Cleaned:</Typography><Typography size="sm" weight="medium">{cleanupInfo.lastRunStats?.keysRemoved || 0}</Typography></Container>
                                </Container>
                            </Container>
                        </Card>
                    )}
                    {adminData.cache && (
                        <Container layout="grid" columns="3" gap="md">
                            <Card padding="lg">
                                <Container layout="flex" align="center" justify="space-between" marginBottom="md">
                                    <Typography weight="semibold" size="lg">Cache Performance</Typography>
                                    {cacheRefreshed && <Container layout="flex" align="center" gap="sm"><Icon name="FiCheckCircle" color="success" size="sm" /><Typography size="sm" color="success" weight="medium">Refreshed</Typography></Container>}
                                </Container>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Hit Rate:</Typography><Typography size="sm" weight="medium" color="success">{adminData.cache.cacheHitRate?.toFixed(2)}%</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Keyspace Hits:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.stats?.keyspace_hits ? parseInt(adminData.cache.redisInfo.stats.keyspace_hits).toLocaleString() : 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Keyspace Misses:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.stats?.keyspace_misses ? parseInt(adminData.cache.redisInfo.stats.keyspace_misses).toLocaleString() : 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Expired Keys:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.stats?.expired_keys ? parseInt(adminData.cache.redisInfo.stats.expired_keys).toLocaleString() : 'N/A'}</Typography></Container>
                                </Container>
                            </Card>
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">Memory Usage</Typography>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Used Memory:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.memory?.used_memory_human || 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Peak Memory:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.memory?.used_memory_peak_human || 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Fragmentation:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.memory?.mem_fragmentation_ratio || 'N/A'}</Typography></Container>
                                </Container>
                            </Card>
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">Connections &amp; Operations</Typography>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Total Connections:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.stats?.total_connections_received ? parseInt(adminData.cache.redisInfo.stats.total_connections_received).toLocaleString() : 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Commands Processed:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.stats?.total_commands_processed ? parseInt(adminData.cache.redisInfo.stats.total_commands_processed).toLocaleString() : 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Ops/sec:</Typography><Typography size="sm" weight="medium">{adminData.cache.redisInfo?.stats?.instantaneous_ops_per_sec || '0'}</Typography></Container>
                                    <Container layout="flex" justify="space-between"><Typography size="sm">Last Updated:</Typography><Typography size="sm" weight="medium">{adminData.cache.timestamp ? new Date(adminData.cache.timestamp).toLocaleTimeString() : 'N/A'}</Typography></Container>
                                </Container>
                            </Card>
                        </Container>
                    )}
                </Container>
            )}

            {/* Files Section */}
            {activeSection === 'files' && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Typography as="h2" size="2xl" weight="semibold">File System Analytics &amp; Management</Typography>
                    <Container layout="grid" columns="5" gap="md">
                        <Card padding="md" color="primary">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Total Files</Typography>
                                <Typography size="xl" weight="bold">{(adminData.files?.overview?.totalFiles || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="tertiary">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Directories</Typography>
                                <Typography size="xl" weight="bold">{(adminData.files?.overview?.totalDirectories || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="success">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Total Storage</Typography>
                                <Typography size="xl" weight="bold">{adminData.files?.overview?.humanReadableSize || '0 B'}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="warning">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Text Files</Typography>
                                <Typography size="xl" weight="bold">{(adminData.files?.overview?.totalTextFiles || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Binary Files</Typography>
                                <Typography size="xl" weight="bold">{(adminData.files?.overview?.totalBinaryFiles || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                    </Container>
                    <Container layout="grid" columns="2" gap="lg">
                        {adminData.files?.distribution?.byType?.length > 0 && (
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">File Type Distribution</Typography>
                                <Container layout="flex-column" gap="sm">
                                    {adminData.files.distribution.byType.slice(0, 8).map((type, index) => (
                                        <Container key={index} layout="flex" justify="space-between" align="center">
                                            <Container layout="flex" align="center" gap="sm"><Icon name="FiFile" size="sm" /><Typography size="sm" weight="medium">{type._id || 'Unknown'}</Typography></Container>
                                            <Container layout="flex" align="center" gap="md"><Typography size="xs" color="secondary">{type.count} files</Typography><Typography size="xs" weight="medium">{formatBytes(type.totalSize || 0)}</Typography></Container>
                                        </Container>
                                    ))}
                                </Container>
                            </Card>
                        )}
                        {adminData.files?.distribution?.byUser?.length > 0 && (
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">Top Users by File Count</Typography>
                                <Container layout="flex-column" gap="sm">
                                    {adminData.files.distribution.byUser.slice(0, 8).map((user, index) => (
                                        <Container key={index} layout="flex" justify="space-between" align="center">
                                            <Container layout="flex" align="center" gap="sm"><Icon name="FiUser" size="sm" /><Typography size="sm" weight="medium">User {user._id?.slice(-8) || 'Unknown'}</Typography></Container>
                                            <Container layout="flex" align="center" gap="md"><Typography size="xs" color="secondary">{user.fileCount} files</Typography><Typography size="xs" weight="medium">{formatBytes(user.totalSize || 0)}</Typography></Container>
                                        </Container>
                                    ))}
                                </Container>
                            </Card>
                        )}
                    </Container>
                    <Card padding="lg">
                        <Typography weight="semibold" size="lg" marginBottom="md">Storage Statistics</Typography>
                        <Container layout="grid" columns="4" gap="md">
                            <Container layout="flex-column" gap="xs"><Typography size="xl" weight="bold" color="primary">{formatBytes(adminData.files?.sizeStats?.totalSize || 0)}</Typography><Typography size="xs" color="secondary">Total Storage</Typography></Container>
                            <Container layout="flex-column" gap="xs"><Typography size="xl" weight="bold" color="success">{formatBytes(adminData.files?.sizeStats?.avgSize || 0)}</Typography><Typography size="xs" color="secondary">Average Size</Typography></Container>
                            <Container layout="flex-column" gap="xs"><Typography size="xl" weight="bold" color="warning">{formatBytes(adminData.files?.sizeStats?.maxSize || 0)}</Typography><Typography size="xs" color="secondary">Largest File</Typography></Container>
                            <Container layout="flex-column" gap="xs"><Typography size="xl" weight="bold" color="info">{formatBytes(adminData.files?.sizeStats?.minSize || 0)}</Typography><Typography size="xs" color="secondary">Smallest File</Typography></Container>
                        </Container>
                    </Card>
                    <Card padding="lg">
                        <Typography weight="semibold" size="lg" marginBottom="md">Bulk File Operations</Typography>
                        <Container layout="flex" gap="md">
                            <Button color="error" onClick={() => setActiveBulk(activeBulk === 'delete' ? null : 'delete')}><Icon name="FiTrash2" size="xs" /> Bulk Delete</Button>
                            <Button color="tertiary" onClick={() => setActiveBulk(activeBulk === 'tag' ? null : 'tag')}><Icon name="FiTag" size="xs" /> Bulk Tag</Button>
                            <Button color="warning" onClick={() => setActiveBulk(activeBulk === 'permissions' ? null : 'permissions')}><Icon name="FiUsers" size="xs" /> Bulk Permissions</Button>
                        </Container>
                        {activeBulk === 'delete' && <Container marginTop="md"><BulkDeleteForm onSubmit={handleBulkDelete} onCancel={() => setActiveBulk(null)} onClose={() => setActiveBulk(null)} /></Container>}
                        {activeBulk === 'tag' && <Container marginTop="md"><BulkTagForm onSubmit={handleBulkTag} onCancel={() => setActiveBulk(null)} onClose={() => setActiveBulk(null)} /></Container>}
                        {activeBulk === 'permissions' && <Container marginTop="md"><BulkPermissionsForm onSubmit={handleBulkPermissions} onCancel={() => setActiveBulk(null)} onClose={() => setActiveBulk(null)} /></Container>}
                    </Card>
                </Container>
            )}

            {/* Users Section */}
            {activeSection === 'users' && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Typography as="h2" size="2xl" weight="semibold">User Statistics &amp; Analytics</Typography>
                    <Container layout="grid" columns="5" gap="md">
                        <Card padding="md" color="tertiary">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Total Users</Typography>
                                <Typography size="xl" weight="bold">{adminData.userStats?.summary?.totalUsers?.toLocaleString() || (Array.isArray(adminData.users) ? adminData.users.length : 0)}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="success">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Active Users</Typography>
                                <Typography size="xl" weight="bold">{adminData.userStats?.summary?.activeUsers?.toLocaleString() || (Array.isArray(adminData.users) ? adminData.users.filter(u => u.active !== false).length : 0)}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="warning">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">New This Week</Typography>
                                <Typography size="xl" weight="bold">{adminData.userStats?.summary?.newThisWeek || 0}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="tertiary">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Admin Users</Typography>
                                <Typography size="xl" weight="bold">{adminData.userStats?.summary?.adminUsers || 0}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="error">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="xs" color="secondary">Inactive Users</Typography>
                                <Typography size="xl" weight="bold">{adminData.userStats?.summary?.inactiveUsers || 0}</Typography>
                            </Container>
                        </Card>
                    </Container>
                    {adminData.users && Array.isArray(adminData.users) && adminData.users.length > 0 && (
                        <Container layout="flex-column" gap="md" align="stretch">
                            <Typography as="h3" size="lg" weight="semibold">All Users ({adminData.users.length} users)</Typography>
                            <Data
                                data={adminData.users}
                                fieldConfig={{
                                    firstName: { component: Typography, props: { size: 'sm', weight: 'medium' } },
                                    lastName: { component: Typography, props: { size: 'sm', weight: 'medium' } },
                                    username: { component: Typography, props: { size: 'sm', color: 'secondary' } },
                                    email: { component: Typography, props: { size: 'sm', color: 'primary' } },
                                    roles: { component: Badge, props: { size: 'sm' }, transform: (value) => { const role = Array.isArray(value) ? value[0] : value; return { color: role === 'OWNER' ? 'error' : role === 'ADMIN' ? 'warning' : role === 'SUPER_CREATOR' ? 'success' : role === 'CREATOR' ? 'tertiary' : 'default', children: role }; } },
                                    active: { component: Badge, props: { size: 'sm' }, transform: (value) => ({ color: value ? 'success' : 'error', children: value ? 'Active' : 'Inactive' }) },
                                    emailVerified: { component: Badge, props: { size: 'sm' }, transform: (value) => ({ color: value ? 'success' : 'warning', children: value ? 'Verified' : 'Unverified' }) },
                                    createdAt: { component: Typography, props: { size: 'xs', color: 'secondary' }, transform: (value) => ({ children: new Date(value).toLocaleDateString() }) },
                                    lastLogin: { component: Typography, props: { size: 'xs', color: 'muted' }, transform: (value) => ({ children: value ? new Date(value).toLocaleDateString() : 'Never' }) }
                                }}
                                exclude={['_id', '__v', 'password', 'resetPasswordToken', 'resetPasswordExpires', 'emailVerificationToken']}
                                searchable={true} filterable={true} paginated={true} pageSize={25} sortable={true}
                                genie={{ trigger: 'contextmenu', variant: 'modal', content: (user) => (
                                    <EditUserForm user={user} onSave={async () => { await loadSectionData('users', true); document.querySelector('[data-genie-backdrop]')?.click(); }} onCancel={() => { document.querySelector('[data-genie-backdrop]')?.click(); }} />
                                )}}
                            />
                        </Container>
                    )}
                    <Card padding="lg">
                        <Typography weight="semibold" size="lg" marginBottom="md">Role Distribution</Typography>
                        {adminData.userStats?.roles ? (
                            <Container layout="flex" gap="lg">
                                {adminData.userStats.roles.map((roleData) => (
                                    <Container key={roleData.role} layout="flex-column" gap="xs" minWidth="120px">
                                        <Typography size="sm" weight="semibold">{roleData.role}</Typography>
                                        <Typography size="xl" weight="bold" color={roleData.role === 'OWNER' ? 'tertiary' : roleData.role === 'ADMIN' ? 'warning' : roleData.role === 'CREATOR' || roleData.role === 'SUPER_CREATOR' ? 'info' : 'secondary'}>{roleData.count}</Typography>
                                        <ProgressBar value={roleData.count} max={adminData.userStats.summary?.totalUsers || 1} variant={roleData.role === 'OWNER' ? 'tertiary' : roleData.role === 'ADMIN' ? 'warning' : roleData.role === 'CREATOR' || roleData.role === 'SUPER_CREATOR' ? 'info' : 'secondary'} showPercentage={true} size="sm" />
                                        <Typography size="xs" color="secondary">{roleData.percentage}% of users</Typography>
                                    </Container>
                                ))}
                            </Container>
                        ) : <Typography size="sm" color="secondary">No detailed role statistics available</Typography>}
                    </Card>
                </Container>
            )}

            {/* Logs Section */}
            {activeSection === 'logs' && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Typography as="h2" size="2xl" weight="semibold">Comprehensive Log Analytics</Typography>
                    {sectionLoading.logs && <Container layout="flex-column" gap="md" align="center"><CircularProgress size="lg" /><Typography size="md" color="secondary">Loading system logs...</Typography></Container>}
                    {!sectionLoading.logs && adminData.logs && adminData.logs.length > 0 && (
                        <Container layout="flex-column" gap="md" align="stretch">
                            <Typography as="h3" size="lg" weight="semibold">System Logs ({adminData.logs.length} entries)</Typography>
                            <Data data={adminData.logs}
                                fieldConfig={{
                                    timestamp: { component: Typography, props: { size: 'sm', color: 'secondary' }, transform: (value) => ({ children: new Date(value).toLocaleString() }) },
                                    method: { component: Badge, props: { size: 'sm' }, transform: (value) => ({ color: value === 'POST' ? 'primary' : value === 'PUT' || value === 'PATCH' ? 'warning' : value === 'DELETE' ? 'error' : 'default', children: value }) },
                                    url: { component: Typography, props: { size: 'sm' }, truncate: true, maxLength: 80 },
                                    statusCode: { component: Badge, props: { size: 'sm' }, transform: (value) => ({ color: value >= 500 ? 'error' : value >= 400 ? 'warning' : value >= 300 ? 'tertiary' : 'success', children: value }) },
                                    responseTime: { component: Typography, props: { size: 'sm' }, transform: (value) => ({ children: value ? `${value}ms` : 'N/A', color: value > 1000 ? 'error' : value > 500 ? 'warning' : 'default' }) }
                                }}
                                exclude={['__v']} searchable={true} filterable={true} paginated={true} pageSize={15} sortable={true}
                            />
                        </Container>
                    )}
                    <Container layout="grid" columns="4" gap="md">
                        <Card padding="md" color="tertiary">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">Total Logs</Typography>
                                <Typography size="xl" weight="bold">{(adminData.logStats?.overview?.totalLogs || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="success">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">Today</Typography>
                                <Typography size="xl" weight="bold">{(adminData.logStats?.overview?.logsToday || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="warning">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">Warnings Today</Typography>
                                <Typography size="xl" weight="bold">{(adminData.logStats?.warnings?.today || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                        <Card padding="md" color="error">
                            <Container layout="flex-column" gap="xs">
                                <Typography size="sm" color="secondary">Errors Today</Typography>
                                <Typography size="xl" weight="bold">{(adminData.logStats?.errors?.today || 0).toLocaleString()}</Typography>
                            </Container>
                        </Card>
                    </Container>
                    {adminData.logStats?.summary && (
                        <Card padding="lg" color="tertiary">
                            <Typography weight="semibold" size="lg" marginBottom="md">System Health Summary</Typography>
                            <Container layout="grid" columns="4" gap="md">
                                <Container layout="flex-column" gap="xs" align="center"><Typography size="sm" color="secondary">System Health</Typography><Typography size="xl" weight="bold" color="primary">{adminData.logStats.summary.systemHealth}%</Typography><ProgressBar value={adminData.logStats.summary.systemHealth || 0} max={100} variant={(adminData.logStats.summary.systemHealth || 0) > 95 ? 'success' : (adminData.logStats.summary.systemHealth || 0) > 85 ? 'warning' : 'error'} showPercentage={false} size="sm" /></Container>
                                <Container layout="flex-column" gap="xs" align="center"><Typography size="sm" color="secondary">Error Rate</Typography><Typography size="xl" weight="bold" color={(adminData.logStats.summary.errorRate || 0) > 10 ? 'error' : 'primary'}>{adminData.logStats.summary.errorRate}%</Typography></Container>
                                <Container layout="flex-column" gap="xs" align="center"><Typography size="sm" color="secondary">Avg Response</Typography><Typography size="xl" weight="bold" color="primary">{adminData.logStats.summary.avgResponseTime?.toFixed(1)}ms</Typography></Container>
                                <Container layout="flex-column" gap="xs" align="center"><Typography size="sm" color="secondary">Daily Requests</Typography><Typography size="xl" weight="bold" color="primary">{adminData.logStats.summary.dailyRequestRate?.toFixed(0)}</Typography></Container>
                            </Container>
                        </Card>
                    )}
                    {adminData.logStats?.breakdowns?.statusCodes && (
                        <Card padding="lg">
                            <Typography weight="semibold" size="lg" marginBottom="md">Status Code Distribution</Typography>
                            <Container layout="flex" gap="lg">
                                {adminData.logStats.breakdowns.statusCodes.map((stat, index) => (
                                    <Container key={index} layout="flex-column" gap="xs" minWidth="120px">
                                        <Typography size="sm" color="secondary">{stat._id}</Typography>
                                        <Typography size="xl" weight="bold">{stat.count?.toLocaleString()}</Typography>
                                        <ProgressBar value={stat.count} max={adminData.logStats.overview?.totalLogs || 1} variant={String(stat._id).startsWith('2') ? 'success' : String(stat._id).startsWith('3') ? 'info' : String(stat._id).startsWith('4') ? 'warning' : 'error'} showPercentage={true} size="sm" />
                                    </Container>
                                ))}
                            </Container>
                        </Card>
                    )}
                    {!sectionLoading.logs && (!adminData.logs || adminData.logs.length === 0) && (
                        <Container layout="flex-column" gap="md" align="center"><Icon name="FiFileText" size="2xl" color="secondary" /><Typography size="lg" color="secondary">No system logs available</Typography></Container>
                    )}
                </Container>
            )}

            {/* Email Section */}
            {activeSection === 'email' && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Typography as="h2" size="2xl" weight="semibold">Email Testing</Typography>
                    <Card padding="lg">
                        <Typography weight="semibold" size="lg" marginBottom="md">Send Test Email</Typography>
                        <Container layout="grid" columns="2" gap="md">
                            <Input label="Recipient Email" type="email" value={emailTest.recipient} onChange={e => setEmailTest(prev => ({ ...prev, recipient: e.target.value }))} placeholder="test@example.com" required />
                            <Select label="Template" value={emailTest.template} onChange={value => setEmailTest(prev => ({ ...prev, template: value }))} options={[{ value: 'welcome', label: 'Welcome Email' }, { value: 'password-reset', label: 'Password Reset' }, { value: 'password-changed', label: 'Password Changed' }, { value: 'security-alert', label: 'Security Alert' }]} />
                            <Input label="Subject" value={emailTest.subject} onChange={e => setEmailTest(prev => ({ ...prev, subject: e.target.value }))} placeholder="Test Email Subject" />
                        </Container>
                        <Container layout="flex" justify="end" marginTop="md">
                            <Button onClick={handleSendTestEmail} disabled={emailTest.isLoading || !emailTest.recipient}>{emailTest.isLoading ? 'Sending...' : 'Send Test Email'}</Button>
                        </Container>
                    </Card>
                </Container>
            )}

            {/* AppStats Section */}
            {activeSection === 'appstats' && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Container layout="flex" justify="space-between" align="center">
                        <Typography as="h2" size="2xl" weight="semibold">Application Statistics</Typography>
                        <Button onClick={() => loadSectionData('appstats', true)} disabled={refreshing} color="secondary">{refreshing ? 'Refreshing...' : 'Refresh Statistics'}</Button>
                    </Container>
                    {adminData.appStats && (
                        <Container layout="grid" columns="2" gap="lg">
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">Application Summary</Typography>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Total Users:</Typography><Typography size="sm" weight="medium">{adminData.appStats.summary?.totalUsers || 0}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Active Users:</Typography><Typography size="sm" weight="medium">{adminData.appStats.summary?.activeUsers || 0}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Total Files:</Typography><Typography size="sm" weight="medium">{adminData.appStats.summary?.totalFiles || 0}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Total Requests:</Typography><Typography size="sm" weight="medium">{adminData.appStats.summary?.totalRequests || 0}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Error Rate:</Typography><Typography size="sm" weight="medium">{adminData.appStats.summary?.errorRate || 0}%</Typography></Container>
                                </Container>
                            </Card>
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">System Information</Typography>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Node Version:</Typography><Typography size="sm" weight="medium">{adminData.appStats.system?.nodeVersion || 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Platform:</Typography><Typography size="sm" weight="medium">{adminData.appStats.system?.platform || 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Environment:</Typography><Typography size="sm" weight="medium">{adminData.appStats.system?.environment || 'N/A'}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Uptime:</Typography><Typography size="sm" weight="medium">{Math.floor((adminData.appStats.system?.uptime || 0) / 3600)}h</Typography></Container>
                                </Container>
                            </Card>
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">Services Status</Typography>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Database:</Typography><Typography size="sm" weight="medium">{adminData.appStats.services?.database?.status === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Cache:</Typography><Typography size="sm" weight="medium">{adminData.appStats.services?.cache?.status === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Cache Hit Rate:</Typography><Typography size="sm" weight="medium">{adminData.appStats.services?.cache?.hitRate || 0}%</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Email Service:</Typography><Typography size="sm" weight="medium">{adminData.appStats.services?.email?.status === 'configured' ? '🟢 Configured' : '🔴 Not Configured'}</Typography></Container>
                                </Container>
                            </Card>
                            <Card padding="lg">
                                <Typography weight="semibold" size="lg" marginBottom="md">Activity Metrics</Typography>
                                <Container layout="flex-column" gap="sm">
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Avg Response Time:</Typography><Typography size="sm" weight="medium">{Math.round(adminData.appStats.activity?.avgResponseTime || 0)} ms</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Total Errors:</Typography><Typography size="sm" weight="medium">{adminData.appStats.activity?.totalErrors || 0}</Typography></Container>
                                    <Container layout="flex" justify="space-between" align="center"><Typography size="sm" color="secondary">Period:</Typography><Typography size="sm" weight="medium">{adminData.appStats.activity?.period || 'N/A'}</Typography></Container>
                                </Container>
                            </Card>
                        </Container>
                    )}
                    {!adminData.appStats && <Card padding="lg"><Typography size="sm" color="secondary">No application statistics data available.</Typography></Card>}
                </Container>
            )}

            {/* Role Requests Section (Owner only) */}
            {activeSection === 'role-requests' && hasOwnerAccess && (
                <Container layout="flex-column" gap="lg" align="center" width="100%">
                    <Typography as="h2" size="2xl" weight="semibold">Role Request Management</Typography>
                    <Typography size="md" color="secondary">Review and manage user role elevation requests</Typography>
                    {sectionLoading['role-requests'] && <Container layout="flex-column" gap="md" align="center"><CircularProgress size="lg" /><Typography size="md" color="secondary">Loading role requests...</Typography></Container>}
                    {!sectionLoading['role-requests'] && adminData.roleRequests && adminData.roleRequests.length > 0 && (
                        <Container layout="flex-column" gap="md" align="stretch">
                            <Typography as="h3" size="lg" weight="semibold">Pending Role Requests ({adminData.roleRequests.length})</Typography>
                            <Data data={adminData.roleRequests}
                                fieldConfig={{
                                    username: { component: Typography, props: { size: 'sm', weight: 'medium' } },
                                    email: { component: Typography, props: { size: 'sm', color: 'secondary' } },
                                    currentRoles: { component: Badge, props: { size: 'sm' }, transform: (value) => { const role = Array.isArray(value) ? value[0] : value; return { color: 'secondary', children: role }; } },
                                    pendingRoles: { component: Badge, props: { size: 'sm' }, transform: (value) => { const role = Array.isArray(value) ? value[0] : value; return { color: role === 'ADMIN' ? 'warning' : role === 'OWNER' ? 'error' : 'tertiary', children: role }; } },
                                    roleApprovalStatus: { component: Badge, props: { size: 'sm' }, transform: (value) => ({ color: value === 'APPROVED' ? 'success' : value === 'REJECTED' ? 'error' : 'tertiary', children: value || 'PENDING' }) }
                                }}
                                genie={{ trigger: 'contextmenu', variant: 'menu', content: (item) => item?.roleApprovalStatus === 'PENDING' ? (
                                    <Container layout="flex-column" gap="xs" padding="xs">
                                        <Typography as="h4" size="sm" weight="semibold">Actions</Typography>
                                        <Button size="sm" onClick={async () => { try { await authService.approveRoleRequest(item._id || item.id, {}); showSuccess('Role request approved'); await loadSectionData('role-requests', true); } catch { showError('Failed to approve'); } }}><Icon name="FiCheck" size="sm" /> Approve Request</Button>
                                        <Button size="sm" color="error" onClick={async () => { try { const reason = window.prompt('Enter rejection reason (optional):') || ''; await authService.rejectRoleRequest(item._id || item.id, reason); showSuccess('Role request rejected'); await loadSectionData('role-requests', true); } catch { showError('Failed to reject'); } }}><Icon name="FiX" size="sm" /> Reject Request</Button>
                                    </Container>
                                ) : <Container layout="flex-column" gap="xs" padding="xs"><Typography size="sm" color="secondary">Request Already Processed</Typography></Container>
                                }}
                            />
                        </Container>
                    )}
                    {!sectionLoading['role-requests'] && (!adminData.roleRequests || adminData.roleRequests.length === 0) && (
                        <Container layout="flex-column" gap="md" align="center"><Icon name="FiUserCheck" size="2xl" color="secondary" /><Typography size="lg" color="secondary">No role requests available</Typography></Container>
                    )}
                    <Button color="secondary" onClick={() => loadSectionData('role-requests', true)} disabled={sectionLoading['role-requests']}>Refresh Role Requests</Button>
                </Container>
            )}

        </Page>
    );
};

export default AdminPage;

