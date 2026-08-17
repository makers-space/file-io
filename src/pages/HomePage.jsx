import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { Page, Container, Card, Button, Typography, Icon, Badge } from '@components/Components';

// ─── Content data ─────────────────────────────────────────────────────────────

const FILE_TYPE_CATEGORIES = [
    { category: 'Documents', icon: 'FiFileText', color: '#4A90D9', types: ['PDF', 'DOCX', 'PPTX', 'TXT', 'MD', 'CSV'] },
    { category: 'Images', icon: 'FiImage', color: '#9B72EF', types: ['PNG', 'JPG', 'GIF', 'WebP', 'SVG'] },
    { category: 'Video', icon: 'FiVideo', color: '#E05C5C', types: ['MP4', 'MOV', 'MKV', 'WebM'] },
    { category: 'Audio', icon: 'FiMusic', color: '#48BB78', types: ['MP3', 'WAV', 'FLAC', 'OGG'] },
    { category: 'Source Code', icon: 'FiCode', color: '#F6AD55', types: ['JS', 'TS', 'PY', 'GO', 'SQL', 'JSON'] },
    { category: '3D Models', icon: 'FiBox', color: '#76E4F7', types: ['GLB', 'OBJ', 'STL', 'FBX'] },
    { category: 'Archives', icon: 'FiArchive', color: '#A0AEC0', types: ['ZIP', 'RAR', '7Z', 'TAR'] },
];

const FEATURES = [
    {
        icon: 'FiEdit2',
        title: 'Real-time collaboration',
        description: 'Multiple people edit the same document at once — changes merge instantly with conflict-free CRDT sync, and you always see who else is in the file.',
        badges: ['Live cursors', 'CRDT sync', 'Presence'],
        wide: true,
    },
    {
        icon: 'FiHardDrive',
        title: 'Store anything',
        description: 'Any file type, organised into folders, stored reliably on GridFS.',
        badges: ['50+ formats'],
    },
    {
        icon: 'FiGitBranch',
        title: 'Version history',
        description: 'Every save is a restore point. Review changes, roll back any time.',
        badges: ['Point-in-time restore'],
    },
    {
        icon: 'FiUsers',
        title: 'Team workspaces',
        description: 'Shared group spaces with granular, role-based access for every member.',
        badges: ['Role-based access'],
    },
    {
        icon: 'FiMessageSquare',
        title: 'Inline comments',
        description: 'Threaded discussion attached directly to the file it is about.',
        badges: ['Threaded replies'],
    },
    {
        icon: 'FiShield',
        title: 'Serious security',
        description: 'Two-factor auth, device tracking, audit logs, and JWT sessions with rotation — on by default, not an enterprise add-on.',
        badges: ['2FA / TOTP', 'Audit logs'],
        wide: true,
    },
];

const HOW_IT_WORKS = [
    { icon: 'FiUploadCloud', title: 'Upload anything', description: 'Drag in files or whole folders — every major format is supported and previewable in the browser.' },
    { icon: 'FiFolder', title: 'Organise and share', description: 'Structure your drive, share at exactly the right permission level, and spin up shared workspaces when you need them.' },
    { icon: 'FiZap', title: 'Bring files to life', description: 'Open and edit documents right in the browser, track every version — and co-edit live when others join in.' },
];

const STATS = [
    { value: '50+', label: 'File formats' },
    { value: '∞', label: 'Version history' },
    { value: '2FA', label: 'Built-in security' },
    { value: 'CRDT', label: 'Conflict-free sync' },
];

// ─── Small building blocks ────────────────────────────────────────────────────

const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const LogoMark = ({ size = 34 }) => (
    <Container
        layout="flex" align="center" justify="center" padding="none" wrap={false}
        width={`${size}px`} height={`${size}px`}
        style={{
            borderRadius: size * 0.29, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary-color), var(--primary-accent-color, var(--primary-color)))',
            boxShadow: `0 4px 14px ${tint('var(--primary-color)', 35)}`,
        }}
    >
        <Icon name="FiHardDrive" size="sm" style={{ color: 'var(--text-contrast-color, #fff)' }} />
    </Container>
);

const IconTile = ({ icon, color = 'var(--primary-color)', size = 42, radius = 12, iconSize = 'sm', solid = false }) => (
    <Container
        layout="flex" align="center" justify="center" padding="none" wrap={false}
        width={`${size}px`} height={`${size}px`}
        style={{ borderRadius: radius, flexShrink: 0, background: solid ? color : tint(color, 14) }}
    >
        <Icon name={icon} size={iconSize} style={{ color: solid ? '#fff' : color }} />
    </Container>
);

