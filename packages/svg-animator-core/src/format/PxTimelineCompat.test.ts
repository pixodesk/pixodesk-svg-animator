/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The two spellings of "what advances progress" (review §2.1) and the conversions
// between them: `animator.timeline` (written) ⇄ flat runtime view (consumed).
// On the wire the time-driven timeline carries NO `type` (absent = 'time'); the runtime view
// keeps the engines' `fill` / `resetOnFinish` / `direction`, DERIVED from the wire's
// `beforeStart` / `actions.finish` / `iterationDirection` (playback-layers.md).

import { describe, expect, it } from 'vitest';
import { resolveAnimatorTimeline, getAnimatorConfig, nestAnimatorTimeline } from './PxAnimatorConstants';
import { PxAnimatorConfigSchema, type PxDocument, type PxAnimatorConfig, type PxAnimatorRuntimeConfig } from './PxAnimatorTypes';
import type { PxValidationContext } from '../schema/PxSchema';
import { untyped } from '../effects/effectTestKit';
import { prepareDocument } from '../pipeline/PxPrepareDocument';
import { PxDocStage } from './PxDocStage';

describe('animator.timeline spelling compat', () => {

    it('§4: the window folds — inTime/outTime → flat duration (window length) + inTime; playDuration passes', () => {
        const cfg = getAnimatorConfig({
            type: 'svg',
            animator: { timeline: { inTime: 500, outTime: 2500, playDuration: 4000 } },
        });
        expect(cfg?.duration).toBe(2000);        // outTime − inTime: the engines' one length
        expect(cfg?.inTime).toBe(500);           // the sampling shift
        expect(cfg?.playDuration).toBe(4000);    // the wall remap, applied as a rate factor
        // …and the round trip writes the window back as its two points
        expect(nestAnimatorTimeline({ inTime: 500, duration: 2000, playDuration: 4000 }).timeline)
            .toEqual({ inTime: 500, outTime: 2500, playDuration: 4000 });
    });

    it('§4: an absent outTime means the max raw keyframe time; none at all means the old default', () => {
        const withKfs = getAnimatorConfig({
            type: 'svg',
            animator: {},
            children: [{ type: 'rect', animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3200, value: 1 }] } } }],
        });
        expect(withKfs?.duration).toBe(3200);
        const bare = getAnimatorConfig({ type: 'svg', animator: {} });
        expect(bare?.duration).toBe(1000);       // PX_DEFAULT_DURATION_MS
    });

    // ── flatten: nested → the flat view every engine consumes ────────────────

    it('flattens a time timeline to the flat runtime keys (actions.finish → resetOnFinish + fill, iterationDirection → direction)', () => {
        const actions = {
            start: { transition: 'restart' }, stop: { transition: 'rewind', completeIteration: true },
            finish: { transition: 'reset' }, suspend: { transition: 'continue' },
        } as const;
        const flat = resolveAnimatorTimeline({
            timeline: {
                type: 'time', outTime: 4000,
                triggers: { start: 'click', pause: 'click' }, beforeStart: 'firstFrame',
                delay: 250, iterations: 'infinite', iterationDirection: 'alternate',
                actions, inViewThreshold: 0.2, inViewDebounce: 80,
            }
        });
        expect(flat.timeline).toBeUndefined();
        expect(flat).toMatchObject({
            duration: 4000, delay: 250, iterations: 'infinite', direction: 'alternate',
            fill: 'backwards', resetOnFinish: true, beforeStart: 'firstFrame',
            actions, inViewThreshold: 0.2, inViewDebounce: 80,
            triggers: { start: 'click', pause: 'click' }
        });
        // an EMPTY triggers block is copied as it is — it means "nothing starts it", not "the defaults"
        expect(resolveAnimatorTimeline({ timeline: { triggers: {} } }).triggers).toEqual({});
    });

    it('the pre-1.3 `timeline.duration` and the pre-1.4 `trigger.finish` are NOT read — the wire steps convert stamped documents', () => {
        // both old spellings, unstamped — not in the type, on purpose
        const old = (version?: string) => untyped<PxDocument>({
            type: 'svg', animator: { ...(version ? { version } : {}), timeline: { duration: 500, trigger: { start: 'click', finish: 'reset' } } },
        });
        const unstamped = getAnimatorConfig(old());
        expect(unstamped?.duration).toBe(1000);             // no keyframes: the default window, not the old 500
        expect(unstamped?.resetOnFinish).toBeUndefined();
        // stamped 1.2: converted on the way in (1.2 → 1.3 → 1.4), so both survive
        const stamped = getAnimatorConfig(prepareDocument(old('1.2'), { stage: PxDocStage.current }));
        expect(stamped?.duration).toBe(500);
        expect(stamped?.resetOnFinish).toBe(true);
    });

    it("flattens 'view' and 'scroll' timelines to timelineSource:'scroll' + scroll.kind, pin object → pin flags; engine is shared", () => {
        const flat = resolveAnimatorTimeline({
            timeline: {
                type: 'view', outTime: 4000, engine: 'js', axis: 'block', subject: 'parent',
                smoothing: 120, pin: { align: 'center', offset: 24, distance: 600 },
                range: { start: { phase: 'entry', fraction: 0.1 } }
            }
        });
        expect(flat.timelineSource).toBe('scroll');
        expect(flat.engine).toBe('js');
        expect(flat.scroll).toEqual({
            kind: 'view', axis: 'block', subject: 'parent', smoothing: 120,
            pin: true, pinAlign: 'center', pinOffset: 24, pinDistance: 600,
            range: { start: { phase: 'entry', fraction: 0.1 } }
        });
        expect(resolveAnimatorTimeline({ timeline: { type: 'scroll', pin: true } }))
            .toMatchObject({ timelineSource: 'scroll', scroll: { kind: 'scroll', pin: true } });
    });

    it('finite iterations survive a scroll timeline in both directions (D4); infinite does not nest', () => {
        // No `scroll` block, so the kind sits at its default — `'view'` (see the kind-default
        // case below); `timelineSource: 'scroll'` names the FAMILY, not the member.
        expect(nestAnimatorTimeline({ duration: 1, timelineSource: 'scroll', iterations: 3 }))
            .toEqual({ timeline: { type: 'view', outTime: 1, iterations: 3 } });
        expect(nestAnimatorTimeline({ duration: 1, timelineSource: 'scroll', iterations: 'infinite' }))
            .toEqual({ timeline: { type: 'view', outTime: 1 } });
        expect(resolveAnimatorTimeline({ timeline: { type: 'view', iterations: 2 } }))
            .toMatchObject({ timelineSource: 'scroll', iterations: 2 });
    });

    it('is identity for a flat runtime-view config and pure for a nested one', () => {
        const flat: PxAnimatorRuntimeConfig = { duration: 1000, triggers: { start: 'load' } };
        expect(resolveAnimatorTimeline(flat)).toBe(flat);            // nothing to fold → same object
        const nested: PxAnimatorRuntimeConfig = { timeline: { delay: 5 } };   // no `type` = time-driven
        // no memo since the prepare-document pipeline: an equal answer every call, not the same object
        expect(resolveAnimatorTimeline(nested)).toEqual(resolveAnimatorTimeline(nested));
    });

    it('getAnimatorConfig serves the flat view (engines never see `timeline`)', () => {
        const cfg = getAnimatorConfig({
            type: 'svg',
            animator: { timeline: { outTime: 500, delay: 42 } }
        });
        expect(cfg?.timeline).toBeUndefined();
        expect(cfg?.duration).toBe(500);   // the window
        expect(cfg?.delay).toBe(42);
    });

    it('getAnimatorConfig DROPS flat playback keys found on a document — the wire states playback only inside `timeline`', () => {
        const cfg = getAnimatorConfig({
            type: 'svg',
            animator: untyped<PxAnimatorConfig>({ duration: 9999, triggers: { start: 'load' }, fill: 'both', resetOnFinish: true }),
        });

        // the stray value never wins: the window resolves to the DEFAULT, not the dropped 9999
        expect(cfg?.duration).toBe(1000);
        expect(cfg?.triggers).toBeUndefined();
        expect(cfg?.fill).toBeUndefined();
        expect(cfg?.resetOnFinish).toBeUndefined();
    });

    it('a stray flat key never shadows the timeline, and the lookup tables still come through', () => {
        const doc: PxDocument = {
            type: 'svg',
            // the stray flat `duration` is not in the type, on purpose
            animator: untyped<PxAnimatorConfig>({ duration: 9, timeline: { outTime: 500 }, definitions: { easings: {} } }),
        };
        const cfg = getAnimatorConfig(doc);

        expect(cfg?.duration).toBe(500);                  // the timeline wins — the stray key is gone
        expect(cfg?.definitions).toEqual({ easings: {} }); // content keys are untouched
        // a RAW doc derives fresh: equal every call (same-object identity holds for PREPARED docs — PxPrepareDocument.test)
        expect(getAnimatorConfig(doc)).toEqual(cfg);
    });

    // ── nest: flat → the written spelling; engine-dead keys structurally gone ──

    it('nests flat time keys under a type-less timeline (absent type = time); fill / resetOnFinish → the two wire settings', () => {
        const nested = nestAnimatorTimeline({
            duration: 4000, engine: 'auto',
            triggers: { start: 'click' }, delay: 250, iterations: 3,
            direction: 'reverse', fill: 'none', resetOnFinish: true
        });
        expect(nested).toEqual({
            timeline: {
                engine: 'auto',
                outTime: 4000,
                triggers: { start: 'click' },
                actions: { finish: { transition: 'reset' } },
                delay: 250, iterations: 3, iterationDirection: 'reverse'
            }
        });
        // the rest pose comes from `beforeStart`, or from `fill` alone; a held end writes no `actions.finish`
        expect(nestAnimatorTimeline({ beforeStart: 'static', fill: 'both' })).toEqual({ timeline: { beforeStart: 'static' } });
        expect(nestAnimatorTimeline({ fill: 'both' })).toEqual({ timeline: { beforeStart: 'firstFrame' } });
        expect(nestAnimatorTimeline({ fill: 'backwards' })).toEqual({ timeline: { actions: { finish: { transition: 'reset' } }, beforeStart: 'firstFrame' } });
        expect(nestAnimatorTimeline({ fill: 'forwards' })).toEqual({});
    });

    it("nests flat scroll config under timeline{type:'view'|'scroll'}; the dead clock keys (triggers, …) do not survive", () => {
        const nested = nestAnimatorTimeline({
            duration: 4000, timelineSource: 'scroll',
            triggers: { start: 'load' },      // dead under scroll (D3) — dropped by nesting
            engine: 'native',
            scroll: { kind: 'view', axis: 'block', smoothing: 120,
                      pin: true, pinAlign: 'center', pinOffset: 24 }
        });
        expect(nested).toEqual({
            timeline: {
                type: 'view', engine: 'native', outTime: 4000, axis: 'block', smoothing: 120,
                pin: { align: 'center', offset: 24 }
            }
        });
    });

    it("an absent scroll.kind nests as 'view', and a view document survives the round trip", () => {
        // REGRESSION. `scroll.kind` defaults to `'view'` (`_PxScroll.kind`), and the editor
        // omits it at that default — so nesting it as `'scroll'` rewrote the commonest scroll
        // document there is: "element enters the viewport" was saved as "container scrolled".
        expect(nestAnimatorTimeline({ timelineSource: 'scroll', scroll: {} }).timeline?.type)
            .toBe('view');
        expect(nestAnimatorTimeline({ timelineSource: 'scroll' }).timeline?.type)
            .toBe('view');
        // Only the explicit spelling selects the scroller member.
        expect(nestAnimatorTimeline({ timelineSource: 'scroll', scroll: { kind: 'scroll' } }).timeline?.type)
            .toBe('scroll');

        // …and the whole trip is stable: a kind, once written, comes back as itself.
        for (const kind of ['view', 'scroll'] as const) {
            const flat: PxAnimatorRuntimeConfig = { timelineSource: 'scroll', scroll: { kind } };
            expect(resolveAnimatorTimeline(nestAnimatorTimeline(flat)))
                .toMatchObject({ timelineSource: 'scroll', scroll: { kind } });
        }
    });

    it('omits an empty time timeline entirely, and passes a config that already has one through unchanged', () => {
        // §4: a set window now forces the timeline block (it lives there on the wire)…
        expect(nestAnimatorTimeline({ duration: 1000, engine: 'auto' }))
            .toEqual({ timeline: { engine: 'auto', outTime: 1000 } });
        // …`engine` lives in the timeline too, and so does `frameRate` — it parameterises the
        // engine chosen there, so the two sit at the same level.
        expect(nestAnimatorTimeline({ engine: 'auto' })).toEqual({ timeline: { engine: 'auto' } });
        expect(nestAnimatorTimeline({ frameRate: 60 })).toEqual({ timeline: { frameRate: 60 } });
        // Only the non-playback keys stay on `animator` itself.
        expect(nestAnimatorTimeline({ version: '1.5' })).toEqual({ version: '1.5' });
        const already: PxAnimatorRuntimeConfig = { duration: 1, timeline: { delay: 2 } };
        expect(nestAnimatorTimeline(already)).toBe(already);
    });

    it('round-trips: flatten(nest(flat)) reproduces the flat form', () => {
        const flat: PxAnimatorRuntimeConfig = {
            duration: 4000, frameRate: 60, engine: 'auto',
            triggers: { start: 'click', pause: 'click' }, delay: 250,
            iterations: 'infinite', direction: 'alternate',
            // the derived rest-pose view and its wire source, consistent with each other
            fill: 'backwards', resetOnFinish: true, beforeStart: 'firstFrame',
            actions: {
                start: { transition: 'restart' }, stop: { transition: 'rewind', completeIteration: true },
                finish: { transition: 'reset' }, suspend: { transition: 'continue' },
            },
            inViewThreshold: 0.2, inViewDebounce: 80,
        };
        expect(resolveAnimatorTimeline(nestAnimatorTimeline(flat))).toEqual(flat);
    });

    // ── schema: the written spelling validates strictly; dead keys have no slot ──

    it('the nested spelling validates strictly; a time knob inside a scroll timeline is a schema error', () => {
        const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timeline: { type: 'view', outTime: 4000, axis: 'block', pin: { align: 'top' } }
        }, ctx)).toBe(true);
        expect(ctx.errors).toEqual([]);

        const bad: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timeline: { type: 'view', triggers: { start: 'click' } }   // dead key — no slot
        }, bad)).toBe(false);
        expect(bad.errors.length).toBeGreaterThan(0);
    });

    it("time timeline: `type: 'time'` and an absent type both validate; the retired 'clock' does not", () => {
        for (const timeline of [{ type: 'time', outTime: 10 }, { outTime: 10, beforeStart: 'firstFrame', actions: { finish: { transition: 'rewind' } } }]) {
            const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
            expect(PxAnimatorConfigSchema.isValid({ timeline }, ctx)).toBe(true);
            expect(ctx.errors).toEqual([]);
        }
        const bad: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({ timeline: { type: 'clock', outTime: 10 } }, bad)).toBe(false);
        expect(bad.errors.length).toBeGreaterThan(0);
        // neither the flat `fill` nor the pre-1.9 `fillMode` / `finish` / `direction` have a slot on the wire
        for (const timeline of [{ fill: 'both' }, { fillMode: 'both' }, { finish: 'reset' }, { direction: 'reverse' }]) {
            const old: PxValidationContext = { errors: [], warnings: [], strict: true };
            expect(PxAnimatorConfigSchema.isValid({ timeline }, old), JSON.stringify(timeline)).toBe(false);
        }
    });

    it('the flat spelling is NOT wire format — flat playback keys are schema errors', () => {
        const clockCtx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            duration: 1000, triggers: { start: 'load' }, iterations: 3, direction: 'normal'
        }, clockCtx)).toBe(false);   // §2.8: flat duration is not wire either
        expect(clockCtx.errors.length).toBeGreaterThan(0);

        const scrollCtx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timelineSource: 'scroll', scroll: { kind: 'view' }
        }, scrollCtx)).toBe(false);
        expect(scrollCtx.errors.length).toBeGreaterThan(0);
    });
});
