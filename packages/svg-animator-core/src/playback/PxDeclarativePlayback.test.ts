/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// §10 (dev-docs/reviews/first-use-review.md): `play` names a STATE — a pose for a one-shot
// document, running-or-not for a looping one. `playMode` (fillMode's spellings) says which pose
// changes PLAY vs snap; `pause` freezes the clock only and is forcibly lifted by `play: false`;
// `completeIteration` defers a loop's off to the iteration boundary. ONE rule for all three
// components.
import { describe, expect, it } from 'vitest';
import {
    PxPlayMode,
} from '../index';
import {
    PxDeclarativeAction,
    PxPlaybackWorld,
    resolveDeclarativePlayback,
    resolvePlaybackWorld,
} from '../engine';

const oneShot = (next: { play?: boolean; pause?: boolean }, prev?: { play?: boolean; pause?: boolean },
    playMode: PxPlayMode = PxPlayMode.forwards, playModeExplicit = false) =>
    resolveDeclarativePlayback({ world: PxPlaybackWorld.oneShot, playMode, playModeExplicit, completeIteration: false, prev, next });
const loop = (next: { play?: boolean; pause?: boolean }, prev?: { play?: boolean; pause?: boolean }, completeIteration = false) =>
    resolveDeclarativePlayback({ world: PxPlaybackWorld.loop, playMode: PxPlayMode.forwards, playModeExplicit: false, completeIteration, prev, next });

describe('the playback world', () => {
    it('splits on the effective iterations', () => {
        expect(resolvePlaybackWorld(undefined)).toBe(PxPlaybackWorld.oneShot);
        expect(resolvePlaybackWorld(1)).toBe(PxPlaybackWorld.oneShot);
        expect(resolvePlaybackWorld(2)).toBe(PxPlaybackWorld.loop);
        expect(resolvePlaybackWorld('infinite')).toBe(PxPlaybackWorld.loop);
    });
});

describe('one-shot: play is a POSE switch', () => {
    it('mount shows the pose, never animates', () => {
        expect(oneShot({ play: true }).actions).toEqual([PxDeclarativeAction.showEnd]);
        expect(oneShot({ play: false }).actions).toEqual([]);
        expect(oneShot({}).actions).toEqual([]);
    });

    it('playMode forwards (default): plays there, snaps back', () => {
        expect(oneShot({ play: true }, { play: false }).actions).toEqual([PxDeclarativeAction.travelToEnd]);
        expect(oneShot({ play: false }, { play: true }).actions).toEqual([PxDeclarativeAction.snapToStart]);
    });

    it('playMode both: plays both ways; backwards: snaps there, plays back; none: snaps both ways', () => {
        expect(oneShot({ play: false }, { play: true }, PxPlayMode.both).actions).toEqual([PxDeclarativeAction.travelToStart]);
        expect(oneShot({ play: true }, { play: false }, PxPlayMode.backwards).actions).toEqual([PxDeclarativeAction.snapToEnd]);
        expect(oneShot({ play: false }, { play: true }, PxPlayMode.backwards).actions).toEqual([PxDeclarativeAction.travelToStart]);
        expect(oneShot({ play: true }, { play: false }, PxPlayMode.none).actions).toEqual([PxDeclarativeAction.snapToEnd]);
        expect(oneShot({ play: false }, { play: true }, PxPlayMode.none).actions).toEqual([PxDeclarativeAction.snapToStart]);
    });

    it('pause freezes the clock while play is true, and resumes toward the current target', () => {
        expect(oneShot({ play: true, pause: true }, { play: true }).actions).toEqual([PxDeclarativeAction.freeze]);
        expect(oneShot({ play: true, pause: false }, { play: true, pause: true }).actions).toEqual([PxDeclarativeAction.resume]);
        // a retarget while frozen: the travel starts, then freezes again — the clock stays held
        expect(oneShot({ play: true, pause: true }, { play: false, pause: true }, PxPlayMode.both).actions)
            .toEqual([PxDeclarativeAction.travelToEnd, PxDeclarativeAction.freeze]);
    });

    it('play: false forcibly unfreezes — the off happens as if nothing had been frozen', () => {
        expect(oneShot({ play: false, pause: true }, { play: true, pause: true }, PxPlayMode.both).actions)
            .toEqual([PxDeclarativeAction.travelToStart]);
    });

    it('pause without play warns and does nothing', () => {
        const r = oneShot({ pause: true }, {});
        expect(r.actions).toEqual([]);
        expect(r.warnings.join(' ')).toContain('pause');
    });
});

describe('loop: play is a RUN switch', () => {
    it('on runs, off snaps to rest; mount with play runs (running IS the named state)', () => {
        expect(loop({ play: true }).actions).toEqual([PxDeclarativeAction.runLoop]);
        expect(loop({ play: true }, { play: false }).actions).toEqual([PxDeclarativeAction.runLoop]);
        expect(loop({ play: false }, { play: true }).actions).toEqual([PxDeclarativeAction.stopLoopNow]);
    });

    it('completeIteration: the off waits for the iteration boundary; re-on cancels the pending stop', () => {
        expect(loop({ play: false }, { play: true }, true).actions).toEqual([PxDeclarativeAction.stopLoopAtIterationEnd]);
        expect(loop({ play: true }, { play: false }, true).actions).toEqual([PxDeclarativeAction.runLoop]);
    });

    it('a mount with play and pause rests frozen; unpausing runs', () => {
        expect(loop({ play: true, pause: true }).actions).toEqual([]);
        expect(loop({ play: true, pause: false }, { play: true, pause: true }).actions).toEqual([PxDeclarativeAction.resume]);
    });

    it('an explicitly set playMode warns on a loop; the default does not', () => {
        const explicit = resolveDeclarativePlayback({
            world: PxPlaybackWorld.loop, playMode: PxPlayMode.both, playModeExplicit: true,
            completeIteration: false, next: { play: true } });
        expect(explicit.warnings.join(' ')).toContain('playMode');
        expect(loop({ play: true }).warnings).toEqual([]);
    });

    it('completeIteration on a one-shot warns', () => {
        const r = resolveDeclarativePlayback({
            world: PxPlaybackWorld.oneShot, playMode: PxPlayMode.forwards, playModeExplicit: false,
            completeIteration: true, next: { play: true } });
        expect(r.warnings.join(' ')).toContain('completeIteration');
    });
});
