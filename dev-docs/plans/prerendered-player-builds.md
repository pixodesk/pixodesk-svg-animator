# Dedicated player builds for pre-rendered SVG (SVG+JS export)

Research + estimates. **Nothing implemented.** Sizes are measured from real probe builds through the
production tsup/terser pipeline, not projected.

## 0 · Answer up front

| build | raw | vs full player (98,147) |
|---|---|---|
| full player — shipped today | 98,147 | — |
| **WAAPI only** | **34,865** | **−64.5%** |
| frames only | 37,132 | −62.2% |
| **WAAPI + frames (`auto`)** | **41,339** | **−57.9%** |
| WAAPI only, after the two extra cuts in §3a | **16,281** | **−83.4%** |

Your instinct is right and the win is much larger than anything in `bundle-size.md`: a
pre-rendered SVG needs **about a third of the player as the code stands today, and a sixth** once the
two small refactors in §3a land.

Two answers to the specific questions you raised:

- **"neither needs effects"** — correct, and it goes further than effects. See §1.
- **"not sure if excluding waapi makes a significant win for FRAMES"** — it does not.
  Frames-only is 37,132 vs 41,339 for both engines: **4,207 B (10%)**. Not worth a third artifact
  initially, which is why your two-build proposal is the right call.

---

## 1 · Why so much can go: the SVG+JS payload carries no document

This is the finding that makes the whole thing work. The `<script>` that SVG+JS export emits is
`PixodeskAnimator.createAnimator({"data": …})`, and the embedded object is built in
`SvgaJsonSerializationUtil.writeAnimationRootAttrs` as:

```js
{ id, type: 'svg', animator: { ...animatorMeta, definitions, animateById } }
```

**There is no `children` tree and no `effects` bucket.** The SVG elements already exist in the exported
file; the payload is purely animation *bindings*, keyed by element id. The editor has already
materialized everything structural at export time — effects, repeater copies, glyph outlines,
`<use>` instances, motion-path sampling, internal loops.

So the embedded player never runs the construction half of the pipeline. What a narrower entry drops
**for free**, today, with no refactor:

| dropped by the entry alone | why it is unreachable for a pre-rendered doc |
|---|---|
| `effects/*` — maskedBy, trimPath, contentRefSplit, gradient, repeater, retime, textPath, transformBy | `materializeNodeEffects` walks `children`; there are none |
| `textGlyphsEffect` | glyph outlines are baked into the SVG at export |
| `PxAnimatorUseMaterializer` | `<use>` is materialized at export (the Safari fix) |
| `PxAnimatorDOM` / `renderNode`, `generateNewIds` | only used when `createAnimator` is given a container to render into — pre-rendered SVG has none |
| `materializeAllInTree` | the whole 4-stage pipeline collapses to a no-op |
| `PxIdUtil` | id rewriting only happens during `generateNewIds` |

Two more are **logically** unneeded but do NOT drop out on their own — they need the small refactors in
§3a, and together they are worth another 18.6 KB:

| still present today | why it lingers |
|---|---|
| `PxSchema` + the schema declarations (14,078 B) | pulled in by a single const (`PxLoopExtend`) — §3a |
| `PxMotionPath` (5,034 B) | statically reachable from `PxDefinitions`' binding path — §3a |

Still needed, and why:

| kept | role |
|---|---|
| `PxDefinitions` (`normalizeBindings`) | resolves `definitions` + `animateById` into per-element bindings; also expands `loop` |
| `PxAnimatorUtil` | interpolation, easing, color/transform value handling |
| `PxAnimatorWebApi` and/or `PxAnimatorFrameLoop` | the engine(s) |
| `PxAnimatorTriggers` | `startOn` / click triggers |
| `PxIdUtil` | id rewriting inside `animateById` |

Note `PxDefinitions` is retained (6,409 B in this closure), so **loop support is included** in the
measured sizes — the estimate is not relying on loops being pre-flattened at export.

---

## 2 · Naming

`prebuild` reads as "before the build" and `prebuild-waapi` doesn't say what is missing. The
distinguishing property is the **input contract**: these builds assume the SVG is already rendered and
materialized, so the player only binds and drives animations.

Ranked suggestions:

