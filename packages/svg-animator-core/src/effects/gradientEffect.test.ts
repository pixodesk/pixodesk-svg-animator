/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the GRADIENT effects (`gradientEffect.ts`) —
// `fillGradient` / `strokeGradient`. Mints a `<linearGradient>` / `<radialGradient>`
// def (geometry as static attrs) with one `<stop>` per colour stop, then rewrites
// the host's `fill` / `stroke` to `url(#id)`. Static stops are bare; an animated
// stop timeline is SLICED per-index into each `<stop>`'s `animate.stopColor.keyframes`.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise, normaliseGeneratedIds } from './effectTestKit';

const STOPS = [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }];
const rect = (effects: any): PxNode =>
    ({ type: 'svg', children: [{ type: 'rect', id: 'r', width: 100, height: 100, fill: '#000', effects }] } as unknown as PxNode);

const theRect = (out: PxNode): any => collectByType(out, 'rect')[0];
const stopsOf = (def: PxNode): Array<any> => collectByType(def, 'stop');


describe('gradientEffect — linear/radial def + stops, static & animated', () => {

    it('case 1 — static linear fillGradient → <linearGradient> def + bare stops, fill=url()', () => {
        const out = materialise(rect({ fillGradient: { type: 'linear', p1: [0, 0], p2: [100, 0], stops: STOPS } }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "linearGradient",
                    "x1": "0",
                    "x2": "100",
                    "y1": "0",
                    "y2": "0",
                    "children": [
                      {
                        "offset": "0%",
                        "stopColor": "#ff0000",
                        "type": "stop"
                      },
                      {
                        "offset": "100%",
                        "stopColor": "#0000ff",
                        "type": "stop"
                      }
                    ]
                  }
                ]
              },
              {
                "fill": "url(#__GEN_0__)",
                "height": 100,
                "id": "r",
                "type": "rect",
                "width": 100
              }
            ]
          }"
        `);
        const defs = collectByType(out, 'linearGradient');
        expect(defs).toHaveLength(1);
        const def = defs[0] as any;
        expect([def.x1, def.y1, def.x2, def.y2]).toEqual(['0', '0', '100', '0']);
        const stops = stopsOf(def);
        expect(stops).toHaveLength(2);
        expect(stops[0]).toMatchObject({ offset: '0%', stopColor: '#ff0000' });
        expect(stops[1]).toMatchObject({ offset: '100%', stopColor: '#0000ff' });
        expect(theRect(out).fill).toMatch(/^url\(#.+\)$/);
    });

    it('case 2 — static radial fillGradient → <radialGradient> with cx/cy/r/fx/fy', () => {
        const out = materialise(rect({ fillGradient: { type: 'radial', c: [50, 50], r: 40, fp: [50, 50], stops: STOPS } }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "cx": "50",
                    "cy": "50",
                    "fx": "50",
                    "fy": "50",
                    "id": "__GEN_0__",
                    "r": "40",
                    "type": "radialGradient",
                    "children": [
                      {
                        "offset": "0%",
                        "stopColor": "#ff0000",
                        "type": "stop"
                      },
                      {
                        "offset": "100%",
                        "stopColor": "#0000ff",
                        "type": "stop"
                      }
                    ]
                  }
                ]
              },
              {
                "fill": "url(#__GEN_0__)",
                "height": 100,
                "id": "r",
                "type": "rect",
                "width": 100
              }
            ]
          }"
        `);
        const def = collectByType(out, 'radialGradient')[0] as any;
        expect([def.cx, def.cy, def.r, def.fx, def.fy]).toEqual(['50', '50', '40', '50', '50']);
        expect(stopsOf(def)).toHaveLength(2);
    });

    it('case 3 — animated stops → each <stop> gets animate.stopColor.keyframes (sliced per index)', () => {
        const out = materialise(rect({
            fillGradient: {
                type: 'linear', p1: [0, 0], p2: [100, 0],
                stops: {
                    keyframes: [
                        { time: 0, value: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] },
                        { time: 1000, value: [{ offset: 0, color: '#00ff00' }, { offset: 1, color: '#ffff00' }] },
                    ],
                },
            },
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
                    "type": "linearGradient",
                    "x1": "0",
                    "x2": "100",
                    "y1": "0",
                    "y2": "0",
                    "children": [
                      {
                        "animate": "{\\"stopColor\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":\\"#ff0000\\"},{\\"time\\":1000,\\"value\\":\\"#00ff00\\"}]}}",
                        "offset": "0%",
                        "stopColor": "#ff0000",
                        "type": "stop"
                      },
                      {
                        "animate": "{\\"stopColor\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":\\"#0000ff\\"},{\\"time\\":1000,\\"value\\":\\"#ffff00\\"}]}}",
                        "offset": "100%",
                        "stopColor": "#0000ff",
                        "type": "stop"
                      }
                    ]
                  }
                ]
              },
              {
                "fill": "url(#__GEN_0__)",
                "height": 100,
                "id": "r",
                "type": "rect",
                "width": 100
              }
            ]
          }"
        `);
        const stops = stopsOf(collectByType(out, 'linearGradient')[0]) as Array<any>;
        expect(stops).toHaveLength(2);
        // stop 0 animates #ff0000 → #00ff00 ; stop 1 animates #0000ff → #ffff00
        expect(stops[0].animate.stopColor.keyframes.map((k: any) => k.value)).toEqual(['#ff0000', '#00ff00']);
        expect(stops[1].animate.stopColor.keyframes.map((k: any) => k.value)).toEqual(['#0000ff', '#ffff00']);
    });

    it('case 4 — strokeGradient rewrites STROKE (not fill)', () => {
        const out = materialise(rect({ strokeGradient: { type: 'linear', p1: [0, 0], p2: [100, 0], stops: STOPS } }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "linearGradient",
                    "x1": "0",
                    "x2": "100",
                    "y1": "0",
                    "y2": "0",
                    "children": [
                      {
                        "offset": "0%",
                        "stopColor": "#ff0000",
                        "type": "stop"
                      },
                      {
                        "offset": "100%",
                        "stopColor": "#0000ff",
                        "type": "stop"
                      }
                    ]
                  }
                ]
              },
              {
                "fill": "#000",
                "height": 100,
                "id": "r",
                "stroke": "url(#__GEN_0__)",
                "type": "rect",
                "width": 100
              }
            ]
          }"
        `);
        const r = theRect(out);
        expect(r.stroke).toMatch(/^url\(#.+\)$/);
        expect(r.fill).toBe('#000'); // untouched
        expect(collectByType(out, 'linearGradient')).toHaveLength(1);
    });

    it('case 5 — gradientUnits / spreadMethod pass through onto the def', () => {
        const out = materialise(rect({
            fillGradient: { type: 'linear', p1: [0, 0], p2: [100, 0], stops: STOPS, gradientUnits: 'userSpaceOnUse', spreadMethod: 'reflect' },
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "gradientUnits": "userSpaceOnUse",
                    "id": "__GEN_0__",
                    "spreadMethod": "reflect",
                    "type": "linearGradient",
                    "x1": "0",
                    "x2": "100",
                    "y1": "0",
                    "y2": "0",
                    "children": [
                      {
                        "offset": "0%",
                        "stopColor": "#ff0000",
                        "type": "stop"
                      },
                      {
                        "offset": "100%",
                        "stopColor": "#0000ff",
                        "type": "stop"
                      }
                    ]
                  }
                ]
              },
              {
                "fill": "url(#__GEN_0__)",
                "height": 100,
                "id": "r",
                "type": "rect",
                "width": 100
              }
            ]
          }"
        `);
        const def = collectByType(out, 'linearGradient')[0] as any;
        expect(def.gradientUnits).toBe('userSpaceOnUse');
        expect(def.spreadMethod).toBe('reflect');
    });
});
