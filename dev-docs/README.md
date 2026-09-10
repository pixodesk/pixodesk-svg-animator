# Developer docs — index

Everything written for people working **on** the library, rather than with it. User guides live in
[`docs/`](#user-facing-guides) and sync to the website.

Plans, reviews and audits are point-in-time records: each one states its date and status at the
top. When a plan and the code disagree, the code (and its tests) win.

## Start here

| doc | what it is |
|---|---|
| [README](../README.md) | project overview, packages, how to build and test |
| [versioning.md](versioning.md) | library vs schema versions — when and how to bump each, the release CLI, the guards |

## Format and schema

| doc | what it is |
|---|---|
| [SCHEMA-DESIGN.md](../SCHEMA-DESIGN.md) | **the design record of the wire format** — layers, generative rules, value taxonomy (player + editor) |
| [SCHEMA.md](../SCHEMA.md) | the whole wire format as compact typings with comments. [SCHEMA.json](../SCHEMA.json) is the JSON Schema generated from the runtime schemas (`node scripts/gen-schema-json.mjs`) |
| [API-SCHEMA.md](../API-SCHEMA.md) | every symbol the five packages export, by audience, with signatures |
| [SCHEMA-NAMING-REVIEW.md](../SCHEMA-NAMING-REVIEW.md) | naming and ergonomics review (2026-09-07) with its decisions and implementation status |

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
| [MINIFICATION-BOUNDARY-PLAN.md](../MINIFICATION-BOUNDARY-PLAN.md) | why wire keys must never be mangled, and how `mangle-reserved.json` enforces it — implemented 2026-09-09 |
| [BUNDLE-SIZE-PLAN.md](../BUNDLE-SIZE-PLAN.md) | shrinking the minified UMD build — measured by raw bytes on disk |
| [PRERENDERED-PLAYER-BUILDS.md](../PRERENDERED-PLAYER-BUILDS.md) | the research and size estimates behind the dedicated pre-rendered-SVG player builds |
| [PRERENDERED-PROGRESS.md](../PRERENDERED-PROGRESS.md) | implementation log for those builds |

## Plans

| doc | what it is |
|---|---|
| [PLAYBACK-OVERRIDE-PLAN.md](../PLAYBACK-OVERRIDE-PLAN.md) | per-instance playback override and two prop renames — implemented 2026-09-09, except steps 7–8 |
| [RN-CORE-PLAN.md](../RN-CORE-PLAN.md) | extracting the platform-neutral `svg-animator-core` and building `svg-animator-rn` on it |
| [RELEASE-PREP.md](../RELEASE-PREP.md) | the release-readiness working document |

## Reviews and audits

| doc | what it is |
|---|---|
| [API-SCHEMA-REVIEW.md](../API-SCHEMA-REVIEW.md) | `API-SCHEMA.md` read cold, as a new user (2026-09-08) |
| [docs-audit.md](../docs-audit.md) | audit of the README, `docs/` and package READMEs (2026-08-29) |
| [DOCS-UPDATE-2026-08.md](../DOCS-UPDATE-2026-08.md) | report on the documentation pass that followed the schema work |

## Examples

| doc | what it is |
|---|---|
| [docs-examples](../examples/docs-examples/README.md) | one standalone page per documentation case, plus a browser for them |
| [preview-player](../examples/preview-player/README.md) | one page playing a document with all three web-runtime packages side by side |
| [react-native-preview-player](../examples/react-native-preview-player/README.md) | Expo app that plays documents on device |
| [react-native-feature-explorer](../examples/react-native-feature-explorer/README.md) | Expo app scrolling the whole feature-fixture suite |

## User-facing guides

Published documentation, not dev docs — listed so there is one place to find everything.

| doc | what it is |
|---|---|
| [docs/library](../docs/library/README.md) | using the players: installation, web, React, Vue, React Native, playback and triggers, minification, troubleshooting |
| [docs/format](../docs/format/README.md) | the document format for authors and tool-builders |
