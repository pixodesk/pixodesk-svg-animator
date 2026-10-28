/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from 'vitest';
import { applyAnimatorConfig, mergeAnimatorConfig, applyPlaybackOverride, type PxAnimatorConfigPatch } from './PxAnimatorConfigPatch';
import { PxAnimatorConfigSchema, type PxDocument, type PxAnimatorConfig, type PxTimeline } from '../format/PxAnimatorTypes';
import { isRecord } from '../schema/PxSchema';
import type { PxTimelinePatch, PxPlaybackOverrideInput } from './PxAnimatorConfigPatch';
import type { PxTriggers } from '../format/PxAnimatorTypes';
import { untyped } from '../effects/effectTestKit';

// root `frameRate` is the flat runtime spelling: not in the wire type, still carried by the merge
const timeBase = untyped<PxAnimatorConfig>({
    frameRate: 60,
    timeline: {
        outTime: 1000,
        iterations: 2,
        beforeStart: 'firstFrame',
        iterationDirection: 'normal',
        triggers: { start: 'load' },
        actions: { suspend: { transition: 'pause' } },
    },
});

const scrollBase: PxAnimatorConfig = {
    timeline: {
        type: 'view', outTime: 4000, axis: 'block', subject: 'parent',
        range: { start: { phase: 'entry', fraction: 0 }, end: { phase: 'exit', fraction: 1 } },
        pin: { align: 'center', offset: 24 },
    },
};

const merge = (base: PxAnimatorConfig | undefined, patch: PxAnimatorConfigPatch) => mergeAnimatorConfig(base, patch);

/** The merged config's `timeline` — throws when there is none (a failed expectation). */
function timelineOf(config: PxAnimatorConfig | undefined): PxTimeline {
    const timeline = config?.timeline;
    if (!timeline) throw new Error('no timeline');
    return timeline;
}

/** The merged config's time-driven timeline — throws when it is scroll-driven. */
function timeTimelineOf(config: PxAnimatorConfig | undefined) {
    const timeline = timelineOf(config);
    if (timeline.type === 'scroll' || timeline.type === 'view') throw new Error('not a time timeline');
    return timeline;
}

