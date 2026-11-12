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

### Autoplay

Uses the triggers defined in the animation document (load, hover, click — behind the visibility
gate), or the triggers object you bind instead of `true`:

```vue
<template>
  <SvgAnimationPlayer :doc="animationDoc" playUsingActionTriggers />
  <SvgAnimationPlayer :doc="animationDoc" :playUsingActionTriggers="{ 'playback.start': 'hoverIn', 'playback.pause': 'hoverOut' }" />
  <!-- a click starts it, the next click stops it -->
  <SvgAnimationPlayer :doc="animationDoc" :playUsingActionTriggers="{ 'playback.start': 'click', 'playback.stop': 'click' }" />
</template>
```

### Declarative playback — `playback`

Control playback with one lever — `playback` holds a position, `'off'` (no playback) · `'on'` (a playback) ·
`'paused'` (the playback, frozen); a change of position presses one built-in button (`playback.start` · `playback.pause` ·
`playback.resume` · `playback.stop`), and how a start or a stop looks is the file's `timeline.actions`, adjusted
through the `actions` prop:

```vue
<script setup lang="ts">
import { ref } from 'vue';
const paused = ref(false);
</script>

<template>
  <SvgAnimationPlayer :doc="animationDoc" :playback="paused ? 'paused' : 'on'" />
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
  <SvgAnimationPlayer :doc="animationDoc" ref="player" />
  <button @click="player?.playback.start()">Start</button>
  <button @click="player?.playback.pause()">Pause</button>
  <button @click="player?.playback.stop()">Stop</button>
</template>
```

