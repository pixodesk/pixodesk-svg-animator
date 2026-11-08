/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// §10 (dev-docs/reviews/first-use-review.md) + D5 (dev-docs/plans/component-api.md): `play` names a
// STATE — a pose for a one-shot document, running-or-not for a looping one; `pause` freezes the clock
// only and is forcibly lifted by `play: false`. HOW an on / off is performed is the timeline's own
// (`actions.start`, `actions.stop`, `actions.finish` — jump / animate to the start or the end) and lives in ONE executor that the
// props, the trigger's event lists and the imperative api share.
import { describe, expect, it } from 'vitest';
import { PxFinishBehavior, PxStopBehavior, PxStartBehavior } from '../index';
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
    jumpToStart(): void { this.playing = false; this.time = 0; this.log.push('jumpToStart'); }
    jumpToEnd(): void { this.playing = false; this.time = this.totalMs; this.log.push('jumpToEnd'); }
    setPlaybackSpeed(rate: number): void { this.rate = rate; }
    getPlaybackSpeed(): number { return this.rate; }
    getTotalTime(): number | null { return this.time; }
    setTotalTime(ms: number): void { this.time = ms; this.log.push(`seek:${ms}`); }
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

describe('one-shot: play plays it', () => {
    it('a mount with play STARTS — a one-shot plays to its end (the pose without motion is showAtProgress)', () => {
        expect(oneShot({ play: true }).actions).toEqual([PxDeclarativeAction.start]);
        expect(oneShot({ play: true, pause: true }).actions).toEqual([PxDeclarativeAction.start, PxDeclarativeAction.pause]);
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

    it('a mount with play and pause starts and freezes at once; unpausing runs', () => {
        expect(loop({ play: true, pause: true }).actions).toEqual([PxDeclarativeAction.start, PxDeclarativeAction.pause]);
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
        expect(x.state()).toBe('idle');
    });

    it('off on a STOPPED player elsewhere than the start (the end pose) still rests it; at the start it is a no-op', () => {
        const atEnd = new FakeEngine(1000);
        atEnd.time = 1000;
        executorOf(atEnd).stop();
        expect(atEnd.log).toEqual(['jumpToStart']);
        const rewound = new FakeEngine(1000);
        rewound.time = 1000;
        executorOf(rewound, { actions: { stop: { behavior: PxStopBehavior.animateToStart } } }).stop();
        expect(rewound.rate).toBe(-1);                   // travels back from the end pose
        expect(rewound.playing).toBe(true);
        const resting = new FakeEngine(1000);
        executorOf(resting).stop();
        expect(resting.log).toEqual([]);
    });

    it('start behavior restart begins a fresh run; the default continue at the END of a one-shot is a fresh run too', () => {
        const restart = new FakeEngine(1000);
        executorOf(restart, { actions: { start: { behavior: PxStartBehavior.jumpToStart } } }).start();
        restart.frames(30);
        restart.log.length = 0;
        executorOf(restart, { actions: { start: { behavior: PxStartBehavior.jumpToStart } } }).start();
        expect(restart.log).toEqual(['jumpToStart', 'play']);
        const ended = new FakeEngine(1000);
        ended.time = 1000;
        executorOf(ended).start();
        expect(ended.log).toEqual(['jumpToStart', 'play']);
        const midway = new FakeEngine(1000);
        midway.time = 300;
        executorOf(midway).start();
        expect(midway.log).toEqual(['play']);              // resume: no reset
    });

    it('start behavior jumpToEnd shows the end pose without motion; a loop shows the end of its first pass', () => {
        const one = new FakeEngine(1000);
        executorOf(one, { actions: { start: { behavior: PxStartBehavior.jumpToEnd } } }).start();
        expect(one.log).toEqual(['jumpToEnd']);
        expect(one.time).toBe(1000);
        const endless = new FakeEngine(Infinity);
        executorOf(endless, { actions: { start: { behavior: PxStartBehavior.jumpToEnd } } }).start();
        expect(endless.log).toEqual(['pause', 'seek:1000']);
    });

    it('stop behavior rewind plays back to the start; a loop rewinds the iteration it is in, then rests', () => {
        const one = new FakeEngine(1000);
        const x = executorOf(one, { actions: { stop: { behavior: PxStopBehavior.animateToStart } } });
        x.start();
        one.frames(30);
        x.stop();
        expect(one.rate).toBe(-1);
        expect(one.playing).toBe(true);
        one.frames(40);
        expect(one.time).toBe(0);
        expect(one.playing).toBe(false);

        const endless = new FakeEngine(Infinity);
        const y = executorOf(endless, { actions: { stop: { behavior: PxStopBehavior.animateToStart } } });
        y.start();
        endless.frames(130);
        expect(endless.time).toBe(1300);
        y.stop();
        endless.frames(25);
        expect(endless.playing).toBe(true);                // still on its way back to 1000
        endless.frames(10);
        expect(endless.log.at(-1)).toBe('jumpToStart');   // rested at the iteration's start
        expect(endless.playing).toBe(false);
        expect(endless.rate).toBe(1);
    });

    it('stop animateToEnd on a loop plays on to the pass end, then finish (jumpToStart rests); an on before it cancels the pending stop', () => {
        const e = new FakeEngine(Infinity);
        const x = executorOf(e, { actions: { stop: 'animateToEnd', finish: 'jumpToStart' } });
        x.start();
        e.frames(30);
        x.stop();
        expect(e.playing).toBe(true);
        e.frames(60);
        expect(e.playing).toBe(true);                      // 900: not yet
        e.frames(15);
        expect(e.playing).toBe(false);                     // the boundary reached → finish: jumpToStart
        expect(e.time).toBe(0);

        x.start();
        e.frames(30);
        x.stop();
        x.start();                                            // takes the pending off back
        e.frames(100);
        expect(e.playing).toBe(true);
        expect(e.time).toBe(1300);
    });

    it('stop animateToEnd on a one-shot completes the run, THEN finish runs — animateToStart included', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { stop: 'animateToEnd', finish: PxFinishBehavior.animateToStart } });
        x.start();
        e.frames(30);
        x.stop();
        e.frames(70);
        expect(e.time).toBe(1000);                         // ran to the end first…
        e.frame(10);
        expect(e.rate).toBe(-1);                           // …then the finish played back
        expect(e.playing).toBe(true);
        e.frames(110);
        expect(e.time).toBe(0);
        expect(e.playing).toBe(false);
    });

    it('pause / resume own the PAUSED state the engines cannot tell apart; play() resumes a pause, jumpToStart() is the hard jump', () => {
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
        x.jumpToStart();
        expect(x.state()).toBe('idle');
        expect(e.time).toBe(0);
    });

    it('onNaturalFinish performs actions.finish: hold leaves the end pose, jumpToStart rests at the start, animateToStart plays back then rests', () => {
        const hold = new FakeEngine(1000);
        hold.time = 1000;
        executorOf(hold).onNaturalFinish();
        expect(hold.log).toEqual([]);
        const reset = new FakeEngine(1000);
        reset.time = 1000;
        executorOf(reset, { actions: { finish: { behavior: PxFinishBehavior.jumpToStart } } }).onNaturalFinish();
        expect(reset.log).toEqual(['jumpToStart']);
        const rewind = new FakeEngine(1000);
        rewind.time = 1000;
        const x = executorOf(rewind, { actions: { finish: { behavior: PxFinishBehavior.animateToStart } } });
        x.onNaturalFinish();
        expect(rewind.rate).toBe(-1);
        expect(rewind.playing).toBe(true);
        rewind.frames(100);
        expect(rewind.time).toBe(0);                     // the engine announces this end too…
        x.onNaturalFinish();
        expect(rewind.rate).toBe(1);                     // …which rests it, forward again
        expect(rewind.log.at(-1)).toBe('jumpToStart');
    });

    it('applyDeclarativeAction maps the four verbs onto the public api — play / pause / stop', () => {
        const calls: Array<string> = [];
        const api = { play: () => calls.push('play'), pause: () => calls.push('pause'), stop: () => calls.push('stop') };
        for (const action of [PxDeclarativeAction.start, PxDeclarativeAction.pause, PxDeclarativeAction.resume, PxDeclarativeAction.stop]) {
            applyDeclarativeAction(api, action);
        }
        expect(calls).toEqual(['play', 'pause', 'play', 'stop']);
    });

    it('a finished one-shot is FINISHED, not idle: a stop still acts on it (animateToStart from the end), a start is a fresh run', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { stop: 'animateToStart' } });
        const stops: Array<string> = [];
        x.setOnStop(() => stops.push('stop'));
        x.start();
        e.frames(110);
        expect(e.time).toBe(1000);
        expect(x.state()).toBe('finished');
        x.stop();                                          // the lid: hover out after it opened fully
        expect(stops).toEqual(['stop']);
        expect(e.rate).toBe(-1);
        e.frames(110);
        expect(e.time).toBe(0);
        expect(x.state()).toBe('idle');
        x.start();
        e.frames(110);
        expect(x.state()).toBe('finished');
        x.pause();                                         // not a stop: onStop is not told
        expect(stops).toEqual(['stop']);
        x.start();                                         // from finished: a fresh run from the beginning
        expect(e.log.at(-2)).toBe('jumpToStart');
        expect(e.playing).toBe(true);
    });
});

