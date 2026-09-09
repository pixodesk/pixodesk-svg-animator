/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// THE WIRE FORMAT, derived — never listed by hand.
//
// Every key of every exported schema in the BUILT core, followed through shape / array /
// optional / lazy / union / discriminatedUnion / record / tuple. A key added to a schema is
// therefore known here automatically, for ever, with no human action — which is the whole
// point of deriving instead of guessing.
//
// Two scripts need this and must not disagree: `collect-identifiers.mjs` (which names the
// keys a minifier must not rename) and `analyse-bundle.mjs` (which reports their byte cost as
// structural rather than as a saving that does not exist).

import { createRequire } from 'node:module';

/**
 * @param {string} coreCjsPath absolute path to packages/svg-animator-core/dist/index.cjs
 * @param {string} caller      script name, for the error message
 * @returns {Set<string>}
 */
export function collectSchemaKeys(coreCjsPath, caller) {
    let core;
    try {
        core = createRequire(coreCjsPath)(coreCjsPath);
    } catch (e) {
        throw new Error(
            caller + ': cannot read the built core at ' + coreCjsPath + '.\n' +
            'Build @pixodesk/svg-animator-core first — the wire-key list is derived from its ' +
            'runtime schemas.\n' + String(e));
    }
    const keys = new Set();
    const seen = new Set();
    const walk = (schema) => {
        if (!schema || typeof schema !== 'object' || seen.has(schema)) return;
        seen.add(schema);
        let d;
        try { d = core.describeSchema(schema); } catch { return; }
        if (!d) return;
        switch (d.kind) {
            case 'shape':
                for (const [k, v] of Object.entries(d.shape || {})) { keys.add(k); walk(v); }
                if (d.openValue) walk(d.openValue);
                break;
            case 'array':    walk(d.item); break;
            case 'optional': walk(d.inner); break;
            case 'lazy':     walk(d.resolved); break;
            case 'record':   walk(d.value); break;
            case 'union':    (d.members || []).forEach(walk); break;
            case 'discriminatedUnion':
                if (d.key) keys.add(d.key);
                (d.members || []).forEach(walk);
                break;
            case 'tuple':    (d.items || []).forEach(walk); break;
        }
    };
    for (const [name, value] of Object.entries(core)) {
        if (/Schema$/.test(name) || name === 'PxNodeBase' || name === 'PxSvgNodeExtra') walk(value);
    }
    return keys;
}
