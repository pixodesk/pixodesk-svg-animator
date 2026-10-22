# Typed internals: the `any` that is not the document (first-use review §17c, part 2)

Owner decision (2026-10-22): after the document was earned as a type (`schema-cast-and-stamps.md`), the
remaining `any` must go by giving each place its REAL type — not by swapping `any` for `unknown` + casts.
A handful of commented casts is fine where TypeScript genuinely cannot express the fact; scattered ones
are not. In scope: the schema framework (§1), the engine's runtime values (§2a), the glyph text
materializer (§3). Out of scope here: platform edges (§4 — owner decisions 2026-10-22: `debugGlobalName` removed
from the format, `doc` compared by content in React, Vue and React Native — see the log) and tests (§5 — a later iteration).

## Where the remaining `any` comes from (shipped source, 126)

| Source | Count | Why it is `any` |
|---|---|---|
| Schema framework type machinery | 71 | "some schema" spelled `PxSchema<any, any>`; open objects ignore their value schema; object builders; introspection of class internals |
| Engine runtime values | 7 | the engine CONVERTS document values (colour → RGBA, `d` → beziers) into a second data model stored in ONE untyped slot (`v?: any`), then re-guesses each value's kind from the property NAME in four places |
| Glyph text materializer | 8 | one signature serves two worlds — the player (wire nodes) and the editor (its own model objects disguised as a `PxNode`) — so it is typed for neither |
| Platform, test kit | 40 | §4 / §5 — not this plan |

## Decisions

1. **Schema framework.** `PxSchema<T>` only PRODUCES `T` (never consumes it), so
   `PxAnySchema = PxSchema<unknown, boolean, boolean>` is the exact "some schema" type. Open objects type
   their extra keys `unknown` (read them through the open value schema). Each schema class describes
   itself (`describe(): PxSchemaDesc`) — no reaching into internals. The only casts left: one per object
   builder (a loop cannot prove it built a mapped type), commented.
2. **Engine runtime values (2a).** A property's VALUE KIND is decided ONCE — `valueKindOf(propName)`,
   the single home of today's four name checks — when the document's keyframes are converted. The result is
   a typed channel, a discriminated union by kind; interpolation, the frame loop, the WAAPI keyframes, the
   React Native tracks and the rest pose `switch` on the kind and are fully typed. Schema casts stay on the
   INPUT side (document values); the engine's own values are typed by construction — no per-frame casts.
   This is NOT a format-level attribute table (rejected for the document): the document keeps its unions.
3. **Glyph text.** The materializer is a LAYOUT engine: layout fields (font, size, spacing, positions,
   text) are read with exact types; paint is never inspected — only carried to the generated shapes — so it
   is a TYPE PARAMETER. Input is a `GlyphTextNode<P, A>` (the editor builds a real one instead of a fake
   `PxNode`); output elements come from the caller's factory typed `E`. The player's defaults: `P`/`A`
   `unknown`, `E` = `PxNode`.
4. **Gate for every step:** byte-identical oracles over the 314-document corpus (below), all five suites,
   `pnpm check:docs`, the kf typecheck and the relevant kf specs.

## Open — decide after 2a

- **2b. Runtime keyframes inside the document tree.** `materializeAllInTree` step 2
  (`materializeInternalLoopsInTree`) writes the engine's CONVERTED keyframes (`{t, v: [r,g,b,a], e}`) back
  into the `plain`-stage tree, in containers typed as wire keyframes — which is why readers use the "either
  spelling" accessors (`keyframeValue`, `PxAnyKeyframe`). Options: (a) the tree stays wire-only (loop
  expansion emits wire keyframes — cut-point values re-formatted, tiny float differences); (b) loops expand
  only in the engine (the tree step goes; check the motion-path sampling order); (c) keep, but type the
  `plain` tree as its own node type. 2a makes the conversion the single boundary that accepts both forms,
  so it does not depend on this choice.

## Plan (tick as implemented)

- [x] 0. Oracles FIRST (baselines before any change): core — `prepareDocument` `plain` output for both
       engines + frame values (`normalizeBindings` → `calcAnimationValues` at 9 times per binding); web —
       `convertToWebApiKeyframes` per binding; rn — `compileTracks` + `sampleProps` at 9 times.
- [x] 1. Schema framework: `PxAnySchema`; `infer` positions `boolean`; open shape `unknown`; builders typed
       (one commented cast each); `describe()` per class (`describeSchema` + the field-universe walker
       consume it); factory generics. Gate: schema specs, `schema-field-universe.player.json` unchanged,
       docs-check signatures, kf typecheck.
- [x] 2. Glyph text: `GlyphTextNode<P, A>`, typed layout reads, paint/animate parametric, `PxCreateElement<E>`
       without `any`; the player adapts a `PxNode` once; the editor (`GlyphMaterialiseSvgUtil`) builds a
       `GlyphTextNode`. Gate: oracles (28 glyph documents), kf glyph specs.
- [x] 3. Engine runtime values (2a): `PxValueKind` + `valueKindOf`; per-kind conversion (schema casts on the
       input, accepting the wire and the already-converted form); `PxRuntimeChannel`; loop expansion generic
       over the kind's value + interpolator; motion path on the parts channel; `normalizeBindings`,
       `calcAnimationValues`, `convertToWebApiKeyframes`, `compileTracks`, the rest pose on channels;
       `_PxNormalizedKeyframe.v` typed. Editor touch points: `PxNormalizedPropertyAnimation` (its model
       implements it), `MotionPathSampler`. Gate: oracles byte-identical, engine-parity + visual specs.
- [x] 4. Guards + batteries: lower the any budget; five suites, docs-check, kf typecheck + relevant specs;
       docs; review card; stage both repos.

## Accepted limits

