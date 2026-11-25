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
10. [Variables](./variables.md) — values the page changes while it plays: from code, a named variant, or the stylesheet
11. [Minification & property mangling](./minification.md) — safe by default; what to do if your build renames object keys
12. [Troubleshooting & FAQ](./troubleshooting.md) — nothing plays, React/TypeScript/React Native gotchas, playback behavior

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
| Play a JSON file in a page | `createSvgAnimationPlayer({ document, container })` (web) |
| Play it in React / Vue | `<SvgAnimationPlayer :document … />` |
| Play it in React Native | `<SvgAnimationPlayer document={…} />` (rn) |
| Change a colour, a size or a text from your app while it plays | `variables={{ … }}` · `player.variables.set(name, value)` — [Variables](./variables.md) |
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
| `document` | ✓ | 1 | 2 | 11 | 11 | 11 |
| `container` | ✓ | 3 | — | — | — | — |
| **Playback override** | | | | | | |
| `timelineOptions` | ✓ | — | — | ✓ | ✓ | 4 |
| **Control** — none of them: the file's own triggers drive it | | | | | | |
| `showAsStatic` | ✓ | 10 | ✓ | ✓ | ✓ | ✓ |
| `disableActions` | ✓ | 10 | ✓ | ✓ | ✓ | ✓ |
| `actions` | ✓ | 10 | ✓ | ✓ | ✓ | 5 |
| **Declarative control** | | | | | | |
| `playback` | — | — | — | ✓ | ✓ | ✓ |
| `showAtProgress` | — | — | — | ✓ | ✓ | ✓ |
| `showAtTime` | — | — | — | ✓ | ✓ | ✓ |
| `flowStep` | — | — | — | ✓ | ✓ | — |
| `flows` | ✓ | — | ✓ | ✓ | ✓ | 13 |
| `timelines` | ✓ | — | ✓ | ✓ | ✓ | 13 |
| **Variables** | | | | | | |
| `variables` | ✓ | 12 | — | ✓ | ✓ | ✓ |
| `variant` | ✓ | 12 | — | ✓ | ✓ | ✓ |
| `cssVariables` | ✓ | 12 | — | ✓ | ✓ | — |
| **Imperative control** | | | | | | |
| `playerRef` | 6 | 7 | 6 | ✓ | 8 | ✓ | <!-- px web=~ tag=~ prerendered=~ vue=~ -->
| **Callbacks** | | | | | | |
| `onPlaybackStart` | ✓ | — | ✓ | ✓ | `@playbackStart` | ✓ |
| `onPlaybackResume` | ✓ | — | ✓ | ✓ | `@playbackResume` | ✓ |
| `onPlaybackPause` | ✓ | — | ✓ | ✓ | `@playbackPause` | ✓ |
| `onPlaybackFinish` | ✓ | — | ✓ | ✓ | `@playbackFinish` | ✓ |
| `onReady` | ✓ | — | ✓ | ✓ | `@ready` | ✓ |
| `onDestroy` | ✓ | — | ✓ | ✓ | `@destroy` | ✓ |
| `onPlaybackStop` | ✓ | — | ✓ | ✓ | `@playbackStop` | ✓ |
| `onFlowStepChange` | ✓ | — | ✓ | ✓ | `@flowStepChange` | 13 |
| `onError` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `onWarning` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `suppressWarnings` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `suppressErrors` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `fallback` | — | — | — | — | — | ✓ |
| **Styling** | | | | | | |
| `className` | — | — | — | ✓ | 9 | — | <!-- px vue=~ -->
| `style` | — | — | — | ✓ | ✓ | — | <!-- px vue=~ -->

**Notes**

1. The tag takes the URL as the `data-px-document` attribute.
2. Required, and the document itself, never a URL. Only `animator.definitions` and `animator.bindings` are needed: the SVG itself is
   already in the page.
3. The tag is the container: the player renders into the element that carries the attribute.
4. React Native ignores `engine` and `frameRate` inside `timelineOptions`.
5. The whole `actions` list to use instead of the file's (a `PxActionsInput`), as everywhere; React
   Native ignores `hoverIn` / `hoverOut`, which have no touch equivalent.
