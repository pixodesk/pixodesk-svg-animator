# React Native — `@pixodesk/svg-animator-rn` 🧪 (in development)

[← Nuxt](./nuxt.md) · [Contents](../../README.md#documentation) · Next: [Playback settings & triggers →](./playback-and-triggers.md)

> **In development.** This player is not finished yet. The API may change without a major
> version change, and some things are unimplemented or not yet verified on real devices — see
> [Feature support](#feature-support). Use it to evaluate and prototype; expect to adjust your
> code as new versions come out.

Use this in a React Native or Expo app. Give `<SvgAnimationPlayer doc={…} />` the **same
JSON the web player uses** and it renders native SVG (`react-native-svg`), driven on the UI
thread by `react-native-reanimated`. There is no JavaScript frame loop: once a document is
compiled, the JS thread stays idle while it plays, so your app stays responsive. The props are
the same as on the [React web component](./react.md), so a component you wrote for
a React website works in the React Native app with little change — and the other way round.

## Install

One package, plus the native libraries it renders and animates with:

```bash
npm install @pixodesk/svg-animator-rn
# also needed, if your app does not have them yet:
npx expo install react-native-svg react-native-reanimated
# Reanimated 4 and later also needs its worklets runtime:
npx expo install react-native-worklets
```

Required alongside it: `react >= 18`, `react-native >= 0.76`, `react-native-svg >= 15`,
`react-native-reanimated >= 3.16`. Reanimated needs its Babel plugin, last in the list:

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'], // must be last
  };
};
```

> **Monorepo users:** `react-native-svg`, `react-native-reanimated` and `react` must resolve to
> a **single copy** each, or you get `View config getter callback for component 'RNSVGLine'
> must be a function` at runtime. This is a general React Native issue with pnpm / yarn
> workspaces, not something this package causes — you would hit it with any library that uses
> `react-native-svg`. We mention it because the error message gives no hint of the cause; the
> fix is in [Monorepo setup](#monorepo-setup).

## Quick start

The whole common case — an animation that plays on mount and loops if the document says so:

```tsx
import { View } from 'react-native';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-rn';
import animation from './animation.json';

export function Logo() {
  return (
    <View style={{ width: 200, height: 200 }}>
      <SvgAnimationPlayer doc={animation} playUsingActionTriggers />
    </View>
  );
}
```

The component has no size of its own: it fills whatever `View` you put it in. To set its size,
give that `View` a `width` and `height`, as in the example above.

Common variations. Each line is the `<SvgAnimationPlayer>` element inside a component like
`Logo` above; `isPlaying`, `scrollProgress` and `setDone` stand for your own state:

```tsx
// Play once when a screen opens, then hold the last frame (one pass; `atEnd: 'hold'` is the default)
<SvgAnimationPlayer doc={doc} playUsingActionTriggers timelineOptions={{ iterations: 1 }} />

// Loop forever regardless of what the document says
<SvgAnimationPlayer doc={doc} playUsingActionTriggers timelineOptions={{ iterations: 'infinite' }} />

// Static — first frame only
<SvgAnimationPlayer doc={doc} />

// Toggle from your own state — the `playRun` lever: 'off' · 'on' · 'paused'
<SvgAnimationPlayer doc={doc} playRun={isPlaying ? 'on' : 'off'} />

// Tie the position to a gesture / slider (no playback, just a frame)
<SvgAnimationPlayer doc={doc} showAtProgress={scrollProgress} />

// Override the document's timing
<SvgAnimationPlayer doc={doc} playUsingActionTriggers timelineOptions={{ outTime: 4000, delay: 500 }} />

