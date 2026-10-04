# Get started with the player library

[Contents](../../README.md#documentation) · Next: [Library documentation →](./README.md)

The shortest path from a blank canvas to an animation playing in your page or app: make the
animation in the editor, save it as a JSON file, put the file next to your code, install one npm
package, render the file with it. Nothing to configure.

```text
the editor  ──save──▶  animation.json  ──import──▶  <PixodeskSvgAnimator doc={animation} />
```

Everything on this page has a longer version — the [library documentation](./README.md)
for every player and option, the [format documentation](../format/README.md) for the file itself.
You do not need either to get the first animation playing.

Every section below links to a complete example project in
[`examples/get-started`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started) — one project per section, each with its own `package.json` and
nothing shared, so it is exactly what the section describes. **Open in StackBlitz** runs it in
your browser tab, code and page side by side, nothing installed. To run one on your machine,
take just its folder:

```bash
npx giget@latest gh:pixodesk/pixodesk-svg-animator/examples/get-started/react my-animation
cd my-animation && npm install && npm run dev
```

## 1. Make the animation and save it as JSON

1. Open Pixodesk SVG Animator ([download](https://pixodesk.com/svg-animator/download)). On the
   welcome screen keep the file type at **Pixodesk animation** (`.json`) and click **Create**.
2. Draw something — or **File › Import** an SVG from Figma, Illustrator or Inkscape — and animate
   it on the timeline. New to the editor?
   [Your first animation](https://pixodesk.com/docs/svga/editor/quick-start#your-first-animation)
   takes ten minutes.
3. **File › Save** (`⌘ / Ctrl + S`) and name the file `animation.json`.

The file is the whole animation: the SVG, the keyframes, and the playback settings — how long,
how many times, and what starts it (load, hover, click or scroll into view). A player reads it and
plays it; nothing else is needed.

Already have a document saved as SVG or Lottie? **File › Save As JSON (for Web, React, Vue)**
writes the same document as JSON.

## 2. Put the file in your project

Save it — or copy it — next to the component that will show it:

```text
src/
  components/
    Hero.tsx          ← your component
    animation.json    ← the file from the editor
```

A plain page without a bundler keeps it next to the HTML file instead (see
[Plain HTML](#plain-html)).

**TypeScript:** a `.json` import is typed as a plain object, so your editor may flag
`doc={animation}` (a string field is not the literal the document type expects). Cast it once —
`animation as PxAnimatedSvgDocument`, the type comes from the package you installed — and make
sure `"resolveJsonModule": true` is in your `tsconfig.json`; both are spelled out in
[Installing the players › TypeScript](./installation.md#typescript).

## 3. Install the player and render the file

One package, chosen by where the animation runs:

<!-- px-check off the stack → package list, prose -->
| Where it runs | Package | Steps |
|---|---|---|
| React, Next.js | `@pixodesk/svg-animator-react` | [React](#react) |
| Vue, Nuxt | `@pixodesk/svg-animator-vue` | [Vue](#vue) |
| Plain HTML, vanilla JavaScript, any framework via the DOM | `@pixodesk/svg-animator-web` | [Plain HTML](#plain-html) |
| React Native, Expo 🧪 | `@pixodesk/svg-animator-rn` | [React Native](#react-native) |

Every snippet below plays the file the way the editor saved it — the same start trigger, the same
loop. Run your dev server as usual (`npm run dev`) and open the page.

## React

> **Example:** [`examples/get-started/react`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/react) — the complete project · [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/react?startScript=dev&title=Get%20started%20%C2%B7%20React)

```bash
npm install @pixodesk/svg-animator-react
```

```tsx
// src/components/Hero.tsx
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-react';
import animation from './animation.json';

export function Hero() {
  return (
    <div style={{ width: 300, height: 300 }}>
      <PixodeskSvgAnimator doc={animation} autoplay />
    </div>
  );
}
```

The component renders the document's `<svg>` and fills the element around it, so size that
element.

**Next.js:** the same component; mark the file that uses it as a client component with
`'use client';` on its first line. Details: [Next.js](./nextjs.md).

## Vue

> **Example:** [`examples/get-started/vue`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/vue) — the complete project · [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/vue?startScript=dev&title=Get%20started%20%C2%B7%20Vue)

```bash
npm install @pixodesk/svg-animator-vue
```

```vue
<!-- src/components/Hero.vue -->
<script setup lang="ts">
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-vue';
import animation from './animation.json';
</script>

<template>
  <div style="width: 300px; height: 300px">
    <PixodeskSvgAnimator :doc="animation" autoplay />
  </div>
</template>
```

**Nuxt:** nothing more to do — the component is SSR-safe. Details: [Nuxt](./nuxt.md).

## Plain HTML

### With a bundler (Vite, webpack, …)

> **Example:** [`examples/get-started/html-bundler`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-bundler) — the complete project · [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-bundler?startScript=dev&title=Get%20started%20%C2%B7%20Plain%20HTML%2C%20with%20a%20bundler)

```bash
npm install @pixodesk/svg-animator-web
```

```html
<!-- index.html -->
<div id="hero" style="width: 300px; height: 300px"></div>
<script type="module" src="/src/main.js"></script>
```

```js
// src/main.js — animation.json sits next to it
import { createAnimator } from '@pixodesk/svg-animator-web';
import animation from './animation.json';

createAnimator({ doc: animation, container: '#hero' });
```

### Without a build step

Copy the player's single-file build from the npm package into your site, next to the page and
the JSON (`npm pack @pixodesk/svg-animator-web` downloads the package without a project):

```bash
npm install @pixodesk/svg-animator-web
cp node_modules/@pixodesk/svg-animator-web/dist/pixodesk-svg-animator.umd.min.js ./js/
```

The script puts a `PixodeskAnimator` global on the page. Then play the file one of the four ways
below — each is complete on its own.

Open the page through a local server (`npx serve .`), not as a `file://` URL: a browser does not
let a page opened from disk fetch the JSON next to it. Only the last way, with the JSON inside
the page, plays from disk.

### No code — the element names the file

> **Example:** [`examples/get-started/html-tag`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-tag) — the complete project · [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-tag?startScript=start&title=Get%20started%20%C2%B7%20No%20code%2C%20the%20element%20names%20the%20file)

```html
<div data-px-animation-src="animation.json" style="width: 300px; height: 300px"></div>

<script src="js/pixodesk-svg-animator.umd.min.js"></script>
<script>PixodeskAnimator.loadTagAnimators();</script>
```

### From code — the player fetches the file

> **Example:** [`examples/get-started/html-create-animator`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-create-animator) — the complete project · [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-create-animator?startScript=start&title=Get%20started%20%C2%B7%20From%20code%2C%20the%20player%20fetches%20the%20file)

`createAnimator` returns the player, so you can call `animator.play()`, `animator.pause()` and
the rest ([the playback API](./web-player.md#the-playback-api)). With `src` it fetches
the file itself:

```html
<div id="hero" style="width: 300px; height: 300px"></div>

<script src="js/pixodesk-svg-animator.umd.min.js"></script>
<script>
  const animator = PixodeskAnimator.createAnimator({ src: 'animation.json', container: '#hero' });
</script>
```

### From code — you fetch the file

> **Example:** [`examples/get-started/html-fetch`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-fetch) — the complete project · [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-fetch?startScript=start&title=Get%20started%20%C2%B7%20From%20code%2C%20you%20fetch%20the%20file)

Load the document yourself — your own `fetch`, a CMS field, a database — and hand over the
parsed object as `doc`:

```html
<div id="hero" style="width: 300px; height: 300px"></div>

<script src="js/pixodesk-svg-animator.umd.min.js"></script>
<script>
  fetch('animation.json')
    .then(response => response.json())
    .then(doc => PixodeskAnimator.createAnimator({ doc, container: '#hero' }));
</script>
```

### From code — the JSON inside the page

> **Example:** [`examples/get-started/html-inline-json`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-inline-json) — the complete project · [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-inline-json?startScript=start&title=Get%20started%20%C2%B7%20From%20code%2C%20the%20JSON%20inside%20the%20page)

Nothing to fetch: paste the file's content into a `<script type="application/json">` (the browser
does not run it), parse it, hand it over as `doc`:

```html
<div id="hero" style="width: 300px; height: 300px"></div>

<script type="application/json" id="hero-animation">
  { "type": "svg", "viewBox": "0 0 400 400", "animator": { … }, "children": [ … ] }
</script>

<script src="js/pixodesk-svg-animator.umd.min.js"></script>
<script>
  const doc = JSON.parse(document.getElementById('hero-animation').textContent);
  PixodeskAnimator.createAnimator({ doc, container: '#hero' });
</script>
```

## React Native

🧪 *In development* — the API may still change; see
[React Native](./react-native.md) for what is supported.

> **Example:** [`examples/get-started/react-native`](https://github.com/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/react-native) — the complete project.

```bash
npm install @pixodesk/svg-animator-rn
npx expo install react-native-svg react-native-reanimated   # if your app does not have them yet
```

Reanimated needs its Babel plugin — one line in `babel.config.js`, spelled out in
[React Native › Install](./react-native.md#install).

```tsx
// components/Hero.tsx
import { View } from 'react-native';
import { PixodeskSvgAnimator } from '@pixodesk/svg-animator-rn';
import animation from './animation.json';

export function Hero() {
  return (
    <View style={{ width: 300, height: 300 }}>
      <PixodeskSvgAnimator doc={animation} autoplay />
    </View>
  );
}
```

## Edit and reload

Open `animation.json` **from the project folder** in the editor — **File › Open**, or drag the
file onto the editor window — change it and save. The dev server picks the change up and the
page shows the new animation; refresh if it does not.

## What next

- **Start it on click, hover or scroll into view, loop it, set its length** — these are saved in
  the file: [playback settings in the editor](https://pixodesk.com/docs/svga/editor/playback-settings).
  To change them for one place in your app without touching the file, pass them to the player:
  [Playback settings & triggers](./playback-and-triggers.md).
- **Play, pause, jump to a time from your code** — the handle every player gives you:
  [React](./react.md#imperative-api-apiref) · [Vue](./vue.md) ·
  [Web player](./web-player.md#the-playback-api).
- **No JavaScript at all** — save a pre-rendered SVG instead of JSON and drop the file into any
  page or CMS: [Pre-rendered SVG](https://pixodesk.com/docs/svga/prerendered-svg).
- **Everything else** — [Library documentation](./README.md), the players and their
  options; [Format documentation](../format/README.md), what is in the file.

[Contents](../../README.md#documentation) · Next: [Library documentation →](./README.md)
