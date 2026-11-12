/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// §10 (dev-docs/reviews/first-use-review.md) + D5 (dev-docs/plans/component-api.md) + the playback model
// (dev-docs/plans/animation-state.brainstorm.md): `playback` names the lever's POSITION — `off` · `on` · `paused`; a
// change between two positions presses one or two of the four buttons. HOW a button moves the playhead is the
// timeline's own (`actions["playback.start"]`, `actions["playback.stop"]`, `atEnd` — jump / animate to the start or the end) and lives in
// ONE executor that the prop, the trigger's event lists and the imperative api share.
import { describe, expect, it } from 'vitest';
import { PxAtEndBehavior, PxStopPlaybackBehavior, PxStartPlaybackBehavior, PxPlayback, type PxPlaybackListeners } from '../index';
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

type Props = { playback?: PxPlayback };
const oneShot = (next: Props, prev?: Props) => resolveDeclarativePlayback({ world: PxPlaybackWorld.oneShot, prev, next });
const loop = (next: Props, prev?: Props) => resolveDeclarativePlayback({ world: PxPlaybackWorld.loop, prev, next });

/** A clock-model engine: time advances by `rate` per ms while playing and stops at either end of the playback. */
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

/** A listener set that writes every playback event into `events`. */
const listening = (events: Array<string>): PxPlaybackListeners => ({
    onPlaybackStart: () => events.push('playbackStart'),
    onPlaybackStop: () => events.push('playbackStop'),
    onPlaybackPause: () => events.push('playbackPause'),
    onPlaybackResume: () => events.push('playbackResume'),
});

describe('the playback world', () => {
    it('splits on the effective iterations', () => {
        expect(resolvePlaybackWorld(undefined)).toBe(PxPlaybackWorld.oneShot);
        expect(resolvePlaybackWorld(1)).toBe(PxPlaybackWorld.oneShot);
        expect(resolvePlaybackWorld(2)).toBe(PxPlaybackWorld.loop);
        expect(resolvePlaybackWorld('infinite')).toBe(PxPlaybackWorld.loop);
    });
});

describe('one-shot: playback names the position', () => {
    it('a mount with "on" STARTS — a one-shot plays to its end (the pose without motion is showAtProgress); "paused" starts it frozen', () => {
        expect(oneShot({ playback: 'on' }).actions).toEqual([PxDeclarativeAction.startPlayback]);
        expect(oneShot({ playback: 'paused' }).actions).toEqual([PxDeclarativeAction.startPlayback, PxDeclarativeAction.pausePlayback]);
        expect(oneShot({ playback: 'off' }).actions).toEqual([]);
        expect(oneShot({}).actions).toEqual([]);
    });

    it("a change asks for the configured on and off — HOW is the timeline's, never the prop's", () => {
        expect(oneShot({ playback: 'on' }, { playback: 'off' }).actions).toEqual([PxDeclarativeAction.startPlayback]);
        expect(oneShot({ playback: 'off' }, { playback: 'on' }).actions).toEqual([PxDeclarativeAction.stopPlayback]);
        expect(oneShot({ playback: 'on' }, { playback: 'on' }).actions).toEqual([]);
    });

    it('"paused" freezes the clock inside a playback, and "on" resumes toward the current target', () => {
        expect(oneShot({ playback: 'paused' }, { playback: 'on' }).actions).toEqual([PxDeclarativeAction.pausePlayback]);
        expect(oneShot({ playback: 'on' }, { playback: 'paused' }).actions).toEqual([PxDeclarativeAction.resumePlayback]);
        // a retarget from off while frozen is asked for: the playback starts, then freezes again — the clock stays held
        expect(oneShot({ playback: 'paused' }, { playback: 'off' }).actions)
            .toEqual([PxDeclarativeAction.startPlayback, PxDeclarativeAction.pausePlayback]);
    });

    it('"off" from "paused" stops — the off happens as if nothing had been frozen', () => {
        expect(oneShot({ playback: 'off' }, { playback: 'paused' }).actions).toEqual([PxDeclarativeAction.stopPlayback]);
    });

    it('the prop appearing as "off" on a later render stops; a mount with "off" does not (no playback to stop)', () => {
        expect(oneShot({ playback: 'off' }, {}).actions).toEqual([PxDeclarativeAction.stopPlayback]);
        expect(oneShot({ playback: 'off' }).actions).toEqual([]);
    });
});

