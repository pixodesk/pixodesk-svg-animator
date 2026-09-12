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

```js
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
      "trigger": { "startOn": "load" }
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
  callbacks: { onFinish: () => console.log('done') },
});

// or from a document object you already have — imported, fetched, or built in code
const animator2 = createAnimator({ data: animationDoc, container: document.getElementById('hero') });

animator.play();
```

#### Options

| Option | Type | Description |
|---|---|---|
| `src` | `string` | URL of the JSON document. Provide **either** `src` **or** `data` |
| `data` | `PxAnimatedSvgDocument` | the document object |
| `container` | `string \| Element` | CSS selector or element the SVG is rendered into |
| `callbacks` | `PxAnimatorCallbacksConfig` | lifecycle callbacks, see [Callbacks](#callbacks) |
| `adapter` | `PxPlatformAdapter` | advanced — a custom attribute writer for the frame loop (this is how the React and Vue packages route updates through their own DOM refs) |
| **Playback overrides** | | *(all optional — see below)* |
| `config` | `object \| string` | per-instance override of the document's `animator` block, deep-merged over it. Same shape as the file; `null` at any slot deletes that key. A JSON string is accepted too |
| `resetDocDefaults` | `boolean` | ignore the document's playback settings and start from the player's defaults, with `config` on top |
| `duration` | `number` | shortcut for `config.timeline.duration` — ms for one iteration |
| `delay` | `number` | shortcut for `config.timeline.delay` |
| `iterations` | `number \| 'infinite'` | shortcut for `config.timeline.iterations` |
| `startOn` | `PxStartOn` | shortcut for `config.timeline.trigger.startOn` |

By default there is nothing to configure: the player takes duration, iterations, direction,
what starts the animation and the engine from the `animator` block inside the JSON — the
settings you chose in the editor. So a file plays the way it was designed.

`config` is there for when one page needs it to play differently — the same file mounted twice
at two speeds, or a file that autostarts everywhere except inside your own transport UI:

```js
const animator = createAnimator({
  src: '/bouncing-ball.json',
  container: '#box',
  config: { timeline: { iterations: 'infinite', trigger: { startOn: 'programmatic' } } },
});
animator.play();
```

The merge is per key, so everything you do not mention stays as the file has it. Full rules —
`null` to delete a key, what happens when the override changes the kind of timeline, and the
shortcut precedence — are in
[Playback settings & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
Every field and its meaning is in [Playback settings & triggers](./playback-and-triggers.md).

## The playback API

`createAnimator` returns a `PxAnimatorAPI`:

| Method | Description |
|---|---|
| `play()` | start, or resume from the current time. On a finished animation, rewinds and plays again |
| `pause()` | pause at the current time |
| `cancel()` | stop and reset to the start state |
| `finish()` | jump to the end and hold the final state |
| `setPlaybackRate(rate)` | speed: `1` normal, `2` double, `0.5` half, **negative value plays in reverse**. `0` is rejected with a warning — use `pause()` |
| `getCurrentTime()` | current time in ms from the start of the whole run, every iteration included (`null` before a `src` document has loaded) |
| `setCurrentTime(ms)` | jump to a point in the animation, given in milliseconds from its start; clamped to the run. While paused, the animation shows that frame and stays there — that is how a slider steps through it frame by frame; while playing, it continues from the new point |
| `getCurrentProgress()` | the same position as `0`–`1` of the whole run (`null` before ready) |
| `setCurrentProgress(p)` | jump to `0`–`1` of the whole run |
| `isPlaying()` | `true` while running |
| `isReady()` | `true` once a `src` document has loaded and rendered |
| `getRootElement()` | the rendered `<svg>` element (`null` before ready) |
| `destroy()` | stop, remove the SVG from the container, release everything |

```html
<div id="hero" style="width: 300px; height: 300px"></div>
<input id="time-slider" type="range" min="0" max="1000" value="0">
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';
import doc from './bouncing-ball.json';

const animator = createAnimator({ data: doc, container: '#hero' });

const slider = document.querySelector('#time-slider');
slider.addEventListener('input', () => {
  animator.pause();
  animator.setCurrentTime(Number(slider.value));   // from 0 to the duration, in ms
});
```

## Callbacks

> **Example:** [`web/callbacks`](../../examples/docs-examples/src/cases/web/callbacks/) — `pnpm example:docs`, then open `#web/callbacks`.

Pass `callbacks` to be told when the animation starts, pauses, resets, finishes or is
destroyed — for example to reveal the next section of a page once an intro has finished. Every
lifecycle callback is called with no arguments.

The same object carries the player's diagnostics: `onWarn` for anything survivable, `onError`
for a document that could not be loaded, parsed or rendered, and `silent` to suppress the console
fallback those two replace. Give a handler and the console stays out of it; give none and the
console still speaks, so nothing is lost by default.

Each one is `{ kind, message, detail?, error? }`, where `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the options you passed) · `internal` (report it to us). So
you can route rather than just log, and `silent: ['platform']` quiets one kind while the rest
still speak.

```html
<div id="box" style="width: 300px; height: 300px"></div>
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';
import doc from './bouncing-ball.json';

createAnimator({
  data: doc,
  container: '#box',
  callbacks: {
    onPlay:   () => {},   // started or resumed
    onPause:  () => {},   // paused
    onCancel: () => {},   // cancelled (reset)
    onFinish: () => {},   // finished naturally, or finish() was called
    onRemove: () => {},   // destroyed

    onWarn:  (d) => {},   // d = { kind, message, detail? }; else console.warn
    onError: (d) => {},   // d = { kind, message, error };   else console.error
    silent:  false,       // true, or ['platform'] to quiet just that kind
  },
});
```

## Triggers

> **Example:** [`web/triggers`](../../examples/docs-examples/src/cases/web/triggers/) — `pnpm example:docs`, then open `#web/triggers`.

If the document says `trigger.startOn: 'click'` (or `mouseOver`, `scrollIntoView`), the player
wires the event on the rendered SVG for you; `outAction` (continue / pause / reset / reverse)
and `scrollIntoViewThreshold` are honoured. With `'load'` it starts immediately; with
`'programmatic'` nothing happens until you call `play()`.

`setupAnimationTriggers(api, triggerConfig)` is exported for one rare case: you have replaced
the rendered SVG yourself, so the click / hover / scroll listeners the player attached are gone
with the old elements, and you need to attach them to the new ones.

## Engines

> **Example:** [`web/engine-modes`](../../examples/docs-examples/src/cases/web/engine-modes/) — `pnpm example:docs`, then open `#web/engine-modes`.

`animator.timeline.engine` in the document selects how the animated attributes get updated:

| Value | Behaviour |
|---|---|
| `'auto'` (default) | Web Animations API, with an automatic fallback to the player's frame loop when the document animates something WAAPI cannot express (path morphing, gradient geometry, filters, text on path…). For scroll-driven documents: the browser's `ScrollTimeline` where supported, else the player measures progress itself |
| `'native'` | Web Animations API only (and the browser's `ScrollTimeline` for scroll-driven documents) |
| `'js'` | the player's frame loop only; honours `timeline.frameRate`. Required for path morphing in Safari < 18.5 |

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
on one page without id conflicts.

## Cleaning up

> **Example:** [`web/cleanup`](../../examples/docs-examples/src/cases/web/cleanup/) — `pnpm example:docs`, then open `#web/cleanup`.

Call `destroy()` when the container goes away (route change, modal close). `onRemove` fires
once. Frameworks: the React and Vue components do this on unmount.


## Related

- [Playback settings & triggers](./playback-and-triggers.md) — every `animator` field and how to override it
- [JSON format reference](../format/README.md#json-format-reference)
- [Troubleshooting](./troubleshooting.md)

[← Installing the players (overview)](./installation.md) · [Contents](../../README.md#documentation) · Next: [React →](./react.md)