6. The handle is what `createSvgAnimationPlayer` returns, a `PxAnimationPlayerApi`.
7. `createSvgAnimationPlayersFromPage` returns the handles it created; `getSvgAnimationPlayer(element)` finds one later.
8. The handle is the component's template ref, a `PxAnimationPlayerHandle`.
9. Written `class`; like `style`, it falls through to the root `<svg>`.
10. The tag has no attribute for it: each file plays on its own triggers. The call that reads the tags takes the
    option for every player it creates — `createSvgAnimationPlayersFromPage({ disableActions: true })`.
11. Required, and the document itself, never a URL — see `document` below.
12. The tag has no attribute for it: the call that reads the tags takes the option for every player it creates —
    `createSvgAnimationPlayersFromPage({ variant: 'dark' })`. With `cssVariables`, a tag's own
    `style="--bg: #111827"` gives that player its value.
13. React Native plays ONE flow — the first that runs (PX1605); its steps change at once, and it has no `flowStep`
    prop yet (`getTimeline()` answers `undefined`). Flows run in full on the web players, React and Vue included.

What some of the names mean:

- **`document`** is the animation, under the same name on every player. The web player takes a URL to fetch
  it from or the document itself — a string is always a URL (`src` / `doc` until 1.25). The components take
  the document itself, for now on purpose: in a component tree the document is data your app already has
  (imported, or fetched with your own loader), and fetching inside the component would add a second loading
  and error state to manage. On the web the name is also part of the export format: every SVG + JS file the
  editor exports calls `createSvgAnimationPlayer({"document": …})` (`PX_ANIMATOR_DOC_KEY`), so it is never
  renamed by a minifier.
