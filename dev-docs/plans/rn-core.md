# Plan: `svg-animator-core` + `svg-animator-rn`

> Step-by-step implementation plan. Status legend: ☐ todo · ◐ in progress · ✅ done.
> Created 2026-07-16. Companion to ../backlog.md.

## Goal

1. **`@pixodesk/svg-animator-core`** — platform-neutral package: schema, types, interpolation, materializers (effects → plain JSON), sampling. Shared by web and RN.
2. **`@pixodesk/svg-animator-rn`** — React Native player on `react-native-svg` + `react-native-reanimated`, with a component API as close as possible to `@pixodesk/svg-animator-react`.
3. **Do not break** `svg-animator-web`, `-react`, `-vue` (public API byte-identical), nor `kf/app`.
4. Update `kf/app` to consume core (local alias + normal npm dependency).
5. Keep a living list of features that can't be implemented directly in RN (sampling/materialization is the answer for most).

## Research findings (grounding)

### The core/web cut is clean
- **28 of 34 non-test modules in `svg-animator-web/src` are 100% DOM-free at runtime** (~10 000 lines pure vs ~1 850 DOM-bound). The whole `effects/` directory (20 files) is pure — including `pathSampler.ts` (arc-length sampling in JS math, *not* `getPointAtLength`) and `textGlyphsEffect.ts` (text→outline from embedded glyph data, no `getBBox`). This is exactly the machinery RN needs.
- DOM-bound modules are all top-of-graph "drivers", nothing pure imports them: `PxAnimator.ts` (entry/fetch/container), `PxAnimatorDOM.ts` (renderNode), `PxAnimatorWebApi.ts` (WAAPI), `PxAnimatorTriggers.ts` (events), `PxAnimatorFrameLoop.ts` (rAF + DOM adapter — but `createAdapterAnimator` is already adapter-driven and DOM-free except the rAF scheduler).
- Exactly **one** type-level DOM leak in the pure set: `PxAnimatorApi.getRootElement(): Element | null` (PxAnimatorTypes).
- Pure-but-misplaced helpers worth moving: `generateNewIds`/`deepClone` (in PxAnimator.ts), `toDomProps`/`resolveStyle` (in PxAnimatorDOM.ts).

### kf/app usage
- Depends on `@pixodesk/svg-animator-web ^1.0.20` (npm), but every toolchain redirects to the local checkout: tsconfig `paths` + webpack (dist), vitest (src), jest (dist), plus `svg-animator-web-umd*` raw-loader aliases for iframe injection.
- 57 symbols imported, **all from the package root** (no subpaths) — dominated by schemas (25 symbols, mostly one file: `PxSchemaUtil.ts`), materializers (`materializeNodeEffects` ×10, `diffInEffect` ×6), and types. One `import * as` namespace spread.
- Consequence: as long as `svg-animator-web` re-exports everything it exports today, kf/app keeps working with **zero changes**; migrating its pure imports to core is then a mechanical, low-risk edit.

### RN experiment (`/Users/admin2/projects/pixodesk-animator-react-native`)
Expo 54 / RN 0.81 / reanimated ~4.1 / react-native-svg 15.12. Lessons encoded in App.tsx:
- `Animated.createAnimatedComponent(rn-svg element)` + `useAnimatedProps` works well for geometry attrs (`cy`, `r`, `x`, `d`) and per-element `transform`.
- **Do not** animate `TextPath.startOffset` (unusably janky) → per-glyph sampled transforms instead.
- **No native motion-along-path** → sample position/tangent (bake into transforms or `d`).
- Baking rotation+position into animated `d` geometry is the most reliable channel.

## Architecture decisions

