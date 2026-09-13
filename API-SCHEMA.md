# Pixodesk SVG Animator — the public API, the compact reference

Every symbol the five packages export, marked by audience — with full signatures
for the ones you actually use to put an animation in a product. For the file
format see [SCHEMA.md](./SCHEMA.md); for prose and guides see
[README.md](./README.md#documentation). Checked against the source on 2026-09-12
(player schema `1.1`).

<!-- px-check off the ●/○/▪ legend -->
| | Meaning |
|---|---|
| **●** | **User-facing** — the API for playing an animation in your page or app. Documented in full below. |
| **○** | **Advanced** — document tooling: inspect, transform or validate a document outside a player. Stable, rarely needed. |
| **▪** | **Internal** — exported so the Pixodesk editor (and the sibling packages) stay in lockstep with the player. Not part of the supported surface; may change without notice. |

Each mark mirrors the release tag on the declaration itself — `@public`, `@public @advanced`,
`@internal` — which is what your IDE shows on hover. The two cannot drift: `docs-check` fails when
a mark here disagrees with the code, when an export carries no tag at all, when something `@public`
is explained in no guide, or when something `@internal` is taught in one.

Which package: **web** for plain HTML/JS · **react** / **vue** for those
frameworks · **rn** for React Native 🧪 · **core** only to inspect or transform
documents yourself. A pre-rendered `.svg` file needs no package at all.

<!-- px-check off quick-start jobs, prose -->
| Job | Call |
|---|---|
| Play a JSON file in a page | `createAnimator({ src, container })` (web) |
| Play it in React / Vue | `<PixodeskSvgAnimator :doc … />` |
| Play it in React Native | `<PixodeskSvgAnimator doc={…} />` (rn) |
| Check a generated document before shipping it | `validateDocument(doc)` |
| Put one animation on a page twice | `generateNewIds(doc)` for the second copy |
| Feed a renderer of your own | `materializeAllInTree(doc, 'native')` (core) |

## Props and options across players

Every way to create a player, side by side — so a prop added or renamed in one place can be
checked against the others. A cell is **✓** when that surface takes the name as is, shows the
spelling when it differs, and is **—** when the surface does not have it. Update this table with
every prop or option change.

<!-- px-check matrix web=web:PxAnimatorOptions tag=~ prerendered=web:PxPrerenderedAnimatorOptions react=react:PixodeskSvgAnimatorProps vue=vue:PixodeskSvgAnimator rn=rn:PixodeskSvgAnimatorProps -->
| Name | Web `createAnimator` | HTML tag (`loadTagAnimators`) | Pre-rendered `createAnimator` | React | Vue | React Native | Notes |
|---|---|---|---|---|---|---|---|
| **Document** | | | | | | | |
| `src` | ✓ URL | `data-px-animation-src` | — | — | — | — | a URL to fetch the document from; the components take the document itself |
| `doc` | ✓ | — | ✓ required¹ | ✓ required | ✓ required | ✓ required | the document, inline — one name on every surface. On the web it also crosses the mangling boundary as a string key: the editor writes `createAnimator({"doc": …})` into every exported SVG+JS (`PX_ANIMATOR_DOC_KEY`), so the key is part of the export format |
| `container` | ✓ selector or `Element` | the tagged element | — | — | — | — | omitted: animate an SVG already in the page |
| **Playback override** | | | | | | | |
| `timeline` | ✓ object or JSON string | — | — | ✓ | ✓ | ✓ | React Native ignores `timeline.engine` |
| `resetTimeline` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `duration` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `delay` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `iterations` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `startOn` | ✓ 5 values | — | — | ✓ 5 values | ✓ 5 values | ✓ 5 values | every player surface takes `PxStartOn` (all 5); React Native ignores `'mouseOver'` |
| **Autoplay control** — the document's own trigger | | | | | | | |
| `autoplay` | — | — | — | ✓ | ✓ | ✓ | the web player and the HTML tag are always in this mode: they follow the document's trigger |
| **Declarative control** — your state drives it | | | | | | | |
| `play` | — | — | — | ✓ | ✓ | ✓ | `false` holds where it is (it used to jump to the end — review §8) |
| `pause` | — | — | — | ✓ | ✓ | ✓ | hold the current frame; `false` again resumes |
| `progress` | — | — | — | ✓ | ✓ | ✓ | show the frame at 0–1 of the whole run — of ONE iteration when `iterations` is `'infinite'` |
| `time` | — | — | — | ✓ | ✓ | ✓ | show the frame at this ms from the start of the whole run |
| **Imperative control** — you call it | | | | | | | |
| `apiRef` | the returned `PxAnimatorApi` | `element._px_animator` | the returned `PxAnimatorApi` | ✓ — mode unchanged | template ref (`VueAnimatorApi`) | ✓ — mode unchanged | the imperative handle; never picks a mode on any surface | <!-- px web=~ tag=~ prerendered=~ vue=~ -->
| **Callbacks** | | | | | | | |
| `onPlay` | ✓ | — | ✓ | ✓ | `@play` | ✓ | |
| `onPause` | ✓ | — | ✓ | ✓ | `@pause` | ✓ | |
| `onCancel` | ✓ | — | ✓ | ✓ | `@cancel` | ✓ | |
| `onFinish` | ✓ | — | ✓ | ✓ | `@finish` | ✓ | |
| `onRemove` | ✓ | — | ✓ | ✓ | `@remove` | ✓ | the animator was thrown away: `destroy()`, unmount, or a new `doc` |
| `onStop` | ✓ | — | ✓ | ✓ | `@stop` | ✓ | after any of pause / cancel / finish / remove |
| `onError` | ✓ | — | ✓ | ✓ | ✓ | ✓ | THIS INSTANCE WILL NOT PLAY — the document failed to load, parse or build, or the render threw: nothing rendered, `isReady()` false, `fallback` shown. Falls back to `console.error` |
| `onWarn` | ✓ | — | ✓ | ✓ | ✓ | ✓ | IT PLAYS, but something was ignored, degraded or misspelled. Falls back to `console.warn` |
| `muteWarn` | ✓ | — | ✓ | ✓ | ✓ | ✓ | switch the `console.warn` fallback off — for a host that knows the player has something to say about this document and tolerates it. A handler you passed still fires: mute is about the console, not about you |
| `muteError` | ✓ | — | ✓ | ✓ | ✓ | ✓ | the same switch for the `console.error` fallback |
| `fallback` | — | — | — | — | — | ✓ | renders in place of the animation after a failure |
| **Styling** | | | | | | | |
| `className` | — | — | — | ✓ on the root `<svg>` | `class`, falls through to the root `<svg>` | — | web: style the container | <!-- px vue=~ -->
| `style` | — | — | — | ✓ on the root `<svg>` | `style`, falls through to the root `<svg>` | — | | <!-- px vue=~ -->

¹ Only `animator.definitions` and `animator.bindings` — the SVG is already in the page.

On the components the three control groups are ONE choice: the highest-priority group that is set
wins — `progress` / `time` → `play` / `pause` → `autoplay` — and a losing group warns (review
§7). `apiRef` stands outside that choice: filled in every mode, never picking one.

Callbacks are ONE shape everywhere — the names above, inline: `createAnimator({ onFinish })` on the
web, props on React and React Native. Vue takes the lifecycle ones as events (`@play`) and the
diagnostics ones (`onWarn` / `onError` / `muteWarn` / `muteError`) as props — props rather than events because an
event handler always exists, which would have silenced the console fallback for anyone who never
subscribed. `PxAnimatorCallbacks` in core is that one shape.

The two pre-rendered SVG + CSS wrappers, which toggle class names instead of creating a player:

<!-- px-check matrix react=react:PixodeskSvgCssAnimator vue=vue:PixodeskSvgCssAnimator -->
| Name | React `PixodeskSvgCssAnimator` | Vue `PixodeskSvgCssAnimator` |
|---|---|---|
| the SVG | `children` | default slot | <!-- px name=children vue=~ -->
| `startOn` | `PxStartOn`, default `'load'` — implements 4; `'programmatic'` does nothing (no `play()` here) | ✓ same |
| `outAction` | ✓ default `'continue'`; `'reverse'` acts as `'continue'` | ✓ same |
| `scrollIntoViewThreshold` | ✓ 0–1 of the SVG that must be visible before `'scrollIntoView'` starts; default 0, the wire default (review §13) | ✓ same |
| `className` | ✓ on the wrapper div | `class`, on the wrapper div | <!-- px vue=~ -->
| `style` | ✓ on the wrapper div | ✓ on the wrapper div | <!-- px vue=~ -->

## @pixodesk/svg-animator-web — the browser player

<!-- px-check signature pkg=web -->
```typescript
// ● Create a player. Provide exactly one of `src` / `doc` — both, or neither, throws.
//   With `src`, control calls made before the fetch resolves are queued and replayed
//   in order, so `createAnimator({ src }).play()` works as written. A failed fetch or an
//   invalid document reaches `onError` — and `console.error` when no handler is
//   given (review §5); `isReady()` stays false either way.
function createAnimator(options: PxAnimatorOptions): PxAnimatorApi;

interface PxAnimatorOptions {
    src?: string;                          // URL to fetch the JSON document from
    doc?: PxAnimatedSvgDocument;           // …or the document inline (see SCHEMA.md)
    container?: string | Element;          // CSS selector or element to render into (its content is
                                           //   replaced). Omit it to animate an SVG already in the
                                           //   page, found by the document's `id`

    // -- Callbacks, inline: `PxAnimatorCallbacks`, the names every component takes ---
    onPlay?: () => void;    onPause?: () => void;    onCancel?: () => void;
    onFinish?: () => void;  onRemove?: () => void;   onStop?: () => void;   // detailed below
    onWarn?: (d: PxDiagnostic) => void;    // diagnostics — see the interface below
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean;  muteError?: boolean;

    // -- Per-instance playback override: `PxPlaybackOverride`; the document is never modified
    timeline?: PxTimelinePatch | string;   // deep-merged over the document's `timeline`
                                           //   block — same shape as the file. `null` at a
                                           //   slot DELETES that key. A JSON string is also
                                           //   accepted (survives property mangling).
    resetTimeline?: boolean;               // start from the player's defaults, `timeline` on top
    duration?: number;                     // ▸ timeline.duration (ms)
    delay?: number;                        // ▸ timeline.delay (ms)
    iterations?: number | 'infinite';      // ▸ timeline.iterations
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
                                           // ▸ timeline.trigger.startOn
                                           //   a shortcut wins over the same key in `timeline`
}

// ● Playback control returned by `createAnimator` — core's `PxAnimatorApi<Element>`.
interface PxAnimatorApi extends PxPlaybackApi {
    finish(): void;                        // jump to the end and hold the final state; fires onFinish
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, negative plays backwards
                                           //   every engine rejects 0 and non-finite rates with a
                                           //   warning — use pause()
    getCurrentTime(): number | null;       // ms from the start of the whole run; null before ready
    setCurrentTime(time: number): void;    // seek, ms; clamped to [0, duration × iterations]
    getCurrentProgress(): number | null;   // 0–1 of the whole run; null before ready
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run (clamped)
    destroy(): void;                       // stop, remove the SVG it rendered, fire onRemove
}

// ● The platform-neutral base from core; the web fixes the root type to `Element`.
interface PxPlaybackApi {
    isReady(): boolean;                    // false until a fetched document has loaded
    getRootElement(): Element | null;      // the rendered <svg>
    isPlaying(): boolean;
    play(): void;                          // start, or resume after pause
    pause(): void;                         // hold the current frame
    cancel(): void;                        // stop and reset to the first frame
}

// ● Every lifecycle callback is optional and takes no arguments. ONE shape on every surface:
//   `createAnimator` takes these inline, the components as props (Vue: events). One chain,
//   three levels, each extending the one above (API-SURFACE-REVIEW.md §26.1): `PxDiagnosticsConfig` (the four
//   diagnostics fields — what `createDiagnostics` reads) → `PxEngineCallbacks` (+ the lifecycle;
//   what an engine such as `createAdapterAnimator` takes) → `PxAnimatorCallbacks`
//   (+ `onStop`; what every public surface takes).
interface PxAnimatorCallbacks {
    onPlay?: () => void;    // started or resumed
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;  // reached the end, or finish() was called
    onRemove?: () => void;  // destroy() was called
    onStop?: () => void;    // after any of pause / cancel / finish / remove

    // Diagnostics — two severities, one meaning each, on every player (review §25.1). Neither
    // ever throws at the caller. Give a handler and it takes over from the console; give none
    // and the console is the fallback, so nothing is lost by default.
    onWarn?: (d: PxDiagnostic) => void;  // IT PLAYS, but something was ignored, degraded or
                                         //   misspelled; else console.warn
    onError?: (d: PxDiagnostic) => void; // THIS INSTANCE WILL NOT PLAY: failed to load, parse or
                                         //   build, or the render threw — nothing rendered,
                                         //   isReady() false, a component shows its fallback;
                                         //   d.error is the Error; else console.error
    muteWarn?: boolean;                  // switch the console.warn fallback off — for a host that
                                         //   knows the player has something to say about this
                                         //   document and tolerates it. A handler you passed
                                         //   still fires: mute is about the console, not you
    muteError?: boolean;                 // the same switch for console.error
}

// ● Every diagnostic says WHO can act on it, so a host can route rather than just log.
interface PxDiagnostic {
    kind: PxDiagnosticKind;   // 'document' | 'host' | 'platform' | 'usage' | 'internal'
    message: string;          // never carries the console prefix
    detail?: unknown;         // the offending binding, the element map, the raw error
    error?: Error;            // errors only
}

const PxDiagnosticKind = {
    document: 'document',   // the file is wrong — regenerate or repair it
    host:     'host',       // the page/app cannot provide what the file asks — fix the mount
    platform: 'platform',   // the browser/renderer cannot do it; the player degraded
    usage:    'usage',      // the options or props you passed are wrong or conflicting
    internal: 'internal',   // the player failed where it did not expect to — report it
};

// ● Scan the page for `<div data-px-animation-src="animation.json">` and create one
//   player per match, rendered into that element and stored on it. Safe to call
//   repeatedly: elements that already carry a player are skipped. Nothing calls it for
//   you. `options` — everything `createAnimator` takes except `src` / `doc` /
//   `container` — applies to EVERY player this call creates; omit it for zero-config.
function loadTagAnimators(options?: PxTagAnimatorOptions): void;

// ● Wire a player to a DOM trigger. `createAnimator` already does this from the
//   document's own `animator.timeline.trigger`, and ties the disposer to `destroy()`.
//   Use it after you have replaced the rendered SVG yourself (the player's listeners went
//   with the old elements). To change the trigger, use `timeline`. Returns a DISPOSER that
//   detaches everything this call attached (review §14) — call it before re-arming an
//   element you wired by hand, or the old listeners stay live next to the new ones.
//   Reads `startOn` / `outAction` / `scrollIntoViewThreshold`; `finishAction` is the
//   player's, not the trigger wiring's.
function setupAnimationTriggers(api: PxAnimatorApi, trigger: PxTrigger,
                                diag?: PxDiagnostics): () => void;
//   `diag` is optional: omit it and anything this has to say goes to the console.

interface PxTrigger {                                  // ● also a wire type — see SCHEMA.md
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
                                                       // default 'load'; 'programmatic' waits for play()
    outAction?: 'continue' | 'pause' | 'reset' | 'reverse'; // when the trigger ends; default 'continue'
    finishAction?: 'hold' | 'reset';                   // after a natural finish; default 'hold'
                                                       //   (the player reads it; setupAnimationTriggers does not)
    scrollIntoViewThreshold?: number;                  // 0–1 visible ratio; default 0
}
```

**Builds.** The ESM and CJS entries (`dist/index.js`, `dist/index.cjs`) carry everything on this
page. Three `<script>` builds put a narrower surface on one global, `window.PixodeskAnimator`:

<!-- px-check off the UMD file list, prose -->
| File | For | On `PixodeskAnimator` |
|---|---|---|
| / `.umd.min.js` | a page playing JSON documents | `createAnimator`, `loadTagAnimators`, `setupAnimationTriggers`, `validateDocument`, `generateNewIds`, `PxTimelineEngineSetting`, `PxTimelineEngine`, `PX_ANIMATOR_DOC_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME` |
| / `.umd.min.js` | a pre-rendered SVG + JS export (engine `auto` / `js`) | `createAnimator(options: PxPrerenderedAnimatorOptions)`, `setupAnimationTriggers`, `PX_ANIMATOR_DOC_KEY` |
| / `.umd.min.js` | the same with engine `native` — the smallest build | the same three |

`PxPrerenderedAnimatorOptions` is `{ doc: PxAnimatedSvgDocument }` plus the inline callbacks. Its `doc`
carries only `animator.definitions` and `animator.bindings` — the SVG is already in the page —
and it is not validated. There is no `src` form.

**Globals.** Importing the player writes nothing to `window`. `<script>` pages reach the playback
surface through `PixodeskAnimator.*` on the UMD build; ESM and CJS consumers import what they
need. (Until 2026-09-12 the module also assigned bare `window.createAnimator`,
`window.loadTagAnimators` and `window.setupAnimationTriggers` on load — that could overwrite a
page's own `createAnimator`, and the side effect stopped the module being tree-shaken.)
Separately, a document with
`animator.debugGlobalName: "heroBanner"` makes the player assign its API object to
`window.heroBanner`, so a live instance can be driven from the console — opt-in per document; see
[Playback & triggers → Debug handle](./docs/library/playback-and-triggers.md#debug-handle--debugglobalname).

**Everything else this package exports**

<!-- px-check exports @pixodesk/svg-animator-web -->
| Symbol | |
|---|---|
| `createAdapterAnimator(doc, adapter, callbacks?)` | ○ the frame-loop engine against a custom `PxPlatformAdapter` — see **core** |
| `PxInternalAnimatorOptions` | ▪ `PxAnimatorOptions` plus `adapter` — the frame loop's custom render target (`PxPlatformAdapter`: `isConnected()` + `setAttribute(id, name, value)`). What the React and Vue components build the player with, so writes go to the elements they rendered; not an option of the public API, because a page has a DOM to write to (review §25.14) |
| `renderNode(node, defs?, diag?)` → `toDomProps(props)` | ○ render one wire node to a DOM element / resolve a node's attributes. `diag` is optional — without it a blocked tag is reported on the console |
| `validateDocument(doc)` | ● the whole-document check — see **core** |
| `generateNewIds` | ○ document tooling — see **core** |
| `PX_ANIMATOR_DOC_KEY` | ▪ attribute and property names the player writes |
| `px`, ; `PxNodeBaseSchema`, `PxSvgNodeRootSchema`, `PxAnimatorConfigSchema`, `PxTriggerSchema`, `PxScrollSchema`, `PxDefinitionsSchema`, ; `PxSchema`, `PxInfer`, `PxValidationContext` | ○ the schema toolkit, re-exported from core — every schema value (the timeline / pin / scroll ones since review §17) and the types to build on them |
| `PxDiagnosticsConfig` | ● the shared component contract — the control-mode rule, and the diagnostics fields every surface accepts — re-exported for the React and Vue components |
| `PxTimelineEngineSetting`, `PxFillMode`, `PxPlaybackDirection`, `PxStartOn` | ● named wire values — one const per wire enum, with the string type derived from it under the same name. `PxTimelineEngineSetting` is what `timeline.engine` accepts (`auto` · `native` · `js`); `PxTimelineEngine` is the resolved engine (`native` · `js`), the argument of `materializeAllInTree`, never an option. `PxUnits` covers `gradientUnits` and the mask units alike |
| `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTrigger`, `PxBinding`, `PxDefinitions` | ● wire types — the shapes in [SCHEMA.md](./SCHEMA.md) |
| `PxAnimatorOptions`, `PxTagAnimatorOptions`, `PxAnimatorApi`, `PxPlaybackApi`, `PxAnimatorCallbacks`, `PxEngineCallbacks`, `PxPlaybackOverride`, `PxTimelinePatch`, `PxPlatformAdapter` | ● / ○ companion types of the calls above |

**Core only**: `flattenAnimatorTimeline` / `nestAnimatorTimeline`, the engine rules
(`resolveTimelineEngine`, …) and the scroll maths.

## @pixodesk/svg-animator-react

<!-- px-check signature pkg=react -->
```typescript
// ● The component. `doc` is the only required prop; everything else overrides what
//   the document already says. React renders the SVG; the player drives its attributes.
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps>;

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;           // the animation document (see SCHEMA.md); no URL form
    className?: string;                   // added to the root <svg>
    style?: CSSProperties;                // set on the root <svg>

    // Playback override — one object, shaped exactly like the file's `timeline` block,
    // deep-merged over it. `null` at a slot DELETES that key:
    //   timeline={{ engine, frameRate, fillMode, direction,
    //              trigger: { outAction, finishAction, scrollIntoViewThreshold } }}
    timeline?: PxTimelinePatch | string;    // a JSON string is accepted too
    resetTimeline?: boolean;              // start from the player's defaults, `timeline` on top

    // Shortcuts — a shortcut wins over the same key inside `timeline`
    duration?: number;                    // ▸ timeline.duration (one iteration, ms)
    delay?: number;                       // ▸ timeline.delay (ms)
    iterations?: number | 'infinite';     // ▸ timeline.iterations
    startOn?: PxStartOn;                  // ▸ timeline.trigger.startOn

    // Control — the HIGHEST-priority one that is set picks the mode (table below)
    apiRef?: React.RefObject<ReactAnimatorApi | null>;   // never a mode: filled in every mode
    autoplay?: boolean;                   // obey the document's own trigger
    progress?: number;                    // controlled: 0–1 of duration × iterations
                                          //   (one iteration when iterations is 'infinite')
    time?: number;                        // controlled: ms
    play?: boolean;                       // true: play regardless of the trigger; false: hold where it is
    pause?: boolean;                      // hold

    // Lifecycle
    onPlay?: () => void;
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;   // reached the end, or finish() was called
    onRemove?: () => void;   // the player was destroyed — unmount, or a change that re-creates it
    onStop?: () => void;     // after any of onPause / onCancel / onFinish / onRemove

    // Diagnostics — the shared channel, as on the web (`PxAnimatorCallbacks`)
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean; muteError?: boolean;
}
```

<!-- px-check off the mode-priority rule, prose -->
| Priority | Mode | Chosen when | The document's trigger |
|---|---|---|---|
| 1 | controlled time | `progress` or `time` | switched off; the player seeks and holds |
| 2 | play / pause | `play` or `pause` | switched off; `play` plays, `pause` holds, `play={false}` holds too (it used to jump to the end — review §8) |
| 3 | autoplay | `autoplay` | used, after the override |
| 4 | static | none of the above | switched off; nothing plays |

`apiRef` is not in the table — the handle is filled in **every** mode and never changes it, so
`<PixodeskSvgAnimator doc={doc} autoplay apiRef={api} />` autoplays and gives you the handle.
Setting two tiers at once keeps the higher one and warns, naming both and the winner. Vue and
React Native resolve the mode with the same shared rule.

Changing `doc`, `className`, `style` or the mode re-creates the player.

<!-- px-check signature pkg=react -->
```typescript
// ● What `apiRef.current` gives you — the web API minus `destroy` / `getRootElement` /
//   `isReady` (the component owns the element's lifetime). This is core's
//   `PxAnimatorHandle` under this package's name (review §9); `VueAnimatorApi` and
//   `RnAnimatorApi` are the same type, so the three cannot drift.
interface ReactAnimatorApi {
    isPlaying(): boolean;
    play(): void; pause(): void; cancel(): void; finish(): void;
    setPlaybackRate(rate: number): void;
    getCurrentTime(): number | null;       // ms from the start of the whole run
    setCurrentTime(time: number): void;
    getCurrentProgress(): number | null;   // 0–1 of the whole run
    setCurrentProgress(p: number): void;
}

// ● For a PRE-RENDERED SVG + CSS file (no JSON, no player): wraps the SVG in a
//   div and drives it by toggling class names — `px-anim-enabled` once started,
//   plus `px-anim-playing` while running. Import the .svg through SVGR and pass
//   it as children.
const PixodeskSvgCssAnimator: FC<{
    children: ReactNode;                  // the SVGR-imported SVG component
    startOn?: PxStartOn;                  // 'load' (default) | 'mouseOver' | 'click' | 'scrollIntoView'
                                          //   — 'programmatic' does nothing here (no play())
    outAction?: PxOutAction;              // 'continue' (default) | 'pause' | 'reset'
                                          //   — 'reverse' is accepted but acts as 'continue'
    scrollIntoViewThreshold?: number;     // 0–1 of the SVG visible before 'scrollIntoView' starts;
                                          //   default 0, the wire default (review §13)
    className?: string;
    style?: CSSProperties;
}>;
```

<!-- px-check exports @pixodesk/svg-animator-react -->
Also exported: **●** `PixodeskSvgAnimatorProps`, `ReactAnimatorApi`,
`PixodeskSvgAnimatorCallbacks` (the six `on*` props as a standalone type).

## @pixodesk/svg-animator-vue

Same two components, same semantics as React; the differences are Vue-shaped.

<!-- px-check signature pkg=vue -->
```typescript
// ● Props: the React set, minus apiRef / className / style (a template ref and
//   Vue's attribute inheritance cover those).
const PixodeskSvgAnimator: DefineComponent<{
    doc: PxAnimatedSvgDocument;           // required
    timeline?: PxTimelinePatch | string;    // the document's `timeline` block, deep-merged
    resetTimeline?: boolean;
    duration?: number; delay?: number;    // shortcuts, as in React
    iterations?: number | 'infinite';
    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
    autoplay?: boolean; play?: boolean; pause?: boolean;
    progress?: number; time?: number;
    onWarn?: (d: PxDiagnostic) => void;   // diagnostics stay PROPS, not events: an event
    onError?: (d: PxDiagnostic) => void;  //   handler always exists, which would silence the
    muteWarn?: boolean; muteError?: boolean;              //   console fallback
}>;

// ● Events instead of callback props: @play @pause @cancel @finish @remove, and
//   @stop after any of the last four.
// ● Imperative API on a template ref (`ref="anim"` → `anim.value.play()`). The ref
//   is available in every mode and never changes the mode.
interface VueAnimatorApi {
    isPlaying(): boolean;
    play(): void; pause(): void; cancel(): void; finish(): void;
    setPlaybackRate(rate: number): void;
    getCurrentTime(): number | null;       // ms from the start of the whole run
    setCurrentTime(time: number): void;
    getCurrentProgress(): number | null;   // 0–1 of the whole run
    setCurrentProgress(p: number): void;
}

// ● Pre-rendered SVG + CSS wrapper; the SVG goes in the default slot, and every
//   other attribute (class, style, …) lands on the wrapper div.
const PixodeskSvgCssAnimator: DefineComponent<{
    startOn?: PxStartOn;                  // default 'load'
    outAction?: PxOutAction;              // default 'continue'
    scrollIntoViewThreshold?: number;     // default 0, as in React
}>;
```

<!-- px-check exports @pixodesk/svg-animator-vue -->
Modes, highest priority wins: `progress` / `time` → `play` / `pause` → `autoplay` → static — the
same shared rule as React and React Native, conflicts warned the same way. Any change to `doc` or
to an override prop re-creates the player.

## @pixodesk/svg-animator-rn 🧪 experimental

Mirrors the React component on `react-native-svg` + `reanimated`: the document is materialized
once, sampled into per-element tracks, and played on the UI thread. No CSS-flavor component, no
`className` / `style`, and a `fallback` element instead of a DOM. (`onRemove` fires on unmount or a
`doc` swap, as on the web — review §18.)

<!-- px-check signature pkg=rn -->
```typescript
// ● The component (a plain function, also the default export).
function PixodeskSvgAnimator(props: PixodeskSvgAnimatorProps): ReactElement | null;

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;           // required

    // Playback override — the same object as React. `timeline.engine` is accepted
    // but ignored: React Native always uses the `native` materialization.
    timeline?: PxTimelinePatch | string;
    resetTimeline?: boolean;

    duration?: number; delay?: number;    // shortcuts, ms
    iterations?: number | 'infinite';
    startOn?: PxStartOn;                  // 'mouseOver' has no touch equivalent and is ignored;
                                          //   'click' = tap (a second tap applies outAction);
                                          //   'scrollIntoView' = measured every 200 ms

    autoplay?: boolean;                   // honor the document trigger — the same defaults as
                                          //   the web: startOn 'load', outAction 'continue'
    play?: boolean; pause?: boolean;      // unconditional control; play={false} holds where it is
    progress?: number;                    // 0–1 of duration × iterations
    time?: number;                        // ms

    apiRef?: React.RefObject<RnAnimatorApi | null>;   // the same methods as ReactAnimatorApi —
                                          //   and, since review §3, the same meanings: whole-run
                                          //   time, clamped seeks, rate 0 rejected

    onPlay?: () => void; onStop?: () => void; onPause?: () => void;
    onCancel?: () => void; onFinish?: () => void;
    onRemove?: () => void;                // unmount, or a `doc` swap (review §18)

    // Diagnostics — the shared channel, exactly as on the web (review §25.1): `onError` means
    // THIS INSTANCE WILL NOT PLAY — the compile or the render threw; `d.error` is the Error,
    // `d.detail.componentStack` is set when the error boundary caught it — and `fallback` is
    // what shows instead. Only JavaScript failures reach it; a crash inside the native
    // renderer does not.
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean; muteError?: boolean;
    fallback?: (error: Error) => ReactElement | null;
}
```

Modes, highest priority wins: `progress` / `time` → `play` / `pause` → `autoplay` → static — the
same shared rule as React and Vue, conflicts warned the same way. `apiRef` never changes the mode.

<!-- px-check exports @pixodesk/svg-animator-rn -->
Nothing else: the package exports the component, its props (`PixodeskSvgAnimatorProps`) and its
handle (`RnAnimatorApi`). The renderer, the track compiler and the tag maps it used to publish are
internal again — see API-SURFACE-REVIEW.md §5.

## @pixodesk/svg-animator-core — no DOM, shared by every player

You depend on this **directly** only to inspect or transform documents; a player
package already bundles it. Nothing here renders anything.

<!-- px-check signature pkg=core -->
```typescript
// ○ Run the whole materialization pipeline: effects → loops → motion paths →
//   <use> instances, in the canonical order. This is exactly what the player
//   runs internally, so a document flattened here plays identically — the way
//   to feed a renderer that has no effects support. `resolveTimelineEngine`
//   turns a document's `timeline.engine` into this argument.
function materializeAllInTree(
    doc: PxAnimatedSvgDocument,
    engine: 'native' | 'js',
    options?: { motionPath?: MotionPathMaterializationOptions },
): PxAnimatedSvgDocument;

// ○ One stage of it: `node.effects` → plain renderable nodes (+ generated defs).
function materializeNodeEffects(root: PxNode): ApplyResult;

// ● The whole-document check: the strict wire schema (undeclared keys included)
//   plus every `effects` bucket. Returns human-readable problems (`path: what is
//   wrong`), empty when the document is sound; never throws. Every player runs the
//   same check on load and prints the problems as one console warning — call this
//   before shipping a document instead of relying on the console.
function validateDocument(doc: unknown, options?: { strict?: boolean }): Array<string>;
//   `strict` (default true) rejects keys the schema does not declare — right before you ship.
//   `{ strict: false }` tolerates them, which is what a READER wants: an unknown key usually
//   means a newer writer — worth a warning, never a refusal.

// ○ Check every `node.effects` bucket against the schema, depth-first. Returns
//   human-readable warnings (each prefixed with the node's path) and never
//   throws; the players run this on load and log whatever comes back.
function validateNodeEffects(root: PxNode, options?: { strict?: boolean }): Array<string>;

// ● Per-instance playback override, shared by every player. `patch` is a
//   deep-partial of the document's `animator` block; objects merge key by key,
//   values replace, and `null` DELETES a key (restoring the default its absence
//   means). Pure — the document is not modified; the result shares every
//   untouched subtree by reference. Warnings say what could not be applied
//   (e.g. clock-only keys aimed at a scroll timeline).
function applyAnimatorConfig(
    doc: PxAnimatedSvgDocument,
    patch: PxAnimatorConfigPatch,
    options?: { resetTimeline?: boolean },   // start from the player's defaults; keeps
): { doc: PxAnimatedSvgDocument; warnings: Array<string> };   // definitions/bindings

// ○ The same merge one level down, on the config object itself.
function mergeAnimatorConfig(
    base: PxAnimatorConfig | undefined,
    patch: PxAnimatorConfigPatch,
): PxAnimatorConfigMergeResult;

// ○ Folds the four shortcuts (duration/delay/iterations/startOn) into a patch and
//   parses the JSON-string form. A shortcut wins over the same key in `timeline`.
//   This is what every player calls before `applyAnimatorConfig`.
function foldTimelineOverride(
    timeline: PxTimelinePatch | string | undefined,
    shortcuts: PxTimelineShortcuts,
): PxAnimatorConfigPatch | undefined;

// ○ The schema version — see docs/format/README.md#versioning.
const PX_WIRE_SCHEMA_VERSION: '1.1';                                    // the schema this build reads
function readWireVersion(doc: unknown): PxWireVersion | undefined;          // animator.version (or meta.animator.version)
function convertWireDocument(doc: unknown): PxWireConversionResult;     // up to this schema; never refuses, never mutates
function downgradeWireDocument(doc: unknown, target: PxWireVersion): PxWireDowngradeResult;   // all or nothing

// ○ Deep-clone a document with fresh ids and internal references rewritten —
//   what you need before putting the same animation on a page twice.
function generateNewIds(doc: PxAnimatedSvgDocument): PxAnimatedSvgDocument;

// ○ Playback on a non-DOM target: implement the adapter, get the frame-loop engine.
function createAdapterAnimator(
    doc: PxAnimatedSvgDocument,
    adapter: PxPlatformAdapter,
    callbacks?: PxEngineCallbacks,
): PxAnimatorApi;

interface PxPlatformAdapter {
    isConnected(): boolean;                                     // is the target still mounted
    setAttribute(id: string, attrName: string, value: string): void;
}

// ● The one rule that turns a component's control props into a decision, so React,
//   Vue and React Native cannot answer it three ways. Most specific first:
//   `progress` / `time` → `play` / `pause` → `autoplay` → `static`. Props from two
//   tiers set together come back as ready-made warning sentences; `apiRef` never
//   changes the mode, being a handle rather than an instruction.
function resolveControlMode(props: PxControlProps): PxResolvedControlMode;

// ● True when that mode has to take the document's own trigger over — every mode
//   except `autoplay`, INCLUDING `static`: a component given no control props at
//   all renders the first frame and waits, so it forces `startOn: 'programmatic'`.
function controlModeTakesOverTrigger(mode: PxControlMode): boolean;
```

**Everything else this package exports**

<!-- px-check exports @pixodesk/svg-animator-core -->
| Group | Symbols | |
|---|---|---|
| Wire types | `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTimeline`, `PxTrigger`, `PxElementAnimation`, `PxPropertyAnimation`, `PxKeyframe`, `PxLoop`, `PxBinding`, `PxDefinitions`, `PxEffects`, `PxTransformParts`, `PxBezierPath`, `PxGlyph`, `PxGlyphFont`, `PxAnimationDefinition`, `PxScroll`, `PxScrollRangePoint`, `PxVec2`, `PxTransformValue` | ● the shapes in [SCHEMA.md](./SCHEMA.md) |
| Player API types | `PxAnimatorApi<TRoot>`, `PxPlaybackApi<TRoot>`, `PxEngineCallbacks`, `PxPlatformAdapter` | ● platform-neutral; the web fixes `TRoot` to `Element`. `PxEngineCallbacks` is what an engine takes — the lifecycle on top of `PxDiagnosticsConfig` |
| Component contract | `PxAnimatorHandle`, `PxAnimatorCallbacks`, `PxControlProps`, `PxControlMode`, `resolveControlMode(props)`, `controlModeTakesOverTrigger(mode)` | ● what the React / Vue / React Native components share (review §1, §7, §9): the imperative handle, the callback set, the props that pick a mode and the one rule that picks it |
| Engine rules | `resolveTimelineEngine(engine)`, `isNativeForced(engine)`, `mayUseNativeScrollTimeline(engine)` | ○ how a `timeline.engine` resolves to an engine / to the browser's ScrollTimeline — the players' own decision helpers |
| Trigger defaults | `PX_TRIGGER_DEFAULTS`, `resolveTrigger(trigger)`| ○ what a missing trigger field means (`startOn` 'load', `outAction` 'continue', threshold 0) — the one resolution every player uses |
| Time contract | `seekCeilingMs`, `progressSpanMs`, `clampSeekMs`, `timeToProgress`, `progressToTimeMs`, `isValidPlaybackRate`, `PX_RATE_REJECTED`, `createRunClock` + | ○ the one meaning of time, seeking and rate that every engine implements — see `PxAnimatorApi` |
| Diagnostics | `createDiagnostics(config?, prefix?)` (▪) → `PxDiagnostics`, `PxDiagnosticKind` + `PxDiagnostic`, `PxDiagnosticsConfig` | ● the one channel every player reports through: `onWarn` / `onError` with a `kind` saying who can act, falling back to the console — see `PxEngineCallbacks` |
| Enum values | `PxTimelineEngineSetting`, `PxTimelineEngine`, `PxGradientType`, `PxUnits`, `PxGradientSpreadMethod`, `PxLoopRepeatAt`, `PxLoopDirection`, `PxStrokeTrimSubPaths`, `PxCloneWithout` (`clone.without` → `'translate'`), `PxMaskType`, `PxPathOverflow`, `PxLengthAdjust`, `PxTextPathMethod`, `PxTextPathSpacing`, `PxFillMode`, `PxPlaybackDirection`, `PxStartOn`, `PxOutAction`, `PxFinishAction`, `PxScrollKind`, `PxScrollAxis`, `PxScrollSource`, `PxScrollPhase`, `PxPinAlign`, `PxAlongPathMode`, `PX_TRANSFORM_PART_KEYS` | ● named values instead of bare strings — each is a const namespace AND the type derived from it, so `PxStartOn.click` and `startOn?: PxStartOn` come from one import |
| Schema version | `PX_WIRE_SCHEMA_VERSION`, `PX_WIRE_VERSION`, `PX_WIRE_BASELINE_VERSION`, `PX_WIRE_STEPS`, `PX_WIRE_VERSION_KEY`, `PxWireVersionRelation`, `parseWireVersion`, `formatWireVersion`, `readWireVersion`, `compareWireVersion`, `wireVersionAdvice`, `convertWireDocument`, `downgradeWireDocument`, `applyWireSteps`, + `PxWireVersion`, `PxWireVersionStep`, `PxWireConversionResult`, `PxWireStepKind`, `PxWireConversionOptions` | ○ read, compare and convert a document's `animator.version` — [docs](./docs/format/README.md#versioning) |
| Schema release | `schemaFieldUniverse`, `diffFieldUniverse`, `planSchemaRelease`, `releaseLogProblems` | ▪ the field inventory and bump rule behind `scripts/schema-release.mjs` |
| Diagnostics | `diagnoseDocument(doc)` (○) → (`{ problems }`), `reportDocumentDiagnostics(doc, where)`, `PX_UNKNOWN_KEY_ERROR` | ▪ the load-time check every player runs; call `validateDocument` instead |
| Validation | `isPxDocument`, `isValidPxDocument`| ○ a cheap "is this a Pixodesk document" gate / the pass-fail form of `validateDocument`, NON-strict, with every message it can name (review §10 — it used to answer only "failed schema validation") |
| Document accessors | `getAnimatorConfig`, `getChildren`, `getBindings`, `getDefinitions` | ○ read a document without knowing its internals |
| Timeline shape | `flattenAnimatorTimeline`, `nestAnimatorTimeline` | ○ nested `timeline` object ⇄ the flat runtime view |
| Playback override | `PxTimelinePatch`, `PxPlaybackOverride`, `PxAnimatorConfigPatch`, `PxAnimatorConfigMergeResult`, `PxTimelineShortcuts` | ● the `timeline` override as every player takes it, and the companion types of the three merge functions above |
| Keyframe forms | `keyframeValue`, `keyframeEasing`, `PxNormalizedKeyframe`, `PxNormalizedPropertyAnimation`, `PxAnyKeyframe` | ▪ read a keyframe in either its wire or its runtime (`t` / `v` / `e`) form; is what `normalizeBindings` hands the engines — bare id + merged animation, from a binding or a node alike |
| Schema toolkit | `px`, `schemaKeys`, `describeSchema` — plus one schema value per wire type: `PxAnimatedSvgDocumentSchema`, `PxNodeSchema`, `PxNodeBaseSchema`, `PxSvgNodeRootSchema`, `PxAnimatorConfigSchema`, `PxTimelineSchema`, `PxTriggerSchema`, `PxElementAnimationSchema`, `PxPropertyAnimationSchema`, `PxKeyframeSchema`, `PxKeyframeValueSchema`, `PxAttrValueSchema`, `PxTransformPartsSchema`, `PxBezierPathSchema`, `PxLoopSchema`, `PxDefinitionsSchema`, `PxEffectsSchema`, `PxClipPathEffectSchema`, `PxCloneEffectSchema`, `PxRepeaterEffectSchema`, `PxRetimeEffectSchema`, `PxMaskedByEffectSchema`, `PxTransformByEffectSchema`, `PxTextEffectSchema`, `PxTextPathEffectSchema`, `PxStrokeTrimEffectSchema`, `PxFillGradientEffectSchema`, `PxGradientStopSchema`, `PxScrollSchema`, `PxScrollRangeSchema`, `PxScrollRangePointSchema`, `PxTransformValueSchema` | ○ the validator the format is written in |
| Pipeline stages | `normalizeBindings` (○), `calcAnimationValues` (○), `interpolateValue`, `materializeMotionPathInPropAnim`, `mergeStaticTransformIntoAnimDef` | ▪ stages of `materializeAllInTree`; call the pipeline instead |
| Effect harness | `diffInEffect` | ▪ the editor's "equal in effect" comparison |
| Text & paths | `materializeGlyphText`, `layoutGlyphTextChars`, `createPathSampler`, `extendedPathForBrowser`, `materializeGlyphTextAlongPath` | ▪ glyph-text and text-on-path materialization |
| Node props | `toDomProps` (○), `sanitizeAttributeValue`, `PX_CSS_ONLY_STYLE_PROPS`, `PX_DISALLOWED_SVG_TAGS_LOWER` | ▪ shared normalization and sanitization rules |
| Scroll math | `isScrollTimeline`, `scrollViewProgress`, `scrollOffsetProgress`, `scrollPhaseInterval`, `scrollResolveAxis`, `scrollTotalDurationMs` | ▪ scroll-driven playback internals |
| Maths & strings | `cubicBezier`, `subdivideCubicBezier`, `bezierToSvgPath`, `splitEasing`, `reverseEasing`, `clamp`, `toRGBA`, `composeTransformParts`, `camelCaseToKebabWordIfNeeded`, `kebabToCamelCaseWord`, `PX_COLOR_ATTR_NAMES`, `PX_STYLE_ATTR_NAMES`, `PX_PCT_BASED_ATTR_NAMES`, `PX_TRANSFORM_FN_NAMES`, `deepClone`, `generateUniqueId`, `PX_DEFAULT_DURATION_MS`, `PX_LOOP_JUMP_SHIFT_MS` | ▪ helpers shared with the editor |
| Schema toolkit types | `PxSchema`, `PxSchemaDesc`, `PxInfer`, `PxValidationContext`, `PxRemoveIndex` | ○ the types you build a schema with — see the toolkit above |
| Companion types | `PxMaterializeAllOptions`, `PxCreateElement`, `PxGlyphCharBox`, `PxAnimatable` | ▪ argument and result shapes of the functions above |
| Attribute names | `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME`, `PX_TEXT_CONTENT_ATTR` | ▪ reserved keys — see [SCHEMA.md](./SCHEMA.md#reserved-keys) |

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
  timeline={{ trigger: { outAction: 'pause' } }} />

// React — imperative: with no control prop the document's trigger is switched off and the
// ref alone starts playback (add `autoplay` and you get both — the ref is never a mode)
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

createAnimator({ doc: doc, container: '#first' });
createAnimator({ doc: generateNewIds(doc), container: '#second' });
```
