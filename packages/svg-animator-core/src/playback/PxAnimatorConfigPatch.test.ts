/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from 'vitest';
import { applyAnimatorConfig, mergeAnimatorConfig, applyPlaybackOverride, takeFollowedOut, withControlMode, withoutTriggerDriver, type PxAnimatorConfigPatch } from './PxAnimatorConfigPatch';
import { PxControlMode } from '../format/PxAnimatorConstants';
import { PxAnimatorConfigSchema, type PxDocument, type PxAnimatorConfig, type PxTimeline } from '../format/PxAnimatorTypes';
import { isRecord } from '../schema/PxSchema';
import type { PxTimelineOptions, PxPlaybackOverrideInput } from './PxAnimatorConfigPatch';
import type { PxActionTriggers } from '../format/PxAnimatorTypes';
import { untyped } from '../effects/effectTestKit';

// root `frameRate` is the flat runtime spelling: not in the wire type, still carried by the merge
const timeBase = untyped<PxAnimatorConfig>({
    frameRate: 60,
    timelines: [{
        outTime: 1000,
        iterations: 2,
        whenIdle: 'firstFrame',
        iterationDirection: 'normal',
        actions: { outOfView: { behavior: 'pause' } },
    }], actionTriggers: [{ action: 'timeline.start', event: 'load' }],
});

const scrollBase: PxAnimatorConfig = {
    timelines: [{
        type: 'scroll', outTime: 4000, axis: 'vertical',
        firstFrameWhen: 'fullyIn', lastFrameWhen: { domElement: 'top', screen: 0.2 },
        holdOnScreen: { at: 'center', offset: 24 },
    }],
};

const merge = (base: PxAnimatorConfig | undefined, patch: PxAnimatorConfigPatch) => mergeAnimatorConfig(base, patch);

/** The merged config's `timeline` — throws when there is none (a failed expectation). */
function timelineOf(config: PxAnimatorConfig | undefined): PxTimeline {
    const timeline = config?.timelines?.[0];
    if (!timeline) throw new Error('no timeline');
    return timeline;
}

/** The merged config's time-driven timeline — throws when it is scroll-driven. */
function timeTimelineOf(config: PxAnimatorConfig | undefined) {
    const timeline = timelineOf(config);
    if (timeline.type === 'scroll') throw new Error('not a time timeline');
    return timeline;
}

/** The merged config's scroll timeline — throws when it is time-driven. */
function scrollTimelineOf(config: PxAnimatorConfig | undefined) {
    const timeline = timelineOf(config);
    if (timeline.type === 'scroll') return timeline;
    throw new Error('not a scroll-driven timeline');
}

/** The document's root `animator` — throws when there is none. */
function animatorOf(doc: PxDocument): PxAnimatorConfig {
    if (!doc.animator) throw new Error('no animator');
    return doc.animator;
}

describe('mergeAnimatorConfig — RFC 7386 base semantics', () => {

    it('merges objects per level, leaving untouched siblings alone', () => {
        const { config } = merge(timeBase, { timeline: { outTime: 5000 } });
        assert(config, 'the merge yields a config');
        expect(config.timelines?.[0]).toMatchObject({ outTime: 5000, iterations: 2, whenIdle: 'firstFrame' });
        expect(config && 'frameRate' in config ? config.frameRate : undefined).toBe(60);
    });

    it('the rules are a list — a patch REPLACES them whole, as every array (2026-11-20: a map by action merged per key until then)', () => {
        const { config } = merge(timeBase, { actionTriggers: [{ action: 'timeline.stop', event: 'click' }] });
        expect(config?.actionTriggers).toEqual([{ action: 'timeline.stop', event: 'click' }]);
    });

    it('replaces primitives and arrays wholesale', () => {
        const base: PxAnimatorConfig = { timelines: [{ outTime: 1000 }], definitions: { easings: { a: [0, 0, 1, 1] } } };
        const { config } = merge(base, { definitions: { easings: { a: [0.5, 0, 0.5, 1] } } });
        expect(config?.definitions?.easings?.a).toEqual([0.5, 0, 0.5, 1]);
    });

    it('RULE 7: a JavaScript `null` changes nothing — no delete since 1.22; set the value wanted instead', () => {
        const { config } = merge(timeBase, untyped<PxAnimatorConfigPatch>({ timeline: { whenIdle: null } }));
        expect(timelineOf(config)).toMatchObject({ whenIdle: 'firstFrame' });
    });

    it('an empty patch returns the base by identity — no needless copy', () => {
        expect(merge(timeBase, {}).config).toBe(timeBase);
    });

    it('never mutates either argument', () => {
        const base = JSON.parse(JSON.stringify(timeBase));
        const patch = { timeline: { outTime: 7000 }, actionTriggers: [{ action: 'timeline.start' as const, event: 'click' as const }] };
        const snapshotBase = JSON.stringify(base);
        const snapshotPatch = JSON.stringify(patch);
        merge(base, patch);
        expect(JSON.stringify(base)).toBe(snapshotBase);
        expect(JSON.stringify(patch)).toBe(snapshotPatch);
    });

    it('returns a NEW object — the flatten memo keys on identity', () => {
        const { config } = merge(timeBase, { timeline: { outTime: 2000 } });
        expect(config).not.toBe(timeBase);
    });
});

