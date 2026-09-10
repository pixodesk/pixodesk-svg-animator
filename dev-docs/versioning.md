# Versioning — library vs schema

Two unrelated numbers. Never derive one from the other.

| number | current | lives in | bumped by | when |
|---|---|---|---|---|
| **Library** (npm) | `1.0.34` | `version` in all five `packages/*/package.json` | you, by hand | every publish |
| **Player schema** `a.b` | `1.1` | `PX_PLAYER_SCHEMA_VERSION` — `packages/svg-animator-core/src/version/PxSchemaVersion.ts` | you, by hand, **with a step** | the player wire format changes |
| **Editor extension** `c` | `1` | `EDITOR_EXTENSION_REVISION` — app repo `src/svgeditor/model/serialization/schema/PxWireVersion.ts` | you, by hand, **with a step** | anything under `meta.*` changes shape |

Documents carry `animator.version: "a.b.c"` (today `"1.1.1"`), written by the editor on every save.
The player never writes it.

No script bumps a schema number. A bump must land together with the step that explains it, which
a script cannot write. The tooling **detects** a missing bump and refuses; you make it.

---

## 1 · What the wire version means

```
a . b . c
│   │   └─ editor extension (meta.*). The player ignores it. Restarts at 1 whenever b moves.
│   └───── player schema revision. A player at a.b reads any file at a.(≤ b).
└───────── generation. Nothing converts across a change of a — not the player, not the editor.
```

- **A diagnostic, not a gate.** A version gap on its own is silent. It is consulted only (1) to pick
  conversion steps and (2) when unknown content was actually met — then it says which way to close
  the gap ("written for 1.5, this player reads 1.1 — update the player").
- **Never refuse on open — degrade.** Unknown parts are dropped, the rest renders, the user is told.
- **Unstamped = unknown**, never "oldest". No migration is guessed.

### Where it happens

| | code |
|---|---|
| stamp written (both carriers) | app `TSvgSvgAnimationAttr.writeDesignPxAttr` (+ JSON finaliser in `SvgaJsonSerializationUtil`) |
| player conversion | lib `convertPlayerDocument(doc)` over `PLAYER_WIRE_STEPS` — never touches `meta.*` |
| editor conversion | app `convertEditorDocument(doc)` = player conversion, then `EDITOR_WIRE_STEPS` (`meta.*` only) |
| order on open | **migrate → strict schema validation → build model** (`readFileJson` / `deserialize`) |

Conversion works on a **copy**. A step that throws returns the original document, never a
half-migrated one.

---

## 2 · When to bump what

| change | bump | step `kind` | `up` | `down` |
|---|---|---|---|---|
| library code only (fix, feature, perf) — no wire change | **library only** | — | — | — |
| new **optional** player key | `b + 1` | `additive` | none | none |
| player key **renamed / removed / restructured** | `b + 1` | `converted` | **required** | only if exactly invertible |
| same keys, **different meaning** | `b + 1` | `converted` | as needed | as needed |
| change no conversion can bridge | `a + 1` | — | — | — |
| new optional `meta.*` key | `c + 1` | `additive` | none | none |
| `meta.*` renamed / removed / restructured | `c + 1` | `converted` | **required** | if invertible |

Rules:

- One `b` at a time — no skipping versions.
- A **removal is never additive**.
- Moving `b` restarts `c` at `1`. Moving `a` is a new generation.
- **No tolerant readers.** Never absorb a rename with `fx.newName ?? fx.oldName` in a reader.
  Conversions live in the step tables, and nowhere else.
- **Pre-release (now):** nothing is published, so schema changes may land at `1.1` / `1.1.1`
  without a bump. Migrate the repo's fixtures by hand and regenerate the snapshots (§4). The rules
  above apply from the first public release on.

---

## 3 · Procedures

### A · Player schema change (post-release) — `1.1 → 1.2`

1. Change the schema — `packages/svg-animator-core/src/format/PxAnimatorTypes.ts`.
2. Set `PX_PLAYER_SCHEMA_VERSION = '1.2'` — `src/version/PxSchemaVersion.ts`.
3. Add the step — `PLAYER_WIRE_STEPS` in `packages/svg-animator-core/src/version/PxWireVersion.ts`:
   ```ts
   {
       from: '1.1', to: '1.2',
       kind: WireStepKind.converted,              // additive for a new optional key
       reason: 'textPath.path renamed to textPath.pathData',
       up: (doc) => { /* mutate the copy; never touch meta.* */ },
       down: (doc) => { /* optional — only if exactly invertible */ },
   },
   ```
