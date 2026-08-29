# JSON format reference

[← Format principles](./13-format--format-principles.md) · [Contents](./README.md) · Next: [Player effects →](./15-format--effects.md)

Look up any key of the JSON document here — every key, its type and its meaning. The document
is **SVG written as JSON, plus animation**: if you can read an SVG file you can read one of
these, and this page is the practical reference for it. Design rationale lives in
[Format principles](./13-format--format-principles.md); TypeScript types and runtime schemas
are exported by every package (`PxAnimatedSvgDocument`, `PxNode`, `PxAnimatorConfig`, …).

## A complete small document

```json
{
  "type": "svg",
  "viewBox": "0 0 400 400",
  "animator": { "duration": 1000, "iterations": "infinite", "trigger": { "startOn": "load" } },
  "children": [
    {
      "type": "ellipse",
      "cx": 139, "cy": 163, "rx": 64, "ry": 64,
      "fill": "#007fff85", "stroke": "#003a73",
      "animate": {
        "transform": { "keyframes": [
          { "time": 0,    "value": { "translate": [0, 0] } },
          { "time": 1000, "value": { "translate": [0, 147] }, "easing": [0.42, 0, 0.58, 1] }
        ] }
      }
    }
  ]
}
```

Three ideas cover 90 % of the format:

1. **Elements are objects** — `type` is the SVG tag, every other key is an SVG attribute,
   `children` nests.
2. **Any attribute animates through a parallel `animate` channel** keyed by the attribute's
   name. The static attribute stays where it is (so the document degrades to a valid static
   SVG); the keyframes sit beside it.
3. **One clock** — the root `animator` holds every document-level setting.

## The document root

