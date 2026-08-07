/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimator, generateNewIds, loadTagAnimators } from './PxAnimator';
import { PX_ANIM_ATTR_NAME } from '@pixodesk/svg-animator-core';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';


const DUR = 320; // multiple of the 16ms fake-timer rAF step

/** Minimal frames-mode doc: one rect whose opacity animates 0 → 1 over DUR ms. */
function makeDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { mode: 'frames', duration: DUR },
        children: [
            {
                type: 'rect',
                id: 'r1',
                opacity: 0,
                animate: {
                    opacity: {
                        keyframes: [
                            { time: 0, value: 0 },
                            { time: DUR, value: 1 },
                        ],
                    },
                },
            },
        ],
    };
}

/** Drains the promise chain behind fetch().then(json).then(create). */
async function flushMicrotasks(turns = 10) {
    for (let i = 0; i < turns; i++) await Promise.resolve();
}

/** Stubs global fetch to resolve with the given JSON payload. */
function stubFetch(json: unknown) {
    const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve(json) }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function container(): Element {
    return document.querySelector('#svg-container')!;
}


describe('createAnimator', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="svg-container"></div>';
        // 'performance' must be faked alongside requestAnimationFrame: with the
        // default toFake set, jsdom's rAF stops firing from the second test in
        // a file onwards (rAF scheduling is driven by performance.now()).
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('throws when both `src` and `data` are provided', () => {
        expect(() => createAnimator({ src: 'a.json', data: makeDoc() })).toThrow();
    });

    it('throws when neither `src` nor `data` is provided', () => {
        expect(() => createAnimator({})).toThrow();
    });

    it('data path: returns a working API synchronously', () => {
        const api = createAnimator({ data: makeDoc(), container: '#svg-container' });

        expect(api.isReady()).toBe(true);
        expect(container().querySelector('svg')).not.toBeNull();
        const rect = container().querySelector('rect')!;
        expect(rect).not.toBeNull();

        api.play();
        vi.advanceTimersByTime(DUR / 2);
        expect(parseFloat(rect.getAttribute('opacity')!)).toBeCloseTo(0.5, 5);
        expect(api.getCurrentTime()).toBe(DUR / 2);
    });

    it('URL path: queues control calls made before the fetch resolves and replays them', async () => {
        const fetchMock = stubFetch(makeDoc());
        const onPlay = vi.fn();

        const api = createAnimator({ src: 'anim.json', callbacks: { onPlay }, container: '#svg-container' });

        // Not loaded yet: getters return their "not ready" values.
        expect(api.isReady()).toBe(false);
        expect(api.getCurrentTime()).toBeNull();
        expect(api.isPlaying()).toBe(false);
        expect(container().querySelector('svg')).toBeNull();

        // Queue calls before the document loads.
        api.play();
        api.setCurrentTime(160);
        expect(onPlay).not.toHaveBeenCalled();

        await flushMicrotasks();

        expect(fetchMock).toHaveBeenCalledWith('anim.json');
        expect(api.isReady()).toBe(true);
        expect(onPlay).toHaveBeenCalledTimes(1); // queued play() was replayed
        expect(api.getCurrentTime()).toBe(160);  // queued setCurrentTime() was replayed in order
        expect(container().querySelector('svg')).not.toBeNull();

        // The replayed play() left the animation running from t=160.
        vi.advanceTimersByTime(80);
        const rect = container().querySelector('rect')!;
        expect(parseFloat(rect.getAttribute('opacity')!)).toBeCloseTo(240 / DUR, 5);
    });

    it('URL path: destroy() before load prevents creation', async () => {
        stubFetch(makeDoc());

        const api = createAnimator({ src: 'anim.json', container: '#svg-container' });
        api.play(); // queued — must be dropped by destroy()
        api.destroy();

        await flushMicrotasks();

        expect(api.isReady()).toBe(false);
        expect(container().innerHTML).toBe(''); // nothing was rendered
    });

    it('URL path: fetch rejection logs console.error and does not throw', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))));
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* silence */ });

        const api = createAnimator({ src: 'broken.json', container: '#svg-container' });
        api.play(); // queued, then dropped on failure

        await flushMicrotasks();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to load'), expect.any(Error));
        expect(api.isReady()).toBe(false);
        expect(() => api.play()).not.toThrow(); // late calls are no-ops, not errors
    });

    it('URL path: invalid document format logs console.error and stays not ready', async () => {
        stubFetch({ hello: 'world' }); // not a px svg document
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* silence */ });

        const api = createAnimator({ src: 'weird.json', container: '#svg-container' });
        await flushMicrotasks();

        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('invalid animation document format'));
        expect(api.isReady()).toBe(false);
        expect(container().querySelector('svg')).toBeNull();
    });
});


