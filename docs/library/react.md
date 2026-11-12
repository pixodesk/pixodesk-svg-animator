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
  return <SvgAnimationPlayer doc={animation} playUsingActionTriggers />;
}
```

The component renders the root `<svg>` of the document; size it with `className` / `style` or
by sizing the parent (the SVG keeps its `viewBox`).

## Control modes

Every driver prop starts with its verb — `play…` plays, `show…` shows a frame: `playUsingActionTriggers`
(the document's triggers, or ones you pass), `playback` (your state — `off` · `on` · `paused`),
`showAtProgress` / `showAtTime` (your position). TypeScript accepts ONE driver family at a time
(`PxControlProps` is a union of them); from JavaScript, set props from more than one group and the
highest-priority one wins — `showAtProgress` → `showAtTime` → `playback`
→ `playUsingActionTriggers` — and the
component warns, naming both props and the winner ([PX1501](../diagnostics.md#the-props-a-component-was-given)). `playerRef` is not a mode: it is filled in
**every** mode and never changes which one you are in, so you can always call `playback.start()` /
`playback.pause()` / `playback.stop()` yourself; `playerRef` with no control prop beside it is simply the static
mode, where nothing plays until you say so. React, Vue and React Native all resolve this the
same way, from one rule in core.

Nothing plays until a prop or option names the driver (`playUsingActionTriggers`, `playback`,
`showAt…`). A file embedded with no code around it — the `<div data-px-animation-src>` tag, the
CSS wrapper, a standalone SVG file — has no other possible driver, so there the embedding is that
naming and the file plays as saved.

In every mode but `playUsingActionTriggers` the file's own triggers are switched off — core's
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
      <button onClick={() => playerRef.current?.playback.start()}>Start</button>
      <button onClick={() => playerRef.current?.playback.pause()}>Pause</button>
      <button onClick={() => playerRef.current?.playback.stop()}>Stop</button>
    </>
  );
}
```

