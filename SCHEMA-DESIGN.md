# SVGA Format — Schema Design (player + editor)

Sources of truth:
- **Player schema**: `packages/svg-animator-core/src/PxAnimatorTypes.ts` (`PxAnimatedSvgDocumentSchema`)
- **Editor schema** (extensions): `kf/app/src/svgeditor/model/serialization/schema/PxSchemaUtil.ts`
- **Empirical corpus**: 116 feature-explorer cases (`featureexplorer/cases/*.json`)

Open problems, ranked: **[SCHEMA-DESIGN.issues.md](./SCHEMA-DESIGN.issues.md)**.
(This file absorbed SCHEMA-ANALYSIS.md, TRANSFORM-ANALYSIS.md, HOST-META-DESIGN.md and
APPLIED-EFFECTS-PLAN.md; §-labels referenced from code comments — R*, E-5, P1–P7, T1–T5 — are kept.)

---

## 0 · Ref-attr glossary — one relation per name

| name | relation | carriers |
|---|---|---|
| **`sourceId`** | ref to an **external** element (survives on its own) | `clone.sourceId`, `maskedBy.sourceId`, retime `sourceId`, `retimedCopy.sourceId` |
| **`coreId`** | my own unit's **survivor** — the node the collapse restores to | `host.coreId` |
| **`partOf`** | my **host** — provenance mark on every derived node | `meta.partOf` |

- Wire spelling of every px-meta ref is **`#id`** (E-5 canon); readers accept legacy bare `id`.
- Native SVG refs (`<use href>`, `mask="url(#…)"`, `fill="url(#…)"`, `offset-path`) stay
  browser-spelled and are always **derived on write**, never design-authored.
- History: `maskedBy.href`→`sourceId`, `clone.baseId`→`sourceId`, retime `baseId`→`sourceId`;
  `retimedCopy.{srcId,baseId}` (two fossil fields nothing wrote or read) collapsed to `sourceId`.

---

## 1 · Generative rules — the format as a story

Each rule adds one concept. A document using only R1–R3 is fully playable; everything later reduces to R1–R3.

**At a glance:**

- **R1** — Static content is SVG as JSON: `{type, ...svgAttributes, children}`.
- **R2** — Any attribute animates via the parallel `animate` channel, keyed by attribute name; the static attr stays plain SVG.
- **R3** — One clock: the root `animator` owns everything temporal that isn't per-property.
- **R4** — Reuse by name: `animator.definitions` (easings, animations, styles, glyphs).
- **R5** — Effects are declarative generators the player expands at load; anything needing STRUCTURE (defs, wrappers, clones, multi-attr rewrites) is an effect, anything the browser consumes as one value is an attribute.
- **R6** — Everything editor-only lives in `meta` (label, runtime, own `appliedEffects`, `host`/`partOf`); the player is free to ignore it.
- **R7** — Pre-rendered SVG is the same model flattened: `meta` → `data-px-meta` strings, animation → CSS `@keyframes` or embedded player binding by id.

### R1 · Static content = SVG as JSON
`{type: "<tagName>", ...svgAttributes, children: []}` — the SVG vocabulary, JSON-encoded.
Reserved node keys: `type, children, animator, meta, animate, effects, text, textContent`.

```json
{ "type": "svg", "viewBox": "0 0 200 200", "children": [
    { "type": "ellipse", "cx": 100, "cy": 100, "r": 30, "fill": "#33b366" } ] }
```

### R2 · Any attribute can animate: the `animate` channel
A **parallel channel keyed by attribute name** — never an inline value replacement:

```json
{ "type": "ellipse", "opacity": 0.5,
  "animate": { "opacity": { "keyframes": [
      { "time": 0, "value": 0.5, "easing": [0.33, 0, 0.67, 1] },
      { "time": 1000, "value": 1 } ] } } }
```

Why not inline: the static attr stays a plain SVG value — the doc degrades to valid static SVG by
ignoring `animate`; tools read initial state without understanding animation.
Keyframe grammar: `{time, value, easing?, tangentIn?/tangentOut?}` (+ short aliases `t/v/e/ti/to`);
`tangent*` = motion-along-path, `autoOrient` rotates along it; per-property
`loop {segmentCount?, before?, alternate?}` extends kfs to the document duration.

