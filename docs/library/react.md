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

What `apiRef.current` gives you — the web API minus `destroy` / `getRootElement` / `isReady`,
because the component owns the element's lifetime. It is core's `PxAnimatorHandle` under this
package's name; `VueAnimatorApi` and `RnAnimatorApi` are the same type, so the three cannot drift:

<!-- px-check signature pkg=react -->
```typescript
interface ReactAnimatorApi {
    isPlaying(): boolean;                  // true while running; false when paused, finished or not started
    play(): void;                          // start, or resume from the current time
    pause(): void;                         // hold the current frame
    cancel(): void;                        // stop and reset to the start
    finish(): void;                        // jump to the end and hold it
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, negative = reverse; 0 is rejected
                                           //   with a warning — use pause()
    getCurrentTime(): number | null;       // ms from the start of the whole run, every iteration
                                           //   included; null before mount
    setCurrentTime(time: number): void;    // seek, ms from the start; clamped to the run
    getCurrentProgress(): number | null;   // the same position as 0–1 of the whole run — the read
                                           //   twin of the `progress` prop
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run
}
```

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
`timeline={{ trigger: { … } }}` for the rest of the trigger — see
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

`play && !pause` plays; `pause` pauses; `play === false` holds where it is (it used to jump to the end); a pause that is
switched back off resumes.

With none of `autoplay` / `progress` / `time` / `play` / `pause` set, the component renders the
first frame statically — `apiRef` on its own is such a case, so playback waits for your `play()`.

## Playback overrides

> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

The same document can play differently in each place you mount it. `timeline` takes an object
shaped exactly like the file's own `animator` block and deep-merges it over what the file says
— the document you passed is never modified.

```tsx
// The file loops twice and starts on load; here it loops forever and waits for play().
<PixodeskSvgAnimator
  doc={animation}
  timeline={{ iterations: 'infinite', trigger: { startOn: 'programmatic' } }}
  apiRef={apiRef}
/>
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back:

```tsx
<PixodeskSvgAnimator doc={animation} autoplay timeline={{ delay: null }} />
```

`duration`, `delay`, `iterations` and `startOn` are also plain props, because
`duration={2000}` reads better than a nested object; a prop wins over the same key inside
`timeline`. To ignore the file's playback settings entirely and start from the player's defaults,
add `resetTimeline`.

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).

## Props

Only `doc` is required; everything else overrides what the document already says. React renders
the SVG; the player drives its attributes.

<!-- px-check signature pkg=react -->
```typescript
const PixodeskSvgAnimator: FC<PixodeskSvgAnimatorProps>;

interface PixodeskSvgAnimatorProps {
    doc: PxAnimatedSvgDocument;           // the animation document (the JSON format page); no URL form
    className?: string;                   // added to the root <svg>
    style?: CSSProperties;                // set on the root <svg>

    // Playback override — one object, shaped exactly like the file's `timeline` block,
    // deep-merged over it. `null` at a slot DELETES that key — see Playback overrides above:
    //   timeline={{ engine, frameRate, fillMode, direction,
    //              trigger: { outAction, finishAction, scrollIntoViewThreshold } }}
    timeline?: PxTimelinePatch | string;  // a JSON string is accepted too
    resetTimeline?: boolean;              // start from the player's defaults, `timeline` on top

    // Shortcuts — a shortcut wins over the same key inside `timeline`
    duration?: number;                    // ▸ timeline.duration (one iteration, ms)
    delay?: number;                       // ▸ timeline.delay (ms). Negative skips ahead: -500 starts
                                          //   at once from the frame at 0.5 s
    iterations?: number | 'infinite';     // ▸ timeline.iterations; 'infinite' never stops
    startOn?: PxStartOn;                  // ▸ timeline.trigger.startOn: 'load' | 'mouseOver' | 'click' |
                                          //   'scrollIntoView' | 'programmatic' (only a play() from code)

