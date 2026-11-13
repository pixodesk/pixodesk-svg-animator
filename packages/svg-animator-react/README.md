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

### Player action triggers

Uses the triggers defined in the animation document (load, hover, click — behind the visibility
gate), or the triggers object you pass instead of `true`:

```tsx
<SvgAnimationPlayer document={animation} playerActionTriggers />
<SvgAnimationPlayer document={animation} playerActionTriggers={{ 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' }} />
<SvgAnimationPlayer document={animation} playerActionTriggers={{ 'playback.start': 'click', 'playback.stop': 'click' }} />   {/* a click starts, the next stops */}
```

### Declarative playback — `playback`

Control playback with one lever — `playback` holds a position, `'off'` (no playback) · `'on'` (a playback) ·
`'paused'` (the playback, frozen); a change of position presses one built-in button (`playback.start` · `playback.pause` ·
`playback.resume` · `playback.stop`), and how a stop looks is the file's `timeline.actions`, adjusted
through the `actions` prop:

```tsx
const [playing, setPlaying] = useState(false);
const [paused, setPaused] = useState(false);

<SvgAnimationPlayer document={animation} playback={paused ? 'paused' : playing ? 'on' : 'off'} />
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

<SvgAnimationPlayer document={animation} playerRef={playerRef} />
<button onClick={() => playerRef.current?.playback.play()}>Play</button>
<button onClick={() => playerRef.current?.playback.pause()}>Pause</button>
<button onClick={() => playerRef.current?.playback.stop()}>Stop</button>
<button onClick={() => playerRef.current?.playback.start()}>Restart</button>
```

