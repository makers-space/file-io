import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import fileService from '../client/file.client';
import FileCard from '../components/FileCard';
import FileListRow from '../components/FileListRow';
import {
  Page,
  Container,
  Card,
  Button,
  Typography,
  Icon,
  Input,
  TreeView,
  Editor,
  FloatingActionButton,
  CircularProgress,
  ProgressBar,
  Switch,
  Select,
  Badge,
  Divider,
  Image,
  Video,
  Audio,
  Model3D,
  PdfViewer
} from '../components/Components';

const useYjsDocument = (file) => {
  const [content, setContent] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connecting', 'connected', 'disconnected', 'error'
  const connectionRef = useRef(null);
  const { error: showError } = useNotification();
  const filePath = file?.filePath;
  const isTextFile = file?.type === 'text';

  useEffect(() => {
    if (!filePath || !isTextFile) {
      setContent('');
      setConnectionStatus('disconnected');
      return;
    }

    let mounted = true;
    const connectToDoc = async () => {
      setConnectionStatus('connecting');
      try {
        const connection = await fileService.connectToDocument(filePath);
        
        if (!mounted) return;
        
        connectionRef.current = connection;
        const initialContent = connection.ytext.toString();
        setContent(initialContent);

        if (connection.provider) {
          connection.provider.on('status', (event) => {
            if (mounted) {
              setConnectionStatus(event.status === 'connected' ? 'connected' : 'connecting');
            }
          });

          connection.provider.on('sync', (synced) => {
            if (mounted && synced) {
              setConnectionStatus('connected');
            }
          });

          // Stop reconnecting for permanent authorization failures.
          // Auth token expiry (1008) is handled by the transport layer
          // in connectToDocument which refreshes the token and retries.
          connection.provider.on('connection-close', (event) => {
            if (event.code === 4403 || event.code === 4404) {
              connection.provider.shouldConnect = false;
              connection.provider.disconnect();
              if (mounted) {
                setConnectionStatus('error');
              }
            }
          });
        }

        const observer = (event, transaction) => {
          if (transaction.origin !== 'editor-change') {
            const newContent = connection.ytext.toString();
            setContent(newContent);
          }
        };
        connection.ytext.observe(observer);
        connection.observer = observer;

        if (mounted) {
          setConnectionStatus('connected');
        }
      } catch (err) {
        if (mounted) {
          setConnectionStatus('error');
          showError(`Failed to connect to document: ${err.message}`);
        }
      }
    };

    connectToDoc();

    return () => {
      mounted = false;
      if (connectionRef.current) {
        if (connectionRef.current.observer) {
          connectionRef.current.ytext.unobserve(connectionRef.current.observer);
        }
        fileService.disconnectFromDocument(filePath).catch((err) => {
          showError(`Failed to disconnect from document: ${err.message}`);
        });
        connectionRef.current = null;
      }
      setConnectionStatus('disconnected');
    };
  }, [filePath, isTextFile, showError]);

  const updateContent = useCallback((newContent) => {
    const ytext = connectionRef.current?.ytext;
    if (!ytext) {
      showError('No collaborative connection available. Please refresh the page.');
      return;
    }
    // Diff-based update: only touch the characters that actually changed.
    // A full delete+insert causes Yjs CRDT to duplicate content when two
    // clients write simultaneously (both inserts survive the merge).
    const oldText = ytext.toString();
    if (newContent === oldText) return;

    let start = 0;
    while (start < oldText.length && start < newContent.length && oldText[start] === newContent[start]) start++;
    let oldEnd = oldText.length;
    let newEnd = newContent.length;
    while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newContent[newEnd - 1]) { oldEnd--; newEnd--; }

    ytext.doc.transact(() => {
      if (oldEnd > start) ytext.delete(start, oldEnd - start);
      if (newEnd > start) ytext.insert(start, newContent.slice(start, newEnd));
    }, 'editor-change');
  }, [showError]);

  return { content, updateContent, connectionStatus };
};

