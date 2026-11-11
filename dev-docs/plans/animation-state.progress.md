# Progress — implementing the run model (A-run), started 2026-11-10

Decisions: [animation-state.brainstorm.md](animation-state.brainstorm.md) §0 (OLD → NEW · NEW · REMOVE · UNCHANGED · DECIDED · PLAN).
Procedure per wire step: `dev-docs/versioning.md` §3A. Go: owner, 2026-11-10 ("implement what you lean towards now, review the code later").

## Rename map (the words every layer uses)

| Old | New |
|---|---|
| file `actionTriggers.start / stop / pause / resume` | `startRun / stopRun / pauseRun / resumeRun` |
| file `actions.start / stop` | `actions.startRun / stopRun` |
| file `actions.finish` | timeline `atEnd` (a plain word, like `whenIdle`) |
| `PxPlayState` idle · playing · paused · finished · destroyed | `PxRunState` off · playing · paused · finished · **returning** · destroyed |
| `PxStartBehavior` / `PxStopBehavior` / `PxFinishBehavior` | `PxStartRunBehavior` / `PxStopRunBehavior` / `PxAtEndBehavior` |
| `PX_PLAYBACK_DEFAULTS.startBehavior / stopBehavior / finishBehavior` | `startRunBehavior / stopRunBehavior / atEnd` |
| `PxTriggerList.start / stop / pause / resume` | `startRun / stopRun / pauseRun / resumeRun` |
| `PxTriggerAction.play / pause / stop` | `startRun / resumeRun / pauseRun / stopRun` |
| `PxDeclarativeAction.start / stop / pause / resume` | `startRun / stopRun / pauseRun / resumeRun` |
| `PxDeclarativeProps { play, pause }` | `{ playRun }` |
| props `play` / `pause` / `playState` (+ `PxPlayStateRequest`, `playStateToLevels`) | `playRun: PxPlayRun` = `'off' \| 'on' \| 'paused'` |
| `PxControlMode.play` | `PxControlMode.playRun` |
| handle `play()` (start or resume by state) | `startRun()` + `resumeRun()`; `play()` kept as the alias |
| handle `stop()` | `stopRun()` |
| handle `pause()` | `pauseRun()`; `pause()` kept as the alias |
| handle `playOnce()` | `runOnce()` |
| handle `getPlayState()` | `getRunState()` + `isRunActive()` |
| callbacks `onPlay` (start AND resume) / `onPause` / `onStop` | `onRunStart` / `onRunResume` / `onRunPause` / `onRunStop` — fired by the EXECUTOR when it performs the act; the engines' `onPlay` / `onPause` stay engine-internal (the gate's hold reports nothing) |
| registry events `play pause stop finish` | `runStart runStop runPause runResume finish` |
| executor `start / stop / pause / resume / play` | `startRun / stopRun / pauseRun / resumeRun` (+ `play` = the alias rule) |
| editor labels Start on · Stop on · Pause on · Resume on | Start run on · Stop run on · Pause run on · Resume run on; actions Start run · Stop run · At end of pass |

## Semantics chosen while implementing (owner to confirm in the review)
| Point | Rule |
|---|---|
| `returning` | reported while an `animateToStart` leg runs (stopRun or atEnd); `isRunActive()` false; `startRun()` turns it around; `stopRun()` / `pauseRun()` / `resumeRun()` no-ops |
| the gate's hold / release | engine pause / play — no public callback, `getRunState()` unchanged |
| `play()` alias | `getRunState() === 'paused' ? resumeRun() : startRun()`; `pause()` = `pauseRun()` |
| wire 1.24 up | the four list keys + two action keys renamed; `actions.finish` (word or `{ behavior }`) → `timeline.atEnd` word |
| wire 1.24 down | exact inverse; `atEnd` → `actions.finish: word` |

## Checklist (ticked as the work lands)

### 1 · Player core (`packages/svg-animator-core`)
- [x] `PxAnimatorConstants.ts`: trigger lists, behaviour enums (`PxStartRunBehavior` / `PxStopRunBehavior` / `PxAtEndBehavior`), defaults, resolved triggers/actions, control props (`playRun`), `PxRunState` (+ `returning`), `PxTriggerAction`, the state rule, `fillModeOf`, the runtime view — pass 1
- [x] `PxAnimatorConstants.ts`: pass 2 — `expandedActions` / `compactActions`, the nested reconstruction, leftovers
- [x] `PxAnimatorTypes.ts`: `_PxActionTriggers`, `_PxActions`, `atEnd` on the timeline, callbacks (`onRun*`), the handle, the executor interface, the engine api
- [x] `PxDeclarativePlayback.ts`: executor (`startRun` … `returning`, listeners, `runOnce`), declarative resolver (`playRun`), `composeApiExtras` (aliases, `getRunState`, `isRunActive`)
- [x] `PxAnimatorConfigPatch.ts`, `PxDiagnosticCode.ts`, `PxFrameLoop.ts`, `PxRestPose.ts` comments
- [x] `index.ts` / `engine.ts` / `internal.ts` exports
- [x] wire 1.24 (`PxWireVersion.ts`, `PxSchemaVersion.ts`), build, `schema-release.mjs --apply` (snapshot + release record + SCHEMA.json written), test literals
- [x] core tests green — 800 (`npx vitest run` in the core package)

