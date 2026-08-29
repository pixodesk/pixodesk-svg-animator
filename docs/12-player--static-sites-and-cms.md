# Static sites & CMS

[← Pre-rendered SVG on the web](./11-player--prerendered-svg.md) · [Contents](./README.md) · Next: [Format principles →](./13-format--format-principles.md)

Building with a static-site generator or a CMS? Use a pre-rendered SVG: the build tool or
CMS **inlines the file** and the animation is on screen before any JavaScript runs. Even the
flavours with a `<script>` just work when inlined. Where a framework also runs client code,
the JSON format with a player is available too.

## Static site generators

| Framework | Inline a pre-rendered SVG | JSON alternative |
|---|---|---|
| **Astro** | `import svg from './animation.svg?raw';` then `<Fragment set:html={svg} />` | use the React or Vue component inside an island (`client:load`) |
| **Gatsby** | `gatsby-plugin-react-svg` (CSS flavour) or `dangerouslySetInnerHTML` with the raw file | React component |
| **Jekyll** | `{% include_relative assets/animation.svg %}` | UMD script tag |
| **Hugo** | `{{ readFile "static/animation.svg" \| safeHTML }}` | UMD script tag |
| **11ty (Eleventy)** | `{% include "animation.svg" %}` | UMD script tag |
| **Docusaurus / MDX** | import the CSS flavour as a component (SVGR is built in) — [example below](#docusaurus--mdx) | React component |

A "raw import + set HTML" inlines the file verbatim, scripts included — that is what makes the
JS-triggers and JS-animation flavours work in these generators. A component import (SVGR,
`vite-svg-loader`) parses the SVG and drops scripts, so it suits the CSS flavour only.

### Docusaurus / MDX

Docusaurus imports `.svg` files as React components through SVGR, so a CSS-flavour export drops
into any `.mdx` page like an icon:

```mdx
import Ball from './animation.svg';

# Our loader

<Ball style={{ width: 300, height: 300 }} />
```

An *On load* export plays on its own. For a hover, click or scroll trigger, wrap it in the
React package's `PixodeskSvgCssAnimator`, which toggles the play classes for you:

```mdx
import Ball from './animation.svg';
import { PixodeskSvgCssAnimator } from '@pixodesk/svg-animator-react';

<PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause" style={{ width: 300, height: 300 }}>
  <Ball />
</PixodeskSvgCssAnimator>
```

One setting matters: Docusaurus runs **SVGO** on imported SVGs, and SVGO's `inlineStyles`
optimisation moves the class-based rules out of `<style>` onto the elements — which removes the
class gate the animation depends on. Turn it off for the SVGR plugin in `docusaurus.config.js`:

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

(`raw-loader` is a one-line `npm install`; Docusaurus documents this pattern for raw file imports.)

Application frameworks that render on the client — Next.js, Nuxt, SvelteKit, Angular — are a
different case: there the JSON format with a player is the natural fit. See
[React → Next.js](./07-player--react.md#nextjs) and [Vue → Nuxt](./08-player--vue.md#nuxt).

### Vanilla JavaScript on any static page

> **Example:** [`static/vanilla-umd`](../examples/docs-examples/src/cases/static/vanilla-umd/) — `pnpm example:docs`, then open `#static/vanilla-umd`.

```html
<div data-px-animation-src="/bouncing-ball.json"></div>
<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>PixodeskAnimator.loadTagAnimators();</script>
```

The script is the player's UMD build, served from your own site — how to get it is in
[Installing the players (overview)](./05-player--installation.md#without-a-bundler--the-umd-build). The
API is in [Web player](./06-player--web-player.md).

## CMS and website builders

Paste the SVG's markup into the platform's HTML / code block. Where the platform sanitises
HTML (most do for `<script>`), the CSS flavour is the safe choice.

| Platform | Method |
|---|---|
| **WordPress** | a *Custom HTML* block, or in a theme: `<?php echo file_get_contents(get_template_directory() . '/assets/animation.svg'); ?>` |
| **Shopify** | add the SVG as a snippet and `{% render 'animation' %}` it, or paste it into a section's custom Liquid |
| **Webflow** | *Embed* component → paste the SVG markup |
| **Squarespace** | *Code* block → paste the SVG markup |
| **Wix** | *Embed HTML* element → paste the SVG markup (runs in an iframe) |
| **Framer / Notion / others** | an embed / code block that accepts raw HTML |

## Tips

- **Content Security Policy.** Inlined scripts (JS-triggers / JS-animation flavours) count as
  inline scripts; if your CSP forbids them, use the CSS flavour, or JSON with the player loaded
  from your own origin.
- ⚠️ **One copy of a file per page.** Inlining the same file twice duplicates its ids and breaks
  masks, gradients and bindings. Export a separate file for each place (every export gets its own ids) or use
  JSON, where the player gives every instance fresh ids ([read more](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page)).
- **Sizing.** Keep the `viewBox`, remove fixed `width`/`height` if you want the SVG to scale
  with its container, and size the container with CSS.
- **Lazy pages.** The `scrollIntoView` trigger starts the animation only when it becomes
  visible — a good default for anything below the fold.

[← Pre-rendered SVG on the web](./11-player--prerendered-svg.md) · [Contents](./README.md) · Next: [Format principles →](./13-format--format-principles.md)
