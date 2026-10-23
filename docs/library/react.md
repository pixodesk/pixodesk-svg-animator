# React — `@pixodesk/svg-animator-react`

[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Next.js →](./nextjs.md)

Use this in a React or Next.js app: drop in the component, pass it the JSON, and it renders
the animation and controls its playback. It wraps the [web player](./web-player.md)
and renders the SVG with React itself, so it is SSR-safe and works in Next.js. Control it the
way that suits your code — playAsSaved, declarative props, an imperative ref, or controlled time.

```bash
npm install @pixodesk/svg-animator-react
```

```tsx
import { SvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Logo() {
  return <SvgAnimator doc={animation} playAsSaved />;
}
```

The component renders the root `<svg>` of the document; size it with `className` / `style` or
by sizing the parent (the SVG keeps its `viewBox`).

## Control modes

Several control modes, plus a handle that is not one. Set more than one control prop and the
highest-priority one wins — `progress` / `time` → `play` / `pause` → `playAsSaved` — and the
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
import { SvgAnimator, type PxAnimatorHandle } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Player() {
  const api = useRef<PxAnimatorHandle>(null);
  return (
    <>
      <SvgAnimator doc={animation} apiRef={api} />
      <button onClick={() => api.current?.play()}>Play</button>
      <button onClick={() => api.current?.pause()}>Pause</button>
      <button onClick={() => api.current?.setPlaybackRate(-1)}>Reverse</button>
    </>
  );
}
```

What `apiRef.current` gives you — the web API minus `destroy` / `getRootElement` / `isReady`,
because the component owns the element's lifetime. It is core's `PxAnimatorHandle`, under that
one name in every framework package, so the three cannot drift apart:

<!-- px-check signature pkg=react -->
```typescript
interface PxAnimatorHandle {
    isPlaying(): boolean;                  // true while running; false when paused, finished or not started
    play(): void;                          // start, or resume from the current time
    pause(): void;                         // hold the current frame
    cancel(): void;                        // stop and reset to the start
    finish(): void;                        // jump to the end and hold it
    playOnce(): void;                      // ONE fresh pass from the start, whatever `iterations`
                                           //   say — the verb behind "plays once on click"
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, negative = reverse; 0 is rejected
                                           //   with a warning — use pause()
    getDuration(): number | null;         // ONE pass of the content window, ms — the slider
                                           //   maximum nobody hard-codes (× iterations = the run)
    getCurrentTime(): number | null;       // ms from the start of the whole run, every iteration
                                           //   included; null before mount
    setCurrentTime(time: number): void;    // seek, ms from the start; clamped to the run
    getCurrentProgress(): number | null;   // the same position as 0–1 of the whole run — the read
                                           //   twin of the `progress` prop
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run
}
```

### Autoplay

> **Example:** [`react/play-as-saved`](../../examples/docs-examples/src/cases/react/play-as-saved/) — `pnpm example:docs`, then open `#react/play-as-saved`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click, or when scrolled into view.

```tsx
import { SvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Intro() {
  return <SvgAnimator doc={animation} playAsSaved />;
}
```

Uses the trigger saved in the document — on load, on hover, on click, when scrolled into view
— and its out action. Override it for this one mount with the `start` shortcut, or with
`timeline={{ trigger: { … } }}` for the rest of the trigger — see
[Playback overrides](#playback-overrides).

### Controlled time (`progress` / `time`)

> **Example:** [`react/controlled-time`](../../examples/docs-examples/src/cases/react/controlled-time/) — `pnpm example:docs`, then open `#react/controlled-time`.

Render one frame, and move through the animation by changing the prop. The animator is **not** recreated on change —
it just jumps to the new time.

```tsx
import { useRef, useState } from 'react';
import { SvgAnimator, type PxAnimatorHandle } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Scrubber() {
  const api = useRef<PxAnimatorHandle>(null);
  const [time, setTime] = useState(0);
  const [max, setMax] = useState(0);
  return (
    <>
      <SvgAnimator doc={animation} time={time} apiRef={api}
                   onReady={() => setMax(api.current?.getDuration() ?? 0)} />
      <input type="range" min={0} max={max} value={time} onChange={e => setTime(+e.target.value)} />
    </>
  );
}
```

`progress` is a position in the whole timeline (duration × iterations), from `0`, the first frame, to `1`, the last; `time` is a time in milliseconds from the start.

### Declarative playback — `play`, `pause`, `playMode`, `completeIteration`

> **Example:** [`react/declarative`](../../examples/docs-examples/src/cases/react/declarative/) — `pnpm example:docs`, then open `#react/declarative`.

**`play` names a state, not a command** — like a CSS class; how a change LOOKS is config. What
that state means follows the document's effective `iterations` (the file's value plus the
`iterations` prop):

