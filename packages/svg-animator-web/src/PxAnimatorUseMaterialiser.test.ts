/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Tests for `materialiseAnimatedUseInstances` — the post-processing pass that
 * replaces `<use>` instances referencing animated subtrees with deep clones.
 *
 * Background: WAAPI / CSS animations applied to an SVG element don't reliably
 * render through `<use>` shadow trees in Chrome and Safari — the source
 * animates, the `<use>` instance shows static. The materialiser sidesteps the
 * issue by deep-cloning the target into the `<use>` site (with fresh ids and
 * rewritten internal refs); both engines then animate the clone directly.
 */

import { describe, expect, it } from 'vitest';
import { materialiseAnimatedUseInstances } from './PxAnimatorUseMaterialiser';
import type { PxNode } from './PxAnimatorTypes';


function deepFind(node: PxNode, predicate: (n: PxNode) => boolean): PxNode | undefined {
    if (predicate(node)) return node;
    if (node.children) {
        for (const ch of node.children) {
            const r = deepFind(ch, predicate);
            if (r) return r;
        }
    }
    return undefined;
}

function deepCountByType(node: PxNode, type: string): number {
    let n = node.type === type ? 1 : 0;
    if (node.children) for (const ch of node.children) n += deepCountByType(ch, type);
    return n;
}