describe('loop: the playback switch', () => {
    it('on runs, off stops; mount with "on" runs (running IS the named state)', () => {
        expect(loop({ playback: 'on' }).actions).toEqual([PxDeclarativeAction.startPlayback]);
        expect(loop({ playback: 'on' }, { playback: 'off' }).actions).toEqual([PxDeclarativeAction.startPlayback]);
        expect(loop({ playback: 'off' }, { playback: 'on' }).actions).toEqual([PxDeclarativeAction.stopPlayback]);
    });

    it('a mount with "paused" starts and freezes at once; unpausing runs', () => {
        expect(loop({ playback: 'paused' }).actions).toEqual([PxDeclarativeAction.startPlayback, PxDeclarativeAction.pausePlayback]);
        expect(loop({ playback: 'on' }, { playback: 'paused' }).actions).toEqual([PxDeclarativeAction.resumePlayback]);
    });
});

describe("the executor performs the timeline's play keys on any engine", () => {
    it('the defaults: on plays from where it is, off resets to the start pose at once', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e);
        x.startPlayback();
        expect(e.playing).toBe(true);
        e.frames(30);
        expect(e.time).toBe(300);
        x.stopPlayback();
        expect(e.playing).toBe(false);
        expect(e.time).toBe(0);
        expect(x.state()).toBe('off');
    });

    it('off on a STOPPED player elsewhere than the start (the end pose) still rests it; at the start it is a no-op', () => {
        const atEnd = new FakeEngine(1000);
        atEnd.time = 1000;
        executorOf(atEnd).stopPlayback();
        expect(atEnd.log).toEqual(['jumpToStart']);
        const rewound = new FakeEngine(1000);
        rewound.time = 1000;
        executorOf(rewound, { actions: { 'playback.stop': { behavior: PxStopPlaybackBehavior.animateToStart } } }).stopPlayback();
        expect(rewound.rate).toBe(-1);                   // travels back from the end pose
        expect(rewound.playing).toBe(true);
        const resting = new FakeEngine(1000);
        executorOf(resting).stopPlayback();
        expect(resting.log).toEqual([]);
    });

    it('start behavior jumpToStart begins a fresh playback; the default continue at the END of a one-shot is a fresh playback too', () => {
        const restart = new FakeEngine(1000);
        executorOf(restart, { actions: { 'playback.start': { behavior: PxStartPlaybackBehavior.jumpToStart } } }).startPlayback();
        restart.frames(30);
        restart.log.length = 0;
        executorOf(restart, { actions: { 'playback.start': { behavior: PxStartPlaybackBehavior.jumpToStart } } }).startPlayback();
        expect(restart.log).toEqual(['jumpToStart', 'play']);
        const ended = new FakeEngine(1000);
        ended.time = 1000;
        executorOf(ended).startPlayback();
        expect(ended.log).toEqual(['jumpToStart', 'play']);
        const midway = new FakeEngine(1000);
        midway.time = 300;
        executorOf(midway).startPlayback();
        expect(midway.log).toEqual(['play']);              // continue: no reset
    });

    it('start behavior jumpToEnd shows the end pose without motion; a loop shows the end of its first pass', () => {
        const one = new FakeEngine(1000);
        executorOf(one, { actions: { 'playback.start': { behavior: PxStartPlaybackBehavior.jumpToEnd } } }).startPlayback();
        expect(one.log).toEqual(['jumpToEnd']);
        expect(one.time).toBe(1000);
        const endless = new FakeEngine(Infinity);
        executorOf(endless, { actions: { 'playback.start': { behavior: PxStartPlaybackBehavior.jumpToEnd } } }).startPlayback();
        expect(endless.log).toEqual(['pause', 'seek:1000']);
    });

    it('stop behavior animateToStart plays back to the start (the RETURNING state); a loop plays back the iteration it is in, then rests', () => {
        const one = new FakeEngine(1000);
        const x = executorOf(one, { actions: { 'playback.stop': { behavior: PxStopPlaybackBehavior.animateToStart } } });
        x.startPlayback();
        one.frames(30);
        x.stopPlayback();
        expect(one.rate).toBe(-1);
        expect(one.playing).toBe(true);
        expect(x.state()).toBe('returning');
        one.frames(40);
        expect(one.time).toBe(0);
        expect(one.playing).toBe(false);
        x.onNaturalFinish();                               // the engine announces the leg's end
        expect(x.state()).toBe('off');

        const endless = new FakeEngine(Infinity);
        const y = executorOf(endless, { actions: { 'playback.stop': { behavior: PxStopPlaybackBehavior.animateToStart } } });
        y.startPlayback();
        endless.frames(130);
        expect(endless.time).toBe(1300);
        y.stopPlayback();
        endless.frames(25);
        expect(endless.playing).toBe(true);                // still on its way back to 1000
        expect(y.state()).toBe('returning');
        endless.frames(10);
        expect(endless.log.at(-1)).toBe('jumpToStart');   // rested at the iteration's start
        expect(endless.playing).toBe(false);
        expect(endless.rate).toBe(1);
        expect(y.state()).toBe('off');
    });

    it('a RETURNING playback turns around on startPlayback, and ignores stopPlayback / pausePlayback / resumePlayback', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { 'playback.stop': 'animateToStart' } });
        const events: Array<string> = [];
        x.setListeners(listening(events));
        x.startPlayback();
        e.frames(50);
        x.stopPlayback();
        expect(x.state()).toBe('returning');
        x.pausePlayback();
        x.resumePlayback();
        x.stopPlayback();
        expect(e.playing).toBe(true);
        expect(e.rate).toBe(-1);
        expect(events).toEqual(['playbackStart', 'playbackStop']);
        e.frames(20);
        x.startPlayback();                                      // the hover-in during the hover-out leg
        expect(e.rate).toBe(1);
        expect(e.playing).toBe(true);
        expect(x.state()).toBe('playing');
        expect(events).toEqual(['playbackStart', 'playbackStop', 'playbackStart']);
    });

    it('stop animateToEnd on a loop plays on to the pass end, then atEnd (jumpToStart rests); an on before it cancels the pending stop', () => {
        const e = new FakeEngine(Infinity);
        const x = executorOf(e, { actions: { 'playback.stop': 'animateToEnd' }, atEnd: 'jumpToStart' });
        x.startPlayback();
        e.frames(30);
        x.stopPlayback();
        expect(e.playing).toBe(true);
        e.frames(60);
        expect(e.playing).toBe(true);                      // 900: not yet
        e.frames(15);
        expect(e.playing).toBe(false);                     // the boundary reached → atEnd: jumpToStart
        expect(e.time).toBe(0);

        x.startPlayback();
        e.frames(30);
        x.stopPlayback();
        x.startPlayback();                                         // takes the pending off back
        e.frames(100);
        expect(e.playing).toBe(true);
        expect(e.time).toBe(1300);
    });

    it('stop animateToEnd on a one-shot completes the playback, THEN atEnd runs — animateToStart included', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { 'playback.stop': 'animateToEnd' }, atEnd: PxAtEndBehavior.animateToStart });
        x.startPlayback();
        e.frames(30);
        x.stopPlayback();
        e.frames(70);
        expect(e.time).toBe(1000);                         // ran to the end first…
        e.frame(10);
        expect(e.rate).toBe(-1);                           // …then atEnd played back
        expect(e.playing).toBe(true);
        e.frames(110);
        expect(e.time).toBe(0);
        expect(e.playing).toBe(false);
    });

    it('pausePlayback / resumePlayback own the PAUSED state the engines cannot tell apart; a start (continue) resumes a pause, jumpToStart() is the hard jump', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e);
        x.startPlayback();
        e.frames(30);
        x.pausePlayback();
        expect(x.state()).toBe('paused');
        expect(e.time).toBe(300);
        x.resumePlayback();
        expect(x.state()).toBe('playing');
        x.pausePlayback();
        e.log.length = 0;
        x.startPlayback();                                 // `continue` on a paused playback (the `play()` alias until 1.25)
        expect(e.log).toEqual(['play']);                   // a resume, not a restart
        expect(e.time).toBe(300);
        x.jumpToStart();
        expect(x.state()).toBe('off');
        expect(e.time).toBe(0);
    });

    it('onNaturalFinish performs atEnd: hold leaves the end pose, jumpToStart rests at the start, animateToStart plays back then rests', () => {
        const hold = new FakeEngine(1000);
        hold.time = 1000;
        executorOf(hold).onNaturalFinish();
        expect(hold.log).toEqual([]);
        const reset = new FakeEngine(1000);
        reset.time = 1000;
        executorOf(reset, { atEnd: PxAtEndBehavior.jumpToStart }).onNaturalFinish();
        expect(reset.log).toEqual(['jumpToStart']);
        const rewind = new FakeEngine(1000);
        rewind.time = 1000;
        const x = executorOf(rewind, { atEnd: PxAtEndBehavior.animateToStart });
        x.onNaturalFinish();
        expect(rewind.rate).toBe(-1);
        expect(rewind.playing).toBe(true);
        expect(x.state()).toBe('returning');
        rewind.frames(100);
        expect(rewind.time).toBe(0);                     // the engine announces this end too…
        x.onNaturalFinish();
        expect(rewind.rate).toBe(1);                     // …which rests it, forward again
        expect(rewind.log.at(-1)).toBe('jumpToStart');
    });

    it('applyDeclarativeAction maps the four buttons onto the public `playback`', () => {
        const calls: Array<string> = [];
        const api = {
            start: () => calls.push('startPlayback'), stop: () => calls.push('stopPlayback'),
            pause: () => calls.push('pausePlayback'), resume: () => calls.push('resumePlayback'),
        };
        for (const action of [PxDeclarativeAction.startPlayback, PxDeclarativeAction.pausePlayback, PxDeclarativeAction.resumePlayback, PxDeclarativeAction.stopPlayback]) {
            applyDeclarativeAction(api, action);
        }
        expect(calls).toEqual(['startPlayback', 'pausePlayback', 'resumePlayback', 'stopPlayback']);
    });

    it('a finished one-shot is FINISHED, not off: a stop still acts on it (animateToStart from the end), a start is a fresh playback', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { 'playback.stop': 'animateToStart' } });
        const events: Array<string> = [];
        x.setListeners(listening(events));
        x.startPlayback();
        e.frames(110);
        expect(e.time).toBe(1000);
        expect(x.state()).toBe('finished');
        x.stopPlayback();                                       // the lid: hover out after it opened fully
        expect(events).toEqual(['playbackStart', 'playbackStop']);
        expect(e.rate).toBe(-1);
        e.frames(110);
        expect(e.time).toBe(0);
        x.onNaturalFinish();
        expect(x.state()).toBe('off');
        x.startPlayback();
        e.frames(110);
        expect(x.state()).toBe('finished');
        x.pausePlayback();                                      // nothing to freeze on a finished run: not told
        expect(events).toEqual(['playbackStart', 'playbackStop', 'playbackStart']);
        x.startPlayback();                                      // from finished: a fresh playback from the beginning
        expect(e.log.at(-2)).toBe('jumpToStart');
        expect(e.playing).toBe(true);
    });

    it('the playback events are told when the act is performed — never for the engine\'s own pause (the gate\'s hold) or a no-op press', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e);
        const events: Array<string> = [];
        x.setListeners(listening(events));
        x.startPlayback();
        x.startPlayback();                                      // continue while playing: nothing changed, nothing told
        e.frames(10);
        e.pause();                                         // the engine's raw pause — the gate's hold
        expect(events).toEqual(['playbackStart']);
        e.play();                                          // the gate's release
        x.pausePlayback();
        x.pausePlayback();                                      // already paused: not told twice
        x.resumePlayback();
        x.resumePlayback();
        x.pausePlayback();
        x.startPlayback();                                 // `continue` on a paused playback: a resume
        x.stopPlayback();
        x.stopPlayback();                                       // at rest: nothing to stop
        expect(events).toEqual(['playbackStart', 'playbackPause', 'playbackResume', 'playbackPause', 'playbackResume', 'playbackStop']);
        x.startPlayback();
        e.frames(10);
        x.pausePlayback();
        x.startPlayback();                                      // continue on a paused playback: it unfreezes — a resume
        expect(events.slice(-3)).toEqual(['playbackStart', 'playbackPause', 'playbackResume']);
    });
});