describe('mergeAnimatorConfig — the timeline union', () => {

    it('RULE 2: the same type merges', () => {
        const { config } = merge(timeBase, { timeline: { type: 'time', delay: 250 } });
        expect(config?.timelines?.[0]).toMatchObject({ outTime: 1000, delay: 250, iterations: 2 });
    });

    it('RULE 2: an explicit `time` against an ABSENT type is a match, not a type change', () => {
        // The trap: `timelineTypeOf` must normalize absent -> 'time', or this replaces.
        const { config } = merge(timeBase, { timeline: { type: 'time', outTime: 3000 } });
        expect(config?.actionTriggers).toEqual([{ action: 'timeline.start', event: 'load' }]);
    });

    it('RULE 2: a patch that does not mention `type` never changes it', () => {
        const { config } = merge(scrollBase, { timeline: { axis: 'horizontal' } });
        expect(config?.timelines?.[0].type).toBe('scroll');
        expect(scrollTimelineOf(config).firstFrameWhen).toBe('fullyIn');
    });

    it('RULE 1: a DIFFERENT type replaces the timeline, carrying only the shared keys', () => {
        const { config } = merge(timeBase, { timeline: { type: 'scroll', follows: 'parentDomElement' } });
        const tl = timelineOf(config);
        expect(tl).toEqual({ outTime: 1000, iterations: 2, type: 'scroll', follows: 'parentDomElement' });
        expect('actionTriggers' in tl).toBe(false);   // the clock keys do not strand on a scroll timeline
        expect('whenIdle' in tl).toBe(false);
        expect('actions' in tl).toBe(false);   // the gate's outOfView is a clock key too
    });

    it('RULE 1: going back to a time timeline drops the scroll-only keys', () => {
        const { config } = merge(scrollBase, { timeline: { type: 'time' }, actionTriggers: [{ action: 'timeline.start', event: 'click' }] });
        const tl = timelineOf(config);
        expect(tl).toEqual({ outTime: 4000, type: 'time' });
        expect(config?.actionTriggers).toEqual([{ action: 'timeline.start', event: 'click' }]);   // the triggers sit at the root since 2026-11-15
        expect('firstFrameWhen' in tl).toBe(false);
        expect('holdOnScreen' in tl).toBe(false);
    });

    it('RULE 3: time-only keys aimed at a scroll timeline are dropped, with a warning', () => {
        const { config, warnings } = merge(scrollBase, { timeline: { delay: 500 }, actionTriggers: [{ action: 'timeline.start', event: 'click' }] });
        expect('delay' in timelineOf(config)).toBe(false);
        expect('trigger' in timelineOf(config)).toBe(false);
        expect(warnings.join(' ')).toContain('no slot on a');
    });

    it('RULE 4: `infinite` iterations cannot map onto a scroll range', () => {
        const { config, warnings } = merge(scrollBase, { timeline: { iterations: 'infinite' } });
        expect('iterations' in timelineOf(config)).toBe(false);
        expect(warnings.join(' ')).toContain('infinite');
    });

    it('RULE 6: `holdOnScreen` replaces as a whole value in both directions — it is a union member, not a mergeable object', () => {
        expect(scrollTimelineOf(merge(scrollBase, { timeline: { holdOnScreen: true } }).config).holdOnScreen).toBe(true);
        const fromBool = merge({ timelines: [{ type: 'scroll', holdOnScreen: true }] }, { timeline: { holdOnScreen: { at: 'top' } } });
        expect(scrollTimelineOf(fromBool.config).holdOnScreen).toEqual({ at: 'top' });
    });

    it('RULE 6b: `holdOnScreen: false` survives — it cannot through a flat round-trip', () => {
        const { config } = merge(scrollBase, { timeline: { holdOnScreen: false } });
        expect(scrollTimelineOf(config).holdOnScreen).toBe(false);
    });

    it('per-level merge: `range` merges two levels down', () => {
        // a moment is one value — a word or an object — so a patch's moment replaces the file's whole, never mixed
        const { config } = merge(scrollBase, { timeline: { lastFrameWhen: { scrolled: 0.5 } } });
        expect(scrollTimelineOf(config).lastFrameWhen).toEqual({ scrolled: 0.5 });
        expect(scrollTimelineOf(merge(scrollBase, { timeline: { firstFrameWhen: { domElement: 'center', screen: 'center' } } }).config).firstFrameWhen)
            .toEqual({ domElement: 'center', screen: 'center' });
    });
});