1. **Web stays self-contained.** `svg-animator-web` gets `@pixodesk/svg-animator-core` as a workspace dep with tsup `noExternal: ['@pixodesk/svg-animator-core']` — dist output (esm/cjs/umd) bundles core and remains byte-equivalent in surface. Consumers (react, vue, kf/app, UMD iframes) see no change at all.
2. **Web re-exports core.** `svg-animator-web/src/index.ts` keeps its exact export list; moved symbols come via `export ... from '@pixodesk/svg-animator-core'`.
3. **`PxAnimatorApi.getRootElement()`** becomes platform-neutral in core: `getRootElement(): unknown | null` via a generic `PxAnimatorApi<TRoot = unknown>`; web re-exports `PxAnimatorApi = PxAnimatorApi<Element>` type alias so web/react/vue signatures don't change.
4. **Frame loop moves to core** (`createAdapterAnimator` + `PxPlatformAdapter`), with an injectable scheduler (defaults to `globalThis.requestAnimationFrame` — exists in RN too). The DOM shell (`createFrameLoopAnimator`, `createDomAdapter`, `getSelector`) stays in web. This gives RN a working playback engine for free.
5. **Core tsconfig drops `"dom"` from `lib`** → purity becomes compiler-enforced.
6. **RN driving model: native/UI-thread, NO JS frame loop.** The most efficient strategy available is the requirement, not an optimization. Pipeline: core materializes + samples the doc at build time (runs once) into **plain per-element keyframe tracks** (attr → `[{t, value}]`, colors pre-converted, transforms pre-composed/decomposed, paths pre-sampled); playback is a single reanimated progress shared value driven by `withTiming`/`withRepeat` **on the UI thread**, with a small generic worklet per animated element interpolating its tracks in `useAnimatedProps`. JS thread is idle during playback. Core's interpolation code is reused at *precompute* time (dense sampling where value types are complex, e.g. path morph / colors), so the worklet stays tiny and dumb (numeric/string lerp + step).
7. **Size stance**: core and web stay lean (core ≈ the already-pure 10k lines, nothing new); RN may grow (per-feature renderers, sampling glue).

## Package layout after the split

```
packages/
  svg-animator-core/    # NEW — schema, types, utils, interpolation, motion path,
                        #   effects/ materializers, use-materializer, materializeAll,
                        #   generateNewIds, basic frame loop (+ adapter iface)
  svg-animator-web/     # KEEPS — createAnimator entry, DOM renderNode, WAAPI engine,
                        #   triggers, DOM adapter, loadTagAnimators; re-exports core
  svg-animator-rn/      # NEW — <PixodeskSvgAnimator> for React Native
  svg-animator-react/   # unchanged (deps unchanged — still imports from -web)
  svg-animator-vue/     # unchanged
```

---

## Steps

### Phase 0 — `svg-animator-core` extraction  ✅ (2026-07-16)

0.1 ✅ Scaffolded `packages/svg-animator-core` (v1.0.20, tsup esm+cjs+dts dual config, tsconfig WITHOUT `"dom"` lib — purity is compiler-enforced, vitest, eslint, typecheck).
0.2 ✅ `git mv`'d the pure modules + tests (schema, types, utils, definitions, motion path, clone util, use-materializer, materializeAll, whole `effects/`). Extracted `PxIdUtil.ts` (generateNewIds/deepClone/generateUniqueId) out of `PxAnimator.ts` and `PxNodeProps.ts` (toDomProps/resolveStyle/sanitizeAttributeValue + tag/attr sanitization sets) out of `PxAnimatorDOM.ts`. `textGlyphs.render.test.ts` (genuinely DOM) moved to web.
0.3 ✅ Frame loop split: core `PxFrameLoop.ts` = `createAdapterAnimator` + `PxPlatformAdapter` with LAZY `globalThis` rAF resolution (works in browsers, fake-timer tests, RN; setTimeout fallback). Web keeps `createFrameLoopAnimator`/`createDomAdapter`/`getSelector`.
0.4 ✅ `PxAnimatorApi<TRoot = unknown>` generic in core; web adds `PxAnimatorWebTypes.ts` aliasing to `<Element>` — web signatures unchanged.
0.5 ✅ Core `index.ts` (explicit exports); web `index.ts` re-exports moved symbols from core; web deps `@pixodesk/svg-animator-core: workspace:*`; tsup `noExternal` bundles core into ALL web dist formats (esm/cjs/umd — runtime fully self-contained; d.ts type-refs resolve through the core dependency).
0.6 ✅ Verified: **runtime export surface byte-identical to published 1.0.20** (0 missing / 0 added); full monorepo build+typecheck+tests green (core 260, web 92, react 23, vue 23 = **398 tests**); **15/15 e2e screenshots pixel-identical** against the bundled dist; react/vue untouched. Compiler purity gate caught and fixed 1 leak (`hasStyleProp: CSSStyleDeclaration` → structural type).

**Publish note:** web depends on core — publish core (same version line) whenever web is published; pnpm rewrites `workspace:*` → `^x.y.z` at pack time.

### Phase 1 — kf/app switch  ✅ (2026-07-16)

