/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from 'vitest';
import { applyAnimatorConfig, mergeAnimatorConfig, foldTimelineOverride, type PxAnimatorConfigPatch } from './PxAnimatorConfigPatch';
import { PxAnimatorConfigSchema, type PxDocument, type PxAnimatorConfig, type PxTimeline } from '../format/PxAnimatorTypes';
import { isRecord } from '../schema/PxSchema';
import { untyped } from '../effects/effectTestKit';

// root `frameRate` is the flat runtime spelling: not in the wire type, still carried by the merge
const timeBase = untyped<PxAnimatorConfig>({
    frameRate: 60,
    timeline: {
        outTime: 1000,
        iterations: 2,
        fillMode: 'both',
        direction: 'normal',
        trigger: { start: 'load', outOfView: 'pause' },
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
        expect(config.timeline).toMatchObject({ outTime: 5000, iterations: 2, fillMode: 'both' });
        expect(config && 'frameRate' in config ? config.frameRate : undefined).toBe(60);
    });

    it('merges nested objects rather than replacing them', () => {
        const { config } = merge(timeBase, { timeline: { trigger: { start: 'click' } } });
        expect(timeTimelineOf(config).trigger).toEqual({ start: 'click', outOfView: 'pause' });
    });

    it('replaces primitives and arrays wholesale', () => {
        const base: PxAnimatorConfig = { timeline: { outTime: 1000 }, definitions: { easings: { a: [0, 0, 1, 1] } } };
        const { config } = merge(base, { definitions: { easings: { a: [0.5, 0, 0.5, 1] } } });
        expect(config?.definitions?.easings?.a).toEqual([0.5, 0, 0.5, 1]);
    });

    it('RULE 7: null DELETES a key, restoring the default that absence means', () => {
        const { config } = merge(timeBase, { timeline: { fillMode: null } });
        expect('fillMode' in timelineOf(config)).toBe(false);
    });

    it('an empty patch returns the base by identity — no needless copy', () => {
        expect(merge(timeBase, {}).config).toBe(timeBase);
    });

    it('never mutates either argument', () => {
        const base = JSON.parse(JSON.stringify(timeBase));
        const patch = { timeline: { outTime: 7000, trigger: { start: 'click' } } };
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
        expect(timeTimelineOf(config).trigger).toEqual({ start: 'load', outOfView: 'pause' });
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
        expect('trigger' in tl).toBe(false);   // the clock keys do not strand on a scroll timeline
        expect('fillMode' in tl).toBe(false);
    });

    it('RULE 1: going back to a time timeline drops the scroll-only keys', () => {
        const { config } = merge(scrollBase, { timeline: { type: 'time', trigger: { start: 'click' } } });
        const tl = timelineOf(config);
        expect(tl).toEqual({ outTime: 4000, type: 'time', trigger: { start: 'click' } });
        expect('range' in tl).toBe(false);
        expect('pin' in tl).toBe(false);
    });

    it('RULE 3: time-only keys aimed at a scroll timeline are dropped, with a warning', () => {
        const { config, warnings } = merge(scrollBase, { timeline: { delay: 500, trigger: { start: 'click' } } });
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
        const { warnings } = merge(untyped<PxAnimatorConfig>({ outTime: 1000, trigger: { start: 'load' } }), { timeline: { outTime: 2000 } });
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

describe('foldTimelineOverride — flat trigger shortcuts (review §12)', () => {
    it('folds the four trigger shortcuts into `timeline.trigger`, same as the CSS component takes', () => {
        const patch = foldTimelineOverride(undefined, {
            start: 'hover', outOfView: 'continue', hoverEnd: 'reverse',
            inViewThreshold: 0.25, inViewDebounce: 300,
        });
        expect(patch).toEqual({ timeline: { trigger: {
            start: 'hover', outOfView: 'continue', hoverEnd: 'reverse',
            inViewThreshold: 0.25, inViewDebounce: 300,
        } } });
    });

    it('a shortcut wins over the same key inside the `timeline` patch', () => {
        const patch = foldTimelineOverride({ trigger: { hoverEnd: 'pause', finish: 'reset' } }, { hoverEnd: 'reverse' });
        const timeline = patch?.timeline;
        expect(isRecord(timeline) ? timeline.trigger : undefined).toEqual({ hoverEnd: 'reverse', finish: 'reset' });
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

    it('resetTimeline ignores the document playback but KEEPS the content tables', () => {
        const d: PxDocument = {
            type: 'svg',
            // root `frameRate` is the flat runtime spelling and the font is cut down — neither fits the wire type
            animator: untyped<PxAnimatorConfig>({
                frameRate: 30,
                timeline: { outTime: 1000, iterations: 5, trigger: { start: 'click' } },
                definitions: { fonts: { Inter: { unitsPerEm: 1000 } } },
                bindings: [{ target: '#r1', animateWith: ['a0'] }],
            }),
        };
        const { doc: out } = applyAnimatorConfig(d, { timeline: { outTime: 250 } }, { resetTimeline: true });
        const cfg = animatorOf(out);
        expect(cfg.timeline).toEqual({ outTime: 250 });   // nothing of the document's timing survives
        expect('frameRate' in cfg ? cfg.frameRate : undefined).toBeUndefined();
        expect(cfg.definitions?.fonts?.Inter.unitsPerEm).toBe(1000);   // content kept
        expect(cfg.bindings).toEqual([{ target: '#r1', animateWith: ['a0'] }]);
    });

    it('resetTimeline with NO patch means "play it with vanilla settings"', () => {
        const d: PxDocument = { type: 'svg', animator: { timeline: { outTime: 1000, iterations: 4 } } };
        const { doc: out } = applyAnimatorConfig(d, {}, { resetTimeline: true });
        expect(animatorOf(out).timeline).toBeUndefined();
    });
});
