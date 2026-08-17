import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import fileService from '@/client/file.client';
import { userService } from '@/client/user.client';
import { getFileIcon } from '@components/FileCard';
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

const greeting = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const AVATAR_COLORS = ['#4A90D9', '#48BB78', '#9B72EF', '#E05C5C', '#F6AD55', '#76E4F7'];
const avatarColor = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const InitialsAvatar = ({ user: u, size = 30 }) => {
    const name = u?.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u?.username || u?.email || '?');
    const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    return (
        <Container
            layout="flex" align="center" justify="center" padding="none" wrap={false}
            width={`${size}px`} height={`${size}px`}
            style={{ borderRadius: '50%', flexShrink: 0, background: avatarColor(u?.username || name) }}
        >
            <Typography as="span" weight="bold" style={{ color: '#fff', fontSize: size * 0.36, lineHeight: 1 }}>
                {initials}
            </Typography>
        </Container>
    );
};

const IconTile = ({ icon, color = 'var(--primary-color)', size = 44, radius = 12, iconSize = 'sm' }) => (
    <Container
        layout="flex" align="center" justify="center" padding="none" wrap={false}
        width={`${size}px`} height={`${size}px`}
        style={{ borderRadius: radius, flexShrink: 0, background: tint(color, 14) }}
    >
        <Icon name={icon} size={iconSize} style={{ color }} />
    </Container>
);

// ─── KPI stat card ────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, caption, accent = 'var(--primary-color)', onClick }) => (
    <Card
        layout="flex" gap="md" padding="md" hover={!!onClick} align="center" wrap={false}
        onClick={onClick}
        style={{ minWidth: 0, cursor: onClick ? 'pointer' : 'default' }}
    >
        <IconTile icon={icon} color={accent} />
        <Container layout="flex-column" gap="none" padding="none" wrap={false} style={{ minWidth: 0 }}>
            <Typography size="xl" weight="bold" style={{ lineHeight: 1.15 }}>{value}</Typography>
            <Typography size="xs" color="muted" style={{ whiteSpace: 'nowrap' }}>
                {label}{caption ? ` · ${caption}` : ''}
            </Typography>
        </Container>
    </Card>
);

// ─── File rows ────────────────────────────────────────────────────────────────

const FileRow = ({ file, navigate, showOwner = false }) => (
    <Container
        layout="flex" align="center" gap="sm" padding="none" wrap={false} hoverable
        onClick={() => navigate(`/files${file.filePath || ''}`)}
        style={{ padding: '9px 10px', minWidth: 0 }}
    >
        <IconTile icon={getFileIcon(file)} size={34} radius={9} />
        <Container layout="flex-column" gap="none" padding="none" flexFill wrap={false} style={{ minWidth: 0 }}>
            <Typography size="sm" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.fileName || file.filePath?.split('/').pop() || 'Untitled'}
            </Typography>
            <Typography size="xs" color="muted">
                {timeAgo(file.updatedAt)}
                {showOwner && file.owner?.username ? ` · shared by ${file.owner.username}` : ''}
            </Typography>
        </Container>
        <Icon name="FiChevronRight" size="xs" style={{ opacity: 0.35, flexShrink: 0 }} />
    </Container>
);

const SectionHeader = ({ icon, title, count, action }) => (
    <Container layout="flex" align="center" justify="between" padding="none" width="100%">
        <Container layout="flex" align="center" gap="xs" padding="none" wrap={false}>
            <Icon name={icon} size="xs" color="primary" />
            <Typography size="sm" weight="semibold">{title}</Typography>
            {count != null && <Badge size="xs" color="secondary">{count}</Badge>}
        </Container>
        {action}
    </Container>
);

// ─── Files panel ──────────────────────────────────────────────────────────────

