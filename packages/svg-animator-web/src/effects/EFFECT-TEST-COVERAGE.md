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
| retime | `retimeEffect.test.ts` | `applyAllRetimeEffects` | ✅ done | start/stretch, nested bare-href + content-ref compose |
| transformation | `transformationEffect.test.ts` | `applyTransformationEffect` | ✅ done | 6 cases: static translate/scale(150→1.5)/skew/rotate+origin-sandwich, animated translate & rotate |
| repeater | `repeaterEffect.test.ts` | `applyRepeaterEffect` | ✅ done | 5 cases: static translate×i, animated translate kf×i, scale% compound s^i, rotate×i + constant origin, copies<1 error |
| maskedBy | `maskedByEffect.test.ts` | `applyMaskedByEffect` | ✅ done | 4 cases: mask def + `<use href>`, attr passthrough, inverse-transform compensation, missing-href error |
| trimPath | `trimPathEffect.test.ts` | `applyTrimPathEffect` | ✅ done | 5 cases: collapse(static range), animated range, animated offset, empty-range opacity 0, multi-subpath split |
| fillGradient/strokeGradient | `gradientEffect.test.ts` | `applyFillGradientEffect` / `applyStrokeGradientEffect` | ✅ done | 5 cases: static linear, radial geom, animated per-stop color slice, stroke-vs-fill host, units passthrough |
| textAlongPath | `textAlongPathEffect.test.ts` | `applyTextAlongPathEffect` | ✅ done | 3 cases: `<textPath href>` wrap + children move, attr passthrough + static startOffset/textLength, animated startOffset |
| ref + contentRefSplit | `refEffect.test.ts` | `applyRefHref` / `splitForContentRef` | ✅ done | 3 cases: whole-element href rewrite, content-ref split (outer#src>inner>bare, use→inner), source-translate lifts to outer |

**All effects covered.** Shared helpers: `effectTestKit.ts`. Run: `npx vitest run src/effects`.

## Blocked / problematic effects
(none yet — recorded here as they come up)
