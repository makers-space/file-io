import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CircularProgress, Container, Data, Icon, Input, Select, TreeView, Typography } from './Components';
import { fileService } from '../client/file.client';
import { useNotification } from '../contexts/NotificationContext';

// File icon mapping utility function
const getFileIcon = (fileType, fileName = '') => {
    // Handle directory first
    if (fileType === 'directory') {
        return 'FiFolder';
    }

    // Get file extension for more specific categorization
    const ext = fileName.toLowerCase().split('.').pop();

    // Categorize based on extension
    const extToTypeMap = {
        // Images
        'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image',
        'svg': 'image', 'bmp': 'image', 'webp': 'image',

        // Documents
        'pdf': 'document', 'doc': 'document', 'docx': 'document',
        'txt': 'document', 'md': 'document', 'rtf': 'document',

        // Code files
        'js': 'code', 'jsx': 'code', 'ts': 'code', 'tsx': 'code',
        'html': 'code', 'css': 'code', 'json': 'code', 'xml': 'code',
        'py': 'code', 'java': 'code', 'c': 'code', 'cpp': 'code',

        // Archives
        'zip': 'archive', 'rar': 'archive', 'tar': 'archive', 'gz': 'archive',
        '7z': 'archive', 'bz2': 'archive',

        // Media
        'mp4': 'video', 'avi': 'video', 'mov': 'video', 'wmv': 'video',
        'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'm4a': 'audio'
    };

    const categorizedType = extToTypeMap[ext] || 'file';

    const iconMap = {
        directory: 'FiFolder',
        image: 'FiImage',
        document: 'FiFile',
        code: 'FiCode',
        archive: 'FiArchive',
        video: 'FiVideo',
        audio: 'FiMusic',
        file: 'FiFile'
    };

    return iconMap[categorizedType] || 'FiFile';
};

// Form components for file/directory actions
const CreateFileForm = ({targetPath, onSuccess}) => {
    const [fileName, setFileName] = useState('');
    const [content, setContent] = useState('');
    const {error: showError} = useNotification();

    const handleSubmit = async () => {
        if (!fileName.trim()) {
            showError('File name is required');
            return;
        }

        try {
            const safePath = fileService.normalizePath(targetPath);
            const fullPath = `${safePath}/${fileName}`.replace(/\/+/g, '/');
            await fileService.createFile(fullPath, content, 'File created via explorer context menu');
            onSuccess?.(fullPath, 'file');
        } catch (err) {
            showError(`Failed to create file: ${err.message}`);
        }
    };

    return (
        <Container layout="flex-column" gap="sm" width="300px" padding="md">
            <Typography variant="h6" size="sm" weight="semibold">
                📄 New File
            </Typography>
            <Typography size="xs">
                Creating in: {targetPath}
            </Typography>

            <Input
                label="File Name"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter file name"
                width="100%"
                autoFocus
            />

            <Input
                label="Initial Content (optional)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter initial content"
                multiline
                rows={3}
                width="100%"
            />

            <Container layout="flex-row" gap="sm" justify="end">
                <Button size="sm" variant="secondary">
                    Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleSubmit}>
                    Create File
                </Button>
            </Container>
        </Container>
    );
};