### R3 · One clock: root `animator`
`{duration/delay (ms), mode: auto|webapi|frames, iterations, direction, fill, frameRate,
resetOnFinish, trigger {startOn, outAction}}` — everything temporal that is not per-property.

### R4 · Reuse: `animator.definitions`
Named libraries: `easings`, `animations`, `styles`, `glyphs` (embedded font outlines).
*Corpus reality: only `glyphs` is used (24 files); named easings/styles are dormant.*

### R5 · Effects (player): declarative generators
`node.effects.{effect}` describes structure the player expands into R1–R3 content at load
(`applyPlayerEffects`; the runtime never sees a non-empty `effects` after entry).

**The attribute-vs-effect law**: an *attribute* is a value the browser consumes as-is on that element —
animating it is one channel, zero structure. An *effect* is anything whose realisation requires
**structure**: minting defs (gradient, clipPath, maskedBy, textPath), wrapper nodes (transformation),
clones (repeater, clone), or geometry-derived multi-attr rewrites (trimPath). The test is structure,
not value complexity (`transform` has a parts-record value but lands in one attribute → attribute);
one attr name can sit on both sides split by value (flat `fill` = attribute; gradient fill = effect).

| effect | expands to | payload core (✚ = animatable slot) |
|---|---|---|
| `transformation` | per-part wrapper sandwich `T(+o)·T(t)·R(r)·S(s)·T(−o)` | `translate✚ rotate✚ scale✚ skew✚ origin✚` |
| `repeater` | N sibling copies, per-copy transform ×i | `copies` + `translate✚ rotate✚ scale✚ skew✚ origin✚` (scale compounds `s^i`) |
| `maskedBy` | minted `<mask>` + wiring | `sourceId`, `maskType…`, `start`/`size` viewport |
| `clipPath` | minted `<clipPath><path>` + url | `d✚` |
| `trimPath` | dash-based draw-on | `offset✚`, `range✚` (fractions), `trimAllAsOne` |
| `clone` | `<use>` semantics: what + when | `type: 'content'?`, `sourceId`, `retime {sourceId?, start, stretch}` |
| `fillGradient`/`strokeGradient` | minted gradient def + url | geometry `p1/p2/c/r/fp`✚ + `stops`✚ |
| `textPath` | native `<textPath>` + minted path def | `path` (d), `startOffset✚`, `pathOverflow…` |
| `text` | glyph-outline text rendering | `useGlyphs` |

### R6 · Editor layer: `meta`
Everything the editor needs but the player is free to ignore (player types `meta` as `px.any()`):
- `meta.label`, `meta.runtime` (export settings, root only);
- `meta.appliedEffects.{group}` — **this node's own** editor effects/mirrors (parametric `shape`
  presets, rich `text` config, gradient mirror);
- `meta.host` + `meta.partOf` — the expansion-host contract (§P below).

### R7 · Pre-rendered SVG (.svg)
The same model flattened into a real SVG document: `meta` serialises to a per-element
`data-px-meta="…"` string; animation ships as CSS `@keyframes` or as embedded player +
`animator.animate` **id → animation map** (the DOM already exists; the player only binds by id).

---

## 2 · Value taxonomy

### Kinds
| kind | example | used by |
|---|---|---|
| number | `0.5`, `45` | opacity, rotate, r, offsets |
| Vec2 `[x,y]` | `[96.8, 46.8]` | translate, scale, origin, ranges, gradient pts |
| number array | `[16,16]` | dasharray (canonical static AND kf form; legacy `"5,5"` read-only), RGBA |
| string | `"#33b366"`, `"none"`, `"0 0 200 200"` | colors, enums, viewBox, transform-as-string |
| transform parts record | `{translate:[x,y], rotate:deg, scale:[sx,sy], skew:deg, origin:[x,y]}` | unified `transform` |
| path value | `{path: "M…"}` (legacy `{paths:[…]}` bezier read-only) | animated `d`, clipPath |
| gradient stops | `[{offset: 0.4, color: "#f00"}, …]` | gradient effects |

