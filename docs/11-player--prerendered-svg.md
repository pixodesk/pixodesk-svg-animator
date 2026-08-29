# Pre-rendered SVG on the web

[← Playback settings & triggers](./10-player--playback-and-triggers.md) · [Contents](./README.md) · Next: [Static sites & CMS →](./12-player--static-sites-and-cms.md)

Put a pre-rendered SVG on a page by **inlining** it — paste the `<svg>` into the HTML, or let
your framework or static-site generator inline the file. It is a normal `.svg` with the
animation already inside, and inline is where it plays with full control.

What does **not** work is treating it as a picture: `<img src>`, SVG `<image>`, CSS
`background-image`. A browser runs no scripts inside an image and nothing on the page can
reach into it, so a pre-rendered SVG used that way is a still frame.

This page shows the embedding options and how much control each flavour gives you once it is
there. For which flavour to pick, see [Choosing a format](./02-start--choosing-a-format.md).

## Three ways to embed animated SVG

> **Example:** [`prerendered/img-css`](../examples/docs-examples/src/cases/prerendered/img-css/) — `pnpm example:docs`, then open `#prerendered/img-css`.

| Method | Works with | Notes |
|---|---|---|
| **Inline** — paste the `<svg>…</svg>` into the HTML | all three flavours | the animation shares the page: styles and scripts run in the page context; best control |
| **Build-time inline** — the framework or static-site generator inlines the file | all three flavours | same result as pasting, but the file stays a file — see [Static sites & CMS](./12-player--static-sites-and-cms.md) |
| **`<object data="a.svg">` / `<iframe src="a.svg">`** | all three flavours | runs in its own document; scripts work but cannot be reached from the page. Not recommended |

**Not as a picture.** `<img src="a.svg">`, SVG `<image>` and CSS `background-image` show a
still frame: no script runs inside an image, and the page cannot reach in to add the play
classes. Inline the file instead.

### One copy of a file per page

> ⚠️ **Inline a given `.svg` file once per page.** Every element in a pre-rendered SVG has an
> id (`id="_px_…"`), and its masks, gradients, clip paths and JS bindings refer to those ids.
> Inline the same file twice and the ids are duplicated — the second copy's mask or gradient
> resolves to the first copy's, and things break in ways that are hard to spot.
>
> Need the same animation several times on one page? Either **export a separate file for each
> place** — every export from the editor gets its own element ids, so the copies don't clash —
> or use the **JSON format**, where the player gives every instance fresh ids for you, so any
> number of copies coexist.

## Which flavour?

| | Pick it when | What you get | What you give up |
|---|---|---|---|
| **1 · SVG + CSS animation** | a loop, an icon, decoration — it just needs to play, on load or on hover | • the smallest file<br>• no JavaScript at all<br>• a hover trigger through CSS `:hover`<br>• imports as a component through SVGR / `vite-svg-loader` | • only what CSS `@keyframes` can express — path morphing only in recent browsers, no gradient geometry, filters or text on a path<br>• no click or scroll trigger<br>• playback is controlled with CSS classes only |
| **2 · SVG + CSS animation + JS triggers** | it should start on click or scroll into view, or needs an out action or reset-on-finish, and you don't want to write code | the same file plus a few inline lines of script (added by the editor app) — no library — that wire the trigger, the out action and reset-on-finish for you | • the same CSS limits<br>• no seek, reverse or speed<br>• the `<script>` rules out SVGR import — inline it |
| **3 · SVG + JS animation** | the animation uses something CSS cannot do, or you want the full playback API | • every animation type<br>• play, pause, seek, reverse, speed<br>• self-contained | • the player is embedded in the file (25–38 KB, unless you reference the library externally)<br>• the `<script>` rules out SVGR import<br>• the exported script keeps its instance local (see below) |

If you find yourself reaching for Flavour 3 *and* wanting to control it from code, the
[JSON format](./06-player--web-player.md) is usually the better answer: same player, no
embedded copy per file, and any number of instances per page.

