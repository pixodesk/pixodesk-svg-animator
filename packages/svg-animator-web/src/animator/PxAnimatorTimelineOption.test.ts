/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The `timeline` / `resetTimeline` option on `createSvgAnimationPlayer`, and the four flat shortcuts.
 *
 * These assert the OBSERVABLE effect — what the animator actually plays — rather than the
 * merged object, because the bug this feature replaces was exactly a merge that happened and
 * was then silently discarded downstream.
 */
import { describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer } from './PxAnimator';
import { resolveTimelineOption } from './PxAnimator';
import type { PxDocument, PxAnimatorConfigPatch, PxTimelinePatch } from '@pixodesk/svg-animator-core';

/** A WIRE-format document (nested `timeline`) — the spelling every writer emits. */
function wireDoc(): PxDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: {
            timeline: {
                engine: 'js', outTime: 1000, iterations: 2,
                trigger: { start: 'load' },
            },
        },
        children: [{
            type: 'rect', id: 'r1', opacity: 0,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    };
}

/** The fold writes the `timeline` slot as a plain object (or `null`). */
const isTimelinePatch = (v: unknown): v is PxTimelinePatch => typeof v === 'object' && !Array.isArray(v);

/** A resolved patch's `timeline` block. */
function timelineOf(patch: PxAnimatorConfigPatch | undefined): PxTimelinePatch | undefined {
    const timeline = patch?.timeline;
    return isTimelinePatch(timeline) ? timeline : undefined;
}

const stage = () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
};

describe('resolveTimelineOption — shortcuts and the string form', () => {

    it('folds the four shortcuts into the timeline patch', () => {
        const out = resolveTimelineOption({ outTime: 500, delay: 20, iterations: 'infinite', start: 'click' });
        expect(out).toEqual({ timeline: { outTime: 500, delay: 20, iterations: 'infinite', trigger: { start: 'click' } } });
    });

    it('a shortcut WINS over the same key inside timeline', () => {
        const out = resolveTimelineOption({ timeline: { outTime: 1 }, outTime: 999 });
        expect(timelineOf(out)?.outTime).toBe(999);
    });

    it('a shortcut merges INTO timeline rather than replacing it', () => {
        const out = resolveTimelineOption({ timeline: { fillMode: 'both' }, outTime: 42 });
        expect(timelineOf(out)).toEqual({ fillMode: 'both', outTime: 42 });
    });

    it('start merges into an existing trigger', () => {
        const out = resolveTimelineOption({ timeline: { trigger: { hoverEnd: 'pause' } }, start: 'click' });
        expect(timelineOf(out)?.trigger).toEqual({ hoverEnd: 'pause', start: 'click' });
    });

    it('accepts the JSON STRING form — the mangling-proof spelling', () => {
        const out = resolveTimelineOption({ timeline: '{"duration":333}' });
        expect(timelineOf(out)?.duration).toBe(333);
    });

    it('a malformed JSON string warns and is ignored, never throws', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => resolveTimelineOption({ timeline: '{not json' })).not.toThrow();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('no timeline and no shortcuts is undefined — nothing to apply', () => {
        expect(resolveTimelineOption({})).toBeUndefined();
    });
});

describe('createSvgAnimationPlayer — the override reaches the running animation', () => {

    // The observable: the document's `start: 'load'` makes it playOnTrigger. If the override
    // reaches the engine, the animation is NOT playing. Chosen because it is unambiguous —
    // keyframe times are absolute, so a duration override changes when playback ENDS, not the
    // value at a given instant, which makes opacity a poor witness.

    it('baseline: the document autoplays, so a change here is visible', () => {
        const api = createSvgAnimationPlayer({ playOnTrigger: true, doc: wireDoc(), container: stage() });
        expect(api.isPlaying()).toBe(true);
        api.destroy();
    });

    it('timeline (object) overrides the trigger on a WIRE document — the case flat props silently lost', () => {
        const api = createSvgAnimationPlayer({
            playOnTrigger: true, doc: wireDoc(), container: stage(),
            timeline: { trigger: { start: 'manual' } },
        });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('timeline as a JSON STRING works identically', () => {
        const api = createSvgAnimationPlayer({
            playOnTrigger: true, doc: wireDoc(), container: stage(),
            timeline: '{"trigger":{"start":"manual"}}',
        });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('the start SHORTCUT does the same thing', () => {
        const api = createSvgAnimationPlayer({ playOnTrigger: true, doc: wireDoc(), container: stage(), start: 'manual' });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it("resetTimeline drops the document trigger, so the default start:'load' applies", () => {
        // `mode` is part of the reset too, so it is restated — otherwise the engine choice
        // falls back to `auto`, which probes WAAPI and is unavailable under jsdom.
        // Since review §2.1 a MISSING trigger resolves to `start: 'load'`, so dropping the
        // document's trigger no longer means "nothing starts" — it means the default applies.
        // To get "nothing autostarts", ask for it: see the `start: 'manual'` test above.
        const api = createSvgAnimationPlayer({
            playOnTrigger: true, doc: wireDoc(), container: stage(),
            resetTimeline: true, timeline: { engine: 'js', outTime: 4000 },
        });
        expect(api.isPlaying()).toBe(true);
        api.destroy();
    });

    it('does not mutate the caller document', () => {
        const doc = wireDoc();
        const before = JSON.stringify(doc);
        const api = createSvgAnimationPlayer({ playOnTrigger: true, doc, container: stage(), timeline: { outTime: 9999 } });
        expect(JSON.stringify(doc)).toBe(before);
        api.destroy();
    });
});