describe('the action model: jump / animate to the start or the end; arriving at the end runs finish (1.23)', () => {
    it('stop jumpToEnd on a one-shot: the engine\'s jump, onStop at once, and the engine\'s finish runs actions.finish', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { stop: 'jumpToEnd', finish: 'jumpToStart' } });
        const stops: Array<string> = [];
        x.setOnStop(() => stops.push('stop'));
        x.start();
        e.frames(30);
        x.stop();
        expect(e.log.at(-1)).toBe('jumpToEnd');
        expect(e.time).toBe(1000);
        expect(stops).toEqual(['stop']);
        x.onNaturalFinish();                                  // what the engine reports after its jump
        expect(e.time).toBe(0);                               // finish: jumpToStart
        expect(x.state()).toBe('idle');
    });

    it('stop jumpToEnd on a loop holds on the end of the CURRENT pass, FINISHED; finish hold is the default', () => {
        const e = new FakeEngine(Infinity);
        const x = executorOf(e, { actions: { stop: 'jumpToEnd' } });
        x.start();
        e.frames(130);
        x.stop();
        expect(e.time).toBe(2000);
        expect(e.playing).toBe(false);
        expect(x.state()).toBe('finished');
        x.stop();                                             // already at the end: nothing to do
        expect(e.time).toBe(2000);
        x.start();                                            // continue: plays on from there
        e.frames(10);
        expect(e.time).toBe(2100);
    });

    it('stop animateToEnd on a loop with finish hold rests on the pass end, FINISHED; while on its way it reads IDLE', () => {
        const e = new FakeEngine(Infinity);
        const x = executorOf(e, { actions: { stop: 'animateToEnd' } });
        const stops: Array<string> = [];
        x.setOnStop(() => stops.push('stop'));
        x.start();
        e.frames(30);
        x.stop();
        expect(x.state()).toBe('idle');                       // a move in flight — a start event turns it around
        expect(stops).toEqual([]);                            // told on arrival
        e.frames(80);
        expect(e.time).toBe(1000);
        expect(e.playing).toBe(false);
        expect(x.state()).toBe('finished');
        expect(stops).toEqual(['stop']);
    });

    it('stop animateToEnd on a PAUSED run resumes it and plays there', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { stop: 'animateToEnd' } });
        x.start();
        e.frames(30);
        x.pause();
        x.stop();
        expect(e.playing).toBe(true);
        e.frames(80);
        expect(e.time).toBe(1000);
        expect(x.state()).toBe('finished');
    });

    it('a one-shot animateToEnd arrives with the engine\'s natural end even when the time read never shows the end', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { stop: 'animateToEnd', finish: 'jumpToStart' } });
        const stops: Array<string> = [];
        x.setOnStop(() => stops.push('stop'));
        x.start();
        e.frames(30);
        x.stop();
        x.onNaturalFinish();                                  // an engine whose clock already reverted (fill none)
        expect(stops).toEqual(['stop']);
        expect(e.time).toBe(0);
        e.frames(5);
        expect(stops).toEqual(['stop']);                      // told once
    });

    it('start jumpToStart (was restart) always plays from the beginning', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { start: PxStartBehavior.jumpToStart } });
        x.start();
        e.frames(30);
        x.pause();
        e.log.length = 0;
        x.start();
        expect(e.log).toEqual(['jumpToStart', 'play']);
    });
});

describe('composeApiExtras — the public api on top of the same executor', () => {
    it('play() / pause() / stop() / jumpToStart() go through ONE executor, reused by every later composition', () => {
        const e = new FakeEngine(2000);
        const api = composeApiExtras(e, { duration: 1000, iterations: 2, actions: { stop: { behavior: PxStopBehavior.animateToStart } } }, e.raf);
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
        api.jumpToStart();
        expect(api.playExecutor.state()).toBe('idle');
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
        composeApiExtras(reset, { duration: 1000, iterations: 'infinite', actions: { finish: { behavior: PxFinishBehavior.jumpToStart } } }, reset.raf).playOnce();
        reset.frames(105);
        expect(reset.time).toBe(0);
        expect(reset.playing).toBe(false);
    });
});
