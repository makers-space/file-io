import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, Icon, Input, Typography } from './Components';
import './styles/FileCard.css';

const FILE_ICONS = {
    directory: 'FiFolder',
    js: 'FiCode', ts: 'FiCode', jsx: 'FiCode', tsx: 'FiCode',
    py: 'FiCode', go: 'FiCode', rs: 'FiCode', java: 'FiCode',
    md: 'FiFileText', txt: 'FiFileText', json: 'FiFileText',
    html: 'FiCode', css: 'FiCode', yaml: 'FiFileText', xml: 'FiFileText',
    jpg: 'FiImage', jpeg: 'FiImage', png: 'FiImage', gif: 'FiImage',
    webp: 'FiImage', svg: 'FiImage',
    mp4: 'FiFilm', webm: 'FiFilm', avi: 'FiFilm', mov: 'FiFilm',
    mp3: 'FiMusic', wav: 'FiMusic', flac: 'FiMusic', aac: 'FiMusic',
    pdf: 'FiFileText', xlsx: 'FiFileText', docx: 'FiFileText',
    zip: 'FiArchive', rar: 'FiArchive', tar: 'FiArchive',
    glb: 'FiBox', gltf: 'FiBox',
};

const getFileIcon = (file) => {
    if (file.type === 'directory') return 'FiFolder';
    const ext = file.fileName?.split('.').pop()?.toLowerCase();
    return FILE_ICONS[ext] || 'FiFile';
};

