/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The `timeline` / `resetTimeline` option on `createAnimator`, and the four flat shortcuts.
 *
 * These assert the OBSERVABLE effect — what the animator actually plays — rather than the
 * merged object, because the bug this feature replaces was exactly a merge that happened and
 * was then silently discarded downstream.
 */
import { describe, expect, it, vi } from 'vitest';
import { createAnimator } from './PxAnimator';
import { resolveTimelineOption } from './PxAnimator';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';

/** A WIRE-format document (nested `timeline`) — the spelling every writer emits. */
function wireDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: {
            timeline: {
                engine: 'js', duration: 1000, iterations: 2,
                trigger: { startOn: 'load' },
            },
        },
        children: [{
            type: 'rect', id: 'r1', opacity: 0,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    } as any;
}

const stage = () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
};

describe('resolveTimelineOption — shortcuts and the string form', () => {

    it('folds the four shortcuts into the timeline patch', () => {
        const out = resolveTimelineOption({ duration: 500, delay: 20, iterations: 'infinite', startOn: 'click' } as any);
        expect(out).toEqual({ timeline: { duration: 500, delay: 20, iterations: 'infinite', trigger: { startOn: 'click' } } });
    });

    it('a shortcut WINS over the same key inside timeline', () => {
        const out = resolveTimelineOption({ timeline: { duration: 1 }, duration: 999 } as any);
        expect((out as any).timeline.duration).toBe(999);
    });

    it('a shortcut merges INTO timeline rather than replacing it', () => {
        const out = resolveTimelineOption({ timeline: { fillMode: 'both' }, duration: 42 } as any);
        expect((out as any).timeline).toEqual({ fillMode: 'both', duration: 42 });
    });

    it('startOn merges into an existing trigger', () => {
        const out = resolveTimelineOption({ timeline: { trigger: { outAction: 'pause' } }, startOn: 'click' } as any);
        expect((out as any).timeline.trigger).toEqual({ outAction: 'pause', startOn: 'click' });
    });

    it('accepts the JSON STRING form — the mangling-proof spelling', () => {
        const out = resolveTimelineOption({ timeline: '{"duration":333}' } as any);
        expect((out as any).timeline.duration).toBe(333);
    });

    it('a malformed JSON string warns and is ignored, never throws', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => resolveTimelineOption({ timeline: '{not json' } as any)).not.toThrow();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('no timeline and no shortcuts is undefined — nothing to apply', () => {
        expect(resolveTimelineOption({} as any)).toBeUndefined();
    });
});

describe('createAnimator — the override reaches the running animation', () => {

    // The observable: the document's `startOn: 'load'` makes it autoplay. If the override
    // reaches the engine, the animation is NOT playing. Chosen because it is unambiguous —
    // keyframe times are absolute, so a duration override changes when playback ENDS, not the
    // value at a given instant, which makes opacity a poor witness.

    it('baseline: the document autoplays, so a change here is visible', () => {
        const api = createAnimator({ doc: wireDoc(), container: stage() });
        expect(api.isPlaying()).toBe(true);
        api.destroy();
    });

    it('timeline (object) overrides the trigger on a WIRE document — the case flat props silently lost', () => {
        const api = createAnimator({
            doc: wireDoc(), container: stage(),
            timeline: { trigger: { startOn: 'programmatic' } },
        });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('timeline as a JSON STRING works identically', () => {
        const api = createAnimator({
            doc: wireDoc(), container: stage(),
            timeline: '{"trigger":{"startOn":"programmatic"}}',
        });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('the startOn SHORTCUT does the same thing', () => {
        const api = createAnimator({ doc: wireDoc(), container: stage(), startOn: 'programmatic' });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it("resetTimeline drops the document trigger, so the default startOn:'load' applies", () => {
        // `mode` is part of the reset too, so it is restated — otherwise the engine choice
        // falls back to `auto`, which probes WAAPI and is unavailable under jsdom.
        // Since review §2.1 a MISSING trigger resolves to `startOn: 'load'`, so dropping the
        // document's trigger no longer means "nothing starts" — it means the default applies.
        // To get "nothing autostarts", ask for it: see the `startOn: 'programmatic'` test above.
        const api = createAnimator({
            doc: wireDoc(), container: stage(),
            resetTimeline: true, timeline: { engine: 'js', duration: 4000 },
        });
        expect(api.isPlaying()).toBe(true);
        api.destroy();
    });

    it('does not mutate the caller document', () => {
        const doc = wireDoc();
        const before = JSON.stringify(doc);
        const api = createAnimator({ doc, container: stage(), timeline: { duration: 9999 } });
        expect(JSON.stringify(doc)).toBe(before);
        api.destroy();
    });
});
