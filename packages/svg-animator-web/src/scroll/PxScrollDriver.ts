// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The DOM half of a scroll timeline (`animator.timelineSource: 'scroll'`): finds what is followed and its screen in the
// page, and turns its place into progress through core's `PxScrollMath` — the player's own measuring (`engine: 'js'`,
// `smoothing`, the fallback of `auto`) — or hands both to the browser's own timeline (`createNativeScrollTimeline`).
//
// | What is followed | Resolved to |
// |---|---|
// | `thisDomElement` (default) | the animation's root |
// | `parentDomElement`, and a held element | the nearest ancestor that really moves (sticky / fixed ones skipped) |
// | `pageDomElement` + `selector` | the page's element; an element handed over by page code wins |
// | `pageScroll` | the page's scroller |
// | `containerScroll` (+ `selector`) | the scrolling box around the animation, or the box the selector names |
//
// "The screen" is the scrolling box around the FOLLOWED element — on both engines (the browser's view timeline takes
// the subject's own nearest scroller).
//
// | What moves the playhead | How our measuring sees it |
// |---|---|
// | scrolling | `scroll` listener (on `window` for the page), coalesced into one frame |
// | a resize | `resize` listener, `ResizeObserver` |
// | a layout move with no scroll (D8) | an element is measured every frame while it is within a screen of the screen (`IntersectionObserver`) |
// | a CSS transform | counted (we read the box as drawn), not by the browser's timeline — accepted limit |

import { followsElement, PxDiagnosticCode, PxDiagnosticKind, PxHoldAt, PxScrollAxis, PxScrollFollows, PxScrollMoment, PX_SCROLL_MOMENT_ORDER, type PxAnimatorRuntimeConfig, type PxDiagnostics } from '@pixodesk/svg-animator-core';
import { isNativeForced } from '@pixodesk/svg-animator-core/engine';
import type { PxNativeRangeOffset } from '../shared/PxAnimatorWebTypes';
import { clampShare, createDiagnostics, cssRangeOfMoment, isScrollTimeline, scrollMomentFor, scrollOffsetProgress, scrollResolveAxis, scrollViewProgress, type PxCssRangeName, type PxScrollMomentSettings, type PxScrollSettings } from '@pixodesk/svg-animator-core/internal';


// ── What is followed ─────────────────────────────────────────────────────────────────────────────────────────────

/** The settings as followed: an element handed over by page code is `pageDomElement` (a held element ignores it). */
function settingsFollowing(scroll: PxScrollSettings | undefined, handed: Element | undefined): PxScrollSettings {
    const settings = scroll ?? {};
    return handed && !settings.holdOnScreen ? { ...settings, follows: PxScrollFollows.pageDomElement } : settings;
}

