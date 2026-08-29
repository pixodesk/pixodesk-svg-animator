# Pixodesk SVG Animator


This documentation covers the **Pixodesk SVG Animator editor**, the **player**, and the **format** between them.

- Use the **Pixodesk SVG Animator editor** — a full-featured vector and animation tool — to create animation files.  
  Import and export **Lottie** animations.  
  Export to video, GIF and static images as a fallback.
- Pick a **player** to run them — in plain **HTML**, **React**, **Vue** or **React Native**.  
  Control playback from code, or let the animation start itself on load, click
  or scroll.
- The **format** stays as close to plain SVG as it can, with a wide vector
  feature set.  
  It comes in two flavours — **JSON**, or
  **pre-rendered SVG** that embeds/inlines straight into a page.  
  Pre-rendered SVG allows: pure **CSS keyframes** for a file that needs **no JavaScript**,
  the same plus a small script for triggers, or embedded **JavaScript** running the
  player on the engine you choose — **WAAPI** or **frames**.  
  Pick whichever suits where it runs — and note that a pre-rendered file goes on a page
  **once**; for several instances of one animation, use JSON.

    
## Contents

### Get started
1. [Introduction](./01-start--introduction.md) — the editor, the file formats, the players, and how they fit together
2. [Choosing a format](./02-start--choosing-a-format.md) — JSON vs pre-rendered SVG, what each can animate, browser support

### Make animations in the editor
3. [The editor](./03-editor--editor.md) — creating shapes, animating, effects, exporting
4. [Set default playback settings & triggers](./04-editor--playback-settings.md) — duration, loops, direction, engine mode, what starts it, clock or scroll — saved with the file

### Play JSON animations
5. [Installing the players (overview)](./05-player--installation.md) — npm packages, the UMD build for pages without a bundler, TypeScript
6. [Web player (`@pixodesk/svg-animator-web`)](./06-player--web-player.md) — `createAnimator`, the playback API, callbacks, triggers
7. [React (`@pixodesk/svg-animator-react`)](./07-player--react.md) — the player component, its props, control modes, Next.js
8. [Vue (`@pixodesk/svg-animator-vue`)](./08-player--vue.md) — the player component, props, events, Nuxt
9. [React Native (`@pixodesk/svg-animator-rn`)](./09-player--react-native.md) 🧪 — install, props, feature support, limitations
10. [Playback settings & triggers](./10-player--playback-and-triggers.md) — the `animator` configuration, and overriding them from props or the player API

### Play pre-rendered SVG animations (minimal setup)
11. [Pre-rendered SVG on the web](./11-player--prerendered-svg.md) — inline, import as a component; the three flavours and how to control them
12. [Static sites & CMS](./12-player--static-sites-and-cms.md) — Astro, Jekyll, Hugo, 11ty, Gatsby, Docusaurus, WordPress, Shopify, Webflow

### Format (deep dive)
13. [Format principles](./13-format--format-principles.md) — why the format is shaped this way: the six layers it is built from and the five rules they follow
14. [JSON format reference](./14-format--json-format.md) — the document, `animator`, nodes, `animate`, keyframes, easing, loops, transforms, motion paths
15. [Player effects](./15-format--effects.md) — `transformBy`, `repeater`, `maskedBy`, `clipPath`, `strokeTrim`, `clone`, gradients, `textPath`, `text`
16. [Editor meta and applied effects](./16-format--editor-meta.md) — what the editor keeps in `meta`, applied effects vs effects, how an expanded effect folds back
17. [Meta in pre-rendered SVG](./17-format--data-px-meta.md) — the `data-px-meta` attribute: notation, what goes where, whether you can strip it
18. [Core library (`@pixodesk/svg-animator-core`)](./18-format--core-library.md) — validate, transform and sample documents without a renderer

### Get help
19. [Troubleshooting & FAQ](./19-help--troubleshooting.md)
20. [Glossary](./20-help--glossary.md)

## Go further

- [Repository README](../README.md) — package overview and examples
- [Runnable examples](../examples/docs-examples/) — one tested page per documented case (web, React, Vue, pre-rendered SVG, static sites); plus a [preview player](../examples/preview-player/) and the [React Native](../examples/react-native-preview-player/) apps
- [pixodesk.com](https://pixodesk.com) — Pixodesk SVG Animator editor
