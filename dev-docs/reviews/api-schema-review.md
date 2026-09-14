# Player API review

Status **2026-09-12** (reviewed 2026-09-10). All 24 numbered items are done — §16 closed as intended
behavior, §20 by the "Standardise spelling" commit, §24 (the props-table naming pass: `doc`,
`timeline` / `resetTimeline`, inline callbacks) on 2026-09-12, and "The reference itself" the same day — the docs are now checked against the
types and schemas on every build (`tools/docs-check`). Open: the polish list in §25, after the
bindings rework. Current issues
only — found by reading the exported code of the five
packages, not the docs. Ranked from "behaves wrongly" to "would be nicer". Each item says where,
why it matters, and what to do. Schema-level findings live in
[schema-naming-review.md](./schema-naming-review.md); where one depends on the other it says so.

🔴 behavior contradicts the docs, or differs per player · 🟠 inconsistent surface — users will
trip on it · 🟡 smaller

## 🔴 Behavior

### 1. ✅ React: `apiRef` silently switches `autoplay` off

Done 2026-09-12, with §7 — the two were one bug. The ref is no longer an input to the mode:
all three components call core's `resolveControlMode`, which takes only `progress` / `time` /
`play` / `pause` / `autoplay`. A handle is not an instruction, so
`<PixodeskSvgAnimator autoplay apiRef={api} />` now autoplays **and** fills the handle.

Covered by `PxControlMode.test.ts` ("the resolver takes no ref at all") and React's "autoplay
still starts when an apiRef is passed — a handle is not a mode".

### 2. ✅ The same document starts differently on web and React Native

Done 2026-09-11: every player resolves the trigger through core's `resolveTrigger` — a missing
`startOn` is `'load'`, a missing `outAction` is `'continue'` (schema-naming-review.md §2.1).

### 3. ✅ `getCurrentTime`, `setCurrentTime` and `setPlaybackRate` mean different things per engine

| | `getCurrentTime()` | `setCurrentTime(t)` | `setPlaybackRate(0)` |
|---|---|---|---|
| web, WAAPI engine | ms since the start of the run, across iterations (`Animation.currentTime`) | set as given, not clamped | accepted |
| web, frame-loop engine | same meaning | clamped to `[0, total]` | ignored with a warning |
| React Native | ms within the **current iteration** (`progress.value`) | clamped, then wrapped into one iteration | ignored with a warning |

`timeline.engine: 'auto'` picks the web engine per document, so two files on one page can answer
the same call differently, and a time slider built on `getCurrentTime()` jumps back every
iteration on React Native.

Done 2026-09-12. One contract, written on `PxAnimatorAPI` and implemented once in core's
`playback/PxPlaybackTime.ts`:

- time is **ms from the start of the whole run**, iterations included, on every engine;
- a seek **clamps to `[0, duration × iterations]`** (unbounded when `iterations` is `'infinite'`);
- a rate of 0 is **rejected everywhere**, with one shared message — `pause()` is how you stop.
  Two of the three engines already rejected it; the WAAPI engine now agrees.

React Native keeps whole-run time on `createRunClock`, because its shared value holds the
position within ONE iteration and `withRepeat` never reports how many have elapsed — under
`alternate` the value runs backwards rather than wrapping, so the count cannot be recovered
from it.

`getCurrentProgress()` / `setCurrentProgress(p)` were added alongside, as the read/write twins
of the components' `progress` prop: 0–1 of the whole run, and of ONE iteration when endless.

## 🟠 Inconsistent surface

### 4. ✅ Loading the web player writes three `window` globals

`PxAnimator.ts:276-280` assigns `window.createAnimator`, `window.loadTagAnimators` and
`window.setupAnimationTriggers` whenever the module loads — ESM and CJS consumers included, not
just `<script>` pages.

- It can overwrite a page's own `createAnimator`, and it makes the module side-effectful. None of
  web / react / vue / rn declares `"sideEffects"` (core does), so bundlers keep every module anyway.
- The UMD already exposes all three on `window.PixodeskAnimator`, which is what the editor's SVG +
  JS export calls.

