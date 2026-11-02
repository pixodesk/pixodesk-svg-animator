# Fix plan after the outside reviews of the animator schema and the component props

Digest of the two replies to [animator-and-props-external-review.md](animator-and-props-external-review.md) —
R1 = [schema-and-props-review-feedback.md](schema-and-props-review-feedback.md) (the main one), R2 =
[schema-and-props-review-feedback2.md](schema-and-props-review-feedback2.md) — checked against the code on
2026-11-01, with the owner's first reactions to R1. Every "today" fact below was read from source that day.

**Why now:** schema 1.11 and the renamed props are NOT published yet (npm still ships 1.0.52 with the old names).
A rename today costs a schema step and a search-and-replace; after publishing it costs a deprecation cycle in
four packages. Everything accepted here lands before the 1.11 publish, or it does not land.

## What will be implemented — old → new

The whole change set on one screen; the reasoning is in the sections named in the last column.

**Wire (the file) — one schema step each**

| Old | New | Step | § |
|---|---|---|---|
| `actionTriggers.togglePlay: 'click'` | removed — `start: 'click', stop: 'click'` says it (the step converts) | 1.12 | 2.3 |
| `actions.suspend: …` | `actions.outOfView: …` (values `pause` · `continue` · `reset` unchanged) | 1.13 | 2.4 |
| `actions.<start\|stop\|finish\|outOfView>.do` | `.behavior` (the word shorthand `stop: 'rewind'` unchanged) | 1.14 | 2.6 |
| `timeline.beforeStart: 'static' \| 'firstFrame'` | `timeline.showWhenStopped: 'static' \| 'firstFrame'` (key only; values unchanged) | 1.15 | 3.1 |
| `actionTriggers.resume` — accepted, ignored | key unchanged; the list is HONOURED (replaces the derivation); a mismatch warns | none | 2.1 |

**Player libraries (core · web · React · Vue · React Native)**

| Old | New | § |
|---|---|---|
| option / prop `timeline={…}` | `timelineOptions={…}` (`actions` keeps its name) | 2.5 |
| `muteWarn` / `muteError` | `suppressWarnings` / `suppressErrors` | 3.6 |
| `PxTriggerIssueKind.resumeIgnored` | `resumeDiffersFromDerived` | 2.1 |
| types `PxStartTransition` · `PxStopTransition` · `PxFinishTransition` · `PxSuspendTransition` | `PxStartBehavior` · `PxStopBehavior` · `PxFinishBehavior` · `PxOutOfViewBehavior` | 2.6 |
| `PxResolvedActions.*.do`, `PxResolvedGate.suspend` | `.behavior`, `.outOfView` | 2.4 / 2.6 |
| `createSvgAnimationPlayersFromPage`'s explicit `playUsingActionTriggers: true` | unchanged — the no-driver rule stays everywhere | 2.2 |

**Editor (kf)**

| Old | New | § |
|---|---|---|
| `expandTogglePlay` on read | gone — the conversion step does it | 2.3 |
| explicit `resume` dropped on read | stored and written back unchanged; "Resume on" stays disabled, shows the warning | 2.1 |
| test id `suspendTransition` | `outOfViewBehavior` (one candidate atest, the `_b.js` fixture) | 2.4 |
| `timeline={PLAY_ONCE}`, `muteWarn: true, muteError: true` | the renamed props | 2.5 / 3.6 |
| fixture stamps `1.11.1` | `1.15.1`; field universe and explorer cases regenerated | 10 |

**Docs only (no behaviour change)**

| Where | What |
|---|---|
| the brief §1, `playback-and-triggers.md`, `playback-layers.md`, prop TSDoc | `actionTriggers` keys = requests, `actions` keys = moments; `pause` has one behaviour; the custom-action key grammar |
| the brief §2.3 / §4.2, the four guides, the format README | the ONE driver-contract sentence (a bare component is a still) |
| the guides | the click-toggle table · merge (patch props) vs replace (trigger block) said once · the time axis on every time member · "`play={false}` stops, it does not pause" · the two meanings of `continue` |
| `react-props-review.md` §2 / §5 | one row per decision above, R2's dissents on `timelineOptions` and `behavior` recorded |

**Kept as is** (reasons in §0 and §3): `jumpToFinished`, `getDuration` (one iteration), `target`, `version`,
`doc`, `playerRef`, `play` / `pause` as booleans and words, `showAtTime`, `playUsingActionTriggers` (two
spellings, absent = still), `completeIteration`, `inViewDebounce`, `engine: 'native'`, `iterationDirection`,
`load`, the event words, the FILE default `start: 'load'`.

