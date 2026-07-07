# Player effect test coverage

Per-effect pure-JSON in/out tests (`outJson = applyPlayerEffects(inJson)`), modelled
on `retimeEffect.test.ts`: a single effect bucket on an input node → run the real
driver → assert (a) a full-tree inline **snapshot** (catches stray output) plus
(b) **pinpoint guards** that encode the effect's contract independent of structure.
Animated props are exercised wherever the effect supports them. Shared helpers live
in `effectTestKit.ts`.

Schemas: `PxAnimatorTypes.ts` (`_PxEffects` + each `_Px*Effect`). Apply order:
`PlayerEffectsUtil.ts`.

| Effect | File | Entry fn | Status | Notes |
|---|---|---|---|---|
| retime | `retimeEffect.test.ts` | `applyAllRetimeEffects` | ✅ done | start/stretch, nested bare-href + content-ref compose, **+ engine cases 5/6 (frames keeps `<use>` vs WAAPI inlines to `<g>`+clone)** |
| transformation | `transformationEffect.test.ts` | `applyTransformationEffect` | ✅ done | 8 cases: static translate/scale(150→1.5)/skew/rotate+origin-sandwich, animated translate & rotate, **+ engine cases 7/8 (frames vs WAAPI autoOrient — motion-path flatten differs)** |
| repeater | `repeaterEffect.test.ts` | `applyRepeaterEffect` | ✅ done | 5 cases: static translate×i, animated translate kf×i, scale% compound s^i, rotate×i + constant origin, copies<1 error |
| maskedBy | `maskedByEffect.test.ts` | `applyMaskedByEffect` | ✅ done | 4 cases: mask def + `<use href>`, attr passthrough, inverse-transform compensation, missing-href error |
| trimPath | `trimPathEffect.test.ts` | `applyTrimPathEffect` | ✅ done | 5 cases: collapse(static range), animated range, animated offset, empty-range opacity 0, multi-subpath split |
| fillGradient/strokeGradient | `gradientEffect.test.ts` | `applyFillGradientEffect` / `applyStrokeGradientEffect` | ✅ done | 5 cases: static linear, radial geom, animated per-stop color slice, stroke-vs-fill host, units passthrough |
| textPath | `textPathEffect.test.ts` | `applyTextPathEffect` | ✅ done | 5 cases: inline path → minted `<path>` def + `<textPath href>` wrap, attr passthrough + static startOffset/textLength, animated startOffset, pathOverflow consumed, empty path no-op |
| ref + contentRefSplit | `refEffect.test.ts` | `applyRefHref` / `splitForContentRef` | ✅ done | 3 cases: whole-element href rewrite, content-ref split (outer#src>inner>bare, use→inner), source-translate lifts to outer |

**All effects covered.** Shared helpers: `effectTestKit.ts`. Run: `npx vitest run src/effects`.

## Engine (WAAPI vs frames) coverage
The effect pass (`applyPlayerEffects`, used by `materialise`) is **engine-agnostic** — same
output for both. The WAAPI-vs-frames difference lives in the later `materialiseAllInTree`
stages (webapi-only): **motion-path flatten** + **animated-`<use>` inline**. Use the
`materialiseEngine(input, engine)` kit helper to exercise those.

- ✅ **transformation** cases 7/8 cover the motion-path-flatten difference (autoOrient
  translate: frames keeps parametric 2-kf form; WAAPI flattens to ~29 sampled `{translate,rotate}` kfs).
- ✅ **retime** cases 5/6 cover the animated-`<use>` **inline** difference (frames keeps 3
  `<use href>`; WAAPI inlines all → 0 `<use>`, deep-cloned `<g>`s, same staircase). This is the
  exact mechanism SVG+CSS export needs for Track 3.
- ⬜ (optional) **ref** content-ref could get the same engine pair, but retime already
  exercises content-ref + inline, so it's lower value.

## Blocked / problematic effects
(none yet — recorded here as they come up)
