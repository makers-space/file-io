import React, { forwardRef, useMemo, useRef } from 'react';
import { ThemeProvider, useTheme } from '@contexts/ThemeContext';
import Typography from './Typography';
import Container from './Container';
import { useGeniePortal } from './Genie';

/**
 * Page - Enhanced base container component for all pages
 * Provides consistent layout structure and theme integration
 * Now includes Container-like layout capabilities and Genie integration
 *
 * Enhanced Features:
 * - Full layout support (flex, grid, multicolumn, etc.)
 * - Genie integration for page-level interactions
 * - Theme inheritance for nested components
 * - All Container layout props available at page level
 */
export const Page = forwardRef(({
    children,
    className = '',
    title = '',
    // Layout props (same as Container)
    layout = 'block', // 'block', 'flex', 'flex-wrap', 'flex-column', 'grid', 'multicolumn', 'positioned'
    columns = 1, // 1-6 for grid layouts, or 'auto', 'auto-sm', 'auto-lg'
    gap = 'lg', // 'none', 'xs', 'sm', 'md', 'lg', 'xl'
    padding = 'lg', // 'none', 'xs', 'sm', 'md', 'lg', 'xl'
    align = 'start', // 'start', 'center', 'end', 'stretch', 'baseline'
    justify = 'start', // 'start', 'center', 'end', 'between', 'around', 'evenly', 'wrap'
    width = null, // Custom width
    height = null, // Custom height
    minWidth = null, // Minimum width
    minHeight = null, // Minimum height
    maxWidth = null, // Maximum width
    maxHeight = null, // Maximum height
    theme = null, // Optional theme override for this page and its children
    // Genie integration props
    genie = null, // Genie content to show OR object with {trigger, content, position}
    genieTrigger = 'click', // 'click', 'hover', 'contextmenu'
    onGenieShow = null, // Callback when genie shows
    onGenieHide = null, // Callback when genie hides
    ...props
}, ref) => {
    const {currentTheme: globalTheme} = useTheme();
    const effectiveTheme = useTheme();

    // Use theme prop if provided, otherwise use effective theme from context
    const pageTheme = theme || effectiveTheme.currentTheme;

    // Handle both old API (separate props) and new API (object with trigger, content, position)
    const genieConfig = useMemo(() => {
        if (!genie) return null;

        // New API: genie is an object with trigger, content, position
        if (typeof genie === 'object' && genie.content) {
            return {
                content: genie.content,
                trigger: genie.trigger || genieTrigger,
                position: genie.position || 'auto'
            };
        }

        // Old API: genie is just the content, other props are separate
        return {
            content: genie,
            trigger: genieTrigger,
            position: 'auto'
        };
    }, [genie, genieTrigger]);

    // Genie integration using simplified portal hook
    const pageRef = ref || useRef(null);
    const {triggerProps, GeniePortal} = useGeniePortal(
        genieConfig,
        pageRef,
        onGenieShow,
        onGenieHide
    );

    // Layout class generation functions (same as Container)
    const getLayoutClass = () => {
        switch (layout) {
            case 'grid':
                return 'layout-grid';
            case 'flex':
                return 'layout-flex';
            case 'flex-wrap':
                return 'layout-flex-wrap';
            case 'flex-column':
                return 'layout-flex-column';
            case 'multicolumn':
                return 'layout-multicolumn';
            case 'positioned':
                return 'layout-positioned';
            default:
                return 'layout-block';
        }
    };

    const getColumnsClass = () => {
        if (layout === 'grid') {
            if (typeof columns === 'string') {
                return `grid-${columns}`;
            }
            if (typeof columns === 'number' && columns >= 1 && columns <= 6) {
                return `grid-${columns}`;
            }
        }
        if (layout === 'multicolumn') {
            if (typeof columns === 'string' && columns === 'auto') {
                return 'columns-auto';
            }
            if (typeof columns === 'number' && columns >= 2 && columns <= 4) {
                return `columns-${columns}`;
            }
        }
        return '';
    };

    const getGapClass = () => {
        return `gap-${gap}`;
    };

    const getPaddingClass = () => {
        return `p-${padding}`;
    };

    const getAlignClass = () => {
        return `align-${align}`;
    };

    const getJustifyClass = () => {
        return `justify-${justify}`;
    };

    // Pass all props to DOM
    const domProps = props;

    // Merge user style
    const mergedStyle = {
        ...props.style
    };

    const pageElement = (
        <div
            ref={pageRef}
            {...domProps}
            {...triggerProps}
            style={mergedStyle}
            className={`page themed-page ${getLayoutClass()} ${getColumnsClass()} ${getGapClass()} ${getPaddingClass()} ${getAlignClass()} ${getJustifyClass()} ${genieConfig ? 'genie-trigger' : ''} theme-${pageTheme} ${className}`}
            data-theme={pageTheme}
            data-theme-source={theme ? 'local' : 'inherited'}
            data-genie-position={genieConfig?.position || 'auto'}
        >
            {title && (
                <Container className="page-header">
                    <Typography as="h1" color='primary'>{title}</Typography>
                </Container>
            )}
            {children}

            {/* Genie Integration */}
            {GeniePortal}
        </div>
    );

    // If theme prop is provided, wrap with ThemeProvider for inheritance
    if (theme) {
        return (
            <ThemeProvider theme={theme}>
                {pageElement}
            </ThemeProvider>
        );
    }

    return pageElement;
});

export default Page;
