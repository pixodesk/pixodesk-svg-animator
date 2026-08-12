/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The DOM half of `animator.timelineSource: 'scroll'` (`driver: 'custom'` — the default
// and the reference implementation): measures the scroller/subject and turns scroll
// position into animation progress via the pure math in core `PxScrollMath`. The
// consumer decides what a progress value does (frames: seek `setCurrentTime`; waapi:
// same, via the engine-agnostic API).
//
// Event model: `scroll` (+`resize`) listeners, passive, coalesced into ONE
// requestAnimationFrame tick — at most one measurement + one seek per frame. A
// `ResizeObserver` (where available) catches subject/scroller size changes that happen
// without a scroll. TODO (optimisation, deliberate v1 omission): an IntersectionObserver
// gate to park the listeners entirely while the subject is far outside its range.

import {
    isScrollTimeline, scrollOffsetProgress, scrollResolveAxis, scrollViewProgress,
    type PxAnimatorConfig, type PxScroll,
} from '@pixodesk/svg-animator-core';


export interface PxScrollDriver {
    /** Detach every listener/observer. Idempotent. */
    destroy(): void;
    /** Re-measure and emit now (also called once on attach). */
    refresh(): void;
}

/** The nearest ancestor that can scroll on the given physical axis — the CSS "scroll
 *  container" definition: computed overflow other than `visible`/`clip` counts
 *  (`hidden` scrolls programmatically). Falls back to the document scroller. */
function findNearestScroller(el: Element, axis: 'x' | 'y'): Element | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
        const style = getComputedStyle(p);
        const overflow = axis === 'y' ? style.overflowY : style.overflowX;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden' || overflow === 'overlay') {
            return p;
        }
    }
    return null;
}

function documentScroller(): Element {
    return document.scrollingElement || document.documentElement;
}

/**
 * Attach a scroll driver for `subject` (the animation's root `<svg>`).
 * Emits `onProgress(0..1)` — clamped, range-mapped — on attach and on every
 * scroll/resize tick. Returns `null` when the document isn't scroll-driven.
 */
export function createScrollDriver(
    subject: Element,
    config: PxAnimatorConfig | undefined,
    onProgress: (progress: number) => void,
): PxScrollDriver | null {
    if (!config || !isScrollTimeline(config)) return null;

    const scroll: PxScroll = config.scroll || {};
    const kind = scroll.kind ?? 'view';

    // Scroller resolution (once, at attach): `view` always tracks the nearest scrollport;
    // `scroll` honours `source`. Axis resolves against the SCROLLER's writing mode.
    const nearest = findNearestScroller(subject, 'y') || findNearestScroller(subject, 'x');
    const scroller: Element = (kind === 'scroll' && scroll.source === 'root')
        ? documentScroller()
        : (nearest || documentScroller());
    const isRootScroller = scroller === documentScroller();
    const axis = scrollResolveAxis(scroll.axis, getComputedStyle(scroller).writingMode);

    const compute = (): number => {
        if (kind === 'scroll') {
            const offset = axis === 'y' ? scroller.scrollTop : scroller.scrollLeft;
            const maxOffset = axis === 'y'
                ? scroller.scrollHeight - scroller.clientHeight
                : scroller.scrollWidth - scroller.clientWidth;
            return scrollOffsetProgress(offset, maxOffset, scroll.range);
        }

        // view: subject's journey across the scrollport, in scrollport coordinates.
        const subjectRect = subject.getBoundingClientRect();
        let portStart: number, portSize: number;
        if (isRootScroller) {
            portStart = 0;
            // documentElement.client* excludes scrollbars (window.inner* does not).
            portSize = axis === 'y' ? document.documentElement.clientHeight : document.documentElement.clientWidth;
        } else {
            const portRect = scroller.getBoundingClientRect();
            portStart = axis === 'y' ? portRect.top : portRect.left;
            portSize = axis === 'y' ? scroller.clientHeight : scroller.clientWidth;
        }
        const subjectStart = (axis === 'y' ? subjectRect.top : subjectRect.left) - portStart;
        const subjectSize = axis === 'y' ? subjectRect.height : subjectRect.width;
        return scrollViewProgress(subjectStart, subjectSize, portSize, scroll.range);
    };

    // rAF coalescing: any number of scroll/resize events in a frame → one measurement.
    let rafId: number | null = null;
    let destroyed = false;
    const tick = () => {
        rafId = null;
        if (destroyed) return;
        onProgress(compute());
    };
    const schedule = () => {
        if (destroyed || rafId !== null) return;
        rafId = requestAnimationFrame(tick);
    };

    // Root scrolling fires on window; container scrolling on the container.
    const scrollTarget: EventTarget = isRootScroller ? window : scroller;
    scrollTarget.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(schedule);
        resizeObserver.observe(subject);
        if (!isRootScroller) resizeObserver.observe(scroller);
    }

    const driver: PxScrollDriver = {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            scrollTarget.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            resizeObserver?.disconnect();
            if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        },
        refresh: () => { if (!destroyed) onProgress(compute()); },
    };

    // Initial pose: reflect the CURRENT scroll position immediately (a page loaded
    // mid-scroll must not flash frame 0).
    driver.refresh();

    return driver;
}
