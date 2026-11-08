# Schema 1.21 — what still deserves improvement (2026-11-04)

Distilled from the owner's notes (`schema-and-props-review-feedback3--manual.md`, marked **M**) and three outside reviews
(`…feedback4.md` **A4**, `…feedback5.md` **A5**, `…feedback6.md` **A6**), each point checked against the source as it is now.
Decided items live in [schema-and-props--manual-review.md](schema-and-props--manual-review.md). §0 was IMPLEMENTED on 2026-11-05 as schema 1.22–1.23 (all but U4); progress and the semantics chosen while implementing: [schema-and-props--improvements.progress.md](schema-and-props--improvements.progress.md).

Legend: ⭐ my recommendation · cost S / M / L · "wire" = another schema step.

## 0 · Decision ledger (owner, 2026-11-04) — overrides the ⭐ marks in §2

IMPLEMENTED 2026-11-05 (except U4). `#n` points at the analysis row in §2. The wire renames went out as TWO steps (each wire change its own step): 1.22 `playbackSpeed`, 1.23 the action words.

### The new action model (replaces reset / rewind / completeIteration)
Every move names a **destination** (`Start` | `End`) and a **manner** (`jump` = at once, `animate` = play there); `hold`, `continue`, `pause` stay as they are.
A stop that reaches the end **runs the finish action** — so "stop after the current pass" is `stop: 'animateToEnd'` and `completeIteration` is gone; `finish: 'animateToStart'` after it is an explicit two-leg chain.
`jumpToStart` lands on the idle pose (`whenIdle`: the file's static attributes, or the first frame). On a loop, `animateToEnd` = the end of the current pass.
The same words serve `start`: `jumpToStart` (from the top, then play — was `restart`), `jumpToEnd` (the end pose, then finish), `continue`.

### ADD
| What | Why / where | Row |
|---|---|---|
| `stop: 'jumpToEnd' \| 'animateToEnd'` | a stop may go to the end; arriving there runs `finish` | #3 #14 |
| `resume` in the trigger override type (`PxActionTriggersInput`), derived when omitted | the file and the prop get the same power | #6 |
| registry event `stop` in `PxAnimationPlayersEvent` | the event set = the callback set | #12 |
| `getTotalPlaybackTime()` (run position in playback ms); optional `getTotalProgress()` | completes the matrix, GSAP has `totalProgress` | #1 #2 |
| a TypeScript union over the control props — one driver family compiles at a time (`playUsingActionTriggers` \| `play`/`pause` \| `playState` \| `showAtProgress` \| `showAtTime`); the PX1501 warning stays for JS | same treatment for every `play*` / `show*` prop | #11 |
| `SvgCssAnimationPlayerProps` DERIVED from `SvgAnimationPlayerProps` + a type-level subset guard + TSDoc cross-references both ways (React and Vue) | the CSS component can never drift from the JS one | #19 |
| a behaviour-contract section + one test per row, in the new words: stop reaching the end → finish; `getPlayState()` during an `animateTo…` leg; negative speed × `reverse`; `play()`/`setPlaybackSpeed()` on scroll timelines; `play={false}` on mount = no stop action | | #14 |
| docs + editor hints: the action words in ONE table (schema TSDoc, docs, panel tooltips); `whenIdle` explained as the split `animation-fill-mode` | | #3 #4 |

### REMOVE
| What | Why | Row |
|---|---|---|
| `actions.stop.completeIteration` | = `stop: 'animateToEnd'` | #3 |
| `null` as "delete this key" in `timelineOptions` / `actions` | a patch only sets values — set the value you want; the type loses `\| null` | §3 |
| the words "wall time" / "real time" in docs and comments | two clocks only: model time and playback time (`delay`, `inViewDebounce`, `frameRate` are playback ms) | #15 |
| `onReset` callback (+ Vue event `reset`, registry event `reset`) | a "back at the start pose" STATE callback nobody needs: it fires on `reset()`, a `reset`/`rewind` preset, `outOfView: reset` and even on `destroy()` — a mix no page can act on. What remains says it all: `onStop` (the stop action was performed, incl. `jumpToStart` / `animateToStart` as its preset), `onFinish` (the end reached), `onDestroy`; the unconditional handle call `jumpToStart()` reports nothing, like `setCurrentTime()`. `getPlayState() === 'idle'` is the state. | U3 → decided |

### OLD → NEW
| Old | New | Where | Row |
|---|---|---|---|
| `timeline.playSpeed`, `timelineOptions.playSpeed` | `playbackSpeed` | wire 1.22 | #2 |
| `getPlaySpeed()` / `setPlaySpeed()` | `getPlaybackSpeed()` / `setPlaybackSpeed()` | handle | #2 |
| `getPlayDuration()` / `setPlayDuration()` | `getPlaybackDuration()` / `setPlaybackDuration()` | handle | #2 |
| `getTotalPlayDuration()` · `getCurrentPlayTime()` | `getTotalPlaybackDuration()` · `getCurrentPlaybackTime()` | handle | #2 |
| action word `reset` | `jumpToStart` | `stop` · `finish` · `outOfView`, wire 1.22 | #3 |
| action word `rewind` | `animateToStart` | `stop` · `finish`, wire 1.22 | #3 |
| `stop: 'reset' \| 'rewind'` (+ `completeIteration`) | `stop: 'jumpToStart' \| 'animateToStart' \| 'jumpToEnd' \| 'animateToEnd'` | wire 1.22 | #3 |
| `finish: 'hold' \| 'reset' \| 'rewind'` | `finish: 'hold' \| 'jumpToStart' \| 'animateToStart'` | wire 1.22 | #3 |
| `start: 'continue' \| 'restart' \| 'jumpToEnd'` | `start: 'continue' \| 'jumpToStart' \| 'jumpToEnd'` — one vocabulary, no unconnected word; a start preset always plays after its move (`jumpToStart` = from the top, `jumpToEnd` = the end pose, then finish) | wire 1.22 | #3 |
| `outOfView: 'pause' \| 'continue' \| 'reset'` | `outOfView: 'pause' \| 'continue' \| 'jumpToStart'` | wire 1.22 | #3 |
| handle `reset()` (unconditional, now) | `jumpToStart()` — same contract; `stop()` keeps running the file's stop action | handle | #3 |
| `playWhile` / `pauseWhile` (1.21) | back to `play` / `pause` — "…While" reads oddly and appears nowhere else; `playState` STAYS beside them (the one-word form); whether the booleans need a better name is left for a later iteration | React, Vue, RN props; `PxControlProps`, `PxDeclarativeProps`, docs, cheat sheet, learn videos' generator | U1 → decided |
| `SvgCssAnimationPlayer` prop `actionTriggers` | `playUsingActionTriggers` — the JS component leads | React, Vue | #5 |
| `SvgCssAnimationPlayer` top-level `inViewThreshold` / `inViewDebounce` | inside `timelineOptions`, as on the JS component | React, Vue | #9 |
| `createSvgAnimationPlayersFromPage({ playUsingActionTriggers?: Triggers })` | `boolean \| Triggers`, as everywhere | web | #5 |
| `onWarn` (+ Vue event `warn`) | `onWarning` (+ `warning`) | callbacks | #18 |
| `playLevelsOf(props)` | `playStateToLevels(props)` — says what it does: the `playState` word → the two booleans (`play`, `pause`) the executor is driven by; `/internal` unless a player author needs it | core | #10 |
| `PxPatch<T>` | `PxRecursivePartial<T>` — deep partial, arrays replaced whole, no `null` | types | §3 |
| `PxTimelinePatch` · `PxActionsPatch` | `PxTimelineOptions` · `PxActionsOptions` (the prop's own words) | types | §3 |

### KEEP
| What | Why | Row |
|---|---|---|
| `getCurrentTime()` / `getTotalTime()`, `getDuration()` / `getTotalDuration()`, `getCurrentProgress()` | GSAP's precedent is exactly this: `time` / `totalTime`, `duration` / `totalDuration`, `progress` / `totalProgress` — "total" = including repeats; one docs line says so | #1 |
| `whenIdle` (its doc improves) · `engine: 'native'` · `timelineOptions` + `actions` · `onSvgAnimationPlayersChange` (name, for now) | | #4 #13 #8 #12 |
| `playUsingActionTriggers` as THE trigger prop on every surface | the most recently designed surface leads | #5 |
| `actions.start: 'continue'` | | — |
| `actions.start: 'jumpToEnd'` | `iterationDirection: 'reverse'` cannot replace it — a reversed one-shot still *plays* (end → start) when started, while the preset shows the end pose with NO motion and lets `stop: 'animateToStart'` retreat (an overlay that appears at once and leaves animated); it fits the jump/animate vocabulary and costs nothing | — |
| `actionTriggers` keyed by action · `playerRef` · `inViewDebounce` · `version` · `playbackSpeed` over `playbackRate` | | §3 |

### UNDECIDED
| # | Question | Ranked options |
|---|---|---|
| U4 | **Effect names** (#20) | ⭐ A: drop `…By` (`effects.transform`, `effects.mask`) · B: only `transformBy` → `transform` · C: `…Effect` on all · D: keep. |

## 1 · The owner's questions, answered from the source

| Question | Answer |
|---|---|
| **`playLevelsOf` — what for, why the name?** | Core helper (`PxAnimatorConstants.ts`): turns the props `{ playWhile, pauseWhile, playState }` into the two booleans the executor is driven by (`playing` → play, `paused` → play + pause, `idle` → stop). Exists so React, Vue and RN resolve `playState` identically. Used by the three components only; `@advanced`. The name is poor — the executor calls the booleans "levels" (held while true), but nobody outside knows that word. → §2 #10. |
| **`getTotalDuration()` / `getTotalPlayDuration()` — "doesn't make sense"** | `getTotalDuration` = duration × iterations in model ms (`null` when infinite); `getTotalPlayDuration` = the same divided by the speed. The *values* are sound; the *word* "total" reads as a length, so `getTotalTime()` (a position) collides with it — the same point A4 makes. → §2 #1. |
| **Missing `getCurrentPlayTime()` / `getTotalPlayTime()`** | `getCurrentPlayTime()` exists (iteration time ÷ \|speed\|). A run-position twin (`getTotalPlayTime`) is indeed missing — it falls out of the family fix in §2 #1. |
| **Where is `jumpToEnd` needed?** | Two places: (1) the file's `actions.start: 'jumpToEnd'` — a one-shot shown at its end pose at once, paired with `stop: 'rewind'` so it retreats animated (overlay art, badges; the editor's hint says exactly this); (2) the handle's `jumpToEnd()` (`@advanced`) is what that preset calls and what a "skip" button calls. Nothing else needs it. |
| **`PxDiagnostic` — what for?** | The one shape of every warning/error a player reports (`onWarn` / `onError` and the console): `{ code, kind, data }`. The sentence is NOT shipped — `docs/diagnostics.md` carries it; a page switches on the stable number instead of matching text. Fine as is. |
| **`onSvgAnimationPlayersChange()` — what for, where used?** | The registry's listener: add / remove / play / pause / reset / finish of any player on the page. Consumers today: the website's dev-only animation monitor, the editor's render-diff overlay, the video test clock (`PlayerClock.ts`). Public because page-level tooling (analytics, "pause everything" buttons) needs it; the name/event-set issue is §2 #12. |
| **`animator.definitions` names** | `easings`, `animations`, `fonts` — one noun each, referenced as `easing: 'name'`, `animateWith: ['name']`, `font: 'name'`. All good; nothing to change. |
| **`whenIdle` — strange name; must idle return to the static form? Isn't that CSS fill-mode?** | Yes, it is exactly `animation-fill-mode` split in two: `whenIdle: firstFrame` = `backwards`, `finish: hold` = `forwards`, both = `both`; core has `fillModeOf(whenIdle, finish)` for the CSS/WAAPI engines. On the default (`static`) the file's static attributes show while idle. For every editor-made file that IS the first frame (the format's rest-pose contract), so the choice only matters for hand-written files. Name options in §2 #4. |

## 2 · Improvement candidates, ranked (analysis — §0 decides)

| # | Area | Problem | Options | Cost | Raised |
|---|---|---|---|---|---|
| 1 | **Time family: "total" reads as a length, "current" does not say "one iteration"** | `getTotalTime()` is a position next to `getTotalDuration()`, a length. The run axis has no real-time position at all. | ⭐ **A** keep plain = one iteration (the common case stays shortest), say "run" for the whole run: `getRunTime/setRunTime`, `getRunDuration`, `getRunPlayDuration`, `getRunPlayTime` — one short word, never a length/position pun. **B** (A4) `getElapsedTime/getElapsedPlayTime` for run positions, keep `getTotal…` for lengths — but the owner rejected "elapsed" once (paused time is not elapsed). **C** (M) `getIterationTime/getIterationProgress` for the pass and plain names for the run — regular, but the common case gets the long name. | M, no wire | M, A4, A5 |
| 2 | **`play` vs `playback`** | "Play speed", "play duration" are not idiomatic; media UIs and APIs say *playback speed* / `playbackRate`. The verbs `playWhile` / `pauseWhile` are a different family and stay. | ⭐ rename the real-time family to `playback…`: wire `timeline.playbackSpeed`, handle `get/setPlaybackSpeed`, `getPlaybackDuration`, `getCurrentPlaybackTime`, `getRunPlaybackDuration`… (+4 chars). Alt: keep `play…` and state in docs that `play…` = playback time (A5 accepts it). Reopens a decided name — owner's call; do it together with #1 if at all. | M (wire 1.22 + handle) | M |
| 3 | **Action behaviour words are hard to think about** | `stop: reset \| rewind`, `finish: hold \| reset \| rewind`, `outOfView: pause \| continue \| reset`: "which way back?" is not in the word. `reset` = jle idle pose at once, `rewind` = play backwards to the start then idle. | ⭐ keep the words, put ONE explanation table everywhere (schema TSDoc, docs, the editor's hints): *reset = jump to the idle pose · rewind = play backwards to it · hold = stay · continue = keep going · restart = from the top · jumpToEnd = last frame at once*. Alt: encode the manner — `stop: 'jumpBack' \| 'playBack'` — new words with no precedent, and `reset` is not "jump to frame 0" when `whenIdle: static`. | S (docs) / L (wire) | M |
| 4 | **`whenIdle`** | The name describes a state, not what is shown; CSS users think "fill-mode". | ⭐ keep the key, add "= `animation-fill-mode` backwards/none" to its TSDoc and docs, and rename the values' explanation ("as authored" for `static`). Alt names if renaming: `idleFrame: 'static' \| 'first'`, `restPose` (core's own word). | S / M (wire) | M, A4 |
| 5 | **Two prop names for one block** | `SvgCssAnimationPlayer` takes `actionTriggers`, `SvgAnimationPlayer` takes `playUsingActionTriggers`; the page-wide creator's type drops the boolean. A6 also calls the long name a "verbosity tax". | ⭐ one name on every surface. Candidates: `actionTriggers={true \| false \| {…}}` (the file's key, short; A4) vs keeping `playUsingActionTriggers` on the CSS component too. The owner rejected "`triggers` as the switch" on 2026-11-01 — the argument then was that the prop must say it *plays*; a CSS component cannot say otherwise. Decide once, apply to all four surfaces. | M | A4, A6 |
| 6 | **`resume` in the file but not in the override** | `PxActionTriggersInput` omits `resume`; a file can say what a prop cannot. | ⭐ allow `resume` in the override (derived when omitted) — the file and the prop then have the same power. Alt: drop it from the file too (the editor stores a named list today). | S | A4, A5 |
| 7 | **Saved triggers silently ignored** | `<SvgAnimationPlayer doc={x} />` with hover triggers in the file shows a still, no message. Same when a control prop overrides the file (A6 #5). | ⭐ a usage diagnostic when the file has `actionTriggers` and no driver prop names them ("pass `playUsingActionTriggers`…"), and one when a control prop takes over a file with triggers. Structured code, no behaviour change. | S | A4, A6 |
| 8 | **`timelineOptions` vs `actions` mirror** | One prop is suffixed, the other is the file's key. | ⭐ leave — `timelineOptions` was chosen because it is a *merge* over a partial, `actions` is the same merge; A5 explicitly keeps `timelineOptions`. Document the rule once ("both merge over the file"). Alt: `actionsOptions` (ugly) or `timeline` (rejected 11-02). | S (docs) | A4 |
| 9 | **Gate numbers in two places** | `inViewThreshold` / `inViewDebounce` are inside `timelineOptions` on the JS component and top-level on the CSS component. | ⭐ CSS component: take them inside a `timelineOptions` pick too (same shape, fewer surprises). | S | A4 |
| 10 | **`playLevelsOf` name** | See §1. | ⭐ `playStateToLevels` or `controlLevelsOf`; or drop the export (only the three components use it — keep it `/internal`). | S | M |
| 11 | **`playState` beside the booleans is a runtime conflict only** | Both can be typed at once; PX1501 warns. Same for `showAtProgress` + `showAtTime`. | ⭐ a discriminated prop union in TypeScript (`{ playState } \| { playWhile, pauseWhile }` and `{ showAtProgress } \| { showAtTime }`) so the conflict cannot compile; keep the warning for JS. Say in TSDoc that the prop takes the three *requestable* states, `getPlayState()` returns five. | S | A5 |
| 12 | **Registry event set ≠ callbacks** | `PxAnimationPlayersEvent` = add · remove · play · pause · reset · finish — no `stop`, while the callbacks have `onStop`; the listener's name says "players change" but carries playback events. | ⭐ add `stop`; split or rename later only if the registry grows (`onSvgAnimationPlayerEvent`). | S | A4, A5 |
| 13 | **`engine: 'native'`** | Means WAAPI on the web; "native" clashes with React Native. | ⭐ `'waapi'` with `'native'` read as its alias for one version; RN ignores the key anyway. | S (wire, with alias) | A4, A5 |
| 14 | **Behaviour the names do not settle — define and test** | (a) `jumpToEnd()` with `finish: 'reset'` / `'rewind'`: does the finish action run after the jump? (the `start: jumpToEnd` preset calls `api.jumpToEnd()`; whether that fires the natural finish is engine-dependent today). (b) during a `rewind`, `getPlayState()` reads `idle` ("heading there") — say so; when `onStop` / `onReset` fire. (c) negative `playSpeed` × `iterationDirection: 'reverse'` — do they combine? may a file's `playSpeed` be negative? (the schema says positive finite). (d) `play()` / `setPlaySpeed()` on a scroll or view timeline. (e) `playWhile={false}` on mount: already *no stop action* — state it in the TSDoc. | ⭐ one "contract" section in `playback-and-triggers.md` + a test per row; (a) should be: jump, hold, no finish action. | S–M | A4, A5 |
| 15 | **Playback time is not wall time** | Docs and comments mix "real", "wall", "play". Facts: `getCurrentPlayTime` excludes `delay` and paused time (it is a position ÷ speed), rewind motion is not in any duration, `inViewDebounce` and `frameRate` ARE wall ms. | ⭐ one paragraph "three clocks": model time · playback time (model ÷ speed, the `play…` family) · wall time (`delay`, `inViewDebounce`, `frameRate`); drop "wall" from the API comments. The cheat sheet's "wall clock" lines are already corrected. | S | A5 |
| 16 | **RN event words** | `click`, `hoverIn`, `hoverOut` are web words on a shared API. | ⭐ a mapping table in `react-native.md` (`click` = press; hover = none) — no rename. | S | A5 |
| 17 | **Small doc gaps** | `completeIteration` (defers the stop to the end of the pass), `outOfView: 'reset'` (restarts when back in view), the `version` stamp needs one worked example (`"2.1.21.1"`-style), the control order "④ a still first frame" should say "④ idle, per `whenIdle`". | ⭐ docs only. | S | A4, A5 |
| 18 | **`onWarn` → `onWarning`?** | Convention nit. | leave (`onWarn`/`onError` pair reads fine; a rename costs every consumer). | — | A5 |
| 19 | **`SvgCssAnimationPlayer` props must stay a subset of `SvgAnimationPlayer` props, and the two must point at each other** | Today the CSS component declares an anonymous inline prop type (`actionTriggers`, `actions: Pick<PxActions, 'outOfView'>`, top-level `inViewThreshold` / `inViewDebounce`, `className`, `style`, `children`) while the JS component composes the shared core pieces (`PxPlaybackOverride & PxControlProps & PxAnimationPlayerCallbacks`, the gate numbers inside `timelineOptions`). Nothing ties them: a prop can be added, renamed or shaped differently on one side and the other never notices; neither TSDoc mentions the other. Same on Vue (`SvgCssAnimator.ts` vs `SvgAnimator.ts`). | ⭐ (1) one exported `SvgCssAnimationPlayerProps` DERIVED from the JS component's props — a `Pick` of the shared pieces it can honour (`timelineOptions` narrowed to the gate numbers, `actions` narrowed to `outOfView`, the trigger prop under the one name decided in #5) plus its own `children`; never a second hand-written list. (2) a type-level guard (`satisfies`/`Expect<Subset<…>>`) or a vitest over the prop-name lists so the CSS keys ⊆ JS keys and every shared key has the same type. (3) cross-references in the comments of both components, React and Vue: the JS component's TSDoc says "the CSS component takes the same props minus … (see `SvgCssAnimationPlayer`)", the CSS component's says "a subset of `SvgAnimationPlayer`'s props, same names and shapes; what it cannot do and why". (4) the docs' props tables generated or px-checked from the one type. Closes #5 and #9 as side effects. | S–M | **M** (owner) |
| 20 | **Effect names: the `…By` suffix is a rule applied to 2 of 10 keys** | Keys today: `transformBy`, `maskedBy`, `clipPath`, `textPath`, `text`, `clone`, `repeater`, `strokeTrim`, `fillGradient`, `strokeGradient`. If `…By` exists to keep an effect apart from the attribute it writes, it protects `transform` and `mask` only — `clipPath`, `textPath` and `text` carry the SVG word unchanged, and the docs state no `…By` rule at all (only `<key>With` = "by name from `definitions`"). `transformBy` is not even a reference ("by" reads as "by means of"), it is the per-part pose with its own timing; `maskedBy: { source: '#id' }` is one. | ⭐ **A — drop the suffix; `effects.` is the namespace.** Every key is the plain noun of what the effect adds, equal to the SVG word where there is one: `effects.transform`, `effects.mask`, `clipPath`, `textPath`, `text`, `clone`, `repeater`, `strokeTrim`, `fillGradient`, `strokeGradient`. One stated rule: an effect may share the attribute's name because the path qualifies it; the attribute holds ONE pose/value, the effect holds the parts with their own timing and is applied on top (already how `transform` + `transformBy` combine — say it). Precedent: After Effects / Lottie call the group "Transform". Two renames (wire step), editor ids and docs follow. **B — two families by mechanism**: a reference effect ends in `…By` (`maskedBy`, and only it — `clipPath` holds its own path, `textPath` is the SVG element's word), a value effect is a plain noun → rename only `transformBy` → `transform`. One rename, a statable rule, but `maskedBy` stays the lone odd one. **C — suffix everything the same way** (`…Effect`: `transformEffect`, `maskEffect`, `clipPathEffect` …): explicit and uniform, but redundant under `effects.` and long in every file. **D — keep, document** — not honest: the rule cannot be stated. | A: M (wire 1.22 + editor) · B: S | **M** (owner) |

## 3 · Raised, but I would keep as is

| Point | Why keep |
|---|---|
| `actionTriggers` keyed by action, event as value (A6 "inversion") | Several events per action, a fixed allowed-event list per action, and the editor's "Start on / Stop on / Pause on" lists all follow from keying by action; `on: { hoverIn: 'start' }` cannot express "start on load *and* click" without arrays of actions. Decided 2026-10-28. |
| `null` deletes a key in a patch prop (A6) | JSON Merge Patch's rule; `undefined` must stay "not mentioned" in React. Document it next to `timelineOptions` with one example. |
| `playerRef` vs `ref` (A4) | `ref` would have to forward to a DOM node or the handle, never both; the handle is not a DOM node. |
| `playSpeed` vs `playbackRate` (A4, A5) | Both reviews accept `playSpeed`; the only live question is #2 (`play` vs `playback`). |
| `inViewDebounce` → `visibilityDebounce` (A5) | It debounces both edges already; "in view" names the gate it belongs to. |
| `version` → `formatVersion` (A5) | The TSDoc states the reason (`animator.version` already says whose; it is not semver). Add the example (#17) instead. |
| `Patch<T>` in the cheat sheet (A5 "must fix") | The real export `PxPatch<T>` already preserves scalars, replaces arrays and distributes over the union; the sheet showed an abbreviation. Sheet fix: show the real type. |
| The `timeline` ↔ `timelineOptions` rename, `jumpToEnd`, `omit`, `whenIdle`, `playWhile/pauseWhile/playState` | Every outside review calls these improvements; no reopen. |

## 4 · Suggested order

1. Decide #1 + #2 + #20 together (one rename pass over the handle and ONE wire step 1.22 carrying `playbackSpeed` and the effect keys, if adopted) — the only items that touch public names broadly.
2. #19 first (one derived CSS prop type + guard + cross-references), then #5, #6, #9, #11, #12, #13 — consistency of the prop surface; one release.
3. #7 + #14 — diagnostics and the behaviour contract, with tests.
4. #3, #4, #15, #16, #17 — docs, hints, TSDoc; no code.
