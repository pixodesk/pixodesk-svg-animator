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
| **Next.js** | CSS flavour: `import Animation from './animation.svg'` with `@svgr/webpack`; scripted flavours: read the file and render with `dangerouslySetInnerHTML` | [`@pixodesk/svg-animator-react`](./07-player--react.md#nextjs) in a client component |
| **Nuxt** | `vite-svg-loader` for the CSS flavour; raw import (`?raw`) + `v-html` for scripted flavours | [`@pixodesk/svg-animator-vue`](./08-player--vue.md#nuxt) |
| **SvelteKit** | `import svg from './animation.svg?raw';` then `{@html svg}` | web player in `onMount` |
| **Angular** | `import svg from './animation.svg?raw';` then `<div [innerHTML]="svg"></div>` (sanitizer: use `bypassSecurityTrustHtml` for scripted flavours) | web player in `ngAfterViewInit` |
| **Gatsby** | `gatsby-plugin-react-svg` (CSS flavour) or `dangerouslySetInnerHTML` with the raw file | React component |
| **Jekyll** | `{% include_relative assets/animation.svg %}` | UMD script tag |
| **Hugo** | `{{ readFile "static/animation.svg" \| safeHTML }}` | UMD script tag |
| **11ty (Eleventy)** | `{% include "animation.svg" %}` | UMD script tag |
| **Docusaurus / MDX** | import the CSS flavour as a component (SVGR is built in) or paste the markup | React component |

A "raw import + set HTML" inlines the file verbatim, scripts included — that is what makes the
JS-triggers and JS-animation flavours work in these frameworks. A component import (SVGR,
`vite-svg-loader`) parses the SVG and drops scripts, so it suits the CSS flavour only.

### Vanilla JavaScript on any static page

> **Example:** [`static/vanilla-umd`](../examples/docs-examples/src/cases/static/vanilla-umd/) — `pnpm example:docs`, then open `#static/vanilla-umd`.

```html
<div data-px-animation-src="/animation.json"></div>
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
- **Repeated animations.** Inlining the same file twice duplicates its ids. Export it twice (each
  export gets fresh ids) or use JSON, which regenerates ids per instance.
- **Sizing.** Keep the `viewBox`, remove fixed `width`/`height` if you want the SVG to scale
  with its container, and size the container with CSS.
- **Lazy pages.** The `scrollIntoView` trigger starts the animation only when it becomes
  visible — a good default for anything below the fold.

[← Pre-rendered SVG on the web](./11-player--prerendered-svg.md) · [Contents](./README.md) · Next: [Format principles →](./13-format--format-principles.md)
