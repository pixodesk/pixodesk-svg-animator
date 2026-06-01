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
});
