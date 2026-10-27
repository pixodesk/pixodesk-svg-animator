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

Point an element at the JSON file and call `createSvgAnimationPlayersFromPage()` once the DOM is ready. The
script is the UMD build, copied from the npm package into your site — see
[Installing the players (overview)](./installation.md#builds--esm-cjs-and-umd):

```html
<div data-px-animation-src="/bouncing-ball.json" style="width: 300px; height: 300px"></div>

<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>Pixodesk.SvgAnimator.createSvgAnimationPlayersFromPage();</script>
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
      "iterationDirection": "alternate",
      "trigger": { "playOn": "load" }
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

Every matching element gets its own player (the [playback API](#the-playback-api) below):
`createSvgAnimationPlayersFromPage()` returns the ones it created, and `getSvgAnimationPlayer(element)` finds an
element's later. Calling `createSvgAnimationPlayersFromPage()` again only picks up elements that do not have
a player yet, so it is safe to call after inserting new content.

### Programmatic — `createSvgAnimationPlayer(options)`

> **Example:** [`web/programmatic`](../../examples/docs-examples/src/cases/web/programmatic/) — `pnpm example:docs`, then open `#web/programmatic`.

Use `createSvgAnimationPlayer` when you want to start the animation from code, react to what it does,
or control it after it has loaded. It returns the playback API at once — even while the
document is still loading from a URL.

```html
<div id="hero" style="width: 300px; height: 300px"></div>
```

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import animationDoc from './bouncing-ball.json';

// from a URL — returns immediately; control calls made before the file loads are
// queued and replayed in order once it is ready
const player = createSvgAnimationPlayer({
  src: '/bouncing-ball.json',
  container: '#hero',
  playOnTrigger: true,            // play the way the editor saved it — the file's own trigger; without it, nothing starts
  onFinish: () => console.log('done'),
});

// or from a document object you already have — imported, fetched, or built in code
const player2 = createSvgAnimationPlayer({ doc: animationDoc, container: document.getElementById('hero'), playOnTrigger: true });

player.play();
```

#### Options

<!-- px-check signature pkg=web -->
```typescript
// Create a player. Provide exactly one of `src` / `doc` — both, or neither, throws.
// With `src`, control calls made before the fetch resolves are queued and replayed in
// order, so `createSvgAnimationPlayer({ src }).play()` works as written. A failed fetch or an
// invalid document reaches `onError` — and `console.error` when no handler is given;
// `isReady()` stays false either way.
function createSvgAnimationPlayer(options: PxAnimationPlayerOptions): PxAnimationPlayerApi;

interface PxAnimationPlayerOptions {
    // The driver. `true` — play the way the editor saved it: the document's own `timeline.trigger`
    // starts, pauses and stops it, behind the visibility gate. An OBJECT — that trigger INSTEAD
    // of the file's, as a whole (keys left out take the format's defaults, not the file's).
    // WITHOUT it the player builds still — the first frame shows, the trigger is replaced by an
    // empty one — and the returned api (`play()`, `setCurrentTime()`) drives it.
    playOnTrigger?: boolean | PxTrigger;
    src?: string;                          // URL to fetch the JSON document from
    doc?: PxDocumentInput;                 // …or the document inline (a .json import passes as-is)
    container?: string | Element;          // CSS selector or element to render into (its content is
                                           //   replaced). Omit it to animate an SVG already in the
                                           //   page, found by the document's `id`

    // Callbacks, inline: `PxAnimationPlayerCallbacks`, the one shape every player takes — see
    // Callbacks below; the shape itself is spelled out once, in the library overview
    onReady?: () => void;   // the player exists and the SVG is rendered — once, async;
                            //   the push twin of isReady() (no more polling with `src`)
    onPlay?: () => void;    onPause?: () => void;    onCancel?: () => void;
    onFinish?: () => void;  onDestroy?: () => void;   onStop?: () => void;
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean;  muteError?: boolean;

    // Per-instance playback override: `PxPlaybackOverride`; the document is never modified.
    // The merge rules: Playback settings & triggers → Overriding from a player
    timeline?: PxTimelinePatch;            // deep-merged over the document's `timeline` block —
                                           //   same shape as the file, minus `trigger` (that is
                                           //   `playOnTrigger`'s). `null` at a slot DELETES that key
}
```

By default there is nothing to configure: the player takes the window, iterations, iteration
direction, what plays and stops the animation, how those transitions look and the engine from the
`animator` block inside the JSON — the settings you chose in the editor. So a file plays the way
it was designed.

`timeline` is there for when one page needs it to play differently — the same file mounted twice
at two speeds, or a heartbeat that should finish its beat before it stops. For your own transport
UI there is nothing to override: just leave `playOnTrigger` out, and nothing starts until you say so:

```js
const player = createSvgAnimationPlayer({
  src: '/bouncing-ball.json',
  container: '#box',
  timeline: { iterations: 'infinite', completeIterationOnPlayOff: true },
});
player.play();
player.stop();   // finishes the current iteration, then rests
```

The merge is per key, so everything you do not mention stays as the file has it. To use another
trigger than the file's, give `playOnTrigger` the trigger itself —
`playOnTrigger: { playOn: 'hoverIn', pauseOn: 'hoverOut' }` — which replaces the file's block as
a whole. Full rules — `null` to delete a key, what happens when the override changes the kind of
timeline — are in
[Playback settings & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
Every field and its meaning is in [Playback settings & triggers](./playback-and-triggers.md).

## The playback API

`createSvgAnimationPlayer` returns a `PxAnimationPlayerApi`. Time is ms from the start of the whole run, every
iteration included; a seek is clamped to it; a rate of `0` is rejected — the same contract on
every player.

<!-- px-check signature pkg=web -->
```typescript
// Playback control returned by `createSvgAnimationPlayer` — core's `PxAnimationPlayerApi<Element>`.
interface PxAnimationPlayerApi {
    isReady(): boolean;                    // true once a `src` document has loaded and rendered
    getRootElement(): Element | null;      // the rendered <svg>; null before ready
    isPlaying(): boolean;                  // true while running
    play(): void;                          // the play-on: paused → continues from there; otherwise per
                                           //   the timeline's `playOnAction` (resume — a fresh run from
                                           //   the start when it is at the start or the end; restart;
                                           //   jumpToEnd)
    pause(): void;                         // hold the current frame
    stop(): void;                          // the play-off, per the timeline: `playOffAction` (reset or
                                           //   rewind), after the current iteration when
                                           //   `completeIterationOnPlayOff` — what a `playOff` event does
    cancel(): void;                        // the unconditional reset-now: stop and show the start state
    finish(): void;                        // jump to the end and hold the final state; fires onFinish
    playOnce(): void;                      // ONE fresh pass from the start, whatever `iterations`
                                           //   say — a loop-configured document plays a single pass,
                                           //   then settles per the file's `playEndAction`
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
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const slider = document.querySelector('#time-slider');
const player = createSvgAnimationPlayer({
  src: '/bouncing-ball.json',
  container: '#hero',
  // §14: no polling isReady(), no hard-coded maximum — the document knows its own length
  onReady: () => { slider.max = String(player.getDuration()); },
});

slider.addEventListener('input', () => {
  player.pause();
  player.setCurrentTime(Number(slider.value));   // from 0 to getDuration(), in ms
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
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';
import doc from './bouncing-ball.json';

createSvgAnimationPlayer({
  doc: doc,
  container: '#box',
  playOnTrigger: true,
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

With `playOnTrigger`, the player listens on the rendered SVG for every event the document's
`timeline.trigger` lists — `hoverIn` / `hoverOut` (`mouseenter` / `mouseleave`), `click` — and
reads each one by the state rule: a `playOn` event acts while stopped, `pauseOn` while playing,
`pauseOff` while paused, `playOff` while playing or paused. HOW the transition looks is the
timeline's (`playOnAction`, `playOffAction`, `completeIterationOnPlayOff`). A `load` listing
starts it as soon as enough of it is on screen (`inViewThreshold`), and with the default
`outOfViewAction: 'pause'` it pauses while scrolled out of view. An empty trigger (`{}`) lists
nothing: nothing happens until you call `play()`. The lists, the events and the rule are on
[Playback settings & triggers → Triggers](./playback-and-triggers.md#triggers--when-it-plays).

`setupAnimationTriggers(api, config)` is exported for one rare case: you have replaced the
rendered SVG yourself, so the listeners the player attached are gone with the old elements, and
you need to attach them to the new ones.

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
once — give each one its own element and call `createSvgAnimationPlayersFromPage()` once. Every element gets its own
independent player, so the copies play, pause and finish on their own.

```html
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
<div class="stage" data-px-animation-src="/bouncing-ball.json"></div>
```

```js
import { createSvgAnimationPlayersFromPage } from '@pixodesk/svg-animator-web';

createSvgAnimationPlayersFromPage();

// Calling it again is safe: only elements without a player are picked up.
createSvgAnimationPlayersFromPage();
```

Showing the same JSON file twice is safe here, unlike inlining the same pre-rendered SVG twice:
each instance gives the document fresh element ids, so the copies do not clash. The same holds
from code — `createSvgAnimationPlayer` with a `container` always renders with fresh ids:

```js
// Two copies of one animation on a page — no id handling needed
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

createSvgAnimationPlayer({ doc: doc, container: '#first', playOnTrigger: true });
createSvgAnimationPlayer({ doc: doc, container: '#second', playOnTrigger: true });
```

## Every player on the page (experimental)

> **Experimental.** The registry is not settled yet: the event names, what
> `getAll()` includes (the pre-rendered builds, a player whose `src` is still loading) and
> the `__pixodeskSvgAnimationPlayers` global may change without a major version change. Use it for dev
> tooling and tests; expect to adjust your code as new versions come out.

The players keep a page-wide registry — the same idea as lottie-web's
`getRegisteredAnimations()`. Every player built by this package (`createSvgAnimationPlayer`,
`createSvgAnimationPlayersFromPage`, the pre-rendered builds, the React and Vue components) is listed from the
moment it exists until its `destroy()`, and announces its playback changes. One registry per
window, whatever the bundling: an ESM import in one script and the UMD build in another see
the same list.

<!-- px-check signature pkg=web -->
```typescript
function getAllSvgAnimationPlayers(): ReadonlyArray<PxAnimationPlayerApi>;
function onSvgAnimationPlayersChange(listener: PxAnimationPlayersListener): () => void;

type PxAnimationPlayersEvent = 'add' | 'remove' | 'play' | 'pause' | 'cancel' | 'finish';
type PxAnimationPlayersListener = (event: PxAnimationPlayersEvent, animator: PxAnimationPlayerApi) => void;

interface PxAnimationPlayerRegistry {
    getAll(): ReadonlyArray<PxAnimationPlayerApi>;
    subscribe(listener: PxAnimationPlayersListener): () => void;
}
```

`getAllSvgAnimationPlayers()` returns the live players in creation order. `onSvgAnimationPlayersChange` hears
every player appear (`add`), start (`play`), pause, cancel, finish and go (`remove`); an
player's own `onPlay` / `onPause` / … callbacks run first. It returns the unsubscribe.

Code that cannot import the library — a page script next to a pre-rendered SVG, whose embedded
player keeps itself to itself, or a tool's iframe — reaches the same registry by name:
`window.__pixodeskSvgAnimationPlayers.getAll()` (the name is exported as `PX_ANIMATION_PLAYER_REGISTRY_GLOBAL`).

```js
import { getAllSvgAnimationPlayers, onSvgAnimationPlayersChange } from '@pixodesk/svg-animator-web';

// Pause everything while the tab is hidden, resume what was playing when it is back.
let paused = [];
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        paused = getAllSvgAnimationPlayers().filter(a => a.isPlaying());
        paused.forEach(a => a.pause());
    } else {
        paused.forEach(a => a.play());
        paused = [];
    }
});

// A dev panel: how many are playing right now?
onSvgAnimationPlayersChange(() => {
    console.log(getAllSvgAnimationPlayers().filter(a => a.isPlaying()).length, 'playing');
});
```

The same store is reachable **by name** as `globalThis.__pixodeskSvgAnimationPlayers` — a
`PxAnimationPlayerRegistry` with `getAll()` and `subscribe()` — for tooling that reads a page it did
not build (a devtools panel, a test harness) without importing the library. Web only: the
React Native player keeps no registry.

## Cleaning up

> **Example:** [`web/cleanup`](../../examples/docs-examples/src/cases/web/cleanup/) — `pnpm example:docs`, then open `#web/cleanup`.

Call `destroy()` when the container goes away (route change, modal close). `onDestroy` fires
once. Frameworks: the React and Vue components do this on unmount.


## API reference

The calls above are spelled out where they are used: `createSvgAnimationPlayer` and its options under
[Programmatic](#programmatic--createsvganimationplayeroptions), the returned `PxAnimationPlayerApi` under
[The playback API](#the-playback-api). The callbacks and diagnostics are one shape on every
player, written out once in [the API at a glance](./README.md#the-api-at-a-glance). The rest:

<!-- px-check signature pkg=web -->
```typescript
// Scan the page for `<div data-px-animation-src="animation.json">` and create one
// player per match, rendered into that element. Safe to call repeatedly: elements that
// already carry a player are skipped. Returns the players THIS call created. Nothing
// calls it for you. `options` — everything `createSvgAnimationPlayer` takes except `src` /
// `doc` / `container` — applies to EVERY player this call creates; omit it for zero-config.
function createSvgAnimationPlayersFromPage(options?: PxPageAnimationPlayerOptions): Array<PxAnimationPlayerApi>;

// The player `createSvgAnimationPlayersFromPage` created in `element`, or `undefined`.
function getSvgAnimationPlayer(element: Element): PxAnimationPlayerApi | undefined;

// Wire a player to the DOM events its document's trigger lists, behind the visibility gate.
// `createSvgAnimationPlayer` already does this from the document's own `animator.timeline`,
// and ties the disposer to `destroy()`. Use it after you have replaced the rendered SVG
// yourself (the player's listeners went with the old elements). `config` is the document's
// runtime view — `getAnimatorConfig(doc)` from core: the trigger, the gate keys and the play
// keys. To change the trigger, use `playOnTrigger`. Returns a DISPOSER that detaches
// everything this call attached — call it before re-arming an element you wired by hand, or
// the old listeners stay live next to the new ones. `diag` is optional: omit it and anything
// this has to say goes to the console.
function setupAnimationTriggers(api: PxEngineAnimationPlayerApi, config: PxAnimatorRuntimeConfig,
                                diag?: PxDiagnostics): () => void;

interface PxTrigger {                      // also a wire type — the JSON format page. WHEN only;
                                           //   each list is one event or an array of
                                           //   'load' | 'hoverIn' | 'hoverOut' | 'click'
    playOn?: PxTriggerEvents;              // acts while stopped — the play-on; absent block = 'load'
    playOff?: PxTriggerEvents;             // acts while playing or paused — the play-off
    pauseOn?: PxTriggerEvents;             // acts while playing — freeze
    pauseOff?: PxTriggerEvents;            // acts while paused — continue; absent = a copy of playOn
}
```

**Builds.** The ESM and CJS entries (`dist/index.js`, `dist/index.cjs`) carry everything on this
page. The `<script>` builds put a smaller set of functions on one global, `window.Pixodesk.SvgAnimator`
(the files themselves: [Installing the players](./installation.md#builds--esm-cjs-and-umd)):

<!-- px-check off the UMD file list, prose -->
| File | For | On `Pixodesk.SvgAnimator` |
|---|---|---|
| `pixodesk-svg-animator.umd.min.js` | a page playing JSON documents | `create` (= `createSvgAnimationPlayer`), `bind` (= `bindSvgAnimationPlayer`), `createSvgAnimationPlayersFromPage`, `setupAnimationTriggers`, `validateDocument`, `generateNewIds`, `PxTimelineEngineSetting`, `PxTimelineEngine`, `PX_ANIMATOR_DOC_KEY`, `PX_ANIM_ATTR_NAME`, `PX_ANIM_SRC_ATTR_NAME` |
| `index.prerendered.umd.min.js` | a pre-rendered SVG + JS export (engine `auto` / `js`) | `bind(options: PxPrerenderedAnimationPlayerOptions)`, `setupAnimationTriggers`, `PX_ANIMATOR_DOC_KEY` |
| `index.prerendered-waapi.umd.min.js` | the same with engine `native` — the smallest build | the same as the line above |

`PxPrerenderedAnimationPlayerOptions` is `{ doc: PxDocumentInput }` plus the inline callbacks. Its `doc`
carries only `animator.definitions` and `animator.bindings` — the SVG is already in the page —
and it is not validated. There is no `src` form.

<!-- px-check signature pkg=web -->
```typescript
// Bind a pre-rendered SVG that is already on the page — what an SVG + JS export's script calls,
// as `Pixodesk.SvgAnimator.bind(…)`. Every build has it; only the full build also has `create`.
function bindSvgAnimationPlayer(options: PxPrerenderedAnimationPlayerOptions): PxAnimationPlayerApi;
```

**Globals.** Importing the player writes nothing to `window`. `<script>` pages reach the player's
functions through `Pixodesk.SvgAnimator.*` on the UMD build — `createSvgAnimationPlayer` is the member `create`
there and `bindSvgAnimationPlayer` the member `bind`; ESM and CJS consumers import what they need. To drive a live instance from the console, use the page registry —
[Every player on the page](#every-player-on-the-page-experimental).

**Everything else this package exports** — ● user-facing · ○ advanced · ▪ internal, as in
[the API at a glance](./README.md#the-api-at-a-glance). Names marked **`/engine`** come from
`@pixodesk/svg-animator-web/engine`, the entry for player authors:

<!-- px-check exports @pixodesk/svg-animator-web -->
| Identifier | Audience · what it is for |
|---|---|
| `createSvgAnimationPlayer(options)`, `bindSvgAnimationPlayer(options)`, `createSvgAnimationPlayersFromPage(options?)`, `getSvgAnimationPlayer(element)`, `setupAnimationTriggers(api, config, diag?)` | ● the player — above |
| `getAllSvgAnimationPlayers()`, `onSvgAnimationPlayersChange(listener)`, `PxAnimationPlayerRegistry`, `PxAnimationPlayersEvent`, `PxAnimationPlayersListener`, `PX_ANIMATION_PLAYER_REGISTRY_GLOBAL` | ● **experimental** — [every player on the page](#every-player-on-the-page-experimental): the window-wide registry, also `globalThis.__pixodeskSvgAnimationPlayers` (that name: `PX_ANIMATION_PLAYER_REGISTRY_GLOBAL`); not settled, may change without a major version |
| `createAdapterSvgAnimationPlayer(doc, adapter, callbacks?)` | ○ **`/engine`** · the frame-loop engine against a custom `PxPlatformAdapter` — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PxInternalAnimationPlayerOptions` | ▪ `PxAnimationPlayerOptions` plus `adapter` — the frame loop's custom render target (`PxPlatformAdapter`: `isConnected()` + `setAttribute(id, name, value)`). What the React and Vue components build the player with, so writes go to the elements they rendered; not an option of the public API, because a page has a DOM to write to |
| `renderNode(node, defs?, diag?)` → `toDomProps(props)` | ○ **`/engine`** · render one wire node to a DOM element / resolve a node's attributes. `diag` is optional — without it a blocked tag is reported on the console |
| `validateDocument(doc)` | ● the whole-document check — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `generateNewIds` | ○ document tooling — see [the core library](../format/README.md#core-library--pixodesksvg-animator-core) |
| `PX_ANIMATOR_DOC_KEY` | ▪ attribute and property names the player writes |
| `PX_PLAYER_GLOBAL`, `PX_PLAYER_CREATE`, `PX_PLAYER_BIND` | ▪ the `<script>` builds' global (`'Pixodesk.SvgAnimator'`) and its two members, `'create'` and `'bind'` — the editor's SVG + JS export builds its call from them |
| `createVisibilityGate(root, gate, host)`, `PxVisibilityGate`, `PxGateHost` | ▪ the gate `setupAnimationTriggers` wires for every document — it opens at `inViewThreshold`, closes only at zero visibility, waits out `inViewDebounce` and treats a hidden tab as off screen; `gate` is core's `resolveGate(view)`, the host's verbs `start` / `hold` / `release` / `reset`. Exported so the CSS-only React and Vue wrappers gate on the same rules rather than each growing their own observer |
| `px`, `PxNodeBaseSchema`, `PxSvgNodeRootSchema`, `PxAnimatorConfigSchema`, `PxTriggerSchema`, `PxScrollSchema`, `PxDefinitionsSchema`, `PxSchema`, `PxInfer`, `PxValidationContext` | ○ the schema toolkit, re-exported from core — the schema values and the types to build on them |
| `PxDiagnosticsConfig`, `PxDiagnostic`, `PxDiagnosticKind` | ● the diagnostics every player shares — re-exported for the React and Vue components; spelled out in [the API at a glance](./README.md#the-api-at-a-glance) |
| `PxTimelineEngineSetting`, `PxFillMode`, `PxPlaybackDirection`, `PxTriggerEvent`, `PxTriggerEvents`, `PxPlayOnAction`, `PxPlayOffAction`, `PxPlayEndAction`, `PxOutOfViewAction` | ● named wire values — one const per wire enum, with the string type derived from it under the same name (`PxTriggerEvent.click` and `playOn?: PxTriggerEvents` come from one import). `PxTimelineEngineSetting` is what `timeline.engine` accepts (`auto` · `native` · `js`); `PxTimelineEngine` is the resolved engine (`native` · `js`), the argument of `materializeAllInTree`, never an option. `PxFillMode` is the engines' CSS-style fill mode derived from `showFirstFrameBeforePlayOn` + `playEndAction`, not a wire key |
| `PxDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTrigger`, `PxBinding`, `PxDefinitions` | ● wire types — the shapes in [the JSON format](../format/README.md#schema-at-a-glance) |
| `PxAnimationPlayerOptions`, `PxPageAnimationPlayerOptions`, `PxAnimationPlayerApi`, `PxAnimationPlayerCallbacks`, `PxEngineCallbacks`, `PxPlaybackOverride`, `PxPlaybackOverrideInput`, `PxTimelinePatch`, `PxTimelineWithoutTrigger`, `PxPlayExecutor`, `PxPlatformAdapter` (`/engine`) | ● / ○ companion types of the calls above. `PxPlaybackOverrideInput` is the override as `applyPlaybackOverride` reads it (`timeline` + the object form of `playOnTrigger`); `PxTimelineWithoutTrigger` the timeline minus its `trigger`, what `PxTimelinePatch` patches; `PxPlayExecutor` the player's one executor of play-on / play-off — [Playback settings & triggers → For player authors](./playback-and-triggers.md#for-player-authors--the-same-rules-exported) |

**Core only**: `prepareDocument` / `nestAnimatorTimeline`, the engine rules
(`resolveTimelineEngine`, …) and the scroll maths.

## Related

- [Playback settings & triggers](./playback-and-triggers.md) — every `animator` field and how to override it
- [JSON format reference](../format/README.md#json-format-reference)
- [Troubleshooting](./troubleshooting.md)

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)
