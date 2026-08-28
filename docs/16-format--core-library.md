# Core library — `@pixodesk/svg-animator-core`

[← Effects reference](./15-format--effects.md) · [Contents](./README.md) · Next: [Troubleshooting →](./17-help--troubleshooting.md)

The platform-neutral heart of every player: the document schema, the effect materialisers,
the interpolation engine and the path sampler — with **no DOM dependency**. It is what makes
the web player and the React Native player produce identical values from the same document.

## Do I need it?

Usually **no** — install a [player](./05-player--installation.md) instead; each depends on the core and
re-exports what you need. Install the core directly when you work with **documents rather
than playback**: validating them, transforming them, flattening them for a renderer of your
own, or computing values at a given time without rendering anything.

```bash
npm install @pixodesk/svg-animator-core
```

## Validating a document

```ts
import { isPxElementFileFormat, isPxElementFileFormatDeep,
         PxAnimatedSvgDocumentSchema, type PxValidationContext } from '@pixodesk/svg-animator-core';

isPxElementFileFormat(json);        // cheap shallow gate — is this a Pixodesk document at all?
isPxElementFileFormatDeep(json);    // { valid, errors } — full schema

// per-field diagnostics
const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
if (!PxAnimatedSvgDocumentSchema.isValid(doc, ctx, [])) console.error(ctx.errors);
// → ["children[0].effects.strokeTrim.range: …", …]
```

| Mode | Question it answers | Unknown keys |
|---|---|---|
| default | *is this document usable?* — what the players accept | ignored (forward-compatible) |
| `strict: true` | *is this document exactly well-formed?* | reported as errors |

Use the default in production readers and `strict` in tests and tooling.
`validateNodeEffects(doc)` checks just the `effects` buckets and returns warning strings.

## Flattening a document

`materialiseAllInTree(doc, engine)` turns a document into a flat tree any renderer can walk:

1. **Effects** — every `node.effects` becomes real nodes, wrappers and defs.
2. **Loops** — each property's `loop` is expanded into explicit keyframes.
3. **Motion paths** — tangented `transform` keyframes and `autoOrient` are sampled into plain
   `{ translate, rotate }` keyframes.
4. **Animated `<use>`** — replaced by a `<g>` with a deep clone and fresh ids.

Steps 3–4 run when `engine` is `waapi`. Pass `waapi` for **any renderer without live `<use>`
propagation** (including `react-native-svg`); `frames` only for the DOM, which resolves `<use>`
natively.

```ts
import { materialiseAllInTree, generateNewIds, calcAnimationValues,
         getNormalisedBindings, PxAnimatorEngine } from '@pixodesk/svg-animator-core';

const flat = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.waapi));

// values at any time, no renderer involved
for (const binding of getNormalisedBindings(flat, PxAnimatorEngine.frames) ?? []) {
  const values = calcAnimationValues(binding.animate, 500);   // t = 500 ms
  console.log(binding.id, values);   // → { opacity: '0.5', transform: 'translate(…)' }
}
```

This is exactly how the React Native player precomputes its tracks and how the web frame loop
renders each tick.

## Writing your own player

Implement `PxPlatformAdapter` and hand it to `createBasicFrameLoopAnimator`; the engine
handles timing, delay, direction, iterations, fill, playback rate and the lifecycle callbacks,
then calls you with plain attribute writes:

```ts
import { createBasicFrameLoopAnimator, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';

const adapter: PxPlatformAdapter = {
  isConnected: () => true,
  setAttribute: (id, attrName, value) => { /* apply to your element */ },
};

const api = createBasicFrameLoopAnimator(flatDoc, adapter, { onFinish: () => console.log('done') });
api.play();
```

Frame scheduling uses `requestAnimationFrame` when it exists and falls back to `setTimeout`, so
the engine runs in browsers, React Native and test environments.

## Exports

| Area | Exports |
|---|---|
| **Schema & types** | `PxAnimatedSvgDocumentSchema`, `PxNodeSchema`, `PxEffectsSchema`, `PxAnimatorConfigSchema`, `PxKeyframeSchema`, … plus every `Px*` TypeScript type and the `px` schema builder |
| **Validation** | `isPxElementFileFormat`, `isPxElementFileFormatDeep`, `validateNodeEffects` |
| **Materialisers** | `materialiseAllInTree`, `applyPlayerEffects`, `materialiseInternalLoopsInTree`, `materialiseMotionPathsInTree`, `materialiseAnimatedUseInstances` |
| **Interpolation** | `calcAnimationValues`, `interpolateValue`, `getNormalisedBindings` |
| **Sampling / geometry** | `createPathSampler`, `evaluateMotionPathSegment`, Bézier helpers, `cubicBezier`, `splitEasing` |
| **Text** | `materialiseGlyphText`, `layoutGlyphTextChars`, `extendedPathForBrowser` |
| **Node helpers** | `getNormalizedProps`, `sanitiseAttributeValue`, `resolveStyle`, `generateNewIds`, `deepClone` |
| **Document accessors** | `getAnimatorConfig`, `getDefs`, `getBindings`, `getChildren` |
| **Scroll timeline math** | `isScrollTimeline`, `scrollViewProgress`, `scrollOffsetProgress`, `scrollTotalDurationMs` |
| **Playback engine** | `createBasicFrameLoopAnimator` + the `PxPlatformAdapter` interface |
| **Wire enums** | `PxAnimatorMode`, `PxAnimatorEngine`, `PxLoopExtend`, `PxStrokeTrimSubPaths`, `PxMaskType`, `PxCloneType`, `PxUnits`, `PxGradientType`, `PxGradientUnits`, `PxGradientSpreadMethod`, `PxPathOverflow`, `PxLengthAdjust`, `PxTextPathMethod`, `PxTextPathSpacing` — every wire selector is a named constant, not a bare string |

## Versioning

Every package is released in lockstep; a player depends on the matching core version, so
upgrading a player upgrades the core with it.

[← Effects reference](./15-format--effects.md) · [Contents](./README.md) · Next: [Troubleshooting →](./17-help--troubleshooting.md)
