import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Container } from './Container';
import Button from './Button';
import { ButtonGroup } from './ButtonGroup';
import Icon from './Icon';
import Typography from './Typography';
import CircularProgress from './CircularProgress';

// A PowerPoint file shown one slide at a time. The file is read and drawn in the browser; nothing is sent anywhere.
export const Slides = ({
    blob,
    fileName = 'slides.pptx',
    compact = false,
    width = '100%',
    height = '100%',
    onError,
    className = ''
}) => {
    const stage = useRef(null);
    const viewer = useRef(null);
    const [state, setState] = useState({ loading: true, count: 0, at: 0, problem: null });

    useEffect(() => {
        if (!blob) return undefined;
        let live = true;
        setState({ loading: true, count: 0, at: 0, problem: null });
        (async () => {
            try {
                const [{ PptxViewer, RECOMMENDED_ZIP_LIMITS }, bytes] = await Promise.all([import('@aiden0z/pptx-renderer'), blob.arrayBuffer()]);
                if (!live || !stage.current) return;
                const opened = await PptxViewer.open(bytes, stage.current, { renderMode: 'slide', zipLimits: RECOMMENDED_ZIP_LIMITS, pdfjs: false });
                if (!live) {
                    opened.destroy();
                    return;
                }
                viewer.current = opened;
                setState({ loading: false, count: opened.slideCount, at: 0, problem: null });
            } catch (error) {
                if (!live) return;
                setState({ loading: false, count: 0, at: 0, problem: 'This file could not be shown as slides.' });
                onError?.(error);
            }
        })();
        return () => {
            live = false;
            viewer.current?.destroy();
            viewer.current = null;
        };
    }, [blob]); // eslint-disable-line react-hooks/exhaustive-deps

    const go = useCallback((to) => {
        setState((now) => {
            const next = Math.min(Math.max(to, 0), now.count - 1);
            if (!viewer.current || next === now.at || now.count === 0) return now;
            viewer.current.goToSlide(next).catch(() => {});
            return { ...now, at: next };
        });
    }, []);

    const onKeyDown = (event) => {
        if (event.key === 'ArrowRight' || event.key === 'PageDown') go(state.at + 1);
        if (event.key === 'ArrowLeft' || event.key === 'PageUp') go(state.at - 1);
        if (event.key === 'Home') go(0);
        if (event.key === 'End') go(state.count - 1);
    };

    return (
        <Container className={`slides ${compact ? 'slides-compact' : ''} ${className}`.trim()} layout="flex-column" gap="xs" padding="none" width={width} height={height} tabIndex={0} onKeyDown={onKeyDown} aria-label={`Slides: ${fileName}`}>
            <Container className="slides-bar" layout="flex" wrap={false} align="center" justify="between" gap="xs" padding="none" width="100%">
                <Typography size="xs" color="muted" truncate title={fileName}>{fileName}</Typography>
                <Container layout="flex" wrap={false} align="center" gap="xs" padding="none">
                    <Typography size="xs" color="muted">{state.count > 0 ? `Slide ${state.at + 1} of ${state.count}` : ''}</Typography>
                    <ButtonGroup selectable={false} size="xs">
                        <Button size="xs" color="secondary" disabled={state.at <= 0} onClick={() => go(state.at - 1)} title="Previous slide"><Icon name="FiChevronLeft" size="xs" /></Button>
                        <Button size="xs" color="secondary" disabled={state.at >= state.count - 1} onClick={() => go(state.at + 1)} title="Next slide"><Icon name="FiChevronRight" size="xs" /></Button>
                    </ButtonGroup>
                </Container>
            </Container>
            <Container className="slides-stage" layout="block" padding="none" width="100%" flexFill>
                {state.loading && <Container className="slides-wait" layout="flex" align="center" justify="center" padding="md" width="100%"><CircularProgress size="sm" /></Container>}
                {state.problem && <Typography size="xs" color="warning">{state.problem}</Typography>}
                <Container ref={stage} className="slides-slide" layout="block" padding="none" width="100%" />
            </Container>
        </Container>
    );
};

export default Slides;
