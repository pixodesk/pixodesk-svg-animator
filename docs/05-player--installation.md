# Installing the players (overview)

[← Set default playback settings & triggers](./04-editor--playback-settings.md) · [Contents](./README.md) · Next: [Web player →](./06-player--web-player.md)

Install a package only if you use the **JSON** format. A pre-rendered SVG needs nothing —
the CSS flavour is plain SVG, and the JS flavour carries its own copy of the player — so if
that is your route, skip this page.

## Packages

| Package | For | Install |
|---|---|---|
| `@pixodesk/svg-animator-web` | browsers, vanilla JavaScript / any framework via the DOM | `npm install @pixodesk/svg-animator-web` |
| `@pixodesk/svg-animator-react` | React 18+ / Next.js | `npm install @pixodesk/svg-animator-react` |
| `@pixodesk/svg-animator-vue` | Vue 3 / Nuxt | `npm install @pixodesk/svg-animator-vue` |
| `@pixodesk/svg-animator-rn` 🧪 | React Native / Expo (experimental) | `npm install @pixodesk/svg-animator-rn` + peers, see [React Native](./09-player--react-native.md#install) |
| `@pixodesk/svg-animator-core` | tools — validate, transform, sample documents; no DOM | `npm install @pixodesk/svg-animator-core` |

All packages are published in lockstep and a player depends on the matching core version,
so upgrading a player upgrades the core with it. `pnpm` and `yarn` work the same way.

The React and Vue packages depend on the web package; the web package bundles the core, so a
browser consumer stays self-contained.

## Without a bundler — the UMD build

The web player ships as ESM, CJS and **UMD**. The UMD file, `index.umd.min.js`, is a single
self-contained script that exposes a `PixodeskAnimator` global — for plain HTML pages, CMS
templates and anything else without a build step.

**Host it yourself.** We publish only to [npm](https://www.npmjs.com/package/@pixodesk/svg-animator-web)
and [GitHub](https://github.com/pixodesk/pixodesk-svg-animator); we do not recommend loading
the player from a third-party CDN, since that puts a file you did not verify between your
page and your users. Get the file from the npm package and serve it alongside your site:

```bash
npm install @pixodesk/svg-animator-web
cp node_modules/@pixodesk/svg-animator-web/dist/index.umd.min.js ./js/pixodesk-svg-animator.umd.min.js
```

No project to install into? `npm pack @pixodesk/svg-animator-web` downloads the exact package
tarball; the file is at `package/dist/index.umd.min.js` inside it.

Then load it with a relative path, like any other script of yours:

```html
<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>
  PixodeskAnimator.loadTagAnimators();                       // declarative
  const a = PixodeskAnimator.createAnimator({ src: '/a.json', container: '#box' }); // programmatic
</script>
```

The copied file is pinned by nature — your site keeps playing the version you tested until you
choose to update it. Renaming it is optional; the [examples](../examples/web/) use
`pixodesk-svg-animator.umd.min.js` so the name says what it is.

Files in `dist/`:

| File | Use |
|---|---|
| `index.js` · `index.cjs` (+ `.min` variants) | ESM / CJS entry for bundlers |
| `index.d.ts` | TypeScript types |
| `index.umd.js` · `index.umd.min.js` | the full player as a `<script>` global (`PixodeskAnimator`) |
| `index.prerendered*.umd*.js` | trimmed builds the **editor** inlines into *SVG + JS animation* exports — you never load these yourself |

## TypeScript

Every package ships types. Importing a JSON file gives you a plain object; if your `tsconfig`
complains about the shape, cast it once:

```ts
import type { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import _animation from './animation.json';
const animation = _animation as PxAnimatedSvgDocument;
```

(`resolveJsonModule: true` is required to import `.json` files at all.) The same type is
exported by the core and React Native packages.

## Requirements

- **Browsers:** any modern browser. The Web Animations API path needs a modern browser; the
  frame-loop fallback runs anywhere `requestAnimationFrame` exists.
- **React:** 18 or newer. **Vue:** 3. **React Native:** 0.76+, with `react-native-svg` ≥ 15 and
  `react-native-reanimated` ≥ 3.16.

[← Set default playback settings & triggers](./04-editor--playback-settings.md) · [Contents](./README.md) · Next: [Web player →](./06-player--web-player.md)