const FilesPanel = ({ navigate, userId }) => {
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
                setRecentFiles(recent.slice(0, 8));
                setSharedFiles(shared.slice(0, 6));
                setStarredFiles(starredRes?.data || []);
            } catch { /* non-critical */ }
            finally { setIsLoading(false); }
        })();
    }, [userId]);

    if (isLoading) {
        return (
            <Card layout="flex" align="center" justify="center" padding="xl" width="100%" minHeight="220px">
                <CircularProgress size="sm" />
            </Card>
        );
    }

    return (
        <Container layout="flex-column" gap="md" padding="none" width="100%" wrap={false} style={{ minWidth: 0 }}>
            {/* Recent */}
            <Card layout="flex-column" gap="sm" padding="lg" hover={false} width="100%" style={{ minWidth: 0 }}>
                <SectionHeader
                    icon="FiClock"
                    title="Recent files"
                    action={
                        <Button size="xs" color="secondary" onClick={() => navigate('/files')}>
                            View all <Icon name="FiArrowRight" size="xs" />
                        </Button>
                    }
                />
                {recentFiles.length === 0 ? (
                    <Container layout="flex-column" align="center" gap="sm" padding="lg" width="100%">
                        <IconTile icon="FiUploadCloud" size={52} radius={14} iconSize="md" />
                        <Typography size="sm" weight="medium">Your drive is empty</Typography>
                        <Typography size="xs" color="muted" align="center" maxWidth="300px">
                            Upload a file or create a document to see it here.
                        </Typography>
                        <Button size="sm" color="primary" onClick={() => navigate('/files')}>
                            <Icon name="FiPlus" size="xs" /> Create your first file
                        </Button>
                    </Container>
                ) : (
                    <Container layout="grid" columns={2} gap="xs" padding="none" width="100%">
                        {recentFiles.map(f => <FileRow key={f._id || f.filePath} file={f} navigate={navigate} />)}
                    </Container>
                )}
            </Card>

            {/* Starred */}
            <Card layout="flex-column" gap="sm" padding="lg" hover={false} width="100%" style={{ minWidth: 0 }}>
                <SectionHeader icon="FiStar" title="Starred" count={starredFiles.length} />
                {starredFiles.length === 0 ? (
                    <Typography size="xs" color="muted">
                        Star files in your drive to pin them here for quick access.
                    </Typography>
                ) : (
                    <Container layout="flex" gap="sm" padding="none" wrap width="100%">
                        {starredFiles.slice(0, 8).map(f => (
                            <Container
                                key={f._id || f.filePath}
                                layout="flex" align="center" gap="xs" padding="none" wrap={false} hoverable
                                onClick={() => navigate(`/files${f.filePath || ''}`)}
                                style={{
                                    padding: '7px 12px', borderRadius: 999,
                                    border: '1px solid var(--border-color)', maxWidth: '100%',
                                }}
                            >
                                <Icon name={getFileIcon(f)} size="xs" color="primary" />
                                <Typography size="xs" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                    {f.fileName || f.filePath?.split('/').pop() || 'Untitled'}
                                </Typography>
                            </Container>
                        ))}
                    </Container>
                )}
            </Card>

            {/* Shared with me */}
            <Card layout="flex-column" gap="sm" padding="lg" hover={false} width="100%" style={{ minWidth: 0 }}>
                <SectionHeader icon="FiShare2" title="Shared with me" count={sharedFiles.length} />
                {sharedFiles.length === 0 ? (
                    <Typography size="xs" color="muted">
                        Files that teammates share with you will show up here.
                    </Typography>
                ) : (
                    <Container layout="grid" columns={2} gap="xs" padding="none" width="100%">
                        {sharedFiles.map(f => <FileRow key={f._id || f.filePath} file={f} navigate={navigate} showOwner />)}
                    </Container>
                )}
            </Card>
        </Container>
    );
};

// ─── Social rail ──────────────────────────────────────────────────────────────

