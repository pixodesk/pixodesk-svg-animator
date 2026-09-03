# Installing the players (overview)

[← Set default playback settings & triggers](./04-editor--playback-settings.md) · [Contents](./README.md) · Next: [Web player →](./06-player--web-player.md)

Install a package only if you use the **JSON** format. A pre-rendered SVG needs nothing —
the CSS flavour is plain SVG, and the JS flavour carries its own copy of the player — so if
that is your route, skip this page. (One limit to know before you commit to it: a pre-rendered
file can be inlined **once per page** — [read more](./11-player--prerendered-svg.md#one-copy-of-a-file-per-page).)

## Packages

| Package | For | Install |
|---|---|---|
| `@pixodesk/svg-animator-web` | browsers, vanilla JavaScript / any framework via the DOM | `npm install @pixodesk/svg-animator-web` |
| `@pixodesk/svg-animator-react` | React 18+ / Next.js | `npm install @pixodesk/svg-animator-react` |
| `@pixodesk/svg-animator-vue` | Vue 3 / Nuxt | `npm install @pixodesk/svg-animator-vue` |
| `@pixodesk/svg-animator-rn` 🧪 | React Native / Expo *(in development)* | `npm install @pixodesk/svg-animator-rn` — plus `react-native-svg` and `react-native-reanimated`, see [React Native](./09-player--react-native.md#install) |
| `@pixodesk/svg-animator-core` | schema, utils; no DOM | `npm install @pixodesk/svg-animator-core` |


The React and Vue packages depend on the web package; the web package depends on the core, so a
browser consumer stays self-contained.

## The three builds — ESM, CJS and UMD

The web player ships in three builds, and your tooling picks the right one by itself:

- **ESM** — for a bundler (Vite, webpack, Rollup, esbuild) or any modern setup:
  `import { createAnimator } from '@pixodesk/svg-animator-web'`. Nothing to configure after
  `npm install`; this is what the React and Vue packages use internally, and what every snippet
  in [Web player](./06-player--web-player.md) assumes.
- **CJS** — for Node.js and older tooling that uses `require()`. Selected automatically through
  the package's `exports` map; you never reference the file by name.
- **UMD** — for pages **without a build step**: plain HTML, CMS templates, code blocks. One
  self-contained file, `pixodesk-svg-animator.umd.min.js`, that exposes a `PixodeskAnimator` global from a
  `<script>` tag. The rest of this section is about this build, because it is the only one
  you have to handle by hand.

**Host it yourself.** We publish only to [npm](https://www.npmjs.com/package/@pixodesk/svg-animator-web)
and [GitHub](https://github.com/pixodesk/pixodesk-svg-animator); we do not recommend loading
the player from a third-party CDN, since that puts a file you did not verify between your
page and your users. Get the file from the npm package and serve it alongside your site:

```bash
npm install @pixodesk/svg-animator-web
cp node_modules/@pixodesk/svg-animator-web/dist/pixodesk-svg-animator.umd.min.js ./js/
```

No project to install into? `npm pack @pixodesk/svg-animator-web` downloads the exact package
tarball; the file is at `package/dist/index.umd.min.js` inside it.

Then load it with a relative path, like any other script of yours:

```html
<!-- declarative: the element names its file -->
<div data-px-animation-src="/bouncing-ball.json" style="width: 300px; height: 300px"></div>

<!-- programmatic: an empty container the player renders into -->
<div id="box" style="width: 300px; height: 300px"></div>

<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>

  // declarative
  PixodeskAnimator.loadTagAnimators(); 

  // programmatic
  const a = PixodeskAnimator.createAnimator({ src: '/bouncing-ball.json', container: '#box' });
  
</script>
```

Because the file is a copy on your own server, it never changes behind your back: your site
keeps using the exact version you tested until you replace the file yourself. The file's name
says which library it is, so anyone reading your page source can tell — keep it, or rename it
if you prefer ([the examples](../examples/docs-examples/src/cases/static/vanilla-umd/) keep it).

Files in `dist/`:

| File | Use |
|---|---|
| `index.js` · `index.cjs` (+ `.min` variants) | ESM / CJS entry for bundlers |
| `index.d.ts` | TypeScript types |
| `pixodesk-svg-animator.umd.js` · `pixodesk-svg-animator.umd.min.js` | the full player as a `<script>` global (`PixodeskAnimator`) |
| `index.prerendered*.umd*.js` | trimmed builds the **editor** inlines into *SVG + JS animation* exports — you never load these yourself |

## TypeScript

Every package ships types. Importing a JSON file gives you a plain object; if your `tsconfig`
complains about the shape, cast it once:

```ts
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import _animation from './animation.json';
const animation = _animation as PxAnimatedSvgDocument;
```

Importing a `.json` file at all requires `"resolveJsonModule": true` in your `tsconfig.json`,
under `compilerOptions`. The same `PxAnimatedSvgDocument` type is exported by the core and React
Native packages.

## Requirements

- **Browsers:** any modern browser. The Web Animations API path needs a modern browser; the
  frame-loop fallback runs anywhere `requestAnimationFrame` exists.
- **React:** 18 or newer.
- **Vue:** 3.
- **React Native:** 0.76 or newer, with `react-native-svg` 15 or newer and
  `react-native-reanimated` 3.16 or newer.

[← Set default playback settings & triggers](./04-editor--playback-settings.md) · [Contents](./README.md) · Next: [Web player →](./06-player--web-player.md)
