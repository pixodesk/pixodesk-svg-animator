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
import { PxCloneEffectSchema, type PxNode } from '../PxAnimatorTypes';
import type { PxValidationContext } from '../PxSchema';

/** The nested content-ref retime wire (== case 4 input): ell1 ← use1(+250) ← use2(+250). */
function nestedContentRefWire(): PxNode {
    return {
        type: 'svg', viewBox: '0 0 400 400',
        children: [
            { type: 'use', href: '#use1', y: '100', effects: { clone: { type: 'content', sourceId: 'use1', retime: { start: 250 } } } },
            { type: 'use', id: 'use1', href: '#ell1', y: '100', effects: { clone: { type: 'content', sourceId: 'ell1', retime: { start: 250 } } } },
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
                    effects: { clone: { type: 'content', sourceId: 'use1', retime: { start: 250 } } },
                },
                {
                    type: 'use', id: 'use1', href: '#ell1', y: '100',
                    effects: { clone: { type: 'content', sourceId: 'ell1', retime: { start: 250 } } },
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
    // The retime EFFECT pass is engine-agnostic, but the full pipeline's waapi-only
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
        const out = materialiseEngine(nestedContentRefWire(), PxAnimatorEngine.waapi);
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
                    { type: 'use', href: '#tpl0', effects: { clone: { type: 'content', sourceId: 'tpl0', retime: { start: 250 } } } },
                ] },
                { type: 'g', id: 'tpl0', children: [animatedBall('ball')] },
                // the OUTER site references the template
                { type: 'use', href: '#tpl1', effects: { clone: { type: 'content', sourceId: 'tpl1', retime: { start: 250 } } } },
            ],
        } as unknown as PxNode;
        const { root } = applyPlayerEffects(wire);
        const times = transformKfTimes(root).map(t => t.join(','));
        expect(times, 'the outer chain composes: +250 (template render) AND +500 (retimed chain)')
            .toContain('500,1500');
        expect(times).toContain('250,1250');
    });
});


// `retime.timeCrop: [start, end]` (ms, document time) — a VISIBILITY WINDOW on the
// instance. Materialised as an opacity animation on a wrapper `<g>`: the target's own
// animation must keep running (a layer inside its window appears mid-motion, not
// restarted), and a wrapper keeps an authored opacity on the `<use>` intact. The wrapper
// is player-side only — it never round-trips to the wire.
describe('retime is PURE TIMING — no own source ref (review §4.3)', () => {

    // `retime.sourceId` was removed outright (schema included): the source ref lives
    // ONCE on the parent `clone.sourceId`, and materialisation follows `href` anyway.
    // These pin every observable angle of that removal.

    it('a retime WITHOUT any source ref works — href is the source of truth', () => {
        const out = materialise({
            type: 'svg',
            children: [
                { type: 'g', id: 'src', children: [{ type: 'rect', width: 10, height: 10,
                    animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } } }] },
                { type: 'use', href: '#src', effects: { clone: { retime: { start: 250 } } } },
            ],
        } as unknown as PxNode);
        const rects: Array<any> = collectByType(out, 'rect') as Array<any>;
        const retimed = rects.find(r => r.animate?.opacity?.keyframes?.[0]?.time === 250);
        expect(retimed, 'a clone with +250-shifted keyframes exists').toBeTruthy();
        expect(retimed.animate.opacity.keyframes.map((k: any) => k.time)).toEqual([250, 1250]);
    });

    it('a STRAY legacy retime.sourceId changes nothing — materialisation follows href, not it', () => {
        const build = (retime: object) => normaliseGeneratedIds(materialise({
            type: 'svg',
            children: [
                { type: 'g', id: 'src', children: [{ type: 'rect', width: 10, height: 10 }] },
                { type: 'g', id: 'decoy', children: [{ type: 'ellipse', rx: 5, ry: 5 }] },
                { type: 'use', href: '#src', effects: { clone: { sourceId: '#src', retime } } },
            ],
        } as unknown as PxNode));
        // Same output whether the removed key is absent or points somewhere else entirely.
        expect(build({ start: 250, sourceId: '#decoy' } as object)).toEqual(build({ start: 250 }));
    });

    it('the schema gives the removed key no slot — strict validation flags it', () => {
        const ok: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxCloneEffectSchema.isValid(
            { sourceId: '#src', retime: { start: 250, stretch: 1.5, timeCrop: [0, 100] } }, ok)).toBe(true);
        expect(ok.errors).toEqual([]);

        const bad: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxCloneEffectSchema.isValid(
            { sourceId: '#src', retime: { sourceId: '#src', start: 250 } }, bad)).toBe(false);
        expect(bad.errors.length).toBeGreaterThan(0);
    });

    it('sanitize strips the removed key and keeps the timing fields', () => {
        expect(PxCloneEffectSchema.sanitize({ sourceId: '#src', retime: { sourceId: '#src', start: 250, stretch: 2 } }))
            .toEqual({ sourceId: '#src', retime: { start: 250, stretch: 2 } });
    });
});

