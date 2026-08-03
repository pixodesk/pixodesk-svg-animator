/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Self-contained tests for `applyPlayerEffects` — each case carries its INPUT
// (`node.effects` bucket emitted by the Editor's lightweight writer) and the
// EXPECTED materialised tree as a full JSON etalon. Deep-equality is checked
// after normalising auto-allocated `_lw_*` ids → stable `__GEN_N__` slugs.

import { describe, expect, it } from 'vitest';
import { applyPlayerEffects } from './PlayerEffectsUtil';
import type { PxNode } from '../PxAnimatorTypes';

/**
 * Replaces every auto-allocated id (`_lw_*`) with `__GEN_<N>__` in encounter
 * order so etalons stay stable across runs / id-allocator changes. Also
 * rewrites references to those ids inside `href` (`#…`) and inline
 * `url(#…)` occurrences.
 */
function normaliseGeneratedIds(tree: PxNode): PxNode {
    const cloned: PxNode = JSON.parse(JSON.stringify(tree));
    const map = new Map<string, string>();
    let counter = 0;
    const alloc = (id: string): string => {
        const existing = map.get(id);
        if (existing !== undefined) return existing;
        const slug = '__GEN_' + (counter++) + '__';
        map.set(id, slug);
        return slug;
    };

    const walkAssign = (n: PxNode): void => {
        if (typeof n.id === 'string' && n.id.startsWith('_lw_')) {
            n.id = alloc(n.id);
        }
        n.children?.forEach(walkAssign);
    };
    walkAssign(cloned);

    const rewriteUrl = (s: string): string => s.replace(/url\(#([^)]+)\)/g, (m, id) => {
        const mapped = map.get(id);
        return mapped ? 'url(#' + mapped + ')' : m;
    });

    const walkRewrite = (n: PxNode): void => {
        if (typeof n.href === 'string' && n.href.startsWith('#')) {
            const id = n.href.slice(1);
            const mapped = map.get(id);
            if (mapped) n.href = '#' + mapped;
        }
        for (const k of Object.keys(n)) {
            if (k === 'children' || k === 'effects' || k === 'meta' || k === 'id' || k === 'href') continue;
            const v = (n as any)[k];
            if (typeof v === 'string' && v.indexOf('url(#') !== -1) (n as any)[k] = rewriteUrl(v);
        }
        n.children?.forEach(walkRewrite);
    };
    walkRewrite(cloned);
    return cloned;
}

/** Materialise + normalise ids — convenience for test assertions. */
function materialise(input: PxNode): PxNode {
    const { root, errors } = applyPlayerEffects(input);
    if (errors.length) throw new Error('applyPlayerEffects errors:\n' + errors.join('\n'));
    return normaliseGeneratedIds(root);
}


