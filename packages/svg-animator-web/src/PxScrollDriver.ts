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

    // Smoothing is a per-frame easing of progress, which a browser-native timeline (a direct
    // scroll→time mapping) cannot express. Honour the authored LOOK over the perf hint — D8
    // already makes `native` a preference rather than a requirement.
    if (scroll.smoothing) {
        console.warn('scroll timeline: `smoothing` needs the built-in driver — ignoring `driver: "native"`');
        return null;
    }

    const g = globalThis as unknown as { ScrollTimeline?: NativeTimelineCtor; ViewTimeline?: NativeTimelineCtor };
    const view = kind === 'view';
    const Ctor = view ? g.ViewTimeline : g.ScrollTimeline;
    if (typeof Ctor !== 'function') return null;

    const axis = scroll.axis ?? 'block';
    let timeline: AnimationTimeline;
    try {
        if (view) {
            // `scroll.subject` is the same indirection the platform's own ViewTimeline takes.
            timeline = new Ctor({ subject: resolveScrollSubject(subject, scroll.subject), axis });
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

/**
 * The nearest ancestor that can scroll on the given physical axis — the CSS "scroll
 * container" definition: computed overflow other than `visible`/`clip` counts
 * (`hidden` scrolls programmatically). Returns null when there is none, so callers fall
 * back to the document scroller.
 *
 * `<html>` and `<body>` are NEVER returned. CSS propagates the root element's overflow to
 * the VIEWPORT (and, when the root's is `visible`, the body's instead) — so with the very
 * common `body { overflow-y: auto }` the body computes as `auto` yet is not a scroll
 * container at all: the viewport scrolls, `body.scrollTop` stays 0, and `body`'s rect is
 * the full content box rather than the 100vh scrollport. Returning it produced a frozen,
 * badly-scaled progress (a doc that never advanced, or sat at a fixed mid-value). The
 * document scroller — which the caller measures with viewport semantics — is the right
 * answer for both elements.
 */
export function findNearestScroller(el: Element, axis: 'x' | 'y'): Element | null {
    const body = document.body;
    const root = document.documentElement;
    for (let p = el.parentElement; p; p = p.parentElement) {
        if (p === body || p === root) return null;   // the viewport scrolls for these — see above
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

/** `scroll.subject` keywords (anything else is treated as a CSS selector). */
const SUBJECT_PARENT = 'parent';
const SUBJECT_SCROLLER = 'scroller';

/**
 * WHICH element's journey `kind: 'view'` measures — `scroll.subject`. Unset = the animation's
 * own `<svg>` (the original behaviour).
 *
 * `'parent'` is the pinned-section answer and needs no knowledge of the host's markup: a
 * `position: sticky` element STOPS MOVING once stuck, so measuring the graphic itself freezes
 * progress for exactly the stretch that should be animating. Walking out to the outermost
 * sticky/fixed ancestor's container gives the element that really does scroll past — and its
 * `contain` phase is precisely the pinned stretch.
 *
 * Never throws and never returns null: an unresolvable selector warns and falls back to the
 * `<svg>`, because a silent freeze is indistinguishable from a broken animation.
 */
export function resolveScrollSubject(svgRoot: Element, subject: string | undefined): Element {
    const spec = subject?.trim();
    if (!spec) return svgRoot;

    if (spec === SUBJECT_PARENT) {
        // Outermost sticky/fixed ancestor wins — nested sticky wrappers are common.
        let outermostPinned: Element | null = null;
        for (let p = svgRoot.parentElement; p && p !== document.body; p = p.parentElement) {
            const position = getComputedStyle(p).position;
            if (position === 'sticky' || position === 'fixed') outermostPinned = p;
        }
        return outermostPinned?.parentElement ?? svgRoot.parentElement ?? svgRoot;
    }

    if (spec === SUBJECT_SCROLLER) {
        return findNearestScroller(svgRoot, 'y') || findNearestScroller(svgRoot, 'x') || documentScroller();
    }

    let found: Element | null = null;
    try {
        found = document.querySelector(spec);
    } catch {
        console.warn('scroll timeline: subject "' + spec + '" is not a valid selector — measuring the SVG itself');
        return svgRoot;
    }
    if (!found) {
        console.warn('scroll timeline: subject "' + spec + '" matched no element — measuring the SVG itself');
        return svgRoot;
    }
    return found;
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

    // WHAT is measured (`view` only): the SVG itself by default, or whatever `scroll.subject`
    // names — the pinned-section case measures the wrapper that actually scrolls past.
    const measured = resolveScrollSubject(subject, scroll.subject);

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

        // view: the MEASURED element's journey across the scrollport, in scrollport coordinates.
        const subjectRect = measured.getBoundingClientRect();
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

    // ── smoothing (`scroll.smoothing`, GSAP's `scrub: <seconds>`) ───────────────────────
    // Without it, emitted progress IS the measurement. With it, the emitted value chases the
    // measurement with an exponential ease, so momentum scrolling and trackpad jitter read as
    // a glide instead of a snap. Frame-rate independent (`1 - exp(-dt/tau)`), and it SETTLES
    // exactly on the target rather than asymptotically near it.
    const smoothingSec = Math.max(0, scroll.smoothing ?? 0) / 1000;   // schema is in ms
    // An exponential ease only approaches its target, so snap the last sliver and stop the rAF
    // loop rather than idling for another second. 0.1% of progress = 1ms of a 1s animation —
    // far below anything visible, and it keeps the tail off the battery.
    const SETTLE_EPSILON = 0.001;
    let destroyed = false;
    let smoothed: number | null = null;      // null until the first emit (which is instant)
    let smoothRaf: number | null = null;
    let lastFrameMs = 0;

    const emit = (target: number) => {
        if (!smoothingSec) { onProgress(target); return; }
        if (smoothed === null) { smoothed = target; onProgress(target); return; }   // no lag on load
        if (smoothRaf !== null) return;      // already chasing
        lastFrameMs = 0;
        const step = (nowMs: number) => {
            smoothRaf = null;
            if (destroyed) return;
            const dtSec = lastFrameMs ? Math.min(0.1, (nowMs - lastFrameMs) / 1000) : 1 / 60;
            lastFrameMs = nowMs;
            const goal = compute();          // re-measure: the user may still be scrolling
            const k = 1 - Math.exp(-dtSec / smoothingSec);
            smoothed = smoothed! + (goal - smoothed!) * k;
            if (Math.abs(goal - smoothed!) < SETTLE_EPSILON) smoothed = goal;   // land exactly
            onProgress(smoothed!);
            if (smoothed !== goal) smoothRaf = requestAnimationFrame(step);
        };
        smoothRaf = requestAnimationFrame(step);
    };

    // rAF coalescing: any number of scroll/resize events in a frame → one measurement.
    let rafId: number | null = null;
    const tick = () => {
        rafId = null;
        if (destroyed) return;
        emit(compute());
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
        resizeObserver.observe(measured);
        if (measured !== subject) resizeObserver.observe(subject);
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
            if (smoothRaf !== null) { cancelAnimationFrame(smoothRaf); smoothRaf = null; }
        },
        // `refresh` is a deliberate JUMP (attach, host relayout) — never eased.
        refresh: () => { if (!destroyed) { smoothed = compute(); onProgress(smoothed); } },
    };

    // Initial pose: reflect the CURRENT scroll position immediately (a page loaded
    // mid-scroll must not flash frame 0).
    driver.refresh();

    return driver;
}


/**
 * Pin the canvas on screen for the scrubbed stretch — GSAP's `pin: true`, expressed as
 * `position: sticky`. Sticky keeps the element's space in normal flow, so (unlike GSAP's
 * `position: fixed`) no spacer has to be injected into the host's layout to stop the page
 * collapsing. Optionally wraps the canvas in a tall block so the PLAYER creates the scroll
 * travel and the host page needs no CSS at all.
 *
 * Returns a cleanup that restores the DOM exactly. No-op (and no cleanup cost) when `pin` is off.
 */
export function applyScrollPin(svgRoot: Element, scroll: PxScroll | undefined): () => void {
    const styled = svgRoot as Element & Partial<ElementCSSInlineStyle>;
    if (!scroll?.pin || !styled.style) return () => { /* nothing pinned */ };

    const style = styled.style;
    const prevPosition = style.position;
    const prevTop = style.top;
    style.position = 'sticky';
    style.top = (scroll.pinTop ?? 0) + 'px';

    // `pinDistance` (in viewport heights) — the travel the pin should last for.
    let wrapper: HTMLElement | null = null;
    const parent = svgRoot.parentElement;
    if (scroll.pinDistance && scroll.pinDistance > 0 && parent) {
        wrapper = document.createElement('div');
        wrapper.setAttribute('data-px-pin', '');
        wrapper.style.height = (scroll.pinDistance * 100) + 'vh';
        parent.insertBefore(wrapper, svgRoot);
        wrapper.appendChild(svgRoot);
    }

    return () => {
        style.position = prevPosition;
        style.top = prevTop;
        if (wrapper?.parentElement) {
            wrapper.parentElement.insertBefore(svgRoot, wrapper);
            wrapper.remove();
        }
    };
}