Done 2026-09-12. The block is gone and web / react / vue / rn now declare `"sideEffects": false`.

Nothing relied on the bare globals, which was checked before removing rather than assumed:

- today's editor export emits `PixodeskAnimator.createAnimator({…})` — the UMD namespace, not the
  bare names;
- the older exported `.svg` files that *do* call `window.createAnimator` are self-contained —
  each inlines its own player and assigns those names itself (`window.createAnimator=function(…)`),
  so a change here cannot reach them;
- no fixture, example or test in either repo reads them.

`PxAnimatorBind` still assigns `window[debugGlobalName]` for a document that opts in — that is
inside a function, not at module load, so it does not make the module side-effectful.

### 5. ✅ No error channel outside React Native

- React Native has `onError` + `fallback`.
- Web: a failed `src` fetch or an invalid document goes to `console.error`, and the returned proxy
  answers `isReady() === false` forever (`PxAnimator.ts:224-237`).
- `PxAnimatorCallbacksConfig` has no `onError`, so React and Vue cannot offer one either.

Done 2026-09-12. One channel on `PxAnimatorCallbacksConfig`, implemented once in core's
`playback/PxDiagnostics.ts` and surfaced on every player:

| | |
|---|---|
| `onWarn(diagnostic)` | survivable — the animation still plays. Falls back to `console.warn`. |
| `onError(diagnostic)` | could not play at all: a document that failed to load, parse or render. Falls back to `console.error`. |
| `silent` | `true`, or just the kinds to quiet. Suppresses the console FALLBACK only — handlers still fire, so it is not a mute button. |

Every diagnostic carries a `kind` saying **who can act on it**, because severity and source are
different axes: `invalid animation document format` is a document problem *and* fatal, while an
effects-shape warning is a document problem that still plays. Splitting the callbacks by source
would have meant four handlers and forced anyone who just wants everything to wire them all.

| `kind` | who fixes it | examples |
|---|---|---|
| `document` | regenerate or repair the file | effects shape, unknown keys, `invalid animation document format`, no/unresolved bindings, a `scroll.subject` that is not a valid selector, a blocked SVG tag |
| `host` | fix the page or app | no root element, a selector that matched nothing, `setAttribute` finding no element, a failed fetch |
| `platform` | nothing — the player degraded | unsupported CSS attrs, `smoothing` needing the built-in driver, native scroll-timeline construction failing, react-native-svg prop limits |
| `usage` | fix the options or props you passed | two control tiers at once, `config override:` warnings, a rate of 0, `animator.trigger` on a scroll timeline |
| `internal` | report it to us | could not build the animation, compile or render the document, a render that threw |

So a host can route instead of just logging — surface `document` in a CI check, quiet `platform`,
alert on `internal` — and `silent: ['platform']` expresses exactly that. The payload is an object
from the start, so adding stable per-diagnostic codes later is additive rather than breaking.

A player warns and carries on rather than throwing at the caller, which is why the advisory
channel is `onWarn` and not a second error path. Handing over a handler means taking over: the
console stays out of it, so nothing is logged twice.

Vue takes these as function PROPS rather than emits. An emit handler always exists whether or
not anyone listens, so wiring them to `emit` would have silenced the console fallback for every
Vue user who never subscribed.

**Everything** is routed: the web entry (load and parse failures, effects and config-override
warnings), both web engines, the scroll binder and driver, the trigger wiring, the DOM renderer,
every component-level warning in React, Vue and React Native, and React Native's error boundary.
No `console.warn` or `console.error` call remains in any of the four player packages.

The last four modules took no `callbacks`, so each gained an optional trailing channel —
`setupAnimationTriggers(api, config, diag?)`, `renderNode(node, defs?, diag?)`,
`createScrollDriver(…, diag?)` / `createNativeScrollTimeline(…, diag?)` /
`resolveScrollSubject(…, diag?)`, and a `diag` prop on `PxRnErrorBoundary`. Optional because
three of them are public exports: omit it and they report on the console exactly as before.

React Native keeps its richer `onError(error, componentStack?)` — the boundary hands it a
component stack — and adapts it into the channel rather than narrowing the published signature.

