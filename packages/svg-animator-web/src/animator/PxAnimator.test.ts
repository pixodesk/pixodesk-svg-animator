/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnimator, generateNewIds, loadTagAnimators } from './PxAnimator';
import { PX_ANIM_ATTR_NAME } from '@pixodesk/svg-animator-core/internal';
import { PxDiagnosticCode, type PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';


const DUR = 320; // multiple of the 16ms fake-timer rAF step

/** Minimal frames-mode doc: one rect whose opacity animates 0 → 1 over DUR ms. */
function makeDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { timeline: { engine: 'js', duration: DUR } },
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

    it('throws when both `src` and `doc` are provided', () => {
        expect(() => createAnimator({ src: 'a.json', doc: makeDoc() })).toThrow();
    });

    it('throws when neither `src` nor `doc` is provided', () => {
        expect(() => createAnimator({})).toThrow();
    });

    it('doc path: returns a working API synchronously', () => {
        const api = createAnimator({ doc: makeDoc(), container: '#svg-container' });

        expect(api.isReady()).toBe(true);
        expect(container().querySelector('svg')).not.toBeNull();
        const rect = container().querySelector('rect')!;
        expect(rect).not.toBeNull();

        api.play();
        vi.advanceTimersByTime(DUR / 2);
        expect(parseFloat(rect.getAttribute('opacity')!)).toBeCloseTo(0.5, 5);
        expect(api.getCurrentTime()).toBe(DUR / 2);
    });

    it('takes the callbacks INLINE, and fires onStop after pause / finish (the same names as the components)', () => {
        const onPlay = vi.fn(), onPause = vi.fn(), onFinish = vi.fn(), onStop = vi.fn();
        const doc = makeDoc();
        doc.animator = { timeline: { engine: 'js', duration: DUR, trigger: { start: 'none' } } };
        const api = createAnimator({ doc, container: '#svg-container', onPlay, onPause, onFinish, onStop });

        api.play();
        expect(onPlay).toHaveBeenCalledTimes(1);
        expect(onStop).not.toHaveBeenCalled();     // play is the one thing that is NOT a stop

        api.pause();
        expect(onPause).toHaveBeenCalledTimes(1);
        expect(onStop).toHaveBeenCalledTimes(1);   // ...after pause

        api.finish();
        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(onStop).toHaveBeenCalledTimes(2);   // ...and after finish
    });

    it('a document with no trigger starts on load — start defaults to load', () => {
        const api = createAnimator({ doc: makeDoc(), container: '#svg-container' });
        expect(api.isPlaying()).toBe(true);
    });

    it('an explicit programmatic trigger still waits for play()', () => {
        const doc = makeDoc();
        doc.animator = { timeline: { engine: 'js', duration: DUR, trigger: { start: 'none' } } };
        const api = createAnimator({ doc: doc, container: '#svg-container' });
        expect(api.isPlaying()).toBe(false);
    });

    it('URL path: queues control calls made before the fetch resolves and replays them', async () => {
        // Explicitly programmatic: since review §2.1 a document with no trigger autostarts on
        // load, which would fire `onPlay` a second time and hide this test's subject — that a
        // control call made before the fetch resolves is queued and replayed exactly once.
        const doc = makeDoc();
        doc.animator = { timeline: { engine: 'js', duration: DUR, trigger: { start: 'none' } } };
        const fetchMock = stubFetch(doc);
        const onPlay = vi.fn();

        const api = createAnimator({ src: 'anim.json', onPlay, container: '#svg-container' });

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

        // The line carries the CODE and a link, not prose — the text is not in the bundle.
        expect(String(errorSpy.mock.calls[0][0])).toContain('PX' + PxDiagnosticCode.loadFailed);
        expect(String(errorSpy.mock.calls[0][0])).toContain('diagnostics.md');
        // The cause still has to be reported — it rides in the DATA now, printed after the code,
        // so this keeps what `expect.any(Error)` used to cover.
        expect(errorSpy.mock.calls[0].slice(1)).toContain('network down');
        expect(api.isReady()).toBe(false);
        expect(() => api.play()).not.toThrow(); // late calls are no-ops, not errors
    });

    it('URL path: invalid document format logs console.error and stays not ready', async () => {
        stubFetch({ hello: 'world' }); // not a px svg document
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* silence */ });

        const api = createAnimator({ src: 'weird.json', container: '#svg-container' });
        await flushMicrotasks();

        expect(String(errorSpy.mock.calls[0][0])).toContain('PX' + PxDiagnosticCode.invalidDocumentAtSrc);
        // Which file it was is DATA, where a sentence used to interpolate it.
        expect(errorSpy.mock.calls[0].slice(1)).toContain('weird.json');
        expect(api.isReady()).toBe(false);
        expect(container().querySelector('svg')).toBeNull();
    });

    // The rule (review §25.1): a player that cannot be built is an ERROR — reported once through
    // the channel, and the returned API stays inert. Never a throw at the caller.
    it('doc path: a player that cannot be built reports onError and stays inert — it never throws', () => {
        const onError = vi.fn();
        // A container whose `replaceChildren` throws stands in for anything breaking mid-construction.
        const broken = { replaceChildren: () => { throw new Error('boom'); } } as unknown as Element;

        const api = createAnimator({ doc: makeDoc(), container: broken, onError });

        expect(onError).toHaveBeenCalledTimes(1);
        const d = onError.mock.calls[0][0];
        expect(d.kind).toBe('internal');
        expect(d.code).toBe(PxDiagnosticCode.buildFailed);
        // The thrown Error is what carries 'boom' — the diagnostic itself carries a number.
        expect(d.error).toBeInstanceOf(Error);
        expect(d.error.message).toContain('boom');
        expect(api.isReady()).toBe(false);
        expect(() => api.play()).not.toThrow();   // inert, not broken
    });

    it('muteError switches the console fallback off for such a failure', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* silence */ });
        const broken = { replaceChildren: () => { throw new Error('boom'); } } as unknown as Element;

        createAnimator({ doc: makeDoc(), container: broken });
        expect(errorSpy).toHaveBeenCalledTimes(1);             // the console is the fallback…

        createAnimator({ doc: makeDoc(), container: broken, muteError: true });
        expect(errorSpy).toHaveBeenCalledTimes(1);             // …unless muted
    });
});


