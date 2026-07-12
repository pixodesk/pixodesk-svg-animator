/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupAnimationTriggers } from './PxAnimatorTriggers';
import type { PxAnimatorAPI } from './PxAnimatorTypes';


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

        it('observes the root and plays when intersecting at or above the default threshold', () => {
            const io = stubIntersectionObserver();
            const { api, root } = createMockApi();
            setupAnimationTriggers(api, { startOn: 'scrollIntoView', outAction: 'pause' });

            expect(io.observed).toBe(root);
            expect(io.options).toEqual({ threshold: 0.5 });

            io.callback!([{ isIntersecting: true, intersectionRatio: 0.7 }]);
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
