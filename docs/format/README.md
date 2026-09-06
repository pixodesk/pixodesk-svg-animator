# The JSON format

The **JSON** animation document, in one page: the principles behind the format, the full
reference, the player effects, the editor's `meta`, and the core library that validates and
transforms documents. (The other shape an animation takes — a finished `.svg` file — has its
own documentation: [Pre-rendered SVG](../prerendered-svg/README.md). A compact, printable
schema-only version: [SCHEMA.md](../../SCHEMA.md).)

**On this page:**
[Format principles](#format-principles) ·
[JSON format reference](#json-format-reference) ·
[Player effects](#player-effects) ·
[Editor meta and applied effects](#editor-meta-and-applied-effects) ·
[Core library](#core-library--pixodesksvg-animator-core)

## Format principles

Read this if you write animation files by hand, need to read one to diagnose a problem, or
are simply curious *why* the format looks the way it does.

### Plain SVG, with layers on top

Start from what already exists: **SVG**, the standard format for vector graphics on the web —
every browser draws it. What SVG does not give us is a good way to describe *animation*: how
those shapes move, change colour, morph over time. The Pixodesk format does not replace SVG
to get there. It **keeps SVG as its base and adds what is missing on top, one addition at a
time** — first typed values, then animation, then effects, then the editor's own data. Each
addition is called a **layer**: plain SVG is layer zero (L0), and every layer above it adds
exactly **one idea** and uses only the layers beneath it.

Two rules hold the stack together.

**Rule 1 — the layers don't mix.** Each layer keeps its data in its own place: animation
always under `animate`, effects under `effects`, editor data under `meta`. So a program
reading the file can take the parts it understands and simply skip the rest.

**Rule 2 — higher layers get translated down into simpler ones, never the other way.** In
the end, a browser can only draw plain SVG. So everything a higher layer describes is, at
some point, converted into the simpler layers below it. This happens at three moments:

- when the **editor saves** a file, it converts its editor-only constructs (L4 — for example
  a star shape preset) into the plain layers below (a path, and its animation);
- when the **player loads** a JSON file, it converts the effects (L3) into plain elements,
  attributes and animation (L0–L2);
- when the **editor exports a pre-rendered SVG**, it converts everything into plain SVG plus
  CSS (L0).

Whichever of these three conversions runs, its output is always written in the simple layers
only.

| Layer | Where its data lives | What it adds | Who reads it |
|---|---|---|---|
| **L0 — plain SVG** | the element object itself: `{type, ...attributes, children}` | the drawing — elements and their SVG attributes, exactly as in any SVG; values are plain strings | the browser |
| **L1 — typed values** | the same SVG attributes as L0 — the layer changes their values, not their place | values become typed instead of strings: numbers (`opacity: 0.5`), arrays (`translate: [96.8, 46.8]`), objects (`transform: { translate, rotate, scale }`). Units are never written — each property has one fixed, implied unit. A value written this way is exactly what a keyframe of L2 holds | the player |
| **L2 — animated attributes** | `node.animate`, one entry per animated attribute name | keyframes for any attribute; the element itself and its place in the tree are untouched — delete every `animate` key and a valid static SVG remains | the player |
| **L3 — player effects** | `node.effects` | effects — short descriptions of masks, gradients, copies and other effects ([see more](#player-effects)), which the player expands into plain elements and attributes when the file loads | the player |
| **L4 — editor meta** | `node.meta` | everything only the editor needs — labels, shape presets, the sources of applied effects; the player ignores this key entirely — [Editor meta and applied effects](#editor-meta-and-applied-effects) | the editor |
| **L5 — pre-rendered SVG** | unlike the layers above, this one is not a part of the JSON document — it is a separate `.svg` file the editor produces on export | the same document, converted into an ordinary SVG file: the animation travels as CSS or a script inside it, and the editor data as `data-px-meta` attributes — [Meta in pre-rendered SVG](../prerendered-svg/data-px-meta.md) | depends on the flavour: a CSS-animation file is played by the browser alone; a JS-animation file is played by the player embedded in it |

## JSON format reference

This page is the reference for the JSON format. It lists every key of the document, with its
type and its meaning. A document is simply **SVG written as JSON, with the animation added
alongside** — if you understand SVG files, you will understand these too. If SVG itself is
new to you, start with an SVG introduction first (for example
[MDN's SVG tutorial](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch)) and come back. Why the
format is shaped this way: [Format principles](#format-principles).

### A complete small document

Everything the format is, in one small document — a ball that drops with an ease-in-out.
The comments mark the two things **added on top of plain SVG** (JSON itself does not allow
comments, so a real file has none):

```js
{
  // The root <svg> element — plain SVG, written as JSON
  "type": "svg",
  "viewBox": "0 0 400 400",

  // ADDED: the playback settings — how long, how many times, what starts it
  "animator": { "timeline": { "type": "clock", "duration": 1000, "iterations": "infinite", "trigger": { "startOn": "load" } } },

  "children": [
    {
      // A plain <ellipse> element with ordinary SVG attributes
      "type": "ellipse",
      "cx": 139, "cy": 163, "rx": 64, "ry": 64,
      "fill": "#007fff85", "stroke": "#003a73",

      // ADDED: the element's animation — keyframes for its transform attribute
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

1. **Every element is a JSON object** — `type` holds the SVG tag name, every other key is an
   SVG attribute, and `children` is an array of the element's child elements, nested the same
   way the tags nest in an SVG file.
2. **Any attribute can be animated by adding keyframes next to it** — they go under the
   element's `animate` key, filed by the attribute's name. The static attribute itself stays
   where it is, so if you remove every `animate`, a valid static SVG remains.
3. **One place for playback settings** — the root `animator` object holds everything about
   how the document plays: duration, loops, what starts it.

### Schema at a glance

The whole format as flattened TypeScript-style typings. A standalone, printable
copy of this section (with examples) lives in [SCHEMA.md](../../SCHEMA.md).

```typescript
// PxAnimatedSvgDocument
// Self-contained document: has children — player renders SVG tree and animates it
// Bind-by-id document: no children — player animates a pre-existing SVG DOM via animator.animateById
interface SVG_JSON {
    type: 'svg';        // document root marker
    id?: string;        // DOM id; in a bind-by-id document it locates the pre-rendered element
    viewBox?: string;   // internal coordinate space, e.g. "0 0 700 380"
    width?: number;     // rendered size; width accepts CSS units
    height?: number;
    [key: string]: any; // any SVG/CSS presentation attribute; pass-through to DOM

    animator?: {
        mode?: 'auto' | 'waapi' | 'frames'; // default 'auto' = WAAPI→RAF fallback; 'waapi' = WAAPI; 'frames' = RAF
        frameRate?: number;                // target fps; RAF mode only (default: uncapped)

        // WHAT ADVANCES THE PLAYHEAD — a discriminated object mirroring WAAPI's
        // DocumentTimeline / ScrollTimeline / ViewTimeline. Timing and the playback
        // dynamics live INSIDE it; each type carries only the fields that mean
        // something for it. Omitting `timeline` entirely means a plain clock.
        timeline?:
            | {
                type: 'clock';                     // wall time — something STARTS it (the trigger)
                duration?: number;                 // length of ONE iteration, ms (default 1000); keyframe times are absolute offsets
                delay?: number;                    // wait before start, ms (default 0); negative = skip ahead, e.g. -500 starts from the 0.5 s frame
                iterations?: number | 'infinite';  // repeat count (default 1); composes with per-property loop (loop-within-loop)
                fill?: 'forwards' | 'backwards' | 'both' | 'none';                      // WAAPI fill; default 'forwards' holds final state
                direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';  // default 'normal'
                trigger?: {
                    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic';
                    outAction?: 'continue' | 'pause' | 'reset' | 'reverse'; // when the trigger condition ends; default 'continue'
                    onFinish?: 'hold' | 'reset';      // after a NATURAL finish; default 'hold' (keep end state per `fill`)
                    scrollIntoViewThreshold?: number; // how much must be on screen to start: 0 = any part (default), 1 = all of it; scrollIntoView only
                };
              }
            | {
                type: 'scroll' | 'view';           // scrubbed: the scroll container's offset ('scroll') or the SVG's
                                                   // journey through the viewport ('view'); no trigger/delay slots exist here
                duration?: number;                 // the keyframe span the scroll range maps onto, ms
                iterations?: number;               // finite only — 'infinite' cannot map onto a range
                engine?: 'custom' | 'native';      // who computes progress: the player (default) or the browser's ScrollTimeline
                axis?: 'block' | 'inline' | 'x' | 'y';
                source?: 'nearest' | 'root';       // type 'scroll' — which scroll container
                subject?: string;                  // type 'view' — whose journey: 'parent' | 'scroller' | a CSS selector
                smoothing?: number;                // ms catch-up lag toward the scroll position
                pin?: boolean | { align?: 'top' | 'center' | 'bottom'; top?: number; distance?: number };
                range?: { start?: { phase?: string; fraction?: number }; end?: { phase?: string; fraction?: number } };
              };

        // named reusable easings and animations; resolved at runtime
        // materialise (inline) all refs before handing to a dumb player
        definitions?: {
            easings?: Record<string, [number, number, number, number]>; // name → [x1,y1,x2,y2]
            animations?: Record<string, Record<string, ANIMATE>>;       // name → { propName: ANIMATE }
            styles?: Record<string, Record<string, string | number>>;   // name → style preset, string|number values only (node.style may reference by name)
            // font-family → embedded glyph outlines, for glyph-mode text
            // (effects.text.useGlyphs) — renders without shipping a font
            glyphs?: Record<string, {
                fontFamily: string;   // e.g. "Roboto"
                fontStyle: string;    // "" | "italic" | …
                ascent: number;       // in unitsPerEm
                unitsPerEm: number;   // e.g. 1000
                glyphs: Record<string, { width: number; d: string }>;  // keyed by the character
            }>;
        };

        debugInstName?: string;  // exposes the animator as window[debugInstName]

        // bind-by-id documents — maps '#elementId' → animation spec. Same value type as
        // `node.animate`; only the KEYSPACE differs (an element reference here, an attr
        // name there). Reference spelling is uniform: every element reference in the
        // format is '#id'-spelled — record keys included.
        animateById?: Record<string,
            | string
            | Array<string>
            | Record<string, ANIMATE>
            | Array<string | Record<string, ANIMATE>>
        >;
    };

    // self-contained documents — SVG element tree; its absence makes the document bind-by-id
    children?: Array<{
        type: string;       // SVG element tag: "rect", "g", "path", "ellipse", "use", …
        id?: string;        // DOM id; required for href="#id" refs or animator.animateById targeting
        [key: string]: any; // SVG/CSS attrs (cx, cy, r, fill, stroke, transform, …); pass-through
        text?: string;      // text content for <text>/<tspan> (alias: textContent)
        style?: string | Record<string, string | number>;
        // named ref / array of refs / inline definition / mixed array
        animate?: string | Array<string> | Record<string, ANIMATE> | Array<string | Record<string, ANIMATE>>;
        // Player-materialised structural effects (transformBy/repeater/maskedBy/
        // strokeTrim/clone/gradient/textPath/text). JSON-only — the
        // Pre-rendered SVG export materialises these in the Editor. See "Player
        // effects" section below.
        effects?: {
            // each part is animatable: raw value | {value} | {keyframes}
            transformBy?:     { translate?: [x,y], rotate?: deg, skew?: deg, scale?: [x,y], origin?: [x,y] };
            repeater?:        { copies?: number, translate?: [x,y], rotate?: deg, scale?: [sx,sy] /*per-copy multiplier, compounds v^i*/, origin?: [x,y] };
            maskedBy?:        { sourceId?: string, maskType?: 'alpha' | 'luminance',
                                maskUnits?, maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox',
                                x?, y?, width?, height?: number };   // mask viewport, user units
            clipPath?:        { d?: "M…" | { value } | { keyframes } };   // ONE animatable slot, like every other effect
            strokeTrim?:        { offset?: number, range?: [a,b], subPaths?: 'separate' | 'combined' };  // offset/range animatable
            clone?:           { type?: 'content', sourceId?: string,
                                retime?: { start?, stretch?: number, timeCrop?: [inMs, outMs] } };  // retime is PURE timing — the ref lives once, on the clone
            // Geometry slots animate like any other slot ({value} | {keyframes});
            // gradient geometry animation runs on the frames engine.
            fillGradient?:    { type: 'linear'|'radial', start?, end? (linear) , center?, radius?, focal? (radial),
                                stops?, gradientUnits?, spreadMethod?, gradientTransform? };
            strokeGradient?:  { /* same shape as fillGradient */ };
            textPath?:        { path: string, pathOverflow?, lengthAdjust?, method?, spacing?, startOffset?, textLength? };
            text?:            { useGlyphs?: boolean };  // render text from embedded glyph outlines (definitions.glyphs)
        };
        meta?: any;         // editor-only (label, shape, …); not rendered, ignored by player
        children?: Array<any>; // recursive; <g>, <defs>, <symbol>, <text>, <use>, …
    }>;
}
```

```typescript
// PxPropertyAnimation — single-property animation
interface ANIMATE {
    keyframes?: Array<{
        time?: number;                        // ms offset from the start of the document timeline
        value?: any;                          // see "Keyframe values" below
        easing?: string | [number, number, number, number]; // named ref or cubic-bezier
        tangentOut?: [number, number];        // motion-path delta tangent at this kf
        tangentIn?:  [number, number];        // motion-path delta tangent at this kf
    }>;
    autoOrient?: boolean;                     // translate-only: rotate element to face the path tangent
    // pre-processes keyframes to fill the timeline duration by repeating a segment
    // true → default: repeat last segment, cycling forward
    // independent of timeline.iterations; composes as loop-within-loop
    loop?: boolean | {
        segmentCount?: number;           // intervals forming the segment; undefined = whole sequence; clamped [1, n-1]
        extend?: 'before' | 'after';     // which END the loop fills: 'after' (default, absent) = idle/outro,
                                         // 'before' = intro
        alternate?: boolean;             // false (default) = cycle same direction; true = pingpong
    };
}
```

### The document root

| Field | Type | Meaning |
|---|---|---|
| `type` | always the string `"svg"` | required — marks the root element of the document |
| `id` | string | the element's identifier — it becomes the DOM id, and other elements and effects reference the element by it ([documents without `children`](#animating-a-pre-rendered-svg) rely on these references) |
| `viewBox` | string | the drawing's coordinate space, exactly as in SVG — e.g. `"0 0 700 380"` means "the drawing spans 700 × 380 units" |
| `width` · `height` | number or string | how big the drawing appears on the page — the same `width` / `height` you would put on an `<svg>` tag. Write a plain number (`400`) for pixels, or a string for anything with a unit: `"32px"`, `"100%"` |
| `animator` | object | the playback settings — duration, loops, trigger, etc — see [Playback settings](../library/playback-and-triggers.md) and [Definitions](#definitions--animatordefinitions) |
| `children` | array of element objects | the nested SVG children tree |
| any SVG attribute | string or number | any other key is passed through to the rendered `<svg>` as an SVG attribute (`fill`, `style`, …) |

### Nodes

Every element of the SVG tree is written as a JSON object, called a **node**. The `type` key
holds the tag name (`"rect"`, `"circle"`, `"path"`, …), the element's SVG attributes are
ordinary keys next to it, and three optional keys can be added: `children` (the element's
child elements), `animate` (its animation) and `effects` (its effects):

```js
// A plain SVG <rect>, written as JSON
{ "type": "rect", "id": "box", "x": 10, "y": 10, "width": 80, "height": 40, "rx": 6, "fill": "#6366f1",
  // ADDED: the rect's animation — keyframes for its opacity
  "animate": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 500, "value": 1 } ] } } }
```

| Field | Meaning |
|---|---|
| `type` | the SVG tag: `rect`, `circle`, `ellipse`, `line`, `path`, `g`, `text`, `tspan`, `use`, `symbol`, `defs`, `image`, `mask`, `clipPath`, `linearGradient`, `radialGradient`, `stop`, `pattern`, `marker`, `filter` and the `fe*` primitives, … |
| `id` | DOM id — required when something references the element (`href="#id"`, `maskedBy`, `animateById` — references are always `#id`-spelled, record keys included). When the player creates the DOM elements, it replaces every id with a fresh one (that is how several copies of one file coexist on a page), so ids need only be unique within the file |
| `children` | nested nodes |
| `animate` | this node's animations — [below](#animating--the-animate-channel) |
| `effects` | this node's effects — [Player effects](#player-effects) |
| `style` | inline style: a string or an object, or the **name** of a preset in `definitions.styles` |
| `textContent` | text content of `<text>` / `<tspan>` |
| `meta` | editor-only data (labels, shape presets, applied effects). Players ignore it, so if the file will only ever be played — never edited in the editor again — this key can be removed — [Editor meta and applied effects](#editor-meta-and-applied-effects) |
| any other key | an SVG attribute |

**Attribute names** may be written as in SVG (`stroke-width`, `font-size`) or camelCase
(`strokeWidth`, `fontSize`); both render to the standard kebab-case attribute. The editor
writes camelCase.

**Static values** are typed: numbers (`opacity: 0.5`), number lists (`strokeDasharray: [16,
16]`), strings (`fill: "#33b366"`, `viewBox`), a transform written as an **object with one key per part** (`transform:
{ translate: [10, 10], rotate: 45 }`) or an SVG transform string. Note that a static
attribute value is written exactly the same way as a keyframe's `value` for that attribute —
learn one way of writing values and you know both.

**Reserved keys** — `type`, `children`, `animator`, `animate`, `effects`, `meta`, `text`,
`textContent` never reach the DOM as attributes: they are instructions for the player, which
turns them into other things — the element itself, its child elements, its text, its
animation.

One name clashes with this rule. A few SVG filter elements (such as `<feTurbulence>`) have an
attribute that is itself called `type` — but in a node, the `type` key is already taken by
the tag name. For these elements, write the attribute under the name **`domType`** instead;
when the player creates the element, it turns `domType` back into a real `type` attribute:

```js
// In SVG this would be:  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" />
{ "type": "feTurbulence", "domType": "fractalNoise", "baseFrequency": 0.05, "numOctaves": 2 }
```

##### Text

Text nodes carry their content in `textContent`, not as children:

```json
{ "type": "text", "x": 20, "y": 40, "fill": "#111", "fontSize": 18, "textContent": "Hello",
  "children": [ { "type": "tspan", "dy": 20, "textContent": "second line" } ] }
```

With `effects.text.useGlyphs: true` the text renders from glyph outlines embedded in
`definitions.glyphs` — no font needed on the viewer's machine (the editor embeds them for you).

### Animating — the `animate` channel

A node animates through its `animate` map — one entry per attribute, each holding that
attribute's keyframes:

```js
// Three attributes of one element, each animated on its own channel
"animate": {
  "opacity":   { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 1 } ] },
  "fill":      { "keyframes": [ { "time": 0, "value": "#3b82f6" }, { "time": 1000, "value": "#ec4899" } ] },
  "transform": { "keyframes": [ { "time": 0, "value": { "rotate": 0 } }, { "time": 1000, "value": { "rotate": 360 } } ] }
}
```

That is the usual form: an object with one entry per animated attribute. There are also
three shorthand forms, all built on **named animations** — animations defined once in
`definitions.animations` ([below](#definitions--animatordefinitions)) and reused by name:

```js
// One named animation, by itself
"animate": "fadeIn"

// Several named animations at once
"animate": ["fadeIn", "spin"]

// Named animations mixed with an ordinary inline one
"animate": ["fadeIn", { "scale": { "keyframes": [ { "time": 0, "value": [1, 1] }, { "time": 1000, "value": [1.5, 1.5] } ] } }]
```

**Any attribute takes one of three forms**, consistently across the format:

```js
{ fill: '#3b82f6' }                              // 1. primitive — static
{ transform: { value: { translate: [10, 10] } } }// 2. {value} — structured static
{ opacity: { keyframes: [ … ] } }                // 3. {keyframes} — animated
```

##### Property animation

| Field | Type | Meaning |
|---|---|---|
| `keyframes` | array | the timeline |
| `value` | same as a keyframe's `value` ([Keyframe values](#keyframe-values)) | optional static baseline (rarely needed — the static attribute on the node is the baseline) |
| `loop` | `true` or object | this one property repeats on its own, independent of the whole document's `iterations` — [Per-property loops](#per-property-loops) |
| `autoOrient` | boolean | translate animations with tangents: rotate the element to face the path — [Motion along a path](#motion-along-a-path) |

##### Keyframes

| Field | Type | Meaning |
|---|---|---|
| `time` | ms | offset from the start of the document timeline |
| `value` | depends on the property — [Keyframe values](#keyframe-values) | the property's value at this time |
| `easing` | `[x1, y1, x2, y2]` or a name | how the value moves **from this keyframe to the next one**: a cubic-bezier curve, or the name of a curve defined in `definitions.easings` |
| `tangentOut` · `tangentIn` | `[dx, dy]` | spatial tangents for motion along a path (translate only), relative to this keyframe's position |

Every key has exactly one spelling — there are no short aliases.

##### Keyframe values

| Property kind | `value` | Example |
|---|---|---|
| a single number (`opacity`, `r`, `strokeWidth`, `rotate`, …) | number | `0.5` |
| a list of numbers (`strokeDasharray`, `scale`, `translate`) | number array | `[80, 40]` |
| colour (`fill`, `stroke`, `stopColor`, …) | CSS colour string (or an RGBA number array) | `"#ec4899"` |
| unified `transform` | an object with one key per transform part — `translate`, `rotate`, `scale`, `skew`, `origin` | `{ "translate": [8, 4], "rotate": 90, "scale": [2, 2] }` |
| path `d` | `{ "path": "M…" }` (a bare `"M…"` string is also accepted) | `{ "path": "M0,0 L50,0 L50,50 Z" }` |
| gradient `stops` (inside gradient effects) | array of `{ offset, color }` — each keyframe's value is the complete stop list, every stop with its position and colour at that moment | `[{ "offset": 0, "color": "#3b82f6" }, { "offset": 1, "color": "#ec4899" }]` |

##### Easing

Easing controls the pace of the change between two keyframes — for example start fast and
slow down towards the end. It is written on the keyframe where the movement begins and
applies to the movement from that keyframe to the next.

Give it a cubic-bezier curve directly:

```json
{ "time": 0, "value": 0, "easing": [0.33, 0, 0.67, 1] }
```

Or give it a name — the named curve must then be defined in `animator.definitions.easings`
of the same document:

```js
// on the keyframe
{ "time": 0, "value": 0, "easing": "smooth" }

// at the document root
"animator": {
  "definitions": { "easings": { "smooth": [0.42, 0, 0.58, 1] } }
}
```

A keyframe with no `easing` gets linear movement: the value changes at a constant, even pace
all the way to the next keyframe.

##### Per-property loops

A property can repeat part of its own keyframes to fill the timeline's `duration`, independently of
the document's `iterations`:

```json
"rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 360 } ], "loop": true }
"scale":  { "keyframes": [ { "time": 0, "value": [1, 1] }, { "time": 500, "value": [1.2, 1.2] }, { "time": 1000, "value": [1, 1] } ],
            "loop": { "segmentCount": 1, "extend": "after", "alternate": true } }
```

| Field | Meaning |
|---|---|
| `segmentCount` | how big the repeated piece is, counted in **intervals** — an interval is the stretch between two neighbouring keyframes. By default the whole sequence repeats; `"segmentCount": 1` repeats only one interval — the last one with `extend: "after"`, the first one with `extend: "before"`. In the example above, `scale` has three keyframes (two intervals), and only its second half — the shrink back from 1.2 to 1 — keeps repeating |
| `extend` | which end of the timeline the repetition fills. `"after"` (default): the animation plays through once, then the **last** intervals repeat until the document's duration is used up — e.g. a character lands and then keeps breathing. `"before"`: the **first** intervals repeat first, and the rest of the keyframes play at the end — e.g. a logo pulses for a while and then settles |
| `alternate` | `false` (default) replays in the same direction; `true` ping-pongs |

`loop: true` = repeat the whole sequence, after, forward.

### Transforms

Animate every part together as **one** `transform` property. Each keyframe's value is an
object holding all the parts — `translate`, `rotate`, `scale` — side by side:

```js
// One transform property; every keyframe carries all the parts together
"animate": { "transform": { "keyframes": [
  { "time": 0,    "value": { "translate": [0, 0],   "rotate": 0,  "scale": [1, 1] } },
  { "time": 1000, "value": { "translate": [80, 40], "rotate": 90, "scale": [1.5, 1.5] } }
] } }
```

| Part | Type | Notes |
|---|---|---|
| `translate` | `[x, y]` | how far to move along x and y — plain numbers in the drawing's coordinates (the `viewBox` space) |
| `rotate` | number | degrees |
| `skew` | number | skewX degrees, composed between rotate and scale |
| `scale` | `[sx, sy]` | multipliers: `1` = unchanged, `2` = double size, `0.5` = half |
| `origin` | `[x, y]` | pivot for rotate / skew / scale — only meaningful alongside one of them |

The parts are applied in this order: `translate · +origin · rotate · skewX · scale · −origin`.

The same kind of object is also the preferred way to write a **static** `transform`
attribute (`"transform": { "translate": [100, 100], "rotate": 45 }`); an ordinary SVG
transform string is accepted too. Each part can also be animated as its own channel
(`animate: { translate, rotate, scale }`).

An animated `transform` writes the element's one `transform` attribute, so it overwrites a
static `transform` on the same element — put a fixed placement on a wrapping `<g>` instead.
And since all parts share one set of keyframes, they run on one schedule; to give each part
its own timing, use the [`transformBy` effect](#8--transformby).

The per-key form (`animate: { translate, rotate, scale }` — used in the examples below) is also accepted; both produce the same composed `transform` string at render. A static `transform` attribute **composes under** the animated transform (CSS's own precedence, applied at read): partial keyframe parts inherit the static parts they don't set, and a single per-key channel next to a static transform keeps that static — `transform: {rotate: 45}` + an animated `translate` slides the element *while it stays rotated*. The one remaining last-write-wins case: several per-key channels animated at once on one node — compose those by nesting `<g>`s instead.

### Motion along a path

Translate keyframes can carry Bézier tangents; the element then moves along the curve, and
`autoOrient` turns it to face the direction of travel:

```js
"animate": { "transform": {
  // The element turns to face its direction of travel
  "autoOrient": true,
  "keyframes": [
    // The tangents bend the straight line between the keyframes into a curve
    { "time": 0,    "value": { "translate": [30, 150] },  "tangentOut": [46, -80] },
    { "time": 3000, "value": { "translate": [270, 150] }, "tangentIn":  [-46, -80] }
  ]
} }
```

The tangents are the Bézier control points of the curve, written relative to their keyframe's
own position (like the handles of a pen tool).

### Shape morphing — animating a `<path>`'s outline

A path's shape is its `d` attribute — a string of drawing commands. Animate `d` and the
shape morphs from one form to the next. One rule: every keyframe's path must have the
**same number of points** (in the example below, both shapes have four). Paths drawn in the
editor get this right automatically:

```js
{ "type": "path", "fill": "#f59e0b", "d": "M-50,0 L0,-50 L50,0 L0,50 Z",
  // The diamond morphs into a square — both shapes have four points
  "animate": { "d": { "keyframes": [
    { "time": 0,    "value": { "path": "M-50,0 L0,-50 L50,0 L0,50 Z" } },
    { "time": 2000, "value": { "path": "M-50,-50 L50,-50 L50,50 L-50,50 Z" } }
  ] } } }
```

Morphing runs on the frame-loop engine (the `auto` mode switches automatically).

### Definitions — `animator.definitions`

`animator.definitions` is where things are **defined once, under a name, and used in many
places by that name** — instead of repeating the same easing curve or the same animation on
every element that needs it:

```json
"definitions": {
  "easings":    { "smooth": [0.42, 0, 0.58, 1] },
  "animations": { "fadeIn": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 2000, "value": 1 } ] } } },
  "styles":     { "label": { "fontFamily": "Inter", "fontSize": 12 } },
  "glyphs":     { "Roboto": { "fontFamily": "Roboto", "fontStyle": "", "ascent": 928, "unitsPerEm": 1000,
                              "glyphs": { "H": { "width": 722, "d": "M100 0V722H190V400H532V722H622V0H532V320H190V0Z" } } } }
}
```

| Field | What it holds | How an element uses it |
|---|---|---|
| `easings` | named easing curves | a keyframe writes the name instead of the curve: `"easing": "smooth"` |
| `animations` | named animations | a node writes the name instead of the keyframes: `"animate": "fadeIn"` (documents without `children` use the same names in `animateById`) |
| `styles` | named sets of style attributes | a node writes the name instead of the attributes: `"style": "label"` |
| `glyphs` | letter outlines: for each font, the shape of every letter used, stored under that font's name (`"Roboto": …` in the example above) | a `<text>` node with `effects.text.useGlyphs: true` is drawn from these outlines — the node's `font-family` says which font's outlines to use. No font file is needed on the viewer's machine |

### Animating a pre-rendered SVG

When the editor saves a **pre-rendered *SVG + JS animation*** file, it puts two things into
that one `.svg` file:

- the **markup** — the elements, as ordinary SVG, each with an id;
- a shortened **JSON document** inside the file's `<script>`, which carries only the
  animations and links them to the markup through those ids.

This section is about that shortened JSON document. It looks like a normal document, with one
difference: it has no `children` — the elements already exist as markup, so instead of
carrying them again, it lists its animations in `animator.animateById`, keyed by the
`#id` of the element each one animates. You will normally never write such a document
yourself; the editor generates it.

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

createAnimator({ container: '#box', data: {   // an empty <div id="box"> on the page
  type: 'svg', id: '_px_root',
  animator: {
    timeline: { type: 'clock', duration: 2000 },
    definitions: { animations: { fadeIn: { opacity: { keyframes: [ { time: 0, value: 0 }, { time: 2000, value: 1 } ] } } } },
    animateById: {
      '#_px_rect':    'fadeIn',                                  // one named animation
      '#_px_ellipse': ['fadeIn', { fill: { keyframes: [ { time: 0, value: '#0087ff' }, { time: 2000, value: '#ff3b30' } ] } }],  // several, mixed
    },
  },
} });
```

`animateById` values have exactly the same shape as a node's `animate`; only the key differs
(element reference here, attribute name there).

**Reference spelling — one rule, everywhere:** every element reference is `#id`-spelled —
`href`, `partOf`, every `sourceId`, and record keys like `animateById`'s alike.

### Units of the values in a document

Every number in a document — a keyframe's `time`, a `duration`, a coordinate, an angle — is
written as a plain number, never with a unit after it (no `"500ms"`, no `"45deg"`). Instead,
each property has one fixed unit that is always understood:

| Value | Unit |
|---|---|
| time (`time`, `timeline.duration`, `timeline.delay`, `retime.start`) | milliseconds |
| lengths, coordinates, `fontSize` in px | plain numbers in the drawing's coordinates (the `viewBox` space) — no unit is written |
| `rotate`, `skew`, angles | degrees |
| `opacity`, trim `range` / `offset`, stop `offset`, `scrollIntoViewThreshold` | a share of the whole, from `0` (none) to `1` (all) |
| every `scale` | a multiplier: `1` = unchanged, `2` = double, `0.5` = half |
| `retime.stretch` | a multiplier of duration: `2` = twice as long (half speed), `0.5` = half as long (double speed) |
| `frameRate` | frames per second |
| easing | cubic-bezier `[x1, y1, x2, y2]` |

## Player effects

An **effect** is a shortcut. Everything an effect does could be written out by hand with
plain elements and attributes — a mask as a `<mask>` element, five copies of a shape as five
elements — but that means a lot of repeated markup. An effect says the same thing in one
short declaration on the element: *"mask me with that circle"*, *"repeat me five times, each
copy 80 further right"*. When a JSON document loads, the player expands each effect into the
plain elements and attributes it stands for. (This applies to JSON only — in a pre-rendered
SVG export the editor has already done the expanding.)

```js
// A plain SVG <rect> with ordinary attributes
{ "type": "rect", "x": 0, "y": 0, "width": 40, "height": 40, "fill": "#3b82f6",
  // ADDED: two effects — the player turns them into real elements when the file loads
  "effects": {
    "transformBy": { "translate": [50, 50], "rotate": 30 },
    "repeater":    { "copies": 5, "translate": [80, 0], "rotate": 15 }
  } }
```

**Effect attribute values — static or animated.** Many of an effect's attributes can be
animated, just like an element's attributes. In the tables below their type is written as a
union, e.g. `number | Animated<number>` — the attribute accepts either form:

- a static value — `"rotate": 30` (also accepted wrapped in an object: `"rotate": { "value": 30 }`)
- an `Animated<…>` value — keyframes written exactly like in an element's `animate`:
  `"rotate": { "keyframes": [ … ] }`, optionally with `"loop"`

When an element has several effects, the player applies them in a fixed order — the
**Applied** column below. How you order the keys inside `effects` makes no difference:

| Applied | Effect | What it does |
|---|---|---|
| 1 | [`text`](#1--text) | glyph-outline text rendering |
| 2 | [`textPath`](#2--textpath) | text along a path |
| 3 | [`fillGradient` / `strokeGradient`](#3--fillgradient--strokegradient) | gradient paint with animatable stops and geometry |
| 4 | [`strokeTrim`](#4--stroketrim) | reveal or hide a stroke progressively along its path |
| 5 | [`repeater`](#5--repeater) | N copies, each stepped by a delta |
| 6 | [`maskedBy`](#6--maskedby) | mask by another element |
| 7 | [`clipPath`](#7--clippath) | clip to a (possibly animated) path |
| 8 | [`transformBy`](#8--transformby) | per-part transforms with independent timing |
| 9 | [`clone`](#9--clone) | `<use>` semantics: what it copies, and re-timing |

For example, `repeater` + `transformBy` on one element always means "repeat, then transform
the whole row", because `repeater` (5) is applied before `transformBy` (8). For "transform
each copy, then repeat", put the `transformBy` on a child and the `repeater` on the parent
group.

### 1 — `text`

Draws a `<text>` element from letter outlines stored in the document itself
(`definitions.glyphs`) instead of using a font: the text looks identical on every machine,
and no font file needs to be installed or loaded.

| Field | Type | Meaning |
|---|---|---|
| `useGlyphs` | boolean | render the text from the glyph outlines in `definitions.glyphs` — self-contained, identical on every machine, no font loading |

```js
{
  "type": "svg",
  "viewBox": "0 0 400 100",
  "animator": {
    "timeline": { "type": "clock", "duration": 1000 },
    "definitions": {
      // The outlines the text is drawn from — one entry per letter used
      // (paths shortened here; the editor writes the real ones)
      "glyphs": {
        "Roboto": { "fontFamily": "Roboto", "fontStyle": "", "ascent": 928, "unitsPerEm": 1000,
                    "glyphs": { "H": { "width": 722, "d": "M…" }, "e": { "width": 556, "d": "M…" },
                                "l": { "width": 222, "d": "M…" }, "o": { "width": 556, "d": "M…" } } }
      }
    }
  },
  "children": [
    { "type": "text", "x": 20, "y": 60, "fontFamily": "Roboto", "fontSize": 32, "textContent": "Hello",
      // Draw "Hello" from the embedded Roboto outlines instead of loading the font
      "effects": { "text": { "useGlyphs": true } } }
  ]
}
```

The editor embeds the used glyphs when you switch a text to glyph mode. Combined with
`textPath`, the glyphs are laid along the path directly.

### 2 — `textPath`

Put this on a `<text>` element to lay its text along a curved path — and, if you want, to
move the text along that path over time.

The text is rendered one of two ways — as **browser text** (a native SVG `<textPath>`, using
a font), or as **glyph text** (from embedded outlines, when the element also has
`effects.text.useGlyphs: true`). Not every field applies to both; the **Applies to** column
says which:

| Field | Type | Meaning | Applies to |
|---|---|---|---|
| `path` | path string | the path geometry (inline — no separate element needed) | browser text, glyphs |
| `startOffset` | number \| `Animated<number>` | where the text starts along the path ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/startOffset)) | browser text, glyphs |
| `textLength` | number \| `Animated<number>` | stretch / squeeze the text to this length ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/textLength)) | browser text, glyphs |
| `lengthAdjust` | `spacing` · `spacingAndGlyphs` | how `textLength` is reached: by changing the space between glyphs only, or by stretching the glyphs too ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/lengthAdjust)) | browser text only |
| `method` | `align` · `stretch` | each glyph is rotated to sit on the path, or the glyphs themselves are bent to follow its curve ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/method)) | browser text only |
| `spacing` | `auto` · `exact` | `exact` places glyphs strictly by the SVG layout rules; `auto` lets the renderer adjust the spacing to look better on curves ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/spacing)) | browser text only |
| `pathOverflow` | `extend` (default) · `clip` | glyphs past the end of an open path continue along the tangent, or disappear | browser text, glyphs |

```js
{ "type": "text", "fill": "#111", "fontSize": 18,
  // Lay the text along the curve, and slide it 260 units along the path over 2 s
  "effects": { "textPath": {
    "path": "M20,100 Q150,20 280,100",
    "startOffset": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 2000, "value": 260 } ] }
  } },
  "children": [ { "type": "tspan", "textContent": "animated text on a path" } ] }
```

### 3 — `fillGradient` / `strokeGradient`

Paints the element's fill (or its stroke) with a colour gradient, and lets the gradient's
colours and geometry animate. Under the hood it generates a `<linearGradient>` /
`<radialGradient>` element and points the `fill` (or `stroke`) at it. Both effects have the
same settings; the only difference is which of the two attributes is painted.

| Field | Type | Meaning |
|---|---|---|
| `type` | `linear` · `radial` | a gradient along a line from `start` to `end`, or one spreading out from a `center` |
| `start` · `end` | `[x, y]` \| `Animated<[x, y]>` | the line the linear gradient runs along — SVG's `x1`/`y1`/`x2`/`y2` ([SVG `<linearGradient>` spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/linearGradient)) |
| `center` · `radius` · `focal` | `[x, y]` \| `Animated<[x, y]>` · number \| `Animated<number>` · `[x, y]` \| `Animated<[x, y]>` | the radial gradient's centre, radius and focal point — SVG's `cx`/`cy`, `r`, `fx`/`fy` ([SVG `<radialGradient>` spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/radialGradient)) |
| `stops` | array of `{ offset, color }` \| `Animated<array of { offset, color }>` | the gradient's colour stops — each becomes an SVG [`<stop>` element](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/stop). When animated, each keyframe's value is the complete stop list — every stop with its position and colour at that moment — and every keyframe must have the same number of stops |
| `gradientUnits` | `objectBoundingBox` · `userSpaceOnUse` | which coordinates `start`, `end`, `center`, `radius`, `focal` are in: positions across the element's own box (`0` = its left / top edge, `1` = its right / bottom edge), or the drawing's own coordinates ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/gradientUnits)) |
| `spreadMethod` | `pad` · `reflect` · `repeat` | what to paint beyond the last stop: extend the end colour, mirror the gradient back, or start it over ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/spreadMethod)) |
| `gradientTransform` | string | static only ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/gradientTransform)) |

```js
{ "type": "rect", "x": 0, "y": 0, "width": 200, "height": 120,
  // A horizontal gradient; its two colours cross-fade to new ones over one second
  "effects": { "fillGradient": {
    "type": "linear", "start": [0, 0], "end": [200, 0],
    "stops": { "keyframes": [
      { "time": 0,    "value": [ { "offset": 0, "color": "#3b82f6" }, { "offset": 1, "color": "#ec4899" } ] },
      { "time": 1000, "value": [ { "offset": 0, "color": "#10b981" }, { "offset": 1, "color": "#f59e0b" } ] }
    ] }
  } } }
```

Animated stop **colours** work everywhere; animated stop *offsets* and geometry need the frame
loop (`mode: auto` switches for you). CSS exports can animate stop colours only.

### 4 — `strokeTrim`

Shows only a part of the **stroke** along the path — a line that draws itself, or erases itself. Works
by generating `stroke-dasharray` / `stroke-dashoffset`; the path geometry and fill are
untouched (unlike Lottie's *trim paths*, which cut the shape itself).

| Field | Type | Meaning |
|---|---|---|
| `range` | `[start, end]` \| `Animated<[start, end]>` | which part of the stroke is visible, as two positions along the path: `0` is the start of the path, `1` its end — `[0, 0.5]` shows the first half |
| `offset` | number \| `Animated<number>` | slides that visible part along the path, as a share of its length: `0.25` moves it a quarter of the way |
| `subPaths` | `separate` (default) · `combined` | what those positions are measured against: each sub-path against its own length, or all sub-paths chained into one so the visible part slides across them |

```js
{ "type": "path", "d": "M 30 360 C 130 290 230 420 330 350", "stroke": "#ef4444", "strokeWidth": 3, "fill": "none",
  // The stroke draws itself: the visible part grows from nothing to the full length in 2 s
  "effects": { "strokeTrim": { "range": { "keyframes": [ { "time": 0, "value": [0, 0] }, { "time": 2000, "value": [0, 1] } ] } } } }
```

The trim can also be put on a group. Then it applies to every path inside the group, and
`subPaths` decides how:

- `"separate"` — every path inside is trimmed on its own, each against its own length;
- `"combined"` — all the paths are chained into one long line, and the visible part slides
  across them as a whole.

### 5 — `repeater`

Repeats the element: the player creates `copies` real copies, each one shifted, rotated or
scaled a step further than the one before — like rubber-stamping a shape across the page.
If the element is animated, every copy carries the same animation.

| Field | Type | Meaning |
|---|---|---|
| `copies` | number | static — the count cannot animate |
| `translate` | `[x, y]` \| `Animated<[x, y]>` | per-copy step |
| `rotate` | number \| `Animated<number>` | per-copy degrees |
| `skew` | number \| `Animated<number>` | per-copy skewX degrees |
| `scale` | `[sx, sy]` \| `Animated<[sx, sy]>` | per-copy multiplier (`0.85` = each copy 85 % of the previous) |
| `origin` | `[x, y]` \| `Animated<[x, y]>` | pivot for the per-copy rotate / scale |

```js
{ "type": "rect", "x": 0, "y": 0, "width": 30, "height": 30, "fill": "#6366f1",
  "animate": { "opacity": { "keyframes": [ { "time": 0, "value": 1 }, { "time": 1000, "value": 0.2 } ] } },
  // Four copies, each 50 further right; the per-copy rotation step grows from 0° to 20°
  "effects": { "repeater": { "copies": 4, "translate": [50, 0], "rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 20 } ] } } } }
```

### 6 — `maskedBy`

Shows this element only where another element is: that other element becomes the mask.
Under the hood the player builds a `<mask>` from it and applies it to this element.

| Field | Type | Meaning |
|---|---|---|
| `sourceId` | `"#id"` | the element that becomes the mask |
| `maskType` | `alpha` · `luminance` | how the source's pixels become mask values ([CSS spec](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-type)) |
| `maskUnits` · `maskContentUnits` | `userSpaceOnUse` · `objectBoundingBox` | SVG's mask coordinate systems ([SVG spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/maskUnits), [maskContentUnits](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/maskContentUnits)) |
| `x` · `y` · `width` · `height` | numbers | the area the mask covers, in user units; leave all four out for SVG's default (`-10%,-10%,120%,120%` — [SVG `<mask>` spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/mask)). A `0` is a real value, not "absent" |

```js
// The element that will become the mask — a growing circle
{ "type": "defs", "children": [ { "type": "circle", "id": "spot", "cx": 100, "cy": 100, "r": 80, "fill": "#fff",
    "animate": { "r": { "keyframes": [ { "time": 0, "value": 20 }, { "time": 1000, "value": 120 } ] } } } ] },
// The element being masked
{ "type": "rect", "x": 0, "y": 0, "width": 200, "height": 200, "fill": "#ec4899",
  // Use the circle as this rect's mask: the rect shows only where the circle is
  "effects": { "maskedBy": { "sourceId": "#spot", "maskType": "alpha" } } }
```

### 7 — `clipPath`

Clips the element by the given path — which can be animated. It simply creates a usual
[`<clipPath>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/clipPath)
for this element and links the two.

| Field | Type | Meaning |
|---|---|---|
| `d` | path string \| `Animated<path string>` | static `"M…"`, or `{ "keyframes": [ { "time", "value": { "path": "M…" } } ] }` |

```js
// The visible area widens from a narrow strip to the full 200 × 200 square
"effects": { "clipPath": { "d": { "keyframes": [
  { "time": 0,    "value": { "path": "M0,0 L20,0 L20,200 L0,200 Z" } },
  { "time": 1000, "value": { "path": "M0,0 L200,0 L200,200 L0,200 Z" } }
] } } }
```

### 8 — `transformBy`

Lets each part of a transform — translate, rotate, scale, skew — animate on its **own
schedule**, with its own keyframe times and easing. A plain `transform` animation cannot do
that: all its parts share one set of keyframes. Under the hood, the effect wraps the element
in one group per part, and each group animates independently.

| Field | Type | Meaning |
|---|---|---|
| `translate` | `[x, y]` \| `Animated<[x, y]>` | how far to move along x and y — plain numbers in the drawing's coordinates |
| `rotate` | number \| `Animated<number>` | degrees |
| `skew` | number \| `Animated<number>` | skewX degrees |
| `scale` | `[sx, sy]` \| `Animated<[sx, sy]>` | multipliers: `1` = unchanged, `2` = double size, `0.5` = half |
| `origin` | `[x, y]` \| `Animated<[x, y]>` | pivot |

```js
// Two parts on their own timelines: move during the first half second, then spin during the next
"effects": { "transformBy": {
  "translate": { "keyframes": [ { "time": 0,   "value": [0, 0] },   { "time": 500,  "value": [200, 0] } ] },
  "rotate":    { "keyframes": [ { "time": 500, "value": 0 },        { "time": 1000, "value": 360 } ] }
} }
```

### 9 — `clone`

Shows copies of one animated element at several places — like a rubber stamp: draw a wheel
once, stamp it three times, and each copy can play on its own schedule. The copies are
ordinary SVG [`<use>`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/use)
elements; the effect on each `<use>` says what it copies (`sourceId`) and, optionally,
re-times that copy's animation (`retime` — start later, play slower, show only for a while).
It is an effect, rather than a plain `<use>`, because those things need real copies: the
player materialises each clone into its own elements with its own timing.

| Field | Type | Meaning |
|---|---|---|
| `sourceId` | `"#id"` | the source element / symbol (the `<use>` also keeps its normal `href`) |
| `type` | `content` (optional) | leave the field out for a direct copy of the whole element; `content` copies the source's content but not its own outer position |
| `retime.start` | ms | shift the source's internal timeline |
| `retime.stretch` | a multiplier of duration | `2` = twice as long (half speed), `0.5` = half as long (double speed) |
| `retime.timeCrop` | `[inMs, outMs]` | show the instance only between these two times of the document timeline (materialised as a wrapping `<g>` with an opacity gate) |

```js
// The source: a spinning-wheel symbol with its own one-second animation
{ "type": "defs", "children": [ { "type": "symbol", "id": "wheel", "viewBox": "0 0 100 100", "children": [
    { "type": "circle", "cx": 50, "cy": 50, "r": 40, "fill": "none", "stroke": "#0087ff", "stroke-width": 8, "stroke-dasharray": "40 20",
      "animate": { "rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 360 } ] } } }
] } ] },
// An exact copy of the wheel
{ "type": "use", "href": "#wheel", "x": 0,   "y": 0, "effects": { "clone": { "sourceId": "#wheel" } } },
// A copy that starts 0.5 s later and spins at half speed
{ "type": "use", "href": "#wheel", "x": 120, "y": 0, "effects": { "clone": { "sourceId": "#wheel", "retime": { "start": 500, "stretch": 2 } } } },
// A copy shown only between 1 s and 2 s of the document timeline
{ "type": "use", "href": "#wheel", "x": 240, "y": 0, "effects": { "clone": { "sourceId": "#wheel", "retime": { "timeCrop": [1000, 2000] } } } }
```

Symbols with their own animation length are how the editor builds reusable animated components;
instances re-time them freely.

## Editor meta and applied effects

The **editor app** writes its own information into a dedicated field that every **node** can
carry, called **`meta`**. It holds things like element labels, shape presets, and the
settings of applied effects.
**Players never read this field**: a file with no `meta` at all plays exactly the same. This
page explains what the editor puts there and why, so you can make sense of a `meta` block you
find in a file — or know what you can safely leave out when writing a file by hand.

### Where it lives

Every node may carry a `meta` object. In the JSON format it sits on the node as `node.meta`;
in a pre-rendered SVG the same object is written into a per-element `data-px-meta` attribute
([Meta in pre-rendered SVG](../prerendered-svg/data-px-meta.md)). One read pipeline handles both.

```js
// A plain SVG path — this is what every player draws
{ "type": "path", "id": "star", "d": "M50,122L78,172.4L22,172.4L50,122z",
  // ADDED: editor-only data — players skip `meta` entirely
  "meta": { "label": "Triangle", "appliedEffects": { "shape": { "preset": { "type": "polygon", "points": 3, "radius": 30 } } } } }
```

### The fields

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

### Applied effects

Sometimes the editor **materialises** an effect: it writes the effect's finished result
straight into the node's ordinary attributes — a star preset becomes path data, rounded
corners become the rounded path. The drawing still looks right, but the effect itself is no
longer in it. To keep the file editable, the editor saves the effect's settings in
`meta.appliedEffects`: a record of what was applied.

As a result, an effect description can sit in one of two places, and the place says what it
means:

| | Meaning | Which effects can appear |
|---|---|---|
| `node.effects` | **apply these.** The player reads this when the document loads and applies the effects — [Player effects](#player-effects) | the player effects: `text`, `textPath`, `fillGradient`, `strokeGradient`, `strokeTrim`, `repeater`, `maskedBy`, `clipPath`, `transformBy`, `clone` |
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

Some effects expand one drawn element into SEVERAL written elements — that expansion exists only in pre-rendered SVG files and is documented there: [Expanded parts — host / core / part](../prerendered-svg/data-px-meta.md#applied-effects-that-create-derived-elements-host--core--part).

## Core library — `@pixodesk/svg-animator-core`

Use the core when you need to validate, transform or sample a document **without rendering
it** — in a build step, a test, a server, or a tool of your own. It is the platform-neutral
heart of every player: the document schema, the effect materialisers, the interpolation engine
and the path sampler, with **no DOM dependency**. It is also what makes the web player and the
React Native player produce identical values from the same document.

### Do I need it?

Usually **no** — install a [player](../library/installation.md) instead; each depends on the core and
re-exports what you need. Install the core directly when you work with **documents rather
than playback**: validating them, transforming them, flattening them for a renderer of your
own, or computing values at a given time without rendering anything.

```bash
npm install @pixodesk/svg-animator-core
```

### Validating a document

Validate a document before it reaches a player — in a build step, a test, or a tool that
accepts files from users:

```ts
import { isPxElementFileFormat, isPxElementFileFormatDeep,
         PxAnimatedSvgDocumentSchema, type PxValidationContext } from '@pixodesk/svg-animator-core';
import { readFile } from 'node:fs/promises';

const json = JSON.parse(await readFile('animation.json', 'utf8'));   // Node — or fetch() in a browser

isPxElementFileFormat(json);        // cheap shallow gate — is this a Pixodesk document at all?
isPxElementFileFormatDeep(json);    // { valid, errors } — full schema

// per-field diagnostics
const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
if (!PxAnimatedSvgDocumentSchema.isValid(json, ctx, [])) console.error(ctx.errors);
// → ["children[0].effects.strokeTrim.range: no union member matched for value 5"]
```

| Mode | Question it answers | Unknown keys |
|---|---|---|
| default | *is this document usable?* — what the players accept | ignored (forward-compatible) |
| `strict: true` | *is this document exactly well-formed?* | reported as errors |

Use the default in production readers and `strict` in tests and tooling.
`validateNodeEffects(doc)` checks just the `effects` buckets and returns warning strings.

### Flattening a document

`materialiseAllInTree(doc, engine)` turns a document into a flat tree any renderer can walk:

1. **Effects** — every `node.effects` becomes real nodes, wrappers and defs.
2. **Loops** — each property's `loop` is expanded into explicit keyframes.
3. **Motion paths** — tangented `transform` keyframes and `autoOrient` are sampled into plain
   `{ translate, rotate }` keyframes.
4. **Animated `<use>`** — replaced by a `<g>` with a deep clone and fresh ids.

Steps 3–4 run when `engine` is `waapi`. Pass `waapi` for **any renderer without live `<use>`
propagation** (including `react-native-svg`); `frames` only for the DOM, which resolves `<use>`
natively.

```ts
import { materialiseAllInTree, generateNewIds, calcAnimationValues,
         getNormalisedBindings, PxAnimatorEngine } from '@pixodesk/svg-animator-core';
import doc from './bouncing-ball.json';

const flat = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.waapi));

// values at any time, no renderer involved
for (const binding of getNormalisedBindings(flat, PxAnimatorEngine.frames) ?? []) {
  const values = calcAnimationValues(binding.animate, 500);   // t = 500 ms
  console.log(binding.id, values);   // → ball { transform: 'translate(200,129.65)' }   (the bouncing ball, half-way down)
}
```

This is exactly how the React Native player precomputes its tracks and how the web frame loop
renders each tick.

### Writing your own player

Implement `PxPlatformAdapter` and hand it to `createBasicFrameLoopAnimator`; the engine
handles timing, delay, direction, iterations, fill, playback rate and the lifecycle callbacks,
then calls you with plain attribute writes:

```ts
import { createBasicFrameLoopAnimator, materialiseAllInTree, generateNewIds,
         PxAnimatorEngine, type PxPlatformAdapter } from '@pixodesk/svg-animator-core';
import doc from './bouncing-ball.json';

const flatDoc = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.frames));

const adapter: PxPlatformAdapter = {
  isConnected: () => true,
  setAttribute: (id, attrName, value) => { /* apply to your element */ },
};

const api = createBasicFrameLoopAnimator(flatDoc, adapter, { onFinish: () => console.log('done') });
api.play();
```

Frame scheduling uses `requestAnimationFrame` when it exists and falls back to `setTimeout`, so
the engine runs in browsers, React Native and test environments.

### Exports

| Area | Exports |
|---|---|
| **Schema & types** | `PxAnimatedSvgDocumentSchema`, `PxNodeSchema`, `PxEffectsSchema`, `PxAnimatorConfigSchema`, `PxKeyframeSchema`, … plus every `Px*` TypeScript type and the `px` schema builder |
| **Validation** | `isPxElementFileFormat`, `isPxElementFileFormatDeep`, `validateNodeEffects` |
| **Materialisers** | `materialiseAllInTree`, `applyPlayerEffects`, `materialiseInternalLoopsInTree`, `materialiseMotionPathsInTree`, `materialiseAnimatedUseInstances` |
| **Interpolation** | `calcAnimationValues`, `interpolateValue`, `getNormalisedBindings` |
| **Sampling / geometry** | `createPathSampler`, `evaluateMotionPathSegment`, Bézier helpers, `cubicBezier`, `splitEasing` |
| **Text** | `materialiseGlyphText`, `layoutGlyphTextChars`, `extendedPathForBrowser` |
| **Node helpers** | `getNormalizedProps`, `sanitiseAttributeValue`, `resolveStyle`, `generateNewIds`, `deepClone` |
| **Document accessors** | `getAnimatorConfig`, `getDefs`, `getBindings`, `getChildren` |
| **Scroll timeline math** | `isScrollTimeline`, `scrollViewProgress`, `scrollOffsetProgress`, `scrollTotalDurationMs` |
| **Playback engine** | `createBasicFrameLoopAnimator` + the `PxPlatformAdapter` interface |
| **Wire enums** | `PxAnimatorMode`, `PxAnimatorEngine`, `PxLoopExtend`, `PxStrokeTrimSubPaths`, `PxMaskType`, `PxCloneType`, `PxUnits`, `PxGradientType`, `PxGradientUnits`, `PxGradientSpreadMethod`, `PxPathOverflow`, `PxLengthAdjust`, `PxTextPathMethod`, `PxTextPathSpacing` — every wire selector is a named constant, not a bare string |

### Versioning

Every package is released in lockstep; a player depends on the matching core version, so
upgrading a player upgrades the core with it.

[Contents](../README.md) · [Library documentation](../library/README.md) · [Pre-rendered SVG documentation](../prerendered-svg/README.md)
