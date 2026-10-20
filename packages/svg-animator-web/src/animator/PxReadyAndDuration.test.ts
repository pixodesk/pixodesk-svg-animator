/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// Review §14: `onReady` is the push twin of `isReady()` (no more polling with `src`), and
// `getDuration()` is the slider maximum nobody has to hard-code — ONE pass of the content
// window, ms.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimator } from '../index';
import type { PxDocumentInput } from '@pixodesk/svg-animator-core';

const DOC = {
    type: 'svg', viewBox: '0 0 10 10',
    animator: { timeline: { engine: 'js', inTime: 200, outTime: 1200 } },
    children: [{
        type: 'rect', id: 'r', width: 10, height: 10,
        animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1200, value: 1 }] } },
    }],
} as unknown as PxDocumentInput;

describe('onReady + getDuration (§14)', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="box"></div>'; vi.useFakeTimers(); });
    afterEach(() => vi.useRealTimers());

    it('getDuration is one pass of the content window, ms', () => {
        const api = createSvgAnimator({ doc: DOC, container: '#box' });
        expect(api.getDuration()).toBe(1000);           // outTime 1200 − inTime 200
    });

    it('onReady fires once, asynchronously — the create call has returned first', async () => {
        const order: Array<string> = [];
        const api = createSvgAnimator({ doc: DOC, container: '#box', onReady: () => order.push('ready:' + String(api.isReady())) });
        order.push('returned');
        await Promise.resolve();                        // run the microtask queue
        expect(order).toEqual(['returned', 'ready:true']);
    });

    it('with `src`, getDuration is null until the fetch lands, then onReady fires', async () => {
        const onReady = vi.fn();
        let resolveFetch: (v: unknown) => void = () => {};
        vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { resolveFetch = r; })));
        const api = createSvgAnimator({ src: '/a.json', container: '#box', onReady });
        expect(api.isReady()).toBe(false);
        expect(api.getDuration()).toBe(null);           // the push-twin claim: no polling needed

        resolveFetch({ json: () => Promise.resolve(JSON.parse(JSON.stringify(DOC))) });
        await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
        expect(api.getDuration()).toBe(1000);
        vi.unstubAllGlobals();
    });
});
