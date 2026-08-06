/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the MASKED-BY effect (`maskedByEffect.ts`).
// Mints a `<mask>` into defs holding `<use href=#source>` (wrapped in inverse-
// transform `<g>`s that cancel the masked element's own + ancestor transforms so
// the mask source paints at its original world position), then sets
// `node.mask = url(#maskId)`. `maskType`/`maskUnits`/`maskContentUnits` pass through.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, countNodes, materialise, materialiseRaw, normaliseGeneratedIds } from './effectTestKit';

/** A mask SOURCE shape + a TARGET rect masked by it. `extraEffects` merge
 *  alongside `maskedBy` on the target (e.g. add a `transformBy`). */
const scene = (maskedBy: any, extraEffects: any = {}): PxNode => ({
    type: 'svg',
    children: [
        { type: 'g', id: 'src', children: [{ type: 'circle', id: 'c', r: 30 }] },
        { type: 'rect', id: 'target', width: 100, height: 100, effects: { maskedBy, ...extraEffects } },
    ],
} as unknown as PxNode);

const maskNode = (out: PxNode): PxNode | undefined => collectByType(out, 'mask')[0];
const target = (out: PxNode): PxNode => collectByType(out, 'rect').find(r => (r as any).id === 'target')!;


describe('maskedByEffect — <mask> def + mask attr', () => {

    it('case 1 — static sourceId → one <mask> in defs holding <use href=#src>, target gets mask=url()', () => {
        const out = materialise(scene({ sourceId: 'src' }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "mask",
                    "children": [
                      {
                        "href": "#src",
                        "type": "use"
                      }
                    ]
                  }
                ]
              },
              {
                "id": "src",
                "type": "g",
                "children": [
                  {
                    "id": "c",
                    "r": 30,
                    "type": "circle"
                  }
                ]
              },
              {
                "height": 100,
                "id": "target",
                "mask": "url(#__GEN_0__)",
                "type": "rect",
                "width": 100
              }
            ]
          }"
        `);
        const mask = maskNode(out)!;
        expect(mask).toBeTruthy();
        expect(collectByType(out, 'mask')).toHaveLength(1);
        // mask content references the source via <use href=#src>
        expect(countNodes(mask, n => n.type === 'use' && n.href === '#src')).toBe(1);
        // target carries the mask attr pointing at the minted id
        expect((target(out) as any).mask).toMatch(/^url\(#.+\)$/);
        // no transforms to compensate → bare <use>, no inverse wrappers
        expect(countNodes(mask, n => n.type === 'g')).toBe(0);
    });

    it('case 2 — maskType / maskUnits / maskContentUnits pass through onto the <mask>', () => {
        const out = materialise(scene({
            sourceId: 'src', maskType: 'alpha', maskUnits: 'userSpaceOnUse', maskContentUnits: 'objectBoundingBox',
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "maskContentUnits": "objectBoundingBox",
                    "maskType": "alpha",
                    "maskUnits": "userSpaceOnUse",
                    "type": "mask",
                    "children": [
                      {
                        "href": "#src",
                        "type": "use"
                      }
                    ]
                  }
                ]
              },
              {
                "id": "src",
                "type": "g",
                "children": [
                  {
                    "id": "c",
                    "r": 30,
                    "type": "circle"
                  }
                ]
              },
              {
                "height": 100,
                "id": "target",
                "mask": "url(#__GEN_0__)",
                "type": "rect",
                "width": 100
              }
            ]
          }"
        `);
        const mask = maskNode(out)! as any;
        expect(mask.maskType).toBe('alpha');
        expect(mask.maskUnits).toBe('userSpaceOnUse');
        expect(mask.maskContentUnits).toBe('objectBoundingBox');
    });

    it('case 3 — masked element with own transformBy → mask source gets the INVERSE translate', () => {
        // target also translated +[60,0]; the mask must cancel it (inverse -[60,0])
        // so the source paints where it really is.
        const out = materialise(scene({ sourceId: 'src' }, { transformBy: { translate: [60, 0] } }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "mask",
                    "children": [
                      {
                        "transform": {
                          "value": {
                            "translate": [
                              -60,
                              0
                            ]
                          }
                        },
                        "type": "g",
                        "children": [
                          {
                            "href": "#src",
                            "type": "use"
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "id": "src",
                "type": "g",
                "children": [
                  {
                    "id": "c",
                    "r": 30,
                    "type": "circle"
                  }
                ]
              },
              {
                "id": "target",
                "transform": {
                  "value": {
                    "translate": [
                      60,
                      0
                    ]
                  }
                },
                "type": "g",
                "children": [
                  {
                    "height": 100,
                    "mask": "url(#__GEN_0__)",
                    "type": "rect",
                    "width": 100
                  }
                ]
              }
            ]
          }"
        `);
        const mask = maskNode(out)!;
        // inverse translate wrapper inside the mask
        const inverseParts = collectByType(mask, 'g')
            .map(g => (g as any).transform).filter(t => t && typeof t === 'object').map(t => t.value);
        // `-0 === 0` so this tolerates the negated-zero y the inverter produces.
        expect(inverseParts.some(p => p.translate && p.translate[0] === -60 && p.translate[1] === 0)).toBe(true);
    });

    it('case 4 — missing sourceId is rejected with an error (no mask minted)', () => {
        const { root, errors } = materialiseRaw(scene({ maskType: 'alpha' }));
        expect(errors.some(e => e.includes('maskedBy.sourceId missing'))).toBe(true);
        expect(collectByType(root, 'mask')).toHaveLength(0);
    });
});
