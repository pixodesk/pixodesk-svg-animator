# Pre-rendered SVG on the web

[← Playback settings & triggers](./10-player--playback-and-triggers.md) · [Contents](./README.md) · Next: [Static sites & CMS →](./12-player--static-sites-and-cms.md)

Put a pre-rendered SVG on a page by **inlining** it — paste the `<svg>` into the HTML, or let
your framework or static-site generator inline the file. It is a normal `.svg` with the
animation already inside, and once its markup is part of the page, everything in it works:
the animation plays, the triggers respond, and its elements can be reached from CSS and
JavaScript.

What does **not** work is treating it as a picture: `<img src>`, SVG `<image>`, CSS
`background-image`. A browser runs no scripts inside an image and nothing on the page can
reach into it, so a pre-rendered SVG used that way is a static frame.

This page shows the embedding options and how much control each flavour gives you once it is
there. For which flavour to pick, see [Choosing a format](./02-start--choosing-a-format.md).

## Three ways to embed animated SVG

> **Example:** [`prerendered/img-css`](../examples/docs-examples/src/cases/prerendered/img-css/) — `pnpm example:docs`, then open `#prerendered/img-css`.

Each of the three works with every flavour:

| Method | Notes |
|---|---|
| **Inline** — paste the `<svg>…</svg>` into the HTML | the animation becomes part of your page, like any other HTML: your CSS can style its elements, your JavaScript can reach them (for example to add the play / pause classes), and the file's own script — if its flavour has one — runs as a normal page script. The most capable option |
| **Build-time inline** — the framework or static-site generator inlines the file | you keep `a.svg` as a separate file in your project, and the tool copies its contents into the HTML when the site is built. The page ends up exactly as in the row above — as if you had pasted the `<svg>` in by hand — but the animation stays editable as its own file. How to set this up per tool: [Static sites & CMS](./12-player--static-sites-and-cms.md) |
| **`<object data="a.svg">` / `<iframe src="a.svg">`** | runs in its own document; scripts work but cannot be reached from the page. Not recommended |

**Not as a picture.** `<img src="a.svg">`, SVG `<image>` and CSS `background-image` show a
static frame: no script runs inside an image, and the page cannot reach in to add the play
classes. Inline the file instead.

### One copy of a file per page

> ⚠️ **Inline each `.svg` file only once per page.** Every element in a pre-rendered SVG has an
> id (`id="_px_…"`), and its masks, gradients, clip paths and JS bindings refer to those ids.
> If you inline the same file twice, the same ids appear twice on the page — the second copy's
> mask or gradient then resolves to the first copy's, and things break in ways that are hard
> to spot.
>
> Need the same animation several times on one page? Either **export a separate file for each
> place** — every export from the editor gets its own element ids, so the copies don't clash —
> or use the **JSON format**, where the player gives every instance fresh ids for you, so any
> number of copies coexist.

## Which flavour?