## 0. Verdict at a glance

| Point | R1 | R2 | Decision | Kind |
|---|---|---|---|---|
| `resume` accepted on the wire but ignored | remove | remove | **owner 2026-11-01: KEEP the key, make it live** — an explicit list is honoured, a mismatch with the pause's counterpart warns; the editor's field stays derived / disabled (§2.1) | player |
| `togglePlay` — a shortcut, read as play/pause by everyone | rename or remove | make "stop" visible or give it the media meaning | **remove**; the state rule already gives both toggles (§2.3) | wire |
| the two blocks are not symmetrical | fix the explanation | (praises the shared key) | **fix the explanation**, not the shape (§2.1) | docs |
| `doc` alone renders a still | document-driven, or state the contract | document-driven + explicit opt-out; the gate already covers "200 icons" | **owner 2026-11-01: keep the rule — nothing plays until a prop names the driver; write that contract down** (§2.2) | docs |
| `playUsingActionTriggers` → `actionTriggers` with `false` | keep the name | rename, `false` = manual | **keep the name** (owner: drivers are `play*`); no `false` spelling — absent IS the opt-out | — |
| same event in several lists — a priority? | — | collision warning is right | **yes, today** (`triggerActionFor`); document the two click toggles | docs |
| `suspend` | `outOfView` | `outOfView` | **`outOfView`** — the editor's own label is already "Out-of-View Action" (§2.4) | wire |
| `timeline` prop ≠ the file's `timeline` | `timelineOptions` | keep (the mirror rule matters more) | **`timelineOptions`** (owner leaned so); R2's dissent recorded — confirm (§2.5) | props |
| `do` | `behavior` | keep | **`behavior`** (owner leaned so); R2's dissent recorded — confirm (§2.6) | wire |
| `beforeStart` | `restingFrame` | value `static` → `asAuthored` | **`showWhenStopped: 'static' \| 'firstFrame'`** — key renamed, values kept (owner: "everything is authored") (§3.1) | wire |
| `jumpToFinished` | `jumpToEnd` | `jumpToEnd` | **keep** — `finish*` is our (WAAPI's) word; `outTime` is a time, not a state (§3.2) | — |
| `onCancel` | `onReset` | `onReset`; don't also fire `onStop` | **done 2026-11-01**, `reset()` reports only `onReset` | — |
| `getDuration` | `getIterationDuration` | say the time AXIS on every time member | **keep the name; no new method** (owner: the total is `getDuration() × iterations`, or nothing for `'infinite'`); **the axis in every TSDoc** (§3.3) | docs |
| `target` → `selector` | yes | — | **keep** — the value is an `#id`, not a selector (§3.4) | — |
| `version` → `schemaVersion` | yes | — | **keep** (owner) | — |
| `doc` → `document` | yes | — | **keep** — shadows the global in every destructuring (§3.5) | — |
| `playerRef` → `ref` | yes | yes (React 19: `ref` is a prop; alias for Vue/RN) | **keep** (owner: the ref is not a mode) | — |
| `muteWarn` / `muteError` → `suppressWarnings` / `suppressErrors` | yes | — | **agree, low priority** (§3.6) | props |
| `inViewDebounce` → `inViewDelay` | if it is a delay | — | **keep** — it IS a debounce (a pending open is cancelled when visibility drops) | — |
| `engine: 'native'` → `'waapi'` | yes | yes (RN reads "native" as its own side) | **keep, weakly** — two votes against (§3.7) | — |
| `iterationDirection`, `alternateReverse` | `direction`, `alternate-reverse` | keep | **keep** — camelCase values are the format rule | — |
| `load` → `ready` | yes | keep | **keep** (record §5) | — |
| `play` / `pause` booleans | `playbackState` enum | keep two booleans, but `playing` / `paused` | **keep the booleans and the words; one TSDoc warning** (§4.1) | — |
| `completeIteration` | `afterCurrentIteration` | `afterIteration` | **keep** (owner) | — |
| `continue` means two things | `keepPlaying` | a TSDoc line | **a TSDoc line**; next to `outOfView` the word reads right | docs |
| §6 event words, `version`, `alternateReverse`, `target` | change | — | **keep** (owner) | — |
| §9 the model mixes a policy, a shortcut, a derived list, a lifecycle event | — | — | **agree**; §9 says what to do | wire + docs |

Wire changes accepted: four (`togglePlay` out, `suspend` → `outOfView`, `do` → `behavior`,
`beforeStart` → `showWhenStopped`, values `static|firstFrame` unchanged). Player behaviour: an explicit
`resume` list is honoured (§2.1). Prop changes: `timeline` → `timelineOptions`, `muteWarn` / `muteError` →
`suppressWarnings` / `suppressErrors`. The handle and the default driver stay as they are (§3.3, §2.2).

## 1. Facts the decisions rest on (read 2026-11-01)

- `resolveTriggers` (`PxAnimatorConstants.ts`): `togglePlay` is unioned into `start` AND `stop`; `resume` is
  DERIVED by `derivedResume` (the counterpart of each `pause` event — hoverIn ↔ hoverOut, click → click — plus the
  `start` events that do not also stop); an explicit `resume` naming a built-in event is ignored and reported as
  `PxTriggerIssueKind.resumeIgnored`. The TSDoc: the key "is kept for element targets, still to come".
- THE STATE RULE `triggerActionFor`: stopped → `start`; finished → `stop` wins over `start`; paused → `resume`
  wins over `stop`; playing → `pause` wins over `stop`. `stop` + `pause` (or + a pause's counterpart) on one event
  is reported as a `collision`. So `{ start: 'click', pause: 'click' }` is the media-style play/pause toggle
  (the editor's "Click: play / pause" preset writes exactly that) and `{ start: 'click', stop: 'click' }` is the
  start/stop toggle — `togglePlay` adds no third behaviour.
- The editor (`TSvgSvgAnimationAttr.tsx`, `Types.ts`): never writes `togglePlay` (reads it INTO start + stop) or
  `resume` (shows the derived list read-only as "Resume on"); edits three lists: Play on · Stop on · Pause on. The
  out-of-view choice is titled **"Out-of-View Action"** (`SvgTriggerFields.tsx:258`, test id `suspendTransition`).
  `beforeStart` has no UI and is never written.
- Defaults without a control prop / option: `createSvgAnimationPlayer` — STATIC (the no-driver rule,
  `PxAnimator.ts:94`); `<SvgAnimationPlayer>` React / Vue / RN — STATIC; `createSvgAnimationPlayersFromPage` —
  PLAYS (passes `playUsingActionTriggers: true`); `<SvgCssAnimationPlayer>` — PLAYS on load when `actionTriggers`
  is absent (`SvgCssAnimator.tsx:36`); the pre-rendered SVG file — plays as its own script says. FILE: an absent
  `actionTriggers` block = `{ start: 'load' }`; the editor writes the block explicitly (`"actionTriggers":
  { "start": "load" }` in a new document), so the file default matters only to hand-written and pre-1.10 files.
- The no-driver rule's history: first-use review §1+2 (2026-10-19) — the web API followed the file while the
  components forced `start: 'none'`; the owner's fix was "NOTHING plays until a line names the driver — on every
  surface" (and `autoplay` was renamed because it lied for a click file). `react-api-hands-on.md` §0.1 flagged
  the bare component's silent still again with the note "reopen only if it still feels wrong in practice; a
  one-time hint would not reopen it".
- `getDuration()` = ONE pass of the content window in content ms (`outTime − inTime`, test
  `PxReadyAndDuration.test.ts:27`); `getCurrentTime()` / `setCurrentTime()` / `getCurrentProgress()` = the WHOLE
  run; `setCurrentTime` clamps to `duration × iterations`, a number the handle does not hand out. `playDuration`
  is implemented as a rate factor (`PxAnimatorBind.ts:56`), so the run's wall length is
  `playDuration × iterations` when set — a third axis the TSDoc does not name.
- `muteWarn` / `muteError` (`PxDiagnostics.ts:126`): switch the `console.warn` / `console.error` FALLBACK off; a
  passed `onWarn` / `onError` still fires.
- The visibility gate (`PxVisibilityGate.ts`): opens at `inViewThreshold` after `inViewDebounce` ms, the pending
  open is cancelled if the ratio falls below the threshold meanwhile; closes only at zero visibility.
- `_PxBinding.target` is "`'#id'`-spelled like every element reference" (`PxAnimatorTypes.ts:1224`); the format has
  two reference spellings — `source` / `target` for elements (`#id`), `…With` for definitions by name.
- `engine` on React Native: accepted and ignored — RN always compiles for its own driver (`SvgAnimator.tsx:56`);
  on the web `native` = WAAPI (+ the browser's ScrollTimeline).

## 2. The important issues

### 2.1 `actionTriggers` vs `actions` — not symmetrical, and the explanation says they are

**Agree with R1.** The shape is right (R2 calls the shared key the strongest idea); the sentence "the same key
appears in both blocks" oversells it. Replace it everywhere (the brief §1, `docs/format/playback-and-triggers.md`,
`dev-docs/plans/playback-layers.md`, the prop TSDoc) with the accurate statement:

- `actionTriggers` keys are the REQUESTS a page event can make: `start`, `stop`, `pause` (`resume` is derived from
  them — hover out resumes what hover in paused, a click resumes what a click paused).
- `actions` keys are the MOMENTS whose outcome is configurable: `start`, `stop`, `finish`, `outOfView`.
- `start` and `stop` are in both because each is both a request and a moment. `pause` has one possible behaviour
  (freeze), so it has no `actions` entry. `finish` and `outOfView` are not page events, so they have no list.

Then the two members that made the sentence false:

**`resume` — KEEP the key and make it live (owner, 2026-11-01; undecided on removal, so no schema step).** Both
reviewers' real complaint is a key that type-checks and does nothing; the fix the owner chose is to make it do
something. Proposed semantics, ONE rule in core (`resolveTriggers` / `derivedResume` stay the single source of
truth; the editor and the CSS components import it, never re-derive):

- No `resume` in the file → derived, as today (the counterpart of each `pause` event plus the `start` events that
  do not also stop).
- `resume` present → the file's list IS the resume list (it replaces the derivation; an empty list = nothing
  resumes, a paused animation waits for `start`/`stop`). Events outside `allowedTriggerEvents(resume)` are dropped
  and warned, like every list.
- Warn when the explicit list differs from what the derivation would give — `PxTriggerIssueKind.resumeIgnored`
  becomes `resumeDiffersFromDerived` (`list: resume`, `event`, plus the derived list in the message), so
  `{ pause: 'click', resume: 'hoverOut' }` plays as written and says "click pauses it, nothing but hover out
  resumes it; the pause's own counterpart would be click". Reported through `triggerIssues` like the collisions,
  so every player warns and the editor can show it.
- Prop type: `PxActionTriggersInput` keeps omitting `resume` for now (the owner's call whether a block override may
  name it; the file can).

Editor (kf), "disabled for now": the "Resume on" field stays read-only and shows `resolved().resume` (which now
reflects an explicit list when a hand-written file has one, and the warning as its note); the model must STORE an
explicit `resume` and write it back unchanged — today `TSvgSvgAnimationAttr` drops it on read ("never stored"),
which would silently change such a file's behaviour on save once the player honours it. Specs: the two
`it(...)`s that say "resume is derived, never stored or written" get updated expectations, not deleted. Docs: every
"resume is derived" line becomes "derived unless the file names it".

**`togglePlay` — remove** (see 2.3).

### 2.2 The file plays by default, the component does not — DECIDED: the rule stays, the contract gets written

Owner, 2026-11-01: "you need to explicitly say what you want; let's not guess the default" — `<SvgAnimationPlayer
doc={x} />` is a still, as agreed in first-use §1+2, and the web API is already the same (the note "in the web
player no actionTriggers means start: load" did not match the code). Both reviewers' document-driven alternative
(the file's block as the default driver, an opt-out spelling) is REJECTED; `playUsingActionTriggers` keeps its two
spellings, `true` or a block, and absent is the opt-out. What stays as it is today:

| Surface | No driver named → | Has another driver? |
|---|---|---|
| FILE, absent `actionTriggers` | `start: 'load'` | — (a file is designed to play) |
| `createSvgAnimationPlayer`, `<SvgAnimationPlayer>` (React, Vue, RN) | static | yes — the returned api / the handle |
| `createSvgAnimationPlayersFromPage` (`<div data-px-animation-src>`) | plays as the file says | no |
| `<SvgCssAnimationPlayer>` without `actionTriggers` | plays on load | no (a class toggle, no handle) |
| pre-rendered SVG file | plays as the file says | no |

The work is docs only — the contract in ONE sentence, said once and pointed at from every guide:

> Nothing plays until a prop or option names the driver (`playUsingActionTriggers`, `play`, `showAt…`). A file
> embedded with no code around it — the `<div data-px-animation-src>` tag, the CSS wrapper, a standalone SVG file —
> has no other possible driver, so there the embedding is that naming and the file plays as saved.

Where: the brief §2.3 (next to `start: 'load'` — "a FILE default, not a component default") and §4.2, the
control-mode paragraph of `react.md` / `vue.md` / `react-native.md` / `web-player.md`, the format README's defaults
table. Optional, not decided: the one-time `usage` diagnostic the hands-on review proposed for a bare `doc` whose
file starts on `load` ("add `playUsingActionTriggers` to play as saved, or a control prop") — it does not reopen
the rule, it only ends the silence; say so if wanted.

Rejected today, for the record: the file's block as the default driver with a `false` opt-out (both reviewers);
making the page tag and the CSS wrapper static too (nothing could play them); changing the FILE default to "absent
block = nothing starts it" (a schema step against hand-written and old files; the editor writes the block anyway).

### 2.3 `togglePlay` — remove; the state rule already gives both toggles

Both reviewers: a media toggle is play/pause, ours toggles start/stop. It is not in the editor's UI or output, and
`start` + `stop` on the same event says the same at the same length. The conversion step does what the editor's
`expandTogglePlay` does today (union into `start` and `stop`); the editor code and the CSS component's `togglePlay`
mention go. The user's question "is there a priority when one event is in several lists?" — yes, THE STATE RULE
(§1), and collisions are warned. Document the two toggles once, under "Click toggles":

| You want | Write |
|---|---|
| click starts, next click pauses, next resumes | `{ start: 'click', pause: 'click' }` |
| click starts, next click stops (per `actions.stop`) | `{ start: 'click', stop: 'click' }` |

R2's alternative — keep `togglePlay` with the media meaning — is the first row with a second spelling; no.

### 2.4 `suspend` → `outOfView`

**Both reviewers; agree.** It names the condition (the editor's label already says "Out-of-View Action"), shares
the stem with `inViewThreshold` / `inViewDebounce`, and the pre-1.10 trigger key WAS `outOfView`, so the editor
docs and videos still use the words. Values stay `pause` · `continue` · `reset`: `outOfView: 'continue'` reads
"out of view: continue [playing]"; add R2's TSDoc line on the two `continue`s (start: from where it rests; out of
view: keep running). Type names follow: `PxSuspendTransition` → `PxOutOfViewBehavior` (2.6), `PxResolvedGate.suspend`
→ `outOfView`, `isGated(gate.outOfView)`. Editor: schema-key constants carry the rename at compile time; the
field title stays; test id `suspendTransition` → `outOfViewBehavior` (one candidate atest and the format fixture
`svga-file-format.svga.data/_b.js` spell `suspend`).

### 2.5 `timeline` prop → `timelineOptions` — owner leaned yes; R2 dissents; confirm

R1: the prop is a JSON Merge Patch of the file's `timeline` MINUS `actionTriggers` and `actions`, so a different
name says "not the same object". R2: keep — "file key = prop name, merged" is the rule that makes the props
predictable, and the misdirection is slight (a `timeline={{ actionTriggers }}` is already warned as
`timelineOverrideIgnored`). Both are defensible; the owner said `timelineOptions` looks good, so the plan carries
it — `actions` keeps its name (it IS a partial of the same object, merged), `PxTimelinePatch` stays. Document the
merge rule once, in the `PxPlaybackOverride` TSDoc and the guides' "Playback overrides" section: patch props MERGE
(objects merge, values replace, `null` deletes — R2: keep), the trigger block REPLACES as a whole. Ripple:
`react.md`, `vue.md`, `react-native.md`, `web-player.md`, the brief, `hello-react`, kf `PlaybackPresetInput.tsx:119`
(`timeline={PLAY_ONCE}`), the learn videos that type `timeline={{ … }}` (re-recording is pending for 1.11 anyway).

### 2.6 `do` → `behavior` — owner leaned yes; R2 dissents; confirm

R1: `do` says nothing about what kind of thing the value is; "stop behavior: rewind", "finish behavior: hold",
"out-of-view behavior: pause" all read. R2: `do` is fine once seen. The owner leaned to `behavior`; the plan
carries it. US spelling like every CSS-derived key (`color`, `scroll-behavior`). The word shorthand stays
(`stop: 'rewind'` ≡ `{ behavior: 'rewind' }`). Types: `PxStartTransition` → `PxStartBehavior`, `PxStopTransition`
→ `PxStopBehavior`, `PxFinishTransition` → `PxFinishBehavior`, `PxSuspendTransition` → `PxOutOfViewBehavior`;
`PxResolvedActions.*.do` → `behavior`. Editor: `PxStopActionSchemaKeys.do` and friends carry it; `PlaybackPresets.ts`
builds through the key constants. `mode` was the runner-up — as generic as `do`.

## 3. The other names

### 3.1 `beforeStart: 'static' | 'firstFrame'` → `showWhenStopped: 'static' | 'firstFrame'`

The key governs the STOPPED state exactly: before the first start, after `reset()`, after a stop or finish whose
behavior is `reset`, after a `rewind` lands. A paused animation shows its paused frame and a finished one its held
frame, so the owner's `showWhenNotPlaying` is wrong for two of the four states; R1's `restingFrame` is right but
`static` is not a frame. `showWhenStopped` uses our state word and echoes the components' `show*` verb (a frame,
no motion); niche, hand-authored only, so the length is fine. The VALUES stay `static` | `firstFrame`: R2's
`asAuthored` was rejected by the owner ("everything is authored" — it says nothing `static` does not), so the step
renames the key only. The TSDoc spells `static` out once: "the SVG as it is in the file, no animation applied".
Alternative if shorter is wanted: `restPose`. `fillModeOf(…)` and the pre-rendered SVG's CSS reader follow.

### 3.2 `jumpToFinished` — keep (two votes against, recorded)

The user asked for the convention: it is WAAPI's — `finish()`, `finished`, `onfinish`, `playState: 'finished'`.
Ours: the `finish` moment, the `finished` state, `onFinish`, `jumpToFinished()` — one trio, plus the preset named
after the state it lands in. `end` is the `<video>` word (`ended`), `complete` is Lottie's. R2's "`outTime` is
already 'where it ends'" names a TIME (the content window's end), not a state; `jumpToEnd` would be a fifth word
next to four `finish`es. This also closes the record's open `onFinish` → `onEnded` row (R2 agrees): keep.

### 3.3 `getDuration` — keep the name, no new method, name the axis on every time member

R1 calls one-iteration `getDuration()` next to whole-run `getCurrentTime()` inconsistent. It is the WAAPI pair
exactly: `effect.getTiming().duration` is one iteration, `animation.currentTime` runs over every iteration; CSS
`animation-duration` and lottie-web's `getDuration()` are one pass too. Renaming would make US the odd one out.

R2's sharper point stands: there are THREE time axes and the names do not say which — content ms (`inTime`,
`outTime`, `getDuration()`), wall ms of one pass (`playDuration`), run ms with iterations (`showAtTime`,
`getCurrentTime()`, `setCurrentTime()`, `delay`). Actions, docs only: (1) every one of these gets its axis in the
first TSDoc sentence — "content ms", "wall ms, one pass", "ms into the whole run"; (2) `getDuration()`'s TSDoc keeps
saying how the total is had — `× iterations`, nothing for `'infinite'` (then it is the slider maximum, as
`getCurrentProgress()` already does). A `getTotalDuration()` method was proposed and REJECTED by the owner
(2026-11-01: "either `getDuration()`, or `getDuration() × iterations`, or null — a method with no value").
(3) Open, so that the multiplication is on one axis: confirm in `PxAnimatorBind` what `getDuration()` returns under
a `playDuration` remap today (content ms, or the remapped wall ms) — the test covers only the unremapped case — and
say it in the TSDoc.

### 3.4 `target` — keep

Not a selector: the format accepts `'#id'` only — `source` / `target` point at elements by id, `…With` at
definitions by name. `selector` would promise `.class` and `svg > g`, which no player resolves. Precedent: WAAPI
`KeyframeEffect.target`, SMIL `href`. Tighten the TSDoc: "the element's id, written `#id` — not a CSS selector".

### 3.5 `doc` — keep

`const { document } = props` and `document={animation}` shadow `window.document` in exactly the files that also
query it; every example would carry that trap. `doc` is also the web API's option, the type is `PxDocument`, and no
peer library uses `document` (lottie-react `animationData`, dotLottie `data` / `src`).

### 3.6 `muteWarn` / `muteError` → `suppressWarnings` / `suppressErrors` — agree, low priority

What they do: switch the console fallback off; the handlers still fire (§1). `muteWarn: true` is odd English (a
verb muted); `suppressWarnings: true` is plain, and React's own props set the precedent
(`suppressHydrationWarning`, `suppressContentEditableWarning`). Keep the TSDoc sentence "about the console, not
about your handler" — it stops `suppressErrors` reading as "swallow errors". Ripple: core `PxDiagnosticsConfig`,
four packages, the guides' callback tables, kf `VscPreviewApp.ts:73`. Do it in the same pass as 2.5 or not at all.

### 3.7 `engine: 'native'` — keep, weakly

Both reviewers: on the web it means WAAPI, on React Native "native" means the RN side. Facts: RN ignores the key
(§1); the design word is "the platform's animation API" (WAAPI on the web, the native driver on RN), and the
default `auto` means almost no file spells it. `waapi` would be exact for the web and meaningless on RN. Keep,
and let the TSDoc say "WAAPI on the web; React Native ignores the key". If the owner prefers precision over
neutrality it is one more schema step (`native` → `waapi`) in the same release.

## 4. Component props

### 4.1 `play` / `pause` — keep the booleans and the words; one TSDoc warning

R1 wants a `playbackState` enum; R2 wants the two booleans but as adjectives (`playing`, `paused`) and warns that
`play={false}` performing a destructive stop is "the part people will trip on". What declarative control looks like
elsewhere (checked 2026-11-01 unless marked):

| Library | Declarative control | Shape |
|---|---|---|
| react-player | `playing` | one boolean |
| react-lottie / lottie-react-web | `isStopped` + `isPaused` | two booleans |
| expo-av `Video` | `shouldPlay` | one boolean |
| react-native-video (from memory) | `paused` | one boolean |
| react-spring | `pause` in the config | one boolean |
| react-fast-marquee (from memory) | `play` | one boolean |
| vue3-lottie (from memory) | `pauseAnimation` (+ `autoPlay`) | one boolean |
| CSS animations | `animation-name` applied or not × `animation-play-state: running \| paused` | two orthogonal switches |
| WAAPI | `playState: idle \| running \| paused \| finished` | READ-ONLY; writes are `play()` / `pause()` / `finish()` / `cancel()` |
| Framer Motion | `animate="variantName"` | a string, but it names a POSE, not a playback state |
| lottie-react, dotlottie-react, lottie-react-native, Rive, Remotion `<Player>` | none — `autoplay` + an imperative ref | imperative |

Reading: the ecosystem's declarative form is ONE boolean for the thing that changes most; nobody ships a
three-word playback enum as a prop — the enums are read-only state (WAAPI) or variants (Framer). Our `play` +
`pause` is the CSS model: whether the animation is on × whether it is frozen, two orthogonal axes, which is why
`play={hovered}` and `pause={!inView}` compose. So: no enum, and nothing in parallel (R1 himself warns against two
ways to say one thing; the record notes an enum would cost every `play={hovered}` line). Words: `play` is the
driver's verb under the owner's `play*` rule and pairs with the handle's `play()`, as `pause` pairs with `pause()`;
React's adjective convention (`checked`, `disabled`, `open`) is a fair point for `playing` / `paused`, but
react-player's `playing={false}` PAUSES, so the adjective would strengthen R2's trap, not remove it. The trap is
real and is a documentation gap: the first TSDoc sentence of `play` and the guides' control-mode table get
"`play={false}` performs the stop action (`actions.stop`: reset or rewind) — it does NOT pause; freeze with
`pause`". If a three-state prop is ever wanted it is the record's `playback="playing" | "paused" | "stopped"` and
it REPLACES the booleans.

### 4.2–4.4 — keep (`playerRef`, `showAtProgress` / `showAtTime`, `playUsingActionTriggers`)

Owner's decisions stand; R1 agrees on 4.3 and 4.4. Both reviewers want React's `ref` (R2: React 19 makes `ref` an
ordinary prop; keep `playerRef` as the alias Vue and RN need) — recorded for the day the owner reopens it; today
the ref is deliberately not a mode and the drivers are the `play*` props. R2's `actionTriggers` prop with `false`
(point 2) is the same "a driver is named by its verb" question — rejected by the owner today; its useful half, the
`false` opt-out, is option D's.

## 9. The architectural observation — agreed, and what it means in practice

R1's list of mixed concepts, item by item:

| Mixed concept | Agree? | What this plan does |
|---|---|---|
| `suspend` is a visibility policy inside `actions` | yes | `outOfView` names it as the moment it is; `actions` = "what happens at a moment", and out-of-view IS a moment, like `finish` |
| `togglePlay` is a compound | yes | removed; the state rule carries both toggles (§2.3) |
| `resume` is derived | yes | kept and made live: derived unless the file names it, a mismatch warns (§2.1) |
| `finish` is a lifecycle event, not a request | yes — and that is fine | the explanation says so: `actions` keys are moments, not requests (§2.1) |
| `pause` has no configurable behaviour | yes — one behaviour exists | one sentence in the docs; no empty `actions.pause` slot |

Two suggestions beyond the renames, so the next layer does not re-grow the exceptions:

1. **Write the key grammar down before custom actions (layer 2).** A custom action is ONE name used in both blocks
   the same way: `actionTriggers.<name>` = when the page asks for it, `actions.<name>` = what it does, both optional.
   The built-ins then stop being special cases: `start` / `stop` have both, `pause` has only a trigger list, `finish`
   / `outOfView` have only a behaviour. Put this paragraph in `playback-layers.md` now; it is the test every
   future key passes.
2. **One place for merge vs replace.** The three override props (`timelineOptions`, `actions`,
   `playUsingActionTriggers`) differ on purpose (patches merge, a trigger block is atomic); say it once in the
   `PxPlaybackOverride` TSDoc with a two-row table and point every guide at it — not three wordings.

## 10. Implementation order (after the owner's go)

Each wire change is its own schema step (dev-docs/versioning.md; even before a publish), so the four accepted
ones are 1.12 … 1.15, in this order — each with `converted` + `up`, no `down` (the newer version says what the
older could not):

| Step | Change | `up` |
|---|---|---|
| 1.12 | `actionTriggers.togglePlay` removed | union its events into `start` and `stop` (today's `resolveTriggers` rule) |
| 1.13 | `actions.suspend` → `actions.outOfView` | rename the key |
| 1.14 | `actions.*.do` → `behavior` | rename inside each object form |
| 1.15 | `timeline.beforeStart` → `showWhenStopped` (values unchanged) | rename the key |

Per step the usual pass (skill `svga-format-schema`): bump + `PX_WIRE_STEPS` entry → build core →
`node scripts/schema-release.mjs --apply` → move the broken version literals → kf: restamp fixtures to `1.15.1`,
regenerate the field universe, re-settle the feature-explorer cases → `pnpm check:docs`. Then, library-level:

1. Props and handle: `PxPlaybackOverride.timeline` → `timelineOptions`; `PxDiagnosticsConfig.muteWarn` /
   `muteError` → `suppressWarnings` / `suppressErrors`; types `Px*Transition` → `Px*Behavior`.
2. `resume` made live (§2.1, no wire change): `resolveTriggers` takes the file's list when present,
   `resumeIgnored` → `resumeDiffersFromDerived` in `triggerIssues`; tests: an explicit list is honoured by the web
   executor and the CSS components, the mismatch warns, the derived path is unchanged — each guard seen to FAIL
   on today's code first.
3. Editor: `expandTogglePlay` and the `togglePlay` spec move to a conversion test (never delete the `it`, relocate
   it); the model stores an explicit `resume` and writes it back (field stays disabled; the two "never stored"
   specs get new expectations); test id `suspendTransition` → `outOfViewBehavior` (+ the candidate atest and the
   `_b.js` fixture); `PxSchemaFullCoverageDoc.ts:669` loses `togglePlay`; `PlaybackPresetInput.tsx` and
   `VscPreviewApp.ts` prop renames; kf tsc clean.
4. Docs, one wording each: the §2.1 explanation ("derived unless the file names it"), the driver contract (§2.2),
   the click-toggle table, the merge-vs-replace table, the time axes, the `play={false}` warning, the two
   `continue`s;
   guides, package READMEs, `docs/format/*`, `playback-layers.md` (+ the key grammar), the brief
   (`animator-and-props-external-review.md`, so the next outside read sees the result), and a row per decision in
   `react-props-review.md` §2 / §5 (the house pattern). Website: `yarn website:svga-docs`; editor page
   `175-playback-settings.md` spells `suspend`, `015-quick-start.mdx` is to check.
5. Verify as on 2026-11-01: `pnpm build` (docs-check, get-started), the five package suites, web bundle-parity
   (`npm run test:bundle` — not run by the build), kf tsc, kf specs that mention the renamed keys, the trigger
   atests and the three `preview-basic-*` atests; re-record the learn videos that type the `timeline` prop.

Not in this plan: the §6 "smaller inconsistencies" (owner: keep), `iterationDirection`, `load`, `version`, `doc`,
`playerRef`, `target`, `jumpToFinished`, `completeIteration` (all keep, reasons above).
