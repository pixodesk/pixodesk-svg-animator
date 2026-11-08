# animator-react

> 📖 Full user guide: [docs/library/react.md](../../docs/library/react.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

React component for rendering and controlling Pixodesk SVG animations.


# 🚧 **Status - This project is currently under development.**

## Usage

```tsx
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import { PxDocument } from '@pixodesk/svg-animator-web';
import _animation from './animation.json';

const animation: PxDocument = _animation;
```

### Autoplay

Uses the triggers defined in the animation document (load, hover, click — behind the visibility
gate), or the triggers object you pass instead of `true`:

```tsx
<SvgAnimationPlayer doc={animation} playUsingActionTriggers />
<SvgAnimationPlayer doc={animation} playUsingActionTriggers={{ start: 'hoverIn', pause: 'hoverOut' }} />
<SvgAnimationPlayer doc={animation} playUsingActionTriggers={{ start: 'click', stop: 'click' }} />   {/* a click starts, the next stops */}
```

### Declarative play/pause

Control playback with two levels — `play` plays while true (`true` calls the built-in `start`,
`false` the built-in `stop`), `pause` freezes on top; how each looks is the file's
`timeline.actions`, adjusted through the `actions` prop. `playState` is the same control in one word
(`'idle' | 'playing' | 'paused'`):

```tsx
const [playing, setPlaying] = useState(false);
const [paused, setPaused] = useState(false);

<SvgAnimationPlayer doc={animation} play={playing} pause={paused} />
<button onClick={() => setPlaying(p => !p)}>
  {playing ? 'Play (on)' : 'Play (off)'}
</button>
<button onClick={() => setPaused(p => !p)}>
  {paused ? 'Pause (on)' : 'Pause (off)'}
</button>

// the same as one state word
<SvgAnimationPlayer doc={animation} playState={paused ? 'paused' : playing ? 'playing' : 'idle'} />
```

### Imperative API

Use a ref for full programmatic control:

```tsx
import { useRef } from 'react';
import type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';

const playerRef = useRef<PxAnimationPlayerHandle>(null);

<SvgAnimationPlayer doc={animation} playerRef={playerRef} />
<button onClick={() => playerRef.current?.play()}>Play</button>
<button onClick={() => playerRef.current?.pause()}>Pause</button>
<button onClick={() => playerRef.current?.stop()}>Stop</button>
<button onClick={() => playerRef.current?.jumpToEnd()}>Finish</button>
```

<!-- px-check members PxAnimationPlayerHandle pkg=react -->
`PxAnimationPlayerHandle` methods: `play()` (paused → resume, otherwise the configured start), `pause()`, `stop()` (the configured stop, `actions.stop` — its animate-to-end preset stops after the current pass), `jumpToStart()` (to the idle pose now, unconditionally — reports nothing), `jumpToEnd()` (the end pose, no motion — advanced), `playOnce()` (one fresh pass from the start, whatever the file's iterations say), `isPlaying()`, `getPlayState()` (idle · playing · paused · finished · destroyed); playback time — `getPlaybackSpeed()` / `setPlaybackSpeed(speed)` (1 normal, 2 double, negative = reverse), `getPlaybackDuration()` / `setPlaybackDuration(ms)` (one pass in playback ms; the setter sets the speed), `getTotalPlaybackDuration()`, `getCurrentPlaybackTime()`, `getTotalPlaybackTime()`; one iteration — `getDuration()` (one pass, ms — a looping file's slider maximum), `getCurrentTime()` / `setCurrentTime(ms)` (the frame inside the current iteration), `getCurrentProgress()` / `setCurrentProgress(p)`, `getCurrentIteration()`; the whole run — `getTotalDuration()` (null when infinite), `getTotalTime()` / `setTotalTime(ms)`, `getTotalProgress()`. Plain names are model ms inside the iteration, `total…` the run (including repeats, GSAP's words), `playback…` model time ÷ the speed ([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)).

### Controlled time

Move through the animation with a slider, or show one fixed frame:

```tsx
const [time, setTime] = useState(0);

<SvgAnimationPlayer doc={animation} showAtTime={time} />
<input
  type="range"
  min={0}
  max={2000}
  value={time}
  onChange={e => setTime(Number(e.target.value))}
/>
```


## Props

<!-- px-check props SvgAnimationPlayerProps pkg=react -->
| Prop | Type | Description |
|---|---|---|
| `doc` | `PxDocumentJson` | The animation document to render (required); a `.json` import passes as-is |
| `playUsingActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play on the document's own triggers; an object: these triggers instead — `{ start, stop, pause, resume }`, each one event or a list of the events that list may name (`'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`; `resume` is derived when left out). See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `play` | `boolean` | A level: plays while `true` (the built-in `start`), `false` performs the built-in `stop` (a mount with `false` does nothing). How each looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#actions--how-start-stop-and-finish-look) |
| `pause` | `boolean` | A level on top: freeze the current frame while `true` / resume; only while `play` is true |
| `playState` | `'idle' \| 'playing' \| 'paused'` | The same control as one state word (`PxPlayStateRequest`): `idle` = the stop action, `paused` = frozen; set beside the booleans it wins (PX1501) |
| `playerRef` | `RefObject<PxAnimationPlayerHandle \| null>` | Ref for imperative control; filled in every mode |
| `showAtProgress` | `number` | show the frame at this position in ONE iteration: `0` is the first frame, `0.5` the middle, `1` the last |
| `showAtTime` | `number` | show the frame at that time, in milliseconds inside one iteration (`0` to `getDuration()`) |
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block, minus its `actionTriggers` and `actions`, deep-merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how the built-in actions look — `{ stop: 'animateToStart' }` — deep-merged over the document's `timeline.actions`. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `onReady` | `() => void` | The player exists and the SVG is rendered — once, async |
| `onPlay` | `() => void` | Called on play/resume |
| `onPause` | `() => void` | Called on pause |
| `onFinish` | `() => void` | Called when the animation reaches its end — every iteration played, or `jumpToEnd()` was called (a loop stopped at a pass end reports `onStop` only) |
| `onDestroy` | `() => void` | Called when the animation is destroyed (e.g. unmount) |
| `onStop` | `() => void` | The built-in `stop` action was performed — a `stop` trigger, `play` false or `stop()`; at once, or on arrival for `animateToEnd`. A pause, the end and a destroy each fire their own; `jumpToStart()` reports nothing |
| `onWarning` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `suppressWarnings` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarning`, if you gave it, still fires: this is about the console, not about you |
| `suppressErrors` | `boolean` | the same switch for `console.error` |
| `className` | `string` | CSS class applied to the rendered root `<svg>` |
| `style` | `CSSProperties` | Inline styles applied to the rendered root `<svg>` |

With none of `playUsingActionTriggers` / `play` / `pause` / `playState` / `showAtProgress` / `showAtTime` set, the component renders the animation statically (initial state, no playback); `playerRef` on its own is such a case. TypeScript accepts one driver family at a time (`PxControlProps` is a union).

`SvgCssAnimationPlayer` (for SVGR-imported pre-rendered SVG + CSS files) takes the same names, narrowed — `playUsingActionTriggers` (the block only), `timelineOptions` (the gate numbers), `actions` (`outOfView`), `className`, `style`; its props type `SvgCssAnimationPlayerProps` is derived from `SvgAnimationPlayerProps`. See [CSS-flavor SVGs](../../docs/library/react.md#css-flavor-svgs--svgcssanimationplayer).

Note: passing a different `doc` (or unmounting) throws the old player away and builds a new one; the old instance emits `onDestroy` on its way out. Changing `showAtProgress` / `showAtTime` does **not** recreate the animator — it just jumps the existing one to the new position.