/** The merged config's scroll-driven (`scroll` / `view`) timeline — throws when it is time-driven. */
function scrollTimelineOf(config: PxAnimatorConfig | undefined) {
    const timeline = timelineOf(config);
    if (timeline.type === 'scroll' || timeline.type === 'view') return timeline;
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
        expect(config.timeline).toMatchObject({ outTime: 5000, iterations: 2, beforeStart: 'firstFrame' });
        expect(config && 'frameRate' in config ? config.frameRate : undefined).toBe(60);
    });

    it('merges nested objects rather than replacing them', () => {
        const { config } = merge(timeBase, { timeline: { triggers: { stop: 'click' } } });
        expect(timeTimelineOf(config).triggers).toEqual({ start: 'load', stop: 'click' });
    });

    it('replaces primitives and arrays wholesale', () => {
        const base: PxAnimatorConfig = { timeline: { outTime: 1000 }, definitions: { easings: { a: [0, 0, 1, 1] } } };
        const { config } = merge(base, { definitions: { easings: { a: [0.5, 0, 0.5, 1] } } });
        expect(config?.definitions?.easings?.a).toEqual([0.5, 0, 0.5, 1]);
    });

    it('RULE 7: null DELETES a key, restoring the default that absence means', () => {
        const { config } = merge(timeBase, { timeline: { beforeStart: null } });
        expect('beforeStart' in timelineOf(config)).toBe(false);
    });

    it('an empty patch returns the base by identity — no needless copy', () => {
        expect(merge(timeBase, {}).config).toBe(timeBase);
    });

    it('never mutates either argument', () => {
        const base = JSON.parse(JSON.stringify(timeBase));
        const patch = { timeline: { outTime: 7000, triggers: { start: 'click' } } };
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
        expect(config?.timeline).toMatchObject({ outTime: 1000, delay: 250, iterations: 2 });
    });

    it('RULE 2: an explicit `time` against an ABSENT type is a match, not a type change', () => {
        // The trap: `timelineTypeOf` must normalize absent -> 'time', or this replaces.
        const { config } = merge(timeBase, { timeline: { type: 'time', outTime: 3000 } });
        expect(timeTimelineOf(config).triggers).toEqual({ start: 'load' });
    });

    it('RULE 2: a patch that does not mention `type` never changes it', () => {
        const { config } = merge(scrollBase, { timeline: { axis: 'inline' } });
        expect(config?.timeline?.type).toBe('view');
        expect(scrollTimelineOf(config).subject).toBe('parent');
    });

    it('RULE 1: a DIFFERENT type replaces the timeline, carrying only the shared keys', () => {
        const { config } = merge(timeBase, { timeline: { type: 'view', subject: 'parent' } });
        const tl = timelineOf(config);
        expect(tl).toEqual({ outTime: 1000, iterations: 2, type: 'view', subject: 'parent' });
        expect('triggers' in tl).toBe(false);   // the clock keys do not strand on a scroll timeline
        expect('beforeStart' in tl).toBe(false);
        expect('actions' in tl).toBe(false);   // the gate's suspend is a clock key too
    });

    it('RULE 1: going back to a time timeline drops the scroll-only keys', () => {
        const { config } = merge(scrollBase, { timeline: { type: 'time', triggers: { start: 'click' } } });
        const tl = timelineOf(config);
        expect(tl).toEqual({ outTime: 4000, type: 'time', triggers: { start: 'click' } });
        expect('range' in tl).toBe(false);
        expect('pin' in tl).toBe(false);
    });

    it('RULE 3: time-only keys aimed at a scroll timeline are dropped, with a warning', () => {
        const { config, warnings } = merge(scrollBase, { timeline: { delay: 500, triggers: { start: 'click' } } });
        expect('delay' in timelineOf(config)).toBe(false);
        expect('trigger' in timelineOf(config)).toBe(false);
        expect(warnings.join(' ')).toContain('no slot on a');
    });

    it('RULE 4: `infinite` iterations cannot map onto a scroll range', () => {
        const { config, warnings } = merge(scrollBase, { timeline: { iterations: 'infinite' } });
        expect('iterations' in timelineOf(config)).toBe(false);
        expect(warnings.join(' ')).toContain('infinite');
    });

    it('RULE 6: `pin` replaces as a whole value in both directions — it is a union member, not a mergeable object', () => {
        expect(scrollTimelineOf(merge(scrollBase, { timeline: { pin: true } }).config).pin).toBe(true);
        const fromBool = merge({ timeline: { type: 'view', pin: true } }, { timeline: { pin: { align: 'top' } } });
        expect(scrollTimelineOf(fromBool.config).pin).toEqual({ align: 'top' });
    });

    it('RULE 6b: `pin: false` survives — it cannot through a flat round-trip', () => {
        const { config } = merge(scrollBase, { timeline: { pin: false } });
        expect(scrollTimelineOf(config).pin).toBe(false);
    });

    it('per-level merge: `range` merges two levels down', () => {
        const { config } = merge(scrollBase, { timeline: { range: { start: { fraction: 0.2 } } } });
        expect(scrollTimelineOf(config).range).toEqual({
            start: { phase: 'entry', fraction: 0.2 },
            end: { phase: 'exit', fraction: 1 },
        });
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
        const base: PxAnimatorConfig = { bindings: [{ target: '#a', animateWith: ['anim1'] }, { target: '#b', animateWith: ['anim2'] }] };
        const { config } = merge(base, { bindings: [{ target: '#a', animateWith: ['anim9'] }] });
        expect(config?.bindings).toEqual([{ target: '#a', animateWith: ['anim9'] }]);
    });
});

describe('mergeAnimatorConfig — guards', () => {

    it('RULE 5: warns when the BASE uses the flat runtime spelling', () => {
        const { warnings } = merge(untyped<PxAnimatorConfig>({ outTime: 1000, triggers: { start: 'load' } }), { timeline: { outTime: 2000 } });
        expect(warnings.join(' ')).toContain('flat runtime spelling');
    });

    it('a null patch clears the config entirely', () => {
        expect(merge(timeBase, null).config).toBeUndefined();
    });

    it('an undefined base is a legal starting point', () => {
        const { config } = merge(undefined, { timeline: { outTime: 800 } });
        expect(config).toEqual({ timeline: { outTime: 800 } });
    });
});

