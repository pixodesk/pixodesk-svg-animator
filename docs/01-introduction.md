# Introduction

[← Contents](./README.md) · Next: [Quick start →](./02-quick-start.md)

Pixodesk SVG Animator is three things that work together:

| Piece | What it is | Where |
|---|---|---|
| **The editor** | A vector & animation editor — draw or import SVG, animate it on a timeline, export | [pixodesk.com](https://pixodesk.com) (web app and the *Pixodesk Animator Studio* desktop app) |
| **The file formats** | A **JSON** document (elements + animation data) or a **pre-rendered SVG** (animation embedded in a normal `.svg`) | Written by the editor, read by the players and by browsers |
| **The players** | Small open-source runtime libraries that play the JSON on the web, in React, Vue and React Native | [this repository](../README.md), MIT-licensed, on npm as `@pixodesk/svg-animator-*` |

```
  ┌──────────────┐   export   ┌───────────────────────────┐   play    ┌──────────────────────┐
  │  the editor  │ ─────────▶ │  JSON  ·  pre-rendered SVG │ ────────▶ │ browser · React · Vue │
  └──────────────┘            └───────────────────────────┘           │ React Native          │
                                                                       └──────────────────────┘
```

## What people build with it

Splash screens, animated backgrounds, icon animations, loaders, illustrations that react to
hover / click / scroll, and animated logos — anything you would otherwise reach for a GIF, a
video or a Lottie file for, but as crisp, tiny, scalable SVG.

## The two formats, in one paragraph each

**Pre-rendered SVG** is a normal `.svg` file with the animation baked in. Drop it into any
page, CMS or static-site generator and it plays — no library needed for the CSS flavour. It is
the simplest option and the right one for most icons, loaders and decorative animation.

**JSON** is the full-fidelity format: a small document describing the SVG tree plus its
animation. A player library renders it and gives you complete runtime control — play, pause,
seek, reverse, speed — and supports every animation type on every browser. It is the right
choice for apps (React / Vue / React Native), for complex animations, and whenever you need to
drive the animation from code.

Both come out of the same editor document, and the editor converts between them at any time.
[Choosing a format](./03-choosing-a-format.md) has the decision table.

## Which package do I need?

| You are building… | Use | Install |
|---|---|---|
| A plain HTML page, or you just want to drop a file in | a **pre-rendered SVG** — no package at all | — |
| A page with vanilla JavaScript, and you want runtime control | JSON + the **web player** | `@pixodesk/svg-animator-web` |
| A React / Next.js app | JSON + the **React component** | `@pixodesk/svg-animator-react` |
| A Vue / Nuxt app | JSON + the **Vue component** | `@pixodesk/svg-animator-vue` |
| A React Native / Expo app | JSON + the **React Native component** 🧪 | `@pixodesk/svg-animator-rn` |
| Tooling that validates, transforms or samples documents without rendering | the **core** | `@pixodesk/svg-animator-core` |

The React and Vue packages wrap the web player; every player shares the core, so the same
document produces the same frames everywhere.

```
                    svg-animator-core          (schema · materialisers · sampling — no DOM)
                       ↑              ↑
        svg-animator-web        svg-animator-rn 🧪   (react-native-svg + reanimated)
          ↑          ↑
  -react       -vue
```

## Status

The project is **under active development**. The web, React and Vue players are the most
mature; the React Native player is **experimental** (its API may change, and a few features are
unverified on device — see [React Native](./10-react-native.md#feature-support)). All packages
are released in lockstep: a player always depends on the matching core version.

## Where next

- Never used it before → [Quick start](./02-quick-start.md)
- Deciding on a format → [Choosing a format](./03-choosing-a-format.md)
- Want to understand the file → [JSON format reference](./13-json-format.md) or the two-page [Format principles](./16-format-principles.md)

[← Contents](./README.md) · Next: [Quick start →](./02-quick-start.md)