1.1 ✅ `"@pixodesk/svg-animator-core": "^1.0.20"` added to kf/app package.json.
1.2 ✅ Local-dev aliases added next to the web ones: tsconfig `paths`, vitest alias (→ core `src/index.ts`), jest moduleNameMapper (→ core `dist/index.cjs`); webpack follows tsconfig automatically.
1.3 ✅ Scripted rewrite of **42 files**: pure symbols (schemas, types, materializers, validators) → core; only the DOM-player surface stays on web (9 imports: `createAnimator`, `PxAnimatorApi`, `PxAnimatorOptions`, `renderNode`, `PX_ANIMATOR_DATA_KEY`, one namespace spread; UMD raw-loader aliases untouched).
1.4 ✅ Typecheck: identical error set before/after (57 pre-existing, none svg-animator-related). All 20 rewritten spec files pass (182 tests). Full suite: 2208 passed / 78 failed — **A/B-verified pre-existing**: stashed the migration + checked out the pre-extraction commit and re-ran the failing specs → identical failures (incl. exactly 48/128 in `lottie-roundtrip-diff.visual`, plus `curated-features.failing/` which is known-failing by name). Zero failures attributable to the migration.

**Acceptance met:** kf/app builds/typechecks/tests exactly as before, with core imports; web imports remain only at the player surface.

### Phase 2 — `svg-animator-rn` MVP  ◐ (beginning implemented 2026-07-16)