- **One-shot document (a single pass): `play` is a POSE switch.** `false` = the start pose,
  `true` = the finish pose. A change moves to the new pose **from the current frame** —
  interruptions turn around smoothly, never jump — and a **mount never animates**: the component
  renders the pose the props name (so a re-rendered list of icons does not all play at once).
  `playMode` says which changes actually play: `'forwards'` (the default — plays there, snaps
  back), `'backwards'` (appears instantly, plays back), `'both'` (the two-pose toggle), `'none'`
  (snaps both ways). The same four words as `fillMode`, the same side-mapping — but a different
  question: `fillMode` picks the picture at rest around a run, `playMode` picks whether a `play`
  change travels.
- **Looping document (`iterations` > 1 or `'infinite'`): `play` is a RUN switch.** `true` runs,
  `false` snaps to rest — or, with `completeIteration`, first finishes the current iteration (a
  heartbeat should not die mid-beat) and then rests.
- **`pause` freezes the current frame, immediately,** and lifting it resumes toward the current
  target. It only means something while `play` is true — `play={false}` forcibly unfreezes.

The everyday recipes:

```tsx
// Hover icon (trash-can lid): rests at start · hover → plays forward · rests at end ·
// unhover → plays BACK from wherever it is · rests. One boolean, playMode="both".
<SvgAnimator doc={doc} play={isHovered} playMode="both" />

// Splash / stamp — zero config: plays forward, off SNAPS back to clean.
// A REPEAT splash needs the off edge — re-arm on finish (or use apiRef + playOnce()):
<SvgAnimator doc={doc} play={isSplashing} onFinish={() => setIsSplashing(false)} />

// Overlay art: appears instantly, retreats animated
<SvgAnimator doc={doc} play={isOpen} playMode="backwards" />

// Spinner: spins while busy, off snaps to rest
<SvgAnimator doc={doc} play={isBusy} iterations="infinite" />

// Heartbeat: finishes the current beat, then rests
<SvgAnimator doc={doc} play={isBeating} iterations="infinite" completeIteration />

// Doorbell — click plays once, start to finish; there is no "off", so it is a ref verb:
<SvgAnimator doc={doc} apiRef={api} />  /* + onClick={() => api.current?.playOnce()} */
```

The same two switches drive a pre-rendered SVG+CSS export as class names on its root —
`px-anim-enabled` (the run switch; removing it resets) and `px-anim-playing` (the freeze
switch) — and the Vue and React Native components share this component's rule
(`resolveDeclarativePlayback` in core, acting through `PxDeclarativeAction`s), so the behaviour
cannot drift. A misplaced modifier (`playMode` on a loop, `completeIteration` on a one-shot,
`pause` without `play`) warns and changes nothing.

With none of `playAsSaved` / `progress` / `time` / `play` / `pause` set, the component renders the
first frame statically — `apiRef` on its own is such a case, so playback waits for your call
(`playOnce()` for the one-shot ping). A WRITE call on the ref while `play`/`pause` or
`progress`/`time` own playback warns ([PX1503](../diagnostics.md)) and is applied; the next prop
change reasserts the props.

## Playback overrides

> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

The same document can play differently in each place you mount it. `timeline` takes an object
shaped exactly like the file's own `animator` block and deep-merges it over what the file says
— the document you passed is never modified.