/** An element's place on the screen is followed — the `…DomElement` words and a held element — not a scrolled amount. */
function followsAnElement(scroll: PxScrollSettings): boolean {
    return !!scroll.holdOnScreen || followsElement(scroll.follows);
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

/** The scrolling box around an element — its nearest scroller (vertical first), else the page's. */
function screenAround(el: Element): Element {
    return findNearestScroller(el, 'y') || findNearestScroller(el, 'x') || documentScroller();
}

/**
 * The nearest ancestor that really moves: a `position: sticky` element STOPS MOVING once stuck, so following it would
 * freeze the progress for exactly the stretch that should play. Walking out to the outermost sticky / fixed ancestor's
 * parent gives the element that really scrolls past — for a held element, its held section (the wrapper the player
 * injects for `forScreens`, or the page's own tall section).
 */
function movingAncestor(root: Element): Element {
    let outermostPinned: Element | null = null;   // nested sticky wrappers are common
    for (let p = root.parentElement; p && p !== document.body; p = p.parentElement) {
        const position = getComputedStyle(p).position;
        if (position === 'sticky' || position === 'fixed') outermostPinned = p;
    }
    return outermostPinned?.parentElement ?? root.parentElement ?? root;
}

/** `selector` in the page — `null`, with a warning, when it is invalid (1303, the file's value) or matches nothing (1304,
 *  the page's business): a silent freeze is indistinguishable from a broken animation. */
function queryPage(selector: string, root: Element, report: PxDiagnostics): Element | null {
    const spec = selector.trim();
    let found: Element | null = null;
    try {
        found = (root.ownerDocument ?? document).querySelector(spec);
    } catch {
        report.warn(PxDiagnosticKind.document, PxDiagnosticCode.scrollSubjectInvalid, spec);
        return null;
    }
    if (!found) report.warn(PxDiagnosticKind.host, PxDiagnosticCode.scrollSubjectNoMatch, spec);
    return found;
}

/**
 * The element whose place on the screen is followed (the `…DomElement` words, a held element). Never throws, never null:
 * what cannot be resolved falls back to the animation's root.
 * - held → its held section ({@link movingAncestor}); `follows`, `selector` and a handed-over element are not used
 * - an element handed over by page code (`timelineOptions.follows`) → it
 * - `parentDomElement` → {@link movingAncestor}; `pageDomElement` → `selector` in the page; otherwise the root
 */
export function resolveFollowedElement(root: Element, scroll: PxScrollSettings | undefined, diag?: PxDiagnostics, handed?: Element): Element {
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');
    if (scroll?.holdOnScreen) return movingAncestor(root);
    if (handed) return handed;
    if (scroll?.follows === PxScrollFollows.parentDomElement) return movingAncestor(root);
    if (scroll?.follows === PxScrollFollows.pageDomElement && scroll.selector) return queryPage(scroll.selector, root, report) ?? root;
    return root;
}

/** The scroller whose scrolled amount is followed (the `…Scroll` words): `pageScroll` → the page's; `containerScroll` →
 *  the box `selector` names, else (or when it cannot be found) the scrolling box around the animation. */
export function resolveScrollSource(root: Element, scroll: PxScrollSettings | undefined, diag?: PxDiagnostics): Element {
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');
    if (scroll?.follows === PxScrollFollows.pageScroll) return documentScroller();
    const named = scroll?.selector ? queryPage(scroll.selector, root, report) : null;
    if (named === document.body || named === document.documentElement) return documentScroller();   // the viewport scrolls for these
    return named ?? screenAround(root);
}


// ── Native timeline support (`timeline.engine: 'native'`, tried first by `auto`) ────────────────────────────────────────
// `ScrollTimeline`/`ViewTimeline` aren't in TS's dom lib yet — minimal local declarations,
// resolved from globalThis so absence is an ordinary feature-detect, never a crash.

/** The constructor options of the browser's `ScrollTimeline` (`source`) / `ViewTimeline` (`subject`), plus the axis — not in the DOM typings. */
interface PxNativeTimelineOptions { source?: Element | null; subject?: Element | null; axis?: string }
interface NativeTimelineCtor { new(options: PxNativeTimelineOptions): AnimationTimeline }

/** A browser timeline constructor (`ScrollTimeline` / `ViewTimeline`) — absent where unsupported, and not in the DOM typings. */
function isTimelineCtor(value: unknown): value is NativeTimelineCtor {
    return typeof value === 'function';
}

interface PxNativeScrollTimeline {
    timeline: AnimationTimeline;
    /** WAAPI `Animation.rangeStart/rangeEnd` values. */
    rangeStart?: PxNativeRangeOffset;
    rangeEnd?: PxNativeRangeOffset;
}

/** One end of the stretch as the browser's range takes it: a share of a named range (a view timeline), or of the whole
 *  scroll (a scroll timeline — no name). */
interface PxNativeEnd { rangeName?: PxCssRangeName; share: number }

/** The axis the browser's constructors take: absent → `block` (the way the page scrolls), else `y` / `x`. */
function nativeAxis(axis: PxScrollAxis | undefined): 'block' | 'x' | 'y' {
    return axis === PxScrollAxis.vertical ? 'y' : axis === PxScrollAxis.horizontal ? 'x' : 'block';
}

/** A moment that is an exact place (`{ element, screen }`) — no word. */
function isExactPlace(moment: PxScrollMomentSettings): boolean {
    return moment.moment === undefined && moment.scrolled === undefined;
}

/**
 * The two ends as the browser's range, in scroll order — `null` when one has no spelling with a known order:
 * - an element: two words only — compared by {@link PX_SCROLL_MOMENT_ORDER}, a reversed pair swapped; an exact place
 *   (even one CSS can say, `entry-crossing`) has no order the browser knows, so the player measures by itself
 * - a scrolled amount: two shares, clamped and swapped into scroll order
 */
function nativeEnds(scroll: PxScrollSettings): [PxNativeEnd, PxNativeEnd] | null {
    const first = scrollMomentFor(scroll, 'first');
    const last = scrollMomentFor(scroll, 'last');
    if (!followsAnElement(scroll)) {
        const a = clampShare(first.scrolled ?? 0), b = clampShare(last.scrolled ?? 1);
        return a <= b ? [{ share: a }, { share: b }] : [{ share: b }, { share: a }];
    }
    if (first.moment === undefined || last.moment === undefined) return null;
    const inOrder = PX_SCROLL_MOMENT_ORDER.indexOf(first.moment) <= PX_SCROLL_MOMENT_ORDER.indexOf(last.moment);
    const start = cssRangeOfMoment(inOrder ? first : last, PxScrollMoment.appears);
    const end = cssRangeOfMoment(inOrder ? last : first, PxScrollMoment.gone);
    if (!start || !end) return null;
    return [{ rangeName: start.name, share: start.fraction }, { rangeName: end.name, share: end.fraction }];
}

/** An end as `Animation.rangeStart` / `rangeEnd` take it — `undefined` without the CSS Typed OM (`CSS.percent`). */
function nativeRangeOffset(end: PxNativeEnd): PxNativeRangeOffset | undefined {
    if (typeof CSS === 'undefined' || typeof CSS.percent !== 'function') return undefined;
    const offset = CSS.percent(end.share * 100);
    return end.rangeName ? { rangeName: end.rangeName, offset } : { offset };
}

// @px-importance important
/**
 * Build the browser's own timeline (`engine: 'native'` / `auto`), or `null` when the player must measure by itself —
 * the caller then falls back to {@link createScrollDriver} (`native` is a preference, never a requirement):
 * - `smoothing` (warns 1301); an exact place (warns 1307 when `native` asked for the browser's); no `ScrollTimeline` /
 *   `ViewTimeline` or no `CSS.percent` in this browser; a constructor that throws (warns 1302)
 * - the `…DomElement` words and a held element → `ViewTimeline({ subject: followed })`; the `…Scroll` words →
 *   `ScrollTimeline({ source })`
 */
export function createNativeScrollTimeline(
    root: Element,
    config: PxAnimatorRuntimeConfig | undefined,
    diag?: PxDiagnostics,
    handed?: Element,
): PxNativeScrollTimeline | null {
    // Exported, so the channel is optional and falls back to the console (review §5).
    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');
    if (!config || !isScrollTimeline(config)) return null;
    const scroll = settingsFollowing(config.scroll, handed);

    // Smoothing is a per-frame easing of progress, which a browser-native timeline (a direct
    // scroll→time mapping) cannot express. Honor the authored LOOK over the perf hint.
    if (scroll.smoothing) {
        report.warn(PxDiagnosticKind.platform, PxDiagnosticCode.scrollSmoothingNeedsOwnDriver);
        return null;
    }

    const ends = nativeEnds(scroll);
    if (!ends) {
        if (isNativeForced(config.engine)) {
            const place = [scrollMomentFor(scroll, 'first'), scrollMomentFor(scroll, 'last')].find(isExactPlace);
            report.warn(PxDiagnosticKind.platform, PxDiagnosticCode.scrollPlaceNeedsOwnDriver, place);
        }
        return null;
    }
    const rangeStart = nativeRangeOffset(ends[0]);
    const rangeEnd = nativeRangeOffset(ends[1]);
    if (!rangeStart || !rangeEnd) return null;

    const ofElement = followsAnElement(scroll);
    const Ctor: unknown = Reflect.get(globalThis, ofElement ? 'ViewTimeline' : 'ScrollTimeline');
    if (!isTimelineCtor(Ctor)) return null;

    const axis = nativeAxis(scroll.axis);
    let timeline: AnimationTimeline;
    try {
        timeline = ofElement
            ? new Ctor({ subject: resolveFollowedElement(root, scroll, report, handed), axis })
            : new Ctor({ source: resolveScrollSource(root, scroll, report), axis });
    } catch (e) {
        report.warn(PxDiagnosticKind.platform, PxDiagnosticCode.scrollNativeUnavailable, e);
        return null;
    }
    return { timeline, rangeStart, rangeEnd };
}


// ── The player's own measuring ───────────────────────────────────────────────────────────────────────────────────

export interface PxScrollDriver {
    /** Detach every listener/observer. Idempotent. */
    destroy(): void;
    /** Re-measure and emit now (also called once on attach). */
    refresh(): void;
}

/** "Near the screen" for the per-frame measuring (D8): within one screen of it, on every side. */
const NEAR_SCREEN_MARGIN = '100%';

/** An exponential ease only approaches its target: the last sliver (0.1 % of progress — 1 ms of a 1 s animation) is
 *  snapped, so the frame loop ends instead of idling. */
const SETTLE_EPSILON = 0.001;

/** Progress of an element's place on its screen. `pageScrolls`: the screen is the viewport (`documentElement.client*`
 *  excludes the scrollbars, `window.inner*` does not). */
function elementProgress(followed: Element, screen: Element, pageScrolls: boolean, axis: 'x' | 'y', scroll: PxScrollSettings): number {
    const rect = followed.getBoundingClientRect();
    let screenStart: number, screenSize: number;
    if (pageScrolls) {
        screenStart = 0;
        screenSize = axis === 'y' ? document.documentElement.clientHeight : document.documentElement.clientWidth;
    } else {
        const screenRect = screen.getBoundingClientRect();
        screenStart = axis === 'y' ? screenRect.top : screenRect.left;
        screenSize = axis === 'y' ? screen.clientHeight : screen.clientWidth;
    }
    const start = (axis === 'y' ? rect.top : rect.left) - screenStart;
    return scrollViewProgress(start, axis === 'y' ? rect.height : rect.width, screenSize, scroll);
}

/** Progress of how far a scroller is scrolled. */
function scrolledProgress(scroller: Element, axis: 'x' | 'y', scroll: PxScrollSettings): number {
    const offset = axis === 'y' ? scroller.scrollTop : scroller.scrollLeft;
    const maxOffset = axis === 'y' ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
    return scrollOffsetProgress(offset, maxOffset, scroll);
}

// @px-importance important
/**
 * Attach the player's own measuring for the animation whose root is `root`. Emits `onProgress(0..1)` on attach and
 * whenever the place changes; `null` when the document is not scroll-driven. `handed`: an element page code handed over
 * in `timelineOptions.follows`.
 * - events: `scroll` / `resize` / `ResizeObserver`, coalesced into ONE frame — one measurement, one emit
 * - D8: an element is also measured every frame while near the screen, so a layout move with no scroll is followed
 * - `smoothing` (GSAP's `scrub: <seconds>`): the emitted value chases the measurement, frame-rate independent
 */
export function createScrollDriver(
    root: Element,
    config: PxAnimatorRuntimeConfig | undefined,
    onProgress: (progress: number) => void,
    diag?: PxDiagnostics,
    handed?: Element,
): PxScrollDriver | null {
    if (!config || !isScrollTimeline(config)) return null;

    const report = diag ?? createDiagnostics(undefined, '[PxAnimator]');
    const scroll = settingsFollowing(config.scroll, handed);

    // WHAT is followed, and its screen — resolved once, at attach. The axis resolves against the scroller's writing mode.
    const followed = followsAnElement(scroll) ? resolveFollowedElement(root, scroll, report, handed) : null;
    const scroller = followed ? screenAround(followed) : resolveScrollSource(root, scroll, report);
    const pageScrolls = scroller === documentScroller();
    const axis = scrollResolveAxis(scroll.axis, getComputedStyle(scroller).writingMode);
    const measure = followed
        ? (): number => elementProgress(followed, scroller, pageScrolls, axis, scroll)
        : (): number => scrolledProgress(scroller, axis, scroll);

    const smoothingSec = Math.max(0, scroll.smoothing ?? 0) / 1000;   // schema is in ms
    let destroyed = false;
    let shown: number | null = null;     // the last progress emitted
    let frameId: number | null = null;
    let lastFrameMs = 0;                 // 0 while no frame loop runs: the next eased step assumes one 60 fps frame
    // D8 — the per-frame measuring: an element only, ON until the observer says it is far
    let near = !!followed;

    const show = (progress: number): void => { shown = progress; onProgress(progress); };
    const eased = (from: number, target: number, nowMs: number): number => {
        const dtSec = lastFrameMs ? Math.min(0.1, (nowMs - lastFrameMs) / 1000) : 1 / 60;
        const next = from + (target - from) * (1 - Math.exp(-dtSec / smoothingSec));
        return Math.abs(target - next) < SETTLE_EPSILON ? target : next;   // land exactly
    };
    const frame = (nowMs: number): void => {
        frameId = null;
        if (destroyed) return;
        const target = measure();
        const next = smoothingSec && shown !== null ? eased(shown, target, nowMs) : target;
        if (next !== shown) show(next);
        const goOn = near || next !== target;
        lastFrameMs = goOn ? nowMs : 0;
        if (goOn) schedule();
    };
    // any number of events in a frame → one measurement
    const schedule = (): void => {
        if (!destroyed && frameId === null) frameId = requestAnimationFrame(frame);
    };

    // Page scrolling fires on window; a box's scrolling on the box.
    const scrollTarget: EventTarget = pageScrolls ? window : scroller;
    scrollTarget.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(schedule);
        resizeObserver.observe(followed ?? root);
        if (followed && followed !== root) resizeObserver.observe(root);
        if (!pageScrolls) resizeObserver.observe(scroller);
    }

    // D8: measure every frame only while the followed element is within a screen of its screen; far away, scrolling
    // and resizing still reach it. Without an observer the per-frame measuring stays on.
    let nearObserver: IntersectionObserver | undefined;
    if (followed && typeof IntersectionObserver !== 'undefined') {
        nearObserver = new IntersectionObserver(entries => {
            const latest = entries[entries.length - 1];
            if (latest) near = latest.isIntersecting;
            schedule();   // one measurement now; the loop goes on only while near
        }, { root: pageScrolls ? null : scroller, rootMargin: NEAR_SCREEN_MARGIN });
        nearObserver.observe(followed);
    }

    const driver: PxScrollDriver = {
        destroy: () => {
            if (destroyed) return;
            destroyed = true;
            scrollTarget.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            resizeObserver?.disconnect();
            nearObserver?.disconnect();
            if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
        },
        // `refresh` is a deliberate JUMP (attach, host relayout) — never eased.
        refresh: () => { if (!destroyed) show(measure()); },
    };

    // Initial pose: the CURRENT place at once (a page loaded mid-scroll must not flash frame 0); then the frame loop.
    driver.refresh();
    if (near) schedule();

    return driver;
}


