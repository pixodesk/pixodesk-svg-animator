#!/usr/bin/env node
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Collect OUR OWN property / method identifiers from source, via the TypeScript AST,
// and split them into "must keep" vs "safe to mangle".
//
//   node scripts/collect-identifiers.mjs            # writes scripts/.identifiers.json
//
// Why the AST and not a regex: we need to know which names are *object property
// names we declare* (class members, interface members, object-literal keys,
// `x.foo` accesses) as opposed to local variables, which terser already mangles.
//
// The classification is deliberately paranoid, because renaming a property that is
// reached by string is a silent runtime break:
//
//   RESERVE  wire-format keys      — keys inside px.object({...}) schema declarations.
//                                    These are the file format; renaming = data loss.
//   RESERVE  string-collided names — any property name that ALSO appears anywhere as a
//                                    string literal in our source. Covers obj['foo'],
//                                    JSON round-trips, attribute names, CSS props,
//                                    getAttribute('...'), and effect-key dispatch tables.
//   RESERVE  public API            — everything exported from either package's entry.
//   RESERVE  public TYPE members    — the KEYS of every exported interface / type alias.
//                                    A consumer builds those objects in THEIR OWN code, so we
//                                    can never rename what we read off them. Reserving only the
//                                    declaration name (above) is not enough: that is how
//                                    `callbacks`, `adapter` and every `on*` callback came to be
//                                    renamed in the shipped bundles (MINIFICATION-BOUNDARY-PLAN.md).
//   MANGLE   the rest              — internal plumbing, reachable only as `x.name` in code
//                                    we compile together.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// typescript is a package-level devDependency, not hoisted to the repo root.
const ts = createRequire(join(ROOT, 'packages/svg-animator-core/package.json'))('typescript');
const SRC_DIRS = [
    join(ROOT, 'packages/svg-animator-core/src'),
    join(ROOT, 'packages/svg-animator-web/src'),
];

// Calls whose object-literal keys ARE the wire format.
// Kept as a CROSS-CHECK only: the authority is now the runtime schema walk below, because
// pattern-matching source only recognises an object literal passed directly to a px.object
// call — a schema built any other way is invisible, which is how `domType` came to be a
// documented wire key that no reserve rule knew about (MINIFICATION-BOUNDARY-PLAN.md §2).
const SCHEMA_FACTORIES = new Set([
    'object', 'openObject', 'extendedObject', 'record', 'discriminatedUnion',
]);

// Names the BROWSER reads off objects we hand it, and names we EMIT as DOM attributes.
// Neither is ours to rename. `rangeName` is a WAAPI `TimelineRangeOffset` member whose
// siblings are in terser's domprops — it is simply younger than the bundled list.
const PLATFORM_NAMES = ['rangeName', 'axis', 'source', 'subject', 'timeline', 'view', 'scroll'];
const EMITTED_DOM_NAMES = ['class'];

/**
 * The wire format, read from the BUILT core at runtime: every key of every exported schema,
 * followed through shape / array / optional / lazy / union / discriminatedUnion / record /
 * tuple. A key added to a schema is therefore reserved automatically, for ever, with no
 * human action — which is the whole point of deriving instead of guessing.
 */
