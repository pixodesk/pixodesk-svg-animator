# Pixodesk SVG Animator — JSON format, the compact schema

The whole wire format as flattened TypeScript-style typings with comments, plus
minimal examples. For prose, guides and the pre-rendered SVG flavors see
[README.md](./README.md) and [docs](./README.md#documentation).

One root type serves two modes:

- **Self-contained document** — `children` present: the player renders the element tree and animates it.
- **Bind-by-id document** — no `children`: the player animates a pre-existing SVG DOM via `animator.bindings`.

**Attribute names are the camelCase DOM names**, as React spells them — `strokeWidth`,
`fontSize`, `viewBox` (the SVG kebab spelling is accepted too; the DOM gets the standard
attribute either way). `style` keys are camelCase CSS property names, as in React's `style` prop
(`whiteSpace`, `pointerEvents`).

**One rule for every attribute**, everywhere in the format — a primitive, a `{value}`
wrapper, or `{keyframes}`:

```js
{ fill: '#3b82f6' }                               // 1. primitive — static
{ transform: { value: { translate: [10, 10] } } } // 2. {value} — structured static
{ opacity: { keyframes: [ … ] } }                 // 3. {keyframes} — animated (under `animate`)
```

## The smallest document that animates

```json
{
  "type": "svg", "viewBox": "0 0 100 100",
  "children": [
    { "type": "circle", "cx": 50, "cy": 50, "r": 20, "fill": "#3b82f6",
      "animate": { "opacity": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 1 } ] } } }
  ]
}
```

Everything not written here is a default: the timeline is time-driven (no `type`
needed), one iteration of 1000 ms, **starting on load** and holding the final state.
To have your own code start it instead, say `"trigger": { "startOn": "programmatic" }`.

## The document

<!-- px-check schema-block SVG_JSON=PxAnimatedSvgDocumentSchema NODE=PxNodeSchema ANIMATE=PxPropertyAnimationSchema EFFECTS=PxEffectsSchema GRADIENT=PxFillGradientEffectSchema -->
```typescript
// PxAnimatedSvgDocument — the root <svg> is a NODE too (every node key applies), plus:
interface SVG_JSON extends NODE {
    type: 'svg';        // document root marker
    id?: string;        // DOM id; in a bind-by-id document it locates the pre-rendered element
    viewBox?: string;   // internal coordinate space, e.g. "0 0 700 380"
    width?: number | string;  // rendered size; a string may carry CSS units, e.g. "100%"
    height?: number | string;
    [camelCaseDomKey: string]: any; // any SVG attribute under its camelCase DOM name (viewBox, strokeWidth, …), as React spells it; pass-through to DOM

    animator?: {
        // WHAT ADVANCES THE PLAYHEAD — a discriminated object mirroring WAAPI's
        // DocumentTimeline / ScrollTimeline / ViewTimeline. Timing and the playback
        // dynamics live INSIDE it; each type carries only the fields that mean
        // something for it. `type` is optional: absent = 'time' (the wall clock), so
        // the common case declares nothing. Omitting `timeline` entirely = all defaults.
        timeline?:
            | {
                type?: 'time';                     // wall time — something STARTS it (the trigger); optional, the default
                engine?: 'auto' | 'native' | 'js';  // WHO RUNS IT (default 'auto'): the browser where it can — WAAPI here,
                                                   // its ScrollTimeline for scroll/view — else the player's own frame loop;
                                                   // 'native' = browser only; 'js' = the player's own loop (+ own scroll measurement)
                frameRate?: number;                // target fps for the player's own frame loop ('js', or 'auto' after
                                                   // falling back to it); uncapped when absent, ignored by WAAPI/RN
                duration?: number;                 // length of ONE iteration, ms (default 1000); keyframe times are absolute offsets
                delay?: number;                    // wait before start, ms (default 0); negative = skip ahead, e.g. -500 starts from the 0.5 s frame
                iterations?: number | 'infinite';  // repeat count (default 1); composes with per-property loop (loop-within-loop)
                fillMode?: 'forwards' | 'backwards' | 'both' | 'none';                  // CSS animation-fill-mode; default 'forwards' holds final state
                direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';  // default 'normal'
                trigger?: {
                    startOn?: 'load' | 'mouseOver' | 'click' | 'scrollIntoView' | 'programmatic'; // default 'load'; 'programmatic' waits for play()
                    outAction?: 'continue' | 'pause' | 'reset' | 'reverse'; // when the trigger condition ends; default 'continue'
                    finishAction?: 'hold' | 'reset';  // after a NATURAL finish; default 'hold' (keep end state per `fillMode`).
                                                      // Named to pair with `outAction`, and to stay clear of the onFinish CALLBACK
                    scrollIntoViewThreshold?: number; // how much must be on screen to start: 0 = any part (default), 1 = all of it; scrollIntoView only
                };
              }
            | {
                type: 'scroll' | 'view';           // scrubbed: the scroll container's offset ('scroll') or the SVG's
                                                   // journey through the viewport ('view'); no trigger/delay slots exist here
                duration?: number;                 // the keyframe span the scroll range maps onto, ms
                iterations?: number;               // finite only — 'infinite' cannot map onto a range
                engine?: 'auto' | 'native' | 'js';  // as above — 'auto'/'native' try the browser's ScrollTimeline, 'js' measures itself
                frameRate?: number;                // target fps for the player's own frame loop ('js', or 'auto' after
                                                   // falling back to it); uncapped when absent, ignored by WAAPI/RN
                axis?: 'block' | 'inline' | 'x' | 'y';
                source?: 'nearest' | 'root';       // type 'scroll' — which scroll container
                subject?: string;                  // type 'view' — whose journey: 'parent' | 'scroller' | a CSS selector
                smoothing?: number;                // ms catch-up lag toward the scroll position
                pin?: boolean | {                  // hold the canvas on screen while the scroll drives it
                    align?: 'top' | 'center' | 'bottom';  // default 'top'
                    offset?: number;               // px offset from the aligned position (default 0)
                    distance?: number;             // scroll travel the pin lasts, in viewport heights
                };
                range?: {                          // the slice mapped onto progress 0..1;
                                                   // default { start: {phase:'cover', fraction:0}, end: {phase:'cover', fraction:1} }
                    start?: { phase?: PHASE; fraction?: number };  // fraction: 0..1 within the phase
                    end?:   { phase?: PHASE; fraction?: number };
                };  // PHASE = 'cover' | 'contain' | 'entry' | 'exit' | 'entry-crossing' | 'exit-crossing'
              };

        // reusable definitions, resolved at runtime. `fonts` is the one in everyday use;
        // easings / animations are supported but rarely used.
        definitions?: {
            easings?: Record<string, [number, number, number, number]>; // name → [x1,y1,x2,y2]   (rarely used)
            animations?: Record<string, Record<string, ANIMATE>>;       // name → { propName: ANIMATE }   (rarely used)
            // embedded fonts for glyph-mode text (effects.text.useGlyphs) — renders without
            // shipping a font file. The KEY is the FACE name, i.e. exactly the node's
            // `fontFamily` ("Roboto-Light"): outlines belong to one face, and `fontWeight` /
            // `fontStyle` are attributes on top of it — they never pick a different face.
            fonts?: Record<string, {
                fontFamily: string;   // the real family, e.g. "Roboto"
                fontStyle: string;    // the face, e.g. "" | "Regular" | "Bold" | "Bold Italic"
                ascent: number;       // in unitsPerEm
                unitsPerEm: number;   // e.g. 1000
                glyphs: Record<string, { width: number; pathData: string }>;  // keyed by the character
            }>;
        };

        debugGlobalName?: string;  // debug helper: exposes the animator as window[debugGlobalName]

        version?: string;          // "a.b.c" — the schema the file was written for: a = generation,
                                   // b = player schema (this release reads 1.1), c = editor extension
                                   // (meta.*, ignored by the player). Written by the editor on save,
                                   // never by the player; absent = unknown

        // bind-by-id documents (a pre-rendered SVG + JS export): the elements already exist as
        // markup, so the document lists WHICH element plays WHICH named animations.
        // `…With` is the format's spelling for "by name, from `definitions`": the bare key
        // holds the thing itself (`node.animate` holds keyframes), `<key>With` an array of
        // names of the same concept (`animateWith` → `definitions.animations`).
        bindings?: Array<{
            target: string;             // the element, '#id'-spelled like every element reference
            animateWith: Array<string>; // names into definitions.animations, applied in order
        }>;
    };

    // self-contained documents — SVG element tree; its absence makes the document bind-by-id
    children?: Array<NODE>;
}

// One SVG element
interface NODE {
    type: string;       // SVG element tag: "rect", "g", "path", "ellipse", "use", …
    id?: string;        // DOM id; required for href="#id" refs or as a binding's target
    [camelCaseDomKey: string]: any; // SVG attrs by camelCase DOM name — cx, cy, r, fill, strokeWidth, fontSize, transform, … (kebab-case is accepted too); pass-through
    domType?: string;   // the `type` ATTRIBUTE of the few elements that have one (feTurbulence, …):
                        // `type` is taken by the tag name, so the attribute travels here
    textContent?: string; // text content for <text>/<tspan>
    style?: { [camelCaseCssProperty: string]: string | number };   // inline declarations, camelCase like React's style prop (whiteSpace, pointerEvents); an object only
    // the normal form is the inline record { propName: ANIMATE }; the string forms
    // reference definitions.animations by name (rarely used), and can be mixed in an array
    animate?: Record<string, ANIMATE> | string | Array<string | Record<string, ANIMATE>>;
    effects?: EFFECTS;  // see below; JSON-only — the pre-rendered SVG export materializes these
    meta?: any;         // editor-only (label, shape, …); not rendered, ignored by the player
    children?: Array<NODE>; // recursive; <g>, <defs>, <symbol>, <text>, <use>, …
}
```

## Property animation

<!-- px-check schema-block -->
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
    value?: any;                              // optional static baseline (rarely needed — the node's own attribute is the baseline)
    autoOrient?: boolean;                     // translate-only: rotate element to face the path tangent
    alongPathMode?: 'sampled' | 'offsetPath'; // transform-only: how a motion path is rendered — pre-sampled keyframes (default) or CSS offset-path
    // pre-processes keyframes to fill the timeline duration by repeating a segment
    // true → default: repeat last segment, cycling forward
    // independent of timeline.iterations; composes as loop-within-loop
    loop?: boolean | {
        segmentCount?: number;           // intervals forming the segment; undefined = whole sequence; clamped [1, n-1]
        repeatAt?: 'start' | 'end';      // which END the repetition fills: 'end' (default) = idle/outro, 'start' = intro
        direction?: 'normal' | 'alternate'; // 'normal' (default) = cycle same direction; 'alternate' = ping-pong
    };
}
```

**Keyframe values** — the shape depends on the property being animated:

<!-- px-check off keyframe value shapes, prose -->
| Property kind | `value` shape | Example |
|---|---|---|
| Scalar (`opacity`, `rotate`, `r`, `strokeWidth`, …) | `number` | `0.5` |
| Vector (`translate`, `scale`, `strokeDasharray`) | `Array<number>` | `[80, 40]` |
| Color (`fill`, `stroke`, `stopColor`, …) | `string` or RGBA array | `"#ec4899"` |
| Unified `transform` | parts record | `{ translate:[8,4], rotate:90, skew:10, scale:[2,2], origin:[5,5] }` |
| Path (`d`) | `{ pathData: "M…" }` | one path-data string; compound shapes use several `M…` sub-paths |

Both keyframes of a `d` morph must have the same command structure.

**Any attribute takes one of three forms**, consistently across the format:

```js
{ fill: '#3b82f6' }                              // 1. primitive — static
{ transform: { value: { translate: [10, 10] } } }// 2. {value} — structured static
{ opacity: { keyframes: [ … ] } }                // 3. {keyframes} — animated
```

**Unified `transform`** parts — composed order `translate · +origin · rotate · skewX · scale · −origin`:

<!-- px-check schema PxTransformPartsSchema -->
| Part | Type | Notes |
|---|---|---|
| `translate` | `[x, y]` | user units |
| `rotate` | `number` | degrees |
| `skew` | `number` | skewX in degrees; composed between `rotate` and `scale` |
| `scale` | `[sx, sy]` | |
| `origin` | `[x, y]` | pivot for rotate / skew / scale |

A static `transform` attribute **composes under** the animated transform (CSS's
own precedence): partial keyframe parts inherit the static parts they don't set.

## Effects (`node.effects`)

<!-- px-check schema-block -->
```typescript
interface EFFECTS {
    // each part is animatable: raw value | {value} | {keyframes}
    transformBy?:     { translate?: [x,y], rotate?: deg, skew?: deg, scale?: [x,y], origin?: [x,y] };
    repeater?:        { copies?: number, translate?: [x,y], rotate?: deg, skew?: deg, scale?: [sx,sy] /*per-copy multiplier, compounds v^i*/, origin?: [x,y] };
    maskedBy?:        { source?: '#id',                       // the element that becomes the mask
                        maskType?: 'alpha' | 'luminance',
                        maskUnits?: 'userSpaceOnUse' | 'objectBoundingBox',
                        maskContentUnits?: 'userSpaceOnUse' | 'objectBoundingBox',
                        x?: number, y?: number, width?: number, height?: number };   // mask viewport, in maskUnits
    clipPath?:        { pathData?: "M…" | ANIMATE };            // ONE animatable slot: a path string, or ANIMATE ({ value } static, { keyframes } animated)
    strokeTrim?:      { offset?: number, range?: [a,b], subPaths?: 'separate' | 'combined' };  // offset/range animatable
    clone?:           { without?: 'translate',                // which part of the SOURCE's own transform is left out: absent = whole element (moves with the source);
                                                              // 'translate' = stays where the <use> put it, still rotates/scales with the source ('transform' may follow)
                        source?: '#id',                       // what it clones
                        retime?: { start?, stretch?: number, timeCrop?: [inMs, outMs] } };  // retime is PURE timing
    fillGradient?:    GRADIENT;               // paints the fill …
    strokeGradient?:  GRADIENT;               // … or the stroke; same settings
    textPath?:        { pathData: string /*inline SVG d*/, pathOverflow?, lengthAdjust?, method?, spacing?, startOffset?, textLength? };
    text?:            { useGlyphs?: boolean };  // render text from embedded glyph outlines (definitions.fonts)
}

