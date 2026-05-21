import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Container, Icon, Input, Typography } from './Components';
import './styles/FileCard.css';

// Shared file-extension → icon mapping used by FileCard, FileListRow,
// the FileBrowser tree, and the dashboard. Icons are react-icons names
// (mostly Feather) resolved by the shared <Icon /> component.
const FILE_ICONS = {
    directory: 'FiFolder',

    // ─ Code ────────────────────────────────────────────────────────
    js: 'FiCode', mjs: 'FiCode', cjs: 'FiCode',
    ts: 'FiCode', jsx: 'FiCode', tsx: 'FiCode',
    py: 'FiCode', rb: 'FiCode', php: 'FiCode',
    go: 'FiCode', rs: 'FiCode',
    java: 'FiCode', kt: 'FiCode', scala: 'FiCode', groovy: 'FiCode',
    c: 'FiCode', cpp: 'FiCode', cc: 'FiCode', cxx: 'FiCode',
    h: 'FiCode', hpp: 'FiCode',
    cs: 'FiCode', swift: 'FiCode', dart: 'FiCode', lua: 'FiCode',
    r: 'FiCode', jl: 'FiCode', clj: 'FiCode', ex: 'FiCode', exs: 'FiCode',
    erl: 'FiCode', hs: 'FiCode', ml: 'FiCode',
    html: 'FiCode', htm: 'FiCode', vue: 'FiCode', svelte: 'FiCode',
    css: 'FiCode', scss: 'FiCode', sass: 'FiCode', less: 'FiCode',

    // ─ Shell ───────────────────────────────────────────────────────
    sh: 'FiTerminal', bash: 'FiTerminal', zsh: 'FiTerminal', fish: 'FiTerminal',
    ps1: 'FiTerminal', bat: 'FiTerminal', cmd: 'FiTerminal',

    // ─ Config / data ───────────────────────────────────────────────
    json: 'FiSettings', yaml: 'FiSettings', yml: 'FiSettings', toml: 'FiSettings',
    ini: 'FiSettings', conf: 'FiSettings', cfg: 'FiSettings', env: 'FiSettings',
    xml: 'FiFileText',

    // ─ Database ────────────────────────────────────────────────────
    sql: 'FiDatabase', db: 'FiDatabase', sqlite: 'FiDatabase', sqlite3: 'FiDatabase',

    // ─ Text / docs ─────────────────────────────────────────────────
    md: 'FiFileText', markdown: 'FiFileText', mdx: 'FiFileText',
    txt: 'FiFileText', rtf: 'FiFileText', log: 'FiFileText',
    tex: 'FiFileText',

    pdf: 'FiBook', epub: 'FiBook', mobi: 'FiBook',

    doc: 'FiFileText', docx: 'FiFileText', odt: 'FiFileText',
    xls: 'FiGrid', xlsx: 'FiGrid', ods: 'FiGrid', csv: 'FiGrid', tsv: 'FiGrid',
    ppt: 'FiLayers', pptx: 'FiLayers', odp: 'FiLayers', key: 'FiLayers',

    // ─ Images (raster) ─────────────────────────────────────────────
    jpg: 'FiImage', jpeg: 'FiImage', png: 'FiImage', gif: 'FiImage',
    webp: 'FiImage', bmp: 'FiImage', tiff: 'FiImage', tif: 'FiImage',
    heic: 'FiImage', heif: 'FiImage', avif: 'FiImage',
    ico: 'FiImage', icns: 'FiImage',

    // ─ Vector / design ─────────────────────────────────────────────
    svg: 'FiPenTool', ai: 'FiPenTool', eps: 'FiPenTool',
    psd: 'FiPenTool', xcf: 'FiPenTool', sketch: 'FiPenTool', fig: 'FiPenTool',

    // ─ RAW photos ──────────────────────────────────────────────────
    raw: 'FiCamera', cr2: 'FiCamera', cr3: 'FiCamera',
    nef: 'FiCamera', arw: 'FiCamera', dng: 'FiCamera',
    orf: 'FiCamera', raf: 'FiCamera', rw2: 'FiCamera',

    // ─ Video ───────────────────────────────────────────────────────
    mp4: 'FiFilm', m4v: 'FiFilm', mov: 'FiFilm', webm: 'FiFilm', mkv: 'FiFilm',
    avi: 'FiVideo', wmv: 'FiVideo', flv: 'FiVideo', ogv: 'FiVideo',
    '3gp': 'FiVideo', mpg: 'FiVideo', mpeg: 'FiVideo',

    // ─ Audio ───────────────────────────────────────────────────────
    mp3: 'FiMusic', aac: 'FiMusic', m4a: 'FiMusic', wav: 'FiMusic',
    flac: 'FiMusic', opus: 'FiMusic', ogg: 'FiMusic', oga: 'FiMusic',
    wma: 'FiMusic', aiff: 'FiMusic',
    midi: 'FiHeadphones', mid: 'FiHeadphones',

    // ─ 3D mesh / scene ─────────────────────────────────────────────
    glb: 'FiBox', gltf: 'FiBox', obj: 'FiBox', fbx: 'FiBox', dae: 'FiBox',
    ply: 'FiBox', '3ds': 'FiBox',
    blend: 'FiBox', max: 'FiBox', ma: 'FiBox', mb: 'FiBox',
    usdz: 'FiBox', usd: 'FiBox',
    x3d: 'FiBox', wrl: 'FiBox', vrml: 'FiBox',

    // ─ 3D printing ─────────────────────────────────────────────────
    stl: 'FiPackage', '3mf': 'FiPackage', amf: 'FiPackage',
    gcode: 'FiPackage',

    // ─ Voxel ───────────────────────────────────────────────────────
    vox: 'FiGrid',

    // ─ CAD ─────────────────────────────────────────────────────────
    dxf: 'FiCpu', dwg: 'FiCpu',
    step: 'FiCpu', stp: 'FiCpu', iges: 'FiCpu', igs: 'FiCpu',

    // ─ Archives ────────────────────────────────────────────────────
    zip: 'FiArchive', rar: 'FiArchive', tar: 'FiArchive', gz: 'FiArchive',
    tgz: 'FiArchive', '7z': 'FiArchive', bz2: 'FiArchive', xz: 'FiArchive',
    zst: 'FiArchive',

    // ─ Fonts ───────────────────────────────────────────────────────
    ttf: 'FiType', otf: 'FiType', woff: 'FiType', woff2: 'FiType', eot: 'FiType',

    // ─ Executables / disk images ───────────────────────────────────
    exe: 'FiHardDrive', dmg: 'FiHardDrive', deb: 'FiHardDrive',
    rpm: 'FiHardDrive', app: 'FiHardDrive', msi: 'FiHardDrive', apk: 'FiHardDrive',
    iso: 'FiHardDrive', img: 'FiHardDrive',
};

