# Typed documents: schema casts + type stamps (first-use review §17c)

Owner decision (2026-10-22): the `any` in the player comes from document JSON that is never
*earned* as a type. Fix it with ONE generic mechanism bound to the schema framework — validate
and repair once, immutably, stamping what was checked — so every later cast is a stamp lookup.
Scope of this iteration: the document-related `any` (195 of 319 in shipped source) plus any
non-document case the same mechanism fixes. The rest (schema DSL internals, platform types,
factory generics, test kit, React `deepEquals`) is a later track.

## Decisions

1. **The cast family on every schema** (`PxSchema`), built on the existing `isValid` / `sanitize`:
   `is(raw): raw is T` · `cast(raw): T` (throws `PxSchemaCastError` with the findings) ·
   `castOrNull(raw): T | null` · `castOrFix(raw): { value: T; problems; errors }`.
2. **Type stamps.** `castOrFix` builds a NEW tree in one visit; every object/array it produces is
   stamped (non-enumerable, module-private `Symbol`) with each schema it satisfies — a union
   stamps the member that matched AND itself. `is` / `cast*` / container `isValid` consult the
   stamp first: a stamped value answers without walking. Primitives need no stamp. Inputs are
   never written to; a spread / clone / JSON round-trip yields an unstamped object, re-checked
   on its next cast. A stamped tree passed to `castOrFix` again is returned as is.
3. **Lenient** (owner: "lenient on unknown keys"): undeclared keys are not reported and are KEPT
   untouched — unlike `sanitize`, which strips them. Unstamped legacy files carry spellings the
   schema no longer declares (`timeline.duration` pre-1.3, `trigger.finish` pre-1.4) that the
   readers still accept; stripping them would silently break those files.
