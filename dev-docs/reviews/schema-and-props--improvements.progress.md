# Progress — implementing schema-and-props--improvements.md §0 (started 2026-11-04)

Decisions: [schema-and-props--improvements.md](schema-and-props--improvements.md) §0. Out of scope: U4 effect names.
Procedure per wire step: `dev-docs/versioning.md` §3A.

## Semantics chosen while implementing (owner to confirm)
| Point | Rule |
|---|---|
| "End" for a stop | `animateToEnd` plays on to the end of the CURRENT pass (a one-shot: the run's end) — exactly old `completeIteration`; `jumpToEnd` jumps there. Paused + `animateToEnd` resumes and plays there. |
| Arrival at the end | by ANY route (natural end, `stop: …ToEnd`, `start: jumpToEnd`, handle `jumpToEnd()`) the `finish` action runs: `hold` stays (state `finished`), `jumpToStart` / `animateToStart` go back. |
| `onStop` | fires when the stop is performed: `jumpToStart` / `animateToStart` / `jumpToEnd` at once, `animateToEnd` on arrival. A loop stopped at a pass end reports `onStop` only — the engine's `onFinish` is the natural end of the RUN. |
| Wire 1.23 up: `completeIteration: true` | `stop: 'animateToEnd'`; on an INFINITE timeline `finish` := the old stop word (lossless — a loop's finish was unreachable); on a finite one `finish` is kept (accepted limit: the completed stop then ends the way the natural end does). |
| Wire 1.23 down | `jumpToStart` → `reset`/`restart`, `animateToStart` → `rewind`; `animateToEnd` → `{ behavior: <finish's way back or reset>, completeIteration: true }`; `stop: 'jumpToEnd'` has no 1.22 spelling and stays — an older reader takes an unknown word as its default (additive). |
| Two wire steps | 1.22 `playSpeed` → `playbackSpeed`; 1.23 the action vocabulary (each wire change its own step). |

## Order
1. [x] core: constants + schema (1.22, 1.23 released), handle interface, executor model, composeApiExtras, patch types (no null), control-props union, callbacks; core 795 green
2. [x] engines: frame loop, WAAPI, bind (+ PX1505 scroll guard), RN (+ its `jumpToEnd` now runs the finish, as the web engines)
3. [x] web: animator proxy, triggers + gate, registry (`stop` in, `reset` out), page creator `boolean | triggers`, contract tests; web 218 green
4. [x] React / Vue / RN components: `play` / `pause`, `playState`, CSS components derived props + guard (no own names, compatible shapes; mutation-checked) + cross-refs, `onWarning`; react 70 · vue 50 · rn 42 green
5. [x] package tests; `pnpm build` green (core 796 · web 218 · react 70 · vue 50 · rn 42 · docs-check 169 · 8/8 examples)
6. [x] docs: action table, `whenIdle` = fill-mode, two clocks, GSAP "total", contract section; stale TSDoc in src fixed; `PxAnyControlProps` exported from `/engine`
7. [x] kf: model + panel (stop choices, no Complete Iteration, `isFinishReachable` / `stopReachesEnd`, Playback Duration/Speed + tooltip), choice tooltips, pure-CSS projections, export dialog, presets, JS-trigger script (4 stop moves), fixtures restamped 1.23.1 + slot words, snapshot regen, cases settled, website examples regen, targeted specs green (1474)
8. [x] website manual pages 140 + 175, synced player docs, real-ui cards, learning projects, generator (10 videos regenerated), cheat sheet, changes HTML
9. [x] kf tsc (7 known); unit 4,432 + 76 green (text-path oracle re-recorded, stamp only); e2e 683/687 (the 4 open since 11-02); report `kf/app/docs/testing/test-run.2026-11-05.md`; processes closed

## State
- 2026-11-04: plan written.
- 2026-11-05: core + web done and green; next React / Vue / RN.
- 2026-11-05 (later): everything but the docs and the full test runs done; next `pnpm build`, website docs sync, kf unit + e2e.
- 2026-11-05 (end): all of §0 except U4 implemented, tested and staged in the player, kf and website repos (not committed). Owner: publish + bump kf, re-record ten learn videos, decide U4 and the 4 open atests.