```tsx
// The file loops twice and starts on load; here it loops forever and waits for play().
<SvgAnimator
  doc={animation}
  timeline={{ iterations: 'infinite', trigger: { start: 'none' } }}
  apiRef={apiRef}
/>
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back:

```tsx
<SvgAnimator doc={animation} playAsSaved timeline={{ delay: null }} />
```

`inTime`, `outTime`, `playDuration`, `delay`, `iterations` and `start` are also plain props,
because `outTime={2000}` reads better than a nested object; a prop wins over the same key inside
`timeline`. To ignore the file's playback settings entirely and start from the player's defaults,
add `resetTimeline`.

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).

## Props

Only `doc` is required; everything else overrides what the document already says. React renders
the SVG; the player drives its attributes.

<!-- px-check signature pkg=react -->
```typescript
const SvgAnimator: FC<SvgAnimatorProps>;

interface SvgAnimatorProps {
    doc: PxDocumentInput;                 // the animation document (a .json import passes as-is); no URL form
    className?: string;                   // added to the root <svg>
    style?: CSSProperties;                // set on the root <svg>

    // Playback override — one object, shaped exactly like the file's `timeline` block,
    // deep-merged over it. `null` at a slot DELETES that key — see Playback overrides above:
    //   timeline={{ engine, frameRate, fillMode, direction,
    //              finish, trigger: { mouseOut, visibilityThreshold } }}
    timeline?: PxTimelinePatch | string;  // a JSON string is accepted too
    resetTimeline?: boolean;              // start from the player's defaults, `timeline` on top

    // Shortcuts — a shortcut wins over the same key inside `timeline`
    inTime?: number;                      // ▸ timeline.inTime — the content window's start, ms
    outTime?: number;                     // ▸ timeline.outTime — …and its end (one pass plays the window)
    playDuration?: number;                // ▸ timeline.playDuration — the window in wall ms (slower / faster)
    delay?: number;                       // ▸ timeline.delay (ms). Negative skips ahead: -500 starts
                                          //   at once from the frame at 0.5 s
    iterations?: number | 'infinite';     // ▸ timeline.iterations; 'infinite' never stops
    start?: PxTriggerStart;                  // ▸ timeline.trigger.start: 'load' | 'mouseOver' | 'click' |
                                          //   'none' (only a play() from code)
    offScreen?: PxOffScreenAction;        // ▸ timeline.trigger.offScreen — while none of it is on screen
    mouseOut?: PxMouseOutAction;          // ▸ timeline.trigger.mouseOut — for start: 'mouseOver'
    visibilityThreshold?: number;         // ▸ timeline.trigger.visibilityThreshold — 0–1 on screen
    visibilityDebounce?: number;          // ▸ timeline.trigger.visibilityDebounce — ms it must hold

    // Control — the HIGHEST-priority one that is set picks the mode (Control modes, above)
    apiRef?: React.RefObject<PxAnimatorHandle | null>;   // never a mode: filled in every mode
    playAsSaved?: boolean;                   // obey the document's own trigger — the Start setting from the editor
    progress?: number;                    // controlled: 0–1 of duration × iterations
                                          //   (one iteration when iterations is 'infinite')
    time?: number;                        // controlled: ms from the start
    play?: boolean;                       // the STATE: one-shot doc — which POSE (false = start,
                                          //   true = finish; changes move per playMode, never on
                                          //   mount); looping doc — running or not (false = rest)
    pause?: boolean;                      // freeze the current frame NOW / resume; only while
                                          //   `play` is true — play={false} forcibly unfreezes
    playMode?: 'forwards' | 'backwards' | 'both' | 'none' | PxPlayMode; // one-shot only: which pose changes PLAY vs snap —
                                          //   'forwards' (default: plays there, snaps back) |
                                          //   'backwards' | 'both' | 'none' (fillMode's spellings)
    completeIteration?: boolean;          // loop only: play={false} finishes the CURRENT
                                          //   iteration, then rests

