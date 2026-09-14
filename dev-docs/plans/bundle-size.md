# Shrinking `svg-animator-web/dist/index.umd.min.js`

**Metric: raw bytes on disk.** This is a published library — people judge it by the number next to
`index.umd.min.js`, and >100 KB does not look good. It is also **inlined verbatim into exported SVG
files**, where nothing compresses it. Brotli figures appear only as a footnote.

**Browser support is not negotiable** — the compile target stays where it is, so the ES2020 lever
below is deliberately *not* taken (§1a).

| | raw | vs original |
|---|---|---|
| original | 114,365 (114 KB) | — |
| entry split | 101,271 (101 KB) | −11.4% |
| **all four levers — SHIPPED** | **98,147 (98 KB)** | **−14.2%** |
| + schema layer removed (§4) | ~84,000 *(projected)* | ~−27% |

Every number below is measured. All 15 Playwright **visual** e2e tests pass against each variant —
that is the gate, because it compares rendered frames, not just API shape.

---

## 1 · The levers, isolated and cumulative

Measured one at a time, each on top of the previous, at the **current compile target**:

| # | lever | raw after | Δ | risk |
|---|---|---|---|---|
| 0 | original | 114,365 | — | |
| 1 | **player-only UMD entry** ✅ | 101,271 | **−13,094** | low |
| 2 | build UMD from core `src`, not core `dist` ✅ | 100,811 | −460 | low |
| 3 | terser `compress.passes: 3` ✅ | 100,322 | −489 | none |
| 4 | **property mangling of our internal names** ✅ | **98,147** | **−2,175** | moderate — see §3 |

All four are in `packages/svg-animator-web/tsup.config.ts`. `passes: 3` also applies to the minified
esm/cjs builds (`index.min.js` 113,562 -> 113,147). Lever 2 and lever 4 are scoped to the iife builds
only: esm/cjs keep resolving core from its published dist, and keep unmangled property names, because
the editor app imports from them.

**Verified:** UMD global exposes exactly its 10 names · web 92 · core 320 · react 23 · vue 23 · rn 42 ·
**15 visual e2e against the mangled minified artifact** · app tsc clean + both SVG+JS export specs.

## 1a · The 6 KB we are choosing not to take

Raising the compile target would save a further **6,171 B**, and it is worth recording exactly where
that comes from so the trade-off can be revisited if browser requirements ever change:

| target | raw | Δ vs es2017 | what it unlocks |
|---|---|---|---|
| es2017 (≈ today) | 98,130 | — | |
| es2018 | 97,423 | −707 | native object spread — drops esbuild's `__spreadValues` / `__objRest` helpers |
| es2019 | 97,423 | −707 | nothing further |
| **es2020** | **91,959** | **−6,171** | **optional chaining `?.` and nullish coalescing `??`** |

Almost all of it is the ES2020 step, and the cause is `?.` — downlevelling `a?.b?.c` expands into
nested ternaries with temporaries, and the source uses it heavily. The cost of taking it would be
requiring Chrome 80 / Safari 13.1 / Firefox 74 (all early 2020). **Not taken.**

### A related finding: the core→web build boundary

Building the UMD from core's `src` instead of its prebuilt `dist` is worth only **460 B** at the
current target — the boundary is essentially not a factor.

It *would* matter under a modern target: `svg-animator-core` publishes a dist compiled at
`"target": "es6"`, so downlevelling helpers are baked into that dist permanently, and no target
setting on the web side can undo transformation that already happened upstream. Merged + `es2020`
together were worth 6,646 B where each alone was worth ~500–1,250 B. Since the target is staying put,
lever 2 is kept only for its own modest 460 B.

---

## 2 · Where the remaining 98 KB actually is

