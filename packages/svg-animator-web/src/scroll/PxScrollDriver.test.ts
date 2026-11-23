/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// DOM-side behavior of the scroll driver (the pure math is covered in core
// `PxScrollMath.test.ts`): what each `follows` word resolves to, attach/emit/coalesce/teardown, the per-frame
// measuring near the screen (D8), holding on screen, and the browser's own timeline. jsdom has no layout, so
// sizes/rects are stubbed.

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { PxDiagnosticCode, PxScrollAxis, PxScrollFollows, PxScrollMoment, PxTimelineEngineSetting, type PxAnimatorRuntimeConfig, type PxDiagnostics } from '@pixodesk/svg-animator-core';
import { createDiagnostics, type PxScrollSettings } from '@pixodesk/svg-animator-core/internal';
import { applyHoldOnScreen, createNativeScrollTimeline, createScrollDriver, resolveFollowedElement, resolveScrollSource } from './PxScrollDriver';


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
            if (Object.getOwnPropertyDescriptor(el, prop)) Reflect.deleteProperty(el, prop);
        }
    }
    document.documentElement.scrollTop = 0;
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

/** A scroll timeline's runtime view with these settings. */
const scrollConfig = (scroll: PxScrollSettings, more: PxAnimatorRuntimeConfig = {}): PxAnimatorRuntimeConfig =>
    ({ timelineSource: 'scroll', scroll, ...more });

/** A box 400 px tall at the top of the page that scrolls — its rect stubbed for the element words. */
function makeScreenBox(): HTMLElement {
    const box = makeScroller({ scrollHeight: 2000, clientHeight: 400 });
    box.getBoundingClientRect = () => rectOf(0, 400);
    stubMetrics(box, { clientWidth: 400 });
    return box;
}

