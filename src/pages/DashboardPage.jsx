import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import fileService from '@/client/file.client';
import { userService } from '@/client/user.client';
import {
    Page,
    Container,
    Card,
    Button,
    Typography,
    Icon,
    Badge,
    Input,
    CircularProgress,
    ProgressBar,
    Divider,
    Select
} from '@components/Components';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const timeAgo = (dateString) => {
    if (!dateString) return '';
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString();
};

const FILE_ICONS = {
    text: 'FiFileText',
    image: 'FiImage',
    video: 'FiVideo',
    audio: 'FiMusic',
    pdf: 'FiFileText',
    directory: 'FiFolder',
};

// ─── Files Tab ────────────────────────────────────────────────────────────────

const FilesTab = ({ navigate, userId }) => {
    const [recentFiles, setRecentFiles] = useState([]);
    const [sharedFiles, setSharedFiles] = useState([]);
    const [starredFiles, setStarredFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [filesRes, starredRes] = await Promise.all([
                    fileService.listFiles({ limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' }),
                    userService.getStarredFiles().catch(() => ({ data: [] }))
                ]);
                const all = filesRes.files;
                const uid = userId?.toString();
                const recent = [];
                const shared = [];
                for (const f of all) {
                    const ownerId = (f.owner?._id || f.owner)?.toString();
                    if (uid && ownerId && ownerId !== uid) {
                        shared.push(f);
                    } else {
                        recent.push(f);
                    }
                }
                setRecentFiles(recent.slice(0, 10));
                setSharedFiles(shared.slice(0, 10));
                setStarredFiles(starredRes?.data || []);
            } catch { /* non-critical */ }
            finally { setIsLoading(false); }
        })();
    }, [userId]);

    if (isLoading) {
        return (
            <Container layout="flex" align="center" justify="center" padding="lg">
                <CircularProgress size="sm" />
            </Container>
        );
    }

    const renderFileCard = (f) => (
        <Container
            key={f._id || f.filePath}
            layout="flex-column" align="center" gap="xs" padding="sm"
            style={{ cursor: 'pointer', borderRadius: '6px', textAlign: 'center' }}
            onClick={() => navigate(`/files${f.filePath || ''}`)}
        >
            <Icon name={FILE_ICONS[f.type] || 'FiFile'} size="md" color="primary" />
            <Typography size="xs" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {f.fileName || f.filePath?.split('/').pop() || 'Untitled'}
            </Typography>
            <Typography size="xs" color="secondary">
                {timeAgo(f.updatedAt)}
            </Typography>
        </Container>
    );

    const renderSharedCard = (f) => (
        <Container
            key={f._id || f.filePath}
            layout="flex" align="center" gap="sm" padding="sm"
            style={{ cursor: 'pointer', borderRadius: '6px', width: '180px', flexShrink: 0 }}
            onClick={() => navigate(`/files${f.filePath || ''}`)}
        >
            <Icon name={FILE_ICONS[f.type] || 'FiFile'} size="sm" color="primary" />
            <Container layout="flex-column" gap="none" style={{ minWidth: 0, flex: 1 }}>
                <Typography size="xs" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.fileName || f.filePath?.split('/').pop() || 'Untitled'}
                </Typography>
                <Typography size="xxs" color="secondary">
                    {timeAgo(f.updatedAt)}
                    {f.owner?.username ? ` · ${f.owner.username}` : ''}
                </Typography>
            </Container>
        </Container>
    );
                
    return (
        <Container layout="flex-column" gap="sm" width="100%" wrap={false}>
            {/* Recent Files */}
            <Typography size="sm" weight="semibold">
                <Icon name="FiClock" size="xs" /> Recent Files
            </Typography>
            {recentFiles.length === 0 ? (
                <Container layout="flex-column" align="center" gap="sm" padding="md" width="100%">
                    <Icon name="FiFile" size="md" color="secondary" />
                    <Typography size="xs" color="secondary">No files yet</Typography>
                    <Button size="sm" color="primary" onClick={() => navigate('/files')}>
                        Create your first file
                    </Button>
                </Container>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', width: '100%' }}>
                    {recentFiles.map(renderFileCard)}
                </div>
            )}

            <Divider margin="xs" />

            {/* Starred Files */}
            <Typography size="sm" weight="semibold">
                <Icon name="FiStar" size="xs" /> Starred
            </Typography>
            {starredFiles.length === 0 ? (
                <Typography size="xs" color="secondary" padding="sm">
                    No starred files yet — star files to find them quickly
                </Typography>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', width: '100%' }}>
                    {starredFiles.slice(0, 10).map(renderFileCard)}
                </div>
            )}

            <Divider margin="xs" />

            {/* Shared With Me */}
            <Typography size="sm" weight="semibold">
                <Icon name="FiShare2" size="xs" /> Shared With Me
            </Typography>
            {sharedFiles.length === 0 ? (
                <Typography size="xs" color="secondary" padding="sm">
                    No files shared with you yet
                </Typography>
            ) : (
                <Container layout="flex" gap="sm" wrap width="100%">
                    {sharedFiles.map(renderSharedCard)}
                </Container>
            )}
        </Container>
    );
};