const SocialPanel = ({ userId, navigate, onCountsChange }) => {
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
                onCountsChange?.({ groups: (groupRes.data || []).length });
            } catch { /* non-critical */ }
            finally { setIsLoading(false); }
        })();
    }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

    const reloadGroups = useCallback(async () => {
        try {
            const groupRes = await userService.getMyGroups();
            setGroups(groupRes.data || []);
            onCountsChange?.({ groups: (groupRes.data || []).length });
        } catch { /* non-critical */ }
    }, [onCountsChange]);

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
            <Card layout="flex" align="center" justify="center" padding="xl" width="100%" minHeight="220px">
                <CircularProgress size="sm" />
            </Card>
        );
    }

    // Find People genie content — rendered inside a Button genie dropdown
    const findPeopleGenie = (
        <Container layout="flex-column" gap="sm" padding="md" width="280px">
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
                <Container layout="flex-column" gap="xs" padding="none" maxHeight="200px" overflow="auto">
                    {searchResults.map(u => {
                        const uid = u._id || u.id;
                        const statusInfo = getStatusLabel(connectionStatuses[uid]);
                        const isSending = !!sendingRequest[uid];
                        return (
                            <Container key={uid} layout="flex" align="center" gap="sm" padding="xs" wrap={false}>
                                <InitialsAvatar user={u} size={26} />
                                <Container layout="flex-column" gap="none" padding="none" flexFill wrap={false} style={{ minWidth: 0 }}>
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
                    <Container layout="flex-column" gap="xs" padding="none" maxHeight="120px" overflow="auto">
                        {sentRequests.map(u => (
                            <Container key={u._id || u.id} layout="flex" align="center" gap="sm" padding="xs" wrap={false}>
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
        <Container layout="flex-column" gap="md" padding="none" width="100%" wrap={false} style={{ minWidth: 0 }}>

            {/* ── People ── */}
            <Card layout="flex-column" gap="sm" padding="lg" hover={false} width="100%" style={{ minWidth: 0 }}>
                <SectionHeader
                    icon="FiUserCheck"
                    title="People"
                    count={connections.length}
                    action={
                        <Button size="xs" color="secondary" genie={findPeopleGenie} genieTrigger="click">
                            <Icon name="FiSearch" size="xs" /> Find people
                        </Button>
                    }
                />

                {/* Pending requests */}
                {pendingRequests.length > 0 && (
                    <Container
                        layout="flex-column" gap="xs" padding="sm" maxHeight="170px" overflow="auto"
                        style={{
                            background: tint('var(--warning-color)', 8),
                            border: `1px solid ${tint('var(--warning-color)', 30)}`,
                            borderRadius: 10,
                        }}
                    >
                        <Typography size="xs" weight="semibold" color="warning">
                            {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}
                        </Typography>
                        {pendingRequests.map(u => {
                            const uid = u._id || u.id;
                            return (
                                <Container key={uid} layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                                    <InitialsAvatar user={u} size={28} />
                                    <Container layout="flex-column" gap="none" padding="none" flexFill wrap={false} style={{ minWidth: 0 }}>
                                        <Typography size="xs" weight="medium">{u.username || u.email}</Typography>
                                        {u.firstName && <Typography size="xxs" color="secondary">{u.firstName} {u.lastName || ''}</Typography>}
                                    </Container>
                                    <Container layout="flex" gap="xs" padding="none" wrap={false}>
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
                )}

                {/* Connections list */}
                {connections.length === 0 ? (
                    <Typography size="xs" color="muted">
                        No connections yet — use Find people to build your network.
                    </Typography>
                ) : (
                    <Container layout="flex-column" gap="none" padding="none" maxHeight="220px" overflow="auto">
                        {connections.map(u => (
                            <Container key={u._id} layout="flex" align="center" gap="sm" padding="none" wrap={false} hoverable style={{ padding: '7px 8px' }}>
                                <InitialsAvatar user={u} size={30} />
                                <Container layout="flex-column" gap="none" padding="none" flexFill wrap={false} style={{ minWidth: 0 }}>
                                    <Typography size="xs" weight="medium">{u.username || u.email}</Typography>
                                    {u.firstName && <Typography size="xxs" color="secondary">{u.firstName} {u.lastName || ''}</Typography>}
                                </Container>
                            </Container>
                        ))}
                    </Container>
                )}
            </Card>

            {/* ── Groups ── */}
            <Card layout="flex-column" gap="sm" padding="lg" hover={false} width="100%" style={{ minWidth: 0 }}>
                <SectionHeader
                    icon="FiUsers"
                    title="Groups"
                    count={groups.length}
                    action={
                        <Container layout="flex" gap="xs" padding="none" wrap={false}>
                            <Button size="xs" color="secondary" onClick={handleDiscover}>
                                <Icon name="FiCompass" size="xs" />
                                {showDiscover ? 'Hide' : 'Discover'}
                            </Button>
                            <Button size="xs" color="primary" onClick={() => { setShowCreateGroup(p => !p); setShowDiscover(false); }}>
                                <Icon name={showCreateGroup ? 'FiChevronUp' : 'FiPlus'} size="xs" />
                                {showCreateGroup ? 'Cancel' : 'New'}
                            </Button>
                        </Container>
                    }
                />

                {/* Create group inline form */}
                {showCreateGroup && (
                    <Container layout="flex-column" gap="sm" padding="sm" style={{ background: tint('var(--primary-color)', 6), borderRadius: 10 }}>
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
                            <Typography size="xs" color="muted" padding="xs">No public groups to join right now</Typography>
                        )}
                        {discoverResults.map(g => (
                            <Container key={g._id} layout="flex" align="center" justify="between" gap="sm" padding="xs" wrap={false}>
                                <Container layout="flex" align="center" gap="sm" padding="none" wrap={false} style={{ minWidth: 0 }}>
                                    <IconTile icon="FiUsers" size={28} radius={8} iconSize="xs" />
                                    <Container layout="flex-column" gap="none" padding="none" wrap={false} style={{ minWidth: 0 }}>
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
                    <Typography size="xs" color="muted">
                        No groups yet — create one or discover public groups.
                    </Typography>
                ) : (
                    <Container layout="flex-column" gap="none" padding="none" maxHeight="220px" overflow="auto">
                        {groups.map(g => (
                            <Container
                                key={g._id}
                                layout="flex" align="center" gap="sm" padding="none" wrap={false} hoverable
                                onClick={() => navigate(`/groups/${g._id}`)}
                                style={{ padding: '7px 8px' }}
                            >
                                <Container
                                    layout="flex" align="center" justify="center" padding="none" wrap={false}
                                    width="30px" height="30px"
                                    style={{ borderRadius: 9, flexShrink: 0, background: avatarColor(g.name) }}
                                >
                                    <Icon name="FiUsers" size="xs" style={{ color: '#fff' }} />
                                </Container>
                                <Container layout="flex-column" gap="none" padding="none" flexFill wrap={false} style={{ minWidth: 0 }}>
                                    <Typography size="xs" weight="medium">{g.name}</Typography>
                                    <Typography size="xxs" color="secondary">{g.memberCount || g.members?.length || 0} members</Typography>
                                </Container>
                                {g.privacy === 'private' && <Badge size="xs" color="secondary">Private</Badge>}
                            </Container>
                        ))}
                    </Container>
                )}
            </Card>
        </Container>
    );
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────

const DashboardPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { error: showError } = useNotification();
    const [stats, setStats] = useState(null);
    const [groupCount, setGroupCount] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

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

    const handleCountsChange = useCallback(({ groups }) => {
        if (groups != null) setGroupCount(groups);
    }, []);

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

    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <Page layout="flex-column" padding="none" gap="none">
            <Container
                layout="flex-column" gap="lg" padding="none" width="100%" maxWidth="1360px" margin="auto" wrap={false}
                style={{ padding: 'clamp(20px, 3vw, 36px)' }}
            >
                {/* ── Header ── */}
                <Container layout="flex" justify="between" align="center" padding="none" width="100%" gap="md" wrap>
                    <Container layout="flex-column" gap="none" padding="none">
                        <Typography size="xs" color="muted" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {today}
                        </Typography>
                        <Typography as="h1" size="2xl" weight="bold" style={{ letterSpacing: '-0.015em' }}>
                            {greeting()}, {user?.firstName || user?.username || 'there'}
                        </Typography>
                    </Container>
                    <Container layout="flex" gap="sm" padding="none" wrap={false}>
                        <Button color="secondary" onClick={() => navigate('/settings')}>
                            <Icon name="FiSettings" size="xs" /> Settings
                        </Button>
                        <Button color="primary" onClick={() => navigate('/files')}>
                            <Icon name="FiFolder" size="xs" /> Open Files
                        </Button>
                    </Container>
                </Container>

                {/* ── KPI cards ── */}
                <Container layout="grid" columns="auto-sm" gap="md" padding="none" width="100%">
                    <StatCard
                        icon="FiFile"
                        label="Files"
                        value={stats?.totalFiles ?? 0}
                        onClick={() => navigate('/files')}
                    />
                    <StatCard
                        icon="FiHardDrive"
                        label="Storage used"
                        value={formatBytes(stats?.totalStorage || 0)}
                        accent="var(--tertiary-accent-color, var(--primary-color))"
                        onClick={() => navigate('/files')}
                    />
                    <StatCard
                        icon="FiUserCheck"
                        label="Connections"
                        value={stats?.connections ?? 0}
                        caption={(stats?.pending ?? 0) > 0 ? `${stats.pending} pending` : null}
                        accent="var(--success-color)"
                    />
                    <StatCard
                        icon="FiUsers"
                        label="Groups"
                        value={groupCount ?? '—'}
                        accent="var(--warning-color)"
                    />
                </Container>

                {/* ── Main content: files (left) + social rail (right) ── */}
                <Container layout="flex" gap="lg" padding="none" width="100%" align="start" wrap>
                    <Container layout="flex-column" gap="none" padding="none" wrap={false} style={{ flex: '2 1 480px', minWidth: 0 }}>
                        <FilesPanel navigate={navigate} userId={user?.id} />
                    </Container>
                    <Container layout="flex-column" gap="none" padding="none" wrap={false} style={{ flex: '1 1 310px', minWidth: 0 }}>
                        <SocialPanel userId={user?.id} navigate={navigate} onCountsChange={handleCountsChange} />
                    </Container>
                </Container>
            </Container>
        </Page>
    );
};

export default DashboardPage;
