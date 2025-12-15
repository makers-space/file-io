import React, { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    codeBlockPlugin,
    codeMirrorPlugin,
    CodeToggle,
    CreateLink,
    diffSourcePlugin,
    DiffSourceToggleWrapper,
    headingsPlugin,
    imagePlugin,
    InsertCodeBlock,
    InsertImage,
    InsertTable,
    InsertThematicBreak,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    ListsToggle,
    MDXEditor,
    quotePlugin,
    Separator,
    tablePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
    UndoRedo
} from '@mdxeditor/editor';
import {ThemeProvider, useTheme} from '../contexts/ThemeContext';

/**
 * Editor - Enhanced MDX Editor component with full theme integration and diff support
 *
 * Features:
 * - Complete MDX Editor functionality with rich text editing
 * - Full theme system integration with custom CSS variables
 * - Customizable toolbar with all standard features
 * - Content styling that matches application themes
 * - Plugin-based architecture for extensibility
 * - Support for markdown shortcuts, code blocks, tables, images, etc.
 * - Diff/source view toggle with version comparison support
 * - Theme inheritance support
 */
export const Editor = forwardRef(({
    className = '',

    onChange = null,
    placeholder = 'Start writing...',
    readOnly = false,
    autoFocus = false,

    // Regular content props (no Yjs here)
    content = '',

    // Add error handling
    onError = null,
    showParseErrors = true,

    // Diff mode configuration
    diffContent = '', // content to compare against

    // Theming props
    theme = null,
    contentClassName = '',

    // Layout props
    width = null,
    height = null,
    minWidth = null,
    minHeight = null, // Minimum height value (e.g., '200px', '10rem', '50vh')
    maxWidth = null,
    maxHeight = null,

    // Spacing props
    marginTop = null,
    marginBottom = null,
    justifySelf = null,

    // Toolbar configuration
    showToolbar = true,
    customToolbar = null,
    toolbarPosition = 'top', // 'top', 'bottom', 'none'

    // Image upload handler
    imageUploadHandler = null,

    // Event handlers
    onFocus = null,
    onBlur = null,
    onKeyDown = null,

    ...props
}, ref) => {
    const {currentTheme: globalTheme} = useTheme();
    const effectiveTheme = useTheme();
    const editorRef = useRef(null);

    // Use content prop directly - no Yjs management here
    const effectiveContent = content || '';

    // Set content when it changes from outside
    useEffect(() => {
        if (editorRef.current && content !== undefined) {
            const currentContent = editorRef.current.getMarkdown();

            // Only set if content is different to avoid cursor jumps
            if (content !== currentContent) {
                editorRef.current.setMarkdown(content);
            }
        }
    }, [content]);

    // Use theme prop if provided, otherwise use effective theme from context
    const editorTheme = theme || effectiveTheme.currentTheme;

    // Consolidated style calculation - removes redundant if-else blocks
    const { style: styleProp, ...restProps } = props;

    const editorStyles = useMemo(() => {
        const styles = {...(styleProp || {})};

        // Margin handling
        const marginMap = {
            xs: 'var(--spacing-xs)',
            sm: 'var(--spacing-sm)',
            md: 'var(--spacing-md)',
            lg: 'var(--spacing-lg)',
            xl: 'var(--spacing-xl)'
        };
        if (marginTop !== null) {
            styles.marginTop = marginTop === 'none' ? '0' : (marginMap[marginTop] || marginTop);
        }
        if (marginBottom !== null) {
            styles.marginBottom = marginBottom === 'none' ? '0' : (marginMap[marginBottom] || marginBottom);
        }

        // Other styles
        if (justifySelf) styles.justifySelf = justifySelf;
        if (width !== null) styles.width = width;
        if (minHeight !== null) styles.minHeight = minHeight;

        return styles;
    }, [marginTop, marginBottom, justifySelf, width, minHeight, styleProp]);

    // Hybrid image upload handler - uses data URLs for simplicity with fallback
    const defaultImageUploadHandler = useCallback(async (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                reject(new Error('File must be an image'));
                return;
            }

            // Check file size (limit to 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                reject(new Error('Image size must be less than 5MB'));
                return;
            }

            // Use data URL approach for now (works without authentication)
            const reader = new FileReader();

            reader.onload = () => {
                resolve(reader.result);
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsDataURL(file);
        });
    }, []);

    // Create plugins array - all plugins enabled by default
    const plugins = useMemo(() => {
        const pluginArray = [];

        // All plugins enabled by default
        pluginArray.push(headingsPlugin());
        pluginArray.push(listsPlugin());
        pluginArray.push(quotePlugin());
        pluginArray.push(thematicBreakPlugin());

        pluginArray.push(linkPlugin());
        pluginArray.push(linkDialogPlugin({
            linkAutocompleteSuggestions: []
        }));

        pluginArray.push(imagePlugin({
            imageUploadHandler: imageUploadHandler || defaultImageUploadHandler,
            imageAutocompleteSuggestions: []
        }));

        pluginArray.push(tablePlugin());

        pluginArray.push(codeBlockPlugin({
            defaultCodeBlockLanguage: 'js'
        }));
        pluginArray.push(codeMirrorPlugin({
            codeBlockLanguages: {
                js: 'JavaScript',
                jsx: 'JavaScript (React)',
                ts: 'TypeScript',
                tsx: 'TypeScript (React)',
                html: 'HTML',
                css: 'CSS',
                json: 'JSON',
                md: 'Markdown',
                txt: 'Plain Text',
                bash: 'Bash',
                python: 'Python',
                sql: 'SQL',
                yml: 'YAML'
            },
            autoLoadLanguageSupport: true
        }));

        // Frontmatter disabled to prevent parsing issues
        // pluginArray.push(frontmatterPlugin());

        // Temporarily disable markdown shortcuts to prevent HTML entity encoding
        // pluginArray.push(markdownShortcutPlugin());

        if (showToolbar && toolbarPosition !== 'none') {
            pluginArray.push(toolbarPlugin({
                toolbarContents: customToolbar || (() => (
                    <DiffSourceToggleWrapper>
                        <UndoRedo/>
                        <Separator/>
                        <BoldItalicUnderlineToggles/>
                        <CodeToggle/>
                        <Separator/>
                        <BlockTypeSelect/>
                        <Separator/>
                        <CreateLink/>
                        <InsertImage/>
                        <InsertTable/>
                        <InsertCodeBlock/>
                        <InsertThematicBreak/>
                        <Separator/>
                        <ListsToggle/>
                    </DiffSourceToggleWrapper>
                ))
            }));
        }

        pluginArray.push(diffSourcePlugin({
            viewMode: 'rich-text',
            diffMarkdown: diffContent || ''
        }));

        return pluginArray;
    }, [showToolbar, toolbarPosition, customToolbar, imageUploadHandler, defaultImageUploadHandler, diffContent]);

    // Create content className that includes theme-specific styling
    const contentEditableClassName = useMemo(() => {
        const baseClasses = ['themed-editor-content'];

        if (contentClassName) {
            baseClasses.push(contentClassName);
        }

        return baseClasses.join(' ');
    }, [contentClassName]);

    // Create combined class names
    const combinedClasses = [
        'themed-editor',
        `themed-editor-${editorTheme}`,
        'mdxeditor',
        className
    ].filter(Boolean).join(' ');

    // Combine all styles
    const combinedStyle = editorStyles;

    const handleChange = useCallback((value) => {
        // Simple onChange handler - no Yjs logic here
        onChange?.(value);
    }, [onChange]);

    // Forward ref methods
    // Forward ref methods
    React.useImperativeHandle(ref, () => ({
        getMarkdown: () => editorRef.current?.getMarkdown(),
        setMarkdown: (value) => editorRef.current?.setMarkdown(value),
        insertMarkdown: (value) => editorRef.current?.insertMarkdown(value),
        focus: () => editorRef.current?.focus(),
        blur: () => editorRef.current?.blur()
    }));

    const editorRenderKey = useMemo(
        () => [showToolbar ? 'toolbar-on' : 'toolbar-off', toolbarPosition, readOnly ? 'read-only' : 'editable'].join(':'),
        [showToolbar, toolbarPosition, readOnly]
    );

    const editorComponent = (
        <div
            className={combinedClasses}
            data-theme={editorTheme}
            data-theme-source={theme ? 'local' : 'inherited'}
            style={combinedStyle}
            {...restProps}
        >
            <MDXEditor
                key={editorRenderKey}
                ref={editorRef}
                markdown={effectiveContent || ''}
                onChange={handleChange}
                onFocus={onFocus}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
                readOnly={readOnly}
                autoFocus={autoFocus}
                placeholder={placeholder}
                contentEditableClassName={contentEditableClassName}
                plugins={plugins}
                suppressHtmlProcessing={true}
            />
        </div>
    );

    // Apply ThemeProvider wrapper if theme is provided
    const wrappedComponent = theme ? (
        <ThemeProvider theme={theme}>
            {editorComponent}
        </ThemeProvider>
    ) : editorComponent;

    return wrappedComponent;
});

Editor.displayName = 'Editor';

export default Editor;