describe('createScrollDriver', () => {

    it('returns null for a non-scroll document', () => {
        const subject = document.createElement('div');
        document.body.appendChild(subject);
        expect(createScrollDriver(subject, undefined, () => {})).toBeNull();
        expect(createScrollDriver(subject, { timelineSource: 'time' }, () => {})).toBeNull();
    });

    it('containerScroll — emits initial progress, follows scrollTop, coalesces to one tick', () => {
        const scroller = makeScroller({ scrollHeight: 1400, clientHeight: 400 });  // maxOffset 1000
        const subject = document.createElement('svg');
        scroller.appendChild(subject);

        const seen: Array<number> = [];
        const driver = createScrollDriver(subject, scrollConfig({ follows: PxScrollFollows.containerScroll }), p => seen.push(p));
        expect(driver).toBeTruthy();
        assert(driver, 'no scroll driver was created');
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

    it('containerScroll with { scrolled } moments slices the scroll distance', () => {
        const scroller = makeScroller({ scrollHeight: 1400, clientHeight: 400 });
        const subject = document.createElement('svg');
        scroller.appendChild(subject);

        const seen: Array<number> = [];
        scroller.scrollTop = 500;   // raw 0.5 → mid of [0.25, 0.75]
        createScrollDriver(subject, scrollConfig({
            follows: PxScrollFollows.containerScroll, firstFrameWhen: { scrolled: 0.25 }, lastFrameWhen: { scrolled: 0.75 },
        }), p => seen.push(p));
        expect(seen[0]).toBeCloseTo(0.5);
    });

    it('thisElement (the default) — progress from the element\'s and its screen\'s rects', () => {
        const scroller = makeScreenBox();
        const subject = document.createElement('svg');
        scroller.appendChild(subject);

        // Screen at y=0 h=400; the element 100 tall, top at 150 → u = 400 − 150 = 250 of [0, 500] → 0.5.
        subject.getBoundingClientRect = () => rectOf(150, 100);

        const seen: Array<number> = [];
        createScrollDriver(subject, { timelineSource: 'scroll' /* thisElement is the default */ }, p => seen.push(p));
        expect(seen[0]).toBeCloseTo(0.5);
    });

    // REGRESSION (found by #trigger-explorer's scroll-timeline rows): CSS propagates the
    // body's overflow to the VIEWPORT, so `body { overflow-y: auto }` computes as `auto`
    // while the body is not a scroll container at all — its scrollTop stays 0 and its rect
    // is the whole content box. Treating it as the scroller froze an element's progress at a
    // fixed mid-value and pinned a scrolled amount at 1 (maxOffset 0).
    describe('body/html are never the scroller — the viewport is', () => {

        it("an element word measures the viewport, not the body's content box", () => {
            document.body.style.overflowY = 'auto';
            stubMetrics(document.body, { scrollHeight: 760, clientHeight: 760 });
            document.body.getBoundingClientRect = () => rectOf(0, 760);
            stubMetrics(document.documentElement, { clientHeight: 200 });   // 200px-tall viewport

            const subject = document.createElement('svg');
            document.body.appendChild(subject);
            subject.getBoundingClientRect = () => rectOf(300, 200);   // 300px down: below the fold

            const seen: Array<number> = [];
            createScrollDriver(subject, { timelineSource: 'scroll' }, p => seen.push(p));
            // u = vpH − sTop = 200 − 300 = −100 → before it appears → progress 0.
            // (Measured against the BODY it was u = 760 − 300 = 460 of [0, 960] ≈ 0.48.)
            expect(seen[0]).toBe(0);
        });

        it('containerScroll with no box around it measures the document scroller, not the unscrollable body', () => {
            document.body.style.overflowY = 'auto';
            stubMetrics(document.body, { scrollHeight: 760, clientHeight: 760 });   // maxOffset 0 → progress 1
            stubMetrics(document.documentElement, { scrollHeight: 760, clientHeight: 200 });   // maxOffset 560

            const subject = document.createElement('svg');
            document.body.appendChild(subject);
            document.documentElement.scrollTop = 140;

            const seen: Array<number> = [];
            createScrollDriver(subject, scrollConfig({ follows: PxScrollFollows.containerScroll }), p => seen.push(p));
            expect(seen[0]).toBeCloseTo(140 / 560);
        });
    });

    // `follows` — WHICH element's place, or which scroller's amount, is followed. Without the moving ancestor a HELD
    // graphic freezes: a stuck element's rect stops moving, so its own "journey" stalls for exactly the stretch that
    // should be animating.
    describe('follows — what each word resolves to', () => {

        it("parentElement skips a sticky ancestor and follows the wrapper that really scrolls", () => {
            const wrapper = document.createElement('div');          // the tall, scrolling one
            const sticky = document.createElement('div');
            sticky.style.position = 'sticky';
            const box = document.createElement('div');               // the player's container
            const svg = document.createElement('svg');
            document.body.append(wrapper);
            wrapper.append(sticky);
            sticky.append(box);
            box.append(svg);

            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.parentDomElement })).toBe(wrapper);
        });

        it("parentElement with nothing held is just the element's own parent", () => {
            const box = document.createElement('div');
            const svg = document.createElement('svg');
            document.body.append(box);
            box.append(svg);

            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.parentDomElement })).toBe(box);
        });

        it('containerScroll resolves to the scroll container around the animation', () => {
            const scroller = makeScroller({ scrollHeight: 900, clientHeight: 300 });
            const svg = document.createElement('svg');
            scroller.append(svg);

            expect(resolveScrollSource(svg, { follows: PxScrollFollows.containerScroll })).toBe(scroller);
        });

        it('pageElement + selector resolves to the matching element', () => {
            const section = document.createElement('section');
            section.id = 'story';
            const svg = document.createElement('svg');
            document.body.append(section, svg);

            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.pageDomElement, selector: '#story' })).toBe(section);
        });

        it('an unresolvable selector WARNS and falls back to the svg (never a silent freeze)', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const svg = document.createElement('svg');
            document.body.append(svg);

            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.pageDomElement, selector: '#nope' })).toBe(svg);
            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.pageDomElement, selector: '!!not a selector!!' })).toBe(svg);
            expect(warn).toHaveBeenCalledTimes(2);
            warn.mockRestore();
        });

        it('hands the resolved element to the browser-native ViewTimeline too', () => {
            const section = document.createElement('section');
            section.id = 'story';
            const svg = document.createElement('svg');
            document.body.append(section, svg);

            const seenOptions: Array<Record<string, unknown>> = [];
            class FakeViewTimeline {
                constructor(options: Record<string, unknown>) { seenOptions.push(options); }
            }
            vi.stubGlobal('ViewTimeline', FakeViewTimeline);
            stubCssPercent();

            const native = createNativeScrollTimeline(svg, scrollConfig({ follows: PxScrollFollows.pageDomElement, selector: '#story' }));
            expect(native).toBeTruthy();
            expect(seenOptions[0].subject).toBe(section);
        });

        it('drives progress from the FOLLOWED element, not the animated one', () => {
            const scroller = makeScreenBox();
            const section = document.createElement('section');
            section.id = 'story';
            const svg = document.createElement('svg');
            scroller.append(section);
            section.append(svg);

            // The animated svg is parked out of range; the SECTION is mid-journey.
            svg.getBoundingClientRect = () => rectOf(4000, 100);
            section.getBoundingClientRect = () => rectOf(150, 100);   // u = 400−150 = 250 of [0,500]

            const seen: Array<number> = [];
            createScrollDriver(svg, scrollConfig({ follows: PxScrollFollows.pageDomElement, selector: '#story' }), p => seen.push(p));
            expect(seen[0]).toBeCloseTo(0.5);
        });

        it('thisElement and no follows resolve to the animation itself', () => {
            const box = document.createElement('div');
            const svg = document.createElement('svg');
            document.body.append(box);
            box.append(svg);

            expect(resolveFollowedElement(svg, {})).toBe(svg);
            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.thisDomElement })).toBe(svg);
        });

        it('pageScroll resolves to the page\'s scroller, even inside a scrolling box', () => {
            const scroller = makeScroller({ scrollHeight: 900, clientHeight: 300 });
            const svg = document.createElement('svg');
            scroller.append(svg);

            expect(resolveScrollSource(svg, { follows: PxScrollFollows.pageScroll })).toBe(document.scrollingElement ?? document.documentElement);
        });

        it('containerScroll + selector resolves to the named box; a selector that matches nothing warns (1304) and falls back to the box around', () => {
            const near = makeScroller({ scrollHeight: 900, clientHeight: 300 });
            const named = makeScroller({ scrollHeight: 900, clientHeight: 300 });
            named.id = 'panel';
            const svg = document.createElement('svg');
            near.append(svg);

            expect(resolveScrollSource(svg, { follows: PxScrollFollows.containerScroll, selector: '#panel' })).toBe(named);

            const codes: Array<PxDiagnosticCode> = [];
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const fallback = resolveScrollSource(svg, { follows: PxScrollFollows.containerScroll, selector: '#gone' }, recordingDiag(codes));
            warn.mockRestore();
            expect(fallback).toBe(near);
            expect(codes).toEqual([PxDiagnosticCode.scrollSubjectNoMatch]);
        });

        it('an invalid selector warns 1303 and falls back to the animation itself', () => {
            const svg = document.createElement('svg');
            document.body.append(svg);
            const codes: Array<PxDiagnosticCode> = [];
            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.pageDomElement, selector: '!!' }, recordingDiag(codes))).toBe(svg);
            expect(codes).toEqual([PxDiagnosticCode.scrollSubjectInvalid]);
        });

        it('an element handed over by page code wins over the selector', () => {
            const section = document.createElement('section');
            section.id = 'story';
            const handed = document.createElement('article');
            const svg = document.createElement('svg');
            document.body.append(section, handed, svg);

            expect(resolveFollowedElement(svg, { follows: PxScrollFollows.pageDomElement, selector: '#story' }, undefined, handed)).toBe(handed);
            // …and a file that follows a scroll is made to follow the element (`pageDomElement`) — its place drives progress
            const box = makeScreenBox();
            box.append(handed);
            handed.getBoundingClientRect = () => rectOf(150, 100);
            svg.getBoundingClientRect = () => rectOf(4000, 100);
            const seen: Array<number> = [];
            createScrollDriver(svg, scrollConfig({ follows: PxScrollFollows.pageScroll }), p => seen.push(p), undefined, handed);
            expect(seen[0]).toBeCloseTo(0.5);
        });

        it('held: the held section is followed — follows, selector and a handed-over element are not used', () => {
            const section = document.createElement('section');
            section.id = 'story';
            const box = document.createElement('div');
            const svg = document.createElement('svg');
            document.body.append(section, box);
            box.append(svg);

            const held: PxScrollSettings = { holdOnScreen: true, follows: PxScrollFollows.pageDomElement, selector: '#story' };
            expect(resolveFollowedElement(svg, held)).toBe(box);
            expect(resolveFollowedElement(svg, held, undefined, section)).toBe(box);
        });
    });

    // "The screen" is the scrolling box around the FOLLOWED element — not the one around the animation.
    it('the screen is the box around the followed element, wherever the animation is', () => {
        const box = makeScreenBox();
        box.getBoundingClientRect = () => rectOf(1000, 400);       // the box sits 1000 px down the page
        const section = document.createElement('section');
        section.id = 'story';
        box.append(section);
        section.getBoundingClientRect = () => rectOf(1150, 100);   // 150 px into the box → 0.5 of its journey there
        const svg = document.createElement('svg');
        document.body.append(svg);                                  // the animation is in the page, not in the box
        svg.getBoundingClientRect = () => rectOf(0, 100);
        stubMetrics(document.documentElement, { clientHeight: 800 });

        const seen: Array<number> = [];
        createScrollDriver(svg, scrollConfig({ follows: PxScrollFollows.pageDomElement, selector: '#story' }), p => seen.push(p));
        // Against the page's screen it would be u = 800 − 1150 < 0 → 0.
        expect(seen[0]).toBeCloseTo(0.5);
    });

    // `holdOnScreen` — GSAP's `pin: true`, as `position: sticky` (which keeps the element's
    // layout space, so no spacer has to be injected into the host page).
    describe('holdOnScreen', () => {

        it('is a no-op — and costs nothing to undo — when not held', () => {
            const svg = document.createElement('svg');
            svg.style.position = 'relative';
            document.body.append(svg);

            applyHoldOnScreen(svg, {})();
            expect(svg.style.position).toBe('relative');
        });

        it('makes the canvas sticky and restores the original styles on cleanup', () => {
            const svg = document.createElement('svg');
            svg.style.position = 'relative';
            svg.style.top = '3px';
            document.body.append(svg);

            const release = applyHoldOnScreen(svg, { holdOnScreen: true, holdOffset: 24 });
            expect(svg.style.position).toBe('sticky');
            expect(svg.style.top).toBe('24px');

            release();
            expect(svg.style.position).toBe('relative');
            expect(svg.style.top).toBe('3px');
        });

        it('forScreens wraps the canvas in a tall block, and unwraps it exactly', () => {
            const box = document.createElement('div');
            const svg = document.createElement('svg');
            document.body.append(box);
            box.append(svg);

            const release = applyHoldOnScreen(svg, { holdOnScreen: true, holdForScreens: 3 });
            const wrapper = svg.parentElement;
            assert(wrapper, 'the canvas has no parent');
            expect(wrapper).not.toBe(box);
            expect(wrapper.style.height).toBe('300vh');
            expect(wrapper.parentElement).toBe(box);
            // …and it is exactly the held section that is then followed.
            expect(resolveFollowedElement(svg, { holdOnScreen: true })).toBe(wrapper);

            release();
            expect(svg.parentElement).toBe(box);
            expect(box.querySelector('[data-px-pin]')).toBeNull();
        });

        it('at: center holds it in the middle of the screen', () => {
            const svg = document.createElement('svg');
            document.body.append(svg);
            stubMetrics(document.documentElement, { clientHeight: 800 });
            svg.getBoundingClientRect = () => rectOf(0, 200);

            const release = applyHoldOnScreen(svg, { holdOnScreen: true, holdAt: 'center', holdOffset: 10 });
            expect(svg.style.top).toBe('310px');   // (800 − 200) / 2 + 10
            release();
        });
    });

    // `smoothing` — GSAP's `scrub: <seconds>`: progress eases toward the scroll
    // position instead of snapping to it.
    describe('smoothing', () => {

        it('eases toward the target across frames and settles exactly on it', () => {
            const scroller = makeScroller({ scrollHeight: 1400, clientHeight: 400 });  // maxOffset 1000
            const svg = document.createElement('svg');
            scroller.append(svg);

            const seen: Array<number> = [];
            createScrollDriver(svg, scrollConfig({ follows: PxScrollFollows.containerScroll, smoothing: 200 }), p => seen.push(p));
            expect(seen).toEqual([0]);            // attach is a jump, never eased

            scroller.scrollTop = 1000;            // target = 1
            scroller.dispatchEvent(new Event('scroll'));
            flushRaf();                           // the measure tick …
            flushRaf();                           // … then the next easing frame

            const first = seen[seen.length - 1];
            expect(first).toBeGreaterThan(0);
            expect(first).toBeLessThan(1);        // eased, NOT snapped

            // An exponential ease only APPROACHES its target — the driver snaps the last
            // sliver so the loop actually ends. At 60fps with tau=200ms that is ~110 frames.
            for (let i = 0; i < 300 && seen[seen.length - 1] !== 1; i++) flushRaf();
            expect(seen[seen.length - 1]).toBe(1);          // lands exactly
            expect(seen.length).toBeGreaterThan(10);        // and took many frames to get there
            flushRaf();
            expect(rafQueue.length).toBe(0);                // …and then the loop ends
        });

        it('snaps immediately when smoothing is absent', () => {
            const scroller = makeScroller({ scrollHeight: 1400, clientHeight: 400 });
            const svg = document.createElement('svg');
            scroller.append(svg);

            const seen: Array<number> = [];
            createScrollDriver(svg, scrollConfig({ follows: PxScrollFollows.containerScroll }), p => seen.push(p));
            scroller.scrollTop = 1000;
            scroller.dispatchEvent(new Event('scroll'));
            flushRaf();
            expect(seen[seen.length - 1]).toBe(1);
        });
    });

    it('trigger config on a scroll document is ignored by the driver layer (D3 — no crash, no listeners needed)', () => {
        const scroller = makeScroller({ scrollHeight: 800, clientHeight: 400 });
        const subject = document.createElement('svg');
        scroller.appendChild(subject);
        const seen: Array<number> = [];
        const driver = createScrollDriver(subject, scrollConfig({ follows: PxScrollFollows.containerScroll }, {
            actions: [{ action: 'timeline.start', event: 'click' }],   // must have no effect
        }), p => seen.push(p));
        expect(driver).toBeTruthy();
        expect(seen.length).toBe(1);
    });

    // D8 — the playhead follows the element's place in the layout, whatever moves it.
    describe('a move with no scrolling (D8)', () => {

        /** An element in the box, its top at `top.value`. */
        function elementAt(top: { value: number }): { svg: SVGElement | HTMLElement; box: HTMLElement } {
            const box = makeScreenBox();
            const svg = document.createElement('svg');
            box.append(svg);
            svg.getBoundingClientRect = () => rectOf(top.value, 100);
            return { svg, box };
        }

        it('a layout move with no scroll event is picked up at the next frame', () => {
            const top = { value: 150 };
            const { svg } = elementAt(top);
            const seen: Array<number> = [];
            const driver = createScrollDriver(svg, { timelineSource: 'scroll' }, p => seen.push(p));
            expect(seen).toEqual([0.5]);

            top.value = 400;          // content above it grew: no scroll, no resize
            flushRaf();
            expect(seen[seen.length - 1]).toBe(0);
            top.value = 250;          // …and again, frames later: measured every frame, not once
            flushRaf();
            flushRaf();
            expect(seen[seen.length - 1]).toBeCloseTo(0.3);   // u = 400 − 250 = 150 of 500
            driver?.destroy();
        });

        it('measures every frame only while near the screen (IntersectionObserver), and once more when it leaves', () => {
            const observers: Array<StubIntersectionObserver> = [];
            vi.stubGlobal('IntersectionObserver', class extends StubIntersectionObserver {
                constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { super(callback, options); observers.push(this); }
            });
            const top = { value: 150 };
            const { svg, box } = elementAt(top);
            const seen: Array<number> = [];
            const driver = createScrollDriver(svg, { timelineSource: 'scroll' }, p => seen.push(p));
            const observer = observers[0];
            assert(observer, 'no IntersectionObserver was created');
            expect(observer.observed).toEqual([svg]);
            expect(observer.root).toBe(box);
            expect(observer.rootMargin).toBe('100%');

            top.value = 900;          // moved far below
            observer.report(svg, false);
            flushRaf();               // one last measurement …
            expect(seen[seen.length - 1]).toBe(0);
            flushRaf();
            expect(rafQueue.length).toBe(0);   // … and the per-frame measuring stops

            top.value = 200;          // a layout move while far: not measured …
            flushRaf();
            expect(seen[seen.length - 1]).toBe(0);

            observer.report(svg, true);         // … until it comes near again
            flushRaf();
            expect(seen[seen.length - 1]).toBeCloseTo(0.4);   // u = 400 − 200 = 200 of 500
            expect(rafQueue.length).toBe(1);    // and it goes on every frame
            driver?.destroy();
            expect(observer.disconnected).toBe(true);
        });

        it('a scrolled amount has no per-frame measuring — scrolling and resizing reach it', () => {
            const scroller = makeScroller({ scrollHeight: 1400, clientHeight: 400 });
            const svg = document.createElement('svg');
            scroller.append(svg);
            createScrollDriver(svg, scrollConfig({ follows: PxScrollFollows.containerScroll }), () => {});
            expect(rafQueue.length).toBe(0);
        });
    });
});

