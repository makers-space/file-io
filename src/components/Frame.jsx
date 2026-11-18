import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@contexts/ThemeContext';

// A sealed frame that shows a web page given as text. The page runs its own scripts, but it is cut off from the app
// around it: it has no access to the app's page, its sign-in or its storage, and it cannot load or send anything
// over the network. Everything the page needs has to be inside its own text.
const RULES = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'";
// Links are sent to a new tab, which the frame is not allowed to open, so a link in the page does nothing.
const SEAL = `<meta http-equiv="Content-Security-Policy" content="${RULES}"><base target="_blank">`;

// The app theme's colours and typeface, handed to the page as --app-… variables so a page can match the app it is shown
// in. The page cannot read them itself, being sealed, so they are written into it.
const THEME_TOKENS = ['background', 'surface', 'text', 'border', 'primary', 'secondary', 'tertiary', 'neutral', 'success', 'warning', 'error'];
export const readAppTheme = () => {
    if (typeof document === 'undefined') return {};
    const styles = getComputedStyle(document.body);
    const theme = {};
    for (const token of THEME_TOKENS) {
        const value = styles.getPropertyValue(`--${token}-color`).trim();
        if (value) theme[token] = value;
    }
    const contrast = styles.getPropertyValue('--text-contrast-color').trim();
    if (contrast) theme.contrast = contrast;
    const font = styles.getPropertyValue('--font-family-primary').trim() || styles.fontFamily;
    if (font) theme.font = font;
    return theme;
};
const isDark = (color) => {
    const parts = String(color || '').match(/[\d.]+/g);
    const hex = String(color || '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    const [r, g, b] = hex ? (hex[1].length === 3 ? [...hex[1]].map((digit) => parseInt(digit + digit, 16)) : [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16))) : (parts || []).slice(0, 3).map(Number);
    return [r, g, b].every(Number.isFinite) ? (0.2126 * r + 0.7152 * g + 0.0722 * b) < 128 : false;
};
const safeValue = (value) => String(value).replace(/[;{}<>]/g, '');
const themeStyle = (theme, variables) => {
    const own = Object.entries(theme).map(([token, value]) => `--app-${token}:${safeValue(value)};`).join('');
    const scheme = theme.background ? `color-scheme:${isDark(theme.background) ? 'dark' : 'light'};` : '';
    const mapped = Object.entries(variables || {}).filter(([name]) => /^[\w-]+$/.test(name)).map(([name, value]) => `--${name}:${safeValue(value)} !important;`).join('');
    return `<style>:root{${own}${scheme}}${mapped ? `:root,:root[data-theme]{${mapped}}` : ''}</style>`;
};

export const sealPage = (html, { theme = {}, variables = null } = {}) => {
    const text = String(html ?? '');
    // The theme goes at the end of the page's own head, so the page's styles can use it and a mapped colour wins.
    const style = Object.keys(theme).length > 0 || variables ? themeStyle(theme, variables) : '';
    const close = (page) => (style ? (/<\/head>/i.test(page) ? page.replace(/<\/head>/i, () => `${style}</head>`) : page.replace(SEAL, () => `${SEAL}${style}`)) : page);
    const head = text.match(/<head[^>]*>/i);
    if (head) return close(text.replace(head[0], () => `${head[0]}${SEAL}`));
    const root = text.match(/<html[^>]*>/i);
    if (root) return close(text.replace(root[0], () => `${root[0]}<head>${SEAL}</head>`));
    return close(`<!doctype html><html><head><meta charset="utf-8">${SEAL}</head><body>${text}</body></html>`);
};

export const Frame = ({
    html = '',
    title = 'Page',
    width = '100%',
    height = '480px',
    minHeight = null,
    bordered = true,
    themed = true,
    variables = null,
    theme = null,
    className = '',
    ...props
}) => {
    const { currentTheme } = useTheme();
    // The colours are read after the theme has been applied, and again whenever it changes.
    const [appTheme, setAppTheme] = useState(() => (themed ? readAppTheme() : {}));
    useEffect(() => {
        if (themed) setAppTheme(readAppTheme());
    }, [themed, currentTheme]);
    const page = useMemo(() => sealPage(html, { theme: themed ? appTheme : {}, variables }), [html, themed, appTheme, variables]);
    const style = { width, height };
    if (minHeight !== null) style.minHeight = minHeight;

    return (
        <iframe
            className={`frame ${bordered ? 'frame-bordered' : ''} themed-frame theme-${theme || currentTheme} ${className}`.trim()}
            data-theme={theme || currentTheme}
            title={title}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            loading="lazy"
            srcDoc={page}
            style={style}
            {...props}
        />
    );
};

export default Frame;