### The ONE animatable grammar
Every animatable slot — body attrs, `transform`, every effect parameter — accepts the same triple;
the animated form IS `PxPropertyAnimation` (the exact `node.animate` object; one schema, one reader
`readAnimatable`, one loop path):

```
T                          — raw static (allowed for any non-plain-object T)
{ value: T }               — structured static (MANDATORY when T is a plain object)
{ value?, keyframes|kfs, loop?, autoOrient? }   — animated
```

`value` inside the animated form is the static baseline. Most slots treat kf values as complete;
patch-semantics slots (the editor `shape` extended-d) shallow-merge each kf value over the base —
per-slot interpretation, universal SHAPE. `loop`/`kfs` are legal in every slot.

### Units — implicit-units doctrine
**Units are never written; each property has one fixed implicit unit.**

| quantity | unit |
|---|---|
| time (`time`, `duration`, `delay`, `retime.start`) | **ms** (editor UI thinks in 10 ms frames; wire is ms) |
| lengths / coords / px `fontSize` | user units, unitless (non-px `fontSize` — `em`/`%`/`pt` — is the one place a suffix appears) |
| `rotate`, `skew` | **degrees** |
| `opacity`, trim `range/offset`, stop `offset`, `scrollIntoViewThreshold` | fraction **0–1** |
| every `scale` (transform, transformation, repeater per-copy) | **factor** (1 = 100%; editor UI displays %) |
| easing | cubic-bezier `[x1,y1,x2,y2]`, x∈0–1 |

### Naming & ids
- Wire attr names are **camelCase JSX-style** (`strokeDasharray`) → kebab-case on rendered SVG.
- Short kf aliases (`t/v/e/kfs/ti/to`) are read; the editor writes long forms.
- Auto-ids `_px_<base36>`, regenerated per write — only reference structure is meaningful.

### Corpus reality (116 cases)
- Animated attrs: `transform` 54 (dominant), `d` 9, `fill`/`opacity`/`letterSpacing` 6…
- Effects: trimPath 68, textPath 62, text 33, repeater 28, fillGradient 28, maskedBy 26, clone 23,
  strokeGradient 12, clipPath 2. `effects.transformation` — 0 (unit-tested, no visual fixture).
- All easings are cubic arrays; the `{value:T}` structured-static form is written 0 times.

---

## 3 · Transform encodings (T1–T5) and the unifiability rule

SVG gives an element ONE `transform` attribute. Per-part timelines need structure → the split form is
an effect (R5 law). Five representations exist, each with a defined role:

| form | what | where |
|---|---|---|
| **T1** | static SVG string `"translate(100,100) rotate(45)"` | written today (see issues: I-1) |
| **T2** | structured static `{value: {translate:[100,100], rotate:45}}` | schema-legal, never written |
| **T3** | body `animate.transform`, ONE timeline, parts-record kf values | SHARED timing (the common case) |
| **T4** | `effects.transformation` — per-part independent slots | SPLIT timing, **the lightweight wire** |
| **T5** | pre-materialised wrapper tree + `meta.host` recipe | heavy/pre-rendered SVG only |

**Unifiability rule (deliberate design, not drift):** the writer emits ONE body channel (T3) whenever
part timings coincide — cheapest for CSS/WAAPI, degrades to valid static SVG — and the
`transformation` effect (T4) only when timings genuinely split. Consequence: the wire shape of "animate
translate+rotate" depends on whether keyframes share times. Accepted cost; readers must handle both.

**Effect = semantic source; baked structure = render artifact** (the "gradient law", holds for
transforms too): lightweight JSON never materialises expansions — it carries T4 and the player expands
at load. Only the editor's pre-rendered outputs (heavy JSON oracle + .svg) carry the baked tree, and
then ALWAYS with the semantic recipe alongside (`meta.host`, §P). Player-materialised output is
ephemeral — rendered, never serialised back.

---

## P · The `meta.host` expansion contract (implemented)

Editor-expanded effects in pre-rendered output follow one formula:

```
HOST      an expansion's outermost derived element. MUST have an id.
          meta.host = { coreId?, …structure (combinedShape, width/height…),
                        appliedEffects ≡ the element's lightweight effects bucket }

PART      EVERY derived element of the expansion, at every depth:
          meta.partOf = '#hostId'

UNIT      host + all its parts (subtree + partOf-marked out-of-tree nodes, e.g. mask defs)

READ      per host, ATOMIC (all-or-nothing):
          valid  ⇔  recipe parses ∧ every element in the unit is marked or under the core
          valid  →  rebuild element from recipe + core (+ core's unmarked children);
                    DELETE every marked element.
          invalid → restore NOTHING, leave the unit whole (it still renders), WARN.

INVARIANT marked  = written by us = consumed on restore (the core survives AS the element)
          unmarked = user content = survives
```

### The three meta keys (orthogonal)

```json5
// 1. expansion HOST:
"meta": { "host": {
    "coreId": "#aaa",              // structure: where body-attrs/animate live (wrapper expansions)
    "combinedShape": true,          // structure: marked <path> children join into the element's d
    "width": 591, "height": 411,    // structure: materialised-<use> restore size (clone hosts)
    "appliedEffects": { "transformation": {…}, "repeater": {…}, "trimPath": {…} }   // THE RECIPE
} }

// 2. every derived element — one string, no object/array/role/index (all shown derivable):
"meta": { "partOf": "#star" }

// 3. meta.appliedEffects WITHOUT host = ordinary meaning: this node's OWN effects/mirrors.
```

**Recipe invariant:** `host.appliedEffects` ≡ exactly the restored element's lightweight `effects`
bucket — same keys, same shapes. Structure facts (`coreId`, `combinedShape`, clone `width/height`) are
HOST FIELDS, never recipe entries, because they don't exist in lightweight.

**Why TOTAL marking:** the one failure this design makes structurally impossible is
restore-the-effect-AND-keep-its-materialised-elements — the next write expands again next to the stale
survivors, doubling forever. Marked set ≡ derived set; provenance is readable off each element;
interiors of copies/clone content are **stripped of their own meta** and carry only `partOf`
(the derived-content strip — kills per-copy recipe duplication and dead meta in one mechanism).

**Contract rules (P1–P7, condensed):**
- **P1** player-materialised output is ephemeral; the contract concerns editor output only.
- **P2** the host declares; effect grammar `true | {…params}` (`true` ≡ `{}`, survives empty-group pruning).
- **P3** structural effects (writer-auto-triggered, e.g. `combinedShape`) use the same machinery, editor bucket only.
- **P4** TOTAL marking, single-string `partOf` (above).
- **P5** part ⇒ declaration: every `partOf` must point at a node with `meta.host` (`lintPartOfMarks` warns).
- **P6** collapse is atomic (above).
- **P7** failure keeps pixels and shouts: unit left whole + warning on read AND on next write.

### Worked example (heavy SVG, condensed)
Path with 2 subpaths + animated trim + repeater ×3 + split-timing transform:

```html
<g id="star" data-px-meta="host:{
      coreId:'#_px_core', combinedShape:true,
      appliedEffects:{ trimPath:{offset:0.05,range:{…}},
                       transformation:{translate:{…},scale:{…}},
                       repeater:{copies:3,translate:[110,0]} }}">
  <g data-px-meta="partOf:'#star'">                  ← machinery wrapper (scale channel)
    <g id="_px_core" data-px-meta="partOf:'#star'">  ← core (its UNMARKED children would be user content)
      <path d="M10,10L90,10" stroke-dasharray="…" data-px-meta="partOf:'#star'"/>   ← subpath split
      <path d="M10,40L90,40" stroke-dasharray="…" data-px-meta="partOf:'#star'"/>
    </g>
    <g transform="matrix(1,0,0,1,110,0)" data-px-meta="partOf:'#star'">…copy (stripped interior)…</g>
    <g transform="matrix(1,0,0,1,220,0)" data-px-meta="partOf:'#star'">…copy…</g>
  </g>
</g>
```

Every meta string is one of exactly three shapes (`host:{…}`, `partOf:'#id'`, ordinary
`appliedEffects`); the recipe appears ONCE; readers dispatch mechanically.

