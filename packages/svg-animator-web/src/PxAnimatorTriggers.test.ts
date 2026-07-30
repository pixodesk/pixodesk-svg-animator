/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import type { PxAnimatorAPI } from './PxAnimatorWebTypes';


/** Mock PxAnimatorAPI backed by a real jsdom element as the root. */
function createMockApi(overrides: Partial<PxAnimatorAPI> = {}) {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const api: PxAnimatorAPI = {
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
        destroy: vi.fn(),
        ...overrides,
    };
    return { api, root };
}


describe('setupAnimationTriggers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("startOn 'load': plays immediately when document.readyState is complete", () => {
        expect(document.readyState).toBe('complete'); // jsdom precondition
        const { api } = createMockApi();

        setupAnimationTriggers(api, { startOn: 'load' });

        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it("startOn 'mouseOver': mouseenter plays", () => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { startOn: 'mouseOver' });

        expect(api.play).not.toHaveBeenCalled();
        root.dispatchEvent(new Event('mouseenter'));
        expect(api.play).toHaveBeenCalledTimes(1);
    });

    it.each([
        { outAction: 'pause' as const, expected: { pause: 1, cancel: 0, setPlaybackRate: 0, play: 1 } },
        { outAction: 'reset' as const, expected: { pause: 0, cancel: 1, setPlaybackRate: 0, play: 1 } },
        { outAction: 'reverse' as const, expected: { pause: 0, cancel: 0, setPlaybackRate: 1, play: 2 } },
        { outAction: 'continue' as const, expected: { pause: 0, cancel: 0, setPlaybackRate: 0, play: 1 } },
    ])("startOn 'mouseOver': mouseleave with outAction '$outAction'", ({ outAction, expected }) => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { startOn: 'mouseOver', outAction });

        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));

        expect(api.pause).toHaveBeenCalledTimes(expected.pause);
        expect(api.cancel).toHaveBeenCalledTimes(expected.cancel);
        expect(api.setPlaybackRate).toHaveBeenCalledTimes(expected.setPlaybackRate);
        expect(api.play).toHaveBeenCalledTimes(expected.play);
        if (outAction === 'reverse') {
            expect(api.setPlaybackRate).toHaveBeenCalledWith(-1);
        }
    });

    it("startOn 'click': toggles — plays when stopped, runs the out action when playing", () => {
        const { api, root } = createMockApi({
            isPlaying: vi.fn()
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true),
        });
        setupAnimationTriggers(api, { startOn: 'click', outAction: 'pause' });

        root.dispatchEvent(new Event('click'));
        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).not.toHaveBeenCalled();

        root.dispatchEvent(new Event('click'));
        expect(api.play).toHaveBeenCalledTimes(1);
        expect(api.pause).toHaveBeenCalledTimes(1);
    });

    it("startOn 'click' with outAction 'reverse': next start restores forward playback before play", () => {
        const order: string[] = [];
        const { api, root } = createMockApi({
            isPlaying: vi.fn()
                .mockReturnValueOnce(true)   // 1st click: playing → reverse out action
                .mockReturnValueOnce(false), // 2nd click: stopped → start
            play: vi.fn(() => order.push('play')),
            setPlaybackRate: vi.fn((rate: number) => order.push('rate:' + rate)),
        });
        setupAnimationTriggers(api, { startOn: 'click', outAction: 'reverse' });

        root.dispatchEvent(new Event('click')); // reverse: rate -1, then play
        root.dispatchEvent(new Event('click')); // start: rate restored to 1 BEFORE play

        expect(order).toEqual(['rate:-1', 'play', 'rate:1', 'play']);
    });

    it("startOn 'programmatic': nothing auto-starts and no listeners react", () => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { startOn: 'programmatic' });

        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('mouseenter'));

        expect(api.play).not.toHaveBeenCalled();
        expect(api.pause).not.toHaveBeenCalled();
        expect(api.cancel).not.toHaveBeenCalled();
    });

    describe("startOn 'scrollIntoView'", () => {

        type IOEntry = { isIntersecting: boolean; intersectionRatio: number };

        /** Stubs global IntersectionObserver; returns captured callback/options/observed. */
        function stubIntersectionObserver() {
            const captured: {
                callback: ((entries: IOEntry[]) => void) | null;
                options: any;
                observed: Element | null;
            } = { callback: null, options: null, observed: null };

            vi.stubGlobal('IntersectionObserver', class {
                constructor(cb: (entries: IOEntry[]) => void, options: any) {
                    captured.callback = cb;
                    captured.options = options;
                }
                observe(el: Element) { captured.observed = el; }
                unobserve() { /* noop */ }
                disconnect() { /* noop */ }
            });
            return captured;
        }

        it('observes the root; the DEFAULT threshold is 0 — any visible pixel plays', () => {
            const io = stubIntersectionObserver();
            const { api, root } = createMockApi();
            setupAnimationTriggers(api, { startOn: 'scrollIntoView', outAction: 'pause' });

            expect(io.observed).toBe(root);
            expect(io.options).toEqual({ threshold: 0 });

            // Keep in sync with the editor model's default
            // (TSvgSvgAnimationAttr.scrollIntoViewThreshold) — a barely-visible element starts.
            io.callback!([{ isIntersecting: true, intersectionRatio: 0.01 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });

        it('leaving the viewport triggers the out action', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, { startOn: 'scrollIntoView', outAction: 'pause' });

            io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
            io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);

            expect(api.play).toHaveBeenCalledTimes(1);
            expect(api.pause).toHaveBeenCalledTimes(1);
        });

        it('honours scrollIntoViewThreshold: intersecting below the threshold does not play', () => {
            const io = stubIntersectionObserver();
            const { api } = createMockApi();
            setupAnimationTriggers(api, { startOn: 'scrollIntoView', scrollIntoViewThreshold: 0.8 });

            expect(io.options).toEqual({ threshold: 0.8 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.6 }]);
            expect(api.play).not.toHaveBeenCalled();

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.9 }]);
            expect(api.play).toHaveBeenCalledTimes(1);
        });
    });

    // ── behaviours pinned by the app's `trigger-explorer.spec.ts` integration suite,
    //    mirrored here so the LIB's own suite (this file) also guards them ─────────────

    it('click DURING reverse playback is another OUT, not a start (the toggle sees "playing")', () => {
        const { api, root } = createMockApi({
            isPlaying: vi.fn()
                .mockReturnValueOnce(false)  // 1st click: stopped → start
                .mockReturnValueOnce(true)   // 2nd click: playing → reverse
                .mockReturnValueOnce(true),  // 3rd click: REVERSING still counts as playing → out again
        });
        setupAnimationTriggers(api, { startOn: 'click', outAction: 'reverse' });

        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));
        root.dispatchEvent(new Event('click'));

        // start ran once; both later clicks applied the reverse out-action.
        expect(api.setPlaybackRate).toHaveBeenCalledTimes(2);
        expect(api.setPlaybackRate).toHaveBeenNthCalledWith(1, -1);
        expect(api.setPlaybackRate).toHaveBeenNthCalledWith(2, -1);
        expect(api.play).toHaveBeenCalledTimes(3);   // start + 2 reverse-plays
    });

    it("mouseOver·reverse: re-enter during reverse playback restores FORWARD playback before play", () => {
        const order: string[] = [];
        const { api, root } = createMockApi({
            play: vi.fn(() => order.push('play')),
            setPlaybackRate: vi.fn((rate: number) => order.push('rate:' + rate)),
        });
        setupAnimationTriggers(api, { startOn: 'mouseOver', outAction: 'reverse' });

        root.dispatchEvent(new Event('mouseenter'));   // start (forward, no rate call)
        root.dispatchEvent(new Event('mouseleave'));   // reverse: rate -1, play
        root.dispatchEvent(new Event('mouseenter'));   // re-enter: rate 1 BEFORE play

        expect(order).toEqual(['play', 'rate:-1', 'play', 'rate:1', 'play']);
    });

    it('a plain (never-reversed) restart never touches the playback rate — custom API rates survive', () => {
        const { api, root } = createMockApi();
        setupAnimationTriggers(api, { startOn: 'mouseOver', outAction: 'pause' });

        root.dispatchEvent(new Event('mouseenter'));
        root.dispatchEvent(new Event('mouseleave'));
        root.dispatchEvent(new Event('mouseenter'));

        expect(api.setPlaybackRate).not.toHaveBeenCalled();
    });

    it("startOn 'programmatic' creates NO IntersectionObserver (nothing to observe)", () => {
        const ctor = vi.fn();
        vi.stubGlobal('IntersectionObserver', class {
            constructor() { ctor(); }
            observe() { /* noop */ }
            unobserve() { /* noop */ }
            disconnect() { /* noop */ }
        });
        const { api } = createMockApi();
        setupAnimationTriggers(api, { startOn: 'programmatic' });
        expect(ctor).not.toHaveBeenCalled();
    });

    it('scrollIntoView·reverse: leaving the viewport reverses playback', () => {
        const io = (function stub() {
            const captured: { callback: ((entries: Array<{ isIntersecting: boolean; intersectionRatio: number }>) => void) | null } = { callback: null };
            vi.stubGlobal('IntersectionObserver', class {
                constructor(cb: (entries: Array<{ isIntersecting: boolean; intersectionRatio: number }>) => void) { captured.callback = cb; }
                observe() { /* noop */ }
                unobserve() { /* noop */ }
                disconnect() { /* noop */ }
            });
            return captured;
        })();
        const { api } = createMockApi();
        setupAnimationTriggers(api, { startOn: 'scrollIntoView', outAction: 'reverse' });

        io.callback!([{ isIntersecting: true, intersectionRatio: 1 }]);
        io.callback!([{ isIntersecting: false, intersectionRatio: 0 }]);

        expect(api.setPlaybackRate).toHaveBeenCalledWith(-1);
        expect(api.play).toHaveBeenCalledTimes(2);   // start + reverse-play
    });

    it("startOn 'load' before the document finishes loading: plays on the window 'load' event", () => {
        const readyStateSpy = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
        const { api } = createMockApi();
        setupAnimationTriggers(api, { startOn: 'load' });

        expect(api.play).not.toHaveBeenCalled();
        window.dispatchEvent(new Event('load'));
        expect(api.play).toHaveBeenCalledTimes(1);
        readyStateSpy.mockRestore();
    });

    it('warns and returns the api unchanged when there is no root element', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { /* silence */ });
        const { api } = createMockApi({ getRootElement: vi.fn(() => null) });

        const res = setupAnimationTriggers(api, { startOn: 'load' });

        expect(res).toBe(api);
        expect(api.play).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
