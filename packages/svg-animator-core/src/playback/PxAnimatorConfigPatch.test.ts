/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { applyAnimatorConfig, mergeAnimatorConfig } from './PxAnimatorConfigPatch';

const timeBase = {
    frameRate: 60,
    timeline: {
        duration: 1000,
        iterations: 2,
        fillMode: 'both',
        direction: 'normal',
        trigger: { startOn: 'load', outAction: 'pause' },
    },
} as any;

const scrollBase = {
    timeline: {
        type: 'view', duration: 4000, axis: 'block', subject: 'parent',
        range: { start: { phase: 'entry', fraction: 0 }, end: { phase: 'exit', fraction: 1 } },
        pin: { align: 'center', offset: 24 },
    },
} as any;

const merge = (base: any, patch: any) => mergeAnimatorConfig(base, patch);

describe('mergeAnimatorConfig — RFC 7386 base semantics', () => {

    it('merges objects per level, leaving untouched siblings alone', () => {
        const { config } = merge(timeBase, { timeline: { duration: 5000 } });
        expect(config!.timeline).toMatchObject({ duration: 5000, iterations: 2, fillMode: 'both' });
        expect((config as any).frameRate).toBe(60);
    });

    it('merges nested objects rather than replacing them', () => {
        const { config } = merge(timeBase, { timeline: { trigger: { startOn: 'click' } } });
        expect((config as any).timeline.trigger).toEqual({ startOn: 'click', outAction: 'pause' });
    });

    it('replaces primitives and arrays wholesale', () => {
        const base = { timeline: { duration: 1000 }, definitions: { easings: { a: [0, 0, 1, 1] } } } as any;
        const { config } = merge(base, { definitions: { easings: { a: [0.5, 0, 0.5, 1] } } });
        expect((config as any).definitions.easings.a).toEqual([0.5, 0, 0.5, 1]);
    });

    it('RULE 7: null DELETES a key, restoring the default that absence means', () => {
        const { config } = merge(timeBase, { timeline: { fillMode: null } });
        expect('fillMode' in (config as any).timeline).toBe(false);
    });

    it('an empty patch returns the base by identity — no needless copy', () => {
        expect(merge(timeBase, {}).config).toBe(timeBase);
    });

    it('never mutates either argument', () => {
        const base = JSON.parse(JSON.stringify(timeBase));
        const patch = { timeline: { duration: 7000, trigger: { startOn: 'click' } } };
        const snapshotBase = JSON.stringify(base);
        const snapshotPatch = JSON.stringify(patch);
        merge(base, patch);
        expect(JSON.stringify(base)).toBe(snapshotBase);
        expect(JSON.stringify(patch)).toBe(snapshotPatch);
    });

    it('returns a NEW object — the flatten memo keys on identity', () => {
        const { config } = merge(timeBase, { timeline: { duration: 2000 } });
        expect(config).not.toBe(timeBase);
    });
});

describe('mergeAnimatorConfig — the timeline union', () => {

    it('RULE 2: the same type merges', () => {
        const { config } = merge(timeBase, { timeline: { type: 'time', delay: 250 } });
        expect((config as any).timeline).toMatchObject({ duration: 1000, delay: 250, iterations: 2 });
    });

    it('RULE 2: an explicit `time` against an ABSENT type is a match, not a type change', () => {
        // The trap: `timelineTypeOf` must normalise absent -> 'time', or this replaces.
        const { config } = merge(timeBase, { timeline: { type: 'time', duration: 3000 } });
        expect((config as any).timeline.trigger).toEqual({ startOn: 'load', outAction: 'pause' });
    });

    it('RULE 2: a patch that does not mention `type` never changes it', () => {
        const { config } = merge(scrollBase, { timeline: { axis: 'inline' } });
        expect((config as any).timeline.type).toBe('view');
        expect((config as any).timeline.subject).toBe('parent');
    });

    it('RULE 1: a DIFFERENT type replaces the timeline, carrying only the shared keys', () => {
        const { config } = merge(timeBase, { timeline: { type: 'view', subject: 'parent' } });
        const tl = (config as any).timeline;
        expect(tl).toEqual({ duration: 1000, iterations: 2, type: 'view', subject: 'parent' });
        expect('trigger' in tl).toBe(false);   // the clock keys do not strand on a scroll timeline
        expect('fillMode' in tl).toBe(false);
    });

    it('RULE 1: going back to a time timeline drops the scroll-only keys', () => {
        const { config } = merge(scrollBase, { timeline: { type: 'time', trigger: { startOn: 'click' } } });
        const tl = (config as any).timeline;
        expect(tl).toEqual({ duration: 4000, type: 'time', trigger: { startOn: 'click' } });
        expect('range' in tl).toBe(false);
        expect('pin' in tl).toBe(false);
    });

    it('RULE 3: time-only keys aimed at a scroll timeline are dropped, with a warning', () => {
        const { config, warnings } = merge(scrollBase, { timeline: { delay: 500, trigger: { startOn: 'click' } } });
        expect('delay' in (config as any).timeline).toBe(false);
        expect('trigger' in (config as any).timeline).toBe(false);
        expect(warnings.join(' ')).toContain('no slot on a');
    });

    it('RULE 4: `infinite` iterations cannot map onto a scroll range', () => {
        const { config, warnings } = merge(scrollBase, { timeline: { iterations: 'infinite' } });
        expect('iterations' in (config as any).timeline).toBe(false);
        expect(warnings.join(' ')).toContain('infinite');
    });

    it('RULE 6: `pin` replaces as a whole value in both directions — it is a union member, not a mergeable object', () => {
        expect((merge(scrollBase, { timeline: { pin: true } }).config as any).timeline.pin).toBe(true);
        const fromBool = merge({ timeline: { type: 'view', pin: true } }, { timeline: { pin: { align: 'top' } } });
        expect((fromBool.config as any).timeline.pin).toEqual({ align: 'top' });
    });

    it('RULE 6b: `pin: false` survives — it cannot through a flat round-trip', () => {
        const { config } = merge(scrollBase, { timeline: { pin: false } });
        expect((config as any).timeline.pin).toBe(false);
    });

    it('per-level merge: `range` merges two levels down', () => {
        const { config } = merge(scrollBase, { timeline: { range: { start: { fraction: 0.2 } } } });
        expect((config as any).timeline.range).toEqual({
            start: { phase: 'entry', fraction: 0.2 },
            end: { phase: 'exit', fraction: 1 },
        });
    });
});

