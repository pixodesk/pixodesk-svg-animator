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
<SvgAnimationPlayer doc={animation} playUsingActionTriggers={{ 'playback.start': 'hoverIn', 'playback.pause': 'hoverOut' }} />
<SvgAnimationPlayer doc={animation} playUsingActionTriggers={{ 'playback.start': 'click', 'playback.stop': 'click' }} />   {/* a click starts, the next stops */}
```

### Declarative playback — `playback`

Control playback with one lever — `playback` holds a position, `'off'` (no playback) · `'on'` (a playback) ·
`'paused'` (the playback, frozen); a change of position presses one built-in button (`playback.start` · `playback.pause` ·
`playback.resume` · `playback.stop`), and how a start or a stop looks is the file's `timeline.actions`, adjusted
through the `actions` prop:

```tsx
const [playing, setPlaying] = useState(false);
const [paused, setPaused] = useState(false);

<SvgAnimationPlayer doc={animation} playback={paused ? 'paused' : playing ? 'on' : 'off'} />
<button onClick={() => setPlaying(p => !p)}>
  {playing ? 'Playback (on)' : 'Playback (off)'}
</button>
<button onClick={() => setPaused(p => !p)}>
  {paused ? 'Frozen' : 'Freeze'}
</button>
```

### Imperative API

Use a ref for full programmatic control:

```tsx
import { useRef } from 'react';
import type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';

const playerRef = useRef<PxAnimationPlayerHandle>(null);

<SvgAnimationPlayer doc={animation} playerRef={playerRef} />
<button onClick={() => playerRef.current?.playback.start()}>Start</button>
<button onClick={() => playerRef.current?.playback.pause()}>Pause</button>
<button onClick={() => playerRef.current?.playback.stop()}>Stop</button>
<button onClick={() => playerRef.current?.playback.jumpToEnd()}>Finish</button>
```

<!-- px-check members PxPlaybackControls pkg=react extra=PxAnimationPlayerHandle,PxPlaybackControls,playback,play -->
`PxAnimationPlayerHandle` is `{ playback }` — the same `PxPlaybackControls` as the web player: the four buttons `playback.start()` (the configured start, `actions["playback.start"]`; a paused playback unfreezes), `playback.stop()` (the configured stop, `actions["playback.stop"]` — its animate-to-end preset stops after the current pass), `playback.pause()`, `playback.resume()`; `playback.jumpToStart()` (to the rest pose now, unconditionally — reports nothing), `playback.jumpToEnd()` (the end pose, no motion — advanced), `playback.playOnce()` (one fresh pass from the start, whatever the file's iterations say); the state `playback.getState()` (off · playing · paused · finished · returning · destroyed), `playback.isActive()`, `playback.isPlaying()`; one iteration — `playback.getDuration()` (one pass, ms — a looping file's slider maximum), `getCurrentTime()` / `setCurrentTime(ms)` (the frame inside the current iteration), `getCurrentProgress()` / `setCurrentProgress(p)`, `getCurrentIteration()`; the whole playback — `getTotalDuration()` (null when infinite), `getTotalTime()` / `setTotalTime(ms)`, `getTotalProgress()`; the speed — `playback.getSpeed()` / `playback.setSpeed(speed)` (1 normal, 2 double, negative = reverse) and the same values at it, `getDurationAtSpeed()` / `setDurationAtSpeed(ms)`, `getTotalDurationAtSpeed()`, `getCurrentTimeAtSpeed()`, `getTotalTimeAtSpeed()`. Plain names are content ms inside the iteration, `total…` the playback (including repeats, GSAP's words), `…AtSpeed` the same at the current speed ([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)). No `play()` / `pause()` aliases — one spelling per act (until 1.25 the methods sat flat on the handle).

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
| `playUsingActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play on the document's own triggers; an object: these triggers instead — `{ "playback.start", "playback.stop", "playback.pause", "playback.resume" }`, each one event or a list of the events that list may name (`'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`; `playback.resume` is derived when left out). See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `playback` | `'off' \| 'on' \| 'paused'` | A lever (`PxPlayback`): its position is held, and a change presses one button — `off` → `on` `playback.start()`, `on` → `paused` `playback.pause()`, `paused` → `on` `playback.resume()`, → `off` `playback.stop()`. How each looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#actions--how-a-start-and-a-stop-look). A mount with `'off'` presses nothing; with `'paused'` starts the playback frozen |
| `playerRef` | `RefObject<PxAnimationPlayerHandle \| null>` | Ref for imperative control; filled in every mode |
| `showAtProgress` | `number` | show the frame at this position in ONE iteration: `0` is the first frame, `0.5` the middle, `1` the last |
| `showAtTime` | `number` | show the frame at that time, in milliseconds inside one iteration (`0` to `playback.getDuration()`) |
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block, minus its `actionTriggers` and `actions`, deep-merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how a start and a stop look — `{ 'playback.stop': 'animateToStart' }` — deep-merged over the document's `timeline.actions` (the end of the pass, `atEnd`, is a timeline key: `timelineOptions`). See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `onReady` | `() => void` | The player exists and the SVG is rendered — once, async |
| `onPlaybackStart` | `() => void` | A playback began — `playback.start()`, a `playback.start` trigger, `playback` to `'on'` / `'paused'` from `'off'`, `playback.playOnce()` |
| `onPlaybackResume` | `() => void` | The playback carried on after a freeze — `playback.resume()`, a `playback.resume` trigger, `playback` back to `'on'` |
| `onPlaybackPause` | `() => void` | The playback was frozen — `playback.pause()`, a `playback.pause` trigger, `playback` `'paused'` (not the gate's off-screen hold, which reports nothing) |
| `onFinish` | `() => void` | Called when the animation reaches its end — every iteration played, or `playback.jumpToEnd()` was called (a loop stopped at a pass end reports `onPlaybackStop` only) |
| `onDestroy` | `() => void` | Called when the animation is destroyed (e.g. unmount) |
| `onPlaybackStop` | `() => void` | The playback was stopped — a `playback.stop` trigger, `playback` `'off'` or `playback.stop()`; at once, or on arrival for `animateToEnd`. A pause, the end and a destroy each fire their own; `playback.jumpToStart()` reports nothing |
| `onWarning` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `suppressWarnings` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarning`, if you gave it, still fires: this is about the console, not about you |
| `suppressErrors` | `boolean` | the same switch for `console.error` |
| `className` | `string` | CSS class applied to the rendered root `<svg>` |
| `style` | `CSSProperties` | Inline styles applied to the rendered root `<svg>` |

With none of `playUsingActionTriggers` / `playback` / `showAtProgress` / `showAtTime` set, the component renders the animation statically (initial state, no playback); `playerRef` on its own is such a case. TypeScript accepts one driver family at a time (`PxControlProps` is a union).

`SvgCssAnimationPlayer` (for SVGR-imported pre-rendered SVG + CSS files) takes the same names, narrowed — `playUsingActionTriggers` (the block only), `timelineOptions` (the gate numbers), `actions` (`outOfView`), `className`, `style`; its props type `SvgCssAnimationPlayerProps` is derived from `SvgAnimationPlayerProps`. See [CSS-flavor SVGs](../../docs/library/react.md#css-flavor-svgs--svgcssanimationplayer).

Note: passing a different `doc` (or unmounting) throws the old player away and builds a new one; the old instance emits `onDestroy` on its way out. Changing `showAtProgress` / `showAtTime` does **not** recreate the animator — it just jumps the existing one to the new position.