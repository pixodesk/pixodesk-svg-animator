# Developer docs — index

Everything written for people working **on** the library, rather than with it. User guides live in
[`docs/`](#user-facing-guides) and sync to the website.

Plans and reviews are point-in-time records: each states its date and status at the top, and code
comments cite them by section (`review §5`, `§26.2`), which is why they are kept once done rather
than folded away. When a record and the code disagree, the code (and its tests) win.

## Start here

| doc | what it is |
|---|---|
| [README](../README.md) | project overview, packages, how to build and test |
| [versioning.md](versioning.md) | library vs schema versions — when and how to bump each, the release CLI, the guards |
| [backlog.md](backlog.md) | deferred items, collected when finished plans and reports were retired |
| [tools/docs-check](../tools/docs-check/README.md) | how the public docs are checked against the code on every build — the markers, the audience tags |

## Format and schema

| doc | what it is |
|---|---|
| [schema-design.md](schema-design.md) | **the design record of the wire format** — layers, generative rules, value taxonomy (player + editor), the normalization history, open items |
| [reviews/schema-naming-review.md](reviews/schema-naming-review.md) | naming and ergonomics review of the schema (2026-09-07 → 2026-09-13); Part 1 records the decisions that stand |
| [SCHEMA.json](../SCHEMA.json) | the JSON Schema generated from the runtime schemas (`node scripts/gen-schema-json.mjs`); the readable form is [Schema at a glance](../docs/format/README.md#schema-at-a-glance) |

## Player API

| doc | what it is |
|---|---|
| [reviews/api-schema-review.md](reviews/api-schema-review.md) | the player API review (2026-09-08 → 2026-09-13), 25 items, all closed: one control-mode rule, one diagnostics channel, one meaning of time, `doc` / `timeline` / inline callbacks |
| [reviews/api-surface-review.md](reviews/api-surface-review.md) | the export surface (2026-09-13), all closed: audience tags on every export, who consumes what, the `/internal` entries, the renames (§26 and §6), the checks that keep "public" meaning "documented" |

## Code layout and architecture

| doc | what it is |
|---|---|
| [core `src/` layout](../packages/svg-animator-core/src/README.md) | what lives in each folder of `@pixodesk/svg-animator-core`, and the import rules |
| [web `src/` layout](../packages/svg-animator-web/src/README.md) | the same for `@pixodesk/svg-animator-web`: entries, engines, triggers, DOM |
| [web code architecture](../packages/svg-animator-web/code-docs.md) | how the player turns a document into a running animation |
| [effect test coverage](../packages/svg-animator-core/src/effects/EFFECT-TEST-COVERAGE.md) | which player effects have pure-JSON in/out tests |
| package READMEs | [core](../packages/svg-animator-core/README.md) · [web](../packages/svg-animator-web/README.md) · [react](../packages/svg-animator-react/README.md) · [vue](../packages/svg-animator-vue/README.md) · [react-native](../packages/svg-animator-rn/README.md) — what ships on npm |

## Builds, bundle size and minification

| doc | what it is |
|---|---|
| [plans/minification-boundary.md](plans/minification-boundary.md) | why wire keys must never be mangled, and how `mangle-reserved.json` enforces it — implemented 2026-09-09 |
| [plans/bundle-size.md](plans/bundle-size.md) | shrinking the minified UMD build — measured by raw bytes on disk; the analysis scripts under §6 |
| [plans/prerendered-player-builds.md](plans/prerendered-player-builds.md) | the research and size estimates behind the dedicated pre-rendered-SVG player builds, since built; what is left is in the backlog |

## Plans

| doc | what it is |
|---|---|
| [plans/trigger-model.md](plans/trigger-model.md) | **implemented 2026-09-18** — the `timeline.trigger` block rewritten: bare keys (`start`, `offScreen`, `mouseOut`, `finish`, plus `visibilityThreshold` and `visibilityDebounce`), `scrollIntoView` retired as a trigger, defaults that do not play off screen, schema 1.1 → 1.2 with a conversion step. One open defect in §11 |
| [plans/playback-override.md](plans/playback-override.md) | per-instance playback override and two prop renames — implemented 2026-09-09; steps 7–8 dropped by decision D6 |
| [plans/rn-core.md](plans/rn-core.md) | the split that produced today's layout: the platform-neutral `svg-animator-core`, and `svg-animator-rn` built on it |

## Examples

| doc | what it is |
|---|---|
| [docs-examples](../examples/docs-examples/README.md) | one standalone page per documentation case, plus a browser for them |
| [preview-player](../examples/preview-player/README.md) | one page playing a document with all three web-runtime packages side by side |
| [react-native-preview-player](../examples/react-native-preview-player/README.md) | Expo app that plays documents on device |
| [react-native-feature-explorer](../examples/react-native-feature-explorer/README.md) | Expo app scrolling the whole feature-fixture suite |

## User-facing guides

Published documentation, not dev docs — listed so there is one place to find everything. Every
`.md` under `docs/` is checked against the code by [docs-check](../tools/docs-check/README.md).

| doc | what it is |
|---|---|
| [docs/library](../docs/library/README.md) | the API at a glance — what every player shares — then installation, web, React, Vue, React Native, playback and triggers, minification, troubleshooting; each player's guide ends with its API reference |
| [docs/format](../docs/format/README.md) | the document format for authors and tool-builders: the schema at a glance, effects, editor meta, and the core library's reference |

`node scripts/gen-schema-html.mjs` renders a printable `.html` twin next to each review and the
schema design (gitignored) — handy for reading a long record in a browser.
