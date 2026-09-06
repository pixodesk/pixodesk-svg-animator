# Static sites & CMS

[← Pre-rendered SVG on the web](./on-the-web.md) · [Contents](../README.md) · Next: [Format principles →](../format/principles.md)

Building with a static-site generator or a CMS? Use a pre-rendered SVG: the build tool or
CMS **inlines the file** and the animation is on screen before any JavaScript runs. Even the
flavours with a `<script>` just work when inlined. Where a framework also runs client code,
the JSON format with a player is available too.

## Static site generators

| Framework | Inline a pre-rendered SVG | JSON alternative |
|---|---|---|
| **Astro** | `import svg from './animation.svg?raw';` then `<Fragment set:html={svg} />` | use the React or Vue component with the `client:load` directive, which tells Astro to run it in the browser (an “island”, in Astro's own terms) |
| **Gatsby** | `gatsby-plugin-react-svg` (CSS flavour) or `dangerouslySetInnerHTML` with the raw file | React component |
| **Jekyll** | `{% include_relative assets/animation.svg %}` | use the player library [`@pixodesk/svg-animator-web`](https://www.npmjs.com/package/@pixodesk/svg-animator-web): it ships a single `.js` file (the “UMD” build) that you copy to your site and load with a plain `<script>` tag — [how to get the file](../library/installation.md#the-three-builds--esm-cjs-and-umd), [example below](#vanilla-javascript-on-any-static-page) |
| **Hugo** | `{{ readFile "static/animation.svg" \| safeHTML }}` | use the player library [`@pixodesk/svg-animator-web`](https://www.npmjs.com/package/@pixodesk/svg-animator-web): it ships a single `.js` file (the “UMD” build) that you copy to your site and load with a plain `<script>` tag — [how to get the file](../library/installation.md#the-three-builds--esm-cjs-and-umd), [example below](#vanilla-javascript-on-any-static-page) |
| **11ty (Eleventy)** | `{% include "animation.svg" %}` | use the player library [`@pixodesk/svg-animator-web`](https://www.npmjs.com/package/@pixodesk/svg-animator-web): it ships a single `.js` file (the “UMD” build) that you copy to your site and load with a plain `<script>` tag — [how to get the file](../library/installation.md#the-three-builds--esm-cjs-and-umd), [example below](#vanilla-javascript-on-any-static-page) |
| **Docusaurus / MDX** | import the CSS flavour as a component (SVGR is built in) — [example below](#docusaurus--mdx) | React component |

The rows above use two different ways of putting the file into the page, and they are not
equal. A **raw include** — Astro's `?raw` import, Jekyll's `include`, Hugo's `readFile` —
copies the file's content into the HTML exactly as it is, `<script>` tags included; that is
why the JS-triggers and JS-animation flavours work in these generators. A **component
import** (SVGR, `vite-svg-loader`) instead converts the SVG into a component, and removes any
`<script>` along the way — so it works for the CSS flavour only.

### Docusaurus / MDX

Docusaurus imports `.svg` files as React components through SVGR, so a CSS-flavour export drops
into any `.mdx` page like an icon, right among the page's ordinary Markdown content:

```mdx
import Ball from './animation.svg';

# Welcome

<Ball style={{ width: 300, height: 300 }} />
```

(`# Welcome` is just the page's own Markdown heading — in `.mdx`, Markdown text and imported
components sit side by side.)

An *On load* export plays on its own. For a hover, click or scroll trigger, wrap it in the
React package's `PixodeskSvgCssAnimator`, which toggles the play classes for you:

```mdx
import Ball from './animation.svg';
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-react';

<PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause" style={{ width: 300, height: 300 }}>
  <Ball />
</PixodeskSvgCssAnimator>
```

One setting matters. Docusaurus runs **SVGO**, an SVG optimiser, on every imported SVG — and
one of SVGO's optimisations (`inlineStyles`) rewrites the file's `<style>` rules as plain
attributes on the elements. That rewrite destroys the animation's on/off switch: the file's
CSS rules only apply while the play classes are on the root `<svg>`
([how that works](./on-the-web.md#flavour-1--svg--css-animation)), and once
the rules are inlined, the classes no longer control anything — the animation cannot be
started or stopped. Turn SVGO off for the SVGR plugin in `docusaurus.config.js`:

```js
export default {
  presets: [
    ['classic', {
      svgr: { svgrConfig: { svgo: false } },
    }],
  ],
};
```

Pasting the SVG markup straight into an `.mdx` file does not work: MDX reads the `{ }` inside
`<style>` as expressions and drops `<script>`. For the scripted flavours, import the file raw
and set it as HTML — Docusaurus renders the page to static HTML at build time, so the file's
own `<script>` runs when the page loads:

```mdx
import svg from '!!raw-loader!./animation.svg';

<div dangerouslySetInnerHTML={{ __html: svg }} />
```

The `!!raw-loader!` prefix in the import needs the `raw-loader` package — add it with
`npm install raw-loader`. This is not our invention: it is the approach Docusaurus itself
recommends for bringing a file's raw text into a page.

Application frameworks that render on the client — Next.js, Nuxt, SvelteKit, Angular — are a
different case: there the JSON format with a player is the natural fit. See
[React → Next.js](../library/react.md#nextjs) and [Vue → Nuxt](../library/vue.md#nuxt).

### Vanilla JavaScript on any static page

> **Example:** [`static/vanilla-umd`](../../examples/docs-examples/src/cases/static/vanilla-umd/) — `pnpm example:docs`, then open `#static/vanilla-umd`.

A page with no framework and no build step: the UMD build copied to your site, one element per
animation, one call:

```html
<div data-px-animation-src="/bouncing-ball.json"></div>
<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>PixodeskAnimator.loadTagAnimators();</script>
```

The `pixodesk-svg-animator.umd.min.js` file in the first `<script>` tag is the player itself —
one `.js` file you copy out of the npm package and put on your own site;
[Installing the players (overview)](../library/installation.md#the-three-builds--esm-cjs-and-umd)
shows exactly how. Everything you can do with the player from here — controlling playback,
reacting to events — is described in [Web player](../library/web-player.md).

## CMS and website builders

Paste the SVG's markup into the platform's HTML / code block. One thing to know first: most
of these platforms clean up any HTML you paste before publishing it — they strip out tags
they consider risky, and `<script>` is usually the first to go. When that happens to a
pre-rendered SVG of a flavour that carries a script (JS triggers, JS animation), the file
still shows, but its animation is broken or cannot start. The **SVG + CSS animation** flavour
has no `<script>` at all, so nothing can be stripped from it — it is the safe choice on any
platform that filters pasted HTML.

| Platform | Method |
|---|---|
| **WordPress** | a *Custom HTML* block, or in a theme: `<?php echo file_get_contents(get_template_directory() . '/assets/animation.svg'); ?>` |
| **Shopify** | save the SVG file as a theme *snippet* (e.g. `snippets/animation.liquid`), then put `{% render 'animation' %}` in the template where it should appear — or simply paste the SVG markup into a section's custom Liquid code |
| **Webflow** | *Embed* component → paste the SVG markup |
| **Squarespace** | *Code* block → paste the SVG markup |
| **Wix** | *Embed HTML* element → paste the SVG markup (runs in an iframe) |
| **Framer / Notion / others** | an embed / code block that accepts raw HTML |

## Before you publish — four things to check

- **Content Security Policy (CSP).** Inlined scripts (JS-triggers / JS-animation flavours)
  count as inline scripts; if your site's CSP forbids them, use the CSS flavour, or JSON with the player loaded
  from your own origin.
- ⚠️ **One copy of a file per page.** Inlining the same file twice duplicates its ids and breaks
  masks, gradients and bindings. Export a separate file for each place (every export gets its own ids) or use
  JSON, where the player gives every instance fresh ids ([read more](./on-the-web.md#one-copy-of-a-file-per-page)).
- **Sizing.** Keep the `viewBox`, remove fixed `width`/`height` if you want the SVG to scale
  with its container, and size the container with CSS.
- **Animations further down the page.** For an animation the visitor has to scroll to, use
  the *When visible* start trigger (`scrollIntoView`): it waits until the animation scrolls
  into view. Otherwise the animation plays while it is still off screen, and by the time the
  visitor reaches it, it is already over.

[← Pre-rendered SVG on the web](./on-the-web.md) · [Contents](../README.md) · Next: [Format principles →](../format/principles.md)