// Geometry slots animate like any other slot ({value} | {keyframes});
// gradient geometry animation runs on the player's frame loop ('auto' switches to it).
interface GRADIENT {
    type: 'linear' | 'radial';
    start?; end?;                             // linear: the line the gradient runs along
    center?; radius?; focal?;                 // radial
    stops?;                                   // [{ offset, color }, …] — animated: every keyframe carries the whole list
    gradientUnits?; spreadMethod?; gradientTransform?;   // gradientTransform is static
}
```

## Reserved keys

`type` on a node is the SVG **tag name**. The reserved wire keys — never written
to the DOM as attributes — are `type`, `children`, `animator`, `animate`,
`effects`, `meta` and `textContent`. For elements with a real `type` *attribute*
(`<feTurbulence type="fractalNoise">`, …) write it as **`domType`**; the player
renames it back on render:

```js
{ type: 'feTurbulence', domType: 'fractalNoise', baseFrequency: 0.05, numOctaves: 2 }
//     ^ the TAG                ^ the ATTRIBUTE
```

## What the player does with an invalid document

The player is lenient: it renders what it can, never throws on a shape problem and never
refuses a document.

- **On load, every player checks the whole document** against the schema and prints one
  `console.warn` listing the problems (the first six, then a count), e.g.
  `root.animator.timeline.duratoin: unexpected extra key`. The strict parts — the `animator`
  block, every `ANIMATE`, every effect — report any unknown key, so a `keyframe` where
  `keyframes` was meant is caught.
- **Effects** are also checked one by one (`validateNodeEffects`); each problem is a
  `console.warn` prefixed with the node's path, and materialization still does its best.
- **Unknown attributes on a node** pass through to the DOM — that is how any SVG/CSS
  presentation attribute works. So a misspelled attribute with a plain value (`"fil": "red"`)
  is not an error and is not reported; one whose value is an object is.

To check a generated document before it ships, call `validateDocument(doc)` (exported from
`@pixodesk/svg-animator-core` and `@pixodesk/svg-animator-web`): it returns the same problem
strings, `[]` when the document is sound. [SCHEMA.json](./SCHEMA.json) is a JSON Schema
generated from the same runtime schemas (`node scripts/gen-schema-json.mjs`) for tools that
validate JSON themselves.

## Examples

**Self-contained, clock timeline:**

```json
{
  "type": "svg",
  "viewBox": "0 0 400 400",
  "animator": {
    "timeline": { "duration": 1000, "iterations": "infinite",
                  "trigger": { "startOn": "load" } }
  },
  "children": [
    { "type": "ellipse", "fill": "#007fff85", "rx": 64, "ry": 64,
      "animate": { "translate": { "keyframes": [
        { "time": 0,    "value": [139, 163] },
        { "time": 1000, "value": [139, 310] }
      ] } } }
  ]
}
```

**Named definitions + unified transform:**

```json
{
  "type": "svg",
  "viewBox": "0 0 600 400",
  "animator": {
    "timeline": { "duration": 2000, "direction": "alternate", "iterations": "infinite" },
    "definitions": {
      "easings": { "smooth": [0.42, 0, 0.58, 1] },
      "animations": { "fadeIn": { "opacity": { "keyframes": [
        { "time": 0, "value": 0 }, { "time": 2000, "value": 1 } ] } } }
    }
  },
  "children": [
    { "type": "rect", "x": 40, "y": 40, "width": 120, "height": 90, "fill": "#6366f1",
      "animate": "fadeIn" },
    { "type": "path", "id": "star", "d": "M300,60L340,140L260,140z", "fill": "#f59e0b",
      "animate": { "transform": { "keyframes": [
        { "time": 0,    "value": { "translate": [0, 0],   "rotate": 0,  "scale": [1, 1] } },
        { "time": 2000, "value": { "translate": [80, 40], "rotate": 90, "scale": [1.5, 1.5] }, "easing": "smooth" }
      ] } } }
  ]
}
```

**Bind-by-id** (no `children` — animates a pre-existing SVG DOM; each binding names its element
by `#id` and the animations it plays by name):

