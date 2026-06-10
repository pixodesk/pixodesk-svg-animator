/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the TEXT-ALONG-PATH effect (`textAlongPathEffect.ts`).
// Wraps the `<text>` host's children in a `<textPath href="#pathId">`, forwarding
// `lengthAdjust`/`method`/`spacing`. `startOffset` / `textLength` are
// `PxAnimatable<number>`: static → string attr on `<textPath>`; `{keyframes}` →
// `<textPath>.animate.<attr>`. The referenced `<path>` def is left untouched.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise, normaliseGeneratedIds } from './effectTestKit';

/** A `<path>` def + a `<text>` host running along it. */
const scene = (textAlongPath: any): PxNode => ({
    type: 'svg',
    children: [
        { type: 'path', id: 'curve', d: 'M0,0 Q50,80 100,0' },
        { type: 'text', id: 't', children: [{ type: 'tspan', text: 'Hi' }], effects: { textAlongPath } },
    ],
} as unknown as PxNode);

const textNode = (out: PxNode): any => collectByType(out, 'text')[0];
const textPathNode = (out: PxNode): any => collectByType(out, 'textPath')[0];


describe('textAlongPathEffect — <textPath> wrap', () => {

    it('case 1 — static href → <text> wraps its children in <textPath href=#curve>', () => {
        const out = materialise(scene({ href: 'curve' }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "d": "M0,0 Q50,80 100,0",
                "id": "curve",
                "type": "path",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "Hi",
                        "type": "tspan",
                      },
                    ],
                    "href": "#curve",
                    "type": "textPath",
                  },
                ],
                "id": "t",
                "type": "text",
              },
            ],
            "type": "svg",
          }
        `);
        const tp = textPathNode(out);
        expect(tp.href).toBe('#curve');                                   // bare id → #id
        expect(tp.children).toEqual([{ type: 'tspan', text: 'Hi' }]);     // original content moved inside
        expect(textNode(out).children).toEqual([tp]);                     // text now holds only the textPath
        expect(textNode(out).effects).toBeUndefined();
    });

    it('case 2 — lengthAdjust/method/spacing + static startOffset/textLength forwarded as attrs', () => {
        const out = materialise(scene({
            href: 'curve', lengthAdjust: 'spacingAndGlyphs', method: 'stretch', spacing: 'exact',
            startOffset: 25, textLength: 200,
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "d": "M0,0 Q50,80 100,0",
                "id": "curve",
                "type": "path",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "text": "Hi",
                        "type": "tspan",
                      },
                    ],
                    "href": "#curve",
                    "lengthAdjust": "spacingAndGlyphs",
                    "method": "stretch",
                    "spacing": "exact",
                    "startOffset": "25",
                    "textLength": "200",
                    "type": "textPath",
                  },
                ],
                "id": "t",
                "type": "text",
              },
            ],
            "type": "svg",
          }
        `);
        const tp = textPathNode(out);
        expect(tp).toMatchObject({
            lengthAdjust: 'spacingAndGlyphs', method: 'stretch', spacing: 'exact',
            startOffset: '25', textLength: '200',
        });
    });

    it('case 3 — animated startOffset → <textPath>.animate.startOffset.keyframes', () => {
        const out = materialise(scene({
            href: 'curve',
            startOffset: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 100 }] },
        }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          {
            "children": [
              {
                "d": "M0,0 Q50,80 100,0",
                "id": "curve",
                "type": "path",
              },
              {
                "children": [
                  {
                    "animate": "{"startOffset":{"keyframes":[{"time":0,"value":0},{"time":1000,"value":100}]}}",
                    "children": [
                      {
                        "text": "Hi",
                        "type": "tspan",
                      },
                    ],
                    "href": "#curve",
                    "type": "textPath",
                  },
                ],
                "id": "t",
                "type": "text",
              },
            ],
            "type": "svg",
          }
        `);
        const tp = textPathNode(out);
        expect(tp.animate.startOffset.keyframes).toHaveLength(2);
        expect(tp.animate.startOffset.keyframes.map((k: any) => k.value)).toEqual([0, 100]);
        expect(tp.startOffset).toBeUndefined(); // animated → no static attr
    });
});
