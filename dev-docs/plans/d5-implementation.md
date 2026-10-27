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
| 3 right panel: Playback Triggers / Playback Behaviour | ✅ 2026-10-27 | `SvgTriggerFields.tsx`: `TriggerListField` × 4 (multi-choice, test ids `animation.<list>.<list>.<event>`), `PlayActionField` × 3, out-of-view + gate numbers in the Behaviour section (`animationBehaviour`); welcome screen shares `SvgPlaybackFields`; `showFirstFrameBeforePlayOn` has no UI (owner) |
| 4 exporters + export dialog on the shared attr | ✅ 2026-10-27 | SVG + JS/CSS writer: ONE generic trigger script (`createTriggerScript`) = lists + state rule + play actions + gate; pure CSS keeps `:hover` (pause or `animation: none`); `effectiveWire(noJs)` drops what CSS cannot listen for; export dialog lists on `TExportConfig.playOn…` (space-separated words); preview players take `trigger` + `outOfViewAction` |
| 5 trigger explorer + tests | ✅ 2026-10-27 (visual matrix not re-run) | `triggerRows.ts` on the lists (`TriggerOutAction`, click × out actions = 41 rows); typecheck clean (7 known); targeted specs green (serialisation 191, defaults parity, animator config, wire guard, preview user action, round-trip, window export…); atest + video DSL ids converted (`checkbox("…playOn.playOn.hoverIn.setOn", true)`); `trigger-explorer.flaky.spec.ts` still to run (heavy) |
| 6 docs, examples, videos, website (with T3b) | ⏳ | |

## Decisions made while implementing
- **The executor owns the natural end.** `playEndAction` (hold / reset / rewind) is performed by `executor.onNaturalEnd()`, called from
  every engine's `onFinish` hook (web `finaliseAnimator`, RN `notifyFinish`). The end of a rewind is a finish at time 0 and rests there.
- **Only the executor touches the rate, and only after ITS rewind** (`reversed`). A custom rate set through the api survives every on / off.
- **An off in flight reads as STOPPED** (`state()` while rewinding or completing an iteration): a `playOn` event turns it around — the
  hover-in during a hover-out rewind plays forward again, as the old `hoverEnd: reverse` did.
- **`off()` on a stopped player elsewhere than the start still rests it** (the declarative `play={false}` from the end pose; `stop()` after `finish()`).
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
- **The one-shot pose contract pins `showFirstFrameBeforePlayOn: true` + `playEndAction: 'hold'`** (was `fillMode: both`).
- **RN limits**: a rewind's run clock counts from 0 (getCurrentTime is approximate while rewinding); hover events have no touch equivalent.
- **Wire step 1.9 `up`** is lossy by design (no `down`): `hoverEnd: continue` → the leave is simply not listed; `manual` → `{}`.

### Editor (steps 2–5)
- **A trigger list is its own value type** — `TStrListValue` (multi-choice `TStrValue`): wire = one word or an array, `setValues([])` = an
  EXPLICIT empty list (`''`), written only where the player reads it as a statement (`pauseOff: []` = "never resumes"; `writeEmptyList`).
  The default word (`playOn: load`) stays a real value — a list never collapses its default to "unset" (that bit us once on read).
- **Empty containers that MEAN something survive the pruning writers** — `isMeaningfulEmptyWireContainer(key)` keeps `trigger: {}`
  (= waits for `play()`) and `pauseOff: []` through `dropEmptyPlainObjectGroups` / `dropEmptyContainers`; every other empty object is still dropped.
- **The editor model holds the FLAT runtime view** (`PxAnimatorConfigSchemaExtraKeys` derived from `schemaKeys(PxTimeTimelineSchema)`),
  writes via `nestAnimatorTimeline(resolveAnimatorTimeline(flat))`; gate numbers are written only when the document is gated.
- **Ticking `Hover in` in `Plays on` adds `Hover out` to `Pauses on`** when no list names it yet (`TSvgSvgAnimationTriggerAttr.setEvents`) —
  the document attr only; the export dialog's lists (`TExportConfig`) do not pair (a per-export override, not an authoring surface).
- **Pure-CSS limits are predicates, not messages** (`animation/Types.ts`): `isNoJsCssTriggerEventSupported` (load, hover in/out), hover out
  must pause XOR stop, `playOnAction` resume only, `playOffAction` reset only, `playEndAction` hold only, no gate. The UI marks every choice
  (CSS) / (JS) in an SVG + CSS file; picking a JS-only one turns `useJsTriggers` on instead of silently downgrading.
- **One trigger script for SVG + JS** replaces the per-mode snippets: it carries the lists, `triggerActionFor`-equivalent state rule, the
  play actions and the gate (`resolveGate`), so the exported file behaves exactly as the library player.
- **Explorer rows are the lists** — `TriggerRow.trigger` is a `PxTrigger`; out-actions = `playOffAction` / `playEndAction` / `outOfViewAction`;
  the driver derives the expected state through the same rule table.
- **Stamped corpora** other than the lifecycle fixtures (visual lightweight-json 1.8.1, format-atest data 1.2.1, video `.data` 1.2.1) are left
  as they are — they convert on read through the wire steps; rewriting them is a separate decision. The format atest's hand-written
  documentation samples (`_a.ts`, `_b.js`, `meta-element-effect.ts`, `file-format.md`) carry the D5 spelling for the trigger block only —
  the rest of those docs predates the `timeline` object and was stale before D5.

## Handoff notes
- Step 6 open items: `pnpm check:docs` RED (30 drifts: web-player.md, playback-and-triggers.md, react.md, vue.md, react-native.md,
  format/README.md, library/README.md, package READMEs); `docs-examples` css-svgr / override-*; videos — `generate-learn-videos.mjs`
  (17 sites), `learn-assets/balls.generate.mjs`, `real-ui.prepare.mjs` + regenerate the learn-assets JSON, the three demo `App.tsx`;
  website editor pages + T3b leftovers (code samples, ~31 videos to re-record after the UI change).
- The old out-of-gallery `learn-triggers-editor.svga.js` keeps valid ids only; its narration still describes the `Start` dropdown.
