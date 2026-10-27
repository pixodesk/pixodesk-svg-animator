// @px-area control
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxOutOfViewAction } from '@pixodesk/svg-animator-core';
import type { PxResolvedGate } from '@pixodesk/svg-animator-core/engine';

/**
 * THE VISIBILITY GATE — permission to run, separate from whatever starts the animation.
 *
 * The trigger's event lists say what STARTS an animation; the timeline's `outOfViewAction` /
 * `inViewThreshold` / `inViewDebounce` say whether it may RUN (D5). The two are independent, so
 * "start on click, but pause while scrolled away" is sayable, and the common document says
 * neither and gets both defaults: start on load, pause off screen.
 *
 * Three rules decide everything here:
 *  - OPEN at `inViewThreshold`, CLOSE only at zero visibility. One value, two edges, so a
 *    graphic resting on the boundary cannot flap between playing and paused.
 *  - A pending open waits `inViewDebounce` ms and is cancelled if visibility falls back below
 *    the threshold, so scrolling straight past a graphic starts nothing.
 *  - A hidden TAB is off screen. `IntersectionObserver` never fires for a hidden tab, so
 *    `visibilitychange` feeds the same state.
 *
 * FAILS OPEN. No `IntersectionObserver` (jsdom, SSR, an old engine) means the animation plays as
 * if fully visible. A page that cannot measure is better off animating than frozen, and failing
 * closed would silently stop every animation in environments that never had the API.
 */

/** What the gate drives. A trigger let through goes to the executor's state-rule play; the gate's
 *  own hold and release are the ENGINE's pause and play — a gate hold is not a user pause, so the
 *  executor's paused state stays untouched and a later `playOn` event still applies. @internal */
export interface PxGateHost {
    isPlaying(): boolean;
    /** A trigger fired and the gate lets it through. */
    start(): void;
    /** Off screen: freeze where it is (resumable by `release`). */
    hold(): void;
    /** Back on screen after a hold: continue from there. */
    release(): void;
    /** Off screen with `outOfViewAction: 'reset'`: back to the start pose; `release` replays. */
    reset(): void;
}

/** Permission to run, wired by `setupAnimationTriggers` for every document. @internal */
export interface PxVisibilityGate {
    /** A trigger fired. `immediate` skips the gate for a direct interaction (a click or a hover
     *  happens on something the reader can already see, and must never wait out a timer). */
    requestStart(immediate: boolean): void;
    /** Detaches the observer, the listener and any pending timer. */
    dispose(): void;
}

/** Granular steps, so the callback fires often enough to notice the threshold being crossed.
 *  Registering only the raw threshold would mean no callback at all for some geometries. */
const THRESHOLD_STEPS: Array<number> = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * Visible share of the graphic, normalized for a target TALLER than the viewport.
 *
 * `intersectionRatio` is measured against the TARGET's own size, so a target twice the height of
 * the viewport can never exceed 0.5 and a 0.5 threshold would be unsatisfiable — the animation
 * would never play at all. Dividing by what could possibly be visible removes that cap.
 */
function effectiveRatio(entry: IntersectionObserverEntry): number {
    const target = entry.boundingClientRect;
    const visible = entry.intersectionRect;
    // Simplified entries (tests, older engines) may omit the rects — fall back to the browser's
    // own ratio rather than inventing one.
    if (!target?.height || !visible) return entry.intersectionRatio;
    // Use the SMALLER of `rootBounds` and the live viewport. `rootBounds` can be null (implicit
    // root in some embeddings) and can also report a box LARGER than the actual viewport, which
    // would reinstate the very cap this normalization exists to remove. `intersectionRect` is
    // already clipped to the real viewport, so the denominator must be too.
    const live = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : Infinity;
    const declared = entry.rootBounds?.height ?? Infinity;
    const viewport = Math.min(live, declared);
    const denom = Math.min(target.height, Number.isFinite(viewport) ? viewport : target.height);
    return denom > 0 ? visible.height / denom : entry.intersectionRatio;
}

/** A gate that is always open and observes nothing — `outOfViewAction: 'continue'`, or no way to measure. */
function openGate(host: PxGateHost): PxVisibilityGate {
    return {
        requestStart: () => host.start(),
        dispose: () => { /* nothing attached */ },
    };
}