describe('applyPlaybackOverride — `timeline` merges, a `playOnTrigger` object replaces the trigger (component-api plan D4)', () => {
    const file = (): PxDocument => ({
        type: 'svg',
        animator: { timeline: { outTime: 1000, delay: 50, iterations: 2, triggers: { start: 'hoverIn', stop: 'hoverOut' } } },
        children: [{ type: 'rect' }],
    });
    const fileTrigger = { start: 'hoverIn', stop: 'hoverOut' };
    const timelineOf = (d: PxDocument) => animatorOf(d).timeline;

    it('`timeline` MERGES over the file\'s timing — `null` deletes a key; the trigger is untouched', () => {
        const { doc, warnings } = applyPlaybackOverride(file(), { timeline: { delay: null, iterations: 'infinite' } });
        expect(timelineOf(doc)).toEqual({ outTime: 1000, iterations: 'infinite', triggers: fileTrigger });
        expect(warnings).toEqual([]);
    });

    it('`playOnTrigger: true` leaves the file\'s trigger as it is', () => {
        expect(timelineOf(applyPlaybackOverride(file(), { playOnTrigger: true }).doc)).toEqual(timelineOf(file()));
    });

    it('a `playOnTrigger` OBJECT replaces the trigger as a WHOLE — the keys it leaves out are gone, not kept', () => {
        expect(timelineOf(applyPlaybackOverride(file(), { playOnTrigger: { start: 'click' } }).doc))
            .toEqual({ outTime: 1000, delay: 50, iterations: 2, triggers: { start: 'click' } });   // the file\'s stop did not survive
    });

    it('both: the timing merged, the trigger replaced', () => {
        expect(timelineOf(applyPlaybackOverride(file(), { timeline: { iterations: 'infinite' }, playOnTrigger: { start: 'load', pause: 'click' } }).doc))
            .toEqual({ outTime: 1000, delay: 50, iterations: 'infinite', triggers: { start: 'load', pause: 'click' } });
    });

    it('`actions` merges over the file\'s actions — one field changed, the rest kept; `null` deletes', () => {
        const d: PxDocument = { type: 'svg', animator: { timeline: { outTime: 1000, actions: { stop: { transition: 'rewind', completeIteration: true }, finish: { transition: 'reset' } } } } };
        expect(timelineOf(applyPlaybackOverride(d, { actions: { stop: { transition: 'reset' } } }).doc))
            .toEqual({ outTime: 1000, actions: { stop: { transition: 'reset', completeIteration: true }, finish: { transition: 'reset' } } });
        expect(timelineOf(applyPlaybackOverride(d, { actions: { finish: null } }).doc))
            .toEqual({ outTime: 1000, actions: { stop: { transition: 'rewind', completeIteration: true } } });
    });

    it('nothing set, or `playOnTrigger: false` — the same document comes back', () => {
        const d = file();
        expect(applyPlaybackOverride(d, {}).doc).toBe(d);
        expect(applyPlaybackOverride(d, { playOnTrigger: false }).doc).toBe(d);
    });

    it('a non-object `timeline` (a JS caller\'s old JSON string) is reported and ignored, never written', () => {
        const d = file();
        const { doc, warnings } = applyPlaybackOverride(d, { timeline: untyped<PxTimelinePatch>('{"iterations":3}') });
        expect(timelineOf(doc)).toEqual(timelineOf(d));
        expect(warnings).toHaveLength(1);
    });

    it('the types: `timeline` takes neither triggers, actions nor an unknown key; the triggers object is the schema\'s', () => {
        const ok: PxPlaybackOverrideInput = { timeline: { iterations: 1 }, playOnTrigger: { start: 'click' }, actions: { stop: { transition: 'rewind' } } };
        // @ts-expect-error — the triggers travel with `playOnTrigger`, never inside `timeline`
        const nested: PxPlaybackOverrideInput = { timeline: { triggers: { start: 'hoverIn' } } };
        // @ts-expect-error — the actions travel with `actions`, never inside `timeline`
        const nestedActions: PxPlaybackOverrideInput = { timeline: { actions: { stop: { transition: 'rewind' } } } };
        expect(nestedActions).toBeDefined();
        // @ts-expect-error — `playsOn` is not a trigger key
        const typo: PxPlaybackOverrideInput = { playOnTrigger: { playsOn: 'hoverIn' } };
        expect([ok, nested, typo]).toHaveLength(3);
    });
});