const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const FileListRow = ({ file, onDelete, onRename, onDownload, selected, onSelect, selectionMode, renderShareForm, renderMoveForm, renderCopyForm }) => {
    const navigate = useNavigate();
    const [menuView, setMenuView] = useState('actions');
    const [renameValue, setRenameValue] = useState(file.fileName);

    const handleOpen = () => {
        if (selectionMode) {
            onSelect?.(file._id);
            return;
        }
        navigate('/files' + file.filePath);
    };

    const resetMenu = () => {
        setMenuView('actions');
        setRenameValue(file.fileName);
    };

    const contextMenu = (
        <Container layout="flex-column" gap="xs" padding="xs" style={{ minWidth: '200px' }}>
            {menuView === 'actions' && (
                <>
                    <Container layout="flex-column" gap="none" padding="xs" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <Typography size="xs" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.fileName}
                        </Typography>
                        {file.type !== 'directory' && (
                            <Typography size="xs" color="secondary">
                                {formatSize(file.size)} · {file.type || 'file'}
                            </Typography>
                        )}
                        <Typography size="xs" color="secondary">
                            Modified {formatDate(file.updatedAt)}
                        </Typography>
                        {file.filePath && (
                            <Typography size="xs" color="secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.filePath}
                            </Typography>
                        )}
                    </Container>
                    <Button size="xs" align="left" width="100%" onClick={handleOpen}>
                        <Icon name={file.type === 'directory' ? 'FiFolder' : 'FiEdit2'} size="xs" />
                        {file.type === 'directory' ? 'Open' : 'Edit'}
                    </Button>
                    {file.type !== 'directory' && (
                        <Button size="xs" align="left" width="100%" onClick={() => onDownload?.(file)}>
                            <Icon name="FiDownload" size="xs" />
                            Download
                        </Button>
                    )}
                    <Button size="xs" align="left" width="100%" onClick={() => setMenuView('share')}>
                        <Icon name="FiShare2" size="xs" />
                        Share
                    </Button>
                    <Button size="xs" align="left" width="100%" onClick={() => { setRenameValue(file.fileName); setMenuView('rename'); }}>
                        <Icon name="FiEdit" size="xs" />
                        Rename
                    </Button>
                    <Button size="xs" align="left" width="100%" onClick={() => setMenuView('copy')}>
                        <Icon name="FiCopy" size="xs" />
                        Make a copy
                    </Button>
                    <Button size="xs" align="left" width="100%" onClick={() => setMenuView('move')}>
                        <Icon name="FiMove" size="xs" />
                        Move to
                    </Button>
                    <Button size="xs" align="left" width="100%" color="error" onClick={() => setMenuView('delete')}>
                        <Icon name="FiTrash2" size="xs" />
                        Delete
                    </Button>
                </>
            )}

            {menuView === 'rename' && (
                <>
                    <Typography size="xs" weight="semibold">Rename</Typography>
                    <Input
                        size="sm"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameValue.trim() && renameValue !== file.fileName) {
                                onRename?.(file, renameValue.trim());
                                resetMenu();
                            }
                            if (e.key === 'Escape') resetMenu();
                        }}
                        autoFocus
                        width="100%"
                    />
                    <Container layout="flex" gap="xs" justify="end" width="100%">
                        <Button size="xs" variant="ghost" onClick={resetMenu}>Cancel</Button>
                        <Button
                            size="xs"
                            color="primary"
                            disabled={!renameValue.trim() || renameValue === file.fileName}
                            onClick={() => { onRename?.(file, renameValue.trim()); resetMenu(); }}
                        >
                            Rename
                        </Button>
                    </Container>
                </>
            )}

            {menuView === 'delete' && (
                <>
                    <Typography size="xs" weight="semibold">Delete "{file.fileName}"?</Typography>
                    <Typography size="xs" color="secondary">This action cannot be undone.</Typography>
                    <Container layout="flex" gap="xs" justify="end" width="100%">
                        <Button size="xs" variant="ghost" onClick={resetMenu}>Cancel</Button>
                        <Button size="xs" color="error" onClick={() => { onDelete?.(file, true); resetMenu(); }}>
                            Delete
                        </Button>
                    </Container>
                </>
            )}

            {menuView === 'share' && renderShareForm?.({ file, onBack: resetMenu })}
            {menuView === 'move' && renderMoveForm?.({ file, onBack: resetMenu })}
            {menuView === 'copy' && renderCopyForm?.({ file, onBack: resetMenu })}
        </Container>
    );

    const cellStyle = { display: 'table-cell', padding: '8px 12px', verticalAlign: 'middle' };

    return (
        <Container
            className={`file-list-row${selected ? ' file-list-row--selected' : ''}`}
            style={{ display: 'table-row', cursor: 'pointer' }}
            genie={{ trigger: 'contextmenu', content: contextMenu, position: 'auto' }}
        >
            {selectionMode && (
                <div style={{ ...cellStyle, width: '32px', padding: '8px 4px' }} onClick={(e) => e.stopPropagation()}>
                    <Input type="checkbox" checked={!!selected} onChange={() => onSelect?.(file._id)} />
                </div>
            )}
            <div style={cellStyle} onClick={handleOpen}>
                <Container layout="flex" align="center" gap="sm">
                    <Icon name={getFileIcon(file)} size="sm" color={file.type === 'directory' ? 'primary' : 'secondary'} />
                    <Typography size="sm" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.fileName}
                    </Typography>
                </Container>
            </div>
            <div style={{ ...cellStyle, width: '120px' }}>
                <Typography size="xs" color="secondary">{formatDate(file.updatedAt)}</Typography>
            </div>
            <div style={{ ...cellStyle, width: '80px', textAlign: 'right' }}>
                <Typography size="xs" color="secondary">{file.type === 'directory' ? '—' : formatSize(file.size)}</Typography>
            </div>
            <div
                style={{ ...cellStyle, width: '40px', textAlign: 'center' }}
                onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.parentElement?.dispatchEvent(
                        new MouseEvent('contextmenu', { bubbles: true, clientX: e.clientX, clientY: e.clientY })
                    );
                }}
            >
                <Icon name="FiMoreVertical" size="xs" color="secondary" />
            </div>
        </Container>
    );
};

export default FileListRow;
