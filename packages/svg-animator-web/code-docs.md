# svg-animator-web — code architecture

Player library that takes a lightweight animated-SVG document (`PxNode` tree with
per-node `effects` / `animate` buckets) and turns it into a running animation in
the browser. Two playback engines: **WAAPI** (`waapi`) and a JS **frame loop**
(`frames`); `auto` resolves to `waapi` with a frames fallback.

## Animation pipeline (call structure)

Entry point is `createAnimatorImpl(doc)`. The whole document is *materialised*
into a flat, renderer-agnostic tree first, then an engine-specific animator is
built over the rendered DOM.

- **`createAnimatorImpl(doc)`** — `PxAnimator.ts`
  - `validateNodeEffects(doc)` — warn-only `PxEffectsSchema` check
  - resolve `engine` = `mode === 'frames' ? frames : waapi` *(auto/waapi/unset → waapi)*
  - **`materialiseAllInTree(doc, engine)`** — `PxAnimatorMaterialiseAll.ts` *(also exported for the Editor — one shared pipeline, no drift)*
    - **1. `applyPlayerEffects(doc)`** — `effects/PlayerEffectsUtil.ts` · **both engines** · materialises `node.effects` into wrappers/defs/clones
      - `applyPlayerEffects_exceptRetime` — pass 1, per node (effects bucket deleted up-front, slices passed to each applier):
        - `applyFillGradientEffect` / `applyStrokeGradientEffect` — `effects/gradientEffect.ts` (mint `<linear/radialGradient>` def, host `fill`/`stroke` → `url(#…)`)
        - `applyStrokeTrimEffect` — `effects/strokeTrimEffect.ts` (offset/range → `stroke-dasharray`/`-dashoffset`; collapse vs `<g>`-split)
        - `applyRepeaterEffect` — `effects/repeaterEffect.ts` (N copies; per-copy translate×i / rotate×i / scale^i / origin const)
        - `applyMaskedByEffect` — `effects/maskedByEffect.ts` (`<mask>` def + inverse-transform compensation; uses `collectMaskAncestorChains` pre-pass)
        - content-ref: `identifyContentRefTargets` (pre-pass) → `applyRefHref` + `splitForContentRef` (`effects/contentRefSplit.ts`); else `applyRefAndTransformationEffect` → `applyTransformationEffect` (`effects/transformationEffect.ts`)
        - `applyTextAlongPathEffect` — `effects/textAlongPathEffect.ts` (wrap children in `<textPath href>`)
      - `applyPlayerEffects_retime` — pass 2 (runs AFTER all pass-1 effects) → **`applyAllRetimeEffects`** — `effects/retimeEffect.ts`
        - `materialiseRetime` → `buildChainClone` → `materialiseNestedRetimeUses` *(nested retime composes via `concatRetime`)*
    - **2. `materialiseInternalLoopsInTree`** — `PxDefinitions.ts` · **both engines** · `propAnim.loop` → flat repeated kfs over the duration
    - **3. `materialiseMotionPathsInTree`** — `PxMotionPath.ts` · **waapi only** · tangent/autoOrient transform kfs → sampled `{translate, rotate}` kfs *(frames evaluates parametric per frame)*
    - **4. `materialiseAnimatedUseInstances`** — `PxAnimatorUseMaterialiser.ts` · **waapi only** · `<use>`→animated-subtree replaced with `<g>`+deep-clone *(WAAPI/CSS don't animate through a `<use>` shadow; frames drives source attrs per frame so the shadow picks them up)*
    - **5. `pruneUnreferencedDefs`** — `PxAnimatorMaterialiseAll.ts` · **waapi only** · removes `<defs>` `<g>`/`<symbol>` entries orphaned by step 4 (no `<use href>` left), then drops the `<defs>` node once it's empty; fixpoint loop collapses chains
  - `generateNewIds` + `renderNode` — render the materialised tree to DOM
  - **`createAnimatorFromConfig(doc, …)`** — `PxAnimator.ts` · builds the actual animator over the rendered DOM
    - `mode === 'frames'` → `createFrameLoopAnimator` — `PxAnimatorFrameLoop.ts`
    - else → `createWebApiAnimator` — `PxAnimatorWebApi.ts` · **||** `createFrameLoopAnimator` *(fallback when WAAPI returns `null` — i.e. some animated `(cssKey, cssValue)` fails `CSS.supports`)*

### Notes on the shape
- **Retime is the last effect** (pass 2 inside `applyPlayerEffects`) but still **step 1** of the whole pipeline.
- **Steps 3-5 are waapi-only.** Frames keeps the parametric / `<use href>` forms and resolves them per frame.
- **Engine is committed before effects** (`waapi` unless explicitly `frames`), but the *actual playback* engine can still fall back to `frames` at `createWebApiAnimator` time — that fallback does **not** re-materialise (slight over-materialisation, no correctness issue).
- **`ApplyContext.engine`** carries the resolved engine into the effect pass for effects that may later choose to inline animated clone content themselves (currently unconsumed; the inline is done by step 4).

## Effect appliers (`effects/`)
Each is a pure transformer `outNode = applyXxx(node, fx, ctx)` — a single `effects` bucket
materialised into structure. Covered 1:1 by per-effect tests (`effects/*.test.ts`, shared
helpers in `effectTestKit.ts`); see `effects/EFFECT-TEST-COVERAGE.md`. Wire-shape source of
truth: `PxAnimatorTypes.ts` (`_PxEffects` + each `_Px*Effect` paired with its `Px*Schema`).
