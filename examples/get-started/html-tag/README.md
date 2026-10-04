# Get started — No code — the element names the file

The [No code — the element names the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#no-code--the-element-names-the-file) section of the Get started guide as a project of its own: no bundler, no framework: `index.html` names `animation.json` on the element and `loadTagAnimators()` plays it.

```bash
npm install
npm start        # serves this folder; then open the URL it prints
```

`npm install` also copies the player's single-file build from the package into `js/` (the
`postinstall` script) — on your own site that copy is the only file you need next to the page.
