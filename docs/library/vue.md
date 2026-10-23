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
import { SvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <SvgAnimator :doc="animation" playAsSaved />
</template>
```

The component renders the document's root `<svg>` directly — there is no wrapper element. To
set its size, give the element that contains it a width and height (or put `style` on the
component itself — see the props table); the SVG keeps its proportions.

## Control modes

Several control modes, plus a template ref that is not one. Set more than one control prop and the
highest-priority one wins — `progress` / `time` → `play` / `pause` → `playAsSaved` — and the
component warns, naming both props and the winner. The ref is available in every mode and never
changes which one you are in. React, Vue and React Native all resolve this the same way, from one
rule in core.

### Autoplay

> **Example:** [`vue/play-as-saved`](../../examples/docs-examples/src/cases/vue/play-as-saved/) — `pnpm example:docs`, then open `#vue/play-as-saved`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click, or when scrolled into view.

```vue
<script setup lang="ts">
import { SvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <SvgAnimator :doc="animation" playAsSaved />
</template>
```

Uses the trigger saved in the document (load / hover / click / scroll into view) and its out
action. Override it for this one mount with the `start` prop, or with
`:timeline="{ trigger: { … } }"` for the rest of the trigger — see
[Playback overrides](#playback-overrides).

### Controlled time (`progress` / `time`)

> **Example:** [`vue/controlled-time`](../../examples/docs-examples/src/cases/vue/controlled-time/) — `pnpm example:docs`, then open `#vue/controlled-time`.

Use these when your code owns the position — a slider, a scroll offset, a step in a
walkthrough. The component renders exactly that frame and never plays on its own.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const time = ref(0);
</script>

<template>
  <SvgAnimator :doc="animation" :time="time" />
  <input type="range" min="0" max="2000" v-model.number="time" />

  <!-- a fixed frame by FRACTION of the whole timeline — that is `progress`, not `time`
       (`time` is milliseconds, so `:time="0.5"` would be half a millisecond in) -->
  <SvgAnimator :doc="animation" :progress="0.5" />
</template>
```

Changing the value moves the existing animator to the new time — nothing is recreated.

### Declarative playback — `play`, `pause`, `playMode`, `completeIteration`

> **Example:** [`vue/declarative`](../../examples/docs-examples/src/cases/vue/declarative/) — `pnpm example:docs`, then open `#vue/declarative`.

**`play` names a state, not a command.** On a ONE-SHOT document (a single pass) it is a POSE
switch — `false` the start pose, `true` the finish pose; a change moves there per `playMode`
(`'forwards'` default: plays there, snaps back; `'both'`: plays both ways — the hover toggle;
`'backwards'`; `'none'`), always from the current frame, and a mount renders the pose without
animating. On a LOOPING document (`iterations` > 1 or `'infinite'`) it is a RUN switch — `false`
snaps to rest, or finishes the current iteration first with `completeIteration`. `pause` freezes
the current frame immediately and only means something while `play` is true. The rule is shared
with the React and React Native components (`resolveDeclarativePlayback` in core); a misplaced
modifier warns and changes nothing. One-shot verbs (`playOnce()`, `finish()`) live on the
template ref.

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const hovered = ref(false);
</script>

<template>
  <!-- the trash-can lid: opens on hover, plays BACK closed on leave, from wherever it is -->
  <div @mouseenter="hovered = true" @mouseleave="hovered = false">
    <SvgAnimator :doc="animation" :play="hovered" playMode="both" />
  </div>
</template>
```

### Imperative API (template ref)

> **Example:** [`vue/imperative`](../../examples/docs-examples/src/cases/vue/imperative/) — `pnpm example:docs`, then open `#vue/imperative`.

The component exposes the playback API on its template ref, so it is available in every mode:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimator, type PxAnimatorHandle } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const animator = ref<PxAnimatorHandle | null>(null);
</script>

<template>
  <SvgAnimator :doc="animation" ref="animator" />
  <button @click="animator?.play()">Play</button>
  <button @click="animator?.pause()">Pause</button>
  <button @click="animator?.setPlaybackRate(-1)">Reverse</button>
</template>
```

The ref holds core's `PxAnimatorHandle` — the one handle name every framework package
exports, so the three cannot drift apart:

<!-- px-check signature pkg=vue -->
```typescript
interface PxAnimatorHandle {
    isPlaying(): boolean;
    play(): void; pause(): void; cancel(): void; finish(): void;
    playOnce(): void;                      // ONE fresh pass from the start, whatever `iterations` say
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, negative = reverse; 0 is rejected
                                           //   with a warning — use pause()
    getDuration(): number | null;          // ONE pass of the content window, ms — the slider
                                           //   maximum nobody hard-codes (× iterations = the run)
    getCurrentTime(): number | null;       // ms from the start of the whole run, every iteration included
    setCurrentTime(time: number): void;    // seek, ms; clamped to the run
    getCurrentProgress(): number | null;   // the same position as 0–1 of the whole run — the read
                                           //   twin of the `progress` prop
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run
}
```

With none of `playAsSaved` / `progress` / `time` / `play` / `pause` set, the first frame renders
statically and the ref is your only control.

## Playback overrides

The same document can play differently in each place you mount it. `timeline` takes an object
shaped exactly like the file's own `animator` block and deep-merges it over what the file says
— the document you passed is never modified.

```vue
<template>
  <!-- The file loops twice and starts on load; here it loops forever and waits for play(). -->
  <SvgAnimator
    :doc="animation"
    :timeline="{ iterations: 'infinite', trigger: { start: 'none' } }"
    ref="anim"
  />
</template>
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back (`:timeline="{ delay: null }"`).

`inTime`, `outTime`, `playDuration`, `delay`, `iterations` and `start` are also plain props, because `:out-time="2000"`
reads better than a nested object; a prop wins over the same key inside `timeline`. To ignore the
file's playback settings entirely and start from the player's defaults, add `resetTimeline`.

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).

