// @px-area engine
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Scroll-timeline PROGRESS MATH — pure functions, no DOM. The reference implementation for `timeline: { type: 'scroll' }`
// when the player measures by itself (`engine: 'js'`, `smoothing`, and the fallback of `auto`): the DOM driver in
// svg-animator-web measures rects and offsets and calls in here. The seven moment words are the same points as the
// browser's own range names (`cssRangeOfMoment`), so both engines agree.

import { clamp, PX_DEFAULT_DURATION_MS } from '../util/PxAnimatorUtil';
import type { PxAnimatorRuntimeConfig } from '../format/PxAnimatorTypes';
import { clampShare, followsElement, PxScrollAxis, PxScrollMoment, scrollLineShare, type PxScrollMomentSettings, type PxScrollSettings } from '../format/PxAnimatorConstants';


/** Is this document scroll-driven? (`animator.timelineSource === 'scroll'`) @internal */
export function isScrollTimeline(config: PxAnimatorRuntimeConfig | undefined): boolean {
    return config?.timelineSource === 'scroll';
}

/**
 * The seek-space length (ms) a scroll progress of 1 maps to: duration × finite
 * iterations. `'infinite'` is meaningless on a finite progress timeline (see design doc
 * D4) — treated as 1 with the read-side warning left to the consumer.
 * @internal
 */
export function scrollTotalDurationMs(config: PxAnimatorRuntimeConfig | undefined): number {
    const duration = (typeof config?.duration === 'number' && config.duration > 0)
        ? config.duration : PX_DEFAULT_DURATION_MS;
    const iterations = (typeof config?.iterations === 'number' && config.iterations > 0)
        ? config.iterations : 1;
    return duration * iterations;
}

/** The two default moments of a scroll timeline — what an absent `firstFrameWhen` / `lastFrameWhen` means:
 *  `appears` → `gone` for an element, the held stretch `fullyIn` → `startsToLeave` when held, the whole scroll
 *  otherwise. @internal */
export function scrollDefaultMoments(scroll: PxScrollSettings | undefined): [PxScrollMomentSettings, PxScrollMomentSettings] {
    if (scroll?.holdOnScreen) return [{ moment: PxScrollMoment.fullyIn }, { moment: PxScrollMoment.startsToLeave }];
    if (!followsElement(scroll?.follows)) return [{ scrolled: 0 }, { scrolled: 1 }];
    return [{ moment: PxScrollMoment.appears }, { moment: PxScrollMoment.gone }];
}

/** The moment a scroll timeline uses for one end: the file's, when it fits what is followed — a word or an exact
 *  place for an element, a share scrolled for a scroll — else the default. @internal */
export function scrollMomentFor(scroll: PxScrollSettings | undefined, end: 'first' | 'last'): PxScrollMomentSettings {
    const [first, last] = scrollDefaultMoments(scroll);
    const given = end === 'first' ? scroll?.firstFrameWhen : scroll?.lastFrameWhen;
    const fallback = end === 'first' ? first : last;
    if (!given) return fallback;
    const ofElement = scroll?.holdOnScreen || followsElement(scroll?.follows);
    const fits = ofElement ? given.scrolled === undefined : given.scrolled !== undefined;
    return fits ? given : fallback;
}

/**
 * Where a moment happens on an element's journey, in `u`-space: `u` = the distance scrolled since the element's start
 * edge reached the screen's end edge — 0 when it is about to appear, `size + screen` when it is gone. The seven words
 * adapt to the size (an element taller than the screen is `fullyIn` once it fills it); an exact place is literal: the
 * line `element` of the element at the line `screen` of the screen, `u = (1 − screen) × screenSize + element × size`.
 * @internal
 */
export function scrollMomentU(moment: PxScrollMomentSettings, subjectSize: number, scrollportSize: number): number {
    const s = subjectSize, vp = scrollportSize;
    switch (moment.moment) {
        case PxScrollMoment.appears: return 0;
        case PxScrollMoment.halfIn: return Math.min(s, vp) / 2;
        case PxScrollMoment.fullyIn: return Math.min(s, vp);
        case PxScrollMoment.centered: return (s + vp) / 2;
        case PxScrollMoment.startsToLeave: return Math.max(s, vp);
        case PxScrollMoment.halfOut: return Math.max(s, vp) + Math.min(s, vp) / 2;
        case PxScrollMoment.gone: return s + vp;
    }
    const element = clampShare(scrollLineShare(moment.element, 0));
    const screen = clampShare(scrollLineShare(moment.screen, 1));
    return (1 - screen) * vp + element * s;
}

/** Progress 0..1 between two points: taken in scroll order (two points that come out reversed are swapped — nothing
 *  ever jumps); a stretch of no length steps from 0 to 1 at its point. */
function progressBetween(at: number, a: number, b: number): number {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (hi <= lo) return at >= hi ? 1 : 0;
    return clamp((at - lo) / (hi - lo), 0, 1);
}

/**
 * Progress ∈ [0, 1] of a scroll timeline that follows an ELEMENT across the screen.
 *
 * @param subjectStart   the followed element's start edge in screen coordinates (`rect.top − screenRect.top`)
 * @param subjectSize    its size on the axis
 * @param scrollportSize the screen's size on the axis
 * @internal
 */
export function scrollViewProgress(
    subjectStart: number, subjectSize: number, scrollportSize: number, scroll: PxScrollSettings | undefined,
): number {
    const u = scrollportSize - subjectStart;
    const a = scrollMomentU(scrollMomentFor(scroll, 'first'), subjectSize, scrollportSize);
    const b = scrollMomentU(scrollMomentFor(scroll, 'last'), subjectSize, scrollportSize);
    return progressBetween(u, a, b);
}

/**
 * Progress ∈ [0, 1] of a scroll timeline that follows how far something is SCROLLED, between the two shares.
 * `maxOffset === 0` (nothing to scroll) reports 1, matching the CSS spec's rule that a zero-length timeline is at 100%.
 * @internal
 */
export function scrollOffsetProgress(offset: number, maxOffset: number, scroll: PxScrollSettings | undefined): number {
    const raw = maxOffset > 0 ? clamp(offset / maxOffset, 0, 1) : 1;
    const start = clampShare(scrollMomentFor(scroll, 'first').scrolled ?? 0);
    const end = clampShare(scrollMomentFor(scroll, 'last').scrolled ?? 1);
    return progressBetween(raw, start, end);
}

/**
 * The physical axis: `vertical` → `y`, `horizontal` → `x`; absent = the way the page scrolls — vertical in
 * horizontal writing (the default), horizontal in vertical writing modes.
 * @internal
 */
export function scrollResolveAxis(axis: PxScrollAxis | undefined, writingMode: string | undefined): 'x' | 'y' {
    if (axis === PxScrollAxis.vertical) return 'y';
    if (axis === PxScrollAxis.horizontal) return 'x';
    const verticalWriting = !!writingMode && writingMode.startsWith('vertical');
    return verticalWriting ? 'x' : 'y';
}
