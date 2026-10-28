/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The playback override on `createSvgAnimationPlayer` (dev-docs/plans/component-api.md D4): `timeline`
 * MERGES over the file's timing; `playOnTrigger` is `true` (the file's trigger) or an object — the WHOLE
 * trigger to use instead.
 *
 * These assert the OBSERVABLE effect — what the animator actually plays — rather than the merged object,
 * because the bug this feature replaced was exactly a merge that happened and was then silently discarded
 * downstream. The merge itself is core's (`applyPlaybackOverride`, tested in PxAnimatorConfigPatch.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { createSvgAnimationPlayer } from './PxAnimator';
import type { PxDocument, PxTriggers } from '@pixodesk/svg-animator-core';

/** A WIRE-format document (nested `timeline`) — the spelling every writer emits. */
function wireDoc(triggers: PxTriggers = { start: 'load' }): PxDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: {
            timeline: { engine: 'js', outTime: 1000, iterations: 2, triggers },
        },
        children: [{
            type: 'rect', id: 'r1', opacity: 0,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    };
}

const stage = () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
};

describe('createSvgAnimationPlayer — the override reaches the running animation', () => {

    // The observable: a document whose trigger is `start: 'load'` plays at once; one whose trigger is
    // the EMPTY block does not. Unambiguous — keyframe times are absolute, so a timing override changes
    // when playback ENDS, not the value at a given instant, which makes opacity a poor witness.

    it('baseline: `playOnTrigger: true` plays the file as saved — this one autoplays', () => {
        const api = createSvgAnimationPlayer({ playOnTrigger: true, doc: wireDoc(), container: stage() });
        expect(api.isPlaying()).toBe(true);
        api.destroy();
    });

    it('a `playOnTrigger` OBJECT is the trigger instead of the file\'s', () => {
        const api = createSvgAnimationPlayer({ playOnTrigger: {}, doc: wireDoc(), container: stage() });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('…as a WHOLE: a list the object leaves out is gone — the file\'s `start: load` does not survive an object that lists only `pause`', () => {
        const api = createSvgAnimationPlayer({ playOnTrigger: { pause: 'click' }, doc: wireDoc({ start: 'load' }), container: stage() });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('`timeline` MERGES over the file\'s timing — the file\'s `engine` and trigger survive, so it still plays', () => {
        const api = createSvgAnimationPlayer({ playOnTrigger: true, doc: wireDoc(), container: stage(), timeline: { outTime: 500, iterations: 1 } });
        expect(api.isPlaying()).toBe(true);
        api.destroy();
    });

    it('`timeline` and a `playOnTrigger` object together: the timing adjusted, the trigger replaced', () => {
        const api = createSvgAnimationPlayer({ playOnTrigger: {}, doc: wireDoc(), container: stage(), timeline: { iterations: 1 } });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });

    it('no driver named: the first frame, nothing plays — whatever the file says', () => {
        const api = createSvgAnimationPlayer({ doc: wireDoc(), container: stage(), timeline: { iterations: 1 } });
        expect(api.isPlaying()).toBe(false);
        api.destroy();
    });
});
