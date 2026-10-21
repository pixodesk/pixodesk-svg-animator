# One staged pipeline: `prepareDocument` + stage stamp (kills the WeakMaps)

Owner decision (first-use review §17a, 2026-10-21): replace the lazy, fragmented lowering
(config fold memoised in module-level WeakMaps, materialize elsewhere, window resolution in a
third place) with **one explicit, immutable pipeline** — "fix once + stamp the RESULT + trust
the stamp", everything local, no global state.

## Research findings (2026-10-21)

- **The pipeline exists, scattered:** `convertWireDocument` (version up) → `getAnimatorConfig`
  (config wire→runtime-view fold + window resolution, LAZY per read: 26 call sites across all
  packages, deduped by `wireViewMemo`/`flattenMemo` WeakMaps) → `materializeAllInTree(doc,
  engine)` (L3 effects → plain L0–L2) → `normalizeBindings` (window-time keyframes) → engine
  projection inline in each player. An `@internal prepareDocumentForRender(doc)` already
  composes engine-resolve + materialize + `generateNewIds`.
- **`getAnimatorConfig` is a SETUP-time read, not per-frame** (bind, frame-loop creation,
  trigger setup, declarative resolve). The expensive part of a derive is `maxKeyframeTimeOf`
  (full tree scan) when the document has no explicit window — the memo mostly pays off inside
  `materializeAllInTree`, whose intermediate roots share the same `animator` object (memo hit).
  The pipeline must therefore CARRY the resolved view across intermediate stages explicitly.
- **Two existing assertions pin the memo** (CORRECTED 2026-10-21 — the first pass of this research
  said "nothing pins it", which was wrong): `PxTimelineCompat.test.ts` lines 95 (`flatten(nested)` twice
  `toBe`) and 130 (`getAnimatorConfig(doc)` twice `toBe`). Both now fail by design — owner to approve
  the update (proposed: `toEqual` on raw docs; identity is asserted on PREPARED docs in the new suite).
  The pass-through `flattenAnimatorTimeline(flat).toBe(flat)` survives.
- **kf** consumes only the public pieces (`getAnimatorConfig`, `materializeAllInTree`,
  `nestAnimatorTimeline`, preview players) in ~12 files — the public surface stays
  source-compatible, so kf needs no change in this pass.

## Decisions (all questions resolved)

1. **Stages** (monotonic ladder; absence of a stamp = raw wire):
   `current` (version-migrated) → `resolved` (runtime view of the animator config computed
   ONCE and attached; the tree untouched) → `plain` (effects/loops/motion-paths/`<use>`/rest
   poses materialized for an ENGINE — directly projectable to WAAPI or the frame loop).
   Engine projection (`normalizeBindings` → effects/tracks) stays a separate explicit step —
   its output is bindings, not a document.
2. **The stamp is a non-registered `Symbol` property on the RESULT only** — the input is never
   touched (immutable; frozen inputs fine). Non-enumerable → invisible to `JSON.stringify`,
   `Object.keys`, schema validation, `structuredClone`; a saved/cloned doc loses it and is
   re-verified. A plain `Symbol()` (NOT `Symbol.for`) makes stamps unreadable across duplicate
   library copies — cross-version false trust is impossible by construction.
3. **Stamp payload:** frozen `{ stage, engine?, view }` — `view` is the resolved runtime config,
   so `getAnimatorConfig` on a prepared doc is a property read. `engine` recorded at `plain`;
   `fixToStage` re-materializes when the requested engine differs.
4. **`getAnimatorConfig` on an UNPREPARED doc derives fresh every call** (pure, no cache); both
   WeakMaps are deleted. Hot paths that care prepare the doc first — that is the design goal.
5. **Public surface:** add `prepareDocument(doc, { stage?, engine?, freshIds? })` (default
   stage `plain`), `documentStage(doc)`, the `PxDocStage` const-object + type, `PxPreparedDocument`
   branded type. Everything existing stays public and source-compatible;
   `flattenAnimatorTimeline` becomes a plain pure function (no memo).
6. **Validation stays OUTSIDE the pipeline** (a check, not a transform).
7. `freshIds` runs `generateNewIds` after `plain` and is not recorded in the stamp (documented
   accepted limit: `fixToStage` never re-runs id regeneration).