describe('the action model: jump / animate to the start or the end; arriving at the end runs atEnd (1.23)', () => {
    it('stop jumpToEnd on a one-shot: the engine\'s jump, onPlaybackStop at once, and the engine\'s finish runs atEnd', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { 'playback.stop': 'jumpToEnd' }, atEnd: 'jumpToStart' });
        const events: Array<string> = [];
        x.setListeners(listening(events));
        x.startPlayback();
        e.frames(30);
        x.stopPlayback();
        expect(e.log.at(-1)).toBe('jumpToEnd');
        expect(e.time).toBe(1000);
        expect(events).toEqual(['playbackStart', 'playbackStop']);
        x.onNaturalFinish();                                  // what the engine reports after its jump
        expect(e.time).toBe(0);                               // atEnd: jumpToStart
        expect(x.state()).toBe('off');
    });

    it('stop jumpToEnd on a loop holds on the end of the CURRENT pass, FINISHED; atEnd hold is the default', () => {
        const e = new FakeEngine(Infinity);
        const x = executorOf(e, { actions: { 'playback.stop': 'jumpToEnd' } });
        x.startPlayback();
        e.frames(130);
        x.stopPlayback();
        expect(e.time).toBe(2000);
        expect(e.playing).toBe(false);
        expect(x.state()).toBe('finished');
        x.stopPlayback();                                          // already at the end: nothing to do
        expect(e.time).toBe(2000);
        x.startPlayback();                                         // continue: plays on from there
        e.frames(10);
        expect(e.time).toBe(2100);
    });

    it('stop animateToEnd on a loop with atEnd hold rests on the pass end, FINISHED; while on its way it still reads PLAYING', () => {
        const e = new FakeEngine(Infinity);
        const x = executorOf(e, { actions: { 'playback.stop': 'animateToEnd' } });
        const events: Array<string> = [];
        x.setListeners(listening(events));
        x.startPlayback();
        e.frames(30);
        x.stopPlayback();
        expect(x.state()).toBe('playing');                    // a move in flight — the playback is still on
        expect(events).toEqual(['playbackStart']);                 // told on arrival
        e.frames(80);
        expect(e.time).toBe(1000);
        expect(e.playing).toBe(false);
        expect(x.state()).toBe('finished');
        expect(events).toEqual(['playbackStart', 'playbackStop']);
    });

    it('stop animateToEnd on a PAUSED playback resumes it and plays there', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { 'playback.stop': 'animateToEnd' } });
        x.startPlayback();
        e.frames(30);
        x.pausePlayback();
        x.stopPlayback();
        expect(e.playing).toBe(true);
        e.frames(80);
        expect(e.time).toBe(1000);
        expect(x.state()).toBe('finished');
    });

    it('a one-shot animateToEnd arrives with the engine\'s natural end even when the time read never shows the end', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { 'playback.stop': 'animateToEnd' }, atEnd: 'jumpToStart' });
        const events: Array<string> = [];
        x.setListeners(listening(events));
        x.startPlayback();
        e.frames(30);
        x.stopPlayback();
        x.onNaturalFinish();                                  // an engine whose clock already reverted (fill none)
        expect(events).toEqual(['playbackStart', 'playbackStop']);
        expect(e.time).toBe(0);
        e.frames(5);
        expect(events).toEqual(['playbackStart', 'playbackStop']);      // told once
    });

    it('start jumpToStart (was restart) always plays from the beginning', () => {
        const e = new FakeEngine(1000);
        const x = executorOf(e, { actions: { 'playback.start': PxStartPlaybackBehavior.jumpToStart } });
        x.startPlayback();
        e.frames(30);
        x.pausePlayback();
        e.log.length = 0;
        x.startPlayback();
        expect(e.log).toEqual(['jumpToStart', 'play']);
    });
});

