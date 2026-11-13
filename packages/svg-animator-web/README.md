# animator-web

> 📖 Full user guide: [docs/library/web-player.md](../../docs/library/web-player.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight JavaScript library for playing SVG animations in the browser. Pixodesk Animator runs animations created in the Pixodesk editor using the Web Animations API or requestAnimationFrame. It supports event triggers such as click, hover, and scroll. The library ships as ESM, CJS, and UMD bundles.


# 🚧 **Status - This project is currently under development.**

## Usage

### Embed/Inline SVG with animation

```html
<body>
  <svg width="200" height="200" viewBox="0 0 200 200">
    <!-- animation here -->
  </svg>
</body>
```

#### CSS Keyframes

```html
<body>
  <svg width="200" height="200" viewBox="0 0 200 200">
    <!-- animation here -->
  </svg>
</body>
```

#### JS


### Declarative (HTML)

Add a `data-px-document` attribute to any element pointing to your animation JSON file, then call `createSvgAnimationPlayersFromPage()`:

```html
<div data-px-document="/animation.json"></div>

<!-- UMD -->
<script src="pixodesk-svg-animator.umd.js"></script>
<script>
  Pixodesk.SvgAnimator.createSvgAnimationPlayersFromPage();
</script>
```

Each element gets its own player: `createSvgAnimationPlayersFromPage()` returns the ones it created, and `getSvgAnimationPlayer(element)` finds an element's later — use it for playback control.

### Programmatic

Use `createSvgAnimationPlayer` for full control:

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

// From a URL — returns a proxy immediately; control calls made before the
// document loads are queued and replayed once it's ready
const player = createSvgAnimationPlayer({
  document: '/animation.json',          // a string is always a URL
  container: '#container',
  onPlaybackFinish: () => console.log('done'),
});

// Or from an already-loaded document object
const fromObject = createSvgAnimationPlayer({ document: animationDoc, container: '#container' });

player.playback.start();               // always from the start
player.playback.pause();
player.playback.setCurrentTime(500);   // 0.5 s into the current iteration — held there (paused)
player.playback.play();                // carry on from there (start() would restart)
player.playback.setSpeed(2);   // 2x speed (-1 plays in reverse)
player.playback.stop();                // back to the rest pose, per the file's stop action
player.destroy();             // cleanup
```

### API

`createSvgAnimationPlayer(options)` takes a single options object:

<!-- px-check props PxAnimationPlayerOptions pkg=web -->
| Option | Type | Description |
| ----------- | ------------------------- | -------------------------------------------------- |
| `playerActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play the way the editor saved it — the document's own triggers start, pause and stop it; an object: those triggers instead of the file's (the whole block). Without it nothing starts and the returned api drives playback |
| `document`  | `string \| PxDocumentJson` | Required: a URL to fetch the animation document from (a string is always a URL), or the document object itself (a `.json` import passes as-is). `src` / `doc` until 1.25 |
| `container` | `string \| Element`       | CSS selector or element to render the SVG into      |
| `onReady` · `onPlaybackStart` · `onPlaybackStop` · `onPlaybackPause` · `onPlaybackResume` · `onPlaybackFinish` · `onDestroy` | `() => void` | the lifecycle callbacks, inline — the same names the components take (`onReady` fires once, async: the push twin of `isReady()`; the `onPlayback…` callbacks are the playback's events, told when the act is performed; `onPlaybackFinish` only when the last pass ends by playing); plus `onWarning`, `onError`, `suppressWarnings`, `suppressErrors` for diagnostics. See [Callbacks](#callbacks) | <!-- px names=onReady,onPlaybackStart,onPlaybackStop,onPlaybackPause,onPlaybackResume,onPlaybackFinish,onDestroy,onWarning,onError,suppressWarnings,suppressErrors -->
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block (minus its `actionTriggers` and `actions`), deep-merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how a stop looks — `{ 'playback.stop': 'animateToStart' }` — and of the gate's `outOfView`, deep-merged over the document's `timeline.actions` (what a finished playback shows, `whenFinished`, is a timeline key: `timelineOptions`). See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |

The document plays the way it was designed with no configuration at all; `timelineOptions` and `actions` are for when
one page needs it to play differently — the same file mounted twice at two speeds, or a file
that autostarts everywhere except inside your own transport UI:

```js
const player = createSvgAnimationPlayer({
  document: '/animation.json',
  container: '#box',
  timelineOptions: { iterations: 'infinite' },   // no `playerActionTriggers`: nothing starts until playback.start()
});
player.playback.start();
```

It returns a `PxAnimationPlayerApi` — the player's lifecycle, and `playback`:

<!-- px-check props PxAnimationPlayerApi pkg=web -->
| Member                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `playback`              | Everything a page does to the animation — a `PxPlaybackControls`, below. One object per player, made of closures (`const { start } = player.playback` works) |
| `isReady()`             | Whether the document has loaded (relevant for URL-based creation) — calls made before are queued |
| `getRootElement()`      | The rendered SVG DOM element                                      |
| `destroy()`             | Remove the animation and clean up; every later call is ignored (PX1504) |

`player.playback` — the buttons, the state, the seeks and both clocks (one spelling per act; until 1.25 these
methods sat flat on the player; `playOnce()`, `jumpToStart()` and `jumpToEnd()` until 1.25 — a one-iteration
timeline and `start()`, `stop()` and `setCurrentProgress()` say the same):

<!-- px-check props PxPlaybackControls pkg=web -->
| Method                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `start()`               | A playback from the start — in every state: off, finished, while playing (it restarts), paused or returning; the delay is waited again; reports `onPlaybackStart` |
| `play()`                | Start or carry on — a Play button: nothing while playing; paused resumes (`onPlaybackResume`); a picture on its way back to the start turns around (`onPlaybackStart`); otherwise starts from the start (`onPlaybackStart`) |
| `stop()`                | The built-in stop, per `actions["playback.stop"].behavior`: `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd` · `animateToEndAndBack`; reports `onPlaybackStop` |
| `pause()`               | Freeze the playback at the current frame (only while playing); reports `onPlaybackPause` |
| `resume()`              | Carry on from the frozen frame (only while paused); reports `onPlaybackResume` |
| `getState()`            | The one state read — the playback's: `off` · `playing` · `paused` · `finished` · `returning` · `destroyed`; `finished` after the natural end whatever `whenFinished` then shows; a stop's `animateToStart` leg on its way back reads `returning` |
| `isActive()`            | A playback exists: `playing` · `paused` · `finished`              |
| `isPlaying()`           | `getState() === 'playing'` — a picture moving back to the start is not playing |
| `getDuration()`         | One pass of the content window, ms — a looping file's slider maximum (`null` before a URL loads) |
| `getCurrentTime()`      | The frame on screen: ms inside the current iteration, `0..getDuration()`; a reversed pass of `alternate` counts down |
| `setCurrentTime(ms)`    | Seek inside the current iteration; clamped to `[0, getDuration()]`. While playing it keeps playing; otherwise the playback is `paused` at that frame |
| `getCurrentProgress()`  | The position counted in iterations, in play order — `1.2` is 20 % into the second (`null` before ready) |
| `setCurrentProgress(p)` | Seek to that position; clamped to `[0, iterations]`, nothing wraps; the same seek rule |
| `getCurrentIteration()` | Which pass is playing, 0-based                                    |
| `getTotalDuration()`    | The whole playback, ms: one pass × iterations; `null` when infinite — a finite playback's slider maximum |
| `getTotalTime()` / `setTotalTime(ms)` | The playhead on the whole playback, every iteration included (0 while the delay waits); the setter seeks on it, by the same seek rule | <!-- px names=getTotalTime,setTotalTime -->
| `getTotalProgress()`    | The playhead as 0–1 of the whole playback (GSAP's `totalProgress`); `null` when endless |
| `getSpeed()` / `setSpeed(speed)` | The speed: 1 normal, 2 double, 0.5 half, negative = reverse (it multiplies with `iterationDirection`); starts at the file's `timeline.playbackSpeed`, the setter replaces it (0 is rejected — use `pause()`) | <!-- px names=getSpeed,setSpeed -->
| `getDurationAtSpeed()` / `setDurationAtSpeed(ms)` | One pass in ms at the current speed; the setter sets the speed so one pass takes `ms` | <!-- px names=getDurationAtSpeed,setDurationAtSpeed -->
| `getTotalDurationAtSpeed()` | The whole playback at the current speed; `null` when `iterations` is `'infinite'` |
| `getCurrentTimeAtSpeed()` | The playhead in the pass at the current speed: `getCurrentTime() / \|speed\|` |
| `getTotalTimeAtSpeed()` | The playhead on the whole playback at the current speed: `getTotalTime() / \|speed\|` |

Plain time names are content ms **inside the iteration**, progress counts **iterations** (`1.2` = 20 % into the
second), `total…` names span the **whole playback** (including repeats — GSAP's words), the `…AtSpeed` names are
the same values **at the current speed** — content time ÷ the speed — the one contract on every player
([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)). A seek while playing keeps playing; in
every other state it leaves the playback `paused` there, and reports nothing. On a
scroll or view timeline the playback verbs are no-ops (PX1505): the scroll position owns the playhead.

### Callbacks

```js
createSvgAnimationPlayer({
  document: doc,
  container: '#container',
  onPlaybackStart:  () => { /* a playback began */ },
  onPlaybackResume: () => { /* the playback carried on after a freeze */ },
  onPlaybackPause:  () => { /* the playback was frozen (also by the out-of-view gate) */ },
  onPlaybackStop:   () => { /* the playback was stopped */ },
  onPlaybackFinish: () => { /* the last pass ended by playing (not a stop that went to the end) */ },
  onDestroy: () => { /* destroyed / cleaned up */ },
});
```

### Engines

`animator.timeline.engine` selects how the animated attributes get updated:

- `'auto'` (default) — the browser where it can (Web Animations API; its ScrollTimeline for scroll-driven documents), the player's frame loop where it must.
- `'native'` — the browser only (Web Animations API).
- `'js'` — the player's `requestAnimationFrame` loop only; honors `timeline.frameRate`. Required for path morphing in Safari < 18.5.

### Document format & effects

The `document` passed to `createSvgAnimationPlayer` is the animation document (`type: 'svg'`), the
same shape as the JSON export. It comes in two modes:

- **Self-contained document** — has `children`: the player renders the SVG tree and animates it.
- **Bind-by-id document** — no `children`: the player animates a pre-existing SVG DOM, mapping
  each `bindings` entry names an element (`target`, `#id`) and the named animations it plays (`animateWith`).

Elements may also carry a `node.effects` bucket (structural effects such as
`transformBy`, `repeater`, `maskedBy`, `strokeTrim`, `clone`, `fillGradient` /
`strokeGradient`, `textPath`). This player materializes and removes them at
runtime before any other normalization.

When you want the markup without a player — a static first frame, a thumbnail, a snapshot —
`renderNode` (from `@pixodesk/svg-animator-web/engine`) is that one step on its own: hand it a node and it returns the DOM element for it, or
`null` when the node renders to nothing. Give it the document's `animator.definitions` as the
second argument so named fonts resolve, and a diagnostics channel as the third to hear about
anything it skips. It renders; it does not animate. `toDomProps(props)` is the attribute half of
that step on its own: a node's attributes, resolved to what the DOM receives.

See the [JSON format reference](../../docs/format/README.md#json-format-reference) and
[Player effects](../../docs/format/README.md#player-effects) for the full schema and
examples, and [Schema at a glance](../../docs/format/README.md#schema-at-a-glance) for the whole
format as typings. The wire types live in
[`PxAnimatorTypes.ts`](../svg-animator-core/src/format/PxAnimatorTypes.ts).

