# Meta in pre-rendered SVG — `data-px-meta`

[← Editor meta and applied effects](./16-format--editor-meta.md) · [Contents](./README.md) · Next: [Core library →](./18-format--core-library.md)

Read this if you open a pre-rendered `.svg` in a text editor and want to know what the
`data-px-meta` attributes are, whether you can remove them, or how to read them from code.

A pre-rendered SVG is a normal SVG file, and SVG has no place for editor data — so the editor's
`meta` object ([Editor meta and applied effects](./16-format--editor-meta.md)) is written into
one attribute per element. Browsers and players ignore it; only the editor reads it.

A complete *SVG + CSS animation* export, exactly as the editor writes it: one circle with a
`repeater` effect (three copies), fading in and out. The root carries the playback settings;
the host, its core and every derived copy carry the marks described in
[Editor meta → Units](./16-format--editor-meta.md#units--one-element-written-as-several):

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

## The notation

The value is **JSON5 with the outer braces removed** — it is always an object, so the braces
are dropped for compactness. That gives you unquoted keys, single-quoted strings, and commas
between entries; numbers are rounded to the editor's display precision, and `null` values are
never written.

To read one, put the braces back and hand it to a JSON5 parser:

```js
import JSON5 from 'json5';

// any element of an inlined pre-rendered SVG that carries the attribute
const element = document.querySelector('svg [data-px-meta]');
const meta = JSON5.parse('{' + element.getAttribute('data-px-meta') + '}');
// → { effectsHost: { coreId: '#_px_2', appliedEffects: { transformBy: { translate: [80, 200] }, repeater: { copies: 3, translate: [100, 0] } } } }
```

A `"` inside a string (a label, say) stays a literal `"` in the JSON5 and is escaped to
`&quot;` by the XML layer, so any text survives the round trip. Plain `JSON.parse` will **not**
read it — the keys are unquoted.

## What goes where

| Element | Keys in its `data-px-meta` |
|---|---|
| root `<svg>` | • `runtime` (how the animation code was generated)<br>• `animator` (the playback settings) |
| any element | `label` · `appliedEffects` · `effectsHost` · `partOf` · `animate` |
| `<symbol>` | `timeline` |
| text line `<tspan>` | `lineSpacing` |

The keys mean exactly what they mean in the JSON format — the table in
[Editor meta → The keys](./16-format--editor-meta.md#the-keys) applies unchanged. Two of them
exist *only* in this form:

### The animator config has two addresses

The playback settings are always called `animator`, but where they sit is forced by the file:

| Form | Address |
|---|---|
| JSON | top-level `animator` — a JSON document has a top level |
| pre-rendered SVG | `meta.animator`, inside the root's `data-px-meta` — an SVG file has nowhere else to put a non-SVG key |

The editor lifts one to the other on save and open. A tool that reads both forms has to check
both places; `getAnimatorConfig()` in the core library does.

### `animate` — the keyframes travel with the element

In a CSS-flavour export the animation *plays* from `@keyframes`, but `@keyframes` cannot be
turned back into the editor's keyframes with their easings and tangents. So each animated
element also carries its original `animate` channel in `data-px-meta` — the same object that is
`node.animate` in JSON. That is what makes a pre-rendered file fully re-openable.

## Can I remove it?

Yes, if the file only has to play. Nothing in `data-px-meta` is read by a browser or a player,
so stripping every `data-px-meta` attribute changes nothing on screen and makes the file
smaller — for a large export, noticeably.

What you lose is the ability to open the file in the editor as what it was: a star preset
becomes a plain path, glyph text becomes outlines, an expanded effect becomes ordinary elements
([Units](./16-format--editor-meta.md#units--one-element-written-as-several)). Keep the original
export if you might ever want to edit it again.

[← Editor meta and applied effects](./16-format--editor-meta.md) · [Contents](./README.md) · Next: [Core library →](./18-format--core-library.md)
