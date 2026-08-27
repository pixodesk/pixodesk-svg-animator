# Pixodesk SVG Animator — Documentation

Everything you need to **make** an SVG animation in the Pixodesk editor, **choose** a file
format, and **play** it on the web, in React, Vue or React Native — from zero.

> New here? Read the [Introduction](./01-introduction.md), then do the
> [Quick start](./02-quick-start.md). Ten minutes, start to finish.

## Start here

| I want to… | Go to |
|---|---|
| Understand what this is and which piece I need | [Introduction](./01-introduction.md) |
| Get an animation on a page in ten minutes | [Quick start](./02-quick-start.md) |
| Decide between the JSON and pre-rendered SVG formats | [Choosing a format](./03-choosing-a-format.md) |
| Learn the editor | [The editor](./04-editor.md) |

## Contents

### Getting started
1. [Introduction](./01-introduction.md) — the editor, the file formats, the players, and how they fit together
2. [Quick start](./02-quick-start.md) — export from the editor and embed it, three ways
3. [Choosing a format](./03-choosing-a-format.md) — JSON vs pre-rendered SVG, what each can animate, browser support

### Making animations
4. [The editor](./04-editor.md) — creating shapes, animating, effects, playback settings, exporting

### Playing animations
5. [Installing the players](./05-installation.md) — npm packages, CDN builds, TypeScript
6. [Pre-rendered SVG on the web](./06-prerendered-svg.md) — inline, `<img>`, framework imports; the three flavours and how to control them
7. [Web player (`@pixodesk/svg-animator-web`)](./07-web-player.md) — `createAnimator`, the playback API, callbacks, triggers
8. [React (`@pixodesk/svg-animator-react`)](./08-react.md) — the component, its props, control modes, Next.js
9. [Vue (`@pixodesk/svg-animator-vue`)](./09-vue.md) — the component, props, events, Nuxt
10. [React Native (`@pixodesk/svg-animator-rn`)](./10-react-native.md) 🧪 — install, props, feature support, limitations
11. [Static sites & CMS](./11-static-sites-and-cms.md) — Astro, Next.js, Nuxt, SvelteKit, Angular, Jekyll, 11ty, WordPress, Shopify, Webflow…
12. [Playback settings & triggers](./12-playback-and-triggers.md) — duration, loops, direction, engine modes, start triggers, scroll-driven playback

### Reference
13. [JSON format reference](./13-json-format.md) — the document, `animator`, nodes, `animate`, keyframes, easing, loops, transforms, motion paths
14. [Effects reference](./14-effects.md) — `transformBy`, `repeater`, `maskedBy`, `clipPath`, `strokeTrim`, `clone`, gradients, `textPath`, `text`
15. [Core library (`@pixodesk/svg-animator-core`)](./15-core-library.md) — validate, transform and sample documents without a renderer
16. [Format principles](./16-format-principles.md) — the six layers in two pages, with a link to the full design spec

### Help
17. [Troubleshooting & FAQ](./17-troubleshooting.md)
18. [Glossary](./18-glossary.md)

## Other resources

- [Repository README](../README.md) — package overview and examples
- [Runnable examples](../examples/) — web, React, Vue, a side-by-side preview player, React Native
- [Full format design spec](../SCHEMA-DESIGN.md) — for contributors and tool authors
- [pixodesk.com](https://pixodesk.com) — the editor