describe('mergeAnimatorConfig — records and content', () => {

    it('definitions.fonts merges BY KEY — patching one font keeps the others', () => {
        // fonts cut down to the one key the merge touches — not complete glyph fonts
        const base = untyped<PxAnimatorConfig>({ definitions: { fonts: { Inter: { unitsPerEm: 1000 }, Roboto: { unitsPerEm: 2048 } } } });
        const { config } = merge(base, { definitions: { fonts: { Inter: { unitsPerEm: 512 } } } });
        expect(config?.definitions?.fonts).toEqual({
            Inter: { unitsPerEm: 512 }, Roboto: { unitsPerEm: 2048 },
        });
    });

    it('bindings is a list, so a patched list REPLACES the document\'s (arrays are values)', () => {
        const base: PxAnimatorConfig = { bindings: [{ element: '#a', animateWith: ['anim1'] }, { element: '#b', animateWith: ['anim2'] }] };
        const { config } = merge(base, { bindings: [{ element: '#a', animateWith: ['anim9'] }] });
        expect(config?.bindings).toEqual([{ element: '#a', animateWith: ['anim9'] }]);
    });
});

describe('mergeAnimatorConfig — guards', () => {

    it('RULE 5: warns when the BASE uses the flat runtime spelling', () => {
        const { warnings } = merge(untyped<PxAnimatorConfig>({ outTime: 1000, delay: 100 }), { timeline: { outTime: 2000 } });
        expect(warnings.join(' ')).toContain('flat runtime spelling');
    });

    it('a null patch changes nothing — the base comes back by identity (no delete since 1.22)', () => {
        expect(merge(timeBase, untyped<PxAnimatorConfigPatch>(null)).config).toBe(timeBase);
    });

    it('an undefined base is a legal starting point', () => {
        const { config } = merge(undefined, { timeline: { outTime: 800 } });
        expect(config).toEqual({ timelines: [{ outTime: 800 }] });
    });
});

