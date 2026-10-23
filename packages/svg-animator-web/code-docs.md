# svg-animator-web — code architecture

Player library that takes a lightweight animated-SVG document (`PxNode` tree with
per-node `effects` / `animate` buckets) and turns it into a running animation in
the browser. Two playback engines: **WAAPI** (`waapi`) and a JS **frame loop**
(`frames`); `auto` resolves to `waapi` with a frames fallback.

## Animation pipeline (call structure)

Entry point is `createAnimatorImpl(doc)`. The document is lowered through the staged
pipeline (`prepareDocument`, core `pipeline/PxPrepareDocument.ts`: `current` → `checked` →
`resolved` → `plain`), then an engine-specific animator is built over the rendered DOM.
Paths below are under core `src/` unless they start with `web:`.

- **`createAnimatorImpl(doc)`** — `web: animator/PxAnimator.ts`
  - `prepareDocument(doc, { stage: checked })` — version-migrate, then ONE repaired, type-stamped copy; repairs reported (`effectsShape`, `documentRepaired`)
  - apply the per-instance override (`applyAnimatorConfig`), then the no-driver rule (`start: 'none'` without `playAsSaved`)
  - `prepareDocument(doc, { stage: resolved })` → engine = `resolveTimelineEngine(timeline.engine)` *(auto/native → native, js → frames)*
  - **`prepareDocument(doc, { engine })`** = the `plain` stage → **`materializeAllInTree(doc, engine)`** — `materialize/PxAnimatorMaterializeAll.ts` *(also used by the Editor — one shared pipeline, no drift)*
    - **1. `materializeNodeEffects(doc)`** — `effects/PlayerEffectsUtil.ts` · **both engines** · materializes `node.effects` into wrappers/defs/clones
      - pre-passes: `identifyContentRefTargets` (`effects/reference/contentRefSplit.ts`), `collectMaskAncestorChains` (`effects/clipping/maskedByEffect.ts`)
      - `applyPlayerEffects_exceptRetime` — pass 1, per node (effects bucket deleted up-front, slices passed to each applier):
        - glyph text: `applyTextGlyphsAlongPath` / `applyTextGlyphsEffect` — `effects/text/textGlyphsEffect.ts` (baked `<path>` outlines); else `applyTextPathEffect` — `effects/text/textPathEffect.ts` (wrap children in `<textPath>`)
        - `applyFillGradientEffect` / `applyStrokeGradientEffect` — `effects/paint/gradientEffect.ts` (generate `<linear/radialGradient>` def, host `fill`/`stroke` → `url(#…)`)
        - `applyStrokeTrimEffect` — `effects/stroke/strokeTrimEffect.ts` (offset/range → `stroke-dasharray`/`-dashoffset`; collapse vs `<g>`-split)
        - `applyRepeaterEffect` — `effects/transform/repeaterEffect.ts` (N copies; per-copy translate×i / rotate×i / scale^i / origin const)
        - `applyMaskedByEffect` — `effects/clipping/maskedByEffect.ts` (`<mask>` def + inverse-transform compensation)
        - `applyClipPathEffect` — `effects/clipping/clipPathEffect.ts` (inline `pathData` → `<clipPath>` def)
        - content-ref: `applyRefHref` (`effects/reference/refEffect.ts`) + `splitForContentRef` (`effects/reference/contentRefSplit.ts`); else `applyRefAndTransformationEffect` (`effects/reference/refEffect.ts`) → `applyTransformByEffect` (`effects/transform/transformationEffect.ts`)
      - `applyPlayerEffects_retime` — pass 2 (runs AFTER all pass-1 effects) → **`applyAllRetimeEffects`** — `effects/reference/retimeEffect.ts`
        - `materializeRetime` → `buildChainClone` → `materializeNestedRetimeUses` *(nested retime composes via `concatRetime`)*
    - **1b. `materializeOffsetPathsInTree`** — `materialize/PxOffsetPathMaterializer.ts` · **both engines** · `alongPathMode: 'offsetPath'` → CSS Motion Path (`offset-path` + an `offsetDistance` binding)
    - **2. `compileAnimationsInTree`** — `animation/PxDefinitions.ts` · **both engines** · every `animate` entry → its COMPILED form (`{ kind, keyframes }`, the format's low layer): values typed by kind, easings resolved, `loop` expanded over the content window `[inTime, inTime + duration]`, a moving `transform` sampled (native) or kept with its tangents (frames evaluates per frame)
    - **4. `materializeAnimatedUseInstances`** — `materialize/PxAnimatorUseMaterializer.ts` · **native only** · `<use>`→animated-subtree replaced with `<g>`+deep-clone *(WAAPI/CSS don't animate through a `<use>` shadow; frames drives source attrs per frame so the shadow picks them up)*
    - **5. `pruneUnreferencedDefs`** — `materialize/PxAnimatorMaterializeAll.ts` · **native only** · removes `<defs>` `<g>`/`<symbol>` entries orphaned by step 4, then drops an empty `<defs>`; fixpoint loop collapses chains
    - **6. `materializeRestPosesInTree`** — `materialize/PxRestPose.ts` · **both engines** · LAST, so generated nodes are covered: the static document shows at rest
  - `prepareDocument(doc, { engine, freshIds: true })` + `renderNode` — render the materialized tree to DOM (when there is a container)
  - **`createAnimatorFromConfig(doc, …)`** — `web: animator/PxAnimator.ts` → `bindWithEngineChoice` (`web: engines/PxAnimatorBind.ts`) · builds the actual animator over the rendered DOM
    - scroll timeline → the scroll driver (`web: scroll/`), triggers inert
    - `js` → `createFrameLoopAnimator` — `web: engines/PxAnimatorFrameLoop.ts`
    - else → `createWebApiAnimator` — `web: engines/PxAnimatorWebApi.ts` · **||** `createFrameLoopAnimator` *(fallback when WAAPI returns `null` — i.e. some animated `(cssKey, cssValue)` fails `CSS.supports`)*

### Notes on the shape
- **Retime is the last effect** (pass 2 inside `materializeNodeEffects`) but still **step 1** of the whole pipeline.
- **Steps 4-5 are native-only.** Frames keeps the parametric / `<use href>` forms and resolves them per frame.
- **Engine is committed before effects** (native unless `timeline.engine: 'js'`), but the *actual playback* engine can still fall back to frames at `createWebApiAnimator` time — that fallback does **not** re-materialize (slight over-materialization, no correctness issue).
- **`ApplyContext.engine`** carries the resolved engine into the effect pass for effects that may later choose to inline animated clone content themselves (currently unconsumed; the inline is done by step 4).

## Effect appliers (`effects/`)
Each is a pure transformer `outNode = applyXxx(node, fx, ctx)` — a single `effects` bucket
materialized into structure. Covered 1:1 by per-effect tests (`effects/**/*.test.ts`, shared
helpers in `effectTestKit.ts`); see `effects/EFFECT-TEST-COVERAGE.md`. Wire-shape source of
truth: `PxAnimatorTypes.ts` (`_PxEffects` + each `_Px*Effect` paired with its `Px*Schema`).