function collectSchemaKeys() {
    const corePath = join(ROOT, 'packages/svg-animator-core/dist/index.cjs');
    let core;
    try {
        core = createRequire(corePath)(corePath);
    } catch (e) {
        throw new Error(
            'collect-identifiers: cannot read the built core at ' + corePath + '.\n' +
            'Build @pixodesk/svg-animator-core first — the reserved list is derived from its runtime schemas.\n' +
            String(e));
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

function walkDir(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walkDir(p, out);
        else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(p);
    }
    return out;
}

const files = SRC_DIRS.flatMap(d => walkDir(d));

const declaredProps = new Map();   // name -> count of declaration/access sites
const wireKeys = new Set();
const stringLiterals = new Set();
const exportedNames = new Set();
const publicTypeMembers = new Set();   // keys of exported interfaces / type aliases

const bump = (name) => declaredProps.set(name, (declaredProps.get(name) || 0) + 1);

const nameOf = (node) => {
    if (!node) return null;
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
    return null;
};

/** True when this object literal is the argument of px.object({...}) & friends. */
function isSchemaShape(node) {
    const call = node.parent;
    if (!call || !ts.isCallExpression(call)) return false;
    const callee = call.expression;
    const fn = ts.isPropertyAccessExpression(callee) ? callee.name.text
        : ts.isIdentifier(callee) ? callee.text : null;
    return fn !== null && SCHEMA_FACTORIES.has(fn);
}

for (const file of files) {
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

    const visit = (node) => {
        // --- every string literal anywhere: the paranoia net
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            const t = node.text.trim();
            if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t)) stringLiterals.add(t);
            // also split multi-word strings: "fill stroke" style attr lists
            for (const w of t.split(/[\s,;:()]+/)) {
                if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(w)) stringLiterals.add(w);
            }
        }

        // --- class members
        if (ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node)
            || ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
            const n = nameOf(node.name); if (n) bump(n);
        }
        // --- constructor parameter properties (`constructor(private foo: X)`)
        if (ts.isParameter(node) && node.modifiers?.length) {
            const n = nameOf(node.name); if (n) bump(n);
        }
        // --- interface / type-literal members
        if (ts.isPropertySignature(node) || ts.isMethodSignature(node)) {
            const n = nameOf(node.name); if (n) bump(n);
        }
        // --- object literal keys
        if (ts.isObjectLiteralExpression(node)) {
            const schema = isSchemaShape(node);
            for (const p of node.properties) {
                const n = nameOf(p.name);
                if (!n) continue;
                if (schema) wireKeys.add(n);
                bump(n);
            }
        }
        // --- property access `x.foo`
        if (ts.isPropertyAccessExpression(node)) bump(node.name.text);
        // --- element access with a literal: obj['foo'] — reachable by string, reserve it
        if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
            stringLiterals.add(node.argumentExpression.text);
        }
        // --- exported TYPE declarations: harvest their member names, not just the type name.
        if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node))
            && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            const harvest = (n) => {
                if (ts.isPropertySignature(n) || ts.isMethodSignature(n)) {
                    const m = nameOf(n.name); if (m) publicTypeMembers.add(m);
                }
                ts.forEachChild(n, harvest);
            };
            harvest(node);
        }

        // --- exports
        if (ts.isExportSpecifier(node)) exportedNames.add((node.propertyName || node.name).text);
        if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
            const n = nameOf(node.name); if (n) exportedNames.add(n);
        }

        ts.forEachChild(node, visit);
    };
    visit(sf);
}

// --- builtins: the trap in this whole exercise.
// The AST pass records every `x.foo`, which sweeps in `Array.isArray`, `arr.push`,
// `el.addEventListener`, `Math.round` — standard library and DOM names that MUST NOT be
// renamed. Source is terser's own domprops list plus everything reachable on the JS
// intrinsic prototypes in this runtime. Without this filter the "safe" list happily
// suggests mangling `push` (x148) and `isArray` (x100), which breaks the bundle outright.
// terser's package `exports` map blocks the ./tools subpath, so read the file directly.
const dompropsPath = join(ROOT, 'packages/svg-animator-web/node_modules/terser/tools/domprops.js');
const dompropsMod = await import(pathToFileURL(dompropsPath).href);
const BUILTIN = new Set(dompropsMod.domprops || dompropsMod.default || []);
// Platform names too NEW for the bundled domprops list. These are keys the BROWSER reads
// off objects we hand it, so they are not ours to rename — `rangeName` is a member of
// WAAPI's `TimelineRangeOffset` (its siblings `rangeStart`/`rangeEnd`/`offset` are already
// in domprops, which is exactly why the omission went unnoticed). This list needs a new
// entry whenever we adopt a web API younger than the terser release we build with.
for (const p of PLATFORM_NAMES) BUILTIN.add(p);
for (const ctor of [Object, Array, String, Number, Boolean, Function, Date, RegExp, Error,
    Map, Set, WeakMap, WeakSet, Promise, Symbol, Math, JSON, ArrayBuffer, Int8Array]) {
    for (const src of [ctor, ctor.prototype]) {
        if (!src) continue;
        for (const p of Object.getOwnPropertyNames(src)) BUILTIN.add(p);
    }
}