describe('applyPlayerEffects — materialisation etalons', () => {

    it('case 1: no effects → unchanged tree', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'r1', fill: '#f00', width: 100, height: 50 },
            ],
        };
        const expected: PxNode = {
            type: 'svg',
            children: [
                { type: 'rect', id: 'r1', fill: '#f00', width: 100, height: 50 },
            ],
        };
        expect(materialise(input)).toEqual(expected);
    });


    it('case 2: transformation (static translate only) → single translate wrapper', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    effects: { transformation: { translate: [10, 20] } },
                },
            ],
        };
        const expected: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'g',
                    transform: { value: { translate: [10, 20] } },
                    children: [
                        { type: 'rect', id: 'r1', width: 100, height: 50 },
                    ],
                },
            ],
        };
        expect(materialise(input)).toEqual(expected);
    });


    it('case 3: transformation (static rotate + origin) → origin sandwich [+o, rotate, -o]', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    effects: { transformation: { rotate: 45, origin: [50, 25] } },
                },
            ],
        };
        // +origin (translate(50,25)) > rotate(45) > -origin (translate(-50,-25)) > rect
        const expected: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'g',
                    transform: { value: { translate: [50, 25] } },
                    children: [
                        {
                            type: 'g',
                            transform: { value: { rotate: 45 } },
                            children: [
                                {
                                    type: 'g',
                                    transform: { value: { translate: [-50, -25] } },
                                    children: [
                                        { type: 'rect', id: 'r1', width: 100, height: 50 },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        expect(materialise(input)).toEqual(expected);
    });


    it('case 4: ref content sub-ref → source split (outer-g translate + inner-g + bare element); use href → inner id', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                // Source ellipse with static translate — content-ref target
                {
                    type: 'ellipse', id: 'src', rx: 50, ry: 50,
                    transform: 'translate(120,80)',
                },
                // Use that targets the source's CONTENT (no translate)
                {
                    type: 'use',
                    transform: 'translate(40,200)',
                    effects: { clone: { sourceId: 'src', type: 'content' } },
                },
            ],
        };
        // Source's translate moves to outer-g; inner-g gets the fresh inner id;
        // use's href is rewritten to the inner id.
        const expected: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'g',
                    id: 'src',
                    transform: 'translate(120,80)',
                    children: [
                        {
                            type: 'g',
                            id: '__GEN_0__',
                            children: [
                                { type: 'ellipse', rx: 50, ry: 50 },
                            ],
                        },
                    ],
                },
                {
                    type: 'use',
                    transform: 'translate(40,200)',
                    href: '#__GEN_0__',
                },
            ],
        };
        expect(materialise(input)).toEqual(expected);
    });


    it('case 5: maskedBy (static href) → <mask> in defs + mask="url(#…)" attr on element', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                // Element being masked
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    effects: { maskedBy: { sourceId: 'm-src' } },
                },
                // Mask source (referenced)
                { type: 'ellipse', id: 'm-src', rx: 30, ry: 20 },
            ],
        };
        // <mask> goes into auto-emitted <defs>, materialised element gets `mask=url(#__GEN_0__)`
        const expected: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'defs',
                    children: [
                        {
                            type: 'mask',
                            id: '__GEN_0__',
                            children: [
                                { type: 'use', href: '#m-src' },
                            ],
                        },
                    ],
                },
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    mask: 'url(#__GEN_0__)',
                },
                { type: 'ellipse', id: 'm-src', rx: 30, ry: 20 },
            ],
        };
        expect(materialise(input)).toEqual(expected);
    });


    it('case 5b: clipPath (static d) → <clipPath> in defs + clip-path="url(#…)" attr on element', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    effects: { clipPath: { d: 'M0,0L40,0L40,40L0,40z' } },
                },
            ],
        };
        // <clipPath> goes into auto-emitted <defs>; the element gets `clipPath=url(#__GEN_0__)`
        // (rendered as the `clip-path` attribute by the DOM layer).
        const expected: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'defs',
                    children: [
                        {
                            type: 'clipPath',
                            id: '__GEN_0__',
                            children: [
                                { type: 'path', d: 'M0,0L40,0L40,40L0,40z' },
                            ],
                        },
                    ],
                },
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    clipPath: 'url(#__GEN_0__)',
                },
            ],
        };
        expect(materialise(input)).toEqual(expected);
    });


    it('case 5c: clipPath (ANIMATED d) → child <path> carries animate.d keyframes', () => {
        const animate = {
            keyframes: [
                { time: 0, value: { path: 'M0,0L40,0L40,40L0,40z' } },
                { time: 30, value: { path: 'M0,0L80,0L80,80L0,80z' } },
            ],
        };
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    effects: { clipPath: { d: 'M0,0L40,0L40,40L0,40z', animate } },
                },
            ],
        };
        // The clip's child <path> gets the animate.d block verbatim; the frame loop
        // (later, in PxAnimator) rewrites its `d` attr per frame → live re-clip.
        const expected: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'defs',
                    children: [
                        {
                            type: 'clipPath',
                            id: '__GEN_0__',
                            children: [
                                { type: 'path', d: 'M0,0L40,0L40,40L0,40z', animate: { d: animate } },
                            ],
                        },
                    ],
                },
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    clipPath: 'url(#__GEN_0__)',
                },
            ],
        };
        expect(materialise(input)).toEqual(expected);
    });


    it('case 6: repeater (static, 3 copies, translate+rotate per copy) → 3 <g> wrapped copies', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 40, height: 40,
                    effects: { repeater: { copies: 3, translate: [50, 0], rotate: 15 } },
                },
            ],
        };
        const result = materialise(input);
        // Repeater emits N copies wrapped in a parent <g>. Exact structure varies;
        // assert key invariants: 3 children. Copies 1..N have per-copy `transform`
        // (translate × i, rotate × i). Copy 0 is the identity baseline (no transform).
        const parent = result.children![0];
        expect(parent.type).toBe('g');
        expect(parent.children?.length).toBe(3);
        // Copies 1 and 2 carry transforms (copy 0 is the identity baseline).
        expect(parent.children![1].transform).toBeDefined();
        expect(parent.children![2].transform).toBeDefined();
    });


    it('case 6b: repeater (animated translate + rotate) → per-copy wrappers carry animate.transform with kf values scaled by i', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 40, height: 40,
                    effects: {
                        repeater: {
                            copies: 3,
                            translate: { keyframes: [
                                { time: 0, value: [50, 0] },
                                { time: 1000, value: [100, 50] },
                            ] },
                            rotate: { keyframes: [
                                { time: 0, value: 0 },
                                { time: 1000, value: 30 },
                            ] },
                        },
                    },
                },
            ],
        };
        const result = materialise(input);
        const parent = result.children![0];
        expect(parent.type).toBe('g');
        expect(parent.children?.length).toBe(3);

        // For each copy i≥1, dive into the per-copy wrapper subtree and find
        // the translate-bearing <g> whose animate.transform.keyframes carry the
        // EXPECTED scaled values (translate × i, rotate × i).
        const findKfsForPart = (n: PxNode, part: 'translate' | 'rotate'): Array<{ time?: number; value?: any }> | undefined => {
            const kfs = (n.animate as any)?.transform?.keyframes;
            if (Array.isArray(kfs) && kfs.length && kfs[0].value && (kfs[0].value as any)[part] !== undefined) {
                return kfs.map(kf => ({ time: kf.time, value: (kf.value as any)[part] }));
            }
            for (const c of n.children || []) {
                const found = findKfsForPart(c, part);
                if (found) return found;
            }
            return undefined;
        };

        for (const i of [1, 2]) {
            const copy = parent.children![i];
            const translateKfs = findKfsForPart(copy, 'translate');
            const rotateKfs = findKfsForPart(copy, 'rotate');
            expect(translateKfs).toEqual([
                { time: 0, value: [50 * i, 0 * i] },
                { time: 1000, value: [100 * i, 50 * i] },
            ]);
            expect(rotateKfs).toEqual([
                { time: 0, value: 0 * i },
                { time: 1000, value: 30 * i },
            ]);
        }
    });


    it('case 6c: repeater (animated scale) → per-axis `s^i` geometric compounding (kf values are 1.0-units on the wire)', () => {
        // Wire convention: animated repeater.scale.keyframes values are ALREADY
        // 1.0-units (the editor's writer converts from the model's PERCENT).
        // The applier does NOT divide by 100 for the keyframe form, just `s^i`.
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 40, height: 40,
                    effects: {
                        repeater: {
                            copies: 3,
                            scale: { keyframes: [
                                { time: 0, value: [2, 2] },     // 1.0-units → 2× scale per copy
                                { time: 1000, value: [1, 1] },  // 1.0-units → 1× (identity)
                            ] },
                        },
                    },
                },
            ],
        };
        const result = materialise(input);
        const parent = result.children![0];
        expect(parent.children?.length).toBe(3);

        const findScaleKfs = (n: PxNode): Array<{ time?: number; value?: any }> | undefined => {
            const kfs = (n.animate as any)?.transform?.keyframes;
            if (Array.isArray(kfs) && kfs.length && kfs[0].value && (kfs[0].value as any).scale !== undefined) {
                return kfs.map(kf => ({ time: kf.time, value: (kf.value as any).scale }));
            }
            for (const c of n.children || []) {
                const found = findScaleKfs(c);
                if (found) return found;
            }
            return undefined;
        };

        // Copy 1: 2^1=2, 1^1=1 → kfs are [2,2] then [1,1].
        expect(findScaleKfs(parent.children![1])).toEqual([
            { time: 0, value: [2, 2] },
            { time: 1000, value: [1, 1] },
        ]);
        // Copy 2: 2^2=4, 1^2=1 → kfs are [4,4] then [1,1].
        expect(findScaleKfs(parent.children![2])).toEqual([
            { time: 0, value: [4, 4] },
            { time: 1000, value: [1, 1] },
        ]);
    });


    it('case 7: retime (symbol clone) → <symbol> in defs, <use> href rewritten, inner ids regenerated', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                // Source symbol with an inner element that has an id (so we can verify regen)
                {
                    type: 'symbol', id: 'sym',
                    children: [
                        { type: 'rect', id: 'inner', width: 100, height: 50 },
                    ],
                },
                // Use that retimes the symbol — retime follows `<use>.href` now
                // (sourceId is no longer consulted; left on the payload only if
                // a producer still emits it — harmless).
                {
                    type: 'use',
                    href: '#sym',
                    effects: { clone: { retime: { start: 100, stretch: 0.5 } } },
                },
            ],
        };
        const result = materialise(input);
        // <defs> contains the cloned symbol with a fresh id; inner rect has a regenerated id
        const defs = result.children?.find(c => c.type === 'defs');
        expect(defs).toBeDefined();
        expect(defs!.children?.length).toBe(1);
        const cloneRoot = defs!.children![0];
        expect(cloneRoot.id).toMatch(/^__GEN_\d+__$/);  // fresh id
        // Inner rect under the clone also has a regenerated id (not the original `inner`)
        const innerInClone = cloneRoot.children?.find(c => c.type === 'rect');
        expect(innerInClone).toBeDefined();
        expect(innerInClone!.id).toMatch(/^__GEN_\d+__$/);
        expect(innerInClone!.id).not.toBe('inner');
        // Use's href points to the cloned root
        const use = result.children?.find(c => c.type === 'use');
        expect(use!.href).toBe('#' + cloneRoot.id);
    });


    it('case 8: transformation with autoOrient — outer +o/translate/-o sandwich around motion-path translate', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    effects: {
                        transformation: {
                            translate: {
                                autoOrient: true,
                                keyframes: [
                                    { time: 0, value: [0, 0], tangentOut: [40, 0] },
                                    { time: 1000, value: [100, 100], tangentIn: [-40, 0] },
                                ],
                            },
                            origin: [10, 10],
                        },
                    },
                },
            ],
        };
        const result = materialise(input);
        // Outermost should be +origin translate, then animated translate with autoOrient,
        // then -origin translate, then rect.
        const outer = result.children![0];
        expect(outer.type).toBe('g');
        // +origin = translate(10,10)
        expect(outer.transform).toEqual({ value: { translate: [10, 10] } });
        const animatedTranslate = outer.children![0];
        expect(animatedTranslate.type).toBe('g');
        // animated translate carries autoOrient + tangent metadata
        expect((animatedTranslate.animate as any)?.transform.autoOrient).toBe(true);
        expect((animatedTranslate.animate as any)?.transform.keyframes[0].tangentOut).toEqual([40, 0]);
        expect((animatedTranslate.animate as any)?.transform.keyframes[1].tangentIn).toEqual([-40, 0]);
        // -origin = translate(-10,-10) inside the animated translate wrapper
        const negOrigin = animatedTranslate.children![0];
        expect(negOrigin.type).toBe('g');
        expect(negOrigin.transform).toEqual({ value: { translate: [-10, -10] } });
    });


    it('case 9: node.effects is fully removed after materialisation', () => {
        const input: PxNode = {
            type: 'svg',
            children: [
                {
                    type: 'rect', id: 'r1', width: 100, height: 50,
                    effects: { transformation: { translate: [10, 20], rotate: 30 } },
                },
            ],
        };
        const result = materialise(input);
        // Walk the tree and assert NO `effects` bucket survives anywhere.
        const walk = (n: PxNode): void => {
            expect(n.effects).toBeUndefined();
            n.children?.forEach(walk);
        };
        walk(result);
    });
});