const ShareForm = ({ filePath, isDirectory, onSuccess, onCancel }) => {
  const [tab, setTab] = useState('share');
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [permission, setPermission] = useState('read');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { error: showError, success: showSuccess } = useNotification();
  const { user } = useAuth();
  const [sharedRead, setSharedRead] = useState([]);
  const [sharedWrite, setSharedWrite] = useState([]);
  const [updatingUser, setUpdatingUser] = useState({});
  const [connectionFilter, setConnectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState({});
  const [sendingRequest, setSendingRequest] = useState({});

  const fetchSharing = useCallback(async () => {
    try {
      const res = await fileService.getFileSharing(filePath);
      const sharing = res.sharing;
      setSharedRead(sharing.permissions.read);
      setSharedWrite(sharing.permissions.write);
    } catch {
      setSharedRead([]);
      setSharedWrite([]);
    }
  }, [filePath]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const userId = user?._id || user?.id;
        if (!userId) return;
        const { default: userService } = await import('../client/user.client');
        const [connectionsRes] = await Promise.all([
          userService.getConnections(userId, { limit: 1000 }),
          fetchSharing()
        ]);
        setAllUsers(connectionsRes.data || []);
      } catch {
        showError('Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, fetchSharing]);

  const getUserShareStatus = useCallback((uid) => {
    if (sharedWrite.some(u => (u._id || u.id) === uid)) return 'write';
    if (sharedRead.some(u => (u._id || u.id) === uid)) return 'read';
    return null;
  }, [sharedRead, sharedWrite]);

  const filteredConnections = useMemo(() => {
    if (!connectionFilter.trim()) return allUsers;
    const q = connectionFilter.toLowerCase();
    return allUsers.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.lastName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [allUsers, connectionFilter]);

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const { default: userService } = await import('../client/user.client');
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
  }, [searchQuery, user]);

  useEffect(() => {
    if (tab !== 'find') return;
    const timer = setTimeout(handleSearch, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, tab, handleSearch]);

  const handleSendRequest = async (targetUserId) => {
    setSendingRequest(prev => ({ ...prev, [targetUserId]: true }));
    try {
      const { default: userService } = await import('../client/user.client');
      await userService.sendConnectionRequest(targetUserId);
      showSuccess('Connection request sent');
      setConnectionStatuses(prev => ({ ...prev, [targetUserId]: 'pending_sent' }));
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to send request');
    } finally {
      setSendingRequest(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) { showError('Please select at least one user'); return; }
    setIsSubmitting(true);
    try {
      await fileService.shareFile(filePath, selectedUsers, permission);
      showSuccess(`${isDirectory ? 'Directory' : 'File'} shared with ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`);
      await fetchSharing();
      setSelectedUsers([]);
      onSuccess?.(filePath, 'share');
    } catch (err) {
      showError(`Failed to share: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermissionChange = async (uid, newPerm) => {
    if (newPerm === 'revoke') {
      setUpdatingUser(prev => ({ ...prev, [uid]: 'revoke' }));
      try {
        await fileService.unshareFile(filePath, [uid], 'both');
        showSuccess('Access revoked');
        await fetchSharing();
      } catch (err) {
        showError(err?.response?.data?.message || 'Failed to revoke access');
      } finally { setUpdatingUser(prev => ({ ...prev, [uid]: null })); }
      return;
    }
    const currentStatus = getUserShareStatus(uid);
    if (newPerm === currentStatus) return;
    setUpdatingUser(prev => ({ ...prev, [uid]: newPerm }));
    try {
      if (newPerm === 'write') {
        await fileService.shareFile(filePath, [uid], 'write');
        showSuccess('Permission upgraded to Read & Write');
      } else {
        await fileService.unshareFile(filePath, [uid], 'write');
        showSuccess('Permission downgraded to Read Only');
      }
      await fetchSharing();
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to update permission');
    } finally { setUpdatingUser(prev => ({ ...prev, [uid]: null })); }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'pending_sent': return 'Request Sent';
      case 'pending_received': return 'Pending';
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <Container layout="flex-column" gap="sm" padding="md" align="center">
        <CircularProgress size="sm" />
        <Typography size="xs">Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container layout="flex-column" gap="sm" padding="md" style={{ minWidth: '320px' }}>
      <Container layout="flex" gap="xs">
        <Button size="sm" variant={tab === 'share' ? 'primary' : 'ghost'} onClick={() => setTab('share')}>
          <Icon name="FiShare2" size="xs" /> Share
        </Button>
        <Button size="sm" variant={tab === 'find' ? 'primary' : 'ghost'} onClick={() => setTab('find')}>
          <Icon name="FiUserPlus" size="xs" /> Find &amp; Connect
        </Button>
      </Container>

      {tab === 'share' && (
        <>
          {allUsers.length === 0 ? (
            <Container layout="flex-column" align="center" gap="sm" padding="md">
              <Icon name="FiUsers" size="md" color="secondary" />
              <Typography size="xs" color="secondary">
                No connections yet. Use "Find &amp; Connect" to add users.
              </Typography>
            </Container>
          ) : (
            <>
              <Input
                placeholder="Filter connections..."
                value={connectionFilter}
                onChange={(e) => setConnectionFilter(typeof e === 'string' ? e : e?.target?.value ?? '')}
                size="sm" icon="FiSearch" width="100%"
              />
              <Container layout="flex-column" gap="2px" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {filteredConnections.map(u => {
                  const uid = u.id || u._id;
                  const shareStatus = getUserShareStatus(uid);
                  const isSelected = selectedUsers.includes(uid);
                  const isUpdating = !!updatingUser[uid];
                  return (
                    <Container
                      key={uid} layout="flex" align="center" gap="xs" padding="xs"
                      onClick={shareStatus ? undefined : () => {
                        setSelectedUsers(prev => isSelected ? prev.filter(id => id !== uid) : [...prev, uid]);
                      }}
                      style={{ cursor: shareStatus ? 'default' : 'pointer', borderRadius: '4px', backgroundColor: isSelected ? 'var(--bg-secondary, rgba(255,255,255,0.05))' : 'transparent' }}
                    >
                      {!shareStatus && <Icon name={isSelected ? 'FiCheckSquare' : 'FiSquare'} size="xs" color={isSelected ? 'primary' : 'secondary'} />}
                      {shareStatus && <Icon name="FiCheckCircle" size="xs" color="success" />}
                      <Typography size="xs" weight="medium" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.username || u.email}
                      </Typography>
                      {shareStatus && (
                        isUpdating ? <CircularProgress size="xs" /> : (
                          <Container layout="flex" gap="2px">
                            {shareStatus === 'read' && (
                              <Button size="xs" variant="ghost" title="Upgrade to Read & Write"
                                onClick={(e) => { e.stopPropagation(); handlePermissionChange(uid, 'write'); }}>
                                <Icon name="FiArrowUp" size="xs" />
                              </Button>
                            )}
                            {shareStatus === 'write' && (
                              <Button size="xs" variant="ghost" title="Downgrade to Read Only"
                                onClick={(e) => { e.stopPropagation(); handlePermissionChange(uid, 'read'); }}>
                                <Icon name="FiArrowDown" size="xs" />
                              </Button>
                            )}
                            <Button size="xs" variant="ghost" color="danger" title="Revoke access"
                              onClick={(e) => { e.stopPropagation(); handlePermissionChange(uid, 'revoke'); }}>
                              <Icon name="FiX" size="xs" />
                            </Button>
                          </Container>
                        )
                      )}
                    </Container>
                  );
                })}
                {filteredConnections.length === 0 && connectionFilter.trim() && (
                  <Typography size="xs" color="secondary" style={{ padding: '8px', textAlign: 'center' }}>No matching connections</Typography>
                )}
              </Container>
              <Container layout="flex" gap="xs" align="center">
                <Select
                  value={permission} onChange={setPermission}
                  options={[{ value: 'read', label: 'Read Only' }, { value: 'write', label: 'Read & Write' }]}
                  size="sm" style={{ flex: 1 }}
                />
                <Button size="sm" variant="primary" onClick={handleSubmit} disabled={selectedUsers.length === 0 || isSubmitting}>
                  {isSubmitting ? 'Sharing...' : `Share (${selectedUsers.length})`}
                </Button>
                {onCancel && (
                  <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                  </Button>
                )}
              </Container>
            </>
          )}
        </>
      )}

      {tab === 'find' && (
        <Container layout="flex-column" gap="sm" width="100%">
          <Input
            placeholder="Search users by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(typeof e === 'string' ? e : e?.target?.value ?? '')}
            size="sm" icon="FiSearch" width="100%"
          />
          {isSearching && (
            <Container layout="flex" align="center" gap="sm" padding="sm">
              <CircularProgress size="sm" />
              <Typography size="xs" color="secondary">Searching...</Typography>
            </Container>
          )}
          {!isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
            <Typography size="xs" color="secondary" style={{ textAlign: 'center', padding: '12px' }}>No users found</Typography>
          )}
          {searchResults.map(u => {
            const uid = u._id || u.id;
            const status = connectionStatuses[uid];
            const label = getStatusLabel(status);
            const isSending = sendingRequest[uid];
            return (
              <Card key={uid} padding="sm">
                <Container layout="flex" align="center" gap="sm">
                  <Icon name="FiUser" size="sm" />
                  <Container layout="flex-column" gap="xs" flexFill>
                    <Typography size="sm" weight="medium">{u.username || u.email}</Typography>
                    {u.firstName && <Typography size="xs" color="secondary">{u.firstName} {u.lastName || ''}</Typography>}
                  </Container>
                  {label ? (
                    <Badge size="sm" color={status === 'connected' ? 'success' : 'secondary'}>{label}</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => handleSendRequest(uid)} disabled={isSending}>
                      {isSending ? <CircularProgress size="xs" /> : <><Icon name="FiUserPlus" size="xs" /> Connect</>}
                    </Button>
                  )}
                </Container>
              </Card>
            );
          })}
        </Container>
      )}
    </Container>
  );
};

const buildDirTree = (tree, parentPath = '', writableOnly = false) => {
  const out = {};
  Object.entries(tree || {}).forEach(([key, node]) => {
    if (node.type !== 'directory') return;
    const filePath = fileService.normalizePath(node.filePath ?? (parentPath ? `${parentPath}/${key}` : `/${key}`));
    const readOnly = writableOnly && !node.writable;
    out[filePath] = {
      ...node, filePath, fileName: node.fileName || key,
      icon: readOnly ? 'FiLock' : 'FiFolder',
      disabled: readOnly,
      children: buildDirTree(node.children || {}, filePath, writableOnly),
    };
  });
  return out;
};

const buildFullTree = (tree, parentPath = '') => {
  const out = {};
  Object.entries(tree || {}).forEach(([key, node]) => {
    const filePath = fileService.normalizePath(node.filePath ?? (parentPath ? `${parentPath}/${key}` : `/${key}`));
    out[filePath] = { ...node, filePath, fileName: node.fileName || key, children: buildFullTree(node.children || {}, filePath) };
  });
  return out;
};

const flattenNodes = (tree, acc = {}) => {
  Object.values(tree).forEach(node => { acc[node.filePath] = node; if (node.children) flattenNodes(node.children, acc); });
  return acc;
};

export const DirectoryPicker = ({ fileTree, writableOnly, selectedPath, onSelect }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set([selectedPath, '/']));
  const dirTree = useMemo(() => buildDirTree(fileTree || {}, '', writableOnly), [fileTree, writableOnly]);
  return (
    <TreeView
      data={dirTree}
      onNodeSelect={(id, isSelected) => isSelected && onSelect(fileService.normalizePath(id))}
      selectedNodes={[selectedPath]}
      expandedNodes={Array.from(expandedNodes)}
      onNodeExpand={(id, expanded) => setExpandedNodes(prev => { const s = new Set(prev); expanded ? s.add(id) : s.delete(id); return s; })}
      showIcons size="sm" searchable searchPlaceholder="Filter directories..." width="100%"
    />
  );
};

const FileBrowser = ({ fileTree, currentPath, onPathSelect, getNodeGenie }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set([currentPath, '/']));
  const tree = useMemo(() => buildFullTree(fileTree || {}), [fileTree]);
  const nodeMap = useMemo(() => flattenNodes(tree), [tree]);
  return (
    <TreeView
      data={tree}
      onNodeSelect={(id, isSelected) => {
        if (isSelected) onPathSelect(id, nodeMap[fileService.normalizePath(id)] ?? null);
      }}
      selectedNodes={[currentPath]}
      expandedNodes={Array.from(expandedNodes)}
      onNodeExpand={(id, expanded) => setExpandedNodes(prev => { const s = new Set(prev); expanded ? s.add(id) : s.delete(id); return s; })}
      getNodeGenie={getNodeGenie}
      showIcons size="sm" searchable searchPlaceholder="Filter files..." width="100%"
    />
  );
};

export const CreateItemForm = ({ type, targetPath: initialPath, fileTree, onSuccess, onCancel }) => {
  const isDir = type === 'directory';
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');
  const [targetPath, setTargetPath] = useState(initialPath || '/');
  const [validationErrors, setValidationErrors] = useState({});
  const { error: showError, success: showSuccess } = useNotification();

  const handleValidation = (validation, inputName) => {
    setValidationErrors(prev => ({
      ...prev,
      [inputName]: validation.isValid ? null : validation.message
    }));
  };

  const fullPath = useMemo(() => {
    if (!name.trim()) return '';
    return `${targetPath || '/'}/${name}`.replace(/\/+/g, '/');
  }, [targetPath, name]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showError(`${isDir ? 'Directory' : 'File'} name is required`);
      return;
    }
    if (Object.values(validationErrors).some(e => e !== null)) {
      showError('Please fix validation errors before submitting');
      return;
    }
    try {
      if (isDir) {
        await fileService.createDirectory(fullPath, description || 'Directory created via FilesPage');
        showSuccess(`Directory created: ${name}`);
        onSuccess?.(fullPath, 'directory');
      } else {
        await fileService.createFile(fullPath, content, description || 'File created via FilesPage');
        showSuccess(`File created: ${name}`);
        onSuccess?.(fullPath, 'file');
      }
    } catch (err) {
      showError(`Failed to create ${isDir ? 'directory' : 'file'}: ${err.message}`);
    }
  };

  return (
    <Container layout="flex-column" padding="none" width="400px">
      <Input
        label={isDir ? 'Directory Name *' : 'File Name *'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isDir ? 'new-folder' : 'Enter file name'}
        required
        minLength={1}
        onValidation={handleValidation}
        width="100%"
      />

      <Container layout="flex-column" gap="small" padding="none" width="100%">
        <Typography variant="label">Target Directory</Typography>
        <DirectoryPicker
          fileTree={fileTree}
          writableOnly
          selectedPath={targetPath || '/'}
          onSelect={(path) => setTargetPath(path || '/')}
        />
      </Container>

      {!isDir && (
        <Input
          label="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter file content (optional)"
          multiline
          width="100%"
        />
      )}

      <Input
        label="Description"
        placeholder={isDir ? 'Folder description' : 'Enter description (optional)'}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={200}
        onValidation={handleValidation}
        width="100%"
      />

      <Container layout="flex" gap="sm" justify="end" width="100%">
        <Button color="secondary" onClick={onCancel} width="80px">
          Cancel
        </Button>
        <Button
          color="primary"
          onClick={handleSubmit}
          disabled={!name.trim()}
          width={isDir ? '140px' : '120px'}
        >
          {isDir ? 'Create Directory' : 'Create File'}
        </Button>
      </Container>

      <Typography size="xs" color="success" margin="none" padding="none">
        Destination: {fullPath}
      </Typography>
    </Container>
  );
};

export const UploadForm = ({ targetPath: initialPath, fileTree, onSuccess, onCancel }) => {
  const [files, setFiles] = useState([]);
  const [destinationPath, setDestinationPath] = useState(initialPath || '/');
  const [overwrite, setOverwrite] = useState(false);
  const [uploadFolder, setUploadFolder] = useState(false);
  const [extractZips, setExtractZips] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { error: showError, success: showSuccess } = useNotification();
  const fileInputRef = useRef(null);

  const hasZipFiles = files.some(f => f.name?.toLowerCase().endsWith('.zip'));

  const handleSubmit = async () => {
    if (files.length === 0) {
      showError('Please select files to upload');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const safePath = destinationPath || '/';
      const response = await fileService.uploadFiles(
        files, 
        safePath, 
        (progress) => {
          setUploadProgress(progress);
        },
        overwrite
      );
      const uploadedFiles = response.files || [];
      const uploadedPaths = uploadedFiles.map(file => file.filePath);
      
      // Extract zip files if option is enabled
      if (extractZips && hasZipFiles) {
        const zipFiles = uploadedFiles.filter(f => f.filePath?.toLowerCase().endsWith('.zip'));
        let extractedCount = 0;
        for (const zipFile of zipFiles) {
          try {
            const result = await fileService.extractZip(zipFile.filePath, safePath);
            extractedCount += result.extracted?.length || 0;
          } catch (err) {
            showError(`Failed to extract ${zipFile.fileName || 'zip'}: ${err.message}`);
          }
        }
        if (extractedCount > 0) {
          showSuccess(`Uploaded ${uploadedPaths.length} file(s) and extracted ${extractedCount} item(s)`);
        } else {
          showSuccess(`Successfully uploaded ${uploadedPaths.length} file(s)`);
        }
      } else {
        showSuccess(`Successfully uploaded ${uploadedPaths.length} file(s)`);
      }
      onSuccess?.(uploadedPaths[0], 'file');
    } catch (err) {
      showError(`Failed to upload files: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Reset file input when toggling folder mode
  const handleFolderToggle = (e) => {
    setUploadFolder(e.target.checked);
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Container layout="flex-column" padding="none" width="100%">
      <Typography variant="label">{uploadFolder ? 'Select Folder *' : 'Select Files *'}</Typography>
      <Input
        key={uploadFolder ? 'folder' : 'file'}
        ref={fileInputRef}
        type="file"
        multiple={!uploadFolder}
        webkitdirectory={uploadFolder ? '' : undefined}
        directory={uploadFolder ? '' : undefined}
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        disabled={isUploading}
        width="100%"
      />
      
      {files.length > 0 && (
        <Typography size="xs">
          Selected: {files.length} file(s){uploadFolder && files[0]?.webkitRelativePath ? ` from ${files[0].webkitRelativePath.split('/')[0]}` : ''}
        </Typography>
      )}

      <Container layout="flex" align="center" padding="none" gap="xs">
        <Switch
          checked={uploadFolder}
          onChange={handleFolderToggle}
          disabled={isUploading}
        />
        <Typography size="sm">Upload folder</Typography>
      </Container>

      <Container layout="flex-column" gap="small" padding="none" width="100%">
        <Typography variant="label">Upload Destination</Typography>
        <DirectoryPicker
          fileTree={fileTree}
          writableOnly
          selectedPath={destinationPath}
          onSelect={(path) => setDestinationPath(path || '/')}
        />
      </Container>
      
      <Container layout="flex" align="center" padding="none" gap="xs">
        <Switch
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          disabled={isUploading}
        />
        <Typography size="sm">Overwrite existing files</Typography>
      </Container>

      {hasZipFiles && (
        <Container layout="flex" align="center" padding="none" gap="xs">
          <Switch
            checked={extractZips}
            onChange={(e) => setExtractZips(e.target.checked)}
            disabled={isUploading}
          />
          <Typography size="sm">Extract zip files after upload</Typography>
        </Container>
      )}

      {isUploading && (
        <Container layout="flex-column" gap="xs" width="100%">
          <Typography size="sm">Uploading... {Math.round(uploadProgress)}%</Typography>
          <ProgressBar
            value={uploadProgress}
            max={100}
            color="primary"
            showPercentage={false}
            animated={true}
          />
        </Container>
      )}
      
      <Container layout="flex" gap="sm" justify="end" width="100%">
        <Button 
          color="secondary" 
          onClick={onCancel}
          disabled={isUploading}
          width="80px"
        >
          Cancel
        </Button>
        <Button
          color="primary"
          onClick={handleSubmit}
          disabled={files.length === 0 || isUploading}
          width="120px"
        >
          {isUploading ? <CircularProgress size="sm" /> : `Upload ${files.length} Files`}
        </Button>
      </Container>

      <Typography size="xs" color="success" margin="none" padding="none">
        Destination: {destinationPath}
      </Typography>
    </Container>
  );
};

const VersionManagement = ({ file, onSuccess }) => {
  const [activeAction, setActiveAction] = useState(null);
  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { success: showSuccess, error: showError } = useNotification();

  useEffect(() => {
    if (file?.filePath) {
      loadVersions();
    }
  }, [file?.filePath]);

  const loadVersions = async () => {
    if (!file?.filePath) return;
    
    setIsLoading(true);
    try {
      const response = await fileService.getFileVersions(file.filePath);
      setVersions(response.versions || []);
    } catch (error) {
      showError(`Failed to load versions: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveVersion = async (message) => {
    if (!file?.filePath) return;
    
    try {
      await fileService.saveFileVersion(file.filePath, message);
      showSuccess('Version saved successfully');
      await loadVersions();
      setActiveAction(null);
      onSuccess({ refreshVersionData: true });
    } catch (error) {
      showError(`Failed to save version: ${error.message}`);
    }
  };

  const handleLoadVersion = async (versionNumber) => {
    if (!file?.filePath) return;
    
    try {
      const response = await fileService.loadFileVersion(file.filePath, versionNumber);
      showSuccess(`Version ${versionNumber} loaded (read-only)`);
      
      setActiveAction(null);
      
      onSuccess({
        content: response.content,
        versionNumber: response.versionNumber,
        versionMessage: response.versionMessage
      });
    } catch (error) {
      showError(`Failed to load version: ${error.message}`);
    }
  };

  const handleDeleteVersion = async (versionNumber) => {
    if (!file?.filePath) return;
    
    try {
      await fileService.deleteFileVersion(file.filePath, versionNumber);
      showSuccess(`Version ${versionNumber} deleted successfully`);
      await loadVersions();
      onSuccess({ refreshVersionData: true });
    } catch (error) {
      showError(`Failed to delete version: ${error.message}`);
    }
  };

  if (activeAction === 'saveVersion') {
    return <SaveVersionForm onSave={handleSaveVersion} onCancel={() => setActiveAction(null)} />;
  }

  return (
    <Container layout="flex-column" gap="sm" padding="md" width="400px">
      <Typography variant="h6" size="sm" weight="semibold">
        🔄 Version Management
      </Typography>
      <Typography size="xs">
        File: {file?.name || 'Unknown'}
      </Typography>

      <Button
        color="primary"
        size="sm"
        onClick={() => setActiveAction('saveVersion')}
        width="100%"
        disabled={file?.type !== 'text'}
      >
        <Icon name="FiSave" size="sm" />
        Save Version
      </Button>

      <Container layout="flex-column" gap="xs" width="100%">
        <Typography variant="label" size="xs">Version History ({versions.length})</Typography>
        
        {isLoading ? (
          <Container layout="flex" align="center" justify="center" padding="md">
            <CircularProgress size="sm" />
          </Container>
        ) : versions.length === 0 ? (
          <Typography size="xs" padding="sm">
            No versions saved yet
          </Typography>
        ) : (
          <Container layout="flex-column" gap="xs">
            {versions.map((version) => (
              <Card key={version.version} padding="xs" backgroundColor="surface">
                <Container layout="flex" align="center" justify="between" width="100%">
                  <Container layout="flex-column" gap="xs">
                    <Typography size="xs" weight="semibold">
                      Version {version.version}
                    </Typography>
                    <Typography size="xs">
                      {version.message || 'No message'}
                    </Typography>
                    <Typography size="xs">
                      {new Date(version.timestamp).toLocaleString()}
                    </Typography>
                  </Container>
                  <Container layout="flex" gap="xs">
                    <Button
                      color="secondary"
                      size="sm"
                      onClick={() => handleLoadVersion(version.version)}
                      title="View this version (read-only)"
                    >
                      <Icon name="FiEye" size="xs" />
                    </Button>
                    <Button
                      color="error"
                      size="sm"
                      onClick={() => handleDeleteVersion(version.version)}
                    >
                      <Icon name="FiTrash2" size="xs" />
                    </Button>
                  </Container>
                </Container>
              </Card>
            ))}
          </Container>
        )}
      </Container>
    </Container>
  );
};

const SaveVersionForm = ({ onSave, onCancel }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    onSave(message.trim() || 'Version saved');
  };

  return (
    <Container layout="flex-column" gap="sm" padding="md" width="350px">
      <Typography variant="h6" size="sm" weight="semibold">
        🔖 Save Version
      </Typography>
      
      <Input
        label="Version Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe this version..."
        multiline
        rows={3}
        width="100%"
      />

      <Container layout="flex" gap="sm" justify="end" width="100%">
        <Button color="secondary" onClick={onCancel} width="80px">
          Cancel
        </Button>
        <Button color="primary" onClick={handleSubmit} width="120px">
          Save Version
        </Button>
      </Container>
    </Container>
  );
};

// ─── File Node Action Forms ──────────────────────────────────────────────────

const NodeActionBack = ({ onBack, title }) => (
  <Container layout="flex" align="center" gap="xs" padding="none">
    <Button size="xs" variant="ghost" onClick={onBack} style={{ minWidth: 0, padding: '2px 4px' }}>
      <Icon name="FiArrowLeft" size="xs" />
    </Button>
    <Typography size="sm" weight="semibold">{title}</Typography>
  </Container>
);

const RenameItemForm = ({ node, onSuccess, onBack }) => {
  const nodeName = node.fileName || node.label || node.filePath?.split('/').pop() || 'item';
  const [name, setName] = useState(nodeName);
  return (
    <Container layout="flex-column" padding="sm" gap="sm" width="280px">
      <NodeActionBack onBack={onBack} title="Rename" />
      <Typography size="xs" color="secondary">{node.filePath}</Typography>
      <Input
        label="New name"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={nodeName}
        width="100%"
        autoFocus
      />
      <Container layout="flex" gap="sm" justify="end" padding="none">
        <Button color="secondary" size="sm" onClick={onBack}>Cancel</Button>
        <Button
          color="primary" size="sm"
          disabled={!name.trim() || name.trim() === nodeName}
          onClick={() => onSuccess(name.trim())}
        >Rename</Button>
      </Container>
    </Container>
  );
};

const MoveOrCopyForm = ({ node, fileTree, label, onSuccess, onBack }) => {
  const nodeName = node.fileName || node.label || node.filePath?.split('/').pop() || 'item';
  const parentPath = fileService.getParentPath(node.filePath) || '/';
  const [destDir, setDestDir] = useState(parentPath);
  const destFull = `${destDir}/${nodeName}`.replace(/\/+/g, '/');
  return (
    <Container layout="flex-column" padding="sm" gap="sm" width="320px">
      <NodeActionBack onBack={onBack} title={`${label} "${nodeName}"`} />
      <Typography size="xs" color="secondary">Select destination folder:</Typography>
      <DirectoryPicker fileTree={fileTree} writableOnly selectedPath={destDir} onSelect={path => setDestDir(path || '/')} />
      <Typography size="xs">→ {destFull}</Typography>
      <Container layout="flex" gap="sm" justify="end" padding="none">
        <Button color="secondary" size="sm" onClick={onBack}>Cancel</Button>
        <Button
          color="primary" size="sm"
          disabled={label === 'Move' && destDir === parentPath}
          onClick={() => onSuccess(destDir)}
        >{label}</Button>
      </Container>
    </Container>
  );
};

const DeleteConfirmForm = ({ node, onConfirm, onBack }) => {
  const isDir = node.type === 'directory';
  const nodeName = node.fileName || node.label || node.filePath?.split('/').pop() || 'item';
  return (
    <Container layout="flex-column" padding="sm" gap="sm" width="280px">
      <NodeActionBack onBack={onBack} title="Delete" />
      <Typography size="sm">
        Delete {isDir ? 'folder' : 'file'} <strong>&ldquo;{nodeName}&rdquo;</strong>?
        {isDir && ' All contents inside will be deleted.'}
      </Typography>
      <Typography size="xs" color="error">This action cannot be undone.</Typography>
      <Container layout="flex" gap="sm" justify="end" padding="none">
        <Button color="secondary" size="sm" onClick={onBack}>Cancel</Button>
        <Button color="error" size="sm" onClick={onConfirm}>Delete</Button>
      </Container>
    </Container>
  );
};

const FileNodeActions = ({ node: rawNode, fileTree, onRefresh, onNavigate }) => {
  // TreeView converts data into its own internal shape ({ id, label, metadata }).
  // Normalise back to the raw node ({ filePath, fileName, type }) at this single
  // entry point so every sub-form and handler below receives the correct shape.
  const node = rawNode?.metadata?.originalData ?? {
    filePath: rawNode?.filePath ?? rawNode?.id,
    fileName: rawNode?.fileName ?? rawNode?.label,
    type: rawNode?.type ?? rawNode?.metadata?.type,
  };

  const [view, setView] = useState('menu');
  const { success: showSuccess, error: showError } = useNotification();
  const isDir = node.type === 'directory';
  const nodeName = node.fileName || node.filePath?.split('/').pop() || 'item';
  const ext = nodeName.split('.').pop().toLowerCase();
  const isZip = !isDir && ext === 'zip';
  const isTextFile = !isDir && [
    'md', 'mdx', 'txt', 'js', 'jsx', 'mjs', 'cjs',
    'ts', 'tsx', 'mts', 'cts',
    'json', 'jsonc', 'html', 'htm', 'css', 'scss', 'less',
    'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
    'py', 'rb', 'go', 'java', 'rs', 'cpp', 'cc', 'c', 'h',
    'sh', 'bash', 'zsh', 'ps1', 'sql', 'graphql', 'gql', 'hbs', 'svelte', 'vue',
  ].includes(ext);

  const doRefresh = useCallback(() => onRefresh?.(), [onRefresh]);

  const handleDownload = useCallback(async () => {
    try {
      const blob = await fileService.downloadFile(node.filePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = nodeName; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { showError(`Download failed: ${err.message}`); }
  }, [node, showError]);

  const handleExtract = useCallback(async () => {
    try {
      const parentPath = fileService.getParentPath(node.filePath) || '/';
      const result = await fileService.extractZip(node.filePath, parentPath);
      showSuccess(`Extracted ${result.extracted?.length ?? 0} item(s)`);
      doRefresh();
    } catch (err) { showError(`Extract failed: ${err.message}`); }
  }, [node, doRefresh, showSuccess, showError]);

  if (view === 'rename') {
    return (
      <RenameItemForm
        node={node}
        onBack={() => setView('menu')}
        onSuccess={async (newName) => {
          try {
            await fileService.renameFile(node.filePath, newName);
            showSuccess(`Renamed to "${newName}"`);
            doRefresh();
          } catch (err) { showError(`Rename failed: ${err.message}`); }
        }}
      />
    );
  }

  if (view === 'move') {
    return (
      <MoveOrCopyForm
        node={node} fileTree={fileTree} label="Move"
        onBack={() => setView('menu')}
        onSuccess={async (destDir) => {
          const destPath = `${destDir}/${nodeName}`.replace(/\/+/g, '/');
          try {
            await fileService.moveFile(node.filePath, destPath);
            showSuccess(`Moved to "${destDir}"`);
            doRefresh();
          } catch (err) { showError(`Move failed: ${err.message}`); }
        }}
      />
    );
  }

  if (view === 'copy') {
    return (
      <MoveOrCopyForm
        node={node} fileTree={fileTree} label="Copy"
        onBack={() => setView('menu')}
        onSuccess={async (destDir) => {
          const destPath = `${destDir}/${nodeName}`.replace(/\/+/g, '/');
          try {
            await fileService.copyFile(node.filePath, destPath);
            showSuccess(`Copied to "${destDir}"`);
            doRefresh();
          } catch (err) { showError(`Copy failed: ${err.message}`); }
        }}
      />
    );
  }

  if (view === 'delete') {
    return (
      <DeleteConfirmForm
        node={node}
        onBack={() => setView('menu')}
        onConfirm={async () => {
          try {
            await fileService.deleteFile(node.filePath);
            showSuccess(`Deleted "${nodeName}"`);
            doRefresh();
          } catch (err) { showError(`Delete failed: ${err.message}`); }
        }}
      />
    );
  }

  if (view === 'create-file') {
    return (
      <CreateItemForm type="file" targetPath={node.filePath} fileTree={fileTree}
        onSuccess={() => { doRefresh(); setView('menu'); }}
        onCancel={() => setView('menu')}
      />
    );
  }

  if (view === 'create-dir') {
    return (
      <CreateItemForm type="directory" targetPath={node.filePath} fileTree={fileTree}
        onSuccess={() => { doRefresh(); setView('menu'); }}
        onCancel={() => setView('menu')}
      />
    );
  }

  if (view === 'share') {
    return (
      <ShareForm
        filePath={node.filePath}
        isDirectory={isDir}
        onSuccess={() => { doRefresh(); setView('menu'); }}
        onCancel={() => setView('menu')}
      />
    );
  }

  if (view === 'upload') {
    return (
      <UploadForm targetPath={node.filePath} fileTree={fileTree}
        onSuccess={() => { doRefresh(); setView('menu'); }}
        onCancel={() => setView('menu')}
      />
    );
  }

  const sep = <div style={{ height: '1px', background: 'var(--border-color)', margin: '2px 0' }} />;

  return (
    <Container layout="flex-column" gap="none" padding="xs" width="220px">
      <Container layout="flex" align="center" gap="xs" padding="xs">
        <Icon name={isDir ? 'FiFolder' : 'FiFile'} size="xs" color="secondary" />
        <Typography size="xs" weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nodeName}
        </Typography>
      </Container>
      {sep}
      <Button size="sm" variant="ghost" width="100%" onClick={() => onNavigate(node.filePath, node)}>
        <Icon name={isDir ? 'FiArrowRight' : 'FiExternalLink'} size="xs" />
        {isDir ? 'Open Folder' : 'Open File'}
      </Button>
      <Button size="sm" variant="ghost" width="100%" onClick={() => setView('rename')}>
        <Icon name="FiEdit" size="xs" />
        Rename
      </Button>
      <Button size="sm" variant="ghost" width="100%" onClick={() => setView('move')}>
        <Icon name="FiMove" size="xs" />
        Move
      </Button>
      <Button size="sm" variant="ghost" width="100%" onClick={() => setView('copy')}>
        <Icon name="FiCopy" size="xs" />
        Copy
      </Button>
      {!isDir && (
        <Button size="sm" variant="ghost" width="100%" onClick={handleDownload}>
          <Icon name="FiDownload" size="xs" />
          Download
        </Button>
      )}
      {isZip && (
        <Button size="sm" variant="ghost" width="100%" onClick={handleExtract}>
          <Icon name="FiArchive" size="xs" />
          Extract Here
        </Button>
      )}
      <Button size="sm" variant="ghost" width="100%" onClick={() => setView('share')}>
        <Icon name="FiShare2" size="xs" />
        Share
      </Button>
      {isTextFile && (
        <Button
          size="sm" variant="ghost" width="100%"
          genie={{ trigger: 'click', content: () => (
            <VersionManagement
              file={{ filePath: node.filePath, name: nodeName, type: 'text' }}
              onSuccess={doRefresh}
            />
          )}}
        >
          <Icon name="FiGitBranch" size="xs" />
          Versions
        </Button>
      )}
      {isDir && (
        <>
          {sep}
          <Button size="sm" variant="ghost" width="100%" onClick={() => setView('create-file')}>
            <Icon name="FiFilePlus" size="xs" />
            New File Here
          </Button>
          <Button size="sm" variant="ghost" width="100%" onClick={() => setView('create-dir')}>
            <Icon name="FiFolderPlus" size="xs" />
            New Folder Here
          </Button>
          <Button size="sm" variant="ghost" width="100%" onClick={() => setView('upload')}>
            <Icon name="FiUpload" size="xs" />
            Upload Here
          </Button>
        </>
      )}
      {sep}
      <Button size="sm" variant="ghost" width="100%" color="error" onClick={() => setView('delete')}>
        <Icon name="FiTrash2" size="xs" />
        Delete
      </Button>
    </Container>
  );
};

export const QuickActions = ({ targetPath, fileTree, onActionComplete }) => {
  const [activeAction, setActiveAction] = useState(null);

  const handleClose = useCallback(() => {
    setActiveAction(null);
  }, []);

  const handleSuccess = useCallback((path, type) => {
    onActionComplete?.(path, type);
  }, [onActionComplete]);

  if (!activeAction) {
    return (
      <Container layout="flex-column" gap="sm" width="280px" padding="lg">
        <Typography as="h6" weight="semibold">
          Quick Actions
        </Typography>
        <Typography size="sm">
          Choose an action for: {targetPath || '/'}
        </Typography>
        
        <Button 
          color="primary"
          onClick={() => setActiveAction('create-file')}
          width="100%"
        >
          <Icon name="FiFilePlus" size="sm" />
          Create File
        </Button>
        
        <Button 
          onClick={() => setActiveAction('create-directory')}
          width="100%"
        >
          <Icon name="FiFolderPlus" size="sm" />
          Create Directory
        </Button>
        
        <Button 
          onClick={() => setActiveAction('upload')}
          width="100%"
        >
          <Icon name="FiUpload" size="sm" />
          Upload Files
        </Button>
      </Container>
    );
  }

  const actionProps = {
    targetPath: targetPath,
    fileTree,
    onSuccess: handleSuccess,
    onCancel: handleClose
  };

  switch (activeAction) {
    case 'create-file':
      return <CreateItemForm type="file" {...actionProps} />;
    case 'create-directory':
      return <CreateItemForm type="directory" {...actionProps} />;
    case 'upload':
      return <UploadForm {...actionProps} />;
    default:
      return null;
  }
};

// ─── Comment Panel (Genie Content) ───────────────────────────────────────────

const CommentPanel = ({ file }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { success: showSuccess, error: showError } = useNotification();

  const loadComments = useCallback(async () => {
    if (!file?._id) return;
    setIsLoading(true);
    try {
      const res = await fileService.getFileComments(file._id);
      const topLevel = res.data || [];

      // Server returns top-level comments with replyCount but no replies array.
      // Fetch actual replies for any comment that has them.
      const withReplies = await Promise.all(
        topLevel.map(async (comment) => {
          if (comment.replyCount > 0) {
            try {
              const replyRes = await fileService.getReplies(comment._id);
              return { ...comment, replies: replyRes.data || [] };
            } catch {
              return { ...comment, replies: [] };
            }
          }
          return { ...comment, replies: [] };
        })
      );

      setComments(withReplies);
    } catch (err) {
      showError(`Failed to load comments: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [file?._id, showError]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async () => {
    const text = newComment.trim();
    if (!text) return;
    setIsSubmitting(true);
    try {
      await fileService.createComment(file._id, text);
      setNewComment('');
      showSuccess('Comment added');
      await loadComments();
    } catch (err) {
      showError(`Failed to add comment: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId) => {
    const text = replyText.trim();
    if (!text) return;
    setIsSubmitting(true);
    try {
      await fileService.createComment(file._id, text, parentId);
      setReplyingTo(null);
      setReplyText('');
      showSuccess('Reply added');
      await loadComments();
    } catch (err) {
      showError(`Failed to add reply: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (commentId) => {
    const text = editText.trim();
    if (!text) return;
    try {
      await fileService.updateComment(commentId, text);
      setEditingId(null);
      setEditText('');
      showSuccess('Comment updated');
      await loadComments();
    } catch (err) {
      showError(`Failed to update comment: ${err.message}`);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await fileService.deleteComment(commentId);
      showSuccess('Comment deleted');
      await loadComments();
    } catch (err) {
      showError(`Failed to delete comment: ${err.message}`);
    }
  };

  const renderComment = (comment, depth = 0) => {
    const isOwn = comment.author?._id === user?._id || comment.author?.username === user?.username;

    return (
      <Container key={comment._id} layout="flex-column" gap="xs" width="100%" padding="none" wrap={false} style={depth > 0 ? { paddingLeft: '16px' } : undefined}>
        <Typography size="xs" weight="semibold" color="secondary">
          {comment.author?.username || 'Unknown'}
        </Typography>

        {editingId === comment._id ? (
          <Container layout="flex-column" gap="xs" width="100%" padding="none" wrap={false}>
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Edit comment..."
              multiline
              rows={2}
              width="100%"
            />
            <Container layout="flex" gap="xs" width="100%" padding="none">
              <Button size="sm" color="primary" onClick={() => handleUpdate(comment._id)}>Save</Button>
              <Button size="sm" color="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
            </Container>
          </Container>
        ) : (
          <Typography size="xs" style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</Typography>
        )}

        <Container layout="flex" gap="sm" align="center" width="100%" padding="none">
          <Typography size="xxs" color="secondary">
            {new Date(comment.createdAt).toLocaleString()}
          </Typography>
          <Button size="sm" variant="ghost" onClick={() => {
            setReplyingTo(replyingTo === comment._id ? null : comment._id);
            setReplyText('');
          }}>
            <Icon name="FiCornerDownRight" size="xs" />
            Reply
          </Button>
          {isOwn && editingId !== comment._id && (
            <>
              <Button size="sm" variant="ghost" onClick={() => {
                setEditingId(comment._id);
                setEditText(comment.body);
              }}>
                <Icon name="FiEdit2" size="xs" />
              </Button>
              <Button size="sm" variant="ghost" color="error" onClick={() => handleDelete(comment._id)}>
                <Icon name="FiTrash2" size="xs" />
              </Button>
            </>
          )}
        </Container>

        {replyingTo === comment._id && (
          <Container layout="flex-column" gap="xs" width="100%" padding="none" wrap={false} style={{ paddingLeft: '16px' }}>
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              multiline
              rows={2}
              width="100%"
            />
            <Container layout="flex" gap="xs" width="100%" padding="none">
              <Button size="sm" color="primary" onClick={() => handleReply(comment._id)} disabled={isSubmitting}>Reply</Button>
              <Button size="sm" color="secondary" onClick={() => setReplyingTo(null)}>Cancel</Button>
            </Container>
          </Container>
        )}

        {comment.replies?.length > 0 && (
          <Container layout="flex-column" gap="xs" width="100%" padding="none" wrap={false}>
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </Container>
        )}

      </Container>
    );
  };

  return (
    <Container layout="flex-column" gap="sm" padding="md" width="100%" wrap={false}>
      <Container layout="flex-column" gap="xs" width="100%" overflow="auto" maxHeight="340px" wrap={false}>
        {isLoading ? (
          <Container layout="flex" align="center" justify="center" padding="md">
            <CircularProgress size="sm" />
          </Container>
        ) : comments.length === 0 ? (
          <Typography size="xs" color="secondary" padding="sm">
            No comments yet. Be the first to comment!
          </Typography>
        ) : (
          comments.map((comment, index) => (
            <React.Fragment key={comment._id}>
              {renderComment(comment)}
              {index < comments.length - 1 && <Divider margin="xs" />}
            </React.Fragment>
          ))
        )}
      </Container>

      <Container layout="flex" gap="xs" width="100%" padding="none" align="stretch" wrap={false}>
        <Input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          multiline
          rows={2}
          width="100%"
        />
        <Button
          color="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !newComment.trim()}
          height="auto"
        >
          <Icon name="FiSend" size="xs" />
        </Button>
      </Container>
    </Container>
  );
};

// ─── File Metadata Bar ───────────────────────────────────────────────────────

const FileMetadata = ({ file, isReadOnly, onDownload, onVersionLoaded, onSave, isSavingImage }) => {
  const [metadata, setMetadata] = useState(null);
  const [lastModified, setLastModified] = useState(null);
  const { error: showError } = useNotification();

  const loadMetadata = useCallback(async () => {
    if (!file?.filePath) return;
    
    try {
      const requests = [
        fileService.getMetadata(file.filePath),
        file.type === 'text' ? fileService.getFileVersions(file.filePath) : Promise.resolve({ versions: [] }),
        fileService.getFileSharing(file.filePath)
      ];

      const responses = await Promise.allSettled(requests);

      const sharingData = responses[2]?.status === 'fulfilled' ? responses[2].value : {};
      const permissions = sharingData.sharing?.permissions || {};
      const readUsers = permissions.read || [];
      const writeUsers = permissions.write || [];
      const userMap = new Map();
      [...readUsers, ...writeUsers].forEach(user => userMap.set(user._id, user));

      const result = {
        info: responses[0]?.status === 'fulfilled' ? responses[0].value : null,
        versions: responses[1]?.status === 'fulfilled' ? responses[1].value.versions || [] : [],
        collaborators: Array.from(userMap.values())
      };

      setMetadata(result);
      
      if (result.info?.updatedAt) {
        setLastModified(result.info.updatedAt);
      }
    } catch (error) {
      showError(`Failed to load file metadata: ${error.message}`);
    }
  }, [file?.filePath, showError]);

  useEffect(() => {
    if (file?.filePath) {
      loadMetadata();
    }
  }, [file?.filePath, loadMetadata]);

  useEffect(() => {
    if (!file?.filePath) return;

    const interval = setInterval(() => {
      loadMetadata();
    }, 59000);

    return () => clearInterval(interval);
  }, [file?.filePath, loadMetadata]);

  if (!file || !metadata) {
    return null;
  }

  const hasVersions = metadata.versions.length > 0;
  const hasCollaborators = metadata.collaborators.length > 0;
  const latestVersion = hasVersions ? metadata.versions[metadata.versions.length - 1] : null;
  const canManageVersions = file?.type === 'text' && !isReadOnly;

  return (
    <Card className="file-metadata-bar" padding="xs" width="100%" backgroundColor="surface" margin="none">
      <Container layout="flex" align="center" justify="between" width="100%" padding="none">
        <Container layout="flex" align="center" gap="sm" padding="none">
          {file.type === 'text' && latestVersion && (
            <Container layout="flex" align="center" gap="xs">
              <Icon name="FiGitBranch" size="xs" />
              <Typography size="xs">
                v{latestVersion.version}
              </Typography>
            </Container>
          )}

          {metadata.info?.size != null && (
            <Container layout="flex" align="center" gap="xs">
              <Icon name="FiHardDrive" size="xs" />
              <Typography size="xs">
                {formatFileSize(metadata.info.size)}
              </Typography>
            </Container>
          )}

          {lastModified && (
            <Container layout="flex" align="center" gap="xs">
              <Icon name="FiClock" size="xs" />
              <Typography size="xs">
                Modified {formatDate(lastModified)}
              </Typography>
            </Container>
          )}
        </Container>

        <Container layout="flex" align="center" gap="xs">
          {file.isImage && !isReadOnly && (
            <Button
              color="success"
              size="sm"
              onClick={onSave}
              disabled={isSavingImage}
            >
              <Icon name={isSavingImage ? "FiLoader" : "FiSave"} size="xs" />
              {isSavingImage ? 'Saving...' : 'Save Image'}
            </Button>
          )}
          
          <Button
            color="secondary"
            size="sm"
            onClick={onDownload}
          >
            <Icon name="FiDownload" size="xs" />
            Download
          </Button>

          {file.type === 'text' && canManageVersions && (
            <Button
              color="secondary"
              size="sm"
              genie={{
                content: () => (
                  <VersionManagement
                    file={file}
                    onSuccess={(versionData) => {
                      if (versionData?.content) {
                        onVersionLoaded(versionData);
                      } else if (versionData?.refreshVersionData) {
                        onVersionLoaded(versionData);
                        loadMetadata();
                      } else {
                        loadMetadata();
                      }
                    }}
                  />
                ),
                trigger: 'click'
              }}
            >
              <Icon name="FiGitBranch" size="xs" />
              Versions
            </Button>
          )}

          <Button
            color="secondary"
            size="sm"
            genie={{
              content: () => (
                <ShareForm
                  filePath={file?.filePath}
                  isDirectory={false}
                  onSuccess={() => {
                    loadMetadata();
                  }}
                />
              ),
              trigger: 'click'
            }}
          >
            <Icon name="FiShare2" size="xs" />
            Share
          </Button>

          <Button
            color="secondary"
            size="sm"
            genie={{
              content: () => (
                <CommentPanel file={file} />
              ),
              trigger: 'click'
            }}
          >
            <Icon name="FiMessageSquare" size="xs" />
            Comments
          </Button>
        </Container>
      </Container>
    </Card>
  );
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 5) {
    return 'just a moment ago';
  }
  
  if (days === 0) {
    if (hours === 0) {
      return `${minutes}m ago`;
    }
    return `${hours}h ago`;
  } else if (days === 1) {
    return 'yesterday';
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

// ─── Drive View ───────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'size-desc', label: 'Largest first' },
  { value: 'size-asc', label: 'Smallest first' },
];

const sortFiles = (files, sortKey) => {
  const sorted = [...files];
  // Directories first, then sort within each group
  sorted.sort((a, b) => {
    const aIsDir = a.type === 'directory' ? 0 : 1;
    const bIsDir = b.type === 'directory' ? 0 : 1;
    if (aIsDir !== bIsDir) return aIsDir - bIsDir;

    switch (sortKey) {
      case 'name-asc': return (a.fileName || '').localeCompare(b.fileName || '');
      case 'name-desc': return (b.fileName || '').localeCompare(a.fileName || '');
      case 'date-desc': return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      case 'date-asc': return new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0);
      case 'size-desc': return (b.size || 0) - (a.size || 0);
      case 'size-asc': return (a.size || 0) - (b.size || 0);
      default: return (a.fileName || '').localeCompare(b.fileName || '');
    }
  });
  return sorted;
};

const DriveView = ({ onRefresh, userRoot, fileTree }) => {
  const { success: showSuccess, error: showError } = useNotification();
  const driveNavigate = useNavigate();
  const driveLocation = useLocation();

  // URL is the single source of truth for the current folder.
  const folderPath = useMemo(() => {
    const urlPath = driveLocation.pathname.replace(/^\/files\/?/, '');
    if (!urlPath) return userRoot;
    return '/' + decodeURIComponent(urlPath);
  }, [driveLocation.pathname, userRoot]);

  // Flat filePath→node map used to resolve human-readable names in the breadcrumb.
  const treeNodeMap = useMemo(() => flattenNodes(buildFullTree(fileTree || {})), [fileTree]);

  // Selection state — local to DriveView.
  const [selectedFiles, setSelectedFiles] = useState([]);
  const selectFile = useCallback((fileId) => {
    setSelectedFiles(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);
  }, []);
  const clearSelection = useCallback(() => setSelectedFiles([]), []);
  const selectAll = useCallback((ids) => setSelectedFiles(ids), []);

  const [files, setFiles] = useState([]);
  const [dirPath, setDirPath] = useState(folderPath); // server-returned directory path
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [sortKey, setSortKey] = useState('name-asc');
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) clearSelection();
      return !prev;
    });
  }, [clearSelection]);

  // Clear selection when folder changes.
  useEffect(() => { clearSelection(); }, [folderPath, clearSelection]);

  // Load directory contents from the server (source of truth).
  const loadContents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fileService.getDirectoryContents(folderPath);
      setFiles(res.contents);
      // Use the server-returned directory filePath as the canonical path.
      const serverDir = res.directory;
      if (serverDir?.filePath) setDirPath(serverDir.filePath);
    } catch {
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [folderPath]);

  useEffect(() => { loadContents(); }, [loadContents]);

  // Build breadcrumbs from the server-returned directory path.
  // Build breadcrumbs from the server-returned directory path — no path manipulation.
  const breadcrumb = useMemo(() => {
    const crumbs = [{ name: 'My Drive', path: userRoot }];
    if (dirPath === userRoot || !dirPath) return crumbs;
    const segments = dirPath.split('/').filter(Boolean);
    let cumulativePath = '';
    segments.forEach(seg => {
      cumulativePath += '/' + seg;
      // Skip segments that are already represented by "My Drive" (user's root path)
      if (userRoot === cumulativePath || userRoot.startsWith(cumulativePath + '/')) return;
      const node = treeNodeMap[fileService.normalizePath(cumulativePath)];
      crumbs.push({ name: node?.fileName || seg, path: cumulativePath });
    });
    return crumbs;
  }, [dirPath, userRoot, treeNodeMap]);

  // Expose refresh to parent
  useEffect(() => {
    if (onRefresh) onRefresh.current = loadContents;
  }, [onRefresh, loadContents]);

  const handleDelete = async (file, confirmed) => {
    if (!confirmed && !window.confirm(`Delete "${file.fileName}"?`)) return;
    try {
      await fileService.deleteFile(file.filePath);
      showSuccess(`Deleted "${file.fileName}"`);
      loadContents();
    } catch (err) {
      showError(`Failed to delete: ${err.message}`);
    }
  };

  const handleRename = async (file, newName) => {
    if (!newName) {
      newName = window.prompt('New name:', file.fileName);
    }
    if (!newName || newName === file.fileName) return;
    try {
      await fileService.renameFile(file.filePath, newName);
      showSuccess(`Renamed to "${newName}"`);
      loadContents();
    } catch (err) {
      showError(`Failed to rename: ${err.message}`);
    }
  };

  const handleDownload = async (file) => {
    try {
      const blob = await fileService.downloadFile(file.filePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError(`Failed to download: ${err.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;
    const toDelete = files.filter(f => selectedFiles.includes(f._id));
    if (toDelete.length === 0) {
      showError('No valid files selected for deletion');
      clearSelection();
      return;
    }
    if (!window.confirm(`Delete ${toDelete.length} item(s)? This cannot be undone.`)) return;
    let deleted = 0;
    let failed = 0;
    for (const f of toDelete) {
      try {
        await fileService.deleteFile(f.filePath);
        deleted++;
      } catch {
        failed++;
      }
    }
    if (deleted > 0) showSuccess(`Deleted ${deleted} item(s)`);
    if (failed > 0) showError(`Failed to delete ${failed} item(s)`);
    clearSelection();
    loadContents();
  };

  const renderShareForm = useCallback(({ file: f, onBack }) => (
    <ShareForm filePath={f.filePath} isDirectory={f.type === 'directory'} onSuccess={() => { onBack(); loadContents(); }} onCancel={onBack} />
  ), [loadContents]);

  const renderMoveForm = useCallback(({ file: f, onBack }) => (
    <MoveOrCopyForm node={f} fileTree={fileTree} label="Move" onBack={onBack}
      onSuccess={async (destDir) => {
        const name = f.fileName || f.filePath.split('/').pop();
        try {
          await fileService.moveFile(f.filePath, `${destDir}/${name}`.replace(/\/+/g, '/'));
          showSuccess(`Moved to "${destDir}"`);
          onBack(); loadContents();
        } catch (err) { showError(`Move failed: ${err.message}`); }
      }}
    />
  ), [fileTree, loadContents, showSuccess, showError]);

  const renderCopyForm = useCallback(({ file: f, onBack }) => (
    <MoveOrCopyForm node={f} fileTree={fileTree} label="Copy" onBack={onBack}
      onSuccess={async (destDir) => {
        const name = f.fileName || f.filePath.split('/').pop();
        try {
          await fileService.copyFile(f.filePath, `${destDir}/${name}`.replace(/\/+/g, '/'));
          showSuccess(`Copied to "${destDir}"`);
          onBack(); loadContents();
        } catch (err) { showError(`Copy failed: ${err.message}`); }
      }}
    />
  ), [fileTree, loadContents, showSuccess, showError]);

  const filtered = useMemo(() => {
    let result = files;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f => (f.fileName || '').toLowerCase().includes(q));
    }
    return sortFiles(result, sortKey);
  }, [files, search, sortKey]);

  const allIds = useMemo(() => files.map(f => f._id).filter(Boolean), [files]);

  return (
    <Container layout="flex-column" width="100%" height="100vh" gap="none" style={{ padding: '5vmin' }}>
      {/* Breadcrumb bar */}
      <Card padding="sm" width="100%" backgroundColor="surface" style={{ borderBottom: '1px solid var(--border-color)', borderRadius: 0 }}>
        <Container layout="flex" align="center" gap="xs" wrap>
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <Icon name="FiChevronRight" size="xs" color="secondary" />}
              <Button
                size="sm"
                variant={i === breadcrumb.length - 1 ? 'primary' : 'ghost'}
                onClick={() => driveNavigate('/files' + crumb.path)}
              >
                {i === 0 && <Icon name="FiHardDrive" size="xs" />}
                {crumb.name}
              </Button>
            </React.Fragment>
          ))}
        </Container>
      </Card>

      {/* Toolbar */}
      <Container layout="flex" justify="between" width="100%" align="center" gap="sm" padding="sm" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <Input
          placeholder="Search files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="sm"
        />
        <Select
          options={SORT_OPTIONS}
          value={sortKey}
          onChange={setSortKey}
          size="sm"
        />
        <Container flexFill />
        <Container layout="flex" gap="xs">
          <Button size="sm" variant={viewMode === 'grid' ? 'primary' : 'ghost'} onClick={() => setViewMode('grid')} title="Grid view">
            <Icon name="FiGrid" size="xs" />
          </Button>
          <Button size="sm" variant={viewMode === 'list' ? 'primary' : 'ghost'} onClick={() => setViewMode('list')} title="List view">
            <Icon name="FiList" size="xs" />
          </Button>
        </Container>

        {allIds.length > 0 && (
          <Button
            size="sm"
            variant={selectionMode ? 'primary' : 'ghost'}
            onClick={toggleSelectionMode}
            title={selectionMode ? 'Exit selection mode' : 'Select files'}
          >
            <Icon name="FiCheckSquare" size="xs" />
            {selectionMode ? 'Done' : 'Select'}
          </Button>
        )}

        {selectionMode && allIds.length > 0 && (
          <Container layout="flex" align="center" gap="sm">
            <Input
              type="checkbox"
              checked={selectedFiles.length > 0 && selectedFiles.length === allIds.length}
              indeterminate={selectedFiles.length > 0 && selectedFiles.length < allIds.length}
              onChange={() => selectedFiles.length === allIds.length ? clearSelection() : selectAll(allIds)}
              label={selectedFiles.length > 0 ? `${selectedFiles.length} selected` : 'Select all'}
            />
          </Container>
        )}

        {selectionMode && selectedFiles.length > 0 && (
          <Container layout="flex" align="center" gap="sm">
            <Button size="sm" color="error" variant="ghost" onClick={handleBulkDelete}>
              <Icon name="FiTrash2" size="xs" />
              Delete ({selectedFiles.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Clear
            </Button>
          </Container>
        )}
      </Container>

      {/* File listing */}
      <Container flexFill overflow="auto" padding="md" width="100%" height="100%">
        {isLoading ? (
          <Container layout="flex" align="center" justify="center" padding="xl" width="100%" height="100%">
            <CircularProgress size="lg" />
          </Container>
        ) : filtered.length === 0 ? (
          <Container layout="flex-column" align="center" justify="center" gap="md" padding="xl" width="100%" height="100%">
            <Icon name="FiFolder" size="xl" color="secondary" />
            <Typography size="md" color="secondary">
              {search ? 'No files match your search' : 'This folder is empty'}
            </Typography>
            <Typography size="sm" color="secondary">
              Use the + button to create files or upload
            </Typography>
          </Container>
        ) : viewMode === 'grid' ? (
          <Container layout="flex" gap="md" width="100%">
            {filtered.map(file => (
              <FileCard
                key={file._id || file.filePath}
                file={file}
                selected={selectedFiles.includes(file._id)}
                onSelect={selectFile}
                selectionMode={selectionMode}
                onDelete={handleDelete}
                onRename={handleRename}
                onDownload={handleDownload}
                renderShareForm={renderShareForm}
                renderMoveForm={renderMoveForm}
                renderCopyForm={renderCopyForm}
              />
            ))}
          </Container>
        ) : (
          <div style={{ display: 'table', width: '100%', borderCollapse: 'collapse' }}>
            {/* List header */}
            <div style={{ display: 'table-row', borderBottom: '2px solid var(--border-color)' }}>
              {selectionMode && (
                <div style={{ display: 'table-cell', padding: '8px 4px', verticalAlign: 'middle', width: '32px' }}>
                  <Input
                    type="checkbox"
                    checked={selectedFiles.length > 0 && selectedFiles.length === allIds.length}
                    indeterminate={selectedFiles.length > 0 && selectedFiles.length < allIds.length}
                    onChange={() => selectedFiles.length === allIds.length ? clearSelection() : selectAll(allIds)}
                  />
                </div>
              )}
              <div style={{ display: 'table-cell', padding: '8px 12px', verticalAlign: 'middle' }}>
                <Typography size="xs" weight="semibold" color="secondary">Name</Typography>
              </div>
              <div style={{ display: 'table-cell', padding: '8px 12px', verticalAlign: 'middle', width: '120px' }}>
                <Typography size="xs" weight="semibold" color="secondary">Modified</Typography>
              </div>
              <div style={{ display: 'table-cell', padding: '8px 12px', verticalAlign: 'middle', width: '80px', textAlign: 'right' }}>
                <Typography size="xs" weight="semibold" color="secondary">Size</Typography>
              </div>
              <div style={{ display: 'table-cell', width: '40px' }} />
            </div>
            {filtered.map(file => (
              <FileListRow
                key={file._id || file.filePath}
                file={file}
                selected={selectedFiles.includes(file._id)}
                onSelect={selectFile}
                selectionMode={selectionMode}
                onDelete={handleDelete}
                onRename={handleRename}
                onDownload={handleDownload}
                renderShareForm={renderShareForm}
                renderMoveForm={renderMoveForm}
                renderCopyForm={renderCopyForm}
              />
            ))}
          </div>
        )}
      </Container>
    </Container>
  );
};

export const FilesPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
  const userRoot = user?.username ? '/' + user.username : '/';
  const [fileTree, setFileTree] = useState({});
  const [activeFile, setActiveFile] = useState({
    file: null,
    isLoading: false,
    isReadOnly: false,
  });
  const [accessError, setAccessError] = useState(false);
  const driveRefreshRef = useRef(null);
  const activeFileRef = useRef(activeFile.file);
  activeFileRef.current = activeFile.file;

  const urlLooksLikeFile = useMemo(() => {
    const urlPath = location.pathname.replace(/^\/files\/?/, '');
    const name = urlPath.split('/').pop() || '';
    return name.includes('.');
  }, [location.pathname]);
  
  useEffect(() => {
    return () => {
      if (activeFile?.file?._isBlobUrl && activeFile?.file?.modelSrc) {
        URL.revokeObjectURL(activeFile.file.modelSrc);
      }
      if (activeFile?.file?.imageSrc && activeFile?.file?.imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(activeFile.file.imageSrc);
      }
    };
  }, [activeFile?.file?.modelSrc, activeFile?.file?.imageSrc]);
  
  const [versionView, setVersionView] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [latestVersionContent, setLatestVersionContent] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  
  const { content: fileContent, connectionStatus, updateContent } = useYjsDocument(activeFile.file);
  
  // Guard: clear raw binary DOCX content ("PK...") that was mistakenly written into Yjs.
  const docxGuardedRef = useRef(null);
  useEffect(() => {
    const filePath = activeFile.file?.filePath;
    if (docxGuardedRef.current !== filePath) docxGuardedRef.current = null;
    if (!filePath?.match(/\.docx?$/i) || connectionStatus !== 'connected' || docxGuardedRef.current) return;
    docxGuardedRef.current = filePath;
    if (fileContent?.startsWith('PK')) {
      console.warn('[FilesPage] Raw binary DOCX in Yjs — clearing. Re-upload the file.', filePath);
      updateContent('');
    }
  }, [activeFile.file?.filePath, connectionStatus, fileContent, updateContent]);
  
  const editorRef = useRef(null);
  const imageRef = useRef(null);
  const pdfRef = useRef(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  
  const { success: showSuccess, error: showError, warning: showWarning, info: showInfo } = useNotification();

  useEffect(() => {
    const fileId = activeFile.file?._id;
    if (!fileId) { setIsStarred(false); return; }
    (async () => {
      try {
        const { default: userService } = await import('../client/user.client');
        const res = await userService.getStarredFiles();
        const starred = (res.data || res || []);
        setIsStarred(starred.some(f => (f._id || f.id) === fileId));
      } catch { setIsStarred(false); }
    })();
  }, [activeFile.file?._id]);

  const handleToggleStar = useCallback(async () => {
    const fileId = activeFile.file?._id;
    if (!fileId) return;
    try {
      const { default: userService } = await import('../client/user.client');
      if (isStarred) {
        await userService.unstarFile(fileId);
        setIsStarred(false);
      } else {
        await userService.starFile(fileId);
        setIsStarred(true);
      }
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to update star');
    }
  }, [activeFile.file?._id, isStarred, showError]);
  
  const clearFileSelection = useCallback(() => {
    setActiveFile({ file: null, isLoading: false, isReadOnly: false });
    const currentFile = activeFileRef.current;
    const parentPath = currentFile
      ? (fileService.getParentPath(currentFile.filePath) || userRoot)
      : userRoot;
    navigate('/files' + parentPath, { replace: true });
  }, [navigate, userRoot]);

  const checkIfReadOnly = useCallback((metadata) => {
    if (!user || !metadata) return true;
    const userId = String(user._id || user.id);
    const ownerId = String(metadata.owner);
    if (ownerId === userId) return false;
    const writeUsers = metadata.permissions?.write || [];
    return !writeUsers.some(writeUserId => String(writeUserId) === userId);
  }, [user]);

  const loadFileTree = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) setIsLoading(true);
      const fullRes = await fileService.getDirectoryTree('/', { format: 'object' });
      setFileTree(fullRes.tree);
    } catch (error) {
      showError(`Failed to load file tree: ${error.message || 'Unknown error'}`);
      if (showLoadingState) {
        showWarning('Unable to load files. Please try refreshing the page.');
      }
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  }, [showError, showWarning]);

  const loadFileContent = useCallback(async (file, prefetchedMetadata) => {
    if (!file?.filePath) {
      showError('Invalid file path');
      return;
    }

    setVersionView(null);
    setLatestVersionContent('');
    setAccessError(false);
    setActiveFile({ file: null, isLoading: true, isReadOnly: false });

    try {
      const filePath = file.filePath;
      const isImage = filePath.match(/\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|tiff|tif)$/i);
      const isVideo = filePath.match(/\.(mp4|webm|avi|mov|wmv|flv)$/i);
      const isAudio = filePath.match(/\.(mp3|wav)$/i);
      const is3DModel = filePath.match(/\.(obj|gltf|glb|fbx|stl|dae|3ds|blend|ply|3mf|usdz|usda|usdc|vrm|vox|c4d)$/i);
      const isPdf = filePath.match(/\.pdf$/i);
      
      // Single metadata fetch — used for type resolution and permissions.
      // If the URL effect already fetched metadata (extensionless paths), reuse it.
      // If metadata fails (404 = file doesn't exist, 403/400 = no access), abort.
      let metadata = prefetchedMetadata || null;
      if (!metadata) {
        try {
          metadata = await fileService.getMetadata(filePath);
        } catch (metadataError) {
          console.warn('[FilesPage] Failed to fetch metadata:', metadataError);
          setActiveFile({ file: null, isLoading: false, isReadOnly: false });
          setAccessError(true);
          return;
        }
      }

      let fileWithMetadata = metadata ? { ...file, ...metadata } : file;
      const isReadOnlyForUser = checkIfReadOnly(metadata);

      if (isImage) {
        const imageBlob = await fileService.downloadFile(filePath);
        const imageSrc = URL.createObjectURL(imageBlob);
        
        setActiveFile({ 
          file: { ...fileWithMetadata, isImage: true, type: 'image', imageSrc }, 
          isLoading: false, 
          isReadOnly: isReadOnlyForUser 
        });
      } else if (isVideo) {
        const videoSrc = fileService.getStreamingUrl(filePath);
        
        setActiveFile({ 
          file: { ...fileWithMetadata, isVideo: true, type: 'video', videoSrc }, 
          isLoading: false, 
          isReadOnly: true
        });
      } else if (isAudio) {
        const audioSrc = fileService.getStreamingUrl(filePath);
        setActiveFile({ 
          file: { ...fileWithMetadata, isAudio: true, type: 'audio', audioSrc }, 
          isLoading: false, 
          isReadOnly: true
        });
      } else if (is3DModel) {
        try {
          const blob = await fileService.downloadFile(filePath);
          const blobUrl = URL.createObjectURL(blob);
          
          const modelExt = filePath.split('.').pop()?.toLowerCase() || 'glb';
          setActiveFile({ 
            file: { ...fileWithMetadata, is3DModel: true, type: '3d-model', modelSrc: blobUrl, modelFormat: modelExt, _isBlobUrl: true }, 
            isLoading: false, 
            isReadOnly: true
          });
        } catch (error) {
          console.error('Failed to load 3D model:', error);
          showError(`Failed to load 3D model: ${error.message}`);
        }
      } else if (isPdf) {
        try {
          const pdfBlob = await fileService.downloadFile(filePath);
          setActiveFile({
            file: { ...fileWithMetadata, isPdf: true, type: 'pdf', pdfBlob },
            isLoading: false,
            isReadOnly: isReadOnlyForUser
          });
        } catch (error) {
          console.error('Failed to load PDF:', error);
          showError(`Failed to load PDF: ${error.message}`);
        }
      } else if (file.type === 'text') {
        // Text content arrives via the Yjs WebSocket (useYjsDocument).
        // No HTTP content fetch needed — even for read-only users the Yjs
        // provider delivers the document.  Version diff is loaded lazily
        // via refreshLatestVersionContent when the user asks for it.
        setActiveFile({ file: { ...fileWithMetadata, isImage: false, type: 'text' }, isLoading: false, isReadOnly: isReadOnlyForUser });
      } else {
        setActiveFile({ file: { ...fileWithMetadata, isImage: false, isBinary: true, type: 'binary' }, isLoading: false, isReadOnly: true });
      }
    } catch (error) {
      showError(`Failed to load file: ${error.message}`);
      setActiveFile({ file: null, isLoading: false, isReadOnly: false });
    }
  }, [showError, checkIfReadOnly]);

  const refreshLatestVersionContent = useCallback(async () => {
    const currentFile = activeFileRef.current;
    if (!currentFile?.filePath || currentFile.type !== 'text') {
      setLatestVersionContent('');
      return;
    }

    try {
      const versionsResponse = await fileService.getFileVersions(currentFile.filePath);
      const versions = versionsResponse.versions || [];
      
      if (versions.length > 0) {
        const latestVersion = versions[versions.length - 1];
        const versionData = await fileService.loadFileVersion(currentFile.filePath, latestVersion.version);
        setLatestVersionContent(versionData.content || '');
      } else {
        setLatestVersionContent('');
      }
    } catch (error) {
      console.warn('Failed to refresh latest version for diff:', error);
      setLatestVersionContent('');
    }
  }, []);
  
  useEffect(() => {
    window.showNotification = (message, type = 'info') => {
      switch (type) {
        case 'info': showInfo(message); break;
        case 'success': showSuccess(message); break;
        case 'warning': showWarning(message); break;
        case 'error': showError(message); break;
        default: showInfo(message);
      }
    };

    const cleanup = fileService.onFileNotification(
      (changeType, data) => {
        switch (changeType) {
          case 'shared':
          case 'unshared':
            loadFileTree(false);
            break;
          case 'created':
            loadFileTree(false);
            break;
          case 'deleted':
            clearFileSelection();
            loadFileTree(false);
            break;
          case 'renamed':
            if (data.newFilePath && activeFileRef.current?.filePath === data.oldFilePath) {
              setActiveFile(prev => prev.file ? ({
                ...prev,
                file: { ...prev.file, filePath: data.newFilePath, fileName: data.newFileName }
              }) : prev);
              navigate('/files' + data.newFilePath, { replace: true });
            }
            loadFileTree(false);
            break;
          case 'moved':
            if (data.newFilePath && activeFileRef.current?.filePath === data.oldFilePath) {
              setActiveFile(prev => prev.file ? ({
                ...prev,
                file: { ...prev.file, filePath: data.newFilePath }
              }) : prev);
              navigate('/files' + data.newFilePath, { replace: true });
            }
            loadFileTree(false);
            break;
          case 'version_saved':
            refreshLatestVersionContent();
            break;
        }
      },
      { showToast: true }
    );

    return () => {
      cleanup();
      delete window.showNotification;
    };
  }, [loadFileTree, clearFileSelection, refreshLatestVersionContent, navigate]);
  
  const handleVersionLoaded = useCallback((versionData) => {
    // Handle refresh signal from version operations (save/delete)
    if (versionData?.refreshVersionData) {
      refreshLatestVersionContent();
      return;
    }
    
    if (!versionData?.content) {
      showError('Invalid version data');
      return;
    }
    
    if (!activeFile.file) {
      showError('No active file to load version for');
      return;
    }
    
    setVersionView({
      originalFile: activeFile.file,
      content: versionData.content,
      versionNumber: versionData.versionNumber,
      versionMessage: versionData.versionMessage,
      name: `${activeFile.file.name.replace(/\s*\(Version \d+\)/, '')} (Version ${versionData.versionNumber})`
    });
    
    showSuccess(`Viewing version ${versionData.versionNumber} (read-only)`);
  }, [activeFile.file, showError, showSuccess, refreshLatestVersionContent]);

  const handleFileDownload = useCallback(async () => {
    if (!activeFile.file?.filePath) return;
    
    try {
      const blob = await fileService.downloadFile(activeFile.file.filePath);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeFile.file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(`Failed to download file: ${error.message}`);
    }
  }, [activeFile.file, showError]);

  const handleImageSave = useCallback(async ({ blob }) => {
    if (!activeFile.file?.filePath || !blob) {
      showError('Failed to save image');
      return;
    }
    
    setIsSavingImage(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      await new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const base64Data = reader.result.split(',')[1];
            
            if (!base64Data) {
              throw new Error('Failed to convert image to base64');
            }
            
            await fileService.updateContent(activeFile.file.filePath, base64Data);
            showSuccess('Image saved successfully');
            await loadFileContent(activeFile.file);
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
      });
    } catch (error) {
      showError(`Failed to save image: ${error.message}`);
    } finally {
      setIsSavingImage(false);
    }
  }, [activeFile.file, showSuccess, showError, loadFileContent]);

  const navigateToPath = useCallback((filePath) => {
    if (!filePath) {
      clearFileSelection();
      return;
    }
    let path = fileService.normalizePath(filePath);
    if (path === '/') path = userRoot;
    navigate('/files' + path);
  }, [clearFileSelection, navigate, userRoot]);

  const handleFileAction = useCallback(async (action, resultPath, type) => {
    await loadFileTree(false);
    driveRefreshRef.current?.();
    if (resultPath && type === 'file' && action !== 'delete') {
      navigateToPath(resultPath);
    } else {
      clearFileSelection();
    }
  }, [loadFileTree, navigateToPath, clearFileSelection]);

  useEffect(() => {
    loadFileTree(true);
  }, [loadFileTree]);

  // ─── Single URL effect ─────────────────────────────────────────────
  // URL is the sole source of truth.  When the URL changes we decide
  // whether to show DriveView (directory) or a file viewer.
  //  • Has a file extension  → treat as file → loadFileContent
  //  • No extension          → ask server (getMetadata).
  //       directory → DriveView (no-op: it reads the URL itself)
  //       file      → loadFileContent
  //  • Empty path            → DriveView at root
  // Everything that wants to navigate just calls navigate().
  useEffect(() => {
    const urlPath = location.pathname.replace(/^\/files\/?/, '');
    const filePath = urlPath ? '/' + decodeURIComponent(urlPath) : '';
    const fileName = filePath.split('/').pop() || '';
    const hasExtension = fileName.includes('.');

    // 1. If a file viewer is open but the URL no longer matches → close it
    if (activeFile.file && filePath !== activeFile.file.filePath) {
      setActiveFile({ file: null, isLoading: false, isReadOnly: false });
      return; // effect will re-run on the state change
    }

    // 2. Already viewing the correct file, already loading, or access denied → nothing to do
    if (activeFile.file?.filePath === filePath || activeFile.isLoading || accessError) return;

    // 3. No path → DriveView handles showing the user root
    if (!filePath) return;

    // 4. Wait for file tree to finish loading before resolving URLs
    if (isLoading) return;

    // 5. Path has a file extension → definitely a file
    if (hasExtension) {
      loadFileContent({ filePath, name: fileName, type: fileService.getFileType(filePath) });
      return;
    }

    // 6. No extension → ask the server whether this is a file or directory
    let cancelled = false;
    (async () => {
      try {
        const metadata = await fileService.getMetadata(filePath);
        if (cancelled) return;
        if (metadata?.type === 'directory') {
          // DriveView is already mounted and syncs to URL — nothing to do
          return;
        }
        // It's an extensionless file — pass metadata to avoid a second fetch
        loadFileContent({ filePath, name: fileName, type: metadata?.type || 'text' }, metadata);
      } catch {
        // Metadata failed — path doesn't exist or no access
        if (!cancelled) setAccessError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname, isLoading, activeFile.file?.filePath, activeFile.isLoading, accessError]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVersionDownload = useCallback(async () => {
    if (!versionView) return;
    
    try {
      const blob = await fileService.downloadFileVersion(
        versionView.originalFile.filePath, 
        versionView.versionNumber
      );
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = versionView.originalFile.name.replace(/\.[^/.]+$/, '');
      const extension = versionView.originalFile.name.match(/\.[^/.]+$/)?.[0] || '.txt';
      a.href = url;
      a.download = `${baseName}_v${versionView.versionNumber}${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(`Failed to download version: ${error.message}`);
    }
  }, [versionView, showError]);

  const renderMainContent = () => {
    if (versionView) {
      const versionFilePath = versionView.originalFile.filePath;
      const versionMode = versionFilePath?.match(/\.docx?$/i)
        ? 'document'
        : versionFilePath?.match(/\.(md|mdx|txt)$/i)
          ? 'markdown'
          : 'code';

      return (
        <Container layout="flex-column" height="100vh" width="100%" gap="none" style={{ padding: '5vmin' }}>
          <Card
            className="file-header-card"
            layout="flex"
            align="center"
            justify="between"
            padding="sm"
            width="100%"
          >
            <Container layout="flex" align="center" gap="sm" padding="none">
              <Button size="sm" variant="ghost" onClick={() => setVersionView(null)} title="Back to current version">
                <Icon name="FiArrowLeft" size="xs" />
              </Button>
              <Icon name="FiLock" size="sm" color="warning" />
              <Typography size="xs" color="warning">READ-ONLY</Typography>
            </Container>

            <Typography weight="semibold">{versionView.originalFile.name}</Typography>

            <Container layout="flex" align="center" gap="sm">
              <Typography size="xs">
                {versionFilePath}
              </Typography>
              <Icon name="FiGitBranch" size="sm" color="info" />
              <Typography size="xs" color="info">Version {versionView.versionNumber}</Typography>
            </Container>
          </Card>

          <Container layout="flex" align="center" justify="center" flexFill width="100%" height="100%" padding="sm" overflow="auto">
            <Editor
              key={`version-editor-${versionView.versionNumber}`}
              mode={versionMode}
              filePath={versionFilePath}
              content={versionView.content}
              placeholder="Version content..."
              showToolbar={false}
              readOnly={true}
              width="100%"
              height="100%"
              minHeight="100%"
            />
          </Container>

          <Card className="file-metadata-bar" padding="sm" width="100%" backgroundColor="surface" margin="none">
            <Container layout="flex" align="center" justify="between" width="100%" padding="none">
              <Container layout="flex" align="center" gap="sm" padding="none">
                <Icon name="FiInfo" size="xs" color="info" />
                <Typography size="xs">
                  {versionView.versionMessage || 'No message'}
                </Typography>
              </Container>
              <Button
                color="secondary"
                size="sm"
                onClick={handleVersionDownload}
              >
                <Icon name="FiDownload" size="xs" />
                Download Version
              </Button>
            </Container>
          </Card>
        </Container>
      );
    }
    
    if (activeFile.isLoading || (!activeFile.file && !accessError && urlLooksLikeFile)) {
      return (
        <Container layout="flex" align="center" justify="center" minHeight="100vh" width="100%">
          <Container layout="flex-column" align="center" gap="md">
            <CircularProgress size="lg" />
            <Typography>Loading...</Typography>
          </Container>
        </Container>
      );
    }

    if (accessError) {
      return (
        <Container layout="flex" align="center" justify="center" minHeight="100vh" width="100%">
          <Container layout="flex-column" align="center" gap="lg">
            <Typography
              size="4xl"
              font="monospace"  
              weight="bold"
              color="primary"
              animation="glitch"
              animationDuration={600}
            >
              404
            </Typography>
            <Typography
              size="lg"
              color="secondary"
              animation="slide"
              animationConfig={{ direction: 'bottom', "splitBy":"words" }}
              animationDelay={150}
              animationDuration={1200}
            >
              File not found or you do not have access
            </Typography>
            <Button
              color="primary"
              size="md"
              onClick={() => {
                setAccessError(false);
                navigate('/files' + userRoot, { replace: true });
              }}
            >
              <Icon name="FiArrowLeft" size="xs" />
              Back to My Files
            </Button>
          </Container>
        </Container>
      );
    }

    if (!activeFile.file) {
      return (
        <DriveView
          onRefresh={driveRefreshRef}
          userRoot={userRoot}
          fileTree={fileTree}
        />
      );
    }

    return (
      <Container layout="flex-column" height="100vh" width="100%" gap="none" style={{ padding: '5vmin' }}>
        <Card
          className="file-header-card"
          layout="flex" 
          align="center" 
          justify="between" 
          padding="sm"
          width="100%"
          
        >
          <Container layout="flex" align="center" gap="sm" padding="none">
            <Button size="sm" variant="ghost" onClick={clearFileSelection} title="Back to files">
              <Icon name="FiArrowLeft" size="xs" />
            </Button>
            {activeFile.file.type === 'text' && !activeFile.isReadOnly && (
              <Container layout="flex" align="center" gap="xs">
                {connectionStatus === 'connected' && (
                  <>
                    <Icon name="FiWifi" size="sm" color="success" />
                    <Typography size="xs" color="success">Live Editing</Typography>
                  </>
                )}
                {connectionStatus === 'connecting' && (
                  <>
                    <CircularProgress size="xs" color="warning" />
                    <Typography size="xs" color="warning">Connecting...</Typography>
                  </>
                )}
                {connectionStatus === 'disconnected' && (
                  <>
                    <Icon name="FiWifiOff" size="sm" />
                    <Typography size="xs">Disconnected</Typography>
                  </>
                )}
                {connectionStatus === 'error' && (
                  <>
                    <Icon name="FiAlertCircle" size="sm" color="error" />
                    <Typography size="xs" color="error">Connection Error</Typography>
                  </>
                )}
              </Container>
            )}

            {activeFile.file.isImage && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="TbImageInPicture" size="sm" />
                    <Typography size="xs" color="primary">IMAGE</Typography>
                </Container>
            )}
            {activeFile.file.isVideo && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="FiVideo" size="sm" />
                    <Typography size="xs" color="primary">VIDEO</Typography>
                </Container>
            )}
            {activeFile.file.isAudio && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="FiMusic" size="sm" />
                    <Typography size="xs" color="primary">AUDIO</Typography>
                </Container>
            )}
            {activeFile.file.is3DModel && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="FiBox" size="sm" />
                    <Typography size="xs" color="primary">3D MODEL</Typography>
                </Container>
            )}
            {activeFile.file.type === 'text' && activeFile.file.filePath?.match(/\.docx?$/i) && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="FiFileText" size="sm" />
                    <Typography size="xs" color="primary">DOCUMENT</Typography>
                </Container>
            )}
            {activeFile.file.isPdf && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="FiFileText" size="sm" />
                    <Typography size="xs" color="primary">PDF</Typography>
                </Container>
            )}
            {activeFile.file.isBinary && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name={activeFile.file.filePath?.match(/\.zip$/i) ? 'FiArchive' : 'FiFile'} size="sm" />
                    <Typography size="xs">{activeFile.file.filePath?.match(/\.zip$/i) ? 'ZIP ARCHIVE' : 'BINARY'}</Typography>
                </Container>
            )}
            {/* Permission indicator */}
            {activeFile.isReadOnly && (
                <Container layout="flex" align="center" gap="sm">
                    <Icon name="FiLock" size="sm" color="warning" />
                    <Typography size="xs" color="warning">READ-only</Typography>
                </Container>
            )}
            </Container>

            <Typography weight="semibold">{activeFile.file.name}</Typography>
            <Container layout="flex" align="center" gap="sm">
            {activeFile.isReadOnly && (
              <Typography size="xs" color="warning">Read-only access</Typography>
            )}
            <Typography size="xs">
              {activeFile.file.filePath}
            </Typography>
            <Button size="sm" variant="ghost" onClick={handleToggleStar} title={isStarred ? 'Unstar file' : 'Star file'}>
              <Icon name={isStarred ? 'FiStar' : 'FiStar'} size="xs" color={isStarred ? 'warning' : 'secondary'} style={isStarred ? { fill: 'currentColor' } : {}} />
            </Button>
          </Container>
        </Card>

        <Container layout="flex" align="center" justify="center" flexFill width="100%" height="100%" padding="sm" overflow="auto">
          {activeFile.file.type === 'text' ? (
            <Editor
              key={`text-editor-${activeFile.file.filePath}`}
              ref={editorRef}
              mode={
                activeFile.file.filePath?.match(/\.docx?$/i)
                  ? 'document'
                  : activeFile.file.filePath?.match(/\.(md|mdx|txt)$/i)
                    ? 'markdown'
                    : 'code'
              }
              filePath={activeFile.file.filePath}
              content={fileContent}
              diffContent={latestVersionContent}
              onChange={updateContent}
              placeholder={activeFile.isReadOnly ? "This file is read-only for you" : "Start typing..."}
              showToolbar={!activeFile.isReadOnly}
              readOnly={activeFile.isReadOnly}
              width="100%"
              height="100%"
              minHeight="100%"
            />
          ) : activeFile.file.isImage ? (
            <Container layout="flex" align="center" justify="center" width="100%">
              <Image
                ref={imageRef}
                key={`image-viewer-${activeFile.file.filePath}`}
                src={activeFile.file.imageSrc}
                alt={activeFile.file.name}
                editable={!activeFile.isReadOnly}
                size="xl"
                fit="contain"
                fileName={activeFile.file.name.split('.')[0]}
                onSave={handleImageSave}
                allowDownload={true}
                controlsPlacement="bottom-right"
              />
            </Container>
          ) : activeFile.file.isVideo ? (
            <Container layout="flex" align="center" justify="center" width="100%">
              {(() => {
                const metadata = activeFile.file.mediaMetadata;
                const posterUrl = metadata?.thumbnailId ? 
                  `${baseUrl}/files/${encodeURIComponent(activeFile.file.filePath)}/thumbnail` : 
                  null;
                
                return (
                  <Video
                    key={`video-player-${activeFile.file.filePath}`}
                    src={activeFile.file.videoSrc}
                    crossOrigin="use-credentials"
                    controls={true}
                    autoPlay={false}
                    loop={false}
                    width="100%"
                    height="auto"
                    aspectRatio="16/9"
                    color="default"
                    poster={posterUrl}
                  />
                );
              })()}
            </Container>
          ) : activeFile.file.isAudio ? (
            <Container layout="flex" align="center" justify="center" width="100%">
              {(() => {
                const metadata = activeFile.file.mediaMetadata;
                const title = metadata?.title || activeFile.file.name.replace(/\.[^/.]+$/, '');
                const artist = metadata?.artist || null;
                const album = metadata?.album || null;
                const coverUrl = metadata?.coverArtId ? 
                  `${baseUrl}/files/${encodeURIComponent(activeFile.file.filePath)}/cover` : 
                  null;
                
                return (
                  <Audio
                    key={`audio-player-${activeFile.file.filePath}`}
                    src={activeFile.file.audioSrc}
                    crossOrigin="use-credentials"
                    title={title}
                    artist={artist}
                    album={album}
                    cover={coverUrl}
                    autoPlay={false}
                    loop={false}
                    muted={false}
                    initialVolume={0.8}
                    color="default"
                    size="lg"
                  />
                );
              })()}
            </Container>
          ) : activeFile.file.isPdf ? (
            <PdfViewer
              key={`pdf-viewer-${activeFile.file.filePath}`}
              ref={pdfRef}
              blob={activeFile.file.pdfBlob}
              fileName={activeFile.file.name}
              readOnly={activeFile.isReadOnly}
              onSave={!activeFile.isReadOnly ? async (savedBlob) => {
                try {
                  const reader = new FileReader();
                  reader.readAsDataURL(savedBlob);
                  await new Promise((resolve, reject) => {
                    reader.onloadend = async () => {
                      try {
                        const base64Data = reader.result.split(',')[1];
                        await fileService.updateContent(activeFile.file.filePath, base64Data);
                        showSuccess('PDF saved successfully');
                        await loadFileContent(activeFile.file);
                        resolve();
                      } catch (err) { reject(err); }
                    };
                    reader.onerror = reject;
                  });
                } catch (err) {
                  showError(`Failed to save PDF: ${err.message}`);
                }
              } : undefined}
              onError={(msg) => showError(msg)}
              width="100%"
              height="100%"
            />
          ) : activeFile.file.is3DModel ? (
            <Model3D
              key={`model3d-viewer-${activeFile.file.filePath}`}
              src={activeFile.file.modelSrc}
              format={activeFile.file.modelFormat}
              alt={activeFile.file.name}
              controls={true}
              autoRotate={false}
              autoRotateSpeed={1}
              width="100%"
              height="100%"
              environment="studio"
              showGrid={true}
              showShadows={true}
              cameraFov={50}
            />
          ) : (
            <Container layout="flex" align="center" justify="center" flexFill>
              <Container layout="flex-column" align="center" gap="md">
                {activeFile.file.filePath?.match(/\.zip$/i) ? (
                  <>
                    <Icon name="FiArchive" size="48" />
                    <Typography size="lg">Zip Archive</Typography>
                    <Typography size="sm">
                      Extract the contents of this archive into a new folder.
                    </Typography>
                    <Container layout="flex" gap="sm">
                      <Button
                        color="primary"
                        size="md"
                        disabled={isExtracting}
                        onClick={async () => {
                          const filePath = activeFile.file.filePath;
                          const parentPath = fileService.getParentPath(filePath) || '/';
                          setIsExtracting(true);
                          try {
                            const result = await fileService.extractZip(filePath, parentPath);
                            const count = result.extracted?.length || 0;
                            showSuccess(`Extracted ${count} item(s) into ${result.targetPath}`);
                            await loadFileTree(false);
                            driveRefreshRef.current?.();
                          } catch (err) {
                            showError(`Failed to extract: ${err.message}`);
                          } finally {
                            setIsExtracting(false);
                          }
                        }}
                      >
                        {isExtracting ? (
                          <><Icon name="FaSpinner" size="xs" /> Extracting...</>
                        ) : (
                          <><Icon name="FiArchive" size="xs" /> Extract Here</>
                        )}
                      </Button>
                      <Button
                        color="secondary"
                        size="md"
                        onClick={handleFileDownload}
                      >
                        <Icon name="FiDownload" size="xs" /> Download
                      </Button>
                    </Container>
                  </>
                ) : (
                  <>
                    <Icon name="FiFile" size="48" />
                    <Typography size="lg">Binary File</Typography>
                    <Typography size="sm">
                      This file cannot be edited directly. Use the download button above.
                    </Typography>
                  </>
                )}
              </Container>
            </Container>
          )}
        </Container>

        {/* File Metadata */}
        <FileMetadata 
          file={activeFile.file}
          isReadOnly={activeFile.isReadOnly}
          onDownload={handleFileDownload}
          onVersionLoaded={handleVersionLoaded}
          onSave={activeFile.file.isImage ? async () => {
            if (imageRef.current?.save) {
              await imageRef.current.save();
            }
          } : undefined}
          isSavingImage={isSavingImage}
        />
      </Container>
    );
  };

  if (isLoading) {
    return (
      <Page layout="flex" align="center" justify="center">
        <Container layout="flex-column" align="center" gap="md">
          <CircularProgress size="lg" />
          <Typography>Loading files...</Typography>
        </Container>
      </Page>
    );
  }

  return (
    <Page layout="flex" padding="none">
      <Container 
        layout="flex-column" 
        padding="none"
        minHeight="100%"
        flexFill
      >
        {renderMainContent()}
      </Container>

      <FloatingActionButton
        icon="FiFolder"
        position="bottom-left"
        size="md"
        color="secondary"
        draggable={true}
        genie={{
          trigger: 'click',
          content: () => (
            <Container minWidth="320px">
              <FileBrowser
                fileTree={fileTree}
                currentPath={activeFile.file?.filePath || userRoot}
                onPathSelect={navigateToPath}
                getNodeGenie={(node) => ({
                  trigger: 'contextmenu',
                  content: () => (
                    <FileNodeActions
                      node={node}
                      fileTree={fileTree}
                      onNavigate={navigateToPath}
                      onRefresh={async () => {
                        await loadFileTree(false);
                        driveRefreshRef.current?.();
                      }}
                    />
                  )
                })}
              />
            </Container>
          )
        }}
        title="Browse files"
        aria-label="Open file explorer"
      />

      <FloatingActionButton
        icon="FiPlus"
        position="bottom-right"
        size="lg"
        color="primary"
        draggable={true}
        genie={{
          content: () => (
            <QuickActions
              targetPath={activeFile.file?.filePath || userRoot}
              fileTree={fileTree}
              onActionComplete={async (path, type) => {
                await handleFileAction('create', path, type);
                showInfo('Action completed successfully');
              }}
            />
          ),
          trigger: 'click'
        }}
      />
    </Page>
  );
};

export default FilesPage;
