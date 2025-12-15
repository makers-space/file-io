import React, { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '@contexts/ThemeContext';
import Icon from './Icon';
import Badge from './Badge';
import './styles/Select.css';

const SELECT_VALIDATION_STATES = new Set(['default', 'success', 'warning', 'error']);
const SELECT_COLOR_OPTIONS = ['primary', 'secondary', 'tertiary'];

const sanitizeValidationState = (state) => (SELECT_VALIDATION_STATES.has(state) ? state : 'default');

/**
 * Select - Enhanced select dropdown component with search functionality
 * Searchable dropdown with filtering capabilities
 * Supports multiple variants, sizes, states, labels, and help text
 * Now includes multi-select variant with badge-styled options and values
 * Inherits styling from the current theme
 */
export const Select = ({
    className = '',
    variant = 'default', // 'default', 'outline', 'filled', 'underline'
    color = 'primary', // 'primary', 'secondary', 'tertiary'
    size = 'md', // 'xs', 'sm', 'md', 'lg', 'xl'
    multiSelect = false, // Enable multi-select mode with badges
    options = [],
    value,
    onChange,
    placeholder = 'Search options...',
    label = '',
    disabled = false,
    required = false,
    helpText = '',
    validationState = 'default', // 'default', 'success', 'warning', 'error'
    width = null, // Width value (e.g., '100%', '200px', '10rem')
    height = null, // Height value
    minWidth = null, // Minimum width value
    minHeight = null, // Minimum height value
    maxWidth = null, // Maximum width value
    maxHeight = null, // Maximum height value
    theme = null, // Optional theme override for this select
    justifySelf = null, // CSS justify-self property: 'auto', 'start', 'end', 'center', 'stretch'
    marginTop = null, // 'none', 'xs', 'sm', 'md', 'lg', 'xl' or custom value
    marginBottom = null, // 'none', 'xs', 'sm', 'md', 'lg', 'xl' or custom value
    // Validation props
    validate = false, // Enable/disable validation - now defaults to false, auto-enabled by required
    onValidation = null, // Callback for validation results
    ...props
}) => {
    const {currentTheme: globalTheme} = useTheme();
    const effectiveTheme = useTheme();

    // Use theme prop if provided, otherwise use effective theme from context
    const selectTheme = theme || effectiveTheme.currentTheme;

    // Badge color variants for multi-select - only available variants
    const badgeVariants = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'error', 'default'];

    const effectiveColor = SELECT_COLOR_OPTIONS.includes(color) ? color : 'primary';
    const colorClass = `select-color-${effectiveColor}`;
    const sanitizedValidationState = sanitizeValidationState(validationState);

    // Function to get badge color based on position in selected values array
    const getBadgeVariant = (optionValue, position = null) => {
        // If position is provided (for selected badges), use position-based assignment
        if (position !== null) {
            return badgeVariants[position % badgeVariants.length];
        }

        // For dropdown options, find the position of this value in normalizedValue array
        if (multiSelect && normalizedValue.length > 0) {
            const selectedIndex = normalizedValue.indexOf(optionValue);
            if (selectedIndex !== -1) {
                return badgeVariants[selectedIndex % badgeVariants.length];
            }
        }

        // For unselected options in dropdown, use default (neutral) color
        return 'default';
    };

    // Normalize value for multi-select (ensure it's always an array)
    const normalizedValue = multiSelect
        ? (Array.isArray(value) ? value : (value ? [value] : []))
        : value;

    // Generate a stable unique ID for the select element using React's useId hook
    const reactId = useId();
    const selectId = props.id || `select-${reactId}`;
    const selectName = props.name || selectId;

    // References
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const badgeContainerRef = useRef(null);

    // State for select
    const [isFocused, setIsFocused] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [internalValidation, setInternalValidation] = useState({isValid: true, message: ''});
    const [isTouched, setIsTouched] = useState(false);
    const [badgeContainerHeight, setBadgeContainerHeight] = useState(0);

    // Get the display text for the selected value
    const getDisplayText = () => {
        if (multiSelect) {
            // For multi-select, we'll show the search term when open, otherwise show placeholder
            if (isOpen) return searchTerm;
            if (normalizedValue.length === 0) return '';
            if (normalizedValue.length === 1) {
                const selectedOption = options.find(opt => opt.value === normalizedValue[0]);
                return selectedOption ? (selectedOption.label || selectedOption.value) : normalizedValue[0];
            }
            return `${normalizedValue.length} items selected`;
        }

        if (!value) return '';
        const selectedOption = options.find(opt => opt.value === value);
        return selectedOption ? (selectedOption.label || selectedOption.value) : value;
    };

    // Filter options based on search term
    const getFilteredOptions = () => {
        if (!searchTerm) return options;

        const search = searchTerm.toLowerCase();

        return options.filter(option => {
            const label = (option.label || option.value || '').toLowerCase();
            const value = (option.value || '').toLowerCase();
            return label.includes(search) || value.includes(search);
        });
    };

    const filteredOptions = getFilteredOptions();

    // Update badge container height when badges change
    useEffect(() => {
        if (badgeContainerRef.current && multiSelect && normalizedValue.length > 0) {
            const height = badgeContainerRef.current.getBoundingClientRect().height;
            setBadgeContainerHeight(height);
        } else {
            setBadgeContainerHeight(0);
        }
    }, [multiSelect, normalizedValue]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
                setFocusedIndex(-1);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (disabled) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                    setFocusedIndex(0);
                } else {
                    setFocusedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                }
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (isOpen) {
                    setFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                }
                break;

            case 'Enter':
                e.preventDefault();
                if (isOpen && focusedIndex >= 0 && filteredOptions[focusedIndex]) {
                    handleOptionSelect(filteredOptions[focusedIndex]);
                } else if (!isOpen) {
                    setIsOpen(true);
                }
                break;

            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearchTerm('');
                setFocusedIndex(-1);
                inputRef.current?.blur();
                break;

            case 'Tab':
                setIsOpen(false);
                setSearchTerm('');
                setFocusedIndex(-1);
                break;
        }
    };

    const handleOptionSelect = (option) => {
        if (option.disabled) return;

        let newValue;

        if (multiSelect) {
            const currentValues = normalizedValue || [];
            if (currentValues.includes(option.value)) {
                // Remove if already selected
                newValue = currentValues.filter(v => v !== option.value);
            } else {
                // Add if not selected
                newValue = [...currentValues, option.value];
            }
        } else {
            newValue = option.value;
            setIsOpen(false);
            setSearchTerm('');
            setFocusedIndex(-1);
        }

        if (onChange) {
            // Modern value-based onChange - much cleaner for custom components
            onChange(newValue);
        }

        // For single select, close dropdown and focus input
        if (!multiSelect) {
            inputRef.current?.focus();
        } else {
            // For multi-select, clear search and keep dropdown open
            setSearchTerm('');
            setFocusedIndex(-1);
        }
    };

    // Handle removing selected values in multi-select mode
    const handleBadgeRemove = (valueToRemove, e) => {
        e.stopPropagation(); // Prevent opening dropdown

        if (disabled || !multiSelect) return;

        const newValue = normalizedValue.filter(v => v !== valueToRemove);

        if (onChange) {
            // Modern value-based onChange - consistent with handleOptionSelect
            onChange(newValue);
        }
    };

    const handleInputClick = () => {
        if (disabled) return;
        setIsOpen(!isOpen);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setFocusedIndex(-1);
        if (!isOpen) setIsOpen(true);
    };

    // Validation function for select
    const performValidation = (selectValue) => {
        // Auto-enable validation if required is true, or if validate is explicitly true
        const shouldValidate = required || validate;

        if (!shouldValidate || disabled) return {isValid: true, message: ''};

        if (required) {
            let isEmpty;
            if (multiSelect) {
                const values = Array.isArray(selectValue) ? selectValue : [];
                isEmpty = values.length === 0;
            } else {
                isEmpty = !selectValue || selectValue === '';
            }

            if (isEmpty) {
                const fieldLabel = label || 'Field';
                return {isValid: false, message: `${fieldLabel} is required`};
            }
        }

        return {isValid: true, message: ''};
    };

    // Effect to validate on value change
    React.useEffect(() => {
        const shouldValidate = required || validate;
        if (isTouched && shouldValidate) {
            const validation = performValidation(multiSelect ? normalizedValue : value);
            setInternalValidation(validation);

            // Call validation callback if provided
            if (onValidation) {
                onValidation(validation, selectName);
            }
        }
    }, [value, normalizedValue, isTouched, required, validate, multiSelect]);

    // Get effective help text - validation message or default helpText
    const getEffectiveHelpText = () => {
        const shouldValidate = required || validate;
        if (shouldValidate && isTouched && internalValidation.message) {
            return internalValidation.message;
        }
        return helpText;
    };

    // Get effective state for styling - validation state or prop state
    const getEffectiveValidationState = () => {
        const shouldValidate = required || validate;
        if (shouldValidate && isTouched) {
            if (!internalValidation.isValid) return 'error';

            // Check if we have a valid selection
            if (multiSelect) {
                return normalizedValue.length > 0 ? 'success' : 'default';
            } else {
                return value ? 'success' : 'default';
            }
        }
        return sanitizedValidationState;
    };

    const handleFocus = (e) => {
        setIsFocused(true);
        if (props.onFocus) {
            props.onFocus(e);
        }
    };

    const handleBlur = (e) => {
        setIsFocused(false);
        setIsTouched(true); // Mark as touched for validation
        if (props.onBlur) {
            props.onBlur(e);
        }
    };

    const getVariantClass = () => {
        return `themed-select-${variant}`;
    };

    const getColorClass = () => colorClass;

    const getSizeClass = () => {
        switch (size) {
            case 'xs':
                return 'select-xs';
            case 'sm':
                return 'select-sm';
            case 'lg':
                return 'select-lg';
            case 'xl':
                return 'select-xl';
            case 'md':
            default:
                return 'select-md';
        }
    };

    const getValidationStateClass = () => {
    if (sanitizedValidationState === 'default') return '';
    return `select-${sanitizedValidationState}`;
    };

    const getFocusClass = () => {
        return isFocused ? 'select-focused' : '';
    };

    const getDisabledClass = () => {
        return disabled ? 'select-disabled' : '';
    };

    const getHelpTextClass = () => {
        const baseClass = `select-help-text themed-help-text theme-${selectTheme}`;

        // Add size class for help text
        const sizeClass = getSizeClass().replace('select-', 'help-text-');

        const effectiveValidationState = getEffectiveValidationState();
        if (effectiveValidationState === 'default') {
            return `${baseClass} ${sizeClass} ${getColorClass()}`.trim();
        }
        return `${baseClass} select-help-text-${effectiveValidationState} ${sizeClass} ${getColorClass()}`.trim();
    };

    const getJustifySelfClass = () => {
        if (justifySelf) {
            return `justify-self-${justifySelf}`;
        }
        return '';
    };

    // Helper function to get badge size based on select size
    const getBadgeSize = () => {
        switch (size) {
            case 'xs':
                return 'xs';
            case 'sm':
                return 'sm';
            case 'lg':
                return 'md';
            case 'xl':
                return 'lg';
            case 'md':
            default:
                return 'sm';
        }
    };

    // Helper function to get icon size for badges based on select size
    const getBadgeIconSize = () => {
        switch (size) {
            case 'xs':
                return 'xs';
            case 'sm':
                return 'xs';
            case 'lg':
                return 'sm';
            case 'xl':
                return 'md';
            case 'md':
            default:
                return 'xs';
        }
    };

    // Helper function to get check icon size based on select size
    const getCheckIconSize = () => {
        switch (size) {
            case 'xs':
                return 'xs';
            case 'sm':
                return 'xs';
            case 'lg':
                return 'md';
            case 'xl':
                return 'lg';
            case 'md':
            default:
                return 'sm';
        }
    };

    // Helper function to get dropdown arrow icon size based on select size
    const getDropdownArrowSize = () => {
        switch (size) {
            case 'xs':
                return 'xs';
            case 'sm':
                return 'sm';
            case 'lg':
                return 'lg';
            case 'xl':
                return 'xl';
            case 'md':
            default:
                return 'md';
        }
    };

    // Helper function to get margin and sizing styles
    const getSelectStyle = () => {
        const style = {};

        // Handle width
        if (width !== null) {
            style.width = width;
        }

        // Handle height
        if (height !== null) {
            style.height = height;
        }

        // Handle minWidth
        if (minWidth !== null) {
            style.minWidth = minWidth;
        }

        // Handle minHeight
        if (minHeight !== null) {
            style.minHeight = minHeight;
        }

        // Handle maxWidth
        if (maxWidth !== null) {
            style.maxWidth = maxWidth;
        }

        // Handle maxHeight
        if (maxHeight !== null) {
            style.maxHeight = maxHeight;
        }

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

    // Function to get dynamic input padding based on badge container height
    const getDynamicInputStyle = () => {
        if (!multiSelect || normalizedValue.length === 0 || badgeContainerHeight === 0) return {};

        // Only add the minimum padding needed to account for the badge container height
        // Let CSS handle all the standard spacing - we just adjust for the dynamic badges
        const baseHeight = size === 'xs' ? 28 : size === 'sm' ? 32 : size === 'lg' ? 48 : size === 'xl' ? 56 : 40;

        return {
            paddingTop: `${badgeContainerHeight}px`,
            minHeight: `${baseHeight + badgeContainerHeight}px` // Ensure reasonable space for text
        };
    };

    const selectClasses = [
        'input', // Base class for styling compatibility
        'themed-select',
        `theme-${selectTheme}`,
        getVariantClass(),
        getSizeClass(),
        getValidationStateClass(),
        getFocusClass(),
        getDisabledClass(),
        getColorClass(),
        'searchable-select',
        className
    ].filter(Boolean).join(' ');

    // Generate ARIA attributes for accessibility
    const ariaAttributes = {
        'aria-invalid': (validate && isTouched && !internalValidation.isValid) || getEffectiveValidationState() === 'error' ? 'true' : 'false',
        'aria-required': required ? 'true' : 'false',
        'aria-describedby': (getEffectiveHelpText() || helpText) ? `${selectId}-help` : undefined,
        'aria-expanded': isOpen,
        'aria-haspopup': 'listbox',
        'aria-activedescendant': focusedIndex >= 0 ? `${selectId}-option-${focusedIndex}` : undefined
    };

    return (
        <div
            ref={containerRef}
            className={`select-container ${getColorClass()} ${getJustifySelfClass()} ${isOpen ? 'select-open' : ''}`}
            style={getSelectStyle()}
        >
            {label && (
                <label
                    htmlFor={selectId}
                    className={`select-label themed-label theme-${selectTheme} ${getColorClass()}`}
                    data-theme={selectTheme}
                >
                    {label}
                    {required && <span className="select-required">*</span>}
                </label>
            )}

            <div className={`select-input-container ${multiSelect && normalizedValue.length > 0 ? 'has-badges' : ''}`}>
                {/* Multi-select badges display */}
                {multiSelect && normalizedValue.length > 0 && (
                    <div ref={badgeContainerRef} className="select-badges-container">
                        {normalizedValue.map((selectedValue, index) => {
                            const selectedOption = options.find(opt => opt.value === selectedValue);
                            const displayText = selectedOption ? (selectedOption.label || selectedOption.value) : selectedValue;
                            const badgeVariant = getBadgeVariant(selectedValue, index); // Pass position for consistent color rotation

                            return (
                                <Badge
                                    key={selectedValue}
                                    color={badgeVariant}
                                    size={getBadgeSize()}
                                    className="select-badge"
                                    theme={selectTheme}
                                >
                                    {displayText}
                                    <Icon
                                        name="FiX"
                                        size={getBadgeIconSize()}
                                        color="error"
                                        className="select-badge-remove"
                                        onClick={(e) => handleBadgeRemove(selectedValue, e)}
                                    />
                                </Badge>
                            );
                        })}
                    </div>
                )}

                <input
                    ref={inputRef}
                    id={selectId}
                    name={selectName}
                    type="text"
                    className={selectClasses}
                    value={isOpen ? searchTerm : getDisplayText()}
                    onChange={handleSearchChange}
                    onClick={handleInputClick}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={multiSelect && normalizedValue.length > 0 ? 'Add more...' : placeholder}
                    disabled={disabled}
                    readOnly={!isOpen}
                    autoComplete="off"
                    data-theme={selectTheme}
                    data-theme-source={theme ? 'local' : 'inherited'}
                    style={getDynamicInputStyle()}
                    {...ariaAttributes}
                />

                <div className={`select-dropdown-arrow ${isOpen ? 'select-dropdown-arrow-open' : ''}`}>
                    <Icon name="FiChevronDown" size={getDropdownArrowSize()} color={effectiveColor}/>
                </div>

                {isOpen && (
                    <div
                        ref={listRef}
                        className="select-dropdown"
                        role="listbox"
                        aria-labelledby={label ? `${selectId}-label` : undefined}
                    >
                        {filteredOptions.length === 0 ? (
                            <div
                                className={`select-no-options ${getSizeClass().replace('select-', 'select-option-')}`}>No
                                options found</div>
                        ) : (
                            filteredOptions.map((option, index) => {
                                const isSelected = multiSelect
                                    ? normalizedValue.includes(option.value)
                                    : option.value === value;
                                const badgeVariant = getBadgeVariant(option.value);

                                return (
                                    <div
                                        key={`${selectId}-option-${index}`}
                                        id={`${selectId}-option-${index}`}
                                        className={`select-option ${getSizeClass().replace('select-', 'select-option-')} ${index === focusedIndex ? 'select-option-focused' : ''} ${option.disabled ? 'select-option-disabled' : ''} ${isSelected ? 'select-option-selected' : ''}`}
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleOptionSelect(option)}
                                        onMouseEnter={() => setFocusedIndex(index)}
                                    >
                                        {multiSelect ? (
                                            <div className="select-option-content">
                                                <Badge
                                                    color={badgeVariant}
                                                    size={getBadgeSize()}
                                                    className="select-option-badge"
                                                    theme={selectTheme}
                                                >
                                                    {option.label || option.value}
                                                </Badge>
                                                {isSelected && (
                                                    <Icon
                                                        name="FiCheck"
                                                        size={getCheckIconSize()}
                                                        className="select-option-check"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            option.label || option.value
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {(getEffectiveHelpText() || helpText) && (
                <span
                    id={`${selectId}-help`}
                    className={getHelpTextClass()}
                    data-theme={selectTheme}
                >
          {getEffectiveHelpText()}
        </span>
            )}
        </div>
    );
};

export default Select;