const SectionHeading = ({ eyebrow, title, sub }) => (
    <Container layout="flex-column" align="center" gap="none" padding="none" width="100%" marginBottom="44px" style={{ textAlign: 'center' }}>
        <Badge color="primary" size="sm" style={{ marginBottom: '14px' }}>{eyebrow}</Badge>
        <Typography as="h2" size="2xl" weight="bold" font="secondary" align="center" style={{ marginBottom: '10px', letterSpacing: '-0.01em' }}>
            {title}
        </Typography>
        {sub && (
            <Typography size="md" color="muted" align="center" style={{ maxWidth: '560px', lineHeight: 1.65 }}>
                {sub}
            </Typography>
        )}
    </Container>
);

// A centered, width-capped content band. Full-bleed styling goes on `bandStyle`.
const Band = ({ children, bandStyle = {}, innerStyle = {}, ...rest }) => (
    <Container layout="flex" justify="center" padding="none" width="100%" wrap={false} style={bandStyle} {...rest}>
        <Container
            layout="flex-column" padding="none" gap="none" width="100%" maxWidth="1160px"
            style={{ paddingLeft: 'clamp(20px, 4vw, 48px)', paddingRight: 'clamp(20px, 4vw, 48px)', ...innerStyle }}
        >
            {children}
        </Container>
    </Container>
);

// Fake presence avatars used in the hero mockup
const PresenceStack = () => {
    const people = [
        { initials: 'AK', color: '#4A90D9' },
        { initials: 'MJ', color: '#48BB78' },
        { initials: 'TS', color: '#9B72EF' },
    ];
    return (
        <Container layout="flex" align="center" padding="none" gap="none" wrap={false}>
            {people.map((p, i) => (
                <Container
                    key={p.initials}
                    layout="flex" align="center" justify="center" padding="none" wrap={false}
                    width="22px" height="22px"
                    style={{
                        borderRadius: '50%', background: p.color,
                        border: '2px solid var(--background-color)',
                        marginLeft: i === 0 ? 0 : -7,
                    }}
                >
                    <Typography as="span" size="xs" weight="bold" style={{ color: '#fff', fontSize: '0.55rem', lineHeight: 1 }}>
                        {p.initials}
                    </Typography>
                </Container>
            ))}
        </Container>
    );
};

