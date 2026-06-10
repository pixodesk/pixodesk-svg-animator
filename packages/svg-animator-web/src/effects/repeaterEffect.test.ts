/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the REPEATER effect (`repeaterEffect.ts`).
// `copies = N` → a `<g>` wrapper with N children: copy 0 is the bare base, copies
// 1..N-1 are wrapped with a per-copy transform synthesised from the repeater parts:
//   translate × i · rotate × i · scale ^ i (per-axis geometric) · origin CONSTANT.
// Each part is independently animatable — animated parts project to per-copy
// `animate.transform.keyframes` with kf values scaled by the same rule.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise, materialiseRaw, noEffectsRemain, normaliseGeneratedIds, transformKfTimes } from './effectTestKit';

const rect = (): PxNode => ({ type: 'rect', id: 'r', width: 20, height: 20 } as unknown as PxNode);
const wrap = (repeater: any): PxNode =>
    ({ type: 'svg', children: [{ ...rect(), effects: { repeater } }] } as unknown as PxNode);

/** Static `{value}` part records on `<g>` wrappers. */
const staticParts = (out: PxNode): Array<any> =>
    collectByType(out, 'g').map(g => (g as any).transform).filter(t => t && typeof t === 'object').map(t => t.value);
/** Last-keyframe `translate` value of every animated `<g>` (per-copy end pose). */
const animTranslateEnds = (out: PxNode): Array<any> =>
    collectByType(out, 'g')
        .map(g => (g as any).animate?.transform?.keyframes)
        .filter(Array.isArray)
        .map((kfs: Array<any>) => kfs[kfs.length - 1].value.translate);


