/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// §10 (dev-docs/reviews/first-use-review.md): `play` and `pause` are two AXES, not two spellings
// of one state — `play` is run/stop (a change RESETS to the initial state), `pause` freezes the
// current frame (no reset), meaningful only while `play` is true. One rule, shared by the three
// components.
import { describe, expect, it } from 'vitest';
import { PxDeclarativePlayback, resolveDeclarativePlayback } from '../index';

const r = (prev: { play?: boolean; pause?: boolean }, next: { play?: boolean; pause?: boolean }) =>
    resolveDeclarativePlayback(prev, next);

describe('the declarative play/pause rule (§10)', () => {
    it('play is the run/stop axis — a change resets', () => {
        expect(r({}, { play: true }).action).toBe(PxDeclarativePlayback.restart);              // mount playing
        expect(r({ play: false }, { play: true }).action).toBe(PxDeclarativePlayback.restart); // false→true restarts from 0
        expect(r({ play: true }, { play: false }).action).toBe(PxDeclarativePlayback.stop);    // true→false stops + resets
        expect(r({ play: true, pause: true }, { play: false, pause: true }).action).toBe(PxDeclarativePlayback.stop);
        expect(r({ play: false }, { play: false }).action).toBe(PxDeclarativePlayback.none);   // no edge, no work
    });

    it('pause is the freeze axis — holds and resumes, never resets', () => {
        expect(r({ play: true }, { play: true, pause: true }).action).toBe(PxDeclarativePlayback.pause);
        expect(r({ play: true, pause: true }, { play: true, pause: false }).action).toBe(PxDeclarativePlayback.resume);
        expect(r({ play: true, pause: false }, { play: true, pause: false }).action).toBe(PxDeclarativePlayback.none);
        // play arriving true with pause already true: reset and HOLD the initial state
        expect(r({}, { play: true, pause: true }).action).toBe(PxDeclarativePlayback.stop);
    });

    it('pause without play does nothing, and says so once', () => {
        const first = r({}, { pause: true });
        expect(first.action).toBe(PxDeclarativePlayback.none);
        expect(first.warning).toContain('pause');
        // unchanged props on a later render: silent
        expect(r({ pause: true }, { pause: true }).warning).toBeUndefined();
    });
});
