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
  <!-- plays the way the file was saved -->
  <SvgAnimationPlayer :document="animation" />
</template>
```

The component renders the document's root `<svg>` directly — there is no wrapper element. To
set its size, give the element that contains it a width and height (or put `style` on the
component itself — see the props table); the SVG keeps its proportions.

## Control modes

With no control prop the component plays the file **the way it was saved** — its own `actionTriggers` start
it (on load, on hover, on click), behind the visibility gate; a file without triggers stays still until your
code starts it. The control props change who drives it:

<!-- px-check off the control props, prose — their types are checked under Props -->
| Prop | Mode | Who drives it |
|---|---|---|
| none (the default) | `actionTriggers` | the file's own triggers — and the template ref, if you take one |
| `:actionTriggers="{ … }"` | `actionTriggers` | these triggers instead of the file's |
| `disableActionTriggers` | `manual` | your code, through the template ref — the file's triggers are off |
| `:playback="'off' \| 'on' \| 'paused'"` | `playback` | your state |
| `:showAtProgress` / `:showAtTime` | `fixedTime` | your position — one frame, held |
| `showAsStatic` | `static` | nobody — the picture as drawn |

Set more than one and the highest-priority one wins — `showAsStatic` → `showAtProgress` → `showAtTime` →
`playback` → `disableActionTriggers` → `actionTriggers` — and the component warns, naming both props and the
winner ([PX1501](../diagnostics.md#the-props-a-component-was-given)). In every mode but the default the
file's own triggers are switched off
([Control modes — who drives it](./playback-and-triggers.md#control-modes--who-drives-it)). The template ref
is not a mode: it is available in every mode and never changes which one you are in. React, Vue and React
Native all resolve this the same way, from one rule in core.

### Action triggers (`actionTriggers`)

> **Example:** [`vue/play-using-action-triggers`](../../examples/docs-examples/src/cases/vue/play-using-action-triggers/) — `pnpm example:docs`, then open `#vue/play-using-action-triggers`.

The default — no prop needed: the component starts the animation the way the file says it should — on
load, on hover, on click — once enough of it is on screen.

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <SvgAnimationPlayer :document="animation" />
</template>
```

It uses the triggers saved in the document — their event lists and the visibility gate
([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)). Bind `actionTriggers` and
that is the whole block to use for this mount instead — a replacement, not a merge: the lists you leave out
are simply not listed, never the file's values. `:actionTriggers="null"` lists nothing, the same as
`disableActionTriggers`. How each action looks stays in the file's `actions`, which the `actions` prop
replaces — see [Playback overrides](#playback-overrides).

```vue
<template>
  <!-- plays while hovered; when the pointer leaves it plays on to the end of the current pass, then rests
       (`playback.play` carries on — a hover-in on the way to the end does not restart it) -->
  <SvgAnimationPlayer :document="animation"
    :actionTriggers="{ 'playback.play': 'hoverIn', 'playback.stop': 'hoverOut' }"
    :actions="{ 'playback.stop': 'animateToEnd' }" />

  <!-- a click toggles off → playing → paused → playing (the state rule picks the list) -->
  <SvgAnimationPlayer :document="animation" :actionTriggers="{ 'playback.play': 'click', 'playback.pause': 'click' }" />

  <!-- a click starts it, the next click stops it -->
  <SvgAnimationPlayer :document="animation" :actionTriggers="{ 'playback.start': 'click', 'playback.stop': 'click' }" />

  <!-- every click plays it from the start — also while it plays -->
  <SvgAnimationPlayer :document="animation" :actionTriggers="{ 'playback.start': 'click' }" />
</template>
```

### The picture as drawn (`showAsStatic`)

`showAsStatic` shows the SVG as drawn and nothing else, whatever the file says: no triggers, no scroll, and
every playback call on the template ref is ignored with a warning
([PX1506](../diagnostics.md#the-props-a-component-was-given)); the reads still answer. It beats every other
control prop — for a thumbnail, or a reduced-motion setting:

```vue
<template>
  <SvgAnimationPlayer :document="animation" :showAsStatic="prefersReducedMotion" />
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
  <SvgAnimationPlayer :document="animation" :showAtTime="time" />
  <input type="range" min="0" max="2000" v-model.number="time" />

  <!-- a fixed frame by FRACTION, counted in iterations — that is `showAtProgress`, not
       `showAtTime` (milliseconds, so `:showAtTime="0.5"` would be half a millisecond in) -->
  <SvgAnimationPlayer :document="animation" :showAtProgress="0.5" />