// Do something when it finishes
<SvgAnimationPlayer doc={doc} playUsingActionTriggers onFinish={() => setDone(true)} />
```

TypeScript: `doc` accepts `import animation from './animation.json'` as-is (it is typed
`PxDocumentJson` — the shape a JSON import produces); enable `"resolveJsonModule"` in
`tsconfig.json`.

## Control modes

Every driver prop starts with its verb — `play…` plays, `show…` shows a frame: `playUsingActionTriggers`
(the document's triggers, or ones you pass), `playRun` (your state — `off` · `on` · `paused`),
`showAtProgress` / `showAtTime` (your position). TypeScript accepts ONE driver family at a time
(`PxControlProps` is a union of them); from JavaScript, set props from more than one group and the
highest-priority one wins — `showAtProgress` → `showAtTime` → `playRun`
→ `playUsingActionTriggers` — and the
component warns, naming both props and the winner ([PX1501](../diagnostics.md#the-props-a-component-was-given));
set none of them and the first frame renders statically. `playerRef` is filled in every mode and never changes which one you are in. React,
Vue and React Native all resolve this the same way, from one rule in core. In every mode but
`playUsingActionTriggers` the file's own triggers are switched off
([a note on the control props](./playback-and-triggers.md#a-note-on-the-components-control-props)).

Nothing plays until a prop or option names the driver (`playUsingActionTriggers`, `playRun`,
`showAt…`). A file embedded with no code around it — the `<div data-px-animation-src>` tag, the
CSS wrapper, a standalone SVG file — has no other possible driver, so there the embedding is that
naming and the file plays as saved.

**Play using action triggers** — honors the document's `actionTriggers`, or an object you pass instead of `true`
([Triggers — WHEN it plays](./playback-and-triggers.md#triggers--when-it-plays)): `load` plays
once enough of it is visible in the window; `click` is a tap — the component wraps the animation
in a `Pressable` — read by the same state rule as on the web, so `{ startRun: 'click', pauseRun: 'click' }`
taps to play and taps again to pause, and `{ startRun: 'click', stopRun: 'click' }` taps to play and taps again to stop. There is no hover on a touch screen, so `hoverIn` /
`hoverOut` never fire.

```tsx
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Intro() {
  return <SvgAnimationPlayer doc={doc} playUsingActionTriggers />;
}
```

**Declarative playback** — `playRun` names a POSITION your app holds (`'off'` · `'on'` · `'paused'`),
the same shared rule as the React and Vue components (`resolveDeclarativePlayback` in core): a change of
position presses one built-in button — `off` → `on` is `startRun()`, `on` → `paused` is `pauseRun()`,
`paused` → `on` is `resumeRun()`, anything → `off` is `stopRun()` — and how a start or a stop looks is
the file's `actions`, adjusted through the `actions` prop
([Actions](./playback-and-triggers.md#actions--how-a-start-and-a-stop-look)). `playRun="off"`
performs the **stop** action (`actions.stopRun`: `jumpToStart`, `animateToStart`, `jumpToEnd` or
`animateToEnd`) — it does not pause; freeze with `"paused"`. With the defaults a one-shot document plays
to the end on `"on"` and holds, and snaps back on `"off"`; a looping document runs on `"on"` and snaps
to rest on `"off"`, or plays on to the end of the current pass first with
`actions={{ stopRun: 'animateToEnd' }}`. A change always moves from the current frame; a mount with
`"on"` plays (a one-shot to its end), a mount with `"off"` presses nothing, a mount with `"paused"`
starts the run frozen. No pair of positions is invalid (`play` / `pause` / `playState` until 1.23).
The recipes are on the [React page](./react.md#declarative-playback--playrun).

```tsx
import { useState } from 'react';
import { Button, View } from 'react-native';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Controlled() {
  const [on, setOn] = useState(false);
  const [frozen, setFrozen] = useState(false);
  return (
    <View>
      {/* the lid: plays to the end on 'on', plays BACK on 'off'; 'paused' freezes the run */}
      <SvgAnimationPlayer doc={doc} playRun={frozen ? 'paused' : on ? 'on' : 'off'} actions={{ stopRun: 'animateToStart' }} />
      <Button title={on ? 'Back to start' : 'Play'} onPress={() => setOn(!on)} />
      <Button title={frozen ? 'Resume' : 'Freeze'} onPress={() => setFrozen(!frozen)} />
    </View>
  );
}
```

**Imperative API:**

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Imperative() {
  const playerRef = useRef<PxAnimationPlayerHandle>(null);
  return (
    <View>
      <SvgAnimationPlayer doc={doc} playerRef={playerRef} />
      <Button title="Start" onPress={() => playerRef.current?.startRun()} />
      <Button title="Pause" onPress={() => playerRef.current?.pauseRun()} />
      <Button title="Stop" onPress={() => playerRef.current?.stopRun()} />
    </View>
  );
}
```

