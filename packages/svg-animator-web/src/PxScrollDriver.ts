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


// ── Native timeline support (`driver: 'native'`) ────────────────────────────────────────
// `ScrollTimeline`/`ViewTimeline` aren't in TS's dom lib yet — minimal local declarations,
// resolved from globalThis so absence is an ordinary feature-detect, never a crash.

interface NativeTimelineCtor { new(options: Record<string, unknown>): AnimationTimeline }

interface PxNativeScrollTimeline {
    timeline: AnimationTimeline;
    /** WAAPI `Animation.rangeStart/rangeEnd` values (TimelineRangeOffset-shaped). */
    rangeStart?: Record<string, unknown>;
    rangeEnd?: Record<string, unknown>;
}

function nativeRangeOffset(point: { phase?: string; fraction?: number } | undefined, defaultFraction: number, view: boolean): Record<string, unknown> | undefined {
    const fraction = typeof point?.fraction === 'number' ? point.fraction : defaultFraction;
    const pct = (globalThis as { CSS?: { percent?: (n: number) => unknown } }).CSS?.percent?.(fraction * 100);
    if (pct === undefined) return undefined;
    // Named phases exist only on VIEW timelines; a scroll timeline takes a bare offset.
    return view ? { rangeName: point?.phase ?? 'cover', offset: pct } : { offset: pct };
}

/**
 * Build the browser-native timeline for `driver: 'native'`, or `null` when the platform
 * doesn't support scroll-driven WAAPI timelines — the caller then falls back to the
 * custom driver (D8: the option is a preference, never a requirement).
 */
export function createNativeScrollTimeline(
    subject: Element,
    config: PxAnimatorConfig | undefined,
): PxNativeScrollTimeline | null {
    if (!config || !isScrollTimeline(config)) return null;
    const scroll: PxScroll = config.scroll || {};
    const kind = scroll.kind ?? 'view';

    const g = globalThis as unknown as { ScrollTimeline?: NativeTimelineCtor; ViewTimeline?: NativeTimelineCtor };
    const view = kind === 'view';
    const Ctor = view ? g.ViewTimeline : g.ScrollTimeline;
    if (typeof Ctor !== 'function') return null;

    const axis = scroll.axis ?? 'block';
    let timeline: AnimationTimeline;
    try {
        if (view) {
            timeline = new Ctor({ subject, axis });
        } else {
            const source = scroll.source === 'root'
                ? documentScroller()
                : (findNearestScroller(subject, 'y') || findNearestScroller(subject, 'x') || documentScroller());
            timeline = new Ctor({ source, axis });
        }
    } catch (e) {
        console.warn('scroll timeline: native timeline construction failed — falling back to the custom driver', e);
        return null;
    }

    return {
        timeline,
        rangeStart: nativeRangeOffset(scroll.range?.start, 0, view),
        rangeEnd: nativeRangeOffset(scroll.range?.end, 1, view),
    };
}


export interface PxScrollDriver {
    /** Detach every listener/observer. Idempotent. */
    destroy(): void;
    /** Re-measure and emit now (also called once on attach). */
    refresh(): void;
}

/** The nearest ancestor that can scroll on the given physical axis — the CSS "scroll
 *  container" definition: computed overflow other than `visible`/`clip` counts
 *  (`hidden` scrolls programmatically). Falls back to the document scroller. */
export function findNearestScroller(el: Element, axis: 'x' | 'y'): Element | null {
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
