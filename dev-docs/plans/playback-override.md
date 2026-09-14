# Per-instance playback override + two prop renames — implementation plan

**Status: IMPLEMENTED 2026-09-09** — steps 1–6 and 9 of §10. Steps 7 and 8 (the HTML
data-attribute channel and the pre-rendered bootstrap) were dropped by decision D6: a
pre-rendered file already carries `data-px-meta`, so a second override channel would be a
second way to say the same thing.

Written 2026-09-08 from a code survey of all three repos. Companion to
[../reviews/api-schema-review.md](../reviews/api-schema-review.md) §2 (props vs document vocabulary), which this
plan resolves.

### What shipped

| Piece | Where |
| --- | --- |
| The merge itself + 28 tests | `packages/svg-animator-core/src/playback/PxAnimatorConfigPatch.ts` — `mergeAnimatorConfig`, `applyAnimatorConfig`, `foldAnimatorConfigShortcuts` |
| `config` / `resetDocDefaults` + four shortcuts | `createAnimator` (13 tests), React (5 new), Vue (4 new), RN — all four call the ONE core merge |
| Wire rename | `trigger.onFinish` → `trigger.finishAction`; `fill` → `fillMode` on the props |
| Examples | `playback/override-web`, `playback/override-react`, `web/triggers`, both preview players |
| Docs | `docs/library/{playback-and-triggers,web-player,react,vue,react-native,troubleshooting}.md`, `API-docs/format/README.md`, the three package READMEs, the website (synced + three authored pages) |

Verified: player 17/17 turbo tasks (core 426, web 128, react 28, vue 27, rn 42, docs e2e 24,
bundle parity 42), editor 1620 tests + `tsc` clean, website build clean.

**Known gap, deliberately left:** RN has no `onRemove` (§11 lists why), and
`examples/preview-player` has 4 pre-existing `tsc` errors on `doc.width`/`doc.height` being
`string | number` — unrelated to this work, and that example has no `typecheck` script so
turbo never gated it.

### 2026-09-09 audit sweep — 56 verified findings, addressed

A six-lens audit (86 findings, each adversarially re-verified against the current source; 30
refuted) turned up work in three groups beyond the plan's own list.

**Real bugs of THIS work's own class — flat reads on a wire document (all fixed):**

| Where | What it did |
| --- | --- |
| `E/src/kf/export/preview/ExportPreviewContent.tsx` | read `animator.timelineSource`/`.scroll` off the EXPORTED wire doc, so the scroll-sim preview never engaged for a scroll-driven document. Now via `getAnimatorConfig` |
| `E/.../previewPlayerProtocol.ts` | baked the Loop choice into a flat `animator.iterations` — discarded on flatten. Now via `applyAnimatorConfig` |
| `E/.../previewPlayerProtocol.ts` | the generated snippet read `doc.animator.duration`, so the transport timeline was always 1000 ms. Now resolved editor-side through `getAnimatorConfig` |
| `E/.../TestExpectFileAction.tsx` | `expectFile` presets asserted the dotted path `animator.duration` on written Pixodesk JSON — a path the writer stopped producing |
| `P/packages/svg-animator-web/package.json` | `mangle-reserved.json` shipped but had no `exports` subpath, so the import minification.md documents threw. Subpath added |

**Docs contradicted by the source (all fixed):** `frameRate` shown INSIDE `timeline` in three
places (it belongs to `animator`; my own error); nine of fourteen "wire enums" in
`docs/format/README.md` are not exported; `definitions.glyphs`→`fonts`, `clone.type`→`without`,
`textPath.path`→`pathData` still taught in `docs/format` and `../schema-design.md` §0/§4;
`isCombinedShape` listed as supported though deleted; RN `mode` labeled with the ENGINE values
`waapi`/`frames`; the tarball UMD filename; `createAnimatorImpl`'s signature (missing the two
params this work added); a Vue sample using `:time="0.5"` where `time` is MILLISECONDS (the
fraction prop is `progress`); a React sample combining `startOn` with `apiRef`, which forces
`programmatic` and discards it; a web-README snippet declaring `const animator` twice;
`setupAnimationTriggers` described as an "override" when it only ADDS listeners; and the claim
that the UMD global carries "the same API" — it carries **11** names, the ESM entry **92**.

**Consistency:** `PxCloneWithout`/`PxLoopRepeatAt`/`PxLoopDirection`/`PxStrokeTrimSubPaths` were
core-only — now re-exported from the web package too; `minification.md` was orphaned from the
docs prev/next chain (and `troubleshooting.md` had no nav at all); the RULE numbers in
`PxAnimatorConfigPatch.test.ts` did not match the RULE numbers in the code.

**Deliberately NOT done, and why:**
- **The editor's ~97 flat-spelling spec fixtures.** Unlike the player's, the editor's flat form
  is a supported INPUT and several suites test that boundary on purpose
  (`SvgaJsonSerializationUtil_animator`, `animator-config`, the scroll specs, and two
  `known-failing-cases` files calibrated to a specific read path). Only the two literals that
  *teach* the retired spelling were fixed: a doc-comment example, and a dead `googscript` sketch
  now marked historical and un-typed (it claimed to be a `PxAnimatedSvgDocument` and never was).
- **§6.5 / D12** — see below.

Repos: **P** = `pixodesk-svg-animator` · **E** = `kf/app` (editor) · **W** = `pixodesk-website`.

---

## 0A. IMPLEMENTATION CHECKLIST

Every deliverable, one line each. `[x]` = implemented AND verified; `[-]` = deliberately not
done, with the decision that says why. There is nothing in this plan that is merely started.

