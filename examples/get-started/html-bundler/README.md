# Get started — Plain HTML — with a bundler

The [Plain HTML — with a bundler](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#with-a-bundler-vite-webpack) section of the Get started guide as a project of its own: `src/main.js` imports `src/animation.json`, the file next to it, and calls `createAnimator({ doc, container })`; Vite bundles the two.

```bash
npm install
npm run dev      # then open the URL it prints
```

Plain JavaScript, the same code as the guide. In TypeScript, cast the JSON import once —
see [Installing the players › TypeScript](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/installation.md#typescript).
