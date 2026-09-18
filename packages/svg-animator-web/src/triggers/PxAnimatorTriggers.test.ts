/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import type { PxAnimatorApi } from '../shared/PxAnimatorWebTypes';


/** Mock PxAnimatorApi backed by a real jsdom element as the root. */
function createMockApi(overrides: Partial<PxAnimatorApi> = {}) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const api: PxAnimatorApi = {
        isReady: vi.fn(() => true),
        getRootElement: vi.fn(() => root),
        isPlaying: vi.fn(() => false),
        play: vi.fn(),
        pause: vi.fn(),
        cancel: vi.fn(),
        finish: vi.fn(),
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

type IOEntry = { isIntersecting: boolean; intersectionRatio: number };

/** Stubs global IntersectionObserver; returns captured callback/options/observed. */
function stubIntersectionObserver() {
    const captured: {
        callback: ((entries: Array<IOEntry>) => void) | null;
        options: any;
        observed: Element | null;
        disconnected: number;
    } = { callback: null, options: null, observed: null, disconnected: 0 };

    vi.stubGlobal('IntersectionObserver', class {
        constructor(cb: (entries: Array<IOEntry>) => void, options: any) {
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

    // ── what STARTS it ──────────────────────────────────────────────────────────────
    // jsdom has no IntersectionObserver, so unless a test stubs one the gate FAILS OPEN
    // and these behave exactly as they did before the gate existed.

    it("start 'load': plays immediately when document.readyState is complete", () => {
        expect(document.readyState).toBe('complete'); // jsdom precondition
        const { api } = createMockApi();

        setupAnimationTriggers(api, { start: 'load' });

        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it('no start: starts on load — the default every player applies', () => {
        const { api } = createMockApi();

        setupAnimationTriggers(api, {});

        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it('a second click always pauses — click is a plain toggle with nothing to configure', () => {
        const { api, root } = createMockApi({ isPlaying: vi.fn(() => true) });
        setupAnimationTriggers(api, { start: 'click' });

        root.dispatchEvent(new Event('click'));

        // `outAction` used to make this configurable per document; a toggle that sometimes did
        // not toggle was a trap, and `reverse`/`reset` on a click had no readable meaning.
        expect(api.pause).toHaveBeenCalledTimes(1);
        expect(api.cancel).not.toHaveBeenCalled();
        expect(api.setPlaybackRate).not.toHaveBeenCalled();
    });

    it("start 'mouseOver': mouseenter plays", () => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { start: 'mouseOver' });

        expect(api.play).not.toHaveBeenCalled();
        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it.each([
        { mouseOut: 'pause' as const, expected: { pause: 1, cancel: 0, setPlaybackRate: 0, play: 1 } },
        { mouseOut: 'reset' as const, expected: { pause: 0, cancel: 1, setPlaybackRate: 0, play: 1 } },
        { mouseOut: 'reverse' as const, expected: { pause: 0, cancel: 0, setPlaybackRate: 1, play: 2 } },
        { mouseOut: 'continue' as const, expected: { pause: 0, cancel: 0, setPlaybackRate: 0, play: 1 } },
    ])("start 'mouseOver': mouseleave with mouseOut '$mouseOut'", ({ mouseOut, expected }) => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { start: 'mouseOver', mouseOut });

        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));

        expect(api.pause).toHaveBeenCalledTimes(expected.pause);
        expect(api.cancel).toHaveBeenCalledTimes(expected.cancel);
        expect(api.setPlaybackRate).toHaveBeenCalledTimes(expected.setPlaybackRate);
        expect(api.play).toHaveBeenCalledTimes(expected.play);
        if (mouseOut === 'reverse') {
            expect(api.setPlaybackRate).toHaveBeenCalledWith(-1);
        }
    });

    it("start 'click': toggles — plays when stopped, pauses when playing", () => {
        const { api, root } = createMockApi({
            isPlaying: vi.fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true),
        });
        setupAnimationTriggers(api, { start: 'click' });

        root.dispatchEvent(new Event('click'));
        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).not.toHaveBeenCalled();

        root.dispatchEvent(new Event('click'));
        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).toHaveBeenCalledTimes(1);
    });

    it("start 'click': a resume after the toggle's pause plays forward, never at a stale rate", () => {
        // Was "click with outAction 'reverse'": a click can no longer reverse, so the rate is
        // never touched by the toggle — which is exactly what this now pins.
        const order: Array<string> = [];
        const { api, root } = createMockApi({
            isPlaying: vi.fn()
                .mockReturnValueOnce(false)  // 1st click: stopped → play
                .mockReturnValueOnce(true)   // 2nd click: playing → pause
                .mockReturnValueOnce(false), // 3rd click: stopped → play again
            play: vi.fn(() => order.push('play')),
            pause: vi.fn(() => order.push('pause')),
            setPlaybackRate: vi.fn((rate: number) => order.push('rate:' + rate)),
        });
        setupAnimationTriggers(api, { start: 'click' });

        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));

        expect(order).toEqual(['play', 'pause', 'play']);
    });

    it("start 'none': nothing auto-starts and no listeners react", () => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { start: 'none' });

        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('mouseenter'));

        expect(api.play).not.toHaveBeenCalled();
        expect(api.pause).not.toHaveBeenCalled();
        expect(api.cancel).not.toHaveBeenCalled();
    });

    // ── whether it may RUN: the visibility gate ─────────────────────────────────────

    describe('the visibility gate', () => {

        it('observes the root; the DEFAULT threshold is 0.5 — a barely-visible element waits', () => {
            const io = stubIntersectionObserver();
            const { api, root } = createMockApi();
            setupAnimationTriggers(api, { visibilityDebounce: 0 });

            expect(io.observed).toBe(root);
            // The observer registers a GRANULAR threshold list, not the author's raw value: a
            // target taller than the viewport can never reach a high ratio, so registering the raw
            // threshold would mean the callback never fires. The author's value is applied to a
            // NORMALIZED ratio inside the callback instead (asserted by the behavior tests below).
            expect(Array.isArray(io.options.threshold)).toBe(true);
            expect(io.options.threshold).toContain(0);
            expect(io.options.threshold).toContain(1);

            // Keep in sync with the editor model's default (TSvgSvgAnimationAttr).
            io.callback!([{ isIntersecting: true, intersectionRatio: 0.01 }]);
            expect(api.play).not.toHaveBeenCalled();

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.6 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('leaving the viewport runs the offScreen action', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi({ isPlaying: vi.fn(() => true) });
            setupAnimationTriggers(api, { offScreen: 'pause', visibilityDebounce: 0 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
            io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);

            expect(api.play).toHaveBeenCalledTimes(1);
            expect(api.pause).toHaveBeenCalledTimes(1);
        });

        it('honors visibilityThreshold: intersecting below the threshold does not play', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, { visibilityThreshold: 0.8, visibilityDebounce: 0 });

            // See the note above: the registration is a granular list; the 0.8 gate is applied to
            // the normalized ratio in the callback, which the assertions below exercise.
            expect(Array.isArray(io.options.threshold)).toBe(true);

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.6 }]);
            expect(api.play).not.toHaveBeenCalled();

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.9 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('HYSTERESIS: once open it stays open until zero, so a graphic on the boundary cannot flap', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi({ isPlaying: vi.fn(() => true) });
            setupAnimationTriggers(api, { visibilityThreshold: 0.5, visibilityDebounce: 0 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.6 }]);   // opens
            io.callback!([{ isIntersecting: true, intersectionRatio: 0.4 }]);   // below → still open
            io.callback!([{ isIntersecting: true, intersectionRatio: 0.6 }]);   // back up → no re-play

            expect(api.play).toHaveBeenCalledTimes(1);
            expect(api.pause).not.toHaveBeenCalled();

            io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);    // gone → closes
            expect(api.pause).toHaveBeenCalledTimes(1);
        });

        it("offScreen 'reset' replays from the start on the next entry", () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi({ isPlaying: vi.fn(() => true) });
            setupAnimationTriggers(api, { offScreen: 'reset', visibilityDebounce: 0 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
            io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);
            expect(api.cancel).toHaveBeenCalledTimes(1);
            expect(api.pause).not.toHaveBeenCalled();

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
            expect(api.play).toHaveBeenCalledTimes(2);   // the replay
        });

        it("offScreen 'continue' observes nothing at all and starts unseen", () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, { offScreen: 'continue' });

            // "Run wherever it is" also means "do not wait to be seen before starting".
            expect(io.observed).toBeNull();
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('a target TALLER than the viewport is normalized, so a 0.5 threshold is reachable', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, { visibilityThreshold: 0.5, visibilityDebounce: 0 });

            // 2000px graphic, 800px viewport: the raw ratio can never exceed 0.4, so an
            // un-normalized gate would never open. Normalized by what COULD be visible, 400px
            // showing is 0.5 and the gate opens.
            io.callback!([{
                isIntersecting: true,
                intersectionRatio: 0.2,
                boundingClientRect: { height: 2000 },
                intersectionRect: { height: 400 },
                rootBounds: { height: 800 },
            } as unknown as IOEntry]);

            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('a hidden TAB counts as off screen', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi({ isPlaying: vi.fn(() => true) });
            setupAnimationTriggers(api, { visibilityDebounce: 0 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
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

            setupAnimationTriggers(api, { start: 'load' });

            // Never "silently never plays": a page that cannot measure animates.
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it("start 'none' is gated too, so an API-started animation pauses off screen", () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi({ isPlaying: vi.fn(() => true) });
            setupAnimationTriggers(api, { start: 'none', visibilityDebounce: 0 });

            // Was "creates NO IntersectionObserver": the gate is about permission to RUN, which
            // applies however playback started — including a bare `play()` from the host.
            expect(io.observed).not.toBeNull();
            io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);
            expect(api.pause).toHaveBeenCalledTimes(1);
        });
    });

    // ── the debounce ────────────────────────────────────────────────────────────────

    describe('visibilityDebounce', () => {

        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it('a graphic scrolled straight past never plays a frame', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, {});   // default 150ms

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
            vi.advanceTimersByTime(100);
            expect(api.play).not.toHaveBeenCalled();

            io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);
            vi.advanceTimersByTime(1000);
            expect(api.play).not.toHaveBeenCalled();
        });

        it('one that stays plays when the dwell has elapsed, and not before', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, {});

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
            vi.advanceTimersByTime(149);
            expect(api.play).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('falling back BELOW the threshold abandons a pending start', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, { visibilityThreshold: 0.5 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.9 }]);
            io.callback!([{ isIntersecting: true, intersectionRatio: 0.2 }]);   // still visible, not enough
            vi.advanceTimersByTime(1000);

            expect(api.play).not.toHaveBeenCalled();
        });

        it('0 plays the moment the threshold is met', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, { visibilityDebounce: 0 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('a click plays immediately rather than waiting out a timer nobody can see', () => {
            stubIntersectionObserver();
            const { api, root } = createMockApi();
            setupAnimationTriggers(api, { start: 'click' });

            root.dispatchEvent(new Event('click'));

            expect(api.play).toHaveBeenCalledTimes(1);
        });
    });

    // ── behaviors pinned by the app's `trigger-explorer.spec.ts` integration suite,
    //    mirrored here so the LIB's own suite (this file) also guards them ─────────────

    it('repeated clicks keep toggling, and the toggle always reads the live playing state', () => {
        const { api, root } = createMockApi({
            isPlaying: vi.fn()
                .mockReturnValueOnce(false)  // 1st click: stopped → play
                .mockReturnValueOnce(true)   // 2nd click: playing → pause
                .mockReturnValueOnce(true),  // 3rd click: still reported playing → pause again
        });
        setupAnimationTriggers(api, { start: 'click' });

        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));

        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).toHaveBeenCalledTimes(2);
        expect(api.setPlaybackRate).not.toHaveBeenCalled();
    });

    it("mouseOver·reverse: re-enter during reverse playback restores FORWARD playback before play", () => {
        const order: Array<string> = [];
        const { api, root } = createMockApi({
            play: vi.fn(() => order.push('play')),
            setPlaybackRate: vi.fn((rate: number) => order.push('rate:' + rate)),
        });
        setupAnimationTriggers(api, { start: 'mouseOver', mouseOut: 'reverse' });

        root.dispatchEvent(new Event('mouseenter'));   // start (forward, no rate call)
        root.dispatchEvent(new Event('mouseleave'));   // reverse: rate -1, play
        root.dispatchEvent(new Event('mouseenter'));   // re-enter: rate 1 BEFORE play

        expect(order).toEqual(['play', 'rate:-1', 'play', 'rate:1', 'play']);
    });

    it('a plain (never-reversed) restart never touches the playback rate — custom API rates survive', () => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { start: 'mouseOver', mouseOut: 'pause' });

        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));
        root.dispatchEvent(new Event('mouseenter'));

        expect(api.setPlaybackRate).not.toHaveBeenCalled();
    });

    it("offScreen 'pause' then returning resumes from where it paused", () => {
        const io = stubIntersectionObserver();
        const { api } = createMockApi({ isPlaying: vi.fn(() => true) });
        setupAnimationTriggers(api, { offScreen: 'pause', visibilityDebounce: 0 });

        io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
        io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);
        io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);

        expect(api.pause).toHaveBeenCalledTimes(1);
        expect(api.cancel).not.toHaveBeenCalled();   // resume, never restart
        expect(api.play).toHaveBeenCalledTimes(2);
    });

    it("start 'load' before the document finishes loading: plays on the window 'load' event", () => {
        const readyStateSpy = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { api } = createMockApi();
        setupAnimationTriggers(api, { start: 'load' });

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
        const dispose = setupAnimationTriggers(api, { start: 'load' });

        expect(typeof dispose).toBe('function');
        expect(() => dispose()).not.toThrow();
        expect(api.play).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('the disposer detaches every listener it attached (review §14)', () => {
        const { api, root } = createMockApi();
        const dispose = setupAnimationTriggers(api, { start: 'mouseOver' });

        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);

        dispose();
        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);   // still 1 — the listener is gone
    });

    it('the disposer also disconnects the visibility observer', () => {
        const io = stubIntersectionObserver();
        const { api } = createMockApi();
        const dispose = setupAnimationTriggers(api, { start: 'load' });

        dispose();
        expect(io.disconnected).toBe(1);
    });
});
