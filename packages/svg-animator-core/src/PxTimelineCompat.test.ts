/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The two spellings of "what advances progress" (review §2.1) and the conversions
// between them: `animator.timeline` (written) ⇄ flat legacy trio (consumed).

import { describe, expect, it } from 'vitest';
import { flattenAnimatorTimeline, getAnimatorConfig, nestAnimatorTimeline } from './PxAnimatorConstants';
import { PxAnimatorConfigSchema } from './PxAnimatorTypes';
import type { PxValidationContext } from './PxSchema';

describe('animator.timeline spelling compat', () => {

    // ── flatten: nested → the flat view every engine consumes ────────────────

    it('flattens a clock timeline to the legacy flat keys (trigger.onFinish → resetOnFinish)', () => {
        const flat = flattenAnimatorTimeline({
            timeline: {
                type: 'clock', duration: 4000,
                trigger: { startOn: 'click', outAction: 'pause', onFinish: 'reset' },
                delay: 250, iterations: 'infinite', direction: 'alternate', fill: 'both'
            }
        } as any) as any;
        expect(flat.timeline).toBeUndefined();
        expect(flat).toMatchObject({
            duration: 4000, delay: 250, iterations: 'infinite', direction: 'alternate',
            fill: 'both', resetOnFinish: true,
            trigger: { startOn: 'click', outAction: 'pause' }
        });
        expect(flat.trigger.onFinish).toBeUndefined(); // folded into resetOnFinish
    });

    it("flattens 'view' and 'scroll' timelines to timelineSource:'scroll' + scroll.kind, pin object → pin flags, engine → driver", () => {
        const flat = flattenAnimatorTimeline({
            timeline: {
                type: 'view', duration: 4000, engine: 'custom', axis: 'block', subject: 'parent',
                smoothing: 120, pin: { align: 'center', top: 24, distance: 600 },
                range: { start: { phase: 'entry', fraction: 0.1 } }
            }
        } as any) as any;
        expect(flat.timelineSource).toBe('scroll');
        expect(flat.scroll).toEqual({
            kind: 'view', driver: 'custom', axis: 'block', subject: 'parent', smoothing: 120,
            pin: true, pinAlign: 'center', pinTop: 24, pinDistance: 600,
            range: { start: { phase: 'entry', fraction: 0.1 } }
        });
        expect(flattenAnimatorTimeline({ timeline: { type: 'scroll', pin: true } } as any))
            .toMatchObject({ timelineSource: 'scroll', scroll: { kind: 'scroll', pin: true } });
    });

    it('finite iterations survive scroll mode in both directions (D4); infinite does not nest', () => {
        expect(nestAnimatorTimeline({ duration: 1, timelineSource: 'scroll', iterations: 3 } as any))
            .toEqual({ timeline: { type: 'scroll', duration: 1, iterations: 3 } });
        expect(nestAnimatorTimeline({ duration: 1, timelineSource: 'scroll', iterations: 'infinite' } as any))
            .toEqual({ timeline: { type: 'scroll', duration: 1 } });
        expect(flattenAnimatorTimeline({ timeline: { type: 'view', iterations: 2 } } as any))
            .toMatchObject({ timelineSource: 'scroll', iterations: 2 });
    });

    it('is identity for a flat runtime-view config and memoised for a nested one', () => {
        const flat = { duration: 1000, trigger: { startOn: 'load' } } as any;
        expect(flattenAnimatorTimeline(flat)).toBe(flat);            // nothing to fold → same object
        const nested = { timeline: { type: 'clock', delay: 5 } } as any;
        expect(flattenAnimatorTimeline(nested)).toBe(flattenAnimatorTimeline(nested)); // memoised
    });

    it('getAnimatorConfig serves the flat view (engines never see `timeline`)', () => {
        const cfg = getAnimatorConfig({
            type: 'svg',
            animator: { timeline: { type: 'clock', duration: 500, delay: 42 } }
        } as any) as any;
        expect(cfg.timeline).toBeUndefined();
        expect(cfg.duration).toBe(500);   // §2.8: wire timeline.duration → runtime-view duration
        expect(cfg.delay).toBe(42);
    });

    // ── nest: flat → the written spelling; mode-dead keys structurally gone ──

    it('nests flat clock keys under timeline{type:clock} and resetOnFinish under trigger.onFinish', () => {
        const nested = nestAnimatorTimeline({
            duration: 4000, mode: 'auto',
            trigger: { startOn: 'click' }, delay: 250, iterations: 3,
            direction: 'reverse', fill: 'none', resetOnFinish: true
        } as any) as any;
        expect(nested).toEqual({
            mode: 'auto',
            timeline: {
                type: 'clock', duration: 4000,
                trigger: { startOn: 'click', onFinish: 'reset' },
                delay: 250, iterations: 3, direction: 'reverse', fill: 'none'
            }
        });
    });

    it("nests flat scroll config under timeline{type:'view'|'scroll'}; the dead clock keys (trigger, …) do not survive", () => {
        const nested = nestAnimatorTimeline({
            duration: 4000, timelineSource: 'scroll',
            trigger: { startOn: 'load' },       // dead under scroll (D3) — dropped by nesting
            scroll: { kind: 'view', driver: 'custom', axis: 'block', smoothing: 120,
                      pin: true, pinAlign: 'center', pinTop: 24 }
        } as any) as any;
        expect(nested).toEqual({
            timeline: {
                type: 'view', duration: 4000, engine: 'custom', axis: 'block', smoothing: 120,
                pin: { align: 'center', top: 24 }
            }
        });
    });

    it('omits an empty clock timeline entirely, and passes a config that already has one through unchanged', () => {
        // §2.8: a set duration now forces the timeline block (it lives there on the wire)…
        expect(nestAnimatorTimeline({ duration: 1000, mode: 'auto' } as any))
            .toEqual({ mode: 'auto', timeline: { type: 'clock', duration: 1000 } });
        // …a config with truly nothing timeline-ish still gets no block at all.
        expect(nestAnimatorTimeline({ mode: 'auto' } as any)).toEqual({ mode: 'auto' });
        const already = { duration: 1, timeline: { type: 'clock', delay: 2 } } as any;
        expect(nestAnimatorTimeline(already)).toBe(already);
    });

    it('round-trips: flatten(nest(flat)) reproduces the flat form', () => {
        const flat = {
            duration: 4000, frameRate: 60, mode: 'auto',
            trigger: { startOn: 'click', outAction: 'pause' }, delay: 250,
            iterations: 'infinite', direction: 'alternate', fill: 'both', resetOnFinish: true
        } as any;
        expect(flattenAnimatorTimeline(nestAnimatorTimeline(flat))).toEqual(flat);
    });

    // ── schema: the written spelling validates strictly; dead keys have no slot ──

    it('the nested spelling validates strictly; a clock knob inside a scroll timeline is a schema error', () => {
        const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timeline: { type: 'view', duration: 4000, axis: 'block', pin: { align: 'top' } }
        }, ctx)).toBe(true);
        expect(ctx.errors).toEqual([]);

        const bad: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timeline: { type: 'view', trigger: { startOn: 'click' } }   // dead key — no slot
        }, bad)).toBe(false);
        expect(bad.errors.length).toBeGreaterThan(0);
    });

    it('the flat spelling is NOT wire format — flat playback keys are schema errors', () => {
        const clockCtx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            duration: 1000, trigger: { startOn: 'load' }, iterations: 3, direction: 'normal'
        }, clockCtx)).toBe(false);   // §2.8: flat duration is not wire either
        expect(clockCtx.errors.length).toBeGreaterThan(0);

        const scrollCtx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timelineSource: 'scroll', scroll: { kind: 'view' }
        }, scrollCtx)).toBe(false);
        expect(scrollCtx.errors.length).toBeGreaterThan(0);
    });
});
