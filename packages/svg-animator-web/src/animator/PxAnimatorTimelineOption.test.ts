/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * The playback override on `createSvgAnimationPlayer` (dev-docs/plans/component-api.md D4): `timelineOptions`
 * MERGES over the file's timing; with no `actionTriggers` the file's trigger drives, an object is the WHOLE
 * trigger to use instead.
 *
 * These assert the OBSERVABLE effect — what the animator actually plays — rather than the merged object,
 * because the bug this feature replaced was exactly a merge that happened and was then silently discarded
 * downstream. The merge itself is core's (`applyPlaybackOverride`, tested in PxAnimatorConfigPatch.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { createSvgAnimationPlayer } from './PxAnimator';
import { PxDiagnosticCode, type PxDiagnostic, type PxDocument, type PxActionTriggers } from '@pixodesk/svg-animator-core';

/** A WIRE-format document (nested `timelineOptions`) — the spelling every writer emits. */
function wireDoc(actionTriggers: PxActionTriggers = { 'playback.start': 'load' }): PxDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: {
            timeline: { engine: 'js', outTime: 1000, iterations: 2, actionTriggers },
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

    // The observable: a document whose trigger is `startPlayback: 'load'` plays at once; one whose trigger is
    // the EMPTY block does not. Unambiguous — keyframe times are absolute, so a timing override changes
    // when playback ENDS, not the value at a given instant, which makes opacity a poor witness.

    it('baseline: no option plays the file as saved — this one autoplays', () => {
        const api = createSvgAnimationPlayer({ document: wireDoc(), container: stage() });
        expect(api.playback.isPlaying()).toBe(true);
        api.destroy();
    });

    it('an `actionTriggers` OBJECT is the trigger instead of the file\'s', () => {
        // the file starts on load; the block says click — so nothing plays until a click
        const api = createSvgAnimationPlayer({ actionTriggers: { 'playback.start': 'click' }, document: wireDoc(), container: stage() });
        expect(api.playback.isPlaying()).toBe(false);
        api.destroy();
    });

    it('…as a WHOLE: a list the object leaves out is gone — the file\'s `start: load` does not survive an object that lists only `pause`', () => {
        const api = createSvgAnimationPlayer({ actionTriggers: { 'playback.pause': 'click' }, document: wireDoc({ 'playback.start': 'load' }), container: stage() });
        expect(api.playback.isPlaying()).toBe(false);
        api.destroy();
    });

    it('`timelineOptions` MERGES over the file\'s timing — the file\'s `engine` and trigger survive, so it still plays', () => {
        const api = createSvgAnimationPlayer({ document: wireDoc(), container: stage(), timelineOptions: { outTime: 500, iterations: 1 } });
        expect(api.playback.isPlaying()).toBe(true);
        api.destroy();
    });

    it('`timelineOptions` and an `actionTriggers` object together: the timing adjusted, the trigger replaced', () => {
        const api = createSvgAnimationPlayer({ actionTriggers: { 'playback.start': 'click' }, document: wireDoc(), container: stage(), timelineOptions: { iterations: 1 } });
        expect(api.playback.isPlaying()).toBe(false);
        api.destroy();
    });

    it('no driver named: the first frame, nothing plays — whatever the file says', () => {
        const api = createSvgAnimationPlayer({ document: wireDoc(), container: stage(), timelineOptions: { iterations: 1 } });
        expect(api.playback.isPlaying()).toBe(false);
        api.destroy();
    });
});

describe('createSvgAnimationPlayer — the control options: manual, a still, a mix (2026-11-13)', () => {

    it('disableActionTriggers: manual — nothing plays by itself, the api drives it', () => {
        const api = createSvgAnimationPlayer({ document: wireDoc(), container: stage(), disableActionTriggers: true });
        expect(api.playback.isPlaying()).toBe(false);
        api.playback.start();
        expect(api.playback.isPlaying()).toBe(true);
        api.destroy();
    });

    it('actionTriggers null: the same as disableActionTriggers', () => {
        const api = createSvgAnimationPlayer({ document: wireDoc(), container: stage(), actionTriggers: null });
        expect(api.playback.isPlaying()).toBe(false);
        api.playback.start();
        expect(api.playback.isPlaying()).toBe(true);
        api.destroy();
    });

    it('showAsStatic: nothing plays, every playback call is ignored with PX1506, the reads still answer', () => {
        const warnings: Array<PxDiagnostic> = [];
        const api = createSvgAnimationPlayer({ document: wireDoc(), container: stage(), showAsStatic: true, onWarning: d => warnings.push(d) });
        expect(api.playback.isPlaying()).toBe(false);
        api.playback.start();
        api.playback.setCurrentTime(500);
        api.playback.setSpeed(2);
        expect(api.playback.isPlaying()).toBe(false);
        expect(api.playback.getCurrentTime()).toBe(0);
        expect(api.playback.getDuration()).toBe(1000);
        expect(warnings.map(w => w.code)).toEqual([PxDiagnosticCode.showAsStaticIgnoresCall, PxDiagnosticCode.showAsStaticIgnoresCall, PxDiagnosticCode.showAsStaticIgnoresCall]);
        api.destroy();
    });

    it('showAsStatic beside an actionTriggers block: the still wins and says so (PX1501)', () => {
        const warnings: Array<PxDiagnostic> = [];
        const api = createSvgAnimationPlayer({
            document: wireDoc(), container: stage(), showAsStatic: true, actionTriggers: { 'playback.start': 'load' }, onWarning: d => warnings.push(d),
        });
        expect(api.playback.isPlaying()).toBe(false);
        expect(warnings.map(w => w.code)).toEqual([PxDiagnosticCode.controlPropsConflict]);
        api.destroy();
    });
});
