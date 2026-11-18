import React, { useMemo } from 'react';
import { useTheme } from '@contexts/ThemeContext';

// A sealed frame that shows a web page given as text. The page runs its own scripts, but it is cut off from the app
// around it: it has no access to the app's page, its sign-in or its storage, and it cannot load or send anything
// over the network. Everything the page needs has to be inside its own text.
const RULES = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'";
// Links are sent to a new tab, which the frame is not allowed to open, so a link in the page does nothing.
const SEAL = `<meta http-equiv="Content-Security-Policy" content="${RULES}"><base target="_blank">`;

export const sealPage = (html) => {
    const text = String(html ?? '');
    const head = text.match(/<head[^>]*>/i);
    if (head) return text.replace(head[0], () => `${head[0]}${SEAL}`);
    const root = text.match(/<html[^>]*>/i);
    if (root) return text.replace(root[0], () => `${root[0]}<head>${SEAL}</head>`);
    return `<!doctype html><html><head><meta charset="utf-8">${SEAL}</head><body>${text}</body></html>`;
};

export const Frame = ({
    html = '',
    title = 'Page',
    width = '100%',
    height = '480px',
    minHeight = null,
    bordered = true,
    theme = null,
    className = '',
    ...props
}) => {
    const { currentTheme } = useTheme();
    const page = useMemo(() => sealPage(html), [html]);
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
