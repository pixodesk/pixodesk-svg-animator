# Quick start

[← Introduction](./01-introduction.md) · [Contents](./README.md) · Next: [Choosing a format →](./03-choosing-a-format.md)

Ten minutes from an empty editor to an animation on a page. Three paths — pick the one that
matches where the animation is going.

## 1 · Make (or import) an animation

1. Open the **Pixodesk Animator Studio** editor desktop app ([pixodesk.com](https://pixodesk.com)).
2. On the welcome screen choose file type:
   - **Pixodesk JSON** — the document the players consume *(pick this for paths B and C)*
   - **SVG + CSS animation** — a self-contained `.svg`, no JavaScript *(default pick for path A)*
   - **SVG + JS (WAAPI/Frames) animation** — a self-contained `.svg` with the player embedded
3. Add some shapes (or **Open / Drop** an existing `.svg`) and animate them on the timeline —
   see the [editor guide](./04-editor.md). Press play.
4. **File → Save** (or *Save As*). That file is what you embed below.

The [editor guide](./04-editor.md) covers everything else — shape presets, effects, easing,
triggers.

## 2 · Put it on a page

### Path A — a pre-rendered SVG, no library

Open the exported `.svg` in a text editor and paste its contents where you want it — into an
HTML file, a CMS "custom HTML" block, an Astro/Jekyll/11ty template. It plays on load.

```html
<!-- index.html -->
<div class="hero">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <style>@keyframes _px_a1 { … }</style>
    <g class="px-anim-element _px_a1">…</g>
  </svg>
</div>
```

The CSS flavour also works as a plain image — `<img src="animation.svg">` — and as a React /
Vue component via SVGR or `vite-svg-loader`. Details, including how to start it on hover or
scroll: [Pre-rendered SVG on the web](./06-prerendered-svg.md).

### Path B — JSON + the web player (vanilla JavaScript)

```html
<div data-px-animation-src="/animation.json" style="width: 400px; height: 300px"></div>

<script src="https://unpkg.com/@pixodesk/svg-animator-web/dist/index.umd.min.js"></script>
<script>
  PixodeskAnimator.loadTagAnimators();   // renders every [data-px-animation-src] element
</script>
```

Or with a bundler:

```bash
npm install @pixodesk/svg-animator-web
```

```js
import { createAnimator } from '@pixodesk/svg-animator-web';

const animator = createAnimator({ src: '/animation.json', container: '#hero' });
animator.play();          // also: pause(), setCurrentTime(ms), setPlaybackRate(2), destroy()
```

Full API: [Web player](./07-web-player.md).

### Path C — JSON in React (or Vue)

```bash
npm install @pixodesk/svg-animator-react
```

```tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Hero() {
  return <PixodeskSvgAnimator doc={animation} autoplay />;
}
```

`autoplay` honours the trigger you chose in the editor (on load, on hover, on click, when
scrolled into view). Props for play/pause, seeking and an imperative API: [React](./08-react.md).
Vue is the same component with Vue props and events: [Vue](./09-vue.md).

## 3 · Next steps

- Not sure the format you picked is right? → [Choosing a format](./03-choosing-a-format.md)
- Want it to start on hover, click or scroll, or loop forever? → [Playback settings & triggers](./12-playback-and-triggers.md)
- Embedding in Astro, Next.js, Nuxt, WordPress, Shopify…? → [Static sites & CMS](./11-static-sites-and-cms.md)
- Something not moving? → [Troubleshooting](./17-troubleshooting.md)

[← Introduction](./01-introduction.md) · [Contents](./README.md) · Next: [Choosing a format →](./03-choosing-a-format.md)