```json
{
  "type": "svg",
  "id": "heroSvg",
  "animator": {
    "timeline": { "duration": 3000, "iterations": "infinite" },
    "definitions": { "animations": {
      "spin":     { "rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 3000, "value": 360 } ] } },
      "spinBack": { "rotate": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 3000, "value": -360 } ] } }
    } },
    "bindings": [
      { "target": "#gear-big",   "animateWith": ["spin"] },
      { "target": "#gear-small", "animateWith": ["spinBack"] }
    ]
  }
}
```

**Effects** (repeater + animated stroke trim + gradient):

```json
{
  "type": "svg",
  "viewBox": "0 0 400 200",
  "animator": { "timeline": { "duration": 1000 } },
  "children": [
    { "type": "path", "d": "M20,100C60,20,140,20,180,100", "stroke": "#000000", "fill": "none",
      "effects": {
        "repeater":    { "copies": 3, "translate": [90, 0] },
        "strokeTrim":  { "offset": { "keyframes": [ { "time": 0, "value": 0 }, { "time": 1000, "value": 1 } ] },
                         "range": [0, 0.6] },
        "fillGradient": { "type": "linear", "start": [0, 0], "end": [100, 0],
                          "stops": [ { "offset": 0, "color": "#ff0000" }, { "offset": 1, "color": "#0000ff" } ] }
      } }
  ]
}
```

**Scroll-driven** (scrubbed by the SVG's journey through the viewport):

```json
{
  "type": "svg",
  "viewBox": "0 0 400 400",
  "animator": {
    "timeline": { "type": "view", "duration": 3000,
                  "range": { "start": { "phase": "entry", "fraction": 0 },
                             "end":   { "phase": "exit",  "fraction": 1 } } }
  },
  "children": [
    { "type": "rect", "width": 80, "height": 80, "fill": "#10b981",
      "animate": { "translate": { "keyframes": [
        { "time": 0, "value": [0, 0] }, { "time": 3000, "value": [320, 0] } ] } } }
  ]
}
```
