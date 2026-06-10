/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the TRIM-PATH effect (`trimPathEffect.ts`).
// Converts parametric `offset` + `range` (both 0..1, animatable) into per-subpath
// `stroke-dasharray` / `stroke-dashoffset` (+ `stroke-opacity` 0 to hide an empty
// range). Single-subpath host COLLAPSES onto the leaf `<path>`; multi-subpath (or
// group) SPLITS into a `<g>` + one bare `<path>` per subpath. Exact dash numbers
// depend on measured arc-length and are pinned by the snapshot; the guards assert
// the structural contract (collapse vs split, static vs animated, hide).

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise, normaliseGeneratedIds } from './effectTestKit';

/** A stroked leaf `<path>` (straight line, length≈100) carrying a trim effect. */
const linePath = (trimPath: any, d = 'M0,0 L100,0'): PxNode =>
    ({ type: 'svg', children: [{ type: 'path', id: 'p', d, stroke: '#000', strokeWidth: 4, fill: 'none', effects: { trimPath } }] } as unknown as PxNode);

const animKeys = (n: PxNode): Array<string> => Object.keys((n as any).animate || {});
const thePath = (out: PxNode): PxNode => collectByType(out, 'path')[0];


describe('trimPathEffect — dasharray/dashoffset materialisation', () => {

    it('case 1 — single subpath + static range → COLLAPSE: dash attrs on the leaf <path>, no <g>', () => {
        const out = materialise(linePath({ range: [0, 0.5] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "d": "M0,0 L100,0",
                "fill": "none",
                "id": "p",
                "stroke": "#000",
                "strokeDasharray": [
                  0,
                  1,
                  50,
                  51
                ],
                "strokeDashoffset": 1,
                "strokeWidth": 4,
                "type": "path"
              }
            ]
          }"
        `);
        const p = thePath(out) as any;
        expect(collectByType(out, 'g')).toHaveLength(0);        // collapsed, no split wrapper
        expect(Array.isArray(p.strokeDasharray)).toBe(true);    // dash pattern emitted
        expect(typeof p.strokeDashoffset).toBe('number');
        expect(p.id).toBe('p');                                 // leaf identity preserved
        expect(p.effects).toBeUndefined();                      // effect consumed
    });

    it('case 2 — animated range → animate.strokeDasharray.keyframes + static baseline', () => {
        const out = materialise(linePath({
            range: { keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [0, 1] }] },
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "animate": "{\\"strokeDasharray\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":[0,1,0,101]},{\\"time\\":1000,\\"value\\":[0,1,100,1]}]},\\"strokeOpacity\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":0},{\\"time\\":10,\\"value\\":1}]}}",
                "d": "M0,0 L100,0",
                "fill": "none",
                "id": "p",
                "stroke": "#000",
                "strokeDasharray": [
                  0,
                  1,
                  0,
                  101
                ],
                "strokeDashoffset": 1,
                "strokeOpacity": 0,
                "strokeWidth": 4,
                "type": "path"
              }
            ]
          }"
        `);
        const p = thePath(out) as any;
        expect(animKeys(p)).toContain('strokeDasharray');                   // animated
        expect(p.animate.strokeDasharray.keyframes).toHaveLength(2);
        expect(Array.isArray(p.strokeDasharray)).toBe(true);                // static baseline (first kf)
    });

    it('case 3 — animated offset → animate.strokeDashoffset.keyframes', () => {
        const out = materialise(linePath({
            range: [0, 0.4],
            offset: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] },
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "animate": "{\\"strokeDashoffset\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":101},{\\"time\\":1000,\\"value\\":1}]}}",
                "d": "M0,0 L100,0",
                "fill": "none",
                "id": "p",
                "stroke": "#000",
                "strokeDasharray": [
                  0,
                  1,
                  40,
                  60,
                  40,
                  61
                ],
                "strokeDashoffset": 101,
                "strokeWidth": 4,
                "type": "path"
              }
            ]
          }"
        `);
        const p = thePath(out) as any;
        expect(animKeys(p)).toContain('strokeDashoffset');
        expect(p.animate.strokeDashoffset.keyframes).toHaveLength(2);
    });

    it('case 4 — empty static range [0,0] → stroke-opacity 0 (hidden), fill untouched', () => {
        const out = materialise(linePath({ range: [0, 0] }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "d": "M0,0 L100,0",
                "fill": "none",
                "id": "p",
                "stroke": "#000",
                "strokeDasharray": [
                  0,
                  1,
                  0,
                  101
                ],
                "strokeDashoffset": 1,
                "strokeOpacity": 0,
                "strokeWidth": 4,
                "type": "path"
              }
            ]
          }"
        `);
        const p = thePath(out) as any;
        expect(p.strokeOpacity).toBe(0);
    });

    it('case 5 — multi-subpath → SPLIT into <g> + one bare <path> per subpath, each trimmed', () => {
        const out = materialise(linePath({ range: [0, 0.5] }, 'M0,0 L100,0 M0,20 L100,20'));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "fill": "none",
                "id": "p",
                "stroke": "#000",
                "strokeWidth": 4,
                "type": "g",
                "children": [
                  {
                    "d": "M0,0L100,0",
                    "strokeDasharray": [
                      0,
                      1,
                      50,
                      51
                    ],
                    "strokeDashoffset": 1,
                    "type": "path"
                  },
                  {
                    "d": "M0,20L100,20",
                    "strokeDasharray": [
                      0,
                      1,
                      50,
                      51
                    ],
                    "strokeDashoffset": 1,
                    "type": "path"
                  }
                ]
              }
            ]
          }"
        `);
        expect(collectByType(out, 'g')).toHaveLength(1);        // split wrapper
        const paths = collectByType(out, 'path');
        expect(paths).toHaveLength(2);                           // one bare path per subpath
        for (const p of paths as Array<any>) {
            expect(Array.isArray(p.strokeDasharray)).toBe(true);
            expect(p.d).toBeTruthy();
        }
    });
});