<!-- px-check members PxPlaybackControls pkg=vue extra=PxAnimationPlayerHandle,PxPlaybackControls,playback,play -->
`PxAnimationPlayerHandle` is `{ playback }` — the same `PxPlaybackControls` as the web player: the four buttons `playback.start()` (the configured start, `actions["playback.start"]`; a paused playback unfreezes), `playback.stop()` (the configured stop, `actions["playback.stop"]` — its animate-to-end preset stops after the current pass), `playback.pause()`, `playback.resume()`; `playback.jumpToStart()` (to the rest pose now, unconditionally — reports nothing), `playback.jumpToEnd()` (the end pose, no motion — advanced), `playback.playOnce()` (one fresh pass from the start, whatever the file's iterations say); the state `playback.getState()` (off · playing · paused · finished · returning · destroyed), `playback.isActive()`, `playback.isPlaying()`; one iteration — `playback.getDuration()` (one pass, ms — a looping file's slider maximum), `getCurrentTime()` / `setCurrentTime(ms)` (the frame inside the current iteration), `getCurrentProgress()` / `setCurrentProgress(p)`, `getCurrentIteration()`; the whole playback — `getTotalDuration()` (null when infinite), `getTotalTime()` / `setTotalTime(ms)`, `getTotalProgress()`; the speed — `playback.getSpeed()` / `playback.setSpeed(speed)` (1 normal, 2 double, negative = reverse) and the same values at it, `getDurationAtSpeed()` / `setDurationAtSpeed(ms)`, `getTotalDurationAtSpeed()`, `getCurrentTimeAtSpeed()`, `getTotalTimeAtSpeed()`. Plain names are content ms inside the iteration, `total…` the playback (including repeats, GSAP's words), `…AtSpeed` the same at the current speed ([Two clocks](../../docs/library/playback-and-triggers.md#two-clocks)). No `play()` / `pause()` aliases — one spelling per act (until 1.25 the methods sat flat on the handle).

### Controlled time

Render a single frame — by time in milliseconds, or by fraction of one iteration:

```vue
<template>
  <SvgAnimationPlayer :doc="animationDoc" :showAtTime="500" />      <!-- 500 ms in -->
  <SvgAnimationPlayer :doc="animationDoc" :showAtProgress="0.5" />  <!-- halfway through -->
</template>
```

## Props

<!-- px-check props SvgAnimationPlayer pkg=vue -->
| Prop | Type | Description |
|---|---|---|
| `doc` | `PxDocumentJson` | The animation document to render (required); a `.json` import passes as-is |
| `playUsingActionTriggers` | `boolean \| PxActionTriggersInput` | `true`: play on the document's own triggers; an object: these triggers instead — `{ "playback.start", "playback.stop", "playback.pause", "playback.resume" }`, each one event or a list of the events that list may name (`'load' \| 'hoverIn' \| 'hoverOut' \| 'click'`; `playback.resume` is derived when left out). See [Triggers](../../docs/library/playback-and-triggers.md#triggers--when-it-plays) |
| `playback` | `'off' \| 'on' \| 'paused'` | A lever (`PxPlayback`): its position is held, and a change presses one button — `off` → `on` `playback.start()`, `on` → `paused` `playback.pause()`, `paused` → `on` `playback.resume()`, → `off` `playback.stop()`. How each looks is the file's `actions` (and the `actions` prop) — see [Actions](../../docs/library/playback-and-triggers.md#actions--how-a-start-and-a-stop-look). A mount with `'off'` presses nothing; with `'paused'` starts the playback frozen |
| `showAtProgress` | `number` | show the frame at this position in ONE iteration: `0` is the first frame, `0.5` the middle, `1` the last |
| `showAtTime` | `number` | show the frame at that time, in milliseconds inside one iteration (`0` to `playback.getDuration()`) |
| `timelineOptions` | `PxTimelineOptions` | per-instance override of the document's `timeline` block, minus its `actionTriggers` and `actions`, deep-merged over it — same shape as the file; a key left out keeps the file's value. See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `actions` | `PxActionsOptions` | per-instance override of how a start and a stop look — `{ 'playback.stop': 'animateToStart' }` — deep-merged over the document's `timeline.actions` (the end of the pass, `atEnd`, is a timeline key: `timelineOptions`). See [Overriding from a player](../../docs/library/playback-and-triggers.md#overriding-from-a-player) |
| `onWarning` | `(diagnostic) => void` | it plays, but something was ignored, degraded or misspelled; without it → `console.warn` (a prop, not an event — see below) |
| `onError` | `(diagnostic) => void` | this instance will not play — failed to load, parse or build, or the render threw; without it → `console.error` |
| `suppressWarnings` | `boolean` | switch the `console.warn` fallback off — for when you know the player has something to say about this document and are prepared to tolerate it. `onWarning`, if you gave it, still fires: this is about the console, not about you |
| `suppressErrors` | `boolean` | the same switch for `console.error` |

With none of `playUsingActionTriggers` / `playback` / `showAtProgress` / `showAtTime` set, the component renders the animation statically (initial state, no playback); use the template ref for imperative control.

Note: passing a different `doc` (or unmounting) throws the old player away and builds a new one; the old instance emits `destroy` on its way out. Changing `showAtProgress` / `showAtTime` does **not** recreate the animator — it just jumps the existing one to the new position.

## Events

<!-- px-check emits SvgAnimationPlayer pkg=vue -->
| Event | Description |
|---|---|
| `ready` | The player exists and the SVG is rendered (once, async) |
| `playbackStart` | A playback began — `playback.start()`, a `playback.start` trigger, `playback` to `'on'` / `'paused'` from `'off'`, `playback.playOnce()` |
| `playbackResume` | The playback carried on after a freeze — `playback.resume()`, a `playback.resume` trigger, `playback` back to `'on'` |
| `playbackPause` | The playback was frozen — `playback.pause()`, a `playback.pause` trigger, `playback` `'paused'` (not the gate's hold, which reports nothing) |
| `finish` | Animation reached its end — every iteration played, or `playback.jumpToEnd()` was called (a loop stopped at a pass end emits `playbackStop` only) |
| `destroy` | The player was torn down (e.g. on unmount) |
| `playbackStop` | The playback was stopped — a `playback.stop` trigger, `playback` `'off'` or `playback.stop()`; at once, or on arrival for `animateToEnd`. A pause, the end and a destroy each fire their own; `playback.jumpToStart()` emits nothing |