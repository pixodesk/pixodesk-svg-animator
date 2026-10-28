/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// §10 (dev-docs/reviews/first-use-review.md) + D5 (dev-docs/plans/component-api.md): `play` names a
// STATE — a pose for a one-shot document, running-or-not for a looping one; `pause` freezes the clock
// only and is forcibly lifted by `play: false`. HOW an on / off is performed is the timeline's own
// (`actions.start`, `actions.stop` and its `completeIteration`) and lives in ONE executor that the
// props, the trigger's event lists and the imperative api share.
import { describe, expect, it } from 'vitest';
import { PxFinishTransition, PxStopTransition, PxStartTransition } from '../index';
import {
    PxDeclarativeAction,
    PxPlaybackWorld,
    applyDeclarativeAction,
    composeApiExtras,
    createPlayExecutor,
    resolveDeclarativePlayback,
    resolvePlaybackWorld,
    type PxPlayExecutorConfig,
    type PxPlayTarget,
} from '../engine';

type Props = { play?: boolean; pause?: boolean };
const oneShot = (next: Props, prev?: Props) => resolveDeclarativePlayback({ world: PxPlaybackWorld.oneShot, prev, next });
const loop = (next: Props, prev?: Props) => resolveDeclarativePlayback({ world: PxPlaybackWorld.loop, prev, next });

/** A clock-model engine: time advances by `rate` per ms while playing and stops at either end of the run. */
class FakeEngine implements PxPlayTarget {
    playing = false;
    time = 0;
    rate = 1;
    log: Array<string> = [];
    private readonly rafQueue: Array<() => void> = [];
    constructor(readonly totalMs: number) {}
    play(): void { this.playing = true; this.log.push('play'); }
    pause(): void { this.playing = false; this.log.push('pause'); }
    cancel(): void { this.playing = false; this.time = 0; this.log.push('cancel'); }
    finish(): void { this.playing = false; this.time = this.totalMs; this.log.push('finish'); }
    setPlaybackRate(rate: number): void { this.rate = rate; }
    getCurrentTime(): number | null { return this.time; }
    setCurrentTime(ms: number): void { this.time = ms; this.log.push(`seek:${ms}`); }
    isPlaying(): boolean { return this.playing; }
    readonly raf = (cb: () => void): void => { this.rafQueue.push(cb); };
    /** One frame of `ms`: the clock moves, then the queued rAF callbacks run (a re-queued one waits for the next frame). */
    frame(ms: number): void {
        if (this.playing) {
            this.time += this.rate * ms;
            if (this.time >= this.totalMs) { this.time = this.totalMs; this.playing = false; }
            if (this.time <= 0 && this.rate < 0) { this.time = 0; this.playing = false; }
        }
        for (const cb of this.rafQueue.splice(0)) cb();
    }
    frames(count: number, ms = 10): void { for (let i = 0; i < count; i++) this.frame(ms); }
}

const executorOf = (engine: FakeEngine, cfg: Partial<PxPlayExecutorConfig> = {}) =>
    createPlayExecutor(engine, { passMs: 1000, totalMs: engine.totalMs, ...cfg }, engine.raf);

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

    it("a change asks for the configured on and off — HOW is the timeline's, never the prop's", () => {
        expect(oneShot({ play: true }, { play: false }).actions).toEqual([PxDeclarativeAction.start]);
        expect(oneShot({ play: false }, { play: true }).actions).toEqual([PxDeclarativeAction.stop]);
    });

    it('pause freezes the clock while play is true, and resumes toward the current target', () => {
        expect(oneShot({ play: true, pause: true }, { play: true }).actions).toEqual([PxDeclarativeAction.pause]);
        expect(oneShot({ play: true, pause: false }, { play: true, pause: true }).actions).toEqual([PxDeclarativeAction.resume]);
        // a retarget while frozen: the on starts, then freezes again — the clock stays held
        expect(oneShot({ play: true, pause: true }, { play: false, pause: true }).actions)
            .toEqual([PxDeclarativeAction.start, PxDeclarativeAction.pause]);
    });

    it('play: false forcibly unfreezes — the off happens as if nothing had been frozen', () => {
        expect(oneShot({ play: false, pause: true }, { play: true, pause: true }).actions).toEqual([PxDeclarativeAction.stop]);
    });

    it('pause without play warns and does nothing', () => {
        const r = oneShot({ pause: true }, {});
        expect(r.actions).toEqual([]);
        expect(r.warnings.join(' ')).toContain('pause');
    });
});

