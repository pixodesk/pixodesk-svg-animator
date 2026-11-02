# Progress — implementing schema-and-props-review-fix-plan.md (started 2026-11-01)

Handoff notes, kept current while the work runs. Plan: [schema-and-props-review-fix-plan.md](schema-and-props-review-fix-plan.md).

## Order
1. core, one schema step at a time (edit → `pnpm --filter @pixodesk/svg-animator-core build` → `node scripts/schema-release.mjs --apply`):
   - [x] 1.12 `togglePlay` removed (converted: union into start/stop) — released 2026-11-01
   - [x] 1.13 `actions.suspend` → `outOfView` (+ types `PxSuspendTransition` → `PxOutOfViewBehavior`, `PxResolvedGate.outOfView`)
   - [x] 1.14 `actions.*.do` → `behavior` (+ `Px*Transition` → `Px*Behavior`, `PX_PLAYBACK_DEFAULTS.*Behavior`)
   - [x] 1.15 `timeline.beforeStart` → `showWhenStopped` (values unchanged; `PxBeforeStart` → `PxShowWhenStopped`)
2. [x] `resume` live (explicit list REPLACES the derivation; `resumeExtra` / `resumeMissing`; web code 1111 = `triggerResumeDiffers`): explicit list replaces the derivation; `resumeIgnored` → `resumeExtra` / `resumeMissing`; web code 1111 reworded
3. [x] props: `PxPlaybackOverride.timeline` → `timelineOptions`; `muteWarn`/`muteError` → `suppressWarnings`/`suppressErrors`
4. [x] web / react / vue / rn code + tests green (core 784, web 215, react 69, vue 50, rn 42); [ ] bundle-parity (`npm run test:bundle` in web)
5. [x] TSDoc "why this name" on schema interfaces + `PxControlProps` / `PxPlaybackOverride` / callbacks / handle
6. [x] docs — done by a subagent 2026-11-02 (docs-check 167 passed; preview-player builds; docs-examples 24 passed; diagnostics.md regenerated) (guides, format README, diagnostics, READMEs, examples, playback-layers.md); dev-docs/reviews rows + brief + hello-react still mine (guides, format README, READMEs, playback-layers.md, brief, review record rows), examples, hello-react
7. [x] kf: tsc clean (7 known), specs green (TSvgSvgAnimationTriggersAttr, PlaybackPresets(+Scenes), pureCssPlayback, serialisation animator specs, schemaDefaultsParity, previewUserAction, TSvgTransformAttr, use/materialise specs, appliedEffects-css-bugs, readDegradation, schemaExplorerChecks, field universe, wireVersionGuard, FileContentVersion, loop-iterations, webDemo, MaskedByMethodConvert, cssExampleScriptFree, pxFileHealth); explorer cases re-settled (129), snapshot regenerated; rename pass applied by scratchpad kf.py (manual edits + regex over every file spelling an old name; video assets/generators included; `.svg` expected files and featureexplorer cases NOT touched); tsc + specs + regens next; schema keys compile-time; `expandTogglePlay` → gone; store explicit `resume`; test id `suspendTransition` → `outOfViewBehavior`; prop renames; fixtures restamp 1.15.1; field universe regen; settle explorer cases; specs; atests `_b.js` / `_a.ts` / file-format.md
8. [x] website sync (`yarn website:svga-docs`, 10 pages) + editor page 175 (`actions.outOfView`)
9. [x] verify (2026-11-02 00:40): full `pnpm build` exit 0 (core 784 · web 215 · react 69 · vue 50 · rn 42 · docs-check · get-started · examples), bundle-parity 40, kf tsc clean, kf specs green; [ ] atests — blocked on a dev-server restart (see State): pnpm build, package suites, `npm run test:bundle` (web), kf tsc, kf specs, atests

## Notes
- Tests touching version literals: `PxWireTriggerStep.test.ts` (1.10 → 1.11 describe converts to CURRENT — pin it to 1.11), `PxWireVersion.test.ts:97` (`1.12.0` as a future version), `PxSchemaRelease.test.ts:33` (synthetic).

- kf.py's version regex hit `tests/video/tts/package-lock.json` — reverted with git checkout. Watch for the same when re-running.
- kf `.svg` expected atest outputs (pre-rendered exports) were left alone: they embed the player runtime; re-record via the monitor when the atests run.

## State at 2026-11-02 00:30
- Player: all suites green (core 784 · web 215 · react 69 · vue 50 · rn 42 · bundle-parity 40); `pnpm build` fails only in docs-check / docs-examples / preview-player example — the docs subagent is fixing those (docs, READMEs, examples, playback-layers.md).
- kf: tsc clean; the specs above green; `tests/video/tts/package-lock.json` (untracked, gitignored) was hit by the version regex and restored from node_modules.
- ATESTS BLOCKED: the running dev server serves a stale bundle — `PxSchemaUtil.ts` sees `PxActionTriggersSchema` undefined (the monorepo core `dist/index.cjs` was rebuilt several times under the webpack watcher; the bundle also carries the npm 1.0.52 copies of the core, which still spell `PxSuspendActionSchema` — expected until the publish + bump). The 7 atests (`preview-basic` ×3, `player-preview-trigger`, `svga-file-format`, `svga--(newSvgaJson)-(edit)-(save-verify)`, `exportSvga(SVG_CssAnim_JsTrigger)`) failed on "test-container not visible" = app did not boot. Re-run them after the owner restarts `yarn start`.
- Pending after the agent: website `yarn website:svga-docs` (from kf/app), editor page `175-playback-settings.md` (`suspend` wording), final `pnpm build`, hello-react done.

## Done 2026-11-02 00:45 — everything staged in player / kf / website; hello-react updated (not a repo). Open: the 7 atests after the owner restarts `yarn start`; publish + kf bump + videos (owner).
