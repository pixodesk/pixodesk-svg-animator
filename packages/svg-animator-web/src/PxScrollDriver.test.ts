/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// DOM-side behaviour of the scroll driver (the pure math is covered in core
// `PxScrollMath.test.ts`): attach/emit/coalesce/teardown, scroller resolution, and the
// `kind: 'scroll'` offset path. jsdom has no layout, so sizes/rects are stubbed.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScrollDriver } from './PxScrollDriver';


// rAF stub: collect callbacks, flush on demand — deterministic, no timers involved.
let rafQueue: Array<FrameRequestCallback> = [];
const flushRaf = () => {
    const q = rafQueue; rafQueue = [];
    for (const cb of q) cb(0);
};

beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { /* queue is rebuilt each flush */ });
});
afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    for (const el of [document.body, document.documentElement] as Array<Element>) {
        for (const prop of ['scrollHeight', 'clientHeight']) {
            if (Object.getOwnPropertyDescriptor(el, prop)) delete (el as unknown as Record<string, unknown>)[prop];
        }
    }
});

/** A scrollable container stub: jsdom reports 0 for all layout metrics, so define them. */
function makeScroller(opts: { scrollHeight: number; clientHeight: number }): HTMLElement {
    const el = document.createElement('div');
    el.style.overflowY = 'scroll';
    Object.defineProperty(el, 'scrollHeight', { value: opts.scrollHeight, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: opts.clientHeight, configurable: true });
    document.body.appendChild(el);
    return el;
}

const rectOf = (top: number, height: number): DOMRect => ({
    top, left: 0, width: 400, height, right: 400, bottom: top + height, x: 0, y: top, toJSON: () => ({}),
} as DOMRect);

function stubMetrics(el: Element, metrics: Record<string, number>): void {
    for (const [k, value] of Object.entries(metrics)) Object.defineProperty(el, k, { value, configurable: true });
}

