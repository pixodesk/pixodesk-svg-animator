// React + ReactDOM as page globals (`window.React`, `window.ReactDOM` incl. `createRoot`) for
// pages that load this package's UMD with plain <script> tags — React 19 ships no UMD build.
// Built to dist-runtime/react-runtime.umd.min.js (see tsup.config.ts); not published (`files` is `dist`).

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

window.React = React;
window.ReactDOM = Object.assign({}, ReactDOM, ReactDOMClient);
