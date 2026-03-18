import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import fileService from '../client/file.client';
import {
  Page,
  Container,
  Card,
  Button,
  Typography,
  Icon,
  Input,
  Explorer,
  Editor,
  FloatingActionButton,
  CircularProgress,
  ProgressBar,
  Switch,
  Image,
  Video,
  Audio,
  Model3D,
  PdfViewer
} from '../components/Components';
import { ShareForm } from '../components/Explorer';

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
    if (connectionRef.current?.ytext) {
      connectionRef.current.ytext.doc.transact(() => {
        connectionRef.current.ytext.delete(0, connectionRef.current.ytext.length);
        if (newContent) connectionRef.current.ytext.insert(0, newContent);
      }, 'editor-change');
    } else {
      showError('No collaborative connection available. Please refresh the page.');
      return;
    }
    // Do NOT call setContent(newContent) here.
    // The Yjs observer already filters 'editor-change' transactions so it
    // won't fire for our own edits.  Calling setContent() would update the
    // `content` prop fed into the Editor, which would then call
    // editor.commands.setContent() again — resetting cursor position after
    // every debounced keystroke and re-introducing the phantom blank paragraph.
    // The editor itself is the source of truth while mounted; remote changes
    // arrive via the Yjs observer (origin !== 'editor-change') as intended.
  }, [showError]);

  return { content, updateContent, connectionStatus };
};

