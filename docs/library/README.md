# Library documentation — the players

How to install and use the player libraries that render and control **JSON** animations:
plain HTML, React, Vue and React Native, plus the playback settings and triggers they all
share. (Playing a **pre-rendered SVG** needs no library — see
[Pre-rendered SVG documentation](https://pixodesk.com/docs/svga/prerendered-svg).)

## Contents

1. [Get started with the player library](./get-started.md) — the shortest path, end to end: save a JSON, put it next to your component, install one package, render it; a complete example project per stack
2. [Installing the players](./installation.md) — npm packages, the UMD build for pages without a bundler, TypeScript
3. [Web player (`@pixodesk/svg-animator-web`)](./web-player.md) — `createSvgAnimationPlayer`, the playback API, callbacks, triggers, the API reference
4. [React (`@pixodesk/svg-animator-react`)](./react.md) — the player component, its props, control modes
5. [Next.js](./nextjs.md) — the React component in a Next.js app
6. [Vue (`@pixodesk/svg-animator-vue`)](./vue.md) — the player component, props, events
7. [Nuxt](./nuxt.md) — the Vue component in a Nuxt app
8. [React Native (`@pixodesk/svg-animator-rn`)](./react-native.md) 🧪 — *in development*; install, props, feature support, limitations
9. [Playback settings & triggers](./playback-and-triggers.md) — the `animator` configuration, and overriding it from props or the player API
10. [Minification & property mangling](./minification.md) — safe by default; what to do if your build renames object keys
11. [Troubleshooting & FAQ](./troubleshooting.md) — nothing plays, React/TypeScript/React Native gotchas, playback behavior

Below is what every player has in common — the same props under the same names, the same
callbacks, the same rule for who controls playback, the same meaning of time — so what you learn
on one player works on all of them.
Each guide then spells out its own package in signature form under **API reference**; the core
library's is on [the format page](../format/README.md#core-library--pixodesksvg-animator-core).

## The API at a glance

Which package: **web** for plain HTML/JS · **react** / **vue** for those frameworks · **rn** for
React Native 🧪 · **core** only to inspect or transform documents yourself. A pre-rendered `.svg`
file needs no package at all.

<!-- px-check off quick-start jobs, prose -->
| Job | Call |
|---|---|
| Play a JSON file in a page | `createSvgAnimationPlayer({ src, container })` (web) |
| Play it in React / Vue | `<SvgAnimationPlayer :doc … />` |
| Play it in React Native | `<SvgAnimationPlayer doc={…} />` (rn) |
| Check a generated document before shipping it | `validateDocument(doc)` |
| Show the same JSON animation twice on one page | nothing extra — every player gives each render fresh ids (`generateNewIds(doc)` is for a renderer of your own) |
| Feed a renderer of your own | `materializeAllInTree(doc, 'native')` (core) |
| See or drive every player on the page — 🧪 experimental | [`getAllSvgAnimationPlayers()` / `onSvgAnimationPlayersChange()`](./web-player.md#every-player-on-the-page-experimental) (web) |

Every export is marked by audience, in the guides and in the code itself — the mark mirrors the
release tag on the declaration, which is what your IDE shows on hover, and the build fails when
the two disagree:

<!-- px-check off the ●/○/▪ legend -->
| | Meaning |
|---|---|
| **●** | **User-facing** — the API for playing an animation in your page or app. Documented in full. |
| **○** | **Advanced** — document tooling: inspect, transform or validate a document outside a player. Stable, rarely needed. |
| **▪** | **Internal** — exported so the Pixodesk editor and the other player packages can share the player's own code. Not meant for your code; may change without notice. |

### Props and options across players

Every way to create a player, side by side, so a prop added or renamed in one place can be
checked against the others. The columns are the web player's `createSvgAnimationPlayer` (**Web**), the
HTML tag read by `createSvgAnimationPlayersFromPage` (**Tag**), the pre-rendered player's `createSvgAnimationPlayer`
(**Pre**), **React**, **Vue** and React Native (**RN**).

A cell is **✓** when that player takes the name as it is, **—** when it does not have it, and
a number when it differs — the note with that number, under the table, says how.

<!-- px-check matrix web=web:PxAnimationPlayerOptions tag=~ prerendered=web:PxPrerenderedAnimationPlayerOptions react=react:SvgAnimationPlayerProps vue=vue:SvgAnimationPlayer rn=rn:SvgAnimationPlayerProps -->
| Name | Web | Tag | Pre | React | Vue | RN |
|---|---|---|---|---|---|---|
| **Document** | | | | | | |
| `src` | ✓ | 1 | — | — | — | — |
| `doc` | ✓ | — | 2 | ✓ | ✓ | ✓ |
| `container` | ✓ | 3 | — | — | — | — |
| **Playback override** | | | | | | |
| `timelineOptions` | ✓ | — | — | ✓ | ✓ | 4 |
| `actions` | ✓ | — | — | ✓ | ✓ | ✓ |
| **Play using action triggers** | | | | | | |
| `playUsingActionTriggers` | ✓ | 10 | 11 | ✓ | ✓ | 5 |
| **Declarative control** | | | | | | |
| `playback` | — | — | — | ✓ | ✓ | ✓ |
| `showAtProgress` | — | — | — | ✓ | ✓ | ✓ |
| `showAtTime` | — | — | — | ✓ | ✓ | ✓ |
| **Imperative control** | | | | | | |
| `playerRef` | 6 | 7 | 6 | ✓ | 8 | ✓ | <!-- px web=~ tag=~ prerendered=~ vue=~ -->
| **Callbacks** | | | | | | |
| `onPlaybackStart` | ✓ | — | ✓ | ✓ | `@playbackStart` | ✓ |
| `onPlaybackResume` | ✓ | — | ✓ | ✓ | `@playbackResume` | ✓ |
| `onPlaybackPause` | ✓ | — | ✓ | ✓ | `@playbackPause` | ✓ |
| `onFinish` | ✓ | — | ✓ | ✓ | `@finish` | ✓ |
| `onReady` | ✓ | — | ✓ | ✓ | `@ready` | ✓ |
| `onDestroy` | ✓ | — | ✓ | ✓ | `@destroy` | ✓ |
| `onPlaybackStop` | ✓ | — | ✓ | ✓ | `@playbackStop` | ✓ |
| `onError` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `onWarning` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `suppressWarnings` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `suppressErrors` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `fallback` | — | — | — | — | — | ✓ |
| **Styling** | | | | | | |
| `className` | — | — | — | ✓ | 9 | — | <!-- px vue=~ -->
| `style` | — | — | — | ✓ | ✓ | — | <!-- px vue=~ -->

**Notes**

1. The tag takes the URL as the `data-px-animation-src` attribute.
2. Required. Only `animator.definitions` and `animator.bindings` are needed: the SVG itself is
   already in the page.
3. The tag is the container: the player renders into the element that carries the attribute.
4. React Native ignores `engine` and `frameRate` inside `timelineOptions`.
5. `true`, or the whole `actionTriggers` block to use instead of the file's (a `PxActionTriggers`); React Native ignores
   `hoverIn` / `hoverOut`, which have no touch equivalent.
6. The handle is what `createSvgAnimationPlayer` returns, a `PxAnimationPlayerApi`.
7. `createSvgAnimationPlayersFromPage` returns the handles it created; `getSvgAnimationPlayer(element)` finds one later.
8. The handle is the component's template ref, a `PxAnimationPlayerHandle`.
9. Written `class`; like `style`, it falls through to the root `<svg>`.
10. The tag plays on the file's own triggers — embedding a finished file IS choosing its behaviour. The call that reads
    the tags takes the option for every player it creates: `createSvgAnimationPlayersFromPage({ playUsingActionTriggers })`
    — `true` (or left out) each file's own triggers, a block instead of them, `false` to leave the driving to your code.
11. `true` only: a pre-rendered file plays on its own triggers, or on the returned api.

What some of the names mean:

- **`src`** is a URL to fetch the document from. The components take the document itself on
  purpose: in a component tree the document is data your app already has (imported, or fetched
  with your own loader), and fetching inside the component would add a second loading and error
  state to manage.
- **`doc`** is the document itself, under the same name on every player. On the web the name
  is also part of the export format: every SVG + JS file the editor exports calls
  `createSvgAnimationPlayer({"doc": …})` (`PX_ANIMATOR_DOC_KEY`), so it is never renamed by a minifier.
- **`container`** left out means: animate an SVG that is already in the page.
- **`timelineOptions`** merges corrections over the file's timing block — `{ iterations: 'infinite' }`,
  `{ playbackSpeed: 2 }` — never a replacement; a key left out keeps the file's value (to get a default,
  set it). See [Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
- **`actions`** merges over the file's `timeline.actions` — how a start and a stop look, and the gate's
  out-of-view: `{ 'playback.stop': 'animateToStart' }`. The same rules as `timelineOptions`. What the end of the
  pass does is a timeline key, `atEnd`, so it travels in `timelineOptions`.
- **`playUsingActionTriggers`** means "play the way the document says". The HTML tag always works this way;
  the web player takes it as an option (`createSvgAnimationPlayer({ …, playUsingActionTriggers: true })`) — without
  it, nothing starts and the returned api drives playback. An **object** instead of `true` is the whole
  `actionTriggers` block to use in place of the file's (`{ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut' }`).
- **`playback`** is a lever: its position is held — `'off'` (no playback), `'on'` (a playback), `'paused'` (the playback,
  frozen) — and a change of position presses one built-in button: `off` → `on` is `playback.start`, `on` → `paused`
  is `playback.pause`, `paused` → `on` is `playback.resume`, anything → `off` is `playback.stop`, each done the way the file's
  `actions` say ([Actions](./playback-and-triggers.md#actions--how-a-start-and-a-stop-look)).
  `playback="off"` performs the stop action (`actions["playback.stop"]`: `jumpToStart`, `animateToStart`,
  `jumpToEnd` or `animateToEnd`) — it does not pause; a mount with `"off"` presses nothing, a mount with
  `"paused"` starts the playback frozen. No pair of positions is invalid; the positions are `PxPlayback`.
- **`showAtProgress`** shows the frame at a point between 0 and 1 of ONE iteration; **`showAtTime`**
  shows the frame at that many ms inside it, `0` to `playback.getDuration()`.
- **`playerRef`** is the handle for calling `playback.start()`, `playback.pause()`, `playback.stop()` and the rest from your code.
  Having it never changes how the component is controlled.
- **`onDestroy`** fires when the player is thrown away: `destroy()`, an unmount, or a new `doc`.
  **`onPlaybackStop`** fires when the built-in stop is performed — at once, or on arrival for `animateToEnd` —
  not on a pause (`onPlaybackPause`), the end (`onFinish`), a removal (`onDestroy`) or `playback.jumpToStart()` (which reports nothing).
  **`onPlaybackStart`** and **`onPlaybackResume`** are the other two buttons' events (`onPlay` fired for both until 1.23);
  the gate's off-screen hold reports nothing.
- **`onError`** means this player will not play: the document failed to load, parse or build,
  or drawing it threw. Nothing is rendered, `isReady()` is `false`, and React Native shows
  `fallback` instead. Without a handler the message goes to `console.error`.
- **`onWarning`** means it plays, but something was ignored, simplified or misspelled. Without a
  handler the message goes to `console.warn`.
- **`suppressWarnings`** / **`suppressErrors`** turn off those console messages, for an app that already
  knows about them. A handler you passed still gets called.
- **`className`** and **`style`** style the root `<svg>`. On the web, style the container instead.

The pre-rendered SVG + CSS wrappers toggle class names instead of creating a player:

<!-- px-check matrix react=react:SvgCssAnimationPlayer vue=vue:SvgCssAnimationPlayer -->
| Name | React `SvgCssAnimationPlayer` | Vue `SvgCssAnimationPlayer` |
|---|---|---|
| the SVG | `children` | default slot | <!-- px name=children vue=~ -->
| `playUsingActionTriggers` | ✓ the block only (no `true`); absent lists nothing — `{ 'playback.start': 'load' }` plays on load | ✓ same |
| `timelineOptions` | ✓ the gate numbers only: `inViewThreshold` (default `0.5`), `inViewDebounce` (default `150` ms) | ✓ same |
| `actions` | ✓ `outOfView` only; default `'pause'` | ✓ same |
| `className` | ✓ on the wrapper div | `class`, on the wrapper div | <!-- px vue=~ -->
| `style` | ✓ on the wrapper div | ✓ on the wrapper div | <!-- px vue=~ -->

The props are the JSON component's names, narrowed where a class toggle can do less (React's
`SvgCssAnimationPlayerProps` is derived from `SvgAnimationPlayerProps`, so the two cannot drift):

- `playUsingActionTriggers` is the JSON player's block — `playback.start`, `playback.stop`, `playback.pause`, `playback.resume` (derived
  when left out), each one event or a list of them, read by the same rules
  ([Triggers](./playback-and-triggers.md#triggers--when-it-plays)): `'playback.pause': 'hoverOut'` pauses,
  `'playback.stop': 'hoverOut'` stops. The block only — a script-free SVG carries no triggers the wrapper could
  read, so there is no `true`. An **empty** block — or no prop at all — does nothing here: a wrapper
  has no `playback.start()` to call, so a wrapper that should play on load says
  `playUsingActionTriggers={{ 'playback.start': 'load' }}`.
- `actions` takes only `outOfView` (`{ outOfView: 'pause' }`): an animation nobody can
  see does not run, whatever started it.
- Accepted limits of a class toggle: the start is always `continue` and the stop always
  `jumpToStart` — a class cannot jump keyframes to their start or end, or play them backwards — and
  `whenIdle` and `atEnd` are the file's own CSS. None of them is a prop here.
- `timelineOptions` takes the two gate numbers: `inViewThreshold` is how much of the SVG (0 to 1)
  must be on screen before it may run; `inViewDebounce` is how long it must stay that way first, so
  scrolling straight past starts nothing. The defaults are the same as the JSON player's.

### Control modes — one rule

A component can be controlled in several ways, and only one of them can be in charge. In React and
React Native, TypeScript accepts one driver family at a time — `PxControlProps` is a union of `showAtProgress` · `showAtTime` ·
`playback` · `playUsingActionTriggers`. If you set props from more than one group
anyway (from JavaScript), the group highest in this table wins, and the player warns you
once, naming the props and the winner. React, Vue and React Native all use the same rule from
core (`resolveControlMode`), so they always pick the same winner:

<!-- px-check off the mode-priority rule, prose -->
| Priority | Mode | Chosen when | The document's triggers |
|---|---|---|---|
| 1 | controlled time | `showAtProgress` or `showAtTime` (`showAtProgress` wins over `showAtTime`) | switched off; the player seeks and holds |
| 2 | playback | `playback` | switched off; `'on'` presses `playback.start`, `'off'` performs the stop action (`actions["playback.stop"]`) — it does not pause — and `'paused'` freezes the playback |
| 3 | playUsingActionTriggers | `playUsingActionTriggers` | used, after the override |
| 4 | static | none of the above | switched off; the first frame renders and nothing plays |

`playerRef` is not in the table: the handle is filled in **every** mode and never changes it, so
`<SvgAnimationPlayer doc={doc} playUsingActionTriggers playerRef={playerRef} />` autoplays and gives you the handle.
`playUsingActionTriggers: false` is not a control prop and claims nothing; `playback: 'off'` is one, and holds.
The HTML tag is always in playUsingActionTriggers mode; the web player's `playUsingActionTriggers: true` option is the same mode.

### Callbacks and diagnostics — one shape

The callbacks have the same names on every player: you pass them as options on the web
(`createSvgAnimationPlayer({ onFinish })`) and as props in React and React Native. Vue takes the playback
ones as events (`@playbackStart`) but `onWarning` and `onError` as props — with an event, Vue would always
count the message as handled, and nobody would see it in the console. All of them are defined
once in core, as `PxAnimationPlayerCallbacks`:

<!-- px-check signature pkg=core -->
```typescript
// Every lifecycle callback is optional and takes no arguments. The types build on each other:
// `PxDiagnosticsConfig` (the diagnostics fields) → `PxEngineCallbacks` (+ the lifecycle; what an
// engine such as `createAdapterSvgAnimationPlayer` takes — its raw `onPlay` / `onPause` are the clock on / off)
// → `PxAnimationPlayerCallbacks` (the four buttons' events instead; what every player takes).
interface PxAnimationPlayerCallbacks {
    onReady?: () => void;   // the player exists and the SVG is rendered — once, async;
                            //   the push twin of isReady()
    onPlaybackStart?: () => void;  // a playback began — playback.start(), a `playback.start` trigger, playback to 'on' / 'paused'
                              //   from 'off', playback.playOnce(); a returning playback turned around
    onPlaybackResume?: () => void; // the playback carried on after a freeze — playback.resume(), a `playback.resume` trigger
    onPlaybackPause?: () => void;  // the playback was frozen — playback.pause(), a `playback.pause` trigger, playback="paused";
                              //   the gate's off-screen hold is NOT this (it reports nothing)
    onFinish?: () => void;  // reached the end, or playback.jumpToEnd() was called — not when stopped early;
                            //   a loop stopped at a pass end reports onPlaybackStop only
    onDestroy?: () => void;  // destroy() was called, the component unmounted, or a new `doc` arrived
    onPlaybackStop?: () => void;   // the playback was stopped — at once, or on arrival for
                              //   `animateToEnd`; playback.jumpToStart() reports nothing (like a seek)

    // Diagnostics — two severities, one meaning each, on every player. Neither ever throws at
    // the caller. Give a handler and it takes over from the console; give none and the console
    // is the fallback, so nothing is lost by default.
    onWarning?: (d: PxDiagnostic) => void;  // IT PLAYS, but something was ignored, degraded or
                                         //   misspelled; else console.warn
    onError?: (d: PxDiagnostic) => void; // THIS INSTANCE WILL NOT PLAY: failed to load, parse or
                                         //   build, or the render threw — nothing rendered,
                                         //   isReady() false, a component shows its fallback;
                                         //   d.error is the Error; else console.error
    suppressWarnings?: boolean;          // switch the console.warn fallback off — for a host that
                                         //   knows the player has something to say about this
                                         //   document and tolerates it. A handler you passed
                                         //   still fires: this is about the console, not you
    suppressErrors?: boolean;            // the same switch for console.error
}

// Every diagnostic says WHAT happened as a NUMBER and WHO can act on it, so a host can switch
// on the code and route it rather than just log a sentence. The words are not in the build: each
// code's description lives on the codes page, generated from the enum the players report through.
interface PxDiagnostic {
    code: PxDiagnosticCode;   // e.g. 1304 — look it up on the codes page (docs/diagnostics.md)
    kind: PxDiagnosticKind;   // 'document' | 'host' | 'platform' | 'usage' | 'internal'
    data?: ReadonlyArray<unknown>;   // the values this one had: the offending binding, the
                                     //   selector that matched nothing, the raw error
    message: string;          // 'PX1304 <link to that code on the codes page>' — the code and
                              //   where to read it, never prose and never the console prefix
    error?: Error;            // errors only
}
```

Every message comes with a `kind` that says **who can fix it**. That is a separate question from
how serious it is: a broken document is fatal, a slightly odd one still plays, but both are the
document's fault and both are fixed the same way, by fixing the file. So you get one handler per
severity (`onError`, `onWarning`) and read `kind` inside it to decide what to do:

<!-- px-check values PxDiagnosticKind pkg=core -->
| `kind` | who fixes it | examples |
|---|---|---|
| `document` | regenerate or repair the file | effects shape, unknown keys, an invalid document, no or unresolved bindings, a `scroll.subject` that is not a valid selector, a blocked SVG tag |
| `host` | fix the page or app | no root element, a selector that matched nothing, `setAttribute` finding no element, a failed fetch |
| `platform` | nothing — the player degraded | unsupported CSS attrs, `smoothing` needing the built-in driver, native scroll-timeline construction failing, `react-native-svg` prop limits |
| `usage` | fix the options or props you passed | props from more than one control mode at once, an override that could not apply, a rate of 0, `actionTriggers` on a scroll timeline, a playback call on a scroll timeline (PX1505) |
| `internal` | report it to us | could not build, compile or render the document; a render that threw |

For example: fail a CI check on `document`, ignore `platform`, and send `internal` to your error
tracker. Filtering on `kind` is one line in your handler, which is why there is no separate mute
per kind.

### Time — one contract

Every engine on every player implements the same meaning of time, written on `PxAnimationPlayerApi`
and implemented once in core, over two clocks — **model time** (content ms, as authored) and
**playback time** (model time ÷ the speed): **every plain ms is model ms inside the iteration;
`total…` counts the whole playback; the `playback…` family is playback time.**

- `playback.getCurrentTime()` / `playback.setCurrentTime()` and `playback.getCurrentProgress()` / `playback.setCurrentProgress()` are the
  frame on screen inside the **current iteration** — `0..getDuration()`, or 0–1 of it; a slider built on
  them spans one pass and wraps on a looping file, as every animation player's does. `showAtTime` /
  `showAtProgress` are the same axis. One pass is always finite, so no read has an `infinite` exception;
- `playback.getTotalTime()` / `playback.setTotalTime()` and `playback.getTotalDuration()` span the **whole playback**, every iteration
  included — `playback.getTotalDuration()` is `null` when `iterations` is `'infinite'`, the honest slider maximum,
  and `playback.getTotalProgress()` the 0–1 of the playback (`null` when endless); `playback.getCurrentIteration()` says which
  pass is on screen. "Total" means including repeats — GSAP's words exactly: `time` / `totalTime`,
  `duration` / `totalDuration`, `progress` / `totalProgress`;
- the **`playback…` family is playback time**: `playbackSpeed` (the file's key, the
  `timelineOptions` key and `playback.getSpeed()` / `playback.setSpeed()` — 1 normal, 2 double; a
  negative speed on the handle plays backwards and multiplies with `iterationDirection`),
  `playback.getDurationAtSpeed()` / `playback.setDurationAtSpeed()` (one pass; the setter sets the speed),
  `playback.getTotalDurationAtSpeed()`, `playback.getCurrentTimeAtSpeed()` and `playback.getTotalTimeAtSpeed()`. `delay` is
  ms scaled by the speed, as WAAPI's is;
- a seek **clamps** — to the pass or to the playback; a speed of `0` is **rejected everywhere**, with a
  warning — `playback.pause()` is how you stop;
- `playback.getState()` is the one state read — the playback's: `off` · `playing` · `paused` · `finished` · `returning`
  · `destroyed`; an `animateToStart` leg on its way back reads `returning` (no playback, the picture still
  moves), `playback.isActive()` is true while a playback exists; a call after `destroy()` is ignored
  with a warning ([PX1504](../diagnostics.md));
- on a scroll or view timeline the scroll position owns the playhead: `playback.start()`, `playback.stop()`, `playback.pause()`,
  `playback.resume()`, `playback.playOnce()`, `playback.setSpeed()` and `playback.setDurationAtSpeed()` are no-ops with a warning
  ([PX1505](../diagnostics.md#the-props-a-component-was-given)); a seek still applies until the next scroll.
  The full list of such rules: [The contract](./playback-and-triggers.md#the-contract).

### Why these names

The file's own keys are explained on the [JSON format page](../format/README.md#why-these-names);
these are the props and calls of the players:

<!-- px-check off naming rationale, prose -->
| Name | Why |
|---|---|
| `doc` | not `document`: `document` shadows `window.document` in exactly the files that also query it, and the type is `PxDocument` |
| `playerRef` | not React's `ref`: the handle is not a control mode — the drivers are the `play…` / `show…` props — and Vue and React Native carry the same name, so one word reads the same in all three |
| `playUsingActionTriggers` | a driver prop starts with its verb and says what drives — here the action triggers; `autoplay` lied for a click file (it waited), `triggers` alone did not say that it plays |
| `playback` | one lever, three positions — `off` · `on` · `paused` (`PxPlayback`): a prop holds a position, and each change of position is exactly one button (`playback.start` · `playback.pause` · `playback.resume` · `playback.stop`). It keeps the `play…` family mark of the driver props (`playUsingActionTriggers`, `show…`) and is the media word for what it switches; `playRun` in 1.24, where "run" read as a verb. `play` / `pause` / `playState` until 1.23: two booleans had an impossible pair (`pause` without `play`), and the one word mixed the request with the readout |
| `player.playback` | ONE home for everything a page does to the animation, so every act has one spelling: the media verbs under the noun they act on (`playback.start()`), no `…Playback` suffix on thirteen methods, and the content / at-speed pairs explain themselves (`playback.getDuration()` vs `playback.getDurationAtSpeed()`). The noun is the one media players use — "start / stop / pause / resume playback" — and `timeline.state.playback` of the layered design; `player.segment.*` can follow the same shape. Flat until 1.25 (`startPlayback()`, with `play()` / `pause()` aliases; `startRun()` in 1.24) |
| `playback.start()` · `playback.stop()` · `playback.pause()` · `playback.resume()` | the four buttons — two for the playback, two for the freeze inside it; one family, so `resume` cannot be read as "start again". No `play()` / `pause()` aliases: `start()` already unfreezes a paused playback (`continue`) |
| `"playback.start"` … in `actionTriggers` / `actions` | the file names the same act the way the handle does: `"playback.start"` ↔ `player.playback.start()`. The keys are ACTION NAMES in a registry, not fields of a structure — the VS Code settings pattern (`"editor.fontSize"`) — so the file stays one level deep, and the dot marks a built-in (`<state variable>.<verb>`), which a custom action name (layer 2) never has: the two can never collide. `start` until 1.23, `startRun` in 1.24 |
| `playOnce()` | one fresh pass as a playback of its own (`runOnce()` in 1.24) — it hangs off the playback, like `playback.getState()` and `playback.isActive()` |
| `atEnd` | nobody presses the end of a pass — the clock gets there — so its rule is a timeline key beside `whenIdle`, not an `actions` slot (`actions.finish` until 1.23) |
| `showAtProgress` / `showAtTime` | `show…` because they show a frame and never play; ms as every time on this API (WAAPI's unit), so not `showAtMs` |
| `timelineOptions` | not `timeline`: it is not the file's `timeline` object — two of its keys live on other props — and a prop sharing a file key's name would promise the same shape; `actions` keeps the file's name because it is a partial of that block |
| `suppressWarnings` / `suppressErrors` | React's own `suppressHydrationWarning` / `suppressContentEditableWarning` set the word; `muteWarn` / `muteError` until 1.15 |
| `onFinish` | WAAPI's word (`finish()`, `onfinish`, `playState: 'finished'`), one pair with the `finished` state; `ended` is `<video>`'s, `complete` Lottie's. Not `onPlaybackFinish`: the playback may go on resting there |
| `onPlaybackStart` · `onPlaybackStop` · `onPlaybackPause` · `onPlaybackResume` | one event per button, told when the act is performed (MediaRecorder's set); noun first for events, verb first for methods. `onPlay` (until 1.23) fired for a start AND a resume, `onPause` for the user's pause AND the gate's hold — the hold now reports nothing. `onPlaybackStop` says "the stop was performed" — at once, or on arrival for `animateToEnd`; no `onReset` (until 1.22): it fired for a mix no page could act on; the state is `playback.getState() === 'off'` |
| `playback.jumpToStart()` | the action words name the destination and the manner — `reset()` until 1.22; unconditional, and it reports nothing, like a seek |
| `playback.getDuration()` | one iteration, as WAAPI's `duration`, CSS `animation-duration` and lottie-web's `getDuration()` are; `getTotalDuration()` for the whole playback — `null` when infinite, the honest slider maximum |
| `playback.getCurrentTime()` / `getTotalTime()`, `getCurrentProgress()` / `getTotalProgress()` | plain names are model ms INSIDE the iteration, `total…` the playback, including repeats — GSAP's `time` / `totalTime`, `duration` / `totalDuration`, `progress` / `totalProgress`; lottie-web's `currentFrame`, Three.js `action.time` and WAAPI's `progress` are per iteration too, so a looping file's slider wraps; until 1.21 `getCurrentTime()` was run ms on the web and iteration ms on React Native |
| `playbackSpeed`, `playback.getSpeed()` / `playback.setSpeed()` | a factor, as every player spells speed (lottie-web `setSpeed`, WAAPI `playbackRate`, GSAP `timeScale`), and a factor needs no knowledge of the content's length; "playback speed" is how media players say it — the file key keeps it in full, on the handle `playback.` already says it. The file key was `playDuration` until 1.15 and `playSpeed` until 1.21; the method `setPlaybackRate` until 1.21 — "rate" reads as a frequency next to `frameRate` |
| `playback.jumpToEnd()` | the executor of the `jumpToEnd` preset, so the same word — one destination word and one manner word, as `jumpToStart` — `jumpToFinished` until 1.17 |
| `…AtSpeed` (`playback.getDurationAtSpeed()` …) | the same five values as their content-time twins, divided by the speed. Flat, "Playback" told the two clocks apart (`getDuration()` vs `getPlaybackDuration()`); inside `playback` that word is the namespace, so the plain names keep content time (the common one — sliders, WAAPI's and GSAP's words) and the rarer reads say what they are, sorting beside their twin |
| `playback.getState()` | the playback's state, one flat word (`getPlayState()` with `idle` until 1.23): `off` says there is no playback, where WAAPI's `idle` could be read as "waiting"; `returning` names the leg where the lever is off but the picture still moves (SVGator's `rollback`); `destroyed` so a call after `destroy()` has an answer |

## See also

- [Which format do I need?](https://pixodesk.com/docs/svga/editor/choosing-a-format)
- [Format documentation](../format/README.md) — the JSON documents the players consume, and the core library
- [Documentation home](../../README.md#documentation)
