# Progress — implementing schema-and-props--manual-review.md (started 2026-11-04)

Handoff notes, kept current while the work runs. The decisions: [schema-and-props--manual-review.md](schema-and-props--manual-review.md)
(top tables). Procedure per wire step: `dev-docs/versioning.md` §3A; the previous iteration's notes:
[schema-and-props-fix.progress.md](schema-and-props-fix.progress.md).

## Order
1. core wire, one schema step at a time (edit → `pnpm --filter @pixodesk/svg-animator-core build` → `node scripts/schema-release.mjs --apply`):
   - [x] 1.16 `timeline.playDuration` → `playSpeed` (`playSpeed = (outTime − inTime) / playDuration`; `outTime` absent → derived max keyframe time, written out)
   - [x] 1.17 `actionTriggers` absent ≡ `{}` ≡ manual; `up` writes `{ start: 'load' }` into a stamped time timeline without the block; `PX_PLAYBACK_DEFAULTS.start` goes
   - [x] 1.18 `actions.start: 'jumpToFinished'` → `'jumpToEnd'`
   - [x] 1.19 `timeline.showWhenStopped` → `whenIdle` (`PxShowWhenStopped` → `PxWhenIdle`; `PxPlayState.stopped` → `idle`, + `destroyed`)
   - [x] 1.20 `effects.clone.without` → `omit`
   - [x] 1.21 `effects.clone.retime { start, stretch, timeCrop }` → `{ offset, stretch, inTime, outTime }`
2. [x] handle: `setPlaySpeed` / `getPlaySpeed`, `get/setPlayDuration`, `getTotalPlayDuration`, `getCurrentPlayTime`, `getTotalDuration`, `get/setTotalTime`, `getCurrentIteration`, per-iteration `getCurrentTime` / `getCurrentProgress`, `jumpToEnd()` (@advanced), `getPlayState()`; calls after `destroy()` no-op + usage diagnostic (new code)
3. [x] engines: js frame loop (`PxFrameLoop.ts`, `PxPlaybackTime.ts`), native (`PxAnimatorWebApi.ts`, `PxAnimatorBind.ts` — the `playDuration` factor goes), RN
4. [x] components: `playWhile` / `pauseWhile` + `playState` prop; `showAtTime` / `showAtProgress` per iteration; `timelineOptions.playSpeed`; `PxDocumentJson`
5. [x] package tests green (core 785 · web 216 · react 69 · vue 50 · rn 42); [x] `pnpm build` (docs-check 166 passed, 8/8 get-started examples build and play; `mangle-reserved.json` regenerated)
6. [x] docs (guides, format README, package READMEs, diagnostics regenerated incl. PX1504, examples incl. the RN feature-explorer's unstamped documents; stale TSDoc in `packages/*/src` fixed by hand)
7. [~] kf: renames done, Play Duration field → `playSpeed` (+ a speed input), fixtures restamped 1.21.1, tsc clean (7 known), call sites done (PlayerClock, VscPreviewApp, TestPlayVscAction, unified-preview-player), learn-video generator + 6 projects regenerated (react-props, react-apiref, web-api, ui-pipeline, ui-wellness, ui-hover — re-record), hello-react / hello-web, cheat sheet 1.21; [x] field universe regen + settle cases + targeted specs (10 failures fixed: retime literals, explorer cases renamed `effect.retime.offset` / `.window`, 5 inline snapshots refreshed (only `omit`/`offset`/stamp changed), parity fixture spelled `actionTriggers`, NEW parity guard: a time timeline without the block is manual in the editor too — `TSvgSvgAnimationTriggersAttr.readDesignPxAttr`)
8. [x] website: `yarn website:svga-docs` (14 pages), editor page 175 row, file-format examples regen, `yarn website:real-ui` cards
9. [x] kf tsc clean (7 known); skills + memory updated; unit full run `yarn test` 4 failures → fixed (2 preview expectations for absent ≡ manual, 2 machine-local oracle baselines re-recorded), re-run green; `yarn e2e` 683/687 — the same 4 open atests as 11-02, nothing new; report `kf/app/docs/testing/test-run.2026-11-04.md`; dev server stopped, no processes left

## Notes
- Tests with version literals: `PxPrepareDocument.test.ts:20` (`1.15.0` stamp), `PxWireTriggerStep.test.ts:311–324` (1.15 describe), `PxSchemaRelease.test.ts` (`PAST_THE_LOG` computed).

## State
- 2026-11-04 (later): player source + tests done; kf renames applied (model attrs, panel, retime effect/panel, clone omit, test clocks, specs regex); fixtures restamped 1.21.1 (regex over video assets/scripts data, atest .data, presets, visual lightweight-json; explorer cases to be re-settled); kf tsc in progress. The preview player (`kf/unified-preview-player`) was renamed too but runs against the npm package — needs the publish.
- 2026-11-04 (end): everything staged in the player, kf and website repos (not committed). Owner's steps: publish the packages, bump kf `@pixodesk/*` (the unified preview player and Electron compile against npm), re-record the six regenerated learn videos, decide the 4 open atests and the stale TSDoc/anchors noted in the final report.
