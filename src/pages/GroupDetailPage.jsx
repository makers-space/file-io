import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { userService } from '@/client/user.client';
import fileService from '@/client/file.client';
import {
    Page,
    Container,
    Card,
    Button,
    Typography,
    Icon,
    Input,
    Badge,
    CircularProgress,
    Select,
    Divider,
    TreeView,
} from '@components/Components';
import { QuickActions } from '@pages/FilesPage';

// Roles assignable to members (OWNER is only transferred, never directly assigned)
const ROLE_OPTIONS = [
    { value: 'READ', label: 'Read' },
    { value: 'WRITE', label: 'Write' },
];

const ROLE_COLORS = { OWNER: 'primary', WRITE: 'warning', READ: 'secondary' };

const FILE_ICONS = {
    text: 'FiFileText', image: 'FiImage', video: 'FiVideo',
    audio: 'FiMusic', pdf: 'FiFileText', directory: 'FiFolder',
};

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const GroupDetailPage = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { success: showSuccess, error: showError } = useNotification();

    const [group, setGroup] = useState(null);
    const [fileTree, setFileTree] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [editForm, setEditForm] = useState(null);
    const [showSettings, setShowSettings] = useState(false);

    // Add-member panel state
    const [memberSearch, setMemberSearch] = useState('');
    const [memberSearchResults, setMemberSearchResults] = useState([]);
    const [memberSearchLoading, setMemberSearchLoading] = useState(false);
    const [addMemberRole, setAddMemberRole] = useState('READ');
    const [addingMember, setAddingMember] = useState(null);
    const searchTimer = useRef(null);

    // Recursively add file-type icons to tree nodes
    const enrichTree = useCallback((treeData) => {
        if (!treeData || typeof treeData !== 'object') return {};
        const out = {};
        Object.entries(treeData).forEach(([key, node]) => {
            out[key] = {
                ...node,
                icon: FILE_ICONS[node.type] || (node.type === 'directory' ? 'FiFolder' : 'FiFile'),
                children: node.children ? enrichTree(node.children) : undefined,
            };
        });
        return out;
    }, []);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const groupRes = await userService.getGroup(groupId);
            const g = groupRes?.data?.group || groupRes?.data || groupRes?.group || groupRes;
            setGroup(g);
            if (g?.rootFolderPath) {
                const treeRes = await fileService.getDirectoryTree(g.rootFolderPath, { format: 'object' });
                setFileTree(enrichTree(treeRes?.tree || treeRes?.data?.tree || {}));
            }
        } catch {
            showError('Failed to load group');
        } finally {
            setIsLoading(false);
        }
    }, [groupId, showError, enrichTree]);

    useEffect(() => { load(); }, [load]);

    // Derive current user's role
    const currentUserId = (user?._id || user?.id)?.toString();
    const currentMember = group?.members?.find(
        m => (m.user?._id || m.user)?.toString() === currentUserId
    );
    const currentRole = currentMember?.role;
    const isOwner = currentRole === 'OWNER';
    const canWrite = isOwner || currentRole === 'WRITE';

    // Debounced member search
    useEffect(() => {
        if (!memberSearch.trim() || memberSearch.trim().length < 2) {
            setMemberSearchResults([]);
            return;
        }
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(async () => {
            setMemberSearchLoading(true);
            try {
                const res = await userService.getPublicUsers({ search: memberSearch.trim(), limit: 10 });
                const users = res?.users || res?.data?.users || [];
                const existingIds = new Set((group?.members || []).map(m => (m.user?._id || m.user)?.toString()));
                setMemberSearchResults(users.filter(u => !existingIds.has((u._id || u.id)?.toString())));
            } catch {
                setMemberSearchResults([]);
            } finally {
                setMemberSearchLoading(false);
            }
        }, 350);
    }, [memberSearch, group?.members]);

    const handleLeave = async () => {
        if (!window.confirm('Leave this group?')) return;
        try {
            await userService.leaveGroup(groupId);
            showSuccess('Left group');
            navigate('/dashboard');
        } catch {
            showError('Failed to leave group');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Delete this group and all its files? This cannot be undone.')) return;
        try {
            await userService.deleteGroup(groupId);
            showSuccess('Group deleted');
            navigate('/dashboard');
        } catch {
            showError('Failed to delete group');
        }
    };

    const handleSaveSettings = async () => {
        if (!editForm) return;
        try {
            await userService.updateGroup(groupId, editForm);
            showSuccess('Group updated');
            load();
            setEditForm(null);
        } catch {
            showError('Failed to update group');
        }
    };

    const handleRemoveMember = async (memberId) => {
        if (!window.confirm('Remove this member?')) return;
        try {
            await userService.removeMember(groupId, memberId);
            showSuccess('Member removed');
            load();
        } catch {
            showError('Failed to remove member');
        }
    };

    const handleUpdateRole = async (memberId, newRole) => {
        try {
            await userService.updateMemberRole(groupId, memberId, newRole);
            showSuccess('Role updated');
            load();
        } catch {
            showError('Failed to update role');
        }
    };

    const handleAddMember = async (targetUser) => {
        const uid = (targetUser._id || targetUser.id)?.toString();
        setAddingMember(uid);
        try {
            await userService.addMember(groupId, uid, addMemberRole);
            showSuccess(`${targetUser.username || targetUser.email} added`);
            setMemberSearch('');
            setMemberSearchResults([]);
            load();
        } catch (err) {
            showError(err?.response?.data?.message || 'Failed to add member');
        } finally {
            setAddingMember(null);
        }
    };

    if (isLoading) {
        return (
            <Page layout="flex" align="center" justify="center">
                <CircularProgress size="xl" />
            </Page>
        );
    }

    if (!group) {
        return (
            <Page layout="flex-column" align="center" justify="center" gap="md">
                <Icon name="FiAlertCircle" size="xl" color="error" />
                <Typography size="lg">Group not found</Typography>
                <Button onClick={() => navigate('/dashboard')}><Icon name="FiArrowLeft" size="xs" />Back</Button>
            </Page>
        );
    }

    const hasFiles = Object.keys(fileTree).length > 0;

    return (
        <Page layout="flex-column" align="center" padding="md">
            <Container layout="flex-column" gap="md" style={{ width: '100%', maxWidth: '900px' }}>

                {/* Top bar */}
                <Container layout="flex" justify="between" align="center" width="100%">
                    <Button size="xs" variant="ghost" onClick={() => navigate('/dashboard')}>
                        <Icon name="FiArrowLeft" size="xs" /> Dashboard
                    </Button>
                    <Container layout="flex" gap="xs">
                        {group.rootFolderPath && (
                            <Button size="xs" variant="ghost" onClick={() => navigate('/files' + group.rootFolderPath)}>
                                <Icon name="FiFolder" size="xs" /> Open in Files
                            </Button>
                        )}
                        {!isOwner && (
                            <Button size="xs" color="error" variant="ghost" onClick={handleLeave}>
                                <Icon name="FiLogOut" size="xs" /> Leave
                            </Button>
                        )}
                        {isOwner && (
                            <Button size="xs" variant={showSettings ? 'primary' : 'ghost'} onClick={() => setShowSettings(p => !p)}>
                                <Icon name="FiSettings" size="xs" /> Settings
                            </Button>
                        )}
                    </Container>
                </Container>

                {/* Group identity */}
                <Container layout="flex-column" align="center" gap="xs" width="100%">
                    <Container style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Icon name="FiUsers" size="xs" color="surface" />
                    </Container>
                    <Typography as="h1" size="lg" weight="bold" align="center">{group.name}</Typography>
                    {group.description && (
                        <Typography size="xs" color="secondary" align="center">{group.description}</Typography>
                    )}
                    <Container layout="flex" gap="xs" justify="center">
                        {group.privacy === 'private' && <Badge size="xs" color="secondary">Private</Badge>}
                        <Badge size="xs" color="primary">{group.members?.length || 0} members</Badge>
                        {currentRole && (
                            <Badge size="xs" color={ROLE_COLORS[currentRole] || 'secondary'}>
                                {currentRole.charAt(0) + currentRole.slice(1).toLowerCase()}
                            </Badge>
                        )}
                    </Container>
                </Container>

                {/* Settings panel (owner only, toggled from top bar) */}
                {showSettings && isOwner && (
                    <Container layout="flex-column" gap="md" style={{ maxWidth: '480px', width: '100%' }}>
                        <Typography size="sm" weight="semibold">Group Settings</Typography>
                        <Input
                            label="Name"
                            value={editForm?.name ?? group.name}
                            onChange={e => setEditForm(p => ({
                                ...(p || { name: group.name, description: group.description || '', privacy: group.privacy || 'private' }),
                                name: e.target.value,
                            }))}
                            width="100%"
                        />
                        <Input
                            label="Description"
                            value={editForm?.description ?? group.description ?? ''}
                            onChange={e => setEditForm(p => ({
                                ...(p || { name: group.name, description: group.description || '', privacy: group.privacy || 'private' }),
                                description: e.target.value,
                            }))}
                            multiline
                            width="100%"
                        />
                        <Select
                            label="Privacy"
                            options={[
                                { value: 'private', label: 'Private - invite only' },
                                { value: 'public', label: 'Public - anyone can join' },
                            ]}
                            value={editForm?.privacy ?? group.privacy ?? 'private'}
                            onChange={val => setEditForm(p => ({
                                ...(p || { name: group.name, description: group.description || '', privacy: group.privacy || 'private' }),
                                privacy: val,
                            }))}
                        />
                        <Container layout="flex" gap="sm">
                            <Button color="primary" onClick={handleSaveSettings} disabled={!editForm}>
                                <Icon name="FiSave" size="xs" /> Save Changes
                            </Button>
                            {editForm && <Button variant="ghost" onClick={() => setEditForm(null)}>Cancel</Button>}
                        </Container>
                        <Divider margin="sm" />
                        <Typography size="sm" weight="semibold" color="error">Danger Zone</Typography>
                        <Typography size="xs" color="secondary">
                            Deleting the group permanently removes all files stored inside it.
                        </Typography>
                        <Button size="sm" color="error" onClick={handleDelete}>
                            <Icon name="FiTrash2" size="xs" /> Delete Group
                        </Button>
                        <Divider margin="none" />
                    </Container>
                )}

                {/* Files + Members side by side */}
                <Container layout="flex" gap="none" align="start" style={{ width: '100%', minHeight: '300px' }}>

                    {/* Files column */}
                    <Container layout="flex-column" gap="xs" style={{ flex: 2, minWidth: 0 }}>
                        <Container layout="flex" justify="between" align="center" width="100%">
                            <Typography size="xs" color="secondary" weight="semibold">Files</Typography>
                            {canWrite && group.rootFolderPath && (
                                <Button size="xs" variant="ghost"
                                    genie={{ trigger: 'click', content: () => (
                                        <QuickActions
                                            targetPath={group.rootFolderPath}
                                            fileTree={fileTree}
                                            onActionComplete={async () => {
                                                const treeRes = await fileService.getDirectoryTree(group.rootFolderPath, { format: 'object' }).catch(() => null);
                                                setFileTree(enrichTree(treeRes?.tree || treeRes?.data?.tree || {}));
                                            }}
                                        />
                                    )}}
                                >
                                    <Icon name="FiPlus" size="xs" /> Add
                                </Button>
                            )}
                        </Container>
                        {!hasFiles ? (
                            <Container layout="flex-column" align="center" justify="center" gap="sm" padding="lg">
                                <Icon name="FiFolder" size="lg" color="secondary" />
                                <Typography size="xs" color="secondary">No files yet</Typography>
                            </Container>
                        ) : (
                            <TreeView
                                data={fileTree}
                                onNodeSelect={(id) => navigate('/files' + id)}
                                showIcons
                                size="sm"
                                color="background"
                                searchable
                                searchPlaceholder="Search files..."
                                width="100%"
                            />
                        )}
                    </Container>

                    <Divider orientation="vertical" margin="sm" />

                    {/* Members column */}
                    <Container layout="flex-column" gap="sm" style={{ flex: 1.5, minWidth: 0 }}>
                        <Container layout="flex" justify="between" align="center" width="100%">
                            <Typography size="xs" color="secondary" weight="semibold">
                                Members ({group.members?.length || 0})
                            </Typography>
                            {isOwner && (
                                <Button size="xs" variant="ghost"
                                    genie={{ trigger: 'click', content: () => (
                                        <Container layout="flex-column" gap="none" padding="xs" style={{ minWidth: 260 }}>
                                            <Container layout="flex" width="100%" gap="xs" align="center" style={{ marginBottom: 4 }}>
                                                <Input
                                                    placeholder="Search by username or email..."
                                                    value={memberSearch}
                                                    onChange={e => setMemberSearch(typeof e === 'string' ? e : e?.target?.value ?? '')}
                                                    icon="FiSearch"
                                                    minWidth="300px"
                                                />
                                                <Select
                                                    options={ROLE_OPTIONS}
                                                    value={addMemberRole}
                                                    onChange={setAddMemberRole}
                                                    width="180px"
                                                />
                                            </Container>
                                            {memberSearchLoading && (
                                                <Container layout="flex" align="center" gap="xs">
                                                    <CircularProgress size="xs" />
                                                    <Typography size="xs" color="secondary">Searching...</Typography>
                                                </Container>
                                            )}
                                            {!memberSearchLoading && memberSearch.trim().length >= 2 && memberSearchResults.length === 0 && (
                                                <Typography size="xs" color="secondary">No users found</Typography>
                                            )}
                                            {memberSearchResults.map(u => {
                                                const uid = (u._id || u.id)?.toString();
                                                return (
                                                    <Container key={uid} layout="flex" align="center" justify="between" gap="xs" width="100%" style={{ padding: '2px 0' }}>
                                                        <Typography size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {u.username || u.email}
                                                            {u.firstName && <span style={{ opacity: 0.55, marginLeft: 5 }}>{u.firstName} {u.lastName || ''}</span>}
                                                        </Typography>
                                                        <Button size="xs" color="primary" onClick={() => handleAddMember(u)} disabled={addingMember === uid}>
                                                            {addingMember === uid ? <CircularProgress size="xs" /> : 'Add'}
                                                        </Button>
                                                    </Container>
                                                );
                                            })}
                                        </Container>
                                    )}}
                                >
                                    <Icon name="FiUserPlus" size="xs" />
                                </Button>
                            )}
                        </Container>

                        <Container layout="flex-column" gap="none" width="100%">
                            {(group.members || []).map((m, idx) => {
                                const memberId = (m.user?._id || m.user)?.toString();
                                const memberName = m.user?.username || m.user?.email || memberId;
                                const memberRole = m.role || 'READ';
                                const isSelf = memberId === currentUserId;
                                const memberIsOwner = memberRole === 'OWNER';
                                const roleColor = ROLE_COLORS[memberRole] || 'secondary';
                                return (
                                    <Container key={memberId} layout="flex" align="center" gap="xs" width="100%"
                                        style={{ padding: '5px 2px', borderTop: idx > 0 ? '1px solid var(--border-color, rgba(255,255,255,0.06))' : 'none' }}
                                    >
                                        <Typography size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {memberName}
                                            {isSelf && <span style={{ opacity: 0.45, marginLeft: 4, fontSize: '0.75em' }}>you</span>}
                                        </Typography>
                                        {isOwner && !isSelf && !memberIsOwner ? (
                                            <>
                                                <Select
                                                    options={ROLE_OPTIONS}
                                                    value={memberRole}
                                                    onChange={(val) => handleUpdateRole(memberId, val)}
                                                    size="xs"
                                                    width="80px"
                                                />
                                                <Button size="xs" variant="ghost" color="error" onClick={() => handleRemoveMember(memberId)}>
                                                    <Icon name="FiX" size="xs" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Typography size="xxs" color={roleColor} style={{ opacity: 0.7 }}>
                                                {memberRole.charAt(0) + memberRole.slice(1).toLowerCase()}
                                            </Typography>
                                        )}
                                    </Container>
                                );
                            })}
                        </Container>
                    </Container>
                </Container>

            </Container>
        </Page>
    );
};

export default GroupDetailPage;
