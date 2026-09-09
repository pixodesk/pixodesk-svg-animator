# Pixodesk SVG Animator — the public API, the compact reference

Every symbol the five packages export, marked by audience — with full signatures
for the ones you actually use to put an animation in a product. For the file
format see [SCHEMA.md](./SCHEMA.md); for prose and guides see
[README.md](./README.md#documentation).

| | Meaning |
|---|---|
| **●** | **User-facing** — the API for playing an animation in your page or app. Documented in full below. |
| **○** | **Advanced** — document tooling: inspect, transform or validate a document outside a player. Stable, rarely needed. |
| **▪** | **Internal** — exported so the Pixodesk editor (and the sibling packages) stay in lockstep with the player. Not part of the supported surface; may change without notice. |

Which package: **web** for plain HTML/JS · **react** / **vue** for those
frameworks · **rn** for React Native 🧪 · **core** only to inspect or transform
documents yourself. A pre-rendered `.svg` file needs no package at all.

## @pixodesk/svg-animator-web — the browser player

```typescript
// ● Create a player. Provide either `src` or `data`, never both (throws).
//   With `src`, control calls made before the fetch resolves are queued and
//   replayed in order, so `createAnimator({ src }).play()` works as written.
function createAnimator(options: PxAnimatorOptions): PxAnimatorAPI;

interface PxAnimatorOptions {
    src?: string;                          // URL to fetch the JSON document from
    data?: PxAnimatedSvgDocument;          // …or the document inline (see SCHEMA.md)
    container?: string | Element;          // CSS selector or element to render into
    callbacks?: PxAnimatorCallbacksConfig; // lifecycle callbacks
    adapter?: PxPlatformAdapter;           // custom render target; omit for the DOM

    // -- Per-instance playback override; the document is never modified -------
    config?: PxAnimatorConfigPatch | string; // deep-merged over the document's `animator`
                                           //   block — same shape as the file. `null` at a
                                           //   slot DELETES that key. A JSON string is also
                                           //   accepted (survives property mangling).
    resetDocDefaults?: boolean;            // start from the player's defaults, `config` on top
    duration?: number;                     // ▸ config.timeline.duration
    delay?: number;                        // ▸ config.timeline.delay
    iterations?: number | 'infinite';      // ▸ config.timeline.iterations
    startOn?: StartOn;                     // ▸ config.timeline.trigger.startOn
                                           //   a shortcut wins over the same key in `config`
}

// ● Playback control returned by `createAnimator`.
interface PxAnimatorAPI extends PxBasicAnimatorAPI {
    finish(): void;                        // jump to the end and hold the final state
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, -1 reverse
    getCurrentTime(): number | null;       // ms; null before the document is ready
    setCurrentTime(time: number): void;    // seek, ms
    destroy(): void;                       // stop and release everything
}

interface PxBasicAnimatorAPI {            // ● the subset the frames engine guarantees
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
    onFinish?: () => void;  // reached the end on its own
    onRemove?: () => void;  // the animation was removed
}

// ● Scan the page for `<div data-px-animation-src="animation.json">` and create
//   one player per match, storing it on the element. Safe to call repeatedly:
//   elements that already carry a player are skipped.
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
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse'; // when the trigger ends; default 'continue'
    scrollIntoViewThreshold?: number;                  // 0–1 visible ratio; default 0
}
```

The UMD build publishes a **narrower** surface on one global, `window.PixodeskAnimator` — it is
built from its own entry, for embedding in a page rather than for tooling. Exactly eleven names:
`createAnimator`, `createAnimatorImpl`, `loadTagAnimators`, `setupAnimationTriggers`,
`validateDocument`, `generateNewIds`, `PxPlaybackMode`, `PxAnimatorEngine`,
`PX_ANIMATOR_DATA_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME`. Everything else listed on
this page — the schemas, the pipeline stages, the maths helpers — is reachable only through the
ESM/CJS entry.

One other thing reaches `window`: a document with `animator.debugGlobalName: "heroBanner"`
makes the player assign its API object to `window.heroBanner`, so a live instance can be driven
from the console. It is opt-in per document — see
[Playback & triggers → Debug handle](./docs/library/playback-and-triggers.md#debug-handle--debugglobalname).

**Everything else this package exports**

| Symbol | |
|---|---|
| `createAnimatorImpl(doc, adapter?, callbacks?, container?, config?, resetDocDefaults?)` | ▪ the non-fetching core of `createAnimator`; the last two are the playback override |
| `createWebApiAnimator(…)`, `createFrameLoopAnimator(…)` | ▪ the two engines; `createAnimator` picks one via `timeline.mode` |
| `createBasicFrameLoopAnimator(doc, adapter, callbacks?)` | ○ frames engine against a custom `PxPlatformAdapter` |
| `renderNode(node, defs?)`, `getNormalizedProps(props)` | ○ render one wire node to a DOM element / resolve a node's attributes |
| `validateDocument(doc)` | ● the whole-document check for tooling / CI / agents — returns problems as strings, empty when sound, never throws |
| `materialiseAllInTree`, `applyPlayerEffects`, `validateNodeEffects`, `generateNewIds` | ○ document tooling — see **core** below |
| `applyAnimatorConfig`, `mergeAnimatorConfig`, `foldAnimatorConfigShortcuts` | ● the playback-override merge behind the `config` option — call it yourself when you build the document elsewhere; re-exported from core |
| `normalizeDocument` (alias of core `getNormalisedBindings`), `calcAnimationValues`, `materialiseInternalLoops*`, `materialiseMotionPath*`, `materialiseAnimatedUseInstances`, `evaluateMotionPathSegment`, `propAnimIsMotionPath`, `collectSampleTimes`, `diffInEffect`, `visualModelAt` | ▪ pipeline stages, re-exported from core |
| `PX_ANIMATOR_DATA_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME` | ▪ attribute/property names the player writes |
| `px`, `schemaKeys`, `describeSchema`, all `Px*Schema` values, glyph/path helpers, string & colour utils | ▪/○ re-exported from core, same marks as there |
| `PxPlaybackMode`, `FillMode`, `PlaybackDirection`, `StartOn`, `OutAction`, `PxCloneWithout`, `PxLoopRepeatAt`, `PxLoopDirection`, `PxStrokeTrimSubPaths`, `PxGradientType`, `PxGradientUnits`, `PxGradientSpreadMethod` | ● the enums used by the options and props above, plus every wire selector re-exported from core (`PxPlaybackMode` = `timeline.mode`: `auto` · `native` · `player`) |
| `PxAnimatorEngine` | ○ the resolved engine (`waapi` · `frames`) — the argument of `materialiseAllInTree`, never an option |
| `PxAnimatedSvgDocument`, `PxNode`, `PxAnimatorConfig`, `PxTrigger`, `PxEffects`, … | ● wire types — the shapes in [SCHEMA.md](./SCHEMA.md) |

## @pixodesk/svg-animator-react

```typescript
// ● The component. `doc` is the only required prop; everything else overrides
//   what the document already says.
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps>;

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;      // the animation document (see SCHEMA.md)
    className?: string;
    style?: CSSProperties;

    // Playback override — one object, shaped exactly like the file's `animator`
    // block, deep-merged over it. `null` at a slot DELETES that key. Everything
    // that used to be its own prop lives here:
    //   config={{ timeline: { mode, frameRate, fillMode, direction,
    //                           trigger: { outAction, scrollIntoViewThreshold } } }}
    config?: PxAnimatorConfigPatch | string;  // a JSON string is accepted too
    resetDocDefaults?: boolean;           // start from the player's defaults, `config` on top

    // Shortcuts — a shortcut wins over the same key inside `config`
    duration?: number;                    // ▸ config.timeline.duration (one iteration, ms)
    delay?: number;                       // ▸ config.timeline.delay
    iterations?: number | 'infinite';     // ▸ config.timeline.iterations
    startOn?: StartOn;                    // ▸ config.timeline.trigger.startOn

    // Declarative control — pick ONE of these three styles
    autoplay?: boolean;                   // obey the document's own trigger
    play?: boolean;                       // start regardless of the trigger
    pause?: boolean;                      // hold; only with `play` or `autoplay`
    progress?: number;                    // controlled: 0–1 of duration × iterations
    time?: number;                        // controlled: ms

    // Imperative control
    apiRef?: React.RefObject<ReactAnimatorApi | null>;

    // Lifecycle
    onPlay?: () => void;
    onStop?: () => void;    // stopped for any reason: pause, cancel, finish, removal
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;
    onRemove?: () => void;
}

// ● What `apiRef.current` gives you — the web API minus `destroy`/`getRootElement`
//   (the component owns the element's lifetime).
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
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView';  // default 'load'
    outAction?: OutAction;                // 'continue' (default) | 'pause' | 'reset'
                                          // — 'reverse' is accepted but acts as 'continue'
    className?: string;
    style?: CSSProperties;
}>;
```

Also exported: **●** `PixodeskSvgAnimatorProps`, `ReactAnimatorApi`,
`PixodeskSvgAnimatorCallbacks` (the six `on*` props as a standalone type).

## @pixodesk/svg-animator-vue

Same two components, same semantics as React; the differences are Vue-shaped.

```typescript
// ● Props: identical set and defaults to the React component above, except
//   there is no apiRef/className/style (a template ref and Vue's attribute
//   inheritance cover those).
const PixodeskSvgAnimator: DefineComponent<{
    doc: PxAnimatedSvgDocument;           // required
    config?: PxAnimatorConfigPatch | string;   // the whole `animator` block, deep-merged
    resetDocDefaults?: boolean;
    duration?: number; delay?: number;    // shortcuts, as in React
    iterations?: number | 'infinite';
    startOn?: StartOn;
    autoplay?: boolean; play?: boolean; pause?: boolean;
    progress?: number; time?: number;
}>;

// ● Events instead of callback props: @play @stop @pause @cancel @finish @remove
// ● Imperative API on a template ref (`ref="anim"` → `anim.value.play()`):
interface VueAnimatorApi {
    isPlaying(): boolean;
    play(): void; pause(): void; cancel(): void; finish(): void;
    setPlaybackRate(rate: number): void;
    getCurrentTime(): number | null;
    setCurrentTime(time: number): void;
}

// ● Pre-rendered SVG + CSS wrapper; the SVG goes in the default slot.
const PixodeskSvgCssAnimator: DefineComponent<{
    startOn?: StartOn;     // default 'load'
    outAction?: OutAction; // default 'continue'
}>;
```

## @pixodesk/svg-animator-rn 🧪 experimental

Mirrors the React component on `react-native-svg` + `reanimated`. One
frame-driven engine (`timeline.mode` is ignored), no CSS-flavour component, no
`onRemove`, and a failure path instead of a DOM.

```typescript
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps>;   // ● also the default export

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;           // required

    // Playback override — the same object as React. `timeline.mode` is accepted
    // but ignored: React Native always materialises the WAAPI-style flattening.
    config?: PxAnimatorConfigPatch | string;
    resetDocDefaults?: boolean;

    duration?: number; delay?: number;    // shortcuts, ms
    iterations?: number | 'infinite';
    startOn?: StartOn;                    // 'mouseOver' has no touch equivalent and is ignored

    autoplay?: boolean;                   // honour the document trigger
    play?: boolean; pause?: boolean;      // unconditional control
    progress?: number;                    // 0–1 of duration × iterations
    time?: number;                        // ms

    apiRef?: React.RefObject<RnAnimatorApi | null>;   // same methods as ReactAnimatorApi

    onPlay?: () => void; onStop?: () => void; onPause?: () => void;
    onCancel?: () => void; onFinish?: () => void;

    // Failure handling — a broken document renders `fallback` instead of throwing.
    // Only JavaScript failures reach this; a crash inside the native renderer does not.
    onError?: (error: Error, componentStack?: string) => void;
    fallback?: (error: Error) => ReactElement | null;
}
```

**Everything else this package exports**

| Symbol | |
|---|---|
| `PxRnErrorBoundary` (+ `PxRnErrorBoundaryProps`) | ○ the boundary the component uses; usable on its own |
| `renderRnNode(node, opts?, key?)`, `toRnProps(props, warnings?, tag?)` | ▪ wire node → `react-native-svg` element / props |
| `compileTracks(doc, opts?)`, `sampleProps(tracks, tMs, …)` | ▪ document → per-element value tracks, sampled per frame |
| `openClosedTextPathTargets(doc, warnings?)` | ▪ works around a `textPath` limitation in the native renderer |
| `RN_SVG_COMPONENTS`, `toRnPropName(name)` | ▪ tag/prop name maps |
| `RenderRnNodeOptions`, `CompileTracksOptions`, `PxCompiledTracks`, `PxElementTracks` | ▪ companion types of the above |

## @pixodesk/svg-animator-core — no DOM, shared by every player

You depend on this **directly** only to inspect or transform documents; a player
package already bundles it. Nothing here renders anything.

```typescript
// ○ Run the whole materialisation pipeline: effects → loops → motion paths →
//   <use> instances, in the canonical order. This is exactly what the player
//   runs internally, so a document flattened here plays identically — the way
//   to feed a renderer that has no effects support.
function materialiseAllInTree(
    doc: PxAnimatedSvgDocument,
    engine: 'waapi' | 'frames',
    opts?: { motionPath?: MotionPathMaterialisationOptions },
): PxAnimatedSvgDocument;

// ○ One stage of it: `node.effects` → plain renderable nodes (+ generated defs).
function applyPlayerEffects(root: PxNode): ApplyResult;

// ● The whole-document check: the strict wire schema (undeclared keys included)
//   plus every `effects` bucket. Returns human-readable problems (`path: what is
//   wrong`), empty when the document is sound; never throws. The player itself
//   only warns and skips what it cannot read — call this before shipping a document.
function validateDocument(doc: unknown): Array<string>;

// ○ Check every `node.effects` bucket against the schema, depth-first. Returns
//   human-readable warnings (each prefixed with the node's path) and never
//   throws; the player runs this on load and logs whatever comes back.
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

// ○ Deep-clone a document with fresh ids and internal references rewritten —
//   what you need before putting the same animation on a page twice.
function generateNewIds(doc: PxAnimatedSvgDocument): PxAnimatedSvgDocument;

// ○ Playback on a non-DOM target: implement the adapter, get the frames engine.
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
| Wire types | `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTimeline`, `PxTrigger`, `PxElementAnimation`, `PxPropertyAnimation`, `PxKeyframe`, `PxLoop`, `PxBinding`, `PxDefs`, `PxEffects` + one type per effect (`PxCloneEffect`, `PxRepeaterEffect`, `PxRetimeEffect`, `PxMaskedByEffect`, `PxTransformByEffect`, `PxTextPathEffect`, `PxStrokeTrimEffect`, `PxFillGradientEffect`, `PxStrokeGradientEffect`, `PxGradientStop`), `PxAttrValue`, `PxTransformValue`, `PxTransformParts`, `PxBezierPath`, `PxGlyph`, `PxGlyphFont`, `PxAnimationDefinition`, `PxTimelinePin`, `PxScroll`, `PxScrollPhase`, `PxScrollRangePoint`, `PxValidationResult`, `Vec2` | ● the shapes in [SCHEMA.md](./SCHEMA.md) |
| Playback-mode rules | `engineForPlaybackMode(mode)`, `isNativeForced(mode)`, `mayUseNativeScrollTimeline(mode)` | ○ how a `timeline.mode` resolves to an engine / the browser's ScrollTimeline — the players' own decision helpers |
| Enums | `PxPlaybackMode`, `PxAnimatorEngine`, `FillMode`, `PlaybackDirection`, `StartOn`, `OutAction`, `PxGradientType`, `PxGradientUnits`, `PxGradientSpreadMethod`, `PxLoopRepeatAt`, `PxLoopDirection`, `PxStrokeTrimSubPaths`, `PxCloneWithout` (`clone.without`: `translate`), `PxTransformPartKey`, `PX_TRANSFORM_PART_KEYS` | ● named values instead of bare strings |
| Document accessors | `getAnimatorConfig`, `getChildren`, `getBindings`, `getDefs`, `isPxElementFileFormat`, `isPxElementFileFormatDeep` | ○ read a document without knowing its internals |
| Timeline shape | `flattenAnimatorTimeline`, `nestAnimatorTimeline` | ○ nested `timeline` object ⇄ the flat runtime view |
| Playback override | `PxAnimatorConfigPatch`, `PxAnimatorConfigMergeResult`, `PxAnimatorConfigShortcuts` | ● companion types of the three merge functions above |
| Schema toolkit | `px`, `schemaKeys`, `describeSchema` — plus one schema value per wire type: `PxAnimatedSvgDocumentSchema`, `PxNodeSchema`, `PxNodeBase`, `PxSvgNodeExtra`, `PxAnimatorConfigSchema`, `PxTimelineSchema`, `PxTimelinePinSchema`, `PxTriggerSchema`, `PxAnimationDefinitionSchema`, `PxElementAnimationSchema`, `PxPropertyAnimationSchema`, `PxKeyframeSchema`, `PxKeyframeValueSchema`, `PxAttrValueSchema`, `PxTransformValueSchema`, `PxTransformPartsSchema`, `PxBezierPathSchema`, `PxEasingOrRefSchema`, `PxLoopSchema`, `PxBindingSchema`, `PxDefsSchema`, `PxEffectsSchema`, `PxCloneEffectSchema`, `PxRepeaterEffectSchema`, `PxRetimeEffectSchema`, `PxMaskedByEffectSchema`, `PxTransformByEffectSchema`, `PxTextEffectSchema`, `PxTextPathEffectSchema`, `PxStrokeTrimEffectSchema`, `PxFillGradientEffectSchema`, `PxStrokeGradientEffectSchema`, `PxGradientStopSchema`, `PxScrollSchema`, `PxScrollRangeSchema`, `PxScrollRangePointSchema` | ○ the validator the format is written in |
| Pipeline stages | `getNormalisedBindings`, `calcAnimationValues`, `interpolateValue`, `materialiseInternalLoopsInTree`, `materialiseInternalLoopsInPropAnim`, `materialiseMotionPathsInTree`, `materialiseMotionPathInPropAnim`, `materialiseAnimatedUseInstances`, `evaluateMotionPathSegment`, `propAnimIsMotionPath`, `mergeStaticTransformIntoAnimDef` | ▪ stages of `materialiseAllInTree`; call the pipeline instead |
| Effect harness | `collectSampleTimes`, `diffInEffect`, `visualModelAt` | ▪ the editor's "equal in effect" comparison |
| Text & paths | `materialiseGlyphText`, `materialiseGlyphTextAlongPath`, `materialiseGlyphTextHorizontal`, `layoutGlyphTextChars`, `MISSING_GLYPH_CLASS_NAME`, `createPathSampler`, `extendedPathForBrowser`, `shiftAnimatable`, `jsonElementFactory` | ▪ glyph-text and text-on-path materialisation |
| Node props | `getNormalizedProps`, `resolveStyle`, `sanitiseAttributeValue`, `CSS_ONLY_STYLE_PROPS`, `DISALLOWED_SVG_TAGS_LOWER` | ▪ shared normalisation and sanitisation rules |
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

```jsx
// React — declarative, then imperative
import { useRef } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import doc from './bouncing-ball.json';

const api = useRef(null);

// `autoplay` honours the file's trigger; the override retunes it for this mount.
// (With `apiRef` but WITHOUT `autoplay` the component takes the trigger over and
//  forces `startOn: 'programmatic'`, so a `startOn` there would be discarded.)
<PixodeskSvgAnimator doc={doc} autoplay startOn="mouseOver"
  config={{ timeline: { trigger: { outAction: 'pause' } } }} apiRef={api} />
<button onClick={() => api.current?.finish()}>Skip</button>
```

```vue
<!-- Vue — controlled time, no player API needed -->
<PixodeskSvgAnimator :doc="doc" :progress="scrollFraction" @finish="done = true" />
```

```javascript
// Two copies of one animation on a page (ids must stay unique)
import { createAnimator, generateNewIds } from '@pixodesk/svg-animator-web';

createAnimator({ data: doc, container: '#first' });
createAnimator({ data: generateNewIds(doc), container: '#second' });
```