const CreateDirectoryForm = ({targetPath, onSuccess}) => {
    const [dirName, setDirName] = useState('');
    const [description, setDescription] = useState('');
    const {error: showError} = useNotification();

    const handleSubmit = async () => {
        if (!dirName.trim()) {
            showError('Directory name is required');
            return;
        }

        try {
            const safePath = fileService.normalizePath(targetPath);
            const fullPath = `${safePath}/${dirName}`.replace(/\/+/g, '/');
            await fileService.createDirectory(fullPath, description || 'Directory created via explorer context menu');
            onSuccess?.(fullPath, 'directory');
        } catch (err) {
            showError(`Failed to create directory: ${err.message}`);
        }
    };

    return (
        <Container layout="flex-column" gap="sm" width="300px" padding="md">
            <Typography variant="h6" size="sm" weight="semibold">
                📁 New Directory
            </Typography>
            <Typography size="xs">
                Creating in: {targetPath}
            </Typography>

            <Input
                label="Directory Name"
                value={dirName}
                onChange={(e) => setDirName(e.target.value)}
                placeholder="Enter directory name"
                width="100%"
                autoFocus
            />

            <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                width="100%"
            />

            <Container layout="flex-row" gap="sm" justify="end">
                <Button size="sm" variant="secondary">
                    Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleSubmit}>
                    Create Directory
                </Button>
            </Container>
        </Container>
    );
};

const DeleteConfirmForm = ({filePath, isDirectory, onSuccess}) => {
    const [force, setForce] = useState(isDirectory); // Default to true for directories
    const {error: showError, success: showSuccess} = useNotification();

    const handleSubmit = async () => {
        try {
            // Use the improved deleteFile method with options
            await fileService.deleteFile(filePath, {force});

            // Show success message
            showSuccess(`${isDirectory ? 'Directory' : 'File'} deleted successfully`);

            // Call success callback
            onSuccess?.(filePath, isDirectory ? 'directory' : 'file');

        } catch (err) {
            showError(`Failed to delete ${isDirectory ? 'directory' : 'file'}: ${err.message}`);
        }
    };

    return (
        <Container layout="flex-column" gap="sm" width="300px" padding="md">
            <Typography variant="h6" size="sm" weight="semibold" color="error">
                🗑️ Delete {isDirectory ? 'Directory' : 'File'}
            </Typography>
            <Typography size="xs">
                {filePath}
            </Typography>

            <Typography size="sm" color="warning">
                This action cannot be undone.
            </Typography>

            {isDirectory && (
                <Container layout="flex-row" gap="sm" alignz="center">
                    <input
                        type="checkbox"
                        checked={force}
                        onChange={(e) => setForce(e.target.checked)}
                    />
                    <Typography size="xs">
                        Force delete (remove all contents)
                    </Typography>
                </Container>
            )}

            <Container layout="flex-row" gap="sm" justify="end">
                <Button size="sm" variant="secondary">
                    Cancel
                </Button>
                <Button size="sm" variant="error" onClick={handleSubmit}>
                    Delete
                </Button>
            </Container>
        </Container>
    );
};

const CopyMoveForm = ({filePath, operation, fileTree, onSuccess}) => {
    const [destinationPath, setDestinationPath] = useState('');
    const {error: showError} = useNotification();

    const handleSubmit = async () => {
        if (!destinationPath.trim()) {
            showError('Please select a destination directory');
            return;
        }

        try {
            const normalizedDest = fileService.normalizePath(destinationPath);

            if (operation === 'copy') {
                await fileService.copyFile(filePath, normalizedDest);
                // For copy operation, construct the full path of the copied file
                const fileName = filePath.split('/').pop();
                const copiedFilePath = `${normalizedDest}/${fileName}`.replace(/\/+/g, '/');
                onSuccess?.(copiedFilePath, 'file');
            } else {
                await fileService.moveFile(filePath, normalizedDest);
                // For move operation, construct the full path of the moved file
                const fileName = filePath.split('/').pop();
                const movedFilePath = `${normalizedDest}/${fileName}`.replace(/\/+/g, '/');
                onSuccess?.(movedFilePath, 'file');
            }

        } catch (err) {
            showError(`Failed to ${operation} item: ${err.message}`);
        }
    };

    return (
        <Container layout="flex-column" gap="sm" width="350px" padding="md">
            <Typography variant="h6" size="sm" weight="semibold">
                {operation === 'copy' ? '📋 Copy' : '📦 Move'} Item
            </Typography>
            <Typography size="xs">
                Source: {filePath}
            </Typography>


            {destinationPath && (
                <Typography size="xs" color="success">
                    Selected: {destinationPath}
                </Typography>
            )}
            <DirectorySelector
                fileTree={fileTree}
                selectedPath={destinationPath}
                onSelect={setDestinationPath}
                width="100%"
            />

            <Container layout="flex-row" gap="sm" justify="end">
                <Button size="sm" variant="secondary">
                    Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleSubmit}>
                    {operation === 'copy' ? 'Copy' : 'Move'}
                </Button>
            </Container>
        </Container>
    );
};

