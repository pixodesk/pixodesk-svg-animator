# React — `@pixodesk/svg-animator-react`

[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Next.js →](./nextjs.md)

Use this in a React or Next.js app: drop in the component, pass it the JSON, and it renders
the animation and controls its playback. It wraps the [web player](./web-player.md)
and renders the SVG with React itself, so it is SSR-safe and works in Next.js. Control it the
way that suits your code — the document's triggers, your own state, a ref, or a controlled position.

```bash
npm install @pixodesk/svg-animator-react
```

```tsx
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Logo() {
  return <SvgAnimationPlayer doc={animation} playOnTrigger />;
}
```

The component renders the root `<svg>` of the document; size it with `className` / `style` or
by sizing the parent (the SVG keeps its `viewBox`).

## Control modes

Every way to make it play starts with `play`: `playOnTrigger` (the document's triggers, or ones
you pass), `play` / `pause` (your state), `playCurrentProgress` / `playCurrentTime` (your
position). Set props from more than one group and the highest-priority one wins —
`playCurrentProgress` / `playCurrentTime` → `play` / `pause` → `playOnTrigger` — and the
component warns, naming both props and the winner. `playerRef` is not a mode: it is filled in
**every** mode and never changes which one you are in, so you can always call `play()` /
`pause()` / `stop()` yourself; `playerRef` with no control prop beside it is simply the static
mode, where nothing plays until you say so. React, Vue and React Native all resolve this the
same way, from one rule in core.

