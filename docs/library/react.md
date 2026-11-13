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
  return <SvgAnimationPlayer document={animation} />;   // plays the way the file was saved
}
```

The component renders the root `<svg>` of the document; size it with `className` / `style` or
by sizing the parent (the SVG keeps its `viewBox`).

## Control modes

With no control prop the component plays the file **the way it was saved** — its own `actionTriggers` start
it (on load, on hover, on click), behind the visibility gate; a file without triggers stays still until your
code starts it. The control props change who drives it:

<!-- px-check off the control props, prose — their types are checked under Props -->
| Prop | Mode | Who drives it |
|---|---|---|
| none (the default) | `actionTriggers` | the file's own triggers — and `playerRef`, if you pass one |
| `actionTriggers={{ … }}` | `actionTriggers` | these triggers instead of the file's |
| `disableActionTriggers` | `manual` | your code, through `playerRef` — the file's triggers are off |
| `playback="off" \| "on" \| "paused"` | `playback` | your state |
| `showAtProgress` / `showAtTime` | `fixedTime` | your position — one frame, held |
| `showAsStatic` | `static` | nobody — the picture as drawn |

TypeScript accepts ONE of them at a time (`PxControlProps` is a union); from JavaScript, set more than one
and the highest-priority one wins — `showAsStatic` → `showAtProgress` → `showAtTime` → `playback` →
`disableActionTriggers` → `actionTriggers` — and the component warns, naming both props and the winner
([PX1501](../diagnostics.md#the-props-a-component-was-given)). In every mode but the default the file's own
triggers are switched off ([Control modes — who drives it](./playback-and-triggers.md#control-modes--who-drives-it)).
`playerRef` is not a mode: it is filled in **every** mode and never changes which one you are in, so you can
always call `playback.play()` / `playback.pause()` / `playback.stop()` yourself — a bare component with
`playerRef` plays as the file says AND gives you the handle. React, Vue and React Native all resolve this the
same way, from one rule in core.

### Imperative API (`playerRef`)

> **Example:** [`react/imperative`](../../examples/docs-examples/src/cases/react/imperative/) — `pnpm example:docs`, then open `#react/imperative`.

Pass a ref as `playerRef`. Once the component has mounted, the ref holds the playback API, so
any button, timer or effect in your app can start, stop, pause, or jump to any point in the animation.
`disableActionTriggers` switches the file's own triggers off, so your buttons alone drive it; leave it out and
the handle works beside the file's triggers.