## Props

Only `doc` is required. The file already carries the timing and the trigger you set in the
editor; every other prop is optional and, when passed, replaces the file's value for this one
component.

The React set, minus `apiRef` / `className` / `style` — a template ref and Vue's attribute
inheritance cover those:

<!-- px-check signature pkg=vue -->
```typescript
const SvgAnimator: DefineComponent<{
    doc: PxDocumentInput;                 // required — the animation; a .json import passes as-is

    // Playback override — the document's `timeline` block, deep-merged (Playback overrides above)
    timeline?: PxTimelinePatch | string;  // a JSON string is accepted too
    resetTimeline?: boolean;              // start from the player's defaults, `timeline` on top
    inTime?: number;                      // ▸ timeline.inTime — the content window's start, ms
    outTime?: number;                     // ▸ timeline.outTime — …and its end (one pass plays the window)
    playDuration?: number;                // ▸ timeline.playDuration — the window in wall ms (slower / faster)
    delay?: number;                       // ▸ timeline.delay — the wait before the first pass, ms
    iterations?: number | 'infinite';     // 'infinite' never stops
    start?: 'load' | 'mouseOver' | 'click' | 'none';
    offScreen?: PxOffScreenAction;        // ▸ timeline.trigger.offScreen
    mouseOut?: PxMouseOutAction;          // ▸ timeline.trigger.mouseOut (for start: 'mouseOver')
    visibilityThreshold?: number;         // ▸ timeline.trigger.visibilityThreshold (0–1)
    visibilityDebounce?: number;          // ▸ timeline.trigger.visibilityDebounce (ms)

    // Control — the highest-priority one that is set picks the mode (Control modes above)
    playAsSaved?: boolean;                   // start the way the file says — the editor's Start setting
    play?: boolean; pause?: boolean;      // the STATE (one-shot: which pose; loop: running) / freeze now
    playMode?: PxPlayMode | `${PxPlayMode}`; // one-shot: which pose changes PLAY vs snap —
                                          //   'forwards' (default) | 'backwards' | 'both' | 'none'
    completeIteration?: boolean;          // loop: play=false finishes the CURRENT iteration, then rests
    progress?: number; time?: number;     // a frame at 0–1 of the whole run / at this ms

    // Diagnostics stay PROPS, not events: an event handler always exists, which would silence
    // the console fallback. onWarn = it plays, but something was ignored, degraded or misspelled;
    // onError = this instance will not play (the API at a glance)
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean; muteError?: boolean;
}>;
```

Anything else you put on `<SvgAnimator>` — `class`, `style`, any attribute — ends up on
the `<svg>` element it renders (standard Vue attribute inheritance). So to set the animation's
size, either put `style="width: 300px; height: 300px"` on the component itself, or give those
dimensions to the element that contains it — the SVG keeps its proportions either way.

## Events