<!-- px-check members PxPlaybackControls pkg=react extra=PxAnimationPlayerHandle,PxPlaybackControls,playback,playOnce,jumpToStart,jumpToEnd -->
`PxAnimationPlayerHandle` is `{ playback }` — the same `PxPlaybackControls` as the web player: the five buttons `playback.start()` (always from the start, in every state), `playback.play()` (start, or carry on — a paused playback resumes, a picture on its way back turns around, nothing while playing), `playback.stop()` (the configured stop, `actions["playback.stop"]` — its animate-to-end presets stop after the current pass), `playback.pause()`, `playback.resume()`; the state `playback.getState()` (off · playing · paused · finished · returning · destroyed), `playback.isActive()`, `playback.isPlaying()`; one iteration — `playback.getDuration()` (one pass, ms — a looping file's slider maximum), `getCurrentTime()` / `setCurrentTime(ms)` (the frame inside the current iteration), `getCurrentProgress()` / `setCurrentProgress(p)` (counted in iterations — `1.2` is 20 % into the second), `getCurrentIteration()`; the whole playback — `getTotalDuration()` (null when infinite), `getTotalTime()` / `setTotalTime(ms)`, `getTotalProgress()`; the speed — `playback.getSpeed()` / `playback.setSpeed(speed)` (1 normal, 2 double, negative = reverse) and the same values at it, `getDurationAtSpeed()` / `setDurationAtSpeed(ms)`, `getTotalDurationAtSpeed()`, `getCurrentTimeAtSpeed()`, `getTotalTimeAtSpeed()`. Plain names are content ms inside the iteration, `total…` the playback (including repeats, GSAP's words), `…AtSpeed` the same at the current speed ([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)). A seek while playing keeps playing; in any other state the playback becomes paused at that frame ([Moving the playhead](../../docs/library/playback-and-triggers.md#moving-the-playhead)). One spelling per act (until 1.25 the methods sat flat on the handle, and `playOnce()`, `jumpToStart()` and `jumpToEnd()` existed — a one-iteration timeline and `start()`, `stop()` and `setCurrentProgress()` say the same).

### Controlled time

Move through the animation with a slider, or show one fixed frame:

```tsx
const [time, setTime] = useState(0);

<SvgAnimationPlayer document={animation} showAtTime={time} />
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
| `document` | `PxDocumentJson` | The animation document to render (required); a `.json` import passes as-is (inline only, no URL form yet) |
| `playerActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play on the document's own triggers; an object: these triggers instead — `{ "playback.start", "playback.play", "playback.stop", "playback.pause", "playback.resume" }`, each one event or a list of the events that list may name (`'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`; `playback.resume` is derived when left out). See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `playback` | `'off' \| 'on' \| 'paused'` | A lever (`PxPlayback`): its position is held, and a change presses one button — `off` → `on` `playback.start()`, `on` → `paused` `playback.pause()`, `paused` → `on` `playback.resume()`, → `off` `playback.stop()`. How a stop looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#actions--how-a-stop-looks); `'on'` always plays from the start. A mount with `'off'` presses nothing; with `'paused'` starts the playback frozen |
| `playerRef` | `RefObject<PxAnimationPlayerHandle \| null>` | Ref for imperative control; filled in every mode |
| `showAtProgress` | `number` | show the frame at this position, counted in iterations: `0` is the first frame, `0.5` the middle of the first iteration, `1` its last frame, `1.2` 20 % into the second |
| `showAtTime` | `number` | show the frame at that time, in milliseconds inside one iteration (`0` to `playback.getDuration()`) |
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block, minus its `actionTriggers` and `actions`, deep-merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how a stop looks — `{ 'playback.stop': 'animateToStart' }` — and of `outOfView`, deep-merged over the document's `timeline.actions` (what shows once finished, `whenFinished`, is a timeline key: `timelineOptions`). See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `onReady` | `() => void` | The player exists and the SVG is rendered — once, async |
| `onPlaybackStart` | `() => void` | A playback began — `playback.start()`, `playback.play()` from rest, a `playback.start` / `playback.play` trigger, `playback` to `'on'` / `'paused'` from `'off'`, the visibility gate starting it again |
| `onPlaybackResume` | `() => void` | The playback carried on after a freeze — `playback.resume()`, `playback.play()`, a `playback.resume` trigger, `playback` back to `'on'`, the visibility gate when it is seen again |
| `onPlaybackPause` | `() => void` | The playback was frozen — `playback.pause()`, a `playback.pause` trigger, `playback` `'paused'`, or the visibility gate's `pause` when it left the screen |
| `onPlaybackFinish` | `() => void` | The last pass ended by playing — the state is `finished`, whatever `whenFinished` then shows. Never for a stop that goes to the end (that is `onPlaybackStop`), never for a loop without end |
| `onDestroy` | `() => void` | Called when the animation is destroyed (e.g. unmount) |
| `onPlaybackStop` | `() => void` | The playback was stopped — a `playback.stop` trigger, `playback` `'off'`, `playback.stop()` or the visibility gate's `stop`; at once, or on arrival for the stops that finish the pass first. A pause, the end and a destroy each fire their own; a seek reports nothing |
| `onWarning` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `suppressWarnings` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarning`, if you gave it, still fires: this is about the console, not about you |
| `suppressErrors` | `boolean` | the same switch for `console.error` |
| `className` | `string` | CSS class applied to the rendered root `<svg>` |
| `style` | `CSSProperties` | Inline styles applied to the rendered root `<svg>` |

With none of `playerActionTriggers` / `playback` / `showAtProgress` / `showAtTime` set, the component renders the animation statically (initial state, no playback); `playerRef` on its own is such a case. TypeScript accepts one driver family at a time (`PxControlProps` is a union).

`SvgCssAnimationPlayer` (for SVGR-imported pre-rendered SVG + CSS files) takes the same names, narrowed — `playerActionTriggers` (the block only), `timelineOptions` (the gate numbers), `actions` (`outOfView`), `className`, `style`; its props type `SvgCssAnimationPlayerProps` is derived from `SvgAnimationPlayerProps`. See [CSS-flavor SVGs](../../docs/library/react.md#css-flavor-svgs--svgcssanimationplayer).

Note: passing a different `document` (or unmounting) throws the old player away and builds a new one; the old instance emits `onDestroy` on its way out. Changing `showAtProgress` / `showAtTime` does **not** recreate the animator — it just jumps the existing one to the new position.