**Done:**
- ✅ 2.1 Package scaffolded (`packages/svg-animator-rn`, no-dom tsconfig, tsup esm+cjs, peer deps react/rn/rn-svg/reanimated, core as regular dep kept EXTERNAL). `"react-native": "./src/index.ts"` entry so Metro builds from source — `'worklet'` directives survive and the consumer's babel workletizes our `useAnimatedProps` callbacks (esbuild dist could strip directives).
- ✅ 2.2 Static renderer (`PxRnRender.tsx` + `PxRnTypeMap.ts`): PxNode tree → react-native-svg components; reuses core's `toDomProps` + `sanitizeAttributeValue` (same security rules as web); unsupported tags warn-and-skip; `decorate` hook lets the animator substitute Animated elements.
- ✅ 2.3/2.4 Track compiler (`PxRnTracks.ts`, pure, 11 unit tests): densely samples every animated prop through core's `calcAnimationValues` (default 60 samples/s, capped) — **value-identical to the web frames engine**; colors/transforms/paths baked to strings, numerics coerced. Playback: single progress SharedValue driven by `withTiming`/`withRepeat` (+`withDelay`) on the UI thread; per-element `useAnimatedProps` worklet is an indexed lookup (`sampleProps`). No JS-thread loop.
- ✅ 2.5 `PixodeskSvgAnimator` component with the react-package prop shape: doc, duration/delay/iterations/fill/direction overrides, autoplay/play/pause, apiRef (`RnAnimatorApi` = ReactAnimatorApi shape), time/timeMs, onPlay/onPause/onCancel/onFinish/onStop.
- ✅ 2.6 Expo test bed at `examples/rn-expo` (workspace member — pnpm resolves `workspace:*`; external experiment app left untouched after yarn-classic couldn't parse the transitive workspace protocol). Metro monorepo config; 3 demo docs (static tree, animated transforms/colors/geometry, motion-along-path with autoOrient). Installs + typechecks clean. **Run with:** `cd examples/rn-expo && npx expo start`.

**Two bugs found and fixed while building the preview player (both verified against the real pipeline):**
1. **RN was using the `frames` materialization** — which deliberately KEEPS `<use href="#animatedTarget">` as a live reference, because the DOM propagates attribute writes through `<use>` shadow trees. react-native-svg has no such propagation, so any animated `<use>` (clone / retime / some repeater shapes) would have rendered frozen. Verified: a clone+retime doc left 3 live `<use>` under `frames` vs 0 (fully inlined, correctly retimed) under `waapi`. **RN now materializes with `waapi`** = "flatten everything for a renderer without live references". Regression test added.
2. **`strokeDasharray` was emitted as a space-separated string.** react-native-svg's JS `extractLengthList` splits strings, but values delivered through reanimated's animated-props path bypass that JS extraction and reach the native view, which expects a number array. Added `toRnPropValue` (length-list props → `number[]`, odd lengths doubled per SVG spec) used by both the track compiler and the static renderer. Regression test added.

### Phase 2.7 — RN preview player  ✅ (2026-07-16)

`examples/react-native-preview-player` — Expo app mirroring the web preview player's controls (transport, scrubbable timeline, loop override, rate, light/dark theme), with six embedded examples instead of drag-and-drop: bouncing ball, text-along-path (per-letter sampled motion path), trim path, repeater, gradient, path morph. Seek bar is `PanResponder`-based so the example adds no native deps.

**Verified end-to-end, not just typechecked:** Metro bundles for iOS (1441 modules) and web; exported the web build (react-native-web) and drove it with Playwright —
- all 6 samples render with the expected element trees, **zero console/page errors**;
- all 6 animate, with exactly the expected attributes changing (`transform`×20 for the 20 letters, `stroke-dasharray` for trim, `stop-color`×3 for the gradient, `d` for the morph, …);
- transport verified: autoplay plays, pause HOLDS the time, resume advances, stop→0, finish→duration, restart replays, tap-to-seek lands exactly on 50%, `No loop` ends idle at the duration;
- playback rate measured: 0.25×→0.25, 1×→0.99 (4× saturates because it reaches the timeline end mid-measurement).

A sample-verification harness also caught three authoring bugs before they shipped: a static `transform` attr competing with an animated `rotate` on the same node, a letter-timeline freeze from over-trimmed keyframes, and a no-op track animating `[150,70]→[150,70]`.

**Still to do (2.x):** verification on a real device/simulator (only the react-native-web path has been visually confirmed here), reverse playback rate, `resetOnFinish`, seek-while-playing continuation (currently pauses first), RN component-level tests.

2.1 ☐ Scaffold `packages/svg-animator-rn`: peer deps `react`, `react-native`, `react-native-svg`, `react-native-reanimated`; dep `@pixodesk/svg-animator-core` (workspace). Build with tsup (esm+cjs, no UMD); jest or vitest with mocks for rn-svg/reanimated (unit-test the pure mapping logic; visual testing via the Expo app).
2.2 ☐ **Static rendering**: `renderNode` for RN — PxNode tree → rn-svg components. Type map (`svg→Svg`, `g→G`, `rect/circle/ellipse/line/path/polygon/polyline`, `text/tspan→Text/TSpan`, `defs/linearGradient/radialGradient/stop/use/symbol/mask/clipPath/image`), attr conversion via core's `toDomProps` + kebab→camel (`stroke-width→strokeWidth`, `xlink:href/href→href`), viewBox/width/height handling, id registration map (same pattern as the React wrapper's `elementRefs`).
2.3 ☐ **Pipeline reuse**: on doc load run core's `materializeAllInTree(doc, 'frames')` + `generateNewIds` — effects, loops, motion-path sampling, animated-`<use>` inlining all reduce to plain nodes exactly as for the web frames engine.
2.4 ☐ **Animation MVP (native driving)**: a core "track compiler" turns the materialized doc's bindings into per-element sampled tracks (numeric tracks for geometry/opacity/transform parts; pre-lerped dense samples for colors and path `d`; easing baked into sample spacing or carried as per-segment cubic-bezier). RN side: one progress `SharedValue` driven by `withTiming`/`withRepeat` (duration/iterations/direction/fill mapped from animator config) entirely on the UI thread; each animated element uses `useAnimatedProps` with a tiny generic worklet interpolator over its tracks. No JS-thread loop; play/pause/seek/rate map to reanimated controls (`cancelAnimation`, re-`withTiming` from an offset, etc.).
2.5 ☐ **Component API parity** with `svg-animator-react`: props `doc, autoplay, play, pause, apiRef→ref, time, timeMs, mode('frames' only — 'auto'/'waapi' coerce with a warning), duration, delay, iterations, fill, direction, frameRate, onPlay/onPause/onCancel/onFinish/onRemove/onStop`; imperative `RnAnimatorApi` = `ReactAnimatorApi` shape. Triggers: `load` + `programmatic` first (RN has no hover/scroll; `click`→`onPress` later — goes on the feature-gap list).
2.6 ☐ Wire the Expo experiment app (`/Users/admin2/projects/pixodesk-animator-react-native`) to the local package (file:/metro watchFolders) with 2–3 sample docs (static tree, transform+color animation, motion-path doc) as the manual test bed.

**Acceptance:** experiment app renders a static editor JSON correctly; plays transform/color/opacity/geometry animations; motion-along-path plays via core sampling; play/pause/seek work through the ref API.

### Phase 3 — iterate & optimize (after MVP review)  ☐

- Text: glyph-mode text via core `textGlyphsEffect` (outlines → `Path` — no font dependency in RN); text-along-path via sampled per-glyph transforms (core `pathSampler`), NOT `TextPath.startOffset`.
- Gradients (static + animated stops via frame loop), maskedBy → rn-svg `Mask`, trimPath (dasharray channel), repeater/clone (already materialized by core — verify).
- Perf pass: track-size tuning (adaptive sampling density, shared tracks for identical animations, memoised track compilation), profiling on low-end Android.
- RN screenshot tests (jest-image-snapshot via Expo or Maestro) mirroring the web e2e matrix docs.

