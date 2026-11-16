import React, { createContext, forwardRef, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '@contexts/ThemeContext';
import { useGeniePortal } from './Genie';

const BUTTON_COLOR_TOKENS = {
    primary: 'var(--primary-color)',
    secondary: 'var(--secondary-color)',
    tertiary: 'var(--tertiary-color)',
    success: 'var(--success-color)',
    warning: 'var(--warning-color)',
    error: 'var(--error-color)'
};

// Context for ButtonGroup to manage selection
export const ButtonGroupContext = createContext(null);

// Context for Button to share state with children (like Icon)
export const ButtonContext = createContext(null);

/**
 * Button - Enhanced themed button component with Genie integration
 * Automatically toggles selected state when clicked
 * Inherits colors and styling from the current theme
 *
 * Enhanced Features:
 * - Full Genie positioning support
 * - Corner-aware floating card positioning
 * - Built-in trigger capabilities for tooltips, popovers, context menus
 * - Automatic hover state management
 * - Theme inheritance support via theme prop
 */
export const Button = forwardRef(({
    children,
    className = '',
    color = 'primary', // 'primary', 'secondary', 'tertiary', 'success', 'warning', 'error'
    variant = null, // Special variant: 'border-shadow' for unique styling
    align = 'center', // Content alignment: 'start', 'center', 'end'
    flat = false, // true keeps hover and selected states free of border, shadow and lift
    round = false, // true makes a circular button, for a single icon
    size = 'md', // 'xxs', 'xs', 'sm', 'md', 'lg', 'xl'
    disabled = false,
    selected: externalSelected = null, // Allow external control of selected state
    type = 'button',
    onClick,
    width = null, // Width value (e.g., '100%', '200px', '10rem')
    height = null, // Height value (e.g., '2.5rem', '40px')
    minWidth = null, // Minimum width (e.g., '100px', '5rem')
    minHeight = null, // Minimum height (e.g., '2rem', '32px')
    maxWidth = null, // Maximum width (e.g., '500px', '100%')
    maxHeight = null, // Maximum height (e.g., '10rem', '200px')
    theme = null, // Optional theme override for this button
    marginTop = null, // Margin top: 'none', 'xs', 'sm', 'md', 'lg', 'xl' or custom value
    marginBottom = null, // Margin bottom: 'none', 'xs', 'sm', 'md', 'lg', 'xl' or custom value
    justifySelf = null, // CSS justify-self property: 'auto', 'start', 'end', 'center', 'stretch'
    // Genie integration props
    genie = null, // Genie content to show
    genieTrigger = 'click', // 'click', 'hover', 'contextmenu'
    onGenieShow = null, // Callback when genie shows
    onGenieHide = null, // Callback when genie hides
    title = null, // Helper text, shown in the app's own style after a short hover
    ...props
}, ref) => {
    const {currentTheme: globalTheme} = useTheme();
    // Use theme prop if provided, otherwise use effective theme from context
    const buttonTheme = theme || globalTheme;

    // Helper function to convert margin prop to CSS style
    const getMarginStyle = () => {
        const style = {};

        // Width and height
        if (width !== null) style.width = width;
        if (height !== null) style.height = height;
        if (minWidth !== null) style.minWidth = minWidth;
        if (minHeight !== null) style.minHeight = minHeight;
        if (maxWidth !== null) style.maxWidth = maxWidth;
        if (maxHeight !== null) style.maxHeight = maxHeight;

        // Only apply margins if explicitly provided
        if (marginTop !== null) {
            if (marginTop === 'none') {
                style.marginTop = '0';
            } else if (['xs', 'sm', 'md', 'lg', 'xl'].includes(marginTop)) {
                style.marginTop = `var(--spacing-${marginTop})`;
            } else {
                style.marginTop = marginTop;
            }
        }

        // Only apply margins if explicitly provided
        if (marginBottom !== null) {
            if (marginBottom === 'none') {
                style.marginBottom = '0';
            } else if (['xs', 'sm', 'md', 'lg', 'xl'].includes(marginBottom)) {
                style.marginBottom = `var(--spacing-${marginBottom})`;
            } else {
                style.marginBottom = marginBottom;
            }
        }

        return style;
    };

    const buttonGroupContext = useContext(ButtonGroupContext);

    // Parse genie prop - support both old API and new object API
    const genieConfig = useMemo(() => {
        if (!genie) return null;

        if (typeof genie === 'object' && genie.content) {
            // New API: genie is an object with trigger, content
            return {
                ...genie,
                trigger: genie.trigger || genieTrigger
            };
        }

        // Old API: genie is just the content, other props are separate
        return {
            content: genie,
            trigger: genieTrigger
        };
    }, [genie, genieTrigger]);

    // Genie integration using simplified portal hook
    // The button keeps its own reference for its pop-ups and passes the element on to whoever asked for it.
    const buttonRef = useRef(null);
    const setButtonRef = (node) => {
        buttonRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    };
    const {triggerProps: genieTriggerProps, GeniePortal} = useGeniePortal(
        genieConfig,
        buttonRef,
        onGenieShow,
        onGenieHide
    );
    // Determine the actual selected state - external selected prop takes priority over ButtonGroup
    const isSelected = externalSelected !== null
        ? externalSelected
        : (buttonGroupContext
            ? buttonGroupContext.selectedButton === buttonGroupContext.buttonId
            : false);

    // Helper text: the title is drawn by the button itself, so it looks the same in every browser and theme.
    const [tip, setTip] = useState(null);
    const tipTimer = useRef(null);
    const showTip = (e) => {
        const button = e?.currentTarget;
        if (!title || !button) return;
        clearTimeout(tipTimer.current);
        tipTimer.current = setTimeout(() => {
            if (!button.isConnected) return;
            const box = button.getBoundingClientRect();
            const below = box.bottom + 40 < window.innerHeight;
            setTip({ x: box.left + box.width / 2, y: below ? box.bottom + 6 : box.top - 6, below });
        }, 500);
    };
    const hideTip = () => {
        clearTimeout(tipTimer.current);
        setTip(null);
    };
    useEffect(() => () => clearTimeout(tipTimer.current), []);
    const placeTip = (element) => {
        if (!element || !tip) return;
        const half = element.offsetWidth / 2;
        element.style.left = `${Math.min(Math.max(tip.x, half + 8), window.innerWidth - half - 8)}px`;
    };

    const handleClick = (e) => {
        if (disabled) return;
        hideTip();

        // Handle Genie click trigger first
        if (genieConfig && genieConfig.trigger === 'click') {
            // Call the genie click handler from triggerProps if it exists
            if (genieTriggerProps.onClick) {
                // Create a new event to prevent stopPropagation from affecting this event
                const genieEvent = {...e};
                genieTriggerProps.onClick(genieEvent);
            }
            // Continue with button logic instead of returning early
        }

        // Only participate in ButtonGroup selection if no external selected prop is provided
        if (buttonGroupContext && externalSelected === null) {
            // In a ButtonGroup - notify the group of selection
            buttonGroupContext.onButtonSelect(buttonGroupContext.buttonId);
        }

        // Call external onClick if provided
        if (onClick) {
            onClick(e);
        }
    };

    // Merge button onClick with genie trigger props (for non-click triggers)
    const withTip = (name, own) => (e) => {
        own(e);
        genieTriggerProps[name]?.(e);
        props[name]?.(e);
    };
    const combinedProps = {
        ...genieTriggerProps,
        onMouseEnter: withTip('onMouseEnter', showTip),
        onMouseLeave: withTip('onMouseLeave', hideTip),
        onClick: handleClick // Always use our handleClick which handles both Genie and Button logic
    };
    const getVariantClass = () => {
        if (!variant) return '';
        if (variant === 'border-shadow') {
            return 'themed-button-border-shadow';
        }
        return `themed-button-variant-${variant}`;
    };

    const getColorClass = () => {
        return `themed-button-${color}`;
    };

    const getVariantColorValue = () => {
        return BUTTON_COLOR_TOKENS[color] || color || BUTTON_COLOR_TOKENS.primary;
    };

    const getSizeClass = () => ['xxs', 'xs', 'sm', 'lg', 'xl'].includes(size) ? size : 'md';

    const getSelectedClass = () => {
        const extras = [isSelected ? 'selected' : '', ['start', 'end'].includes(align) ? `button-align-${align}` : '', flat ? 'button-flat' : '', round ? 'button-round' : ''];
        return extras.filter(Boolean).join(' ');
    };

    const getJustifySelfClass = () => {
        if (justifySelf) {
            return `justify-self-${justifySelf}`;
        }
        return '';
    };

    const variantColorValue = getVariantColorValue();

    return (
        <ButtonContext.Provider value={{ size }}>
            <button
                ref={setButtonRef}
                type={type}
                className={`button themed-button ${getVariantClass()} ${getColorClass()} ${getSizeClass()} ${getSelectedClass()} ${getJustifySelfClass()} ${genieConfig ? 'genie-trigger' : ''} theme-${buttonTheme} ${className}`}
                disabled={disabled}
                data-theme={buttonTheme}
                data-theme-source={theme ? 'local' : 'inherited'}
                data-genie-position={genieConfig?.position || 'auto'}
                aria-label={title || undefined}
                {...props}
                {...combinedProps}
                style={{ ...getMarginStyle(), ...(variantColorValue ? { '--button-variant-color': variantColorValue } : {}) }}
            >
                <span className="button-content">
                    {children}
                </span>
            </button>
            {tip && createPortal(
                <span
                    ref={placeTip}
                    role="tooltip"
                    className={`button-tip theme-${buttonTheme} ${tip.below ? '' : 'button-tip-above'}`}
                    data-theme={buttonTheme}
                    style={{ left: tip.x, top: tip.y }}
                >
                    {title}
                </span>,
                document.body
            )}
            {/* Genie Integration using Portal */}
            {GeniePortal}
        </ButtonContext.Provider>
    );
});

Button.displayName = 'Button';

export default Button;
