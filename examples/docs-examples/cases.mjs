// Every example case, in the order the docs present them.
//
// This file drives three things at once, so a case can never be half-registered:
//   • vite.config.ts   — each case is a multi-page entry at src/cases/<group>/<id>/index.html
//   • src/index.ts     — the case browser (sidebar, hash routing, doc links)
//   • e2e/cases.spec.ts — every case gets the generic "loads and animates" test
//
// `doc` is the chapter (and optional anchor) under /docs the case belongs to.

export const GROUPS = [
  { id: 'web',         title: 'Web player',              doc: '06-player--web-player.md' },
  { id: 'react',       title: 'React',                   doc: '07-player--react.md' },
  { id: 'vue',         title: 'Vue',                     doc: '08-player--vue.md' },
  { id: 'playback',    title: 'Playback settings & triggers', doc: '10-player--playback-and-triggers.md' },
  { id: 'prerendered', title: 'Pre-rendered SVG',        doc: '11-player--prerendered-svg.md' },
  { id: 'static',      title: 'Static sites & CMS',      doc: '12-player--static-sites-and-cms.md' },
];

export const CASES = [
  // -- Web player -------------------------------------------------------------
  { group: 'web', id: 'declarative',   title: 'Declarative — data-px-animation-src', anchor: 'declarative--data-px-animation-src',
    summary: 'Point an element at the JSON and call loadTagAnimators() once.' },
  { group: 'web', id: 'programmatic',  title: 'Programmatic — createAnimator + playback API', anchor: 'programmatic--createanimatoroptions',
    summary: 'createAnimator({ src, container }) and every method of the returned API.' },
  { group: 'web', id: 'callbacks',     title: 'Callbacks', anchor: 'callbacks',
    summary: 'onPlay / onPause / onCancel / onFinish / onRemove, logged as they fire.' },
  { group: 'web', id: 'triggers',      title: 'Triggers — start on click', anchor: 'triggers',
    summary: 'The document says startOn: "click"; the player wires the event for you.' },
  { group: 'web', id: 'engine-modes',  title: 'Engine modes — WAAPI vs frames', anchor: 'engine-modes',
    summary: 'The same document driven by each engine, side by side.' },
  { group: 'web', id: 'several',       title: 'Loading several animations', anchor: 'loading-several-animations',
    summary: 'Three elements, one loadTagAnimators() call.' },
  { group: 'web', id: 'cleanup',       title: 'Cleaning up — destroy()', anchor: 'cleaning-up',
    summary: 'destroy() stops playback and removes the SVG from the container.' },

  // -- React ------------------------------------------------------------------
  { group: 'react', id: 'imperative',      title: '1 · Imperative API (apiRef)', anchor: '1--imperative-api-apiref',
    summary: 'play / pause / cancel / finish through a ref.' },
  { group: 'react', id: 'autoplay',        title: '2 · Autoplay', anchor: '2--autoplay',
    summary: 'The component honours the document\'s own trigger.' },
  { group: 'react', id: 'controlled-time', title: '3 · Controlled time (time)', anchor: '3--controlled-time-progress--time',
    summary: 'A slider drives time (ms); the component renders that exact frame.' },
  { group: 'react', id: 'declarative',     title: '4 · Declarative play / pause', anchor: '4--declarative-play--pause',
    summary: 'Boolean play and pause props.' },
  { group: 'react', id: 'css-svgr',        title: 'CSS-flavour SVG — PixodeskSvgCssAnimator + SVGR', anchor: 'css-flavour-svgs--pixodesksvgcssanimator',
    summary: 'A pre-rendered SVG imported as a component, with a click trigger added by the wrapper.' },

  // -- Vue --------------------------------------------------------------------
  { group: 'vue', id: 'autoplay',        title: '1 · Autoplay', anchor: '1--autoplay',
    summary: 'The component honours the document\'s own trigger.' },
  { group: 'vue', id: 'controlled-time', title: '2 · Controlled time (time)', anchor: '2--controlled-time-progress--time',
    summary: 'A slider drives time (ms); the component renders that exact frame.' },
  { group: 'vue', id: 'declarative',     title: '3 · Declarative play / pause', anchor: '3--declarative-play--pause',
    summary: 'Boolean play and pause props.' },
  { group: 'vue', id: 'imperative',      title: '4 · Imperative API (template ref)', anchor: '4--imperative-api-template-ref',
    summary: 'play / pause / cancel / finish through a template ref.' },
  { group: 'vue', id: 'css-loader',      title: 'CSS-flavour SVG — PixodeskSvgCssAnimator + vite-svg-loader', anchor: 'css-flavour-svgs--pixodesksvgcssanimator',
    summary: 'A pre-rendered SVG imported as a component, with a click trigger added by the wrapper.' },

  // -- Playback settings & triggers ---------------------------------------------
  { group: 'playback', id: 'override-web',   title: 'Overriding from the web player', anchor: 'overriding-from-a-player',
    summary: 'Edit animator before createAnimator: infinite iterations, programmatic trigger.' },
  { group: 'playback', id: 'override-react', title: 'Overriding from component props', anchor: 'overriding-from-a-player',
    summary: 'iterations / direction / mode props replace the document\'s values.' },

  // -- Pre-rendered SVG ----------------------------------------------------------
  { group: 'prerendered', id: 'inline-css', title: 'Flavour 1 inlined — SVG + CSS animation', anchor: 'flavour-1--svg--css-animation',
    summary: 'An On-load export pasted into the page; the browser runs the @keyframes. No library.' },
  { group: 'prerendered', id: 'img-css',    title: 'In an <img> — static', anchor: 'three-ways-to-embed-animated-svg',
    summary: 'Used as a picture, a pre-rendered SVG shows a still frame. Inline it instead.' },
  { group: 'prerendered', id: 'inline-js',  title: 'Flavour 3 — SVG + JS animation', anchor: 'flavour-3--svg--js-animation',
    summary: 'An already-rendered SVG plus a bindings payload, driven by the embedded player.' },

  // -- Static sites & CMS --------------------------------------------------------
  { group: 'static', id: 'vanilla-umd', title: 'Vanilla JavaScript on any static page', anchor: 'vanilla-javascript-on-any-static-page',
    summary: 'The UMD build served from your own site, with a relative <script src>.' },
];

/** Where a case's page lives, relative to the project root. */
export const casePath = (c) => `src/cases/${c.group}/${c.id}/index.html`;