</template>
```

`showAtProgress` counts **iterations**, in the order they play: `0` the first frame, `1` the end of the first
iteration, `1.2` 20 % into the second (an `alternate` second pass runs backwards, so that is the frame at
80 %) — clamped to `0 … iterations`, no upper bound when endless, nothing wraps (0–1 of one iteration until
1.25). `showAtTime` is milliseconds inside one iteration, `0` to `playback.getDuration()`. Changing the value moves the existing player to the new position — nothing
is recreated. The read twins on the template ref are `playback.getCurrentProgress()` and `playback.getCurrentTime()`.

### Declarative playback — `playback`

> **Example:** [`vue/declarative`](../../examples/docs-examples/src/cases/vue/declarative/) — `pnpm example:docs`, then open `#vue/declarative`.

**`playback` names a position, not a command** — a lever your app holds: `'off'` (no playback), `'on'`
(a playback) or `'paused'` (the playback, frozen). A change of position presses one of the built-in buttons —
`off` → `on` is `playback.start()`, `on` → `paused` is `playback.pause()`, `paused` → `on` is `playback.resume()`, anything
→ `off` is `playback.stop()` — and HOW a stop looks is the file's `actions` block (or the one the
`actions` prop gives instead), which the triggers and the ref honour too
([Actions — how a stop looks](./playback-and-triggers.md#actions--how-a-stop-looks)).
`playback` `'off'` performs the **stop** action (`actions["playback.stop"]`: `jumpToStart`, `animateToStart`,
`jumpToEnd`, `animateToEnd` or `animateToEndAndBack`) — it does not pause; freeze with `'paused'`.
With the defaults, a ONE-SHOT document (a single pass) plays to the end on `'on'` and the last frame stays
(`whenFinished` `hold`), and snaps back on `'off'`; a LOOPING document (`iterations` > 1 or `'infinite'`) runs on
`'on'` and snaps to rest on `'off'` — or plays on to the end of the current pass first with
`:actions="{ 'playback.stop': 'animateToEnd' }"`. `'on'` is a start, so it always plays **from the start** — an
`'on'` while a stop plays the picture back jumps to the start first (a hover that turns around smoothly is the
`'playback.play'` trigger list, or `playback.play()` on the ref). A mount with `'on'` plays (a one-shot to its
end), a mount with `'off'` presses nothing, a mount with `'paused'` starts the playback frozen. No pair of positions is invalid (`play` / `pause` / `playState` until 1.23 —
the booleans had an impossible pair, and the word mixed the request with the readout; the readout is
`playback.getState()`). The rule is shared with the React and React Native components
(`resolveDeclarativePlayback` in core). A one-shot ping with no "off" — click, play one pass — is
`playback.start()` on the template ref.

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
  <!-- the trash-can lid: opens on hover, plays BACK closed on leave, from wherever it is
       (an enter on the way back starts it again from the start) -->
  <div @mouseenter="hovered = true" @mouseleave="hovered = false">
    <SvgAnimationPlayer :document="animation" :playback="hovered ? 'on' : 'off'" :actions="{ 'playback.stop': 'animateToStart' }" />
  </div>

  <!-- a spinner: runs while busy; when busy ends it finishes the current turn, then rests -->
  <SvgAnimationPlayer :document="animation" :playback="busy ? 'on' : 'off'" :actions="{ 'playback.stop': 'animateToEnd' }" />

  <!-- the same spinner with a freeze button: 'paused' keeps the playback, frozen -->
  <SvgAnimationPlayer :document="animation" :playback="frozen ? 'paused' : busy ? 'on' : 'off'" />
</template>
```

The other recipes — a splash that replays on every click, a heartbeat with a freeze button — are
written out on the [React page](./react.md#declarative-playback--playback); the same `actions` objects work here.

### Imperative API (template ref)

> **Example:** [`vue/imperative`](../../examples/docs-examples/src/cases/vue/imperative/) — `pnpm example:docs`, then open `#vue/imperative`.

The component exposes the playback API on its template ref, so it is available in every mode.
`disableActionTriggers` switches the file's own triggers off, so your buttons alone drive it; leave it out and
the ref works beside the file's triggers:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const player = ref<PxAnimationPlayerHandle | null>(null);
</script>

<template>
  <SvgAnimationPlayer :document="animation" disableActionTriggers ref="player" />
  <button @click="player?.playback.play()">Play</button>
  <button @click="player?.playback.pause()">Pause</button>
  <button @click="player?.playback.stop()">Stop</button>
</template>
```

The ref holds core's `PxAnimationPlayerHandle` — the one handle name every framework package
exports, so the three cannot drift apart: `playback`, everything a page does to the animation, the same
`PxPlaybackControls` the web player hands out — [every member is listed there](./web-player.md#the-playback-api).
The five buttons take no arguments: `playback.start()` always plays from the start, `playback.play()` starts or
carries on (a Play button), `playback.stop()`, `playback.pause()` and `playback.resume()`. How a stop looks is the
file's `actions`, and the handle follows it exactly as the triggers and the `playback` prop do. One spelling per
act (until 1.25 the methods sat flat on the handle, and `playOnce()`, `jumpToStart()` and `jumpToEnd()` existed —
a one-iteration timeline and `start()`, `stop()` and `setCurrentProgress()` say the same).

<!-- px-check signature pkg=vue loose=PxAnimationPlayerHandle.playback -->
```typescript
interface PxAnimationPlayerHandle {
    readonly playback: PxPlaybackControls; // start · play · stop · pause · resume — the buttons (each emits
                                           //   its event: `playbackStart` …); getState · isActive · isPlaying — the
                                           //   state; setCurrentTime · setCurrentProgress · setTotalTime — the
                                           //   seeks; getDuration · getCurrentTime · … ·
                                           //   getTotalProgress — content time; getSpeed / setSpeed and the
                                           //   …AtSpeed reads — the speed
}
```

**Two clocks.** Plain time names are content ms **inside the iteration**: `playback.getCurrentTime()` is the
frame on screen, `0..getDuration()` — the way every animation player shows it. Progress counts iterations, in
the order they play: `playback.getCurrentProgress()` is `1.2` 20 % into the second
([Moving the playhead](./playback-and-triggers.md#moving-the-playhead)). The `total…` names span the **whole playback** ("total" = including repeats,
GSAP's words): `playback.getTotalDuration()` is the slider maximum for a finite playback and `null` when
`iterations` is `'infinite'` (the honest answer, no division to guard); `playback.getTotalTime()` /
`playback.getTotalProgress()` are the playhead on it. The `…AtSpeed` names are the same values at the current
speed: `playback.getDurationAtSpeed()` is how long one pass takes, `playback.getCurrentTimeAtSpeed()` /
`playback.getTotalTimeAtSpeed()` where the playhead is; the file's `timeline.playbackSpeed` is the initial
speed and `playback.setSpeed()` replaces it ([Two clocks](./playback-and-triggers.md#two-clocks)).
A seek (`setCurrentTime()`, `setCurrentProgress()`, `setTotalTime()`) while `playing` keeps playing; in any other
state the playback becomes `paused` at that frame and `playback.resume()` plays on from it — a seek emits
nothing. `playback.stop()` runs the file's stop action and emits `playbackStop`. A call on a ref
whose component has unmounted is ignored ([PX1504](../diagnostics.md)); `playback.getState()` then says
`'destroyed'`.

With `disableActionTriggers` the ref is your only control; with no control prop at all it works beside the
file's own triggers.

## Playback overrides

The same document can play differently in each place you mount it. Three props, the same on every
player ([Overriding from a player](./playback-and-triggers.md#overriding-from-a-player)), and
the document you passed is never modified:

- `timelineOptions` — corrections to the file's `animator.timeline` block, minus its `actionTriggers`
  and `actions`: an object shaped like the file — `iterations`, `delay`, `playbackSpeed`, the gate
  numbers; whoever needs more edits the document.
- `actions` — the `timeline.actions` block to use instead of the file's: `{ 'playback.stop': 'animateToStart' }`
  says how a stop looks; a setting left out reads its default, never the file's value.
- `actionTriggers` — the whole `actionTriggers` block to use instead of the file's
  ([Action triggers](#action-triggers-actiontriggers)). To have your code drive instead, pass
  `disableActionTriggers` — the file's triggers are then switched off and the template ref is the driver.

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions` | **a recursive partial** — objects merge key by key, values replace, a key left out keeps the file's value |
| `actions`, `actionTriggers` | **blocks** that replace the file's as a whole — their settings belong together |

```vue
<template>
  <!-- The file loops twice and plays on load; here it loops forever and waits for playback.start() —
       `disableActionTriggers` switches the file's triggers off, so only your code starts it. -->
  <SvgAnimationPlayer :document="animation" :timeline-options="{ iterations: 'infinite' }" disableActionTriggers ref="anim" />

  <!-- These triggers instead of the file's, and a smooth retreat on hover-out (a hover-in on the way back turns it around) -->
  <SvgAnimationPlayer :document="animation"
    :actionTriggers="{ 'playback.play': 'hoverIn', 'playback.stop': 'hoverOut' }"
    :actions="{ 'playback.stop': 'animateToStart' }" />
</template>
```

There is no delete in `timelineOptions`: a key you leave out keeps the file's value. To get a default back, set
it (`:timeline-options="{ delay: 0 }"`). `actions` works the other way: it is the whole block, so a setting you
leave out reads its default, not the file's value — write every setting you want kept.

`actionTriggers` and `actions` are not keys of `timelineOptions` — only the `actionTriggers` prop carries
triggers and only `actions` the action settings, so every key is reachable exactly one way. The out-of-view
behavior goes in `actions` (`:actions="{ outOfView: 'continue' }"`); the gate
numbers `inViewThreshold` and `inViewDebounce` are timeline keys and go in `timelineOptions`
([the visibility gate](./playback-and-triggers.md#whether-it-may-run--the-visibility-gate)).

**To repeat the whole animation**, pass `:timeline-options="{ iterations: 'infinite' }"` — there is no
`loop` prop. A `loop` inside a file means something narrower: it repeats part of one property's
keyframes ([per-property loops](../format/README.md#per-property-loops)).

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → How the merge works](./playback-and-triggers.md#how-the-merge-works).

## Props

Only `document` is required. The file already carries the timing and the triggers you set in the
editor; every other prop is optional and, when passed, adjusts the file's value for this one
component.

The React set, minus `playerRef` / `className` / `style` — a template ref and Vue's attribute
inheritance cover those:

<!-- px-check signature pkg=vue -->
```typescript
const SvgAnimationPlayer: DefineComponent<{
    document: PxDocumentJson;             // required — the animation; a .json import passes as-is (inline only)

    // Playback override (Playback overrides above)
    timelineOptions?: PxTimelineOptions;  // the timing: the `timeline` block minus `actionTriggers` and `actions` —
                                          //   MERGED over the file's
    actions?: PxActionsInput;             // the file's `actions` block, REPLACED — how a stop looks (+ the gate's
                                          //   outOfView): { 'playback.stop': 'animateToStart' }; a setting left out reads
                                          //   its default. What shows once finished is a timeline key —
                                          //   timelineOptions: { whenFinished: 'jumpToStart' }

    // Control — the highest-priority one that is set picks the mode (Control modes above); none of
    // them = the file's own triggers drive it
    showAsStatic?: boolean;               // the picture as drawn: nothing plays, no scroll; playback calls on the
                                          //   ref are ignored (PX1506). Beats every other control prop
    disableActionTriggers?: boolean;      // manual: the file's triggers off — your code drives it through the ref
    actionTriggers?: PxActionTriggersInput | null; // these triggers INSTEAD of the file's —
                                          //   { "playback.start", "playback.play", "playback.stop", "playback.pause", "playback.resume" },
                                          //   each one event or a list of the events that list may name ('load' | 'hoverIn' |
                                          //   'hoverOut' | 'click'); playback.resume is derived when left out. null or {}: none
    playback?: 'off' | 'on' | 'paused';    // a LEVER (`PxPlayback`): a change of position presses one button — off → on
                                          //   playback.start(), on → paused playback.pause(), paused → on playback.resume(), → off playback.stop();
                                          //   how each looks is the file's `actions`; a mount with 'off' presses nothing
    showAtProgress?: number;              // a frame, counted in iterations — 1.2 = 20 % into the second
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
| `playbackStart` | a playback began — `playback.start()`, `playback.play()` from rest, a `playback.start` / `playback.play` trigger, `playback` to `'on'` / `'paused'` from `'off'`, the visibility gate starting it again; a returning picture turned around by a play |
| `playbackResume` | the playback carried on after a freeze — `playback.resume()`, `playback.play()`, a `playback.resume` trigger, `playback` back to `'on'`, or the visibility gate when it is seen again |
| `playbackPause` | the playback was frozen at the current frame — `playback.pause()`, a `playback.pause` trigger, `playback` `'paused'`, or the visibility gate's `pause` when it left the screen |
| `playbackFinish` | the last pass ended by playing — the state is `finished`, whatever `whenFinished` then shows. Never for a stop that goes to the end (that emits `playbackStop`), never for a loop without end (`finish` until 1.25) |
| `destroy` | the player was thrown away: the component unmounted, or you passed a different `document` and a new player was built for it |
| `playbackStop` | the playback was stopped — a `playback.stop` trigger, `playback` `'off'`, `playback.stop()` or the visibility gate's `stop`; at once, or on arrival for the stops that finish the pass first. A pause is `playbackPause`, the end `playbackFinish`; a seek emits nothing |

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
const onPlaybackStop = () => console.log('stopped');
</script>

<template>
  <SvgAnimationPlayer :document="animation" @playback-finish="onDone" @playback-stop="onPlaybackStop" />
</template>
```

Passing a different `document` throws the old player away and builds a new one; the old instance
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
  <SvgCssAnimationPlayer :actionTriggers="{ 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' }" style="width: 400px; height: 400px">
    <AnimationSvg />
  </SvgCssAnimationPlayer>
</template>
```

`actionTriggers` is the JSON player's block — the same lists over the same events, read by
the same rules ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)) —
and the gate is the same gate. Unlike the JSON component, it has no file triggers to fall back on: a
script-free SVG imported as a component carries none the component could read. So with no `actionTriggers`
(or `null`, or an empty block) nothing starts the animation; to play on load, say so:
`:actionTriggers="{ 'playback.start': 'load' }"`. The gate numbers go in `timelineOptions`, as on the
JSON component: `:timelineOptions="{ inViewThreshold: 1 }"`.

<!-- px-check signature pkg=vue loose=SvgCssAnimationPlayer.timelineOptions -->
```typescript
// The SVG goes in the default slot; every other attribute (class, style, …) lands on the wrapper div.
const SvgCssAnimationPlayer: DefineComponent<{
    actionTriggers?: PxActionTriggersInput | null; // { "playback.start", "playback.play", "playback.stop",
                                          //   "playback.pause", "playback.resume" }, each one event or a list of the events
                                          //   that list may name ('load' | 'hoverIn' | 'hoverOut' | 'click');
                                          //   playback.resume is derived when left out. None given: nothing starts it
    timelineOptions?: { inViewThreshold?: number; inViewDebounce?: number };
                                          // the gate numbers only: 0–1 of the SVG on screen before it may run
                                          //   (default 0.5; 0 = any visible pixel), and ms it must hold first (150)
    actions?: Pick<PxActionsInput, 'outOfView'>; // only `outOfView` applies: 'pause' (default) | 'continue' |
                                          //   'stop' (replays on the next entry) while nobody can see it
}>;
```

**Accepted limits** of a class toggle — how the moves look stays in the file's CSS, so here:

- a start that is not from rest restarts by remounting the content — a class cannot rewind keyframes;
- the stop is always `jumpToStart` — a class cannot play keyframes backwards or on to their end;
- there is no `finished` state — the class toggle does not see the CSS animation end;
- `whenIdle` and `whenFinished` are the file's own CSS and are not changed from here.

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
`showAsStatic` → `showAtProgress` → `showAtTime` → `playback` → `disableActionTriggers` → `actionTriggers`
(or none: the file's own triggers) — the same rule as React and React Native, conflicts warned the same way; a change to `document`'s content
(compared deeply) or to an override prop re-creates the player. The callbacks and diagnostics
are the shape every player shares — [the API at a glance](./README.md#the-api-at-a-glance).

<!-- px-check exports @pixodesk/svg-animator-vue -->
The package exports the two components, `SvgAnimationPlayer` and `SvgCssAnimationPlayer`, the
handle type `PxAnimationPlayerHandle` with its `PxPlaybackControls` (what `playback` is), and the document type `PxDocument` (for casting a JSON
import — [TypeScript](./installation.md#typescript)); nothing else.

## Example

Every section above links to its running example in
[`examples/docs-examples`](../../examples/docs-examples/). Each example is a small standalone
page, and they are all collected in one app: a list of every example down the side, with the
selected one running next to it. Run `pnpm example:docs` from the repository root to open it,
then pick an example from the list — or jump straight to one by its address in the URL, like
`#vue/play-using-action-triggers`. Each example has a test that runs on every build.

[← Next.js](./nextjs.md) · [Contents](../../README.md#documentation) · Next: [Nuxt →](./nuxt.md)
