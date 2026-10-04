# Get started — From code — the JSON inside the page

The [From code — the JSON inside the page](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#from-code--the-json-inside-the-page) section of the *Get started with the player library* guide as a project of its own: no bundler, no framework, nothing to fetch: the JSON sits in a `<script type="application/json">` in `index.html`, parsed and handed over as `doc`. This page plays straight from disk too.

```bash
npm install
npm start        # serves this folder; then open the URL it prints
```

`npm install` also copies the player's single-file build from the package into `js/` (the
`postinstall` script) — on your own site that copy is the only file you need next to the page.