4. **One visit.** `_fix(raw, run)` per schema class: builds the copy and counts repairs. A union
   picks the first member that fixes with ZERO repairs (≡ today's "first member whose `isValid`
   passes"), skipping members whose cheap `_canSanitize` already fails. A repaired subtree is
   re-checked before it is stamped (rare path), so a stamp is never a lie. Findings for the
   problems are produced by `isValid(raw, ctx)` on the original — only when repairs happened.
5. **The `checked` stage** of `prepareDocument` (between `current` and `resolved`):
   `PxAnimatedSvgDocumentSchema.castOrFix`; problems go to the caller (`onProblems`) — the players
   warn through their diagnostics channel. The strict boundary diagnostic (mangled-property
   detection) stays a separate check this round: strict cannot trust lenient stamps.
6. Then document-related reads use `Schema.cast*` (fast on stamped data) instead of `as any`,
   and the root holes become `unknown` (`PxNode` index signature, `PxKeyframe<T>` default,
   `keyframeValue()`).
7. Out of scope (owner): the canonical form for animatables (`5` / `{value:5}` / animation).

## Plan (tick as implemented)

- [x] 1. Framework: stamp helpers, `_fix` per schema class, `is` / `cast` / `castOrNull` /
       `castOrFix`, `PxSchemaCastError`, stamp shortcut in container `isValid`.
- [x] 2. Tests FIRST (seen failing): casts narrow + throw with path; stamps make re-checks free
       (walk counter); unions stamp member + union; inputs untouched; extras kept; repaired
       subtree stamped only when valid; `castOrFix` output ≡ `sanitize` output on declared keys.
- [x] 3. Corpus dry-run: `castOrFix` over every real document (kf atest data, website file-format
       examples, player examples) — count changed documents, list changed paths. Gate: valid
       documents come out deep-equal.
- [x] 4. `checked` stage in `prepareDocument` + `onProblems`; the web / React / Vue / RN entries
       report problems; `toAnimatedSvgDocument` stays type-only for TS JSON imports.
- [x] 5. Root holes → `unknown`; replace the document-related `any`, file by file
       (maskedByEffect, contentRefSplit, textGlyphsEffect, config patch, visualModel,
       PxAnimatorConstants/Types, PxDefinitions, transformParts, the rest).
- [x] 6. Guards: `noImplicitAny` on in all five packages; an "any budget" test per package that
       can only go down.
- [x] 7. Batteries (five suites, docs-check, kf typecheck + relevant specs), docs, review card.

## Progress log

- 2026-10-22 — plan written (owner approved the design in chat; go given).
- 2026-10-22 — steps 1–3. Framework: stamps (`PX_SCHEMA_STAMP`), `_fix` per class (scalars via Base;
  Obj/OpenObj/Arr/Rec/Tuple build + `_seal`; Union = first member fixing with zero repairs, stamps only
  objects WE built; DiscriminatedUnion; Optional; Lazy), `is`/`cast`/`castOrNull`/`castOrFix`,
  `PxSchemaCastError`, stamp shortcut in container `isValid` (non-strict) and container `_fix` (a stamped
  subtree is REUSED — re-checking an edited copy rebuilds only what changed). 15 tests, seen red first;
  mutation-proved: union never stamps an input passed through (`px.any`), `_seal` never stamps an invalid
  repair. Core 683 ✓.
  Corpus (314 real documents — kf atest/fixtures/learn assets, website file formats, player examples):
  309 byte-identical, 5 repaired, 0 silent changes. Repaired: 3 deliberate "typo" teaching files; 2 kf
  fixtures missing `definitions.fonts.*.fontStyle` (repaired to "" — the documented normal; the player
  never reads it). Speed: castOrFix over all 314 = 50 ms (today's validate-only walk: 31 ms); re-checking
  the stamped results = 0.07 ms in total.
- 2026-10-22 — steps 4–6.
  - Step 4: the `checked` stage (`castOrFix`, `onProblems`); the web / React / Vue / RN entries report through
    `reportDocumentProblems` (`effectsShape` inside `effects`, else the new `documentRepaired` PX1108).
  - Step 5 — the mechanism, by kind of read:
    | Read | How |
    |---|---|
    | the doc type already says the shape | TS narrowing: `inlineAnimate(node)` (`animate` as an object), `'finish' in trigger` |
    | a value that is a UNION of shapes | the schema cast at the use site: `PxTransformPartsSchema.castOrNull(kf.value)`, `PxPropertyAnimationSchema.castOrNull(node.transform)?.keyframes` |
    | an effect channel (`PxAnimatable<T>`) | `readAnimatable(raw, valueSchema)` casts the static AND every keyframe value with the slot's grammar (`PxVec2Schema`, `PxChannelNumberSchema`, `PxPathValueSchema`, `PxGradientStopsSchema`) — a mismatching static reads Absent, a mismatching keyframe is skipped |
    | an open JSON record (merge patch, id walker) | `Record<string, unknown>` + a predicate |
    | editor-opaque values (glyph paint, `meta`) | `unknown` |
    - Root holes: `PxNode` index, `meta`, `px.any()` / `px.defined()`, `PxAttrValue.value` → `unknown`;
      `isPxDocument(doc: unknown)`; `toDomProps(): Record<string, string>`; `PxAnimatorConfigPatch` /
      `PxTimelinePatch` = `Record<string, unknown> | null`.
    - The legacy `meta.animator` address: one reader, `legacyAnimatorOf` (raw object; `meta` is never checked).
    - The merge stays a JSON merge: the players apply overrides to the RAW document before `prepareDocument`,
      and report merge warnings as `timelineOverrideIgnored` — repairing inside the merge would mislabel the
      document's own problems and hide them from the `checked` stage. The merged config is marked unchecked in
      ONE named place (`uncheckedConfig`).
    - Oracle: every corpus document lowered to `plain` for both engines before vs after = 628/628 identical;
      timing unchanged (~730 ms for the corpus).
  - Step 6: `noImplicitAny: true` in all five packages (2 test params annotated); `anyBudget.test.ts` — AST
    count per package, exact ratchet (seen red both ways: over budget, and under budget → "lower it").
  - Shipped `any`: 319 → 126 (core 99 · web 4 · react 8 · vue 0 · rn 15). What is left is outside the
    document — later track:
    | Left | Where | Why not now |
    |---|---|---|
    | schema DSL internals | `PxSchema.ts` 65, `PxSchemaFieldUniverse.ts` 6 | `PxSchema<any, any>` in constraints / infer positions — type-level work on the DSL |
    | the interpolator's runtime values | `PxDefinitions.ts` 6, `PxNormalizedKeyframe.v` 1 | the per-frame value domain — needs a value union + predicates, a schema cast per frame would be too slow |
    | element-factory generic | `elementFactory.ts` 4, `textGlyphsEffect.ts` 4 | `<E = any>` defaults + the editor's factory signature |
    | platform | `PxFrameLoop` (`globalThis`) 4, web DOM expandos / `style[...]` 4, RN `ComponentType<any>` 15 | not document data |
    | test kit in `src` | `effectTestKit.ts` 9 | tests |
    | React `deepEquals` | react `Utils.ts` 8 | generic deep compare |
- 2026-10-22 — step 7. Five suites green (core 699 · web 212 · react 66 · vue 48 · rn 42), `pnpm check:docs` 146 ✓.
  kf: typecheck clean (the 7 known `migratePxCurrent.spec` errors only) after 4 call-site fixes (`AnimatedWire` keyframes
  typed as `PxPropertyAnimation['keyframes']`, a JSON-parsed patch narrowed, a spec predicate for `meta`, the legacy
  `meta.animator` easings read through `legacyAnimatorOf` + `PxAnimatorConfigSchema.castOrNull`). 131 relevant kf spec
  files: 231 failures, every one also failing at player HEAD (stale feature-explorer fixtures at wire 1.2.1, legacy
  `timeline.duration` test inputs, the lottie scrub visuals) — none from this work.
