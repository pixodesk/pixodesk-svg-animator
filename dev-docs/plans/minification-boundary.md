# Minification safety & the wire boundary — implementation plan

**Status: IMPLEMENTED 2026-09-09** — see the checklist in §3A. Written 2026-09-08 from an
empirical audit of both repos (every claim below was verified by running the shipped bundles,
not by reading code alone), and the same standard was applied to the implementation: every
guard in this plan has been watched to FAIL on a deliberately introduced fault, not merely
observed to pass.

Split out of [playback-override.md](./playback-override.md), which now depends on this
landing first. Repos: **P** = `pixodesk-svg-animator` · **E** = `kf/app` (editor).

---

## 0. Why this exists

Property mangling renames object keys. It is safe only when the writer and the reader are in the
same build — which is never true at a library boundary. Today the reserve list that is supposed to
protect boundary names is computed by pattern-matching source, and it leaks. **Twelve public names
are renamed in the shipped bundles**, and nothing catches it because **no test in the repo ever runs
property-mangled code**.

The defining property of this bug class: it is *configuration-dependent and silent*. The same source
works unminified and fails minified, with no error.

---

## 1. The evidence

### 1.1 Twelve broken names (A/B-verified in jsdom, shipped `.umd.min.js` vs `.umd.js`)

| # | name | read at | what the shipped build does |
|---|---|---|---|
| 1-2 | `adapter`, `callbacks` | [PxAnimator.ts:138](../../packages/svg-animator-web/src/animator/PxAnimator.ts#L138) | `const{src:n,data:e,Bt:r,Ut:o,container:i}=t` — **no callback fires, adapter ignored** |
| 3-6 | `onPlay` `onPause` `onCancel` `onRemove` | [PxFrameLoop.ts:477](../../packages/svg-animator-core/src/playback/PxFrameLoop.ts#L477), [PxAnimatorWebApi.ts:334](../../packages/svg-animator-web/src/engines/PxAnimatorWebApi.ts#L334) | never invoked. `onFinish` survives only because `trigger.onFinish` is a schema key |
| 7 | `domType` | [PxAnimatorDOM.ts:80](../../packages/svg-animator-web/src/dom/PxAnimatorDOM.ts#L80), [PxRnRender.tsx:77](../../packages/svg-animator-rn/src/PxRnRender.tsx#L77) | ships as a literal `dom-type="fractalNoise"` attribute — the filter primitive is lost |
| 8 | `kfs` (`keyframes` alias) | [transformParts.ts:70](../../packages/svg-animator-core/src/effects/shared/transformParts.ts#L70) | `stroke-dasharray="0,NaN,NaN,NaN"` |
| 9 | `rangeName` | emitted [PxScrollDriver.ts:42](../../packages/svg-animator-web/src/scroll/PxScrollDriver.ts#L42) → browser at [PxAnimatorWebApi.ts:325](../../packages/svg-animator-web/src/engines/PxAnimatorWebApi.ts#L325) | `{"Rt":"entry"}`; the browser ignores the unknown member, so a native view timeline scrubs the wrong range |
| 10 | `class` | [textGlyphsEffect.ts:747](../../packages/svg-animator-core/src/effects/text/textGlyphsEffect.ts#L747) | missing-glyph marker becomes `ct="px-missing-glyph"` |
| 11-12 | `timelineSource`, `resetOnFinish` | [PxScrollMath.ts:18](../../packages/svg-animator-core/src/playback/PxScrollMath.ts#L18), [PxAnimatorBind.ts:38](../../packages/svg-animator-web/src/engines/PxAnimatorBind.ts#L38) | a legacy flat scroll document silently plays time-driven |

**Eight of the twelve also hit the pre-rendered builds the editor inlines into every SVG + JS
export** (`adapter`, `callbacks`, the four `on*`, `rangeName`, `timelineSource`, `resetOnFinish`).

### 1.2 The editor build is about to break — act on this first

Simulating `E/lib/ObfuscationUtil.js` `getPropsSetForObfuscation` against the current editor source
shows **`debugGlobalName`, `pathData` and `repeatAt` are protected by nothing** and will enter
`propsSet` on the next production build. They are absent from the committed
`E/obfuscation/props.txt` only because it is dated Sep 7 — *before* the 09-07/09-08 renames.

Root cause: `schemaKeys()` returns strings from `node_modules` (never mangled), but the editor reads
them as *identifiers* — `@serializable(PxAnimatorConfigSchemaExtraKeys.debugGlobalName, …)`
([TSvgSvgAnimationAttr.tsx:454](../../kf/app/src/svgeditor/animation/TSvgSvgAnimationAttr.tsx#L454)).
Mangling `.debugGlobalName` yields `keys._$3 === undefined` → `@serializable(undefined, …)`.
**A production editor build today writes documents with mangled wire keys.**

### 1.3 Why nothing caught it

- All five vitest configs are `include: ["src/**/*.test.ts"]` — **no test reads `dist/`**.
- `e2e:fixtures` copies the **unminified** UMD ([package.json:37](package.json#L37)); `e2e:fixtures:min`
  overwrites the same filename, so min and unmin can never run together.
- `test:e2e` is not a turbo task and is absent from `ci.yml` — so `test:e2e:min` is **dead code**.

---

## 2. Root causes

1. **The collector reserves exported *declaration names*, never the *members* of exported types**
   ([collect-identifiers.mjs:155](../../scripts/collect-identifiers.mjs#L155)). Explains 8 of 12. The
   library already worked around this by hand on the *output* side — every API method is written as
   a quoted key ([PxAnimatorWebApi.ts:366-419](../../packages/svg-animator-web/src/engines/PxAnimatorWebApi.ts#L366)) —
   but the *input* side (options, callbacks) never got the same treatment. `src`/`data`/`container`
   survive only by accident (domprops / an unrelated string literal).
2. **The "not ours" filter is terser 5.46.0's `domprops`**, which predates scroll-driven animations
   → `rangeName`. This recurs with every new web API.
3. **Per-site:** `domType` is a documented wire key declared in no schema; `kfs` is an undocumented
   alias the docs explicitly deny; `class` is the one emitted DOM attribute name with no string twin.

---

## 3. Two options, side by side

Both fix the twelve. They differ in **whose mangler they survive**.

### First, the mechanism as it exists today

Property mangling is ON for the three minified bundles
([tsup.config.ts:130](../../packages/svg-animator-web/tsup.config.ts#L130) full UMD, `:72` both
pre-rendered) and OFF for esm/cjs and the unminified UMD. Variables are always mangled; **properties
are mangled selectively** — only the 92 names in `safeToMangle`. All 113 wire keys are reserved,
which is why `doc.keyframes` reads fine today. The twelve are the names that fell outside every
reserve rule.

### Option C — derived reservation (names stay identical)

```ts
// core, unchanged: the public name IS the internal name
const cfg = doc.animator;              // 'animator' must never be renamed

// scripts/collect-reserved.mjs walks the RUNTIME schemas → ['animator','timeline','keyframes',…]
// tsup: mangle.properties = { regex /* fail-closed */, reserved /* second net, wins */ }
```

*Survives:* our own build, whatever we later change in it — because the list is derived from the
schemas and a test fails if any reserved name lands in `safeToMangle`.

*Does not survive:* **a consumer who compiles our source inside their project with their own
property mangling.** Their mangler renames `doc.animator` → `doc.a` while the JSON still says
`animator`. Nothing in our source can prevent that; the mitigations are documentation and a
published `mangle-reserved.json` they can feed to their config.

### Option B — parse boundary (public name ≠ internal name)

```ts
// 1. the schema carries BOTH names: the property name is the internal one (manglable),
//    the string literal is the public one (no mangler renames string VALUES)
const PxAnimatorConfigSchema = px.object({
    timeline: px.wire('timeline', PxTimelineSchema),
    frameRate: px.wire('frameRate', px.number().optional()),
});

// 2. the boundary reads public, writes internal — both by computed key, so both are mangle-proof
export function readDocument(json: unknown): PxReadResult<PxAnimatedSvgDocument> { … }
//    inner[innerKeyFromShape] = json[publicNameFromStringLiteral]

// 3. internals are UNCHANGED and freely manglable
const cfg = doc.animator;   // any mangler renames the shape key and this read consistently
```

*Survives:* **any mangler, ours or theirs** — that is the whole point.

*Costs:* a public name declared per schema field (~114); a deep copy at each door; production dumps
show mangled keys; and — the sting — **every public export that hands a document back must convert
out**, or a user who saves the result writes `{"a":{"b":1000}}`.

*Measured yield if we also wanted the size win:* only ~2.0 KB (1.79%) on the main UMD, because
terser's `domprops` already reserves 56 of the 113 wire keys regardless, and the 11 keys on open
node objects can never be renamed (they share a namespace with arbitrary SVG attributes). So B is
worth doing **for robustness, not for bytes**.

*One trap to design around:* double-converting a keyframe yields `{}` — and
`PxKeyframeSchema.isValid({})` returns `true`, because 133 of 151 fields are optional. The failure
mode is a silently empty object, not a crash. An idempotency brand does not save it: a brand cannot
survive `deepClone` ([PxIdUtil.ts:25](../../packages/svg-animator-core/src/util/PxIdUtil.ts#L25)), which the
player calls mid-pipeline. B therefore needs the conversion to be *typed* (a distinct TS type for
parsed documents) so our own code cannot double-convert.

### What B costs depends on one API decision

The "fifty internal twins" estimate assumed every low-level export keeps accepting raw public JSON.
If the tooling exports instead **require a parsed document**, B needs a parse at six doors only:

| entry | takes | note |
|---|---|---|
| `createAnimator`, `createAnimatorImpl`, `loadTagAnimators`, `createPrerenderedAnimator` (×2 entries), React / Vue / RN components | **public JSON** | the true doors — the only places that parse |
| `materializeAllInTree`, `materializeNodeEffects`, `generateNewIds`, `normalizeBindings`, `calcAnimationValues`, `interpolateValue`, `materializeInternalLoops*`, `materializeMotionPaths*`, `materializeAnimatedUseInstances`, `visualModelAt`, `diffInEffect`, `collectSampleTimes`, `createAdapterAnimator` | could require **parsed** | the editor is the main consumer and imports the *unmangled* esm build, so identity holds there |
| `getAnimatorConfig`, `getDefinitions`, `getBindings`, `getChildren`, `isPxDocument(Deep)`, `flattenAnimatorTimeline`, `nestAnimatorTimeline` | could require **parsed** | thin accessors |
| `validateDocument`, `validateNodeEffects` | **public JSON, always** | their job is judging unparsed input |
| `renderNode`, `toDomProps`, `normalizeDocument`, `createWebApiAnimator`, `createFrameLoopAnimator` (web); `compileTracks`, `sampleProps`, `renderRnNode`, `openClosedTextPathTargets` (RN) | could require **parsed** | node/document tooling |

### The contract (decided): public JSON at the doors, internal documents everywhere else

The low-level exports are consumed almost entirely by our own packages and the editor, not by end
users, so they take an **internal** document. `readDocument()` / `writeDocument()` are exported, so
anyone calling them directly converts first.

Only `validateDocument` and `validateNodeEffects` keep taking raw public JSON — judging unparsed
input is their job.

**The editor's exposure is small and non-urgent:** 19 non-spec call sites across ~10 files, mostly
`renderNode` (node-level) and `flattenAnimatorTimeline`/`nestAnimatorTimeline` (config-level); only
`materializeNodeEffects` (×2, preview player), `materializeAllInTree` (×1) and the serialization util
pass whole documents.

And because **the editor imports the esm build, which is never property-mangled**, inner ≡ outer
there and the converter is an identity mapping — so B can be adopted incrementally: the player gets
the conversion where mangling actually happens, and the editor's call sites are migrated
deliberately afterwards. The trap to avoid is stopping there: "it works because identity happens to
hold" is exactly the accident that produced the twelve bugs.

### B, costed honestly (with "tooling takes a parsed document" accepted)

| work | size |
|---|---|
| parse at the 6 doors | small |
| the converter module — built on `describeSchema`, which already walks every schema kind | ~200 lines, one new file |
| **a public name per schema field (~114)** | mechanical, but touches most of `PxAnimatorTypes.ts` — this is the bulk |
| `writeDocument()` for the return path, and deciding which exports return internal documents | small, but an API contract change |
| tests | moderate |

**The caveat that needs design attention:** node objects are `px.openObject`, so they carry TWO
namespaces — declared keys (which B renames internally) and arbitrary SVG attributes passed through
verbatim (data; can never be renamed). Code that reads a pass-through attribute *by name* still needs
that name reserved. Most such code iterates keys rather than naming them, but this must be checked
before committing to B.

### B requires the validator to learn both names — and to validate both namespaces

`isValid` today walks `Object.keys(this._shape)` and both READS and builds its ERROR PATH from those
keys ([PxSchema.ts:395-404](../../packages/svg-animator-core/src/schema/PxSchema.ts#L395)). Under C that is fine
(inner ≡ outer). Under B the shape keys are the internal names, so the walker must gain:

- a **public-name read mode**, to validate incoming JSON by its real key names; and
- **error paths always built from the public name**, whichever side is being validated — otherwise a
  warning reads `root.a.b: expected number` and is useless to the author.

`px.wire('timeline', …)` supplies both names, so this is contained inside `PxSchema`'s walkers — but
it is real work and easy to half-do.

### Is B reversible, and does it scatter?

**Reversible both ways.** C is a *build-config* guarantee; B is a *runtime mapping*. They are
orthogonal: with both in place the mapping is identity and B's converter degenerates into a
validating deep copy. B → C later = delete the parse calls and the public names; C → B = add them.

**Footprint, honestly:**

| | |
|---|---|
| conversion logic | **one module** — a genuine choke point |
| public names | ~114 declarations, all inside the schema files — broad but mechanical |
| the public/internal **type distinction** | propagates through signatures wherever a document type appears; compiler-enforced, so it cannot rot silently, but it is visible |
| `writeDocument` on the way out | a handful of sites |
| the standing invariant | never double-convert, never hand an internal document to a user. Double-conversion yields `{}` and still passes `isValid`, so this needs distinct TS types rather than discipline |

So B is not scattered logic that resists removal, but it does introduce a **permanent
two-representation discipline**. C introduces a build-config discipline instead. That is the trade.

### What each option actually guarantees

- **Validation is independent of the C/B choice.** Both can validate at the boundary. The confidence
  that a document matches the schema comes from validating, not from converting.
- **B's unique guarantee:** the key names the code reads are the names the converter wrote, whatever
  any mangler did — including a mangler in someone else's build.
- **Neither gives certainty about content.** 133 of 151 schema fields are optional, so `{}` passes
  `isValid`. Validation proves nothing contradicts the schema, not that the document is meaningful.

### Does B remove `scripts/.identifiers.json`?

In the limit, yes — if every boundary name (wire keys, option keys, callback keys, and the names we
hand to the platform such as `rangeName` and `class`) is accessed through a string-literal constant
with a computed key, nothing needs reserving and the mangler can run unrestricted. Stage it: keep
the allowlist as a fail-closed net while the boundary layer proves out, and shrink it after.

### What the player validates today (checked, 2026-09-08)

| | |
|---|---|
| `validateNodeEffects(doc)` at [PxAnimator.ts:57](../../packages/svg-animator-web/src/animator/PxAnimator.ts#L57) and RN [PixodeskSvgAnimator.tsx:316](../../packages/svg-animator-rn/src/PixodeskSvgAnimator.tsx#L316) | **the only validation in the load path** — `node.effects` buckets only, `console.warn` |
| `validateDocument` | exported, **called by nobody** |
| `isValidPxDocument` | does a whole-document `isValid`, but is marked `// FIXME - do we need it?` and is not in the load path |
| `.sanitize()` | called **only recursively inside `PxSchema` itself** — no product code in either repo calls it |

**`sanitize` is not validation.** `isValid(raw, ctx, path)` walks and *reports* into a context
(strict mode also flags unknown keys), returning a boolean. `sanitize(raw)` *repairs*: a new object
with every declared key present, bad values coerced to defaults, and **no error channel** —
`sanitize(5)` returns `{type:'svg'}`. A boundary parse therefore wants `isValid` for reporting plus a
*faithful* copy (§4 step 9), not `sanitize` as it stands.

### AUDIT RESULT (2026-09-09): B cannot deliver mangler-independence — recommendation reverted to C

A four-agent audit of the open-object question came back **high severity** unanimously, with
experiments run against the shipped bundles. The findings:

| finding | evidence |
|---|---|
| A node declares only **11 keys**; everything else is pass-through | `type, id, meta, effects, animate, style` (`PxNodeBaseSchema`), `children` (`PxNodeSchema`), root-only `width, height, viewBox, animator` (`PxSvgNodeRootSchema`) |
| **74 distinct pass-through attribute names** across 275 documents / 15,436 nodes, and the namespace is **open-ended** | `data-px-label` ×1,159, `xml:space` ×472, any SVG attribute is legal; `OpenObj.sanitize` is `{...src}` with no name allowlist |
| **B has no internal name for a pass-through key** — 18 of 46 are read by dot access in our code | B fixes none of them; they still need reservation |
| **Write side, 5/5:** `renderNode`/`renderRnNode` turn a node's own keys into DOM attributes by rest-spread | an internal name leaks (`<g rt="svg" ft="[object Object]">`), case-collides, or **throws DOMException** when the mangled name contains `$` — terser's charset includes it and the shipped bundle already has `.$` |
| `INTERNAL_ATTRS` is a Set of **public** literals | under B it stops suppressing `animate`/`effects`/`meta`, which stringify onto the DOM as `[object Object]` — reproduced in jsdom |
| The structural/attribute hybrid is **nearly worthless** | `width`/`height`/`viewBox` are declared on the root but pass-through on children (186/186/8 occurrences) — one identifier cannot be both |
| It all fails **silently** | ~2,000 simulated renames across 122 documents: zero exceptions, zero warnings, and `isValid` still returns `true` for 8 of 11 declared-key renames (nodes are open objects) |

Good news: `animate` / `animateById` are `px.record`, so attribute names there are **data** and survive
B untouched — only 3 dot-reads and 2 dot-writes of record keys are affected.

**Consequence.** The narrowest viable B parses only the animator / effects / definitions subtrees and
keeps node objects public — which means the node tree still depends on reservation, so a consumer
mangling our source still breaks. **The "works in every environment" guarantee is unattainable**,
because the attribute namespace is shared with the DOM and open by construction. Partial
mangler-independence is worse than none: it invites confidence the design cannot back.

This is also what React's own build says: it does **no property mangling at all** (`memoizedState`
×238, `stateNode` ×164 readable in react-dom 19.2.3 production), it emits attributes with
`setAttribute(key, …)` from the object's own keys — 9 such sites — and where a name must be
translated it uses a string-literal table (`"className"→"class"`, `"htmlFor"→"for"`, `"xlinkHref"`).
That is option C.

**→ DECIDED: C, plus schema validation as a DIAGNOSTIC.**

Validation earns its place not as a correctness mechanism but as the way a third-party consumer with an
exotic minifier configuration *finds out*. If their build renames keys, the document reaching us has
unrecognizable keys — and strict validation says so out loud instead of rendering a blank canvas.

What can and cannot be detected: keyframes and most sub-objects are strict `px.object`, so an unexpected
or missing key IS detectable there; nodes are `px.openObject`, so an unknown attribute name on a node is
indistinguishable from a legitimate SVG attribute. The diagnostic therefore keys off the strict parts of
the document, and its wording must name property mangling as the likely cause and point at the reserved
names list — a bare "unexpected extra key" leaves the user no wiser.

Scope: run it at the entry points, alongside the `validateNodeEffects` call that already happens there.

### SUPERSEDED — earlier decision: B first; C later, or not at all

Implement **B**, confirm it solves the problem on its own, and only then consider adding C — possibly
as a **build-configuration switch** (B, C, or both), since with both the mapping is simply identity.
The two are orthogonal, so nothing here forecloses that.

Steps 1–7 below are worth doing either way: they fix the twelve broken names and make the reserve
list sound. Under B they also shrink over time, as boundary names stop needing reservation.

**Validation must cover BOTH namespaces** (decided): the schema walker gains a public-name read mode
so it can validate incoming public JSON *and* internal documents, with error paths always spelled in
public names.

### Existing bracket access is already disciplined (audited 2026-09-09)

All computed member access across the five packages was classified. **Nothing needs fixing.**

- **Literal-string access `obj['name']` — ~30 sites, all correct** (`node['id']` ×4,
  `normProps['className']` ×3, `propsCopy['transform']` ×2, `newAnimate['offsetDistance']`,
  `fileJson['type']`, …), and each reserves its name as a side effect. Several apparent hits are
  TypeScript indexed-access *types* (`PxNode['animate']`, `PxKeyframe['e']`) with no runtime effect.
- **Constant-variable access — 11 sites, 3 constants, all reserved:** `TEXT_ATTR` (`'text'`),
  `PX_TEXT_CONTENT_ATTR` (`'textContent'`), `PX_ANIM_ATTR_NAME` (`'_px_animator'`). This is the bucket
  that could hide a live bug (mangler renames the property, not the string) — it is clean.
- The remaining ~1,200 computed accesses in core are array indices and genuine dictionary lookups
  (`fonts[name]`, `glyphs[char]`, `easings[name]`, `animateById[id]`, `window[debugGlobalName]`) —
  unavoidable and correct.

**Conclusion:** all twelve bugs came from *dot* access on names the collector failed to reserve, not
from bracket access. The fix belongs in the reserve list (steps 2-7), not in the call sites.

---

## 3A. IMPLEMENTATION CHECKLIST

`[x]` = implemented AND verified; `[-]` = deliberately not done, with the decision that says why.

**The twelve broken names (§1)**
- [x] All twelve fixed and held by `test:bundle` — 42 tests loading the six SHIPPED bundles in jsdom, asserting minified ≡ unminified
- [x] `safeToMangle` fell 92 → 52; the build THROWS if a reserved name is ever also marked safe

**The reserve list (steps 2-7)**
- [x] Rule: members of exported interfaces / type aliases (fixed 8 of 12 alone)
- [x] Platform names too new for terser's `domprops` (`rangeName`, the scroll-timeline family)
- [x] `domType` declared in `PxNodeBaseSchema` — structurally a wire key now, reserved automatically
- [x] `class` emitted through `CLASS_ATTR`
- [x] DERIVED from the built core's runtime schemas, not guessed — and shared with `analyze-bundle.mjs` so the two scripts cannot disagree
- [x] `mangle-reserved.json` published, in `package.json#files`, AND reachable via an `exports` subpath (without which the documented import threw)

**Guards**
- [x] Editor guard subtracts the player's reserved names and THROWS if the list is missing — it had been about to mangle `debugGlobalName`, `pathData`, `repeatAt`
- [x] `sanitize` phantom-key guard — 16,367 phantom keys → 0, content diffs 0/254
- [x] **Entry diagnostic at the doors (§3, "run it at the entry points")** — `reportDocumentDiagnostics` in `createAnimatorImpl` (the single choke point for `createAnimator`, `loadTagAnimators`, React and Vue) and in the RN component, beside the `validateNodeEffects` call that was already there. Names property mangling as the likely cause and points at the reserved list; a bare "unexpected extra key" leaves the reader no wiser. Measured: **0.06 ms** per document and **0 false positives** across the editor's 127-document corpus; the legacy flat spelling is classified separately and stays SILENT, because it still plays correctly
- [-] Entry diagnostic in the two PRE-RENDERED bundles — **not added on purpose.** They deliberately skip `validateNodeEffects` too (the payload has no `children`, so it is a provable no-op), they are size-critical, and their payload is written by the editor rather than authored by a consumer whose build might mangle it. Confirmed by measurement: adding the diagnostic cost those bundles **0 bytes** because it is not reachable from their entry, and the main UMD grew 1,006 bytes

**Cleanups (§6)**
- [x] `kfs` deleted — and its short siblings `t`/`v`/`e`/`ti`/`to`; all now REJECTED by the schema
- [x] …and the TYPE that let them linger: `PxKeyframe` is wire-only and `KeysMatch`-locked, with
      `PxNormalizedKeyframe` as the runtime counterpart (2026-09-09). Until then one interface
      carried both spellings, so no key-set lock was possible and nothing in the types said which
      form a function expected
- [x] Name access: `TRANSFORM_PART`, `TRANSFORM_ATTR`, `OFFSET_DISTANCE_ATTR`, `REACT_PROP`/`VUE_PROP`
- [x] Every one of OUR flat-spelling fixtures migrated (197 sites) + a guard test
- [x] Docs — `docs/library/minification.md`, linked from the index and troubleshooting
- [-] Flat-document ACCEPTANCE removal — **decision D11**, see §6.1

**Option B**
- [-] Not implemented, and will not be — the audit proved it cannot deliver mangler-independence (§3, AUDIT RESULT). C + the diagnostic is the shipped answer

---

## 3B. IMPLEMENTATION STATUS — steps 0-6 DONE (2026-09-09)

| step | state | what landed |
|---|---|---|
| 0 | ✅ | clean rebuild of core + web; all twelve reconfirmed against it (not a stale local `dist`) |
| 1 | ✅ | **`packages/svg-animator-web/bundle-tests/`** + `vitest.bundle.config.ts` + `npm run test:bundle`. Loads all six shipped bundles into fresh jsdom instances; asserts boundary names survive AND that behavior is identical minified vs unminified. First run: **32 failing / 8 passing**, reproducing every bug (minified fired `''` callbacks vs `'onPlay,onPause,onCancel'`; adapter ignored; `domType` → `type=null` plus a bogus `dom-type` attribute) |
| 2 | ✅ | `collect-identifiers.mjs`: fourth reserve rule — the **members** of exported interfaces / type aliases (191 names), not just the declaration name. Fixed 8 of 12 alone |
| 3 | ✅ | platform names too new for terser's `domprops` (`rangeName` + the scroll-timeline family) added to `BUILTIN` |
| 4 | ✅ | **`domType` declared in `PxNodeBaseSchema`** and in `_PxNode`. Structural fix: it is now a wire key, reserved automatically, and present in the generated `SCHEMA.json` |
| 5 | ✅ | `kfs` deletion — deferred here to the §6 follow-ups at the time, and **done there** (see §6.2 below). Verified 2026-09-09: no `.kfs` read remains in any package (the surviving `kfs` identifiers are local variables holding `.keyframes`), `validateDocument` REJECTS the key, and it is correctly absent from `mangle-reserved.json` — removed, not reserved. The short siblings `t`/`v`/`e`/`ti`/`to` are rejected too |
| 6 | ✅ | `class` emitted through a new `CLASS_ATTR` constant, following the pattern every other emitted attribute name already used |

**Result:** `test:bundle` **40/40**. `safeToMangle` fell from **92 → 52** names.

### Steps 7-10 — also DONE (2026-09-09)

| step | state | what landed |
|---|---|---|
| 7 | ✅ | **The reserve list is now DERIVED, not guessed.** `collect-identifiers.mjs` walks the RUNTIME schemas from the built core (`describeSchema`, following shape/array/optional/lazy/union/discriminatedUnion/record/tuple) — 115 keys, matching what the AST scan found, with a divergence warning if the two ever disagree. Reserved = schema keys ∪ public type members ∪ platform names ∪ emitted DOM names = **199 names**. The build now **throws** if any reserved name is also marked safe to mangle. Terser gets `regex` (fail-closed, primary) **and** `reserved` (independent second net that wins on disagreement) — measured cost of the `reserved` net: **0 bytes**, since the regex already excluded those names |
| 7b | ✅ | **`packages/svg-animator-web/mangle-reserved.json`** — the published contract, in `package.json#files`, with a comment telling a consumer to feed it to terser's `mangle.properties.reserved` or esbuild's `reserveProps`. The bundle suite asserts the two sets never intersect and that the list covers the whole wire format |
| 8 | ✅ | **Editor guard.** `lib/ObfuscationUtil.js` now subtracts the player's reserved names from its own mangle set, logging what it protected, and **throws** if the list cannot be found (a guard that silently does nothing is the failure mode being fixed). Verified against real editor source: `debugGlobalName`, `pathData`, `repeatAt`, `fillMode`, `finishAction`, `animateById` all now **protected** — the first three were about to be mangled on the next production build |
| 9 | ✅ | **`sanitize` phantom-key guard** in `Obj.sanitize` / `OpenObj.sanitize`. Verified empirically on the editor's 127-document corpus: **phantom keys 0** (was 16,367) and **content diffs 0 of 254 materializations** when comparing canonically. (The raw-`JSON.stringify` comparison reports 28 "diffs" that are key ORDER only — `{scale,translate,origin}` vs `{translate,scale,origin}` — which `composeTransformParts` is insensitive to.) 14 tests in `PxSchema.test.ts` asserted the phantom shape and were updated; several were literally named "drops…"/"strips…" while asserting the key was present |
| 10 | ✅ | `SCHEMA.json` + `SCHEMA.html` regenerated — `domType` now appears in the generated schema, where it had been missing despite being documented |

**Editor fallout from declaring `domType`, and its fix:** the editor's schema-coverage spec correctly
reported the new field as untouched. A `<filter>` + `<feTurbulence domType="fractalNoise">` was added
to the coverage lab's `defs` — the only element shape that actually produces the key, since
`TDomElement` relocates a real `type` attribute only for filter primitives — and the root-level slot
(inherited from `PxNodeBaseSchema`, meaningless on an `<svg>`) is touched on a timeline companion rather
than faked in the master document. Editor: **165/165** including the fixture round-trip guard, `tsc` clean.

### Steps 10b + 11 and the §6 follow-ups — DONE (2026-09-09)

| item | state | what landed |
|---|---|---|
| §6.2 `kfs` | ✅ **deleted** | the alias is gone from `transformParts` and `maskedByEffect`, from the test-local schema mirror, and from 5 test inputs that fed it deliberately (those now use `keyframes`, and their names no longer claim to test an alias) |
| §6.1 legacy flat documents | ✅ fixtures / ⏸ acceptance | **2026-09-09: every one of OUR fixtures is migrated** — 197 sites (122 RN feature-explorer cases, 69 package-test literals, 6 preview samples), flatten-equivalence proven and guarded by `PxWireSpellingGuard.test.ts`. See PLAYBACK-OVERRIDE-PLAN §6.4. **Acceptance is still deliberately NOT removed** — see the note below; that is decision D11, not outstanding work |
| 10b name access | ✅ | `TRANSFORM_PART` (a named record; `PX_TRANSFORM_PART_KEYS` now derives from it, so the literals exist once), `TRANSFORM_ATTR`, `OFFSET_DISTANCE_ATTR`; `PxNodeProps`, `PxDefinitions` and `PxOffsetPathMaterializer` use them instead of bare strings; `fileJson['type']` → `fileJson.type` (a schema key, read like every other schema key); React/Vue `node['id']` → `node.id`, and their framework-only prop names (`key`/`ref`/`className`/`style`) go through a `REACT_PROP` / `VUE_PROP` record |
| 11 docs | ✅ | **[docs/library/minification.md](../../docs/library/minification.md)** — safe by default, the reserved list and how to feed it to terser / esbuild / Closure, what the failure looks like, and `validateDocument` as the diagnostic. Linked from the library index and from troubleshooting (where someone with a blank canvas looks first). `validateDocument` was ALSO not exported from the web package despite `API-docs/format/README.md` claiming it — now it is, and the diagnostic was checked against a mangled document |

**Why flat-document acceptance was not removed.** The premise changed: the reason for dropping it was
to avoid special-casing `timelineSource`/`resetOnFinish` in the reserve list, and step 2 reserves them
anyway under a general rule (they are members of an exported type). Meanwhile the measured blast
radius is not what the plan assumed — **one** flat JSON document repo-wide (now migrated) and **zero**
in the editor, but **83 inline flat literals** across ~20 test files, several of which
(`PxTimelineCompat.test.ts`) exist precisely to test the flat↔nested boundary. Removing acceptance is
a breaking change for files in the wild with no remaining benefit, so it is left for an explicit
decision rather than taken autonomously.

### Stale specs found by the full sweep — earlier renames left EIGHT files red

Running the whole editor tree (`src/svgeditor` + `src/kf/common/development`, 212 files) rather than
targeted subsets surfaced failures from the *earlier* renames in this session, which had been
reported green on the strength of partial runs:

| from | files |
|---|---|
| `clone.type` → `clone.without` (09-08) | `PxEnumSlots.test.ts`, `refEffect.test.ts` (inline snapshots corrupted by an accidental `-u` run), `materialize-use-id-uniqueness.spec.ts`, `CompositeElementEffectVariants.spec.ts` (17 tests), `effect.retime.nested.svgCss.spec.ts` (comments) |
| `timeline.engine` merge (09-08) | `animator-config.spec.ts` (still spelled the removed `timeline.engine`), `TSvgTransformAttr.spec.ts` and `appliedEffects-css-bugs.spec.ts` (carried the now-omitted default `mode:'auto'`) |
| `definitions.glyphs` → `fonts` (09-07) | `glyph-alongpath-lottie-roundtrip.spec.ts` (asserted `/definitions:\{glyphs/`) |

All fixed; each diff was verified to be exactly the rename. **Lesson recorded: after a wire rename,
run the full suite, not the files you predicted would break.**

**Verified after all of it:** core 398 · web 115 · React 23 · Vue 23 · RN 42 · bundle parity 42 ·
five typechecks clean · **editor 1620 passed / 212 files** · editor `tsc` clean.

**Cost measured:** main UMD `113,858 → 115,484` raw (**+1,626 B, +1.4%**), 32,556 brotli. Higher than
the +928 B the design estimated, because the rule reserves the members of *every* exported type
rather than only those reachable from the UMD entry's export graph. Narrowing it would recover
roughly 700 B at the price of resolving that graph — deliberately not done: fail-closed is the right
default here.

**Collateral fixes — two suites left red by the 2026-09-08 `clone.type` → `clone.without` rename,
neither of which had been re-run:**
- `PxEnumSlots.test.ts:28` still exercised the removed `clone.type` slot → updated to `without` / `translate`.
- `refEffect.test.ts` carried **inline** snapshots corrupted by an accidental `-u` run during the
  broken window: they showed the content-ref split happening but the `<use>` pointing at the OUTER
  layer, contradicting the test's own name ("points at inner"). Re-recorded; the diff is exactly the
  two `href` lines.

**Verified:** core 398/398 · web 115/115 · RN 42/42 · React 23/23 · Vue 23/23 · four typechecks clean
· `test:bundle` 40/40.

---

## 4. Step-by-step

Each step is independently verifiable. Steps 1–2 alone fix 9 of the 12.

### Step 0 — reconfirm against a clean build

`dist/` is gitignored, so the audit ran against a local build. Rebuild from committed source and
re-run the twelve-name check before touching anything.

```
pnpm --filter @pixodesk/svg-animator-core build && pnpm --filter @pixodesk/svg-animator-web build
node -e "const s=new Set(require('./scripts/.identifiers.json').safeToMangle);console.log(['adapter','callbacks','onPlay','onPause','onCancel','onRemove','domType','kfs','rangeName','class','timelineSource','resetOnFinish'].filter(n=>s.has(n)))"
```
Expected today: all twelve. Expected at the end: `[]`.

### Step 1 — the A/B bundle test (do this first; it must FAIL on all twelve)

New package `bundle-tests/` (vitest, `environment: "node"`, jsdom **as a library** so each bundle
gets a fresh DOM). It loads all six built bundles — full UMD min/unmin, both pre-rendered pairs —
and asserts identical observable behavior.

Build-order constraint: `turbo.json` runs `test` **before** `build`, so this cannot be a `test` task
in a package that produces `dist`. Make it a separate package whose `test` `dependsOn: ["^build"]`,
and add it to `ci.yml`.

Scenarios, one per known bug plus baseline:

| test | asserts |
|---|---|
| `callbacks fire in every bundle` | `onPlay`/`onPause`/`onCancel`/`onRemove` each invoked |
| `adapter receives setAttribute calls` | call count > 0 |
| `domType reaches the DOM` | `type="fractalNoise"`, and **no** `dom-type` attribute |
| `keyframes alias` | (after step 5) `kfs` is rejected, `keyframes` works |
| `native view timeline keeps its range` | `rangeStart.rangeName === 'entry'` |
| `missing glyph keeps its class` | `class="px-missing-glyph"` |
| `legacy flat scroll document is scroll-driven` | the scroll warning fires / playhead follows scroll |
| `wire-format document plays end to end` | baseline parity min vs unmin |

Plus static guards (cheap, run in `core`/`web`): every schema-declared key and every boundary key is
absent from `safeToMangle`; every one of them appears literally in each minified bundle.

### Step 2 — collector edit A: reserve the members of public types (fixes 8)

[scripts/collect-identifiers.mjs:155](../../scripts/collect-identifiers.mjs#L155) — add a fourth reserve
rule: the keys of every type the UMD entry publishes (`src/index.player.ts`), resolved through
heritage clauses and type references. A `<script>` consumer builds those objects in *its own* code,
so their keys can never be renamed.

Fixes `adapter`, `callbacks`, `onPlay`, `onPause`, `onCancel`, `onRemove`, `timelineSource`,
`resetOnFinish`.

### Step 3 — collector edit B: platform names newer than `domprops` (fixes `rangeName`)

[collect-identifiers.mjs:145](../../scripts/collect-identifiers.mjs#L145) — extend `BUILTIN` with the web
API dictionary keys terser does not yet know (`rangeName`, and the scroll-timeline family). These are
names we hand to the browser; they are not ours to rename.

### Step 4 — declare `domType` in the schema (fixes `domType`, and a SCHEMA.json gap)

[PxAnimatorTypes.ts:1594](../../packages/svg-animator-core/src/format/PxAnimatorTypes.ts#L1594) — add `domType` to
`PxNodeBaseSchema`. `px.openObject` keys count as wire keys, so this reserves it *structurally* and makes it
appear in the generated `SCHEMA.json`, where it is currently missing despite being documented at
[docs/format/README.md:232](../../docs/format/README.md#schema-at-a-glance).

**Rule this establishes: a wire key that is not declared in a schema does not exist.**

### Step 5 — delete the `kfs` alias (see also §6)

[transformParts.ts:67,70](../../packages/svg-animator-core/src/effects/shared/transformParts.ts#L67) and
[maskedByEffect.ts:518](../../packages/svg-animator-core/src/effects/clipping/maskedByEffect.ts#L518). No writer
emits it, no fixture uses it (in either repo), the schema already rejects it, and
[docs/format/README.md:393](../../docs/format/README.md#L393) explicitly denies aliases exist. Removing it
is more honest than reserving it.

### Step 6 — `class` via a named constant

Add `CLASS_ATTR` beside `TEXT_ATTR`/`PX_TEXT_CONTENT_ATTR`
([PxAnimatorConstants.ts:193](../../packages/svg-animator-core/src/format/PxAnimatorConstants.ts#L193)) and emit it
as a computed key in [textGlyphsEffect.ts:747](../../packages/svg-animator-core/src/effects/text/textGlyphsEffect.ts#L747).
This follows the pattern every other emitted attribute name already uses.

### Step 7 — derive the reserve list from the runtime schemas

New `scripts/collect-reserved.mjs` (run under `tsx`) → `scripts/.reserved.json`:

- **schema keys** — a `describeSchema` walk over the runtime schemas (114 keys today), following
  shape / array / optional / lazy / union / discriminatedUnion / record / tuple. This replaces
  `SCHEMA_FACTORIES` / `isSchemaShape` / `wireKeys` in the collector, which only recognize inline
  object literals passed directly to a `px.object` call.
- **boundary keys** — a hand-declared module, made exhaustive by `Record<keyof I, true>` so a new
  option key fails to compile until it is listed.

`collect-identifiers.mjs` keeps its job as the candidate enumerator and subtracts `.reserved.json`,
with a build-time assertion that `safeToMangle ∩ reserved` is empty.

**Terser wiring: keep `regex`, add `reserved` — both.** Measured in terser 5.46.0: `reserved` wins
over `regex` when they disagree, and costs 87 B of the 2,475 B mangling saves. `regex` stays primary
because it is *fail-closed* (an unclassified name is not mangled); `reserved` is a second net so a
generator bug cannot rename a wire key. Never `reserved` alone — that is fail-open.

### Step 8 — the editor's symmetric guard (urgent, see §1.2)

Add the reserved list to `E/lib/ObfuscationUtil.js`'s filter chain and assert in
`ObfuscatedBuildValidationPlugin` ([E/webpack.config.ts:314](../../kf/app/webpack.config.ts#L314))
that no reserved key entered `propsSet`. With today's source that assertion fails immediately with
`debugGlobalName, pathData, repeatAt` — which is the point.

### Step 9 — the `sanitize` faithfulness fix (validation, independent of the above)

[PxSchema.ts:386-393](../../packages/svg-animator-core/src/schema/PxSchema.ts#L386) and
[:465-479](../../packages/svg-animator-core/src/schema/PxSchema.ts#L465) — guard the writes with
`if (v !== undefined)`. Four lines.

Measured today: `sanitize` writes **16,367 phantom `undefined` keys** across 135 real documents,
which changes rendered output on **10 of 127** — `PxOffsetPathMaterializer.ts:91-92` bails on the
extra transform keys (CSS Motion Path disabled, WAAPI output 5,153 → 26,019 bytes) and
`contentRefSplit.ts:254-257` emits `transform=""`. The guard takes those 20 materialization diffs
to **0**.

This makes `sanitize` usable as a boundary *validator* later; it is worth landing on its own merit.

### Step 10 — documentation

`docs/format/README.md` (`domType` now in the schema; the `kfs` denial becomes true), regenerate `SCHEMA.json`
and `SCHEMA.html`, and a short "minification" note in `API-docs/format/README.md` naming the reserved list and
the `mangle-reserved.json` consumers can feed their own mangler.

---

## 5. Sequencing

| # | step | gate |
|---|---|---|
| 0 | clean rebuild, reconfirm the twelve | the check prints all twelve |
| 1 | A/B bundle test suite | **fails** on all twelve — that is success |
| 2 | collector edit A | 8 names fixed; suite goes from 12 red to 4 |
| 3 | collector edit B | `rangeName` |
| 4 | declare `domType` | `grep -c domType SCHEMA.json` ≥ 1 |
| 5 | delete `kfs` | no `.kfs` reads remain |
| 6 | `class` constant | `grep -c '"class"' dist/*.umd.min.js` ≥ 1 |
| 7 | derived reserve list + terser `reserved` | `safeToMangle ∩ reserved === []` |
| 8 | editor guard | editor production build fails, then passes after reserving the 3 keys |
| 9 | `sanitize` guard | 20 materialization diffs → 0 |
| 10 | docs + regenerated schema | website build clean |

Steps 0–6 are the bug fix. Steps 7–8 are what stops it recurring. Step 9 is independent.

Measured cost of fixing all twelve: **+928 bytes raw / +49 brotli — 0.15% of the bundle.**

---

### Step 11 — a "Minification" section in the library docs

Written **after** the implementation, once the solution is proven: what the library guarantees, which
names must never be renamed, how to feed the reserved list to terser / esbuild / Closure, what the
diagnostic warning means when it fires, and the one-line summary that property mangling of third-party
code is not supported (with React's precedent — it does none).

---

## 6. Follow-ups — after the obfuscation work lands (decided, not scheduled)

No backwards compatibility is being kept for either of these. They are listed here so the reserve
list shrinks rather than grows, but **they are not part of steps 0-10**.

1. **Delete legacy flat-document support.** ⏸ **Not done, and deliberately so.** `timelineSource`
   and `resetOnFinish` are read only for documents in the pre-2026-09 flat spelling
   ([PxScrollMath.ts:18](../../packages/svg-animator-core/src/playback/PxScrollMath.ts#L18),
   [PxAnimatorBind.ts:38](../../packages/svg-animator-web/src/engines/PxAnimatorBind.ts#L38)). The premise for
   removing it evaporated once step 2 reserved both names under a GENERAL rule (members of an
   exported type), so acceptance now costs nothing in the reserve list — while removing it would
   stop old files in the wild from playing. See the note under §3B.
   The fixture half IS done: ✅ all 197 sites migrated 2026-09-09 (the estimate of "18 test
   documents" was low by an order of magnitude), with a guard test so it stays that way.
2. **`kfs` cleanup** ✅ **done** — the alias and its short siblings (`t`/`v`/`e`/`ti`/`to`) are
   deleted and now REJECTED by the schema; [docs/format/README.md](../../docs/format/README.md)'s denial
   that aliases exist is finally true.

## 7. Open questions — ALL ANSWERED (2026-09-09)

1. **Option C or B** (§3) — ✅ **C.** B cannot deliver what it promised: the DOM is itself a
   boundary and the node attribute namespace is open-ended, so a converting parse boundary would
   still leave names exposed. Recorded in §3; the recommendation was reverted to C.
2. **If B: do the low-level exports require a parsed document?** — moot, B was not chosen.
3. **Does the editor guard block its build, or warn?** — ✅ **blocks.**
   `E/lib/ObfuscationUtil.js:getPlayerReservedNames()` searches `node_modules` then the sibling
   checkout and **throws** when neither has the list, naming both paths and saying why. A guard
   that silently does nothing is the exact failure this exists to prevent.
4. **`mangle-reserved.json` — ship it, or just document?** — ✅ **shipped**, in
   `package.json#files` AND, since 2026-09-09, reachable: an `exports` subpath was added, without
   which the `require('@pixodesk/svg-animator-web/mangle-reserved.json')` that
   [docs/library/minification.md](../../docs/library/minification.md) documents threw
   `ERR_PACKAGE_PATH_NOT_EXPORTED`.