describe('composeApiExtras — the public api on top of the same executor', () => {
    it('playback: the four buttons and jumpToStart() go through ONE executor, reused by every later composition', () => {
        const e = new FakeEngine(2000);
        const events: Array<string> = [];
        const api = composeApiExtras(e, { duration: 1000, iterations: 2, actions: { 'playback.stop': { behavior: PxStopPlaybackBehavior.animateToStart } }, playbackListeners: listening(events) }, e.raf);
        api.playback.start();
        e.frames(30);
        api.playback.pause();
        expect(api.playback.getState()).toBe('paused');
        expect(api.playback.isActive()).toBe(true);
        e.log.length = 0;
        api.playback.start();
        expect(e.log).toEqual(['play']);                   // `continue` on a pause resumes
        api.playback.stop();
        expect(e.rate).toBe(-1);                           // the configured off
        expect(api.playback.getState()).toBe('returning');
        expect(api.playback.isActive()).toBe(false);
        e.frames(40);
        expect(e.time).toBe(0);
        api.playback.jumpToStart();
        expect(api.playback.getState()).toBe('off');
        expect(api.playback.getDuration()).toBe(1000);
        expect(events).toEqual(['playbackStart', 'playbackPause', 'playbackResume', 'playbackStop']);
        expect(composeApiExtras(e, { duration: 1000 }, e.raf).playExecutor).toBe(api.playExecutor);
    });

    it('playOnce runs ONE pass of a multi-pass document and settles at the end of that pass, per atEnd; it tells onPlaybackStart', () => {
        const hold = new FakeEngine(Infinity);
        const events: Array<string> = [];
        const api = composeApiExtras(hold, { duration: 1000, iterations: 'infinite', playbackListeners: listening(events) }, hold.raf);
        api.playback.playOnce();
        hold.frames(105);
        expect(hold.time).toBe(1000);
        expect(hold.playing).toBe(false);
        expect(api.playback.getState()).toBe('finished');
        expect(events).toEqual(['playbackStart']);
        const reset = new FakeEngine(Infinity);
        composeApiExtras(reset, { duration: 1000, iterations: 'infinite', atEnd: PxAtEndBehavior.jumpToStart }, reset.raf).playback.playOnce();
        reset.frames(105);
        expect(reset.time).toBe(0);
        expect(reset.playing).toBe(false);
    });
});
