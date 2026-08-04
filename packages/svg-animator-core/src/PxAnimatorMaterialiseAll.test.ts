/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Tests for `materialiseAllInTree` — the single-call pipeline that the player
 * uses internally AND the editor uses externally. Confirms each of the four
 * stages runs in the right order, and that engine gating is honoured.
 */

import { describe, expect, it } from 'vitest';
import { materialiseAllInTree } from './PxAnimatorMaterialiseAll';
import { PxAnimatorEngine } from './PxAnimatorTypes';
import type { PxAnimatedSvgDocument, PxNode, PxPropertyAnimation } from './PxAnimatorTypes';


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

function deepHasAnyEffects(node: PxNode): boolean {
    if (node.effects && Object.keys(node.effects).length > 0) return true;
    if (node.children) for (const ch of node.children) if (deepHasAnyEffects(ch)) return true;
    return false;
}

function getTransformAnim(node: PxNode | undefined): PxPropertyAnimation | undefined {
    if (!node || !node.animate || typeof node.animate !== 'object' || Array.isArray(node.animate)) return undefined;
    return (node.animate as Record<string, PxPropertyAnimation>).transform;
}


describe('materialiseAllInTree', () => {

    // One fixture covering all four stages: it has a node.effects (retime), an
    // animation with a loop, a tangented `transform` (motion-along-path), and
    // a <use> referencing an animated subtree.
    function fixture(): PxAnimatedSvgDocument {
        return {
            type: 'svg',
            animator: { duration: 1000 },
            children: [
                // Source rect with tangented motion-path + a loop.
                {
                    type: 'rect',
                    id: 'src',
                    animate: {
                        transform: {
                            autoOrient: true,
                            loop: true,
                            keyframes: [
                                // L-curve: start heading +X, end arriving from +Y → has interior extremes.
                                { time: 0,    value: { translate: [0, 0] },     tangentOut: [80, 0] },
                                { time: 500,  value: { translate: [100, 100] }, tangentIn: [0, -80] },
                            ],
                        },
                    },
                } as PxNode,
                // <use> referring to src — animated target, must materialise for waapi.
                { type: 'use', id: 'inst', href: '#src' } as PxNode,
                // A second element with an `effects.clone.retime` bucket, just to verify
                // applyPlayerEffects ran.
                {
                    type: 'use',
                    id: 'retimed',
                    href: '#src',
                    effects: { clone: { retime: { start: 0, stretch: 0.5 } } },
                } as PxNode,
            ],
        } as PxAnimatedSvgDocument;
    }


    // ── Engine: waapi ────────────────────────────────────────────────────

    it('waapi: applyPlayerEffects ran — no node.effects remains anywhere', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.waapi);
        expect(deepHasAnyEffects(out)).toBe(false);
    });

    it('waapi: motion-path materialised — tangents and autoOrient removed from `src`', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.waapi);
        const src = deepFind(out, n => n.id === 'src')!;
        const anim = getTransformAnim(src)!;
        expect(anim.autoOrient).toBeUndefined();
        const kfs = (anim.keyframes ?? anim.kfs) as Array<{ tangentIn?: unknown; tangentOut?: unknown }>;
        for (const kf of kfs) {
            expect(kf.tangentIn).toBeUndefined();
            expect(kf.tangentOut).toBeUndefined();
        }
        // Motion-path sampling adds intermediate kfs — output should have >2.
        expect(kfs.length).toBeGreaterThan(2);
    });

    it('waapi: loop materialised — `loop` field consumed', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.waapi);
        const src = deepFind(out, n => n.id === 'src')!;
        const anim = getTransformAnim(src)!;
        expect(anim.loop).toBeUndefined();
    });

    it('waapi: <use> referencing animated subtree materialised — replaced by <g>', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.waapi);
        // The `inst` <use> is the simple ref one. No <use href="#src"> should remain
        // in the output (all materialised).
        const remainingUses = deepCountByType(out, 'use');
        // The retime effect's <use> is consumed by applyPlayerEffects, the plain
        // `inst` <use> by materialiseAnimatedUseInstances. Both gone.
        expect(remainingUses).toBe(0);
    });


    // ── Engine: frames ────────────────────────────────────────────────────

    it('frames: applyPlayerEffects ran — no node.effects remains', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.frames);
        expect(deepHasAnyEffects(out)).toBe(false);
    });

    it('frames: loop materialised — same as waapi (both engines need flat kfs)', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.frames);
        const src = deepFind(out, n => n.id === 'src')!;
        const anim = getTransformAnim(src)!;
        expect(anim.loop).toBeUndefined();
    });

    it('frames: motion-path KEPT parametric — tangents + autoOrient intact', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.frames);
        const src = deepFind(out, n => n.id === 'src')!;
        const anim = getTransformAnim(src)!;
        expect(anim.autoOrient).toBe(true);
        const kfs = (anim.keyframes ?? anim.kfs) as Array<{ tangentIn?: unknown; tangentOut?: unknown }>;
        const hasAnyTangent = kfs.some(kf => kf.tangentIn || kf.tangentOut);
        expect(hasAnyTangent).toBe(true);
    });

    it('frames: <use> KEPT — animated-use materialisation skipped', () => {
        const out = materialiseAllInTree(fixture(), PxAnimatorEngine.frames);
        // The plain `inst` <use> survives; the retime effect's <use> is still
        // consumed by applyPlayerEffects.
        const remainingUses = deepCountByType(out, 'use');
        expect(remainingUses).toBeGreaterThanOrEqual(1);
    });


    // ── Immutability ──────────────────────────────────────────────────────

    it('does not mutate the input doc', () => {
        const doc = fixture();
        const snapshot = JSON.stringify(doc);
        materialiseAllInTree(doc, PxAnimatorEngine.waapi);
        expect(JSON.stringify(doc)).toBe(snapshot);
    });
});
