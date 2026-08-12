/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Scroll-timeline PROGRESS MATH — pure functions, no DOM. This is the reference
// implementation for `animator.timelineSource: 'scroll'` (the `driver: 'custom'` path,
// both engines): the DOM driver in svg-animator-web measures rects/offsets and calls in
// here; the editor's design doc (`app/src/svgeditor/animation/scroll-timeline.design.md`
// §4) documents the same formulas — keep them in sync.

import { clamp, DEFAULT_DURATION_MS } from './PxAnimatorUtil';
import type { PxAnimatorConfig, PxScroll, PxScrollPhase, PxScrollRangePoint } from './PxAnimatorTypes';


/** Is this document scroll-driven? (`animator.timelineSource === 'scroll'`) */
export function isScrollTimeline(config: PxAnimatorConfig | undefined): boolean {
    return config?.timelineSource === 'scroll';
}

/**
 * The seek-space length (ms) a scroll progress of 1 maps to: duration × finite
 * iterations. `'infinite'` is meaningless on a finite progress timeline (see design doc
 * D4) — treated as 1 with the read-side warning left to the consumer.
 */
export function scrollTotalDurationMs(config: PxAnimatorConfig | undefined): number {
    const duration = (typeof config?.duration === 'number' && config.duration > 0)
        ? config.duration : DEFAULT_DURATION_MS;
    const iterations = (typeof config?.iterations === 'number' && config.iterations > 0)
        ? config.iterations : 1;
    return duration * iterations;
}

/**
 * A named phase's interval in `u`-space.
 *
 * `u` is the subject's "journey distance": with `sTop` = subject's leading edge in
 * scrollport coordinates, `u = vpSize − sTop` — 0 exactly when the subject is about to
 * enter (leading edge at the scrollport's trailing edge), growing as the user scrolls.
 * The `min`/`max` pairs make every formula valid BOTH for a subject smaller than the
 * scrollport and one larger than it (where "fully visible" flips to "covers the
 * scrollport") — the same case split CSS specifies for its named timeline ranges.
 */
export function scrollPhaseInterval(
    phase: PxScrollPhase, subjectSize: number, scrollportSize: number
): [number, number] {
    const s = subjectSize, vp = scrollportSize;
    switch (phase) {
        case 'cover': return [0, s + vp];
        case 'entry': return [0, Math.min(s, vp)];
        case 'contain': return [Math.min(s, vp), Math.max(s, vp)];
        case 'exit': return [Math.max(s, vp), s + vp];
        case 'entry-crossing': return [0, s];
        case 'exit-crossing': return [vp, s + vp];
    }
}

const DEFAULT_PHASE: PxScrollPhase = 'cover';

/** One range endpoint resolved to a `u`-space value. */
function resolveRangePointU(
    point: PxScrollRangePoint | undefined, defaultFraction: number,
    subjectSize: number, scrollportSize: number
): number {
    const [u0, u1] = scrollPhaseInterval(point?.phase ?? DEFAULT_PHASE, subjectSize, scrollportSize);
    const fraction = typeof point?.fraction === 'number' ? point.fraction : defaultFraction;
    return u0 + fraction * (u1 - u0);
}

/**
 * `kind: 'view'` progress ∈ [0, 1]: where the subject's journey sits within the
 * configured range.
 *
 * @param subjectStart   subject's leading edge in scrollport coordinates
 *                       (`subjectRect.top − scrollportRect.top` on the resolved axis)
 * @param subjectSize    subject size on the axis
 * @param scrollportSize scrollport size on the axis
 *
 * A degenerate/inverted range (uStart ≥ uEnd — e.g. zero-size subject with an `entry`
 * range) reports 1 once the point is passed, 0 before — never NaN.
 */
export function scrollViewProgress(
    subjectStart: number, subjectSize: number, scrollportSize: number,
    range: PxScroll['range'] | undefined
): number {
    const u = scrollportSize - subjectStart;
    const uStart = resolveRangePointU(range?.start, 0, subjectSize, scrollportSize);
    const uEnd = resolveRangePointU(range?.end, 1, subjectSize, scrollportSize);
    if (uEnd <= uStart) return u >= uEnd ? 1 : 0;
    return clamp((u - uStart) / (uEnd - uStart), 0, 1);
}

/**
 * `kind: 'scroll'` progress ∈ [0, 1]: the scroller's offset ratio mapped through the
 * range (phases don't exist here — `fraction` is of the total scroll range).
 *
 * `maxOffset === 0` (nothing to scroll) reports 1, matching the CSS spec's rule that a
 * zero-length timeline is at 100%.
 */
export function scrollOffsetProgress(
    offset: number, maxOffset: number,
    range: PxScroll['range'] | undefined
): number {
    const raw = maxOffset > 0 ? clamp(offset / maxOffset, 0, 1) : 1;
    const start = typeof range?.start?.fraction === 'number' ? range.start.fraction : 0;
    const end = typeof range?.end?.fraction === 'number' ? range.end.fraction : 1;
    if (end <= start) return raw >= end ? 1 : 0;
    return clamp((raw - start) / (end - start), 0, 1);
}

/**
 * Resolve a logical axis to a physical one. `block`/`inline` are writing-mode relative:
 * in horizontal writing (`horizontal-tb`, the default) block flows vertically; in
 * vertical writing modes it flows horizontally.
 */
export function scrollResolveAxis(
    axis: PxScroll['axis'] | undefined, writingMode: string | undefined
): 'x' | 'y' {
    const a = axis ?? 'block';
    if (a === 'x' || a === 'y') return a;
    const vertical = !!writingMode && writingMode.startsWith('vertical');
    if (a === 'inline') return vertical ? 'y' : 'x';
    return vertical ? 'x' : 'y';   // block
}