**The merge (§3)**
- [x] `PxAnimatorConfigPatch.ts` in core — `mergeAnimatorConfig`, `applyAnimatorConfig`, `foldAnimatorConfigShortcuts`
- [x] RFC 7386 base semantics: objects merge, values replace, `null` deletes
- [x] RULE 1 — a different `timeline.type` replaces, carrying only the shared keys
- [x] RULE 2 — same/absent type merges (absent normalized to `time`)
- [x] RULE 3 — time-only keys on a scroll timeline are dropped + warned
- [x] RULE 4 — `iterations: 'infinite'` rejected on a scroll range
- [x] RULE 5 — flat-base warning
- [x] RULES 6/7 — arrays & primitives replace; `null` deletes
- [x] `definitions` / `animateById` never reset by `resetDocDefaults`
- [x] Pure — neither argument mutated, result always a new object (the flatten memo keys on identity)
- [x] 28 tests, RULE numbers matching the code

**The renames (§4)**
- [x] `fill` → `fillMode` (props)
- [x] `trigger.onFinish` → `trigger.finishAction` (wire), compile-guarded by `PxTriggerSchema`
- [x] `animator.frameRate` → `animator.timeline.frameRate` (2026-09-09 — it parameterises the engine `timeline.engine` selects, so it belongs at the same level; `animator` now holds only non-playback keys)