Per-module attribution of the merged player build (esbuild `--metafile`, total 95,969 raw before
terser's final pass):

| module | bytes | % | |
|---|---|---|---|
| `PxDefinitions.ts` | 9,069 | 9.4% | |
| `effects/maskedByEffect.ts` | 7,696 | 8.0% | feature |
| **`PxSchema.ts`** | 7,520 | 7.8% | **removable — §4** |
| **`PxAnimatorTypes.ts`** | 7,085 | 7.4% | **mostly removable — §4** |
| `effects/textGlyphsEffect.ts` | 6,944 | 7.2% | feature |
| `PxAnimatorUtil.ts` | 6,109 | 6.4% | |
| `PxMotionPath.ts` | 5,946 | 6.2% | feature |
| `effects/trimPathEffect.ts` | 5,632 | 5.9% | feature |
| `effects/contentRefSplit.ts` | 4,519 | 4.7% | feature |
| `PxAnimatorWebApi.ts` | 3,563 | 3.7% | |
| …19 more | | | |

**The schema layer is 14,605 B = 15.2%** — the largest non-feature block, and playback never uses it.
Everything else of size is a feature someone asked for. With the target frozen, §4 is now by a wide
margin the biggest remaining lever: it is worth more than levers 2-4 combined, four times over.

---

## 3 · Property mangling — done properly

The earlier attempt at this was hand-waved. This one derives the name list from the TypeScript AST.

**`scripts/collect-identifiers.mjs`** walks all 40 source files of core + web and collects every
property/method name we declare (class members, interface members, object-literal keys, `x.foo`
accesses). It then reserves, paranoically:

| reserved because | count |
|---|---|
| **wire-format key** — appears inside a `px.object({…})` schema declaration | 103 |
| **collides with a string literal anywhere in our source** — covers `obj['x']`, JSON round-trips, attribute names, dispatch tables | 356 |
| **exported** from either package entry | 286 |
| **builtin / DOM** — terser's `domprops` list plus every JS intrinsic prototype | — |
| → **safe to mangle** | **83** (56 present in the bundle) |

**The builtin filter is the whole ballgame.** Without it the "safe" list cheerfully proposes renaming
`push` (×148), `isArray` (×100), `addEventListener`, `querySelectorAll` — because an AST pass that
records every `x.foo` sweeps up the entire standard library. A first run of this script produced a
list that would have broken the bundle outright and claimed a 5,055 B saving. The real figure is
**2,175 B**.

`scripts/mangle-savings.mjs` cross-references that list with the shipped bundle and emits
`scripts/.mangle-props.json` for the build to consume:

```
top contributors:  _canSanitize 170 B · _default 156 B · sanitize 144 B ·
                   translateKeyframes 144 B · isValid 135 B · contentRefInnerIds 80 B ·
                   sampleAtDistance 70 B · maskAncestorChains 64 B
```

Note how modest individual names are: `contentRefInnerIds` is 80 B across 5 occurrences. There is no
single fat identifier — the saving is the tail.

**Residual risk.** The reserved list is derived, not proven. A property reached by a string built at
runtime (`obj['content' + 'Ref']`) or coming from JSON that our own source never spells would slip
through. Mitigations in place: the string-collision net, and the visual e2e suite passing against the
mangled artifact.

⚠️ **Gap worth closing:** `npm run test:e2e` copies `dist/index.umd.js` — the **non-minified** UMD,
which is not property-mangled. So the default e2e run does not exercise lever 4 at all. The
verification above was done by hand, copying `index.umd.min.js` into the fixture. Either point the
e2e fixture at the minified build or add a second project that does, otherwise a future mangling
regression ships silently.

The allowlist is regenerated on every build (`build` runs `collect-identifiers.mjs` first) rather than
committed. That is the safe direction: if a name later appears as a string literal in our source, the
next build removes it from the list instead of renaming a property that is now string-reachable.

---

## 4 · The one big lever left: get the schema layer out of playback

Worth **~14 KB (15%)** — bigger than every shipped lever combined, and it is *not* about renaming.

Playback validates but does not need to. `validateNodeEffects` IS called on every
`createAnimatorImpl` (`svg-animator-web/src/animator/PxAnimator.ts:94`) — an earlier version of this document
claimed it had no caller, from a grep scoped to core only. It logs shape warnings and neither mutates
nor blocks, so it is a dev-only diagnostic, not a playback requirement.

The layer ships because `PxAnimatorTypes.ts` mixes
~874 lines of schema declarations with runtime constants the player needs (`INTERNAL_ATTRS`,
`TEXT_ATTR`, `PxAnimatorMode`, `PxLoopExtend`, `PxUnits`, `PxGradientType`,
`PxGradientSpreadMethod`, `PX_TRANSFORM_PART_KEYS`, `isPxDocument`, `getAnimatorConfig`) —
and those constants are **interleaved** with the schema block, not stacked above it.

Tree-shaking cannot rescue it: every declaration is `implementsInterface<_X>()(px.object({…}))`, a
**curried call** no minifier treats as side-effect-free. Verified — esbuild `--pure` hints for
`px.object`, `px.union`, `px.array`, `implementsInterface` and 12 more changed **literally zero
bytes**.

**The fix is a module split**, not a rewrite:

| new module | contents | imported by |
|---|---|---|
| `PxAnimatorConstants.ts` | the enums + `INTERNAL_ATTRS`, `TEXT_ATTR`, `PX_TRANSFORM_PART_KEYS` | player **and** schema |
| `PxAnimatorRuntime.ts` | `getAnimatorConfig`, `isPxDocument` | player |
| `PxAnimatorSchemas.ts` | all `*Schema` consts, `PxNodeBaseSchema`, `PxSvgNodeRootSchema`, `validateNodeEffects`, `isValidPxDocument` | validation entry only |

Types are erased at build time — leave them where they read best. Watch for cycles: constants must
not import schemas back. Measured on a surgically stripped probe: **−13,717 raw**.

---

## 5 · Measured and rejected

| idea | measured | verdict |
|---|---|---|
| **Tune terser harder** (`unsafe`, more mangling) | −247 B | Build already used `minify: 'terser'`; only `passes: 3` adds anything (−489 B). |
| **Raise the compile target** | −6,171 B at es2020 | **Declined — older-browser support is a product requirement.** Detail kept in §1a in case that ever changes. |
| **Rename long identifiers generally** | ceiling 4.2% *of brotli* | Raw looks tempting (27.9 KB of identifiers) but most are immovable: wire-format keys, builtins, and language keywords. `null` alone is 1,784 B and cannot be renamed. Only the AST-derived 83 names are actually safe — §3. |
| **Error codes instead of messages** | 573 B brotli / ~2,000 B raw | Prose is 1.9% of the bundle. Highest policy cost (immutable code registry, generated `ERRORS.md`, never-reuse rule) for a small return. Do it for the published catalog if you want that product — not for size. Most of it sits on validation paths that §4 removes for free. |
| **De-duplicating code** | negligible | Largest repeated 14-token sequences are ~200 B total each. |
| **`/* @__PURE__ */` hints** | 0 bytes | Defeated by the curried `implementsInterface<T>()(…)` wrapper. |

*Errors this analysis made, recorded so they are not repeated:*
1. A regex literal-scan reported strings as 87% of the bundle — a greedy pattern over the single-line
   minified file. Quote-aware scan: 8.4%. **Never size a lever from a regex over minified code.**
2. Terser was scored at "−5.4%" against esbuild-only probes **without reading `tsup.config.ts`**,
   which already enabled terser. **Check the build config before crediting a build-tool lever.**
3. The identifier census counted `null`, `for`, `this` as renameable "other", and the first AST pass
   counted `push`/`isArray` as ours. **A name being in your source does not make it yours.**
4. The merged-src build was dismissed at −460 B, measured without the modern target. With `es2020` it
   is −5,391 B. **Test interacting levers together before rejecting either.**

---

## 6 · Tooling

```bash
node scripts/analyze-bundle.mjs                 # identifier categories + real cost, string census
node scripts/collect-identifiers.mjs            # AST pass -> scripts/.identifiers.json
node scripts/mangle-savings.mjs                 # cross-reference -> scripts/.mangle-props.json
```

**Verification gate for any of this:** core 320 · web 92 · react 23 · vue 23 · rn 42 unit tests,
the **15 Playwright visual e2e tests** (the one that actually proves animation output is unchanged),
and the editor app's feature-explorer corpus (124 cases) for §4.

⚠️ Turbo's `test` task has no `dependsOn`, so package tests run against a stale dist. Rebuild first.

---

## 7 · See also

**`prerendered-player-builds.md`** — dedicated builds for SVG+JS export, where the payload carries no
node tree at all. Measured at **34,865 B** (WAAPI only) and **41,339 B** (both engines) versus 98,147
for the full player: a far bigger win than anything in this document, because effects, materializers,
the schema layer and the DOM renderer are all unreachable for a pre-rendered document.

---

## 8 · Open questions

1. **Ship levers 2–4?** Measured at −3,124 B combined with visual e2e passing. Lever 4 (property
   mangling) carries the only residual risk and supplies most of the saving; levers 2–3 are free but
   small.
2. **Do §4 (the schema split)?** At ~14 KB it now dwarfs everything else on the list.
3. **Does any `<script>` consumer use a name outside the 7 player exports?** That was the only cost
   of lever 1.
4. **Is the 238 KB unminified `index.js` still needed?** Source maps would replace it.
