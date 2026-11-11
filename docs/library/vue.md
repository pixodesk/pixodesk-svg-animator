# Vue — `@pixodesk/svg-animator-vue`

[← Next.js](./nextjs.md) · [Contents](../../README.md#documentation) · Next: [Nuxt →](./nuxt.md)

Use this in a Vue 3 or Nuxt app: drop in the component, pass it the JSON, and it renders the
animation and controls its playback. It wraps the [web player](./web-player.md) and
renders the SVG through Vue's virtual DOM, so it is SSR-safe and Nuxt-ready. It mirrors the
[React component](./react.md) feature for feature, so the two guides read the same.

```bash
npm install @pixodesk/svg-animator-vue
```

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <SvgAnimationPlayer :doc="animation" playUsingActionTriggers />
</template>
```

The component renders the document's root `<svg>` directly — there is no wrapper element. To
set its size, give the element that contains it a width and height (or put `style` on the
component itself — see the props table); the SVG keeps its proportions.

## Control modes

Every driver prop starts with its verb — `play…` plays, `show…` shows a frame: `playUsingActionTriggers`
(the document's triggers, or ones you pass), `playRun` (your state — `off` · `on` · `paused`),
`showAtProgress` / `showAtTime` (your position). Set props from more than one group and the
highest-priority one wins — `showAtProgress` → `showAtTime` → `playRun`
→ `playUsingActionTriggers` — and the
component warns, naming both props and the winner ([PX1501](../diagnostics.md#the-props-a-component-was-given)). The template ref is not a mode: it is
available in every mode and never changes which one you are in. React, Vue and React Native all
resolve this the same way, from one rule in core.

Nothing plays until a prop or option names the driver (`playUsingActionTriggers`, `playRun`,
`showAt…`). A file embedded with no code around it — the `<div data-px-animation-src>` tag, the
CSS wrapper, a standalone SVG file — has no other possible driver, so there the embedding is that
naming and the file plays as saved.

In every mode but `playUsingActionTriggers` the file's own triggers are switched off — core's
`withoutTriggerDriver` replaces them with an empty block, so nothing starts the animation by
itself ([a note on the control props](./playback-and-triggers.md#a-note-on-the-components-control-props)).

### Play using action triggers (`playUsingActionTriggers`)

> **Example:** [`vue/play-using-action-triggers`](../../examples/docs-examples/src/cases/vue/play-using-action-triggers/) — `pnpm example:docs`, then open `#vue/play-using-action-triggers`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click — once enough of it is on screen.

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <SvgAnimationPlayer :doc="animation" playUsingActionTriggers />
</template>
```

`playUsingActionTriggers` alone uses the triggers saved in the document — their event lists and the
visibility gate ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)).
Bind an **object** instead and that is the whole `actionTriggers` block to use for this mount — a
replacement, not a merge: the lists you leave out are simply not listed, never the file's values.
How each action looks stays in the file's `actions`, which the `actions` prop adjusts — see
[Playback overrides](#playback-overrides).

```vue
<template>
  <!-- plays while hovered; when the pointer leaves it plays on to the end of the current pass, then rests -->
  <SvgAnimationPlayer :doc="animation"
    :playUsingActionTriggers="{ startRun: 'hoverIn', stopRun: 'hoverOut' }"
    :actions="{ stopRun: 'animateToEnd' }" />

  <!-- a click toggles off → playing → paused → playing (the state rule picks the list) -->
  <SvgAnimationPlayer :doc="animation" :playUsingActionTriggers="{ startRun: 'click', pauseRun: 'click' }" />

  <!-- a click starts it, the next click stops it -->
  <SvgAnimationPlayer :doc="animation" :playUsingActionTriggers="{ startRun: 'click', stopRun: 'click' }" />
</template>
```

### Controlled time (`showAtProgress` / `showAtTime`)

> **Example:** [`vue/controlled-time`](../../examples/docs-examples/src/cases/vue/controlled-time/) — `pnpm example:docs`, then open `#vue/controlled-time`.

Use these when your code owns the position — a slider, a scroll offset, a step in a
walkthrough. The component renders exactly that frame and never plays on its own.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const time = ref(0);
</script>

<template>
  <SvgAnimationPlayer :doc="animation" :showAtTime="time" />
  <input type="range" min="0" max="2000" v-model.number="time" />

  <!-- a fixed frame by FRACTION of one iteration — that is `showAtProgress`, not
       `showAtTime` (milliseconds, so `:showAtTime="0.5"` would be half a millisecond in) -->
  <SvgAnimationPlayer :doc="animation" :showAtProgress="0.5" />
</template>
```

Both are positions in **one iteration** of the content window — `showAtProgress` from `0` to `1`,
`showAtTime` from `0` to `getDuration()` ms — so neither needs an exception for
`iterations: 'infinite'`. Changing the value moves the existing player to the new position — nothing
is recreated. The read twins on the template ref are `getCurrentProgress()` and `getCurrentTime()`.

### Declarative playback — `playRun`

> **Example:** [`vue/declarative`](../../examples/docs-examples/src/cases/vue/declarative/) — `pnpm example:docs`, then open `#vue/declarative`.

**`playRun` names a position, not a command** — a lever your app holds: `'off'` (no run), `'on'`
(a run) or `'paused'` (the run, frozen). A change of position presses one of the built-in buttons —
`off` → `on` is `startRun()`, `on` → `paused` is `pauseRun()`, `paused` → `on` is `resumeRun()`, anything
→ `off` is `stopRun()` — and HOW a start or a stop looks is the file's `actions` block, which the
`actions` prop adjusts and which the triggers and the ref honour too
([Actions — how a start and a stop look](./playback-and-triggers.md#actions--how-a-start-and-a-stop-look)).
`playRun` `'off'` performs the **stop** action (`actions.stopRun`: `jumpToStart`, `animateToStart`,
`jumpToEnd` or `animateToEnd`) — it does not pause; freeze with `'paused'`.
With the defaults, a ONE-SHOT document (a single pass) plays to the end on `'on'` and holds,
and snaps back on `'off'`; a LOOPING document (`iterations` > 1 or `'infinite'`) runs on `'on'`
and snaps to rest on `'off'` — or plays on to the end of the current pass first with
`:actions="{ stopRun: 'animateToEnd' }"`. A change always moves from the current frame; a mount with
`'on'` plays (a one-shot to its end), a mount with `'off'` presses nothing, a mount with `'paused'`
starts the run frozen. No pair of positions is invalid (`play` / `pause` / `playState` until 1.23 —
the booleans had an impossible pair, and the word mixed the request with the readout; the readout is
`getRunState()`). The rule is shared with the React and React Native components
(`resolveDeclarativePlayback` in core). One-shot verbs (`runOnce()`, `jumpToEnd()`) live on the
template ref.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const hovered = ref(false);
const busy = ref(false);
const frozen = ref(false);
</script>

<template>
  <!-- the trash-can lid: opens on hover, plays BACK closed on leave, from wherever it is -->
  <div @mouseenter="hovered = true" @mouseleave="hovered = false">
    <SvgAnimationPlayer :doc="animation" :playRun="hovered ? 'on' : 'off'" :actions="{ stopRun: 'animateToStart' }" />
  </div>

  <!-- a spinner: runs while busy; when busy ends it finishes the current turn, then rests -->
  <SvgAnimationPlayer :doc="animation" :playRun="busy ? 'on' : 'off'" :actions="{ stopRun: 'animateToEnd' }" />

  <!-- the same spinner with a freeze button: 'paused' keeps the run, frozen -->
  <SvgAnimationPlayer :doc="animation" :playRun="frozen ? 'paused' : busy ? 'on' : 'off'" />
</template>
```

The other recipes — overlay art that appears instantly and retreats animated
(`{ startRun: 'jumpToEnd', stopRun: 'animateToStart' }`), a splash that replays
on every click (`{ startRun: 'jumpToStart' }`) — are written out on the [React page](./react.md#declarative-playback--playrun);
the same `actions` objects work here.

### Imperative API (template ref)

> **Example:** [`vue/imperative`](../../examples/docs-examples/src/cases/vue/imperative/) — `pnpm example:docs`, then open `#vue/imperative`.

The component exposes the playback API on its template ref, so it is available in every mode:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const player = ref<PxAnimationPlayerHandle | null>(null);
</script>

<template>
  <SvgAnimationPlayer :doc="animation" ref="player" />
  <button @click="player?.startRun()">Start</button>
  <button @click="player?.pauseRun()">Pause</button>
  <button @click="player?.stopRun()">Stop</button>
</template>
```

The ref holds core's `PxAnimationPlayerHandle` — the one handle name every framework package
exports, so the three cannot drift apart. The four buttons — `startRun()`, `stopRun()`, `pauseRun()`,
`resumeRun()` — take no arguments: how a start or a stop looks is the file's `actions`, and the
handle follows it exactly as the triggers and the `playRun` prop do. `play()` and `pause()` stay as
one-line aliases.

<!-- px-check signature pkg=vue loose=PxAnimationPlayerHandle.getRunState -->
```typescript
interface PxAnimationPlayerHandle {
    isPlaying(): boolean;                  // getRunState() === 'playing'
    getRunState(): PxRunState;             // the one state read — the RUN's: 'off' | 'playing' | 'paused' | 'finished'
                                           //   | 'returning' (an animateToStart leg plays back to the rest pose) | 'destroyed'
    isRunActive(): boolean;                // a run exists: playing · paused · finished
    startRun(): void;                      // the configured start (`actions.startRun`); a paused run unfreezes,
                                           //   a returning one turns around — emits `runStart`
    stopRun(): void;                       // the configured stop (`actions.stopRun`: jumpToStart · animateToStart ·
                                           //   jumpToEnd · animateToEnd) — what a `stopRun` trigger does; emits `runStop`
    pauseRun(): void;                      // freeze the current frame (only while playing) — emits `runPause`
    resumeRun(): void;                     // carry on from the frozen frame (only while paused) — emits `runResume`
    play(): void;                          // ALIAS: getRunState() === 'paused' ? resumeRun() : startRun()
    pause(): void;                         // ALIAS of pauseRun()
    jumpToStart(): void;                   // to the rest pose NOW, unconditionally — reports nothing (like a seek)
    jumpToEnd(): void;                     // the end pose, no motion; runs `atEnd`, emits `finish`
                                           //   (advanced — the `jumpToEnd` preset as a call)
    runOnce(): void;                       // ONE fresh pass from the start, whatever `iterations` say;
                                           //   the end pose follows `atEnd`

    // Playback time — the `playback…` family, every value derived from the speed
    getPlaybackSpeed(): number;            // 1 normal, 2 double, 0.5 half, negative plays backwards (a
                                           //   `reverse` pass at −1 plays forwards); starts at the file's
                                           //   `timeline.playbackSpeed`
    setPlaybackSpeed(speed: number): void; // replaces it; 0 and non-finite are rejected with a
                                           //   warning — use pauseRun()
    getPlaybackDuration(): number | null;  // one pass in playback ms at the current speed: getDuration() / |speed|
    setPlaybackDuration(ms: number): void; // the same knob as a length: sets the speed so one pass takes `ms`
    getTotalPlaybackDuration(): number | null; // the whole run in playback ms; null when `iterations` is 'infinite'
    getCurrentPlaybackTime(): number | null;   // the playhead in the pass, playback ms: getCurrentTime() / |speed|
    getTotalPlaybackTime(): number | null; // the playhead on the run, playback ms: getTotalTime() / |speed|

    // Model time, ONE iteration — the plain names
    getDuration(): number | null;          // one pass of the content window, ms — a looping file's slider maximum
    getCurrentTime(): number | null;       // the frame on screen: ms inside the current iteration,
                                           //   0..getDuration(); a reversed pass of `alternate` counts down
    setCurrentTime(time: number): void;    // seek inside the current iteration; clamped to [0, getDuration()]
    getCurrentProgress(): number | null;   // the same position as 0–1 of the iteration — the read
                                           //   twin of the `showAtProgress` prop
    setCurrentProgress(p: number): void;   // seek, 0–1 of the current iteration
    getCurrentIteration(): number;         // which pass is playing, 0-based

    // Model time, the WHOLE run — the `total…` names
    getTotalDuration(): number | null;     // one pass × iterations; null when infinite — a finite run's
                                           //   slider maximum, no division to guard
    getTotalTime(): number | null;         // the playhead on the whole run, every iteration included;
                                           //   0 while the delay waits
    setTotalTime(ms: number): void;        // seek on the whole run; clamped to [0, getTotalDuration()]
    getTotalProgress(): number | null;     // the playhead as 0–1 of the whole run; null when endless
}
```

**Two clocks.** Plain names are model ms **inside the iteration**: `getCurrentTime()` is the frame on
screen, `0..getDuration()`, so a slider for a looping file spans one pass and wraps — the way every
animation player shows it. The `total…` names span the **whole run** ("total" = including repeats,
GSAP's words): `getTotalDuration()` is the slider maximum for a finite run and `null` when
`iterations` is `'infinite'` (the honest answer, no division to guard); `getTotalTime()` /
`getTotalProgress()` are the playhead on it. The `playback…` family is **playback time** — model time
÷ the speed: `getPlaybackDuration()` is how long one pass takes, `getCurrentPlaybackTime()` /
`getTotalPlaybackTime()` where the playhead is; the file's `timeline.playbackSpeed` is the initial
speed and `setPlaybackSpeed()` replaces it ([Two clocks](./playback-and-triggers.md#two-clocks)).
`jumpToStart()` is the unconditional jump to the rest pose and reports nothing, like a seek;
`stopRun()` runs the file's stop action and emits `runStop`. A call on a ref
whose component has unmounted is ignored ([PX1504](../diagnostics.md)); `getRunState()` then says
`'destroyed'`.

With none of `playUsingActionTriggers` / `showAtProgress` / `showAtTime` / `playRun` set, the first
frame renders statically and the ref is your only control.

## Playback overrides

The same document can play differently in each place you mount it. Three props, the same on every
player ([Overriding from a player](./playback-and-triggers.md#overriding-from-a-player)), and
the document you passed is never modified:

- `timelineOptions` — corrections to the file's `animator.timeline` block, minus its `actionTriggers`
  and `actions`: an object shaped like the file — `iterations`, `delay`, `playbackSpeed`, the gate
  numbers; whoever needs more edits the document.
- `actions` — corrections to the file's `timeline.actions`: `{ stopRun: 'animateToStart' }` changes how a stop
  looks and leaves every other setting as the file has it.
- `playUsingActionTriggers` — `true` plays on the file's triggers; an object is the whole `actionTriggers` block
  to use instead ([Play using action triggers](#play-using-action-triggers-playusingactiontriggers)). To have your
  code drive instead, pass no control prop at all — the file's triggers are then switched off and the template ref
  is the driver.

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions`, `actions` | **recursive partials** — objects merge key by key, values replace, a key left out changes nothing |
| a `playUsingActionTriggers` object | **replaces** the file's `actionTriggers` as a whole — its lists belong together |

```vue
<template>
  <!-- The file loops twice and plays on load; here it loops forever and waits for startRun() —
       without `playUsingActionTriggers` the file's triggers are switched off, so only your code starts it. -->
  <SvgAnimationPlayer :doc="animation" :timeline-options="{ iterations: 'infinite' }" ref="anim" />

  <!-- These triggers instead of the file's, and a smooth retreat on hover-out -->
  <SvgAnimationPlayer :doc="animation"
    :playUsingActionTriggers="{ startRun: 'hoverIn', stopRun: 'hoverOut' }"
    :actions="{ stopRun: 'animateToStart' }" />
</template>
```

There is no delete: a key you leave out keeps the file's value. To get a default back, set it
(`:timeline-options="{ delay: 0 }"`).

`actionTriggers` and `actions` are not keys of `timelineOptions` — only `playUsingActionTriggers` carries triggers
and only `actions` the action settings, so every key is reachable exactly one way. The out-of-view
behavior goes in `actions` (`:actions="{ outOfView: 'continue' }"`); the gate
numbers `inViewThreshold` and `inViewDebounce` are timeline keys and go in `timelineOptions`
([the visibility gate](./playback-and-triggers.md#whether-it-may-run--the-visibility-gate)).

**To repeat the whole animation**, pass `:timeline-options="{ iterations: 'infinite' }"` — there is no
`loop` prop. A `loop` inside a file means something narrower: it repeats part of one property's
keyframes ([per-property loops](../format/README.md#per-property-loops)).

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → How the merge works](./playback-and-triggers.md#how-the-merge-works).

## Props

Only `doc` is required. The file already carries the timing and the triggers you set in the
editor; every other prop is optional and, when passed, adjusts the file's value for this one
component.

The React set, minus `playerRef` / `className` / `style` — a template ref and Vue's attribute
inheritance cover those:

<!-- px-check signature pkg=vue -->
```typescript
const SvgAnimationPlayer: DefineComponent<{
    doc: PxDocumentJson;                  // required — the animation; a .json import passes as-is

    // Playback override — deep-merged over the file (Playback overrides above)
    timelineOptions?: PxTimelineOptions;  // the timing: the `timeline` block minus `actionTriggers` and `actions`
    actions?: PxActionsOptions;           // how a start and a stop look (+ the gate's outOfView): { stopRun: 'animateToStart' };
                                          //   the end of the pass is a timeline key — timelineOptions: { atEnd: 'jumpToStart' }

    // Control — the highest-priority one that is set picks the mode (Control modes above)
    playUsingActionTriggers?: boolean | PxActionTriggersInput; // true: the file's own triggers; an object: these triggers instead —
                                          //   { startRun, stopRun, pauseRun, resumeRun }, each one event or a list of the
                                          //   events that list may name ('load' | 'hoverIn' | 'hoverOut' |
                                          //   'click'); resumeRun is derived when left out
    playRun?: 'off' | 'on' | 'paused';    // a LEVER (`PxPlayRun`): a change of position presses one button — off → on
                                          //   startRun(), on → paused pauseRun(), paused → on resumeRun(), → off stopRun();
                                          //   how each looks is the file's `actions`; a mount with 'off' presses nothing
    showAtProgress?: number;              // a frame at 0–1 of ONE iteration
    showAtTime?: number;                  // a frame at this ms inside one iteration, 0..getDuration()

    // Diagnostics stay PROPS, not events: an event handler always exists, which would silence
    // the console fallback. onWarning = it plays, but something was ignored, degraded or misspelled;
    // onError = this instance will not play (the API at a glance)
    onWarning?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    suppressWarnings?: boolean; suppressErrors?: boolean;
}>;
```

Anything else you put on `<SvgAnimationPlayer>` — `class`, `style`, any attribute — ends up on
the `<svg>` element it renders (standard Vue attribute inheritance). So to set the animation's
size, either put `style="width: 300px; height: 300px"` on the component itself, or give those
dimensions to the element that contains it — the SVG keeps its proportions either way.

## Events

<!-- px-check emits SvgAnimationPlayer pkg=vue -->
| Event | When |
|---|---|
| `ready` | the player exists and the SVG is rendered — once, asynchronously; the push twin of `isReady()` |
| `runStart` | a run began — `startRun()`, a `startRun` trigger, `playRun` to `'on'` / `'paused'` from `'off'`, `runOnce()`; a returning run turned around |
| `runResume` | the run carried on after a freeze — `resumeRun()`, a `resumeRun` trigger, `playRun` back to `'on'` |
| `runPause` | the run was frozen at the current frame — `pauseRun()`, a `pauseRun` trigger, `playRun` `'paused'`. Not the visibility gate's hold, which reports nothing |
| `finish` | the animation reached its end — it played all its iterations, or `jumpToEnd()` was called. Does not fire when playback is stopped early; a loop stopped at a pass end emits `runStop` only |
| `destroy` | the player was thrown away: the component unmounted, or you passed a different `doc` and a new player was built for it |
| `runStop` | the run was stopped — a `stopRun` trigger, `playRun` `'off'` or `stopRun()`; at once, or on arrival for `animateToEnd`. A pause is `runPause`, the end `finish`; `jumpToStart()` emits nothing |

`onWarning` and `onError` are **props**, not events. With an event, Vue would treat the message as
handled even when nobody listens, so it would never reach the console. As props, leaving them
out means exactly that — and the message goes to the console as usual.

Each diagnostic is `{ code, kind, data?, message, error? }`. `code` is a number you can switch on — its description is on the [codes page](../diagnostics.md), which `message` links to; `data` carries the specifics. `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the props you passed) · `internal` (report it to us). So you
can route rather than just log — surface `document` problems in a build check, for instance. Once
you know what a document has to say and tolerate it, `suppressWarnings` keeps it out of the console.

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const onDone = () => console.log('finished');
const onRunStop = () => console.log('stopped');
</script>

<template>
  <SvgAnimationPlayer :doc="animation" playUsingActionTriggers @finish="onDone" @run-stop="onRunStop" />
</template>
```

Passing a different `doc` throws the old player away and builds a new one; the old instance
emits `destroy` on its way out.

## CSS-flavor SVGs — `SvgCssAnimationPlayer`

> **Example:** [`vue/css-loader`](../../examples/docs-examples/src/cases/vue/css-loader/) — `pnpm example:docs`, then open `#vue/css-loader`.

For a **pre-rendered SVG + CSS animation** file imported with
[`vite-svg-loader`](https://github.com/jpkleemans/vite-svg-loader) (or any loader that yields a
component), this wrapper adds the triggers and the visibility gate. It renders a `<div>` of its
own around your SVG component — that is what `SvgCssAnimationPlayer` becomes on the page — and
starts, pauses or stops the animation by switching the file's CSS classes on that `<div>`. Its props
are `SvgAnimationPlayer`'s names, narrowed where a class toggle can do less (they derive from the JSON
component's props and are checked against them):

```vue
<script setup>
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-vue';
import AnimationSvg from './animation.svg';   // vite-svg-loader
</script>

<template>
  <SvgCssAnimationPlayer :playUsingActionTriggers="{ startRun: 'hoverIn', pauseRun: 'hoverOut' }" style="width: 400px; height: 400px">
    <AnimationSvg />
  </SvgCssAnimationPlayer>
</template>
```

`playUsingActionTriggers` is the JSON player's block — the same lists over the same events, read by
the same rules ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)) —
and the gate is the same gate. It takes the block only, never `true`: a script-free SVG imported as a
component carries no triggers the component could read. An absent `playUsingActionTriggers` lists
nothing, like an empty block — nothing starts the animation without one; to play on load, say so:
`:playUsingActionTriggers="{ startRun: 'load' }"`. The gate numbers go in `timelineOptions`, as on the
JSON component: `:timelineOptions="{ inViewThreshold: 1 }"`.

<!-- px-check signature pkg=vue loose=SvgCssAnimationPlayer.timelineOptions -->
```typescript
// The SVG goes in the default slot; every other attribute (class, style, …) lands on the wrapper div.
const SvgCssAnimationPlayer: DefineComponent<{
    playUsingActionTriggers?: PxActionTriggersInput; // the BLOCK only: { startRun, stopRun, pauseRun, resumeRun },
                                          //   each one event or a list of the events that list may name ('load' |
                                          //   'hoverIn' | 'hoverOut' | 'click'); resumeRun is derived when left out
    timelineOptions?: { inViewThreshold?: number; inViewDebounce?: number };
                                          // the gate numbers only: 0–1 of the SVG on screen before it may run
                                          //   (default 0.5; 0 = any visible pixel), and ms it must hold first (150)
    actions?: Pick<PxActionsOptions, 'outOfView'>; // only `outOfView` applies: 'pause' (default) | 'continue' |
                                          //   'jumpToStart' while nobody can see it
}>;
```

**Accepted limits** of a class toggle — how the moves look stays in the file's CSS, so here:

- the start is always `continue` — a class cannot jump keyframes to their start or end;
- the stop is always `jumpToStart` — a class cannot play keyframes backwards or on to their end;
- `whenIdle` and `atEnd` are the file's own CSS and are not changed from here.

> ⚠️ **Don't put the SAME SVG file on a page twice.** You can have as many
> `<SvgCssAnimationPlayer>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#the-same-file-twice-on-one-page)).

Only the pure CSS flavor works this way (loaders strip or refuse `<script>`); flavors with
scripts should be inlined as raw HTML, or use JSON.

## API reference

Everything is spelled out above: `SvgAnimationPlayer` under [Props](#props) and [Events](#events),
the handle under [Imperative API](#imperative-api-template-ref), `SvgCssAnimationPlayer` under
[CSS-flavor SVGs](#css-flavor-svgs--svgcssanimationplayer). Modes, highest priority wins:
`showAtProgress` → `showAtTime` → `playRun` → `playUsingActionTriggers` → static — the
same rule as React and React Native, conflicts warned the same way; a change to `doc`'s content
(compared deeply) or to an override prop re-creates the player. The callbacks and diagnostics
are the shape every player shares — [the API at a glance](./README.md#the-api-at-a-glance).

<!-- px-check exports @pixodesk/svg-animator-vue -->
The package exports the two components, `SvgAnimationPlayer` and `SvgCssAnimationPlayer`, the
handle type `PxAnimationPlayerHandle`, and the document type `PxDocument` (for casting a JSON
import — [TypeScript](./installation.md#typescript)); nothing else.

## Example

Every section above links to its running example in
[`examples/docs-examples`](../../examples/docs-examples/). Each example is a small standalone
page, and they are all collected in one app: a list of every example down the side, with the
selected one running next to it. Run `pnpm example:docs` from the repository root to open it,
then pick an example from the list — or jump straight to one by its address in the URL, like
`#vue/play-using-action-triggers`. Each example has a test that runs on every build.

[← Next.js](./nextjs.md) · [Contents](../../README.md#documentation) · Next: [Nuxt →](./nuxt.md)
