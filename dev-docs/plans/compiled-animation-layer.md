# Compiled animation — a public low layer of the format (typed-internals 2b)

Owner decisions (2026-10-22):
- The expanded animation the pipeline produces STAYS IN THE DOCUMENT, as a layer of the public, versioned schema —
  not an internal node type and not a side channel. Every stage stays a valid `PxAnimatedSvgDocument`.
- Per property it is ALL authored or ALL compiled — never mixed.
- The editor READS the compiled form (converts it to the authored form on read) and never WRITES it.
- Times are CONTENT ms (independent of `inTime` / `playDuration`).

## Why

The `plain` stage today writes the engine's converted keyframes (`{t, v: [1,0,0], e}`, `{paths: […]}`) back into
containers typed as file keyframes. The type lies; every reader needs the "either spelling" accessors; a copied
prepared document (stamps lost) is "repaired" destructively by `castOrFix`; looped properties are converted twice.
Effects already lower into plain L0–L2 elements that are valid in the format — animation lowers the same way.

## The form

```json
"fill": { "keyframes": [{ "time": 0, "value": "#ff0000", "easing": "smooth" }, …], "loop": true }          // authored — what the editor writes
"fill": { "kind": "color", "keyframes": [{ "time": 0, "value": [1, 0, 0, 1], "easing": [0.42, 0, 0.58, 1] }, …] }  // compiled
```

