import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, Container, Card, Button, Typography, Icon, Badge, Divider } from '@components/Components';

const FILE_TYPE_CATEGORIES = [
    {
        // Binary (GridFS): pdf, xls, xlsx, ppt, pptx, odt, ods, odp
        // Text (Yjs/editable): docx, doc, txt, md, csv, rtf and all plain-text variants
        category: 'Documents',
        icon: 'FiFileText',
        color: '#4A90D9',
        types: ['PDF', 'DOCX', 'PPTX', 'PPT', 'TXT', 'MD', 'CSV', 'ODT'],
    },
    {
        // Binary (GridFS): jpg, jpeg, png, gif, webp, bmp, ico, tiff, tif, svg
        category: 'Images',
        icon: 'FiImage',
        color: '#9B72EF',
        types: ['PNG', 'JPG', 'GIF', 'WebP', 'SVG', 'BMP', 'TIFF', 'ICO'],
    },
    {
        // Binary (GridFS): mp4, webm, avi, mov, wmv, flv, mkv, m4v
        category: 'Video',
        icon: 'FiVideo',
        color: '#E05C5C',
        types: ['MP4', 'MOV', 'AVI', 'MKV', 'WebM', 'WMV', 'FLV', 'M4V'],
    },
    {
        // Binary (GridFS): mp3, wav, flac, aac, ogg, m4a, wma
        category: 'Audio',
        icon: 'FiMusic',
        color: '#48BB78',
        types: ['MP3', 'WAV', 'FLAC', 'OGG', 'M4A', 'AAC', 'WMA'],
    },
    {
        // Text (Yjs + Monaco editor) — all stored as collaborative text
        category: 'Source Code',
        icon: 'FiCode',
        color: '#F6AD55',
        types: ['JS', 'TS', 'PY', 'GO', 'RS', 'SQL', 'JSON', 'YAML', 'HTML', 'CSS', 'SH', 'XML'],
    },
    {
        // Binary (GridFS) + interactive 3D viewer (three-stdlib):
        // glb, gltf, obj, stl, fbx, ply, dae, 3mf, vox — all renderable in browser
        category: '3D Models',
        icon: 'FiBox',
        color: '#76E4F7',
        types: ['GLB', 'GLTF', 'OBJ', 'STL', 'FBX', 'PLY', 'DAE', '3MF', 'VOX'],
    },
    {
        // Binary (GridFS): zip, rar, 7z, tar, gz, bz2, xz, zst
        // ZIP files can be extracted server-side after upload
        category: 'Archives',
        icon: 'FiArchive',
        color: '#A0AEC0',
        types: ['ZIP', 'RAR', '7Z', 'TAR', 'GZ', 'BZ2', 'XZ', 'ZST'],
    },
];

const FEATURES = [
    {
        icon: 'FiHardDrive',
        title: 'Unlimited File Storage',
        description: 'Upload any file type and size. Organised into folders and stored reliably on MongoDB GridFS — your files are always within reach.',
        badges: ['Any File Type', 'Folder Structure', 'GridFS'],
    },
    {
        icon: 'FiUsers',
        title: 'Team Workspaces',
        description: 'Create shared workspaces for any team or project. Assign granular roles, control access permissions, and keep everyone aligned.',
        badges: ['Groups', 'Role-Based Access', 'Invite Members'],
    },
    {
        icon: 'FiEdit2',
        title: 'Real-Time Collaboration',
        description: 'Multiple people can edit the same document simultaneously. Changes sync instantly using conflict-free CRDT technology powered by Yjs.',
        badges: ['Simultaneous Editing', 'CRDTs (Yjs)', 'Live Presence'],
    },
    {
        icon: 'FiGitBranch',
        title: 'Version History',
        description: 'Never lose your work. Every saved version of your file is stored and restorable. Review what changed, and roll back to any point in time.',
        badges: ['Save Versions', 'Point-in-Time Restore', 'Change Tracking'],
    },
    {
        icon: 'FiMessageSquare',
        title: 'Inline Comments',
        description: 'Discuss files without leaving the platform. Leave threaded comments directly on any file and keep all feedback in context.',
        badges: ['Threaded Replies', 'Per-File Context', 'Team Discussion'],
    },
    {
        icon: 'FiShield',
        title: 'Enterprise Security',
        description: 'Two-factor authentication, JWT session management, device tracking, role-based access control, and full audit logs — built in from day one.',
        badges: ['2FA / TOTP', 'JWT Auth', 'Audit Logs'],
    },
];

