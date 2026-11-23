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

### Action triggers — the default

With no control prop the component plays the file the way it was saved — the triggers defined in the
animation document (load, hover, click — behind the visibility gate). `actions` gives other
triggers instead of the file's (the whole list of rules):

```tsx
<SvgAnimationPlayer document={animation} />
<SvgAnimationPlayer document={animation}
  actions={[{ action: 'timeline.play', event: 'hoverIn' }, { action: 'timeline.pause', event: 'hoverOut' }]} />
<SvgAnimationPlayer document={animation}
  actions={[{ action: 'timeline.start', event: 'click' }, { action: 'timeline.stop', event: 'click' }]} />   {/* a click starts, the next stops */}
<SvgAnimationPlayer document={animation} showAsStatic />   {/* the picture as drawn — nothing plays */}
```

### Declarative playback — `playback`

Control playback with one lever — `playback` holds a position, `'off'` (no playback) · `'on'` (a playback) ·
`'paused'` (the playback, frozen); a change of position presses one built-in button (`timeline.start` · `timeline.pause` ·
`timeline.resume` · `timeline.stop`), and how a stop looks is the timeline's `whenStopped` — the file's, or
`timelineOptions`' (`{ whenStopped: 'animateToStart' }`):

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

Use a ref for full programmatic control — `disableActions` switches the file's triggers off, so your
buttons alone drive it:

```tsx
import { useRef } from 'react';
import type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';

const playerRef = useRef<PxAnimationPlayerHandle>(null);

<SvgAnimationPlayer document={animation} disableActions playerRef={playerRef} />
<button onClick={() => playerRef.current?.timeline.play()}>Play</button>
<button onClick={() => playerRef.current?.timeline.pause()}>Pause</button>
<button onClick={() => playerRef.current?.timeline.stop()}>Stop</button>
<button onClick={() => playerRef.current?.timeline.start()}>Restart</button>
```