// ─── Social Tab ───────────────────────────────────────────────────────────────

const SocialTab = ({ userId, navigate }) => {
    const [connections, setConnections] = useState([]);
    const [groups, setGroups] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [responding, setResponding] = useState({});
    const { success: showSuccess, error: showError } = useNotification();
    const { user } = useAuth();

    // Create group
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [createGroupForm, setCreateGroupForm] = useState({ name: '', description: '', privacy: 'private' });
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // Discover groups
    const [showDiscover, setShowDiscover] = useState(false);
    const [discoverResults, setDiscoverResults] = useState([]);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [joiningGroup, setJoiningGroup] = useState(null);

    // Find & Connect
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [connectionStatuses, setConnectionStatuses] = useState({});
    const [sendingRequest, setSendingRequest] = useState({});

    useEffect(() => {
        if (!userId) return;
        (async () => {
            try {
                const [connRes, groupRes, pendingRes, sentRes] = await Promise.all([
                    userService.getConnections(userId).catch(() => ({ data: [] })),
                    userService.getMyGroups().catch(() => ({ data: [] })),
                    userService.getPendingRequests({ limit: 20 }).catch(() => ({ data: [] })),
                    userService.getSentRequests().catch(() => ({ data: [] }))
                ]);
                setConnections(connRes?.data || []);
                setGroups(groupRes.data);
                setPendingRequests(pendingRes?.data || []);
                setSentRequests(sentRes?.data || []);
            } catch { /* non-critical */ }
            finally { setIsLoading(false); }
        })();
    }, [userId]);

    const reloadGroups = useCallback(async () => {
        try {
            const groupRes = await userService.getMyGroups();
            setGroups(groupRes.data || []);
        } catch { /* non-critical */ }
    }, []);

    const handleCreateGroup = async () => {
        if (!createGroupForm.name.trim()) return;
        setIsCreatingGroup(true);
        try {
            const res = await userService.createGroup(createGroupForm);
            const newGroup = res?.data?.group || res?.data;
            showSuccess(`Group "${createGroupForm.name}" created`);
            setCreateGroupForm({ name: '', description: '', privacy: 'private' });
            setShowCreateGroup(false);
            await reloadGroups();
            if (newGroup?._id) navigate(`/groups/${newGroup._id}`);
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to create group');
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleDiscover = async () => {
        setShowDiscover(p => !p);
        if (showDiscover) return;
        setIsDiscovering(true);
        try {
            const res = await userService.discoverGroups({ limit: 20 });
            const list = res?.data?.groups || res?.data || [];
            const myIds = new Set(groups.map(g => g._id));
            setDiscoverResults(list.filter(g => !myIds.has(g._id)));
        } catch {
            setDiscoverResults([]);
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleJoinGroup = async (group) => {
        setJoiningGroup(group._id);
        try {
            await userService.joinGroup(group._id);
            showSuccess(`Joined "${group.name}"`);
            setDiscoverResults(p => p.filter(g => g._id !== group._id));
            await reloadGroups();
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to join group');
        } finally {
            setJoiningGroup(null);
        }
    };

    const handleSearch = useCallback(async () => {
        const trimmed = searchQuery.trim();
        if (!trimmed || trimmed.length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const response = await userService.getPublicUsers({ search: trimmed, limit: 20 });
            const users = response.users;
            const currentId = user?._id || user?.id;
            const filtered = users.filter(u => (u._id || u.id) !== currentId);
            setSearchResults(filtered);
            const statuses = {};
            await Promise.all(filtered.map(async (u) => {
                const uid = u._id || u.id;
                try {
                    const statusRes = await userService.getConnectionStatus(uid);
                    statuses[uid] = statusRes?.data?.status || 'none';
                } catch { statuses[uid] = 'none'; }
            }));
            setConnectionStatuses(statuses);
        } catch { showError('Search failed'); }
        finally { setIsSearching(false); }
    }, [searchQuery, user, showError]);

    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        const timer = setTimeout(handleSearch, 400);
        return () => clearTimeout(timer);
    }, [searchQuery, handleSearch]);

    const handleSendRequest = async (targetUserId) => {
        setSendingRequest(prev => ({ ...prev, [targetUserId]: true }));
        try {
            await userService.sendConnectionRequest(targetUserId);
            showSuccess('Connection request sent');
            setConnectionStatuses(prev => ({ ...prev, [targetUserId]: 'pending_sent' }));
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to send request');
        } finally {
            setSendingRequest(prev => ({ ...prev, [targetUserId]: false }));
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'connected': return { label: 'Connected', color: 'success' };
            case 'pending_sent': return { label: 'Request Sent', color: 'secondary' };
            case 'pending_received': return { label: 'Pending', color: 'warning' };
            default: return null;
        }
    };

    const handleRespond = async (requesterId, action) => {
        setResponding(prev => ({ ...prev, [requesterId]: action }));
        try {
            await userService.respondToConnection(requesterId, action);
            showSuccess(`Connection request ${action}ed`);
            setPendingRequests(prev => prev.filter(u => (u._id || u.id) !== requesterId));
        } catch (err) {
            showError(err?.response?.data?.message || `Failed to ${action} request`);
        } finally {
            setResponding(prev => ({ ...prev, [requesterId]: null }));
        }
    };

    if (isLoading) {
        return (
            <Container layout="flex" align="center" justify="center" padding="lg">
                <CircularProgress size="sm" />
            </Container>
        );
    }

    // Find People genie content — rendered inside a Button genie dropdown
    const findPeopleGenie = (
        <Container layout="flex-column" gap="sm" padding="md" style={{ width: '280px' }}>
            <Typography size="sm" weight="semibold">Find People</Typography>
            <Input
                placeholder="Name, username or email…"
                value={searchQuery}
                onChange={e => setSearchQuery(typeof e === 'string' ? e : e?.target?.value ?? '')}
                width="100%"
                icon="FiSearch"
            />
            {isSearching && (
                <Container layout="flex" align="center" gap="xs" padding="none">
                    <CircularProgress size="xs" />
                    <Typography size="xs" color="secondary">Searching…</Typography>
                </Container>
            )}
            {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <Typography size="xs" color="secondary">No users found</Typography>
            )}
            {!isSearching && searchResults.length > 0 && (
                <Container layout="flex-column" gap="xs" padding="none" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {searchResults.map(u => {
                        const uid = u._id || u.id;
                        const statusInfo = getStatusLabel(connectionStatuses[uid]);
                        const isSending = !!sendingRequest[uid];
                        return (
                            <Container key={uid} layout="flex" align="center" gap="sm" padding="xs">
                                <Icon name="FiUser" size="sm" />
                                <Container layout="flex-column" gap="none" flexFill style={{ minWidth: 0 }}>
                                    <Typography size="xs" weight="medium">{u.username || u.email}</Typography>
                                    {u.firstName && <Typography size="xxs" color="secondary">{u.firstName} {u.lastName || ''}</Typography>}
                                </Container>
                                {statusInfo ? (
                                    <Badge size="xs" color={statusInfo.color}>{statusInfo.label}</Badge>
                                ) : (
                                    <Button size="xs" color="primary" onClick={() => handleSendRequest(uid)} disabled={isSending}>
                                        {isSending ? <CircularProgress size="xs" /> : <><Icon name="FiUserPlus" size="xs" />Connect</>}
                                    </Button>
                                )}
                            </Container>
                        );
                    })}
                </Container>
            )}
            {sentRequests.length > 0 && (
                <>
                    <Divider margin="xs" />
                    <Typography size="xs" weight="semibold" color="secondary">Sent Requests</Typography>
                    <Container layout="flex-column" gap="xs" padding="none" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        {sentRequests.map(u => (
                            <Container key={u._id || u.id} layout="flex" align="center" gap="sm" padding="xs">
                                <Icon name="FiUser" size="xs" color="secondary" />
                                <Typography size="xs" color="secondary" flexFill style={{ minWidth: 0 }}>{u.username || u.email}</Typography>
                                <Badge size="xs" color="warning">Pending</Badge>
                            </Container>
                        ))}
                    </Container>
                </>
            )}
        </Container>
    );

    return (
        <Container layout="flex-column" gap="sm" width="100%" wrap={false}>

            {/* ── Connections header with Find People genie ── */}
            <Container layout="flex" align="center" justify="between" padding="none" gap="sm" width="100%">
                <Container layout="flex" align="center" gap="xs" padding="none">
                    <Icon name="FiUserCheck" size="sm" />
                    <Typography size="sm" weight="semibold">Connections ({connections.length})</Typography>
                    {pendingRequests.length > 0 && (
                        <Badge size="xs" color="warning">{pendingRequests.length} pending</Badge>
                    )}
                </Container>
                <Button
                    size="xs"
                    color="secondary"
                    genie={findPeopleGenie}
                    genieTrigger="click"
                >
                    <Icon name="FiSearch" size="xs" /> Find People
                </Button>
            </Container>

            {/* ── Pending requests (compact inline) ── */}
            {pendingRequests.length > 0 && (
                <Card padding="sm">
                    <Container layout="flex-column" gap="xs" padding="none" style={{ maxHeight: '140px', overflowY: 'auto' }}>
                        {pendingRequests.map(u => {
                            const uid = u._id || u.id;
                            return (
                                <Container key={uid} layout="flex" align="center" gap="sm" padding="none">
                                    <Icon name="FiUserPlus" size="xs" color="warning" />
                                    <Container layout="flex-column" gap="none" flexFill style={{ minWidth: 0 }}>
                                        <Typography size="xs" weight="medium">{u.username || u.email}</Typography>
                                        {u.firstName && <Typography size="xxs" color="secondary">{u.firstName} {u.lastName || ''}</Typography>}
                                    </Container>
                                    <Container layout="flex" gap="xs" padding="none">
                                        <Button size="xs" color="primary" onClick={() => handleRespond(uid, 'accept')} disabled={!!responding[uid]}>
                                            {responding[uid] === 'accept' ? <CircularProgress size="xs" /> : 'Accept'}
                                        </Button>
                                        <Button size="xs" color="secondary" onClick={() => handleRespond(uid, 'reject')} disabled={!!responding[uid]}>
                                            Decline
                                        </Button>
                                    </Container>
                                </Container>
                            );
                        })}
                    </Container>
                </Card>
            )}

            {/* ── Connections list ── */}
            {connections.length === 0 ? (
                <Typography size="xs" color="secondary" style={{ padding: '4px 2px' }}>
                    No connections yet. Use Find People to connect with others.
                </Typography>
            ) : (
                <Container layout="flex-column" gap="2px" padding="none" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {connections.map(u => (
                        <Container key={u._id} layout="flex" align="center" gap="sm" padding="xs">
                            <Icon name="FiUser" size="sm" />
                            <Container layout="flex-column" gap="none" flexFill style={{ minWidth: 0 }}>
                                <Typography size="xs" weight="medium">{u.username || u.email}</Typography>
                                {u.firstName && <Typography size="xxs" color="secondary">{u.firstName} {u.lastName || ''}</Typography>}
                            </Container>
                        </Container>
                    ))}
                </Container>
            )}

            <Divider margin="xs" />

            {/* ── Groups ── */}
            <Container layout="flex" justify="between" align="center" padding="none">
                <Container layout="flex" align="center" gap="xs" padding="none">
                    <Icon name="FiUsers" size="sm" />
                    <Typography size="sm" weight="semibold">Groups ({groups.length})</Typography>
                </Container>
                <Container layout="flex" gap="xs" padding="none">
                    <Button size="xs" color="secondary" onClick={handleDiscover}>
                        <Icon name="FiCompass" size="xs" />
                        {showDiscover ? 'Hide' : 'Discover'}
                    </Button>
                    <Button size="xs" color="primary" onClick={() => { setShowCreateGroup(p => !p); setShowDiscover(false); }}>
                        <Icon name={showCreateGroup ? 'FiChevronUp' : 'FiPlus'} size="xs" />
                        {showCreateGroup ? 'Cancel' : 'New'}
                    </Button>
                </Container>
            </Container>

            {/* Create group inline form */}
            {showCreateGroup && (
                <Card padding="md">
                    <Container layout="flex-column" gap="sm" padding="none">
                        <Input
                            placeholder="Group name *"
                            value={createGroupForm.name}
                            onChange={e => setCreateGroupForm(p => ({ ...p, name: typeof e === 'string' ? e : e?.target?.value ?? '' }))}
                            width="100%"
                        />
                        <Input
                            placeholder="Description (optional)"
                            value={createGroupForm.description}
                            onChange={e => setCreateGroupForm(p => ({ ...p, description: typeof e === 'string' ? e : e?.target?.value ?? '' }))}
                            width="100%"
                        />
                        <Select
                            options={[
                                { value: 'private', label: 'Private — invite only' },
                                { value: 'public', label: 'Public — anyone can join' },
                            ]}
                            value={createGroupForm.privacy}
                            onChange={val => setCreateGroupForm(p => ({ ...p, privacy: val }))}
                        />
                        <Button size="sm" color="primary" onClick={handleCreateGroup} disabled={isCreatingGroup || !createGroupForm.name.trim()}>
                            {isCreatingGroup ? <CircularProgress size="xs" /> : <><Icon name="FiUsers" size="xs" />Create Group</>}
                        </Button>
                    </Container>
                </Card>
            )}

            {/* Discover public groups */}
            {showDiscover && (
                <Container layout="flex-column" gap="xs" padding="none">
                    {isDiscovering && (
                        <Container layout="flex" align="center" gap="xs" padding="xs">
                            <CircularProgress size="xs" />
                            <Typography size="xs" color="secondary">Looking for groups…</Typography>
                        </Container>
                    )}
                    {!isDiscovering && discoverResults.length === 0 && (
                        <Typography size="xs" color="secondary" padding="xs">No public groups to join</Typography>
                    )}
                    {discoverResults.map(g => (
                        <Container key={g._id} layout="flex" align="center" justify="between" gap="sm" padding="xs">
                            <Container layout="flex" align="center" gap="sm" padding="none">
                                <Container style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon name="FiUsers" size="xs" color="surface" />
                                </Container>
                                <Container layout="flex-column" gap="none" padding="none">
                                    <Typography size="xs" weight="medium">{g.name}</Typography>
                                    <Typography size="xxs" color="secondary">{g.memberCount || g.members?.length || 0} members</Typography>
                                </Container>
                            </Container>
                            <Button size="xs" color="primary" onClick={() => handleJoinGroup(g)} disabled={joiningGroup === g._id}>
                                {joiningGroup === g._id ? <CircularProgress size="xs" /> : 'Join'}
                            </Button>
                        </Container>
                    ))}
                </Container>
            )}

            {/* My groups list */}
            {groups.length === 0 && !showCreateGroup && !showDiscover ? (
                <Typography size="xs" color="secondary" padding="xs">
                    No groups yet — create one or discover public groups
                </Typography>
            ) : (
                <Container layout="flex-column" gap="xs" padding="none" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {groups.map(g => (
                        <Container
                            key={g._id} layout="flex" align="center" gap="sm" padding="xs"
                            style={{ cursor: 'pointer', borderRadius: '4px' }}
                            onClick={() => navigate(`/groups/${g._id}`)}
                        >
                            <Container style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon name="FiUsers" size="xs" color="surface" />
                            </Container>
                            <Container layout="flex-column" gap="none" flexFill style={{ minWidth: 0 }}>
                                <Typography size="xs" weight="medium">{g.name}</Typography>
                                <Typography size="xxs" color="secondary">{g.memberCount || g.members?.length || 0} members</Typography>
                            </Container>
                            {g.privacy === 'private' && <Badge size="xs" color="secondary">Private</Badge>}
                        </Container>
                    ))}
                </Container>
            )}
        </Container>
    );
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────

const DashboardPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { error: showError } = useNotification();
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('files');

    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        (async () => {
            try {
                const [userStatsRes, connectionCounts] = await Promise.all([
                    userService.getUserStatsByUserId(user.id).catch(() => null),
                    userService.getConnectionCounts(user.id).catch(() => null)
                ]);
                const fileData = userStatsRes?.stats?.files ?? {};
                setStats({
                    totalFiles: fileData.totalFiles ?? 0,
                    totalStorage: fileData.totalStorage ?? 0,
                    connections: connectionCounts?.data?.connectionCount ?? 0,
                    pending: connectionCounts?.data?.pendingCount ?? 0
                });
            } catch {
                showError('Failed to load dashboard stats');
            } finally {
                setIsLoading(false);
            }
        })();
    }, [user?.id, showError]);

    if (isLoading) {
        return (
            <Page layout="flex" align="center" justify="center">
                <Container layout="flex-column" align="center" gap="md">
                    <CircularProgress size="lg" />
                    <Typography>Loading dashboard...</Typography>
                </Container>
            </Page>
        );
    }

    const tabs = [
        { id: 'files', icon: 'FiFolder', label: 'Files' },
        { id: 'social', icon: 'FiUsers', label: 'Social' },
    ];

    return (
        <Page layout="flex-column" padding="none" gap="none" style={{ overflow: 'hidden', height: '100vh' }}>
            <Container
                layout="flex-column"
                gap="none"
                width="100%"
                height="100%"
                style={{ padding: '8vmin', display: 'flex', flexDirection: 'column' }}
            >
                {/* ── Main scrollable content area ── */}
                <Container layout="flex-column" gap="sm" flexFill overflow="auto" padding="none" wrap={false} width="100%">
                    {/* Welcome */}
                    <Container layout="flex" justify="between" align="center" padding="none" width="100%">
                        <Container layout="flex-column" gap="xs" padding="none">
                            <Typography as="h1" size="xl" weight="bold">
                                Welcome back, {user?.firstName || user?.username || 'User'}
                            </Typography>
                            <Typography size="sm" color="secondary">
                                Here's an overview of your workspace
                            </Typography>
                        </Container>
                        <Button color="primary" onClick={() => navigate('/files')}>
                            <Icon name="FiFolder" size="xs" />
                            Open Files
                        </Button>
                    </Container>

                    {/* Tab Content */}
                    <Container layout="flex-column" flexFill overflow="auto" padding="none" width="100%" style={{ minHeight: 0 }}>
                        {activeTab === 'files' && <FilesTab navigate={navigate} userId={user?.id} />}
                        {activeTab === 'social' && <SocialTab userId={user?.id} navigate={navigate} />}
                    </Container>
                </Container>

                {/* ── Tab Icons (above footer) ── */}
                <Container layout="flex" justify="center" gap="lg" padding="sm" width="100%">
                    {tabs.map(tab => (
                        <Button
                            key={tab.id}
                            size="md"
                            variant="border-shadow"
                            selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{ borderRadius: '50%', width: '48px', height: '48px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={tab.label}
                        >
                            <Icon name={tab.icon} size="sm" />
                        </Button>
                    ))}
                </Container>

                {/* ── Footer Stats Bar ── */}
                <Card padding="md" width="100%" style={{ minHeight: '40px', flexShrink: 0 }}>
                    <Container layout="flex" align="center" justify="between" width="100%" height="100%" padding="none" style={{ padding: '0 16px' }}>
                        <Container layout="flex" align="center" gap="sm" padding="none">
                            <Icon name="FiHardDrive" size="xs" color="secondary" />
                            <Typography size="xs" color="secondary">
                                {formatBytes(stats?.totalStorage || 0)} used
                            </Typography>
                        </Container>

                        <Container layout="flex" align="center" gap="md" padding="none">
                            <Container layout="flex" align="center" gap="xs" padding="none">
                                <Icon name="FiFile" size="xs" color="secondary" />
                                <Typography size="xs" color="secondary">
                                    {stats?.totalFiles ?? 0} files
                                </Typography>
                            </Container>

                            <Container layout="flex" align="center" gap="xs" padding="none">
                                <Icon name="FiUserCheck" size="xs" color="secondary" />
                                <Typography size="xs" color="secondary">
                                    {stats?.connections ?? 0} connections
                                </Typography>
                            </Container>

                            {(stats?.pending ?? 0) > 0 && (
                                <Container layout="flex" align="center" gap="xs" padding="none">
                                    <Icon name="FiUserPlus" size="xs" color="warning" />
                                    <Typography size="xs" color="warning">
                                        {stats.pending} pending
                                    </Typography>
                                </Container>
                            )}
                        </Container>
                    </Container>
                </Card>
            </Container>
        </Page>
    );
};

export default DashboardPage;
