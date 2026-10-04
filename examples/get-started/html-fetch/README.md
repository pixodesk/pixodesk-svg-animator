# Get started — From code — you fetch the file

The [From code — you fetch the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#from-code--you-fetch-the-file) section of the Get started guide as a project of its own: no bundler, no framework: your own `fetch` loads `animation.json` and the parsed object goes in as `doc`.

```bash
npm install
npm start        # serves this folder; then open the URL it prints
```

`npm install` also copies the player's single-file build from the package into `js/` (the
`postinstall` script) — on your own site that copy is the only file you need next to the page.