describe('createScrollDriver', () => {

    it('returns null for a non-scroll document', () => {
        const subject = document.createElement('div');
        document.body.appendChild(subject);
        expect(createScrollDriver(subject, undefined, () => {})).toBeNull();
        expect(createScrollDriver(subject, { timelineSource: 'time' }, () => {})).toBeNull();
    });

    it("kind:'scroll' — emits initial progress, follows scrollTop, coalesces to one tick", () => {
        const scroller = makeScroller({ scrollHeight: 1400, clientHeight: 400 });  // maxOffset 1000
        const subject = document.createElement('svg');
        scroller.appendChild(subject);

        const seen: Array<number> = [];
        const driver = createScrollDriver(
            subject,
            { timelineSource: 'scroll', scroll: { kind: 'scroll' } },
            p => seen.push(p),
        )!;
        expect(driver).toBeTruthy();
        expect(seen).toEqual([0]);                       // initial emit at current position

        scroller.scrollTop = 250;
        // Three events in one frame → ONE measurement.
        scroller.dispatchEvent(new Event('scroll'));
        scroller.dispatchEvent(new Event('scroll'));
        scroller.dispatchEvent(new Event('scroll'));
        flushRaf();
        expect(seen.length).toBe(2);
        expect(seen[1]).toBeCloseTo(0.25);

        scroller.scrollTop = 1000;
        scroller.dispatchEvent(new Event('scroll'));
        flushRaf();
        expect(seen[2]).toBe(1);

        // Scroll BACK — scrubbing is bidirectional.
        scroller.scrollTop = 500;
        scroller.dispatchEvent(new Event('scroll'));
        flushRaf();
        expect(seen[3]).toBeCloseTo(0.5);

        driver.destroy();
        scroller.scrollTop = 0;
        scroller.dispatchEvent(new Event('scroll'));
        flushRaf();
        expect(seen.length).toBe(4);                     // detached — no further emits
    });

    it("kind:'scroll' with range slices the scroll distance", () => {
        const scroller = makeScroller({ scrollHeight: 1400, clientHeight: 400 });
        const subject = document.createElement('svg');
        scroller.appendChild(subject);

        const seen: Array<number> = [];
        scroller.scrollTop = 500;   // raw 0.5 → mid of [0.25, 0.75]
        createScrollDriver(subject, {
            timelineSource: 'scroll',
            scroll: { kind: 'scroll', range: { start: { fraction: 0.25 }, end: { fraction: 0.75 } } },
        }, p => seen.push(p));
        expect(seen[0]).toBeCloseTo(0.5);
    });

    it("kind:'view' — progress from subject/scrollport rects", () => {
        const scroller = makeScroller({ scrollHeight: 2000, clientHeight: 400 });
        const subject = document.createElement('svg');
        scroller.appendChild(subject);

        // Stub the rects: scrollport at y=0 h=400; subject 100 tall, top at 150
        // → u = 400 − 150 = 250 of cover [0, 500] → 0.5.
        scroller.getBoundingClientRect = () => ({ top: 0, left: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
        Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true });
        subject.getBoundingClientRect = () => ({ top: 150, left: 0, width: 100, height: 100, right: 100, bottom: 250, x: 0, y: 150, toJSON: () => ({}) } as DOMRect);

        const seen: Array<number> = [];
        createScrollDriver(subject, { timelineSource: 'scroll' /* view is the default kind */ }, p => seen.push(p));
        expect(seen[0]).toBeCloseTo(0.5);
    });

    // REGRESSION (found by #trigger-explorer's scroll-timeline rows): CSS propagates the
    // body's overflow to the VIEWPORT, so `body { overflow-y: auto }` computes as `auto`
    // while the body is not a scroll container at all — its scrollTop stays 0 and its rect
    // is the whole content box. Treating it as the scroller froze `view` progress at a
    // fixed mid-value and pinned `scroll` progress at 1 (maxOffset 0).
    describe('body/html are never the scroller — the viewport is', () => {

        it("kind:'view' measures the viewport, not the body's content box", () => {
            document.body.style.overflowY = 'auto';
            stubMetrics(document.body, { scrollHeight: 760, clientHeight: 760 });
            document.body.getBoundingClientRect = () => rectOf(0, 760);
            stubMetrics(document.documentElement, { clientHeight: 200 });   // 200px-tall viewport

            const subject = document.createElement('svg');
            document.body.appendChild(subject);
            subject.getBoundingClientRect = () => rectOf(300, 200);   // 300px down: below the fold

            const seen: Array<number> = [];
            createScrollDriver(subject, { timelineSource: 'scroll' }, p => seen.push(p));
            // u = vpH − sTop = 200 − 300 = −100 → before `cover` starts → progress 0.
            // (Measured against the BODY it was u = 760 − 300 = 460 of [0, 960] ≈ 0.48.)
            expect(seen[0]).toBe(0);
        });

        it("kind:'scroll' measures the document scroller, not the unscrollable body", () => {
            document.body.style.overflowY = 'auto';
            stubMetrics(document.body, { scrollHeight: 760, clientHeight: 760 });   // maxOffset 0 → progress 1
            stubMetrics(document.documentElement, { scrollHeight: 760, clientHeight: 200 });   // maxOffset 560

            const subject = document.createElement('svg');
            document.body.appendChild(subject);
            document.documentElement.scrollTop = 140;

            const seen: Array<number> = [];
            createScrollDriver(subject, { timelineSource: 'scroll', scroll: { kind: 'scroll' } }, p => seen.push(p));
            expect(seen[0]).toBeCloseTo(140 / 560);
        });
    });

    it('trigger config on a scroll document is ignored by the driver layer (D3 — no crash, no listeners needed)', () => {
        const scroller = makeScroller({ scrollHeight: 800, clientHeight: 400 });
        const subject = document.createElement('svg');
        scroller.appendChild(subject);
        const seen: Array<number> = [];
        const driver = createScrollDriver(subject, {
            timelineSource: 'scroll',
            scroll: { kind: 'scroll' },
            trigger: { startOn: 'click' },   // must have no effect
        }, p => seen.push(p));
        expect(driver).toBeTruthy();
        expect(seen.length).toBe(1);
    });
});