What `playerRef.current` gives you — the web API minus `destroy` / `getRootElement` / `isReady`,
because the component owns the element's lifetime: `playback`, everything a page does to the animation. It is
core's `PxAnimationPlayerHandle`, under that one name in every framework package, so the three cannot drift
apart; `playback` is the same `PxPlaybackControls` the web player hands out — [every member is listed
there](./web-player.md#the-playback-api). The four buttons — `playback.start()`, `playback.stop()`,
`playback.pause()`, `playback.resume()` — take no arguments: how a start or a stop looks is written once, in the
timeline's `actions` ([Actions](./playback-and-triggers.md#actions--how-a-start-and-a-stop-look)), which the
handle follows exactly as the triggers and the `playback` prop do. One spelling per act: there are no
`play()` / `pause()` aliases (until 1.25 the methods sat flat on the handle).

<!-- px-check signature pkg=react -->
```typescript
interface PxAnimationPlayerHandle {
    readonly playback: PxPlaybackControls; // start · stop · pause · resume · playOnce — the buttons;
                                           //   getState · isActive · isPlaying — the state;
                                           //   jumpToStart · jumpToEnd · setCurrentTime · setCurrentProgress ·
                                           //   setTotalTime — the playhead; getDuration · getCurrentTime · … ·
                                           //   getTotalProgress — content time; getSpeed / setSpeed and the
                                           //   …AtSpeed reads — the speed
}
```

**Two clocks.** Plain names are content ms **inside the iteration**: `playback.getCurrentTime()` is the frame
on screen, `0..getDuration()`, so a slider for a looping file spans one pass and wraps — the way every
animation player shows it. The `total…` names span the **whole playback** ("total" = including repeats,
GSAP's words): `playback.getTotalDuration()` is the slider maximum for a finite playback and `null` when
`iterations` is `'infinite'` (the honest answer, no division to guard); `playback.getTotalTime()` /
`playback.getTotalProgress()` are the playhead on it. The `…AtSpeed` names are the same values at the current
speed: `playback.getDurationAtSpeed()` is how long one pass takes, `playback.getCurrentTimeAtSpeed()` /
`playback.getTotalTimeAtSpeed()` where the playhead is; the file's `timeline.playbackSpeed` is the initial
speed and `playback.setSpeed()` replaces it ([Two clocks](./playback-and-triggers.md#two-clocks)).
`playback.jumpToStart()` is the unconditional jump to the rest pose and reports nothing, like a seek;
`playback.stop()` runs the file's stop action and reports `onPlaybackStop`. A call on a handle
whose component has unmounted is ignored ([PX1504](../diagnostics.md)); `playback.getState()` then says
`'destroyed'`.

### Play using action triggers (`playUsingActionTriggers`)

> **Example:** [`react/play-using-action-triggers`](../../examples/docs-examples/src/cases/react/play-using-action-triggers/) — `pnpm example:docs`, then open `#react/play-using-action-triggers`.

The simplest mode: the component starts the animation the way the file says it should — on
load, on hover, on click — once enough of it is on screen.

```tsx
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Intro() {
  return <SvgAnimationPlayer doc={animation} playUsingActionTriggers />;
}
```

`playUsingActionTriggers` alone uses the triggers saved in the document — their event lists and the
visibility gate ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)).
Pass an **object** instead of `true` and that is the whole `actionTriggers` block to use for this mount —
a replacement, not a merge: the lists you leave out are simply not listed, never the file's
values. How each action looks stays in the file's `actions`, which the `actions` prop adjusts —
see [Playback overrides](#playback-overrides).

```tsx
// plays while hovered; when the pointer leaves it plays on to the end of the current pass, then rests
<SvgAnimationPlayer doc={animation}
  playUsingActionTriggers={{ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut' }}
  actions={{ 'playback.stop': 'animateToEnd' }} />

// a click toggles off → playing → paused → playing (the state rule picks the list)
<SvgAnimationPlayer doc={animation} playUsingActionTriggers={{ 'playback.start': 'click', 'playback.pause': 'click' }} />

// a click starts it, the next click stops it
<SvgAnimationPlayer doc={animation} playUsingActionTriggers={{ 'playback.start': 'click', 'playback.stop': 'click' }} />
```

### Controlled time (`showAtProgress` / `showAtTime`)

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
      <SvgAnimationPlayer doc={animation} showAtTime={time} playerRef={playerRef}
                   onReady={() => setMax(playerRef.current?.playback.getDuration() ?? 0)} />
      <input type="range" min={0} max={max} value={time} onChange={e => setTime(+e.target.value)} />
    </>
  );
}
```

`showAtProgress` is a position in **one iteration** of the content window, from `0`, the first
frame, to `1`, the last; `showAtTime` is the same position in milliseconds, `0` to `playback.getDuration()`.
One pass is always finite, so neither needs an exception for `iterations: 'infinite'` (until 1.21
both spanned the whole playback, one iteration only when infinite). Their read twins on the handle are
`playback.getCurrentProgress()` and `playback.getCurrentTime()`.

### Declarative playback — `playback`

> **Example:** [`react/declarative`](../../examples/docs-examples/src/cases/react/declarative/) — `pnpm example:docs`, then open `#react/declarative`.

**`playback` names a position, not a command** — a lever your app holds, like a CSS class that is
applied or not: `"off"` (no playback), `"on"` (a playback) or `"paused"` (the playback, frozen). A change of position
presses one of the built-in buttons — `off` → `on` is `playback.start()`, `on` → `paused` is `playback.pause()`,
`paused` → `on` is `playback.resume()`, anything → `off` is `playback.stop()` — and HOW a start or a stop looks is
the file's `actions` block, which the `actions` prop adjusts and which the triggers and the handle
honour too
([Actions — how a start and a stop look](./playback-and-triggers.md#actions--how-a-start-and-a-stop-look)).
`playback="off"` performs the **stop** action (`actions["playback.stop"]`: `jumpToStart`, `animateToStart`,
`jumpToEnd` or `animateToEnd`) — it does not pause; freeze with `"paused"`. With the defaults:

- **One-shot document (a single pass):** `playback="on"` plays to the end and holds there
  (start `continue`, `atEnd` `hold`) — on mount too (the end pose without motion is
  `showAtProgress={1}`); `playback="off"` snaps back to the start (stop `jumpToStart`). A change moves
  from the current frame — interruptions turn around smoothly, never jump — and a **mount with
  `playback="off"` presses nothing**: there is nothing to stop yet.
- **Looping document (`iterations` > 1 or `'infinite'`):** `"on"` runs, `"off"`
  snaps to rest — or, with `actions={{ 'playback.stop': 'animateToEnd' }}`, first plays on to the end of the
  current pass (a heartbeat should not die mid-beat) and then rests.
- **`"paused"` freezes the current frame, immediately,** and `"on"` carries on from it. A mount with
  `"paused"` starts the playback frozen on its first frame. No pair of positions is invalid: the lever has
  three, and every move between them is exactly one button.

WHY one lever (`play` / `pause` / `playState` until 1.23): two booleans had an impossible pair (`pause`
without `play`), and the one word mixed what the host asks for with what the player reports. `playback`'s
positions are requests — `off` · `on` · `paused` (`PxPlayback`); `playback.getState()` is the readout (`playing`
or `finished` for `on`, plus the states the player reaches by itself).

The everyday recipes — the same actions, the same settings:

```tsx
// Hover icon (trash-can lid): plays to the end on enter, plays BACK on leave, from wherever it is
<SvgAnimationPlayer doc={lid} playback={hovered ? 'on' : 'off'} actions={{ 'playback.stop': 'animateToStart' }} />

// Splash / stamp — zero config: plays forward, off SNAPS back to clean.
// To replay on EVERY click, let the start jump to the start instead of continuing, and re-arm on finish:
<SvgAnimationPlayer doc={splash} playback={splashing ? 'on' : 'off'} actions={{ 'playback.start': 'jumpToStart' }}
  onFinish={() => setSplashing(false)} />

// Overlay art: appears instantly, retreats animated
<SvgAnimationPlayer doc={art} playback={open ? 'on' : 'off'}
  actions={{ 'playback.start': 'jumpToEnd', 'playback.stop': 'animateToStart' }} />

// Spinner: runs while busy; when busy ends it finishes the current turn, then rests
<SvgAnimationPlayer doc={spinner} playback={busy ? 'on' : 'off'} actions={{ 'playback.stop': 'animateToEnd' }} />

// Heartbeat with two buttons: Pause freezes it (the freeze inside the playback), Stop lets the beat finish first
<SvgAnimationPlayer doc={beat} playback={paused ? 'paused' : running ? 'on' : 'off'}
  actions={{ 'playback.stop': 'animateToEnd' }} />

// Doorbell — click plays once, start to finish; there is no "off", so it is a ref verb:
<SvgAnimationPlayer doc={bell} playerRef={playerRef} />  /* + onClick={() => playerRef.current?.playback.playOnce()} */
```

The same lever drives a pre-rendered SVG+CSS export as class names on its root —
`px-anim-enabled` (a playback exists; removing it jumps back to the start) and `px-anim-playing` (not frozen) — and the Vue
and React Native components share this component's rule (`resolveDeclarativePlayback` in core,
acting through `applyDeclarativeAction`), so the behaviour cannot drift.

With none of `playUsingActionTriggers` / `showAtProgress` / `showAtTime` / `playback` set, the
component renders the first frame statically — `playerRef` on its own is such a
case, so playback waits for your call (`playback.playOnce()` for the one-shot ping). A WRITE call on the ref while
`playback` or `showAtProgress` / `showAtTime` own playback warns
([PX1503](../diagnostics.md)) and is applied; the next prop change reasserts the props.

## Playback overrides

> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

The same document can play differently in each place you mount it. Three props, the same on every
player ([Overriding from a player](./playback-and-triggers.md#overriding-from-a-player)), and
the document you passed is never modified:

- `timelineOptions` — corrections to the file's `animator.timeline` block, minus its `actionTriggers`
  and `actions`: an object shaped like the file — `iterations`, `delay`, `playbackSpeed`, the gate
  numbers; whoever needs more edits the document.
- `actions` — corrections to the file's `timeline.actions`: `{ 'playback.stop': 'animateToStart' }` changes how a stop
  looks and leaves every other setting as the file has it.
- `playUsingActionTriggers` — `true` plays on the file's triggers; an object is the whole `actionTriggers` block
  to use instead ([Play using action triggers](#play-using-action-triggers-playusingactiontriggers)). To have your
  code drive instead, pass no control prop at all — the file's triggers are then switched off and `playerRef` is
  the driver.

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions`, `actions` | **recursive partials** — objects merge key by key, values replace, a key left out changes nothing |
| a `playUsingActionTriggers` object | **replaces** the file's `actionTriggers` as a whole — its lists belong together |

```tsx
// The file loops twice and plays on load; here it loops forever and waits for playback.start() —
// without `playUsingActionTriggers` the file's triggers are switched off, so only your code starts it.
<SvgAnimationPlayer doc={animation} timelineOptions={{ iterations: 'infinite' }} playerRef={playerRef} />

// The file's triggers, with the timing corrected
<SvgAnimationPlayer doc={animation} playUsingActionTriggers timelineOptions={{ outTime: 2000, playbackSpeed: 2 }} />

// These triggers instead of the file's, and a smooth retreat on hover-out
<SvgAnimationPlayer doc={animation} playUsingActionTriggers={{ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut' }}
  actions={{ 'playback.stop': 'animateToStart' }} />
```

There is no delete: a key you leave out keeps the file's value. To get a default back, set it:

```tsx
<SvgAnimationPlayer doc={animation} playUsingActionTriggers timelineOptions={{ delay: 0 }} />
```

`actionTriggers` and `actions` are not keys of `timelineOptions` — only `playUsingActionTriggers` carries triggers
and only `actions` the action settings, so every key is reachable exactly one way. The out-of-view
behavior goes in `actions` (`actions={{ outOfView: 'continue' }}`); the gate
numbers `inViewThreshold` and `inViewDebounce` are timeline keys and go in `timelineOptions`
([the visibility gate](./playback-and-triggers.md#whether-it-may-run--the-visibility-gate)).

**To repeat the whole animation**, pass `timelineOptions={{ iterations: 'infinite' }}` — there is no
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
    doc: PxDocumentJson;                  // the animation document (a .json import passes as-is); no URL form
    className?: string;                   // added to the root <svg>
    style?: CSSProperties;                // set on the root <svg>

    // Playback override — shaped like the file's `timeline` block, deep-merged over it; a key left
    // out keeps the file's value — see Playback overrides above:
    //   timelineOptions={{ iterations, delay, iterationDirection, playbackSpeed, inViewThreshold, … }}
    timelineOptions?: PxTimelineOptions;  // the timing — everything but `actionTriggers` and `actions`
    actions?: PxActionsOptions;           // how a start and a stop look (+ the gate's outOfView):
                                          //   actions={{ 'playback.stop': 'animateToEnd' }}; the end of the pass is a
                                          //   timeline key — timelineOptions={{ atEnd: 'jumpToStart' }}

    // Control — `PxControlProps`: ONE driver family at a time compiles (Control modes, above)
    playerRef?: React.RefObject<PxAnimationPlayerHandle | null>;   // never a mode: filled in every mode
    playUsingActionTriggers?: boolean | PxActionTriggersInput; // true: the document's own triggers; an object: these triggers
                                          //   instead — { "playback.start", "playback.stop", "playback.pause", "playback.resume" } (`PxActionTriggersInput`),
                                          //   each one event or a list of the events that list may name ('load' |
                                          //   'hoverIn' | 'hoverOut' | 'click'); playback.resume is derived when left out
    showAtProgress?: number;              // controlled: 0–1 of ONE iteration of the content window
    showAtTime?: number;                  // controlled: ms inside one iteration, 0..getDuration()
    playback?: 'off' | 'on' | 'paused';    // a LEVER (`PxPlayback`): its position is held, a change presses one
                                          //   button — off → on playback.start(), on → paused playback.pause(), paused → on
                                          //   playback.resume(), → off playback.stop() — how each looks is the file's `actions`
                                          //   (and the `actions` prop); a mount with 'off' presses nothing, with
                                          //   'paused' starts the playback frozen

    // Lifecycle — no arguments
    onReady?: () => void;    // the player exists and the SVG is rendered — fires once, async;
                             //   the push twin of isReady()
    onPlaybackStart?: () => void; // a playback began — playback.start(), a `playback.start` trigger, playback to 'on' / 'paused'
                             //   from 'off', playback.playOnce(); a returning playback turned around
    onPlaybackResume?: () => void; // the playback carried on after a freeze — playback.resume(), a `playback.resume` trigger,
                             //   playback back to 'on'
    onPlaybackPause?: () => void; // the playback was frozen — playback.pause(), a `playback.pause` trigger, playback="paused";
                             //   NOT the gate's off-screen hold (that reports nothing)
    onFinish?: () => void;   // reached the end — every iteration played, or playback.jumpToEnd(); not when
                             //   stopped early (a loop stopped at a pass end reports onPlaybackStop only)
    onDestroy?: () => void;   // the player was destroyed — unmount, or new `doc` content re-created it
    onPlaybackStop?: () => void;  // the playback was stopped — a `playback.stop` trigger, playback="off", playback.stop(); at once,
                             //   or on arrival for `animateToEnd`. A pause is onPlaybackPause, the end onFinish,
                             //   a removal onDestroy; playback.jumpToStart() reports nothing

    // Diagnostics — the shared channel (the API at a glance): onWarning = it plays, but something was
    // ignored, degraded or misspelled; onError = this instance will not play, `playerRef` stays empty
    onWarning?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    suppressWarnings?: boolean; suppressErrors?: boolean;
}
```

Each diagnostic is `{ code, kind, data?, message, error? }`. `code` is a number you can switch on — its description is on the [codes page](../diagnostics.md), which `message` links to; `data` carries the specifics. `kind` says **who can act on it**:
`document` (repair the file) · `host` (fix the page) · `platform` (the browser could not do it;
the player degraded) · `usage` (fix the props you passed) · `internal` (report it to us). So you
can route rather than just log — surface `document` problems in a build check, for instance. Once
you know what a document has to say and tolerate it, `suppressWarnings` keeps it out of the console.

Passing a different `doc` (or changing `className` / `style` / the control mode) throws the
old player away and builds a new one; the old instance emits `onDestroy` on its
way out. Changing `showAtProgress` / `showAtTime` does not recreate anything.

## CSS-flavor SVGs — `SvgCssAnimationPlayer`

> **Example:** [`react/css-svgr`](../../examples/docs-examples/src/cases/react/css-svgr/) — `pnpm example:docs`, then open `#react/css-svgr`.

For a **pre-rendered SVG + CSS animation** file imported as a component with
[SVGR](https://react-svgr.com/) (`@svgr/webpack`, `vite-plugin-svgr`), this small wrapper adds
the triggers and the visibility gate. It renders a `<div>` of its own around your SVG component —
that is what `SvgCssAnimationPlayer` becomes on the page — and starts, pauses or stops the
animation by switching the file's CSS classes on that `<div>`. Its props are `SvgAnimationPlayer`'s
names, narrowed where a class toggle can do less (`SvgCssAnimationPlayerProps` is derived from
`SvgAnimationPlayerProps`, so the two cannot drift):

```tsx
import { SvgCssAnimationPlayer } from '@pixodesk/svg-animator-react';
import AnimationSvg from './animation.svg?react';   // vite-plugin-svgr

export function HoverLogo() {
  return (
    <SvgCssAnimationPlayer playUsingActionTriggers={{ 'playback.start': 'hoverIn', 'playback.pause': 'hoverOut' }} style={{ width: 400, height: 400 }}>
      <AnimationSvg />
    </SvgCssAnimationPlayer>
  );
}
```

`playUsingActionTriggers` is the JSON player's block — the same lists over the same events, read by
the same rules ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)) —
and the gate is the same gate. It takes the block only, never `true`: a script-free SVG imported as a
component carries no triggers the component could read. An absent `playUsingActionTriggers` lists
nothing, like an empty block — nothing starts the animation without one; to play on load, say so:
`playUsingActionTriggers={{ 'playback.start': 'load' }}`. The gate numbers go in `timelineOptions`, as on the JSON
component: `timelineOptions={{ inViewThreshold: 1 }}`.

<!-- px-check signature pkg=react loose=SvgCssAnimationPlayerProps.timelineOptions -->
```typescript
// Wraps the SVG in a div and drives it by toggling class names — `px-anim-enabled` once
// started (paused), plus `px-anim-playing` while running.
const SvgCssAnimationPlayer: FC<SvgCssAnimationPlayerProps>;

// DERIVED from SvgAnimationPlayerProps — the same names, narrowed; a type-level guard fails to
// compile the moment one drifts
interface SvgCssAnimationPlayerProps {
    children: ReactNode;                  // the SVGR-imported SVG component
    playUsingActionTriggers?: PxActionTriggersInput; // the BLOCK only: { "playback.start", "playback.stop", "playback.pause", "playback.resume" },
                                          //   each one event or a list of the events that list may name ('load' |
                                          //   'hoverIn' | 'hoverOut' | 'click'); playback.resume is derived when left out
    timelineOptions?: { inViewThreshold?: number; inViewDebounce?: number };
                                          // the gate numbers only: 0–1 of the SVG on screen before it may run
                                          //   (default 0.5; 0 = any visible pixel), and ms it must hold first (150)
    actions?: Pick<PxActionsOptions, 'outOfView'>; // only `outOfView` applies: 'pause' (default) | 'continue' |
                                          //   'jumpToStart' while nobody can see it
    className?: string;                   // on the wrapper div
    style?: CSSProperties;                // on the wrapper div
}
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

SVGR strips `<script>` tags, so only the pure CSS flavor works this way. Files with scripts
(JS triggers / JS animation) should be inlined as raw HTML, or switched to JSON.

## API reference

Everything is spelled out above: `SvgAnimationPlayer` and its props under [Props](#props), the
handle under [Imperative API](#imperative-api-playerref), `SvgCssAnimationPlayer` under
[CSS-flavor SVGs](#css-flavor-svgs--svgcssanimationplayer). The callbacks and diagnostics are
the shape every player shares — [the API at a glance](./README.md#the-api-at-a-glance).

<!-- px-check exports @pixodesk/svg-animator-react -->
Also exported: **●** `SvgAnimationPlayerProps`, `SvgCssAnimationPlayerProps` (derived from it),
`PxAnimationPlayerHandle` and its `PxPlaybackControls` (what `playback` is), `SvgAnimationPlayerCallbacks` (the `on*` props as a standalone type), and `PxDocument`
(the document type, for casting a JSON import — [TypeScript](./installation.md#typescript)).

[← Web player](./web-player.md) · [Contents](../../README.md#documentation) · Next: [Next.js →](./nextjs.md)
