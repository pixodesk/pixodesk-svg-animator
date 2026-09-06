# Editor meta and applied effects

[← Player effects](./effects.md) · [Contents](../README.md) · Next: [Meta in pre-rendered SVG →](../prerendered-svg/data-px-meta.md)

The **editor app** writes its own information into a dedicated field that every **node** can
carry, called **`meta`**. It holds things like element labels, shape presets, and the
settings of applied effects.
**Players never read this field**: a file with no `meta` at all plays exactly the same. This
page explains what the editor puts there and why, so you can make sense of a `meta` block you
find in a file — or know what you can safely leave out when writing a file by hand.

## Where it lives

Every node may carry a `meta` object. In the JSON format it sits on the node as `node.meta`;
in a pre-rendered SVG the same object is written into a per-element `data-px-meta` attribute
([Meta in pre-rendered SVG](../prerendered-svg/data-px-meta.md)). One read pipeline handles both.

```js
// A plain SVG path — this is what every player draws
{ "type": "path", "id": "star", "d": "M50,122L78,172.4L22,172.4L50,122z",
  // ADDED: editor-only data — players skip `meta` entirely
  "meta": { "label": "Triangle", "appliedEffects": { "shape": { "preset": { "type": "polygon", "points": 3, "radius": 30 } } } } }
```

## The fields

