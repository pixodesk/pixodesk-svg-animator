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
const SCHEMA_FACTORIES = new Set([
    'object', 'openObject', 'extendedObject', 'record', 'discriminatedUnion',
]);

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
for (const ctor of [Object, Array, String, Number, Boolean, Function, Date, RegExp, Error,
    Map, Set, WeakMap, WeakSet, Promise, Symbol, Math, JSON, ArrayBuffer, Int8Array]) {
    for (const src of [ctor, ctor.prototype]) {
        if (!src) continue;
        for (const p of Object.getOwnPropertyNames(src)) BUILTIN.add(p);
    }
}

const safe = [...declaredProps.keys()].filter(n =>
    !wireKeys.has(n) && !stringLiterals.has(n) && !exportedNames.has(n)
    && !BUILTIN.has(n)
    // 1-2 char names are already minimal; renaming buys nothing and the bundle's
    // own mangled locals share those spellings, which corrupts the occurrence count.
    && n.length > 2);

const result = {
    files: files.length,
    declared: [...declaredProps.entries()].sort((a, b) => b[1] - a[1]),
    wireKeys: [...wireKeys].sort(),
    stringLiterals: [...stringLiterals].sort(),
    exportedNames: [...exportedNames].sort(),
    safeToMangle: safe.sort(),
};
writeFileSync(join(ROOT, 'scripts/.identifiers.json'), JSON.stringify(result, null, 1));

console.log(`scanned ${files.length} source files`);
console.log(`  declared property/method names : ${declaredProps.size}`);
console.log(`  wire-format keys (px.object)   : ${wireKeys.size}`);
console.log(`  names colliding with a string  : ${stringLiterals.size}`);
console.log(`  exported names                 : ${exportedNames.size}`);
console.log(`  => SAFE TO MANGLE              : ${safe.length}`);
console.log(`\nwrote scripts/.identifiers.json`);