describe('the patch types are the schema\'s, not records (component-api plan T1 / T2)', () => {
    it('TypeScript names a misspelled key, a wrong value, and a trigger in the wrong place', () => {
        const ok: PxTimelinePatch = { iterations: 'infinite', delay: null };
        // @ts-expect-error — `strat` is not a timeline key
        const typo: PxTimelinePatch = { strat: 'hover' };
        // @ts-expect-error — not a legal `iterations` value
        const value: PxTimelinePatch = { iterations: 'forever' };
        // @ts-expect-error — `trigger` is the alias, never a `timeline` key (D2)
        const nested: PxTimelinePatch = { triggers: { start: 'hoverIn' } };
        // @ts-expect-error — `playsOn` is not a trigger key
        const triggerTypo: PxTriggers = { playsOn: 'hoverIn' };
        expect([ok, typo, value, nested, triggerTypo]).toHaveLength(5);
    });
});

describe('applyAnimatorConfig — document level', () => {

    const doc = (): PxDocument => ({ type: 'svg', animator: { timeline: { outTime: 1000 } }, children: [{ type: 'rect' }] });

    it('returns a NEW document that shares untouched subtrees', () => {
        const d = doc();
        const { doc: out } = applyAnimatorConfig(d, { timeline: { outTime: 2000 } });
        expect(out).not.toBe(d);
        expect(out.children).toBe(d.children);     // untouched subtree shared by reference
        expect(animatorOf(out).timeline?.outTime).toBe(2000);
        expect(animatorOf(d).timeline?.outTime).toBe(1000);   // input untouched
    });

    it('patches `doc.meta.animator` when that is where the config lives', () => {
        const d: PxDocument = { type: 'svg', meta: { animator: { timeline: { outTime: 500 } } } };
        const { doc: out } = applyAnimatorConfig(d, { timeline: { outTime: 900 } });
        expect(out.meta).toMatchObject({ animator: { timeline: { outTime: 900 } } });
        expect(out.animator).toBeUndefined();   // never invents the other address
    });

    it('warns when both addresses exist, and patches the one that wins', () => {
        const d: PxDocument = { type: 'svg', animator: { timeline: { outTime: 1 } }, meta: { animator: { timeline: { outTime: 2 } } } };
        const { doc: out, warnings } = applyAnimatorConfig(d, { timeline: { outTime: 9 } });
        expect(animatorOf(out).timeline?.outTime).toBe(9);
        expect(isRecord(out.meta) ? PxAnimatorConfigSchema.cast(out.meta.animator).timeline?.outTime : undefined).toBe(2);
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
                timeline: { outTime: 1000, iterations: 5, triggers: { start: 'click' } },
                definitions: { fonts: { Inter: { unitsPerEm: 1000 } } },
                bindings: [{ target: '#r1', animateWith: ['a0'] }],
            }),
        };
        const { doc: out } = applyPlaybackOverride(d, { timeline: { outTime: 250 } });
        const cfg = animatorOf(out);
        expect(cfg.timeline).toEqual({ outTime: 250, iterations: 5, triggers: { start: 'click' } });   // one key changed, the rest kept
        expect(cfg.definitions?.fonts?.Inter.unitsPerEm).toBe(1000);   // content kept
        expect(cfg.bindings).toEqual([{ target: '#r1', animateWith: ['a0'] }]);
    });

    it('an EMPTY `timeline` patch changes nothing', () => {
        const d: PxDocument = { type: 'svg', animator: { timeline: { outTime: 1000, iterations: 4, triggers: { start: 'click' } } } };
        expect(animatorOf(applyPlaybackOverride(d, { timeline: {} }).doc).timeline).toEqual(animatorOf(d).timeline);
    });
});
