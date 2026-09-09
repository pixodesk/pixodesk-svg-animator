/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The `config` / `resetDocDefaults` option on `createAnimator`, and the four flat shortcuts.
 *
 * These assert the OBSERVABLE effect — what the animator actually plays — rather than the
 * merged object, because the bug this feature replaces was exactly a merge that happened and
 * was then silently discarded downstream.
 */
import { describe, expect, it, vi } from 'vitest';
import { createAnimator } from './PxAnimator';
import { resolveAnimatorConfigOption } from './PxAnimator';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';

/** A WIRE-format document (nested `timeline`) — the spelling every writer emits. */
function wireDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: {
            timeline: {
                mode: 'player', duration: 1000, iterations: 2,
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

describe('resolveAnimatorConfigOption — shortcuts and the string form', () => {

    it('folds the four shortcuts into config.timeline', () => {
        const out = resolveAnimatorConfigOption({ duration: 500, delay: 20, iterations: 'infinite', startOn: 'click' } as any);
        expect(out).toEqual({ timeline: { duration: 500, delay: 20, iterations: 'infinite', trigger: { startOn: 'click' } } });
    });

    it('a shortcut WINS over the same key inside config', () => {
        const out = resolveAnimatorConfigOption({ config: { timeline: { duration: 1 } }, duration: 999 } as any);
        expect((out as any).timeline.duration).toBe(999);
    });

    it('a shortcut merges INTO config rather than replacing it', () => {
        const out = resolveAnimatorConfigOption({ config: { timeline: { fillMode: 'both' } }, duration: 42 } as any);
        expect((out as any).timeline).toEqual({ fillMode: 'both', duration: 42 });
    });

    it('startOn merges into an existing trigger', () => {
        const out = resolveAnimatorConfigOption({ config: { timeline: { trigger: { outAction: 'pause' } } }, startOn: 'click' } as any);
        expect((out as any).timeline.trigger).toEqual({ outAction: 'pause', startOn: 'click' });
    });

    it('accepts the JSON STRING form — the mangling-proof spelling', () => {
        const out = resolveAnimatorConfigOption({ config: '{"timeline":{"duration":333}}' } as any);
        expect((out as any).timeline.duration).toBe(333);
    });

    it('a malformed JSON string warns and is ignored, never throws', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => resolveAnimatorConfigOption({ config: '{not json' } as any)).not.toThrow();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('no config and no shortcuts is undefined — nothing to apply', () => {
        expect(resolveAnimatorConfigOption({} as any)).toBeUndefined();
    });
});

describe('createAnimator — the override reaches the running animation', () => {

    // The observable: the document's `startOn: 'load'` makes it autoplay. If the override
    // reaches the engine, the animation is NOT playing. Chosen because it is unambiguous —
    // keyframe times are absolute, so a duration override changes when playback ENDS, not the
    // value at a given instant, which makes opacity a poor witness.

    it('baseline: the document autoplays, so a change here is visible', () => {
        const api = createAnimator({ data: wireDoc(), container: stage() });
        expect(api.isPlaying()).toBe(true);
        api.destroy();
    });

    it('config (object) overrides the trigger on a WIRE document — the case flat props silently lost', () => {
        const api = createAnimator({
            data: wireDoc(), container: stage(),
            config: { timeline: { trigger: { startOn: 'programmatic' } } },
        });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('config as a JSON STRING works identically', () => {
        const api = createAnimator({
            data: wireDoc(), container: stage(),
            config: '{"timeline":{"trigger":{"startOn":"programmatic"}}}',
        });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('the startOn SHORTCUT does the same thing', () => {
        const api = createAnimator({ data: wireDoc(), container: stage(), startOn: 'programmatic' });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('resetDocDefaults drops the document trigger, so nothing autostarts', () => {
        // `mode` is part of the reset too, so it is restated — otherwise the engine choice
        // falls back to `auto`, which probes WAAPI and is unavailable under jsdom.
        const api = createAnimator({
            data: wireDoc(), container: stage(),
            resetDocDefaults: true, config: { timeline: { mode: 'player', duration: 4000 } },
        });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('does not mutate the caller document', () => {
        const doc = wireDoc();
        const before = JSON.stringify(doc);
        const api = createAnimator({ data: doc, container: stage(), config: { timeline: { duration: 9999 } } });
        expect(JSON.stringify(doc)).toBe(before);
        api.destroy();
    });
});