### Phase 3 — feature completion  ✅ (2026-07-31)

**Core bug fixed first (affected the WEB player too):** effect payloads silently dropped animations authored with the short keyframe aliases (`{t, v}` instead of `{time, value}`) — `transformation` and `repeater` froze at frame 0 with no warning. Root cause: `transformParts.readAnimatable`/`keyframeWith` only understood the long names. Fixed by normalizing aliases once at the shared read point; 6 regression tests added (`PxEffectsSchema.test.ts`).

**RN gaps closed:**
- **Filters** — all 22 `fe*` primitives + `filter` added to the type map (react-native-svg implements them). `feFunc*` elements now get their `funcType` → `type` relay, mirroring the web renderer. `foreignObject` deliberately left out (blocked by the shared sanitizer).
- **`node.style`** — was destructured away and dropped; now resolved through core's `resolveStyle` (named presets from `definitions.styles` included) and applied as props, with explicit attributes winning.
- **`resetOnFinish`** — carried on the compiled tracks and honored by a shared `restingPosition()` used by both the natural finish and `finish()`.
- **Seek while playing** — `setCurrentTime` used to pause; it now resumes from the new position.
- **Reverse playback** — negative rates supported; the sign composes with `direction` (WAAPI semantics) instead of being rejected.
- **Trigger `click`** — wrapped in `Pressable`; a second tap applies `outAction`.
- **Trigger `scrollIntoView`** — visibility sampled via `measureInWindow` against the window box (RN has no `IntersectionObserver`), honoring `scrollIntoViewThreshold` and `outAction`.

**Audit:** 56 documented cases (every element type, animatable attribute, effect, motion/loop/reference feature) were run through the real pipeline. Everything renders and animates; results are the source of the support tables now in the RN README. Verified afterwards that the example app still bundles and all six samples animate with no page errors.

**Remaining:** `mouseOver` (no touch analogue — will not implement); `retime.timeCrop` and animated `gradientTransform` (unimplemented core-wide); on-device verification of the native reanimated ↔ react-native-svg bridge, especially filters.

### Feature-gap list (RN) — keep updated during implementation

| Feature | Status / approach |
|---|---|
| Motion along path | ✅ solvable — core materializer samples to plain transform kfs (same as web frames path) |
| Text along path (`startOffset`) | sampling — per-glyph transforms via core pathSampler; native `TextPath` too slow |
| Native text metrics (`getBBox`) | avoided — glyph-mode text uses embedded outlines from `definitions.glyphs` |
| WAAPI engine | N/A in RN — frames engine only (`mode` coerced) |
| Triggers: mouseOver / scrollIntoView | no RN equivalent — `load`/`programmatic` first; `click`→`onPress` mapping later |
| CSS `filter` effects | rn-svg has partial filter support (v15) — investigate; likely gap list |
| `<use>` of animated targets | core already inlines these (`materializeAnimatedUseInstances`) |
| `foreignObject`, external images | out of scope initially |
| CSS styles / classes on nodes | rn-svg has no CSS — `resolveStyle` output must map to props; partial (currently dropped with the `style` attr) |
| Negative playback rate (reverse via API) | not supported in the RN driver yet (`setPlaybackRate` warns); `direction: 'reverse'/'alternate-*'` IS supported via withRepeat |
| `frameRate` config | N/A — reanimated runs at display rate; sampling density is the analogous knob (`CompileTracksOptions.sampleRate`) |
| `resetOnFinish` config | not yet implemented in the RN driver |
| Seek during playback | `setCurrentTime` pauses first (MVP); resume continues from the seeked position |

---

## Risks & mitigations

- **Web dist regression** — mitigated by `noExternal` bundling + surface diff of `dist/index.d.ts` + full test/e2e suite (Phase 0.6).
- **kf/app breakage** — nothing breaks even before Phase 1 (web re-exports everything); Phase 1 is opt-in and mechanical.
- **reanimated/rn-svg version churn** — pin what the experiment app proves (Expo 54 line); peer ranges kept wide.
- **Perf of JS-thread frame loop** — acceptable for MVP scope; UI-thread path is a planned optimization, and the sampled-table design (Phase 3) is compatible with everything built in Phase 2.

## Progress log

- 2026-07-16: Research done (DOM-dependency analysis, kf/app usage survey, RN experiment review). Plan written. Awaiting approval.
