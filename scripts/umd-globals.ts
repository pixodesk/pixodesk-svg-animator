// Page globals for the framework UMD builds (`@pixodesk/svg-animator-react` / `-vue`).
//
// tsup skips its external plugin for `format: 'iife'` (tsup/dist: `format !== "iife" && externalPlugin(…)`),
// so an `external` list is silently ignored there and the framework got BUNDLED into the UMD —
// a second React / Vue copy the page cannot mount (hooks and lifecycle only work within one copy).
// This plugin resolves each listed import to a tiny module that reads the page's global instead.

import type { Plugin } from 'esbuild';

const NAMESPACE = 'umd-global';

/** Module source that re-exports `window[globalName]`, failing loudly when the page did not load it. */
export function globalModule(globalName: string, libLabel: string): string {
    return `if (!window.${globalName}) throw new Error('${libLabel}: load ${globalName} before this script (window.${globalName} is missing)');\n`
        + `module.exports = window.${globalName};\n`;
}

/** `react/jsx-runtime` over the page's React — the automatic JSX runtime is not part of React's globals. */
export function reactJsxRuntimeModule(libLabel: string): string {
    return `if (!window.React) throw new Error('${libLabel}: load React before this script (window.React is missing)');\n`
        + 'var R = window.React;\n'
        + 'function jsx(type, props, key) { return R.createElement(type, key === undefined ? props : Object.assign({}, props, { key: key })); }\n'
        + 'module.exports = { jsx: jsx, jsxs: jsx, Fragment: R.Fragment };\n';
}

/** Resolves every import named in `modules` (exact specifier) to its given module source. */
export function umdGlobalsPlugin(modules: ReadonlyMap<string, string>): Plugin {
    const escaped = [...modules.keys()].map(name => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
    const filter = new RegExp(`^(${escaped.join('|')})$`);
    return {
        name: 'umd-globals',
        setup(build) {
            build.onResolve({ filter }, args => ({ path: args.path, namespace: NAMESPACE }));
            build.onLoad({ filter: /.*/, namespace: NAMESPACE }, args => ({ contents: modules.get(args.path), loader: 'js' }));
        },
    };
}
