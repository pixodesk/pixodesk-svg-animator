# D5 implementation — progress log

Started 2026-10-26, autonomous run (owner: "do all steps in one go"). Design: `component-api.md` §D5.
Strategy: change the WIRE (schema, enums, wire step 1.9); derive the engines' runtime view (`fill`, `resetOnFinish`,
`direction`) from the new keys and add the new runtime fields beside them, so the frame-loop / WAAPI / RN engines stay
stable; the lists and actions go through ONE executor in core.

| step | status | notes |
|---|---|---|
| 1a core: wire types, enums, defaults, resolve/nest, wire step 1.9, schema release | ✅ 2026-10-27 | schema 1.9 released (`schema-release.mjs --apply`), diagnostics md regenerated, PX1109 added |
| 1b core: declarative resolver + executor (`applyOn` / `applyOff`), control props | ✅ 2026-10-27 | `createPlayExecutor` / `ensurePlayExecutor` / `composeApiExtras`; `triggerActionFor` is THE state rule; `PxControlProps` lost `playMode` / `completeIteration` |
| 1c web: triggers (lists, state rule), gate from timeline, `stop()`, `cancel()` kept | ✅ 2026-10-27 | `setupAnimationTriggers(api, runtimeConfig, diag)`; gate host `start / hold / release / reset`; `finaliseAnimator` routes the natural end to the executor |
| 1d react / vue / rn: drop `playMode` / `completeIteration`; CSS components take the lists | ✅ 2026-10-27 | CSS components: `trigger` + `outOfViewAction` / `inViewThreshold` / `inViewDebounce` props; RN: `player.playExecutor` drives the tap and the gate |
| 1e player tests green, dists built | ✅ 2026-10-27 | core 754 · web 215 · react 68 · vue 49 · rn 42; `pnpm check:docs` RED (30 doc drifts — step 6); `mangle-reserved.json` regenerated |
| 2 editor model + writer, fixtures, field universe, corpora | ✅ 2026-10-27 | `TSvgSvgAnimationTriggerAttr` (four `TStrListValue` lists) + flat play / gate attrs on `TSvgSvgAnimationAttr`; `fillMode` / `resetOnFinish` gone; kf field universe regenerated; 129 feature-explorer cases settled to 1.9.1 (oracle diff 0); `01-app-lifecycle/.data` fixtures restamped (SVG metas converted in place, JSON round-tripped) |
| 3 right panel: Playback Triggers / Playback Behaviour | ✅ 2026-10-27 | `SvgTriggerFields.tsx`: `TriggerListField` × 4 (multi-choice, test ids `animation.<list>.<list>.<event>`), `PlayActionField` × 3, out-of-view + gate numbers in the Behaviour section (`animationBehaviour`); welcome screen shares `SvgPlaybackFields`; `showFirstFrameBeforePlayStart` has no UI (owner) |
| 4 exporters + export dialog on the shared attr | ✅ 2026-10-27 | SVG + JS/CSS writer: ONE generic trigger script (`createTriggerScript`) = lists + state rule + play actions + gate; pure CSS keeps `:hover` (pause or `animation: none`); `effectiveWire(noJs)` drops what CSS cannot listen for; export dialog lists on `TExportConfig.playStart…` (space-separated words); preview players take `trigger` + `outOfViewAction` |
| 5 trigger explorer + tests | ✅ 2026-10-27 (visual matrix not re-run) | `triggerRows.ts` on the lists (`TriggerOutAction`, click × out actions = 41 rows); typecheck clean (7 known); targeted specs green (serialisation 191, defaults parity, animator config, wire guard, preview user action, round-trip, window export…); atest + video DSL ids converted (`checkbox("…playStart.playStart.hoverIn.setOn", true)`); `trigger-explorer.flaky.spec.ts` still to run (heavy) |
| 6 docs, examples, videos, website (with T3b) | ✅ 2026-10-27 (recording + publish pending) | player docs rewritten to D4/D5 (`playback-and-triggers.md` is the vocabulary; every guide, README, the format reference, troubleshooting, diagnostics regenerated), `pnpm check:docs` GREEN (152 tests); examples converted (docs-examples incl. the editor-generated payloads' `data-px-meta` / `timeline`, preview-player's trigger UI = four checkbox lists, RN samples + the 122 explorer cases); kf: learn assets converted to 1.9 with the player's converter (`convert-assets.mjs`; unstamped files stamped 1.8 first), `balls.generate.mjs` / `real-ui.prepare.mjs` write 1.9, the generator + 26 learn scripts regenerated on `playOnTrigger={…}` / `playCurrentProgress` / `playerRef` (narration revised; `learn-triggers-ball` restructured to the lists), every React video project typechecks against the local packages; `VscPreviewApp` takes `data-px-trigger`; website: player docs synced, real-ui cards regenerated, editor pages (playback settings, animation, quick start, save, loop) and the gallery rewritten |