    // Lifecycle — no arguments
    onReady?: () => void;    // the animator exists and the SVG is rendered — fires once, async;
                             //   the push twin of isReady()
    onPlay?: () => void;     // started, or resumed after a pause
    onPause?: () => void;    // paused: the `pause` prop, the API's pause(), or a trigger's out action
    onCancel?: () => void;   // stopped and back at the start state
    onFinish?: () => void;   // reached the end — every iteration played, or finish() was called;
                             //   not when stopped early
    onDestroy?: () => void;   // the player was destroyed — unmount, or new `doc` content re-created it
    onStop?: () => void;     // "no longer playing, whatever the reason" — after any of onPause /
                             //   onCancel / onFinish / onDestroy; the one to use
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
old animator away and builds a new one; the old instance emits `onCancel`, `onDestroy` and
`onStop` on its way out. Changing `progress` / `time` does not recreate anything.

## CSS-flavor SVGs — `SvgCssAnimator`

> **Example:** [`react/css-svgr`](../../examples/docs-examples/src/cases/react/css-svgr/) — `pnpm example:docs`, then open `#react/css-svgr`.

For a **pre-rendered SVG + CSS animation** file imported as a component with
[SVGR](https://react-svgr.com/) (`@svgr/webpack`, `vite-plugin-svgr`), this small wrapper adds
the hover / click / scroll triggers. It renders a `<div>` of its own around your SVG component —
that is what `SvgCssAnimator` becomes on the page — and starts, pauses or resets the
animation by switching the file's CSS classes on that `<div>`:

```tsx
import { SvgCssAnimator } from '@pixodesk/svg-animator-react';
import AnimationSvg from './animation.svg?react';   // vite-plugin-svgr

export function HoverLogo() {
  return (
    <SvgCssAnimator start="mouseOver" mouseOut="pause" style={{ width: 400, height: 400 }}>
      <AnimationSvg />
    </SvgCssAnimator>
  );
}
```

<!-- px-check signature pkg=react -->
```typescript
// Wraps the SVG in a div and drives it by toggling class names — `px-anim-enabled` once
// started, plus `px-anim-playing` while running.
const SvgCssAnimator: FC<{
    children: ReactNode;                  // the SVGR-imported SVG component
    start?: PxTriggerStart;               // 'load' (default) | 'mouseOver' | 'click'
                                          //   — 'none' does nothing here (no play())
    offScreen?: PxOffScreenAction;        // 'pause' (default) | 'continue' | 'reset' — what happens
                                          //   while nobody can see it, whatever started it
    mouseOut?: PxMouseOutAction;          // 'continue' (default) | 'pause' | 'reset'
                                          //   — 'reverse' is accepted but acts as 'continue': a class
                                          //   toggle cannot run CSS keyframes backwards
    visibilityThreshold?: number;         // 0–1 of the SVG on screen before it may run; default 0.5; 0 = any visible pixel
    visibilityDebounce?: number;          // ms it must hold first; default 150
    className?: string;                   // on the wrapper div
    style?: CSSProperties;                // on the wrapper div
}>;
```

> ⚠️ **Don't put the SAME SVG file on a page twice.** You can have as many
> `<SvgCssAnimator>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#the-same-file-twice-on-one-page)).

SVGR strips `<script>` tags, so only the pure CSS flavor works this way. Files with scripts
(JS triggers / JS animation) should be inlined as raw HTML, or switched to JSON.

## API reference

Everything is spelled out above: `SvgAnimator` and its props under [Props](#props), the
handle under [Imperative API](#imperative-api-apiref), `SvgCssAnimator` under
[CSS-flavor SVGs](#css-flavor-svgs--svgcssanimator). The callbacks and diagnostics are
the shape every player shares — [the API at a glance](./README.md#the-api-at-a-glance).

<!-- px-check exports @pixodesk/svg-animator-react -->
Also exported: **●** `SvgAnimatorProps`, `PxAnimatorHandle`,
`SvgAnimatorCallbacks` (the `on*` props as a standalone type), and `PxDocument`
(the document type, for casting a JSON import — [TypeScript](./installation.md#typescript)).

[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Next.js →](./nextjs.md)
