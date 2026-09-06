# pixodesk-svg-animator

[![CI](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pixodesk/pixodesk-svg-animator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🚧 This project is currently under development.

<img src="boat.svg" width="100%"/>

The official runtime libraries and file formats for playing SVG animations created with the
[Pixodesk SVG Animator](https://pixodesk.com) editor — splash screens, animated backgrounds,
icon animations, loaders.

- **The player** runs the animation on a page or in an app: a library for plain **HTML**,
  **React**, **Vue** or **React Native** (in development) — or none at all, because a
  pre-rendered SVG file plays on its own.
- **The format** stays as close to plain SVG as it can. One animation, two shapes:
  **JSON** (the source a player renders and you control from code) and **pre-rendered SVG**
  (a finished `.svg` you embed or inline straight into a page).
- **The editor** — a full-featured vector and animation tool — creates the files in either
  shape and sets their playback defaults.

## Pick your path

- 🚀 [Play a pre-rendered SVG](./docs/prerendered-svg/README.md) — no library, embed or inline the file
- ⚛️ [Use in React / Next.js](./docs/library/react.md) · 💚 [Vue / Nuxt](./docs/library/vue.md) · 🌐 [Plain HTML / vanilla JS](./docs/library/web-player.md)
- 📱 [React Native](./docs/library/react-native.md) 🧪 *(experimental)*
- 🤔 [Which format do I need?](./docs/start/choosing-a-format.md) — JSON vs pre-rendered SVG, what each can animate
- 📄 [The JSON format](./docs/format/README.md) — the full reference · [SCHEMA.md](./SCHEMA.md) — the compact printable schema

**The full documentation lives in [`docs/`](./docs/README.md)** — the editor, every player's API,
both file formats, troubleshooting.

## Packages

| Package | Description |
|---------|-------------|
| **[@pixodesk/svg-animator-core](./packages/svg-animator-core/README.md)** | Platform-neutral core — schema, document types, interpolation, effect materialisers and path sampling. No DOM. Shared by every player; you only depend on it directly to inspect or transform documents. |
| **[@pixodesk/svg-animator-web](./packages/svg-animator-web/README.md)** | Web player — renders JSON animations in the browser via the Web Animations API or `requestAnimationFrame`. Ships as ESM, CJS, and UMD. |
| **[@pixodesk/svg-animator-react](./packages/svg-animator-react/README.md)** | React component — SSR-safe wrapper around the web player |
| **[@pixodesk/svg-animator-vue](./packages/svg-animator-vue/README.md)** | Vue component — SSR-safe wrapper around the web player |
| **[@pixodesk/svg-animator-rn](./packages/svg-animator-rn/README.md)** 🧪 | **Experimental** — React Native player built on `react-native-svg` + `react-native-reanimated`. Component API mirrors the React package. See its README for the current feature gaps. |

How they fit together:

```
                    svg-animator-core          (schema · materialisers · sampling — no DOM)
                       ↑              ↑
        svg-animator-web        svg-animator-rn 🧪   (react-native-svg + reanimated)
          ↑          ↑
  -react       -vue
```

The same document format feeds every player: the core flattens effects, loops and
motion paths once, and each player renders the result its own way.

## Examples

Examples in [`examples/`](examples/):

| Example | Package | Run |
|---------|---------|-----|
| [docs-examples](examples/docs-examples/) | one page per documented case — web, React, Vue, pre-rendered SVG, static sites — with a browser to step through them; every case is tested on each build | `pnpm example:docs` |
| [preview-player](examples/preview-player/) | web / react / vue side by side | `pnpm example:preview` |
| [react-native-preview-player](examples/react-native-preview-player/) 🧪 | `@pixodesk/svg-animator-rn` | `pnpm example:rn` |
| [react-native-feature-explorer](examples/react-native-feature-explorer/) 🧪 | `@pixodesk/svg-animator-rn` — all 118 feature fixtures | `pnpm example:rn:explorer` |

## License

[MIT](LICENSE) © [Pixodesk](https://pixodesk.com)
