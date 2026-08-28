# Pre-rendered SVG on the web

[← Playback settings & triggers](./10-player--playback-and-triggers.md) · [Contents](./README.md) · Next: [Static sites & CMS →](./12-player--static-sites-and-cms.md)

Put a pre-rendered SVG on a page by **inlining** it — paste the `<svg>` into the HTML, or let
your framework or static-site generator inline the file. It is a normal `.svg` with the
animation already inside, and inline is where it plays with full control.

What does **not** work is treating it as a picture: `<img src>`, SVG `<image>`, CSS
`background-image`. A browser runs no scripts inside an image and nothing on the page can
reach into it, so every flavour is static there — with one exception, the CSS flavour exported
with the *On load* start option, which carries its play state inside the file (details below).

This page shows the embedding options and how much control each flavour gives you once it is
there. For which flavour to pick, see [Choosing a format](./02-start--choosing-a-format.md).

## Four ways to embed any SVG

> **Example:** [`prerendered/img-css`](../examples/docs-examples/src/cases/prerendered/img-css/) — `pnpm example:docs`, then open `#prerendered/img-css`.

| Method | Works with | Notes |
|---|---|---|
| **Inline** — paste the `<svg>…</svg>` into the HTML | all three flavours | the animation shares the page: styles and scripts run in the page context; best control |
| **Build-time inline** — the framework or SSG inlines the file | all three flavours | same result as pasting, but the file stays a file — see [Static sites & CMS](./12-player--static-sites-and-cms.md) |
| **`<img src="a.svg">`**, SVG `<image>`, CSS `background-image` | **CSS flavour exported with *On load*** — nothing else | the file is treated as a picture: scripts never run, and the page cannot add or toggle the play classes. Only a file that already carries `px-anim-enabled px-anim-playing` on its root animates, and then it just loops; no interaction is possible |
| **`<object data="a.svg">` / `<iframe src="a.svg">`** | all three flavours | runs in its own document; scripts work but cannot be reached from the page. Not recommended |

Inlining the **same file twice** on one page duplicates its element ids (`id="_px_…"`), which can
break masks, gradients and JS bindings. Use the JSON format for multiple instances, or export
the file twice so each gets fresh ids.

## Flavour 1 — SVG + CSS animation

> **Example:** [`prerendered/inline-css`](../examples/docs-examples/src/cases/prerendered/inline-css/) — `pnpm example:docs`, then open `#prerendered/inline-css`.

Everything is CSS: a `<style>` block of `@keyframes` and classes on the animated elements.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <style>
    @keyframes _px_2s602utm { 0% { transform: translate(200px, 41px) } 100% { … } }
  </style>
  <g class="px-anim-element _px_2s602utn" transform="…">
    <ellipse id="_px_2s602utl" fill="#0087ff" … />
  </g>
</svg>
```

Two classes on the root gate playback, so you can control it from your own CSS or JavaScript:

| Classes on the root `<svg>` (or a wrapper you control) | State |
|---|---|
| *(none)* | idle — the animation has not started |
| `px-anim-enabled` | started but **paused** |
| `px-anim-enabled px-anim-playing` | **playing** |

Exported with the **On load** start option, the file has `px-anim-enabled px-anim-playing` on
its root already, so it plays the moment it is displayed — inline, and also as an `<img>`, since
nothing has to happen at runtime. With any other start option the root carries no play classes
and something has to add them: the file's own trigger script (flavour 2), a
`PixodeskSvgCssAnimator` wrapper, or your code:

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

Same file plus a small `<script data-px-script="true">` that listens for the trigger you chose
in the editor (mouse over, click, scroll into view) and toggles the classes above, including
the *out action* (continue / pause / reset) and *reset on finish*. Nothing to wire up: inline
the file and it responds to the user.

Because it has a `<script>`, it cannot be used in `<img>` or through SVGR (which strips scripts).
Inline it, or use an `<object>`.

## Flavour 3 — SVG + JS animation

> **Example:** [`prerendered/inline-js`](../examples/docs-examples/src/cases/prerendered/inline-js/) — `pnpm example:docs`, then open `#prerendered/inline-js`.

The web player is embedded in the file and drives the animation from a bindings payload:

```svg
<svg id="_px_root" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <rect id="_px_rect" … />
  <script data-px-script="true">
    /* the player library (minified) */
    var a = PixodeskAnimator.createAnimator({ data: {
      type: 'svg', id: '_px_root',
      animator: { duration: 2000, iterations: 'infinite',
                  definitions: { animations: { fadeIn: { opacity: { keyframes: [ … ] } } } },
                  animateById: { _px_rect: 'fadeIn' } }
    }});
  </script>
</svg>
```

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