### 6. ✅ `startOn` is typed four ways

| Surface | Accepts `'programmatic'` |
|---|---|
| `createAnimator` option | yes — `PxTrigger['startOn']` |
| Vue prop | yes — its own inline union |
| React prop, React Native prop | ✅ yes, since `PxStartOn` (was `StartOn`, which omitted it) |
| both CSS animators | typed yes; documented as never starting there |

~~The exported `StartOn` type disagrees with the wire enum it names.~~ Fixed 2026-09-12: one
`PxStartOn` derived from the schema, including `'programmatic'` (schema-naming-review.md §2.7).

**Done 2026-09-12** — documented rather than narrowed. The two CSS animators implement four of the
five: `'load'`, `'mouseOver'`, `'click'` and `'scrollIntoView'` (the last via an IntersectionObserver
whose threshold is the `scrollIntoViewThreshold` prop since §13 — it was a fixed 0.1). They expose no
`play()`, so `'programmatic'` has no meaning there. Both props keep the shared `PxStartOn` type —
one enum per wire key, per schema-naming-review.md §2.7 — and each now documents `'programmatic'`
as not supported there, pointing at the JSON player for code-driven starts.

### 7. ✅ Control-mode precedence differs per component

Done 2026-09-12. One rule, one place: `resolveControlMode` in core's `PxAnimatorConstants.ts`
returns the mode *and* the warnings, so react / vue / rn share the order and the wording
instead of each re-deriving them.

| Priority | Props | Mode |
|---|---|---|
| 1 | `progress` / `time` | `fixedTime` — seek and hold |
| 2 | `play` / `pause` | `play` |
| 3 | `autoplay` | `autoplay` — the document's own trigger |
| 4 | none of them | `static` — nothing plays |

`apiRef` is deliberately absent: it never picks a mode (§1). A losing tier warns once, naming
both props and the winner, so `autoplay` + `progress={0.5}` now seeks on all three **and** says
why. `autoplay: false` is not a control prop and does not claim the mode; `play: false` is one,
and holds where it is (§8).

### 8. ✅ `play={false}` jumps to the end

React (`:432-434`), Vue (`:303-305`) and React Native (`:527`) all call `finish()`. A boolean whose
`false` means "finish" is not what anyone guesses.

Done 2026-09-12: it **pauses**, on all three. "Not playing" now means "holds where it is" — the
one reading that moves nothing. `cancel` was the alternative, and would have given `false` a
meaning distinct from `pause`; pausing won because a boolean flipping to `false` should never
make the frame jump. Guarded by React's "play={false} HOLDS where it is": `onPause` fires and
`onFinish` does not, on the same document object, so a remount cannot satisfy it by accident.

### 9. ✅ Three identical API interfaces

`ReactAnimatorApi`, `VueAnimatorApi` and `RnAnimatorApi` declare the same eight methods
separately, none derived from core's `PxAnimatorAPI`. They have started to drift (React Native's
`setPlaybackRate` comment drops "negative plays backwards").

Done 2026-09-12. Core's `PxAnimatorHandle` = `PxAnimatorAPI` minus `isReady` / `getRootElement` /
`destroy`; the three names are now aliases of it, so the drift is gone by construction.

The same rule was then applied to every other shape the components had each spelled out:

| in core | was copied in |
|---|---|
| `PxPlaybackOverrideProps` — `config`, `resetDocDefaults` + the four shortcuts | React props, RN props, RN `ConfigOverrides`, Vue `DocOverrideProps` |
| `PxControlProps` — `progress` / `time` / `play` / `pause` / `autoplay`, now documented | React props, RN props, Vue `DocOverrideProps` |
| `PxComponentCallbacks` — the player's callbacks + `onStop` | React props + `PixodeskSvgAnimatorCallbacks`, RN props |

React's and React Native's props `extend` the three; Vue's runtime `props: {…}` block stays (Vue
needs runtime declarations) but its TypeScript view derives from them. React Native keeps its
richer `onError(error, componentStack?)` via `Omit`. While there, `PxAnimatorConfigShortcuts.startOn`
was a bare `string` — it is `PxStartOn` now.

### 10. ✅ Two whole-document validators