- `PxPropertyAnimationSchema` becomes a discriminated union on `kind`: ABSENT = authored (today's object, unchanged);
  present = a compiled member.
- Same keyframe keys (`time`, `value`, `easing`, `tangentIn`, `tangentOut`) — the retired `t` / `v` / `e` stay retired.
- Fully explicit: no `loop`, no named easings, `time` required, `easing` a resolved `[x1, y1, x2, y2]`.

| `kind` | `value` | Extra |
|---|---|---|
| `number`, `percent`, `rotate`, `skew` | `number` | `unit?` (`number` only — `"20%"` → `20` + `unit: "%"`) |
| `color` | `[r, g, b, a]`, 0..1, always four | |
| `path` | `{ paths: Array<PxBezierPath> }` | |
| `transform` | `PxTransformParts` | keyframe `tangentIn?` / `tangentOut?` + member `autoOrient?` — the frames engine's motion path; the native engine's is sampled (none) |
| `numberList`, `translate`, `scale` | `Array<number>` | |
| `discrete` | `string` | switches, never blends |

The `kind` names are `PxValueKind`'s — public from here on. Reviewed against §25 (our own values camelCase): `parts` became `transform` (it is the `transform` attribute's record); `discrete` stays (CSS's own word for a value that switches).

## Design

| Piece | Change |
|---|---|
| Engine type | `PxRuntimeChannel` = `PxInfer` of the compiled schema (one source); `PxRuntimeKeyframe` keys renamed to `time` / `value` / `easing`. The document holds content ms; the bindings the engines play are shifted to window ms when built (`normalizeBindings`) |
| `plain` stage | `materializeAllInTree` steps 2 (loops) + 3 (motion paths) → ONE "compile animations" step: values converted by kind, easings resolved, loops expanded, motion path sampled (native) or kept with tangents (frames). The rest pose reads the compiled members |
| Bindings documents | `definitions.animations` may hold either form; the pre-rendered builds (no pipeline) compile authored members in `normalizeBindings` — the SAME function, a second caller; compiled members pass through |
| Removed | `PxAnyKeyframe`, `keyframeTime` / `Value` / `Easing` / `TangentIn` / `TangentOut`, `_PxNormalizedKeyframe` — after the editor's touch points (`PxAttrValueObj implements PxNormalizedPropertyAnimation`, `MotionPathSampler`) move to the compiled type |
| Stamps | Unchanged rules. `checked` schema-stamps what `castOrFix` created; the compile step's new nodes carry no schema stamp; the stage stamp says `plain`. A copy that lost its stamps is verified by `castOrFix` like any input — the compiled members are in the schema |
| Editor read | `convertEditorDocument` (both carriers) gains one pass, a player helper: compiled → authored — `toRGBA` for colours, `bezierToSvgPath` → `{ pathData }`, number + `unit` → string, the rest as is. Never written |
| Version | schema 1.6, a `converted` step with a no-op `up` and NO `down` (like 1.2 / 1.3): an older player would read a compiled entry as an authored one and play it wrong, so additive ("an older reader ignores it") would be false; release record via `scripts/schema-release.mjs` |
| Docs | the layer table gets a compiled-animation row under L2; a reference section for the form; `SCHEMA.json`; docs-check |

## Accepted limits

| Limit | Why |
|---|---|
| Loops are expanded to the duration at compile time | an `outTime` override after preparing needs a re-prepare (the stage stamp forces it); a copied prepared document keeps its expansion |
| A prepared document is per engine | as today: native samples motion paths, frames keeps tangents — both are valid compiled forms |
| The editor reads compiled animation as explicit keyframes | a loop or a named easing is not recovered; a native-compiled motion path reads as its samples |
| Colours read back at 0..255 precision | the authored form is a colour string |

## Plan (tick as implemented)

- [x] 0. Oracles FIRST: engine output for the 314-document corpus (core frames + native, web WAAPI, rn tracks), baselined
       and seen deterministic.
- [x] 1. Schema: compiled members (`kind` names reviewed), the union, `PxRuntimeChannel` inferred, keyframe keys renamed;
       schema 1.6 step + release record. Gate: schema specs, field inventory, docs-check signatures.
- [x] 2. Pipeline + engines: the compile step, rest pose, `normalizeBindings` (window shift, authored → compiled for
       bindings), WAAPI / frames / rn on the inferred type. Gate: oracles identical; a prepared document copied through
       `JSON.stringify` re-prepares with no problems and plays identically.
- [x] 3. Remove the either-spelling accessors; editor touch points on the compiled type. Gate: kf typecheck + specs.
- [x] 4. Editor read support (`convertEditorDocument`). Gate: a compiled document reads into the same model as its
       authored source (within the accepted limits); writing never emits `kind`.
- [x] 5. Guards (schema rejects a mixed member: `kind` with authored values, authored with `kind`), five suites,
       docs-check, kf typecheck + relevant specs, docs, review card; stage both repos.

## Progress log

- 2026-10-22 — plan written from the owner's decisions.
- 2026-10-22 — implemented (owner: "go ahead").
  - Schema: `PX_COMPILED_MEMBERS` (one per kind), `PxCompiledAnimationSchema`, `PxAnyPropertyAnimationSchema`
    (`px.discriminatedUnion` gained an `absent` member — the authored form, which declares no `kind`; the field
    inventory gives that member no `|label`, so the authored paths did not move), `anyPropertyAnimationSchemaOf`
    (the editor's widened record uses the same members), `PxRgba` (always four), `PxCubicBezier`, `PxCompiledKeyframe`.
    `PxRuntimeChannel` / `PxRuntimeKeyframe` / the either-spelling accessors / `_PxNormalizedKeyframe` are gone;
    keyframe keys are `time` / `value` / `easing` everywhere.
  - Pipeline: `compileAnimationsInTree` replaces the loop + motion-path passes; `compileAnimationDefinition` (static
    transform merged first, `offsetPath` transforms skipped, compiled entries pass through) is shared with
    `normalizeBindings`, which windows content ms → window ms. `movesAlongPath` is the derived rule (no cache — §17b).
  - Editor: `convertEditorDocument` ends with `authorCompiledAnimations`; `MotionPathSampler` uses the file keys;
    `PxAttrValueObj` no longer claims a player type.
  - Gates: core 628/628 identical (+ the version stamp 1.5 → 1.6); rn 314/314; web: every difference is the WAAPI
    map key (`transform` → `translate`, never read — the rest pose's static transform no longer lifts a lone
    channel at bind time) and `rgb(r,g,b)` → `rgba(r,g,b,1)` (colours are four numbers) — 16 documents. 628 prepared
    documents copied through JSON re-prepare with zero problems and identical frames; the permanent tests
    (`PxCompiledAnimation.test.ts`, kf `compiledAnimationRead.spec.ts`) were each seen to fail under a mutation.
  - Fixed on the way: a looped `transform` skipped the static-transform merge (the loop pass wrote runtime keys the
    merge could not read); a `loopIn` on a document with `inTime` > 0 filled from content 0, not the window start.