describe('materialiseAnimatedUseInstances', () => {

    it('returns the input by reference when no <use> exists', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'r', width: 10, height: 10 } as PxNode,
            ],
        };
        const out = materialiseAnimatedUseInstances(tree);
        expect(out).toBe(tree);
    });

    it('returns the input by reference when <use> targets a STATIC subtree', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'static-rect', width: 10, height: 10 } as PxNode,
                { type: 'use', href: '#static-rect' } as PxNode,
            ],
        };
        const out = materialiseAnimatedUseInstances(tree);
        expect(out).toBe(tree);
    });

    it('materialises <use> when the target itself has an `animate` bucket', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect',
                    id: 'animated-rect',
                    width: 10, height: 10,
                    animate: { transform: { keyframes: [{ t: 0, v: { translate: [0, 0] } }, { t: 1000, v: { translate: [100, 0] } }] } },
                } as PxNode,
                { type: 'use', href: '#animated-rect' } as PxNode,
            ],
        };

        const out = materialiseAnimatedUseInstances(tree);
        expect(out).not.toBe(tree);

        // The <use> child must now be a <g> with the cloned content.
        const useReplacement = out.children![1];
        expect(useReplacement.type).toBe('g');
        expect((useReplacement as PxNode).href).toBeUndefined();
        expect(useReplacement.children).toBeDefined();
        expect(useReplacement.children!.length).toBe(1);

        // The cloned child is a rect with a FRESH id and the same animation.
        const clonedRect = useReplacement.children![0];
        expect(clonedRect.type).toBe('rect');
        expect(clonedRect.id).not.toBe('animated-rect');
        expect(typeof clonedRect.id).toBe('string');
        expect((clonedRect as PxNode).animate).toBeDefined();
        expect(((clonedRect as PxNode).animate as { transform?: unknown }).transform).toBeDefined();
    });

    it('materialises <use> when the target has an animated DESCENDANT', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'g',
                    id: 'wrapper',
                    children: [
                        {
                            type: 'ellipse',
                            id: 'inner',
                            rx: 5, ry: 5,
                            animate: { transform: { keyframes: [{ t: 0, v: { translate: [0, 0] } }, { t: 1000, v: { translate: [0, 50] } }] } },
                        },
                    ] as Array<PxNode>,
                } as PxNode,
                { type: 'use', href: '#wrapper' } as PxNode,
            ],
        };

        const out = materialiseAnimatedUseInstances(tree);
        const useReplacement = out.children![1];
        expect(useReplacement.type).toBe('g');

        // The clone preserves the structure of the wrapper.
        const clonedWrapper = useReplacement.children![0];
        expect(clonedWrapper.type).toBe('g');
        const clonedInner = clonedWrapper.children![0];
        expect(clonedInner.type).toBe('ellipse');
        expect(clonedInner.id).not.toBe('inner');
        expect((clonedInner as PxNode).animate).toBeDefined();
    });

    it('preserves the <use>\'s own transform on the materialised <g>', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect',
                    id: 'r',
                    animate: { transform: { keyframes: [{ t: 0, v: 0 }, { t: 1000, v: 1 }] } },
                } as PxNode,
                { type: 'use', href: '#r', transform: 'translate(50,100)' } as PxNode,
            ],
        };
        const out = materialiseAnimatedUseInstances(tree);
        const useReplacement = out.children![1];
        expect(useReplacement.transform).toBe('translate(50,100)');
    });

    it('rewrites internal refs inside the clone — `url(#oldId)` and inner `href="#oldId"` get new ids', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'g',
                    id: 'wrap',
                    children: [
                        // Inner element with `fill="url(#localGrad)"` referring to a sibling.
                        {
                            type: 'rect',
                            id: 'inner-rect',
                            fill: 'url(#localGrad)',
                            animate: { transform: { keyframes: [{ t: 0, v: 0 }, { t: 1000, v: 1 }] } },
                        },
                        { type: 'linearGradient', id: 'localGrad' },
                    ] as Array<PxNode>,
                } as PxNode,
                { type: 'use', href: '#wrap' } as PxNode,
            ],
        };

        const out = materialiseAnimatedUseInstances(tree);
        const cloneRoot = out.children![1].children![0];
        const clonedRect = deepFind(cloneRoot, n => n.type === 'rect');
        const clonedGrad = deepFind(cloneRoot, n => n.type === 'linearGradient');
        expect(clonedRect).toBeDefined();
        expect(clonedGrad).toBeDefined();
        // The clone's rect.fill should reference the cloned gradient, not the original.
        expect((clonedRect as PxNode).fill).toBe('url(#' + clonedGrad!.id + ')');
        // The original sibling rect / gradient are untouched.
        const originalGrad = tree.children![0].children![1];
        expect(originalGrad.id).toBe('localGrad');
        expect((tree.children![0].children![0] as PxNode).fill).toBe('url(#localGrad)');
    });

    it('reproduces the user bug: <use> nested in a <mask>, target is the animated rect', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'defs',
                    children: [
                        {
                            type: 'mask',
                            id: 'mymask',
                            children: [
                                {
                                    type: 'g',
                                    children: [
                                        // <use> referencing the animated rect outside the mask.
                                        { type: 'use', href: '#anim-rect' },
                                    ] as Array<PxNode>,
                                },
                            ] as Array<PxNode>,
                        },
                    ] as Array<PxNode>,
                },
                {
                    type: 'rect',
                    id: 'anim-rect',
                    animate: {
                        transform: {
                            autoOrient: true,
                            keyframes: [
                                { t: 0, v: { translate: [0, 0] } },
                                { t: 1000, v: { translate: [100, 100] } },
                            ],
                        },
                    },
                } as PxNode,
            ],
        };

        const out = materialiseAnimatedUseInstances(tree);
        // Find the use's replacement inside the mask.
        const replacement = deepFind(out, n => n.type === 'g' && Array.isArray(n.children) && n.children.length === 1 && n.children[0].type === 'rect');
        expect(replacement).toBeDefined();
        const clonedRect = replacement!.children![0];
        expect(clonedRect.id).not.toBe('anim-rect');
        expect((clonedRect as PxNode).animate).toBeDefined();
    });

    it('recursively materialises: clone of an animated subtree may contain another <use> needing materialisation', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect',
                    id: 'leaf',
                    animate: { transform: { keyframes: [{ t: 0, v: 0 }, { t: 1000, v: 1 }] } },
                } as PxNode,
                {
                    type: 'g',
                    id: 'middle',
                    children: [
                        { type: 'use', href: '#leaf' },
                    ] as Array<PxNode>,
                } as PxNode,
                { type: 'use', href: '#middle' } as PxNode,
            ],
        };

        const out = materialiseAnimatedUseInstances(tree);

        // Count rect copies — original + nested-use-in-middle + middle-clone's inner use.
        // After materialisation, the tree should contain THREE rect instances:
        //   1. The original `leaf` rect.
        //   2. The materialised rect inside the original `<g id="middle">` (from <use href="#leaf">).
        //   3. The materialised rect inside the OUTER `<use href="#middle">`'s clone.
        expect(deepCountByType(out, 'rect')).toBe(3);
        // No <use> elements should remain (all materialised).
        expect(deepCountByType(out, 'use')).toBe(0);
    });


    it('materialised <use> targeting a <symbol> rewrites the clone root into a <g> with viewBox-offset transform + clip', () => {
        // <symbol> doesn't render unless instantiated by <use>. If the
        // materialiser just deep-clones the <symbol> into a <g> parent, the
        // cloned <symbol> is still invisible. Replace the clone-root <symbol>
        // with a <g> that:
        //   - translates by `(-vbX, -vbY)` so the symbol's local origin aligns
        //     with the use's anchor (mirrors how the browser maps a <symbol>
        //     viewBox into a <use> viewport at default x=0, y=0).
        //   - clips to the viewBox rectangle (via a fresh `<clipPath>` in defs)
        //     so out-of-viewBox content is hidden, matching <symbol> semantics.
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'symbol',
                    id: 'sym',
                    viewBox: '10 20 100 50',  // x=10, y=20, w=100, h=50
                    children: [
                        {
                            type: 'rect',
                            id: 'inner',
                            width: 40, height: 30,
                            animate: { opacity: { keyframes: [
                                { time: 0,    value: 0 },
                                { time: 1000, value: 1 },
                            ] } },
                        },
                    ] as Array<PxNode>,
                } as PxNode,
                { type: 'use', href: '#sym' } as PxNode,
            ],
        };

        const out = materialiseAnimatedUseInstances(tree);
        // The original <symbol> is untouched.
        expect(out.children![0].type).toBe('symbol');
        // The <use>'s replacement is a <g>, with NO <symbol> inside the cloned
        // subtree — every clone-root symbol gets rewritten.
        const replacement = out.children![1];
        expect(replacement.type).toBe('g');
        expect(deepCountByType(replacement, 'symbol')).toBe(0);
        // The cloned content's structure: replacement <g> → inner <g> with
        // viewBox-derived transform (translate(-10,-20)) and a clip-path ref →
        // the cloned <rect> (still animated).
        const cloneRoot = replacement.children![0];
        expect(cloneRoot.type).toBe('g');
        expect(typeof cloneRoot.transform).toBe('string');
        expect(cloneRoot.transform).toMatch(/translate\s*\(\s*-10\s*,\s*-20\s*\)/);
        expect(typeof (cloneRoot as PxNode & { clipPath?: string }).clipPath).toBe('string');
        // The clipPath defs entry should exist somewhere in the tree.
        const clipPathRef = (cloneRoot as PxNode & { clipPath?: string }).clipPath!;
        const clipPathId = clipPathRef.match(/url\(#([^)]+)\)/)?.[1];
        expect(clipPathId).toBeTruthy();
        const clipPathNode = deepFind(out, n => n.type === 'clipPath' && n.id === clipPathId);
        expect(clipPathNode).toBeDefined();
        // The clipPath must contain a <rect> matching the viewBox dimensions.
        const clipRect = clipPathNode!.children![0];
        expect(clipRect.type).toBe('rect');
        expect(clipRect.x).toBe(10);
        expect(clipRect.y).toBe(20);
        expect(clipRect.width).toBe(100);
        expect(clipRect.height).toBe(50);
        // Cloned animated rect is reachable and keeps its animation.
        const clonedRect = deepFind(replacement, n => n.type === 'rect' && !!(n as PxNode).animate);
        expect(clonedRect).toBeDefined();
    });


    it('<symbol> WITHOUT viewBox — rewrites to plain <g> (no transform / clip needed)', () => {
        const tree: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'symbol',
                    id: 'sym2',
                    children: [
                        {
                            type: 'rect',
                            id: 'inner',
                            width: 10, height: 10,
                            animate: { opacity: { keyframes: [
                                { time: 0, value: 0 }, { time: 1000, value: 1 },
                            ] } },
                        },
                    ] as Array<PxNode>,
                } as PxNode,
                { type: 'use', href: '#sym2' } as PxNode,
            ],
        };
        const out = materialiseAnimatedUseInstances(tree);
        const replacement = out.children![1];
        expect(replacement.type).toBe('g');
        const cloneRoot = replacement.children![0];
        expect(cloneRoot.type).toBe('g');
        // No viewBox → no transform / clip needed.
        expect(cloneRoot.transform).toBeUndefined();
        expect((cloneRoot as PxNode & { clipPath?: string }).clipPath).toBeUndefined();
        // No new clipPath defs created.
        expect(deepCountByType(out, 'clipPath')).toBe(0);
    });
});
