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
  <SvgAnimationPlayer :doc="animation" playOnTrigger />
</template>
```

The component renders the document's root `<svg>` directly — there is no wrapper element. To
set its size, give the element that contains it a width and height (or put `style` on the
component itself — see the props table); the SVG keeps its proportions.

## Control modes

Every way to make it play starts with `play`: `playOnTrigger` (the document's trigger, or one
you pass), `play` / `pause` (your state), `playCurrentProgress` / `playCurrentTime` (your
position). Set props from more than one group and the highest-priority one wins —
`playCurrentProgress` / `playCurrentTime` → `play` / `pause` → `playOnTrigger` — and the
component warns, naming both props and the winner. The template ref is not a mode: it is
available in every mode and never changes which one you are in. React, Vue and React Native all
resolve this the same way, from one rule in core.

In every mode but `playOnTrigger` the file's own trigger is switched off — core's
`withoutTriggerDriver` replaces it with an empty trigger, so nothing starts the animation by
itself ([a note on the control props](./playback-and-triggers.md#a-note-on-the-components-control-props)).

### Play on trigger (`playOnTrigger`)

> **Example:** [`vue/play-on-trigger`](../../examples/docs-examples/src/cases/vue/play-on-trigger/) — `pnpm example:docs`, then open `#vue/play-on-trigger`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click — once enough of it is on screen.

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <SvgAnimationPlayer :doc="animation" playOnTrigger />
</template>
```

`playOnTrigger` alone uses the trigger saved in the document — its four event lists and the
visibility gate ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)).
Bind an **object** instead and that is the whole trigger to use for this mount — a replacement,
not a merge: the lists you leave out take the format's defaults, not the file's values. How each
transition looks stays in the timeline, which `timeline` adjusts — see
[Playback overrides](#playback-overrides).

```vue
<template>
  <!-- plays while hovered; when the pointer leaves it finishes the current iteration, then rests -->
  <SvgAnimationPlayer :doc="animation"
    :playOnTrigger="{ playOn: 'hoverIn', playOff: 'hoverOut' }"
    :timeline="{ completeIterationOnPlayOff: true }" />

  <!-- a click toggles stopped → playing → paused → playing (the state rule picks the list) -->
  <SvgAnimationPlayer :doc="animation" :playOnTrigger="{ playOn: 'click', pauseOn: 'click' }" />
</template>
```

### Controlled time (`playCurrentProgress` / `playCurrentTime`)

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
  <SvgAnimationPlayer :doc="animation" :playCurrentTime="time" />
  <input type="range" min="0" max="2000" v-model.number="time" />

  <!-- a fixed frame by FRACTION of the whole timeline — that is `playCurrentProgress`, not
       `playCurrentTime` (milliseconds, so `:playCurrentTime="0.5"` would be half a millisecond in) -->
  <SvgAnimationPlayer :doc="animation" :playCurrentProgress="0.5" />
</template>
```

Changing the value moves the existing player to the new position — nothing is recreated. The
read twins on the template ref are `getCurrentProgress()` and `getCurrentTime()`.

### Declarative playback — `play`, `pause`

> **Example:** [`vue/declarative`](../../examples/docs-examples/src/cases/vue/declarative/) — `pnpm example:docs`, then open `#vue/declarative`.