| Limit | Why |
|---|---|
| Object builders state their result once (`asBuilt`) | a loop building an object key by key cannot prove it equals the mapped type `InferShape<S>` |
| The union factories state their members' type once (`asMembersOf`) | TypeScript cannot follow `UnionMembers<T>` (a mapped type) back to the tuple it came from |
| The plain tree still holds converted keyframes | 2b, decided separately |
| A legacy `[x, y]` skew (the pre-1.3 per-part channel) | a parts record's `skew` is ONE number (skewX): the malformed part is dropped, the rest of the record plays |
| A `transform` channel of strings (`"translate(…)"`) | `discrete` — the frames engine switches at half; WAAPI hands the strings to the browser, which interpolates them |
| A colour channel with a value `parseColor` cannot read (`red`, `url(#g)`, `none`) | `discrete` in the frames engine; WAAPI passes the value on (the browser blends named colours) |

## Progress log

- 2026-10-22 — plan written (owner: "yes, do it").
- 2026-10-22 — step 0: three oracles baselined and seen deterministic (core 628 · web 314 · rn 314 entries; 251 / 202 / 208 distinct outputs).
- 2026-10-22 — step 1. `PxAnySchema` (exported, described in the guide) replaces every `PxSchema<any, any>`;
  `infer` positions take `boolean`. Open objects: extra keys `unknown` — the `any` index had made even the
  DECLARED keys of an open object read as `any` (`T & any`). One `isRecord` predicate replaces the `raw as any`
  reads. Each class has `describe()`; `describeSchema` delegates (the `_kind` tags and the reach into
  `inner` / `_schemas` / `fn` are gone); the discriminated union reads its literal via `absentDefault()` +
  `describe()`. Casts left: `asBuilt` (object builders), `asMembersOf` (union factories). Core `any` 99 → 28;
  five suites green, oracle 628/628, field inventory unchanged, docs-check ✓, kf typecheck clean.
- 2026-10-22 — step 2. `GlyphTextNode<P, A>` (layout typed; paint `P` and animated paint `A` carried), a two-method
  `GlyphFactory<E, P, A>` (`path`, `group`) the caller always passes — no default, no `E = any`; the library-built
  tracks are exact (`GlyphMotion`: parts keyframes, `GlyphVisibility`: 0/1 keyframes) and separate from the carried
  paint; the library decides the placeholder's `className` once. The player adapts a wire node once
  (`glyphTextNodeOf`: typed layout reads, style folded under paint attributes, paint-only animations, the root's
  other attributes → `groupAttrs`) and builds wire nodes with `glyphNodeFactory` — same output, same key order.
  `elementFactory.ts` deleted. Editor: `GlyphMaterialiseSvgUtil` builds an `EditorGlyphNode` (no fake `PxNode`) and an
  `EditorGlyphFactory`. Core `any` 28 → 20. Oracles identical (core 628 · web 314 · rn 314; 28 glyph documents);
  five suites, docs-check, kf typecheck; kf text/glyph specs 26/27 files — the one failing file is a stale
  feature-explorer fixture (`timeline.duration`, pre-existing class).
- 2026-10-22 — step 3 (owner: "one decision, fix them"). `PxRuntimeChannel.ts`: `PxValueKind`, `channelKindOf`
  (the one decision: name + values), the typed channel union, `mapChannelKeyframes` (generic keyframe work with the
  kind's blend). `normalizeBindings` → `PxNormalizedBinding { id, channels }`; conversion `toRuntimeChannel`
  (values converted per kind, easings resolved, either keyframe spelling); the loop expansion is generic over the
  value; the native engine SAMPLES a moving parts channel (`sampleMotionPathKeyframes`, also behind the editor's
  `materializeMotionPathInPropAnim`), the frames engine flags it for per-frame evaluation; `calcAnimationValues`,
  `convertToWebApiKeyframes`, `compileTracks`, the rest pose switch on the kind. `_PxNormalizedKeyframe.v`:
  `unknown`; `interpolateValue` gone. Core `any` 20 → 13 (left: platform globals, the test kit).
  Divergences fixed (every changed corpus document listed):
  | Document | Before | After |
  |---|---|---|
  | website `color`, `color-2d`, `gradients` (animated gradient stops) | WAAPI wrote `stopColor: "1,0,0"`, marked it unsupported → the WHOLE document fell back to frames | `rgba(…)`, nothing unsupported — native WAAPI |
  | kf `loop.true.fill`, `loop.true.scale` | the loop's cut keyframe blended with the easing NAME (`"smooth"`) → `rgba(0,0,0,NaN)` / `scale(0,0)` at the window end | the name resolved (`definitions.easings`) → the right value |
  | kf `gradient.stop.offset.animated` | `offset: "20%"` → `"80%"` parsed as `NaN` | blends and keeps the unit: `20%`, `35%`, … |
  | kf `skew.x+y` (1.2.1, legacy `[x, y]` skew) | `translate(120,75)skewX(NaN)` | `translate(120,75)` (see accepted limits) |
  All other corpus output byte-identical (core 620/628, web 308/314, rn 310/314 — the rest are the rows above).
- 2026-10-22 — platform decisions (owner). `debugGlobalName` REMOVED from the format (schema 1.5, step `up` drops it,
  `down` is a no-op): a file wrote any `window` property of the page playing it. Console / page access is the
  registry's job — `PX_ANIMATOR_REGISTRY_GLOBAL` (`__pixodeskSvgAnimators`) is now exported; the editor's preview
  transport and render-diff page find the file's animator there. `doc` comparison: core `deepEquals` (typed; an object
  reused in two places no longer reads as a cycle — the old guard threw during render); React keeps deep compare, Vue
  (`docInput` + watch) and React Native (`docRef`) now match it. Budgets: web 4 → 3, react 8 → 0.
