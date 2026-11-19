import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@contexts/ThemeContext';

// A sealed frame that shows a web page given as text. The page runs its own scripts, but it is cut off from the app
// around it: it has no access to the app's page, its sign-in or its storage, and it cannot load or send anything
// over the network. Everything the page needs has to be inside its own text.
const RULES = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'; base-uri 'none'";
// Links are sent to a new tab, which the frame is not allowed to open, so a link in the page does nothing.
const SEAL = `<meta http-equiv="Content-Security-Policy" content="${RULES}"><base target="_blank">`;
// The one thing a sealed page tells the app: how tall its content is, so the frame can be made to fit it with no
// scrolling inside, and that it was pressed, which the app's own pop-ups need to know to close. It is told nothing back.
const REPORT = `<script>(function(){var last=0;function size(){var b=document.body;if(!b)return;var top=Infinity,bottom=-Infinity,i,c,r;for(i=0;i<b.children.length;i++){c=b.children[i];if(c.tagName==='SCRIPT'||c.tagName==='STYLE')continue;r=c.getBoundingClientRect();if(!r.width&&!r.height)continue;top=Math.min(top,r.top);bottom=Math.max(bottom,r.bottom)}var s=getComputedStyle(b),h=bottom<top?document.documentElement.scrollHeight:Math.ceil(bottom-top+parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+parseFloat(s.marginTop)+parseFloat(s.marginBottom));if(Math.abs(h-last)>1){last=h;parent.postMessage({sealedFrame:'height',height:h},'*')}}function watch(){size();if(!document.body||!window.ResizeObserver)return;var seen=new ResizeObserver(size);seen.observe(document.documentElement);var each=function(){for(var i=0;i<document.body.children.length;i++)seen.observe(document.body.children[i]);size()};each();new MutationObserver(each).observe(document.body,{childList:true})}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();addEventListener('load',size);addEventListener('pointerdown',function(){parent.postMessage({sealedFrame:'pressed'},'*')},true)})()</script>`;

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
    const radius = styles.getPropertyValue('--button-radius').trim() || styles.getPropertyValue('--border-radius-md').trim();
    if (radius) theme.radius = radius;
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

// A dressed page has its own buttons and sliders drawn in the app's look: its typeface, its button shape and its
// colours. A page's switch between its own light and dark is hidden, because the app's theme decides that.
const DRESS = '<style>body,body *:not(code,pre,kbd,samp){font-family:var(--app-font,inherit)!important;letter-spacing:0!important}button{height:28px!important;padding:0 12px!important;font-size:12px!important;font-weight:500!important;line-height:1!important;border:1px solid var(--app-primary)!important;border-radius:var(--app-radius,6px)!important;background:var(--app-surface,transparent)!important;color:var(--app-text)!important;cursor:pointer}button:hover{background:color-mix(in srgb,var(--app-primary) 16%,var(--app-surface,transparent))!important}button[aria-pressed="true"]{background:var(--app-primary)!important;color:var(--app-contrast,var(--app-background))!important}button:focus-visible,input:focus-visible{outline:2px solid var(--app-primary)!important;outline-offset:2px!important}input[type="range"]{accent-color:var(--app-primary)}input[type="range"]::-webkit-slider-runnable-track{height:3px!important;border-radius:2px;background:color-mix(in srgb,var(--app-primary) 35%,transparent)!important}input[type="range"]::-webkit-slider-thumb{width:14px!important;height:14px!important;margin-top:-6px!important;border:none!important;background:var(--app-primary)!important}input[type="range"]::-moz-range-track{height:3px!important;background:color-mix(in srgb,var(--app-primary) 35%,transparent)!important}input[type="range"]::-moz-range-thumb{width:14px!important;height:14px!important;border:none!important;background:var(--app-primary)!important}[aria-label*="theme" i],span:has(+ [aria-label*="theme" i]){display:none!important}</style>';

export const sealPage = (html, { theme = {}, variables = null, dressed = false } = {}) => {
    const text = String(html ?? '');
    // The theme goes at the end of the page's own head, so the page's styles can use it and a mapped colour wins.
    const style = `${Object.keys(theme).length > 0 || variables ? themeStyle(theme, variables) : ''}${dressed ? DRESS : ''}`;
    const close = (page) => (style ? (/<\/head>/i.test(page) ? page.replace(/<\/head>/i, () => `${style}</head>`) : page.replace(SEAL, () => `${SEAL}${style}`)) : page);
    const head = text.match(/<head[^>]*>/i);
    if (head) return close(text.replace(head[0], () => `${head[0]}${SEAL}${REPORT}`));
    const root = text.match(/<html[^>]*>/i);
    if (root) return close(text.replace(root[0], () => `${root[0]}<head>${SEAL}${REPORT}</head>`));
    return close(`<!doctype html><html><head><meta charset="utf-8">${SEAL}${REPORT}</head><body>${text}</body></html>`);
};

export const Frame = ({
    html = '',
    title = 'Page',
    width = '100%',
    height = '480px',
    minHeight = null,
    fit = false, // Grow or shrink to the height of the page's content, so nothing scrolls inside the frame
    dressed = false, // Draw the page's own buttons and sliders in the app's look
    bordered = true,
    themed = true,
    variables = null,
    theme = null,
    className = '',
    ...props
}) => {
    const { currentTheme } = useTheme();
    const frame = useRef(null);
    // The colours are read when the theme is put on the page, which is a moment after it is chosen: reading at the
    // choice itself gave the theme before. The page's own body is watched, so the frame follows whatever sets it.
    const [appTheme, setAppTheme] = useState(() => (themed ? readAppTheme() : {}));
    useEffect(() => {
        if (!themed) return undefined;
        const read = () => setAppTheme((now) => {
            const next = readAppTheme();
            return JSON.stringify(next) === JSON.stringify(now) ? now : next;
        });
        // A theme's own styles may arrive a little after its name is put on the page, so the colours are read again.
        const timers = [];
        const later = () => {
            requestAnimationFrame(read);
            timers.push(setTimeout(read, 300), setTimeout(read, 1200));
        };
        const watcher = new MutationObserver(later);
        read();
        later();
        watcher.observe(document.head, { childList: true });
        watcher.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
        watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
        return () => {
            watcher.disconnect();
            timers.forEach(clearTimeout);
        };
    }, [themed, currentTheme]);
    const page = useMemo(() => sealPage(html, { theme: themed ? appTheme : {}, variables, dressed: dressed && themed }), [html, themed, appTheme, variables, dressed]);
    // What the page reports is taken only from this frame's own page. A page whose height follows the frame's would
    // grow for ever, so the fitting stops after a number of changes.
    const [fitted, setFitted] = useState(null);
    const changes = useRef(0);
    useEffect(() => {
        changes.current = 0;
        setFitted(null);
    }, [html]);
    useEffect(() => {
        const heard = (event) => {
            if (!frame.current || event.source !== frame.current.contentWindow || !event.data || typeof event.data !== 'object') return;
            if (event.data.sealedFrame === 'pressed') frame.current.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            if (event.data.sealedFrame === 'height' && fit && Number.isFinite(event.data.height) && changes.current < 24) {
                changes.current += 1;
                setFitted(Math.min(6000, Math.max(40, Math.ceil(event.data.height))));
            }
        };
        window.addEventListener('message', heard);
        return () => window.removeEventListener('message', heard);
    }, [fit]);
    const style = { width, height: fit && fitted !== null ? `${fitted + (bordered ? 2 : 0)}px` : height };
    if (minHeight !== null) style.minHeight = minHeight;

    return (
        <iframe
            ref={frame}
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
