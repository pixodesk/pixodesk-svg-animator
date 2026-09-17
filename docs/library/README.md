# Library documentation — the players

How to install and use the player libraries that render and control **JSON** animations:
plain HTML, React, Vue and React Native, plus the playback settings and triggers they all
share. (Playing a **pre-rendered SVG** needs no library — see
[Pre-rendered SVG documentation](https://pixodesk.com/docs/svga/prerendered-svg).)

## Contents

1. [Installing the players](./installation.md) — npm packages, the UMD build for pages without a bundler, TypeScript
2. [Web player (`@pixodesk/svg-animator-web`)](./web-player.md) — `createAnimator`, the playback API, callbacks, triggers, the API reference
3. [React (`@pixodesk/svg-animator-react`)](./react.md) — the player component, its props, control modes, Next.js
4. [Vue (`@pixodesk/svg-animator-vue`)](./vue.md) — the player component, props, events, Nuxt
5. [React Native (`@pixodesk/svg-animator-rn`)](./react-native.md) 🧪 — *in development*; install, props, feature support, limitations
6. [Playback settings & triggers](./playback-and-triggers.md) — the `animator` configuration, and overriding it from props or the player API
7. [Minification & property mangling](./minification.md) — safe by default; what to do if your build renames object keys
8. [Troubleshooting & FAQ](./troubleshooting.md) — nothing plays, React/TypeScript/React Native gotchas, playback behavior

Below, what every player shares — the same props under the same names, one callback shape, one
control-mode rule, one meaning of time — so a prop learned on one surface is known on all of them.
Each guide then spells out its own package in signature form under **API reference**; the core
library's is on [the format page](../format/README.md#core-library--pixodesksvg-animator-core).

## The API at a glance

Which package: **web** for plain HTML/JS · **react** / **vue** for those frameworks · **rn** for
React Native 🧪 · **core** only to inspect or transform documents yourself. A pre-rendered `.svg`
file needs no package at all.

<!-- px-check off quick-start jobs, prose -->
| Job | Call |
|---|---|
| Play a JSON file in a page | `createAnimator({ src, container })` (web) |
| Play it in React / Vue | `<PixodeskSvgAnimator :doc … />` |
| Play it in React Native | `<PixodeskSvgAnimator doc={…} />` (rn) |
| Check a generated document before shipping it | `validateDocument(doc)` |
| Put one animation on a page twice | `generateNewIds(doc)` for the second copy |
| Feed a renderer of your own | `materializeAllInTree(doc, 'native')` (core) |
| See or drive every animator on the page — 🧪 experimental | [`getAllAnimators()` / `onAnimatorsChange()`](./web-player.md#every-animator-on-the-page-experimental) (web) |

Every export is marked by audience, in the guides and in the code itself — the mark mirrors the
release tag on the declaration, which is what your IDE shows on hover, and the build fails when
the two disagree:

<!-- px-check off the ●/○/▪ legend -->
| | Meaning |
|---|---|
| **●** | **User-facing** — the API for playing an animation in your page or app. Documented in full. |
| **○** | **Advanced** — document tooling: inspect, transform or validate a document outside a player. Stable, rarely needed. |
| **▪** | **Internal** — exported so the Pixodesk editor (and the sibling packages) stay in lockstep with the player. Not part of the supported surface; may change without notice. |

### Props and options across players

Every way to create a player, side by side — so a prop added or renamed in one place can be
checked against the others. A cell is **✓** when that surface takes the name as is, shows the
spelling when it differs, and is **—** when the surface does not have it.

<!-- px-check matrix web=web:PxAnimatorOptions tag=~ prerendered=web:PxPrerenderedAnimatorOptions react=react:PixodeskSvgAnimatorProps vue=vue:PixodeskSvgAnimator rn=rn:PixodeskSvgAnimatorProps -->
| Name | Web `createAnimator` | HTML tag (`loadTagAnimators`) | Pre-rendered `createAnimator` | React | Vue | React Native | Notes |
|---|---|---|---|---|---|---|---|
| **Document** | | | | | | | |
| `src` | ✓ URL | `data-px-animation-src` | — | — | — | — | a URL to fetch the document from. The components take the document itself, on purpose: in a component tree the document is data the app already owns — imported, or fetched with the app's own loader — and fetching inside the component would mean a second data layer, with its own loading and error states |
| `doc` | ✓ | — | ✓ required¹ | ✓ required | ✓ required | ✓ required | the document, inline — one name on every surface. On the web it also crosses the mangling boundary as a string key: the editor writes `createAnimator({"doc": …})` into every exported SVG+JS (`PX_ANIMATOR_DOC_KEY`), so the key is part of the export format |
| `container` | ✓ selector or `Element` | the tagged element | — | — | — | — | omitted: animate an SVG already in the page |
| **Playback override** | | | | | | | |
| `timeline` | ✓ object or JSON string | — | — | ✓ | ✓ | ✓ | React Native ignores `timeline.engine` |
| `resetTimeline` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `duration` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `delay` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `iterations` | ✓ | — | — | ✓ | ✓ | ✓ | |
| `startOn` | ✓ 5 values | — | — | ✓ 5 values | ✓ 5 values | ✓ 5 values | every player surface takes `PxStartOn` (all 5); React Native ignores `'mouseOver'` |
| **Autoplay control** — the document's own trigger | | | | | | | |
| `autoplay` | — | — | — | ✓ | ✓ | ✓ | the web player and the HTML tag are always in this mode: they follow the document's trigger |
| **Declarative control** — your state drives it | | | | | | | |
| `play` | — | — | — | ✓ | ✓ | ✓ | `false` holds where it is |
| `pause` | — | — | — | ✓ | ✓ | ✓ | hold the current frame; `false` again resumes |
| `progress` | — | — | — | ✓ | ✓ | ✓ | show the frame at 0–1 of the whole run — of ONE iteration when `iterations` is `'infinite'` |
| `time` | — | — | — | ✓ | ✓ | ✓ | show the frame at this ms from the start of the whole run |
| **Imperative control** — you call it | | | | | | | |
| `apiRef` | the returned `PxAnimatorApi` | `element._px_animator` | the returned `PxAnimatorApi` | ✓ — mode unchanged | template ref (`VueAnimatorApi`) | ✓ — mode unchanged | the imperative handle; never picks a mode on any surface | <!-- px web=~ tag=~ prerendered=~ vue=~ -->
| **Callbacks** | | | | | | | |
| `onPlay` | ✓ | — | ✓ | ✓ | `@play` | ✓ | |
| `onPause` | ✓ | — | ✓ | ✓ | `@pause` | ✓ | |
| `onCancel` | ✓ | — | ✓ | ✓ | `@cancel` | ✓ | |
| `onFinish` | ✓ | — | ✓ | ✓ | `@finish` | ✓ | |
| `onRemove` | ✓ | — | ✓ | ✓ | `@remove` | ✓ | the animator was thrown away: `destroy()`, unmount, or a new `doc` |
| `onStop` | ✓ | — | ✓ | ✓ | `@stop` | ✓ | after any of pause / cancel / finish / remove |
| `onError` | ✓ | — | ✓ | ✓ | ✓ | ✓ | THIS INSTANCE WILL NOT PLAY — the document failed to load, parse or build, or the render threw: nothing rendered, `isReady()` false, `fallback` shown. Falls back to `console.error` |
| `onWarn` | ✓ | — | ✓ | ✓ | ✓ | ✓ | IT PLAYS, but something was ignored, degraded or misspelled. Falls back to `console.warn` |
| `muteWarn` | ✓ | — | ✓ | ✓ | ✓ | ✓ | switch the `console.warn` fallback off — for a host that knows the player has something to say about this document and tolerates it. A handler you passed still fires: mute is about the console, not about you |
| `muteError` | ✓ | — | ✓ | ✓ | ✓ | ✓ | the same switch for the `console.error` fallback |
| `fallback` | — | — | — | — | — | ✓ | renders in place of the animation after a failure |
| **Styling** | | | | | | | |
| `className` | — | — | — | ✓ on the root `<svg>` | `class`, falls through to the root `<svg>` | — | web: style the container | <!-- px vue=~ -->
| `style` | — | — | — | ✓ on the root `<svg>` | `style`, falls through to the root `<svg>` | — | | <!-- px vue=~ -->

¹ Only `animator.definitions` and `animator.bindings` — the SVG is already in the page.

The two pre-rendered SVG + CSS wrappers, which toggle class names instead of creating a player:

<!-- px-check matrix react=react:PixodeskSvgCssAnimator vue=vue:PixodeskSvgCssAnimator -->
| Name | React `PixodeskSvgCssAnimator` | Vue `PixodeskSvgCssAnimator` |
|---|---|---|
| the SVG | `children` | default slot | <!-- px name=children vue=~ -->
| `startOn` | `PxStartOn`, default `'load'` — implements 4; `'programmatic'` does nothing (no `play()` here) | ✓ same |
| `outAction` | ✓ default `'continue'`; `'reverse'` acts as `'continue'` | ✓ same |
| `scrollIntoViewThreshold` | ✓ 0–1 of the SVG that must be visible before `'scrollIntoView'` starts; default 0, the wire default | ✓ same |
| `className` | ✓ on the wrapper div | `class`, on the wrapper div | <!-- px vue=~ -->
| `style` | ✓ on the wrapper div | ✓ on the wrapper div | <!-- px vue=~ -->

### Control modes — one rule

On the components the three control groups are ONE choice: the highest-priority group that is set
wins, a losing group warns once — naming both props and the winner — and React, Vue and React
Native resolve it from the same rule in core (`resolveControlMode`), so they cannot answer it
three ways:

<!-- px-check off the mode-priority rule, prose -->
| Priority | Mode | Chosen when | The document's trigger |
|---|---|---|---|
| 1 | controlled time | `progress` or `time` | switched off; the player seeks and holds |
| 2 | play / pause | `play` or `pause` | switched off; `play` plays, `pause` holds, `play={false}` holds too |
| 3 | autoplay | `autoplay` | used, after the override |
| 4 | static | none of the above | switched off; the first frame renders and nothing plays |

`apiRef` is not in the table: the handle is filled in **every** mode and never changes it, so
`<PixodeskSvgAnimator doc={doc} autoplay apiRef={api} />` autoplays and gives you the handle.
`autoplay: false` is not a control prop and claims nothing; `play: false` is one, and holds.
The web player and the HTML tag are always in autoplay mode — the document's own trigger.

### Callbacks and diagnostics — one shape

Callbacks are ONE shape everywhere — the names in the table, inline: `createAnimator({ onFinish })`
on the web, props on React and React Native. Vue takes the lifecycle ones as events (`@play`) and
the diagnostics ones as props — props rather than events because an event handler always exists,
which would have silenced the console fallback for anyone who never subscribed. `PxAnimatorCallbacks`
in core is that one shape:

<!-- px-check signature pkg=core -->
```typescript
// Every lifecycle callback is optional and takes no arguments. One chain, three levels, each
// extending the one above: `PxDiagnosticsConfig` (the four diagnostics fields) → `PxEngineCallbacks`
// (+ the lifecycle; what an engine such as `createAdapterAnimator` takes) → `PxAnimatorCallbacks`
// (+ `onStop`; what every public surface takes).
interface PxAnimatorCallbacks {
    onPlay?: () => void;    // started or resumed
    onPause?: () => void;
    onCancel?: () => void;
    onFinish?: () => void;  // reached the end, or finish() was called — not when stopped early
    onRemove?: () => void;  // destroy() was called, the component unmounted, or a new `doc` arrived
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

Severity and source are different axes — an invalid document is a `document` problem *and* fatal,
an effects-shape warning a `document` problem that still plays — so one channel with a `kind`
replaces four handlers a host would have to wire to hear everything:

<!-- px-check values PxDiagnosticKind pkg=core -->
| `kind` | who fixes it | examples |
|---|---|---|
| `document` | regenerate or repair the file | effects shape, unknown keys, an invalid document, no or unresolved bindings, a `scroll.subject` that is not a valid selector, a blocked SVG tag |
| `host` | fix the page or app | no root element, a selector that matched nothing, `setAttribute` finding no element, a failed fetch |
| `platform` | nothing — the player degraded | unsupported CSS attrs, `smoothing` needing the built-in driver, native scroll-timeline construction failing, `react-native-svg` prop limits |
| `usage` | fix the options or props you passed | two control tiers at once, an override that could not apply, a rate of 0, `trigger` on a scroll timeline |
| `internal` | report it to us | could not build, compile or render the document; a render that threw |

So surface `document` in a CI check, quiet `platform`, alert on `internal`. A handler that filters
on `kind` is one line, which is why there is no per-kind mute.

### Time — one contract

Every engine on every player implements the same meaning of time, written on `PxAnimatorApi`
and implemented once in core:

- time is **ms from the start of the whole run**, iterations included — so a slider built on
  `getCurrentTime()` never jumps back when the animation repeats;
- a seek **clamps to `[0, duration × iterations]`**, unbounded when `iterations` is `'infinite'`;
- a rate of `0` is **rejected everywhere**, with a warning — `pause()` is how you stop;
- `progress` and `getCurrentProgress()` are the same position as 0–1 of the whole run — of ONE
  iteration when endless, since an endless run has no whole to be a fraction of.

## See also

- [Which format do I need?](https://pixodesk.com/docs/svga/editor/choosing-a-format)
- [Format documentation](../format/README.md) — the JSON documents the players consume, and the core library
- [Documentation home](../../README.md#documentation)
