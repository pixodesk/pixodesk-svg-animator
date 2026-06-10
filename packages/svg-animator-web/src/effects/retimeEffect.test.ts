/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the RETIME player effect (`retimeEffect.ts`), driven
// through the real `applyPlayerEffects` pipeline (so content-ref split + retime
// run exactly as in production).
//
// Retime time-shifts a `<use>`'s referenced animation by `start` (+ scales by
// `stretch`): every keyframe `time` becomes `start + time*stretch`. Nested
// `<use>`s COMPOSE via `concatRetime`. The cleanest, most reason-about-able
// assertion is therefore the multiset of transform-keyframe `time` arrays that
// survive in the materialised tree — one entry per rendered animated element.
//
//   leaf ball animates translate over [0 .. 1000]ms.
//   a +250ms (=25f) retime  → that ball's clone animates over [250 .. 1250].
//   nested +250 over +250   → composes to +500 → [500 .. 1500].

import { describe, expect, it } from 'vitest';
import { applyPlayerEffects } from './PlayerEffectsUtil';
import type { PxNode } from '../PxAnimatorTypes';


/** A leaf shape that translates 0→100 (x) over the full 0..1000ms timeline. */
function animatedBall(id: string): PxNode {
    return {
        type: 'ellipse', id, rx: '16', ry: '16', fill: '#3399e6',
        animate: {
            transform: {
                keyframes: [
                    { time: 0, value: { translate: [0, 0] } },
                    { time: 1000, value: { translate: [100, 0] } },
                ],
            },
        },
    } as unknown as PxNode;
}

/** Every transform-keyframe `time` array in the tree, sorted for stable compare.
 *  One entry per animated element (the smoking gun for retime shift/compose). */
function transformKfTimes(root: PxNode): Array<Array<number>> {
    const out: Array<Array<number>> = [];
    const walk = (n: PxNode): void => {
        const kfs = (n.animate as any)?.transform?.keyframes;
        if (Array.isArray(kfs)) out.push(kfs.map((k: any) => k.time));
        n.children?.forEach(walk);
    };
    walk(root);
    return out.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

/** A `<use>` that still carries an un-consumed retime effect = a materialisation
 *  miss (retime should always be folded into a clone, never left dangling). */
function danglingRetimeCount(root: PxNode): number {
    let n = 0;
    const walk = (node: PxNode): void => {
        if (node.type === 'use' && (node.effects as any)?.retime) n++;
        node.children?.forEach(walk);
    };
    walk(root);
    return n;
}

function materialise(input: PxNode): PxNode {
    const { root, errors } = applyPlayerEffects(input);
    if (errors.length) throw new Error('applyPlayerEffects errors:\n' + errors.join('\n'));
    return root;
}

/** Replaces auto-allocated `_lw_*` ids with stable `__GEN_N__` slugs (and rewrites
 *  `#…` href references to them) so full-tree snapshots don't churn on id counter
 *  changes. Same convention as PlayerEffectsUtil.test.ts. */
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
        if (typeof n.id === 'string' && n.id.startsWith('_lw_')) n.id = alloc(n.id);
        n.children?.forEach(walkAssign);
    };
    walkAssign(cloned);
    const walkRewrite = (n: PxNode): void => {
        if (typeof n.href === 'string' && n.href.startsWith('#')) {
            const mapped = map.get(n.href.slice(1));
            if (mapped) n.href = '#' + mapped;
        }
        // Collapse `animate` to a single-line JSON string so the snapshot stays
        // compact (keyframe arrays otherwise explode to ~10 lines each).
        if (n.animate) (n as any).animate = JSON.stringify(n.animate);
        n.children?.forEach(walkRewrite);
    };
    walkRewrite(cloned);
    return cloned;
}