The full comparison — including JSON, and what each engine can animate — is in
[Choosing a format → Pros and cons](./02-start--choosing-a-format.md#pros-and-cons) and
[Engine pros and cons](./02-start--choosing-a-format.md#engine-pros-and-cons).

## Flavour 1 — SVG + CSS animation

> **Example:** [`prerendered/inline-css`](../examples/docs-examples/src/cases/prerendered/inline-css/) — `pnpm example:docs`, then open `#prerendered/inline-css`.

Everything is CSS: a `<style>` block of `@keyframes` and classes on the animated elements.

The complete *SVG + CSS animation* export of a bouncing ball, start option *On load* — exactly
as the editor writes it (this is the file the
[example](../examples/docs-examples/src/fixtures/ball-css-onload.svg) inlines):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" id="_px_1" class="px-anim-enabled px-anim-playing" data-px-meta="runtime:{useCssAnimation:true},animator:{duration:1000,mode:'auto',iterations:'infinite',direction:'alternate',trigger:{startOn:'load',outAction:'pause'}}">
  <style>@keyframes _px_2 {0% {transform:translate(200px,60px);animation-timing-function:cubic-bezier(0.33,0,0.67,0.33);}
100% {transform:translate(200px,340px)}}
.px-anim-enabled ._px_3 { animation: 1000ms _px_2 infinite alternate both; }
.px-anim-enabled.px-anim-playing .px-anim-element {animation-play-state: running !important;}
.px-anim-enabled:not(.px-anim-playing) .px-anim-element {animation-play-state: paused;}</style>
  <ellipse id="ball" class="px-anim-element _px_3" fill="#0087ff" transform="translate(200,60)" rx="40" ry="40" data-px-meta="animate:{transform:{keyframes:[{time:0,value:{translate:[200,60]},easing:[0.33,0,0.67,0.33]},{time:1000,value:{translate:[200,340]}}]}}"/>
</svg>
```

Three things to notice: the `@keyframes` and the per-element class are the animation; the two
classes on the root are the play state; and `data-px-meta` is editor bookkeeping that lets the
file be re-opened with its effects intact — browsers ignore it ([Meta in pre-rendered SVG](./17-format--data-px-meta.md)).

Two classes on the root gate playback, so you can control it from your own CSS or JavaScript:

| Classes on the root `<svg>` (or a wrapper you control) | State |
|---|---|
| *(none)* | idle — the animation has not started |
| `px-anim-enabled` | started but **paused** |
| `px-anim-enabled px-anim-playing` | **playing** |

Exported with the **On load** start option, the file has `px-anim-enabled px-anim-playing` on
its root already, so it plays the moment it is inlined — nothing has to happen at runtime.
Exported with **On mouse over**, the root carries `px-anim-enabled` only and the stylesheet
gates playback on `:hover` — a hover trigger with no script at all. *On click* and *When
visible* have no CSS equivalent; a pure-CSS export falls back to On load for them. With any
other start option something has to add the play classes: the file's own trigger snippet
(flavour 2), a `PixodeskSvgCssAnimator` wrapper, or your code:

```js
const svg = document.querySelector('#hero svg');
svg.classList.add('px-anim-enabled', 'px-anim-playing');   // play
svg.classList.remove('px-anim-playing');                    // pause
svg.classList.remove('px-anim-enabled', 'px-anim-playing'); // reset to the start
```

This is exactly what the React and Vue `PixodeskSvgCssAnimator` components do for you — they
wrap an SVGR / `vite-svg-loader` import in a `<div>` and toggle these classes on hover, click or
scroll-into-view. See [React → CSS-flavour SVGs](./07-player--react.md#css-flavour-svgs--pixodesksvgcssanimator)
and [Vue → CSS-flavour SVGs](./08-player--vue.md#css-flavour-svgs--pixodesksvgcssanimator).

## Flavour 2 — SVG + CSS animation + JS triggers

Same file plus a small `<script data-px-script="true">` — a few lines the editor writes, no
library — that listens for the trigger you chose (mouse over, click, scroll into view) and
toggles the classes above, including the *out action* (continue / pause / reset / reverse) and
*reset on finish*. It is the *Use JS Triggers* switch in the editor's trigger panel. Nothing to
wire up: inline the file and it responds to the user.

Because it has a `<script>`, it cannot go through SVGR or `vite-svg-loader`, which strip
scripts. Inline it, or use an `<object>`.

## Flavour 3 — SVG + JS animation

> **Example:** [`prerendered/inline-js`](../examples/docs-examples/src/cases/prerendered/inline-js/) — `pnpm example:docs`, then open `#prerendered/inline-js`.

The web player drives the animation from a bindings payload carried in the file's own
`<script>`. Below is the editor's *SVG + JS animation* export of the same ball with the
*Embed JS player* option **off** — exactly as written (the
[example](../examples/docs-examples/src/cases/prerendered/inline-js/) inlines it after loading
the player library). With the option **on**, the editor inlines the player into that same
`<script data-px-script="true">`, so the file is self-contained.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" id="_px_1" data-px-meta="runtime:{externalJs:true},animator:{duration:1000,mode:'auto',iterations:'infinite',direction:'alternate',trigger:{startOn:'load',outAction:'pause'}}">
  <ellipse id="ball" fill="#0087ff" transform="translate(200,60)" rx="40" ry="40" data-px-meta="animate:{transform:{keyframes:[{time:0,value:{translate:[200,60]},easing:[0.33,0,0.67,0.33]},{time:1000,value:{translate:[200,340]}}]}}"/>
<script data-px-script="true">
//<![CDATA[
(function() {
var a = PixodeskAnimator.createAnimator({"data": 
{"id":"_px_1","type":"svg","animator":{"duration":1000,"mode":"auto","iterations":"infinite","direction":"alternate","trigger":{"startOn":"load","outAction":"pause"},"definitions":{"animations":{"a0":{"transform":{"keyframes":[{"time":0,"value":{"translate":[200,60]},"easing":[0.33,0,0.67,0.33]},{"time":1000,"value":{"translate":[200,340]}}]}}}},"animateById":{"ball":["a0"]}}}
});
})();
//]]>
</script>
</svg>
```

The payload is the JSON format's `animator` block only — `definitions.animations` plus an
`animateById` map from element id to animation — with no `children`, because the elements
already exist in the file; the player binds to them by id.

This flavour supports **every** animation type (the editor picks the trimmed player build
matching the engine mode you chose — *WAAPI only* is the smallest). The editor's *Embed JS
player* option can instead reference the library externally so several files share one copy.

`createAnimator` returns the same playback API as the web player ([Web player → Playback API](./06-player--web-player.md#the-playback-api)).
The exported script keeps it in a local variable; if you need to drive the animation from your
own code, choose the *Manually from JS* start option in the editor and either edit the script
to store the instance (`window.myAnim = PixodeskAnimator.createAnimator(…)`), or — simpler and
recommended — use the [JSON format](./06-player--web-player.md) instead.

## Sizing

An inlined SVG sizes like any SVG: keep its `viewBox`, drop or override `width`/`height`, and
size the container with CSS (`svg { width: 100%; height: auto }`).

[← Playback settings & triggers](./10-player--playback-and-triggers.md) · [Contents](./README.md) · Next: [Static sites & CMS →](./12-player--static-sites-and-cms.md)
