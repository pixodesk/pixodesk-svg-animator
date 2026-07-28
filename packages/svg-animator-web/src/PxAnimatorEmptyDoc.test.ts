/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// A document with NO children is still a document: it carries a viewBox and a timeline,
// and rendering it should produce an empty `<svg>`, not nothing at all.
//
// `createAnimator` used to gate the whole render on `doc.children`, so a childless
// document left `getRootElement()` answering `null`. Consumers can't tell that apart from
// "the render failed" — the editor's visual harness threw `animator root is not an <svg>
// element` on an empty fixture, which reads as a broken player rather than an empty case.

import { beforeEach, describe, expect, it } from 'vitest';
import { createAnimator } from './PxAnimator';
import type { PxAnimatedSvgDocument } from './PxAnimatorTypes';

const emptyDoc = (): PxAnimatedSvgDocument => ({
    type: 'svg',
    viewBox: '0 0 200 200',
    animator: { duration: 1000, mode: 'auto' },
} as unknown as PxAnimatedSvgDocument);

const docWithChild = (): PxAnimatedSvgDocument => ({
    ...emptyDoc(),
    children: [{ type: 'rect', x: 10, y: 10, width: 20, height: 20 }],
} as unknown as PxAnimatedSvgDocument);


describe('createAnimator — a document with no children', () => {

    beforeEach(() => {
        document.body.innerHTML = '<div id="c"></div>';
    });

    it('still renders its root <svg>', () => {
        const api = createAnimator({ data: emptyDoc(), container: '#c' });
        const root = api.getRootElement();

        expect(root, 'an empty document renders an empty <svg>, not null').not.toBeNull();
        expect((root as Element)?.tagName?.toLowerCase()).toBe('svg');
        expect(document.querySelector('#c svg'), 'and it is mounted in the container').not.toBeNull();
        api.destroy();
    });

    it('keeps the root attributes that make it a viewport', () => {
        const api = createAnimator({ data: emptyDoc(), container: '#c' });
        expect((api.getRootElement() as Element).getAttribute('viewBox')).toBe('0 0 200 200');
        api.destroy();
    });

    it('a document WITH children is unaffected', () => {
        const api = createAnimator({ data: docWithChild(), container: '#c' });
        expect((api.getRootElement() as Element)?.tagName?.toLowerCase()).toBe('svg');
        expect(document.querySelector('#c rect'), 'children still render').not.toBeNull();
        api.destroy();
    });
});