- **`container`** left out means: animate an SVG that is already in the page.
- **`timelineOptions`** merges corrections over the file's timing block — `{ iterations: 'infinite' }`,
  `{ playbackSpeed: 2 }`, and how a stop looks: `{ whenStopped: 'animateToStart' }` — never a replacement; a key
  left out keeps the file's value (to get a default, set it). `whenOutOfView` and `whenFinished` travel here too.
  See [Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
- **No control prop** means "play the way the document says": its own `actions` start it, on every
  player — a file saved with a `timeline.start` entry on `load` plays at once, a file without triggers stays still until
  your code calls `timeline.start()`.
- **`actions`** is the whole `actions` list to use in place of the file's
  (`[{ name: 'timeline.play', triggers: [{ event: 'hoverIn' }] }, { name: 'timeline.stop', triggers: [{ event: 'hoverOut' }] }]`) — an entry left
  out is not there. `null` or `[]`: no triggers, the same as `disableActions` (`actionTriggers` and
  `disableActionTriggers` until 1.29).
- **`disableActions`** switches the file's triggers off: nothing starts by itself, your code drives it
  through the handle (`playerRef`, the template ref, the web player's returned api).
- **`showAsStatic`** shows the picture as drawn — nothing plays, whatever the file says: no triggers, no scroll,
  and every playback call on the handle is ignored with a warning
  ([PX1506](../diagnostics.md#the-props-a-component-was-given)); the reads still answer. It beats every other
  control prop.
- **`playback`** is a lever: its position is held — `'off'` (no playback), `'on'` (a playback), `'paused'` (the playback,
  frozen) — and a change of position presses one built-in button: `off` → `on` is `timeline.start`, `on` → `paused`
  is `timeline.pause`, `paused` → `on` is `timeline.resume`, anything → `off` is `timeline.stop`, a stop done the
  way the timeline's `whenStopped` says ([How a stop looks](./playback-and-triggers.md#how-a-stop-looks--whenstopped)).
  `"on"` is a start, so it always plays from the start.
  `playback="off"` performs the stop action (`whenStopped`: `jumpToStart`, `animateToStart`,
  `jumpToEnd`, `animateToEnd` or `animateToEndAndBack`) — it does not pause; a mount with `"off"` presses nothing, a mount with
  `"paused"` starts the playback frozen. No pair of positions is invalid; the positions are `PxPlayback`.
- **`showAtProgress`** shows the frame at a position counted in iterations — `0.5` half-way through the first,
  `1.2` 20 % into the second ([Moving the playhead](./playback-and-triggers.md#moving-the-playhead));
  **`showAtTime`** shows the frame at that many ms inside the iteration, `0` to `timeline.getDuration()`.
- **`flowStep`** holds a [flow step](./playback-and-triggers.md#flows--named-steps-of-the-animation) of the file — a
  lever beside the others: `flowStep={status}`, or a list of ids, one per flow. While set, the file's entries for that
  flow rest; a change goes there the way the step being left says (`whenLeaving`). It combines with any control prop.
- **`flows`** · **`timelines`** say what runs ([What runs](./playback-and-triggers.md#what-runs--the-pages-lists)):
  those flows, or those timelines whole and by themselves; with neither, every flow. A change plans again over the
  same picture — no remount.
- **`variables`** gives the file's [variables](./variables.md) values by name — `{ bg: '#111827', title: 'Hi' }`;
  they win over the file, and a name that leaves the prop goes back to the file's value. A change is drawn on the
  next frame and never restarts the animation. **`variant`** picks a named set of defaults from the file;
  **`cssVariables`** delivers variables as CSS custom properties, so the page's stylesheet can set them (not on
  React Native). The pre-rendered `bind` takes none of them: its values were written in at export.
- **`playerRef`** is the handle for calling `timeline.start()`, `timeline.play()`, `timeline.pause()`, `timeline.stop()` and the
  rest from your code, and `variables.set()` for the variables. Having it never changes how the component is controlled.
- **`onDestroy`** fires when the player is thrown away: `destroy()`, an unmount, or a new `document`.
  **`onPlaybackStop`** fires when the built-in stop is performed — at once, or on arrival for the stops that
  finish the pass first — not on a pause (`onPlaybackPause`), the end (`onPlaybackFinish`) or a removal (`onDestroy`).
  **`onPlaybackFinish`** fires when the last pass ends by playing — never for a stop that goes to the end, never
  on a loop without end (`onFinish` until 1.25). **`onPlaybackStart`** and **`onPlaybackResume`** are the other
  buttons' events (`onPlay` fired for both until 1.23); the visibility gate presses the same buttons, so its
  out-of-view pause reports `onPlaybackPause` and `onPlaybackResume`, its stop `onPlaybackStop` and `onPlaybackStart`.
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
| `actions` | ✓ — but absent lists nothing: the wrapper cannot read a file's triggers; `[{ name: 'timeline.start', triggers: [{ event: 'load' }] }]` plays on load | ✓ same |
| `timelineOptions` | ✓ the gate only: `inViewThreshold` (default `0.5`), `inViewDebounce` (default `150` ms), `whenOutOfView` (default `'pause'`) | ✓ same |
| `className` | ✓ on the wrapper div | `class`, on the wrapper div | <!-- px vue=~ -->
| `style` | ✓ on the wrapper div | ✓ on the wrapper div | <!-- px vue=~ -->

The props are the JSON component's names, narrowed where a class toggle can do less (React's
`SvgCssAnimationPlayerProps` is derived from `SvgAnimationPlayerProps`, so the two cannot drift):

- `actions` is the JSON player's list of entries — `timeline.start`, `timeline.play`, `timeline.stop`,
  `timeline.pause`, `timeline.resume` (derived when left out), each with its triggers, read by the same rules
  ([Triggers](./playback-and-triggers.md#triggers--when-it-plays)): `{ name: 'timeline.pause', triggers: [{ event: 'hoverOut' }] }`
  pauses, `{ name: 'timeline.stop', triggers: [{ event: 'hoverOut' }] }` stops. A script-free SVG carries no triggers the wrapper
  could read, so there is no file default here: an **empty** list — or no prop at all — does nothing, and a wrapper
  has no `timeline.start()` to call. A wrapper that should play on load says
  `actions={[{ name: 'timeline.start', triggers: [{ event: 'load' }] }]}`.
- Accepted limits of a class toggle: a start that is not from rest restarts by remounting the content (a
  class cannot rewind keyframes); the stop is always `jumpToStart` (a class cannot play keyframes backwards or
  on to their end); there is no `finished` state (the class toggle does not see the CSS animation end); and
  `whenIdle` and `whenFinished` are the file's own CSS. None of them is a prop here.
- `timelineOptions` takes the gate: `inViewThreshold` is how much of the SVG (0 to 1)
  must be on screen before it may run; `inViewDebounce` is how long it must stay that way first, so
  scrolling straight past starts nothing; `whenOutOfView` (`'pause'`, the default) says what happens while nobody
  can see it — an animation nobody can see does not run, whatever started it. The defaults are the same as the
  JSON player's.

### Control modes — one rule

A player can be controlled in several ways, and only one of them can be in charge. **With no control prop
it plays the file the way it was saved** — the file's own `actions` drive it. In React and React Native,
TypeScript accepts one driver family at a time — `PxControlProps` is a union of `showAsStatic` ·
`showAtProgress` · `showAtTime` · `playback` · `disableActions` · `actions`. If you set props from
more than one group anyway (from JavaScript), the group highest in this table wins, and the player warns you
once, naming the props and the winner ([PX1501](../diagnostics.md#the-props-a-component-was-given)). Every
player uses the same rule from core (`resolveControlMode`), so they always pick the same winner:

<!-- px-check off the mode-priority rule, prose -->
| Priority | Mode | Chosen when | The document's triggers |
|---|---|---|---|
| 1 | static | `showAsStatic` | switched off, and no scroll: the picture as drawn; every playback call on the handle is ignored ([PX1506](../diagnostics.md#the-props-a-component-was-given)) |
| 2 | controlled time | `showAtProgress` or `showAtTime` (`showAtProgress` wins over `showAtTime`) | switched off; the player seeks and holds |
| 3 | playback | `playback` | switched off; `'on'` presses `timeline.start`, `'off'` performs the stop action (`whenStopped`) — it does not pause — and `'paused'` freezes the playback |
| 4 | manual | `disableActions` (or `actions: null`) | switched off; your code drives it through the handle |
| 5 | actions — the default | none of the above, or an `actions` list | the file's own, or the list given — used after the override |

`playerRef` is not in the table: the handle is filled in **every** mode and never changes it, so
`<SvgAnimationPlayer document={animation} playerRef={playerRef} />` plays as the file says and gives you the handle;
add `disableActions` when your code alone should drive. `showAsStatic={false}` and
`disableActions={false}` claim nothing; `playback: 'off'` is a mode, and holds. The web player, the HTML
tag (through `createSvgAnimationPlayersFromPage(options)`) and the pre-rendered `bind` take rows 1, 4 and 5 —
`showAsStatic`, `disableActions`, `actions` (`PxCommonControlProps`) — by the same rule.

### Callbacks and diagnostics — one shape

The callbacks have the same names on every player: you pass them as options on the web
(`createSvgAnimationPlayer({ onPlaybackFinish })`) and as props in React and React Native. Vue takes the playback
ones as events (`@playbackStart`) but `onWarning` and `onError` as props — with an event, Vue would always
count the message as handled, and nobody would see it in the console. All of them are defined
once in core, as `PxAnimationPlayerCallbacks`:

<!-- px-check signature pkg=core -->
```typescript
// Every lifecycle callback is optional and takes no arguments. The types build on each other:
// `PxDiagnosticsConfig` (the diagnostics fields) → `PxEngineCallbacks` (+ the lifecycle; what an
// engine such as `createAdapterSvgAnimationPlayer` takes — its raw `onPlay` / `onPause` are the clock on / off)
// → `PxAnimationPlayerCallbacks` (the buttons' events and the finish instead; what every player takes).
interface PxAnimationPlayerCallbacks {
    onReady?: () => void;   // the player exists and the SVG is rendered — once, async;
                            //   the push twin of isReady()
    onPlaybackStart?: () => void;  // a playback began — timeline.start(), timeline.play() from rest, a `timeline.start` /
                              //   `timeline.play` trigger, playback to 'on' / 'paused' from 'off', the gate starting
                              //   it again; a picture on its way back turned around by a play
    onPlaybackResume?: () => void; // the playback carried on after a freeze — timeline.resume(), timeline.play(), a
                              //   `timeline.resume` trigger, playback back to 'on', the gate when it is seen again
    onPlaybackPause?: () => void;  // the playback was frozen — timeline.pause(), a `timeline.pause` trigger, playback="paused",
                              //   or the gate's out-of-view pause
    onPlaybackFinish?: () => void;  // the last pass ended by playing — the state is `finished`, whatever `whenFinished`
                              //   then shows; never for a stop that goes to the end, never on a loop without end
    onDestroy?: () => void;  // destroy() was called, the component unmounted, or a new `document` arrived
    onPlaybackStop?: () => void;   // the playback was stopped — at once, or on arrival for the stops that finish the
                              //   pass first; the gate's stop too. A seek reports nothing
    onFlowStepChange?: (flowStep: string, previous: string, flow: string) => void;  // a flow went to another
                              //   step — an entry of `actions` (a step's end too), flow.goTo(), the `flowStep` prop; `flow`
                              //   is its id, `default` for the flow `default` (`onStateChange` until 2026-11-22)

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
| `document` | regenerate or repair the file | effects shape, unknown keys, an invalid document, no or unresolved bindings, a scroll timeline's `selector` that is not a valid selector, a blocked SVG tag |
| `host` | fix the page or app | no root element, a selector that matched nothing, `setAttribute` finding no element, a failed fetch |
| `platform` | nothing — the player degraded | unsupported CSS attrs, `smoothing` needing the built-in driver, native scroll-timeline construction failing, `react-native-svg` prop limits |
| `usage` | fix the options or props you passed | props from more than one control mode at once, an override that could not apply, a rate of 0, `actions` on a scroll timeline, a playback call on a scroll timeline (PX1505) or on a `showAsStatic` player (PX1506) |
| `internal` | report it to us | could not build, compile or render the document; a render that threw |

For example: fail a CI check on `document`, ignore `platform`, and send `internal` to your error
tracker. Filtering on `kind` is one line in your handler, which is why there is no separate mute
per kind.

### Time — one contract

Every engine on every player implements the same meaning of time, written on `PxAnimationPlayerApi`
and implemented once in core, over two clocks — **model time** (content ms, as authored) and
**playback time** (model time ÷ the speed): **every plain ms is model ms inside the iteration;
`total…` counts the whole playback; the `playback…` family is playback time.**

- `timeline.getCurrentTime()` / `timeline.setCurrentTime()` are the frame on screen inside the **current
  iteration** — `0..getDuration()`; `showAtTime` is the same axis. One pass is always finite, so no read has an
  `infinite` exception;
- `timeline.getCurrentProgress()` / `timeline.setCurrentProgress()` **count iterations**, in the order they play —
  `1.2` is 20 % into the second iteration (on its way back, in an `alternate` loop); nothing wraps, the value is
  clamped to `0 … iterations` and has no upper bound when endless. `showAtProgress` is the same axis. A bar that
  runs `0 … 1` on every pass is `getCurrentTime() / getDuration()`;
- `timeline.getTotalTime()` / `timeline.setTotalTime()` and `timeline.getTotalDuration()` span the **whole playback**, every iteration
  included — `timeline.getTotalDuration()` is `null` when `iterations` is `'infinite'`, the honest slider maximum,
  and `timeline.getTotalProgress()` the 0–1 of the playback (`null` when endless); `timeline.getCurrentIteration()` says which
  pass is on screen. "Total" means including repeats — GSAP's words exactly: `time` / `totalTime`,
  `duration` / `totalDuration`, `progress` / `totalProgress`;
- the **`playback…` family is playback time**: `playbackSpeed` (the file's key, the
  `timelineOptions` key and `timeline.getSpeed()` / `timeline.setSpeed()` — 1 normal, 2 double; a
  negative speed on the handle plays backwards and multiplies with `iterationDirection`),
  `timeline.getDurationAtSpeed()` / `timeline.setDurationAtSpeed()` (one pass; the setter sets the speed),
  `timeline.getTotalDurationAtSpeed()`, `timeline.getCurrentTimeAtSpeed()` and `timeline.getTotalTimeAtSpeed()`. `delay` is
  ms scaled by the speed, as WAAPI's is;
- a seek **clamps** — to the pass or to the playback — and follows one rule: while `playing` it keeps playing
  from there; in every other state the playback becomes `paused` at that frame, and `timeline.resume()` plays on
  from it ([Moving the playhead](./playback-and-triggers.md#moving-the-playhead)). A speed of `0` is **rejected
  everywhere**, with a warning — `timeline.pause()` is how you stop;
- `timeline.getState()` is the one state read — the playback's: `off` · `playing` · `paused` · `finished` · `returning`
  · `scrubbing` · `destroyed`; `finished` after the last pass, whatever `whenFinished` then shows; a stop's `animateToStart`
  leg on its way back reads `returning` (no playback, the picture still moves); `timeline.isPlaying()` is
  `getState() === 'playing'`, `timeline.isActive()` is true while a playback exists; a call after `destroy()`
  is ignored with a warning ([PX1504](../diagnostics.md));
- on a scroll timeline only the scroll moves the playhead: `timeline.getState()` reads `scrubbing` on every engine,
  no playback callback fires, and `timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`,
  `timeline.resume()`, `timeline.setSpeed()`, `timeline.setDurationAtSpeed()` and the seeks (`showAtProgress` /
  `showAtTime` too) are ignored with a warning ([PX1505](../diagnostics.md#the-props-a-component-was-given));
  the reads still answer.
  The full list of such rules: [The contract](./playback-and-triggers.md#the-contract).

### Why these names

The file's own keys are explained on the [JSON format page](../format/README.md#why-these-names);
these are the props and calls of the players:

<!-- px-check off naming rationale, prose -->
| Name | Why |
|---|---|
| `document` | one name for "which animation", on every player — a URL or the document itself on the web, the type tells them apart. `src` / `doc` until 1.25: two names for one thing, and `src` did not say what it was the source of. The name hides the browser's `window.document` only where code destructures it as `({ document })` — write `{ document: animation }` there |
| `playerRef` | not React's `ref`: the handle is not a control mode — the drivers are the `play…` / `show…` props — and Vue and React Native carry the same name, so one word reads the same in all three |
| no control prop | the file drives: a player plays a file the way it was saved, the same on every surface — a bare component, `createSvgAnimationPlayer`, the page tag and the pre-rendered `bind`. Until 1.25 nothing played until a prop named the driver (`playUsingActionTriggers`); that made every surface equal when the old `autoplay` lied for a click file (it waited) — the file's own triggers make them equal with no such word |
| `actions` | the file's own key: the prop IS an `animator.actions` list, used instead of the file's, so it replaces it whole — the entries belong together (hover → click wants other `pause` / `stop` entries too) |
| `disableActions` | manual gets its own flag: `actions={[]}` says the same, but alone it reads as a mistake. It names what it does to the file — the triggers are switched off — and code presses the buttons |
| `showAsStatic` | `show…` like `showAtProgress` / `showAtTime`: it shows a picture and never plays; `static` is the SVG as drawn, `whenIdle`'s word. A pure still, not manual by another name — manual has its own spelling — so a playback call on it warns instead of moving it |
| `playback` | one lever, three positions — `off` · `on` · `paused` (`PxPlayback`): a prop holds a position, and each change of position is exactly one button (`timeline.start` · `timeline.pause` · `timeline.resume` · `timeline.stop`). It is the media word for what it switches; `playRun` in 1.24, where "run" read as a verb. `play` / `pause` / `playState` until 1.23: two booleans had an impossible pair (`pause` without `play`), and the one word mixed the request with the readout |
| `player.timeline` | ONE home for everything a page does to the animation, so every act has one spelling: the media verbs under the noun they act on (`timeline.start()`), no `…Playback` suffix on thirteen methods, and the content / at-speed pairs explain themselves (`timeline.getDuration()` vs `timeline.getDurationAtSpeed()`). The noun is the one media players use — "start / stop / pause / resume playback" — and `timeline.state.timeline` of the layered design; `player.flow.*` follows the same shape. Flat until 1.25 (`startPlayback()`; `startRun()` in 1.24) |
| `timeline.start()` · `timeline.stop()` · `timeline.pause()` · `timeline.resume()` | the buttons — two for the playback, two for the freeze inside it; one family, so `resume` cannot be read as "start again". One job each: `start()` always plays from the start (until 1.25 it carried on by default), `resume()` continues a pause |
| `timeline.play()` | start, or carry on — what a Play button wants, and the media word for it: nothing while playing, a resume while paused, a turn-around while the picture goes back, a start otherwise. Not an alias: no other button does that. The file's `"timeline.play"` list is the same act (since 1.26) |
| `"timeline.start"` … in `actions` | the file names the same act the way the handle does: `{ "name": "timeline.start" }` ↔ `player.timeline.start()`, `{ "name": "flow.goTo", "with": { "flowStep": "hover" } }` ↔ `player.flow.goTo({ flowStep: 'hover' })` — the entry's `with` is the call's argument. They are ACTION NAMES — the `name` of an entry (its `action` until 1.33) — not fields of a structure, the VS Code settings pattern (`"editor.fontSize"`); the dot marks a built-in (`<noun>.<verb>`), which a custom action name (layer 2) never has: the two can never collide. `start` until 1.23, `startRun` in 1.24 |
| `flowStep` · `player.flow` · `onFlowStepChange` | one family wherever a step is meant: `flowSteps` in the file, `flow.goTo` the action, `player.flow.goTo()` the call, `flowStep` the prop — plain words for a person who never heard of a state machine. `state` until 2026-11-22, `segment` until 2026-11-20 |
| `whenFinished` | nobody presses the end of the playback — the clock gets there — so its rule is a timeline key beside `whenIdle`, like `whenStopped`, not a button; it names the state it governs and moves only the picture: the playback stays `finished`. `atEnd` until 1.25, `actions.finish` until 1.23 |
| `showAtProgress` / `showAtTime` | `show…` because they show a frame and never play; ms as every time on this API (WAAPI's unit), so not `showAtMs` |
| `timelineOptions` | not `timeline`: it is not a timeline of the file — the `actions` live on another prop, and it patches the first timeline only — and a prop sharing a file key's name would promise the same shape; "options" also says it MERGES, `whenStopped` included. `actions` keeps the file's name because it IS that list, and replaces it (`actionTriggers` until 1.29) |
| `suppressWarnings` / `suppressErrors` | React's own `suppressHydrationWarning` / `suppressContentEditableWarning` set the word; `muteWarn` / `muteError` until 1.15 |
| `onPlaybackFinish` | WAAPI's word (`finish()`, `onfinish`, `playState: 'finished'`), one pair with the `finished` state; `ended` is `<video>`'s, `complete` Lottie's. The `Playback` prefix like its four siblings — a playback event; a flow's move is `onFlowStepChange`. `onFinish` until 1.25 |
| `onPlaybackStart` · `onPlaybackStop` · `onPlaybackPause` · `onPlaybackResume` | one event per button, told when the act is performed (MediaRecorder's set); noun first for events, verb first for methods. `onPlay` (until 1.23) fired for a start AND a resume. The visibility gate presses the same buttons, so its pause and stop report too (since 1.26). `onPlaybackStop` says "the stop was performed" — at once, or on arrival for the stops that finish the pass first; no `onReset` (until 1.22): it fired for a mix no page could act on; the state is `timeline.getState() === 'off'` |
| `timeline.getDuration()` | one iteration, as WAAPI's `duration`, CSS `animation-duration` and lottie-web's `getDuration()` are; `getTotalDuration()` for the whole playback — `null` when infinite, the honest slider maximum |
| `timeline.getCurrentTime()` / `getTotalTime()`, `getCurrentProgress()` / `getTotalProgress()` | plain time names are model ms INSIDE the iteration, `total…` the playback, including repeats — GSAP's `time` / `totalTime`, `duration` / `totalDuration`, `progress` / `totalProgress`; lottie-web's `currentFrame` and Three.js `action.time` are per iteration too. Progress counts iterations (1.26): one number says the pass and the place in it, so a value read can be written back, and nothing wraps (`0 … 1` of the iteration until 1.25); until 1.21 `getCurrentTime()` was run ms on the web and iteration ms on React Native |
| `playbackSpeed`, `timeline.getSpeed()` / `timeline.setSpeed()` | a factor, as every player spells speed (lottie-web `setSpeed`, WAAPI `playbackRate`, GSAP `timeScale`), and a factor needs no knowledge of the content's length; "playback speed" is how media players say it — the file key keeps it in full, on the handle `playback.` already says it. The file key was `playDuration` until 1.15 and `playSpeed` until 1.21; the method `setPlaybackRate` until 1.21 — "rate" reads as a frequency next to `frameRate` |
| `…AtSpeed` (`timeline.getDurationAtSpeed()` …) | the same five values as their content-time twins, divided by the speed. Flat, "Playback" told the two clocks apart (`getDuration()` vs `getPlaybackDuration()`); inside `playback` that word is the namespace, so the plain names keep content time (the common one — sliders, WAAPI's and GSAP's words) and the rarer reads say what they are, sorting beside their twin |
| `timeline.getState()` | the playback's state, one flat word (`getPlayState()` with `idle` until 1.23): `off` says there is no playback, where WAAPI's `idle` could be read as "waiting"; `returning` names the leg where the lever is off but the picture still moves (SVGator's `rollback`); `finished` is a state, not a picture — it holds whatever `whenFinished` shows; `destroyed` so a call after `destroy()` has an answer |

## See also

- [Which format do I need?](https://pixodesk.com/docs/svga/editor/choosing-a-format)
- [Format documentation](../format/README.md) — the JSON documents the players consume, and the core library
- [Documentation home](../../README.md#documentation)