### 2 · Player web (`packages/svg-animator-web`)
- [x] `PxAnimatorCallbacks.ts` (`toPlayerCallbacks` + `toEngineCallbacks`; inert api), `PxAnimatorBind.ts` (`runListeners` into `composeApiExtras`), `PxAnimatorRegistry.ts` (events), `PxAnimator.ts` (proxy), `PxAnimatorTriggers.ts`, `PxVisibilityGate.ts`, `index.ts`
- [x] web tests green — 218

### 3 · Components
- [x] React `SvgAnimator.tsx` (`playRun`, callbacks, handle), `SvgCssAnimator.tsx`, `index.ts`
- [x] Vue `SvgAnimator.ts`, `SvgCssAnimator.ts`
- [x] React Native `SvgAnimator.tsx`
- [x] react · vue · rn tests green — 70 · 50 · 42

### 4 · Player docs + build
- [x] `docs/library/*`, `docs/format/*`, `docs/diagnostics.md`, package READMEs, examples, `gen-diagnostics-md.mjs`, dev-docs plans "since 1.24" notes
- [x] `pnpm build` green (docs-check 170, package entries, get-started 8/8); fix found on the way: run listeners attached before a `load` trigger presses `startRun` (`PxEngineCallbacks.runListeners` → `setupAnimationTriggers`), guard test seen to fail first

### 5 · Editor (`kf/app`)
- [x] model: `TSvgSvgAnimationAttr.tsx`, `Types.ts`, `PlaybackPresets.ts`, `PxSchemaUtil.ts`
- [x] UI: `SvgTriggerFields.tsx`, `SvgSvgAnimationAttrs.tsx`, `PlaybackPresetInput.tsx`, `TimelineActions.tsx`, `ActionsMappingImpl.ts`
- [x] export: `ExportSvgContent.tsx`, `TExportConfig.tsx`, `SvgJsCssPlayerSerialisationUtil.tsx`
- [x] dev tools: trigger explorer (`triggerRows.ts`, `TriggerCell.tsx`, `TriggerCellDriver.ts`), `VscPreviewApp.ts`, `previewPlayerProtocol` / `triggerIframe` script strings
- [x] fixtures restamped 1.24.1, field-universe snapshot, settled cases, inline snapshots
- [x] `./node_modules/.bin/tsc --noEmit -p tsconfig.json` (7 known) + targeted specs green
- [x] unified-preview-player `content.ts` (preset match on the run keys; compiles against npm — note only)

### 6 · Website · learning projects · HTML
- [x] website `140-animation.mdx`, `175-playback-settings.md`, `015-quick-start.mdx` (labels + keys)
- [x] synced player docs (`yarn website:svga-docs`, 14 pages), real-ui cards (`yarn website:real-ui`)
- [x] learn-video generator (`generate-learn-videos.mjs`): `playRun` in learn-react-props / learn-ui-pipeline / learn-ui-wellness + regenerated data (videos to re-record)
- [x] learning projects `hello-react`, `hello-web` (+ their 1.15 JSONs moved to 1.24 — an old JSON import no longer type-checks against `PxDocument`: review item)
- [x] `player-api-cheatsheet.html`, `schema-1.21-changes.html` (updated in place, as for 1.23)

### 7 · Test runs + wrap-up
- [x] kf unit: `yarn test` (both passes) — parallel 4076 green / 50 failed in 7 files (all stale fixtures: preset scenes, website examples, text-path baseline, three literals, 1.15 video JSONs), fixed and re-run; flaky pass 76 green
- [x] kf e2e: player built → my `yarn start-no-test` → `yarn e2e` — 683 green / the 4 open flagged ones at their known steps (18 min)
- [x] every process I started stopped (dev server, vitest, runner, browsers); port 8080 free
- [x] report `kf/app/docs/testing/test-run.2026-11-11.md`; skills (`player-repo`, `svga-format-schema`, `e2e-tests`, `editor-app`) + memory updated

## State
- 2026-11-10: plan written; core done (800 green); web source done, its tests next.
- 2026-11-11: web · react · vue · rn green; editor converted (tsc clean, 247 fixtures at 1.24.1, snapshot + settled cases + 10 inline snapshots refreshed, trigger matrix 67 green); website manual pages done; player docs + learning material in progress (agents); kf full unit run started, e2e next.
- 2026-11-11 (end): everything on the checklist done; website `yarn build` green (one gallery link moved to the new React anchor); npm publish + kf bump + video re-recording are the owner's.
- Notes for the review: `brainstorm.md`'s status line still says "candidate, not decided / schema 1.23" — owner's file (open in the IDE), left for the owner to restate. 39 learn-asset / video `.data` JSONs stay stamped 1.15.0 (as at 1.21–1.23; the player migrates them on read).
