# Pixodesk SVG Animator — the public API, the compact reference

Every symbol the five packages export, marked by audience — with full signatures
for the ones you actually use to put an animation in a product. For the file
format see [SCHEMA.md](./SCHEMA.md); for prose and guides see
[README.md](./README.md#documentation). Checked against the source on 2026-09-10
(player schema `1.1`).

| | Meaning |
|---|---|
| **●** | **User-facing** — the API for playing an animation in your page or app. Documented in full below. |
| **○** | **Advanced** — document tooling: inspect, transform or validate a document outside a player. Stable, rarely needed. |
| **▪** | **Internal** — exported so the Pixodesk editor (and the sibling packages) stay in lockstep with the player. Not part of the supported surface; may change without notice. |

Which package: **web** for plain HTML/JS · **react** / **vue** for those
frameworks · **rn** for React Native 🧪 · **core** only to inspect or transform
documents yourself. A pre-rendered `.svg` file needs no package at all.

| Job | Call |
|---|---|
| Play a JSON file in a page | `createAnimator({ src, container })` (web) |
| Play it in React / Vue | `<PixodeskSvgAnimator :doc … />` |
| Play it in React Native | `<PixodeskSvgAnimator doc={…} />` (rn) |
| Check a generated document before shipping it | `validateDocument(doc)` |
| Put one animation on a page twice | `generateNewIds(doc)` for the second copy |
| Feed a renderer of your own | `materialiseAllInTree(doc, 'native')` (core) |

## Props and options across players

Every way to create a player, side by side — so a prop added or renamed in one place can be
checked against the others. A cell is **✓** when that surface takes the name as is, shows the
spelling when it differs, and is **—** when the surface does not have it. Update this table with
every prop or option change.

| Name | Web `createAnimator` | HTML tag (`loadTagAnimators`) | Pre-rendered `createAnimator` | React | Vue | React Native | Notes |
|---|---|---|---|---|---|---|---|
| **Document** | | | | | | | |
| `src` | ✓ URL | `data-px-animation-src` | — | — | — | — | the components take the document itself |
| `data` | ✓ | — | ✓ required¹ | — | — | — | |
| `doc` | — | — | — | ✓ required | ✓ required | ✓ required | the same thing as `data` |
| `container` | ✓ selector or `Element` | the tagged element | — | — | — | — | omitted: animate an SVG already in the page |
| `adapter` | ✓ ○ | — | ✓ ○ | — | — | — | |
| **Playback override** | | | | | | | |
| `config` | ✓ object or JSON string | — | — | ✓ | ✓ | ✓ | React Native ignores `timeline.engine` |
| `resetDocDefaults` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `duration` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `delay` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `iterations` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `startOn` | ✓ 5 values | — | — | ✓ 4 values | ✓ 5 values | ✓ 4 values | `'programmatic'` on web and Vue only; React Native ignores `'mouseOver'` |
| **Control** | | | | | | | |
| `autoplay` | — | — | — | ✓ | ✓ | ✓ | web and the HTML tag always follow the document's trigger |
| `play` | — | — | — | ✓ | ✓ | ✓ | `false` jumps to the end |
| `pause` | — | — | — | ✓ | ✓ | ✓ | |
| `progress` | — | — | — | ✓ | ✓ | ✓ | |
| `time` | — | — | — | ✓ | ✓ | ✓ | |
| `apiRef` | the returned `PxAnimatorAPI` | `element._px_animator` | the returned `PxAnimatorAPI` | ✓ — picks the imperative mode | template ref (`VueAnimatorApi`) | ✓ — mode unchanged | the imperative handle |
| **Callbacks** | | | | | | | |
| `callbacks` | ✓ object | — | ✓ object | — | — | — | holds the web forms of the rows below |
| `onPlay` | `callbacks.onPlay` | — | `callbacks.onPlay` | ✓ | `@play` | ✓ | |
| `onPause` | `callbacks.onPause` | — | `callbacks.onPause` | ✓ | `@pause` | ✓ | |
| `onCancel` | `callbacks.onCancel` | — | `callbacks.onCancel` | ✓ | `@cancel` | ✓ | |
| `onFinish` | `callbacks.onFinish` | — | `callbacks.onFinish` | ✓ | `@finish` | ✓ | |
| `onRemove` | `callbacks.onRemove` | — | `callbacks.onRemove` | ✓ | `@remove` | — | |
| `onStop` | — | — | — | ✓ | `@stop` | ✓ | after any of pause / cancel / finish / remove |
| `onError` | — | — | — | — | — | ✓ | web reports failures with `console.error` only |
| `fallback` | — | — | — | — | — | ✓ | |
| **Styling** | | | | | | | |
| `className` | — | — | — | ✓ on the root `<svg>` | `class`, falls through to the root `<svg>` | — | web: style the container |
| `style` | — | — | — | ✓ on the root `<svg>` | `style`, falls through to the root `<svg>` | — | |

¹ Only `animator.definitions` and `animator.animateById` — the SVG is already in the page.

The two pre-rendered SVG + CSS wrappers, which toggle class names instead of creating a player:

| Name | React `PixodeskSvgCssAnimator` | Vue `PixodeskSvgCssAnimator` |
|---|---|---|
| the SVG | `children` | default slot |
| `startOn` | ✓ 4 values, default `'load'` | ✓ 4 values, default `'load'` |
| `outAction` | ✓ default `'continue'`; `'reverse'` acts as `'continue'` | ✓ same |
| `className` | ✓ on the wrapper div | `class`, on the wrapper div |
| `style` | ✓ on the wrapper div | ✓ on the wrapper div |

## @pixodesk/svg-animator-web — the browser player

```typescript
// ● Create a player. Provide exactly one of `src` / `data` — both, or neither, throws.
//   With `src`, control calls made before the fetch resolves are queued and replayed
//   in order, so `createAnimator({ src }).play()` works as written. A failed fetch or
//   an invalid document is reported with `console.error` only; `isReady()` stays false.
function createAnimator(options: PxAnimatorOptions): PxAnimatorAPI;

interface PxAnimatorOptions {
    src?: string;                          // URL to fetch the JSON document from
    data?: PxAnimatedSvgDocument;          // …or the document inline (see SCHEMA.md)
    container?: string | Element;          // CSS selector or element to render into (its content is
                                           //   replaced). Omit it to animate an SVG already in the
                                           //   page, found by the document's `id`
    callbacks?: PxAnimatorCallbacksConfig; // lifecycle callbacks
    adapter?: PxPlatformAdapter;           // ○ custom render target; omit for the DOM

    // -- Per-instance playback override; the document is never modified -------
    config?: PxAnimatorConfigPatch | string; // deep-merged over the document's `animator`
                                           //   block — same shape as the file. `null` at a
                                           //   slot DELETES that key. A JSON string is also
                                           //   accepted (survives property mangling).
    resetDocDefaults?: boolean;            // start from the player's defaults, `config` on top
    duration?: number;                     // ▸ config.timeline.duration (ms)
    delay?: number;                        // ▸ config.timeline.delay (ms)
    iterations?: number | 'infinite';      // ▸ config.timeline.iterations
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
                                           // ▸ config.timeline.trigger.startOn
                                           //   a shortcut wins over the same key in `config`
}

// ● Playback control returned by `createAnimator` — core's `PxAnimatorAPI<Element>`.
interface PxAnimatorAPI extends PxBasicAnimatorAPI {
    finish(): void;                        // jump to the end and hold the final state; fires onFinish
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, negative plays backwards
                                           //   (the frame-loop engine ignores 0 and non-finite rates)
    getCurrentTime(): number | null;       // ms from the start of the whole run; null before ready
    setCurrentTime(time: number): void;    // seek, ms
    destroy(): void;                       // stop, remove the SVG it rendered, fire onRemove
}

// ● The platform-neutral base from core; the web fixes the root type to `Element`.
interface PxBasicAnimatorAPI {
    isReady(): boolean;                    // false until a fetched document has loaded
    getRootElement(): Element | null;      // the rendered <svg>
    isPlaying(): boolean;
    play(): void;                          // start, or resume after pause
    pause(): void;                         // hold the current frame
    cancel(): void;                        // stop and reset to the first frame
}

// ● Every callback is optional and takes no arguments.
interface PxAnimatorCallbacksConfig {
    onPlay?: () => void;    // started or resumed
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;  // reached the end, or finish() was called
    onRemove?: () => void;  // destroy() was called
}

// ● Scan the page for `<div data-px-animation-src="animation.json">` and create one
//   player per match, rendered into that element and stored on it. Safe to call
//   repeatedly: elements that already carry a player are skipped. Zero-config — no
//   callbacks, no override — and nothing calls it for you.
function loadTagAnimators(): void;

// ● Wire a player to a DOM trigger. `createAnimator` already does this from the
//   document's own `animator.timeline.trigger`. It only ADDS listeners — nothing is
//   detached — so calling it on an element the player already wired leaves BOTH sets
//   live. Use it after you have replaced the rendered SVG yourself (the player's
//   listeners went with the old elements). To change the trigger, use `config`.
//   Returns the same api, for chaining.
function setupAnimationTriggers(api: PxAnimatorAPI, config: PxTrigger): PxAnimatorAPI;

interface PxTrigger {                                  // ● also a wire type — see SCHEMA.md
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
                                                       // absent: nothing starts until play()
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse'; // when the trigger ends; default 'continue'
    finishAction?: 'hold' | 'reset';                   // after a natural finish; default 'hold'
                                                       //   (the player reads it; setupAnimationTriggers does not)
    scrollIntoViewThreshold?: number;                  // 0–1 visible ratio; default 0
}
```

**Builds.** The ESM and CJS entries (`dist/index.js`, `dist/index.cjs`) carry everything on this
page. Three `<script>` builds put a narrower surface on one global, `window.PixodeskAnimator`:

| File | For | On `PixodeskAnimator` |
|---|---|---|
| `pixodesk-svg-animator.umd.js` / `.umd.min.js` | a page playing JSON documents | `createAnimator`, `createAnimatorImpl`, `loadTagAnimators`, `setupAnimationTriggers`, `validateDocument`, `generateNewIds`, `PxTimelineEngineExtra`, `PxTimelineEngine`, `PX_ANIMATOR_DATA_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME` |
| `index.prerendered.umd.js` / `.umd.min.js` | a pre-rendered SVG + JS export (engine `auto` / `js`) | `createAnimator(options: PxPrerenderedOptions)`, `setupAnimationTriggers`, `PX_ANIMATOR_DATA_KEY` |
| `index.prerendered-waapi.umd.js` / `.umd.min.js` | the same with engine `native` — the smallest build | the same three |

`PxPrerenderedOptions` is `{ data: PxAnimatedSvgDocument; callbacks?; adapter? }`. Its `data`
carries only `animator.definitions` and `animator.animateById` — the SVG is already in the page —
and it is not validated. There is no `src` form.

**Globals.** Loading the full player — the ESM/CJS entry or the main UMD — also assigns
`window.createAnimator`, `window.loadTagAnimators` and `window.setupAnimationTriggers` whenever
`window` exists. The pre-rendered builds do not. Separately, a document with
`animator.debugGlobalName: "heroBanner"` makes the player assign its API object to
`window.heroBanner`, so a live instance can be driven from the console — opt-in per document; see
[Playback & triggers → Debug handle](./docs/library/playback-and-triggers.md#debug-handle--debugglobalname).

**Everything else this package exports**

| Symbol | |
|---|---|
| `createAnimatorImpl(doc, adapter?, callbacks?, container?, config?, resetDocDefaults?)` | ▪ the non-fetching core of `createAnimator`; `config` takes the object form only |
| `createWebApiAnimator(doc, callbacks?, rootElement?, forceEvenIfHasUnsupportedAttrs?, scrollTimeline?)` → `PxAnimatorAPI \| null`, `createFrameLoopAnimator(doc, adapter?, callbacks?, rootElement?)` | ▪ the two engines; `createAnimator` picks one from `timeline.engine` |
| `createBasicFrameLoopAnimator(doc, adapter, callbacks?)` | ○ the frame-loop engine against a custom `PxPlatformAdapter` — see **core** |
| `renderNode(node, defs?)` → `Element \| null`, `getNormalizedProps(props)` | ○ render one wire node to a DOM element / resolve a node's attributes |
| `validateDocument(doc)` | ● the whole-document check — see **core** |
| `applyAnimatorConfig`, `mergeAnimatorConfig`, `foldAnimatorConfigShortcuts` | ● the playback-override merge behind `config` — see **core** |
| `materialiseAllInTree`, `applyPlayerEffects`, `validateNodeEffects`, `generateNewIds` | ○ document tooling — see **core** |
| `getAnimatorConfig`, `getBindings`, `getChildren`, `getDefs`, `isPxElementFileFormat`, `isPxElementFileFormatDeep` | ○ document accessors — see **core** |
| `normalizeDocument` (= core `getNormalisedBindings`), `calcAnimationValues`, `materialiseInternalLoopsInTree`, `materialiseInternalLoopsInPropAnim`, `materialiseMotionPathsInTree`, `materialiseMotionPathInPropAnim`, `evaluateMotionPathSegment`, `propAnimIsMotionPath`, `materialiseAnimatedUseInstances`, `collectSampleTimes`, `diffInEffect`, `visualModelAt` | ▪ pipeline stages and the editor's comparison harness, re-exported from core |
| `jsonElementFactory`, `materialiseGlyphText`, `materialiseGlyphTextAlongPath`, `materialiseGlyphTextHorizontal`, `layoutGlyphTextChars`, `MISSING_GLYPH_CLASS_NAME`, `createPathSampler`, `extendedPathForBrowser`, `shiftAnimatable` | ▪ glyph text and text-on-path, re-exported from core |
| `camelCaseToKebabWordIfNeeded`, `COLOUR_ATTR_NAMES`, `STYLE_ATTR_NAMES`, `TRANSFORM_FN_NAMES`, `toRGBA` | ▪ string and colour helpers |
| `PX_ANIMATOR_DATA_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME` | ▪ attribute and property names the player writes |
| `px`, `schemaKeys`, `describeSchema`; `PxAnimatedSvgDocumentSchema`, `PxNodeSchema`, `PxNodeBase`, `PxSvgNodeExtra`, `PxAnimatorConfigSchema`, `PxTriggerSchema`, `PxAnimationDefinitionSchema`, `PxElementAnimationSchema`, `PxPropertyAnimationSchema`, `PxKeyframeSchema`, `PxKeyframeValueSchema`, `PxAttrValueSchema`, `PxTransformValueSchema`, `PxTransformPartsSchema`, `PxBezierPathSchema`, `PxEasingOrRefSchema`, `PxLoopSchema`, `PxBindingSchema`, `PxDefsSchema` and the twelve effect schemas | ○ re-exported from core. Not re-exported: `PxTimelineSchema`, `PxTimelinePinSchema`, `PxScrollSchema`, `PxScrollRangeSchema`, `PxScrollRangePointSchema` |
| `PxTimelineEngineExtra`, `PxTimelineEngine`, `PxCloneWithout`, `PxLoopRepeatAt`, `PxLoopDirection`, `PxStrokeTrimSubPaths`, `PxGradientType`, `PxGradientUnits`, `PxGradientSpreadMethod`, `PX_TRANSFORM_PART_KEYS` | ● named wire values. `PxTimelineEngineExtra` is what `timeline.engine` accepts (`auto` · `native` · `js`); `PxTimelineEngine` is the resolved engine (`native` · `js`), the argument of `materialiseAllInTree`, never an option |
| `FillMode`, `PlaybackDirection`, `StartOn`, `OutAction`, `PxTransformPartKey` | ● string-union **types** — no runtime value. `StartOn` omits `'programmatic'` |
| `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTrigger`, `PxKeyframe`, `PxPropertyAnimation`, `PxLoop`, `PxDefs`, `PxEffects` + one type per effect, … | ● wire types — the shapes in [SCHEMA.md](./SCHEMA.md) |
| `PxNormalisedKeyframe`, `PxAnyKeyframe` | ▪ the runtime keyframe (`t` / `v` / `e`) and the either-form union |
| `PxAnimatorOptions`, `PxAnimatorAPI`, `PxBasicAnimatorAPI`, `PxAnimatorCallbacksConfig`, `PxAnimatorConfigPatch`, `PxAnimatorConfigMergeResult`, `PxAnimatorConfigShortcuts`, `PxPlatformAdapter` | ● / ○ companion types of the calls above |
| `PxValidationResult` | ○ the result of `isPxElementFileFormatDeep` |

**Core only** — install `@pixodesk/svg-animator-core` for: the schema-version API
(`PX_PLAYER_SCHEMA_VERSION`, `convertPlayerDocument`, …), `diagnoseDocument`,
`flattenAnimatorTimeline` / `nestAnimatorTimeline`, the engine rules (`resolveTimelineEngine`, …)
and the scroll maths.

## @pixodesk/svg-animator-react

```typescript
// ● The component. `doc` is the only required prop; everything else overrides what
//   the document already says. React renders the SVG; the player drives its attributes.
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps>;

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;           // the animation document (see SCHEMA.md); no URL form
    className?: string;                   // added to the root <svg>
    style?: CSSProperties;                // set on the root <svg>

    // Playback override — one object, shaped exactly like the file's `animator` block,
    // deep-merged over it. `null` at a slot DELETES that key:
    //   config={{ timeline: { engine, frameRate, fillMode, direction,
    //                           trigger: { outAction, finishAction, scrollIntoViewThreshold } } }}
    config?: PxAnimatorConfigPatch | string;  // a JSON string is accepted too
    resetDocDefaults?: boolean;           // start from the player's defaults, `config` on top

    // Shortcuts — a shortcut wins over the same key inside `config`
    duration?: number;                    // ▸ config.timeline.duration (one iteration, ms)
    delay?: number;                       // ▸ config.timeline.delay (ms)
    iterations?: number | 'infinite';     // ▸ config.timeline.iterations
    startOn?: StartOn;                    // ▸ config.timeline.trigger.startOn ('programmatic' not accepted)

    // Control — the FIRST of these that is set picks the mode (table below)
    apiRef?: React.RefObject<ReactAnimatorApi | null>;
    autoplay?: boolean;                   // obey the document's own trigger
    progress?: number;                    // controlled: 0–1 of duration × iterations
                                          //   (one iteration when iterations is 'infinite')
    time?: number;                        // controlled: ms
    play?: boolean;                       // true: play regardless of the trigger; false: jump to the end
    pause?: boolean;                      // hold

    // Lifecycle
    onPlay?: () => void;
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;   // reached the end, or finish() was called
    onRemove?: () => void;   // the player was destroyed — unmount, or a change that re-creates it
    onStop?: () => void;     // after any of onPause / onCancel / onFinish / onRemove
}
```

| Mode | Chosen when | The document's trigger |
|---|---|---|
| imperative | `apiRef` is passed — **even together with `autoplay`** | switched off (`startOn` forced to `'programmatic'`); only the ref starts playback |
| autoplay | `autoplay` | used, after the override |
| controlled time | `progress` or `time` | switched off; the player seeks and holds |
| play / pause | `play` or `pause` | switched off; `play` plays, `pause` holds, `play={false}` jumps to the end |
| static | none of the above | switched off; nothing plays |

Changing `doc`, `className`, `style` or the mode re-creates the player.

```typescript
// ● What `apiRef.current` gives you — the web API minus `destroy` / `getRootElement` /
//   `isReady` (the component owns the element's lifetime).
interface ReactAnimatorApi {
    isPlaying(): boolean;
    play(): void; pause(): void; cancel(): void; finish(): void;
    setPlaybackRate(rate: number): void;
    getCurrentTime(): number | null;
    setCurrentTime(time: number): void;
}

// ● For a PRE-RENDERED SVG + CSS file (no JSON, no player): wraps the SVG in a
//   div and drives it by toggling class names — `px-anim-enabled` once started,
//   plus `px-anim-playing` while running. Import the .svg through SVGR and pass
//   it as children.
const PixodeskSvgCssAnimator: FC<{
    children: ReactNode;                  // the SVGR-imported SVG component
    startOn?: StartOn;                    // 'load' (default) | 'mouseOver' | 'click' | 'scrollIntoView'
                                          //   — scrollIntoView starts at 10 % visible, fixed
    outAction?: OutAction;                // 'continue' (default) | 'pause' | 'reset'
                                          //   — 'reverse' is accepted but acts as 'continue'
    className?: string;
    style?: CSSProperties;
}>;
```

Also exported: **●** `PixodeskSvgAnimatorProps`, `ReactAnimatorApi`,
`PixodeskSvgAnimatorCallbacks` (the six `on*` props as a standalone type).

## @pixodesk/svg-animator-vue

Same two components, same semantics as React; the differences are Vue-shaped.

```typescript
// ● Props: the React set, minus apiRef / className / style (a template ref and
//   Vue's attribute inheritance cover those).
const PixodeskSvgAnimator: DefineComponent<{
    doc: PxAnimatedSvgDocument;           // required
    config?: PxAnimatorConfigPatch | string;   // the whole `animator` block, deep-merged
    resetDocDefaults?: boolean;
    duration?: number; delay?: number;    // shortcuts, as in React
    iterations?: number | 'infinite';
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
    autoplay?: boolean; play?: boolean; pause?: boolean;
    progress?: number; time?: number;
}>;

// ● Events instead of callback props: @play @pause @cancel @finish @remove, and
//   @stop after any of the last four.
// ● Imperative API on a template ref (`ref="anim"` → `anim.value.play()`). The ref
//   is available in every mode and never changes the mode.
interface VueAnimatorApi {
    isPlaying(): boolean;
    play(): void; pause(): void; cancel(): void; finish(): void;
    setPlaybackRate(rate: number): void;
    getCurrentTime(): number | null;
    setCurrentTime(time: number): void;
}

// ● Pre-rendered SVG + CSS wrapper; the SVG goes in the default slot, and every
//   other attribute (class, style, …) lands on the wrapper div.
const PixodeskSvgCssAnimator: DefineComponent<{
    startOn?: StartOn;     // default 'load'
    outAction?: OutAction; // default 'continue'
}>;
```

Modes, first match wins: `autoplay` → `progress` / `time` → `play` / `pause` → static. Any change
to `doc` or to an override prop re-creates the player.

## @pixodesk/svg-animator-rn 🧪 experimental

Mirrors the React component on `react-native-svg` + `reanimated`: the document is materialised
once, sampled into per-element tracks, and played on the UI thread. No CSS-flavour component, no
`className` / `style`, no `onRemove`, and a failure path instead of a DOM.

```typescript
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps>;   // ● also the default export

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;           // required

    // Playback override — the same object as React. `timeline.engine` is accepted
    // but ignored: React Native always uses the `native` materialisation.
    config?: PxAnimatorConfigPatch | string;
    resetDocDefaults?: boolean;

    duration?: number; delay?: number;    // shortcuts, ms
    iterations?: number | 'infinite';
    startOn?: StartOn;                    // 'mouseOver' has no touch equivalent and is ignored;
                                          //   'click' = tap (a second tap applies outAction);
                                          //   'scrollIntoView' = measured every 200 ms

    autoplay?: boolean;                   // honour the document trigger. A document with no
                                          //   trigger plays on mount; a missing outAction acts
                                          //   as 'pause' (the web: nothing starts; 'continue')
    play?: boolean; pause?: boolean;      // unconditional control; play={false} jumps to the end
    progress?: number;                    // 0–1 of duration × iterations
    time?: number;                        // ms

    apiRef?: React.RefObject<RnAnimatorApi | null>;   // same methods as ReactAnimatorApi, but
                                          //   getCurrentTime() is ms within the CURRENT iteration,
                                          //   and setPlaybackRate ignores 0 and non-finite rates

    onPlay?: () => void; onStop?: () => void; onPause?: () => void;
    onCancel?: () => void; onFinish?: () => void;

    // Failure handling — a broken document renders `fallback` instead of throwing.
    // Only JavaScript failures reach this; a crash inside the native renderer does not.
    onError?: (error: Error, componentStack?: string) => void;
    fallback?: (error: Error) => ReactElement | null;
}
```

Modes, first match wins: `progress` / `time` → `play` / `pause` → `autoplay`. `apiRef` never
changes the mode.

**Everything else this package exports**

| Symbol | |
|---|---|
| `PxRnErrorBoundary` (+ `PxRnErrorBoundaryProps`) | ○ the boundary the component uses; usable on its own |
| `renderRnNode(node, opts?, key?)`, `toRnProps(props, warnings?, tag?)` | ▪ wire node → `react-native-svg` element / props |
| `compileTracks(doc, opts?)`, `sampleProps(tracks, tMs, …)` | ▪ document → per-element value tracks, sampled per frame |
| `openClosedTextPathTargets(doc, warnings?)` | ▪ works around a `textPath` crash in the native renderer |
| `RN_SVG_COMPONENTS`, `toRnPropName(name)` | ▪ tag / prop name maps |
| `RenderRnNodeOptions`, `CompileTracksOptions`, `PxCompiledTracks`, `PxElementTracks` | ▪ companion types of the above |

## @pixodesk/svg-animator-core — no DOM, shared by every player

You depend on this **directly** only to inspect or transform documents; a player
package already bundles it. Nothing here renders anything.

```typescript
// ○ Run the whole materialisation pipeline: effects → loops → motion paths →
//   <use> instances, in the canonical order. This is exactly what the player
//   runs internally, so a document flattened here plays identically — the way
//   to feed a renderer that has no effects support. `resolveTimelineEngine`
//   turns a document's `timeline.engine` into this argument.
function materialiseAllInTree(
    doc: PxAnimatedSvgDocument,
    engine: 'native' | 'js',
    opts?: { motionPath?: MotionPathMaterialisationOptions },
): PxAnimatedSvgDocument;

// ○ One stage of it: `node.effects` → plain renderable nodes (+ generated defs).
function applyPlayerEffects(root: PxNode): ApplyResult;

// ● The whole-document check: the strict wire schema (undeclared keys included)
//   plus every `effects` bucket. Returns human-readable problems (`path: what is
//   wrong`), empty when the document is sound; never throws. Every player runs the
//   same check on load and prints the problems as one console warning — call this
//   before shipping a document instead of relying on the console.
function validateDocument(doc: unknown): Array<string>;

// ○ Check every `node.effects` bucket against the schema, depth-first. Returns
//   human-readable warnings (each prefixed with the node's path) and never
//   throws; the players run this on load and log whatever comes back.
function validateNodeEffects(root: PxNode, opts?: { strict?: boolean }): Array<string>;

// ● Per-instance playback override, shared by every player. `patch` is a
//   deep-partial of the document's `animator` block; objects merge key by key,
//   values replace, and `null` DELETES a key (restoring the default its absence
//   means). Pure — the document is not modified; the result shares every
//   untouched subtree by reference. Warnings say what could not be applied
//   (e.g. clock-only keys aimed at a scroll timeline).
function applyAnimatorConfig(
    doc: PxAnimatedSvgDocument,
    patch: PxAnimatorConfigPatch,
    opts?: { resetDefaults?: boolean },   // start from the player's defaults; keeps
): { doc: PxAnimatedSvgDocument; warnings: Array<string> };   // definitions/animateById

// ○ The same merge one level down, on the config object itself.
function mergeAnimatorConfig(
    base: PxAnimatorConfig | undefined,
    patch: PxAnimatorConfigPatch,
): PxAnimatorConfigMergeResult;

// ○ Folds the four shortcuts (duration/delay/iterations/startOn) into a patch and
//   parses the JSON-string form. A shortcut wins over the same key in `config`.
//   This is what every player calls before `applyAnimatorConfig`.
function foldAnimatorConfigShortcuts(
    config: PxAnimatorConfigPatch | string | undefined,
    shortcuts: PxAnimatorConfigShortcuts,
): PxAnimatorConfigPatch | undefined;

// ○ The schema version — see docs/format/README.md#versioning.
const PX_PLAYER_SCHEMA_VERSION: string;                                   // the schema this build reads: '1.1'
function readWireVersion(doc: unknown): WireVersion | undefined;          // animator.version (or meta.animator.version)
function convertPlayerDocument(doc: unknown): PlayerConversionResult;     // up to this schema; never refuses, never mutates
function downgradePlayerDocument(doc: unknown, target: WireVersion): WireDowngradeResult;   // all or nothing

// ○ Deep-clone a document with fresh ids and internal references rewritten —
//   what you need before putting the same animation on a page twice.
function generateNewIds(doc: PxAnimatedSvgDocument): PxAnimatedSvgDocument;

// ○ Playback on a non-DOM target: implement the adapter, get the frame-loop engine.
function createBasicFrameLoopAnimator(
    doc: PxAnimatedSvgDocument,
    adapter: PxPlatformAdapter,
    callbacks?: PxAnimatorCallbacksConfig,
): PxAnimatorAPI;

interface PxPlatformAdapter {
    isConnected(): boolean;                                     // is the target still mounted
    setAttribute(id: string, attrName: string, value: string): void;
}
```

**Everything else this package exports**

| Group | Symbols | |
|---|---|---|
| Wire types | `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTimeline`, `PxTrigger`, `PxElementAnimation`, `PxPropertyAnimation`, `PxKeyframe`, `PxLoop`, `PxBinding`, `PxDefs`, `PxEffects` + one type per effect (`PxCloneEffect`, `PxRepeaterEffect`, `PxRetimeEffect`, `PxMaskedByEffect`, `PxTransformByEffect`, `PxTextPathEffect`, `PxStrokeTrimEffect`, `PxFillGradientEffect`, `PxStrokeGradientEffect`, `PxGradientStop`), `PxAttrValue`, `PxTransformValue`, `PxTransformParts`, `PxBezierPath`, `PxGlyph`, `PxGlyphFont`, `PxAnimationDefinition`, `PxTimelinePin`, `PxScroll`, `PxScrollPhase`, `PxScrollRangePoint`, `Vec2` | ● the shapes in [SCHEMA.md](./SCHEMA.md) |
| Player API types | `PxAnimatorAPI<TRoot>`, `PxBasicAnimatorAPI<TRoot>`, `PxAnimatorCallbacksConfig`, `PxPlatformAdapter` | ● platform-neutral; the web fixes `TRoot` to `Element` |
| Engine rules | `resolveTimelineEngine(engine)`, `isNativeForced(engine)`, `mayUseNativeScrollTimeline(engine)` | ○ how a `timeline.engine` resolves to an engine / to the browser's ScrollTimeline — the players' own decision helpers |
| Enum values | `PxTimelineEngineExtra`, `PxTimelineEngine`, `PxGradientType`, `PxGradientUnits`, `PxGradientSpreadMethod`, `PxLoopRepeatAt`, `PxLoopDirection`, `PxStrokeTrimSubPaths`, `PxCloneWithout` (`clone.without`: `translate`), `PX_TRANSFORM_PART_KEYS` | ● named values instead of bare strings |
| Enum types | `FillMode`, `PlaybackDirection`, `StartOn`, `OutAction`, `PxTransformPartKey` | ● string-union types, no runtime value; `StartOn` omits `'programmatic'` |
| Schema version | `PX_PLAYER_SCHEMA_VERSION`, `PLAYER_WIRE_VERSION`, `BASELINE_PLAYER_VERSION`, `PLAYER_WIRE_STEPS`, `WIRE_VERSION_KEY`, `WireVersionRelation`, `WireStepKind`, `parseWireVersion`, `formatWireVersion`, `readWireVersion`, `compareWireVersion`, `versionAdvice`, `convertPlayerDocument`, `downgradePlayerDocument`, `applyWireSteps`, `applyWireStepsDown` + `WireVersion`, `WireVersionStep`, `PlayerConversionResult`, `WireConversionConfig`, `WireDowngradeResult`, `WireDowngradeConfig` | ○ read, compare and convert a document's `animator.version` — [docs](./docs/format/README.md#versioning) |
| Schema release | `schemaFieldUniverse`, `diffFieldUniverse`, `planSchemaRelease`, `releaseLogProblems`, `SchemaReleasePlan`, `SchemaReleaseRecord` | ▪ the field inventory and bump rule behind `scripts/schema-release.mjs` |
| Diagnostics | `diagnoseDocument(doc)` → `PxDocumentDiagnosis` (`{ problems, legacy }`), `reportDocumentDiagnostics(doc, where)`, `PX_UNKNOWN_KEY_ERROR` | ▪ the load-time check every player runs; call `validateDocument` instead |
| Validation | `isPxElementFileFormat`, `isPxElementFileFormatDeep` → `PxValidationResult` | ○ a cheap "is this a Pixodesk document" gate / a pass-fail schema check without messages |
| Document accessors | `getAnimatorConfig`, `getChildren`, `getBindings`, `getDefs` | ○ read a document without knowing its internals |
| Timeline shape | `flattenAnimatorTimeline`, `nestAnimatorTimeline` | ○ nested `timeline` object ⇄ the flat runtime view |
| Playback override | `PxAnimatorConfigPatch`, `PxAnimatorConfigMergeResult`, `PxAnimatorConfigShortcuts` | ● companion types of the three merge functions above |
| Keyframe forms | `kfTime`, `kfValue`, `kfEasing`, `kfTangentIn`, `kfTangentOut`, `PxNormalisedKeyframe`, `PxNormalisedPropertyAnimation`, `PxAnyKeyframe` | ▪ read a keyframe in either its wire or its runtime (`t` / `v` / `e`) form |
| Schema toolkit | `px`, `schemaKeys`, `describeSchema` — plus one schema value per wire type: `PxAnimatedSvgDocumentSchema`, `PxNodeSchema`, `PxNodeBase`, `PxSvgNodeExtra`, `PxAnimatorConfigSchema`, `PxTimelineSchema`, `PxTimelinePinSchema`, `PxTriggerSchema`, `PxAnimationDefinitionSchema`, `PxElementAnimationSchema`, `PxPropertyAnimationSchema`, `PxKeyframeSchema`, `PxKeyframeValueSchema`, `PxAttrValueSchema`, `PxTransformValueSchema`, `PxTransformPartsSchema`, `PxBezierPathSchema`, `PxEasingOrRefSchema`, `PxLoopSchema`, `PxBindingSchema`, `PxDefsSchema`, `PxEffectsSchema`, `PxCloneEffectSchema`, `PxRepeaterEffectSchema`, `PxRetimeEffectSchema`, `PxMaskedByEffectSchema`, `PxTransformByEffectSchema`, `PxTextEffectSchema`, `PxTextPathEffectSchema`, `PxStrokeTrimEffectSchema`, `PxFillGradientEffectSchema`, `PxStrokeGradientEffectSchema`, `PxGradientStopSchema`, `PxScrollSchema`, `PxScrollRangeSchema`, `PxScrollRangePointSchema` | ○ the validator the format is written in |
| Pipeline stages | `getNormalisedBindings`, `calcAnimationValues`, `interpolateValue`, `materialiseInternalLoopsInTree`, `materialiseInternalLoopsInPropAnim`, `materialiseMotionPathsInTree`, `materialiseMotionPathInPropAnim`, `materialiseAnimatedUseInstances`, `evaluateMotionPathSegment`, `propAnimIsMotionPath`, `mergeStaticTransformIntoAnimDef` | ▪ stages of `materialiseAllInTree`; call the pipeline instead |
| Effect harness | `collectSampleTimes`, `diffInEffect`, `visualModelAt` | ▪ the editor's "equal in effect" comparison |
| Text & paths | `materialiseGlyphText`, `materialiseGlyphTextAlongPath`, `materialiseGlyphTextHorizontal`, `layoutGlyphTextChars`, `MISSING_GLYPH_CLASS_NAME`, `createPathSampler`, `extendedPathForBrowser`, `shiftAnimatable`, `jsonElementFactory` | ▪ glyph-text and text-on-path materialisation |
| Node props | `getNormalizedProps` (○), `resolveStyle`, `sanitiseAttributeValue`, `CSS_ONLY_STYLE_PROPS`, `DISALLOWED_SVG_TAGS_LOWER` | ▪ shared normalisation and sanitisation rules |
| Scroll math | `isScrollTimeline`, `scrollViewProgress`, `scrollOffsetProgress`, `scrollPhaseInterval`, `scrollResolveAxis`, `scrollTotalDurationMs` | ▪ scroll-driven playback internals |
| Maths & strings | `cubicBezier`, `subdivideCubicBezier`, `interpolateBeziers`, `bezierToSvgPath`, `splitEasing`, `reverseEasing`, `clamp`, `toRGBA`, `composeTransformParts`, `parseTransformParts`, `camelCaseToKebabWordIfNeeded`, `kebabToCamelCaseWord`, `COLOUR_ATTR_NAMES`, `STYLE_ATTR_NAMES`, `PCT_BASED_ATTR_NAMES`, `TRANSFORM_FN_NAMES`, `deepClone`, `generateUniqueId`, `DEFAULT_DURATION_MS`, `LOOP_JUMP_SHIFT_MS` | ▪ helpers shared with the editor |
| Companion types | `PxSchema`, `PxSchemaDesc`, `PxInfer`, `PxValidationContext`, `KeysMatch`, `RemoveIndex`, `MaterialiseAllOptions`, `ApplyResult`, `MotionPathMaterialisationOptions`, `MotionPathSample`, `PathPoint`, `PathSampler`, `PxCreateElement`, `GlyphCharBox`, `GlyphCharBoxAlongPath`, `GlyphMaterialiseOpts`, `ExtendPathOpts`, `ExtendedPath`, `PxAnimatable` | ▪ argument and result shapes of the functions above |
| Attribute names | `INTERNAL_ATTRS`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME`, `TEXT_ATTR`, `TEXT_CONTENT_ATTR` | ▪ reserved keys — see [SCHEMA.md](./SCHEMA.md#reserved-keys) |

## Examples

```javascript
// Plain HTML / vanilla JS
import { createAnimator } from '@pixodesk/svg-animator-web';

const anim = createAnimator({ src: '/bouncing-ball.json', container: '#stage' });
anim.play();
anim.setPlaybackRate(2);
anim.setCurrentTime(500);
```

```html
<!-- No bundler: the UMD build -->
<script src="pixodesk-svg-animator.umd.min.js"></script>
<div id="stage" style="width: 300px; height: 300px"></div>
<div data-px-animation-src="/logo.json" style="width: 120px; height: 120px"></div>
<script>
  PixodeskAnimator.createAnimator({ src: '/bouncing-ball.json', container: '#stage' });
  PixodeskAnimator.loadTagAnimators();   // every [data-px-animation-src] element
</script>
```

```jsx
// React — autoplay, retuned for this mount
import { useRef } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import doc from './bouncing-ball.json';

<PixodeskSvgAnimator doc={doc} autoplay startOn="mouseOver"
  config={{ timeline: { trigger: { outAction: 'pause' } } }} />

// React — imperative: the ref alone starts playback (the document's trigger is switched
// off, and `autoplay` next to `apiRef` would be ignored)
const api = useRef(null);
<PixodeskSvgAnimator doc={doc} apiRef={api} />
<button onClick={() => api.current?.play()}>Play</button>
```

```vue
<!-- Vue — controlled time, no player API needed -->
<PixodeskSvgAnimator :doc="doc" :progress="scrollFraction" @finish="done = true" />
```

```javascript
// Check a generated document before it ships
import { validateDocument } from '@pixodesk/svg-animator-web';

const problems = validateDocument(doc);   // [] when the document is sound
if (problems.length) throw new Error(problems.join('\n'));
```

```javascript
// Two copies of one animation on a page (ids must stay unique)
import { createAnimator, generateNewIds } from '@pixodesk/svg-animator-web';

createAnimator({ data: doc, container: '#first' });
createAnimator({ data: generateNewIds(doc), container: '#second' });
```