## Decisions made while implementing
- **The executor owns the natural end.** `playFinishAction` (hold / reset / rewind) is performed by `executor.onNaturalFinish()`, called from
  every engine's `onFinish` hook (web `finaliseAnimator`, RN `notifyFinish`). The end of a rewind is a finish at time 0 and rests there.
- **Only the executor touches the rate, and only after ITS rewind** (`reversed`). A custom rate set through the api survives every on / off.
- **An off in flight reads as STOPPED** (`state()` while rewinding or completing an iteration): a `playStart` event turns it around — the
  hover-in during a hover-out rewind plays forward again, as the old `hoverEnd: reverse` did.
- **`stop()` on a stopped player elsewhere than the start still rests it** (the declarative `play={false}` from the end pose; `stop()` after `finish()`).
- **`pause()` always reaches the engine** (it announces `onPause`); only a pause of a RUN becomes a resumable state.
- **The state rule is ONE function** — core `triggerActionFor(trigger, state, event)`; the web triggers, the CSS components and RN call it.
  `triggerListsEvent` says which listeners to attach.
- **The gate host has four verbs**: `start` (a trigger let through → `executor.play()`), `hold` / `release` (the ENGINE's pause / play — a
  gate hold is not a user pause), `reset` (`executor.cancel()`). `PX_TRIGGER_DEFAULTS` / `PLAY_WHEN_VISIBLE_DEFAULTS` are gone:
  `resolveGate(runtimeView)` applies `PX_PLAYBACK_DEFAULTS`.
- **`setupAnimationTriggers` takes the runtime view** (`getAnimatorConfig(doc)`), not the trigger: it needs the trigger, the gate keys and
  the play keys. Public signature change (clean cut).
- **The declarative apply targets the PUBLIC api** (`applyDeclarativeAction(api, action, totalMs)` — `play()` / `pause()` / `stop()` /
  a seek for the mount pose), so a component's proxy (which queues calls until the player exists) qualifies.
- **The web dist BUNDLES core** — after any core change rebuild web too, or React / Vue tests run the stale copy (cost us one chase).
- **The one-shot pose contract pins `showFirstFrameBeforePlayStart: true` + `playFinishAction: 'hold'`** (was `fillMode: both`).
- **RN limits**: a rewind's run clock counts from 0 (getCurrentTime is approximate while rewinding); hover events have no touch equivalent.
- **Wire step 1.9 `up`** is lossy by design (no `down`): `hoverEnd: continue` → the leave is simply not listed; `manual` → `{}`.

### Rename 2026-10-27 (owner): the moments are start / stop / finish
- `playOn` / `playOff` / `pauseOn` / `pauseOff` → `playStart` / `playStop` / `pauseStart` / `pauseStop`; `playOnAction` / `playOffAction` /
  `playEndAction` → `playStartAction` / `playStopAction` / `playFinishAction`; `completeIterationOnPlayOff` → `completeIterationOnPlayStop`;
  `showFirstFrameBeforePlayOn` → `showFirstFrameBeforePlayStart`. Why: "play on" is the idiom for *keep playing* and a "play-off" is a
  tie-breaker match; start / stop / finish are moments and the words the api (`stop()`) and the editor ("When stopped") already use;
  `finish` matches `onFinish` / `finish()` and leaves "end" to positions (`jumpToEnd`). The executor's verbs follow (`start()` / `stop()`,
  `PxTriggerAction.stop`, `onNaturalFinish`). Done as a mechanical rename inside the unpublished 1.9 step — no 1.10 step. Editor labels unchanged.
- Considered and REJECTED by the owner: `outOfViewAction: continue` → `ignore`, `showFirstFrameBeforePlayStart` → `restPose`, `engine: native`
  → `browser`, `inViewDebounce` → `inViewDelay`.

### Editor (steps 2–5)
- **A trigger list is its own value type** — `TStrListValue` (multi-choice `TStrValue`): wire = one word or an array, `setValues([])` = an
  EXPLICIT empty list (`''`), written only where the player reads it as a statement (`pauseStop: []` = "never resumes"; `writeEmptyList`).
  The default word (`playStart: load`) stays a real value — a list never collapses its default to "unset" (that bit us once on read).
