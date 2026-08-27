# Installing the players

[← The editor](./04-editor.md) · [Contents](./README.md) · Next: [Pre-rendered SVG on the web →](./06-prerendered-svg.md)

You only need a package for the **JSON** format. Pre-rendered SVG files need nothing — the
CSS flavour is plain SVG, and the JS flavour carries its own copy of the player.

## Packages

| Package | For | Install |
|---|---|---|
| `@pixodesk/svg-animator-web` | browsers, vanilla JavaScript / any framework via the DOM | `npm install @pixodesk/svg-animator-web` |
| `@pixodesk/svg-animator-react` | React 18+ / Next.js | `npm install @pixodesk/svg-animator-react` |
| `@pixodesk/svg-animator-vue` | Vue 3 / Nuxt | `npm install @pixodesk/svg-animator-vue` |
| `@pixodesk/svg-animator-rn` 🧪 | React Native / Expo (experimental) | `npm install @pixodesk/svg-animator-rn` + peers, see [React Native](./10-react-native.md#install) |
| `@pixodesk/svg-animator-core` | tools — validate, transform, sample documents; no DOM | `npm install @pixodesk/svg-animator-core` |

All packages are published in lockstep and a player depends on the matching core version,
so upgrading a player upgrades the core with it. `pnpm` and `yarn` work the same way.

The React and Vue packages depend on the web package; the web package bundles the core, so a
browser consumer stays self-contained.

## Without a bundler — the UMD build

The web player ships as ESM, CJS and **UMD**. The UMD file exposes a `PixodeskAnimator` global:

```html
<script src="https://unpkg.com/@pixodesk/svg-animator-web/dist/index.umd.min.js"></script>
<script>
  PixodeskAnimator.loadTagAnimators();                       // declarative
  const a = PixodeskAnimator.createAnimator({ src: '/a.json', container: '#box' }); // programmatic
</script>
```

Pin a version in production (`…/svg-animator-web@1.0.30/dist/…`). jsDelivr works the same way
(`https://cdn.jsdelivr.net/npm/@pixodesk/svg-animator-web/dist/index.umd.min.js`), or copy the
file from `node_modules/@pixodesk/svg-animator-web/dist/` into your site.

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

[← The editor](./04-editor.md) · [Contents](./README.md) · Next: [Pre-rendered SVG on the web →](./06-prerendered-svg.md)