// Fallback when a file's extension isn't mapped but we know its viewer category.
const TYPE_FALLBACK = {
    directory: 'FiFolder',
    image: 'FiImage',
    video: 'FiFilm',
    audio: 'FiMusic',
    text: 'FiFileText',
    pdf: 'FiBook',
    '3d': 'FiBox',
    binary: 'FiFile',
};

export const getFileIcon = (file) => {
    if (!file) return 'FiFile';
    if (file.type === 'directory') return 'FiFolder';
    const name = file.fileName || file.filePath?.split('/').pop() || '';
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext && FILE_ICONS[ext]) return FILE_ICONS[ext];
    if (file.type && TYPE_FALLBACK[file.type]) return TYPE_FALLBACK[file.type];
    return 'FiFile';
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

const FileCard = ({ file, onDelete, onRename, onDownload, selected, onSelect, selectionMode, renderShareForm, renderMoveForm, renderCopyForm }) => {
    const navigate = useNavigate();
    const [menuView, setMenuView] = useState('actions'); // 'actions' | 'rename' | 'delete'
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
                    {/* Metadata */}
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
                        {file.createdAt && (
                            <Typography size="xs" color="secondary">
                                Created {formatDate(file.createdAt)}
                            </Typography>
                        )}
                        {file.filePath && (
                            <Typography size="xs" color="secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.filePath}
                            </Typography>
                        )}
                    </Container>
                    {/* Actions */}
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

    return (
        <Card
            padding="xs"
            className={`file-card${selected ? ' file-card--selected' : ''}`}
            genie={{ trigger: 'contextmenu', content: contextMenu, position: 'auto' }}
            style={{ cursor: 'pointer', userSelect: 'none', position: 'relative' }}
        >
            {/* Checkbox — only in selection mode */}
            {selectionMode && (
              <Container
                  style={{ position: 'absolute', top: '4px', left: '4px', zIndex: 1 }}
                  onClick={(e) => e.stopPropagation()}
              >
                  <Input
                      type="checkbox"
                      checked={!!selected}
                      onChange={() => onSelect?.(file._id)}
                  />
              </Container>
            )}

            {/* Icon / thumbnail */}
            <Container
                layout="flex"
                align="center"
                justify="center"
                height="52px"
                onClick={handleOpen}
            >
                <Icon name={getFileIcon(file)} size="lg" color={file.type === 'directory' ? 'primary' : 'secondary'} />
            </Container>

            {/* Name */}
            <Container layout="flex-column" gap="none" onClick={handleOpen}>
                <Typography size="xs" weight="medium" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.fileName}
                </Typography>
            </Container>
        </Card>
    );
};

export default FileCard;