describe('repeaterEffect — per-copy transform synthesis', () => {

    it('case 1 — static translate, 3 copies → copy i shifted by translate×i', () => {
        const out = materialise(wrap({ copies: 3, translate: [30, 0] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "height": 20,
                    "id": "r",
                    "type": "rect",
                    "width": 20,
                  },
                  {
                    "children": [
                      {
                        "height": 20,
                        "id": "r",
                        "type": "rect",
                        "width": 20,
                      },
                    ],
                    "transform": {
                      "value": {
                        "translate": [
                          30,
                          0,
                        ],
                      },
                    },
                    "type": "g",
                  },
                  {
                    "children": [
                      {
                        "height": 20,
                        "id": "r",
                        "type": "rect",
                        "width": 20,
                      },
                    ],
                    "transform": {
                      "value": {
                        "translate": [
                          60,
                          0,
                        ],
                      },
                    },
                    "type": "g",
                  },
                ],
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(collectByType(out, 'rect')).toHaveLength(3);        // base + 2 clones
        expect(staticParts(out)).toContainEqual({ translate: [30, 0] });   // copy 1
        expect(staticParts(out)).toContainEqual({ translate: [60, 0] });   // copy 2
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 2 — animated translate, 3 copies → each copy carries animate.transform, kf values ×i', () => {
        const out = materialise(wrap({
            copies: 3,
            translate: { keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [100, 0] }] },
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "height": 20,
                    "id": "r",
                    "type": "rect",
                    "width": 20,
                  },
                  {
                    "animate": "{"transform":{"keyframes":[{"value":{"translate":[0,0]},"time":0},{"value":{"translate":[100,0]},"time":1000}]}}",
                    "children": [
                      {
                        "height": 20,
                        "id": "r",
                        "type": "rect",
                        "width": 20,
                      },
                    ],
                    "type": "g",
                  },
                  {
                    "animate": "{"transform":{"keyframes":[{"value":{"translate":[0,0]},"time":0},{"value":{"translate":[200,0]},"time":1000}]}}",
                    "children": [
                      {
                        "height": 20,
                        "id": "r",
                        "type": "rect",
                        "width": 20,
                      },
                    ],
                    "type": "g",
                  },
                ],
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(transformKfTimes(out)).toEqual([[0, 1000], [0, 1000]]);     // 2 animated copies
        expect(animTranslateEnds(out)).toContainEqual([100, 0]);           // copy 1 end
        expect(animTranslateEnds(out)).toContainEqual([200, 0]);           // copy 2 end (×2)
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 3 — static scale (PERCENT bare array) compounds per axis s^i in 1.0-units', () => {
        const out = materialise(wrap({ copies: 3, scale: [50, 50] }));   // 50% = 0.5×
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "height": 20,
                    "id": "r",
                    "type": "rect",
                    "width": 20,
                  },
                  {
                    "children": [
                      {
                        "height": 20,
                        "id": "r",
                        "type": "rect",
                        "width": 20,
                      },
                    ],
                    "transform": {
                      "value": {
                        "scale": [
                          0.5,
                          0.5,
                        ],
                      },
                    },
                    "type": "g",
                  },
                  {
                    "children": [
                      {
                        "height": 20,
                        "id": "r",
                        "type": "rect",
                        "width": 20,
                      },
                    ],
                    "transform": {
                      "value": {
                        "scale": [
                          0.25,
                          0.25,
                        ],
                      },
                    },
                    "type": "g",
                  },
                ],
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(staticParts(out)).toContainEqual({ scale: [0.5, 0.5] });    // copy 1 = 0.5^1
        expect(staticParts(out)).toContainEqual({ scale: [0.25, 0.25] });  // copy 2 = 0.5^2
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 4 — rotate×i with CONSTANT origin (no spiral drift)', () => {
        const out = materialise(wrap({ copies: 3, rotate: 30, origin: [40, 40] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "children": [
                  {
                    "height": 20,
                    "id": "r",
                    "type": "rect",
                    "width": 20,
                  },
                  {
                    "children": [
                      {
                        "children": [
                          {
                            "children": [
                              {
                                "height": 20,
                                "id": "r",
                                "type": "rect",
                                "width": 20,
                              },
                            ],
                            "transform": {
                              "value": {
                                "translate": [
                                  -40,
                                  -40,
                                ],
                              },
                            },
                            "type": "g",
                          },
                        ],
                        "transform": {
                          "value": {
                            "rotate": 30,
                          },
                        },
                        "type": "g",
                      },
                    ],
                    "transform": {
                      "value": {
                        "translate": [
                          40,
                          40,
                        ],
                      },
                    },
                    "type": "g",
                  },
                  {
                    "children": [
                      {
                        "children": [
                          {
                            "children": [
                              {
                                "height": 20,
                                "id": "r",
                                "type": "rect",
                                "width": 20,
                              },
                            ],
                            "transform": {
                              "value": {
                                "translate": [
                                  -40,
                                  -40,
                                ],
                              },
                            },
                            "type": "g",
                          },
                        ],
                        "transform": {
                          "value": {
                            "rotate": 60,
                          },
                        },
                        "type": "g",
                      },
                    ],
                    "transform": {
                      "value": {
                        "translate": [
                          40,
                          40,
                        ],
                      },
                    },
                    "type": "g",
                  },
                ],
                "type": "g",
              },
            ],
            "type": "svg",
          }
        `);
        expect(staticParts(out)).toContainEqual({ rotate: 30 });           // copy 1
        expect(staticParts(out)).toContainEqual({ rotate: 60 });           // copy 2 (×2)
        // origin stays [40,40] for BOTH copies — NOT scaled to [80,80]
        expect(staticParts(out)).toContainEqual({ translate: [40, 40] });
        expect(staticParts(out)).not.toContainEqual({ translate: [80, 80] });
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 5 — copies < 1 is rejected with an error (no crash)', () => {
        const { errors } = materialiseRaw(wrap({ copies: 0, translate: [10, 0] }));
        expect(errors.some(e => e.includes('repeater.copies invalid'))).toBe(true);
    });
});