// 1.26: the triggers override is `actionTriggers` (`playerActionTriggers` until 1.25) and `actions` REPLACES the block;
// since 2026-11-15 the triggers sit at the animator's root, beside `timeline`
describe('applyPlaybackOverride — `timeline` merges, an `actionTriggers` block replaces the triggers (component-api plan D4)', () => {
    const file = (): PxDocument => ({
        type: 'svg',
        animator: { timelines: [{ outTime: 1000, delay: 50, iterations: 2 }], actionTriggers: [{ action: 'timeline.start', event: 'hoverIn' }, { action: 'timeline.stop', event: 'hoverOut' }] },
        children: [{ type: 'rect' }],
    });
    const fileTrigger = [{ action: 'timeline.start', event: 'hoverIn' }, { action: 'timeline.stop', event: 'hoverOut' }];
    const timelineOf = (d: PxDocument) => animatorOf(d).timelines?.[0];

    it('`timeline` MERGES over the file\'s timing — a key left out (or a JavaScript `null`) keeps the file\'s value; the trigger is untouched', () => {
        const { doc, warnings } = applyPlaybackOverride(file(), { timelineOptions: untyped<PxTimelineOptions>({ delay: null, iterations: 'infinite' }) });
        expect(timelineOf(doc)).toEqual({ outTime: 1000, delay: 50, iterations: 'infinite' });
        expect(animatorOf(doc).actionTriggers).toEqual(fileTrigger);
        expect(warnings).toEqual([]);
    });

    it('no `actionTriggers` leaves the file\'s triggers as they are', () => {
        const { doc } = applyPlaybackOverride(file(), {});
        expect(timelineOf(doc)).toEqual(timelineOf(file()));
        expect(animatorOf(doc).actionTriggers).toEqual(fileTrigger);
    });

    it('an `actionTriggers` OBJECT replaces the triggers as a WHOLE — the keys it leaves out are gone, not kept', () => {
        const { doc } = applyPlaybackOverride(file(), { actionTriggers: [{ action: 'timeline.start', event: 'click' }] });
        expect(timelineOf(doc)).toEqual({ outTime: 1000, delay: 50, iterations: 2 });
        expect(animatorOf(doc).actionTriggers).toEqual([{ action: 'timeline.start', event: 'click' }]);   // the file\'s stop did not survive
    });

    it('both: the timing merged, the triggers replaced', () => {
        const { doc } = applyPlaybackOverride(file(), { timelineOptions: { iterations: 'infinite' }, actionTriggers: [{ action: 'timeline.start', event: 'load' }, { action: 'timeline.pause', event: 'click' }] });
        expect(timelineOf(doc)).toEqual({ outTime: 1000, delay: 50, iterations: 'infinite' });
        expect(animatorOf(doc).actionTriggers).toEqual([{ action: 'timeline.start', event: 'load' }, { action: 'timeline.pause', event: 'click' }]);
    });

    it('`actions` REPLACES the file\'s actions block (1.26) — a slot it leaves out reads as its default, a slot is kept as written', () => {
        const d: PxDocument = { type: 'svg', animator: { timelines: [{ outTime: 1000, actions: { 'timeline.stop': { behavior: 'animateToStart' }, outOfView: { behavior: 'continue' } }, whenFinished: 'jumpToStart' }] } };
        expect(timelineOf(applyPlaybackOverride(d, { actions: { 'timeline.stop': { behavior: 'animateToEnd' } } }).doc))
            .toEqual({ outTime: 1000, actions: { 'timeline.stop': { behavior: 'animateToEnd' } }, whenFinished: 'jumpToStart' });   // the file\'s outOfView is gone
        // the word form is exactly `{ behavior }`, and stays the word
        expect(timelineOf(applyPlaybackOverride(d, { actions: { 'timeline.stop': 'jumpToStart' } }).doc))
            .toEqual({ outTime: 1000, actions: { 'timeline.stop': 'jumpToStart' }, whenFinished: 'jumpToStart' });
        const words: PxDocument = { type: 'svg', animator: { timelines: [{ outTime: 1000, actions: { 'timeline.stop': 'jumpToStart' }, whenFinished: 'hold' }] } };
        expect(timelineOf(applyPlaybackOverride(words, { actions: { 'timeline.stop': { behavior: 'animateToEnd' } } }).doc))
            .toEqual({ outTime: 1000, actions: { 'timeline.stop': { behavior: 'animateToEnd' } }, whenFinished: 'hold' });
        // `whenFinished` is a timeline key: it travels with `timelineOptions`
        expect(timelineOf(applyPlaybackOverride(words, { timelineOptions: { whenFinished: 'animateToStart' } }).doc))
            .toEqual({ outTime: 1000, actions: { 'timeline.stop': 'jumpToStart' }, whenFinished: 'animateToStart' });
    });

    it('nothing set, or `actionTriggers: null` (the control mode\'s to apply) — the same document comes back', () => {
        const d = file();
        expect(applyPlaybackOverride(d, {}).doc).toBe(d);
        expect(applyPlaybackOverride(d, { actionTriggers: null }).doc).toBe(d);
    });

    it('a non-object `timeline` (a JS caller\'s old JSON string) is reported and ignored, never written', () => {
        const d = file();
        const { doc, warnings } = applyPlaybackOverride(d, { timelineOptions: untyped<PxTimelineOptions>('{"iterations":3}') });
        expect(timelineOf(doc)).toEqual(timelineOf(d));
        expect(warnings).toHaveLength(1);
    });

    it('the types: `timeline` takes neither triggers, actions nor an unknown key; the triggers object is the schema\'s', () => {
        const ok: PxPlaybackOverrideInput = { timelineOptions: { iterations: 1 }, actionTriggers: [{ action: 'timeline.start', event: 'click' }], actions: { 'timeline.stop': { behavior: 'animateToStart' } } };
        // @ts-expect-error — the triggers travel with `actionTriggers`, never inside `timeline`
        const nested: PxPlaybackOverrideInput = { timeline: { }, actionTriggers: [{ action: 'timeline.start', event: 'hoverIn' }] };
        // @ts-expect-error — the actions travel with `actions`, never inside `timeline`
        const nestedActions: PxPlaybackOverrideInput = { timeline: { actions: { 'timeline.stop': { behavior: 'animateToStart' } } } };
        expect(nestedActions).toBeDefined();
        // @ts-expect-error — `hovrIn` is not an event (since 2026-11-15 the block is open to one go-to key per segment, so a
        // misspelled KEY compiles; a known key's events are still checked)
        const typo: PxPlaybackOverrideInput = { actionTriggers: [{ action: 'timeline.start', event: 'hovrIn' }] };
        expect([ok, nested, typo]).toHaveLength(3);
    });
});