| Key | Type | Meaning |
|---|---|---|
| `type` | `"svg"` | required — identifies a document |
| `id` | string | DOM id; in Mode B ([below](#mode-b--binding-to-an-existing-svg)) it locates the pre-rendered element |
| `viewBox` | string | coordinate space, e.g. `"0 0 700 380"` |
| `width` · `height` | number or SVG length string (`"100%"`) | rendered size |
| `animator` | object | playback settings, definitions, Mode B bindings — see [Playback settings](./10-player--playback-and-triggers.md) and [Definitions](#definitions--animatordefinitions) |
| `children` | array of nodes | the SVG tree (Mode A). Absent → Mode B |
| any SVG attribute | | passed through (`fill`, `style`, `xmlns` is added for you) |

## Nodes

```json
{ "type": "rect", "id": "box", "x": 10, "y": 10, "width": 80, "height": 40, "rx": 6, "fill": "#6366f1",
  "animate": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 500, "value": 1 } ] } } }
```

| Key | Meaning |
|---|---|
| `type` | the SVG tag: `rect`, `circle`, `ellipse`, `line`, `path`, `polygon`, `polyline`, `g`, `text`, `tspan`, `use`, `symbol`, `defs`, `image`, `mask`, `clipPath`, `linearGradient`, `radialGradient`, `stop`, `pattern`, `marker`, `filter` and the `fe*` primitives, … |
| `id` | DOM id — required when something references the element (`href="#id"`, `maskedBy`, `animateById`). The player regenerates ids per instance, so they need only be unique within the file |
| `children` | nested nodes |
| `animate` | this node's animations — [below](#animating--the-animate-channel) |
| `effects` | structural effects — [Player effects](./15-format--effects.md) |
| `style` | inline style: a string or an object, or the **name** of a preset in `definitions.styles` |
| `textContent` | text content of `<text>` / `<tspan>` (the older `text` key is still read) |
| `meta` | editor-only data (labels, shape presets, applied effects). Players ignore it; safe to strip — [Editor meta and applied effects](./16-format--editor-meta.md) |
| any other key | an SVG attribute |

**Attribute names** may be written as in SVG (`stroke-width`, `font-size`) or camelCase
(`strokeWidth`, `fontSize`); both render to the standard kebab-case attribute. The editor
writes camelCase.

**Static values** are typed: numbers (`opacity: 0.5`), number lists (`strokeDasharray: [16,
16]`), strings (`fill: "#33b366"`, `viewBox`), a transform **parts record** (`transform:
{ translate: [10, 10], rotate: 45 }`) or an SVG transform string. A typed static has the same
shape as the keyframe value that animates it — there is one grammar, not two.

**Reserved keys** — `type`, `children`, `animator`, `animate`, `effects`, `meta`, `text`,
`textContent` never reach the DOM as attributes. The one collision is the SVG `type`
*attribute* of filter primitives: write it as **`domType`** and the player renames it back:

```json
{ "type": "feTurbulence", "domType": "fractalNoise", "baseFrequency": 0.05, "numOctaves": 2 }
```

### Text

```json
{ "type": "text", "x": 20, "y": 40, "fill": "#111", "fontSize": 18, "textContent": "Hello",
  "children": [ { "type": "tspan", "dy": 20, "textContent": "second line" } ] }
```

With `effects.text.useGlyphs: true` the text renders from glyph outlines embedded in
`definitions.glyphs` — no font needed on the viewer's machine (the editor embeds them for you).

## Animating — the `animate` channel

```json
"animate": {
  "opacity":   { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 1 } ] },
  "fill":      { "keyframes": [ { "time": 0, "value": "#3b82f6" }, { "time": 1000, "value": "#ec4899" } ] },
  "transform": { "keyframes": [ { "time": 0, "value": { "rotate": 0 } }, { "time": 1000, "value": { "rotate": 360 } } ] }
}
```

`animate` maps **attribute name → property animation**. It can also be a **name** from
`definitions.animations`, an array of names, or a mixed array:

```json
"animate": "fadeIn"
"animate": ["fadeIn", "spin"]
"animate": ["fadeIn", { "scale": { "keyframes": [ { "time": 0, "value": [1, 1] }, { "time": 1000, "value": [1.5, 1.5] } ] } }]
```

### Property animation

| Key | Type | Meaning |
|---|---|---|
| `keyframes` | array | the timeline (alias `kfs`) |
| `value` | | optional static baseline (rarely needed — the static attribute on the node is the baseline) |
| `loop` | `true` or object | repeat a segment to fill the document — [Loops](#loops) |
| `autoOrient` | boolean | translate animations with tangents: rotate the element to face the path — [Motion along a path](#motion-along-a-path) |

### Keyframes

| Key | Alias | Type | Meaning |
|---|---|---|---|
| `time` | `t` | ms | offset from the start of the document timeline |
| `value` | `v` | see below | the property's value at this time |
| `easing` | `e` | `[x1, y1, x2, y2]` or a name | cubic-bezier for the interval **leaving** this keyframe, or a key of `definitions.easings` |
| `tangentOut` · `tangentIn` | `to` · `ti` | `[dx, dy]` | spatial tangents for motion along a path (translate only), relative to this keyframe's position |

Use one spelling per key, never both.

### Keyframe values

| Property kind | `value` | Example |
|---|---|---|
| scalar (`opacity`, `r`, `strokeWidth`, `rotate`, …) | number | `0.5` |
| vector (`strokeDasharray`, `scale`, `translate`) | number array | `[80, 40]` |
| colour (`fill`, `stroke`, `stopColor`, …) | CSS colour string (or an RGBA number array) | `"#ec4899"` |
| unified `transform` | parts record | `{ "translate": [8, 4], "rotate": 90, "scale": [2, 2] }` |
| path `d` | `{ "path": "M…" }` (a bare `"M…"` string is also accepted) | `{ "path": "M0,0 L50,0 L50,50 Z" }` |
| gradient `stops` (inside gradient effects) | array of `{ offset, color }` — one snapshot per keyframe | |

### Easing

```json
{ "time": 0, "value": 0, "easing": [0.33, 0, 0.67, 1] }
{ "time": 0, "value": 0, "easing": "smooth" }
```

A named easing is defined once in `animator.definitions.easings` (`"smooth": [0.42, 0, 0.58,
1]`). No easing = linear.

### Loops

A property can repeat part of its own keyframes to fill `animator.duration`, independently of
the document's `iterations`:

```json
"rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 360 } ], "loop": true }
"scale":  { "keyframes": [ { "time": 0, "value": [1, 1] }, { "time": 500, "value": [1.2, 1.2] }, { "time": 1000, "value": [1, 1] } ],
            "loop": { "segmentCount": 1, "extend": "after", "alternate": true } }
```

| Key | Meaning |
|---|---|
| `segmentCount` | how many keyframe intervals form the repeated segment (default: all of them) |
| `extend` | `"after"` (default) repeats the **last** intervals after the final keyframe — idle/outro loops; `"before"` repeats the **first** intervals ahead of the first keyframe — intro loops |
| `alternate` | `false` (default) replays in the same direction; `true` ping-pongs |

`loop: true` = repeat the whole sequence, after, forward.

## Transforms

Animate every part together as **one** `transform` property whose values are parts records:

```json
"animate": { "transform": { "keyframes": [
  { "time": 0,    "value": { "translate": [0, 0],   "rotate": 0,  "scale": [1, 1] } },
  { "time": 1000, "value": { "translate": [80, 40], "rotate": 90, "scale": [1.5, 1.5] } }
] } }
```

| Part | Type | Notes |
|---|---|---|
| `translate` | `[x, y]` | user units |
| `rotate` | number | degrees |
| `skew` | number | skewX degrees, composed between rotate and scale |
| `scale` | `[sx, sy]` | factors (`1` = 100 %) |
| `origin` | `[x, y]` | pivot for rotate / skew / scale — only meaningful alongside one of them |

Composed order: `translate · +origin · rotate · skewX · scale · −origin`. The same record is
the canonical **static** `transform` value (`"transform": { "translate": [100, 100], "rotate":
45 }`); an SVG transform string is accepted too. The older per-part channels (`animate:
{ translate, rotate, scale }`) are still read.

A static `transform` attribute and an animated `transform` on the same node share one slot, so
the animation wins; put a static placement on a wrapping `<g>`. To animate parts on
**different timings** (rotate 0–500 ms while translate runs 500–1000 ms) use the
[`transformBy` effect](./15-format--effects.md#transformby).

## Motion along a path

Translate keyframes can carry Bézier tangents; the element then moves along the curve, and
`autoOrient` turns it to face the direction of travel:

```json
"animate": { "transform": {
  "autoOrient": true,
  "keyframes": [
    { "time": 0,    "value": { "translate": [30, 150] },  "tangentOut": [46, -80] },
    { "time": 3000, "value": { "translate": [270, 150] }, "tangentIn":  [-46, -80] }
  ]
} }
```

Tangents are deltas from the keyframe's own position (`P1 = value + tangentOut`, `P2 =
next.value + next.tangentIn`). Players sample the curve where the platform cannot follow it
natively.

## Path morphing

Animate a path's `d`; every keyframe must have the **same command structure** (same number and
kinds of segments — the editor guarantees this for shapes it created):

```json
{ "type": "path", "fill": "#f59e0b", "d": "M-50,0 L0,-50 L50,0 L0,50 Z",
  "animate": { "d": { "keyframes": [
    { "time": 0,    "value": { "path": "M-50,0 L0,-50 L50,0 L0,50 Z" } },
    { "time": 2000, "value": { "path": "M-50,-50 L50,-50 L50,50 L-50,50 Z" } }
  ] } } }
```

Morphing runs on the frame-loop engine (the `auto` mode switches automatically).

## Definitions — `animator.definitions`

Reusable, named pieces:

```json
"definitions": {
  "easings":    { "smooth": [0.42, 0, 0.58, 1] },
  "animations": { "fadeIn": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 2000, "value": 1 } ] } } },
  "styles":     { "label": { "fontFamily": "Inter", "fontSize": 12 } },
  "glyphs":     { "Roboto": { "fFamily": "Roboto", "style": "", "ascent": 928, "unitsPerEm": 1000,
                              "glyphs": { "H": { "width": 722, "d": "M100 0V722H190V400H532V722H622V0H532V320H190V0Z" } } } }
}
```

| Key | Referenced by |
|---|---|
| `easings` | a keyframe's `easing: "name"` |
| `animations` | a node's `animate: "name"` (or `animateById` values) |
| `styles` | a node's `style: "name"` |
| `glyphs` | `<text>` with `effects.text.useGlyphs`, keyed by the text's `font-family` |

## Mode B — binding to an existing SVG

A document **without `children`** does not build anything: it animates an SVG that already
exists in the DOM, matching elements by id. This is what the editor's *SVG + JS animation*
export embeds.

```js
createAnimator({ data: {
  type: 'svg', id: '_px_root',
  animator: {
    duration: 2000,
    definitions: { animations: { fadeIn: { opacity: { keyframes: [ { time: 0, value: 0 }, { time: 2000, value: 1 } ] } } } },
    animateById: {
      _px_rect:    'fadeIn',                                     // one named animation
      _px_ellipse: ['fadeIn', { fill: { keyframes: [ { time: 0, value: '#0087ff' }, { time: 2000, value: '#ff3b30' } ] } }],  // several, mixed
    },
  },
} });
```

`animateById` values have exactly the same shape as a node's `animate`; only the key differs
(element id here, attribute name there).

## Units

Units are never written. Each property has one fixed implicit unit:

| Quantity | Unit |
|---|---|
| time (`time`, `duration`, `delay`, `retime.start`) | milliseconds |
| lengths, coordinates, `fontSize` in px | user units (unitless) |
| `rotate`, `skew`, angles | degrees |
| `opacity`, trim `range` / `offset`, stop `offset`, `scrollIntoViewThreshold` | fraction 0–1 |
| every `scale` | factor (`1` = 100 %) |
| `retime.stretch` | factor (`0.5` = half speed) |
| `frameRate` | frames per second |
| easing | cubic-bezier `[x1, y1, x2, y2]` |

## Validating a document

```ts
import { isPxElementFileFormat, PxAnimatedSvgDocumentSchema } from '@pixodesk/svg-animator-web';

isPxElementFileFormat(json);                              // cheap: is this a Pixodesk document at all?
const ctx = { errors: [], warnings: [], strict: true };
PxAnimatedSvgDocumentSchema.isValid(json, ctx, []);       // full check; ctx.errors lists problems
```

See [Core library → Validating](./18-format--core-library.md#validating-a-document).

[← Format principles](./13-format--format-principles.md) · [Contents](./README.md) · Next: [Player effects →](./15-format--effects.md)
