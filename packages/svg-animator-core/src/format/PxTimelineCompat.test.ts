/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The two spellings of "what advances progress" (review §2.1) and the conversions
// between them: `animator.timelines?.[0]` (written) ⇄ flat runtime view (consumed).
// On the wire the time-driven timeline carries NO `type` (absent = 'time'); the runtime view
// keeps the engines' `fill` / `resetOnFinish` / `direction`, DERIVED from the wire's
// `whenIdle` / `whenFinished` / `iterationDirection` (playback-layers.md).

import { describe, expect, it } from 'vitest';
import { resolveAnimatorTimeline, getAnimatorConfig, nestAnimatorTimeline } from './PxAnimatorConstants';
import { PxAnimatorConfigSchema, type PxDocument, type PxAnimatorConfig, type PxAnimatorRuntimeConfig } from './PxAnimatorTypes';
import type { PxValidationContext } from '../schema/PxSchema';
import { untyped } from '../effects/effectTestKit';
import { prepareDocument } from '../pipeline/PxPrepareDocument';
import { PxDocStage } from './PxDocStage';

describe('animator.timelines?.[0] spelling compat', () => {

    it('§4: the window folds — inTime/outTime → flat duration (window length) + inTime; playbackSpeed passes', () => {
        const cfg = getAnimatorConfig({
            type: 'svg',
            animator: { timelines: [{ inTime: 500, outTime: 2500, playbackSpeed: 0.5 }] },
        });
        expect(cfg?.duration).toBe(2000);        // outTime − inTime: the engines' one length
        expect(cfg?.inTime).toBe(500);           // the sampling shift
        expect(cfg?.playbackSpeed).toBe(0.5);        // the file's speed, the engine's initial one
        // …and the round trip writes the window back as its two points
        expect(nestAnimatorTimeline({ inTime: 500, duration: 2000, playbackSpeed: 0.5 }).timelines?.[0])
            .toEqual({ inTime: 500, outTime: 2500, playbackSpeed: 0.5 });
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

    it('flattens a time timeline to the flat runtime keys (whenFinished → resetOnFinish + fill, iterationDirection → direction)', () => {
        // 1.29: what the timeline does by itself is its own keys (`whenStopped`, `whenOutOfView`), carried flat
        const flat = resolveAnimatorTimeline({
            timelines: [{
                type: 'time', outTime: 4000,
                whenIdle: 'firstFrame', whenFinished: 'jumpToStart', whenStopped: 'animateToEnd', whenOutOfView: 'continue',
                delay: 250, iterations: 'infinite', iterationDirection: 'alternate',
                inViewThreshold: 0.2, inViewDebounce: 80,
            }], actions: [{ name: 'timeline.start', triggers: [{ event: 'click' }] }, { name: 'timeline.pause', triggers: [{ event: 'click' }] }]
        });
        expect(flat.timelines).toBeUndefined();
        expect(flat).toMatchObject({
            duration: 4000, delay: 250, iterations: 'infinite', direction: 'alternate',
            fill: 'backwards', resetOnFinish: true, whenIdle: 'firstFrame', whenFinished: 'jumpToStart',
            whenStopped: 'animateToEnd', whenOutOfView: 'continue', inViewThreshold: 0.2, inViewDebounce: 80,
            actions: [{ name: 'timeline.start', triggers: [{ event: 'click' }] }, { name: 'timeline.pause', triggers: [{ event: 'click' }] }]
        });
        // an EMPTY triggers block is copied as it is — it means "nothing starts it", not "the defaults"
        expect(resolveAnimatorTimeline({ timelines: [{ }], actions: [] }).actions).toEqual([]);
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

    it("flattens a scroll timeline to timelineSource:'scroll' + its settings: a word moment → { moment }, holdOnScreen → flat flags; engine is shared", () => {
        const flat = resolveAnimatorTimeline({
            timelines: [{
                type: 'scroll', outTime: 4000, engine: 'js', axis: 'vertical',
                smoothing: 120, holdOnScreen: { at: 'center', offset: 24, forScreens: 3 },
                firstFrameWhen: 'halfIn', lastFrameWhen: { domElement: 'top', screen: 0.8 },
            }]
        });
        expect(flat.timelineSource).toBe('scroll');
        expect(flat.engine).toBe('js');
        expect(flat.scroll).toEqual({
            axis: 'vertical', smoothing: 120,
            holdOnScreen: true, holdAt: 'center', holdOffset: 24, holdForScreens: 3,
            firstFrameWhen: { moment: 'halfIn' }, lastFrameWhen: { domElement: 'top', screen: 0.8 },
        });
        expect(resolveAnimatorTimeline({ timelines: [{ type: 'scroll', follows: 'pageScroll', holdOnScreen: true, firstFrameWhen: { scrolled: 0.2 } }] }))
            .toMatchObject({ timelineSource: 'scroll', scroll: { follows: 'pageScroll', holdOnScreen: true, firstFrameWhen: { scrolled: 0.2 } } });
    });

    it('finite iterations survive a scroll timeline in both directions (D4); infinite does not nest', () => {
        expect(nestAnimatorTimeline({ duration: 1, timelineSource: 'scroll', iterations: 3 }))
            .toEqual({ timelines: [{ type: 'scroll', outTime: 1, iterations: 3 }] });
        expect(nestAnimatorTimeline({ duration: 1, timelineSource: 'scroll', iterations: 'infinite' }))
            .toEqual({ timelines: [{ type: 'scroll', outTime: 1 }] });
        expect(resolveAnimatorTimeline({ timelines: [{ type: 'scroll', iterations: 2 }] }))
            .toMatchObject({ timelineSource: 'scroll', iterations: 2 });
    });

    it('is identity for a flat runtime-view config and pure for a nested one', () => {
        const flat: PxAnimatorRuntimeConfig = { duration: 1000, actions: [{ name: 'timeline.start', triggers: [{ event: 'load' }] }] };
        expect(resolveAnimatorTimeline(flat)).toBe(flat);            // nothing to fold → same object
        const nested: PxAnimatorRuntimeConfig = { timelines: [{ delay: 5 }] };   // no `type` = time-driven
        // no memo since the prepare-document pipeline: an equal answer every call, not the same object
        expect(resolveAnimatorTimeline(nested)).toEqual(resolveAnimatorTimeline(nested));
    });

    it('getAnimatorConfig serves the flat view (engines never see `timeline`)', () => {
        const cfg = getAnimatorConfig({
            type: 'svg',
            animator: { timelines: [{ outTime: 500, delay: 42 }] }
        });
        expect(cfg?.timelines).toBeUndefined();
        expect(cfg?.duration).toBe(500);   // the window
        expect(cfg?.delay).toBe(42);
    });

    it('getAnimatorConfig DROPS flat playback keys found on a document — the wire states playback only inside `timeline`', () => {
        const cfg = getAnimatorConfig({
            type: 'svg',
            animator: untyped<PxAnimatorConfig>({ duration: 9999, actions: [{ name: 'timeline.start', triggers: [{ event: 'load' }] }], fill: 'both', resetOnFinish: true }),
        });

        // the stray value never wins: the window resolves to the DEFAULT, not the dropped 9999
        expect(cfg?.duration).toBe(1000);
        expect(cfg?.actions).toEqual([{ name: 'timeline.start', triggers: [{ event: 'load' }] }]);   // not a flat key: the triggers' wire place since 2026-11-15
        expect(cfg?.fill).toBeUndefined();
        expect(cfg?.resetOnFinish).toBeUndefined();
    });

    it('a stray flat key never shadows the timeline, and the lookup tables still come through', () => {
        const doc: PxDocument = {
            type: 'svg',
            // the stray flat `duration` is not in the type, on purpose
            animator: untyped<PxAnimatorConfig>({ duration: 9, timelines: [{ outTime: 500 }], definitions: { easings: {} } }),
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
            actions: [{ name: 'timeline.start', triggers: [{ event: 'click' }] }], delay: 250, iterations: 3,
            direction: 'reverse', fill: 'none', resetOnFinish: true
        });
        expect(nested).toEqual({
            timelines: [{
                engine: 'auto',
                outTime: 4000,
                whenFinished: 'jumpToStart',
                delay: 250, iterations: 3, iterationDirection: 'reverse'
            }], actions: [{ name: 'timeline.start', triggers: [{ event: 'click' }] }]
        });
        // the rest pose comes from `whenIdle`, or from `fill` alone; a held end writes no `whenFinished`
        expect(nestAnimatorTimeline({ whenIdle: 'static', fill: 'both' })).toEqual({ timelines: [{ whenIdle: 'static' }] });
        expect(nestAnimatorTimeline({ fill: 'both' })).toEqual({ timelines: [{ whenIdle: 'firstFrame' }] });
        expect(nestAnimatorTimeline({ fill: 'backwards' })).toEqual({ timelines: [{ whenFinished: 'jumpToStart', whenIdle: 'firstFrame' }] });
        expect(nestAnimatorTimeline({ fill: 'forwards' })).toEqual({});
    });

    it("nests flat scroll settings under timeline{type:'scroll'}; the dead clock keys (triggers, frame rate, …) do not survive", () => {
        const nested = nestAnimatorTimeline({
            duration: 4000, timelineSource: 'scroll',
            actions: [{ name: 'timeline.start', triggers: [{ event: 'load' }] }],      // dead under scroll (D3) — dropped by nesting
            frameRate: 30,                                      // no frame rate on a scroll timeline
            engine: 'native',
            scroll: { axis: 'horizontal', smoothing: 120, holdOnScreen: true, holdAt: 'center', holdOffset: 24,
                      lastFrameWhen: { moment: 'fullyIn' } }
        });
        expect(nested).toEqual({
            timelines: [{
                type: 'scroll', engine: 'native', outTime: 4000, axis: 'horizontal', smoothing: 120,
                holdOnScreen: { at: 'center', offset: 24 }, lastFrameWhen: 'fullyIn',
            }]
        });
    });

    it("an empty scroll block nests as a bare scroll timeline, and every settings form survives the round trip", () => {
        expect(nestAnimatorTimeline({ timelineSource: 'scroll', scroll: {} }).timelines?.[0]).toEqual({ type: 'scroll' });
        expect(nestAnimatorTimeline({ timelineSource: 'scroll' }).timelines?.[0]).toEqual({ type: 'scroll' });
        // held with no settings is the word `true`
        expect(nestAnimatorTimeline({ timelineSource: 'scroll', scroll: { holdOnScreen: true } }).timelines?.[0])
            .toEqual({ type: 'scroll', holdOnScreen: true });

        // …and the whole trip is stable: a moment, once written, comes back as itself.
        const flats: Array<PxAnimatorRuntimeConfig> = [
            { timelineSource: 'scroll', scroll: { follows: 'parentDomElement', firstFrameWhen: { moment: 'centered' } } },
            { timelineSource: 'scroll', scroll: { follows: 'pageDomElement', selector: '#a', lastFrameWhen: { domElement: 0.3, screen: 'top' } } },
            { timelineSource: 'scroll', scroll: { follows: 'containerScroll', firstFrameWhen: { scrolled: 0.25 } } },
        ];
        for (const flat of flats) expect(resolveAnimatorTimeline(nestAnimatorTimeline(flat))).toMatchObject(flat);
    });

    it('omits an empty time timeline entirely, and passes a config that already has one through unchanged', () => {
        // §4: a set window now forces the timeline block (it lives there on the wire)…
        expect(nestAnimatorTimeline({ duration: 1000, engine: 'auto' }))
            .toEqual({ timelines: [{ engine: 'auto', outTime: 1000 }] });
        // …`engine` lives in the timeline too, and so does `frameRate` — it parameterises the
        // engine chosen there, so the two sit at the same level.
        expect(nestAnimatorTimeline({ engine: 'auto' })).toEqual({ timelines: [{ engine: 'auto' }] });
        expect(nestAnimatorTimeline({ frameRate: 60 })).toEqual({ timelines: [{ frameRate: 60 }] });
        // Only the non-playback keys stay on `animator` itself.
        expect(nestAnimatorTimeline({ version: '1.5' })).toEqual({ version: '1.5' });
        const already: PxAnimatorRuntimeConfig = { duration: 1, timelines: [{ delay: 2 }] };
        expect(nestAnimatorTimeline(already)).toBe(already);
    });

    it('round-trips: flatten(nest(flat)) reproduces the flat form', () => {
        const flat: PxAnimatorRuntimeConfig = {
            duration: 4000, frameRate: 60, engine: 'auto',
            actions: [{ name: 'timeline.start', triggers: [{ event: 'click' }] }, { name: 'timeline.pause', triggers: [{ event: 'click' }] }], delay: 250,
            iterations: 'infinite', direction: 'alternate',
            // the derived rest-pose view and its wire source, consistent with each other
            fill: 'backwards', resetOnFinish: true, whenIdle: 'firstFrame', whenFinished: 'jumpToStart',
            whenStopped: 'animateToEnd', whenOutOfView: 'continue',
            inViewThreshold: 0.2, inViewDebounce: 80,
        };
        expect(resolveAnimatorTimeline(nestAnimatorTimeline(flat))).toEqual(flat);
    });

    // ── schema: the written spelling validates strictly; dead keys have no slot ──

    it('the nested spelling validates strictly; a time knob inside a scroll timeline is a schema error', () => {
        const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timelines: [{ type: 'scroll', outTime: 4000, axis: 'vertical', holdOnScreen: { at: 'top' }, firstFrameWhen: 'fullyIn' }]
        }, ctx)).toBe(true);
        expect(ctx.errors).toEqual([]);

        const bad: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timelines: [{ type: 'scroll', delay: 100 }]   // a clock key — no slot on a scroll timeline
        }, bad)).toBe(false);
        expect(bad.errors.length).toBeGreaterThan(0);
    });

    it("time timeline: `type: 'time'` and an absent type both validate; the retired 'clock' does not", () => {
        for (const timeline of [{ type: 'time', outTime: 10 }, { outTime: 10, whenIdle: 'firstFrame', whenFinished: 'animateToStart', whenStopped: 'animateToStart' }]) {
            const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
            expect(PxAnimatorConfigSchema.isValid({ timelines: [timeline] }, ctx)).toBe(true);
            expect(ctx.errors).toEqual([]);
        }
        const bad: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({ timelines: [{ type: 'clock', outTime: 10 }] }, bad)).toBe(false);
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
            duration: 1000, actions: [{ name: 'timeline.start', triggers: [{ event: 'load' }] }], iterations: 3, direction: 'normal'
        }, clockCtx)).toBe(false);   // §2.8: flat duration is not wire either
        expect(clockCtx.errors.length).toBeGreaterThan(0);

        const scrollCtx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxAnimatorConfigSchema.isValid({
            timelineSource: 'scroll', scroll: { follows: 'pageScroll' }
        }, scrollCtx)).toBe(false);
        expect(scrollCtx.errors.length).toBeGreaterThan(0);
    });
});