- **Empty containers that MEAN something survive the pruning writers** — `isMeaningfulEmptyWireContainer(key)` keeps `trigger: {}`
  (= waits for `play()`) and `pauseStop: []` through `dropEmptyPlainObjectGroups` / `dropEmptyContainers`; every other empty object is still dropped.
- **The editor model holds the FLAT runtime view** (`PxAnimatorConfigSchemaExtraKeys` derived from `schemaKeys(PxTimeTimelineSchema)`),
  writes via `nestAnimatorTimeline(resolveAnimatorTimeline(flat))`; gate numbers are written only when the document is gated.
- **Ticking `Hover in` in `Plays on` adds `Hover out` to `Pauses on`** when no list names it yet (`TSvgSvgAnimationTriggerAttr.setEvents`) —
  the document attr only; the export dialog's lists (`TExportConfig`) do not pair (a per-export override, not an authoring surface).
- **Pure-CSS limits are predicates, not messages** (`animation/Types.ts`): `isNoJsCssTriggerEventSupported` (load, hover in/out), hover out
  must pause XOR stop, `playStartAction` resume only, `playStopAction` reset only, `playFinishAction` hold only, no gate. The UI marks every choice
  (CSS) / (JS) in an SVG + CSS file; picking a JS-only one turns `useJsTriggers` on instead of silently downgrading.
- **One trigger script for SVG + JS** replaces the per-mode snippets: it carries the lists, `triggerActionFor`-equivalent state rule, the
  play actions and the gate (`resolveGate`), so the exported file behaves exactly as the library player.
- **Explorer rows are the lists** — `TriggerRow.trigger` is a `PxTrigger`; out-actions = `playStopAction` / `playFinishAction` / `outOfViewAction`;
  the driver derives the expected state through the same rule table.
- **An UNSTAMPED document is not converted on read** (`PxWireVersion.ts`: nothing is assumed) — so an old unstamped trigger block reads
  as an EMPTY trigger and the animation never starts, silently on the bind path (not validated). Every unstamped learn asset, example
  payload and RN explorer case was therefore stamped `1.8.0` (the last version its spelling belongs to) and converted with the player's
  own `convertWireDocument` (kf `tests/video/learn-assets/convert-assets.mjs`); the asset generators now stamp `WIRE_VERSION` from the
  local core (`pxWire.mjs`). Open for the owner: should the reader WARN when an unstamped document carries keys it does not know?
- **Stamped corpora** other than the lifecycle fixtures (visual lightweight-json 1.8.1, format-atest data 1.2.1, video `.data` 1.2.1) are left
  as they are — they convert on read through the wire steps; rewriting them is a separate decision. The format atest's hand-written
  documentation samples (`_a.ts`, `_b.js`, `meta-element-effect.ts`, `file-format.md`) carry the D5 spelling for the trigger block only —
  the rest of those docs predates the `timeline` object and was stale before D5.

## Handoff notes
- **Videos to re-record** (needs the kf dev server on :8080, which the owner runs): `yarn website:videos` for every learn video whose
  screen changed — `learn-react-autoplay`, `learn-react-props`, `learn-react-apiref`, `learn-triggers-ball`, `learn-triggers-practice`,
  `learn-ui-loader`, `learn-ui-icons`, `learn-ui-payment`, `learn-ui-hover`, `learn-editor-export` (the export dialog's trigger fields)
  and the ten quick starts that show the editor's document panel. The learn gallery's other videos only changed their JSON assets
  (not on screen). The editor screenshot `animation-settings.png` (website `140-animation.mdx`, provenance updated) also needs a retake.
- **Publish** the player packages: the kf video projects install from npm (`yarn test:video-examples` is red until 1.9 is published —
  its React projects were typechecked against the local packages instead, all 23 green); Electron compiles against npm too.
- `yarn test:video-examples` also asked to drop the `copy-player-library` stand-in (1.0.50 ships it) — done.
- The old out-of-gallery `learn-triggers-editor.svga.js` keeps valid ids only; its narration still describes the `Start` dropdown.
- Adjacent fixes made on the way (flagging): preview-player's `readCanvasSize` narrowed `doc.width` with `typeof` (a pre-existing TS
  error); the format README's versioning prose said schema 1.6 (now 1.9).