// The hero visual: a stylised file-drive window built entirely from the
// component system + theme tokens, so it adapts to every theme.
const HeroMockup = () => {
    const rows = [
        { icon: 'FiFolder', name: 'Design assets', meta: '24 items', tint: '#4A90D9' },
        { icon: 'FiFileText', name: 'Q3 launch plan.docx', meta: 'Edited 2m ago', tint: '#4A90D9', live: true },
        { icon: 'FiCode', name: 'api-client.ts', meta: 'v14 · 2 editors', tint: '#F6AD55', live: true },
        { icon: 'FiImage', name: 'hero-banner.png', meta: '2.4 MB', tint: '#9B72EF' },
        { icon: 'FiBox', name: 'prototype-v2.glb', meta: '3D preview', tint: '#76E4F7' },
    ];
    const sidebar = [
        { icon: 'FiHardDrive', label: 'My Drive', active: true },
        { icon: 'FiUsers', label: 'Shared' },
        { icon: 'FiStar', label: 'Starred' },
        { icon: 'FiClock', label: 'Recent' },
    ];
    return (
        <Container padding="none" width="100%" maxWidth="560px" style={{ position: 'relative' }}>
            {/* Main window */}
            <Card padding="none" hover={false} width="100%" style={{ overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
                {/* Title bar */}
                <Container
                    layout="flex" align="center" gap="sm" padding="sm" width="100%" wrap={false}
                    style={{ borderBottom: '1px solid var(--border-color)', background: tint('var(--surface-color)', 60) }}
                >
                    <Container layout="flex" gap="xs" padding="none" wrap={false}>
                        {['#E05C5C', '#F6AD55', '#48BB78'].map(c => (
                            <Container key={c} as="span" padding="none" width="9px" height="9px" style={{ borderRadius: '50%', background: c }} />
                        ))}
                    </Container>
                    <Container
                        layout="flex" align="center" gap="xs" padding="none" flexFill wrap={false}
                        style={{ padding: '4px 10px', borderRadius: 6, background: tint('var(--text-color)', 6) }}
                    >
                        <Icon name="FiSearch" size="xs" style={{ opacity: 0.5 }} />
                        <Typography size="xs" color="muted" font="monospace">drive / marketing / launch</Typography>
                    </Container>
                    <PresenceStack />
                </Container>

                <Container layout="flex" padding="none" gap="none" width="100%" wrap={false} minHeight="240px" align="stretch">
                    {/* Sidebar */}
                    <Container
                        layout="flex-column" gap="none" wrap={false}
                        width="132px" style={{ flexShrink: 0, padding: '12px 8px', borderRight: '1px solid var(--border-color)' }}
                    >
                        {sidebar.map(s => (
                            <Container
                                key={s.label} layout="flex" align="center" gap="sm" padding="none" wrap={false}
                                style={{
                                    padding: '7px 10px', borderRadius: 7,
                                    background: s.active ? tint('var(--primary-color)', 14) : 'transparent',
                                }}
                            >
                                <Icon name={s.icon} size="xs" color={s.active ? 'primary' : 'text'} style={s.active ? {} : { opacity: 0.55 }} />
                                <Typography size="xs" weight={s.active ? 'semibold' : 'normal'} color={s.active ? 'primary' : 'muted'}>
                                    {s.label}
                                </Typography>
                            </Container>
                        ))}
                        <Container layout="flex-column" gap="none" padding="none" style={{ marginTop: 'auto', padding: '8px 10px' }}>
                            <Container padding="none" width="100%" height="5px" style={{ borderRadius: 3, background: tint('var(--text-color)', 10), overflow: 'hidden' }}>
                                <Container padding="none" width="38%" height="100%" style={{ borderRadius: 3, background: 'var(--primary-color)' }} />
                            </Container>
                            <Typography size="xs" color="muted" style={{ marginTop: 5, fontSize: '0.65rem' }}>3.8 GB used</Typography>
                        </Container>
                    </Container>

                    {/* File rows */}
                    <Container layout="flex-column" gap="none" flexFill wrap={false} style={{ padding: '10px 12px', minWidth: 0 }}>
                        {rows.map(r => (
                            <Container key={r.name} layout="flex" align="center" gap="sm" padding="none" wrap={false} width="100%" style={{ padding: '8px 10px', borderRadius: 8 }}>
                                <IconTile icon={r.icon} color={r.tint} size={28} radius={8} iconSize="xs" />
                                <Container layout="flex-column" gap="none" padding="none" flexFill wrap={false} style={{ minWidth: 0 }}>
                                    <Typography size="xs" weight="medium" font="monospace" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.name}
                                    </Typography>
                                    <Typography size="xs" color="muted" style={{ fontSize: '0.65rem' }}>{r.meta}</Typography>
                                </Container>
                                {r.live && (
                                    <Container
                                        as="span" padding="none" width="7px" height="7px"
                                        style={{
                                            borderRadius: '50%', flexShrink: 0,
                                            background: 'var(--success-color)',
                                            boxShadow: `0 0 0 3px ${tint('var(--success-color)', 25)}`,
                                        }}
                                    />
                                )}
                            </Container>
                        ))}
                    </Container>
                </Container>
            </Card>

            {/* Floating: live editing toast */}
            <Card layout="flex" align="center" gap="sm" padding="sm" hover={false} wrap={false} style={{ position: 'absolute', top: -18, right: -14, boxShadow: 'var(--shadow-lg)' }}>
                <Container as="span" padding="none" width="8px" height="8px" style={{ borderRadius: '50%', background: 'var(--success-color)' }} />
                <Typography size="xs" weight="semibold" animation="typewriter" animationDelay={1400} animationDuration={900}>3 people editing now</Typography>
            </Card>

            {/* Floating: version restored toast */}
            <Card layout="flex" align="center" gap="sm" padding="sm" hover={false} wrap={false} style={{ position: 'absolute', bottom: -16, left: -14, boxShadow: 'var(--shadow-lg)' }}>
                <Icon name="FiGitBranch" size="xs" color="primary" />
                <Typography size="xs" weight="semibold">Version 12 restored</Typography>
            </Card>
        </Container>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const HomePage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const pageRef = useRef(null);
    const [navHidden, setNavHidden] = useState(false);

    useEffect(() => {
        const scroller = pageRef.current;
        if (!scroller) return undefined;
        let lastY = scroller.scrollTop;
        const onScroll = () => {
            const y = scroller.scrollTop;
            setNavHidden(y > lastY && y > 80);
            lastY = y;
        };
        scroller.addEventListener('scroll', onScroll, { passive: true });
        return () => scroller.removeEventListener('scroll', onScroll);
    }, []);

    const primaryCta = user
        ? { label: 'Open your dashboard', icon: 'FiGrid', to: '/dashboard' }
        : { label: 'Start for free', icon: 'FiArrowRight', to: '/signup' };

    return (
        <Page ref={pageRef} layout="flex-column" align="center" padding="none" gap="none" style={{ overflowX: 'hidden' }}>

            {/* ── Top bar ──────────────────────────────────────────── */}
            <Band
                bandStyle={{
                    position: 'sticky', top: 0, zIndex: 20,
                    backgroundColor: tint('var(--background-color)', 90),
                    borderBottom: '1px solid var(--border-color)',
                    transform: navHidden ? 'translateY(-100%)' : 'translateY(0)',
                    transition: 'transform 0.25s ease',
                }}
            >
                <Container layout="flex" align="center" justify="between" padding="none" width="100%" wrap={false} style={{ paddingTop: 12, paddingBottom: 12 }}>
                    <Container layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                        <LogoMark size={30} />
                        <Typography size="md" weight="bold" font="secondary" style={{ letterSpacing: '-0.01em' }}>Filesystem One</Typography>
                        <Badge color="primary" size="xs" style={{ marginLeft: 4 }}>Beta</Badge>
                    </Container>
                    <Container layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                        {user ? (
                            <Button color="primary" size="sm" onClick={() => navigate('/dashboard')}>
                                <Icon name="FiGrid" size="xs" /> Dashboard
                            </Button>
                        ) : (
                            <>
                                <Button color="secondary" size="sm" onClick={() => navigate('/login')}>Sign in</Button>
                                <Button color="primary" size="sm" onClick={() => navigate('/signup')}>Get started</Button>
                            </>
                        )}
                    </Container>
                </Container>
            </Band>

            {/* ── Hero ─────────────────────────────────────────────── */}
            <Band bandStyle={{ position: 'relative' }}>
                {/* Ambient background: gradient blob + dot grid */}
                <Container padding="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    {/* Kept inside the band — clipped edges show as hard lines */}
                    <Container
                        padding="none"
                        style={{
                            position: 'absolute', top: '8%', right: '4%', width: '48%', height: '70%',
                            background: 'radial-gradient(ellipse, var(--primary-color) 0%, transparent 65%)',
                            opacity: 0.1, borderRadius: '50%',
                        }}
                    />
                    <Container
                        padding="none"
                        style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: `radial-gradient(${tint('var(--text-color)', 14)} 1px, transparent 1px)`,
                            backgroundSize: '28px 28px',
                            maskImage: 'radial-gradient(ellipse at 30% 40%, black 0%, transparent 70%)',
                            WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, black 0%, transparent 70%)',
                            opacity: 0.35,
                        }}
                    />
                </Container>

                <Container
                    layout="grid" columns="auto-lg" gap="xl" padding="none" width="100%" align="center"
                    style={{ position: 'relative', paddingTop: 'clamp(56px, 9vh, 110px)', paddingBottom: 'clamp(56px, 9vh, 110px)' }}
                >
                    {/* Copy */}
                    <Container layout="flex-column" gap="none" padding="none" align="start">
                        <Badge color="primary" size="sm" style={{ marginBottom: 20 }}>
                            Free during beta — no credit card
                        </Badge>
                        <Typography as="h1" size="4xl" weight="extrabold" style={{ lineHeight: 1.08, letterSpacing: '-0.025em', marginBottom: 18 }}>
                            <Typography
                                as="span" size="4xl" weight="extrabold"
                                animation="blur" animationDelay={100} animationDuration={700}
                                animationConfig={{ splitBy: 'words' }}
                            >
                                {'Write it. Store it.'}
                            </Typography>{' '}
                            <Typography
                                as="span" size="4xl" weight="extrabold"
                                style={{
                                    background: 'linear-gradient(100deg, var(--primary-color), var(--primary-accent-color, var(--primary-color)))',
                                    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                                }}
                            >
                                Bring it to life.
                            </Typography>
                        </Typography>
                        <Typography size="md" color="muted" animation="fade" animationDelay={500} animationDuration={800} animationConfig={{ splitBy: 'words' }} style={{ maxWidth: 480, lineHeight: 1.7, marginBottom: 32 }}>
                            Filesystem One is a cloud drive that behaves like a workspace —
                            keep any file, edit documents right in the browser, roll back to
                            any version, and share on your terms. Built for you, ready for
                            your team.
                        </Typography>
                        <Container layout="flex" gap="sm" padding="none" wrap>
                            <Button color="primary" size="lg" onClick={() => navigate(primaryCta.to)}>
                                <Icon name={primaryCta.icon} size="sm" />
                                {primaryCta.label}
                            </Button>
                            {!user && (
                                <Button color="secondary" size="lg" onClick={() => navigate('/login')}>
                                    Sign in
                                </Button>
                            )}
                        </Container>
                        <Container layout="flex" align="center" gap="md" padding="none" marginTop="24px" wrap>
                            {['End-to-end access control', 'Version history', 'Live co-editing'].map(t => (
                                <Container key={t} layout="flex" align="center" gap="xs" padding="none" wrap={false}>
                                    <Icon name="FiCheck" size="xs" color="success" />
                                    <Typography size="xs" color="muted">{t}</Typography>
                                </Container>
                            ))}
                        </Container>
                    </Container>

                    {/* Visual */}
                    <Container layout="flex" justify="center" padding="none">
                        <HeroMockup />
                    </Container>
                </Container>
            </Band>

            {/* ── Stats band ───────────────────────────────────────── */}
            <Band
                bandStyle={{
                    backgroundColor: 'var(--surface-color)',
                    borderTop: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                }}
                innerStyle={{ paddingTop: 36, paddingBottom: 36 }}
            >
                <Container layout="grid" columns="auto-sm" gap="lg" padding="none" width="100%">
                    {STATS.map(stat => (
                        <Container key={stat.label} layout="flex-column" align="center" gap="xs" padding="none">
                            <Typography
                                size="3xl" weight="bold" color="primary" font="monospace"
                                animation="scramble" animateOn="hover"
                                style={{ lineHeight: 1 }}
                            >
                                {stat.value}
                            </Typography>
                            <Typography size="sm" color="muted">{stat.label}</Typography>
                        </Container>
                    ))}
                </Container>
            </Band>

            {/* ── Features (bento) ─────────────────────────────────── */}
            <Band innerStyle={{ paddingTop: 'clamp(64px, 9vh, 110px)' }}>
                <SectionHeading
                    eyebrow="Features"
                    title="Storage is just the start"
                    sub="From personal cloud storage to live document collaboration and serious access control — one coherent tool instead of five subscriptions."
                />
                <Container layout="grid" columns="auto" gap="md" padding="none" width="100%">
                    {FEATURES.map(f => (
                        <Card
                            key={f.title}
                            layout="flex-column"
                            gap="sm"
                            padding="lg"
                            span={f.wide ? 2 : null}
                            style={{ minWidth: 0 }}
                        >
                            <IconTile icon={f.icon} />
                            <Typography size="md" weight="semibold">{f.title}</Typography>
                            <Typography size="sm" color="muted" style={{ lineHeight: 1.6, flex: 1 }}>{f.description}</Typography>
                            <Container layout="flex" gap="xs" padding="none" wrap>
                                {f.badges.map(b => <Badge key={b} size="xs" color="secondary">{b}</Badge>)}
                            </Container>
                        </Card>
                    ))}
                </Container>
            </Band>

            {/* ── File formats ─────────────────────────────────────── */}
            <Band innerStyle={{ paddingTop: 'clamp(64px, 9vh, 110px)' }}>
                <SectionHeading
                    eyebrow="File support"
                    title="Bring every format you work with"
                    sub="Upload, preview, and collaborate on 50+ file types — documents, media, source code, even interactive 3D models."
                />
                <Container layout="flex" gap="sm" padding="none" justify="center" wrap width="100%">
                    {FILE_TYPE_CATEGORIES.map(ft => (
                        <Card key={ft.category} layout="flex" align="center" gap="sm" padding="sm" hover={false}>
                            <IconTile icon={ft.icon} color={ft.color} size={30} radius={8} iconSize="xs" />
                            <Typography size="sm" weight="semibold" style={{ marginRight: 4 }}>{ft.category}</Typography>
                            <Container layout="flex" gap="xs" padding="none" wrap>
                                {ft.types.map(t => <Badge key={t} size="xs" color="secondary">{t}</Badge>)}
                            </Container>
                        </Card>
                    ))}
                </Container>
            </Band>

            {/* ── How it works ─────────────────────────────────────── */}
            <Band innerStyle={{ paddingTop: 'clamp(64px, 9vh, 110px)' }}>
                <SectionHeading
                    eyebrow="How it works"
                    title="Up and running in minutes"
                    sub="No complex setup and no IT department required — sign up and start uploading in seconds."
                />
                <Container layout="grid" columns={3} gap="md" padding="none" width="100%">
                    {HOW_IT_WORKS.map((step, i) => (
                        <Card key={step.title} layout="flex-column" gap="sm" padding="lg" style={{ minWidth: 0 }}>
                            <Container layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                                <Container
                                    layout="flex" align="center" justify="center" padding="none" wrap={false}
                                    width="34px" height="34px"
                                    style={{ borderRadius: '50%', flexShrink: 0, background: 'var(--primary-color)' }}
                                >
                                    <Typography as="span" size="sm" weight="bold" style={{ color: 'var(--text-contrast-color, #fff)' }}>
                                        {i + 1}
                                    </Typography>
                                </Container>
                                <Icon name={step.icon} size="sm" color="primary" />
                            </Container>
                            <Typography size="md" weight="semibold">{step.title}</Typography>
                            <Typography size="sm" color="muted" style={{ lineHeight: 1.6 }}>{step.description}</Typography>
                        </Card>
                    ))}
                </Container>
            </Band>

            {/* ── Final CTA ────────────────────────────────────────── */}
            <Band innerStyle={{ paddingTop: 'clamp(64px, 9vh, 110px)', paddingBottom: 'clamp(48px, 7vh, 80px)' }}>
                <Card padding="none" hover={false} width="100%" style={{ overflow: 'hidden', position: 'relative' }}>
                    <Container
                        padding="none"
                        style={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(120deg, var(--primary-color), var(--primary-accent-color, var(--primary-color)))',
                        }}
                    />
                    <Container
                        padding="none"
                        style={{
                            position: 'absolute', inset: 0,
                            backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
                            backgroundSize: '22px 22px', opacity: 0.5,
                        }}
                    />
                    <Container layout="flex-column" align="center" padding="xl" width="100%" >
                        <Typography
                            as="h2" size="2xl" weight="bold" font="secondary" align="center" color="contrast"
                            animation="shiny" animationDuration={4000}
                            style={{ marginBottom: 10 }}
                        >
                            Ready to take control of your files?
                        </Typography>
                        <Typography size="sm" align="center" color="contrast" maxWidth={460} >
                            Store, create, and share in one secure workspace — whether it's
                            just you or a whole team. Completely free to get started.
                        </Typography>
                        <Container layout="flex" gap="sm" justify="center" padding="none" wrap>
                            <Button color="secondary" size="lg" onClick={() => navigate(primaryCta.to)} style={{ color: 'var(--text-contrast-color)' }}>
                                <Icon name={primaryCta.icon} size="sm" />
                                {user ? 'Open your dashboard' : 'Create free account'}
                            </Button>
                            {!user && (
                                <Button color="primary" size="lg" onClick={() => navigate('/login')} style={{ color: 'var(--text-contrast-color)' }}>
                                    Sign in
                                </Button>
                            )}
                        </Container>
                    </Container>
                </Card>
            </Band>

            {/* ── Footer ───────────────────────────────────────────── */}
            <Band bandStyle={{ borderTop: '1px solid var(--border-color)' }}>
                <Container layout="flex" align="center" justify="between" padding="none" width="100%" gap="md" wrap style={{ paddingTop: 20, paddingBottom: 20 }}>
                    <Container layout="flex" align="center" gap="sm" padding="none" wrap={false}>
                        <LogoMark size={22} />
                        <Typography size="xs" color="muted">Filesystem One — cloud storage that works the way you do.</Typography>
                    </Container>
                    <Container layout="flex" align="center" gap="md" padding="none" wrap={false}>
                        <Typography size="xs" color="muted" style={{ cursor: 'pointer' }} onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                            {user ? 'Dashboard' : 'Get started'}
                        </Typography>
                        {!user && (
                            <Typography size="xs" color="muted" style={{ cursor: 'pointer' }} onClick={() => navigate('/login')}>
                                Sign in
                            </Typography>
                        )}
                    </Container>
                </Container>
            </Band>
        </Page>
    );
};

export default HomePage;