In every mode but `playOnTrigger` the file's own triggers are switched off — core's
`withoutTriggerDriver` replaces them with an empty block, so nothing starts the animation by
itself ([a note on the control props](./playback-and-triggers.md#a-note-on-the-components-control-props)).

### Imperative API (`playerRef`)

> **Example:** [`react/imperative`](../../examples/docs-examples/src/cases/react/imperative/) — `pnpm example:docs`, then open `#react/imperative`.

Pass a ref as `playerRef`. Once the component has mounted, the ref holds the playback API, so
any button, timer or effect in your app can start, stop, pause, or jump to any point in the animation.

```tsx
import { useRef } from 'react';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Player() {
  const playerRef = useRef<PxAnimationPlayerHandle>(null);
  return (
    <>
      <SvgAnimationPlayer doc={animation} playerRef={playerRef} />
      <button onClick={() => playerRef.current?.play()}>Play</button>
      <button onClick={() => playerRef.current?.pause()}>Pause</button>
      <button onClick={() => playerRef.current?.stop()}>Stop</button>
    </>
  );
}
```

What `playerRef.current` gives you — the web API minus `destroy` / `getRootElement` / `isReady`,
because the component owns the element's lifetime. It is core's `PxAnimationPlayerHandle`, under that
one name in every framework package, so the three cannot drift apart. `play()`, `pause()` and
`stop()` take no arguments: they call the built-in actions, and how a start or a stop looks is
written once, in the timeline's `actions`
([Actions](./playback-and-triggers.md#actions--how-start-stop-and-finish-look)),
which the handle follows exactly as the triggers and the `play` prop do.

<!-- px-check signature pkg=react -->
```typescript
interface PxAnimationPlayerHandle {
    isPlaying(): boolean;                  // true while running; false when paused, stopped or finished
    play(): void;                          // paused → resume; otherwise the configured start (`actions.start`)
    pause(): void;                         // hold the current frame
    stop(): void;                          // the configured stop (`actions.stop`) — after the current
                                           //   iteration when its `completeIteration` is true
    cancel(): void;                        // reset NOW, unconditionally — back to the start state
    finish(): void;                        // jump to the end and hold it
    playOnce(): void;                      // ONE fresh pass from the start, whatever `iterations`
                                           //   say — the verb behind "plays once on click"; the end
                                           //   pose follows `actions.finish`
    setPlaybackRate(rate: number): void;   // 1 normal, 2 double, negative = reverse; 0 is rejected
                                           //   with a warning — use pause()
    getDuration(): number | null;          // ONE pass of the content window, ms — the slider
                                           //   maximum nobody hard-codes (× iterations = the run)
    getCurrentTime(): number | null;       // ms from the start of the whole run, every iteration
                                           //   included; null before mount
    setCurrentTime(time: number): void;    // seek, ms from the start; clamped to the run
    getCurrentProgress(): number | null;   // the same position as 0–1 of the whole run — the read
                                           //   twin of the `playCurrentProgress` prop
    setCurrentProgress(p: number): void;   // seek, 0–1 of the whole run
}
```

### Play on trigger (`playOnTrigger`)

> **Example:** [`react/play-on-trigger`](../../examples/docs-examples/src/cases/react/play-on-trigger/) — `pnpm example:docs`, then open `#react/play-on-trigger`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click — once enough of it is on screen.

```tsx
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Intro() {
  return <SvgAnimationPlayer doc={animation} playOnTrigger />;
}
```

`playOnTrigger` alone uses the triggers saved in the document — their event lists and the
visibility gate ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)).
Pass an **object** instead of `true` and that is the whole `triggers` block to use for this mount —
a replacement, not a merge: the lists you leave out are simply not listed, never the file's
values. How each action looks stays in the file's `actions`, which the `actions` prop adjusts —
see [Playback overrides](#playback-overrides).

```tsx
// plays while hovered; when the pointer leaves it finishes the current iteration, then rests
<SvgAnimationPlayer doc={animation}
  playOnTrigger={{ start: 'hoverIn', stop: 'hoverOut' }}
  actions={{ stop: { completeIteration: true } }} />

// a click toggles stopped → playing → paused → playing (the state rule picks the list)
<SvgAnimationPlayer doc={animation} playOnTrigger={{ start: 'click', togglePause: 'click' }} />

// a click starts it, the next click stops it
<SvgAnimationPlayer doc={animation} playOnTrigger={{ togglePlay: 'click' }} />
```

### Controlled time (`playCurrentProgress` / `playCurrentTime`)

> **Example:** [`react/controlled-time`](../../examples/docs-examples/src/cases/react/controlled-time/) — `pnpm example:docs`, then open `#react/controlled-time`.

Render one frame, and move through the animation by changing the prop. The player is **not** recreated on change —
it just jumps to the new position.

```tsx
import { useRef, useState } from 'react';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Scrubber() {
  const playerRef = useRef<PxAnimationPlayerHandle>(null);
  const [time, setTime] = useState(0);
  const [max, setMax] = useState(0);
  return (
    <>
      <SvgAnimationPlayer doc={animation} playCurrentTime={time} playerRef={playerRef}
                   onReady={() => setMax(playerRef.current?.getDuration() ?? 0)} />
      <input type="range" min={0} max={max} value={time} onChange={e => setTime(+e.target.value)} />
    </>
  );
}
```

`playCurrentProgress` is a position in the whole timeline (duration × iterations), from `0`, the
first frame, to `1`, the last — of one iteration when `iterations` is `'infinite'`;
`playCurrentTime` is a time in milliseconds from the start. Their read twins on the handle are
`getCurrentProgress()` and `getCurrentTime()`.

### Declarative playback — `play`, `pause`

> **Example:** [`react/declarative`](../../examples/docs-examples/src/cases/react/declarative/) — `pnpm example:docs`, then open `#react/declarative`.

**`play` names a state, not a command** — like a CSS class. `true` calls the built-in `start`,
`false` the built-in `stop`, and HOW each one looks is the file's `actions` block — the start,
stop and finish transitions and the stop's `completeIteration` — which the `actions` prop adjusts
and which the triggers and the handle honour too
([Actions — how start, stop and finish look](./playback-and-triggers.md#actions--how-start-stop-and-finish-look)).
With the defaults:

- **One-shot document (a single pass):** `play={true}` plays to the end and holds there
  (start `continue`, finish `hold`); `play={false}` snaps back to the start
  (stop `reset`). A change moves from the current frame — interruptions turn around
  smoothly, never jump — and a **mount never animates**: the component renders the pose the
  props name (so a re-rendered list of icons does not all play at once).
- **Looping document (`iterations` > 1 or `'infinite'`):** `play={true}` runs, `play={false}`
  snaps to rest — or, with `actions={{ stop: { completeIteration: true } }}`, first finishes the current
  iteration (a heartbeat should not die mid-beat) and then rests.
- **`pause` freezes the current frame, immediately,** and lifting it resumes. It only means
  something while `play` is true — `play={false}` forcibly unfreezes; `pause` without `play`
  warns ([PX1502](../diagnostics.md)) and changes nothing.

The everyday recipes — the same actions, the same settings:

```tsx
// Hover icon (trash-can lid): plays to the end on enter, plays BACK on leave, from wherever it is
<SvgAnimationPlayer doc={lid} play={hovered} actions={{ stop: { transition: 'rewind' } }} />

// Splash / stamp — zero config: plays forward, off SNAPS back to clean.
// To replay on EVERY click, let the start restart instead of continuing, and re-arm on finish:
<SvgAnimationPlayer doc={splash} play={splashing} actions={{ start: { transition: 'restart' } }}
  onFinish={() => setSplashing(false)} />

// Overlay art: appears instantly, retreats animated
<SvgAnimationPlayer doc={art} play={open}
  actions={{ start: { transition: 'jumpToFinished' }, stop: { transition: 'rewind' } }} />

// Spinner: runs while busy; when busy ends it finishes the current turn, then rests
<SvgAnimationPlayer doc={spinner} play={busy} actions={{ stop: { completeIteration: true } }} />

// Heartbeat with two buttons: Pause freezes it (the freeze axis), Stop lets the beat finish first
<SvgAnimationPlayer doc={beat} play={running} pause={paused} actions={{ stop: { completeIteration: true } }} />

// Doorbell — click plays once, start to finish; there is no "off", so it is a ref verb:
<SvgAnimationPlayer doc={bell} playerRef={playerRef} />  /* + onClick={() => playerRef.current?.playOnce()} */
```

The same two switches drive a pre-rendered SVG+CSS export as class names on its root —
`px-anim-enabled` (started; removing it resets) and `px-anim-playing` (running) — and the Vue
and React Native components share this component's rule (`resolveDeclarativePlayback` in core,
acting through `applyDeclarativeAction`), so the behaviour cannot drift.

With none of `playOnTrigger` / `playCurrentProgress` / `playCurrentTime` / `play` / `pause` set,
the component renders the first frame statically — `playerRef` on its own is such a case, so
playback waits for your call (`playOnce()` for the one-shot ping). A WRITE call on the ref while
`play` / `pause` or `playCurrentProgress` / `playCurrentTime` own playback warns
([PX1503](../diagnostics.md)) and is applied; the next prop change reasserts the props.

## Playback overrides

> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

The same document can play differently in each place you mount it. Three props, the same on every
player ([Overriding from a player](./playback-and-triggers.md#overriding-from-a-player)), and
the document you passed is never modified:

- `timeline` — a **merge** over the file's `animator.timeline` block, minus its `triggers` and
  `actions`: an object shaped like the file, deep-merged key by key. Corrections — `iterations`,
  `delay`, `playDuration` — never a replacement; whoever needs more edits the document.
- `actions` — a **merge** over the file's `timeline.actions`: `{ stop: { transition: 'rewind' } }`
  changes how a stop looks and leaves every other setting as the file has it.
- `playOnTrigger` — `true` plays on the file's triggers; an object is the whole `triggers` block
  to use instead ([Play on trigger](#play-on-trigger-playontrigger)).

```tsx
// The file loops twice and plays on load; here it loops forever and waits for play() —
// without `playOnTrigger` the file's triggers are switched off, so only your code starts it.
<SvgAnimationPlayer doc={animation} timeline={{ iterations: 'infinite' }} playerRef={playerRef} />

// The file's triggers, with the timing corrected
<SvgAnimationPlayer doc={animation} playOnTrigger timeline={{ outTime: 2000, playDuration: 1000 }} />

// These triggers instead of the file's, and a smooth retreat on hover-out
<SvgAnimationPlayer doc={animation} playOnTrigger={{ start: 'hoverIn', stop: 'hoverOut' }}
  actions={{ stop: { transition: 'rewind' } }} />
```

Objects merge key by key, values replace, and `null` **deletes** a key so the default its
absence means comes back:

```tsx
<SvgAnimationPlayer doc={animation} playOnTrigger timeline={{ delay: null }} />
```

`triggers` and `actions` are not keys of `timeline` here — only `playOnTrigger` carries triggers
and only `actions` the action settings, so every key is reachable exactly one way. The suspend
transition goes in `actions` (`actions={{ suspend: { transition: 'continue' } }}`); the gate
numbers `inViewThreshold` and `inViewDebounce` are timeline keys and go in `timeline`
([the visibility gate](./playback-and-triggers.md#whether-it-may-run--the-visibility-gate)).

**To repeat the whole animation**, pass `timeline={{ iterations: 'infinite' }}` — there is no
`loop` prop. A `loop` inside a file means something narrower: it repeats part of one property's
keyframes ([per-property loops](../format/README.md#per-property-loops)).

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → How the merge works](./playback-and-triggers.md#how-the-merge-works).

## Props

Only `doc` is required; everything else overrides what the document already says. React renders
the SVG; the player drives its attributes.

<!-- px-check signature pkg=react -->
```typescript
const SvgAnimationPlayer: FC<SvgAnimationPlayerProps>;

interface SvgAnimationPlayerProps {
    doc: PxDocumentInput;                 // the animation document (a .json import passes as-is); no URL form
    className?: string;                   // added to the root <svg>
    style?: CSSProperties;                // set on the root <svg>

    // Playback override — shaped like the file's `timeline` block, deep-merged over it. `null` at
    // a slot DELETES that key — see Playback overrides above:
    //   timeline={{ iterations, delay, iterationDirection, playDuration, inViewThreshold, … }}
    timeline?: PxTimelinePatch;           // the timing — everything but `triggers` and `actions`
    actions?: PxActionsPatch;             // how start, stop, finish and suspend look:
                                          //   actions={{ stop: { transition: 'rewind', completeIteration: true } }}

    // Control — the HIGHEST-priority one that is set picks the mode (Control modes, above)
    playerRef?: React.RefObject<PxAnimationPlayerHandle | null>;   // never a mode: filled in every mode
    playOnTrigger?: boolean | PxTriggers; // true: the document's own triggers; an object: these triggers
                                          //   instead — { start, stop, pause, resume, togglePlay, togglePause },
                                          //   each one event or a list of 'load' | 'hoverIn' | 'hoverOut' | 'click'
    playCurrentProgress?: number;         // controlled: 0–1 of duration × iterations
                                          //   (one iteration when iterations is 'infinite')
    playCurrentTime?: number;             // controlled: ms from the start
    play?: boolean;                       // the STATE: true calls `start`, false calls `stop` — how each
                                          //   looks is the file's `actions` (and the `actions` prop);
                                          //   a mount never animates
    pause?: boolean;                      // freeze the current frame NOW / resume; only while
                                          //   `play` is true — play={false} forcibly unfreezes

    // Lifecycle — no arguments
    onReady?: () => void;    // the player exists and the SVG is rendered — fires once, async;
                             //   the push twin of isReady()
    onPlay?: () => void;     // started, or resumed after a pause
    onPause?: () => void;    // paused: the `pause` prop, the API's pause(), a `pause` trigger, or the gate
    onCancel?: () => void;   // stopped and back at the start state
    onFinish?: () => void;   // reached the end — every iteration played, or finish() was called;
                             //   not when stopped early
    onDestroy?: () => void;   // the player was destroyed — unmount, or new `doc` content re-created it
    onStop?: () => void;     // "no longer playing, whatever the reason" — after any of onPause /
                             //   onCancel / onFinish / onDestroy; the one to use
                             //   when you only care that it is no longer playing

    // Diagnostics — the shared channel (the API at a glance): onWarn = it plays, but something was
    // ignored, degraded or misspelled; onError = this instance will not play, `playerRef` stays empty
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
old player away and builds a new one; the old instance emits `onCancel`, `onDestroy` and
`onStop` on its way out. Changing `playCurrentProgress` / `playCurrentTime` does not recreate anything.

## CSS-flavor SVGs — `SvgCssAnimationPlayer`

> **Example:** [`react/css-svgr`](../../examples/docs-examples/src/cases/react/css-svgr/) — `pnpm example:docs`, then open `#react/css-svgr`.

For a **pre-rendered SVG + CSS animation** file imported as a component with
[SVGR](https://react-svgr.com/) (`@svgr/webpack`, `vite-plugin-svgr`), this small wrapper adds
the triggers and the visibility gate. It renders a `<div>` of its own around your SVG component —
that is what `SvgCssAnimationPlayer` becomes on the page — and starts, pauses or resets the
animation by switching the file's CSS classes on that `<div>`:

```tsx
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-react';
import AnimationSvg from './animation.svg?react';   // vite-plugin-svgr

export function HoverLogo() {
  return (
    <SvgCssAnimationPlayer triggers={{ start: 'hoverIn', pause: 'hoverOut' }} style={{ width: 400, height: 400 }}>
      <AnimationSvg />
    </SvgCssAnimationPlayer>
  );
}
```

`triggers` is the JSON player's block — the same lists and toggles over the same events, read by
the same rules ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)) —
and the gate is the same gate. Absent `triggers` play on load; an empty block lists nothing.

<!-- px-check signature pkg=react -->
```typescript
// Wraps the SVG in a div and drives it by toggling class names — `px-anim-enabled` once
// started (paused), plus `px-anim-playing` while running.
const SvgCssAnimationPlayer: FC<{
    children: ReactNode;                  // the SVGR-imported SVG component
    triggers?: PxTriggers;                // WHEN: { start, stop, pause, resume, togglePlay, togglePause },
                                          //   each one event or a list of 'load' | 'hoverIn' | 'hoverOut' | 'click'
    actions?: Pick<PxActions, 'suspend'>; // only `suspend` applies: { suspend: { transition } } — 'pause'
                                          //   (default) | 'continue' | 'reset' while nobody can see it
    inViewThreshold?: number;             // 0–1 of the SVG on screen before it may run; default 0.5; 0 = any visible pixel
    inViewDebounce?: number;              // ms it must hold first; default 150
    className?: string;                   // on the wrapper div
    style?: CSSProperties;                // on the wrapper div
}>;
```

**Accepted limits** of a class toggle — how the moves look stays in the file's CSS, so here:

- the start transition acts as `continue` — a class cannot restart keyframes or jump to their end;
- the stop transition acts as `reset` — a class cannot play keyframes backwards;
- the stop's `completeIteration`, `beforeStart` and the finish transition are the file's own CSS
  and are not changed from here.

> ⚠️ **Don't put the SAME SVG file on a page twice.** You can have as many
> `<SvgCssAnimationPlayer>` on a page as you like, each with a *different* file. What does not
> work is the *same* file twice: the imported component is the file's markup, element ids
> included, so two copies share the same ids and their masks and gradients cross over. To show
> one animation several times, use the JSON component instead — the player gives every copy
> its own ids ([read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#the-same-file-twice-on-one-page)).

SVGR strips `<script>` tags, so only the pure CSS flavor works this way. Files with scripts
(JS triggers / JS animation) should be inlined as raw HTML, or switched to JSON.

## API reference

Everything is spelled out above: `SvgAnimationPlayer` and its props under [Props](#props), the
handle under [Imperative API](#imperative-api-playerref), `SvgCssAnimationPlayer` under
[CSS-flavor SVGs](#css-flavor-svgs--svgcssanimationplayer). The callbacks and diagnostics are
the shape every player shares — [the API at a glance](./README.md#the-api-at-a-glance).

<!-- px-check exports @pixodesk/svg-animator-react -->
Also exported: **●** `SvgAnimationPlayerProps`, `PxAnimationPlayerHandle`,
`SvgAnimationPlayerCallbacks` (the `on*` props as a standalone type), and `PxDocument`
(the document type, for casting a JSON import — [TypeScript](./installation.md#typescript)).

[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Next.js →](./nextjs.md)
