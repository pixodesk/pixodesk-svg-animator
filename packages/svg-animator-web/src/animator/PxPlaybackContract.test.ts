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
        animator: { timelines: [{ engine: 'js', outTime: 1000, ...timeline }] },
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
        const api = createSvgAnimationPlayer({ document: doc({ iterationDirection: 'reverse' }), container: '#box' });
        api.timeline.start();
        vi.advanceTimersByTime(400);
        const before = api.timeline.getCurrentTime() ?? 0;
        expect(before).toBeLessThan(700);                    // a reverse pass counts down from the end
        api.timeline.setSpeed(-1);
        vi.advanceTimersByTime(200);
        expect(api.timeline.getCurrentTime() ?? 0).toBeGreaterThan(before);   // reverse × −1: the frames run forwards
        api.destroy();
    });

    it('on a scroll timeline the playback verbs are no-ops that say so (PX1505); scroll owns the playhead', () => {
        const said: Array<PxDiagnostic> = [];
        const api = createSvgAnimationPlayer({
            document: doc({ type: 'scroll' }), container: '#box',
            onWarning: d => said.push(d),
        });
        api.timeline.start();
        api.timeline.setSpeed(2);
        vi.advanceTimersByTime(200);
        expect(api.timeline.isPlaying()).toBe(false);
        expect(api.timeline.getSpeed()).toBe(1);
        expect(said.filter(d => d.code === PxDiagnosticCode.scrollOwnsPlayhead).map(d => d.data?.[0])).toEqual(['timeline.start()', 'timeline.setSpeed()']);
        api.destroy();
    });
});