**Read algorithm:** ① parse recipe (fail → leave whole + warn) → ② take core (`coreId`; absent for
content-discarding hosts like materialised `<use>`) → ③ `combinedShape`: join marked `<path>`
children's `d`s in document order → ④ delete every marked element (incl. out-of-tree), reattach the
core's unmarked children. Nested units resolve inside-out (today: nested hosts — outer
composite host + inner trim host; single-umbrella hoisting is a recorded follow-up).

**Host adoption today:** composite wrapper (`coreId` + transformation/repeater/maskedBy recipe), trim
split wrapper (`combinedShape` + trimPath), materialised `<use>` `<g>` (`width/height` + clone),
masked element itself (`maskedBy`; its `<mask>` def + interior marked `partOf`). Def minters
(gradient/clipPath/textPath/retime copies) are accumulation-stable but not yet host/partOf-marked.

---

## 4 · Editor schema = player schema + named keys

The editor schema is a strict superset built by reuse, not parallel declaration: effect slots share
the lib schemas outright (`SvgRetimeEffectAttrSchema = PxRetimeEffectSchema`,
`SvgCloneEffectAttrSchema = extendedObject(PxCloneEffectSchema, {width, height})`, …). Intentional
editor-only additions: `alongPathMode`, clone `width/height` (host fields), `animator.timeline`, the
`shape`/rich-`text` groups, `meta.host`/`meta.partOf`. Features implemented by the player live ONLY in
the lib schema (`resetOnFinish`, kf tangents, `repeater.skew`, `maskedBy.start/size`).

---

## 5 · Normalisation history (resolved — recorded so it doesn't resurface)

- **Dasharray**: canonical static = number array (string legacy read-only) — the static/animated split closed.
- **fontSize**: px writes as bare number; `em`/`%`/`pt` keep suffixes (genuinely different lengths).
- **Scale**: FACTOR everywhere (percent eliminated; breaking for old bare-percent statics).
- **Keyframe `value`**: runtime-validated by `PxKeyframeValueSchema` (was `px.any()`); compile-time stays permissive for the duck-typed interpolators.
- **One animatable grammar** (was three): gradient geometry animates on its slots (`animate.gradientX1…` legacy read-only); `clipPath.d` is a slot; `shape` documented as patch-semantics instance. Consolidating readers fixed a real bug (repeater mappers missed the `kfs` alias).
- **Ref canon `#id`** everywhere on write; readers accept bare. Fell out: bare `maskedBy` refs became visible to `generateNewIds` + broken-ref validation.
- **Gradient triality** → ONE semantic encoding (`fillGradient`/`strokeGradient` effect; heavy mirrors it); the `colorType`/`gradient(…)` design channel and `animate.gradientX1…` wire channels deleted outright (write AND read); def-chain parse survives only as foreign-SVG import.
- **`isCombinedShape`** → deleted (player + editor); function carried by `host:{combinedShape:true}` + marked subpath children; the player applier's parameter was a literal no-op.
- **Marker evolution**: `appliedEffectPart:{topId,role,index}` → `[{hostId,effect,role?,index?}]` → **`partOf:'#id'`** (everything else host-declared or derivable). A7 fixed en route (markers now reach heavy JSON; combined-trim no longer splits permanently). A8 (wrong host) and A9 (per-copy meta explosion + dangling ids) died by construction; hosts force + carry their ids.
- **`sourceId` renames** (see §0 glossary) incl. the `retimedCopy` fossil collapse.
- **`noRefTranslate`**: dead vocabulary — live mechanism is `clone.type:'content'` (stale comments may linger).
- **Editor↔player graduations**: `repeater.skew` (animated, ×i), `maskedBy.start/size` (mask viewport), kf tangent fields, `resetOnFinish`; dead `SvgTransformAttrSchema` decomposed-transform group deleted.
- **Group-trim safety** (verified): trim on a REAL `<g>` cannot false-collapse — children are per-child wrappers, each its own host.
- **Heavy round-trip idempotency** holds (`write(read(heavy)) == heavy`, canonical ids) across probe combos; accumulation guarded by `applied-effects-accumulation.spec.ts` (11 producers × 2 forms × 3 cycles).