describe('the patch types are the schema\'s, not records (component-api plan T1 / T2)', () => {
    it('TypeScript names a misspelled key, a wrong value, and a trigger in the wrong place', () => {
        const ok: PxTimelineOptions = { iterations: 'infinite', delay: 100 };
        // @ts-expect-error — no `null` delete since 1.22: set the value wanted
        const nulled: PxTimelineOptions = { delay: null };
        // @ts-expect-error — `strat` is not a timeline key
        const typo: PxTimelineOptions = { strat: 'hover' };
        // @ts-expect-error — not a legal `iterations` value
        const value: PxTimelineOptions = { iterations: 'forever' };
        // @ts-expect-error — `trigger` is the alias, never a `timeline` key (D2)
        const nested: PxTimelineOptions = { actionTriggers: [{ action: 'timeline.start', event: 'hoverIn' }] };
        // @ts-expect-error — `hovrIn` is not an event (the block is open to go-to keys since 2026-11-15; a known key's events are checked)
        const triggerTypo: PxActionTriggers = { 'timeline.pause': 'hovrIn' };
        expect([ok, nulled, typo, value, nested, triggerTypo]).toHaveLength(6);
    });
});

describe('applyAnimatorConfig — document level', () => {

    const doc = (): PxDocument => ({ type: 'svg', animator: { timelines: [{ outTime: 1000 }] }, children: [{ type: 'rect' }] });

    it('returns a NEW document that shares untouched subtrees', () => {
        const d = doc();
        const { doc: out } = applyAnimatorConfig(d, { timeline: { outTime: 2000 } });
        expect(out).not.toBe(d);
        expect(out.children).toBe(d.children);     // untouched subtree shared by reference
        expect(animatorOf(out).timelines?.[0].outTime).toBe(2000);
        expect(animatorOf(d).timelines?.[0].outTime).toBe(1000);   // input untouched
    });

    it('patches `doc.meta.animator` when that is where the config lives', () => {
        const d: PxDocument = { type: 'svg', meta: { animator: { timelines: [{ outTime: 500 }] } } };
        const { doc: out } = applyAnimatorConfig(d, { timeline: { outTime: 900 } });
        expect(out.meta).toMatchObject({ animator: { timelines: [{ outTime: 900 }] } });
        expect(out.animator).toBeUndefined();   // never invents the other address
    });

    it('warns when both addresses exist, and patches the one that wins', () => {
        const d: PxDocument = { type: 'svg', animator: { timelines: [{ outTime: 1 }] }, meta: { animator: { timelines: [{ outTime: 2 }] } } };
        const { doc: out, warnings } = applyAnimatorConfig(d, { timeline: { outTime: 9 } });
        expect(animatorOf(out).timelines?.[0].outTime).toBe(9);
        expect(isRecord(out.meta) ? PxAnimatorConfigSchema.cast(out.meta.animator).timelines?.[0]?.outTime : undefined).toBe(2);
        expect(warnings.join(' ')).toContain('shadowed');
    });

    it('an empty patch returns the document by identity', () => {
        const d = doc();
        expect(applyAnimatorConfig(d, {}).doc).toBe(d);
    });

    it('`timeline` adjusts the document\'s timing and KEEPS the content tables and its trigger', () => {
        const d: PxDocument = {
            type: 'svg',
            // the font is cut down, so it does not fit the wire type
            animator: untyped<PxAnimatorConfig>({
                timelines: [{ outTime: 1000, iterations: 5 }], actionTriggers: [{ action: 'timeline.start', event: 'click' }],
                definitions: { fonts: { Inter: { unitsPerEm: 1000 } } },
                bindings: [{ element: '#r1', animateWith: ['a0'] }],
            }),
        };
        const { doc: out } = applyPlaybackOverride(d, { timelineOptions: { outTime: 250 } });
        const cfg = animatorOf(out);
        expect(cfg.timelines?.[0]).toEqual({ outTime: 250, iterations: 5 });   // one key changed, the rest kept
        expect(cfg.actionTriggers).toEqual([{ action: 'timeline.start', event: 'click' }]);
        expect(cfg.definitions?.fonts?.Inter.unitsPerEm).toBe(1000);   // content kept
        expect(cfg.bindings).toEqual([{ element: '#r1', animateWith: ['a0'] }]);
    });

    it('an EMPTY `timeline` patch changes nothing', () => {
        const d: PxDocument = { type: 'svg', animator: { timelines: [{ outTime: 1000, iterations: 4 }], actionTriggers: [{ action: 'timeline.start', event: 'click' }] } };
        expect(animatorOf(applyPlaybackOverride(d, { timelineOptions: {} }).doc).timelines?.[0]).toEqual(animatorOf(d).timelines?.[0]);
    });
});

