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
| `timeline` | ✓ | — | — | ✓ | ✓ | 4 |
| `actions` | ✓ | — | — | ✓ | ✓ | ✓ |
| **Play on trigger** | | | | | | |
| `playOnTrigger` | ✓ | 10 | 11 | ✓ | ✓ | 5 |
| **Declarative control** | | | | | | |
| `play` | — | — | — | ✓ | ✓ | ✓ |
| `pause` | — | — | — | ✓ | ✓ | ✓ |
| `playCurrentProgress` | — | — | — | ✓ | ✓ | ✓ |
| `playCurrentTime` | — | — | — | ✓ | ✓ | ✓ |
| **Imperative control** | | | | | | |
| `playerRef` | 6 | 7 | 6 | ✓ | 8 | ✓ | <!-- px web=~ tag=~ prerendered=~ vue=~ -->
| **Callbacks** | | | | | | |
| `onPlay` | ✓ | — | ✓ | ✓ | `@play` | ✓ |
| `onPause` | ✓ | — | ✓ | ✓ | `@pause` | ✓ |
| `onCancel` | ✓ | — | ✓ | ✓ | `@cancel` | ✓ |
| `onFinish` | ✓ | — | ✓ | ✓ | `@finish` | ✓ |
| `onReady` | ✓ | — | ✓ | ✓ | `@ready` | ✓ |
| `onDestroy` | ✓ | — | ✓ | ✓ | `@destroy` | ✓ |
| `onStop` | ✓ | — | ✓ | ✓ | `@stop` | ✓ |
| `onError` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `onWarn` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `muteWarn` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `muteError` | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `fallback` | — | — | — | — | — | ✓ |
| **Styling** | | | | | | |
| `className` | — | — | — | ✓ | 9 | — | <!-- px vue=~ -->
| `style` | — | — | — | ✓ | ✓ | — | <!-- px vue=~ -->

**Notes**

1. The tag takes the URL as the `data-px-animation-src` attribute.
2. Required. Only `animator.definitions` and `animator.bindings` are needed: the SVG itself is
   already in the page.
3. The tag is the container: the player renders into the element that carries the attribute.
4. React Native ignores `timeline.engine`.
5. `true`, or the whole `triggers` block to use instead of the file's (a `PxTriggers`); React Native ignores
   `hoverIn` / `hoverOut`, which have no touch equivalent.