describe('loop: play is a RUN switch', () => {
    it('on runs, off stops; mount with play runs (running IS the named state)', () => {
        expect(loop({ play: true }).actions).toEqual([PxDeclarativeAction.start]);
        expect(loop({ play: true }, { play: false }).actions).toEqual([PxDeclarativeAction.start]);
        expect(loop({ play: false }, { play: true }).actions).toEqual([PxDeclarativeAction.stop]);
    });

    it('a mount with play and pause rests frozen; unpausing runs', () => {
        expect(loop({ play: true, pause: true }).actions).toEqual([]);
        expect(loop({ play: true, pause: false }, { play: true, pause: true }).actions).toEqual([PxDeclarativeAction.resume]);
    });
});

describe("the executor performs the timeline's play keys on any engine", () => {
    it('the defaults: on plays from where it is, off resets to the start pose at once', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e);
        x.start();
        expect(e.playing).toBe(true);
        e.frames(30);
        expect(e.time).toBe(300);
        x.stop();
        expect(e.playing).toBe(false);
        expect(e.time).toBe(0);
        expect(x.state()).toBe('stopped');
    });

    it('off on a STOPPED player elsewhere than the start (the end pose) still rests it; at the start it is a no-op', () => {
        const atEnd = new FakeEngine(1000);
        atEnd.time = 1000;
        executorOf(atEnd).stop();
        expect(atEnd.log).toEqual(['cancel']);
        const rewound = new FakeEngine(1000);
        rewound.time = 1000;
        executorOf(rewound, { actions: { stop: { transition: PxStopTransition.rewind } } }).stop();
        expect(rewound.rate).toBe(-1);                   // travels back from the end pose
        expect(rewound.playing).toBe(true);
        const resting = new FakeEngine(1000);
        executorOf(resting).stop();
        expect(resting.log).toEqual([]);
    });

    it('start transition restart begins a fresh run; the default continue at the END of a one-shot is a fresh run too', () => {
        const restart = new FakeEngine(1000);
        executorOf(restart, { actions: { start: { transition: PxStartTransition.restart } } }).start();
        restart.frames(30);
        restart.log.length = 0;
        executorOf(restart, { actions: { start: { transition: PxStartTransition.restart } } }).start();
        expect(restart.log).toEqual(['cancel', 'play']);
        const ended = new FakeEngine(1000);
        ended.time = 1000;
        executorOf(ended).start();
        expect(ended.log).toEqual(['cancel', 'play']);
        const midway = new FakeEngine(1000);
        midway.time = 300;
        executorOf(midway).start();
        expect(midway.log).toEqual(['play']);              // resume: no reset
    });

    it('start transition jumpToFinished shows the end pose without motion; a loop shows the end of its first pass', () => {
        const one = new FakeEngine(1000);
        executorOf(one, { actions: { start: { transition: PxStartTransition.jumpToFinished } } }).start();
        expect(one.log).toEqual(['finish']);
        expect(one.time).toBe(1000);
        const endless = new FakeEngine(Infinity);
        executorOf(endless, { actions: { start: { transition: PxStartTransition.jumpToFinished } } }).start();
        expect(endless.log).toEqual(['pause', 'seek:1000']);
    });

    it('stop transition rewind plays back to the start; a loop rewinds the iteration it is in, then rests', () => {
        const one = new FakeEngine(1000);
        const x = executorOf(one, { actions: { stop: { transition: PxStopTransition.rewind } } });
        x.start();
        one.frames(30);
        x.stop();
        expect(one.rate).toBe(-1);
        expect(one.playing).toBe(true);
        one.frames(40);
        expect(one.time).toBe(0);
        expect(one.playing).toBe(false);

        const endless = new FakeEngine(Infinity);
        const y = executorOf(endless, { actions: { stop: { transition: PxStopTransition.rewind } } });
        y.start();
        endless.frames(130);
        expect(endless.time).toBe(1300);
        y.stop();
        endless.frames(25);
        expect(endless.playing).toBe(true);                // still on its way back to 1000
        endless.frames(10);
        expect(endless.log.at(-1)).toBe('cancel');         // rested at the iteration's start
        expect(endless.playing).toBe(false);
        expect(endless.rate).toBe(1);
    });

    it('stop completeIteration: the off waits for the iteration boundary; an on before it cancels the pending stop', () => {
        const e = new FakeEngine(Infinity);
        const x = executorOf(e, { actions: { stop: { completeIteration: true } } });
        x.start();
        e.frames(30);
        x.stop();
        expect(e.playing).toBe(true);
        e.frames(60);
        expect(e.playing).toBe(true);                      // 900: not yet
        e.frames(15);
        expect(e.playing).toBe(false);                     // the boundary passed → the off
        expect(e.time).toBe(0);

        x.start();
        e.frames(30);
        x.stop();
        x.start();                                            // takes the pending off back
        e.frames(100);
        expect(e.playing).toBe(true);
        expect(e.time).toBe(1300);
    });

    it('stop completeIteration on a one-shot completes the run, THEN performs the off — rewind included', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { stop: { completeIteration: true, transition: PxStopTransition.rewind } } });
        x.start();
        e.frames(30);
        x.stop();
        e.frames(70);
        expect(e.time).toBe(1000);                         // ran to the end first…
        e.frame(10);
        expect(e.rate).toBe(-1);                           // …then the rewind started
        expect(e.playing).toBe(true);
        e.frames(110);
        expect(e.time).toBe(0);
        expect(e.playing).toBe(false);
    });

    it('pause / resume own the PAUSED state the engines cannot tell apart; play() resumes a pause, cancel() is the hard reset', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e);
        x.start();
        e.frames(30);
        x.pause();
        expect(x.state()).toBe('paused');
        expect(e.time).toBe(300);
        x.resume();
        expect(x.state()).toBe('playing');
        x.pause();
        e.log.length = 0;
        x.play();
        expect(e.log).toEqual(['play']);                   // a resume, not a restart
        expect(e.time).toBe(300);
        x.cancel();
        expect(x.state()).toBe('stopped');
        expect(e.time).toBe(0);
    });

    it('onNaturalFinish performs actions.finish: hold leaves the end pose, reset rests at the start, rewind plays back then rests', () => {
        const hold = new FakeEngine(1000);
        hold.time = 1000;
        executorOf(hold).onNaturalFinish();
        expect(hold.log).toEqual([]);
        const reset = new FakeEngine(1000);
        reset.time = 1000;
        executorOf(reset, { actions: { finish: { transition: PxFinishTransition.reset } } }).onNaturalFinish();
        expect(reset.log).toEqual(['cancel']);
        const rewind = new FakeEngine(1000);
        rewind.time = 1000;
        const x = executorOf(rewind, { actions: { finish: { transition: PxFinishTransition.rewind } } });
        x.onNaturalFinish();
        expect(rewind.rate).toBe(-1);
        expect(rewind.playing).toBe(true);
        rewind.frames(100);
        expect(rewind.time).toBe(0);                     // the engine announces this end too…
        x.onNaturalFinish();
        expect(rewind.rate).toBe(1);                     // …which rests it, forward again
        expect(rewind.log.at(-1)).toBe('cancel');
    });

    it('applyDeclarativeAction maps the five verbs onto the public api — play / pause / stop / a seek for the mount pose', () => {
        const calls: Array<string> = [];
        const api = {
            play: () => calls.push('play'), pause: () => calls.push('pause'), stop: () => calls.push('stop'),
            setCurrentTime: (ms: number) => calls.push(`seek:${ms}`),
        };
        for (const action of [PxDeclarativeAction.showEnd, PxDeclarativeAction.start, PxDeclarativeAction.pause, PxDeclarativeAction.resume, PxDeclarativeAction.stop]) {
            applyDeclarativeAction(api, action, 1000);
        }
        expect(calls).toEqual(['seek:1000', 'play', 'pause', 'play', 'stop']);
    });
});