const RenameForm = ({filePath, isDirectory, onSuccess}) => {
    const currentName = filePath.split('/').pop();
    const [newName, setNewName] = useState(currentName);
    const {error: showError} = useNotification();

    const handleSubmit = async () => {
        if (!newName.trim()) {
            showError('Name is required');
            return;
        }

        if (newName === currentName) {
            showError('Please enter a different name');
            return;
        }

        try {
            const result = await fileService.renameFile(filePath, newName.trim());
            const newPath = result.newPath || filePath; // Fallback to original path if not provided
            onSuccess?.(newPath, 'rename');
        } catch (err) {
            showError(`Failed to rename: ${err.message}`);
        }
    };

    return (
        <Container layout="flex-column" gap="sm" width="300px" padding="md">
            <Typography variant="h6" size="sm" weight="semibold">
                ✏️ Rename {isDirectory ? 'Directory' : 'File'}
            </Typography>
            <Typography size="xs">
                {filePath}
            </Typography>

            <Input
                label="New Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
                width="100%"
                autoFocus
            />

            <Container layout="flex-row" gap="sm" justify="end">
                <Button size="sm" variant="secondary">
                    Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleSubmit}>
                    Rename
                </Button>
            </Container>
        </Container>
    );
};

const UploadForm = ({targetPath, onSuccess}) => {
    const [files, setFiles] = useState([]);
    const [overwrite, setOverwrite] = useState(false);
    const {error: showError, success: showSuccess} = useNotification();

    const handleSubmit = async () => {
        if (files.length === 0) {
            showError('Please select files to upload');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('basePath', targetPath);

            if (files.length === 1) {
                formData.append('file', files[0]);
                await fileService.uploadFile(formData);
                showSuccess('File uploaded successfully');
            } else {
                files.forEach(file => formData.append('files', file));
                await fileService.uploadMultipleFiles(formData);
                showSuccess(`${files.length} files uploaded successfully`);
            }

            onSuccess?.(targetPath, 'upload');
        } catch (err) {
            showError(`Failed to upload files: ${err.message}`);
        }
    };

    return (
        <Container layout="flex-column" gap="sm" width="300px" padding="md">
            <Typography variant="h6" size="sm" weight="semibold">
                📤 Upload Files
            </Typography>
            <Typography size="xs">
                Upload to: {targetPath}
            </Typography>

            <Input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                width="100%"
            />

            {files.length > 0 && (
                <Container layout="flex-column" gap="xs">
                    <Typography size="xs" weight="semibold">
                        Selected files ({files.length}):
                    </Typography>
                    {files.slice(0, 3).map((file, index) => (
                        <Typography key={index} size="xs">
                            • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </Typography>
                    ))}
                    {files.length > 3 && (
                        <Typography size="xs">
                            ... and {files.length - 3} more
                        </Typography>
                    )}
                </Container>
            )}

            <Container layout="flex-row" gap="sm" justify="end">
                <Button size="sm" variant="secondary">
                    Cancel
                </Button>
                <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={files.length === 0}
                >
                    Upload
                </Button>
            </Container>
        </Container>
    );
};