    // Control — the HIGHEST-priority one that is set picks the mode (Control modes, above)
    apiRef?: React.RefObject<ReactAnimatorApi | null>;   // never a mode: filled in every mode
    autoplay?: boolean;                   // obey the document's own trigger — the Start setting from the editor
    progress?: number;                    // controlled: 0–1 of duration × iterations
                                          //   (one iteration when iterations is 'infinite')
    time?: number;                        // controlled: ms from the start
    play?: boolean;                       // true: play regardless of the trigger; false: hold where it is
    pause?: boolean;                      // hold the current frame; false again resumes

    // Lifecycle — no arguments
    onPlay?: () => void;     // started, or resumed after a pause
    onPause?: () => void;    // paused: the `pause` prop, the API's pause(), or a trigger's out action
    onCancel?: () => void;   // stopped and back at the start state
    onFinish?: () => void;   // reached the end — every iteration played, or finish() was called;
                             //   not when stopped early
    onRemove?: () => void;   // the player was destroyed — unmount, or a new `doc` re-created it
    onStop?: () => void;     // after any of onPause / onCancel / onFinish / onRemove — the one to use
                             //   when you only care that it is no longer playing

    // Diagnostics — the shared channel (the API at a glance): onWarn = it plays, but something was
    // ignored, degraded or misspelled; onError = this instance will not play, `apiRef` stays empty
    onWarn?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    muteWarn?: boolean; muteError?: boolean;
}
```

Each diagnostic is `{ code, kind, data?, message, error? }`. `code` is a number you can switch on — its description is on the [codes page](../diagnostics.md), which `message` links to; `data` carries the specifics. `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the props you passed) · `internal` (report it to us). So you
can route rather than just log — surface `document` problems in a build check, for instance. Once
you know what a document has to say and tolerate it, `muteWarn` keeps it out of the console.

Passing a different `doc` (or changing `className` / `style` / the control mode) throws the
old animator away and builds a new one; the old instance emits `onCancel`, `onRemove` and
`onStop` on its way out. Changing `progress` / `time` does not recreate anything.

## CSS-flavor SVGs — `PixodeskSvgCssAnimator`

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

<!-- px-check signature pkg=react -->
```typescript
// Wraps the SVG in a div and drives it by toggling class names — `px-anim-enabled` once
// started, plus `px-anim-playing` while running.
const PixodeskSvgCssAnimator: FC<{
    children: ReactNode;                  // the SVGR-imported SVG component
    startOn?: PxStartOn;                  // 'load' (default) | 'mouseOver' | 'click' | 'scrollIntoView'
                                          //   — 'programmatic' does nothing here (no play())
    outAction?: PxOutAction;              // 'continue' (default) | 'pause' | 'reset'
                                          //   — 'reverse' is accepted but acts as 'continue': a class
                                          //   toggle cannot run CSS keyframes backwards
    scrollIntoViewThreshold?: number;     // 0–1 of the SVG visible before 'scrollIntoView' starts;
                                          //   default 0, the wire default
    className?: string;                   // on the wrapper div
    style?: CSSProperties;                // on the wrapper div
}>;
```

> ⚠️ **Don't put the same SVG file on a page twice.** You can have as many
> `<PixodeskSvgCssAnimator>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#one-copy-of-a-file-per-page)).

SVGR strips `<script>` tags, so only the pure CSS flavor works this way. Files with scripts
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

JSON imports work out of the box in Next.js; for a CSS-flavor SVG use `@svgr/webpack`.

## API reference

Everything is spelled out above: `PixodeskSvgAnimator` and its props under [Props](#props), the
handle under [Imperative API](#imperative-api-apiref), `PixodeskSvgCssAnimator` under
[CSS-flavor SVGs](#css-flavor-svgs--pixodesksvgcssanimator). The callbacks and diagnostics are
the shape every player shares — [the API at a glance](./README.md#the-api-at-a-glance).

<!-- px-check exports @pixodesk/svg-animator-react -->
Also exported: **●** `PixodeskSvgAnimatorProps`, `ReactAnimatorApi`,
`PixodeskSvgAnimatorCallbacks` (the six `on*` props as a standalone type).

[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Vue →](./vue.md)