- `validateDocument(doc)` — strict, one message per problem with its path.
- `isPxElementFileFormatDeep(doc)` — non-strict, `{ valid, errors: ['Document failed schema validation'] }`,
  never says what failed.

Done 2026-09-12 — merged, not deleted. `Deep` is still called by the editor on OPEN
(`PxSchemaValidationUtil.step03_playerFileFormat`), where it is deliberately non-strict: a key
from a newer version is worth a warning there, never a refusal. So `validateDocument` gained
`{ strict?: boolean }` (default `true`, unchanged) and `Deep` is now one line over it with
`strict: false`. One implementation, and every problem `validateDocument` can name comes back
with its path instead of one blanket sentence. Side effect to know about: `Deep` now also runs
the effects, easing-ref, glyph-font and version-stamp checks it never ran before — the ones the
player itself warns about at load, which is exactly what that editor step exists to catch.

### 11. ✅ `createAnimatorImpl`

Six positional parameters, `config` object-only (`createAnimator` also takes a JSON string), marked
internal — yet one of the eleven names on the `PixodeskAnimator` UMD global.

Done 2026-09-12: off the UMD, off the ESM/CJS surface, and no longer `export`ed at all — nothing
in either repo called it (the editor, the examples, the e2e fixtures and the exported SVGs all go
through `createAnimator`). The other ten UMD names were audited the same way and stay: each is a
documented `●` / `○` call with a real runtime consumer (`loadTagAnimators` from the docs and
e2e pages, `createAnimator` from every exported SVG+JS, the rest by hand-written pages per the
reference).

### 12. ✅ `onFinish` is documented as "natural finish only"

The JSDoc on core's `PxAnimatorCallbacksConfig.onFinish` and React's `onFinish` says "finishes
naturally", but `finish()` fires it too — WAAPI through the native `onfinish`, the frame loop
through `finishAnim(true)`, React Native directly.

Done 2026-09-12: both comments, plus the same sentence in the React, Vue and React Native
READMEs ("Called on natural finish" / "finished naturally"). All five now say the same thing:
reached the end — every iteration played, or `finish()` was called — and not when stopped early.

## 🟡 Smaller