describe('composeApiExtras — the public api on top of the same executor', () => {
    it('play() / pause() / stop() / cancel() go through ONE executor, reused by every later composition', () => {
        const e = new FakeEngine(2000);
        const api = composeApiExtras(e, { duration: 1000, iterations: 2, actions: { stop: { transition: PxStopTransition.rewind } } }, e.raf);
        api.play();
        e.frames(30);
        api.pause();
        expect(api.playExecutor.state()).toBe('paused');
        e.log.length = 0;
        api.play();
        expect(e.log).toEqual(['play']);                   // the state rule: a pause resumes
        api.stop();
        expect(e.rate).toBe(-1);                           // the configured off
        e.frames(40);
        expect(e.time).toBe(0);
        api.cancel();
        expect(api.playExecutor.state()).toBe('stopped');
        expect(api.getDuration()).toBe(1000);
        expect(composeApiExtras(e, { duration: 1000 }, e.raf).playExecutor).toBe(api.playExecutor);
    });

    it('playOnce runs ONE pass of a multi-pass document and settles at the end of that pass', () => {
        const hold = new FakeEngine(Infinity);
        composeApiExtras(hold, { duration: 1000, iterations: 'infinite' }, hold.raf).playOnce();
        hold.frames(105);
        expect(hold.time).toBe(1000);
        expect(hold.playing).toBe(false);
        const reset = new FakeEngine(Infinity);
        composeApiExtras(reset, { duration: 1000, iterations: 'infinite', actions: { finish: { transition: PxFinishTransition.reset } } }, reset.raf).playOnce();
        reset.frames(105);
        expect(reset.time).toBe(0);
        expect(reset.playing).toBe(false);
    });
});
