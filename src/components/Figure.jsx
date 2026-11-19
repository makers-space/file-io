import React, { useEffect, useRef, useState } from 'react';

// The figures the Hairline package draws, by name.
export const FIGURES = [
    'riffle', 'terrain', 'exploded', 'phosphor', 'slow', 'turntable', 'keyboard', 'elevator', 'phone', 'laptop', 'terminal',
    'cabinet', 'branches', 'vault', 'lockers', 'padlock', 'patch', 'dish', 'router', 'loupe', 'sieve', 'rail', 'plug', 'query',
    'drawer', 'basket', 'plot', 'hub', 'relay', 'settle', 'format', 'rebuild', 'stack'
];

// A Hairline figure: an isometric line drawing that answers the pointer. It takes its colours from the app's theme.
// What the app is doing drives it: `play` walks it through its answer while something is under way, and `intensity`
// (0 to 1) is how strongly it answers, so it can follow a progress or a count.
export const Figure = ({
    name = 'loupe',
    intensity = 0.5,
    play = false,
    label = null,
    onRead = null,
    width = '100%',
    maxWidth = '280px',
    className = ''
}) => {
    const stage = useRef(null);
    const figure = useRef(null);
    const read = useRef(onRead);
    read.current = onRead;
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        let live = true;
        setMissing(false);
        import('@lucasmarkes/hairline').then((library) => {
            const draw = library[FIGURES.includes(name) ? name : 'loupe'];
            if (!live || !stage.current || typeof draw !== 'function') return;
            figure.current = draw(stage.current, { intensity, play, ...(label ? { label } : {}), onRead: (text) => read.current?.(text) });
        }).catch(() => { if (live) setMissing(true); });
        return () => {
            live = false;
            figure.current?.destroy();
            figure.current = null;
        };
    }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        figure.current?.update({ intensity, play, ...(label ? { label } : {}) });
    }, [intensity, play, label]);

    if (missing) return null;
    return <div ref={stage} className={`figure ${className}`.trim()} style={{ width, maxWidth }} />;
};

export default Figure;
