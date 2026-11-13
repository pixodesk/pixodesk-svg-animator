# animator-vue

> 📖 Full user guide: [docs/library/vue.md](../../docs/library/vue.md) · [all docs](../../README.md#documentation)

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Vue component for rendering and controlling Pixodesk SVG animations.


# 🚧 **Status - This project is currently under development.**

## Usage

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animationDoc from './animation.json';
</script>
```

### Player action triggers

Uses the triggers defined in the animation document (load, hover, click — behind the visibility
gate), or the triggers object you bind instead of `true`:

```vue
<template>
  <SvgAnimationPlayer :document="animationDoc" playerActionTriggers />
  <SvgAnimationPlayer :document="animationDoc" :playerActionTriggers="{ 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' }" />
  <!-- a click starts it, the next click stops it -->
  <SvgAnimationPlayer :document="animationDoc" :playerActionTriggers="{ 'playback.start': 'click', 'playback.stop': 'click' }" />
</template>
```

### Declarative playback — `playback`

Control playback with one lever — `playback` holds a position, `'off'` (no playback) · `'on'` (a playback) ·
`'paused'` (the playback, frozen); a change of position presses one built-in button (`playback.start` · `playback.pause` ·
`playback.resume` · `playback.stop`), and how a stop looks is the file's `timeline.actions`, adjusted
through the `actions` prop:

```vue
<script setup lang="ts">
import { ref } from 'vue';
const paused = ref(false);
</script>

<template>
  <SvgAnimationPlayer :document="animationDoc" :playback="paused ? 'paused' : 'on'" />
  <button @click="paused = !paused">Toggle</button>
</template>
```

### Imperative API

Use a template ref for full programmatic control:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';

const player = ref<PxAnimationPlayerHandle | null>(null);
</script>

<template>
  <SvgAnimationPlayer :document="animationDoc" ref="player" />
  <button @click="player?.playback.play()">Play</button>
  <button @click="player?.playback.pause()">Pause</button>
  <button @click="player?.playback.stop()">Stop</button>
  <button @click="player?.playback.start()">Restart</button>
</template>
```

<!-- px-check members PxPlaybackControls pkg=vue extra=PxAnimationPlayerHandle,PxPlaybackControls,playback,playOnce,jumpToStart,jumpToEnd -->
`PxAnimationPlayerHandle` is `{ playback }` — the same `PxPlaybackControls` as the web player: the five buttons `playback.start()` (always from the start, in every state), `playback.play()` (start, or carry on — a paused playback resumes, a picture on its way back turns around, nothing while playing), `playback.stop()` (the configured stop, `actions["playback.stop"]` — its animate-to-end presets stop after the current pass), `playback.pause()`, `playback.resume()`; the state `playback.getState()` (off · playing · paused · finished · returning · destroyed), `playback.isActive()`, `playback.isPlaying()`; one iteration — `playback.getDuration()` (one pass, ms — a looping file's slider maximum), `getCurrentTime()` / `setCurrentTime(ms)` (the frame inside the current iteration), `getCurrentProgress()` / `setCurrentProgress(p)` (counted in iterations — `1.2` is 20 % into the second), `getCurrentIteration()`; the whole playback — `getTotalDuration()` (null when infinite), `getTotalTime()` / `setTotalTime(ms)`, `getTotalProgress()`; the speed — `playback.getSpeed()` / `playback.setSpeed(speed)` (1 normal, 2 double, negative = reverse) and the same values at it, `getDurationAtSpeed()` / `setDurationAtSpeed(ms)`, `getTotalDurationAtSpeed()`, `getCurrentTimeAtSpeed()`, `getTotalTimeAtSpeed()`. Plain names are content ms inside the iteration, `total…` the playback (including repeats, GSAP's words), `…AtSpeed` the same at the current speed ([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)). A seek while playing keeps playing; in any other state the playback becomes paused at that frame ([Moving the playhead](../../docs/library/playback-and-triggers.md#moving-the-playhead)). One spelling per act (until 1.25 the methods sat flat on the handle, and `playOnce()`, `jumpToStart()` and `jumpToEnd()` existed — a one-iteration timeline and `start()`, `stop()` and `setCurrentProgress()` say the same).

### Controlled time

Render a single frame — by time in milliseconds inside one iteration, or by progress counted in iterations:

```vue
<template>
  <SvgAnimationPlayer :document="animationDoc" :showAtTime="500" />      <!-- 500 ms in -->
  <SvgAnimationPlayer :document="animationDoc" :showAtProgress="0.5" />  <!-- halfway through the first iteration -->
</template>
```

## Props

<!-- px-check props SvgAnimationPlayer pkg=vue -->
| Prop | Type | Description |
|---|---|---|
| `document` | `PxDocumentJson` | The animation document to render (required); a `.json` import passes as-is (inline only, no URL form yet) |
| `playerActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play on the document's own triggers; an object: these triggers instead — `{ "playback.start", "playback.play", "playback.stop", "playback.pause", "playback.resume" }`, each one event or a list of the events that list may name (`'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`; `playback.resume` is derived when left out). See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `playback` | `'off' \| 'on' \| 'paused'` | A lever (`PxPlayback`): its position is held, and a change presses one button — `off` → `on` `playback.start()`, `on` → `paused` `playback.pause()`, `paused` → `on` `playback.resume()`, → `off` `playback.stop()`. How a stop looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#actions--how-a-stop-looks); `'on'` always plays from the start. A mount with `'off'` presses nothing; with `'paused'` starts the playback frozen |
| `showAtProgress` | `number` | show the frame at this position, counted in iterations: `0` is the first frame, `0.5` the middle of the first iteration, `1` its last frame, `1.2` 20 % into the second |
| `showAtTime` | `number` | show the frame at that time, in milliseconds inside one iteration (`0` to `playback.getDuration()`) |
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block, minus its `actionTriggers` and `actions`, deep-merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how a stop looks — `{ 'playback.stop': 'animateToStart' }` — and of `outOfView`, deep-merged over the document's `timeline.actions` (what shows once finished, `whenFinished`, is a timeline key: `timelineOptions`). See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `onWarning` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` (a prop, not an event — see below) |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `suppressWarnings` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarning`, if you gave it, still fires: this is about the console, not about you |
| `suppressErrors` | `boolean` | the same switch for `console.error` |

With none of `playerActionTriggers` / `playback` / `showAtProgress` / `showAtTime` set, the component renders the animation statically (initial state, no playback); use the template ref for imperative control.

Note: passing a different `document` (or unmounting) throws the old player away and builds a new one; the old instance emits `destroy` on its way out. Changing `showAtProgress` / `showAtTime` does **not** recreate the animator — it just jumps the existing one to the new position.

## Events

<!-- px-check emits SvgAnimationPlayer pkg=vue -->
| Event | Description |
|---|---|
| `ready` | The player exists and the SVG is rendered (once, async) |
| `playbackStart` | A playback began — `playback.start()`, `playback.play()` from rest, a `playback.start` / `playback.play` trigger, `playback` to `'on'` / `'paused'` from `'off'`, the visibility gate starting it again |
| `playbackResume` | The playback carried on after a freeze — `playback.resume()`, `playback.play()`, a `playback.resume` trigger, `playback` back to `'on'`, the visibility gate when it is seen again |
| `playbackPause` | The playback was frozen — `playback.pause()`, a `playback.pause` trigger, `playback` `'paused'`, or the visibility gate's `pause` when it left the screen |
| `playbackFinish` | The last pass ended by playing — the state is `finished`, whatever `whenFinished` then shows. Never for a stop that goes to the end (that emits `playbackStop`), never for a loop without end |
| `destroy` | The player was torn down (e.g. on unmount) |
| `playbackStop` | The playback was stopped — a `playback.stop` trigger, `playback` `'off'`, `playback.stop()` or the visibility gate's `stop`; at once, or on arrival for the stops that finish the pass first. A pause, the end and a destroy each fire their own; a seek emits nothing |