/** Whether visibility governs this document at all. `continue` means "run wherever it is",
 *  which also means it must not WAIT to be seen before starting (review: plan §4 example G). */
function isGated(outOfViewAction: PxOutOfViewAction): boolean {
    return outOfViewAction !== PxOutOfViewAction.continue;
}

// @px-importance important
/** Builds the gate for one document. Returns an always-open one when visibility does not govern
 *  it, or when nothing can measure. @internal */
export function createVisibilityGate(root: Element, gate: PxResolvedGate, host: PxGateHost): PxVisibilityGate {
    if (!isGated(gate.outOfViewAction)) return openGate(host);
    if (typeof IntersectionObserver === 'undefined') return openGate(host);

    const threshold = gate.inViewThreshold;
    const debounceMs = gate.inViewDebounce;

    /** Enough of it is on screen AND the dwell has elapsed. `undefined` until the first
     *  measurement arrives, so that measurement always counts as a transition — an animation the
     *  HOST already started through the API must be paused by the first report of "off screen",
     *  not silently left running because the gate had never been open. */
    let isOpen: boolean | undefined = undefined;
    /** A trigger fired while the gate was shut; it is owed a play once the gate opens. */
    let startPending = false;
    /** The gate paused (or reset) a running animation, so it owes it a play. */
    let pausedByGate = false;
    /** The most recent measurement, kept so `visibilitychange` can re-decide without one. */
    let lastRatio = 0;
    let openTimer: ReturnType<typeof setTimeout> | undefined;

    const cancelPendingOpen = (): void => {
        if (openTimer !== undefined) {
            clearTimeout(openTimer);
            openTimer = undefined;
        }
    };

    const open = (): void => {
        openTimer = undefined;
        if (isOpen === true) return;
        isOpen = true;
        // Whichever of the two owes a play, exactly one happens: a trigger's start, or the gate's release.
        if (startPending) {
            startPending = false;
            pausedByGate = false;
            host.start();
        } else if (pausedByGate) {
            pausedByGate = false;
            host.release();
        }
    };

    const close = (): void => {
        cancelPendingOpen();
        if (isOpen === false) return;
        isOpen = false;
        // Only act on something that is actually running — including an animation the HOST
        // started through the API, which is why this asks rather than tracking its own flag.
        if (!host.isPlaying()) return;
        if (gate.outOfViewAction === PxOutOfViewAction.reset) {
            host.reset();    // progress back to 0; the next open replays from the start
        } else {
            host.hold();
        }
        pausedByGate = true;
    };

    /** One measurement in, one decision out. The threshold governs OPENING (including its dwell);
     *  only zero visibility CLOSES. Between the two nothing changes. A threshold of 0 means ANY
     *  visible pixel — not "no pixels": the gate never opens on a ratio of 0. */
    const apply = (ratio: number): void => {
        lastRatio = ratio;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            close();
            return;
        }
        if (ratio > 0 && ratio >= threshold) {
            if (isOpen === true || openTimer !== undefined) return;
            if (debounceMs > 0) openTimer = setTimeout(open, debounceMs);
            else open();
            return;
        }
        if (ratio <= 0) {
            close();
            return;
        }
        // The middle band: still visible, but no longer visible ENOUGH. An open gate stays open
        // (hysteresis); a pending open is abandoned, since the dwell is about staying visible.
        if (isOpen !== true) cancelPendingOpen();
    };

    const observer = new IntersectionObserver(entries => {
        const last = entries[entries.length - 1];
        if (last) apply(last.isIntersecting ? effectiveRatio(last) : 0);
    }, { threshold: THRESHOLD_STEPS });
    observer.observe(root);

    const onVisibilityChange = (): void => { apply(lastRatio); };
    const hasDocument = typeof document !== 'undefined';
    if (hasDocument) document.addEventListener('visibilitychange', onVisibilityChange);

    return {
        requestStart: (immediate: boolean) => {
            // A click or a hover is aimed at something the reader can see; it never waits.
            if (immediate || isOpen === true) {
                cancelPendingOpen();
                isOpen = true;
                startPending = false;
                pausedByGate = false;
                host.start();
                return;
            }
            startPending = true;
        },
        dispose: () => {
            cancelPendingOpen();
            observer.disconnect();
            if (hasDocument) document.removeEventListener('visibilitychange', onVisibilityChange);
        },
    };
}