describe('generateNewIds', () => {

    function makeRefDoc(): PxAnimatedSvgDocument {
        return {
            type: 'svg',
            id: 'root1',
            animator: {
                duration: 100,
                animateById: {
                    'rect1': {
                        opacity: { keyframes: [{ time: 0, value: 0 }, { time: 100, value: 1 }] },
                    },
                },
            },
            children: [
                {
                    type: 'defs',
                    children: [{ type: 'linearGradient', id: 'grad1', children: [] }],
                },
                { type: 'rect', id: 'rect1', fill: 'url(#grad1)' },
                { type: 'use', href: '#rect1' },
            ],
        };
    }

    it('regenerates all ids and does not mutate the original document', () => {
        const doc = makeRefDoc();
        const out = generateNewIds(doc);

        expect(out).not.toBe(doc);
        // Original untouched.
        expect(doc.id).toBe('root1');
        expect(doc.children![1].id).toBe('rect1');
        expect(Object.keys(doc.animator!.animateById!)).toEqual(['rect1']);

        // All ids regenerated with the _px_ prefix.
        const newRectId = out.children![1].id as string;
        const newGradId = out.children![0].children![0].id as string;
        expect(out.id).not.toBe('root1');
        expect(newRectId).not.toBe('rect1');
        expect(newRectId).toMatch(/^_px_/);
        expect(newGradId).not.toBe('grad1');
        expect(newGradId).toMatch(/^_px_/);
        // Repeated calls produce different ids.
        expect(generateNewIds(doc).children![1].id).not.toBe(newRectId);
    });

    it('updates href="#id" and url(#id) references to the new ids', () => {
        const out = generateNewIds(makeRefDoc());

        const newRectId = out.children![1].id as string;
        const newGradId = out.children![0].children![0].id as string;

        expect(out.children![2].href).toBe('#' + newRectId);
        expect(out.children![1].fill).toBe('url(#' + newGradId + ')');
    });

    it('remaps animator.animateById keys to the new ids', () => {
        const out = generateNewIds(makeRefDoc());

        const newRectId = out.children![1].id as string;
        const animate = out.animator!.animateById!;
        expect(Object.keys(animate)).toEqual([newRectId]);
        expect(animate[newRectId]).toEqual({
            opacity: { keyframes: [{ time: 0, value: 0 }, { time: 100, value: 1 }] },
        });
    });
});


describe('loadTagAnimators', () => {
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('creates an animator for elements with data-px-animation-src and stores it on the element', async () => {
        document.body.innerHTML = '<div id="host" data-px-animation-src="anim.json"></div><div id="plain"></div>';
        const fetchMock = stubFetch(makeDoc());

        loadTagAnimators();

        const host = document.getElementById('host') as any;
        const plain = document.getElementById('plain') as any;
        const instance = host[PX_ANIM_ATTR_NAME];
        expect(instance).toBeDefined();
        expect(typeof instance.play).toBe('function');
        expect(plain[PX_ANIM_ATTR_NAME]).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledWith('anim.json');

        // A second scan must not replace the existing animator.
        loadTagAnimators();
        expect(host[PX_ANIM_ATTR_NAME]).toBe(instance);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Once the document loads, the svg is rendered into the tag element.
        await flushMicrotasks();
        expect(instance.isReady()).toBe(true);
        expect(host.querySelector('svg')).not.toBeNull();
    });
});