describe('applyPlaybackOverride — `actions` and `actionTriggers` REPLACE the file\'s blocks; withControlMode (2026-11-13)', () => {
    const hoverFile = (): PxDocument => ({
        type: 'svg',
        animator: { timelines: [{ outTime: 1000, actions: { 'timeline.stop': 'animateToStart', outOfView: 'continue' } }], actionTriggers: [{ action: 'timeline.start', event: 'hoverIn' }, { action: 'timeline.pause', event: 'hoverOut' }] },
    });
    const timelineOf = (d: PxDocument): Record<string, unknown> => {
        const timeline: unknown = animatorOf(d).timelines?.[0];
        return isRecord(timeline) ? timeline : {};
    };

    it('`actions` is the WHOLE block — a slot left out is gone, never the file\'s value', () => {
        const out = applyPlaybackOverride(hoverFile(), { actions: { 'timeline.stop': 'animateToEnd' } }).doc;
        expect(timelineOf(out)).toEqual({ outTime: 1000, actions: { 'timeline.stop': 'animateToEnd' } });
        expect(animatorOf(out).actionTriggers).toEqual([{ action: 'timeline.start', event: 'hoverIn' }, { action: 'timeline.pause', event: 'hoverOut' }]);
    });

    it('`actionTriggers` is the WHOLE block; `null` is the control mode\'s to apply, so the override leaves the document as it is', () => {
        expect(animatorOf(applyPlaybackOverride(hoverFile(), { actionTriggers: [{ action: 'timeline.start', event: 'click' }] }).doc).actionTriggers)
            .toEqual([{ action: 'timeline.start', event: 'click' }]);
        const d = hoverFile();
        expect(applyPlaybackOverride(d, { actionTriggers: null }).doc).toBe(d);
    });

    it('withControlMode: the default keeps the triggers, manual empties them, static also shows the static picture', () => {
        const d = hoverFile();
        expect(withControlMode(d, PxControlMode.actionTriggers)).toBe(d);
        expect(animatorOf(withControlMode(d, PxControlMode.manual)).actionTriggers).toEqual([]);
        const still = withControlMode(d, PxControlMode.static);
        expect(animatorOf(still).actionTriggers).toEqual([]);
        expect(timelineOf(still).whenIdle).toBe('static');
    });

    it('withControlMode spares a scroll-driven document — scroll is not an action trigger', () => {
        const scroll: PxDocument = { type: 'svg', animator: { timelines: [{ type: 'scroll', outTime: 1000 }] } };
        expect(withControlMode(scroll, PxControlMode.manual)).toBe(scroll);
        expect(withControlMode(scroll, PxControlMode.static)).toBe(scroll);
    });

    it('withoutTriggerDriver spares a scroll timeline too — the components call it directly, and an empty block there is a validation problem', () => {
        const scroll: PxDocument = { type: 'svg', animator: { timelines: [{ type: 'scroll', outTime: 1000 }] } };
        expect(withoutTriggerDriver(scroll)).toBe(scroll);
        const clock: PxDocument = { type: 'svg', animator: { timelines: [{ outTime: 1000 }], actionTriggers: [{ action: 'timeline.start', event: 'load' }] } };
        expect(withoutTriggerDriver(clock).animator?.timelines?.[0]).toEqual({ outTime: 1000 });
        expect(withoutTriggerDriver(clock).animator?.actionTriggers).toEqual([]);
    });
});

