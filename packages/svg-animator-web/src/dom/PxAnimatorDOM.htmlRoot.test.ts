/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';
import { PxTimelineEngine } from '@pixodesk/svg-animator-core';
import { isPxDocument } from '@pixodesk/svg-animator-core';
import { createSvgAnimator } from '../index';
import { renderNode } from './PxAnimatorDOM';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HTML_NS = 'http://www.w3.org/1999/xhtml';

/** A page, not just a drawing: HTML around an animated SVG. */
const page = (): PxAnimatedSvgDocument => ({
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
} as PxAnimatedSvgDocument);

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
        const h1 = root!.querySelector('h1')!;
        expect(h1.namespaceURI).toBe(HTML_NS);
        expect(h1.textContent).toBe('Hello, world!');
        const svg = root!.querySelector('svg')!;
        expect(svg.namespaceURI).toBe(SVG_NS);
        expect(svg.querySelector('circle')!.namespaceURI).toBe(SVG_NS);
    });

    it('an untyped child is a div outside <svg> and a g inside it', () => {
        const root = renderNode({ type: 'div', children: [{}, { type: 'svg', children: [{}] }] } as PxAnimatedSvgDocument);
        expect(root!.children[0].tagName).toBe('DIV');
        expect(root!.querySelector('svg')!.children[0].tagName).toBe('g');
    });

    it('blocked tags stay blocked outside <svg>', () => {
        const root = renderNode({ type: 'div', children: [{ type: 'iframe', src: 'https://example.com' }, { type: 'script' }, { type: 'p' }] } as PxAnimatedSvgDocument);
        expect(root!.querySelector('iframe')).toBeNull();
        expect(root!.querySelector('script')).toBeNull();
        expect(root!.querySelector('p')).not.toBeNull();
    });

    it('the animation inside plays and can be stepped frame by frame', () => {
        const api = createSvgAnimator({ doc: page(), container: '#stage' });
        const stage = document.getElementById('stage')!;
        expect(stage.querySelector('h1')!.textContent).toBe('Hello, world!');
        // the player gives ids an instance prefix; the drawing's only circle is the ball
        const cy = () => Number(stage.querySelector('circle')!.getAttribute('cy'));
        api.setCurrentTime(500);
        expect(cy()).toBeCloseTo(190, 0);
        api.setCurrentTime(1000);
        expect(cy()).toBeCloseTo(320, 0);
        api.destroy();
    });
});