// A scroll timeline (D3, D16): the scrolling owns the playhead on EVERY engine — the state reads `scrubbing`, nothing
// starts, pauses or finishes it (no playback callback), and the buttons, the speed and the seeks are ignored with PX1505.
describe('the playback contract — a scroll timeline', () => {

    /** Every Animation the WAAPI engine builds (jsdom has no Web Animations API — stubbed as in PxAnimatorWebApiTime.test.ts). */
    const created: Array<StubAnimation> = [];
    class StubKeyframeEffect {
        constructor(readonly target: Element, readonly keyframes: unknown, private readonly timing: EffectTiming) {}
        getTiming(): EffectTiming { return this.timing; }
        updateTiming(): void {}
    }
    class StubAnimation {
        playState: AnimationPlayState = 'idle';
        playbackRate = 1;
        currentTime: number | null = 0;
        onfinish: (() => void) | null = null;
        onremove: (() => void) | null = null;
        constructor(readonly effect: StubKeyframeEffect, readonly timeline?: unknown) { created.push(this); }
        play(): void { this.playState = 'running'; }
        pause(): void { this.playState = 'paused'; }
        cancel(): void { this.playState = 'idle'; }
        finish(): void { this.playState = 'finished'; }
    }
    /** The subjects the stubbed browser ViewTimeline was built on, and the sources of its ScrollTimeline. */
    const viewSubjects: Array<unknown> = [];
    const scrollSources: Array<unknown> = [];

    let rafQueue: Array<FrameRequestCallback> = [];
    const flushRaf = (): void => { const q = rafQueue; rafQueue = []; for (const cb of q) cb(0); };

    beforeEach(() => {
        document.body.innerHTML = '<div id="box"></div>';
        created.length = 0;
        viewSubjects.length = 0;
        scrollSources.length = 0;
        rafQueue = [];
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length; });
        vi.stubGlobal('cancelAnimationFrame', () => {});
        vi.stubGlobal('KeyframeEffect', StubKeyframeEffect);
        vi.stubGlobal('Animation', StubAnimation);
        vi.stubGlobal('CSS', { supports: () => true, percent: (value: number) => ({ value, unit: 'percent' }) });
        // the page: 1000 px to scroll
        Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1400, configurable: true });
        Object.defineProperty(document.documentElement, 'clientHeight', { value: 400, configurable: true });
        document.documentElement.scrollTop = 0;
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        Reflect.deleteProperty(document.documentElement, 'scrollHeight');
        Reflect.deleteProperty(document.documentElement, 'clientHeight');
        document.documentElement.scrollTop = 0;
    });

    /** The browser's own ViewTimeline and ScrollTimeline — only for the native engine's runs. */
    const stubViewTimeline = (): void => {
        vi.stubGlobal('ViewTimeline', class { constructor(options: { subject?: unknown }) { viewSubjects.push(options.subject); } });
        vi.stubGlobal('ScrollTimeline', class { constructor(options: { source?: unknown }) { scrollSources.push(options.source); } });
    };

    /** The three engines: the frame loop, WAAPI driven by the player's own measuring, and the browser's own timeline. */
    const ENGINES: Array<{ name: string; engine: string; native: boolean }> = [
        { name: 'frame loop (js)', engine: 'js', native: false },
        { name: 'WAAPI, own measuring (auto, no browser timeline)', engine: 'auto', native: false },
        { name: 'the browser\'s timeline (native)', engine: 'native', native: true },
    ];

    for (const { name, engine, native } of ENGINES) {
        it(`getState() reads 'scrubbing' — ${name}; 'destroyed' after destroy()`, () => {
            if (native) stubViewTimeline();
            const api = createSvgAnimationPlayer({ document: doc({ type: 'scroll', engine }), container: '#box', suppressWarnings: true });
            expect(api.timeline.getState()).toBe('scrubbing');
            api.timeline.start();
            expect(api.timeline.getState()).toBe('scrubbing');
            expect(api.timeline.isActive()).toBe(false);
            expect(api.timeline.isPlaying()).toBe(false);
            if (native) expect(viewSubjects).toHaveLength(1);   // really the browser's timeline
            api.destroy();
            expect(api.timeline.getState()).toBe('destroyed');
        });

        it(`no playback callback fires — ${name}`, () => {
            if (native) stubViewTimeline();
            const told: Array<string> = [];
            const api = createSvgAnimationPlayer({
                document: doc({ type: 'scroll', engine, follows: 'pageScroll' }), container: '#box', suppressWarnings: true,
                onPlaybackStart: () => told.push('start'), onPlaybackStop: () => told.push('stop'),
                onPlaybackPause: () => told.push('pause'), onPlaybackResume: () => told.push('resume'),
                onPlaybackFinish: () => told.push('finish'),
            });
            api.timeline.start(); api.timeline.pause(); api.timeline.resume(); api.timeline.stop(); api.timeline.play();
            // scrolled to the end: the last frame — never a finish
            document.documentElement.scrollTop = 1000;
            window.dispatchEvent(new Event('scroll'));
            flushRaf();
            if (native) expect(scrollSources).toHaveLength(1);   // really the browser's timeline
            for (const a of created) a.onfinish?.();   // the browser's animation reaching its end
            expect(told).toEqual([]);
            api.destroy();
        });
    }

    it('the buttons, the speed AND the seeks are ignored with PX1505 (D16); the reads still answer', () => {
        const said: Array<PxDiagnostic> = [];
        const api = createSvgAnimationPlayer({ document: doc({ type: 'scroll', follows: 'pageScroll' }), container: '#box', onWarning: d => said.push(d) });
        const before = api.timeline.getCurrentProgress();
        api.timeline.setCurrentTime(500);
        api.timeline.setCurrentProgress(0.5);
        api.timeline.setTotalTime(500);
        api.timeline.setDurationAtSpeed(100);
        expect(said.filter(d => d.code === PxDiagnosticCode.scrollOwnsPlayhead).map(d => d.data?.[0]))
            .toEqual(['timeline.setCurrentTime()', 'timeline.setCurrentProgress()', 'timeline.setTotalTime()', 'timeline.setDurationAtSpeed()']);
        expect(before).toBe(0);
        expect(api.timeline.getCurrentProgress()).toBe(0);   // not moved
        expect(api.timeline.getDuration()).toBe(1000);       // the reads answer
        api.destroy();
    });

    it('the scrolling still moves the playhead — the driver\'s own seek is not a guarded one', () => {
        const api = createSvgAnimationPlayer({ document: doc({ type: 'scroll', follows: 'pageScroll' }), container: '#box', suppressWarnings: true });
        document.documentElement.scrollTop = 250;
        window.dispatchEvent(new Event('scroll'));
        flushRaf();
        expect(api.timeline.getCurrentProgress()).toBeCloseTo(0.25);
        api.destroy();
    });

    it('timelineOptions.follows takes an element of the page — followed by the browser\'s timeline and by our own measuring', () => {
        const section = document.createElement('section');
        document.body.append(section);
        const said: Array<PxDiagnostic> = [];

        // the browser's timeline: the element is the ViewTimeline's subject
        stubViewTimeline();
        const nativeApi = createSvgAnimationPlayer({
            document: doc({ engine: 'native' }), container: '#box', onWarning: d => said.push(d),
            timelineOptions: { type: 'scroll', follows: section },
        });
        expect(viewSubjects).toEqual([section]);
        expect(nativeApi.timeline.getState()).toBe('scrubbing');
        nativeApi.destroy();

        // our own measuring: the element's place drives the progress, not the animation's
        section.getBoundingClientRect = () => ({ top: 150, left: 0, width: 10, height: 100, right: 10, bottom: 250, x: 0, y: 150, toJSON: () => ({}) });
        const ownApi = createSvgAnimationPlayer({
            document: doc({ engine: 'js' }), container: '#box', onWarning: d => said.push(d),
            timelineOptions: { type: 'scroll', follows: section },
        });
        expect(ownApi.timeline.getCurrentProgress()).toBeCloseTo(0.5);   // u = 400 − 150 = 250 of [0, 500]
        ownApi.destroy();
        // the element never reached the document: no repair, no ignored override
        expect(said.map(d => d.code)).toEqual([]);
    });

    it('naming another type in timelineOptions still picks the kind and drops the other kind\'s keys, with a warning', () => {
        const said: Array<PxDiagnostic> = [];
        const section = document.createElement('section');
        document.body.append(section);
        // a JavaScript caller: a clock key beside the scroll type (TypeScript would not let a literal say it)
        const timelineOptions = { type: 'scroll' as const, follows: section, playbackSpeed: 3 };
        const api = createSvgAnimationPlayer({
            document: doc({ playbackSpeed: 2, actions: [{ action: 'timeline.start', event: 'load' }] }), container: '#box',
            onWarning: d => said.push(d),
            timelineOptions,
        });
        expect(api.timeline.getState()).toBe('scrubbing');
        expect(said.filter(d => d.code === PxDiagnosticCode.timelineOverrideIgnored).map(d => String(d.data?.[0])))
            .toEqual([expect.stringContaining('playbackSpeed')]);
        api.destroy();
    });
});
