/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// The behaviour contract the names alone do not settle (dev-docs/reviews/schema-and-props--improvements.md §0,
// docs/library/playback-and-triggers.md "The contract"): one test per row that lives in the web engines.
// The executor's rows (stop reaching the end runs finish, the state during a move) are core's PxDeclarativePlayback.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer } from '../index';
import { PxDiagnosticCode, type PxDiagnostic, type PxDocumentJson } from '@pixodesk/svg-animator-core';

function doc(timeline: Record<string, unknown>): PxDocumentJson {
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: { timeline: { engine: 'js', outTime: 1000, ...timeline } },
        children: [{
            type: 'rect', id: 'r', width: 10, height: 10,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    };
}

describe('the playback contract — web engines', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="box"></div>'; vi.useFakeTimers(); });
    afterEach(() => vi.useRealTimers());

    it('a negative speed plays a `reverse` pass forwards — the two multiply', () => {
        const api = createSvgAnimationPlayer({ doc: doc({ iterationDirection: 'reverse' }), container: '#box' });
        api.play();
        vi.advanceTimersByTime(400);
        const before = api.getCurrentTime() ?? 0;
        expect(before).toBeLessThan(700);                    // a reverse pass counts down from the end
        api.setPlaybackSpeed(-1);
        vi.advanceTimersByTime(200);
        expect(api.getCurrentTime() ?? 0).toBeGreaterThan(before);   // reverse × −1: the frames run forwards
        api.destroy();
    });

    it('on a scroll timeline the playback verbs are no-ops that say so (PX1505); scroll owns the playhead', () => {
        const said: Array<PxDiagnostic> = [];
        const api = createSvgAnimationPlayer({
            doc: doc({ type: 'scroll' }), container: '#box',
            onWarning: d => said.push(d),
        });
        api.play();
        api.setPlaybackSpeed(2);
        vi.advanceTimersByTime(200);
        expect(api.isPlaying()).toBe(false);
        expect(api.getPlaybackSpeed()).toBe(1);
        expect(said.filter(d => d.code === PxDiagnosticCode.scrollOwnsPlayhead).map(d => d.data?.[0])).toEqual(['play()', 'setPlaybackSpeed()']);
        api.destroy();
    });
});
