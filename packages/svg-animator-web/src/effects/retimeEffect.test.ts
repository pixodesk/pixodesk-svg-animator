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
import { collectByType, materialiseEngine, normaliseGeneratedIds, PxAnimatorEngine } from './effectTestKit';
import type { PxNode } from '../PxAnimatorTypes';

/** The nested content-ref retime wire (== case 4 input): ell1 ← use1(+250) ← use2(+250). */
function nestedContentRefWire(): PxNode {
    return {
        type: 'svg', viewBox: '0 0 400 400',
        children: [
            { type: 'use', href: '#use1', y: '100', effects: { clone: { type: 'content', baseId: 'use1', retime: { start: 250 } } } },
            { type: 'use', id: 'use1', href: '#ell1', y: '100', effects: { clone: { type: 'content', baseId: 'ell1', retime: { start: 250 } } } },
            { type: 'g', id: 'ell1', children: [animatedBall('ball')] },
        ],
    } as unknown as PxNode;
}


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

describe('retimeEffect — keyframe time-shift & composition', () => {

    it('case 1 — single retime via bare href (start only) shifts the clone +250', () => {
        const input: PxNode = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                { type: 'g', id: 'src', children: [animatedBall('ball')] },
                { type: 'use', href: '#src', effects: { clone: { retime: { start: 250 } } } },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "viewBox": "0 0 400 400",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":250,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1250,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_1__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse"
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
                    "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1000,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                    "fill": "#3399e6",
                    "id": "ball",
                    "rx": "16",
                    "ry": "16",
                    "type": "ellipse"
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
        // original src ball [0,1000] + retimed clone [250,1250]
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 1250]]);
        expect(danglingRetimeCount(out)).toBe(0);
    });

    it('case 2 — single retime with stretch=0.5 maps time → start + time*stretch', () => {
        const input: PxNode = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                { type: 'g', id: 'src', children: [animatedBall('ball')] },
                { type: 'use', href: '#src', effects: { clone: { retime: { start: 250, stretch: 0.5 } } } },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "viewBox": "0 0 400 400",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":250,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":750,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_1__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse"
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
                    "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1000,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                    "fill": "#3399e6",
                    "id": "ball",
                    "rx": "16",
                    "ry": "16",
                    "type": "ellipse"
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
        // clone: 0→250, 1000→250+1000*0.5=750
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 750]]);
        expect(danglingRetimeCount(out)).toBe(0);
    });

    it('case 3 — NESTED retime via bare href composes (use→use→src) → +500', () => {
        const input: PxNode = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                { type: 'g', id: 'src', children: [animatedBall('ball')] },
                { type: 'use', id: 'u1', href: '#src', effects: { clone: { retime: { start: 250 } } } },
                { type: 'use', href: '#u1', effects: { clone: { retime: { start: 250 } } } },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "viewBox": "0 0 400 400",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":500,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1500,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_1__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse"
                      }
                    ]
                  },
                  {
                    "href": "#__GEN_0__",
                    "id": "__GEN_2__",
                    "type": "use"
                  },
                  {
                    "id": "__GEN_3__",
                    "type": "g",
                    "children": [
                      {
                        "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":250,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1250,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                        "fill": "#3399e6",
                        "id": "__GEN_4__",
                        "rx": "16",
                        "ry": "16",
                        "type": "ellipse"
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
                    "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1000,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                    "fill": "#3399e6",
                    "id": "ball",
                    "rx": "16",
                    "ry": "16",
                    "type": "ellipse"
                  }
                ]
              },
              {
                "href": "#__GEN_3__",
                "id": "u1",
                "type": "use"
              },
              {
                "href": "#__GEN_2__",
                "type": "use"
              }
            ]
          }"
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
                    effects: { clone: { type: 'content', baseId: 'use1', retime: { start: 250 } } },
                },
                {
                    type: 'use', id: 'use1', href: '#ell1', y: '100',
                    effects: { clone: { type: 'content', baseId: 'ell1', retime: { start: 250 } } },
                },
                { type: 'g', id: 'ell1', children: [animatedBall('ball')] },
            ],
        } as unknown as PxNode;

        const out = materialise(input);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "viewBox": "0 0 400 400",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "type": "g",
                        "children": [
                          {
                            "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":500,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1500,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "__GEN_1__",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "id": "__GEN_2__",
                    "type": "g",
                    "children": [
                      {
                        "href": "#__GEN_0__",
                        "type": "use",
                        "y": "100"
                      }
                    ]
                  },
                  {
                    "id": "__GEN_3__",
                    "type": "g",
                    "children": [
                      {
                        "type": "g",
                        "children": [
                          {
                            "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":250,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1250,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "__GEN_4__",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse"
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "href": "#__GEN_2__",
                "type": "use",
                "y": "100"
              },
              {
                "id": "use1",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_5__",
                    "type": "g",
                    "children": [
                      {
                        "href": "#__GEN_3__",
                        "type": "use",
                        "y": "100"
                      }
                    ]
                  }
                ]
              },
              {
                "id": "ell1",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_6__",
                    "type": "g",
                    "children": [
                      {
                        "type": "g",
                        "children": [
                          {
                            "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1000,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "ball",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse"
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
        // Same three shifts as the bare-href nested case — content-ref must NOT
        // change the timing composition: lead [0,1000] · use1 [250,1250] · use2 [500,1500].
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 1250], [500, 1500]]);
        expect(danglingRetimeCount(out)).toBe(0);
    });

    // ── Engine difference (full pipeline `materialiseAllInTree`) ─────────────────
    // The retime EFFECT pass is engine-agnostic, but the full pipeline's webapi-only
    // step 4 (`materialiseAnimatedUseInstances`) INLINES every `<use>` that targets
    // an animated subtree — because WAAPI/CSS animations don't propagate through a
    // `<use>` shadow tree. frames keeps the `<use href>` (it drives source attrs per
    // frame, which the shadow tree picks up natively). Composition (the +0/+250/+500
    // staircase) is identical in BOTH; only the use-vs-inline structure differs.

    it('case 5 — FRAMES engine → animated `<use href>` KEPT (composition still +0/+250/+500)', () => {
        const out = materialiseEngine(nestedContentRefWire(), PxAnimatorEngine.frames);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "viewBox": "0 0 400 400",
            "children": [
              {
                "type": "defs",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "type": "g",
                        "children": [
                          {
                            "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":500,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1500,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "__GEN_1__",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "id": "__GEN_2__",
                    "type": "g",
                    "children": [
                      {
                        "href": "#__GEN_0__",
                        "type": "use",
                        "y": "100"
                      }
                    ]
                  },
                  {
                    "id": "__GEN_3__",
                    "type": "g",
                    "children": [
                      {
                        "type": "g",
                        "children": [
                          {
                            "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":250,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1250,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "__GEN_4__",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse"
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "href": "#__GEN_2__",
                "type": "use",
                "y": "100"
              },
              {
                "id": "use1",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_5__",
                    "type": "g",
                    "children": [
                      {
                        "href": "#__GEN_3__",
                        "type": "use",
                        "y": "100"
                      }
                    ]
                  }
                ]
              },
              {
                "id": "ell1",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_6__",
                    "type": "g",
                    "children": [
                      {
                        "type": "g",
                        "children": [
                          {
                            "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1000,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "ball",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse"
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
        expect(collectByType(out, 'use').length).toBeGreaterThan(0);     // uses kept
        expect(transformKfTimes(out)).toEqual([[0, 1000], [250, 1250], [500, 1500]]);
    });

    it('case 6 — WAAPI engine → animated `<use>` INLINED to `<g>`+clone (fewer/no use; same staircase)', () => {
        const framesOut = materialiseEngine(nestedContentRefWire(), PxAnimatorEngine.frames);
        const out = materialiseEngine(nestedContentRefWire(), PxAnimatorEngine.webapi);
        expect(normaliseGeneratedIds(out)).toMatchInlineSnapshot(`
          "{
            "type": "svg",
            "viewBox": "0 0 400 400",
            "children": [
              {
                "transform": "translate(0,100)",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_0__",
                    "type": "g",
                    "children": [
                      {
                        "transform": "translate(0,100)",
                        "type": "g",
                        "children": [
                          {
                            "id": "__GEN_1__",
                            "type": "g",
                            "children": [
                              {
                                "type": "g",
                                "children": [
                                  {
                                    "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":500,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1500,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                                    "fill": "#3399e6",
                                    "id": "__GEN_2__",
                                    "rx": "16",
                                    "ry": "16",
                                    "type": "ellipse"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "id": "use1",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_3__",
                    "type": "g",
                    "children": [
                      {
                        "transform": "translate(0,100)",
                        "type": "g",
                        "children": [
                          {
                            "id": "__GEN_4__",
                            "type": "g",
                            "children": [
                              {
                                "type": "g",
                                "children": [
                                  {
                                    "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":250,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1250,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                                    "fill": "#3399e6",
                                    "id": "__GEN_5__",
                                    "rx": "16",
                                    "ry": "16",
                                    "type": "ellipse"
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "id": "ell1",
                "type": "g",
                "children": [
                  {
                    "id": "__GEN_6__",
                    "type": "g",
                    "children": [
                      {
                        "type": "g",
                        "children": [
                          {
                            "animate": "{\\"transform\\":{\\"keyframes\\":[{\\"time\\":0,\\"value\\":{\\"translate\\":[0,0]}},{\\"time\\":1000,\\"value\\":{\\"translate\\":[100,0]}}]}}",
                            "fill": "#3399e6",
                            "id": "ball",
                            "rx": "16",
                            "ry": "16",
                            "type": "ellipse"
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
        // WAAPI inlines the animated uses → strictly fewer `<use>` than frames
        expect(collectByType(out, 'use').length).toBeLessThan(collectByType(framesOut, 'use').length);
        // composition is preserved — inlining DEEP-CLONES animated subtrees so the
        // shifted balls appear multiple times; assert the DISTINCT shift set is the same.
        const distinctShifts = Array.from(new Set(transformKfTimes(out).map(t => t.join(',')))).sort();
        expect(distinctShifts).toEqual(['0,1000', '250,1250', '500,1500']);
        // the two engines genuinely diverge
        expect(JSON.stringify(out)).not.toEqual(JSON.stringify(framesOut));
    });

    // The shape a Lottie-precomp import produces: the retimed inner use lives inside a
    // SYMBOL-like template that serialises BEFORE the outer site. Materialising sites in
    // plain document order consumed the inner retime in place first, so the outer chain
    // clone found nothing to compose — the doubly-retimed content started at +250 instead
    // of +500. Site ordering is by reachability now (outer-most first), which must make
    // this layout equivalent to case 3.
    it('case 6 — inner retimed use INSIDE the referenced template, template serialised first → still composes to +500', () => {
        const wire = {
            type: 'svg', viewBox: '0 0 400 400',
            children: [
                // the template (with its retimed inner use) comes FIRST in document order
                { type: 'g', id: 'tpl1', children: [
                    { type: 'use', href: '#tpl0', effects: { clone: { type: 'content', baseId: 'tpl0', retime: { start: 250 } } } },
                ] },
                { type: 'g', id: 'tpl0', children: [animatedBall('ball')] },
                // the OUTER site references the template
                { type: 'use', href: '#tpl1', effects: { clone: { type: 'content', baseId: 'tpl1', retime: { start: 250 } } } },
            ],
        } as unknown as PxNode;
        const { root } = applyPlayerEffects(wire);
        const times = transformKfTimes(root).map(t => t.join(','));
        expect(times, 'the outer chain composes: +250 (template render) AND +500 (retimed chain)')
            .toContain('500,1500');
        expect(times).toContain('250,1250');
    });
});
