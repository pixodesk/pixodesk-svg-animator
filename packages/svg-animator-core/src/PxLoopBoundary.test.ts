import { describe, expect, it } from 'vitest';
import { LOOP_JUMP_SHIFT_MS, calcAnimationValues, materialiseInternalLoopsInPropAnim } from './PxDefinitions';
import type { PxPropertyAnimation } from './PxAnimatorTypes';

/**
 * B7 — a cycle loop's snap-back must not share a time with the previous repetition's
 * end, and the player's expansion must match the editor's.
 *
 * The editor (`TLoop.toKeyframes`) separates the pair by ONE 10ms frame and skips the
 * duplicate entirely when the two values are equal (a pingpong turn). Its SVG+CSS
 * export of the `anim.loop` fixture is the reference this file pins:
 *
 *   @keyframes _px_8 { 0% …20px…   50% …160px…   51% …20px…   100% …160px… }   ← cycle
 *   @keyframes _px_4 { 0% …20px…   50% …160px…                100% …20px…  }   ← alternate
 *
 * Before the fix the player emitted BOTH keyframes at t=500. Nothing sampled exactly
 * on a boundary, so no test caught it; the value there fell out of the sampler's
 * first-match-wins tie-break and disagreed with every other output form.
 */
describe('cycle-loop boundary (B7)', () => {

    const KF = (time: number, x: number) => ({ time, value: { translate: [x, 30] } });
    const SEGMENT = [KF(0, 20), KF(500, 160)];

    const expand = (loop: unknown): PxPropertyAnimation =>
        materialiseInternalLoopsInPropAnim('transform', { loop, keyframes: SEGMENT } as never, 1000);

    /** Materialised keyframes keep the short spelling (`t`/`v`); accept either. */
    interface LooseKf { t?: number; time?: number; v?: { translate?: Array<number> }; value?: { translate?: Array<number> } }
    const kfsOf = (a: PxPropertyAnimation): Array<LooseKf> => (a.keyframes ?? []) as Array<LooseKf>;
    const times = (a: PxPropertyAnimation) => kfsOf(a).map(k => k.t ?? k.time);
    const xs = (a: PxPropertyAnimation) => kfsOf(a).map(k => (k.v ?? k.value)?.translate?.[0]);

    it('a cycle separates the snap-back by LOOP_JUMP_SHIFT_MS — matching the editor', () => {
        const out = expand(true);
        // Derived, not hard-coded: the gap is a tuning value (10ms read as a visible jump,
        // so it is now 1ms) and this test asserts the SHAPE, not the number.
        expect(times(out)).toEqual([0, 500, 500 + LOOP_JUMP_SHIFT_MS, 1000]);
        expect(xs(out)).toEqual([20, 160, 20, 160]);
    });

    it('a pingpong turn emits NO duplicate — the values are equal, so it says nothing', () => {
        const out = expand({ alternate: true });
        expect(times(out)).toEqual([0, 500, 1000]);
        expect(xs(out)).toEqual([20, 160, 20]);
    });

    it('sampling exactly ON the boundary is unambiguous', () => {
        const out = expand(true);
        const at = (t: number) => {
            const v = calcAnimationValues({ transform: out } as never, t) as { transform?: string };
            return Number((/translate\(([-\d.]+)/.exec(v.transform ?? '') ?? [])[1]);
        };
        // No two keyframes share a time, so no tie-break decides these.
        expect(at(500)).toBeCloseTo(160, 5);                        // end of cycle 1
        expect(at(500 + LOOP_JUMP_SHIFT_MS)).toBeCloseTo(20, 5);    // start of cycle 2
        expect(at(499)).toBeGreaterThan(159);                       // still finishing cycle 1
        expect(at(500 + LOOP_JUMP_SHIFT_MS / 2)).toBeGreaterThan(20); // mid-snap, between the two
    });

    it('the repeat is compressed by the shift, not delayed past the duration', () => {
        const out = expand(true);
        // Cycle 2 occupies (500 + shift)→1000; it must still END on the document duration.
        expect(times(out)[times(out).length - 1]).toBe(1000);
        expect(xs(out)[xs(out).length - 1]).toBe(160);
    });

});
