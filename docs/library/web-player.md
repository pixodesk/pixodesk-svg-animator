# Web player — `@pixodesk/svg-animator-web`

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)

Use this on a plain web page — or anywhere you write JavaScript without a framework — to play
a JSON animation with full control. Hand it the document and it builds the SVG DOM, drives the
animation with the Web Animations API or a frame loop, and wires up hover / click / scroll
triggers for you. It ships as ESM, CJS and UMD (global `Pixodesk.SvgAnimator`), so it fits a
bundler or a plain `<script>` tag equally well.

```bash
npm install @pixodesk/svg-animator-web
```

## Ways to use it

### Declarative — `data-px-animation-src`

> **Example:** [`web/declarative`](../../examples/docs-examples/src/cases/web/declarative/) — `pnpm example:docs`, then open `#web/declarative`.

Point an element at the JSON file and call `loadTagSvgAnimators()` once the DOM is ready. The
script is the UMD build, copied from the npm package into your site — see
[Installing the players (overview)](./installation.md#builds--esm-cjs-and-umd):

```html
<div data-px-animation-src="/bouncing-ball.json" style="width: 300px; height: 300px"></div>

<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>Pixodesk.SvgAnimator.loadTagSvgAnimators();</script>
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
      "outTime": 1000,
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
        "transform": {
          "keyframes": [
            { "time": 0,    "value": { "translate": [200, 60] },  "easing": [0.33, 0, 0.67, 0.33] },
            { "time": 1000, "value": { "translate": [200, 340] } }
          ]
        }
      }
    }
  ]
}
```

Every matching element gets its own animator, stored on the element as `element._px_animator`
(the [playback API](#the-playback-api) below). Calling `loadTagSvgAnimators()` again only picks up
elements that do not have an animator yet, so it is safe to call after inserting new content.

### Programmatic — `createSvgAnimator(options)`

> **Example:** [`web/programmatic`](../../examples/docs-examples/src/cases/web/programmatic/) — `pnpm example:docs`, then open `#web/programmatic`.

Use `createSvgAnimator` when you want to start the animation from code, react to what it does,
or control it after it has loaded. It returns the playback API at once — even while the
document is still loading from a URL.

```html
<div id="hero" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimator } from '@pixodesk/svg-animator-web';
import animationDoc from './bouncing-ball.json';

// from a URL — returns immediately; control calls made before the file loads are
// queued and replayed in order once it is ready
const animator = createSvgAnimator({
  src: '/bouncing-ball.json',
  container: '#hero',
  playAsSaved: true,            // play the way the editor saved it; without it, nothing starts
  onFinish: () => console.log('done'),
});

// or from a document object you already have — imported, fetched, or built in code
const animator2 = createSvgAnimator({ doc: animationDoc, container: document.getElementById('hero'), playAsSaved: true });

animator.play();
```

#### Options

<!-- px-check signature pkg=web -->
```typescript
// Create a player. Provide exactly one of `src` / `doc` — both, or neither, throws.
// With `src`, control calls made before the fetch resolves are queued and replayed in
// order, so `createSvgAnimator({ src }).play()` works as written. A failed fetch or an
// invalid document reaches `onError` — and `console.error` when no handler is given;
// `isReady()` stays false either way.
function createSvgAnimator(options: PxAnimatorOptions): PxAnimatorApi;

interface PxAnimatorOptions {
    playAsSaved?: boolean;                 // play the way the editor saved it — the document's own
                                           //   trigger starts and gates playback. WITHOUT it the
                                           //   animator builds still (trigger start forced to
                                           //   'none') and the returned api drives it
    src?: string;                          // URL to fetch the JSON document from
    doc?: PxDocumentInput;                 // …or the document inline (a .json import passes as-is)
    container?: string | Element;          // CSS selector or element to render into (its content is
                                           //   replaced). Omit it to animate an SVG already in the
                                           //   page, found by the document's `id`

    // Callbacks, inline: `PxAnimatorCallbacks`, the one shape every player takes — see
    // Callbacks below; the shape itself is spelled out once, in the library overview
    onReady?: () => void;   // the animator exists and the SVG is rendered — once, async;
                            //   the push twin of isReady() (no more polling with `src`)
    onPlay?: () => void;    onPause?: () => void;    onCancel?: () => void;
    onFinish?: () => void;  onDestroy?: () => void;   onStop?: () => void;
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
    inTime?: number;                       // ▸ timeline.inTime — the content window's start, ms
    outTime?: number;                     // ▸ timeline.outTime — …and its end (one pass plays the window)
    playDuration?: number;                // ▸ timeline.playDuration — the window in wall ms (slower / faster)
    delay?: number;                        // ▸ timeline.delay, ms; negative skips ahead
    iterations?: number | 'infinite';      // ▸ timeline.iterations
    start?: 'load' | 'mouseOver' | 'click' | 'none';
                                           // ▸ timeline.trigger.start — a shortcut wins over
                                           //   the same key in `timeline`
    offScreen?: PxOffScreenAction;         // ▸ timeline.trigger.offScreen
    mouseOut?: PxMouseOutAction;           // ▸ timeline.trigger.mouseOut (for start: 'mouseOver')
    visibilityThreshold?: number;          // ▸ timeline.trigger.visibilityThreshold (0–1)
    visibilityDebounce?: number;           // ▸ timeline.trigger.visibilityDebounce (ms)
}
```

By default there is nothing to configure: the player takes the window, iterations, direction,
what starts the animation and the engine from the `animator` block inside the JSON — the
settings you chose in the editor. So a file plays the way it was designed.

`timeline` is there for when one page needs it to play differently — the same file mounted twice
at two speeds. For your own transport UI there is nothing to override: just leave `playAsSaved`
out, and nothing starts until you say so:

```js
const animator = createSvgAnimator({
  src: '/bouncing-ball.json',
  container: '#box',
  timeline: { iterations: 'infinite' },
});
animator.play();
```

The merge is per key, so everything you do not mention stays as the file has it. Full rules —
`null` to delete a key, what happens when the override changes the kind of timeline, and the
shortcut precedence — are in
[Playback settings & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
Every field and its meaning is in [Playback settings & triggers](./playback-and-triggers.md).

## The playback API

`createSvgAnimator` returns a `PxAnimatorApi`. Time is ms from the start of the whole run, every
iteration included; a seek is clamped to it; a rate of `0` is rejected — the same contract on
every player.

<!-- px-check signature pkg=web -->
```typescript
// Playback control returned by `createSvgAnimator` — core's `PxAnimatorApi<Element>`.
interface PxAnimatorApi {
    isReady(): boolean;                    // true once a `src` document has loaded and rendered
    getRootElement(): Element | null;      // the rendered <svg>; null before ready
    isPlaying(): boolean;                  // true while running
    play(): void;                          // start, or resume from the current time; on a finished
                                           //   animation, rewinds and plays again
    pause(): void;                         // hold the current frame
    cancel(): void;                        // stop and reset to the start state
    finish(): void;                        // jump to the end and hold the final state; fires onFinish
    playOnce(): void;                      // ONE fresh pass from the start, whatever `iterations`
                                           //   say — a loop-configured document plays a single pass,
                                           //   then settles per the file's `finish`
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, 0.5 half, negative plays backwards;
                                           //   0 and non-finite are rejected with a warning — use pause()
    getDuration(): number | null;          // ONE pass of the content window, ms — the slider
                                           //   maximum nobody hard-codes; null before a `src` loads
    getCurrentTime(): number | null;       // ms from the start of the whole run; null before a
                                           //   `src` document has loaded
    setCurrentTime(time: number): void;    // seek, ms; clamped to [0, duration × iterations]. Paused,
                                           //   the animation shows that frame and stays — a slider
                                           //   steps through it this way; playing, it continues from there
    getCurrentProgress(): number | null;   // the same position as 0–1 of the whole run; null before ready
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run (clamped)
    destroy(): void;                       // stop, remove the SVG it rendered, release everything; fires onDestroy
}
```

```html
<div id="hero" style="width: 300px; height: 300px"></div>
<input id="time-slider" type="range" min="0" value="0">
```

```js
import { createSvgAnimator } from '@pixodesk/svg-animator-web';

const slider = document.querySelector('#time-slider');
const animator = createSvgAnimator({
  src: '/bouncing-ball.json',
  container: '#hero',
  // §14: no polling isReady(), no hard-coded maximum — the document knows its own length
  onReady: () => { slider.max = String(animator.getDuration()); },
});

slider.addEventListener('input', () => {
  animator.pause();
  animator.setCurrentTime(Number(slider.value));   // from 0 to getDuration(), in ms
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
import { createSvgAnimator } from '@pixodesk/svg-animator-web';
import doc from './bouncing-ball.json';

createSvgAnimator({
  doc: doc,
  container: '#box',
  playAsSaved: true,
  onPlay:   () => {},   // started or resumed
  onPause:  () => {},   // paused
  onCancel: () => {},   // canceled (reset)
  onFinish: () => {},   // finished naturally, or finish() was called
  onDestroy: () => {},   // destroyed

  onWarn:  (d) => {},   // d = { code, kind, data? }; else console.warn
  onError: (d) => {},   // d = { code, kind, data?, error }; else console.error
  muteWarn: false,      // true: no console.warn — you know about the warnings and tolerate them
  muteError: false,     // true: no console.error
});
```

## Triggers

> **Example:** [`web/triggers`](../../examples/docs-examples/src/cases/web/triggers/) — `pnpm example:docs`, then open `#web/triggers`.

If the document says `trigger.start: 'click'` (or `'mouseOver'`), the player listens for that
event on the rendered SVG for you, and `mouseOut` (pause / continue / reset / reverse) is
honored. With `'load'` it starts as soon as enough of it is on screen (`visibilityThreshold`),
and with the default `offScreen: 'pause'` it pauses while scrolled out of view. With `'none'`
nothing happens until you call `play()`.

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

To put several animations on one page — different files, or even the same JSON file more than
once — give each one its own element and call `loadTagSvgAnimators()` once. Every element gets its own
independent animator, so the copies play, pause and finish on their own.

```html
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
```

```js
import { loadTagSvgAnimators } from '@pixodesk/svg-animator-web';

loadTagSvgAnimators();

// Calling it again is safe: only elements without an animator are picked up.
loadTagSvgAnimators();
```

Showing the same JSON file twice is safe here, unlike inlining the same pre-rendered SVG twice:
each instance gives the document fresh element ids, so the copies do not clash. From code, give
the second copy fresh ids yourself:

```js
// Two copies of one animation on a page (ids must stay unique)
import { createSvgAnimator, generateNewIds } from '@pixodesk/svg-animator-web';

createSvgAnimator({ doc: doc, container: '#first', playAsSaved: true });
createSvgAnimator({ doc: generateNewIds(doc), container: '#second', playAsSaved: true });
```

## Every animator on the page (experimental)

> **Experimental.** The registry is not settled yet: the event names, what
> `getAll()` includes (the pre-rendered builds, an animator whose `src` is still loading) and
> the `__pixodeskSvgAnimators` global may change without a major version change. Use it for dev
> tooling and tests; expect to adjust your code as new versions come out.

The players keep a page-wide registry — the same idea as lottie-web's
`getRegisteredAnimations()`. Every animator built by this package (`createSvgAnimator`,
`loadTagSvgAnimators`, the pre-rendered builds, the React and Vue components) is listed from the
moment it exists until its `destroy()`, and announces its playback changes. One registry per
window, whatever the bundling: an ESM import in one script and the UMD build in another see
the same list.

<!-- px-check signature pkg=web -->
```typescript
function getAllSvgAnimators(): ReadonlyArray<PxAnimatorApi>;
function onSvgAnimatorsChange(listener: PxAnimatorsListener): () => void;

type PxAnimatorsEvent = 'add' | 'remove' | 'play' | 'pause' | 'cancel' | 'finish';
type PxAnimatorsListener = (event: PxAnimatorsEvent, animator: PxAnimatorApi) => void;

interface PxAnimatorRegistry {
    getAll(): ReadonlyArray<PxAnimatorApi>;
    subscribe(listener: PxAnimatorsListener): () => void;
}
```

`getAllSvgAnimators()` returns the live animators in creation order. `onSvgAnimatorsChange` hears
every animator appear (`add`), start (`play`), pause, cancel, finish and go (`remove`); an
animator's own `onPlay` / `onPause` / … callbacks run first. It returns the unsubscribe.

```js
import { getAllSvgAnimators, onSvgAnimatorsChange } from '@pixodesk/svg-animator-web';

// Pause everything while the tab is hidden, resume what was playing when it is back.
let paused = [];
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        paused = getAllSvgAnimators().filter(a => a.isPlaying());
        paused.forEach(a => a.pause());
    } else {
        paused.forEach(a => a.play());
        paused = [];
    }
});

// A dev panel: how many are playing right now?
onSvgAnimatorsChange(() => {
    console.log(getAllSvgAnimators().filter(a => a.isPlaying()).length, 'playing');
});
```

The same store is reachable **by name** as `globalThis.__pixodeskSvgAnimators` — a
`PxAnimatorRegistry` with `getAll()` and `subscribe()` — for tooling that reads a page it did
not build (a devtools panel, a test harness) without importing the library. Web only: the
React Native player keeps no registry.

## Cleaning up

> **Example:** [`web/cleanup`](../../examples/docs-examples/src/cases/web/cleanup/) — `pnpm example:docs`, then open `#web/cleanup`.

Call `destroy()` when the container goes away (route change, modal close). `onDestroy` fires
once. Frameworks: the React and Vue components do this on unmount.


## API reference

The calls above are spelled out where they are used: `createSvgAnimator` and its options under
[Programmatic](#programmatic--createsvganimatoroptions), the returned `PxAnimatorApi` under
[The playback API](#the-playback-api). The callbacks and diagnostics are one shape on every
player, written out once in [the API at a glance](./README.md#the-api-at-a-glance). The rest:

<!-- px-check signature pkg=web -->
```typescript
// Scan the page for `<div data-px-animation-src="animation.json">` and create one
// player per match, rendered into that element and stored on it. Safe to call
// repeatedly: elements that already carry a player are skipped. Nothing calls it for
// you. `options` — everything `createSvgAnimator` takes except `src` / `doc` /
// `container` — applies to EVERY player this call creates; omit it for zero-config.
function loadTagSvgAnimators(options?: PxTagAnimatorOptions): void;

// Wire a player to a DOM trigger. `createSvgAnimator` already does this from the
// document's own `animator.timeline.trigger`, and ties the disposer to `destroy()`.
// Use it after you have replaced the rendered SVG yourself (the player's listeners went
// with the old elements). To change the trigger, use `timeline`. Returns a DISPOSER that
// detaches everything this call attached — call it before re-arming an element you
// wired by hand, or the old listeners stay live next to the new ones. Reads `start` /
// `mouseOut` / `visibilityThreshold`; `finish` is the player's, not the
// trigger wiring's. `diag` is optional: omit it and anything this has to say goes to
// the console.
function setupAnimationTriggers(api: PxEngineAnimatorApi, trigger: PxTrigger,
                                diag?: PxDiagnostics): () => void;

interface PxTrigger {                                  // also a wire type — the JSON format page
    start?: 'load' | 'mouseOver' | 'click' | 'none';   // what STARTS it; default 'load';
                                                       //   'none' waits for play()
    offScreen?: 'pause' | 'continue' | 'reset';        // while nobody can see it; default 'pause'
    mouseOut?: 'continue' | 'pause' | 'reset' | 'reverse'; // pointer leaves; default 'continue'
    visibilityThreshold?: number;                      // 0–1 visible ratio; default 0.5; 0 = any visible pixel
    visibilityDebounce?: number;                       // ms it must hold first; default 150
}
```

**Builds.** The ESM and CJS entries (`dist/index.js`, `dist/index.cjs`) carry everything on this
page. The `<script>` builds put a smaller set of functions on one global, `window.Pixodesk.SvgAnimator`
(the files themselves: [Installing the players](./installation.md#builds--esm-cjs-and-umd)):

<!-- px-check off the UMD file list, prose -->
| File | For | On `Pixodesk.SvgAnimator` |
|---|---|---|
| `pixodesk-svg-animator.umd.min.js` | a page playing JSON documents | `create` (= `createSvgAnimator`), `bind` (= `bindSvgAnimator`), `loadTagSvgAnimators`, `setupAnimationTriggers`, `validateDocument`, `generateNewIds`, `PxTimelineEngineSetting`, `PxTimelineEngine`, `PX_ANIMATOR_DOC_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME` |
| `index.prerendered.umd.min.js` | a pre-rendered SVG + JS export (engine `auto` / `js`) | `bind(options: PxPrerenderedAnimatorOptions)`, `setupAnimationTriggers`, `PX_ANIMATOR_DOC_KEY` |
| `index.prerendered-waapi.umd.min.js` | the same with engine `native` — the smallest build | the same as the line above |

`PxPrerenderedAnimatorOptions` is `{ doc: PxDocumentInput }` plus the inline callbacks. Its `doc`
carries only `animator.definitions` and `animator.bindings` — the SVG is already in the page —
and it is not validated. There is no `src` form.

<!-- px-check signature pkg=web -->
```typescript
// Bind a pre-rendered SVG that is already on the page — what an SVG + JS export's script calls,
// as `Pixodesk.SvgAnimator.bind(…)`. Every build has it; only the full build also has `create`.
function bindSvgAnimator(options: PxPrerenderedAnimatorOptions): PxAnimatorApi;
```

**Globals.** Importing the player writes nothing to `window`. `<script>` pages reach the player's
functions through `Pixodesk.SvgAnimator.*` on the UMD build — `createSvgAnimator` is the member `create`
there and `bindSvgAnimator` the member `bind`; ESM and CJS consumers import what they need. A tool that writes a script for those pages (an
exporter) builds the call from `PX_PLAYER_GLOBAL`, `PX_PLAYER_CREATE` and `PX_PLAYER_BIND` instead of spelling it. Separately, a document with `animator.debugGlobalName: "heroBanner"` makes the player
assign its API object to `window.heroBanner`, so a live instance can be driven from the console —
opt-in per document; see [Playback & triggers → Debug handle](./playback-and-triggers.md#debug-handle--debugglobalname).

**Everything else this package exports** — ● user-facing · ○ advanced · ▪ internal, as in
[the API at a glance](./README.md#the-api-at-a-glance):

<!-- px-check exports @pixodesk/svg-animator-web -->
| Identifier | Audience · what it is for |
|---|---|
| `createSvgAnimator(options)`, `bindSvgAnimator(options)`, `loadTagSvgAnimators(options?)`, `setupAnimationTriggers(api, trigger, diag?)` | ● the player — above |
| `getAllSvgAnimators()`, `onSvgAnimatorsChange(listener)`, `PxAnimatorRegistry`, `PxAnimatorsEvent`, `PxAnimatorsListener` | ● **experimental** — [every animator on the page](#every-animator-on-the-page-experimental): the window-wide registry, also `globalThis.__pixodeskSvgAnimators`; not settled, may change without a major version |
| `createAdapterSvgAnimator(doc, adapter, callbacks?)` | ○ the frame-loop engine against a custom `PxPlatformAdapter` — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PxInternalAnimatorOptions` | ▪ `PxAnimatorOptions` plus `adapter` — the frame loop's custom render target (`PxPlatformAdapter`: `isConnected()` + `setAttribute(id, name, value)`). What the React and Vue components build the player with, so writes go to the elements they rendered; not an option of the public API, because a page has a DOM to write to |
| `renderNode(node, defs?, diag?)` → `toDomProps(props)` | ○ render one wire node to a DOM element / resolve a node's attributes. `diag` is optional — without it a blocked tag is reported on the console |
| `validateDocument(doc)` | ● the whole-document check — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `generateNewIds` | ○ document tooling — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PX_ANIMATOR_DOC_KEY` | ▪ attribute and property names the player writes |
| `PX_PLAYER_GLOBAL`, `PX_PLAYER_CREATE`, `PX_PLAYER_BIND` | ○ the `<script>` builds' global (`'Pixodesk.SvgAnimator'`) and its two members, `'create'` and `'bind'` — for tools that emit a call to it |
| `createVisibilityGate(root, trigger, host)`, `PLAY_WHEN_VISIBLE_DEFAULTS`, `PxVisibilityGate`, `PxGateHost`, `PxGateTrigger` | ▪ the gate `setupAnimationTriggers` wires for every document — it opens at `visibilityThreshold`, closes only at zero visibility, waits out `visibilityDebounce` and treats a hidden tab as off screen. Exported so the CSS-only React and Vue wrappers gate on the same rules rather than each growing their own observer |
| `px`, `PxNodeBaseSchema`, `PxSvgNodeRootSchema`, `PxAnimatorConfigSchema`, `PxTriggerSchema`, `PxScrollSchema`, `PxDefinitionsSchema`, `PxSchema`, `PxInfer`, `PxValidationContext` | ○ the schema toolkit, re-exported from core — the schema values and the types to build on them |
| `PxDiagnosticsConfig`, `PxDiagnostic`, `PxDiagnosticKind` | ● the diagnostics every player shares — re-exported for the React and Vue components; spelled out in [the API at a glance](./README.md#the-api-at-a-glance) |
| `PxTimelineEngineSetting`, `PxFillMode`, `PxPlaybackDirection`, `PxTriggerStart` | ● named wire values — one const per wire enum, with the string type derived from it under the same name. `PxTimelineEngineSetting` is what `timeline.engine` accepts (`auto` · `native` · `js`); `PxTimelineEngine` is the resolved engine (`native` · `js`), the argument of `materializeAllInTree`, never an option. `PxUnits` covers `gradientUnits` and the mask units alike |
| `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTrigger`, `PxBinding`, `PxDefinitions` | ● wire types — the shapes in [the JSON format](../format/README.md#schema-at-a-glance) |
| `PxAnimatorOptions`, `PxTagAnimatorOptions`, `PxAnimatorApi`, `PxAnimatorCallbacks`, `PxEngineCallbacks`, `PxPlaybackOverride`, `PxTimelinePatch`, `PxPlatformAdapter` | ● / ○ companion types of the calls above |

**Core only**: `prepareDocument` / `nestAnimatorTimeline`, the engine rules
(`resolveTimelineEngine`, …) and the scroll maths.

## Related

- [Playback settings & triggers](./playback-and-triggers.md) — every `animator` field and how to override it
- [JSON format reference](../format/README.md#json-format-reference)
- [Troubleshooting](./troubleshooting.md)

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)