13. ✅ **CSS animators (React and Vue).** `outAction: 'reverse'` is accepted but acts as `'continue'`;
    `scrollIntoView` starts at a fixed 10 % visibility, while the player's default is 0 and the
    wire has `scrollIntoViewThreshold`. Narrow the type to what works, and take a threshold prop.
    *Done 2026-09-12:* both take `scrollIntoViewThreshold`, defaulting to the wire default (0 —
    the JSON player's, not a private 0.1), and compare the observer's ratio against it — with a
    threshold above 0, `isIntersecting` alone (true at one visible pixel) could never report
    "out". `'reverse'` keeps the shared `PxOutAction` type per §6 and is documented as acting
    as `'continue'`: a class toggle cannot run CSS keyframes backwards.
14. ✅ **`setupAnimationTriggers`** only adds listeners and returns the API — there is no way to detach
    them. It also accepts a `PxTrigger` and ignores its `finishAction`. Return a disposer.
    *Done 2026-09-12:* returns a disposer; both engines tie it to `destroy()`, so the listeners
    finally go when the animator does. `finishAction` is documented as the player's, not the
    wiring's. Guarded by "the disposer detaches every listener it attached".
15. ✅ **`loadTagAnimators()`** takes no options (no callbacks, no override), and nothing calls it
    for you. Accept `{ callbacks, config }`, or keep it as the documented zero-config path.
    *Done 2026-09-12:* `loadTagAnimators(options?: PxTagAnimatorOptions)` — everything
    `createAnimator` takes except `src` / `data` / `container`, applied to every player it
    creates. Omit it for the zero-config path, which is unchanged.
16. ✅ **No URL form on the components.** React, Vue and React Native take `doc` only; the web
    player takes `src`. *Closed 2026-09-12 — intended, not a gap.* In a component tree the
    document is data the app already owns: it imports the JSON, or fetches it with whatever the
    app uses (a loader, React Query, a server component) and passes the result down. Fetching
    inside the components would mean owning loading and error states, SSR and caching — a second,
    worse data layer beside the app's own. The web player takes `src` precisely because a plain
    `<script>` page has no such layer. The stale "accept a URL" TODO on the React `doc` prop is gone.
17. ✅ **The web package lacks the schema-version API** (`PX_PLAYER_SCHEMA_VERSION`,
    `convertPlayerDocument`, …), `diagnoseDocument`, and the timeline / pin / scroll schema values.
    A web-only user needs a second install for them. Re-export, or keep the "core only" note
    the API reference (now the guides under docs/library) now carries. *Done 2026-09-12:* re-exported from the ESM/CJS entry (not the
    UMD, which cannot tree-shake); the "core only" note now lists only what really is.
18. ✅ **React Native has no `onRemove`.** *Done 2026-09-12:* fires from the unmount / doc-swap
    cleanup, with `onStop` alongside — the same meaning as the web's `destroy()`. The React
    Native doc's "never called" row is gone; it is no longer a difference.
19. ✅ **Old engine words in exported JSDoc**, which users see as IDE hover text: `createAnimatorImpl`
    "chooses 'waapi' or 'frames'" and "`auto` and `native` resolve to `waapi`" (`PxAnimator.ts:38`,
    `:77-80`); React Native's `config` prop "materializes the WAAPI-style flattening" (`:83-84`)
    and `compileDocument`'s "waapi" / "frames flavor" notes (`:321-327`); the
    `index.prerendered*.ts` headers ("animator mode is `auto` or `frames`", "`waapi`").
    *Done 2026-09-12:* every span rewritten in `timeline.engine` terms (`auto` / `native` / `js`).
    One was wrong rather than stale: React Native's header said its pipeline is "identical to the
    web frames engine", while thirty lines below it explains why it must use the fully-flattened
    `native` materialization and NOT the frame loop. It says `native` now.
20. ✅ **Spelling drift in export names:** British `materialise*`, `getNormalisedBindings`,
    `sanitiseAttributeValue`, `PxNormalisedKeyframe` next to American `normalizeDocument`,
    `getNormalizedProps`. The web package re-exported `getNormalisedBindings` as
    `normalizeDocument`. Pick one spelling for API names. *Done 2026-09-12* in the
    "Standardise spelling" commit: American, repo-wide — `materialize*`, `getNormalizedBindings`,
    `sanitizeAttributeValue`, `PxNormalizedKeyframe`, 140 files. Verified afterwards rather than
    assumed: no old name is left anywhere in the player repo (source, JSON, fixtures, docs), every
    package typechecks and its suite passes, and the editor app typechecks against the renamed
    core. The rename also rewrote this item's own text into "British `materialize*`"; the
    historical names above were restored by hand — a future spelling pass will hit them again.
21. ✅ **Type-only enums.** ~~`FillMode`, `PlaybackDirection`, `StartOn` and `OutAction` have no
    runtime value and no `Px` prefix, unlike every other wire selector.~~ Fixed 2026-09-12: they are
    `PxFillMode` / `PxPlaybackDirection` / `PxStartOn` / `PxOutAction`, each an exported const
    namespace plus the type derived from it (schema-naming-review.md §2.7).
22. ✅ **`progress` with `iterations: 'infinite'`** maps 0–1 onto a single iteration in all three
    components; the prop comments say "duration × iterations". *Done 2026-09-12:* the comments
    say "of ONE iteration when endless" (the rule §3's `progressSpanMs` made explicit), and React
    and Vue now map the prop with core's `progressToTimeMs` instead of their own arithmetic — a
    pure swap, since both already treated `'infinite'` as one iteration; it just could not drift
    from `getCurrentProgress` any more.
23. ✅ **React adapter noise.** A missing element logs the whole element map
    (`console.warn(elementRefs.current)`, `PixodeskSvgAnimator.tsx:207`). *Done with §5:* the map
    rides as the diagnostic's `detail`, where a handler can inspect it and the console stays
    readable.

24. ✅ **The props table, read across.** Four names meant one thing each and were spelled by
    surface: `data` (web) vs `doc` (components) for the document; `config` for the override,
    which said nothing about what it overrides — the `animator` block has exactly `timeline`,
    `definitions`, `animateById`, `debugGlobalName` and `version`, and `timeline` is the whole
    useful surface; `resetDocDefaults`, not linked to `config` by name; and the web player took
    callbacks grouped in `callbacks` where every component took them inline (and had `onStop`,
    which the web did not). *Done 2026-09-12, no aliases:* `doc` everywhere
    (`PX_ANIMATOR_DOC_KEY = 'doc'` — the editor's exporter follows); `timeline` is the override,
    a patch of the document's `timeline` block (or a JSON string), with `resetTimeline` beside
    it (`PX_ANIMATOR_TIMELINE_KEY` / `PX_ANIMATOR_RESET_KEY`); `foldTimelineOverride` in core;
    and `createAnimator({ onPlay, …, onStop, onWarn, onError, silent })` inline, the same
    `PxComponentCallbacks` the components extend — `toEngineCallbacks` folds `onStop` into
    pause / cancel / finish / remove, making no wrapper when nothing was given, so the console
    fallback still sees "no handler". Guarded by "takes the callbacks INLINE, and fires onStop
    after pause / finish" and the `timeline` option tests (web, React, Vue).

## The reference itself

✅ *Done 2026-09-12 — checked, not generated.*

the API reference (now the guides under docs/library) is written by hand and had drifted again — the `window` globals, `PxStartOn`, the
React example that combined `autoplay` with `apiRef`, the missing version API. The original idea was
to generate its "Everything else" tables from `dist/index.d.ts`. Generation would have flattened
what makes the tables worth reading — the cross-player matrix, the Notes column, the ●/○/▪ marks,
the grouping — so the docs stay hand-written and are *checked* instead: every table, reference block
and export list in the public markdown carries a `<!-- px-check … -->` comment naming the type,
package or runtime schema it documents, and `tools/docs-check` (a vitest suite over the five
`dist/index.d.ts` files and core's `describeSchema`) fails the build when they disagree — members,
optionality, inlined types, exports listed once and completely, schema keys, discriminated unions.
Marker grammar and per-row annotations: [tools/docs-check/README.md](../../tools/docs-check/README.md).
Wired into `pnpm build` and `pnpm test`; 114 checks over 18 files, 75 markers.

Its first run found what a review by eye had missed: `onWarn` / `onError` / `silent` absent from
three prop blocks, `scrollIntoViewThreshold` absent from both CSS wrappers (§13 had added it), ~80 web
re-exports and 7 core exports undocumented, `PxScrollPhase` listed twice, five wire enums
(`PxMaskType`, `PxPathOverflow`, `PxLengthAdjust`, `PxTextPathMethod`, `PxTextPathSpacing`) and
`PxClipPathEffectSchema` documented as exports but never exported (now they are), the `clipPath`
effect documented under `d` where the wire key is `pathData`, `domType` and the static `value`
baseline missing from the format typings, `repeater.skew` missing, and the React Native component
described as an `FC` it is not.

## 25. ✅ Polish list — complete (2026-09-13)

A second read of docs/format/README.md and the API reference (now the guides under docs/library) against the code, after everything above closed.
Nothing structural is left. Behaviour and shape polish is here and closed; the pure identifier /
interface renames moved to their own review — api-surface-review.md — where they keep their
§26 numbers, so a `review §26.x` in the code still finds its item.

| # | Now | Proposed | Why | Cost |
|---|---|---|---|---|
| 25.1 ✅ | RN `onError(error, componentStack?)` | *Done 2026-09-13:* `onError(d: PxDiagnostic)` on every player, `d.error` the Error, `d.detail.componentStack` from the boundary; `fallback(error)` unchanged. With it THE RULE, now in code and docs: `onError` = this instance will not play (nothing rendered, `isReady()` false, `fallback` shown); `onWarn` = it plays, but something was ignored, degraded or misspelled. RN stops reporting a crash twice (a warning + `onError`); the web player catches a synchronous failure of `createAnimator({ doc })` and the pre-rendered entries, reports it and returns an inert API instead of throwing half-way through construction | the one structural inconsistency left in the "one diagnostics channel" (§5) | rn + web |
| 25.11 ✅ | `node.style: string` meant BOTH "CSS text" (docs/format/README.md) and "a name in `definitions.styles`" (`resolveStyle` treats every string as a name, so CSS text resolves to `undefined`) | *Done 2026-09-13 (naming review 2.13):* `definitions.styles` and the name form are gone — `style` is an object only; presets can come back as `styleWith` under the `…With` convention | the same polymorphism that `animateById` had; nothing wrote it | core + docs |
| 25.12 ✅ | `style` keys were CSS property names (`white-space`) while attributes are camelCase (`strokeWidth`) — and already mixed (`mixBlendMode` beside `white-space`) | *Done 2026-09-13:* camelCase like React's `style` prop everywhere (`whiteSpace`, `pointerEvents`); the editor converts to CSS names when it reads a record into its attribute bag; players were already spelling-agnostic; 47 fixture files migrated | one spelling rule for the whole document | editor + docs |
| 25.13 ✅ | `silent?: boolean \| Array<PxDiagnosticKind>` — muted the console fallback for warnings AND errors, whole or by kind; the name said nothing about which | *Done 2026-09-13:* `muteWarn?: boolean`, `muteError?: boolean` — plain switches, one per severity, named after the callback they pair with. Intent, in code and docs: a way for a host that knows the player has something to say about a document, and tolerates it, to keep it out of the console; a handler you passed still fires. The per-kind list is gone — a handler that filters on `kind` is one line | "silent" was not linked to `onWarn` / `onError` by name and hid two switches in one value | core + 4 players + docs |
| 25.14 ✅ | `adapter` was a public option of `createAnimator` and of the pre-rendered entries — "○ advanced" — though nothing outside this repo can want it: a page has a DOM to write to | *Done 2026-09-13:* off the public options. `PxAnimatorOptions` is the public shape; `PxInternalAnimatorOptions extends PxAnimatorOptions { adapter? }` is what the React and Vue components build the player with (their frame loop writes to the elements they rendered) — exported as a type so they can name it, listed under the web internals, never as an option. `createAnimator(options: PxAnimatorOptions)` keeps its signature and reads `adapter` through a type guard when a component passed one; `PxPrerenderedOptions` lost the field outright (a pre-rendered SVG is already in the DOM). Core's `createBasicFrameLoopAnimator(doc, adapter, …)` and `PxPlatformAdapter` stay public — that is the platform-neutral engine API a new platform plugs into | an internal extension point was on the public surface | web + react + vue + docs |

**Done 2026-09-13:** `animator.animateById` → `animator.bindings`, a list of
`{ target: "#id", animateWith: ["a0", …] }` — names into `definitions.animations` only, no inline
keyframes (the editor has never written any there); `node.animate` untouched; still schema `1.1`.
The `…With` naming convention is recorded in schema-naming-review.md (Part 1 + 2.12).

## Suggested order

| | Items | Why |
|---|---|---|
| 1 | ✅ 1, ✅ 2, ✅ 3 | a user sees wrong or divergent behavior |
| 2 | ✅ 4, ✅ 5, ✅ 6, ✅ 7 | surface decisions — cheaper before the first release |
| 3 | ✅ 8, ✅ 9, ✅ 10, ✅ 11, ✅ 12 | naming and duplication |
| 4 | ✅ 13, ✅ 14, ✅ 15, ✅ 16, ✅ 17, ✅ 18, ✅ 19, ✅ 20, ✅ 21, ✅ 22, ✅ 23 | as convenient |
| 5 | ✅ 24 | the props table read across — one name per thing, on every surface |
| 6 | ✅ The reference itself | the docs checked against the code, so none of the above can drift back |
| 7 | ✅ 25 | the second read: behaviour and shape polish. The pure renames (§26) moved to api-surface-review.md, which also audits the whole export surface |

✅ 1 and ✅ 7 were one change: the control mode is now resolved once, in core. 16 was closed as
intended behavior (the app owns its data layer), 20 by the spelling commit. "The reference itself"
closed last, as a check rather than a generator — see above.
