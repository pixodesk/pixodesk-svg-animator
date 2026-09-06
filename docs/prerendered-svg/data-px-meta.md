# Meta in pre-rendered SVG — `data-px-meta`

[← Editor meta and applied effects](../format/README.md#editor-meta-and-applied-effects) · [Contents](../README.md) · Next: [Core library →](../format/README.md#core-library--pixodesksvg-animator-core)

Read this if you open a pre-rendered `.svg` in a text editor and want to know what the
`data-px-meta` attributes are, whether you can remove them, or how to read them from code.

A pre-rendered SVG is a normal SVG file, and SVG has no place for editor data — so the editor's
`meta` object ([Editor meta and applied effects](../format/README.md#editor-meta-and-applied-effects)) is written into
one attribute per element. Browsers and players ignore it; only the editor reads it.

A complete *SVG + CSS animation* export, exactly as the editor writes it: one circle with a
`repeater` effect (three copies), fading in and out. The root carries the playback settings;
the host, its core and every derived copy carry the marks described in
[Editor meta → derived elements (host / core / part)](../prerendered-svg/data-px-meta.md#applied-effects-that-create-derived-elements-host--core--part):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" id="_px_1" class="px-anim-enabled px-anim-playing" data-px-meta="runtime:{useCssAnimation:true},animator:{duration:1000,mode:'auto',iterations:'infinite',direction:'alternate',trigger:{startOn:'load',outAction:'pause'}}">
  <style>@keyframes _px_3 {0% {opacity:1;animation-timing-function:cubic-bezier(0.167,0.167,0.833,0.833);}
100% {opacity:0.2}}
.px-anim-enabled ._px_4 { animation: 1000ms _px_3 infinite alternate both; }
.px-anim-enabled.px-anim-playing .px-anim-element {animation-play-state: running !important;}
.px-anim-enabled:not(.px-anim-playing) .px-anim-element {animation-play-state: paused;}</style>
  <g id="dot" transform="translate(80,200)" data-px-meta="effectsHost:{coreId:'#_px_2',appliedEffects:{transformBy:{translate:[80,200]},repeater:{copies:3,translate:[100,0]}}}">
    <ellipse id="_px_2" class="px-anim-element _px_4" fill="#0087ff" rx="20" ry="20" data-px-meta="partOf:'#dot',animate:{opacity:{keyframes:[{time:0,value:1},{time:1000,value:0.2}]}}"/>
    <g transform="matrix(1,0,0,1,100,0)" data-px-meta="partOf:'#dot'">
      <ellipse class="px-anim-element _px_4" fill="#0087ff" rx="20" ry="20" data-px-meta="partOf:'#dot',animate:{opacity:{keyframes:[{time:0,value:1},{time:1000,value:0.2}]}}"/>
    </g>
    <g transform="matrix(1,0,0,1,200,0)" data-px-meta="partOf:'#dot'">
      <ellipse class="px-anim-element _px_4" fill="#0087ff" rx="20" ry="20" data-px-meta="partOf:'#dot',animate:{opacity:{keyframes:[{time:0,value:1},{time:1000,value:0.2}]}}"/>
    </g>
  </g>
</svg>
```

## How the value is written — JSON5 without the outer braces

The value is **JSON5 with the outer braces removed** — it is always an object, so the braces
are dropped for compactness. That gives you unquoted keys, single-quoted strings, and commas
between entries; numbers are rounded to the editor's display precision, and `null` values are
never written.

To read one, put the braces back and hand it to a JSON5 parser. Say the SVG contains this
element (the host `<g>` from the export above):

```svg
<g id="dot" data-px-meta="effectsHost:{coreId:'#_px_2',appliedEffects:{transformBy:{translate:[80,200]},repeater:{copies:3,translate:[100,0]}}}">
```

```js
import JSON5 from 'json5';

// any element of an inlined pre-rendered SVG that carries the attribute
const element = document.querySelector('svg [data-px-meta]');
const meta = JSON5.parse('{' + element.getAttribute('data-px-meta') + '}');
// → { effectsHost: { coreId: '#_px_2', appliedEffects: { transformBy: { translate: [80, 200] }, repeater: { copies: 3, translate: [100, 0] } } } }
```

A `"` inside a string — for example in an element's label — stays a literal `"` in the JSON5 and is escaped to
`&quot;` by the XML layer, so any text survives the round trip. Plain `JSON.parse` will **not**
read it — the keys are unquoted.

## What goes where

Which keys appear on which element — a skeleton of a pre-rendered file (values shortened
to `…`):

```svg
<!-- root <svg>: runtime (how the animation code was generated) + animator (the playback settings) -->
<svg data-px-meta="runtime:{…},animator:{…}">

  <!-- any element can carry: label, appliedEffects, effectsHost, partOf, animate -->
  <g id="dot" data-px-meta="label:'Wheel',effectsHost:{…}">
    <ellipse data-px-meta="partOf:'#dot',animate:{…}"/>
  </g>

  <!-- a <symbol>: timeline — the symbol's own animation length -->
  <symbol data-px-meta="timeline:{duration:2000}">…</symbol>

  <!-- a text line <tspan>: lineSpacing — the line-height its y was computed from -->
  <text>
    <tspan data-px-meta="lineSpacing:1.2">second line</tspan>
  </text>
</svg>
```

The keys mean exactly what they mean in the JSON format — the table in
[Editor meta → The fields](../format/README.md#the-fields) applies unchanged. Two of them
exist *only* in this form:

### The animator config lives in two different places

The playback settings are always called `animator`, but where they sit is forced by the file:

| Form | Where it lives |
|---|---|
| JSON | the `animator` key of the document's root object, next to `type` and `children` |
| pre-rendered SVG | inside the root `<svg>` element's `data-px-meta` attribute — an SVG file cannot have keys of its own, so the attribute is the only place to put it |

The same settings, in both forms:

```js
// JSON document — an ordinary key of the root object
{
  "type": "svg",
  "animator": { "timeline": { "type": "clock", "duration": 1000, "trigger": { "startOn": "load" } } },
  "children": [ … ]
}
```

```svg
<!-- pre-rendered SVG — inside the root's data-px-meta -->
<svg data-px-meta="animator:{duration:1000,trigger:{startOn:'load'}}">
```

The editor lifts one to the other on save and open. A tool that reads both forms has to check
both places; `getAnimatorConfig()` in the core library does.

### `animate` — the keyframes travel with the element

In a CSS-flavour export the animation *plays* from `@keyframes`, but `@keyframes` cannot be
turned back into the editor's keyframes with their easings and tangents. So each animated
element also carries its original `animate` channel in `data-px-meta` — the same object that is
`node.animate` in JSON. That is what makes a pre-rendered file fully re-openable.

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

## Can I remove `data-px-meta` from SVG elements?

> ⚠️ **Only if you will never open this file in the editor again.** `data-px-meta` is what
> makes a pre-rendered file editable: strip it, and a star preset becomes a plain path, glyph
> text becomes outlines, an expanded effect becomes ordinary elements
> ([Applied effects that create derived elements](../prerendered-svg/data-px-meta.md#applied-effects-that-create-derived-elements-host--core--part)).
> Keep the original export if you might ever want to edit it again.

For a file that only has to play, removing it is safe: nothing in `data-px-meta` is read by a
browser or a player, so stripping every `data-px-meta` attribute changes nothing on screen and
makes the file smaller.

[← Editor meta and applied effects](../format/README.md#editor-meta-and-applied-effects) · [Contents](../README.md) · Next: [Core library →](../format/README.md#core-library--pixodesksvg-animator-core)