describe('generateNewIds', () => {

    function makeRefDoc(): PxAnimatedSvgDocument {
        return {
            type: 'svg',
            id: 'root1',
            animator: {
                definitions: { animations: { fade: {
                    opacity: { keyframes: [{ time: 0, value: 0 }, { time: 100, value: 1 }] },
                } } },
                bindings: [{ target: '#rect1', animateWith: ['fade'] }],
                timeline: {
                    duration: 100,
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
        expect(doc.animator!.bindings![0].target).toBe('#rect1');

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

    it('re-points animator.bindings targets at the new ids', () => {
        const out = generateNewIds(makeRefDoc());

        const newRectId = out.children![1].id as string;
        expect(out.animator!.bindings).toEqual([{ target: '#' + newRectId, animateWith: ['fade'] }]);
        // the named animation itself is untouched
        expect(out.animator!.definitions!.animations!.fade).toEqual({
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

    it('passes the same options createAnimator takes to EVERY player it creates (review §15)', async () => {
        document.body.innerHTML =
            '<div data-px-animation-src="a.json"></div><div data-px-animation-src="b.json"></div>';
        stubFetch(makeDoc());   // a document that would autoplay on load
        const onPlay = vi.fn();

        // A timeline override that cancels the autoplay, plus an inline callback — both must reach
        // both players. The zero-config path (no argument at all) is unchanged.
        loadTagAnimators({ timeline: { trigger: { start: 'none' } }, onPlay });
        await flushMicrotasks();

        const instances = Array.from(document.querySelectorAll('[data-px-animation-src]'))
            .map((el: any) => el[PX_ANIM_ATTR_NAME]);
        expect(instances).toHaveLength(2);
        for (const instance of instances) {
            expect(instance.isReady()).toBe(true);
            expect(instance.isPlaying()).toBe(false);   // the override reached it
        }

        instances[0].play();
        expect(onPlay).toHaveBeenCalledTimes(1);        // the callback reached it
    });
});

describe('destroy() and the rendered SVG', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="svg-container"></div>';
    });

    it('removes the SVG it rendered into the container', () => {
        const api = createAnimator({ doc: makeDoc(), container: '#svg-container' });
        expect(container().querySelector('svg')).not.toBeNull();

        api.destroy();

        // Documented contract: "stop, remove the SVG from the container, release everything".
        expect(container().querySelector('svg')).toBeNull();
    });

    it('leaves a root it did NOT render alone', () => {
        // No container: the caller owns whatever DOM exists (this is the React / Vue
        // adapter path). destroy() must not reach into it.
        container().innerHTML = '<svg id="mine"></svg>';
        const api = createAnimator({ doc: makeDoc() });

        api.destroy();

        expect(document.querySelector('#mine')).not.toBeNull();
    });
});
