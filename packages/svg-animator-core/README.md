# animator-core

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Platform-neutral core of the Pixodesk SVG animator: the document schema, the
effect materialisers, the interpolation engine and the path sampler — with **no
DOM dependency at all**. It is what every player shares, so the web player and
the React Native player produce identical values from the same document.

# 🚧 **Status - This project is currently under development.**

## Do I need this package?

Usually **no**. If you just want to play an animation, install a player:

| You are building for | Install |
|---|---|
| Browser (vanilla JS) | [`@pixodesk/svg-animator-web`](../svg-animator-web/README.md) |
| React | [`@pixodesk/svg-animator-react`](../svg-animator-react/README.md) |
| Vue | [`@pixodesk/svg-animator-vue`](../svg-animator-vue/README.md) |
| React Native | [`@pixodesk/svg-animator-rn`](../svg-animator-rn/README.md) 🧪 |

Each of those depends on this package and re-exports what you need.

Install it **directly** when you want to work with documents rather than play
them — validating them, transforming them, flattening them for a renderer of
your own, or computing values at a given time without rendering anything.

```bash
npm install @pixodesk/svg-animator-core
```

## Why it exists

A player has to answer two very different questions:

1. **What should be on screen at time _t_?** — schema, effects, easing,
   interpolation, path sampling. Pure computation, identical on every platform.
2. **How do I put it there?** — DOM elements, WAAPI, `react-native-svg`.
   Platform-specific.

Everything in category 1 lives here. The package compiles without the TypeScript
`dom` library, so a stray `document` reference is a build error rather than a
runtime crash on a non-browser platform.

## What's inside

| Area | Exports |
|---|---|
| **Schema & types** | `PxAnimatedSvgDocumentSchema`, `PxNodeSchema`, `PxEffectsSchema`, … plus every `Px*` TypeScript type and the `px` schema builder |
| **Validation** | `isPxElementFileFormat`, `isPxElementFileFormatDeep`, `validateNodeEffects` |
| **Materialisers** | `materialiseAllInTree`, `applyPlayerEffects`, `materialiseInternalLoopsInTree`, `materialiseMotionPathsInTree`, `materialiseAnimatedUseInstances` |
| **Interpolation** | `calcAnimationValues`, `interpolateValue`, `getNormalisedBindings` |
| **Sampling / geometry** | `createPathSampler`, `evaluateMotionPathSegment`, bezier helpers, `cubicBezier`, `splitEasing` |
| **Text** | `materialiseGlyphText`, `layoutGlyphTextChars`, `extendedPathForBrowser` |
| **Node helpers** | `getNormalizedProps`, `sanitiseAttributeValue`, `resolveStyle`, `generateNewIds` |
| **Playback engine** | `createBasicFrameLoopAnimator` + the `PxPlatformAdapter` interface |
| **Wire enums** | `PxAnimatorMode`, `PxAnimatorEngine`, `PxLoopExtend`, `PxTrimSubPaths`, `PxMaskType`, `PxCloneType`, `PxUnits`, `PxGradientType`, `PxGradientUnits`, `PxGradientSpreadMethod`, `PxPathOverflow`, `PxLengthAdjust`, `PxTextPathMethod`, `PxTextPathSpacing` — every two-or-more-way wire selector is a named enum, not a bare string |

### Validating a document

`isPxElementFileFormat(json)` is the cheap shallow gate (is this a Px document at all?);
`isPxElementFileFormatDeep(json)` runs the full schema. For per-field diagnostics, call a schema's
`isValid` with a context:

```ts
import { PxAnimatedSvgDocumentSchema, type PxValidationContext } from '@pixodesk/svg-animator-core';

const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
const ok = PxAnimatedSvgDocumentSchema.isValid(doc, ctx, []);
if (!ok) console.error(ctx.errors);   // ["children[0].effects.trimPath.range: …", …]
```

**Two modes, two different questions:**

| mode | question it answers | undeclared keys |
|---|---|---|
| default (`strict` absent/false) | *is this document repairable?* — what `sanitize` would accept | ignored, so unknown future fields stay forward-compatible |
| `strict: true` | *is this document well-formed?* — the wire shape locked to its schema | reported as errors on closed objects |

Use default in production readers and `strict` in tests and tooling. Two notes on strict, both
deliberate: it reaches **inside unions** (a union member is checked in the caller's mode, though its
per-branch errors are not reported unless every branch fails), and it **ignores keys whose value is
`undefined`** — those cannot survive `JSON.stringify`, so strict judges the document rather than the
in-memory object that produced it.

## The materialisation pipeline

`materialiseAllInTree(doc, engine)` is the single entry point that turns a
lightweight editor document into a flat tree any renderer can walk:

1. **Effects** — `node.effects` (transformBy, repeater, maskedBy, trimPath,
   clone/retime, gradients, textPath) become real nodes, wrappers and defs.
2. **Loops** — each property's `loop` is expanded into explicit keyframes.
3. **Motion paths** — tangented `transform` keyframes plus `autoOrient` are
   sampled into plain `{translate, rotate}` keyframes.
4. **Animated `<use>`** — replaced by `<g>` + a deep clone with fresh ids.

Steps 3 and 4 run when `engine` is `waapi`. Pass `waapi` for **any renderer
without live `<use>` propagation** — that includes `react-native-svg` — and
`frames` only for the DOM, which resolves `<use>` references natively.

```ts
import {
    materialiseAllInTree, generateNewIds, calcAnimationValues,
    getNormalisedBindings, PxAnimatorEngine,
} from '@pixodesk/svg-animator-core';

// Flatten once …
const flat = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.waapi));

// … then ask for values at any time, with no renderer involved.
for (const binding of getNormalisedBindings(flat, PxAnimatorEngine.frames) ?? []) {
    const values = calcAnimationValues(binding.animate, 500); // t = 500 ms
    console.log(binding.id, values);   // → { opacity: '0.5', transform: 'translate(…)' }
}
```

This is exactly how the React Native player precomputes its animation tracks, and
how the frames engine renders each tick in the browser — same function, same
numbers.

## Writing your own player

Implement `PxPlatformAdapter` and hand it to `createBasicFrameLoopAnimator`; the
engine handles timing, delay, direction, iterations, fill, playback rate and the
lifecycle callbacks, then calls you with plain attribute writes.

```ts
import { createBasicFrameLoopAnimator, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';

const adapter: PxPlatformAdapter = {
    isConnected: () => true,
    setAttribute: (id, attrName, value) => { /* apply to your element */ },
};

const api = createBasicFrameLoopAnimator(flatDoc, adapter, {
    onFinish: () => console.log('done'),
});
api.play();
```

Frame scheduling resolves `requestAnimationFrame` from `globalThis` at call time
and falls back to `setTimeout`, so the engine works in browsers, React Native and
test environments with faked timers.

## Versioning

Every package in this repo is released in lockstep. A player depends on the
matching core version (`^x.y.z`), so upgrading a player upgrades the core with it.

## License

[MIT](../../LICENSE) © [Pixodesk](https://pixodesk.com)