| Field | Which elements carry it | What it holds |
|---|---|---|
| `label` | any element | the display name shown in the editor's element tree |
| `appliedEffects` | a plain node | this node's own effects, **already applied** — [Applied effects](#applied-effects) |
| `effectsHost` | the host of expanded parts, **pre-rendered SVG only** | some effects turn one drawn element into several written elements (a repeater becomes its copies) — its "expanded parts". This field sits on the expansion's outermost element (its **host**) and holds `{ coreId?, appliedEffects }`: all the effects the drawn element had, so the editor can fold the parts back into that one element — [Expanded parts](#applied-effects-that-create-derived-elements-host--core--part) |
| `partOf` | every element derived by that expansion, **pre-rendered SVG only** | the counterpart of `effectsHost`: each element the expansion produced carries `"#hostId"` pointing back at the host element that holds the `effectsHost` field, so the whole unit can be found from any of its parts |
| `runtime` | root `<svg>` only | how the animation code was generated: `{ useCssAnimation, useJsTriggers, externalJs, unoptimisedJs }` — the export-format choices, not the animation |
| `animator` | root `<svg>`, **pre-rendered SVG only** | the playback settings; in JSON they are the top-level `animator` instead ([read more](../prerendered-svg/data-px-meta.md#the-animator-config-lives-in-two-different-places)) |
| `timeline` | `<symbol>` only | `{ duration }` — the symbol's own animation length, ms |
| `lineSpacing` | text line `<tspan>`s from the second line on | the *Auto* line-height multiplier the materialised `y` was computed from |
| `animate` | any element, **pre-rendered SVG only** | the node's keyframes, so a CSS export can be re-opened; in JSON this is the node's own `animate` |

## Applied effects

Sometimes the editor **materialises** an effect: it writes the effect's finished result
straight into the node's ordinary attributes — a star preset becomes path data, rounded
corners become the rounded path. The drawing still looks right, but the effect itself is no
longer in it. To keep the file editable, the editor saves the effect's settings in
`meta.appliedEffects`: a record of what was applied.

As a result, an effect description can sit in one of two places, and the place says what it
means:

| | Meaning | Which effects can appear |
|---|---|---|
| `node.effects` | **apply these.** The player reads this when the document loads and applies the effects — [Player effects](./effects.md) | the player effects: `text`, `textPath`, `fillGradient`, `strokeGradient`, `strokeTrim`, `repeater`, `maskedBy`, `clipPath`, `transformBy`, `clone` |
| `node.meta.appliedEffects` | **these were already applied.** The result is in the node's ordinary attributes; the settings are kept for the editor, so that when it opens the file it can read the effect back as an effect — not just its materialised result | the same names, plus keys only the editor knows: `shape`, `combinedPath`, and widened `text` / `clone` — listed below |

The player never reads `appliedEffects`, and the editor never re-applies it. Editing a value
in `appliedEffects` by hand changes nothing on screen — the materialised result is what plays.

Where `appliedEffects` matters is when the editor opens the file again: it reads each entry
and collapses the materialised result back into the editable effect it came from — a star
preset becomes a star with a radius handle again, not a frozen path. The entries use the same
names as the effects in `node.effects`, plus a few keys only the editor knows:

- **`shape`** — **where the path came from**, so the file re-opens as a star with a radius
  handle, not as a fixed path. The finished outline always goes into `node.d` (or
  `node.animate.d` when it animates); `shape` keeps the source:
  - `preset` — a **ready-made shape** described by a few settings (radius, number of points,
    roundness, …): `star`, `polygon`, `spiral`, `arc`, `wave`, `arrow`, `heart`, `cross`,
    `frame`, `cog`, `crescent`, `tear`, `eye`, `trapezoid`. The settings **can carry
    keyframes**; only the structure (say, a polygon's side count) is fixed.
  - `path` — the original path, when a modifier (rounded `corners`) was applied to it.
- **`text`** — widened with `fontSource` and `content`, the payload that lets glyph-rendered
  text be edited as text again.
- **`clone`** — widened with the `width` / `height` of a materialised `<use>`.
- **`combinedPath: true`** — an *identity* effect the writer adds beside `strokeTrim` when it
  had to split a multi-sub-path shape into a `<g>` of one `<path>` each; it tells the reader to
  join them back into one shape.

```json
"meta": { "appliedEffects": {
  "shape": {
    "preset": { "type": "polygon", "points": 6, "radius": 40, "startAngle": 0,
                "roundness": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 12 } ] } }
  }
} }
```

## Applied effects that create derived elements (host / core / part)

Some effects cannot be materialised into one element. A repeater is *n* copies; a stroke trim on a
shape with several sub-paths becomes a `<g>` of one `<path>` per sub-path. A pre-rendered file
holds that expansion — and the editor must be able to fold it back into the one element you
drew. Three marks make that possible:

- **Host** — the outermost written element; keeps the element's own id. Carries
  `meta.effectsHost = { coreId?, appliedEffects }` — **all** of the element's effects, the
  only copy.
- **Core** — the element's own node among the parts: named by `coreId`, or the host itself
  when `coreId` is absent.
- **Part** — every element the expansion produced. Carries `meta.partOf = "#hostId"` — always
  the host, never a sibling.

For example, a fading circle — its opacity is animated — drawn once with a `repeater` effect
(three copies) is written into a pre-rendered export like this (shortened — the complete,
genuine export is in [Meta in pre-rendered SVG](../prerendered-svg/data-px-meta.md)):

```svg
<!-- HOST: the outermost element of the expansion. It keeps the drawn element's own id
     and holds ALL of its effects, in effectsHost. coreId names the core below;
     when coreId is absent, the host itself is the core -->
<g id="dot" transform="translate(80,200)"
   data-px-meta="effectsHost:{coreId:'#_px_2',appliedEffects:{transformBy:{translate:[80,200]},repeater:{copies:3,translate:[100,0]}}}">

  <!-- CORE: the ellipse that was actually drawn, named by coreId above -->
  <ellipse id="_px_2" fill="#0087ff" rx="20" ry="20"
           data-px-meta="partOf:'#dot',animate:{opacity:{keyframes:[{time:0,value:1},{time:1000,value:0.2}]}}"/>

  <!-- PARTS: the two extra copies the repeater produced; every derived element,
       the core included, points back at the host.
       (A repeater with a STATIC source writes its copies compactly, as <g><use href="#…">.
       Here the source is animated, and CSS animation cannot reach inside a <use>,
       so the copies are written as real clones.) -->
  <g transform="matrix(1,0,0,1,100,0)" data-px-meta="partOf:'#dot'">
    <ellipse fill="#0087ff" rx="20" ry="20"
             data-px-meta="partOf:'#dot',animate:{opacity:{keyframes:[{time:0,value:1},{time:1000,value:0.2}]}}"/>
  </g>
  <g transform="matrix(1,0,0,1,200,0)" data-px-meta="partOf:'#dot'">
    <ellipse fill="#0087ff" rx="20" ry="20"
             data-px-meta="partOf:'#dot',animate:{opacity:{keyframes:[{time:0,value:1},{time:1000,value:0.2}]}}"/>
  </g>
</g>
```

A node is exactly one of *host*, *part* or *plain* — never two. Only a plain node carries
`appliedEffects` directly; within an expansion everything lives in the host's `effectsHost`.

On read the editor takes one verdict per expansion — *does this fold back to exactly one
element?* — and restores all of it or none. An expansion it cannot restore keeps its artwork,
drops its effects
cleanly, and tells you which effect was lost. This is also why every derived element is marked:
restoring an effect while leaving its old expansion behind would double it on the next save.

Expanded parts appear in pre-rendered files. A JSON document from the editor carries its
effects declaratively instead, so it never contains them.

[← Player effects](./effects.md) · [Contents](../README.md) · Next: [Meta in pre-rendered SVG →](../prerendered-svg/data-px-meta.md)
