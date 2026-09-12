# React — `@pixodesk/svg-animator-react`

[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Vue →](./vue.md)

Use this in a React or Next.js app: drop in the component, pass it the JSON, and it renders
the animation and controls its playback. It wraps the [web player](./web-player.md)
and renders the SVG with React itself, so it is SSR-safe and works in Next.js. Control it the
way that suits your code — autoplay, declarative props, an imperative ref, or controlled time.

```bash
npm install @pixodesk/svg-animator-react
```

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Logo() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

The component renders the root `<svg>` of the document; size it with `className` / `style` or
by sizing the parent (the SVG keeps its `viewBox`).

## Control modes

Three control modes, plus a handle that is not one. Set more than one control prop and the
highest-priority one wins — `progress` / `time` → `play` / `pause` → `autoplay` — and the
component warns, naming both props and the winner. `apiRef` is filled in **every** mode and never
changes which one you are in, so you can always call `play()` / `pause()` yourself; `apiRef` with
no control prop beside it is simply the static mode, where nothing plays until you say so. React,
Vue and React Native all resolve this the same way, from one rule in core.

### Imperative API (`apiRef`)

> **Example:** [`react/imperative`](../../examples/docs-examples/src/cases/react/imperative/) — `pnpm example:docs`, then open `#react/imperative`.

Pass a ref as `apiRef`. Once the component has mounted, the ref holds the playback API, so
any button, timer or effect in your app can start, pause, or jump to any point in the animation.

```tsx
import { useRef } from 'react';
import { PixodeskSvgAnimator, type ReactAnimatorApi } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Player() {
  const api = useRef<ReactAnimatorApi>(null);
  return (
    <>
      <PixodeskSvgAnimator doc={animation} apiRef={api} />
      <button onClick={() => api.current?.play()}>Play</button>
      <button onClick={() => api.current?.pause()}>Pause</button>
      <button onClick={() => api.current?.setPlaybackRate(-1)}>Reverse</button>
    </>
  );
}
```

`ReactAnimatorApi`:

| Method | Description |
|---|---|
| `play()` | start, or resume from the current time |
| `pause()` | pause at the current time |
| `cancel()` | stop and reset to the start |
| `finish()` | jump to the end and hold it |
| `setPlaybackRate(rate)` | `1` normal, `2` double, negative = reverse. `0` is rejected with a warning — use `pause()` |
| `getCurrentTime()` | ms from the start of the whole run (every iteration included), or `null` before mount |
| `setCurrentTime(ms)` | jump to a point in the animation, in milliseconds from its start; clamped to the run |
| `getCurrentProgress()` | the same position as `0`–`1` of the whole run — the read twin of the `progress` prop |
| `setCurrentProgress(p)` | jump to `0`–`1` of the whole run |
| `isPlaying()` | `true` while the animation is running, `false` when paused, finished or not started |

### Autoplay

> **Example:** [`react/autoplay`](../../examples/docs-examples/src/cases/react/autoplay/) — `pnpm example:docs`, then open `#react/autoplay`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click, or when scrolled into view.

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Intro() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