const CreateItemForm = ({ type, filePath: initialPath, fileTree, onSuccess, onCancel }) => {
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
        <Explorer
          fileTree={fileTree}
          currentPath={targetPath || '/'}
          onPathSelect={(path) => setTargetPath(path || '/')}
          includeFiles={false}
          showSelector={true}
          buttonLabel="Select Directory"
          hideTitle={true}
          showContextActions={false}
          width="100%"
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

const UploadForm = ({ targetPath, onSuccess, onCancel }) => {
  const [files, setFiles] = useState([]);
  const [overwrite, setOverwrite] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { error: showError, success: showSuccess } = useNotification();

  const handleSubmit = async () => {
    if (files.length === 0) {
      showError('Please select files to upload');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const safePath = targetPath || '/';
      const response = await fileService.uploadFiles(
        files, 
        safePath, 
        (progress) => {
          setUploadProgress(progress);
        },
        overwrite
      );
      const uploadedPaths = response.files.map(file => file.filePath);
      
      showSuccess(`Successfully uploaded ${uploadedPaths.length} file(s)`);
      onSuccess?.(uploadedPaths[0], 'file');
    } catch (err) {
      showError(`Failed to upload files: ${err.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Container layout="flex-column" padding="none" width="100%">
      <Typography variant="label">Select Files *</Typography>
      <Input
        type="file"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        disabled={isUploading}
        width="100%"
      />
      
      {files.length > 0 && (
        <Typography size="xs">
          Selected: {files.length} file(s)
        </Typography>
      )}
      
      <Container layout="flex" align="center" padding="none" gap="xs">
        <Switch
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          disabled={isUploading}
        />
        <Typography size="sm">Overwrite existing files</Typography>
      </Container>

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

  const handlePublishVersion = async (message) => {
    if (!file?.filePath) return;
    
    try {
      await fileService.publishFileVersion(file.filePath, message);
      showSuccess('Version published successfully');
      await loadVersions();
      setActiveAction(null);
      onSuccess({ refreshVersionData: true });
    } catch (error) {
      showError(`Failed to publish version: ${error.message}`);
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

  if (activeAction === 'publish') {
    return <PublishVersionForm onPublish={handlePublishVersion} onCancel={() => setActiveAction(null)} />;
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
        onClick={() => setActiveAction('publish')}
        width="100%"
        disabled={file?.type !== 'text'}
      >
        <Icon name="FiSave" size="sm" />
        Publish Current Version
      </Button>

      <Container layout="flex-column" gap="xs" width="100%">
        <Typography variant="label" size="xs">Version History ({versions.length})</Typography>
        
        {isLoading ? (
          <Container layout="flex" align="center" justify="center" padding="md">
            <CircularProgress size="sm" />
          </Container>
        ) : versions.length === 0 ? (
          <Typography size="xs" padding="sm">
            No versions published yet
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

const PublishVersionForm = ({ onPublish, onCancel }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    onPublish(message.trim() || 'Published version');
  };

  return (
    <Container layout="flex-column" gap="sm" padding="md" width="350px">
      <Typography variant="h6" size="sm" weight="semibold">
        📦 Publish Version
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
          Publish
        </Button>
      </Container>
    </Container>
  );
};

const FileSharing = ({ file, onSuccess }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const { success: showSuccess, error: showError } = useNotification();

  useEffect(() => {
    if (file?.filePath) {
      loadCollaborators();
    }
  }, [file?.filePath]);

  const loadCollaborators = async () => {
    if (!file?.filePath) return;
    
    setIsLoading(true);
    try {
      const response = await fileService.getFileSharing(file.filePath);
      const permissions = response.sharing?.permissions || {};
      
      const readUsers = (permissions.read || []).map(user => ({ ...user, permission: 'read' }));
      const writeUsers = (permissions.write || []).map(user => ({ ...user, permission: 'write' }));
      const userMap = new Map();
      readUsers.forEach(user => userMap.set(user._id, user));
      writeUsers.forEach(user => userMap.set(user._id, user));
      
      setCollaborators(Array.from(userMap.values()));
    } catch (error) {
      showError(`Failed to load collaborators: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareFile = async (userIds, permission) => {
    if (!file?.filePath) return;
    
    try {
      await fileService.shareFile(file.filePath, userIds, permission);
      showSuccess(`File shared with ${Array.isArray(userIds) ? userIds.length + ' users' : '1 user'}`);
      await loadCollaborators();
      setActiveAction(null);
      onSuccess();
    } catch (error) {
      showError(`Failed to share file: ${error.message}`);
    }
  };

  const handleUnshareFile = async (userId) => {
    if (!file?.filePath) return;
    
    try {
      await fileService.unshareFile(file.filePath, userId);
      showSuccess('File unshared successfully');
      await loadCollaborators();
      onSuccess?.();
    } catch (error) {
      showError(`Failed to unshare file: ${error.message}`);
    }
  };

  if (activeAction === 'share') {
    return (
      <ShareForm 
        filePath={file?.filePath}
        isDirectory={false}
        onSuccess={() => {
          loadCollaborators();
          setActiveAction(null);
          onSuccess();
        }}
      />
    );
  }

  return (
    <Container layout="flex-column" gap="sm" padding="md" width="400px">
      <Typography variant="h6" size="sm" weight="semibold">
        👥 File Sharing
      </Typography>
      <Typography size="xs">
        File: {file?.name || 'Unknown'}
      </Typography>

      <Button
        color="primary"
        size="sm"
        onClick={() => setActiveAction('share')}
        width="100%"
      >
        <Icon name="FiUserPlus" size="sm" />
        Share with User
      </Button>

      <Container layout="flex-column" gap="xs" width="100%">
        <Typography variant="label" size="xs">Shared with ({collaborators.length})</Typography>
        
        {isLoading ? (
          <Container layout="flex" align="center" justify="center" padding="md">
            <CircularProgress size="sm" />
          </Container>
        ) : collaborators.length === 0 ? (
          <Typography size="xs" padding="sm">
            File not shared with anyone
          </Typography>
        ) : (
          <Container layout="flex-column" gap="xs" style={{ overflowY: 'auto' }}>
            {collaborators.map((collaborator) => (
              <Card key={collaborator._id} padding="xs" backgroundColor="surface">
                <Container layout="flex" align="center" justify="between" width="100%">
                  <Container layout="flex-column" gap="xs">
                    <Typography size="xs" weight="semibold">
                      {collaborator.email || collaborator.username || 'Unknown User'}
                    </Typography>
                    <Typography size="xs">
                      {collaborator.permission || 'read'} access
                    </Typography>
                  </Container>
                  <Button
                    color="error"
                    size="sm"
                    onClick={() => handleUnshareFile(collaborator._id)}
                  >
                    <Icon name="FiUserMinus" size="xs" />
                  </Button>
                </Container>
              </Card>
            ))}
          </Container>
        )}
      </Container>

    </Container>
  );
};

const QuickActions = ({ targetPath, fileTree, onActionComplete }) => {
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
      return <UploadForm targetPath={targetPath} onSuccess={handleSuccess} onCancel={handleClose} />;
    default:
      return null;
  }
};

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
          {file.type === 'text' && (
            <Container layout="flex" align="center" gap="xs">
              <Icon name="FiGitBranch" size="xs" />
              <Typography size="xs">
                {hasVersions ? `${metadata.versions.length} versions` : 'No versions'}
              </Typography>
              {latestVersion && (
                <Typography size="xs">
                  | Latest: v{latestVersion.version}
                </Typography>
              )}
            </Container>
          )}

          <Container layout="flex" align="center" gap="xs">
            <Icon name="FiShare2" size="xs" />
            <Typography size="xs">
              {hasCollaborators ? `Shared with ${metadata.collaborators.length} users` : 'Private'}
            </Typography>
          </Container>

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
                <FileSharing
                  file={file}
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

export const FilesPage = () => {
  const { user } = useAuth();
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';
  const [fileTree, setFileTree] = useState({});
  const [activeFile, setActiveFile] = useState({
    file: null,
    content: '',
    isLoading: false,
    isReadOnly: false, // Simple boolean for read-only state
  });
  
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
  const [selectedDirectory, setSelectedDirectory] = useState('/');
  const [isLoading, setIsLoading] = useState(true);
  const [latestVersionContent, setLatestVersionContent] = useState('');
  
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
  
  const { success: showSuccess, error: showError, warning: showWarning, info: showInfo } = useNotification();
  
  const clearFileSelection = useCallback(() => {
    setActiveFile({ file: null, content: '', isLoading: false, isReadOnly: false });
  }, []);

  const checkIfReadOnly = useCallback(async (filePath) => {
    try {
      const metadata = await fileService.getMetadata(filePath);
      if (!user || !metadata) {
        return true;
      }
      const userId = String(user._id || user.id);
      const ownerId = String(metadata.owner);
      if (ownerId === userId) {
        return false;
      }
      const writeUsers = metadata.permissions?.write || [];
      const hasWriteAccess = writeUsers.some(writeUserId => String(writeUserId) === userId);
      return !hasWriteAccess;
    } catch (error) {
      console.warn('Failed to check file permissions:', error);
      return true; // Default to read-only on error for safety
    }
  }, [user]);

  const loadFileTree = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) setIsLoading(true);
      const response = await fileService.getDirectoryTree('/', { format: 'object' });
      const treeData = response?.tree || response?.data?.tree || {};
      setFileTree(treeData);
    } catch (error) {
      showError(`Failed to load file tree: ${error.message || 'Unknown error'}`);
      if (showLoadingState) {
        showWarning('Unable to load files. Please try refreshing the page.');
      }
    } finally {
      if (showLoadingState) setIsLoading(false);
    }
  }, [showError, showWarning]);

  const loadFileContent = useCallback(async (file) => {
    if (!file?.filePath) {
      showError('Invalid file path');
      return;
    }

    setActiveFile({ file: null, content: '', isLoading: true, isReadOnly: false });

    try {
      const filePath = file.filePath;
      const isImage = filePath.match(/\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|tiff|tif)$/i);
      const isVideo = filePath.match(/\.(mp4|webm|avi|mov|wmv|flv)$/i);
      const isAudio = filePath.match(/\.(mp3|wav)$/i);
      const is3DModel = filePath.match(/\.(obj|gltf|glb|fbx|stl|dae|3ds|blend|ply|3mf|usdz|usda|usdc|vrm|vox|c4d)$/i);
      const isPdf = filePath.match(/\.pdf$/i);
      
      let fileWithMetadata = file;
      if (isAudio || isVideo || is3DModel) {
        try {
          const fullMetadata = await fileService.getMetadata(filePath);
          fileWithMetadata = { ...file, ...fullMetadata };
        } catch (metadataError) {
          console.warn('[FilesPage] Failed to fetch full metadata:', metadataError);
        }
      }
      
      const isReadOnlyForUser = await checkIfReadOnly(filePath);

      if (isImage) {
        const imageBlob = await fileService.downloadFile(filePath);
        const imageSrc = URL.createObjectURL(imageBlob);
        
        setActiveFile({ 
          file: { ...fileWithMetadata, isImage: true, type: 'image', imageSrc }, 
          content: '', 
          isLoading: false, 
          isReadOnly: isReadOnlyForUser 
        });
        setLatestVersionContent('');
      } else if (isVideo) {
        const videoSrc = fileService.getStreamingUrl(filePath);
        
        setActiveFile({ 
          file: { ...fileWithMetadata, isVideo: true, type: 'video', videoSrc }, 
          content: '', 
          isLoading: false, 
          isReadOnly: true
        });
        setLatestVersionContent('');
      } else if (isAudio) {
        const audioSrc = fileService.getStreamingUrl(filePath);
        setActiveFile({ 
          file: { ...fileWithMetadata, isAudio: true, type: 'audio', audioSrc }, 
          content: '', 
          isLoading: false, 
          isReadOnly: true
        });
        setLatestVersionContent('');
      } else if (is3DModel) {
        try {
          const blob = await fileService.downloadFile(filePath);
          const blobUrl = URL.createObjectURL(blob);
          
          const modelExt = filePath.split('.').pop()?.toLowerCase() || 'glb';
          setActiveFile({ 
            file: { ...fileWithMetadata, is3DModel: true, type: '3d-model', modelSrc: blobUrl, modelFormat: modelExt, _isBlobUrl: true }, 
            content: '', 
            isLoading: false, 
            isReadOnly: true
          });
          setLatestVersionContent('');
        } catch (error) {
          console.error('Failed to load 3D model:', error);
          showError(`Failed to load 3D model: ${error.message}`);
        }
      } else if (isPdf) {
        try {
          const pdfBlob = await fileService.downloadFile(filePath);
          setActiveFile({
            file: { ...fileWithMetadata, isPdf: true, type: 'pdf', pdfBlob },
            content: '',
            isLoading: false,
            isReadOnly: isReadOnlyForUser
          });
          setLatestVersionContent('');
        } catch (error) {
          console.error('Failed to load PDF:', error);
          showError(`Failed to load PDF: ${error.message}`);
        }
      } else if (file.type === 'text') {
        setActiveFile({ file: { ...file, isImage: false, type: 'text' }, content: '', isLoading: false, isReadOnly: isReadOnlyForUser });

        if (isReadOnlyForUser) {
          try {
            const contentResponse = await fileService.getContent(filePath);
            const textContent = contentResponse?.content ?? contentResponse?.data?.content ?? '';

            setActiveFile((prev) => ({
              ...prev,
              content: typeof textContent === 'string' ? textContent : JSON.stringify(textContent, null, 2)
            }));
          } catch (contentError) {
            console.warn('Failed to load read-only text content:', contentError);
            showWarning('Unable to load file content in read-only mode.');
          }
        }
        // Load latest published version for diff comparison
        try {
          const versionsResponse = await fileService.getFileVersions(filePath);
          const versions = versionsResponse.versions || [];
          
          if (versions.length > 0) {
            const latestVersion = versions[versions.length - 1];
            const versionData = await fileService.loadFileVersion(filePath, latestVersion.version);
            setLatestVersionContent(versionData.content || '');
          } else {
            setLatestVersionContent('');
          }
        } catch (error) {
          console.warn('Failed to load latest version for diff:', error);
          setLatestVersionContent('');
        }
      } else {
        setActiveFile({ file: { ...file, isImage: false, isBinary: true, type: 'binary' }, content: '', isLoading: false, isReadOnly: true });
        setLatestVersionContent('');
      }
    } catch (error) {
      showError(`Failed to load file: ${error.message}`);
      setActiveFile({ file: null, content: '', isLoading: false, isReadOnly: false });
    }
  }, [showError, checkIfReadOnly]);

  const refreshLatestVersionContent = useCallback(async () => {
    if (!activeFile.file?.filePath || activeFile.file.type !== 'text') {
      setLatestVersionContent('');
      return;
    }

    try {
      const versionsResponse = await fileService.getFileVersions(activeFile.file.filePath);
      const versions = versionsResponse.versions || [];
      
      if (versions.length > 0) {
        const latestVersion = versions[versions.length - 1];
        const versionData = await fileService.loadFileVersion(activeFile.file.filePath, latestVersion.version);
        setLatestVersionContent(versionData.content || '');
      } else {
        setLatestVersionContent('');
      }
    } catch (error) {
      console.warn('Failed to refresh latest version for diff:', error);
      setLatestVersionContent('');
    }
  }, [activeFile.file]);
  
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
            if (data.newFilePath) {
              setActiveFile(prev => ({
                ...prev,
                file: { ...prev.file, filePath: data.newFilePath, fileName: data.newFileName }
              }));
            }
            loadFileTree(false);
            break;
          case 'moved':
            if (activeFile.file?.filePath === data.oldFilePath) {
              // If the moved file is currently open, update the active file path
              setActiveFile(prev => ({
                ...prev,
                file: { ...prev.file, filePath: data.newFilePath }
              }));
            }
            loadFileTree(false);
            break;
          case 'version_published':
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
  }, [loadFileTree, clearFileSelection, refreshLatestVersionContent]);
  
  const handleVersionLoaded = useCallback((versionData) => {
    // Handle refresh signal from version operations (publish/delete)
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

  const handleContentChange = useCallback((newContent) => {
    updateContent(newContent);
  }, [updateContent]);

  const handleFileSelect = useCallback(async (filePath, node = null) => {
    setVersionView(null);
    setLatestVersionContent('');
    
    if (!filePath) {
      clearFileSelection();
      return;
    }

    const path = fileService.normalizePath(filePath);
    
    if (node) {
      if (node.type === 'directory') {
        setSelectedDirectory(path);
        return;
      }

      const fileObject = {
        filePath: path,
        name: fileService.getDisplayName(node) || path.split('/').pop(),
        type: node.type || 'file'
      };
      await loadFileContent(fileObject);
      setSelectedDirectory(fileService.getParentPath(path) || '/');
      return;
    }

    try {
      const detectedType = fileService.getFileType(path);
      const fileName = path.split('/').pop() || '';

      const fileObject = {
        filePath: path,
        name: fileName,
        type: detectedType
      };
      await loadFileContent(fileObject);
      setSelectedDirectory(fileService.getParentPath(path) || '/');
    } catch (error) {
      showError(`Failed to load file after operation: ${error.message}`);
    }
  }, [loadFileContent, clearFileSelection, showError]);

  const handleFileAction = useCallback(async (action, resultPath, type) => {
    await loadFileTree(false);
    if (resultPath && type === 'file' && action !== 'delete') {
      await handleFileSelect(resultPath);
    } else {
      clearFileSelection();
    }
  }, [loadFileTree, handleFileSelect, clearFileSelection]);

  const handleQuickActionComplete = useCallback(async (path, type) => {
    await handleFileAction('create', path, type);
    showInfo('Action completed successfully');
  }, [handleFileAction, showInfo]);

  useEffect(() => {
    loadFileTree(true);
  }, [loadFileTree]);

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

  const renderRightContent = () => {
    if (versionView) {
      return (
        <Container layout="flex-column" minHeight="100vh" width="100%" gap="none">
          <Card
            className="version-header-card"
            layout="flex" 
            align="center" 
            justify="between" 
            padding="sm"
            width="100%"
            backgroundColor="background"
          >
            <Container layout="flex" align="center" gap="sm">
              <Icon name="FiGitBranch" size="sm" color="info" />
              <Typography size="xs" color="info">Version {versionView.versionNumber}</Typography>
              <Icon name="FiLock" size="sm" color="warning" />
              <Typography size="xs" color="warning">READ-ONLY</Typography>
            </Container>

            <Typography weight="semibold">{versionView.name}</Typography>
            
            <Container layout="flex" align="center" gap="sm">
              <Button 
                color="primary" 
                size="sm"
                onClick={() => setVersionView(null)}
              >
                <Icon name="FiArrowLeft" size="sm" />
                Back to Current Version
              </Button>
              <Typography size="xs">
                {versionView.originalFile.filePath}
              </Typography>
            </Container>
          </Card>

          <Container layout="flex" align="center" justify="center" minHeight="80vh" width="100%" padding="sm">
            <Editor
              key={`version-editor-${versionView.versionNumber}`}
              content={versionView.content}
              placeholder="Version content..."
              showToolbar={false}
              readOnly={true}
              width="100%"
              minHeight="80vh"
            />
          </Container>

          <Card className="version-footer-card" padding="xs" width="100%" backgroundColor="surface" margin="none">
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
    
    if (activeFile.isLoading) {
      return (
        <Container layout="flex" align="center" justify="center" minHeight="100vh" width="100%">
          <Container layout="flex-column" align="center" gap="md">
            <CircularProgress size="lg" />
            <Typography>Loading file...</Typography>
          </Container>
        </Container>
      );
    }

    if (!activeFile.file) {
      return (
        <Container layout="flex" align="center" justify="center" minHeight="100vh" width="100%">
          <Container layout="flex-column" align="center" gap="md">
            <Icon name="FiFile" size="48" />
            <Typography size="lg">Select a file to view its content</Typography>
            <Typography size="sm">
              Use the file explorer on the left to browse and select files
            </Typography>
          </Container>
        </Container>
      );
    }

    const resolvedEditorContent =
      activeFile.file.type === 'text' && activeFile.isReadOnly && (!fileContent || fileContent.length === 0)
        ? activeFile.content
        : fileContent;

    return (
      <Container layout="flex-column" minHeight="100vh" width="100%" gap="none">
        <Card
          className="file-header-card"
          layout="flex" 
          align="center" 
          justify="between" 
          padding="sm"
          width="100%"
          
        >
          <Container layout="flex" align="center" gap="sm" padding="none">
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
                    <Icon name="FiFile" size="sm" />
                    <Typography size="xs">BINARY</Typography>
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
          </Container>
        </Card>

        <Container layout="flex" align="center" justify="center" minHeight="80vh" width="100%" padding="sm">
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
              content={resolvedEditorContent}
              diffContent={latestVersionContent}
              onChange={handleContentChange}
              placeholder={activeFile.isReadOnly ? "This file is read-only for you" : "Start typing..."}
              showToolbar={!activeFile.isReadOnly}
              readOnly={activeFile.isReadOnly}
              width="100%"
              minHeight="80vh"
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
              height="80vh"
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
              height="80vh"
              environment="studio"
              showGrid={true}
              showShadows={true}
              cameraFov={50}
            />
          ) : (
            <Container layout="flex" align="center" justify="center" minHeight="400px">
              <Container layout="flex-column" align="center" gap="md">
                <Icon name="FiFile" size="48" />
                <Typography size="lg">Binary File</Typography>
                <Typography size="sm">
                  This file cannot be edited directly. Use the download button above.
                </Typography>
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
        {renderRightContent()}
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
            <Explorer
              width="320px"
              fileTree={fileTree}
              currentPath={activeFile.file?.filePath || selectedDirectory}
              includeFiles={true}
              hideTitle={true}
              showSelector={true}
              buttonLabel={null}
              onFileAction={handleFileAction}
              onPathSelect={handleFileSelect}
              showIcons={true}
              showContextActions={true}
              contentPadding="none"
            />
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
              targetPath={selectedDirectory}
              fileTree={fileTree}
              onActionComplete={handleQuickActionComplete}
            />
          ),
          trigger: 'click'
        }}
      />
    </Page>
  );
};

export default FilesPage;