describe('retime.timeCrop — visibility window', () => {

    const cropDoc = (timeCrop: [number, number], useExtra: Record<string, unknown> = {}): PxNode => ({
        type: 'svg', animator: { duration: 2000 },
        children: [
            { type: 'rect', id: 'src', width: 10, height: 10,
              animate: { opacity: { keyframes: [{ time: 0, value: 1 }, { time: 2000, value: 0 }] } } },
            { type: 'use', href: '#src', ...useExtra, effects: { clone: { retime: { start: 0, timeCrop } } } },
        ],
    } as unknown as PxNode);

    /** The wrapper `<g>` the crop is applied to (the `<use>` lives inside it). */
    const cropWrapper = (out: PxNode): any =>
        collectByType(out, 'g').find(g => (g as any).animate?.opacity);

    it('wraps the <use> in a <g> whose opacity gates the window', () => {
        const out = materialiseEngine(cropDoc([500, 1500]), PxAnimatorEngine.frames);
        const g = cropWrapper(out);
        expect(g, 'a crop wrapper was generated').toBeDefined();
        expect(g.animate.opacity.keyframes).toEqual([
            { time: 499, value: 0 },   // hidden right up to the edge…
            { time: 500, value: 1 },   // …visible AT the boundary
            { time: 1500, value: 1 },  // …still visible AT the far boundary
            { time: 1501, value: 0 },  // …hidden immediately after
        ]);
        // The `<use>` itself is untouched inside the wrapper.
        expect(g.children).toHaveLength(1);
    });

    it('a window starting at 0 emits no leading hidden keyframe', () => {
        const g = cropWrapper(materialiseEngine(cropDoc([0, 800]), PxAnimatorEngine.frames));
        expect(g.animate.opacity.keyframes[0]).toEqual({ time: 0, value: 1 });
    });

    it('an EMPTY window (end <= start) hides the instance outright', () => {
        // Lottie layers with ip >= op are exactly this — they must never show.
        const g = cropWrapper(materialiseEngine(cropDoc([900, 900]), PxAnimatorEngine.frames));
        expect(g.animate.opacity.keyframes).toEqual([{ time: 0, value: 0 }]);
    });

    it('an authored opacity on the <use> survives — the crop rides on the wrapper', () => {
        const out = materialiseEngine(cropDoc([100, 200], { opacity: 0.25 }), PxAnimatorEngine.frames);
        const g = cropWrapper(out);
        expect(g.opacity, 'wrapper carries only the crop').toBeUndefined();
        expect(g.children[0].opacity, 'the instance keeps its own opacity').toBe(0.25);
    });

    it('no timeCrop → no wrapper at all', () => {
        const out = materialiseEngine({
            type: 'svg', animator: { duration: 2000 },
            children: [
                { type: 'rect', id: 'src', width: 10, height: 10 },
                { type: 'use', href: '#src', effects: { clone: { retime: { start: 250 } } } },
            ],
        } as unknown as PxNode, PxAnimatorEngine.frames);
        expect(cropWrapper(out)).toBeUndefined();
    });
});