6. The handle is what `createSvgAnimationPlayer` returns, a `PxAnimationPlayerApi`.
7. `createSvgAnimationPlayersFromPage` returns the handles it created; `getSvgAnimationPlayer(element)` finds one later.
8. The handle is the component's template ref, a `PxAnimationPlayerHandle`.
9. Written `class`; like `style`, it falls through to the root `<svg>`.
10. The tag always plays on the file's own triggers — embedding a finished file IS choosing its behaviour — so it
    takes no `playOnTrigger` option.
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
- **`timeline`** merges corrections over the file's timing block — `{ iterations: 'infinite' }`,
  `{ playDuration: 500 }` — never a replacement; `null` at a key deletes it. See
  [Overriding from a player](./playback-and-triggers.md#overriding-from-a-player).
- **`actions`** merges over the file's `timeline.actions` — how start, stop, finish and suspend
  look: `{ stop: { transition: 'rewind' } }`. The same rules as `timeline`.
- **`playOnTrigger`** means "play the way the document says". The HTML tag always works this way;
  the web player takes it as an option (`createSvgAnimationPlayer({ …, playOnTrigger: true })`) — without
  it, nothing starts and the returned api drives playback. An **object** instead of `true` is the whole
  `triggers` block to use in place of the file's (`{ start: 'hoverIn', stop: 'hoverOut' }`).
- **`play`** is the on/off switch: `true` calls the built-in `start`, `false` the built-in `stop`, each
  done the way the file's `actions` say (the transitions, the stop's `completeIteration` —
  [Actions](./playback-and-triggers.md#actions--how-start-stop-and-finish-look));
  **`pause`** freezes the current frame, and setting it back to `false` resumes.
- **`playCurrentProgress`** shows the frame at a point between 0 and 1 of the whole run (of one iteration
  when `iterations` is `'infinite'`); **`playCurrentTime`** shows the frame at that many ms from the start.
- **`playerRef`** is the handle for calling `play()`, `pause()`, `stop()` and the rest from your code.
  Having it never changes how the component is controlled.
- **`onDestroy`** fires when the player is thrown away: `destroy()`, an unmount, or a new `doc`.
  **`onStop`** fires after any of pause, cancel, finish or remove.
- **`onError`** means this player will not play: the document failed to load, parse or build,
  or drawing it threw. Nothing is rendered, `isReady()` is `false`, and React Native shows
  `fallback` instead. Without a handler the message goes to `console.error`.
- **`onWarn`** means it plays, but something was ignored, simplified or misspelled. Without a
  handler the message goes to `console.warn`.
- **`muteWarn`** / **`muteError`** turn off those console messages, for an app that already
  knows about them. A handler you passed still gets called.
- **`className`** and **`style`** style the root `<svg>`. On the web, style the container instead.

The pre-rendered SVG + CSS wrappers toggle class names instead of creating a player:

<!-- px-check matrix react=react:SvgCssAnimationPlayer vue=vue:SvgCssAnimationPlayer -->
| Name | React `SvgCssAnimationPlayer` | Vue `SvgCssAnimationPlayer` |
|---|---|---|
| the SVG | `children` | default slot | <!-- px name=children vue=~ -->
| `triggers` | ✓ the file's `triggers` block; absent = plays on load | ✓ same |
| `actions` | ✓ `suspend` only; default `'pause'` | ✓ same |
| `inViewThreshold` | ✓ default `0.5` | ✓ same |
| `inViewDebounce` | ✓ default `150` ms | ✓ same |
| `className` | ✓ on the wrapper div | `class`, on the wrapper div | <!-- px vue=~ -->
| `style` | ✓ on the wrapper div | ✓ on the wrapper div | <!-- px vue=~ -->

- `triggers` is the JSON player's block — `start`, `stop`, `pause`, `resume` (derived),
  `togglePlay`, each one event or a list of them, read by the same rules
  ([Triggers](./playback-and-triggers.md#triggers--when-it-plays)): `pause: 'hoverOut'` pauses,
  `stop: 'hoverOut'` stops. An **empty** block does nothing here: a wrapper has no `play()` to call.
- `actions` takes only `suspend` (`{ suspend: { transition: 'pause' } }`): an animation nobody can
  see does not run, whatever started it.
- Accepted limits of a class toggle: a start acts as the `continue` transition and a stop as
  `reset` — a class cannot restart keyframes, jump to their end or play them backwards — and the
  stop's `completeIteration`, `beforeStart` and the finish transition are the file's own CSS.
  None of them is a prop here.
- `inViewThreshold` is how much of the SVG (0 to 1) must be on screen before it may run;
  `inViewDebounce` is how long it must stay that way first, so scrolling straight past starts
  nothing. The defaults are the same as the JSON player's.

### Control modes — one rule

A component can be controlled in several ways, and only one of them can be in charge. If you set
props from more than one group, the group highest in this table wins, and the player warns you
once, naming the props and the winner. React, Vue and React Native all use the same rule from
core (`resolveControlMode`), so they always pick the same winner:

<!-- px-check off the mode-priority rule, prose -->
| Priority | Mode | Chosen when | The document's triggers |
|---|---|---|---|
| 1 | controlled time | `playCurrentProgress` or `playCurrentTime` | switched off; the player seeks and holds |
| 2 | play / pause | `play` or `pause` | switched off; `play={true}` calls `start`, `play={false}` calls `stop` — per the file's `actions` — and `pause` freezes |
| 3 | playOnTrigger | `playOnTrigger` | used, after the override |
| 4 | static | none of the above | switched off; the first frame renders and nothing plays |

`playerRef` is not in the table: the handle is filled in **every** mode and never changes it, so
`<SvgAnimationPlayer doc={doc} playOnTrigger playerRef={playerRef} />` autoplays and gives you the handle.
`playOnTrigger: false` is not a control prop and claims nothing; `play: false` is one, and holds.
The HTML tag is always in playOnTrigger mode; the web player's `playOnTrigger: true` option is the same mode.

### Callbacks and diagnostics — one shape

The callbacks have the same names on every player: you pass them as options on the web
(`createSvgAnimationPlayer({ onFinish })`) and as props in React and React Native. Vue takes the playback
ones as events (`@play`) but `onWarn` and `onError` as props — with an event, Vue would always
count the message as handled, and nobody would see it in the console. All of them are defined
once in core, as `PxAnimationPlayerCallbacks`:

<!-- px-check signature pkg=core -->
```typescript
// Every lifecycle callback is optional and takes no arguments. The types build on each other:
// `PxDiagnosticsConfig` (the diagnostics fields) → `PxEngineCallbacks` (+ the lifecycle; what an
// engine such as `createAdapterSvgAnimationPlayer` takes) → `PxAnimationPlayerCallbacks` (+ `onStop`; what every
// player takes).
interface PxAnimationPlayerCallbacks {
    onReady?: () => void;   // the player exists and the SVG is rendered — once, async;
                            //   the push twin of isReady()
    onPlay?: () => void;    // started or resumed
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;  // reached the end, or finish() was called — not when stopped early
    onDestroy?: () => void;  // destroy() was called, the component unmounted, or a new `doc` arrived
    onStop?: () => void;    // after any of pause / cancel / finish / remove

    // Diagnostics — two severities, one meaning each, on every player. Neither ever throws at
    // the caller. Give a handler and it takes over from the console; give none and the console
    // is the fallback, so nothing is lost by default.
    onWarn?: (d: PxDiagnostic) => void;  // IT PLAYS, but something was ignored, degraded or
                                         //   misspelled; else console.warn
    onError?: (d: PxDiagnostic) => void; // THIS INSTANCE WILL NOT PLAY: failed to load, parse or
                                         //   build, or the render threw — nothing rendered,
                                         //   isReady() false, a component shows its fallback;
                                         //   d.error is the Error; else console.error
    muteWarn?: boolean;                  // switch the console.warn fallback off — for a host that
                                         //   knows the player has something to say about this
                                         //   document and tolerates it. A handler you passed
                                         //   still fires: mute is about the console, not you
    muteError?: boolean;                 // the same switch for console.error
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
severity (`onError`, `onWarn`) and read `kind` inside it to decide what to do:

<!-- px-check values PxDiagnosticKind pkg=core -->
| `kind` | who fixes it | examples |
|---|---|---|
| `document` | regenerate or repair the file | effects shape, unknown keys, an invalid document, no or unresolved bindings, a `scroll.subject` that is not a valid selector, a blocked SVG tag |
| `host` | fix the page or app | no root element, a selector that matched nothing, `setAttribute` finding no element, a failed fetch |
| `platform` | nothing — the player degraded | unsupported CSS attrs, `smoothing` needing the built-in driver, native scroll-timeline construction failing, `react-native-svg` prop limits |
| `usage` | fix the options or props you passed | props from more than one control mode at once, an override that could not apply, a rate of 0, `triggers` on a scroll timeline |
| `internal` | report it to us | could not build, compile or render the document; a render that threw |

For example: fail a CI check on `document`, ignore `platform`, and send `internal` to your error
tracker. Filtering on `kind` is one line in your handler, which is why there is no separate mute
per kind.

### Time — one contract

Every engine on every player implements the same meaning of time, written on `PxAnimationPlayerApi`
and implemented once in core:

- time is **ms from the start of the whole run**, iterations included — so a slider built on
  `getCurrentTime()` never jumps back when the animation repeats;
- a seek **clamps to `[0, duration × iterations]`**, unbounded when `iterations` is `'infinite'`;
- a rate of `0` is **rejected everywhere**, with a warning — `pause()` is how you stop;
- `playCurrentProgress` and `getCurrentProgress()` are the same position as 0–1 of the whole run — of ONE
  iteration when endless, since an endless run has no whole to be a fraction of.

## See also

- [Which format do I need?](https://pixodesk.com/docs/svga/editor/choosing-a-format)
- [Format documentation](../format/README.md) — the JSON documents the players consume, and the core library
- [Documentation home](../../README.md#documentation)