// Page code may hand an element (web) or a ref (React, Vue) to a scroll timeline's `follows` (2026-11-14): it is taken
// out before the merge, so documents stay JSON. Each surface gives its own test for "what was handed over".
describe('takeFollowedOut — what page code hands over in `follows` never reaches the document', () => {
    /** A stand-in for an element or a ref: anything that is not a word. */
    interface Box { readonly box: true }
    const isBox = (value: unknown): value is Box => typeof value === 'object' && value !== null && 'box' in value;
    const box: Box = { box: true };

    it('takes it out — the rest of the options stay, `follows` is left out (the file\'s stays)', () => {
        const { timelineOptions, followed } = takeFollowedOut<Box>({ type: 'scroll', follows: box, lastFrameWhen: 'fullyIn' }, isBox);
        expect(followed).toBe(box);
        expect(timelineOptions).toEqual({ type: 'scroll', lastFrameWhen: 'fullyIn' });
        // …and the merge then carries no `follows` from the options
        const { doc } = applyPlaybackOverride({ type: 'svg', animator: { timelines: [{ type: 'scroll', follows: 'pageScroll' }] } }, { timelineOptions });
        expect(doc.animator?.timelines?.[0]).toEqual({ type: 'scroll', follows: 'pageScroll', lastFrameWhen: 'fullyIn' });
    });

    it('a word, no `follows`, nothing and a non-object pass through untouched', () => {
        const word: PxTimelineOptions = { type: 'scroll', follows: 'pageScroll' };
        expect(takeFollowedOut<Box>(word, isBox)).toEqual({ timelineOptions: word });
        const clock: PxTimelineOptions = { iterations: 2 };
        expect(takeFollowedOut<Box>(clock, isBox).timelineOptions).toBe(clock);
        expect(takeFollowedOut<Box>(undefined, isBox)).toEqual({ timelineOptions: undefined });
        const text = untyped<PxTimelineOptions>('{"iterations":3}');   // a JavaScript caller: the merge reports it
        expect(takeFollowedOut<Box>(text, isBox).timelineOptions).toBe(text);
    });

    it('the plain options type takes the words only; `PxTimelineOptions<T>` also takes `T` in `follows`', () => {
        const handed: PxTimelineOptions<Box> = { type: 'scroll', follows: box };
        // @ts-expect-error — without a type for it, `follows` is a word
        const plain: PxTimelineOptions = { type: 'scroll', follows: box };
        expect([handed, plain]).toHaveLength(2);
    });
});