| | name | why |
|---|---|---|
| **1** | **`index.prerendered.umd.min.js`** + `index.prerendered-waapi.umd.min.js` | Names the contract exactly: "the DOM is already there". Self-documenting to anyone reading the dist listing, and it is the term already used for this export family. **Recommended.** |
| 2 | `index.embedded.umd.min.js` + `-waapi` | Names where it lives (inlined in an exported SVG) rather than what it assumes. Good, slightly less precise — the full UMD is also embeddable. |
| 3 | `index.bindings.umd.min.js` + `-waapi` | Names the mechanism (`animateById` bindings). Accurate but jargon. |
| 4 | `index.lite.umd.min.js` | Avoid — says nothing about *what* was removed, so it will be misused. |

For the engine suffix, `-waapi` is right; the both-engines build needs no suffix since it is the
default. If a frames-only artifact is ever added, `-frames` follows naturally.

---

## 3 · What has to be built

### Player side (small)

1. **`createPrerenderedAnimator(...)`** in `svg-animator-web` — a sibling of `createAnimatorImpl` that
   skips validation, materialization, id regeneration and rendering, and goes straight to
   binding + engine construction. ~40–60 lines. It must NOT be a flag on `createAnimatorImpl`: a
   runtime flag keeps every branch reachable and tree-shakes nothing.
2. **Two entries** — `src/index.prerendered.ts` (waapi + frames with the existing auto-fallback) and
   `src/index.prerendered-waapi.ts` (waapi only, no fallback).
3. **Two tsup configs** (minified + non-minified each, if e2e needs the readable one). The existing
   `umdAlias` / `terserFor` helpers apply unchanged.

Add ~0.5–1 KB to the measured probe numbers for the bootstrap wrapper the probes didn't include.

### Editor side (the larger half)

4. The editor **already knows the engine at export time** — `svg.animation.mode` (`auto` | `waapi` |
   `frames`) is a model setting and is written into `animator.mode`. So bundle selection is a
   straightforward mapping:

   | `animation.mode` | inline |
   |---|---|
   | `waapi` | `index.prerendered-waapi.umd.min.js` |
   | `frames` | `index.prerendered.umd.min.js` (until a frames-only artifact exists) |
   | `auto` | `index.prerendered.umd.min.js` |

5. **Webpack aliases + statics.** Today `App.tsx` raw-imports two bundles into
   `SvgaJsonSerializationUtil.SVGA_JSA_SCRIPT_OPTIMIZED` / `_UNOPTIMIZED`. That pair becomes a small
   matrix (mode × optimized), so the statics want to become a lookup rather than two fields. This is
   where most of the work is.

### Verification

6. e2e coverage per artifact — the existing 15 visual tests should run against each build, since a
   missing materializer would show up as a wrong rendered frame rather than an error.
7. An **app-side corpus check** is the important one: run the feature-explorer's 124 cases through
   SVG+JS export with the prerendered bundle. That is what would catch a case where the editor does
   *not* pre-materialize something and the runtime stage was actually load-bearing.

**Estimate: ~1 day player side + verification, ~1 day editor side**, plus **~0.5 day** for the
`PxAnimatorTypes` enum split (§3a) and **~0.5 day** for making the motion-path hooks optional. Those
two are what take the artifact from 35 KB to ~16 KB, so they are the highest value-per-hour items in
the whole exercise. The risk is concentrated in step 7, not in the build plumbing.

---

## 3a · There is far more to cut than effects — measured

The §0 numbers were the *starting* point: those probes still carry three large modules that a
pre-rendered document never needs. Per-module attribution of the prerendered-WAAPI closure
(36,098 raw before terser, only **10 modules**):

| module | bytes | % | needed? |
|---|---|---|---|
| **`PxSchema.ts`** | 7,520 | 20.8% | **no** — nothing validates |
| **`PxAnimatorTypes.ts`** | 6,558 | 18.2% | **only one const from it** |
| `PxDefinitions.ts` | 6,409 | 17.8% | yes — bindings + loops |
| `PxAnimatorUtil.ts` | 5,712 | 15.8% | yes — interpolation |
| **`PxMotionPath.ts`** | 5,034 | 13.9% | **no** — pre-sampled at export |
| `PxAnimatorWebApi.ts` | 3,561 | 9.9% | yes — the engine |
| `PxAnimatorTriggers.ts` | 1,277 | 3.5% | yes |
| `PxAnimatorFrameLoop.ts` | 27 | 0.1% | `getSelector` only |