// ── Held on screen ───────────────────────────────────────────────────────────────────────────────────────────────

/** Height of the scrollport the canvas is held inside — the nearest y-scroller's, else the
 *  document's. `clientHeight` (not `innerHeight`) so scrollbars are excluded, matching the
 *  progress math above. Holding is a `top` offset, so it is always the VERTICAL size. */
function holdScrollportHeight(root: Element): number {
    const scroller = findNearestScroller(root, 'y');
    return scroller ? scroller.clientHeight : document.documentElement.clientHeight;
}

/**
 * `holdOnScreen` — the canvas stays on screen while the page scrolls on (GSAP's `pin: true`), as `position: sticky`:
 * sticky keeps the element's space in normal flow, so no spacer has to be injected into the host's layout.
 * - `at` / `offset`: where it is held — a `top` offset; `center` / `bottom` are measured and re-applied on resize
 * - `forScreens`: wraps the canvas in a block that tall, so the PLAYER makes the scroll travel and the page needs no CSS
 *
 * Returns a cleanup that restores the DOM exactly. No-op (and no cleanup cost) when not held.
 */
export function applyHoldOnScreen(root: Element, scroll: PxScrollSettings | undefined): () => void {
    if (!scroll?.holdOnScreen || !(root instanceof HTMLElement || root instanceof SVGElement)) return () => { /* nothing held */ };

    const style = root.style;
    const prevPosition = style.position;
    const prevTop = style.top;
    style.position = 'sticky';

    // `center` / `bottom` depend on the canvas's own height AND the scrollport height, neither of which CSS can express
    // for a sticky offset (a `top` percentage resolves against the CONTAINING BLOCK, not the element).
    const alignFactor = scroll.holdAt === PxHoldAt.center ? 0.5 : scroll.holdAt === PxHoldAt.bottom ? 1 : 0;
    const applyTop = (): void => {
        const extra = scroll.holdOffset ?? 0;
        if (!alignFactor) {
            style.top = extra + 'px';
            return;
        }
        const portSize = holdScrollportHeight(root);
        const ownSize = root.getBoundingClientRect().height;
        style.top = Math.round((portSize - ownSize) * alignFactor + extra) + 'px';
    };
    applyTop();

    // Keep a measured offset correct as the viewport or the canvas resizes.
    let resizeObserver: ResizeObserver | null = null;
    const onWindowResize = alignFactor ? applyTop : null;
    if (alignFactor) {
        if (onWindowResize) window.addEventListener('resize', onWindowResize);
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(applyTop);
            resizeObserver.observe(root);
        }
    }

    // `forScreens` (in viewport heights) — the travel the hold lasts for.
    let wrapper: HTMLElement | null = null;
    const parent = root.parentElement;
    if (scroll.holdForScreens && scroll.holdForScreens > 0 && parent) {
        wrapper = document.createElement('div');
        wrapper.setAttribute('data-px-pin', '');
        wrapper.style.height = (scroll.holdForScreens * 100) + 'vh';
        parent.insertBefore(wrapper, root);
        wrapper.appendChild(root);
    }

    return () => {
        if (onWindowResize) window.removeEventListener('resize', onWindowResize);
        resizeObserver?.disconnect();
        style.position = prevPosition;
        style.top = prevTop;
        if (wrapper?.parentElement) {
            wrapper.parentElement.insertBefore(root, wrapper);
            wrapper.remove();
        }
    };
}