**The surfaces (§5, §6)**
- [x] `createAnimator` / `createAnimatorImpl` — `config`, `resetDocDefaults`, + 4 shortcuts (13 tests)
- [x] React component — same surface, one `applyAnimatorConfig` call, `programmatic` take-over preserved (28 tests)
- [x] Vue component — same (27 tests)
- [x] React Native component — same, patch applied on the wire doc before compile (42 tests)
- [x] JSON-string form of `config` accepted everywhere (mangling-proof)
- [x] A shortcut wins over the same key inside `config`
- [-] HTML data-attribute channel (§5.2) — **dropped, decision D6**: a pre-rendered file already carries `data-px-meta`
- [-] Pre-rendered bootstrap channel (§5.3) — **dropped, decision D6**, same reason
- [-] RN `onRemove` — **not added**: its RN semantic (unmount vs the web's DOM removal) is a judgement call, not a port

**Fixtures & examples (§6.3, §6.4)**
- [x] `override-web` + `override-react` examples rewritten to `config` — the acceptance test
- [x] `web/triggers` example fixed (was RED — the same flat-override bug)
- [x] Both preview players routed through the shared merge
- [x] 197 flat-spelling fixture sites migrated, flatten-equivalence proven
- [x] `PxWireSpellingGuard.test.ts` — the guard, proven to FAIL on a reintroduced flat literal
- [-] Flat-document ACCEPTANCE removal — **deliberately not done, decision D11**: old files must keep playing, and the premise for removing it evaporated (see minification-boundary.md §6.1)
- [-] Editor's ~97 flat-spelling spec fixtures — **not migrated**: there the flat form is a supported INPUT and several suites test that boundary on purpose (two `known-failing-cases` files are calibrated to a specific read path). Only the literals that TEACH the retired spelling were fixed
- [-] 4 RN feature-explorer cases still invalid — **needs a re-export from the editor**, not a rename: animated gradients changed structurally (one animatable `focal`/`center` vs two scalar channels)

**Typechecker gaps (§7)**
- [x] 7.2 — the timeline union is locked to hand-written interfaces (`implementsInterface` + `KeysMatch`), verified by watching a `fillMode` rename fail to compile
- [x] 7.5 — `analyze-bundle.mjs` derives the wire keys from the schemas (shared `scripts/lib/schema-keys.mjs`) instead of a hand list that had drifted
- [-] 7.3 — the editor's runtime-view key map is still hand-written literals. Correct by construction (those keys are NOT schema fields), so there is nothing to derive it from
- [-] 7.4 — the editor's production write audit is still non-strict; its strict tripwire is `PxSchemaFullCoverage.spec.ts`
- [-] 6.5 / D12 — the editor's hand-rolled `flatten → mutate → nest` merges. **Optional cleanup, not done**: correct and commented today, and its row model stores scroll config in the flat shape, so routing it through `applyAnimatorConfig` means reshaping the trigger-explorer row type

**Docs (§9)**
- [x] `docs/library/{playback-and-triggers,web-player,react,vue,react-native,troubleshooting,minification}.md`
- [x] `API-docs/format/README.md` — options, props, the merge functions, and 128/128 core + 96/96 web exports documented
- [x] `docs/format/README.md` / `SCHEMA.json` / `SCHEMA.html` regenerated
- [x] The three package READMEs
- [x] Website synced, plus the hand-authored pages
- [x] 0 broken links or anchors across the doc set

---

## 0. What this delivers

1. **A per-instance override of the playback settings**, expressible identically on every
   surface that has a JS player: `createAnimator`, the HTML data-attribute path, the
   editor-generated pre-rendered bootstrap, and the React / Vue / React Native components.
2. **Two renames** that end the "props say one thing, the document says another" split:
   the components' `fill` → `fillMode`, and the wire's `trigger.onFinish` → `trigger.finishAction`.
3. **A bug fix** — see §1.1: the existing prop overrides are already a no-op.

---

## 1. Six facts that constrain everything below

Each was verified in source; each one sinks an obvious-looking implementation.

### 1.1 The existing override props are a silent no-op (this is a bug, not a gap)

`flattenAnimatorTimeline` copies the flat keys off the config first
(`P/packages/svg-animator-core/src/format/PxAnimatorConstants.ts:331`) and **then overwrites them from
`timeline.*`** (`:356-367`). React (`P/packages/svg-animator-react/src/PixodeskSvgAnimator.tsx:375-419`)
and Vue (`P/packages/svg-animator-vue/src/PixodeskSvgAnimator.ts:127-166`) write overrides to
those flat keys, so on any 2026-09-format document **every timing and trigger prop is discarded**:

```
base  { timeline: { duration: 1000, iterations: 2, fillMode: 'none', trigger: { startOn: 'load' } } }
+ props { duration: 5000, iterations: 'infinite', fill: 'both', trigger: { startOn: 'programmatic' } }
→ flatten → { duration: 1000, iterations: 2, fill: 'none', trigger: { startOn: 'load' } }
```

RN escapes it only because it re-bases on the already-flattened config
(`P/packages/svg-animator-rn/src/PixodeskSvgAnimator.tsx:335`).

Casualties already in the tree:
- `P/examples/docs-examples/src/cases/playback/override-web/main.ts:5-12` — uses the flat
  spelling over a wire-format fixture, so the case autoplays instead of staying frozen;
- `P/examples/docs-examples/e2e/cases.spec.ts:155-159` asserts the opposite → **currently red or unrun**;
- `P/examples/docs-examples/src/cases/playback/override-react/main.tsx:8` passes `mode="frames"`,
  which is not a `PxTimelineEngineSetting` any more (`auto|native|player`);
- `P/examples/preview-player/src/players/types.ts:66-77` — same no-op class;
- `P/docs/library/playback-and-triggers.md:162-163` documents the nested form, which works but
  **silently drops `duration`** because it replaces the whole `timeline`.

**Consequence for sequencing:** the merge must land before the shortcut props, or we ship four
more silent no-ops. The red e2e case becomes the acceptance test for the feature.

### 1.2 A new option key gets silently minifier-mangled

`P/scripts/collect-identifiers.mjs:117-124` computes `safeToMangle` = declared property names
minus (wire keys ∪ string literals ∪ exported names ∪ domprops ∪ len ≤ 2), and
`P/packages/svg-animator-web/tsup.config.ts:40-58,74,126` feeds it to terser for the minified full
UMD **and both minified pre-rendered UMDs**.

| candidate key | protected by | verdict |
|---|---|---|
| `data` | string literal `P/packages/svg-animator-web/src/shared/PxAnimatorKeys.ts:18` | safe |
| `animator`, `duration`, `delay`, `iterations`, `startOn` | wire keys | safe |
| `container` | terser's `domprops` | safe by luck |
| `playback` | three `console.warn` prose strings only | **fragile** |
| `playbackReplace`, `override`, `settings`, `patch` | nothing | **would be mangled** |

`callbacks` and `adapter` are *already* mangled in the shipped bundles (`n.W`, `n._`) — a live
bug nobody noticed, which is exactly how this fails: silently.

**Consequence:** every new public option key must be declared as a string-literal constant next
to `PX_ANIMATOR_DATA_KEY` **and** guarded by a test that greps the built bundle.

### 1.3 The merge must happen on the nested wire form, never via the flat view

- `nestAnimatorTimeline` is a **no-op** on anything already carrying `timeline`
  (`PxAnimatorConstants.ts:380`), so a wire→flat→merge→wire round-trip returns the *pre-merge*
  nesting for every real document.
- The round-trip is lossy: `iterations: 'infinite'` is dropped on the scroll branch (`:390`),
  `trigger.onFinish` collapses into `resetOnFinish` and back (`:360-361` / `:419-423`), and an
  empty time-branch emits no `timeline` at all (`:427`).
- `pin: false` cannot survive it (`:348` vs `:406-414`).

### 1.4 The merge must allocate; mutation poisons a memo

`flattenAnimatorTimeline` memoises on object identity (`PxAnimatorConstants.ts:316-318,328,369`).
A merge that mutated `doc.animator` in place would make every later `getAnimatorConfig` return the
**pre-merge** view. The editor already does the correct dance and is the reference
(`E/src/svgeditor/animation/TSvgSvgAnimationAttr.tsx:307-310`).

### 1.5 The animator config has two addresses

`PxAnimatorConstants.ts:297`: `doc?.animator || doc?.meta?.animator` — the second is the
pre-rendered `.svg` `data-px-meta` blob. The patch must write back to whichever it read, and must
never create the other (a writer would then emit two configs).

### 1.6 `Partial<PxAnimatorConfig>` is the wrong type for the override

`PxAnimatorConfig` is deliberately a **superset** carrying both the flat runtime view and
`timeline` (`P/packages/svg-animator-core/src/format/PxAnimatorTypes.ts:824-923`). A `Partial<>` of it
would accept `{duration}` *and* `{timeline:{duration}}` with different results — re-opening the
ambiguity the 2026-09 overhaul closed. The override needs a **wire-only** type.

---

## 2. Decisions to confirm before step 1

| # | Decision | Recommendation |
|---|---|---|
| D1 | Shape and names | **CONFIRMED: `config` object + `resetDocDefaults` flag** (§2.1) |
| D2 | Wire rename `trigger.onFinish` → `trigger.finishAction` | **CONFIRMED — do it** (§4.2) |
| D3 | Component prop `fill` → `fillMode`; runtime view keeps `fill` | **CONFIRMED** — only the props move (§4.1) |
| D4 | Flat shortcuts `duration`, `delay`, `iterations`, `startOn` | **CONFIRMED** |
| D5 | Drop the other flat props (`mode`, `direction`, `frameRate`, `outAction`, `scrollIntoViewThreshold`, RN `resetOnFinish`) | **CONFIRMED** — all expressible in `config` |
| D6 | HTML attribute channel + pre-rendered bootstrap | **DROPPED** — `data-px-meta` is the editor's channel and no second attribute belongs in the library. Consequence: a page hosting an exported `.svg` cannot override its playback; the config is baked at export time |
| D7 | `config` scope | **CONFIRMED: the whole animator config, `definitions` included** (§2.1) |
| D8 | RN parity | **CONFIRMED** — add `startOn` + `onRemove`, drop `resetOnFinish`; `mode`/`frameRate` stay N/A (§11) |
| D9 | The 18 flat-spelling test documents | **CONFIRMED** — migrate them to the wire spelling as part of this work (§6.4) |
| D10 | `callbacks`/`adapter` mangling (a live bug) | **CONFIRMED to fix here** — boundary module + tests, option (c) in §7A |
| D11 | Flat-spelling tolerance | **KEEP** — old flat documents go on playing; `validateDocument` stays the place that flags them. Only our own 18 fixtures migrate (§6.4) |
| D12 | Editor migrating its hand-rolled merges to `config` | **OPTIONAL** — cleanup + dogfooding, not required (§6.5) |

### 2.1 Shape: one object + one flag (confirmed)

```jsx
<Animator doc={doc} config={{ timeline: { duration: 2000 } }} />                    // merge over the document
<Animator doc={doc} config={{ timeline: { duration: 2000 } }} resetDocDefaults />   // ignore the document's playback
```

This is better than the two-prop `config` + flag shape it replaces, for a reason
that only becomes visible once written down: with *reset-to-defaults* semantics the object **need
not be complete**. Unspecified keys fall back to the player's own defaults rather than to the
document's values, so both modes take the **same deep-partial type** — which removes the only
strong argument for two props (their types would have differed).

It also gives the flag alone a meaning: `resetDocDefaults` with no object = "play this file with
vanilla playback settings", which is a real use.

| mode | result |
|---|---|
| `config` only | `merge(document's playback, config)` |
| `config` + flag | `merge(player defaults, config)` — the document's playback is ignored |
| flag only | player defaults |
| neither | the document, untouched |

**Scope: `config` is the whole animator config**, `definitions` included — so a per-instance font
or easing swap is expressible. The merge rules for keyed records (§3.1 C7) already cover it.

**The flag never resets content.** `definitions` and `animateById` are kept from the document even
under `resetDocDefaults`, unless `config` supplies them explicitly. Resetting them would leave an
animation with nothing to animate. This is the one carve-out the `config` name has to document —
with the narrower name `playback` it would have been a tautology; the tradeoff was accepted.

**`config` also accepts a JSON string.** `config='{"timeline":{"duration":2000}}'` parses to the
same value. Strings are immune to property mangling, so this is the escape hatch for a consumer
whose own build renames object-literal keys (§7, S2), and it is the exact value the HTML attribute
carries — one shape, three surfaces.

**Open — the noun.** `config` reads well in JSX and, being all-lowercase, is safe from both
obfuscators (§7.1). Its one cost: inside `createAnimator({ data, config })` the options object is
*itself* a config, and the "everything except `definitions`/`animateById`" carve-out becomes a rule
to document. `playback` avoids both (the wire block minus those two tables **is** what this project
calls playback, so the carve-out is a tautology) at the cost of joining the
`play`/`pause`/`autoplay` autocomplete cluster.

**Open — the flag.** `resetDocDefaults` reads ambiguously (reset *to* the doc's defaults?).
Clearer: `ignoreDocConfig` / `ignoreDocPlayback` (pairs with the noun), or `resetDocConfig`.

---

## 3. Step 1 — the merge, in core (no surface wiring)

New file `P/packages/svg-animator-core/src/PxAnimatorPatch.ts`, exported from `src/index.ts`.

```ts
/** Pure. Wire form in, wire form out. Never mutates either argument. */
export function mergeAnimatorConfig(
    base: PxAnimatorConfig | undefined,
    patch: PxAnimatorConfigPatch | null,
): { config: PxAnimatorConfig | undefined; warnings: Array<string> };

/** Document level: resolves the two addresses (§1.5), returns a NEW document that
 *  shares every untouched subtree by reference. */
export function applyConfigPatch(
    doc: PxAnimatedSvgDocument,
    patch: PxAnimatorConfigPatch | null,
): { doc: PxAnimatedSvgDocument; warnings: Array<string> };

/** Replace variant — the document's definitions/animateById are carried over. */
export function applyConfigReset(
    doc: PxAnimatedSvgDocument,
    playback: PxPlayback,
): { doc: PxAnimatedSvgDocument; warnings: Array<string> };
```

**Base semantics:** JSON Merge Patch (RFC 7386) — objects merge per level, primitives and arrays
replace, `null` deletes. `null` is the right sentinel because it is not a legal value anywhere in
the schema, and deletion is the only way to restore a meaningful *absence* (`timeline.engine` absent
= `auto`, `timeline.type` absent = time, `fillMode` absent = `forwards`).

### 3.1 Custom rules (each needs a worked test)

| # | Site | Rule |
|---|---|---|
| C1 | `timeline.type` **differs** between base and patch | **Replace** the whole timeline; carry over only the keys shared by both members (`duration`, `iterations`, `mode`, and nothing else). Prevents clock keys stranded on a scroll timeline. |
| C2 | `timeline.type` equal, or **absent in the patch** | Merge per level. **Normalize absent → `'time'` before comparing**, or a patch that spells `type: 'time'` against a document with an absent type wrongly triggers C1. A patch without `type` never changes the type. |
| C3 | Time-only keys (`trigger`, `delay`, `fillMode`, `direction`) landing on a scroll/view timeline | Drop them and warn — the same way the wire has no slot for them. |
| C4 | `iterations` | `'infinite'` is legal on a time timeline only; on scroll it must be finite. Reject + warn rather than silently coerce. |
| C5 | `pin` (boolean **or** object) | Whole-value replace, both directions. |
| C6 | `range` | Merge two levels (`range.start.fraction` alone keeps `range.start.phase` and `range.end`). |
| C7 | Keyed records (`definitions.fonts`) | Merge by key — patching one font must not drop the others. *(Only reachable via the merge variant if we later allow `definitions`; out of scope for `playback`.)* |
| C8 | `animateById` | Not patchable through `playback` — it is animation content, not playback. |
| C9 | Arrays (keyframes, easing tuples, transform tuples) | Always replace. Never index-merge, never concatenate. |
| C10 | Base carries flat runtime keys | Warn (`base carries the flat runtime spelling`) and merge on the nested subtree anyway. Do **not** nest the base first — `nestAnimatorTimeline` would no-op (§1.3). |

### 3.2 Failure handling

Validate the merged config strictly and **return** warnings; never throw, never silently drop.
`applyConfigPatch` returns them; every caller decides the channel (players `console.warn`, the
editor its audit, CI the exit code). This is the same contract as `validateDocument`.

### 3.3 Tests (new `PxAnimatorPatch.test.ts`)

RFC 7386 base semantics · C1–C10, one test each · `null` deletes and restores the default ·
merge never mutates base or patch · result is a new object identity (§1.4) · wire-form-only
guard · both animator addresses · `doc.meta.animator` shadowed → warns · empty patch returns the
document by identity.

**Verify:** `pnpm --filter @pixodesk/svg-animator-core test`

---

## 4. Step 2 — the two renames

### 4.1 `fill` → `fillMode` (props only)

Three layers exist; **only the props move**:

| layer | before | after |
|---|---|---|
| wire | `timeline.fillMode` | unchanged |
| runtime view (internal) | `fill` | unchanged |
| component props | `fill` | **`fillMode`** |

Do **not** rename the wire to `fill` — that inverts a codified regression test
(`P/packages/svg-animator-core/src/format/PxTimelineCompat.test.ts:161-164`) and contradicts the schema's
own rule that `fill` is paint everywhere else (`PxAnimatorTypes.ts:783-785`).

Under D5 the prop disappears into `playback.timeline.fillMode` anyway, so this rename is mostly
about the docs and the RN prop list.

### 4.2 `trigger.onFinish` → `trigger.finishAction` (wire)

Reason: `onFinish` is a *value* key sitting next to the callback `onFinish()` and the prop
`onFinish={fn}` — in JSON that is fine, in a TS document literal or JSX it is not. `finishAction`
pairs with its existing sibling `outAction`.

Blast radius is small — the wire key exists in **5 source places**:
`PxAnimatorTypes.ts` (schema + interface), `PxAnimatorConstants.ts` flatten (`:360-361`) and nest
(`:419-423`), and `E/src/svgeditor/model/serialization/schema/coverage/PxSchemaFullCoverageDoc.ts:595`.
The ~40-file `resetOnFinish` blast radius is the **runtime view**, which does not rename.

Also required, and easy to miss:
- `E/src/kf/common/development/triggerexplorer/DevTriggerExplorer.tsx:315` renders the literal
  string `` `onFinish: reset` `` in the UI;
- `W/src/content/docs/svga/editor/175-playback-settings.md:33` quotes `timeline.trigger.onFinish: "reset"`;
- RN prop `resetOnFinish` is dropped (D5).

**Typechecker will NOT catch this** — see §7.

**Verify:** core tests, then `E: npx tsc --noEmit -p tsconfig.json` and the strict tripwire
`yarn test-impl -t "full schema-field coverage"`.

---

## 5. Step 3 — wire the surfaces

Order matters: core → web → components → editor generator.

### 5.1 `createAnimator` (the reference surface)

Add to `PxAnimatorOptions` (`P/packages/svg-animator-web/src/animator/PxAnimator.ts:115-126`) and to
`createAnimatorImpl` (`:46-51`):

```ts
config?: PxAnimatorConfigPatch | string;   // merge (or a JSON string)
resetDocDefaults?: boolean;               // ignore the document's playback settings
duration?: number; delay?: number; iterations?: number | 'infinite'; startOn?: StartOn;  // shortcuts
```

Apply **immediately before `PxAnimator.ts:64`** — after the effects warning, before every read:

| must precede | why |
|---|---|
| `:64-65` engine pick | `timeline.engine` selects the engine |
| `:70` `materializeAllInTree` | loop expansion and motion-path sampling read `duration` |
| `:79` `generateNewIds` | it rewrites `animateById` keys; patch keys must land while authored ids stand |
| `bindWithEngineChoice` | consumes `debugGlobalName` |

Both entry paths must plumb it: inline `data` (`:147`) and the fetch path (`:171`).
Shortcut precedence: a flat shortcut beats the same key inside the object; implement once, in a
shared `resolvePlaybackOptions()`.

**Mangle guard (§1.2):** add `export const PX_ANIMATOR_CONFIG_KEY = 'config';` (and the
replace variant) to `PxAnimatorKeys.ts`, use the constants, and add the bundle test from §8.

### 5.2-5.3 HTML attribute channel and pre-rendered bootstrap — DROPPED (D6)

No new `data-px-*` attribute enters the library: `data-px-meta` is the editor's re-import channel
and nothing else should compete with it. The generated bootstrap keeps its single `data` key, so
`P/packages/svg-animator-web/src/engines/PxAnimatorBind.ts` and the editor generator
(`E/src/svgeditor/model/serialization/SvgaJsonSerializationUtil.tsx:168-176`) are untouched by this
work — which also removes the bundle-size gate from the critical path.

**Consequence to document:** a page hosting an exported pre-rendered `.svg`, or a
`data-px-animation-src` div, cannot override playback per instance. Those files carry the playback
settings the editor baked in. Overrides are a JS-API feature (`createAnimator` and the three
components).

### 5.4 Editor spec anchors that will break here

- `E/src/svgeditor/model/elements/use/effect.retime.nested.svgCss.spec.ts:270-273` — inline
  snapshot of the emitted bootstrap.
- `E/src/svgeditor/model/serialization/spec/SvgaSerializationUtil_animatorScriptPayload.spec.ts:74-105`
  and `gradient-endpoints-anim-player-dict.spec.ts:61-72` — brace-walking parsers that return
  `arg.data`; change them to return the whole argument and assert both keys.

---

## 6. Step 4 — the components

### 6.1 The prop surface after the change

**Inside `config` + flag** (was: flat props): `mode`, `duration`, `delay`,
`iterations`, `direction`, `fillMode`, `frameRate`, `trigger.*`, and — new capability — every
scroll/view field (`type`, `axis`, `subject`, `range`, `pin`, `smoothing`).

**Shortcuts:** `duration`, `delay`, `iterations`, `startOn`.

**Everything else stays flat — the per-instance props that are not the document:**

| group | React | Vue | RN |
|---|---|---|---|
| source | `doc`, `playback`, `playbackReplace` | same | same |
| host element | `className`, `style` | attribute fallthrough | – |
| declarative control | `autoplay`, `play`, `pause` | same | same |
| controlled time | `progress`, `time` | same | same |
| imperative | `apiRef` | `expose()` template ref | `apiRef` |
| lifecycle | `onPlay onStop onPause onCancel onFinish onRemove` | the six emits | the five (no `onRemove` — add for parity) |
| failure | – (addable) | – (addable) | `onError`, `fallback` |

### 6.2 The rebuild guard (§1.1's other half)

Today: React deep-compares the **merged document** every render
(`P/packages/svg-animator-react/src/PixodeskSvgAnimator.tsx:461` + `Utils.ts:64-107`); Vue
rebuilds the animator on **every** re-render (reference watch on a computed that mints a new
object, `vue:270-273,365`); RN recompiles the whole document on a new `doc` identity
(`rn:389`).

Fix: hoist React's structural comparator into core, and compare
**`(compMode, doc, playback, className, style)` — not the merged document**. `doc` hits the `===`
fast path; only the small override object walks the deep path, so the O(document) compare
disappears. Then:

- React: `useDepsVersion(...)` gains the override; the merge moves into a `useMemo` keyed on the version.
- Vue: introduce a monotonic `version` ref bumped only when the structural compare fails; watch the
  version, keep `flush: 'post'`.
- RN: deps become `[doc, version]`; drop the hand-rolled override block (`rn:335-348`).

**Rebuild vs live contract** — rebuild: `doc`, the whole override, the shortcuts, `container`,
`className`/`style`, `compMode`. Live: `play`/`pause`, `progress`/`time`, `setPlaybackRate`, all
callbacks, `apiRef`, RN `onError`/`fallback`. Trigger fields stay in the **rebuild** bucket even
though they could be live, because the pre-rendered and attribute surfaces have no live path and
the point of this work is to remove behavioral differences.

### 6.5 OPTIONAL — migrate the editor's hand-rolled merges (D12)

The editor already does by hand what `config` will do properly:
`E/src/kf/common/development/triggerexplorer/triggerRows.ts:668-682` builds each row by
`flatten → mutate flat keys → nest`, and the preview panels clone-and-mutate documents. These
could become `createAnimator({ data: doc, config: {…} })` — one merge implementation instead of
several, and a real consumer dogfooding the API. Cleanup, not a requirement.

### 6.4 Migrate the flat-spelling test documents (D9) — **DONE 2026-09-09**

The estimate of "18 test documents" was low by an order of magnitude. A precise scan (balanced
brace-matching, not grep) found **197 sites**:

| Where | Sites | Shape found |
| --- | --- | --- |
| `examples/react-native-feature-explorer/src/cases/*.svga.ts` | 122 | flat keys **plus a string-valued `"timeline": "time"`** — the pre-2026-09 discriminant, on which `flattenAnimatorTimeline` bails out entirely (`typeof timeline !== 'object'`), so the flat keys were what actually ran |
| package test files (22 files) | 69 | flat `duration` / `mode` / `direction` / `trigger` / `fill` |
| `examples/react-native-preview-player/src/samples.ts` | 6 | flat `duration` / `iterations` / `direction` / `trigger` |

All migrated. Two things made it safe rather than hopeful:

1. **A flatten-equivalence oracle.** Every `animator` block was run through the REAL
   `flattenAnimatorTimeline` before and after; the engines only ever see that flat view, so an
   identical view is proof the re-spelling changed no behavior. 122/122 identical, the sole
   difference being the vestigial `timeline: "time"` string that no engine reads.
2. **`validateDocument` over the result.** The 122 cases now report **zero** animator warnings
   (they had 24, from a second stale rename — `definitions.fonts.*.style`, whose wire name has
   been the REQUIRED `fontStyle` since review §5.2; fixed in the same pass).

Two behavioral traps the mechanical pass could not see, both caught by running the suites:

- `index.test.ts` mutated `json.animator.duration = 256` at RUNTIME. Once the fixture was
  nested, that flat sibling was silently overwritten by `timeline.duration` on flatten, and the
  loop assertions failed. Re-addressed to `animator.timeline.duration`.
- `PxSchema.test.ts` declares its **own toy schemas** to unit-test the schema toolkit — its
  `animator` is a fixture of that toy format, with no `timeline` key at all. Migrating it made
  `sanitize` drop the whole block. Reverted and permanently exempted.

The tolerance itself is untouched (D11): old files in the wild keep playing, and
`validateDocument` remains the place that reports the old spelling.

#### What the migration uncovered: the RN snapshots were stale in FIVE ways, not one

`examples/react-native-feature-explorer/src/cases/*.svga.ts` are a hand-copied snapshot of the
editor's own 127 feature-explorer fixtures, taken before the 2026-09 renames and never refreshed.
Running `validateDocument` over them after the timeline fix turned up four more stale spellings —
each confirmed key-for-key against the editor's fixture for the SAME case, which validates clean:

| Stale | Current | Sites | Note |
| --- | --- | --- | --- |
| `definitions.fonts.*.style` | `fontStyle` | 24 files | review §5.2; `fontStyle` is REQUIRED, so those documents were invalid |
| `fillGradient`/`strokeGradient` `p1 p2 c r fp` | `start end center radius focal` | 19 files, 102 keys | review §4.2, "plain words, no abbreviations" |
| `maskedBy.href` | `maskedBy.source` | 26 | F5. Values left bare — every applier reads through `stripHash` ("`#id` canonical, bare legacy") |
| `clone.baseId` | `clone.source` | 22 | ditto; `clone.without` was already correct in those files |
| `strokeTrim.trimAllAsOne: true` | `subPaths: 'combined'` | 18 | boolean → named enum |

Result: **117 of 122 cases now validate clean, up from 64.** `caseTypes.ts` used to excuse all of
this as "keys the player's schema does not declare" — that was true of only a handful.

**The 5 that remain are NOT renames** and were deliberately left: an animated gradient is now one
animatable `focal`/`center` (`{value, keyframes}`) where the snapshot has two scalar channels
(`animate.gradientFx` / `gradientFy`); likewise `clipPath.animate` and one `transform.loop.before`.
Converting those means re-pairing keyframes, which would silently change what the case demonstrates.
**The fix is to re-export those five from the editor**, not to hand-edit them.

**The guard that keeps it migrated:** `packages/svg-animator-core/src/format/PxWireSpellingGuard.test.ts`
scans `packages/` and `examples/` for `animator: { … }` literals carrying a playback key at the
top level and fails with `file:line  keys`. Three files are exempt by name, each with its reason.
Verified to fail on a reintroduced flat literal, not just to pass.

### 6.3 Fix the shipped examples (the acceptance test)

`override-web/main.ts`, `override-react/main.tsx` (also drop the stale `mode="frames"`),
`P/examples/preview-player/src/players/types.ts:66-77`. Then
`P/examples/docs-examples/e2e/cases.spec.ts:155-159` should pass for the first time.

---

## 7. What the typechecker will not catch

1. `flattenAnimatorTimeline` / `nestAnimatorTimeline` read the timeline through `any`
   (`PxAnimatorConstants.ts:325,334,381,404,424,427`) — a wire rename produces **zero** errors there.
2. ~~`PxTimeTimelineSchema` has no `implementsInterface` / `KeysMatch` guard~~ — **FIXED
   2026-09-09.** `_PxTimeTimeline`, `_PxScrollishTimelineShape`, `_PxScrollTimeline`,
   `_PxViewTimeline` and `_PxTimelinePin` are now hand-written interfaces, each locked to its
   schema with `implementsInterface` + a `KeysMatch` assertion. Verified by renaming
   `fillMode` in the schema and watching `_ck_PxTimeTimeline` fail to compile — before this,
   that rename produced **zero** errors anywhere in the repo.
3. The editor's runtime-view key map is **hand-written string literals**
   (`E/src/svgeditor/model/serialization/schema/PxSchemaUtil.ts:1078-1090`), consumed at
   `TSvgSvgAnimationAttr.tsx:433-437,464-465`.
4. The editor's production write audit is **not strict**
   (`E/src/svgeditor/model/serialization/schema/validation/PxSchemaValidationUtil.ts:392-393`), so it will not
   report an unexpected extra key. The editor's only strict tripwire is a spec:
   `PxSchemaFullCoverage.spec.ts:72`.
5. ~~Hardcoded key list: `P/scripts/analyze-bundle.mjs:36`~~ — **FIXED 2026-09-09.** The walk
   that derives the wire keys from the built core's runtime schemas moved to
   `scripts/lib/schema-keys.mjs`, and both `collect-identifiers.mjs` and `analyze-bundle.mjs`
   import it, so the two can no longer disagree. The old literal had drifted: it still carried
   `timelineSource` (a runtime-view key that was never on the wire) and had missed `timeline`,
   `mode`, `trigger`, `startOn`, `finishAction`, `pin` and `range`. The script's default bundle
   path was stale too (`index.umd.min.js`, which has not existed for some time) — corrected to
   `pixodesk-svg-animator.umd.min.js`.

---

## 7A. Obfuscation and the wire boundary — MOVED

This grew into a body of work of its own and now lives in
**[minification-boundary.md](./minification-boundary.md)**: twelve public names are renamed
in the shipped minified bundles (callbacks never fire, `domType` ships as `dom-type`, native
view-timeline ranges are ignored, legacy flat scroll documents play time-driven), the editor's next
production build will mangle three wire keys from the 09-07/09-08 renames, and no test in either repo
runs property-mangled code.

**That plan lands first.** The `config` work in this document depends on it: the new option key would
otherwise be silently mangled the same way `callbacks` and `adapter` already are, and the boundary
module it introduces is where the new key gets declared.

---

## 8. Build order, and the trap in it

```
cd P
pnpm --filter @pixodesk/svg-animator-core build
pnpm --filter @pixodesk/svg-animator-web  build
pnpm --filter @pixodesk/svg-animator-react build && pnpm --filter @pixodesk/svg-animator-vue build
pnpm --filter @pixodesk/svg-animator-rn   build
node scripts/gen-schema-json.mjs     # reads core/dist — AFTER the core build
node scripts/gen-schema-html.mjs     # reads docs/format/README.md — AFTER the docs/format/README.md edit
```

**The trap:** the editor typechecks and builds against the player's **dist**
(`E/tsconfig.json:33-36`, `E/webpack.config.ts:24,411-420`) while its vitest suite aliases to the
player's **src** (`E/vitest.browser.config.ts:63-64`). And `P/turbo.json:5-11` has
`build.dependsOn: ["^build", "test"]`, so **a failing unit test blocks `dist` emission** — mid-change
the editor keeps typechecking green against a stale `.d.ts` while its own vitest run is already
red. Run the editor suite twice: once as-is, once after a successful player build.

`P/packages/*/dist` is gitignored; `docs/format/README.md`, `SCHEMA.json`, `SCHEMA.html`, `API-docs/format/README.md` are
currently **untracked** — commit them before expecting a reviewable diff of generated output.

### Mangle guard (the check that does not exist yet)

```
pnpm --filter @pixodesk/svg-animator-web build
node -e "const j=require('./scripts/.identifiers.json');console.log('MANGLED:', j.safeToMangle.includes('config'))"
grep -c 'config' packages/svg-animator-web/dist/index.prerendered.umd.min.js   # must be > 0
grep -c 'config' packages/svg-animator-web/dist/pixodesk-svg-animator.umd.min.js
```

### Regression tests that would have caught both bugs

The reason nothing failed is structural: **every unit test runs against `src`**, and the override
tests used flat-spelling documents. Four layers, in order of value:

1. **Behavioral tests against the built minified UMD** — load `dist/*.umd.min.js`, call
   `PixodeskAnimator.createAnimator({ data, config: {…} })` with a plain object, assert the override
   took effect. Catches mangling *and* wiring.
2. **Classifier assertion** — read `scripts/.identifiers.json`; fail if any boundary key is in
   `safeToMangle`.
3. **Bundle grep** — each boundary key must appear literally in every minified bundle.
4. **A cross-surface contract table** — one list of override cases run against core,
   `createAnimator` (src *and* built), React, Vue and RN, with the rule that **every fixture uses
   the wire spelling**. This is what makes a repeat of the flat-key no-op impossible.

### Per-step verification

```
# player
pnpm --filter @pixodesk/svg-animator-core test        # PxTimelineCompat + PxAnimatorPatch fire first
pnpm --filter @pixodesk/svg-animator-web  test
pnpm --filter @pixodesk/svg-animator-web  test:e2e    # refreshes the git-tracked e2e/fixtures/player.js
pnpm --filter @pixodesk/example-docs-examples test    # the override-web acceptance case

# editor
cd E && npx tsc --noEmit -p tsconfig.json
yarn test-impl -t "full schema-field coverage"        # the only strict tripwire
yarn test-impl src/svgeditor/model/serialization/spec/SvgaSerializationUtil.specs/document/animator-config.spec.ts
yarn test-impl src/svgeditor/model/serialization/spec/SvgaSerializationUtil_animatorScriptPayload.spec.ts
yarn test-impl src/svgeditor/model/elements/use/effect.retime.nested.svgCss.spec.ts
```

---

## 9. Step 5 — documentation

**Player:** `docs/format/README.md` (the `finishAction` key), regenerate `SCHEMA.html` + `SCHEMA.json`,
`API-docs/format/README.md` (prop tables, the new options, the prop→document mapping table from
API-SCHEMA-REVIEW §2), `docs/library/{playback-and-triggers,web-player,react,vue,react-native,troubleshooting}.md`,
`docs/format/README.md`, the three package READMEs.

Fix in passing — **an error I introduced today**: `P/API-docs/format/README.md:78-79` says nothing is written
to `window` directly. It is (`P/packages/svg-animator-web/src/animator/PxAnimator.ts:221-225`), and
`E/src/kf/export/preview/SvgaIframePreviewPlayer.tsx:97` depends on that side effect.

**Website (manual, easy to forget):** `yarn sync:svga-docs` carries the `docs/library` + `docs/format`
pages, but three authored pages must be hand-edited:
`W/src/content/docs/svga/editor/175-playback-settings.md:33`,
`W/src/content/docs/svga/editor/animation/140-animation.mdx:114,127-128`,
`W/src/content/docs/svga/prerendered-svg/on-the-web.md:162,201` (quotes the bootstrap verbatim).

**Also stale, worth fixing while here:** `E/pixodesk-json-mcp/src/doc/summary.ts:135` reads the
runtime-view `resetOnFinish` (never present in a wire document) and `:131` compares
`a.timeline` to a string — both already wrong.

---

## 10. Sequencing

| # | Step | Gate |
|---|---|---|
| 1 | Core merge + tests (§3) | ✅ core tests green |
| 2 | Renames (§4) | ✅ core + editor strict tripwire green |
| 3 | `createAnimator` + mangle guard (§5.1) | ✅ bundle parity suite green (42 tests) |
| 4 | Fix React/Vue/RN to use the merge, drop the dead flat blocks (§6.1-6.2) | ✅ component tests green |
| 5 | Fix the shipped examples (§6.3) | ✅ `override-web` **and** `web/triggers` e2e green — the latter was red for the same reason, and is the acceptance test's twin |
| 6 | Shortcuts (§5.1, D4) | ✅ `duration` · `delay` · `iterations` · `startOn` on all four surfaces |
| 6b | Migrate the flat-spelling fixtures (§6.4, D9) | ✅ 197 sites, flatten-equivalence proven; guarded by `PxWireSpellingGuard.test.ts` |
| 7 | Data-attribute path (§5.2) + editor attribute registry | ⛔ dropped (D6) |
| 8 | Pre-rendered bootstrap (§5.3) — **only if the size budget allows** | ⛔ dropped (D6) |
| 9 | Docs, generated schema, website (§9) | ✅ website build clean |

Steps 1–5 are the bug fix and are worth doing even if 6–8 are deferred.

---

## 11. What cannot be made identical (state it in the docs, do not chase it)

- **`src`** on pre-rendered — the narrow bundles deliberately carry no fetch path.
- **`container`** — the components own rendering; the tagged element *is* the container; a
  pre-rendered SVG is already in the DOM.
- **`callbacks` / `adapter`** — function-valued, so not expressible in HTML or generated markup.
- **`mode` / `frameRate` on RN and pre-rendered** — RN always materializes WAAPI-style; the
  pre-rendered engine is chosen at *export* time, so a runtime `mode` cannot resurrect an engine
  that is not in the file.
- **`startOn: 'mouseOver'` on RN** — no hover on touch.
- **SVG + CSS export** — no player at all, so a per-instance override is structurally impossible;
  same for an SVG embedded as `<img>` or `background-image`.

So the claim is "identical across the **five surfaces that have a JS player**", not "all surfaces".