describe('createNativeScrollTimeline — the browser\'s own timeline', () => {

    /** The options each constructor saw. */
    let viewOptions: Array<Record<string, unknown>>;
    let scrollOptions: Array<Record<string, unknown>>;

    beforeEach(() => {
        viewOptions = [];
        scrollOptions = [];
        vi.stubGlobal('ViewTimeline', class { constructor(options: Record<string, unknown>) { viewOptions.push(options); } });
        vi.stubGlobal('ScrollTimeline', class { constructor(options: Record<string, unknown>) { scrollOptions.push(options); } });
        stubCssPercent();
    });

    function svgInPage(): HTMLElement {
        const svg = document.createElement('svg');
        document.body.append(svg);
        return svg;
    }

    it('an element word → ViewTimeline on the followed element; the seven words as CSS ranges', () => {
        const native = createNativeScrollTimeline(svgInPage(), scrollConfig({ lastFrameWhen: { moment: PxScrollMoment.fullyIn } }));
        assert(native, 'no native timeline');
        expect(viewOptions).toHaveLength(1);
        expect(scrollOptions).toHaveLength(0);
        expect(native.rangeStart).toEqual({ rangeName: 'cover', offset: percent(0) });   // appears — the default
        expect(native.rangeEnd).toEqual({ rangeName: 'entry', offset: percent(100) });   // fullyIn
    });

    it('every word maps to its CSS range', () => {
        const css: Array<[PxScrollMoment, string, number]> = [
            [PxScrollMoment.appears, 'cover', 0], [PxScrollMoment.halfIn, 'entry', 50], [PxScrollMoment.fullyIn, 'entry', 100],
            [PxScrollMoment.centered, 'cover', 50], [PxScrollMoment.startsToLeave, 'exit', 0], [PxScrollMoment.halfOut, 'exit', 50],
            [PxScrollMoment.gone, 'cover', 100],
        ];
        for (const [moment, rangeName, pct] of css) {
            const native = createNativeScrollTimeline(svgInPage(), scrollConfig({ firstFrameWhen: { moment }, lastFrameWhen: { moment: PxScrollMoment.gone } }));
            expect(native?.rangeStart).toEqual({ rangeName, offset: percent(pct) });
        }
    });

    it('two words in the wrong order are swapped into scroll order', () => {
        const native = createNativeScrollTimeline(svgInPage(), scrollConfig({
            firstFrameWhen: { moment: PxScrollMoment.halfOut }, lastFrameWhen: { moment: PxScrollMoment.halfIn },
        }));
        expect(native?.rangeStart).toEqual({ rangeName: 'entry', offset: percent(50) });
        expect(native?.rangeEnd).toEqual({ rangeName: 'exit', offset: percent(50) });
    });

    it('held → ViewTimeline on the held section, fullyIn → startsToLeave by default', () => {
        const box = document.createElement('div');
        const svg = document.createElement('svg');
        document.body.append(box);
        box.append(svg);
        const native = createNativeScrollTimeline(svg, scrollConfig({ holdOnScreen: true }));
        expect(viewOptions[0].subject).toBe(box);
        expect(native?.rangeStart).toEqual({ rangeName: 'entry', offset: percent(100) });
        expect(native?.rangeEnd).toEqual({ rangeName: 'exit', offset: percent(0) });
    });

    it('a handed-over element is the ViewTimeline\'s subject', () => {
        const handed = document.createElement('article');
        document.body.append(handed);
        createNativeScrollTimeline(svgInPage(), scrollConfig({ follows: PxScrollFollows.pageScroll }), undefined, handed);
        expect(viewOptions[0].subject).toBe(handed);
        expect(scrollOptions).toHaveLength(0);
    });

    it('the axis: absent → block, vertical → y, horizontal → x', () => {
        createNativeScrollTimeline(svgInPage(), scrollConfig({}));
        createNativeScrollTimeline(svgInPage(), scrollConfig({ axis: PxScrollAxis.vertical }));
        createNativeScrollTimeline(svgInPage(), scrollConfig({ axis: PxScrollAxis.horizontal }));
        expect(viewOptions.map(o => o.axis)).toEqual(['block', 'y', 'x']);
    });

    it('pageScroll → ScrollTimeline on the page\'s scroller; { scrolled } as a bare percent, in scroll order', () => {
        const native = createNativeScrollTimeline(svgInPage(), scrollConfig({
            follows: PxScrollFollows.pageScroll, firstFrameWhen: { scrolled: 0.8 }, lastFrameWhen: { scrolled: 0.2 },
        }));
        expect(scrollOptions[0].source).toBe(document.scrollingElement ?? document.documentElement);
        expect(native?.rangeStart).toEqual({ offset: percent(20) });
        expect(native?.rangeEnd).toEqual({ offset: percent(80) });
    });

    it('containerScroll → ScrollTimeline on the box around; the whole scroll by default', () => {
        const scroller = makeScroller({ scrollHeight: 900, clientHeight: 300 });
        const svg = document.createElement('svg');
        scroller.append(svg);
        const native = createNativeScrollTimeline(svg, scrollConfig({ follows: PxScrollFollows.containerScroll }));
        expect(scrollOptions[0].source).toBe(scroller);
        expect(native?.rangeStart).toEqual({ offset: percent(0) });
        expect(native?.rangeEnd).toEqual({ offset: percent(100) });
    });

    it('an exact place falls back to the player\'s own measuring — even one CSS could spell (entry-crossing)', () => {
        for (const place of [{ domElement: 'top' as const, screen: 0.8 }, { domElement: 0.3, screen: 'bottom' as const }]) {
            expect(createNativeScrollTimeline(svgInPage(), scrollConfig({ firstFrameWhen: place }))).toBeNull();
        }
        expect(viewOptions).toHaveLength(0);
    });

    it('an exact place warns 1307 only when engine "native" asked for the browser\'s timeline', () => {
        const codes: Array<PxDiagnosticCode> = [];
        const place: PxScrollSettings = { firstFrameWhen: { domElement: 'top', screen: 0.8 } };
        createNativeScrollTimeline(svgInPage(), scrollConfig(place), recordingDiag(codes));
        expect(codes).toEqual([]);
        createNativeScrollTimeline(svgInPage(), scrollConfig(place, { engine: PxTimelineEngineSetting.native }), recordingDiag(codes));
        expect(codes).toEqual([PxDiagnosticCode.scrollPlaceNeedsOwnDriver]);
    });

    it('smoothing measures by itself (warns 1301)', () => {
        const codes: Array<PxDiagnosticCode> = [];
        expect(createNativeScrollTimeline(svgInPage(), scrollConfig({ smoothing: 150 }), recordingDiag(codes))).toBeNull();
        expect(codes).toEqual([PxDiagnosticCode.scrollSmoothingNeedsOwnDriver]);
    });

    it('no CSS.percent in this browser → the player measures by itself', () => {
        vi.stubGlobal('CSS', {});
        expect(createNativeScrollTimeline(svgInPage(), scrollConfig({}))).toBeNull();
    });
});


// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A Typed OM percentage, as the stubbed `CSS.percent` makes it. */
function percent(value: number): { value: number; unit: string } {
    return { value, unit: 'percent' };
}

function stubCssPercent(): void {
    vi.stubGlobal('CSS', { percent });
}

/** A diagnostics channel that records the codes it is told. */
function recordingDiag(codes: Array<PxDiagnosticCode>): PxDiagnostics {
    return createDiagnostics({ onWarning: d => codes.push(d.code), onError: d => codes.push(d.code) }, '[test]');
}

/** An IntersectionObserver the test drives: `report` tells the driver whether the target is near. */
class StubIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null;
    readonly rootMargin: string;
    readonly thresholds: ReadonlyArray<number> = [0];
    readonly observed: Array<Element> = [];
    disconnected = false;
    constructor(private readonly callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.root = options?.root ?? null;
        this.rootMargin = options?.rootMargin ?? '0px';
    }
    observe(target: Element): void { this.observed.push(target); }
    unobserve(): void {}
    disconnect(): void { this.disconnected = true; }
    takeRecords(): Array<IntersectionObserverEntry> { return []; }
    report(target: Element, isIntersecting: boolean): void {
        const rect = rectOf(0, 0);
        this.callback([{ boundingClientRect: rect, intersectionRatio: isIntersecting ? 1 : 0, intersectionRect: rect, isIntersecting, rootBounds: null, target, time: 0 }], this);
    }
}
