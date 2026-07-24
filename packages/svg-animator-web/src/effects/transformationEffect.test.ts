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
import { collectByType, materialise, materialiseEngine, noEffectsRemain, normaliseGeneratedIds, PxAnimatorEngine, transformKfTimes } from './effectTestKit';

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
          "{
            "type": "svg",
            "children": [
              {
                "transform": {
                  "value": {
                    "translate": [
                      40,
                      20
                    ]
                  }
                },
                "type": "g",
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100
                  }
                ]
              }
            ]
          }"
        `);
        expect(staticParts(out)).toContainEqual({ translate: [40, 20] });
        expect(collectByType(out, 'rect')).toHaveLength(1);
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 2 — static scale in EDITOR units (150) converts to 1.0-units (1.5)', () => {
        const out = materialise(wrap({ scale: [150, 150] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "transform": {
                  "value": {
                    "scale": [
                      1.5,
                      1.5
                    ]
                  }
                },
                "type": "g",
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100
                  }
                ]
              }
            ]
          }"
        `);
        expect(staticParts(out)).toContainEqual({ scale: [1.5, 1.5] }); // NOT [150,150]
        expect(noEffectsRemain(out)).toBe(true);
    });

    // Skew is a SCALAR (skewX degrees) since the parts-record slot landed — the old
    // Vec2 `skewX()skewY()` string form never matched what the editor writes and is gone
    // (see skew-support.plan.md; user-approved order/semantics unification).
    it('case 3 — static skew → standard parts-record wrapper (scalar skewX)', () => {
        const out = materialise(wrap({ skew: 10 }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "transform": {
                  "value": {
                    "skew": 10
                  }
                },
                "type": "g",
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100
                  }
                ]
              }
            ]
          }"
        `);
        expect(staticParts(out)).toContainEqual({ skew: 10 });
        expect(noEffectsRemain(out)).toBe(true);
    });

    it('case 4 — static rotate + origin → +origin / rotate / -origin sandwich', () => {
        const out = materialise(wrap({ rotate: 45, origin: [50, 25] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "transform": {
                  "value": {
                    "translate": [
                      50,
                      25
                    ]
                  }
                },
                "type": "g",
                "children": [
                  {
                    "transform": {
                      "value": {
                        "rotate": 45
                      }
                    },
                    "type": "g",
                    "children": [
                      {
                        "transform": {
                          "value": {
                            "translate": [
                              -50,
                              -25
                            ]
                          }
                        },
                        "type": "g",
                        "children": [
                          {
                            "height": 50,
                            "id": "r",
                            "type": "rect",
                            "width": 100
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }"
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
          "{
            "type": "svg",
            "children": [
              {
                "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"value\\":{\\"translate\\":[0,0]},\\"time\\":0},{\\"value\\":{\\"translate\\":[100,0]},\\"time\\":1000}]}}",
                "type": "g",
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100
                  }
                ]
              }
            ]
          }"
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
          "{
            "type": "svg",
            "children": [
              {
                "transform": {
                  "value": {
                    "translate": [
                      50,
                      25
                    ]
                  }
                },
                "type": "g",
                "children": [
                  {
                    "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"value\\":{\\"rotate\\":0},\\"time\\":0},{\\"value\\":{\\"rotate\\":90},\\"time\\":1000}]}}",
                    "type": "g",
                    "children": [
                      {
                        "transform": {
                          "value": {
                            "translate": [
                              -50,
                              -25
                            ]
                          }
                        },
                        "type": "g",
                        "children": [
                          {
                            "height": 50,
                            "id": "r",
                            "type": "rect",
                            "width": 100
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }"
        `);
        expect(transformKfTimes(out)).toEqual([[0, 1000]]);              // the rotate wrapper animates
        expect(staticParts(out)).toContainEqual({ translate: [50, 25] }); // origin sandwich is static
        expect(staticParts(out)).toContainEqual({ translate: [-50, -25] });
        expect(noEffectsRemain(out)).toBe(true);
    });

    // ── Engine difference (full pipeline `materialiseAllInTree`) ──────────────
    // The effect pass itself is engine-agnostic; the WAAPI-vs-frames difference
    // is the webapi-only MOTION-PATH flatten. An autoOrient translate (curved,
    // with tangent handles) is the transformation case that exercises it.
    const AUTO_ORIENT = {
        translate: {
            autoOrient: true,
            keyframes: [
                { time: 0, value: [0, 0], tangentOut: [60, 0] },
                { time: 1000, value: [120, 120], tangentIn: [0, -60] },
            ],
        },
    };

    it('case 7 — autoOrient translate, FRAMES engine → parametric kept (tangents/autoOrient survive)', () => {
        const out = materialiseEngine(wrap(AUTO_ORIENT), PxAnimatorEngine.frames);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"value\\":{\\"translate\\":[0,0]},\\"time\\":0,\\"tangentOut\\":[60,0]},{\\"value\\":{\\"translate\\":[120,120]},\\"time\\":1000,\\"tangentIn\\":[0,-60]}],\\"autoOrient\\":true}}",
                "type": "g",
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100
                  }
                ]
              }
            ]
          }"
        `);
        // frames keeps the raw motion-path form — autoOrient flag + only the 2 authored kfs
        const animated = collectByType(out, 'g').map(g => (g as any).animate?.transform).find(Boolean) as any;
        expect(animated.autoOrient).toBe(true);
        expect(animated.keyframes).toHaveLength(2);
    });

    it('case 8 — autoOrient translate, WAAPI engine → motion-path FLATTENED (sampled, rotate baked, no autoOrient)', () => {
        const framesOut = materialiseEngine(wrap(AUTO_ORIENT), PxAnimatorEngine.frames);
        const out = materialiseEngine(wrap(AUTO_ORIENT), PxAnimatorEngine.webapi);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "animate": "{\\"transform\\":{\\"kfs\\":[{\\"t\\":0,\\"v\\":{\\"translate\\":[0,0],\\"rotate\\":0}},{\\"t\\":30.273579205331064,\\"v\\":{\\"translate\\":[5.6231689453125,0.1739501953125],\\"rotate\\":3.524028583874214}},{\\"t\\":60.600241825328006,\\"v\\":{\\"translate\\":[11.2353515625,0.6884765625],\\"rotate\\":6.931356798315828}},{\\"t\\":91.02273763233231,\\"v\\":{\\"translate\\":[16.8255615234375,1.5325927734375],\\"rotate\\":10.220376123953532}},{\\"t\\":121.57390795927078,\\"v\\":{\\"translate\\":[22.3828125,2.6953125],\\"rotate\\":13.392497753751098}},{\\"t\\":152.27739409843252,\\"v\\":{\\"translate\\":[27.8961181640625,4.1656494140625],\\"rotate\\":16.451622636657152}},{\\"t\\":183.14841561022726,\\"v\\":{\\"translate\\":[33.3544921875,5.9326171875],\\"rotate\\":19.403625737855755}},{\\"t\\":214.19458317526022,\\"v\\":{\\"translate\\":[38.7469482421875,7.9852294921875],\\"rotate\\":22.255887893373735}},{\\"t\\":245.41671860049752,\\"v\\":{\\"translate\\":[44.0625,10.3125],\\"rotate\\":25.016893478100023}},{\\"t\\":276.8117273152399,\\"v\\":{\\"translate\\":[49.2901611328125,12.9034423828125],\\"rotate\\":27.69590038078042}},{\\"t\\":308.36682191529303,\\"v\\":{\\"translate\\":[54.4189453125,15.7470703125],\\"rotate\\":30.30268072048809}},{\\"t\\":340.0670585706286,\\"v\\":{\\"translate\\":[59.4378662109375,18.8323974609375],\\"rotate\\":32.847325870977365}},{\\"t\\":371.8937880405679,\\"v\\":{\\"translate\\":[64.3359375,22.1484375],\\"rotate\\":35.34010692155767}},{\\"t\\":435.8376294849879,\\"v\\":{\\"translate\\":[73.7255859375,29.4287109375],\\"rotate\\":40.211533449686414}},{\\"t\\":499.99999999999966,\\"v\\":{\\"translate\\":[82.5,37.5],\\"rotate\\":45}},{\\"t\\":564.1623705150116,\\"v\\":{\\"translate\\":[90.5712890625,46.2744140625],\\"rotate\\":49.78846655031359}},{\\"t\\":628.1062119594317,\\"v\\":{\\"translate\\":[97.8515625,55.6640625],\\"rotate\\":54.65989307844234}},{\\"t\\":659.9329414293709,\\"v\\":{\\"translate\\":[101.1676025390625,60.5621337890625],\\"rotate\\":57.15267412902264}},{\\"t\\":691.6331780847065,\\"v\\":{\\"translate\\":[104.2529296875,65.5810546875],\\"rotate\\":59.697319279511916}},{\\"t\\":723.1882726847598,\\"v\\":{\\"translate\\":[107.0965576171875,70.7098388671875],\\"rotate\\":62.304099619219585}},{\\"t\\":754.5832813995023,\\"v\\":{\\"translate\\":[109.6875,75.9375],\\"rotate\\":64.98310652189998}},{\\"t\\":785.8054168247395,\\"v\\":{\\"translate\\":[112.0147705078125,81.2530517578125],\\"rotate\\":67.74411210662628}},{\\"t\\":816.8515843897725,\\"v\\":{\\"translate\\":[114.0673828125,86.6455078125],\\"rotate\\":70.59637426214424}},{\\"t\\":847.722605901567,\\"v\\":{\\"translate\\":[115.8343505859375,92.1038818359375],\\"rotate\\":73.54837736334285}},{\\"t\\":878.4260920407289,\\"v\\":{\\"translate\\":[117.3046875,97.6171875],\\"rotate\\":76.6075022462489}},{\\"t\\":908.9772623676675,\\"v\\":{\\"translate\\":[118.4674072265625,103.1744384765625],\\"rotate\\":79.77962387604647}},{\\"t\\":939.3997581746719,\\"v\\":{\\"translate\\":[119.3115234375,108.7646484375],\\"rotate\\":83.06864320168418}},{\\"t\\":969.726420794669,\\"v\\":{\\"translate\\":[119.8260498046875,114.3768310546875],\\"rotate\\":86.47597141612579}},{\\"t\\":1000,\\"v\\":{\\"translate\\":[120,120],\\"rotate\\":90}}]}}",
                "type": "g",
                "children": [
                  {
                    "height": 50,
                    "id": "r",
                    "type": "rect",
                    "width": 100
                  }
                ]
              }
            ]
          }"
        `);
        const animated = collectByType(out, 'g').map(g => (g as any).animate?.transform).find(Boolean) as any;
        // webapi flattens to the SHORT kf form (`kfs` with `t`/`v` aliases): autoOrient
        // consumed, many SAMPLED kfs, each value carries a baked `rotate` (path tangent).
        const kfs = animated.kfs ?? animated.keyframes;
        expect(animated.autoOrient).toBeUndefined();
        expect(kfs.length).toBeGreaterThan(2);
        expect(kfs.some((k: any) => { const v = k.v ?? k.value; return v && typeof v.rotate === 'number'; })).toBe(true);
        // and the two engines genuinely diverge
        expect(JSON.stringify(out)).not.toEqual(JSON.stringify(framesOut));
    });
});
