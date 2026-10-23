# svg-animator-core — source layout

Platform-neutral: no DOM anywhere in this package (the tsconfig has no `dom` lib, by contract).
Everything public is re-exported from `index.ts`; `internal.ts` is the `/internal` entry for the editor and
the sibling packages. The folders are internal organization only.

| folder | what lives here |
|---|---|
| `index.ts` | the public API — the entry point every consumer uses |
| `internal.ts` | `@pixodesk/svg-animator-core/internal` — `@internal` helpers for the editor and the sibling player packages; no compatibility promise |
| `schema/` | the `px` schema toolkit: `px.object`, unions, strict validation, `describeSchema`. Knows nothing about our format |
| `format/` | **the document format** — types + runtime schemas (`PxAnimatorTypes`), wire constants and schema-free helpers (`PxAnimatorConstants`), the entry diagnostic, and the tests that guard wire spelling |
| `version/` | **schema versioning** — `PX_WIRE_SCHEMA_VERSION` (alone in `PxSchemaVersion.ts`), the step table and conversion engine (`PxWireVersion`), the field inventory and its snapshot, the release rule and its log. See `dev-docs/versioning.md` |
| `animation/` | the per-frame value engine (`PxDefinitions`): binding normalization, keyframe interpolation, internal loops, and `compileAnimationsInTree` — every `animate` entry lowered to its compiled form (`{ kind, keyframes }`) |
| `playback/` | runtime timing: the frame loop, the one time contract (`PxPlaybackTime`), declarative playback, scroll-timeline progress math, per-instance config overrides, the diagnostics channel |
| `pipeline/` | `prepareDocument` — the staged lowering `current` → `checked` → `resolved` → `plain`, each result stamped so a later call trusts it |
| `render/` | `renderPxTree` — the one renderer from a `PxNode` tree to elements; the web, React and Vue players pass their own element factory |
| `materialize/` | tree rewrites before rendering: `<use>` instances, motion along a path, CSS offset-path, and the all-in-one pipeline |
| `effects/` | the player effects (`node.effects.*`). `PlayerEffectsUtil.ts` is the entry that runs them all, in order; the shared test harness and cross-effect tests sit beside it. Each effect family has a folder: `transform/` (transformBy, repeater) · `reference/` (clone href, retime, content-ref split) · `clipping/` (maskedBy, clipPath) · `paint/` (fill/stroke gradients) · `stroke/` (strokeTrim) · `text/` (glyph text, textPath, path sampler) · `shared/` (applier types, id/clone helpers, animatable transform parts) |
| `util/` | path / bezier helpers, id generation, subtree cloning, node props and the tag blocklist |

Conventions:

- Tests sit beside the code they test, as `*.test.ts`.
- `format/PxAnimatorConstants.ts` must never import a **value** from `PxAnimatorTypes` (type-only
  imports are fine). A value import drags the whole schema engine into the pre-rendered player
  builds — see `dev-docs/plans/prerendered-player-builds.md`. `version/PxSchemaVersion.ts` stays import-free for the
  same reason.
- No `any` (ESLint `no-explicit-any`; `anyBudget.test.ts` holds the budget at 0) and no module-level caches
  (`noGlobalCaches.test.ts`) — a cache belongs to the thing that owns the data.
