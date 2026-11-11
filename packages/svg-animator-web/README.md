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

Add a `data-px-animation-src` attribute to any element pointing to your animation JSON file, then call `createSvgAnimationPlayersFromPage()`:

```html
<div data-px-animation-src="/animation.json"></div>

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
  src: '/animation.json',
  container: '#container',
  onFinish: () => console.log('done'),
});

// Or from an already-loaded document object
const fromObject = createSvgAnimationPlayer({ doc: animationDoc, container: '#container' });

player.startRun();
player.pauseRun();
player.setCurrentTime(500);   // jump to 0.5 s into the current iteration
player.setPlaybackSpeed(2);   // 2x speed (-1 plays in reverse)
player.jumpToEnd();           // the end pose, no motion
player.destroy();             // cleanup
```

### API

`createSvgAnimationPlayer(options)` takes a single options object:

<!-- px-check props PxAnimationPlayerOptions pkg=web -->
| Option | Type | Description |
| ----------- | ------------------------- | -------------------------------------------------- |
| `playUsingActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play the way the editor saved it — the document's own triggers start, pause and stop it; an object: those triggers instead of the file's (the whole block). Without it nothing starts and the returned api drives playback |
| `src`       | `string`                  | URL to fetch the animation document from (provide either `src` or `doc`) |
| `doc`       | `PxDocumentJson`          | Inline animation document object (a `.json` import passes as-is) |
| `container` | `string \| Element`       | CSS selector or element to render the SVG into      |
| `onReady` · `onRunStart` · `onRunStop` · `onRunPause` · `onRunResume` · `onFinish` · `onDestroy` | `() => void` | the lifecycle callbacks, inline — the same names the components take (`onReady` fires once, async: the push twin of `isReady()`; the four `onRun…` are the buttons' events, told when the act is performed); plus `onWarning`, `onError`, `suppressWarnings`, `suppressErrors` for diagnostics. See [Callbacks](#callbacks) | <!-- px names=onReady,onRunStart,onRunStop,onRunPause,onRunResume,onFinish,onDestroy,onWarning,onError,suppressWarnings,suppressErrors -->
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block (minus its `actionTriggers` and `actions`), deep-merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how a start and a stop look — `{ stopRun: 'animateToStart' }` — deep-merged over the document's `timeline.actions` (the end of the pass, `atEnd`, is a timeline key: `timelineOptions`). See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |

The document plays the way it was designed with no configuration at all; `timelineOptions` and `actions` are for when
one page needs it to play differently — the same file mounted twice at two speeds, or a file
that autostarts everywhere except inside your own transport UI:

```js
const player = createSvgAnimationPlayer({
  src: '/animation.json',
  container: '#box',
  timelineOptions: { iterations: 'infinite' },   // no `playUsingActionTriggers`: nothing starts until startRun()
});
player.startRun();
```

It returns a `PxAnimationPlayerApi`:

<!-- px-check props PxAnimationPlayerApi pkg=web -->
| Method                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `startRun()`            | The run's on button — the built-in start, per `actions.startRun` (`continue` · `jumpToStart` · `jumpToEnd`); a paused run unfreezes, a returning one turns around; reports `onRunStart` |
| `stopRun()`             | The run's off button — the built-in stop, per `actions.stopRun.behavior`: `jumpToStart` · `animateToStart` · `jumpToEnd` · `animateToEnd`; reports `onRunStop` |
| `pauseRun()`            | Freeze the run at the current frame (only while playing); reports `onRunPause` |
| `resumeRun()`           | Carry on from the frozen frame (only while paused); reports `onRunResume` |
| `play()`                | ALIAS: `getRunState() === 'paused' ? resumeRun() : startRun()` — the media word |
| `pause()`               | ALIAS of `pauseRun()`                                             |
| `jumpToStart()`         | The unconditional jump to the rest pose — reports nothing, like a seek |
| `jumpToEnd()`           | The end pose, no motion — runs the timeline's `atEnd`, fires `onFinish` (advanced: the `jumpToEnd` preset as a call) |
| `runOnce()`             | One fresh pass from the start, whatever `iterations` say          |
| `getRunState()`         | The one state read — the run's: `off` · `playing` · `paused` · `finished` · `returning` · `destroyed`; an `animateToStart` leg on its way back reads `returning` |
| `isRunActive()`         | A run exists: `playing` · `paused` · `finished`                   |
| `getPlaybackSpeed()` / `setPlaybackSpeed(speed)` | The speed: 1 normal, 2 double, 0.5 half, negative = reverse (it multiplies with `iterationDirection`); starts at the file's `timeline.playbackSpeed`, the setter replaces it (0 is rejected — use `pauseRun()`) | <!-- px names=getPlaybackSpeed,setPlaybackSpeed -->
| `getPlaybackDuration()` / `setPlaybackDuration(ms)` | One pass in playback ms at the current speed; the setter sets the speed so one pass takes `ms` | <!-- px names=getPlaybackDuration,setPlaybackDuration -->
| `getTotalPlaybackDuration()` | The whole run in playback ms; `null` when `iterations` is `'infinite'` |
| `getCurrentPlaybackTime()` | The playhead in the pass, playback ms: `getCurrentTime() / \|speed\|` |
| `getTotalPlaybackTime()` | The playhead on the run, playback ms: `getTotalTime() / \|speed\|` |
| `getDuration()`         | One pass of the content window, ms — a looping file's slider maximum (`null` before a `src` loads) |
| `getCurrentTime()`      | The frame on screen: ms inside the current iteration, `0..getDuration()`; a reversed pass of `alternate` counts down |
| `setCurrentTime(ms)`    | Seek inside the current iteration; clamped to `[0, getDuration()]` |
| `getCurrentProgress()`  | The same position as 0–1 of the iteration (`null` before ready)   |
| `setCurrentProgress(p)` | Seek to 0–1 of the current iteration                              |
| `getCurrentIteration()` | Which pass is playing, 0-based                                    |
| `getTotalDuration()`    | The whole run, ms: one pass × iterations; `null` when infinite — a finite run's slider maximum |
| `getTotalTime()` / `setTotalTime(ms)` | The playhead on the whole run, every iteration included (0 while the delay waits); the setter seeks on it | <!-- px names=getTotalTime,setTotalTime -->
| `getTotalProgress()`    | The playhead as 0–1 of the whole run (GSAP's `totalProgress`); `null` when endless |
| `isPlaying()`           | Whether the animation is currently playing                        |
| `isReady()`             | Whether the document has loaded (relevant for URL-based creation) |
| `getRootElement()`      | The rendered SVG DOM element                                      |
| `destroy()`             | Remove the animation and clean up; every later call is ignored (PX1504) |

Plain names are model ms **inside the iteration**, `total…` names span the **whole run** (including
repeats — GSAP's words), the `playback…` family is **playback time** — model time ÷ the speed — the
one contract on every player ([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)). On a
scroll or view timeline the playback verbs are no-ops (PX1505): the scroll position owns the playhead.

### Callbacks

```js
createSvgAnimationPlayer({
  doc: doc,
  container: '#container',
  onRunStart:  () => { /* a run began */ },
  onRunResume: () => { /* the run carried on after a freeze */ },
  onRunPause:  () => { /* the run was frozen (not the gate's hold) */ },
  onRunStop:   () => { /* the run was stopped */ },
  onFinish: () => { /* reached the end (or via jumpToEnd()) */ },
  onDestroy: () => { /* destroyed / cleaned up */ },
});
```

### Engines

`animator.timeline.engine` selects how the animated attributes get updated:

- `'auto'` (default) — the browser where it can (Web Animations API; its ScrollTimeline for scroll-driven documents), the player's frame loop where it must.
- `'native'` — the browser only (Web Animations API).
- `'js'` — the player's `requestAnimationFrame` loop only; honors `timeline.frameRate`. Required for path morphing in Safari < 18.5.

### Document format & effects

The `doc` passed to `createSvgAnimationPlayer` is the animation document (`type: 'svg'`), the
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