| | Pick it when | What you get | What you give up |
|---|---|---|---|
| **1 · SVG + CSS animation** | a loop, an icon, decoration — it just needs to play, on load or on hover | • the smallest file<br>• no JavaScript at all<br>• a hover trigger through CSS `:hover`<br>• imports as a component through SVGR / `vite-svg-loader` | • only what CSS `@keyframes` can express — path morphing only in recent browsers, no gradient geometry, filters or text on a path<br>• no click or scroll trigger<br>• playback is controlled with CSS classes only |
| **2 · SVG + CSS animation + JS triggers** | it should start on click or scroll into view, or needs an out action or reset-on-finish, and you don't want to write code | the same file plus a few inline lines of script (added by the editor app) — no library — that wire the trigger, the out action and reset-on-finish for you | • the same CSS limits<br>• no jumping to a time, no reverse, no speed change<br>• the `<script>` rules out SVGR import — inline it |
| **3 · SVG + JS animation** | the animation uses something CSS cannot do, or you want the full playback API | • every animation type<br>• play, pause, jump to any point, reverse, change speed<br>• self-contained | • the player is embedded in the file (25–38 KB; the editor can instead leave it out and let the page load the player library, [`@pixodesk/svg-animator-web`](https://www.npmjs.com/package/@pixodesk/svg-animator-web), separately — see [Flavour 3](#flavour-3--svg--js-animation))<br>• the `<script>` rules out SVGR import<br>• out of the box, your own page scripts cannot control the playback: the script inside the file starts the player and keeps it to itself, in a local variable. [Flavour 3](#flavour-3--svg--js-animation) shows the workaround — and why JSON is the better choice when you need control from code |

If you find yourself reaching for Flavour 3 *and* wanting to control it from code, the
[JSON format](./06-player--web-player.md) is usually the better answer: same player, no
embedded copy per file, and any number of instances per page.

The full comparison — including JSON, and what each engine can animate — is in
[Choosing a format → Pros and cons](./02-start--choosing-a-format.md#pros-and-cons) and
[Engine pros and cons](./02-start--choosing-a-format.md#engine-pros-and-cons).

## Flavour 1 — SVG + CSS animation

> **Example:** [`prerendered/inline-css`](../examples/docs-examples/src/cases/prerendered/inline-css/) — `pnpm example:docs`, then open `#prerendered/inline-css`.

In this flavour the file contains no JavaScript at all — the animation is written entirely in
CSS, which every browser plays by itself. Inside the `.svg` there is a `<style>` block holding
the movement as CSS `@keyframes` rules, and each animated element carries a class that
connects it to its rules. Nothing needs to load or run for it to play.

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

Three things to notice:

- the `@keyframes` and the per-element class are the animation;
- the two classes on the root `<svg>` are the play state;
- `data-px-meta` is editor bookkeeping that lets the file be re-opened with its effects
  intact — browsers ignore it ([Meta in pre-rendered SVG](./17-format--data-px-meta.md)).

Whether the animation runs is decided by two CSS classes on the root `<svg>` element. The
animation only plays while both are present; take one away and it stops. Since adding and
removing classes is something any CSS rule or line of JavaScript can do, this is also how you
control playback in this flavour:

| Classes on the root `<svg>` (or a wrapper you control) | State |
|---|---|
| *(none)* | idle — the animation has not started |
| `px-anim-enabled` | started but **paused** |
| `px-anim-enabled px-anim-playing` | **playing** |

Exported with the *On load* start option, the file has `px-anim-enabled px-anim-playing` on
its root already, so it plays the moment it is inlined — nothing has to happen at runtime.
Exported with *On mouse over*, the root carries `px-anim-enabled` only, and a CSS `:hover`
rule inside the file supplies the playing state while the pointer is over it — a hover trigger
with no script at all. *On click* and *When
visible* have no CSS equivalent; a pure-CSS export falls back to *On load* for them. So a pure-CSS file starts an
animation by itself only in those two cases — on load and on hover. For anything else, the
play classes have to be added to the `<svg>` at the right moment, and that can be done by one
of three things: the small trigger script the editor puts into the file in
[flavour 2](#flavour-2--svg--css-animation--js-triggers), the `PixodeskSvgCssAnimator`
wrapper component (React / Vue — described just after the code), or a few lines of your own JavaScript:

```js
const svg = document.getElementById('_px_1');   // the exported <svg>'s own id — see the file above
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

In this flavour nothing in the file is animated by CSS. Instead, the elements are drawn as
plain, static SVG, and the file carries a `<script>` holding the animation data — which
elements move, and how, over time. When the page shows the file, that script hands the data
to the web player, and the player animates the elements. Below is the editor's
*SVG + JS animation* export of the same bouncing-ball animation with the *Embed JS Player* option **off** —
exactly as written (the
[example](../examples/docs-examples/src/cases/prerendered/inline-js/) inlines it after loading
the player library). With *Embed JS Player* switched **on**, the editor inlines the player into that same
`<script data-px-script="true">`, so the file is self-contained.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" id="_px_1" data-px-meta="runtime:{externalJs:true},animator:{duration:1000,mode:'auto',iterations:'infinite',direction:'alternate',trigger:{startOn:'load',outAction:'pause'}}">
  <ellipse id="ball" fill="#0087ff" transform="translate(200,60)" rx="40" ry="40" data-px-meta="animate:{transform:{keyframes:[{time:0,value:{translate:[200,60]},easing:[0.33,0,0.67,0.33]},{time:1000,value:{translate:[200,340]}}]}}"/>
<script data-px-script="true">
//<![CDATA[
(function() {
var a = PixodeskAnimator.createAnimator({"data": 
{"id":"_px_1","type":"svg","animator":{"mode":"auto","timeline":{"type":"clock","duration":1000,"trigger":{"startOn":"load","outAction":"pause"},"iterations":"infinite","direction":"alternate"},"definitions":{"animations":{"a0":{"transform":{"keyframes":[{"time":0,"value":{"translate":[200,60]},"easing":[0.33,0,0.67,0.33]},{"time":1000,"value":{"translate":[200,340]}}]}}}},"animateById":{"#ball":["a0"]}}}
});
})();
//]]>
</script>
</svg>
```

The `<script>` does not repeat the drawing. A JSON animation file normally carries both the
elements and their animation; here the elements are already in the file as ordinary SVG
markup, so the script holds only the animation part — the JSON format's `animator` block.
Inside it, `definitions.animations` describes the movements, and `animateById` lists which
element id gets which movement. When the file loads, the player finds each element in the SVG
by its id and animates it in place.

Because a real player runs the animation, this flavour supports **every** animation type —
nothing falls back, nothing is dropped. To keep the file small, the editor does not embed the
full player: it picks a trimmed build that contains only what your chosen engine mode needs —
choosing the “WAAPI” engine mode in the editor gives the smallest file, because the build for
it carries no frame-loop engine.

The player does not have to live inside the file at all. Switch the editor's *Embed JS Player*
option **off** and the exported file contains only the drawing and the animation data; your
page then loads the player library,
[`@pixodesk/svg-animator-web`](https://www.npmjs.com/package/@pixodesk/svg-animator-web), as a
normal script ([how to host it on your own site](./05-player--installation.md#the-three-builds--esm-cjs-and-umd)).
Do this when several exported files sit on one page: they all use that one copy of the player
instead of each file carrying its own.

One limitation to know. The script inside the file starts the player and gets back a full
remote control for the animation — the same [playback API](./06-player--web-player.md#the-playback-api)
the web player has, with play, pause and everything else. But the script keeps that remote
control in a variable of its own, where scripts on your page cannot see it. So the animation
plays fine, but your code has no way to pause it or jump around in it. If you need that
control, you have two options:

- choose the *Manually from JS* start option in the editor, then edit the exported script by
  hand so it puts the remote control somewhere your code can reach, for example
  `window.myAnim = PixodeskAnimator.createAnimator(…)`;
- or — simpler, and recommended — use the [JSON format](./06-player--web-player.md) instead:
  controlling the animation from code is exactly what it is made for.

## Sizing

Setting the size of an inlined pre-rendered SVG works the same as for any inlined SVG: keep
its `viewBox` attribute (it preserves the proportions), remove or override the `width` /
`height` attributes, and give the size in CSS — on the `<svg>` itself or on the element that
contains it, e.g. `svg { width: 100%; height: auto }`.

[← Playback settings & triggers](./10-player--playback-and-triggers.md) · [Contents](./README.md) · Next: [Static sites & CMS →](./12-player--static-sites-and-cms.md)
