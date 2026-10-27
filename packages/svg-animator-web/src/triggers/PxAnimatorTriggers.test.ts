/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { PxDiagnosticCode, type PxAnimatorRuntimeConfig, type PxDiagnostics } from '@pixodesk/svg-animator-core';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import type { PxEngineAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';


/** Mock engine api backed by a real jsdom element as the root. STATEFUL by default: `play` / `pause` /
 *  `cancel` move `isPlaying`, as the state rule reads it; an override replaces any member. */
function createMockApi(overrides: Partial<PxEngineAnimationPlayerApi> = {}) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    let playing = false;
    const api: PxEngineAnimationPlayerApi = {
        isReady: vi.fn(() => true),
        getRootElement: vi.fn(() => root),
        isPlaying: vi.fn(() => playing),
        play: vi.fn(() => { playing = true; }),
        pause: vi.fn(() => { playing = false; }),
        cancel: vi.fn(() => { playing = false; }),
        finish: vi.fn(() => { playing = false; }),
        setPlaybackRate: vi.fn(),
        getCurrentTime: vi.fn(() => 0),
        setCurrentTime: vi.fn(),
        getCurrentProgress: vi.fn(() => 0),
        setCurrentProgress: vi.fn(),
        destroy: vi.fn(),
        ...overrides,
    };
    return { api, root };
}

/** The runtime view the engines pass: a one-second one-shot unless the case says otherwise. */
const setup = (api: PxEngineAnimationPlayerApi, config: PxAnimatorRuntimeConfig = {}, diag?: PxDiagnostics) =>
    setupAnimationTriggers(api, { duration: 1000, ...config }, diag);

const CLICK_TOGGLE: PxAnimatorRuntimeConfig = { trigger: { playStart: 'click', pauseStart: 'click' } };
const HOVER_PAUSES: PxAnimatorRuntimeConfig = { trigger: { playStart: 'hoverIn', pauseStart: 'hoverOut' } };

// the entry fields the gate reads; the heights only matter for a target taller than the viewport
type IOEntry = { isIntersecting: boolean; intersectionRatio: number; boundingClientRect?: { height: number }; intersectionRect?: { height: number }; rootBounds?: { height: number } };

/** Stubs global IntersectionObserver; returns captured callback/options/observed. */
function stubIntersectionObserver() {
    const captured: {
        callback: ((entries: Array<IOEntry>) => void) | null;
        options: IntersectionObserverInit | undefined | null;
        observed: Element | null;
        disconnected: number;
    } = { callback: null, options: null, observed: null, disconnected: 0 };

    vi.stubGlobal('IntersectionObserver', class {
        constructor(cb: (entries: Array<IOEntry>) => void, options?: IntersectionObserverInit) {
            captured.callback = cb;
            captured.options = options;
        }
        observe(el: Element) { captured.observed = el; }
        unobserve() { /* noop */ }
        disconnect() { captured.disconnected++; }
    });
    return captured;
}


