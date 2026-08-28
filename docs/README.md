# Pixodesk SVG Animator


This documentation covers the **Pixodesk editor**, the **player**, and the **format** between them.

- Use the **editor** — a full-featured vector and animation tool — to create
  animation files.  
  Import and export **Lottie** animations.  
  Export to video, GIF and still images as a fallback.
- Pick a **player** to run them — in plain **HTML**, **React**, **Vue** or **React Native**.  
  Control playback from code, or let the animation start itself on load, click
  or scroll.
- The **format** stays as close to plain SVG as it can, with a wide vector
  feature set.  
  It comes in two flavours — canonical **JSON**, or
  **pre-rendered SVG** that embeds/inlines straight into a page.  
  Pre-rendered goes further: pure **CSS keyframes** for a file that needs no JavaScript,
  the same plus a small script for triggers, or embedded **JS** running the
  player on the engine you choose — **WAAPI** or **frames**.  
  Pick whichever suits where it runs.

    
## Contents

### Get started
1. [Introduction](./01-start--introduction.md) — the editor, the file formats, the players, and how they fit together
2. [Choosing a format](./02-start--choosing-a-format.md) — JSON vs pre-rendered SVG, what each can animate, browser support

### Make animations in the editor
3. [The editor](./03-editor--editor.md) — creating shapes, animating, effects, exporting
4. [Set default playback settings & triggers](./04-editor--playback-settings.md) — duration, loops, direction, engine mode, what starts it, clock or scroll — saved with the file

### Play JSON animations
5. [Installing the players](./05-player--installation.md) — npm packages, CDN builds, TypeScript
6. [Web player (`@pixodesk/svg-animator-web`)](./06-player--web-player.md) — `createAnimator`, the playback API, callbacks, triggers
7. [React (`@pixodesk/svg-animator-react`)](./07-player--react.md) — the component, its props, control modes, Next.js
8. [Vue (`@pixodesk/svg-animator-vue`)](./08-player--vue.md) — the component, props, events, Nuxt
9. [React Native (`@pixodesk/svg-animator-rn`)](./09-player--react-native.md) 🧪 — install, props, feature support, limitations
10. [Playback settings & triggers](./10-player--playback-and-triggers.md) — the `animator` fields in full, and overriding them from props or the player API

### Play pre-rendered SVG animations (minimal setup)
11. [Pre-rendered SVG on the web](./11-player--prerendered-svg.md) — inline, `<img>`, framework imports; the three flavours and how to control them
12. [Static sites & CMS](./12-player--static-sites-and-cms.md) — Astro, Next.js, Nuxt, SvelteKit, Angular, Jekyll, 11ty, WordPress, Shopify, Webflow…

### Format (deep dive)
13. [Format principles](./13-format--format-principles.md) — why the format is shaped this way: the six layers it is built from and the five rules they follow
14. [JSON format reference](./14-format--json-format.md) — the document, `animator`, nodes, `animate`, keyframes, easing, loops, transforms, motion paths
15. [Effects reference](./15-format--effects.md) — `transformBy`, `repeater`, `maskedBy`, `clipPath`, `strokeTrim`, `clone`, gradients, `textPath`, `text`
16. [Core library (`@pixodesk/svg-animator-core`)](./16-format--core-library.md) — validate, transform and sample documents without a renderer

### Get help
17. [Troubleshooting & FAQ](./17-help--troubleshooting.md)
18. [Glossary](./18-help--glossary.md)

## Go further

- [Repository README](../README.md) — package overview and examples
- [Runnable examples](../examples/) — web, React, Vue, a side-by-side preview player, React Native
- [Full format design spec](../SCHEMA-DESIGN.md) — for contributors and tool authors
- [pixodesk.com](https://pixodesk.com) — the editor