`PxAnimationPlayerHandle`: the four buttons — `startRun()` (the configured start, `actions.startRun`;
a paused run unfreezes), `stopRun()` (the configured stop, `actions.stopRun`), `pauseRun()`, `resumeRun()`
— and the aliases `play()` (paused → `resumeRun()`, otherwise `startRun()`) and `pause()`;
`jumpToStart()` (to the rest pose now, unconditionally — reports nothing), `jumpToEnd()` (the end pose,
no motion — advanced), `runOnce()` (ONE fresh pass from the start, whatever `iterations` say — the
"plays once on click" verb), `isPlaying()`, `isRunActive()`, `getRunState()` (`off` · `playing` ·
`paused` · `finished` · `returning` · `destroyed`),
`getPlaybackSpeed()` / `setPlaybackSpeed(speed)` (negative = reverse; `0` is rejected with a warning —
use `pauseRun()`), `getPlaybackDuration()` / `setPlaybackDuration(ms)` (one pass in playback ms; the setter
sets the speed), `getTotalPlaybackDuration()`, `getCurrentPlaybackTime()`, `getTotalPlaybackTime()`,
`getDuration()`, `getCurrentTime()`, `setCurrentTime(ms)`, `getCurrentProgress()`,
`setCurrentProgress(p)`, `getCurrentIteration()`, `getTotalDuration()`, `getTotalTime()`,
`setTotalTime(ms)`, `getTotalProgress()` — jumping to a time while playing continues from there. The buttons take no
arguments: how a start or a stop looks is the file's `actions`, the same as on the web. The full
signature is on the [React page](./react.md#imperative-api-playerref).

One time contract, the same as the web players: `getCurrentTime()` is the frame on screen inside
the current iteration, `0..getDuration()` (until 1.21 the web counted run ms here and React Native
iteration ms, so a slider behaved differently per platform); the `total…` names count the whole
run — `getTotalTime()` / `getTotalDuration()` for a slider that must not wrap on a finite file,
`null` as the maximum when `iterations` is `'infinite'`; the `playback…` family is playback time —
model time ÷ the speed ([Two clocks](./playback-and-triggers.md#two-clocks)).

**Controlled time:**

```tsx
import { useState } from 'react';
import { View } from 'react-native';
import Slider from '@react-native-community/slider';   // any slider works — this one is `npm install @react-native-community/slider`
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Scrubber() {
  const [time, setTime] = useState(0);
  return (
    <View>
      <SvgAnimationPlayer doc={doc} showAtTime={time} />
      <Slider minimumValue={0} maximumValue={2000} value={time} onValueChange={setTime} />
    </View>
  );
}
```

## Props

Only `doc` is required. The file already carries the timing and the triggers you set in the
editor; every other prop is optional and, when passed, adjusts the file's value for this one
component.

Works like the React component, drawn with `react-native-svg` and animated with `reanimated`:
the document's effects are expanded once, its animated values are worked out in advance for
every element, and playback runs on the UI thread. No CSS-flavor component, no
`className` / `style`, and a `fallback` element instead of a DOM.

<!-- px-check signature pkg=rn -->
```typescript
// The component — a plain function, also the default export.
function SvgAnimationPlayer(props: SvgAnimationPlayerProps): ReactElement | null;

interface SvgAnimationPlayerProps {
    doc: PxDocumentJson;                  // required — the animation; a .json import passes as-is

    // Playback override — the same objects as React (Playback overrides below), deep-merged over
    // the file; a key left out keeps the file's value. `engine` and `frameRate` inside it are
    // accepted but ignored: React Native always plays natively.
    timelineOptions?: PxTimelineOptions;  // the timing: the `timeline` block minus `actionTriggers` and `actions`
    actions?: PxActionsOptions;           // how a start and a stop look (+ the gate's outOfView): { stopRun: 'animateToStart' };
                                          //   the end of the pass is a timeline key — timelineOptions={{ atEnd: 'jumpToStart' }}

    // Control — `PxControlProps`: ONE driver family at a time compiles (Control modes above)
    playUsingActionTriggers?: boolean | PxActionTriggersInput; // true: the document's triggers; an object: these triggers instead —
                                          //   { startRun, stopRun, pauseRun, resumeRun } (`PxActionTriggersInput`). `click` = a tap;
                                          //   `hoverIn` / `hoverOut` never fire (no hover on a touch screen);
                                          //   visibility is measured every 200 ms
    playRun?: 'off' | 'on' | 'paused';    // a LEVER (`PxPlayRun`): a change of position presses one button — off → on
                                          //   startRun(), on → paused pauseRun(), paused → on resumeRun(), → off stopRun();
                                          //   how each looks is the file's `actions`; a mount with 'off' presses nothing
    showAtProgress?: number;              // 0–1 of ONE iteration
    showAtTime?: number;                  // ms inside one iteration, 0..getDuration()

    playerRef?: React.RefObject<PxAnimationPlayerHandle | null>;   // the same methods as on the web components, and the
                                          //   same meanings: iteration time, `total…` for the run, the `playback…`
                                          //   family in playback time, clamped seeks, speed 0 rejected

    // Lifecycle — no arguments; the same meanings as on the web
    onReady?: () => void;                 // once per compiled document, asynchronously
    onRunStart?: () => void; onRunStop?: () => void; onRunPause?: () => void; onRunResume?: () => void;
                                          // the run events — told when the button's act is performed (the gate's hold reports nothing)
    onFinish?: () => void;
    onDestroy?: () => void;                // unmount, or a `doc` swap

    // Diagnostics — the shared channel (the API at a glance): onError means THIS INSTANCE WILL NOT
    // PLAY — the compile or the render threw; d.error is the Error, and d.data carries the
    // component stack when the error boundary caught it — and `fallback` is what shows instead.
    // Only JavaScript failures reach it; a crash inside the native renderer does not.
    onWarning?: (d: PxDiagnostic) => void;
    onError?: (d: PxDiagnostic) => void;
    suppressWarnings?: boolean; suppressErrors?: boolean;
    fallback?: (error: Error) => ReactElement | null;   // rendered in place of a failed animation
}
```

The package exports the component (`SvgAnimationPlayer`, also its default export), its props
(`SvgAnimationPlayerProps`), its handle (`PxAnimationPlayerHandle`) and the document type
`PxDocument` (a JSON import — [TypeScript](./installation.md#typescript)); nothing else.

With none of `playUsingActionTriggers` / `playRun` / `showAtProgress` / `showAtTime` set, the first
frame renders statically.

### Playback overrides

The same document can play differently on each screen. Three props, the same on every player
([Overriding from a player](./playback-and-triggers.md#overriding-from-a-player)), and the
document you passed is never modified: `timelineOptions` carries corrections to the file's
`animator.timeline` block minus its `actionTriggers` and `actions` — an object shaped like the file;
`actions` carries corrections to the file's `timeline.actions`;
`playUsingActionTriggers` is `true` for the file's triggers, or the whole `actionTriggers` block to use instead.

Merge or replace — the one rule for the three:

<!-- px-check off merge versus replace, prose -->
| | |
|---|---|
| `timelineOptions`, `actions` | **recursive partials** — objects merge key by key, values replace, a key left out changes nothing |
| a `playUsingActionTriggers` object | **replaces** the file's `actionTriggers` as a whole — its lists belong together |

```tsx
// The file loops twice and plays on load; here it loops forever and finishes the beat before stopping.
<SvgAnimationPlayer
  doc={doc}
  playUsingActionTriggers
  timelineOptions={{ iterations: 'infinite' }}
  actions={{ stopRun: 'animateToEnd' }}
/>

// These triggers instead of the file's: a tap plays, a second tap pauses
<SvgAnimationPlayer doc={doc} playUsingActionTriggers={{ startRun: 'click', pauseRun: 'click' }} />
```

There is no delete: a key you leave out keeps the file's value. To get a default back, set it
(`timelineOptions={{ delay: 0 }}`).

**To repeat the whole animation**, pass `timelineOptions={{ iterations: 'infinite' }}` — there is no
`loop` prop. A `loop` inside a file means something narrower: it repeats part of one property's
keyframes ([per-property loops](../format/README.md#per-property-loops)).

How each move looks goes in `actions` — the start, stop and out-of-view behaviors. Every other playback setting — `atEnd` included — is a timeline key and goes inside
`timelineOptions` — `iterationDirection` and the gate numbers `inViewThreshold` and `inViewDebounce`; the
triggers are `playUsingActionTriggers`'s alone. Full merge rules are in
[Playback & triggers → How the merge works](./playback-and-triggers.md#how-the-merge-works).

### Differences from the React package

<!-- px-check off differences from React, prose -->
| Prop | Why it differs |
|---|---|
| `timeline.engine` | accepted — in the file, or inside `timelineOptions` — but ignored — there is no Web Animations API on React Native; playback is always native-driven |
| `timeline.frameRate` | ignored — the screen's own refresh rate is used. On React Native the player does not compute values frame by frame; when the document loads it works out the animated values in advance, as a list of snapshots — 60 per second of animation — and while playing, each screen refresh shows the nearest one. The closest thing to a frame rate is how many snapshots per second are prepared, which the player fixes at 60 |
| `hoverIn` / `hoverOut` | have no touch equivalent, so they never fire. `load` and `click` (a tap) work as they do on the web, from the file or from `playUsingActionTriggers` |
| `className` / `style` | not accepted — you cannot style the component itself. It fills whatever `View` you put it in, so to set its size, give that `View` a `width` and `height` (see [Quick start](#quick-start)). Styling *inside* the document — `style` on an element in the JSON — is supported |

### Failure handling

The component never throws errors for a bad document: compilation and rendering run in `try/catch`
and behind an error boundary, so a failure reaches `onError` — the shared diagnostic, exactly as
on the web: **this instance will not play** — and shows `fallback` while the rest of the screen
keeps working. It is reported once, as an error; nothing else is logged for it.

```tsx
import { Text } from 'react-native';
import { SvgAnimationPlayer } from '@pixodesk/svg-animator-rn';
import doc from './animation.json';

export function Safe() {
  return (
    <SvgAnimationPlayer
      doc={doc}
      playUsingActionTriggers
      onError={d => console.warn('animation failed:', d.message)}
      fallback={() => <Text>could not play this animation</Text>}
    />
  );
}
```

A crash inside `react-native-svg`'s **native** renderer never reaches JavaScript and cannot be
caught — see the limitations below.

## How playback works

The work is split into two stages: a heavier one done once, when the document loads, and a
very light one repeated on every screen refresh while it plays.

1. **Once, when the document loads.** The shared core (the same code the web player uses)
   first turns everything special in the document into plain SVG elements and attributes —
   effects, property loops, motion along a path, animated `<use>` copies. Then, for every
   animated property, it works out the value at each moment of the animation in advance and
   stores them as a list of snapshots, 60 per second of animation. It uses the same value
   calculation as the web player's frame loop, so the animation looks exactly the same as on
   the web.
2. **On every screen refresh while playing.** A single number — how far along the animation
   is — is advanced by `react-native-reanimated` directly on the UI thread, the part of the app
   that draws the screen. Each animated element runs a tiny piece of code there that picks the
   snapshot for the current moment and applies it. No JavaScript in your app runs per frame,
   which is why playback stays smooth even while your app is busy.

Anything `react-native-svg` cannot draw directly — motion along a path, text on a path — is
converted into plain positions and values in stage 1, so stage 2 never has to deal with it.

## Feature support

Every ✅ row was verified by running a document through the real pipeline and checking that
the element maps to a `react-native-svg` component and that its animated properties change
over time. The code is unit-tested and was run end-to-end through `react-native-web`; ⚠️
marks what works there but has not yet been checked on a real iOS / Android device; ❌ is
not supported.

### Elements

<!-- px-check off support matrix, prose -->
| Element | Supported | Notes |
|---|---|---|
| `svg`, `g`, `defs` | ✅ | |
| `rect`, `circle`, `ellipse`, `line`, `path`, `polygon`, `polyline` | ✅ | |
| `text`, `tspan`, `textPath` | ✅ | |
| `image` | ✅ | `data:` URIs only — the player has a built-in safety check that removes remote image URLs |
| `use`, `symbol` | ✅ | an animated target is copied into a real clone before rendering |
| `linearGradient`, `radialGradient`, `stop` | ✅ | |
| `mask`, `clipPath` | ✅ | |
| `pattern`, `marker` | ⚠️ | static use verified; complex cases not yet checked on a device |
| `filter` and all 22 `fe*` primitives | ⚠️ | compiles and renders; visual result not yet checked on a device |
| `foreignObject`, `script` | ❌ | removed |

### Animatable attributes

<!-- px-check off support matrix, prose -->
| Attribute | Supported | Notes |
|---|---|---|
| `opacity`, `fillOpacity`, `strokeOpacity` | ✅ | |
| `fill`, `stroke`, `stopColor` | ✅ | colors blend through RGBA |
| `strokeWidth`, `strokeDashoffset` | ✅ | |
| `strokeDasharray` | ⚠️ | animates; the native value bridge not yet checked on a device |
| `x`, `y`, `width`, `height`, `cx`, `cy`, `r`, `rx`, `ry` | ✅ | |
| `d` (path morphing) | ✅ | keyframes must share the same command structure |
| `transform` (record keyframes holding the parts: translate, rotate, scale, …) | ✅ | per-key `translate` / `rotate` / `scale` channels are deprecated — still read, warned as [PX1107](../diagnostics.md) |
| gradient stop `offset`, `stopColor` | ✅ | |
| `fontSize` and any other numeric attribute | ✅ | |
| filter primitive attributes | ⚠️ | compiles; on-device rendering not yet checked |

### Effects

<!-- px-check schema PxEffectsSchema -->
| Effect | Supported | Notes |
|---|---|---|
| `transformBy` | ✅ | |
| `repeater` | ✅ | |
| `maskedBy` | ✅ | |
| `clipPath` | ✅ | |
| `strokeTrim` | ✅ | incl. `offset` and `subPaths: 'combined'` |
| `clone` + `retime` | ✅ | incl. the `inTime` / `outTime` window |
| `fillGradient` / `strokeGradient` | ✅ | animated stops **and** geometry | <!-- px names=fillGradient,strokeGradient -->
| Animated `gradientTransform` | ❌ | not implemented in the shared core, so unavailable on every player; a static `gradientTransform` works | <!-- px skip -->
| `textPath` | ✅ | incl. animated `startOffset` |
| `text.useGlyphs` | ✅ | |

### Motion, timing, references

<!-- px-check off support matrix, prose -->
| Feature | Supported | Notes |
|---|---|---|
| Motion along a path, `autoOrient` | ✅ | positions worked out in advance by the core |
| Text along a path | ✅ | two ways: native `textPath`, or one motion path per letter. The example app uses the latter — animating native `startOffset` stutters in `react-native-svg` |
| Text on a *closed* path with a non-zero `startOffset` | ⚠️ | worked around, not fixed: `react-native-svg`'s own text-on-path layout crashes on this (iOS), so the player gives such text its own *open* copy of the path; text that would wrap past the end of the loop is cut off instead. The web player is unaffected |
| Per-property `loop`, incl. ping-pong | ✅ | |
| Cubic-bezier and named easings | ✅ | |
| `definitions.animations` / `easings` / `fonts` | ✅ | |
| `node.style` (inline record) | ✅ | |

### Playback and triggers

<!-- px-check off support matrix, prose -->
| Feature | Supported | Notes |
|---|---|---|
| `inTime` / `outTime` / `playbackSpeed`, `delay`, `iterations` (incl. infinite) | ✅ | |
| `iterationDirection` — all four values | ✅ | through `timeline` — see [Playback overrides](#playback-overrides) |
| `actions`: the start and stop presets, `atEnd` | ✅ | `animateToStart` plays back natively; the run clock behind `getTotalTime()` / `getCurrentTime()` is approximate while it plays back |
| startRun / stopRun / pauseRun / resumeRun / jumpToStart / jumpToEnd | ✅ | |
| Jumping to any time, also while playing | ✅ | |
| Playback speed (`setPlaybackSpeed`): faster, slower, reverse | ✅ | |
| Trigger events `load` and `click` (a tap), in the lists that may name them | ✅ | |
| The gate: `actions.outOfView`, `inViewThreshold`, `inViewDebounce` | ✅ | visibility measured against the window every 200 ms — React Native has no `IntersectionObserver` |
| Trigger events `hoverIn` / `hoverOut` | ❌ | no touch equivalent; will not be added |
| `timeline.frameRate`, `timeline.engine` | ❌ | see [Differences from the React package](#differences-from-the-react-package) |
| Scroll-driven playback (`timeline.type: 'scroll' / 'view'`) | ❌ | |

## Monorepo setup

This section is about a general React Native problem, not one this package causes; it is
here in case you hit it. A plain Expo or React Native app with a single `node_modules` never
does. pnpm and yarn workspaces, however, can install **two physical copies** of a native
package when peer versions differ even slightly — and then the copy of `react-native-svg` the
player imports is not the one whose native views were registered, which fails at runtime with
`View config getter callback for component 'RNSVGLine' must be a function`. Two things
prevent it:

1. Keep `@types/react`, `react` and `react-native` versions aligned across every workspace
   package.
2. Force single instances in `metro.config.js`:

```js
const SINGLETONS = ['react', 'react-dom', 'react-native', 'react-native-svg',
                    'react-native-reanimated', 'react-native-worklets'];

const base = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETONS.some(n => moduleName === n || moduleName.startsWith(n + '/'))) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'index.js') },
      moduleName, platform);
  }
  return (base ?? context.resolveRequest)(context, moduleName, platform);
};
```

A complete config is in
[`examples/react-native-preview-player/metro.config.js`](../../examples/react-native-preview-player/metro.config.js).

## Example apps

Two Expo apps in the repository show the player running on a device. Each is one command from
the repository root:

```bash
pnpm example:rn            # preview player with several animations and controls
pnpm example:rn:web        # quickest look — runs via react-native-web
pnpm example:rn:explorer   # feature explorer
```

See [`examples/react-native-preview-player`](../../examples/react-native-preview-player).

[← Nuxt](./nuxt.md) · [Contents](../../README.md#documentation) · Next: [Playback settings & triggers →](./playback-and-triggers.md)