// The wire format, derived from the built core rather than guessed from source.
const schemaKeys = collectSchemaKeys();
const astOnly = [...wireKeys].filter(k => !schemaKeys.has(k));
if (astOnly.length) {
    console.warn(`  ! ${astOnly.length} key(s) found by the source scan but NOT by the runtime walk: ${astOnly.join(', ')}`);
    console.warn('    (a schema that is not exported from core, or built in a shape the walk misses)');
}
for (const k of schemaKeys) wireKeys.add(k);

// The published contract: everything a consumer's minifier must not rename.
const reserved = new Set([
    ...schemaKeys,           // the file format
    ...publicTypeMembers,    // the keys of every exported type — options, callbacks, API methods
    ...PLATFORM_NAMES,       // names the browser reads off objects we hand it
    ...EMITTED_DOM_NAMES,    // names we write into the DOM
]);

const safe = [...declaredProps.keys()].filter(n =>
    !wireKeys.has(n) && !stringLiterals.has(n) && !exportedNames.has(n)
    && !publicTypeMembers.has(n)
    && !BUILTIN.has(n)
    // 1-2 char names are already minimal; renaming buys nothing and the bundle's
    // own mangled locals share those spellings, which corrupts the occurrence count.
    && n.length > 2);

// A name can never be both. If this fires, a reserve rule and the mangle filter disagree —
// which is precisely the silent, configuration-dependent breakage this whole exercise exists
// to end, so fail the build rather than ship it.
const collision = safe.filter(n => reserved.has(n));
if (collision.length) {
    throw new Error('collect-identifiers: these names are BOTH reserved and marked safe to mangle: '
        + collision.join(', '));
}

// Published for third parties: terser takes it as `mangle.properties.reserved`, esbuild as
// `reserveProps`. There is no npm standard for this, but every mangler accepts such a list.
writeFileSync(
    join(ROOT, 'packages/svg-animator-web/mangle-reserved.json'),
    JSON.stringify({
        comment: 'Property names @pixodesk/svg-animator reads from, or writes to, objects it does '
            + 'not own. Feed this to your minifier (terser: mangle.properties.reserved; esbuild: '
            + 'reserveProps) if you property-mangle this library or the objects you pass it.',
        reserved: [...reserved].sort(),
    }, null, 1) + '\n');

const result = {
    files: files.length,
    declared: [...declaredProps.entries()].sort((a, b) => b[1] - a[1]),
    wireKeys: [...wireKeys].sort(),
    stringLiterals: [...stringLiterals].sort(),
    exportedNames: [...exportedNames].sort(),
    publicTypeMembers: [...publicTypeMembers].sort(),
    reserved: [...reserved].sort(),
    safeToMangle: safe.sort(),
};
writeFileSync(join(ROOT, 'scripts/.identifiers.json'), JSON.stringify(result, null, 1));

console.log(`scanned ${files.length} source files`);
console.log(`  declared property/method names : ${declaredProps.size}`);
console.log(`  wire-format keys (px.object)   : ${wireKeys.size}`);
console.log(`  names colliding with a string  : ${stringLiterals.size}`);
console.log(`  exported names                 : ${exportedNames.size}`);
console.log(`  public type members            : ${publicTypeMembers.size}`);
console.log(`  schema keys (runtime walk)     : ${schemaKeys.size}`);
console.log(`  RESERVED (published)           : ${reserved.size}`);
console.log(`  => SAFE TO MANGLE              : ${safe.length}`);
console.log(`\nwrote scripts/.identifiers.json`);