Uses the trigger saved in the document — on load, on hover, on click, when scrolled into view
— and its out action. Override it for this one mount with the `startOn` shortcut, or with
`config={{ timeline: { trigger: { … } } }}` for the rest of the trigger — see
[Playback overrides](#playback-overrides).

### Controlled time (`progress` / `time`)

> **Example:** [`react/controlled-time`](../../examples/docs-examples/src/cases/react/controlled-time/) — `pnpm example:docs`, then open `#react/controlled-time`.

Render one frame, and move through the animation by changing the prop. The animator is **not** recreated on change —
it just jumps to the new time.

```tsx
import { useState } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Scrubber() {
  const [time, setTime] = useState(0);
  return (
    <>
      <PixodeskSvgAnimator doc={animation} time={time} />
      <input type="range" min={0} max={2000} value={time} onChange={e => setTime(+e.target.value)} />
    </>
  );
}
```

`progress` is a position in the whole timeline (duration × iterations), from `0`, the first frame, to `1`, the last; `time` is a time in milliseconds from the start.

### Declarative play / pause

> **Example:** [`react/declarative`](../../examples/docs-examples/src/cases/react/declarative/) — `pnpm example:docs`, then open `#react/declarative`.

Drive playback from your own state with two booleans — handy when play/pause is already part
of your component's state (a toggle, a visibility flag) and you would rather not hold a ref.

```tsx
import { useState } from 'react';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Controlled() {
  const [play, setPlay] = useState(false);
  const [pause, setPause] = useState(false);
  return (
    <>
      <PixodeskSvgAnimator doc={animation} play={play} pause={pause} />
      <button onClick={() => { setPlay(true); setPause(false); }}>Play</button>
      <button onClick={() => setPause(true)}>Pause</button>
    </>
  );
}
```

`play && !pause` plays; `pause` pauses; `play === false` jumps to the end state; a pause that is
switched back off resumes.

With none of `autoplay` / `progress` / `time` / `play` / `pause` set, the component renders the
first frame statically — `apiRef` on its own is such a case, so playback waits for your `play()`.

## Playback overrides

> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

The same document can play differently in each place you mount it. `config` takes an object
shaped exactly like the file's own `animator` block and deep-merges it over what the file says
— the document you passed is never modified.

```tsx
// The file loops twice and starts on load; here it loops forever and waits for play().
<PixodeskSvgAnimator
  doc={animation}
  config={{ timeline: { iterations: 'infinite', trigger: { startOn: 'programmatic' } } }}
  apiRef={apiRef}
/>
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back:

```tsx
<PixodeskSvgAnimator doc={animation} autoplay config={{ timeline: { delay: null } }} />
```

`duration`, `delay`, `iterations` and `startOn` are also plain props, because
`duration={2000}` reads better than a nested object; a prop wins over the same key inside
`config`. To ignore the file's playback settings entirely and start from the player's defaults,
add `resetDocDefaults`.

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).

## Props

| Prop | Type | Description |
|---|---|---|
| `doc` | `PxAnimatedSvgDocument` | **required** — the animation document |
| `className` | `string` | class on the rendered root `<svg>` |
| `style` | `CSSProperties` | inline style on the root `<svg>` |
| **Control** | | |
| `autoplay` | `boolean` | start the way the file says — the *Start* trigger you chose in the editor: at once, on hover, on click, or when scrolled into view |
| `play` | `boolean` | play unconditionally (ignores document triggers) |
| `pause` | `boolean` | pause current playback |
| `apiRef` | `RefObject<ReactAnimatorApi>` | imperative control |
| `progress` | `number` | show the frame at this position in the whole timeline (duration × iterations): `0` is the first frame, `0.5` the middle, `1` the last |
| `time` | `number` | show the frame at that time, in milliseconds from the start |
| **Playback overrides** | | *(see [Playback overrides](#playback-overrides))* |
| `config` | `object \| string` | per-instance override of the document's `animator` block, deep-merged over it. Same shape as the file; `null` at any slot deletes that key. A JSON string is accepted too |
| `resetDocDefaults` | `boolean` | ignore the document's playback settings and start from the player's defaults, with `config` on top |
| `duration` | `number` | shortcut for `config.timeline.duration` — ms for one iteration |
| `delay` | `number` | shortcut for `config.timeline.delay`. A negative value skips ahead instead: `-500` starts right away from the frame at 0.5 s, as if the animation had already been running for half a second |
| `iterations` | `number \| 'infinite'` | shortcut for `config.timeline.iterations`; `'infinite'` never stops |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView' \| 'programmatic'` | shortcut for `config.timeline.trigger.startOn`: at once, on hover, on click, when scrolled into view, or only a `play()` call from code |
| **Callbacks** | | |
| `onPlay` | `() => void` | the animation started playing — for the first time, or resumed after a pause |
| `onPause` | `() => void` | playback paused at the current frame — via the `pause` prop, the API's `pause()`, or a trigger's *out action* |
| `onCancel` | `() => void` | playback stopped and the animation went back to its start state |
| `onFinish` | `() => void` | the animation reached its end — it played all its iterations, or `finish()` was called. Does not fire when playback is stopped early |
| `onRemove` | `() => void` | the animator was thrown away: the component unmounted, or you passed a different `doc` and a new animator was built for it |
| `onStop` | `() => void` | fires *in addition to* whichever of `onPause`, `onCancel`, `onFinish` or `onRemove` just fired. Use this one callback when you only care that the animation is no longer playing, whatever the reason |
| `onWarn` | `(diagnostic) => void` | something is off but the animation still plays — an unknown easing, a config key that could not be applied, two control props at once. Without this it goes to `console.warn` |
| `onError` | `(diagnostic) => void` | the animation could not be produced at all — a document that failed to parse or render. Without this it goes to `console.error` |
| `silent` | `boolean \| PxDiagnosticKind[]` | silences the console *fallback* above — everything, or just the kinds you list. `onWarn` / `onError` still fire if you gave them — it is not a mute button |

Each diagnostic is `{ kind, message, detail?, error? }`, where `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the props you passed) · `internal` (report it to us). So you
can route rather than just log — surface `document` problems in a build check, and quiet the
rest with `silent={['platform']}`.

Passing a different `doc` (or changing `className` / `style` / the control mode) throws the
old animator away and builds a new one; the old instance emits `onCancel`, `onRemove` and
`onStop` on its way out. Changing `progress` / `time` does not recreate anything.

## CSS-flavour SVGs — `PixodeskSvgCssAnimator`

> **Example:** [`react/css-svgr`](../../examples/docs-examples/src/cases/react/css-svgr/) — `pnpm example:docs`, then open `#react/css-svgr`.

For a **pre-rendered SVG + CSS animation** file imported as a component with
[SVGR](https://react-svgr.com/) (`@svgr/webpack`, `vite-plugin-svgr`), this small wrapper adds
the hover / click / scroll triggers. It renders a `<div>` of its own around your SVG component —
that is what `PixodeskSvgCssAnimator` becomes on the page — and starts, pauses or resets the
animation by switching the file's CSS classes on that `<div>`:

```tsx
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-react';
import AnimationSvg from './animation.svg?react';   // vite-plugin-svgr

export function HoverLogo() {
  return (
    <PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause" style={{ width: 400, height: 400 }}>
      <AnimationSvg />
    </PixodeskSvgCssAnimator>
  );
}
```

| Prop | Type | Default |
|---|---|---|
| `children` | the SVGR component | required |
| `startOn` | `'load' \| 'mouseOver' \| 'click' \| 'scrollIntoView'` | `'load'` |
| `outAction` | `'continue' \| 'pause' \| 'reset'` | `'continue'` |
| `className` · `style` | on the wrapper `<div>` | — |

> ⚠️ **Don't put the same SVG file on a page twice.** You can have as many
> `<PixodeskSvgCssAnimator>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#one-copy-of-a-file-per-page)).

SVGR strips `<script>` tags, so only the pure CSS flavour works this way. Files with scripts
(JS triggers / JS animation) should be inlined as raw HTML, or switched to JSON.

## Next.js

The component renders real SVG markup on the server and starts the animator in an effect on
the client, so it works in the App Router — mark the file that uses it as a client component:

```tsx
'use client';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export default function Hero() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

JSON imports work out of the box in Next.js; for a CSS-flavour SVG use `@svgr/webpack`.


[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Vue →](./vue.md)