<!-- px-check emits SvgAnimator pkg=vue -->
| Event | When |
|---|---|
| `ready` | the animator exists and the SVG is rendered — once, asynchronously; the push twin of `isReady()` |
| `play` | the animation started playing — for the first time, or resumed after a pause |
| `pause` | playback paused at the current frame — via the `pause` prop, the API's `pause()`, or a trigger's *out action* |
| `cancel` | playback stopped and the animation went back to its start state |
| `finish` | the animation reached its end — it played all its iterations, or `finish()` was called. Does not fire when playback is stopped early |
| `destroy` | the animator was thrown away: the component unmounted, or you passed a different `doc` and a new animator was built for it |
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
import { SvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
const onDone = () => console.log('finished');
const onStop = () => console.log('stopped');
</script>

<template>
  <SvgAnimator :doc="animation" playAsSaved @finish="onDone" @stop="onStop" />
</template>
```

Passing a different `doc` throws the old animator away and builds a new one; the old instance
emits `cancel`, `destroy` and `stop` on its way out.

## CSS-flavor SVGs — `SvgCssAnimator`

> **Example:** [`vue/css-loader`](../../examples/docs-examples/src/cases/vue/css-loader/) — `pnpm example:docs`, then open `#vue/css-loader`.

For a **pre-rendered SVG + CSS animation** file imported with
[`vite-svg-loader`](https://github.com/jpkleemans/vite-svg-loader) (or any loader that yields a
component), this wrapper adds hover / click / scroll triggers. It renders a `<div>` of its own
around your SVG component — that is what `SvgCssAnimator` becomes on the page — and
starts, pauses or resets the animation by switching the file's CSS classes on that `<div>`:

```vue
<script setup>
import { SvgCssAnimator } from '@pixodesk/svg-animator-vue';
import AnimationSvg from './animation.svg';   // vite-svg-loader
</script>

<template>
  <SvgCssAnimator start="mouseOver" mouseOut="pause" style="width: 400px; height: 400px">
    <AnimationSvg />
  </SvgCssAnimator>
</template>
```

<!-- px-check signature pkg=vue -->
```typescript
// The SVG goes in the default slot; every other attribute (class, style, …) lands on the wrapper div.
const SvgCssAnimator: DefineComponent<{
    start?: PxTriggerStart;               // 'load' (default) | 'mouseOver' | 'click'
    offScreen?: PxOffScreenAction;        // ▸ timeline.trigger.offScreen
    mouseOut?: PxMouseOutAction;          // ▸ timeline.trigger.mouseOut (for start: 'mouseOver')
    visibilityThreshold?: number;         // ▸ timeline.trigger.visibilityThreshold (0–1)
    visibilityDebounce?: number;          // ▸ timeline.trigger.visibilityDebounce (ms)
                                          //   — 'none' does nothing here (no play())
    offScreen?: PxOffScreenAction;        // 'pause' (default) | 'continue' | 'reset' — what happens
                                          //   while nobody can see it, whatever started it
    mouseOut?: PxMouseOutAction;          // 'continue' (default) | 'pause' | 'reset' — 'reverse' is
                                          //   accepted but acts as 'continue'
    visibilityThreshold?: number;         // 0–1 of the SVG on screen before it may run; default 0.5; 0 = any visible pixel
    visibilityDebounce?: number;          // ms it must hold first; default 150
}>;
```

> ⚠️ **Don't put the SAME SVG file on a page twice.** You can have as many
> `<SvgCssAnimator>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#the-same-file-twice-on-one-page)).

Only the pure CSS flavor works this way (loaders strip or refuse `<script>`); flavors with
scripts should be inlined as raw HTML, or use JSON.

## API reference

Everything is spelled out above: `SvgAnimator` under [Props](#props) and [Events](#events),
the handle under [Imperative API](#imperative-api-template-ref), `SvgCssAnimator` under
[CSS-flavor SVGs](#css-flavor-svgs--svgcssanimator). Modes, highest priority wins:
`progress` / `time` → `play` / `pause` → `playAsSaved` → static — the same rule as React and React
Native, conflicts warned the same way; a change to `doc`'s content (compared deeply) or to an override
prop re-creates the player. The callbacks and diagnostics are the shape every player shares —
[the API at a glance](./README.md#the-api-at-a-glance).

<!-- px-check exports @pixodesk/svg-animator-vue -->
The package exports the components, the handle type `PxAnimatorHandle`, and the document type
`PxDocument` (for casting a JSON import — [TypeScript](./installation.md#typescript));
nothing else.

## Example

Every section above links to its running example in
[`examples/docs-examples`](../../examples/docs-examples/). Each example is a small standalone
page, and they are all collected in one app: a list of every example down the side, with the
selected one running next to it. Run `pnpm example:docs` from the repository root to open it,
then pick an example from the list — or jump straight to one by its address in the URL, like
`#vue/play-as-saved`. Each example has a test that runs on every build.

[← Next.js](./nextjs.md) · [Contents](../../README.md#documentation) · Next: [Nuxt →](./nuxt.md)
