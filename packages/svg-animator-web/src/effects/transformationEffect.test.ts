/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the TRANSFORMATION effect (`transformationEffect.ts`).
// One `<g>` wrapper per part; nesting outer→inner is
//   translate → +origin → rotate → scale → -origin → skew → element.
// Static parts emit `transform: { value: { <part>: v } }`; animated parts emit
// `animate.transform.keyframes`. Origin is emitted as +origin/-origin *translate*
// wrappers sandwiching rotate+scale. Bare-array `scale` is in EDITOR units
// (150 = 150%) and converts to 1.0-units (1.5); skew is static-only.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise, noEffectsRemain, normaliseGeneratedIds, transformKfTimes } from './effectTestKit';

const rect = (): PxNode => ({ type: 'rect', id: 'r', width: 100, height: 50 } as unknown as PxNode);
const wrap = (transformation: any): PxNode =>
    ({ type: 'svg', children: [{ ...rect(), effects: { transformation } }] } as unknown as PxNode);

/** Static `{value:{part:…}}` records carried by `<g>` wrappers. */
const staticParts = (out: PxNode): Array<any> =>
    collectByType(out, 'g').map(g => (g as any).transform).filter(t => t && typeof t === 'object').map(t => t.value);
/** String transforms (skew). */
const stringTransforms = (out: PxNode): Array<string> =>
    collectByType(out, 'g').map(g => (g as any).transform).filter(t => typeof t === 'string');


describe('transformationEffect — wrappers, static & animated parts', () => {

    it('case 1 — static translate → single <g transform:{value:{translate}}>', () => {
        const out = materialise(wrap({ translate: [40, 20] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100,
                  },
                ],
                "transform": {
                  "value": {
                    "translate": [
                      40,
                      20,
                    ],
                  },
                },
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(staticParts(out)).toContainEqual({ translate: [40, 20] });
        expect(collectByType(out, 'rect')).toHaveLength(1);
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 2 — static scale in EDITOR units (150) converts to 1.0-units (1.5)', () => {
        const out = materialise(wrap({ scale: [150, 150] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100,
                  },
                ],
                "transform": {
                  "value": {
                    "scale": [
                      1.5,
                      1.5,
                    ],
                  },
                },
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(staticParts(out)).toContainEqual({ scale: [1.5, 1.5] }); // NOT [150,150]
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 3 — static skew → string transform skewX()/skewY()', () => {
        const out = materialise(wrap({ skew: [10, 5] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100,
                  },
                ],
                "transform": "skewX(10)skewY(5)",
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(stringTransforms(out)).toContain('skewX(10)skewY(5)');
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 4 — static rotate + origin → +origin / rotate / -origin sandwich', () => {
        const out = materialise(wrap({ rotate: 45, origin: [50, 25] }));
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
                            "height": 50,
                            "id": "r",
                            "type": "rect",
                            "width": 100,
                          },
                        ],
                        "transform": {
                          "value": {
                            "translate": [
                              -50,
                              -25,
                            ],
                          },
                        },
                        "type": "g",
                      },
                    ],
                    "transform": {
                      "value": {
                        "rotate": 45,
                      },
                    },
                    "type": "g",
                  },
                ],
                "transform": {
                  "value": {
                    "translate": [
                      50,
                      25,
                    ],
                  },
                },
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        // origin emitted as plain translate wrappers: +[50,25] outside, -[50,25] inside
        expect(staticParts(out)).toContainEqual({ translate: [50, 25] });
        expect(staticParts(out)).toContainEqual({ translate: [-50, -25] });
        expect(staticParts(out)).toContainEqual({ rotate: 45 });
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 5 — animated translate → wrapper carries animate.transform.keyframes', () => {
        const out = materialise(wrap({
            translate: { keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [100, 0] }] },
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "animate": "{"transform":{"keyframes":[{"value":{"translate":[0,0]},"time":0},{"value":{"translate":[100,0]},"time":1000}]}}",
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100,
                  },
                ],
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(transformKfTimes(out)).toEqual([[0, 1000]]);
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 6 — animated rotate + static origin → rotate kfs pivot inside origin sandwich', () => {
        const out = materialise(wrap({
            rotate: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 90 }] },
            origin: [50, 25],
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "animate": "{"transform":{"keyframes":[{"value":{"rotate":0},"time":0},{"value":{"rotate":90},"time":1000}]}}",
                    "children": [
                      {
                        "children": [
                          {
                            "height": 50,
                            "id": "r",
                            "type": "rect",
                            "width": 100,
                          },
                        ],
                        "transform": {
                          "value": {
                            "translate": [
                              -50,
                              -25,
                            ],
                          },
                        },
                        "type": "g",
                      },
                    ],
                    "type": "g",
                  },
                ],
                "transform": {
                  "value": {
                    "translate": [
                      50,
                      25,
                    ],
                  },
                },
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(transformKfTimes(out)).toEqual([[0, 1000]]);              // the rotate wrapper animates
        expect(staticParts(out)).toContainEqual({ translate: [50, 25] }); // origin sandwich is static
        expect(staticParts(out)).toContainEqual({ translate: [-50, -25] });
        expect(noEffectsRemain(out)).toBe(true);
    });
});