describe('setupAnimationTriggers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // ── what STARTS it: the event lists and the state rule (D5) ────────────────────────
    // jsdom has no IntersectionObserver, so unless a test stubs one the gate FAILS OPEN
    // and these behave exactly as they did before the gate existed.

    it("playStart 'load': plays immediately when document.readyState is complete", () => {
        expect(document.readyState).toBe('complete'); // jsdom precondition
        const { api } = createMockApi();

        setup(api, { trigger: { playStart: 'load' } });

        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it('no trigger block: plays on load — the default every player applies', () => {
        const { api } = createMockApi();

        setup(api, {});

        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it('a second click always pauses — the click toggle lists click in playStart and pauseStart', () => {
        const { api, root } = createMockApi({ isPlaying: vi.fn(() => true) });
        setup(api, CLICK_TOGGLE);

        root.dispatchEvent(new Event('click'));

        expect(api.pause).toHaveBeenCalledTimes(1);
        expect(api.cancel).not.toHaveBeenCalled();
        expect(api.setPlaybackRate).not.toHaveBeenCalled();
    });

    it("playStart 'hoverIn': mouseenter plays", () => {
        const { api, root } = createMockApi();
        setup(api, { trigger: { playStart: 'hoverIn' } });

        expect(api.play).not.toHaveBeenCalled();
        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it.each([
        { name: 'pauseStart hoverOut (pause)', config: HOVER_PAUSES, expected: { pause: 1, cancel: 0, setPlaybackRate: 0, play: 1 } },
        { name: 'playStop hoverOut (reset)', config: { trigger: { playStart: 'hoverIn', playStop: 'hoverOut' } }, expected: { pause: 0, cancel: 1, setPlaybackRate: 0, play: 1 } },
        { name: 'playStop hoverOut + playStopAction rewind', config: { trigger: { playStart: 'hoverIn', playStop: 'hoverOut' }, playStopAction: 'rewind' }, expected: { pause: 0, cancel: 0, setPlaybackRate: 1, play: 2 } },
        { name: 'hoverOut not listed (continue)', config: { trigger: { playStart: 'hoverIn' } }, expected: { pause: 0, cancel: 0, setPlaybackRate: 0, play: 1 } },
    ] satisfies Array<{ name: string; config: PxAnimatorRuntimeConfig; expected: Record<string, number> }>)("hoverIn plays; mouseleave with $name", ({ config, expected }) => {
        const { api, root } = createMockApi();
        setup(api, config);

        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));

        expect(api.pause).toHaveBeenCalledTimes(expected.pause);
        expect(api.cancel).toHaveBeenCalledTimes(expected.cancel);
        expect(api.setPlaybackRate).toHaveBeenCalledTimes(expected.setPlaybackRate);
        expect(api.play).toHaveBeenCalledTimes(expected.play);
        if (config.playStopAction === 'rewind') {
            expect(api.setPlaybackRate).toHaveBeenCalledWith(-1);
        }
    });

    it('the click toggle: plays when stopped, pauses when playing', () => {
        const { api, root } = createMockApi();
        setup(api, CLICK_TOGGLE);

        root.dispatchEvent(new Event('click'));
        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).not.toHaveBeenCalled();

        root.dispatchEvent(new Event('click'));
        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).toHaveBeenCalledTimes(1);
    });

    it("the click toggle: a resume after the toggle's pause plays forward, never at a stale rate", () => {
        // `pauseStop` is a copy of `playStart` when omitted: the third click RESUMES, and the rate is
        // never touched by any of the three.
        const order: Array<string> = [];
        let playing = false;
        const { api, root } = createMockApi({
            isPlaying: vi.fn(() => playing),
            play: vi.fn(() => { playing = true; order.push('play'); }),
            pause: vi.fn(() => { playing = false; order.push('pause'); }),
            setPlaybackRate: vi.fn((rate: number) => order.push('rate:' + rate)),
        });
        setup(api, CLICK_TOGGLE);

        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));

        expect(order).toEqual(['play', 'pause', 'play']);
    });

    it('the EMPTY trigger: nothing auto-starts and no listeners react', () => {
        const { api, root } = createMockApi();
        setup(api, { trigger: {} });

        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('mouseenter'));

        expect(api.play).not.toHaveBeenCalled();
        expect(api.pause).not.toHaveBeenCalled();
        expect(api.cancel).not.toHaveBeenCalled();
    });

    it('a list holds one event or several: a click and a hover both play; hover out pauses, either resumes', () => {
        const { api, root } = createMockApi();
        setup(api, { trigger: { playStart: ['click', 'hoverIn'], pauseStart: 'hoverOut' } });

        root.dispatchEvent(new Event('click'));
        expect(api.play).toHaveBeenCalledTimes(1);
        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);          // already playing: hoverIn is not in pauseStart / playStop
        root.dispatchEvent(new Event('mouseleave'));
        expect(api.pause).toHaveBeenCalledTimes(1);
        root.dispatchEvent(new Event('click'));             // paused: pauseStop = playStart, so a click resumes
        expect(api.play).toHaveBeenCalledTimes(2);
    });

    it('the state rule: playStop acts while PAUSED too; a hover out while STOPPED does nothing', () => {
        const { api, root } = createMockApi();
        setup(api, { trigger: { playStart: 'click', pauseStart: 'click', playStop: 'hoverOut' } });

        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));        // stopped: not in playStart → nothing
        expect(api.cancel).not.toHaveBeenCalled();

        root.dispatchEvent(new Event('click'));             // play
        root.dispatchEvent(new Event('click'));             // pause
        root.dispatchEvent(new Event('mouseleave'));        // paused: playStop → the off
        expect(api.cancel).toHaveBeenCalledTimes(1);
    });

    it('an event in both playStop and pauseStart is reported (PX1109), and pauseStart wins', () => {
        const warn = vi.fn();
        const diag: PxDiagnostics = { warn, error: vi.fn() };
        const { api, root } = createMockApi();
        setup(api, { trigger: { playStart: 'hoverIn', playStop: 'hoverOut', pauseStart: 'hoverOut' } }, diag);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]).toContain(PxDiagnosticCode.triggerEventConflict);
        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));
        expect(api.pause).toHaveBeenCalledTimes(1);
        expect(api.cancel).not.toHaveBeenCalled();
    });

    it("playStartAction 'restart': a play-start while stopped midway begins a fresh run", () => {
        const order: Array<string> = [];
        const { api, root } = createMockApi({
            getCurrentTime: vi.fn(() => 300),
            play: vi.fn(() => order.push('play')),
            cancel: vi.fn(() => order.push('cancel')),
        });
        setup(api, { trigger: { playStart: 'click' }, playStartAction: 'restart' });

        root.dispatchEvent(new Event('click'));

        expect(order).toEqual(['cancel', 'play']);
    });

    it('attaches the executor to the api, so the composed api and the triggers share ONE state', () => {
        const { api } = createMockApi();
        setup(api, { trigger: {} });

        expect(api.playExecutor).toBeDefined();
        expect(api.playExecutor?.state()).toBe('stopped');
    });

    // ── whether it may RUN: the visibility gate ─────────────────────────────────────

    describe('the visibility gate', () => {

        it('observes the root; the DEFAULT threshold is 0.5 — a barely-visible element waits', () => {
            const io = stubIntersectionObserver();
            const { api, root } = createMockApi();
            setup(api, { inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            expect(io.observed).toBe(root);
            // The observer registers a GRANULAR threshold list, not the author's raw value: a
            // target taller than the viewport can never reach a high ratio, so registering the raw
            // threshold would mean the callback never fires. The author's value is applied to a
            // NORMALIZED ratio inside the callback instead (asserted by the behavior tests below).
            expect(Array.isArray(io.options?.threshold)).toBe(true);
            expect(io.options?.threshold).toContain(0);
            expect(io.options?.threshold).toContain(1);

            // Keep in sync with the editor model's default (TSvgSvgAnimationAttr).
            io.callback([{ isIntersecting: true, intersectionRatio: 0.01 }]);
            expect(api.play).not.toHaveBeenCalled();

            io.callback([{ isIntersecting: true, intersectionRatio: 0.6 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('leaving the viewport runs the outOfViewAction', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { outOfViewAction: 'pause', inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
            io.callback([{ isIntersecting: false, intersectionRatio: 0 }]);

            expect(api.play).toHaveBeenCalledTimes(1);
            expect(api.pause).toHaveBeenCalledTimes(1);
        });

        it('honors inViewThreshold: intersecting below the threshold does not play', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { inViewThreshold: 0.8, inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            // See the note above: the registration is a granular list; the 0.8 gate is applied to
            // the normalized ratio in the callback, which the assertions below exercise.
            expect(Array.isArray(io.options?.threshold)).toBe(true);

            io.callback([{ isIntersecting: true, intersectionRatio: 0.6 }]);
            expect(api.play).not.toHaveBeenCalled();

            io.callback([{ isIntersecting: true, intersectionRatio: 0.9 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('inViewThreshold 0 means ANY visible pixel — zero visibility still keeps it shut', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { inViewThreshold: 0, inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            // Not intersecting at all: a threshold of 0 is "any pixel", not "no pixels".
            io.callback([{ isIntersecting: false, intersectionRatio: 0 }]);
            expect(api.play).not.toHaveBeenCalled();

            // The first visible pixel opens it.
            io.callback([{ isIntersecting: true, intersectionRatio: 0.01 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('HYSTERESIS: once open it stays open until zero, so a graphic on the boundary cannot flap', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { inViewThreshold: 0.5, inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 0.6 }]);   // opens
            io.callback([{ isIntersecting: true, intersectionRatio: 0.4 }]);   // below → still open
            io.callback([{ isIntersecting: true, intersectionRatio: 0.6 }]);   // back up → no re-play

            expect(api.play).toHaveBeenCalledTimes(1);
            expect(api.pause).not.toHaveBeenCalled();

            io.callback([{ isIntersecting: false, intersectionRatio: 0 }]);    // gone → closes
            expect(api.pause).toHaveBeenCalledTimes(1);
        });

        it("outOfViewAction 'reset' replays from the start on the next entry", () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { outOfViewAction: 'reset', inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
            io.callback([{ isIntersecting: false, intersectionRatio: 0 }]);
            expect(api.cancel).toHaveBeenCalledTimes(1);
            expect(api.pause).not.toHaveBeenCalled();

            io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
            expect(api.play).toHaveBeenCalledTimes(2);   // the replay
        });

        it("outOfViewAction 'continue' observes nothing at all and starts unseen", () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { outOfViewAction: 'continue' });

            // "Run wherever it is" also means "do not wait to be seen before starting".
            expect(io.observed).toBeNull();
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('a target TALLER than the viewport is normalized, so a 0.5 threshold is reachable', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { inViewThreshold: 0.5, inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            // 2000px graphic, 800px viewport: the raw ratio can never exceed 0.4, so an
            // un-normalized gate would never open. Normalized by what COULD be visible, 400px
            // showing is 0.5 and the gate opens.
            io.callback([{
                isIntersecting: true,
                intersectionRatio: 0.2,
                boundingClientRect: { height: 2000 },
                intersectionRect: { height: 400 },
                rootBounds: { height: 800 },
            }]);

            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('a hidden TAB counts as off screen', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
            expect(api.play).toHaveBeenCalledTimes(1);

            const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
            document.dispatchEvent(new Event('visibilitychange'));
            expect(api.pause).toHaveBeenCalledTimes(1);

            hidden.mockReturnValue('visible');
            document.dispatchEvent(new Event('visibilitychange'));
            expect(api.play).toHaveBeenCalledTimes(2);
            hidden.mockRestore();
        });

        it('FAILS OPEN when there is no IntersectionObserver at all', () => {
            vi.stubGlobal('IntersectionObserver', undefined);
            const { api } = createMockApi();

            setup(api, { trigger: { playStart: 'load' } });

            // Never "silently never plays": a page that cannot measure animates.
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('the EMPTY trigger is gated too, so an API-started animation pauses off screen', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi({ isPlaying: vi.fn(() => true) });
            setup(api, { trigger: {}, inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            // The gate is about permission to RUN, which applies however playback started —
            // including a bare `play()` from the host.
            expect(io.observed).not.toBeNull();
            io.callback([{ isIntersecting: false, intersectionRatio: 0 }]);
            expect(api.pause).toHaveBeenCalledTimes(1);
        });
    });

    // ── the debounce ────────────────────────────────────────────────────────────────

    describe('inViewDebounce', () => {

        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it('a graphic scrolled straight past never plays a frame', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, {});   // default 150ms
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
            vi.advanceTimersByTime(100);
            expect(api.play).not.toHaveBeenCalled();

            io.callback([{ isIntersecting: false, intersectionRatio: 0 }]);
            vi.advanceTimersByTime(1000);
            expect(api.play).not.toHaveBeenCalled();
        });

        it('one that stays plays when the dwell has elapsed, and not before', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, {});
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
            vi.advanceTimersByTime(149);
            expect(api.play).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('falling back BELOW the threshold abandons a pending start', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { inViewThreshold: 0.5 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 0.9 }]);
            io.callback([{ isIntersecting: true, intersectionRatio: 0.2 }]);   // still visible, not enough
            vi.advanceTimersByTime(1000);

            expect(api.play).not.toHaveBeenCalled();
        });

        it('0 plays the moment the threshold is met', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setup(api, { inViewDebounce: 0 });
            assert(io.callback, 'the gate created no IntersectionObserver');

            io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('a click plays immediately rather than waiting out a timer nobody can see', () => {
            stubIntersectionObserver();
            const { api, root } = createMockApi();
            setup(api, CLICK_TOGGLE);

            root.dispatchEvent(new Event('click'));

            expect(api.play).toHaveBeenCalledTimes(1);
        });
    });

    // ── behaviors pinned by the app's `trigger-explorer.spec.ts` integration suite,
    //    mirrored here so the LIB's own suite (this file) also guards them ─────────────

    it('repeated clicks keep toggling, and the toggle always reads the live playing state', () => {
        let playing = false;
        const { api, root } = createMockApi({
            isPlaying: vi.fn(() => playing),
            play: vi.fn(() => { playing = true; }),
            pause: vi.fn(() => { playing = false; }),
        });
        setup(api, CLICK_TOGGLE);

        root.dispatchEvent(new Event('click'));   // stopped → play
        root.dispatchEvent(new Event('click'));   // playing → pause
        playing = true;                           // the host played it again through the api
        root.dispatchEvent(new Event('click'));   // reported playing → pause again

        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).toHaveBeenCalledTimes(2);
        expect(api.setPlaybackRate).not.toHaveBeenCalled();
    });

    it('hover-out rewind: a hover-in during the rewind turns it around — FORWARD before play', () => {
        const order: Array<string> = [];
        let playing = false;
        const { api, root } = createMockApi({
            isPlaying: vi.fn(() => playing),
            play: vi.fn(() => { playing = true; order.push('play'); }),
            cancel: vi.fn(() => { playing = false; order.push('cancel'); }),
            setPlaybackRate: vi.fn((rate: number) => order.push('rate:' + rate)),
        });
        setup(api, { trigger: { playStart: 'hoverIn', playStop: 'hoverOut' }, playStopAction: 'rewind' });

        root.dispatchEvent(new Event('mouseenter'));   // start (forward, no rate call)
        root.dispatchEvent(new Event('mouseleave'));   // rewind: rate -1, play
        root.dispatchEvent(new Event('mouseenter'));   // re-enter: rate 1 BEFORE play

        expect(order).toEqual(['play', 'rate:-1', 'play', 'rate:1', 'play']);
    });

    it('a plain (never-rewound) resume never touches the playback rate — custom API rates survive', () => {
        const { api, root } = createMockApi();
        setup(api, HOVER_PAUSES);

        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));
        root.dispatchEvent(new Event('mouseenter'));

        expect(api.setPlaybackRate).not.toHaveBeenCalled();
        expect(api.play).toHaveBeenCalledTimes(2);
    });

    it("outOfViewAction 'pause' then returning resumes from where it paused", () => {
        const io = stubIntersectionObserver();
        const { api } = createMockApi();
        setup(api, { outOfViewAction: 'pause', inViewDebounce: 0 });
        assert(io.callback, 'the gate created no IntersectionObserver');

        io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);
        io.callback([{ isIntersecting: false, intersectionRatio: 0 }]);
        io.callback([{ isIntersecting: true, intersectionRatio: 1 }]);

        expect(api.pause).toHaveBeenCalledTimes(1);
        expect(api.cancel).not.toHaveBeenCalled();   // resume, never restart
        expect(api.play).toHaveBeenCalledTimes(2);
    });

    it("playStart 'load' before the document finishes loading: plays on the window 'load' event", () => {
        const readyStateSpy = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { api } = createMockApi();
        setup(api, { trigger: { playStart: 'load' } });

        expect(api.play).not.toHaveBeenCalled();
        window.dispatchEvent(new Event('load'));
        expect(api.play).toHaveBeenCalledTimes(1);
        readyStateSpy.mockRestore();
    });

    it('warns and returns a no-op disposer when there is no root element', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* silence */ });
        const { api } = createMockApi({ getRootElement: vi.fn(() => null) });

        // Used to return the api "for chaining" (review §14). A disposer is what a caller can
        // actually use — and with nothing attached, it must simply be safe to call.
        const dispose = setup(api, { trigger: { playStart: 'load' } });

        expect(typeof dispose).toBe('function');
        expect(() => dispose()).not.toThrow();
        expect(api.play).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('the disposer detaches every listener it attached (review §14)', () => {
        const { api, root } = createMockApi();
        const dispose = setup(api, { trigger: { playStart: 'hoverIn' } });

        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);

        dispose();
        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);   // still 1 — the listener is gone
    });

    it('the disposer also disconnects the visibility observer', () => {
        const io = stubIntersectionObserver();
        const { api } = createMockApi();
        const dispose = setup(api, { trigger: { playStart: 'load' } });

        dispose();
        expect(io.disconnected).toBe(1);
    });
});