**`play` names a state, not a command.** `true` is a play-on, `false` a play-off, and HOW each
one looks is not a prop: it is the timeline's keys `playOnAction`, `playOffAction`,
`completeIterationOnPlayOff` and `playEndAction`, which `timeline` adjusts and which the trigger
and the ref honour too
([Play on, play off, play end — how a transition looks](./playback-and-triggers.md#play-on-play-off-play-end--how-a-transition-looks)).
With the defaults, a ONE-SHOT document (a single pass) plays to the end on `true` and holds,
and snaps back on `false`; a LOOPING document (`iterations` > 1 or `'infinite'`) runs on `true`
and snaps to rest on `false` — or finishes the current iteration first with
`completeIterationOnPlayOff: true`. A change always moves from the current frame, and a mount
renders the pose without animating. `pause` freezes the current frame immediately and only
means something while `play` is true (`pause` without `play` warns,
[PX1502](../diagnostics.md)). The rule is shared with the React and React Native
components (`resolveDeclarativePlayback` in core). One-shot verbs (`playOnce()`, `finish()`)
live on the template ref.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const hovered = ref(false);
const busy = ref(false);
</script>

<template>
  <!-- the trash-can lid: opens on hover, plays BACK closed on leave, from wherever it is -->
  <div @mouseenter="hovered = true" @mouseleave="hovered = false">
    <SvgAnimationPlayer :doc="animation" :play="hovered" :timeline="{ playOffAction: 'rewind' }" />
  </div>

  <!-- a spinner: runs while busy; when busy ends it finishes the current turn, then rests -->
  <SvgAnimationPlayer :doc="animation" :play="busy" :timeline="{ completeIterationOnPlayOff: true }" />
</template>
```

The other recipes — overlay art that appears instantly and retreats animated
(`{ playOnAction: 'jumpToEnd', playOffAction: 'rewind' }`), a splash that replays on every click
(`{ playOnAction: 'restart' }`) — are written out on the [React page](./react.md#declarative-playback--play-pause);
the same `timeline` objects work here.

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
  <button @click="player?.play()">Play</button>
  <button @click="player?.pause()">Pause</button>
  <button @click="player?.stop()">Stop</button>
</template>
```

The ref holds core's `PxAnimationPlayerHandle` — the one handle name every framework package
exports, so the three cannot drift apart. `play()`, `pause()` and `stop()` take no arguments:
how a play-on or a play-off looks is the timeline's, and the handle follows it exactly as the
trigger and the `play` prop do.

<!-- px-check signature pkg=vue -->
```typescript
interface PxAnimationPlayerHandle {
    isPlaying(): boolean;
    play(): void;                          // paused → resume; otherwise the configured play-on (`playOnAction`)
    pause(): void;                         // hold the current frame
    stop(): void;                          // the configured play-off (`playOffAction`) — after the current
                                           //   iteration when `completeIterationOnPlayOff`
    cancel(): void;                        // reset NOW, unconditionally — back to the start state
    finish(): void;                        // jump to the end and hold it
    playOnce(): void;                      // ONE fresh pass from the start, whatever `iterations` say;
                                           //   the end pose follows `playEndAction`
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, negative = reverse; 0 is rejected
                                           //   with a warning — use pause()
    getDuration(): number | null;          // ONE pass of the content window, ms — the slider
                                           //   maximum nobody hard-codes (× iterations = the run)
    getCurrentTime(): number | null;       // ms from the start of the whole run, every iteration included
    setCurrentTime(time: number): void;    // seek, ms; clamped to the run
    getCurrentProgress(): number | null;   // the same position as 0–1 of the whole run — the read
                                           //   twin of the `playCurrentProgress` prop
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run
}
```

With none of `playOnTrigger` / `playCurrentProgress` / `playCurrentTime` / `play` / `pause` set,
the first frame renders statically and the ref is your only control.

## Playback overrides

The same document can play differently in each place you mount it. Two props, the same on every
player ([Overriding from a player](./playback-and-triggers.md#overriding-from-a-player)), and
the document you passed is never modified:

- `timeline` — a **merge** over the file's `animator.timeline` block, minus its `trigger`: an
  object shaped like the file, deep-merged key by key. Corrections — `iterations`, `delay`,
  `playOffAction` — never a replacement; whoever needs more edits the document.
- `playOnTrigger` — `true` plays on the file's trigger; an object is the whole trigger to use
  instead ([Play on trigger](#play-on-trigger-playontrigger)).

```vue
<template>
  <!-- The file loops twice and plays on load; here it loops forever and waits for play() —
       without `playOnTrigger` the file's trigger is switched off, so only your code starts it. -->
  <SvgAnimationPlayer :doc="animation" :timeline="{ iterations: 'infinite' }" ref="anim" />

  <!-- This trigger instead of the file's, and a smooth retreat on hover-out -->
  <SvgAnimationPlayer :doc="animation"
    :playOnTrigger="{ playOn: 'hoverIn', playOff: 'hoverOut' }"
    :timeline="{ playOffAction: 'rewind' }" />
</template>
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back (`:timeline="{ delay: null }"`).

`trigger` is not a key of `timeline` here — only `playOnTrigger` carries a trigger, so every key
is reachable exactly one way. The play keys and the gate keys (`outOfViewAction`,
`inViewThreshold`, `inViewDebounce`) are timeline keys and go in `timeline`
([the visibility gate](./playback-and-triggers.md#whether-it-may-run--the-visibility-gate)).

**To repeat the whole animation**, pass `:timeline="{ iterations: 'infinite' }"` — there is no
`loop` prop. A `loop` inside a file means something narrower: it repeats part of one property's
keyframes ([per-property loops](../format/README.md#per-property-loops)).

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → How the merge works](./playback-and-triggers.md#how-the-merge-works).

## Props

Only `doc` is required. The file already carries the timing and the trigger you set in the
editor; every other prop is optional and, when passed, adjusts the file's value for this one
component.

The React set, minus `playerRef` / `className` / `style` — a template ref and Vue's attribute
inheritance cover those:

<!-- px-check signature pkg=vue -->
```typescript
const SvgAnimationPlayer: DefineComponent<{
    doc: PxDocumentInput;                 // required — the animation; a .json import passes as-is

    // Playback override — the file's `timeline` block minus `trigger`, deep-merged (Playback overrides above)
    timeline?: PxTimelinePatch;

    // Control — the highest-priority one that is set picks the mode (Control modes above)
    playOnTrigger?: boolean | PxTrigger;  // true: the file's own trigger; an object: this trigger instead —
                                          //   { playOn, playOff, pauseOn, pauseOff }, each one event or a
                                          //   list of 'load' | 'hoverIn' | 'hoverOut' | 'click'
    play?: boolean; pause?: boolean;      // the STATE (true = a play-on, false = a play-off — how each looks
                                          //   is the timeline's play keys) / freeze now
    playCurrentProgress?: number;         // a frame at 0–1 of the whole run
    playCurrentTime?: number;             // a frame at this ms

    // Diagnostics stay PROPS, not events: an event handler always exists, which would silence
    // the console fallback. onWarn = it plays, but something was ignored, degraded or misspelled;
    // onError = this instance will not play (the API at a glance)
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean; muteError?: boolean;
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
| `play` | the animation started playing — for the first time, or resumed after a pause |
| `pause` | playback paused at the current frame — via the `pause` prop, the API's `pause()`, a `pauseOn` event, or the visibility gate |
| `cancel` | playback stopped and the animation went back to its start state |
| `finish` | the animation reached its end — it played all its iterations, or `finish()` was called. Does not fire when playback is stopped early |
| `destroy` | the player was thrown away: the component unmounted, or you passed a different `doc` and a new player was built for it |
| `stop` | "no longer playing, whatever the reason": fires *in addition to* whichever of `pause`, `cancel`, `finish` or `destroy` just fired |

`onWarn` and `onError` are **props**, not events. With an event, Vue would treat the message as
handled even when nobody listens, so it would never reach the console. As props, leaving them
out means exactly that — and the message goes to the console as usual.

Each diagnostic is `{ code, kind, data?, message, error? }`. `code` is a number you can switch on — its description is on the [codes page](../diagnostics.md), which `message` links to; `data` carries the specifics. `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the props you passed) · `internal` (report it to us). So you
can route rather than just log — surface `document` problems in a build check, for instance. Once
you know what a document has to say and tolerate it, `muteWarn` keeps it out of the console.

```vue
<script setup lang="ts">
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const onDone = () => console.log('finished');
const onStop = () => console.log('stopped');
</script>

<template>
  <SvgAnimationPlayer :doc="animation" playOnTrigger @finish="onDone" @stop="onStop" />
</template>
```

Passing a different `doc` throws the old player away and builds a new one; the old instance
emits `cancel`, `destroy` and `stop` on its way out.

## CSS-flavor SVGs — `SvgCssAnimationPlayer`

> **Example:** [`vue/css-loader`](../../examples/docs-examples/src/cases/vue/css-loader/) — `pnpm example:docs`, then open `#vue/css-loader`.

For a **pre-rendered SVG + CSS animation** file imported with
[`vite-svg-loader`](https://github.com/jpkleemans/vite-svg-loader) (or any loader that yields a
component), this wrapper adds the trigger and the visibility gate. It renders a `<div>` of its
own around your SVG component — that is what `SvgCssAnimationPlayer` becomes on the page — and
starts, pauses or resets the animation by switching the file's CSS classes on that `<div>`:

```vue
<script setup>
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-vue';
import AnimationSvg from './animation.svg';   // vite-svg-loader
</script>

<template>
  <SvgCssAnimationPlayer :trigger="{ playOn: 'hoverIn', pauseOn: 'hoverOut' }" style="width: 400px; height: 400px">
    <AnimationSvg />
  </SvgCssAnimationPlayer>
</template>
```

The `trigger` is the JSON player's — the same four lists over the same events, read by the same
state rule ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)) —
and the gate is the same gate. An absent `trigger` plays on load; an empty one lists nothing.

<!-- px-check signature pkg=vue -->
```typescript
// The SVG goes in the default slot; every other attribute (class, style, …) lands on the wrapper div.
const SvgCssAnimationPlayer: DefineComponent<{
    trigger?: PxTrigger;                  // WHEN: { playOn, playOff, pauseOn, pauseOff }, each one event
                                          //   or a list of 'load' | 'hoverIn' | 'hoverOut' | 'click'
    outOfViewAction?: PxOutOfViewAction;  // 'pause' (default) | 'continue' | 'reset' — what happens
                                          //   while nobody can see it, whatever started it
    inViewThreshold?: number;             // 0–1 of the SVG on screen before it may run; default 0.5; 0 = any visible pixel
    inViewDebounce?: number;              // ms it must hold first; default 150
}>;
```

**Accepted limits** of a class toggle — the play keys stay in the file's CSS, so here:

- `playOnAction` acts as `resume` — a class cannot restart keyframes or jump to their end;
- `playOffAction` acts as `reset` — a class cannot play keyframes backwards;
- `completeIterationOnPlayOff`, `showFirstFrameBeforePlayOn` and `playEndAction` are the file's
  own CSS and are not changed from here.

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
`playCurrentProgress` / `playCurrentTime` → `play` / `pause` → `playOnTrigger` → static — the
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
`#vue/play-on-trigger`. Each example has a test that runs on every build.

[← Next.js](./nextjs.md) · [Contents](../../README.md#documentation) · Next: [Nuxt →](./nuxt.md)
