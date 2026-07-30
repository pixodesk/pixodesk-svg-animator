/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Pure-JSON in/out tests for the REF effect (`refEffect.ts` + `contentRefSplit.ts`).
//  - Whole-element ref (`ref:{baseId}`) → the `<use>.href` is rewritten to `#baseId`.
//  - Content ref (`ref:{type:'content', baseId}`) → the SOURCE element is split into
//      <g id=src> (outer, holds translate) > <g id=inner> (rotate/scale) > bare element
//    and the `<use>.href` is pointed at the INNER id — so the use renders the source
//    EXCLUDING the source's own translate.

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise, normaliseGeneratedIds } from './effectTestKit';

/** A `<rect id=src>` source + a `<use>` referencing it. */
const scene = (srcExtra: any, useEffects: any): PxNode => ({
    type: 'svg',
    children: [
        { type: 'rect', id: 'src', width: 40, height: 40, ...srcExtra },
        { type: 'use', effects: useEffects },
    ],
} as unknown as PxNode);

const useNode = (out: PxNode): any => collectByType(out, 'use')[0];
const gById = (out: PxNode, id: string): any => collectByType(out, 'g').find(g => (g as any).id === id);


describe('refEffect — whole-element ref & content-ref split', () => {

    it('case 1 — whole-element ref → <use>.href rewritten to #baseId, source untouched', () => {
        const out = materialise(scene({}, { clone: { baseId: 'src' } }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "height": 40,
                "id": "src",
                "type": "rect",
                "width": 40
              },
              {
                "href": "#src",
                "type": "use"
              }
            ]
          }"
        `);
        expect(useNode(out).href).toBe('#src');
        expect(collectByType(out, 'g')).toHaveLength(0);          // no split for whole-element ref
        expect(collectByType(out, 'rect')[0]).toMatchObject({ id: 'src', width: 40 });
    });

    it('case 2 — content ref → source SPLIT (outer#src > inner > bare), <use> points at inner', () => {
        const out = materialise(scene({}, { clone: { type: 'content', baseId: 'src' } }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "id": "src",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "height": 40,
                        "type": "rect",
                        "width": 40
                      }
                    ]
                  }
                ]
              },
              {
                "href": "#__GEN_0__",
                "type": "use"
              }
            ]
          }"
        `);
        const outer = gById(out, 'src');
        expect(outer).toBeTruthy();                               // outer keeps the original id
        const innerId = outer.children[0].id;
        expect(innerId).not.toBe('src');                          // inner has a fresh id
        expect(useNode(out).href).toBe('#' + innerId);           // use targets the INNER layer
        // bare element lost its id (outer owns it now) so there's no duplicate #src
        const bareRect = collectByType(out, 'rect')[0] as any;
        expect(bareRect.id).toBeUndefined();
    });

    it('case 3 — content ref with source TRANSLATE → translate lifts to outer, bare element has none', () => {
        const out = materialise(scene({ transform: 'translate(30,40)' }, { clone: { type: 'content', baseId: 'src' } }));
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "children": [
              {
                "id": "src",
                "transform": "translate(30,40)",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "height": 40,
                        "type": "rect",
                        "width": 40
                      }
                    ]
                  }
                ]
              },
              {
                "href": "#__GEN_0__",
                "type": "use"
              }
            ]
          }"
        `);
        // the source's own translate moved to the outer wrapper; the bare element
        // is translate-free, so a <use> of the inner layer ignores the source's position
        const bareRect = collectByType(out, 'rect')[0] as any;
        expect(bareRect.transform).toBeUndefined();
        const outer = gById(out, 'src');
        expect(JSON.stringify(outer)).toContain('translate');     // outer carries the translate
        expect(useNode(out).href).toBe('#' + outer.children[0].id);
    });
});