```tsx
import { useRef } from 'react';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Player() {
  const playerRef = useRef<PxAnimationPlayerHandle>(null);
  return (
    <>
      <SvgAnimationPlayer document={animation} disableActionTriggers playerRef={playerRef} />
      <button onClick={() => playerRef.current?.playback.play()}>Play</button>
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
there](./web-player.md#the-playback-api). The five buttons take no arguments: `playback.start()` always plays from
the start, `playback.play()` starts or carries on (a Play button), `playback.stop()`, `playback.pause()` and
`playback.resume()`. How a stop looks is written once, in the timeline's `actions`
([Actions](./playback-and-triggers.md#actions--how-a-stop-looks)), which the handle follows exactly as the
triggers and the `playback` prop do. One spelling per act (until 1.25 the methods sat flat on the handle, and
`playOnce()`, `jumpToStart()` and `jumpToEnd()` existed — a one-iteration timeline and `start()`, `stop()` and
`setCurrentProgress()` say the same).

<!-- px-check signature pkg=react -->
```typescript
interface PxAnimationPlayerHandle {
    readonly playback: PxPlaybackControls; // start · play · stop · pause · resume — the buttons;
                                           //   getState · isActive · isPlaying — the state;
                                           //   setCurrentTime · setCurrentProgress · setTotalTime — the
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
state the playback becomes `paused` at that frame and `playback.resume()` plays on from it — a seek reports
nothing. `playback.stop()` runs the file's stop action and reports `onPlaybackStop`. A call on a handle
whose component has unmounted is ignored ([PX1504](../diagnostics.md)); `playback.getState()` then says
`'destroyed'`.

### Action triggers (`actionTriggers`)

> **Example:** [`react/play-using-action-triggers`](../../examples/docs-examples/src/cases/react/play-using-action-triggers/) — `pnpm example:docs`, then open `#react/play-using-action-triggers`.

The default — no prop needed: the component starts the animation the way the file says it should — on
load, on hover, on click — once enough of it is on screen.

```tsx
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Intro() {
  return <SvgAnimationPlayer document={animation} />;
}
```

It uses the triggers saved in the document — their event lists and the visibility gate
([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)). Pass `actionTriggers` and
that is the whole block to use for this mount instead — a replacement, not a merge: the lists you leave
out are simply not listed, never the file's values. `actionTriggers={null}` lists nothing, the same as
`disableActionTriggers`. How each action looks stays in the file's `actions`, which the `actions` prop
replaces — see [Playback overrides](#playback-overrides).

```tsx
// plays while hovered; when the pointer leaves it plays on to the end of the current pass, then rests
// (`playback.play` carries on — a hover-in on the way to the end does not restart it)
<SvgAnimationPlayer document={animation}
  actionTriggers={{ 'playback.play': 'hoverIn', 'playback.stop': 'hoverOut' }}
  actions={{ 'playback.stop': 'animateToEnd' }} />

// a click toggles off → playing → paused → playing (the state rule picks the list)
<SvgAnimationPlayer document={animation} actionTriggers={{ 'playback.play': 'click', 'playback.pause': 'click' }} />

// a click starts it, the next click stops it
<SvgAnimationPlayer document={animation} actionTriggers={{ 'playback.start': 'click', 'playback.stop': 'click' }} />

// every click plays it from the start — also while it plays
<SvgAnimationPlayer document={animation} actionTriggers={{ 'playback.start': 'click' }} />
```

### The picture as drawn (`showAsStatic`)

`showAsStatic` shows the SVG as drawn and nothing else, whatever the file says: no triggers, no scroll, and
every playback call on `playerRef` is ignored with a warning
([PX1506](../diagnostics.md#the-props-a-component-was-given)); the reads still answer. It beats every other
control prop — for a thumbnail, or a reduced-motion setting:

```tsx
<SvgAnimationPlayer document={animation} showAsStatic={prefersReducedMotion} />
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
      <SvgAnimationPlayer document={animation} showAtTime={time} playerRef={playerRef}
                   onReady={() => setMax(playerRef.current?.playback.getDuration() ?? 0)} />
      <input type="range" min={0} max={max} value={time} onChange={e => setTime(+e.target.value)} />
    </>
  );
}
```

`showAtProgress` is a position counted in **iterations**, in the order they play: `0` the first frame, `1` the
end of the first iteration, `1.2` 20 % into the second (an `alternate` second pass runs backwards, so that is
the frame at 80 %) — clamped to `0 … iterations`, no upper bound when endless, nothing wraps (0–1 of one
iteration until 1.25). `showAtTime` is milliseconds inside one iteration, `0` to `playback.getDuration()`.
Their read twins on the handle are `playback.getCurrentProgress()` and `playback.getCurrentTime()`.

### Declarative playback — `playback`

> **Example:** [`react/declarative`](../../examples/docs-examples/src/cases/react/declarative/) — `pnpm example:docs`, then open `#react/declarative`.

**`playback` names a position, not a command** — a lever your app holds, like a CSS class that is
applied or not: `"off"` (no playback), `"on"` (a playback) or `"paused"` (the playback, frozen). A change of position
presses one of the built-in buttons — `off` → `on` is `playback.start()`, `on` → `paused` is `playback.pause()`,
`paused` → `on` is `playback.resume()`, anything → `off` is `playback.stop()` — and HOW a stop looks is
the file's `actions` block (or the one the `actions` prop gives instead), which the triggers and the handle
honour too
([Actions — how a stop looks](./playback-and-triggers.md#actions--how-a-stop-looks)).
`playback="off"` performs the **stop** action (`actions["playback.stop"]`: `jumpToStart`, `animateToStart`,
`jumpToEnd`, `animateToEnd` or `animateToEndAndBack`) — it does not pause; freeze with `"paused"`. With the defaults:

- **One-shot document (a single pass):** `playback="on"` plays to the end, and the last frame stays
  (`whenFinished` `hold`) — on mount too (the end pose without motion is `showAtProgress={1}`);
  `playback="off"` snaps back to the start (stop `jumpToStart`). `"on"` is a start, so it always plays
  **from the start** — an `"on"` while a stop plays the picture back jumps to the start first (a hover that
  turns around smoothly is the `'playback.play'` trigger list, or `playback.play()` on the ref). A **mount
  with `playback="off"` presses nothing**: there is nothing to stop yet.
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
// Hover icon (trash-can lid): plays on enter, plays BACK on leave, from wherever it is
// (an enter on the way back starts it again from the start)
<SvgAnimationPlayer document={lid} playback={hovered ? 'on' : 'off'} actions={{ 'playback.stop': 'animateToStart' }} />

// Splash / stamp — zero config: plays forward, off SNAPS back to clean.
// To replay on EVERY click, re-arm on finish — every start plays from the start:
<SvgAnimationPlayer document={splash} playback={splashing ? 'on' : 'off'}
  onPlaybackFinish={() => setSplashing(false)} />

// Spinner: runs while busy; when busy ends it finishes the current turn, then rests
<SvgAnimationPlayer document={spinner} playback={busy ? 'on' : 'off'} actions={{ 'playback.stop': 'animateToEnd' }} />

// Heartbeat with two buttons: Pause freezes it (the freeze inside the playback), Stop lets the beat finish first
<SvgAnimationPlayer document={beat} playback={paused ? 'paused' : running ? 'on' : 'off'}
  actions={{ 'playback.stop': 'animateToEnd' }} />

// Doorbell — click plays one pass, start to finish; there is no "off", so it is a ref verb:
<SvgAnimationPlayer document={bell} disableActionTriggers playerRef={playerRef} timelineOptions={{ iterations: 1 }} />
/* + onClick={() => playerRef.current?.playback.start()} */
```

The same lever drives a pre-rendered SVG+CSS export as class names on its root —
`px-anim-enabled` (a playback exists; removing it jumps back to the start) and `px-anim-playing` (not frozen) — and the Vue
and React Native components share this component's rule (`resolveDeclarativePlayback` in core,
acting through `applyDeclarativeAction`), so the behaviour cannot drift.

A WRITE call on the ref while `playback` or `showAtProgress` / `showAtTime` own playback warns
([PX1503](../diagnostics.md)) and is applied; the next prop change reasserts the props. With `showAsStatic`
it is ignored ([PX1506](../diagnostics.md#the-props-a-component-was-given)).

## Playback overrides

> **Example:** [`playback/override-react`](../../examples/docs-examples/src/cases/playback/override-react/) — `pnpm example:docs`, then open `#playback/override-react`.

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
  `disableActionTriggers` — the file's triggers are then switched off and `playerRef` is the driver.

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions` | **a recursive partial** — objects merge key by key, values replace, a key left out keeps the file's value |
| `actions`, `actionTriggers` | **blocks** that replace the file's as a whole — their settings belong together |

```tsx
// The file loops twice and plays on load; here it loops forever and waits for playback.start() —
// `disableActionTriggers` switches the file's triggers off, so only your code starts it.
<SvgAnimationPlayer document={animation} timelineOptions={{ iterations: 'infinite' }} disableActionTriggers playerRef={playerRef} />

// The file's triggers, with the timing corrected
<SvgAnimationPlayer document={animation} timelineOptions={{ outTime: 2000, playbackSpeed: 2 }} />

// These triggers instead of the file's, and a smooth retreat on hover-out (a hover-in on the way back turns it around)
<SvgAnimationPlayer document={animation} actionTriggers={{ 'playback.play': 'hoverIn', 'playback.stop': 'hoverOut' }}
  actions={{ 'playback.stop': 'animateToStart' }} />
```

There is no delete in `timelineOptions`: a key you leave out keeps the file's value. To get a default back, set it:

```tsx
<SvgAnimationPlayer document={animation} timelineOptions={{ delay: 0 }} />
```

`actions` works the other way: it is the whole block, so a file that saves `actions: { outOfView: 'continue' }`
mounted with `actions={{ 'playback.stop': 'animateToStart' }}` pauses out of view again — `outOfView` reads its
default. Write every setting you want kept.

`actionTriggers` and `actions` are not keys of `timelineOptions` — only the `actionTriggers` prop carries
triggers and only `actions` the action settings, so every key is reachable exactly one way. The out-of-view
behavior goes in `actions` (`actions={{ outOfView: 'continue' }}`); the gate
numbers `inViewThreshold` and `inViewDebounce` are timeline keys and go in `timelineOptions`
([the visibility gate](./playback-and-triggers.md#whether-it-may-run--the-visibility-gate)).

**To repeat the whole animation**, pass `timelineOptions={{ iterations: 'infinite' }}` — there is no
`loop` prop. A `loop` inside a file means something narrower: it repeats part of one property's
keyframes ([per-property loops](../format/README.md#per-property-loops)).

Full merge rules — including what happens when the override changes the kind of timeline — are
in [Playback & triggers → How the merge works](./playback-and-triggers.md#how-the-merge-works).

## Props

Only `document` is required; everything else overrides what the document already says. React renders
the SVG; the player drives its attributes.

<!-- px-check signature pkg=react -->
```typescript
const SvgAnimationPlayer: FC<SvgAnimationPlayerProps>;

interface SvgAnimationPlayerProps {
    document: PxDocumentJson;             // the animation document (a .json import passes as-is); inline only, no URL form yet
    className?: string;                   // added to the root <svg>
    style?: CSSProperties;                // set on the root <svg>

    // Playback override — see Playback overrides above:
    //   timelineOptions={{ iterations, delay, iterationDirection, playbackSpeed, inViewThreshold, … }}
    timelineOptions?: PxTimelineOptions;  // the timing — everything but `actionTriggers` and `actions` —
                                          //   MERGED over the file's; a key left out keeps the file's value
    actions?: PxActionsInput;             // the file's `actions` block, REPLACED — how a stop looks (+ the gate's
                                          //   outOfView): actions={{ 'playback.stop': 'animateToEnd' }}; a setting left
                                          //   out reads its default. What shows once finished is a timeline key —
                                          //   timelineOptions={{ whenFinished: 'jumpToStart' }}

    // Control — `PxControlProps`: ONE at a time compiles (Control modes, above); none of them = the
    // file's own triggers drive it
    playerRef?: React.RefObject<PxAnimationPlayerHandle | null>;   // never a mode: filled in every mode
    actionTriggers?: PxActionTriggersInput | null; // these triggers INSTEAD of the file's — { "playback.start",
                                          //   "playback.play", "playback.stop", "playback.pause", "playback.resume" }, each
                                          //   one event or a list of the events that list may name ('load' | 'hoverIn' |
                                          //   'hoverOut' | 'click'); playback.resume is derived when left out. null or {}: none
    disableActionTriggers?: boolean;      // manual: the file's triggers off — your code drives it through playerRef
    showAsStatic?: boolean;               // the picture as drawn: nothing plays, no scroll; playback calls on the
                                          //   handle are ignored (PX1506). Beats every other control prop
    showAtProgress?: number;              // controlled: a position counted in iterations — 1.2 = 20 % into the second
    showAtTime?: number;                  // controlled: ms inside one iteration, 0..getDuration()
    playback?: 'off' | 'on' | 'paused';    // a LEVER (`PxPlayback`): its position is held, a change presses one
                                          //   button — off → on playback.start(), on → paused playback.pause(), paused → on
                                          //   playback.resume(), → off playback.stop() — how each looks is the file's `actions`
                                          //   (and the `actions` prop); a mount with 'off' presses nothing, with
                                          //   'paused' starts the playback frozen

    // Lifecycle — no arguments
    onReady?: () => void;    // the player exists and the SVG is rendered — fires once, async;
                             //   the push twin of isReady()
    onPlaybackStart?: () => void; // a playback began — playback.start(), playback.play() from rest, a `playback.start` /
                             //   `playback.play` trigger, playback to 'on' / 'paused' from 'off', the gate starting it
                             //   again; a returning picture turned around by a play
    onPlaybackResume?: () => void; // the playback carried on after a freeze — playback.resume(), playback.play(), a
                             //   `playback.resume` trigger, playback back to 'on', or the gate when it is seen again
    onPlaybackPause?: () => void; // the playback was frozen — playback.pause(), a `playback.pause` trigger, playback="paused",
                             //   or the gate's `pause` when it left the screen
    onPlaybackFinish?: () => void; // the last pass ended by playing — the state is 'finished', whatever whenFinished then
                             //   shows; never for a stop that goes to the end (onPlaybackStop), never for an endless loop
    onDestroy?: () => void;   // the player was destroyed — unmount, or new `document` content re-created it
    onPlaybackStop?: () => void;  // the playback was stopped — a `playback.stop` trigger, playback="off", playback.stop(), the
                             //   gate's `stop`; at once, or on arrival for the stops that finish the pass first. A pause
                             //   is onPlaybackPause, the end onPlaybackFinish, a removal onDestroy; a seek reports nothing

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

Passing a different `document` (or changing `className` / `style` / the control mode) throws the
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
    <SvgCssAnimationPlayer actionTriggers={{ 'playback.play': 'hoverIn', 'playback.pause': 'hoverOut' }} style={{ width: 400, height: 400 }}>
      <AnimationSvg />
    </SvgCssAnimationPlayer>
  );
}
```

`actionTriggers` is the JSON player's block — the same lists over the same events, read by
the same rules ([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)) —
and the gate is the same gate. Unlike the JSON component, it has no file triggers to fall back on: a
script-free SVG imported as a component carries none the component could read. So with no `actionTriggers`
(or `null`, or an empty block) nothing starts the animation; to play on load, say so:
`actionTriggers={{ 'playback.start': 'load' }}`. The gate numbers go in `timelineOptions`, as on the JSON
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
    actionTriggers?: PxActionTriggersInput | null; // { "playback.start", "playback.play", "playback.stop",
                                          //   "playback.pause", "playback.resume" }, each one event or a list of the events
                                          //   that list may name ('load' | 'hoverIn' | 'hoverOut' | 'click');
                                          //   playback.resume is derived when left out. None given: nothing starts it
    timelineOptions?: { inViewThreshold?: number; inViewDebounce?: number };
                                          // the gate numbers only: 0–1 of the SVG on screen before it may run
                                          //   (default 0.5; 0 = any visible pixel), and ms it must hold first (150)
    actions?: Pick<PxActionsInput, 'outOfView'>; // only `outOfView` applies: 'pause' (default) | 'continue' |
                                          //   'stop' (replays on the next entry) while nobody can see it
    className?: string;                   // on the wrapper div
    style?: CSSProperties;                // on the wrapper div
}
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
