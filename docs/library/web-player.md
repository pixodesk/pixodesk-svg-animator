# Web player — `@pixodesk/svg-animator-web`

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)

Use this on a plain web page — or anywhere you write JavaScript without a framework — to play
a JSON animation with full control. Hand it the document and it builds the SVG DOM, drives the
animation with the Web Animations API or a frame loop, and wires up hover / click / scroll
triggers for you. It ships as ESM, CJS and UMD (global `PixodeskAnimator`), so it fits a
bundler or a plain `<script>` tag equally well.

```bash
npm install @pixodesk/svg-animator-web
```

## Two ways to use it

### Declarative — `data-px-animation-src`

> **Example:** [`web/declarative`](../../examples/docs-examples/src/cases/web/declarative/) — `pnpm example:docs`, then open `#web/declarative`.

Point an element at the JSON file and call `loadTagAnimators()` once the DOM is ready. The
script is the UMD build, copied from the npm package into your site — see
[Installing the players (overview)](./installation.md#the-three-builds--esm-cjs-and-umd):

```html
<div data-px-animation-src="/bouncing-ball.json" style="width: 300px; height: 300px"></div>

<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>PixodeskAnimator.loadTagAnimators();</script>
```

`bouncing-ball.json` is the whole document — a ball on an eased, alternating bounce. (The
comments are explanatory; JSON does not allow comments, so the real file has none.)

```js px-player
{
  // The root <svg> element — plain SVG, written as JSON
  "type": "svg",
  "viewBox": "0 0 400 400",

  // ADDED: the playback settings — how long, how many times, what starts it
  "animator": {
    "timeline": {
      "duration": 1000,
      "iterations": "infinite",
      "direction": "alternate",
      "trigger": { "start": "load" }
    }
  },
  "children": [
    {
      // A plain SVG <circle> with ordinary attributes
      "type": "circle",
      "id": "ball",
      "cx": 0, "cy": 0, "r": 40, "fill": "#0087ff",

      // ADDED: the circle's animation — keyframes for its position
      "animate": {
        "translate": {
          "keyframes": [
            { "time": 0,    "value": [200, 60],  "easing": [0.33, 0, 0.67, 0.33] },
            { "time": 1000, "value": [200, 340] }
          ]
        }
      }
    }
  ]
}
```

Every matching element gets its own animator, stored on the element as `element._px_animator`
(the [playback API](#the-playback-api) below). Calling `loadTagAnimators()` again only picks up
elements that do not have an animator yet, so it is safe to call after inserting new content.

### Programmatic — `createAnimator(options)`

> **Example:** [`web/programmatic`](../../examples/docs-examples/src/cases/web/programmatic/) — `pnpm example:docs`, then open `#web/programmatic`.

Use `createAnimator` when you want to start the animation from code, react to what it does,
or control it after it has loaded. It returns the playback API at once — even while the
document is still loading from a URL.

```html
<div id="hero" style="width: 300px; height: 300px"></div>
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';
import animationDoc from './bouncing-ball.json';

// from a URL — returns immediately; control calls made before the file loads are
// queued and replayed in order once it is ready
const animator = createAnimator({
  src: '/bouncing-ball.json',
  container: '#hero',
  onFinish: () => console.log('done'),
});

// or from a document object you already have — imported, fetched, or built in code
const animator2 = createAnimator({ doc: animationDoc, container: document.getElementById('hero') });

animator.play();
```

#### Options

<!-- px-check signature pkg=web -->
```typescript
// Create a player. Provide exactly one of `src` / `doc` — both, or neither, throws.
// With `src`, control calls made before the fetch resolves are queued and replayed in
// order, so `createAnimator({ src }).play()` works as written. A failed fetch or an
// invalid document reaches `onError` — and `console.error` when no handler is given;
// `isReady()` stays false either way.
function createAnimator(options: PxAnimatorOptions): PxAnimatorApi;

interface PxAnimatorOptions {
    src?: string;                          // URL to fetch the JSON document from
    doc?: PxAnimatedSvgDocument;           // …or the document inline (the JSON format page)
    container?: string | Element;          // CSS selector or element to render into (its content is
                                           //   replaced). Omit it to animate an SVG already in the
                                           //   page, found by the document's `id`

    // Callbacks, inline: `PxAnimatorCallbacks`, the one shape every player takes — see
    // Callbacks below; the shape itself is spelled out once, in the library overview
    onPlay?: () => void;    onPause?: () => void;    onCancel?: () => void;
    onFinish?: () => void;  onRemove?: () => void;   onStop?: () => void;
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean;  muteError?: boolean;

    // Per-instance playback override: `PxPlaybackOverride`; the document is never modified.
    // The merge rules: Playback settings & triggers → Overriding from a player
    timeline?: PxTimelinePatch | string;   // deep-merged over the document's `timeline` block —
                                           //   same shape as the file. `null` at a slot DELETES
                                           //   that key. A JSON string is accepted too (survives
                                           //   property mangling)
    resetTimeline?: boolean;               // start from the player's defaults, `timeline` on top
    duration?: number;                     // ▸ timeline.duration — one iteration, ms
    delay?: number;                        // ▸ timeline.delay, ms; negative skips ahead
    iterations?: number | 'infinite';      // ▸ timeline.iterations
    start?: 'load' | 'mouseOver' | 'click' | 'none';
                                           // ▸ timeline.trigger.start — a shortcut wins over
                                           //   the same key in `timeline`
}
```

By default there is nothing to configure: the player takes duration, iterations, direction,
what starts the animation and the engine from the `animator` block inside the JSON — the
settings you chose in the editor. So a file plays the way it was designed.

`timeline` is there for when one page needs it to play differently — the same file mounted twice
at two speeds, or a file that autostarts everywhere except inside your own transport UI:

```js
const animator = createAnimator({
  src: '/bouncing-ball.json',
  container: '#box',
  timeline: { iterations: 'infinite', trigger: { start: 'none' } },
});
animator.play();
```

The merge is per key, so everything you do not mention stays as the file has it. Full rules —
`null` to delete a key, what happens when the override changes the kind of timeline, and the
shortcut precedence — are in
[Playback settings & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
Every field and its meaning is in [Playback settings & triggers](./playback-and-triggers.md).

## The playback API

`createAnimator` returns a `PxAnimatorApi`. Time is ms from the start of the whole run, every
iteration included; a seek is clamped to it; a rate of `0` is rejected — the same contract on
every player.

<!-- px-check signature pkg=web -->
```typescript
// Playback control returned by `createAnimator` — core's `PxAnimatorApi<Element>`.
interface PxAnimatorApi extends PxPlaybackApi {
    finish(): void;                        // jump to the end and hold the final state; fires onFinish
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, 0.5 half, negative plays backwards;
                                           //   0 and non-finite are rejected with a warning — use pause()
    getCurrentTime(): number | null;       // ms from the start of the whole run; null before a
                                           //   `src` document has loaded
    setCurrentTime(time: number): void;    // seek, ms; clamped to [0, duration × iterations]. Paused,
                                           //   the animation shows that frame and stays — a slider
                                           //   steps through it this way; playing, it continues from there
    getCurrentProgress(): number | null;   // the same position as 0–1 of the whole run; null before ready
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run (clamped)
    destroy(): void;                       // stop, remove the SVG it rendered, release everything; fires onRemove
}

// The platform-neutral base from core; the web fixes the root type to `Element`.
interface PxPlaybackApi {
    isReady(): boolean;                    // true once a `src` document has loaded and rendered
    getRootElement(): Element | null;      // the rendered <svg>; null before ready
    isPlaying(): boolean;                  // true while running
    play(): void;                          // start, or resume from the current time; on a finished
                                           //   animation, rewinds and plays again
    pause(): void;                         // hold the current frame
    cancel(): void;                        // stop and reset to the start state
}
```

```html
<div id="hero" style="width: 300px; height: 300px"></div>
<input id="time-slider" type="range" min="0" max="1000" value="0">
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';
import doc from './bouncing-ball.json';

const animator = createAnimator({ doc: doc, container: '#hero' });

const slider = document.querySelector('#time-slider');
slider.addEventListener('input', () => {
  animator.pause();
  animator.setCurrentTime(Number(slider.value));   // from 0 to the duration, in ms
});
```

## Callbacks

> **Example:** [`web/callbacks`](../../examples/docs-examples/src/cases/web/callbacks/) — `pnpm example:docs`, then open `#web/callbacks`.

Pass `onPlay`, `onFinish` and friends — inline, next to `doc` — to be told when the animation starts, pauses, resets, finishes or is
destroyed — for example to reveal the next section of a page once an intro has finished. Every
lifecycle callback is called with no arguments.

The same options carry the player's diagnostics, two severities with one meaning each: `onWarn`
— **it plays**, but something was ignored, degraded or misspelled; `onError` — **this instance
will not play**: the document failed to load, parse or build, or the render threw, and
`isReady()` stays false. Neither ever throws at you. Give a handler and the console stays out of
it; give none and the console still speaks, so nothing is lost by default. `muteWarn` /
`muteError` switch that console fallback off — for when you know the player has something to
say about this document and are prepared to tolerate it (a handler you passed still fires).

Each one is `{ code, kind, data?, message, error? }`. `code` is a number you can switch on — its description is on the [codes page](../diagnostics.md), which `message` links to; `data` carries the specifics. `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the options you passed) · `internal` (report it to us). So
you can route rather than just log — a handler that ignores `platform` and logs the rest is one
line.

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';
import doc from './bouncing-ball.json';

createAnimator({
  doc: doc,
  container: '#box',
  onPlay:   () => {},   // started or resumed
  onPause:  () => {},   // paused
  onCancel: () => {},   // canceled (reset)
  onFinish: () => {},   // finished naturally, or finish() was called
  onRemove: () => {},   // destroyed

  onWarn:  (d) => {},   // d = { code, kind, data? }; else console.warn
  onError: (d) => {},   // d = { code, kind, data?, error }; else console.error
  muteWarn: false,      // true: no console.warn — you know about the warnings and tolerate them
  muteError: false,     // true: no console.error
});
```

## Triggers

> **Example:** [`web/triggers`](../../examples/docs-examples/src/cases/web/triggers/) — `pnpm example:docs`, then open `#web/triggers`.

If the document says `trigger.start: 'click'` (or `mouseOver`, `scrollIntoView`), the player
wires the event on the rendered SVG for you; `mouseOut` (continue / pause / reset / reverse)
and `visibilityThreshold` are honored. With `'load'` it starts immediately; with
`'none'` nothing happens until you call `play()`.

`setupAnimationTriggers(api, triggerConfig)` is exported for one rare case: you have replaced
the rendered SVG yourself, so the click / hover / scroll listeners the player attached are gone
with the old elements, and you need to attach them to the new ones.

## Engines

> **Example:** [`web/engine-modes`](../../examples/docs-examples/src/cases/web/engine-modes/) — `pnpm example:docs`, then open `#web/engine-modes`.

`animator.timeline.engine` in the document selects how the animated attributes get updated:

<!-- px-check values PxTimelineEngineSetting pkg=web -->
| Value | Behavior |
|---|---|
| `'auto'` (default) | Web Animations API, with an automatic fallback to the player's frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on path…). For scroll-driven documents: the browser's `ScrollTimeline` where supported, else the player measures progress itself |
| `'native'` | Web Animations API only (and the browser's `ScrollTimeline` for scroll-driven documents) |
| `'js'` | the player's frame loop only; honors `timeline.frameRate`. Required for path morphing in Safari < 18.5 |

The fallback is per document: if any animated attribute fails the runtime `CSS.supports` gate,
the whole document runs on the frame loop. Either way it plays.

## Loading several animations

> **Example:** [`web/several`](../../examples/docs-examples/src/cases/web/several/) — `pnpm example:docs`, then open `#web/several`.

To put several animations on one page — different files, or the same file more than once —
give each one its own element and call `loadTagAnimators()` once. Every element gets its own
independent animator, so the copies play, pause and finish on their own.

```html
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
```

```js
import { loadTagAnimators } from '@pixodesk/svg-animator-web';

loadTagAnimators();

// Calling it again is safe: only elements without an animator are picked up.
loadTagAnimators();
```

Each instance regenerates the document's element ids, so many copies of the same file coexist
on one page without id conflicts. From code, give the second copy fresh ids yourself:

```js
// Two copies of one animation on a page (ids must stay unique)
import { createAnimator, generateNewIds } from '@pixodesk/svg-animator-web';

createAnimator({ doc: doc, container: '#first' });
createAnimator({ doc: generateNewIds(doc), container: '#second' });
```

## Every animator on the page (experimental)

> **Experimental.** The registry is new (2026-09) and not settled: the event names, what
> `getAll()` includes (the pre-rendered builds, an animator whose `src` is still loading) and
> the `__pixodeskAnimators` global may change without a major version change. Use it for dev
> tooling and tests; expect to adjust your code as new versions come out.

The players keep a page-wide registry — the same idea as lottie-web's
`getRegisteredAnimations()`. Every animator built by this package (`createAnimator`,
`loadTagAnimators`, the pre-rendered builds, the React and Vue components) is listed from the
moment it exists until its `destroy()`, and announces its playback changes. One registry per
window, whatever the bundling: an ESM import in one script and the UMD build in another see
the same list.

<!-- px-check signature pkg=web -->
```typescript
function getAllAnimators(): ReadonlyArray<PxAnimatorApi>;
function onAnimatorsChange(listener: PxAnimatorsListener): () => void;

type PxAnimatorsEvent = 'add' | 'remove' | 'play' | 'pause' | 'cancel' | 'finish';
type PxAnimatorsListener = (event: PxAnimatorsEvent, animator: PxAnimatorApi) => void;

interface PxAnimatorRegistry {
    getAll(): ReadonlyArray<PxAnimatorApi>;
    subscribe(listener: PxAnimatorsListener): () => void;
}
```

`getAllAnimators()` returns the live animators in creation order. `onAnimatorsChange` hears
every animator appear (`add`), start (`play`), pause, cancel, finish and go (`remove`); an
animator's own `onPlay` / `onPause` / … callbacks run first. It returns the unsubscribe.

```js
import { getAllAnimators, onAnimatorsChange } from '@pixodesk/svg-animator-web';

// Pause everything while the tab is hidden, resume what was playing when it is back.
let paused = [];
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        paused = getAllAnimators().filter(a => a.isPlaying());
        paused.forEach(a => a.pause());
    } else {
        paused.forEach(a => a.play());
        paused = [];
    }
});

// A dev panel: how many are playing right now?
onAnimatorsChange(() => {
    console.log(getAllAnimators().filter(a => a.isPlaying()).length, 'playing');
});
```

The same store is reachable **by name** as `globalThis.__pixodeskAnimators` — a
`PxAnimatorRegistry` with `getAll()` and `subscribe()` — for tooling that reads a page it did
not build (a devtools panel, a test harness) without importing the library. Web only: the
React Native player keeps no registry.

## Cleaning up

> **Example:** [`web/cleanup`](../../examples/docs-examples/src/cases/web/cleanup/) — `pnpm example:docs`, then open `#web/cleanup`.

Call `destroy()` when the container goes away (route change, modal close). `onRemove` fires
once. Frameworks: the React and Vue components do this on unmount.


## API reference

The calls above are spelled out where they are used: `createAnimator` and its options under
[Programmatic](#programmatic--createanimatoroptions), the returned `PxAnimatorApi` under
[The playback API](#the-playback-api). The callbacks and diagnostics are one shape on every
player, written out once in [the API at a glance](./README.md#the-api-at-a-glance). The rest:

<!-- px-check signature pkg=web -->
```typescript
// Scan the page for `<div data-px-animation-src="animation.json">` and create one
// player per match, rendered into that element and stored on it. Safe to call
// repeatedly: elements that already carry a player are skipped. Nothing calls it for
// you. `options` — everything `createAnimator` takes except `src` / `doc` /
// `container` — applies to EVERY player this call creates; omit it for zero-config.
function loadTagAnimators(options?: PxTagAnimatorOptions): void;

// Wire a player to a DOM trigger. `createAnimator` already does this from the
// document's own `animator.timeline.trigger`, and ties the disposer to `destroy()`.
// Use it after you have replaced the rendered SVG yourself (the player's listeners went
// with the old elements). To change the trigger, use `timeline`. Returns a DISPOSER that
// detaches everything this call attached — call it before re-arming an element you
// wired by hand, or the old listeners stay live next to the new ones. Reads `start` /
// `mouseOut` / `visibilityThreshold`; `finish` is the player's, not the
// trigger wiring's. `diag` is optional: omit it and anything this has to say goes to
// the console.
function setupAnimationTriggers(api: PxAnimatorApi, trigger: PxTrigger,
                                diag?: PxDiagnostics): () => void;

interface PxTrigger {                                  // also a wire type — the JSON format page
    start?: 'load' | 'mouseOver' | 'click' | 'none';   // what STARTS it; default 'load';
                                                       //   'none' waits for play()
    offScreen?: 'pause' | 'continue' | 'reset';        // while nobody can see it; default 'pause'
    mouseOut?: 'continue' | 'pause' | 'reset' | 'reverse'; // pointer leaves; default 'continue'
    finish?: 'hold' | 'reset';                         // after a natural finish; default 'hold'
                                                       //   (the player reads it; setupAnimationTriggers does not)
    visibilityThreshold?: number;                      // 0–1 visible ratio; default 0.5
    visibilityDebounce?: number;                       // ms it must hold first; default 150
}
```

**Builds.** The ESM and CJS entries (`dist/index.js`, `dist/index.cjs`) carry everything on this
page. Three `<script>` builds put a narrower surface on one global, `window.PixodeskAnimator`
(the files themselves: [Installing the players](./installation.md#the-three-builds--esm-cjs-and-umd)):

<!-- px-check off the UMD file list, prose -->
| File | For | On `PixodeskAnimator` |
|---|---|---|
| `pixodesk-svg-animator.umd.min.js` | a page playing JSON documents | `createAnimator`, `loadTagAnimators`, `setupAnimationTriggers`, `validateDocument`, `generateNewIds`, `PxTimelineEngineSetting`, `PxTimelineEngine`, `PX_ANIMATOR_DOC_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME` |
| `index.prerendered.umd.min.js` | a pre-rendered SVG + JS export (engine `auto` / `js`) | `createAnimator(options: PxPrerenderedAnimatorOptions)`, `setupAnimationTriggers`, `PX_ANIMATOR_DOC_KEY` |
| `index.prerendered-waapi.umd.min.js` | the same with engine `native` — the smallest build | the same three |

`PxPrerenderedAnimatorOptions` is `{ doc: PxAnimatedSvgDocument }` plus the inline callbacks. Its `doc`
carries only `animator.definitions` and `animator.bindings` — the SVG is already in the page —
and it is not validated. There is no `src` form.

**Globals.** Importing the player writes nothing to `window`. `<script>` pages reach the playback
surface through `PixodeskAnimator.*` on the UMD build; ESM and CJS consumers import what they
need. Separately, a document with `animator.debugGlobalName: "heroBanner"` makes the player
assign its API object to `window.heroBanner`, so a live instance can be driven from the console —
opt-in per document; see [Playback & triggers → Debug handle](./playback-and-triggers.md#debug-handle--debugglobalname).

**Everything else this package exports** — ● user-facing · ○ advanced · ▪ internal, as in
[the API at a glance](./README.md#the-api-at-a-glance):

<!-- px-check exports @pixodesk/svg-animator-web -->
| Symbol | |
|---|---|
| `createAnimator(options)`, `loadTagAnimators(options?)`, `setupAnimationTriggers(api, trigger, diag?)` | ● the player — above |
| `getAllAnimators()`, `onAnimatorsChange(listener)`, `PxAnimatorRegistry`, `PxAnimatorsEvent`, `PxAnimatorsListener` | ● **experimental** — [every animator on the page](#every-animator-on-the-page-experimental): the window-wide registry, also `globalThis.__pixodeskAnimators`; not settled, may change without a major version |
| `createAdapterAnimator(doc, adapter, callbacks?)` | ○ the frame-loop engine against a custom `PxPlatformAdapter` — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PxInternalAnimatorOptions` | ▪ `PxAnimatorOptions` plus `adapter` — the frame loop's custom render target (`PxPlatformAdapter`: `isConnected()` + `setAttribute(id, name, value)`). What the React and Vue components build the player with, so writes go to the elements they rendered; not an option of the public API, because a page has a DOM to write to |
| `renderNode(node, defs?, diag?)` → `toDomProps(props)` | ○ render one wire node to a DOM element / resolve a node's attributes. `diag` is optional — without it a blocked tag is reported on the console |
| `validateDocument(doc)` | ● the whole-document check — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `generateNewIds` | ○ document tooling — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PX_ANIMATOR_DOC_KEY` | ▪ attribute and property names the player writes |
| `createVisibilityGate(root, trigger, host)`, `PLAY_WHEN_VISIBLE_DEFAULTS`, `PxVisibilityGate`, `PxGateHost`, `PxGateTrigger` | ▪ the gate `setupAnimationTriggers` wires for every document — it opens at `visibilityThreshold`, closes only at zero visibility, waits out `visibilityDebounce` and treats a hidden tab as off screen. Exported so the CSS-only React and Vue wrappers gate on the same rules rather than each growing their own observer |
| `px`, `PxNodeBaseSchema`, `PxSvgNodeRootSchema`, `PxAnimatorConfigSchema`, `PxTriggerSchema`, `PxScrollSchema`, `PxDefinitionsSchema`, `PxSchema`, `PxInfer`, `PxValidationContext` | ○ the schema toolkit, re-exported from core — the schema values and the types to build on them |
| `PxDiagnosticsConfig`, `PxDiagnostic`, `PxDiagnosticKind` | ● the diagnostics channel every surface shares — re-exported for the React and Vue components; spelled out in [the API at a glance](./README.md#the-api-at-a-glance) |
| `PxTimelineEngineSetting`, `PxFillMode`, `PxPlaybackDirection`, `PxTriggerStart` | ● named wire values — one const per wire enum, with the string type derived from it under the same name. `PxTimelineEngineSetting` is what `timeline.engine` accepts (`auto` · `native` · `js`); `PxTimelineEngine` is the resolved engine (`native` · `js`), the argument of `materializeAllInTree`, never an option. `PxUnits` covers `gradientUnits` and the mask units alike |
| `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTrigger`, `PxBinding`, `PxDefinitions` | ● wire types — the shapes in [the JSON format](../format/README.md#schema-at-a-glance) |
| `PxAnimatorOptions`, `PxTagAnimatorOptions`, `PxAnimatorApi`, `PxPlaybackApi`, `PxAnimatorCallbacks`, `PxEngineCallbacks`, `PxPlaybackOverride`, `PxTimelinePatch`, `PxPlatformAdapter` | ● / ○ companion types of the calls above |

**Core only**: `flattenAnimatorTimeline` / `nestAnimatorTimeline`, the engine rules
(`resolveTimelineEngine`, …) and the scroll maths.

## Related

- [Playback settings & triggers](./playback-and-triggers.md) — every `animator` field and how to override it
- [JSON format reference](../format/README.md#json-format-reference)
- [Troubleshooting](./troubleshooting.md)

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)