**53% of the prerendered bundle is removable.** The measured ladder:

| | raw | vs full player |
|---|---|---|
| full player (shipped) | 98,147 | — |
| prerendered-WAAPI, today's code | 34,865 | −64% |
| **+ schema layer out** | **22,051** | **−78%** |
| **+ motion-path out as well** | **16,281** | **−83%** |

### Why the schema still ships even though nothing validates

This is the important subtlety, and it means **"skip validation for pre-rendered" does not by itself
remove the schema**. The probe never calls `validateNodeEffects`, yet `PxSchema` + its declarations
are 39% of the bundle. The reason:

`PxDefinitions` and `PxAnimatorUtil` import from `PxAnimatorTypes` almost entirely as **types** —
which are erased. The single exception is **`PxLoopExtend`**, a small const object used at four places
in `PxDefinitions` for loop-boundary logic. That one enum makes the module a runtime dependency, and
`PxAnimatorTypes` builds ~31 schema declarations at module scope via `implementsInterface<T>()(px.object(…))`
— curried calls no minifier can drop.

**One enum drags in 14,078 B.** So the fix is the `PxAnimatorTypes.ts` split already described in
`bundle-size.md` §4 — moving the enums into `PxAnimatorConstants.ts`. Its value is far higher
here (−12,814 B, 37% of this bundle) than in the full player (−14 KB of 98 KB).

### Motion-path

`PxDefinitions` imports `evaluateMotionPathSegment`, `materializeMotionPathInPropAnim` and
`propAnimIsMotionPath`. Two call sites:

- `normalizeAnimationDefinition` (line 894) — on the **bindings** path, called for every definition.
  A no-op unless the animation has tangents, which a pre-rendered export never has.
- `calcPropertyValue` (line 1102) — the **frames** kernel. The comment there already notes it is a
  no-op for WAAPI.

So it is dead twice over for prerendered-WAAPI. Removing it needs the motion-path hooks made optional
(inject them, or split the tangent path out of `PxDefinitions`) — a small refactor, worth 5,770 B.

### Validation: keep it for external JSON

Your split is exactly right and matches how the code is already shaped:

- **External JSON** (`loadTagAnimators` / `data-px-animation-src`, or any caller passing a doc the
  editor did not just produce) — keep `validateNodeEffects` and keep warning. That path is in the
  **full** build, which also has `loadTagAnimators`; nothing to change.
- **Pre-rendered SVG** — the editor produced both the DOM and the bindings in one pass, so there is
  nothing a schema check could catch that the editor did not already guarantee. The prerendered
  entries simply must not call it.

No new work beyond *not* wiring validation into the new entries — but note the schema only actually
leaves once the enum split lands.

---

## 4 · Risks and open questions

1. **The core assumption is "the editor pre-materializes everything structural".** Strongly supported —
   the payload has no `children`, and SVG+CSS export shares the identical element structure while
   being unable to express effects, loops or tangents at all. But it is an assumption about *every*
   feature, and the corpus run in step 7 is what turns it into a fact. If one feature turns out to
   rely on a runtime stage, that stage comes back and the size moves.
2. **Dropping `validateNodeEffects` removes the shape-drift warnings** from exported output. Acceptable
   — the editor validates at author time — but it means a hand-edited exported SVG gets no diagnostics.
3. **Three artifacts to keep in sync** (full, prerendered, prerendered-waapi), each needing its own
   size gate and e2e run. This is the ongoing cost of the split.
4. **Should `frames` mode get its own artifact?** Only 4,207 B better than the both-engines build. My
   recommendation is no, until someone is exporting frames-mode at volume.
5. **Does anything else consume the UMD expecting the full surface?** The trigger-explorer and preview
   panels raw-import the UMD; they render live documents *with* effects, so they must keep using the
   full build. Worth confirming when wiring step 5.

---

## 5 · Correction to `bundle-size.md`

That document claims `validateNodeEffects` has "no internal caller". **That is wrong** — it is called
on every `createAnimatorImpl` (`PxAnimator.ts:94`). The earlier grep was scoped to
`svg-animator-core/src` and missed the caller in `svg-animator-web`. The schema layer is still
removable from a *pre-rendered* build, and still a defensible dev-only candidate for the full build,
but the reason is "validation is optional", not "nothing calls it".
