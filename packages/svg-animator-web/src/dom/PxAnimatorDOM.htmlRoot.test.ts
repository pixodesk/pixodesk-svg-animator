/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxDocument } from '@pixodesk/svg-animator-core';
import { PxTimelineEngine } from '@pixodesk/svg-animator-core';
import { isPxDocument } from '@pixodesk/svg-animator-core';
import { createSvgAnimationPlayer } from '../index';
import { renderNode } from './PxAnimatorDOM';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_NS = 'http://www.w3.org/1999/xhtml';

/** A page, not just a drawing: HTML around an animated SVG. */
const page = (): PxDocument => ({
    type: 'div',
    style: { textAlign: 'center' },
    animator: { timeline: { outTime: 1000, engine: PxTimelineEngine.js } },
    children: [
        { type: 'h1', textContent: 'Hello, world!' },
        {
            type: 'svg', viewBox: '0 0 400 400', width: 300, height: 300,
            children: [{ type: 'circle', id: 'ball', cx: 200, cy: 60, r: 40, fill: '#2a7fff',
                animate: { cy: { keyframes: [{ time: 0, value: 60 }, { time: 1000, value: 320 }] } } }],
        },
    ],
} as PxDocument);

describe('HTML root around SVG content', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="stage"></div>'; vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('a div root is a document', () => {
        expect(isPxDocument(page())).toBe(true);
        expect(isPxDocument({ v: '5.7.0', layers: [] })).toBe(false);   // Lottie has no `type`
    });

    it('elements are HTML outside <svg> and SVG inside it', () => {
        const root = renderNode(page());
        expect(root?.namespaceURI).toBe(HTML_NS);
        expect(root?.tagName).toBe('DIV');
        assert(root, 'nothing was rendered');
        const h1 = root.querySelector('h1');
        assert(h1, 'no <h1> was rendered');
        expect(h1.namespaceURI).toBe(HTML_NS);
        expect(h1.textContent).toBe('Hello, world!');
        const svg = root.querySelector('svg');
        assert(svg, 'no <svg> was rendered');
        expect(svg.namespaceURI).toBe(SVG_NS);
        expect(svg.querySelector('circle')?.namespaceURI).toBe(SVG_NS);
    });

    it('an untyped child is a div outside <svg> and a g inside it', () => {
        const root = renderNode({ type: 'div', children: [{}, { type: 'svg', children: [{}] }] } as PxDocument);
        assert(root, 'nothing was rendered');
        expect(root.children[0].tagName).toBe('DIV');
        expect(root.querySelector('svg')?.children[0].tagName).toBe('g');
    });

    it('blocked tags stay blocked outside <svg>', () => {
        const root = renderNode({ type: 'div', children: [{ type: 'iframe', src: 'https://example.com' }, { type: 'script' }, { type: 'p' }] } as PxDocument);
        assert(root, 'nothing was rendered');
        expect(root.querySelector('iframe')).toBeNull();
        expect(root.querySelector('script')).toBeNull();
        expect(root.querySelector('p')).not.toBeNull();
    });

    it('the animation inside plays and can be stepped frame by frame', () => {
        const api = createSvgAnimationPlayer({ doc: page(), container: '#stage' });
        const stage = document.getElementById('stage');
        assert(stage, 'fixture element #stage is missing');
        expect(stage.querySelector('h1')?.textContent).toBe('Hello, world!');
        // the player gives ids an instance prefix; the drawing's only circle is the ball
        const cy = () => Number(stage.querySelector('circle')?.getAttribute('cy'));
        api.setCurrentTime(500);
        expect(cy()).toBeCloseTo(190, 0);
        api.setCurrentTime(1000);
        expect(cy()).toBeCloseTo(320, 0);
        api.destroy();
    });
});


// Owner rule 2026-10-23: the player renders the tree AS IS and never adds an <svg> around the root. Outside an
// <svg> every element is HTML, from <svg> down SVG — so a bare `rect` root is an HTML element (accepted: such
// documents are hand-made only; refine later). The editor opens only an <svg> root and says so otherwise.
describe('an SVG element as the root — rendered as is, never wrapped', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="html-stage"></div><svg id="page"><g id="svg-stage"></g></svg>';
        vi.useFakeTimers();
    });
    afterEach(() => { vi.useRealTimers(); });

    /** A bare animated `<rect>` — no `<svg>` around it. */
    const rectRoot = (): PxDocument => ({
        type: 'rect', id: 'box', x: 0, y: 10, width: 20, height: 20, fill: '#2a7fff',
        animator: { timeline: { outTime: 1000, engine: PxTimelineEngine.js } },
        animate: { x: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 100 }] } },
    } as PxDocument);

    /** The container's one rendered child — asserting nothing else was added. */
    const onlyChild = (stage: string): Element => {
        const el = document.getElementById(stage);
        assert(el, '#' + stage + ' is missing');
        expect(el.children).toHaveLength(1);
        expect(el.querySelector('svg')).toBeNull();   // no <svg> added
        const child = el.firstElementChild;
        assert(child, '#' + stage + ' rendered nothing');
        return child;
    };

    it('a <rect> root is a document', () => {
        expect(isPxDocument(rectRoot())).toBe(true);
    });

    it('in an HTML container the <rect> is the only element — nothing is wrapped around it', () => {
        const api = createSvgAnimationPlayer({ doc: rectRoot(), container: '#html-stage' });
        expect(onlyChild('html-stage').localName).toBe('rect');
        api.destroy();
    });

    // NOT PLANNED (owner 2026-10-23: render as is, refine later) — what a later refinement could add: a bare
    // SVG-element root created as SVG when its container is SVG. Today it is an HTML element and draws nothing.
    it.skip('in an SVG container it is an SVG <rect> — it draws, and its animation plays', () => {
        const api = createSvgAnimationPlayer({ doc: rectRoot(), container: '#svg-stage' });
        const rect = onlyChild('svg-stage');
        expect(rect.localName).toBe('rect');
        expect(rect.namespaceURI).toBe(SVG_NS);
        api.setCurrentTime(500);
        expect(Number(rect.getAttribute('x'))).toBeCloseTo(50, 0);
        api.destroy();
    });
});
