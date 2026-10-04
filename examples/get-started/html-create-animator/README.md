# Get started — From code — the player fetches the file

The [From code — the player fetches the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#from-code--the-player-fetches-the-file) section of the Get started guide as a project of its own: no bundler, no framework: `createAnimator({ src, container })` from the `PixodeskAnimator` global fetches `animation.json` and returns the player.

```bash
npm install
npm start        # serves this folder; then open the URL it prints
```

`npm install` also copies the player's single-file build from the package into `js/` (the
`postinstall` script) — on your own site that copy is the only file you need next to the page.