describe('mergeAnimatorConfig — records and content', () => {

    it('definitions.fonts merges BY KEY — patching one font keeps the others', () => {
        const base = { definitions: { fonts: { Inter: { unitsPerEm: 1000 }, Roboto: { unitsPerEm: 2048 } } } } as any;
        const { config } = merge(base, { definitions: { fonts: { Inter: { unitsPerEm: 512 } } } });
        expect((config as any).definitions.fonts).toEqual({
            Inter: { unitsPerEm: 512 }, Roboto: { unitsPerEm: 2048 },
        });
    });

    it('animateById merges by element id', () => {
        const base = { animateById: { a: ['anim1'], b: ['anim2'] } } as any;
        const { config } = merge(base, { animateById: { a: ['anim9'] } });
        expect((config as any).animateById).toEqual({ a: ['anim9'], b: ['anim2'] });
    });
});

describe('mergeAnimatorConfig — guards', () => {

    it('RULE 5: warns when the BASE uses the flat runtime spelling', () => {
        const { warnings } = merge({ duration: 1000, trigger: { startOn: 'load' } } as any, { timeline: { duration: 2000 } });
        expect(warnings.join(' ')).toContain('flat runtime spelling');
    });

    it('a null patch clears the config entirely', () => {
        expect(merge(timeBase, null).config).toBeUndefined();
    });

    it('an undefined base is a legal starting point', () => {
        const { config } = merge(undefined, { timeline: { duration: 800 } });
        expect(config).toEqual({ timeline: { duration: 800 } });
    });
});

describe('applyAnimatorConfig — document level', () => {

    const doc = () => ({ type: 'svg', animator: { timeline: { duration: 1000 } }, children: [{ type: 'rect' }] } as any);

    it('returns a NEW document that shares untouched subtrees', () => {
        const d = doc();
        const { doc: out } = applyAnimatorConfig(d, { timeline: { duration: 2000 } });
        expect(out).not.toBe(d);
        expect(out.children).toBe(d.children);     // untouched subtree shared by reference
        expect((out as any).animator.timeline.duration).toBe(2000);
        expect((d as any).animator.timeline.duration).toBe(1000);   // input untouched
    });

    it('patches `doc.meta.animator` when that is where the config lives', () => {
        const d = { type: 'svg', meta: { animator: { timeline: { duration: 500 } } } } as any;
        const { doc: out } = applyAnimatorConfig(d, { timeline: { duration: 900 } });
        expect(out.meta.animator.timeline.duration).toBe(900);
        expect((out as any).animator).toBeUndefined();   // never invents the other address
    });

    it('warns when both addresses exist, and patches the one that wins', () => {
        const d = { type: 'svg', animator: { timeline: { duration: 1 } }, meta: { animator: { timeline: { duration: 2 } } } } as any;
        const { doc: out, warnings } = applyAnimatorConfig(d, { timeline: { duration: 9 } });
        expect((out as any).animator.timeline.duration).toBe(9);
        expect((out as any).meta.animator.timeline.duration).toBe(2);
        expect(warnings.join(' ')).toContain('shadowed');
    });

    it('an empty patch returns the document by identity', () => {
        const d = doc();
        expect(applyAnimatorConfig(d, {}).doc).toBe(d);
    });

    it('resetDefaults ignores the document playback but KEEPS the content tables', () => {
        const d = {
            type: 'svg',
            animator: {
                frameRate: 30,
                timeline: { duration: 1000, iterations: 5, trigger: { startOn: 'click' } },
                definitions: { fonts: { Inter: { unitsPerEm: 1000 } } },
                animateById: { r1: ['a0'] },
            },
        } as any;
        const { doc: out } = applyAnimatorConfig(d, { timeline: { duration: 250 } }, { resetDefaults: true });
        const cfg = (out as any).animator;
        expect(cfg.timeline).toEqual({ duration: 250 });   // nothing of the document's timing survives
        expect(cfg.frameRate).toBeUndefined();
        expect(cfg.definitions.fonts.Inter.unitsPerEm).toBe(1000);   // content kept
        expect(cfg.animateById).toEqual({ r1: ['a0'] });
    });

    it('resetDefaults with NO patch means "play it with vanilla settings"', () => {
        const d = { type: 'svg', animator: { timeline: { duration: 1000, iterations: 4 } } } as any;
        const { doc: out } = applyAnimatorConfig(d, {}, { resetDefaults: true });
        expect((out as any).animator.timeline).toBeUndefined();
    });
});