const HOW_IT_WORKS = [
    {
        number: '01',
        icon: 'FiUploadCloud',
        title: 'Upload anything',
        description: 'Drag and drop files or entire folders. Supports every major file format — documents, images, video, audio, source code, and more.',
    },
    {
        number: '02',
        icon: 'FiFolder',
        title: 'Organise and share',
        description: 'Structure files into folders, create team workspaces, and share with exactly the right people at exactly the right permission level.',
    },
    {
        number: '03',
        icon: 'FiZap',
        title: 'Collaborate in real time',
        description: 'Edit documents together, leave comments, track versions, and always know who changed what — and when.',
    },
];

const STATS = [
    { value: '50+', label: 'File formats supported' },
    { value: '∞', label: 'Version history depth' },
    { value: '2FA', label: 'Built-in security' },
    { value: 'CRDT', label: 'Conflict-free sync' },
];

const HomePage = () => {
    const navigate = useNavigate();

    return (
        <Page layout="flex-column" align="center" style={{ overflowX: 'hidden' }}>

            {/* ── Hero ─────────────────────────────────────────────── */}
            <Container
                layout="flex-column"
                align="center"
                justify="center"
                padding="xl"
                style={{ minHeight: '92vh', textAlign: 'center', maxWidth: '860px', margin: '0 auto', position: 'relative' }}
            >
                {/* Ambient glow */}
                <div style={{
                    position: 'absolute', top: '25%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: '640px', height: '320px',
                    background: 'radial-gradient(ellipse, var(--primary-color) 0%, transparent 70%)',
                    opacity: 0.07, borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
                }} />

                <Container layout="flex" gap="sm" justify="center" padding="none" style={{ marginBottom: '28px', position: 'relative', zIndex: 1 }}>
                    <Icon name="FiHardDrive" size="xl" color="primary" />
                    <Badge color="primary" size="sm">Beta — Free to use</Badge>
                </Container>

                <Typography
                    as="h1"
                    size="3xl"
                    weight="bold"
                    align="center"
                    color="primary"
                    animation="shiny"
                    animationDelay={500}
                    animationDuration={2400}
                    style={{ marginBottom: '20px', position: 'relative', zIndex: 1, letterSpacing: '-0.02em' }}
                >
                    Filesystem One
                </Typography>

                <Typography
                    as="h2"
                    size="xl"
                    weight="semibold"
                    align="center"
                    style={{ marginBottom: '16px', lineHeight: 1.35, position: 'relative', zIndex: 1 }}
                >
                    A cloud-based file system<br />built for teams that move fast.
                </Typography>

                <Typography
                    size="md"
                    align="center"
                    color="muted"
                    style={{ maxWidth: '580px', marginBottom: '44px', lineHeight: 1.7, position: 'relative', zIndex: 1 }}
                >
                    Store any file in the cloud, edit documents together in real time, track every version,
                    and control exactly who has access — all in one secure place.
                </Typography>

                <Container layout="flex" gap="md" justify="center" padding="none" wrap style={{ position: 'relative', zIndex: 1 }}>
                    <Button color="primary" size="lg" onClick={() => navigate('/signup')}>
                        <Icon name="FiUserPlus" size="sm" />
                        Start for free
                    </Button>
                    <Button color="secondary" size="lg" onClick={() => navigate('/login')}>
                        <Icon name="FiLogIn" size="sm" />
                        Sign in
                    </Button>
                </Container>

                <Typography size="xs" color="muted" style={{ marginTop: '20px', position: 'relative', zIndex: 1 }}>
                    No credit card required &nbsp;·&nbsp; Free during beta
                </Typography>
            </Container>

            {/* ── Stats Bar ─────────────────────────────────────────── */}
            <Container
                layout="flex"
                justify="center"
                gap="none"
                wrap
                style={{
                    width: '100%',
                    borderTop: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--surface-color)',
                    padding: '24px 16px',
                }}
            >
                {STATS.map((stat, i) => (
                    <React.Fragment key={stat.label}>
                        {i > 0 && (
                            <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 32px' }} />
                        )}
                        <Container layout="flex-column" align="center" gap="xs" padding="none" style={{ minWidth: '120px' }}>
                            <Typography size="2xl" weight="bold" color="primary" style={{ lineHeight: 1 }}>
                                {stat.value}
                            </Typography>
                            <Typography size="sm" color="muted">
                                {stat.label}
                            </Typography>
                        </Container>
                    </React.Fragment>
                ))}
            </Container>

            {/* ── Supported File Types ─────────────────────────────── */}
            <Container
                layout="flex-column"
                align="center"
                padding="xl"
                style={{ width: '100%', maxWidth: '1100px', marginTop: '72px' }}
            >
                <Badge color="primary" size="sm" style={{ marginBottom: '16px' }}>File Support</Badge>
                <Typography as="h2" size="2xl" weight="bold" align="center" style={{ marginBottom: '8px' }}>
                    Works with every format you use
                </Typography>
                <Typography size="md" color="muted" align="center" style={{ marginBottom: '48px', maxWidth: '520px' }}>
                    Upload, preview, and collaborate on over 50 file types — from documents and source code
                    to 3D models, video, and archives.
                </Typography>

                <Container layout="flex" gap="lg" justify="center" wrap style={{ width: '100%' }}>
                    {FILE_TYPE_CATEGORIES.map(ft => (
                        <Card
                            key={ft.category}
                            layout="flex-column"
                            gap="sm"
                            padding="lg"
                            style={{ width: '280px', minWidth: '240px' }}
                        >
                            <Container layout="flex" align="center" gap="sm" padding="none">
                                <div style={{
                                    width: '38px', height: '38px',
                                    borderRadius: '10px',
                                    background: ft.color + '20',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Icon name={ft.icon} size="sm" style={{ color: ft.color }} />
                                </div>
                                <Typography size="sm" weight="semibold">{ft.category}</Typography>
                            </Container>
                            <Container layout="flex" gap="xs" padding="none" wrap>
                                {ft.types.map(t => (
                                    <Badge key={t} size="sm" color="secondary">{t}</Badge>
                                ))}
                            </Container>
                        </Card>
                    ))}
                </Container>
            </Container>

            {/* ── Features ─────────────────────────────────────────── */}
            <Container
                layout="flex-column"
                align="center"
                padding="xl"
                style={{ width: '100%', maxWidth: '1100px', marginTop: '72px' }}
            >
                <Badge color="primary" size="sm" style={{ marginBottom: '16px' }}>Features</Badge>
                <Typography as="h2" size="2xl" weight="bold" align="center" style={{ marginBottom: '8px' }}>
                    Everything your team needs
                </Typography>
                <Typography size="md" color="muted" align="center" style={{ marginBottom: '48px', maxWidth: '520px' }}>
                    Built for individuals and teams alike — from simple file storage to real-time
                    document collaboration and enterprise-grade access control.
                </Typography>

                <Container layout="flex" gap="lg" wrap justify="center" style={{ width: '100%' }}>
                    {FEATURES.map(f => (
                        <Card
                            key={f.title}
                            layout="flex-column"
                            gap="sm"
                            padding="lg"
                            style={{ width: '320px', minWidth: '280px' }}
                        >
                            <div style={{
                                width: '44px', height: '44px',
                                borderRadius: '12px',
                                backgroundColor: 'var(--primary-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '4px',
                            }}>
                                <Icon name={f.icon} size="md" color="white" />
                            </div>
                            <Typography size="md" weight="semibold">{f.title}</Typography>
                            <Typography size="sm" color="muted">{f.description}</Typography>
                            <Container layout="flex" gap="xs" padding="none" wrap>
                                {f.badges.map(b => (
                                    <Badge key={b} size="sm" color="secondary">{b}</Badge>
                                ))}
                            </Container>
                        </Card>
                    ))}
                </Container>
            </Container>

            {/* ── How It Works ─────────────────────────────────────── */}
            <Container
                layout="flex-column"
                align="center"
                padding="xl"
                style={{ width: '100%', maxWidth: '1100px', marginTop: '72px' }}
            >
                <Badge color="primary" size="sm" style={{ marginBottom: '16px' }}>How it works</Badge>
                <Typography as="h2" size="2xl" weight="bold" align="center" style={{ marginBottom: '8px' }}>
                    Up and running in minutes
                </Typography>
                <Typography size="md" color="muted" align="center" style={{ marginBottom: '48px', maxWidth: '520px' }}>
                    No complex setup. No IT department required. Sign up and start uploading in seconds.
                </Typography>

                <Container layout="flex" gap="lg" justify="center" wrap style={{ width: '100%' }}>
                    {HOW_IT_WORKS.map(step => (
                        <Card
                            key={step.number}
                            layout="flex-column"
                            gap="md"
                            padding="lg"
                            style={{ width: '300px', minWidth: '260px', position: 'relative', overflow: 'hidden' }}
                        >
                            {/* Large number watermark */}
                            <div style={{
                                position: 'absolute', top: '8px', right: '14px',
                                fontSize: '4rem', fontWeight: 700, lineHeight: 1,
                                color: 'var(--primary-color)', opacity: 0.06,
                                userSelect: 'none', pointerEvents: 'none',
                            }}>
                                {step.number}
                            </div>
                            <div style={{
                                width: '48px', height: '48px',
                                borderRadius: '12px',
                                border: '2px solid var(--primary-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Icon name={step.icon} size="md" color="primary" />
                            </div>
                            <Typography size="md" weight="semibold">{step.title}</Typography>
                            <Typography size="sm" color="muted">{step.description}</Typography>
                        </Card>
                    ))}
                </Container>
            </Container>

            {/* ── Final CTA ─────────────────────────────────────────── */}
            <Container
                layout="flex-column"
                align="center"
                justify="center"
                padding="xl"
                style={{ width: '100%', marginTop: '72px', marginBottom: '80px', position: 'relative' }}
            >
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'radial-gradient(ellipse at center, var(--primary-color) 0%, transparent 65%)',
                    opacity: 0.05, pointerEvents: 'none',
                }} />
                <Card
                    layout="flex-column"
                    align="center"
                    padding="xl"
                    style={{ maxWidth: '620px', width: '100%', textAlign: 'center', position: 'relative' }}
                >
                    <Icon name="FiZap" size="lg" color="primary" style={{ marginBottom: '8px' }} />
                    <Typography as="h2" size="xl" weight="bold" align="center" style={{ marginBottom: '8px' }}>
                        Ready to take control of your files?
                    </Typography>
                    <Typography size="sm" color="muted" align="center" style={{ marginBottom: '28px', maxWidth: '440px' }}>
                        Join teams already using Filesystem One to store, collaborate, and ship
                        faster. It's completely free to get started.
                    </Typography>
                    <Container layout="flex" gap="md" justify="center" padding="none" wrap>
                        <Button color="primary" size="lg" onClick={() => navigate('/signup')}>
                            <Icon name="FiArrowRight" size="sm" />
                            Create free account
                        </Button>
                        <Button color="secondary" size="lg" onClick={() => navigate('/login')}>
                            Sign in
                        </Button>
                    </Container>
                    <Typography size="xs" color="muted" style={{ marginTop: '16px' }}>
                        No credit card needed &nbsp;·&nbsp; Free during beta
                    </Typography>
                </Card>
            </Container>

        </Page>
    );
};

export default HomePage;
