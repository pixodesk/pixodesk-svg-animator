# Installing the players (overview)

[← Get started with the player library](./get-started.md) · [Contents](../../README.md#documentation) · Next: [Web player →](./web-player.md)

Install a package only if you use the **JSON** format. A pre-rendered SVG needs nothing —
the CSS flavor is plain SVG, and the JS flavor carries its own copy of the player — so if
that is your route, skip this page. (One limit to know before you commit to it: the **same**
pre-rendered file cannot be inlined twice on one page — different files are fine —
[read more](https://pixodesk.com/docs/svga/prerendered-svg/on-the-web#the-same-file-twice-on-one-page).)

## Packages

<!-- px-check off the package list, prose -->
| Package | For | Install |
|---|---|---|
| `@pixodesk/svg-animator-web` | browsers, vanilla JavaScript / any framework via the DOM | `npm install @pixodesk/svg-animator-web` |
| `@pixodesk/svg-animator-react` | React 18+ / Next.js | `npm install @pixodesk/svg-animator-react` |
| `@pixodesk/svg-animator-vue` | Vue 3 / Nuxt | `npm install @pixodesk/svg-animator-vue` |
| `@pixodesk/svg-animator-rn` 🧪 | React Native / Expo *(in development)* | `npm install @pixodesk/svg-animator-rn` — plus `react-native-svg` and `react-native-reanimated`, see [React Native](./react-native.md#install) |
| `@pixodesk/svg-animator-core` | schema, utils; no DOM | `npm install @pixodesk/svg-animator-core` |


The React and Vue packages depend on the web package; the web package depends on the core, so a
browser consumer stays self-contained.

## Builds — ESM, CJS and UMD

The web player ships in several builds, and your tooling picks the right one by itself:

- **ESM** — for a bundler (Vite, webpack, Rollup, esbuild) or any modern setup:
  `import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web'`. Nothing to configure after
  `npm install`; this is what the React and Vue packages use internally, and what every snippet
  in [Web player](./web-player.md) assumes.
- **CJS** — for Node.js and older tooling that uses `require()`. Selected automatically through
  the package's `exports` map; you never reference the file by name.
- **UMD** — for pages **without a build step**: plain HTML, CMS templates, code blocks. One
  self-contained file, `pixodesk-svg-animator.umd.min.js`, that exposes a `Pixodesk.SvgAnimator` global from a
  `<script>` tag. The rest of this section is about this build, because it is the only one
  you have to handle by hand.

**Host it yourself.** We publish only to [npm](https://www.npmjs.com/package/@pixodesk/svg-animator-web)
and [GitHub](https://github.com/pixodesk/pixodesk-svg-animator); we do not recommend loading
the player from a third-party CDN, since that puts a file you did not verify between your
page and your users. Copy the file into your site with the package's own command — no install,
no project needed:

```bash
npx @pixodesk/svg-animator-web copy-player-library js
```

It puts `pixodesk-svg-animator.umd.min.js` into `./js` (leave the folder out for the current
folder) and prints the tags that load it. The copy's first line names its version; run the
command again to update it, and it tells you which version it replaced.

Then load it with a relative path, like any other script of yours:

```html
<!-- declarative: the element names its file -->
<div data-px-animation-src="/bouncing-ball.json" style="width: 300px; height: 300px"></div>

<!-- programmatic: an empty container the player renders into -->
<div id="box" style="width: 300px; height: 300px"></div>

<script src="/js/pixodesk-svg-animator.umd.min.js"></script>
<script>

  // declarative
  Pixodesk.SvgAnimator.createSvgAnimationPlayersFromPage(); 

  // programmatic
  const a = Pixodesk.SvgAnimator.create({ src: '/bouncing-ball.json', container: '#box', playOnTrigger: true });
  
</script>
```

Because the file is a copy on your own server, it never changes behind your back: your site
keeps using the exact version you tested until you replace the file yourself. The file's name
says which library it is, so anyone reading your page source can tell — keep it, or rename it
if you prefer ([the examples](../../examples/docs-examples/src/cases/static/vanilla-umd/) keep it).

Files in `dist/`:

<!-- px-check off the dist file list, prose -->
| File | Use |
|---|---|
| `index.js` · `index.cjs` (+ `.min` variants) | ESM / CJS entry for bundlers |
| `index.d.ts` | TypeScript types |
| `pixodesk-svg-animator.umd.js` · `pixodesk-svg-animator.umd.min.js` | the full player as a `<script>` global (`Pixodesk.SvgAnimator`) |
| `index.prerendered*.umd*.js` | trimmed builds the **editor** inlines into *SVG + JS animation* exports — you never load these yourself |

## TypeScript

Every package ships types, and `doc` accepts a `.json` import as-is:

```ts
import animation from './animation.json';
// <SvgAnimationPlayer doc={animation} /> — no cast: `doc` is typed `PxDocumentInput`,
// the shape a JSON import produces; values are validated at runtime.
```

Importing a `.json` file at all requires `"resolveJsonModule": true` in your `tsconfig.json`,
under `compilerOptions`. Every package also exports the strict `PxDocument` — the
type to use when you BUILD a document in code (literal unions, autocomplete) — and
`toPxDocument(animation)`, which names the one narrowing from a JSON import to that
strict type when an advanced API asks for it (values are validated at runtime); import it
from the one you installed.

Other types you may want by name:

- `PxPageAnimationPlayerOptions` — the options `createSvgAnimationPlayersFromPage` takes.
- `PxPrerenderedAnimationPlayerOptions` — the options the pre-rendered builds take.
- `PxAnimationPlayerHandle` — the handle the components give you through `playerRef` (every framework
  package exports this one name).
- `PxPlaybackOverride` — the playback override every player accepts.

Hearing back from it: `PxAnimationPlayerCallbacks` is the single callback shape — the playback lifecycle
plus `onWarn` / `onError` — and `PxDiagnosticsConfig` is the diagnostics half of it on its own. A
handler receives a `PxDiagnostic`, whose `kind` is a `PxDiagnosticKind` saying who can act on it,
and `PxDiagnostics` is the channel object a player reports through.

## Requirements

- **Browsers:** any modern browser. The Web Animations API path needs a modern browser; the
  frame-loop fallback runs anywhere `requestAnimationFrame` exists.
- **React:** 18 or newer.
- **Vue:** 3.
- **React Native:** 0.76 or newer, with `react-native-svg` 15 or newer and
  `react-native-reanimated` 3.16 or newer.

[← Get started with the player library](./get-started.md) · [Contents](../../README.md#documentation) · Next: [Web player →](./web-player.md)