const PublishForm = ({filePath, onSuccess}) => {
    const [message, setMessage] = useState('');
    const {error: showError} = useNotification();

    const handleSubmit = async () => {
        try {
            await fileService.publishFile(filePath, message || 'Published via context menu');
            onSuccess?.(filePath, 'publish');
        } catch (err) {
            showError(`Failed to publish file: ${err.message}`);
        }
    };

    return (
        <Container layout="flex-column" gap="sm" width="300px" padding="md">
            <Typography variant="h6" size="sm" weight="semibold">
                📦 Publish File
            </Typography>
            <Typography size="xs">
                {filePath}
            </Typography>

            <Typography size="xs" color="info">
                Publishing creates a new version snapshot of the current file content.
            </Typography>

            <Input
                label="Version Message (optional)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe this version..."
                width="100%"
                multiline
                rows={2}
                autoFocus
            />

            <Container layout="flex-row" gap="sm" justify="end">
                <Button size="sm" variant="secondary">
                    Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleSubmit}>
                    Publish
                </Button>
            </Container>
        </Container>
    );
};

/**
 * ShareForm - Enhanced share form with user selection via Data component
 * Uses public users endpoint that returns limited user info
 * Exported for reuse in other components
 */
export const ShareForm = ({filePath, isDirectory, onSuccess}) => {
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [permission, setPermission] = useState('read');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const {error: showError, success: showSuccess} = useNotification();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                // Import userService dynamically to avoid circular dependencies
                const {default: userService} = await import('../client/user.client');
                const response = await userService.getPublicUsers({limit: 1000, active: true});
                setAllUsers(response.users || []);
            } catch (error) {
                console.error('Error fetching users:', error);
                showError('Failed to load users');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const handleSubmit = async () => {
        if (selectedUsers.length === 0) {
            showError('Please select at least one user');
            return;
        }

        setIsSubmitting(true);
        try {
            await fileService.shareFile(filePath, selectedUsers, permission);
            showSuccess(`${isDirectory ? 'Directory' : 'File'} shared with ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`);
            onSuccess?.(filePath, 'share');
        } catch (err) {
            showError(`Failed to share ${isDirectory ? 'directory' : 'file'}: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <Container layout="flex-column" gap="md" padding="md" width="600px" align="center">
                <CircularProgress size="lg"/>
                <Typography>Loading users...</Typography>
            </Container>
        );
    }

    return (
        <Container layout="flex-column" gap="md" padding="md" width="600px">
            <Typography weight="semibold" size="sm">
                � Share {isDirectory ? 'Directory' : 'File'}
            </Typography>
            <Typography size="xs">
                {filePath}
            </Typography>

            <Data
                data={allUsers.map(user => ({
                    id: user.id,
                    name: `${user.firstName} ${user.lastName}`,
                    username: user.username,
                    email: user.email
                }))}
                selector={true}
                selectedItems={selectedUsers}
                onSelectionChange={(newSelectedItems, selectedIds) => {
                    setSelectedUsers(selectedIds);
                }}
                paginated={false}
                searchable={true}
                variant="table"
            />

            <Select
                label="Permission Level"
                value={permission}
                onChange={setPermission}
                options={[
                    {value: 'read', label: 'Read Only'},
                    {value: 'write', label: 'Read & Write'}
                ]}
                width="100%"
                size="sm"
            />

            <Container layout="flex" gap="sm" justify="end">
                <Button
                    size="sm"
                    variant="secondary"
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={selectedUsers.length === 0 || isSubmitting}
                >
                    {isSubmitting ? 'Sharing...' : `Share with ${selectedUsers.length} user${selectedUsers.length !== 1 ? 's' : ''}`}
                </Button>
            </Container>
        </Container>
    );
};

// Simple Directory Selector component reusing Explorer logic
const DirectorySelector = ({fileTree, onSelect, selectedPath = '', width = '100%'}) => {
    const [expandedNodes, setExpandedNodes] = useState(new Set([selectedPath, '/']));

    // Reuse the same directory filtering logic from Explorer
    const filteredTree = useMemo(() => {
        if (!fileTree || Object.keys(fileTree).length === 0) {
            return {};
        }

        const filterTree = (tree, parentPath = '') => {
            const filtered = {};

            Object.entries(tree).forEach(([key, node]) => {
                // Only include directories
                if (node.type === 'directory') {
                    const rawPath = node.filePath ?? (parentPath ? `${parentPath}/${key}` : key);
                    const filePath = fileService.normalizePath(rawPath);
                    const displayName = fileService.getDisplayName(node) || key;
                    const fileIcon = getFileIcon('directory', displayName);

                    let filteredChildren = {};
                    if (node.children) {
                        filteredChildren = filterTree(node.children, filePath);
                    }

                    filtered[filePath] = {
                        ...node,
                        filePath: filePath,
                        fileName: displayName,
                        icon: fileIcon,
                        children: filteredChildren,
                        metadata: {
                            ...(node.metadata || {}),
                            type: node.type,
                            filePath: filePath
                        }
                    };
                }
            });

            return filtered;
        };

        return filterTree(fileTree, '');
    }, [fileTree]);

    const handleNodeSelect = useCallback((nodeId, isSelected) => {
        if (isSelected && onSelect) {
            onSelect(fileService.normalizePath(nodeId));
        }
    }, [onSelect]);

    const handleNodeExpand = useCallback((nodeId, isExpanded) => {
        setExpandedNodes(prev => {
            const newExpanded = new Set(prev);
            if (isExpanded) {
                newExpanded.add(nodeId);
            } else {
                newExpanded.delete(nodeId);
            }
            return newExpanded;
        });
    }, []);

    return (
        <Container layout="flex-column" gap="sm" width={width}>
            {Object.keys(filteredTree).length > 0 ? (
                <TreeView
                    data={filteredTree}
                    onNodeSelect={handleNodeSelect}
                    selectedNodes={[selectedPath]}
                    expandedNodes={Array.from(expandedNodes)}
                    onNodeExpand={handleNodeExpand}
                    color="surface"
                    size="sm"
                    showIcons={true}
                    width={width}
                    searchable
                    searchPlaceholder="Search directories..."
                />
            ) : (
                <Typography size="sm">
                    No directories available
                </Typography>
            )}
        </Container>
    );
};

/**
 * Explorer - A reusable component for directory browsing and selection
 *
 * Features:
 * - Toggle explorer visibility
 * - Search within directory structure
 * - Select files and directories from tree view
 * - Expanded/collapsed state management
 * - Path display and formatting
 * - Configurable file/directory filtering
 * - Context menu actions via direct genie integration
 *
 * @param {Object} props Component properties
 * @param {Object} props.fileTree The complete file tree structure
 * @param {string} props.currentPath Current selected path
 * @param {boolean} props.includeFiles Whether to include files in the tree (default: true)
 * @param {Function} props.onPathSelect Callback when a path is selected
 * @param {boolean} props.showSelector Whether to show the explorer initially
 * @param {string} props.buttonLabel Custom label for toggle button (optional)
 * @param {string} props.toggleButtonSize Size of toggle button ('small', 'medium', etc.)
 * @param {string} props.toggleButtonVariant Variant of toggle button ('primary', 'secondary', etc.)
 * @param {string} props.width Width of explorer container
 * @param {string} props.height Height of explorer container (default: 'auto')
 * @param {string} props.minHeight Minimum height of explorer container
 * @param {boolean} props.showIcons Whether to show icons in the tree view
 * @param {boolean} props.hideTitle Whether to hide the title (default: false)
 * @param {boolean} props.showContextActions Whether to show context menu actions (default: true)
 * @param {Function} props.onFileAction Callback for file actions (create, delete, etc.)
 * @param {string} props.contentPadding Internal padding for the explorer content area (default: 'sm')
 */
const Explorer = ({
                      fileTree,
                      currentPath,
                      includeFiles = true,
                      onPathSelect,
                      showSelector = false,
                      buttonLabel,
                      toggleButtonSize = 'small',
                      toggleButtonVariant = 'secondary',
                      width = '100%',
                      height = 'auto',
                      minHeight = null, // Minimum height value (e.g., '200px', '10rem', '50vh')
                      showIcons = true,
                      hideTitle = false,
                      showContextActions = true,
                      onFileAction,
                      contentPadding = 'sm'
                  }) => {
    // Local state
    const [selectorState, setSelectorState] = useState({
        showSelector: showSelector,
        selectedPath: currentPath,
        expandedNodes: new Set([currentPath, '/'])
    });

    // Update state when props change
    useEffect(() => {
        const normalizedPath = fileService.normalizePath(currentPath);
        setSelectorState(prev => ({
            ...prev,
            selectedPath: normalizedPath,
            showSelector: showSelector,
            expandedNodes: new Set([...prev.expandedNodes, normalizedPath, '/'])
        }));
    }, [currentPath, showSelector]);

    // Filter the file tree based on includeFiles option
    const filteredTree = useMemo(() => {
        // Early return if no fileTree data
        if (!fileTree || Object.keys(fileTree).length === 0) {
            return {};
        }

        // Filter the file tree based on type
        const filterTree = (tree, parentPath = '', depth = 0) => {
            if (!tree || Object.keys(tree).length === 0) {
                return {};
            }

            const filtered = {};

            Object.entries(tree).forEach(([key, node]) => {
                // Include directories
                if (node.type === 'directory') {
                    const rawPath = node.filePath ?? (parentPath ? `${parentPath}/${key}` : key);
                    const filePath = fileService.normalizePath(rawPath);
                    const displayName = fileService.getDisplayName(node) || key;

                    // Get file type and appropriate icon
                    const isDirectory = node.type === 'directory';
                    const fileType = isDirectory ? 'directory' : node.type || 'file';
                    const fileIcon = getFileIcon(fileType, displayName);

                    // For directories, recursively filter children
                    let filteredChildren = {};
                    if (isDirectory && node.children) {
                        filteredChildren = filterTree(node.children, filePath, depth + 1);
                    }

                    filtered[filePath] = {
                        ...node,
                        // Standardize the node structure
                        filePath: filePath,
                        fileName: displayName,
                        // Add the file-specific icon
                        icon: fileIcon,
                        // Include filtered children
                        children: filteredChildren,
                        metadata: {
                            ...(node.metadata || {}),
                            type: node.type,
                            filePath: filePath
                        }
                    };
                }
                // Include files only if includeFiles is true
                else if (includeFiles && (node.type === 'binary' || node.type === 'text')) {
                    const rawPath = node.filePath ?? (parentPath ? `${parentPath}/${key}` : key);
                    const filePath = fileService.normalizePath(rawPath);
                    const displayName = fileService.getDisplayName(node) || key;

                    // Get file type and appropriate icon
                    const fileType = node.type || 'file';
                    const fileIcon = getFileIcon(fileType, displayName);

                    filtered[filePath] = {
                        ...node,
                        // Standardize the node structure
                        filePath: filePath,
                        fileName: displayName,
                        // Add the file-specific icon
                        icon: fileIcon,
                        metadata: {
                            ...(node.metadata || {}),
                            type: node.type,
                            filePath: filePath
                        }
                    };
                }
            });

            return filtered;
        };

        return filterTree(fileTree, '', 0);
    }, [fileTree]);

    // Filter items based on search query
    // Toggle directory explorer visibility
    const toggleSelector = useCallback(() => {
        setSelectorState(prev => ({...prev, showSelector: !prev.showSelector}));
    }, []);

    // Handle node selection (files or directories)
    const handleNodeSelect = useCallback((nodeId, isSelected, selectedNodes) => {
        if (!isSelected) return; // Only handle selection, not deselection

        // Update internal selection state with normalized path
        const normalizedPath = fileService.normalizePath(nodeId);
        setSelectorState(prev => ({...prev, selectedPath: normalizedPath}));

        // Call onPathSelect if provided to handle file opening
        if (onPathSelect) {
            // Simple recursive search using filePath as the only identifier
            const findNodeByPath = (tree, targetPath) => {
                const normalizedTarget = fileService.normalizePath(targetPath);

                for (const node of Object.values(tree)) {
                    const normalizedNodePath = fileService.normalizePath(node.filePath || 'unknown');

                    if (normalizedNodePath === normalizedTarget) {
                        return node;
                    }

                    if (node.children) {
                        const found = findNodeByPath(node.children, targetPath);
                        if (found) return found;
                    }
                }
                return null;
            };

            const actualNode = findNodeByPath(fileTree, nodeId);

            if (actualNode) {
                onPathSelect(nodeId, actualNode);
            } else {
                // Could not find node - handle silently
            }
        }
    }, [onPathSelect, fileTree]);

    // Handle search input change
    // Handle node expansion/collapse
    const handleNodeExpand = useCallback((nodeId, isExpanded) => {
        setSelectorState(prev => {
            const newExpanded = new Set(prev.expandedNodes);
            if (isExpanded) {
                newExpanded.add(nodeId);
            } else {
                newExpanded.delete(nodeId);
            }
            return {...prev, expandedNodes: newExpanded};
        });
    }, []);

    return (
        <Container
            padding="none"
            width={width}
            height={height}
        >
            {/* Toggle Button - only render if buttonLabel is not null */}
            {buttonLabel !== null && (
                <Button
                    variant={toggleButtonVariant}
                    size={toggleButtonSize}
                    onClick={toggleSelector}
                >
                    <Icon name="FiFolderPlus" size="14px"/>
                    {buttonLabel || (selectorState.showSelector ? ' Hide' : ' Browse')}
                </Button>
            )}

            {/* Directory Explorer */}
            {selectorState.showSelector && (
                <Card
                    padding="none"
                    width={width}
                    height={height}
                    minHeight={minHeight}
                    layout="flex-column"
                >
                    <Container layout="flex-column" gap="sm" width="100%" flexFill padding={contentPadding}>
                        {!hideTitle && (
                            <Typography size="sm" weight="medium">
                                Select Directory
                            </Typography>
                        )}

                        {/* File/Directory TreeView */}
                        <Container width="100%" flexFill>
                            {Object.keys(filteredTree).length > 0 ? (
                                <TreeView
                                    data={filteredTree}
                                    onNodeSelect={handleNodeSelect}
                                    selectedNodes={[selectorState.selectedPath]}
                                    expandedNodes={Array.from(selectorState.expandedNodes)}
                                    onNodeExpand={handleNodeExpand}
                                    color="surface"
                                    size="sm"
                                    showIcons={showIcons}
                                    width="100%"
                                    searchable
                                    searchPlaceholder="Filter directories..."
                                    getNodeGenie={showContextActions ? (node, nodeState) => {
                                        // Direct genie implementation for files and directories
                                        const isDirectory = node.metadata.type === 'directory';
                                        const filePath = node.filePath || node.id;
                                        const displayName = node.fileName || node.label || filePath.split('/').pop();

                                        return {
                                            content: (
                                                <Container layout="flex-column" gap="sm" width="250px" padding="md">
                                                    <Typography as="h6" size="sm" weight="semibold">
                                                        {isDirectory ? '📁' : '📄'} {displayName}
                                                    </Typography>
                                                    <Typography size="xs">
                                                        {filePath}
                                                    </Typography>

                                                    <Container layout="flex-column" gap="xs">
                                                        {isDirectory ? (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiFilePlus"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <CreateFileForm
                                                                                targetPath={filePath}
                                                                                onSuccess={(newPath, type) => {
                                                                                    onFileAction?.('create', newPath, type);
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    New File
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiFolderPlus"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <CreateDirectoryForm
                                                                                targetPath={filePath}
                                                                                onSuccess={(newPath, type) => {
                                                                                    onFileAction?.('create', newPath, type);
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    New Folder
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiUpload"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <UploadForm
                                                                                targetPath={filePath}
                                                                                onSuccess={(path, action) => {
                                                                                    onFileAction?.(action, path, 'upload');
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Upload Files
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiCopy"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <CopyMoveForm
                                                                                filePath={filePath}
                                                                                operation="copy"
                                                                                fileTree={fileTree}
                                                                                onSuccess={(newPath, type) => {
                                                                                    onFileAction?.('copy', newPath, type);
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Copy
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiMove"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <CopyMoveForm
                                                                                filePath={filePath}
                                                                                operation="move"
                                                                                fileTree={fileTree}
                                                                                onSuccess={(newPath, type) => {
                                                                                    onFileAction?.('move', newPath, type);
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Move
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiEdit2"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <RenameForm
                                                                                filePath={filePath}
                                                                                isDirectory={true}
                                                                                onSuccess={(newPath, action) => {
                                                                                    onFileAction?.(action, newPath, 'directory');
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Rename
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiShare2"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <ShareForm
                                                                                filePath={filePath}
                                                                                isDirectory={true}
                                                                                onSuccess={(path, action) => {
                                                                                    onFileAction?.(action, path, 'directory');
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Share
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiEdit2"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <RenameForm
                                                                                filePath={filePath}
                                                                                isDirectory={false}
                                                                                onSuccess={(newPath, action) => {
                                                                                    onFileAction?.(action, newPath, 'file');
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Rename
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiCopy"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <CopyMoveForm
                                                                                filePath={filePath}
                                                                                operation="copy"
                                                                                fileTree={fileTree}
                                                                                onSuccess={(newPath, type) => {
                                                                                    onFileAction?.('copy', newPath, type);
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Copy
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiMove"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <CopyMoveForm
                                                                                filePath={filePath}
                                                                                operation="move"
                                                                                fileTree={fileTree}
                                                                                onSuccess={(newPath, type) => {
                                                                                    onFileAction?.('move', newPath, type);
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Move
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    width="100%"
                                                                    icon="FiShare2"
                                                                    genie={{
                                                                        content: ({onHide}) => (
                                                                            <ShareForm
                                                                                filePath={filePath}
                                                                                isDirectory={false}
                                                                                onSuccess={(path, action) => {
                                                                                    onFileAction?.(action, path, 'file');
                                                                                }}
                                                                            />
                                                                        ),
                                                                        trigger: 'click',
                                                                        position: 'right'
                                                                    }}
                                                                >
                                                                    Share
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            width="100%"
                                                            icon="FiTrash2"
                                                            variant="error"
                                                            genie={{
                                                                content: ({onHide}) => (
                                                                    <DeleteConfirmForm
                                                                        filePath={filePath}
                                                                        isDirectory={isDirectory}
                                                                        onSuccess={(deletedPath, type) => {
                                                                            onFileAction?.('delete', deletedPath, type);
                                                                        }}
                                                                    />
                                                                ),
                                                                trigger: 'click',
                                                                position: 'right'
                                                            }}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </Container>
                                                </Container>
                                            ),
                                            trigger: 'contextmenu',
                                            position: 'auto'
                                        };
                                    } : undefined}
                                />
                            ) : (
                                <Typography size="sm">
                                    No directories available
                                </Typography>
                            )}
                        </Container>
                    </Container>

                    {/* Selected Path Display - Always at bottom with no space below */}
                    {selectorState.selectedPath && (
                        <Container
                            style={{
                                marginTop: 'auto'
                            }}
                        >
                            <Typography size="xs" color="tertiary">
                                Selected: {selectorState.selectedPath}
                            </Typography>
                        </Container>
                    )}
                </Card>
            )}
        </Container>
    );
};

export default Explorer;