## Plan (tick as implemented)

- [x] 1. `pipeline/PxPrepareDocument.ts`: `PxDocStage`, the symbol, stamp helpers
       (`documentStage`, internal `stampPrep`/`prepOf`/`carryPrep`), `prepareDocument`,
       branded `PxPreparedDocument`.
- [x] 2. Extract the view derivation out of `getAnimatorConfig` (internal
       `deriveRuntimeView`), make `getAnimatorConfig` read the stamp first, derive fresh
       otherwise; DELETE `wireViewMemo` + `flattenMemo`.
- [x] 3. Thread the stamp through `materializeAllInTree` intermediates (`carryPrep` on each
       stage output) so the view is computed once per prepare.
- [x] 4. Rebase `prepareDocumentForRender` on the pipeline; switch the web player's load path
       (`PxAnimator`: convert+materialize inline) and RN's compile to `prepareDocument`.
- [x] 5. Tests FIRST, seen failing: `pipeline/PxPrepareDocument.test.ts` — stage ladder,
       early-return identity (`prepare(prepared)` returns the same object), stamp invisible to
       JSON/`Object.keys`/validation, frozen input accepted, engine mismatch re-materializes,
       view equals `getAnimatorConfig` of the unprepared doc, the `plain` output plays
       identically (reuse an engine-parity fixture).
- [x] 6. Docs: format guide "Preparing a document" (signature block + stage ladder), exports
       table row; audience tags; regenerate nothing else.
- [x] 7. Batteries: core/web/react/vue/rn suites, `pnpm check:docs`, kf typecheck.
- [x] 8. Review doc §17a resolution note; stage both repos; suggest commit message.

## Progress log

- 2026-10-21 — doc created; research + decisions settled with the owner (chat).
- 2026-10-21 — steps 1–5: `format/PxDocStage.ts` (stamp; leaf module — `pipeline/` would import-cycle with
  `PxAnimatorConstants`), `pipeline/PxPrepareDocument.ts`, `getAnimatorConfig` = stamp read else fresh derive
  (`deriveRuntimeView`), BOTH WeakMaps deleted, `materializeAllInTree` carries the view on every intermediate
  root and stamps its output `plain`. Web load path + RN compile + `prepareDocumentForRender` on the pipeline.
  Side effect: RN now version-migrates documents (it never did; web always has). 9 pipeline tests; the
  input-never-stamped guard seen FAILING under mutation (2 tests red), restored green. Own bug caught while
  wiring: `freshIds` on a trusted `plain` doc re-materialized it — now it only re-mints ids (test added).
- 2026-10-21 — web suite caught a real flaw (5 frame-loop tests frozen): `freshIds` rewrites ids INSIDE
  `animator.bindings`, but the carried view kept the old targets → nothing animated. The WeakMap never hit
  this because it keyed on the config OBJECT. Fix, still local: the stamp records `viewOf` (the config object
  its view came from); `getAnimatorConfig` trusts the view only while the doc holds that object; `carryPrep`
  (moved beside the deriver) re-derives when it changed. Two tests added first and seen red (stale bindings;
  in-place config swap). Also fixed my own test data (`timeline.window.outTime` is not the wire spelling —
  `timeline.outTime` is).
- 2026-10-21 — steps 6–7: format guide "Preparing a document" + signature lines + exports row; docs-check
  146 ✓; web 212 ✓, react 66 ✓, vue 48 ✓, rn 42 ✓, core 666 ✓ + the 2 memo assertions pending approval; all
  five packages tsc 0. kf: tsc clean (baseline only), 4 relevant specs 77 ✓, preview player tsc 0. Fallout
  from review §16 fixed on the way: kf `wireVersionGuard.spec.ts` imported the now-internal
  `PX_WIRE_SCHEMA_VERSION` from the main entry → import moved to `/internal`, assertions untouched.
- 2026-10-21 — owner approved the 2 memo-assertion updates: `PxTimelineCompat.test.ts` line 95 and 130 `toBe` →
  `toEqual` (title "…memoised for a nested one" → "…pure for a nested one"). Core 668/668.