4. Build and test the core:
   ```sh
   pnpm --filter @pixodesk/svg-animator-core build
   pnpm --filter @pixodesk/svg-animator-core test
   ```
5. Check, then apply the release (writes the field snapshot, the dated changelog entry, `SCHEMA.json`):
   ```sh
   node scripts/schema-release.mjs            # dry run — exit 1 = REFUSED, read the message
   node scripts/schema-release.mjs --apply
   ```
6. In the **app** repo: regenerate the editor snapshot (§4), run the suite, and re-save any
   feature-explorer fixture whose round-trip guard reports *STALE*.
   **The first real step will fail `wireVersionGuard.spec.ts`** ("NO step may exist until the SVG
   carrier re-spells its raw tree"). That is deliberate: on an SVG open, migration currently runs
   only on the audit view. Wire it into `SvgaSerializationUtil.deserialize` (map the converted
   view's meta back onto the raw tree) before relaxing that assertion.
7. Bump the library (§3C), then commit both repos.

### B · Editor `meta.*` change — `1.1.1 → 1.1.2` (app repo)

1. Change the meta schema — `src/svgeditor/model/serialization/schema/PxSchemaUtil.ts`.
2. Set `EDITOR_EXTENSION_REVISION = 2` — `src/svgeditor/model/serialization/schema/PxWireVersion.ts`.
3. Add the step to `EDITOR_WIRE_STEPS` — full `a.b.c` versions, `meta.*` only:
   ```ts
   { from: '1.1.1', to: '1.1.2', kind: WireStepKind.converted, reason: '…', up: (doc) => { /* meta.* */ } },
   ```
4. Regenerate the editor snapshot (§4) and run the suite. The SVG-carrier tripwire in step A.6
   applies here too.

The library is not involved. A `c` bump never needs a player release.

### C · Library release (with or without a schema change)

1. Build and test the core (A.4).
2. `node scripts/schema-release.mjs` — expect `No player schema change since 1.1 — no schema bump.`,
   or follow procedure A first.
3. Set the same `version` in **all five** `packages/*/package.json`. They move together by
   convention; internal deps are `workspace:^`, which pnpm rewrites to `^x.y.z` on publish.
   `schema-release.mjs --lib-version x.y.z` sets **core's `package.json` only**, so use it only
   when releasing core alone.
4. Commit everything a build regenerated. That includes `packages/svg-animator-web/mangle-reserved.json`:
   it is the minifier's do-not-rename list for wire/API properties. Never revert it.

---

## 4 · Commands

| task | command | run in |
|---|---|---|
| build core (the CLIs read `dist`) | `pnpm --filter @pixodesk/svg-animator-core build` | lib root |
| test core | `pnpm --filter @pixodesk/svg-animator-core test` | lib root |
| release check / apply | `node scripts/schema-release.mjs [--apply] [--lib-version x.y.z]` | lib root |
| regenerate `SCHEMA.json` only | `node scripts/gen-schema-json.mjs` | lib root |
| regenerate **player** field snapshot | `PX_REGEN_FIELD_UNIVERSE=1 npx vitest run src/version/PxSchemaFieldUniverse.test.ts` | `packages/svg-animator-core` |
| regenerate **editor** field snapshot | `PX_REGEN_FIELD_UNIVERSE=1 npx vitest run --config vitest.browser.config.ts src/svgeditor/model/serialization/schema/PxSchemaFieldUniverse.gen.spec.ts` | app root |
| upgrade a document | `node scripts/upgrade-document.mjs <in.json> [--out <file> \| --in-place]` | lib root |
| down-convert a document | `node scripts/upgrade-document.mjs <in.json> --to 1.1` | lib root |

Regenerate a snapshot only **after** deciding the change is intended. For a vanished key, the
decision is a converted step, not a regeneration.

---

## 5 · When a guard fails

| failure | means | do |
|---|---|---|
| lib `PxWireVersion.test.ts` — *runs unbroken from the baseline…* | player version moved without a step | add the `PLAYER_WIRE_STEPS` entry |
| lib `PxSchemaFieldUniverse.test.ts` — *no key LEFT…* | a player key was renamed/removed | `converted` step + `b` bump, then regenerate |
| lib `PxSchemaFieldUniverse.test.ts` — *…lists every key…* | a player key was added | `additive` step + `b` bump (pre-release: just regenerate) |
| lib `PxSchemaRelease.test.ts` — *…last release record is…* | bumped without a changelog entry | `node scripts/schema-release.mjs --apply` |
| `schema-release.mjs` → `REFUSED`, exit 1 | diff without bump · missing step · removal marked additive · skipped version | do what the message says |
| app `PxSchemaFieldUniverse.spec.ts` | an editor-schema key moved | decide, then regenerate (§4) |
| app `wireVersionGuard.spec.ts` — *editor step chain…* | `c` moved without an `EDITOR_WIRE_STEPS` entry | add the step |
| app `wireVersionGuard.spec.ts` — *NO step may exist…* | the first step exists; SVG-carrier conversion not wired | see A.6 |

---

## 6 · API

**Library** (`@pixodesk/svg-animator-core`)

| | |
|---|---|
| `PX_PLAYER_SCHEMA_VERSION`, `PLAYER_WIRE_VERSION`, `BASELINE_PLAYER_VERSION`, `PLAYER_WIRE_STEPS` | the player's number, parsed form, first release, step table |
| `parseWireVersion`, `formatWireVersion`, `readWireVersion(doc)` | parse `"a.b[.c]"` (compare parsed, never strings); read the stamp from either carrier |
| `compareWireVersion(file, mine, readerReadsEditorPart)` | `unstamped` · `same` · `older` · `newer` · `otherGeneration` — the player passes `false` (blind to `c`) |
| `versionAdvice(relation, file, mine, isPlayer)` | the sentence to show — `undefined` when the version explains nothing |
| `convertPlayerDocument(doc)` / `downgradePlayerDocument(doc, target)` | up (never refuses) / down (all-or-nothing, may refuse) |
| `applyWireSteps` / `applyWireStepsDown` | the engine both tables run on |
| `schemaFieldUniverse`, `diffFieldUniverse`, `planSchemaRelease`, `releaseLogProblems` | the inventory and the bump rule — shared by the CLI and the tests |

**Editor** (app `PxWireVersion.ts`): `CURRENT_WIRE_VERSION`, `EDITOR_EXTENSION_REVISION`,
`EDITOR_WIRE_STEPS`, `convertEditorDocument(doc)`. It re-exports the library's half and never
re-implements it.

---

## 7 · Files

The core's source is grouped by concern — the map is `packages/svg-animator-core/src/README.md`.
Everything versioning-related is in `src/version/`.

| library | |
|---|---|
| `src/version/PxSchemaVersion.ts` | `PX_PLAYER_SCHEMA_VERSION` — alone in its file |
| `src/version/PxWireVersion.ts` | parse/compare/advice, `PLAYER_WIRE_STEPS`, conversion engine, down-conversion |
| `src/version/PxSchemaFieldUniverse.ts` · `src/version/schema-field-universe.player.json` | canonical field inventory · committed snapshot |
| `src/version/PxSchemaRelease.ts` · `src/version/schema-releases.player.json` | bump rule · dated release log (written by the CLI) |
| `scripts/schema-release.mjs` · `scripts/upgrade-document.mjs` · `scripts/gen-schema-json.mjs` | release CLI · upgrader · `SCHEMA.json` generator |

| app | |
|---|---|
| `src/svgeditor/model/serialization/schema/PxWireVersion.ts` | `c`, `EDITOR_WIRE_STEPS`, `convertEditorDocument` |
| `…/schema/schema-field-universe.snapshot.json` + `PxSchemaFieldUniverse.spec.ts` / `.gen.spec.ts` | editor inventory, guard, regenerator |
| `…/schema/wireVersionGuard.spec.ts` | editor bump guard, editor/player seam, SVG tripwire |
| `…/schema/read-audit-completeness.design.md` §6 | the full design and the decisions behind it |