<!-- px-check members PxTimelineControls pkg=react extra=PxAnimationPlayerHandle,PxTimelineControls,PxFlowControls,playback,variables,playOnce,jumpToStart,jumpToEnd,timeline,flow,getTimeline,next,previous,goTo,get,getAll -->
`PxAnimationPlayerHandle` is `{ timeline, flow, getTimeline, variables }` — `variables` is the document's variables ([Variables](#variables)); `timeline` the same `PxTimelineControls` as the web player: the five buttons `timeline.start()` (always from the start, in every state), `timeline.play()` (start, or carry on — a paused playback resumes, a picture on its way back turns around, nothing while playing), `timeline.stop()` (the configured stop, `actions["timeline.stop"]` — its animate-to-end presets stop after the current pass), `timeline.pause()`, `timeline.resume()`; the state `timeline.getState()` (off · playing · paused · finished · returning · destroyed), `timeline.isActive()`, `timeline.isPlaying()`; one iteration — `timeline.getDuration()` (one pass, ms — a looping file's slider maximum), `getCurrentTime()` / `setCurrentTime(ms)` (the frame inside the current iteration), `getCurrentProgress()` / `setCurrentProgress(p)` (counted in iterations — `1.2` is 20 % into the second), `getCurrentIteration()`; the whole playback — `getTotalDuration()` (null when infinite), `getTotalTime()` / `setTotalTime(ms)`, `getTotalProgress()`; the speed — `timeline.getSpeed()` / `timeline.setSpeed(speed)` (1 normal, 2 double, negative = reverse) and the same values at it, `getDurationAtSpeed()` / `setDurationAtSpeed(ms)`, `getTotalDurationAtSpeed()`, `getCurrentTimeAtSpeed()`, `getTotalTimeAtSpeed()`. `flow` is the file's flows, a `PxFlowControls` — `goTo(id)`, `next()`, `previous()`, `get()` (one id per flow), `getAll()` ([States](../../docs/library/playback-and-triggers.md#flows--named-steps-of-the-animation)); `getTimeline(id)` the same controls as `timeline` for one timeline of the file. Plain names are content ms inside the iteration, `total…` the playback (including repeats, GSAP's words), `…AtSpeed` the same at the current speed ([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)). A seek while playing keeps playing; in any other state the playback becomes paused at that frame ([Moving the playhead](../../docs/library/playback-and-triggers.md#moving-the-playhead)). One spelling per act (until 1.25 the methods sat flat on the handle, and `playOnce()`, `jumpToStart()` and `jumpToEnd()` existed — a one-iteration timeline and `start()`, `stop()` and `setCurrentProgress()` say the same).

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

### Variables

A file can declare variables — a colour, a size, a caption — and your app gives them values. A change is drawn on
the player's next frame, with no React render of the SVG and no new player:

```tsx
<SvgAnimationPlayer document={card} variables={{ bg: theme.accent, title: user.name }} variant="dark" />

playerRef.current?.variables.set('size', 60);   // or from code, through the handle
```

`cssVariables` lets the page's stylesheet set them instead. See [Variables](../../docs/library/variables.md).

## Props

<!-- px-check props SvgAnimationPlayerProps pkg=react -->
| Prop | Type | Description |
|---|---|---|
| `document` | `PxDocumentJson` | The animation document to render (required); a `.json` import passes as-is (inline only, no URL form yet) |
| `actions` | `PxActionTriggersInput \| null` | these rules instead of the document's own — a list of `{ action, event, … }`, `[{ action: 'timeline.start', event: 'load' }]`; a rule whose action may not name its event is dropped; `timeline.resume` is derived when no rule names it; `null` or `[]`: none. See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `disableActions` | `boolean` | manual: the document's triggers are switched off — your code drives it through `playerRef` |
| `showAsStatic` | `boolean` | the picture as drawn — nothing plays, whatever the file says; playback calls on `playerRef` are ignored with a warning (PX1506). Beats every other control prop |
| `playback` | `'off' \| 'on' \| 'paused'` | A lever (`PxPlayback`): its position is held, and a change presses one button — `off` → `on` `timeline.start()`, `on` → `paused` `timeline.pause()`, `paused` → `on` `timeline.resume()`, → `off` `timeline.stop()`. How a stop looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#how-a-stop-looks--whenstopped); `'on'` always plays from the start. A mount with `'off'` presses nothing; with `'paused'` starts the playback frozen |
| `playerRef` | `RefObject<PxAnimationPlayerHandle \| null>` | Ref for imperative control; filled in every mode |
| `showAtProgress` | `number` | show the frame at this position, counted in iterations: `0` is the first frame, `0.5` the middle of the first iteration, `1` its last frame, `1.2` 20 % into the second |
| `showAtTime` | `number` | show the frame at that time, in milliseconds inside one iteration (`0` to `timeline.getDuration()`) |
| `flowStep` | `string \| Array<string>` | holds that [flow step](../../docs/library/playback-and-triggers.md#flows--named-steps-of-the-animation) of the file — one id, or one per flow; a lever beside the others: the file's rules for that flow rest while it is set |
| `flows` | `Array<string>` | what runs: those [flows](../../docs/library/playback-and-triggers.md#what-runs--the-pages-lists) (`default` for the flow `default`); with neither list, every flow. A change plans again over the same picture — no remount |
| `timelines` | `Array<string>` | …or those timelines, each whole and by itself, side by side |
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's first timeline (how a stop looks too: `{ whenStopped: 'animateToStart' }`), merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `variables` | `Record<string, PxVariableValue>` | values for the document's variables, by name — they win over the file's defaults; a name that leaves the prop goes back to the file's value. A change never builds a new player. See [Variables](../../docs/library/variables.md) |
| `variant` | `string \| null` | a named set of defaults from the file's `definitions.variableVariants` |
| `cssVariables` | `boolean \| Record<string, string>` | deliver variables as CSS custom properties, so the page's stylesheet sets them: `true`, or a map with a `"*"` pattern — `{ '*': 'card-*', bg: 'brand-primary' }` |
| `onReady` | `() => void` | The player exists and the SVG is rendered — once, async |
| `onPlaybackStart` | `() => void` | A playback began — `timeline.start()`, `timeline.play()` from rest, a `timeline.start` / `timeline.play` trigger, `playback` to `'on'` / `'paused'` from `'off'`, the visibility gate starting it again |
| `onPlaybackResume` | `() => void` | The playback carried on after a freeze — `timeline.resume()`, `timeline.play()`, a `timeline.resume` trigger, `playback` back to `'on'`, the visibility gate when it is seen again |
| `onPlaybackPause` | `() => void` | The playback was frozen — `timeline.pause()`, a `timeline.pause` trigger, `playback` `'paused'`, or the visibility gate's `pause` when it left the screen |
| `onPlaybackFinish` | `() => void` | The last pass ended by playing — the state is `finished`, whatever `whenFinished` then shows. Never for a stop that goes to the end (that is `onPlaybackStop`), never for a loop without end |
| `onDestroy` | `() => void` | Called when the animation is destroyed (e.g. unmount) |
| `onPlaybackStop` | `() => void` | The playback was stopped — a `timeline.stop` trigger, `playback` `'off'`, `timeline.stop()` or the visibility gate's `stop`; at once, or on arrival for the stops that finish the pass first. A pause, the end and a destroy each fire their own; a seek reports nothing |
| `onFlowStepChange` | `(flowStep: string, previous: string, flow: string) => void` | A flow went to another step — a rule, a step's `whenFinished`, `flow.goTo()` or the `flowStep` prop; `flow` is its id, `default` for the flow `default` |
| `onWarning` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `suppressWarnings` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarning`, if you gave it, still fires: this is about the console, not about you |
| `suppressErrors` | `boolean` | the same switch for `console.error` |
| `className` | `string` | CSS class applied to the rendered root `<svg>` |
| `style` | `CSSProperties` | Inline styles applied to the rendered root `<svg>` |

With no control prop (`showAsStatic` / `showAtProgress` / `showAtTime` / `playback` / `disableActions` / `actions`) the component plays the file the way it was saved — its own triggers drive it; `playerRef` on its own changes nothing, it just gives you the handle. TypeScript accepts one driver family at a time (`PxControlProps` is a union).

`SvgCssAnimationPlayer` (for SVGR-imported pre-rendered SVG + CSS files) takes the same names, narrowed — `actions` (with none given nothing starts it: the SVG carries no triggers it could read), `timelineOptions` (the gate: the two numbers and `whenOutOfView`), `className`, `style`; its props type `SvgCssAnimationPlayerProps` is derived from `SvgAnimationPlayerProps`. See [CSS-flavor SVGs](../../docs/library/react.md#css-flavor-svgs--svgcssanimationplayer).

Note: passing a different `document` (or unmounting) throws the old player away and builds a new one; the old instance emits `onDestroy` on its way out. Changing `showAtProgress` / `showAtTime` does **not** recreate the animator — it just jumps the existing one to the new position.