describe('retimeEffect — keyframe time-shift & composition', () => {

    it('case 1 — single retime via bare href (start only) shifts the clone +250', () => {
        const input: PxNode = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                { type: 'g', id: 'src', children: [animatedBall('ball')] },
                { type: 'use', href: '#src', effects: { retime: { start: 250 } } },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "animate": "{"transform":{"keyframes":[{"time":250,"value":{"translate":[0,0]}},{"time":1250,"value":{"translate":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_1__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse",
                      },
                    ],
                    "id": "__GEN_0__",
                    "type": "g",
                  },
                ],
                "type": "defs",
              },
              {
                "children": [
                  {
                    "animate": "{"transform":{"keyframes":[{"time":0,"value":{"translate":[0,0]}},{"time":1000,"value":{"translate":[100,0]}}]}}",
                    "fill": "#3399e6",
                    "id": "ball",
                    "rx": "16",
                    "ry": "16",
                    "type": "ellipse",
                  },
                ],
                "id": "src",
                "type": "g",
              },
              {
                "href": "#__GEN_0__",
                "type": "use",
              },
            ],
            "type": "svg",
            "viewBox": "0 0 400 400",
          }
        `);
        // original src ball [0,1000] + retimed clone [250,1250]
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 1250]]);
        expect(danglingRetimeCount(out)).toBe(0);
    });

    it('case 2 — single retime with stretch=0.5 maps time → start + time*stretch', () => {
        const input: PxNode = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                { type: 'g', id: 'src', children: [animatedBall('ball')] },
                { type: 'use', href: '#src', effects: { retime: { start: 250, stretch: 0.5 } } },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "animate": "{"transform":{"keyframes":[{"time":250,"value":{"translate":[0,0]}},{"time":750,"value":{"translate":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_1__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse",
                      },
                    ],
                    "id": "__GEN_0__",
                    "type": "g",
                  },
                ],
                "type": "defs",
              },
              {
                "children": [
                  {
                    "animate": "{"transform":{"keyframes":[{"time":0,"value":{"translate":[0,0]}},{"time":1000,"value":{"translate":[100,0]}}]}}",
                    "fill": "#3399e6",
                    "id": "ball",
                    "rx": "16",
                    "ry": "16",
                    "type": "ellipse",
                  },
                ],
                "id": "src",
                "type": "g",
              },
              {
                "href": "#__GEN_0__",
                "type": "use",
              },
            ],
            "type": "svg",
            "viewBox": "0 0 400 400",
          }
        `);
        // clone: 0→250, 1000→250+1000*0.5=750
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 750]]);
        expect(danglingRetimeCount(out)).toBe(0);
    });

    it('case 3 — NESTED retime via bare href composes (use→use→src) → +500', () => {
        const input: PxNode = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                { type: 'g', id: 'src', children: [animatedBall('ball')] },
                { type: 'use', id: 'u1', href: '#src', effects: { retime: { start: 250 } } },
                { type: 'use', href: '#u1', effects: { retime: { start: 250 } } },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "animate": "{"transform":{"keyframes":[{"time":250,"value":{"translate":[0,0]}},{"time":1250,"value":{"translate":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_1__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse",
                      },
                    ],
                    "id": "__GEN_0__",
                    "type": "g",
                  },
                  {
                    "children": [
                      {
                        "animate": "{"transform":{"keyframes":[{"time":500,"value":{"translate":[0,0]}},{"time":1500,"value":{"translate":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_3__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse",
                      },
                    ],
                    "id": "__GEN_2__",
                    "type": "g",
                  },
                  {
                    "href": "#__GEN_2__",
                    "id": "__GEN_4__",
                    "type": "use",
                  },
                ],
                "type": "defs",
              },
              {
                "children": [
                  {
                    "animate": "{"transform":{"keyframes":[{"time":0,"value":{"translate":[0,0]}},{"time":1000,"value":{"translate":[100,0]}}]}}",
                    "fill": "#3399e6",
                    "id": "ball",
                    "rx": "16",
                    "ry": "16",
                    "type": "ellipse",
                  },
                ],
                "id": "src",
                "type": "g",
              },
              {
                "href": "#__GEN_0__",
                "id": "u1",
                "type": "use",
              },
              {
                "href": "#__GEN_4__",
                "type": "use",
              },
            ],
            "type": "svg",
            "viewBox": "0 0 400 400",
          }
        `);
        // src [0,1000] · u1 clone +250 [250,1250] · outer clone composed +500 [500,1500]
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 1250], [500, 1500]]);
        expect(danglingRetimeCount(out)).toBe(0);
    });

    it('case 4 — NESTED CONTENT-REF retime (curated effect.retime.nested) composes → +500', () => {
        // ell1 (a NON-animated <g> wrapping the animated ball) ← use1(content-ref, +250)
        // ← use2(content-ref, +250). Mirrors the editor fixture's lightweight wire.
        const input: PxNode = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                {
                    type: 'use', href: '#use1', y: '100',
                    effects: { ref: { baseId: 'use1', type: 'content' }, retime: { start: 250 } },
                },
                {
                    type: 'use', id: 'use1', href: '#ell1', y: '100',
                    effects: { ref: { baseId: 'ell1', type: 'content' }, retime: { start: 250 } },
                },
                { type: 'g', id: 'ell1', children: [animatedBall('ball')] },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "children": [
                          {
                            "animate": "{"transform":{"keyframes":[{"time":500,"value":{"translate":[0,0]}},{"time":1500,"value":{"translate":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "__GEN_1__",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse",
                          },
                        ],
                        "type": "g",
                      },
                    ],
                    "id": "__GEN_0__",
                    "type": "g",
                  },
                  {
                    "children": [
                      {
                        "href": "#__GEN_0__",
                        "type": "use",
                        "y": "100",
                      },
                    ],
                    "id": "__GEN_2__",
                    "type": "g",
                  },
                  {
                    "children": [
                      {
                        "children": [
                          {
                            "animate": "{"transform":{"keyframes":[{"time":250,"value":{"translate":[0,0]}},{"time":1250,"value":{"translate":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "__GEN_4__",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse",
                          },
                        ],
                        "type": "g",
                      },
                    ],
                    "id": "__GEN_3__",
                    "type": "g",
                  },
                ],
                "type": "defs",
              },
              {
                "href": "#__GEN_2__",
                "type": "use",
                "y": "100",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "href": "#__GEN_3__",
                        "type": "use",
                        "y": "100",
                      },
                    ],
                    "id": "__GEN_5__",
                    "type": "g",
                  },
                ],
                "id": "use1",
                "type": "g",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "children": [
                          {
                            "animate": "{"transform":{"keyframes":[{"time":0,"value":{"translate":[0,0]}},{"time":1000,"value":{"translate":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "ball",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse",
                          },
                        ],
                        "type": "g",
                      },
                    ],
                    "id": "__GEN_6__",
                    "type": "g",
                  },
                ],
                "id": "ell1",
                "type": "g",
              },
            ],
            "type": "svg",
            "viewBox": "0 0 400 400",
          }
        `);
        // Same three shifts as the bare-href nested case — content-ref must NOT
        // change the timing composition: lead [0,1000] · use1 [250,1250] · use2 [500,1500].
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 1250], [500, 1500]]);
        expect(danglingRetimeCount(out)).toBe(0);
    });
});
