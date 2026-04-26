import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useTheme } from '@contexts/ThemeContext';
import { Badge, Button, CircularProgress, Container, FloatingActionButton, Icon, Page, Typography } from './Components';

// Standardized loading component for consistent UI across all pages
export const PageLoading = ({ message = "Loading..." }) => {
    return (
        <Page layout="flex" align="center" justify="center">
            <Container layout="flex-column" align="center" justify="center" gap="md">
                <CircularProgress size="lg"/>
                <Typography size="lg">{message}</Typography>
            </Container>
        </Page>
    );
};

// Route role configuration - simplified for role checking only
const getRouteConfig = () => {
    return {
        '/admin': {roles: ['ADMIN', 'OWNER']}
    };
};

const PUBLIC_PAGES = ['/'];

/**
 * Navigation - App navigation component with draggable FAB and Genie integration
 *
 * Features:
 * - Draggable floating action button for navigation
 * - Genie popup with navigation menu
 * - Authentication-aware navigation options
 * - Theme switching capability
 * - User profile quick access
 * - Contextual navigation based on user roles
 */
export const Navigation = ({
                               className = '',
                               position = 'top-right',
                               variant = 'primary',
                               size = 'md',
                               draggable = true,
                               theme = null,
                               ...props
                           }) => {
    const {user, isLoading, logout, hasRole} = useAuth();
    const {currentTheme, switchTheme, availableThemes} = useTheme();
    const [isNavigating, setIsNavigating] = useState(false);
    const navigate = useNavigate();

    // Navigation menu items based on authentication and roles
    const getNavigationItems = () => {
        const items = [];

        if (user) {
            // Dashboard
            items.push({
                id: 'dashboard',
                label: 'Dashboard',
                icon: 'FiHome',
                path: '/dashboard',
                requireAuth: true
            });

            // Files
            items.push({
                id: 'files',
                label: 'Files',
                icon: 'FiFolder',
                path: '/files',
                requireAuth: true
            });

            // Settings
            items.push({
                id: 'settings',
                label: 'Settings',
                icon: 'FiSettings',
                path: '/settings',
                requireAuth: true
            });

            // Admin panel for admin users
            if (hasRole('ADMIN') || hasRole('OWNER')) {
                items.push({
                    id: 'admin',
                    label: 'Admin Panel',
                    icon: 'FiShield',
                    path: '/admin',
                    roles: ['ADMIN', 'OWNER'],
                    requireAuth: true,
                    badge: 'Admin'
                });
            }
        } else {
            items.push({
                id: 'home-guest',
                label: 'Home',
                icon: 'FiHome',
                path: '/',
                publicOnly: true
            });

            // Guest navigation
            items.push({
                id: 'login',
                label: 'Sign In',
                icon: 'FiLogIn',
                path: '/login',
                publicOnly: true
            });

            items.push({
                id: 'signup',
                label: 'Sign Up',
                icon: 'FiUserPlus',
                path: '/signup',
                publicOnly: true
            });
        }

        return items.filter(item =>
            !item.roles || item.roles.some(role => hasRole(role))
        );
    };

    const navigationItems = getNavigationItems();

    const handleNavigation = (path) => {
        navigate(path);
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            // Silent error handling
        }
    };

    const handleThemeChange = (themeName) => {
        switchTheme(themeName);
    };

    // Genie content with navigation menu
    const genieContent = (
        <Container layout="flex-column" gap="sm" padding="sm">
            {/* Header */}
            <Container layout="flex" justify="between" align="center" gap="md" width="100%">
                <Typography as="h4" size="sm" weight="semibold">
                    Navigation
                </Typography>
                {user && (
                    <Badge color="primary" size="sm">
                        {user.username || user.email}
                    </Badge>
                )}
            </Container>

            {/* User info for authenticated users */}
            {user && (
                <Container
                    layout="flex"
                    gap="sm"
                    justify="around"
                    align="center"
                    padding="sm"
                    backgroundColor="background"
                    width="100%"
                >
                    <Icon name="FiUser" size="md"/>
                    <Container layout="flex-column" gap="xs">
                        <Typography as="p" size="sm" weight="medium">
                            {user.firstName} {user.lastName}
                        </Typography>
                        <Container layout="flex" gap="xs">
                            {user.roles?.map(role => (
                                <Badge
                                    key={role}
                                    color={role === 'OWNER' ? 'primary' : 'secondary'}
                                    size="sm"
                                >
                                    {role}
                                </Badge>
                            )) || <Badge color="secondary" size="sm">USER</Badge>}
                        </Container>
                    </Container>
                </Container>
            )}

            {/* Navigation Items */}
            <Container layout="flex-column" gap="xs" width="100%">
                <Typography as="p" size="xs" weight="medium">
                    MENU
                </Typography>
                {navigationItems.map(item => (
                    <Button
                        key={item.id}
                        size="sm"
                        align="left"
                        width="100%"
                        onClick={() => handleNavigation(item.path)}
                        disabled={isNavigating}
                    >
                        <Icon name={item.icon} size="xs"/>
                        {item.label}
                        {item.badge && (
                            <Badge color="tertiary" size="xs">
                                {item.badge}
                            </Badge>
                        )}
                    </Button>
                ))}
            </Container>

            {/* Theme Switcher */}
            <Container layout="flex-column" gap="xs">
                <Typography as="p" size="xs" weight="medium">
                    THEME
                </Typography>
                <Container layout="flex" gap="xs" wrap>
                    {availableThemes.map(themeName => (
                        <Button
                            key={themeName}
                            variant='ghost'
                            size="sm"
                            onClick={() => handleThemeChange(themeName)}
                        >
                            {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                        </Button>
                    ))}
                </Container>
            </Container>

            {/* Actions */}
            {user ? (
                <Container layout="flex-column" gap="xs" width="100%">
                    <Typography as="p" size="xs" weight="medium">
                        ACCOUNT
                    </Typography>
                    <Button
                        variant="ghost"
                        size="sm"
                        align="left"
                        width="100%"
                        onClick={handleLogout}
                        color="error"
                        disabled={isNavigating}
                    >
                        <Icon name="FiLogOut" size="xs"/>
                        Sign Out
                    </Button>
                </Container>
            ) : (
                <Container layout="flex" gap="sm">
                    <Button
                        color="primary"
                        size="sm"
                        onClick={() => handleNavigation('/login')}
                        disabled={isNavigating}
                    >
                        <Icon name="FiLogIn" size="sm"/>
                        Sign In
                    </Button>
                    <Button
                        color="secondary"
                        size="sm"
                        onClick={() => handleNavigation('/signup')}
                        disabled={isNavigating}
                    >
                        <Icon name="FiUserPlus" size="sm"/>
                        Sign Up
                    </Button>
                </Container>
            )}
        </Container>
    );

    return (
        <FloatingActionButton
            className={`navigation-fab ${className}`}
            color={variant}
            size={size}
            position={position}
            draggable={draggable}
            icon={isNavigating ? 'FiLoader' : 'FiMap'}
            theme={theme}
            disabled={isNavigating}
            genie={{
                trigger: 'click',
                content: genieContent,
                variant: 'menu',
                maxHeight: '48vh'
            }}
            title="Navigation Menu"
            aria-label="Open navigation menu"
            {...props}
        />
    );
};

// Simple route access control - just basic checks
export const RouteAccessControl = ({children, path}) => {
    const {user, isLoading} = useAuth();

    // Show loading during auth check
    if (isLoading) {
        return <PageLoading message="Loading..."/>;
    }

    // Simple auth pages list
    const authPages = ['/login', '/signup', '/forgot-password'];
    const isAuthPage = authPages.includes(path);

    // Redirect logic
    const isPublicPage = PUBLIC_PAGES.includes(path);
    if (!isAuthPage && !isPublicPage && !user) {
        // Protected page, no user - go to login
        return <Navigate to="/login" replace />;
    }

    if (isAuthPage && user) {
        // Auth page, but user is logged in - go to dashboard
        return <Navigate to="/dashboard" replace />;
    }

    // Simple role check for admin pages
    if (path === '/admin' && user && !user.roles?.includes('ADMIN') && !user.roles?.includes('OWNER')) {
        return (
            <Page layout="flex-column" align="center" justify="center" gap="lg" padding="xl">
                <Icon name="FiLock" size="xl" variant="error"/>
                <Typography size="xl" weight="bold">Access Denied</Typography>
                <Typography size="md" align="center">
                    Admin access required.
                </Typography>
            </Page>
        );
    }

    return children;
};

export default Navigation;
