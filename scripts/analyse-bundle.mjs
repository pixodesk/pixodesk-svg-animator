#!/usr/bin/env node
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Bundle composition analyser.
//
//   node scripts/analyse-bundle.mjs [path/to/bundle.js]
//   (default: packages/svg-animator-web/dist/index.umd.min.js)
//
// Answers "what is actually costing us bytes" for an ALREADY-minified bundle.
//
// The point of this script is that **raw bytes lie**. Identifiers repeat, and brotli
// encodes each repeat in roughly a bit — so a name worth 1 KB raw is often worth ~100 B
// on the wire. Every category below is therefore reported twice:
//
//   raw   — bytes on disk, what a naive scan sees
//   wire  — REAL brotli delta, measured by shortening every occurrence of that category
//           and re-compressing. This is the number a change would actually buy you.
//
// The shortening is a measurement only; nothing is written back.

import { readFileSync } from 'node:fs';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const FILE = process.argv[2] || 'packages/svg-animator-web/dist/index.umd.min.js';
const TOP = Number(process.env.TOP || 20);

// ---------------------------------------------------------------- categories

// Keys of the on-disk animation format. These can NEVER be renamed — they are the
// file format, read from JSON authored elsewhere. Listed so the report can say
// "this cost is structural" rather than implying a saving that does not exist.
const WIRE = new Set(`children animate animator effects meta type text textContent
keyframes easing offset value time duration delay direction fillMode iterations
translate rotate scale origin skew transform opacity anchor position
tangentIn tangentOut autoOrient path spatial
fill stroke strokeWidth strokeLinecap strokeDasharray fontSize fontFamily fontWeight
width height viewBox preserveAspectRatio gradientUnits spreadMethod stops
strokeTrim repeater maskedBy clipPath retime clone transformBy fillGradient strokeGradient
textPath timeCrop loop extend subPaths timelineSource`.trim().split(/\s+/));

// Schema-engine members. In the UMD these are INTERNAL — `px` and the schema objects
// are no longer exported — so they are renameable in principle.
const ENGINE = new Set(`optional isValid sanitize schemas describe innerSchema nullable
_default _optional _canSanitize _shape _fix _map _resolved _findSchema
openObject extendedObject discriminatedUnion errors warnings strict`.trim().split(/\s+/));

// Standard library / DOM. Renaming these is impossible.
const BUILTIN = new Set(`length Object Number String Boolean Array Math JSON Symbol Promise
isArray isFinite isNaN parseFloat parseInt forEach filter reduce indexOf lastIndexOf
includes startsWith endsWith slice splice concat join split replace charCodeAt
toString valueOf hasOwnProperty defineProperty getPrototypeOf create assign freeze
keys values entries push pop shift unshift sort reverse
console document window navigator setTimeout clearTimeout
requestAnimationFrame cancelAnimationFrame querySelector querySelectorAll
createElement createElementNS setAttribute getAttribute removeAttribute appendChild
addEventListener removeEventListener getBoundingClientRect getComputedStyle
getTotalLength getPointAtLength animate currentTime playbackRate`.trim().split(/\s+/));

// Language keywords and literals. Not identifiers at all — they cannot be renamed, and
// counting them as "other" overstates the renameable surface badly (`null` alone is
// 1,784 B in the UMD). Terser already emits the shortest legal spelling of each.
const KEYWORDS = new Set(`function return typeof instanceof undefined constructor prototype
default require exports module continue extends static class const let var new delete
void yield await async import export switch case break throw catch finally
null true false this for else if while do in of try with super arguments globalThis
NaN Infinity get set of from as`.trim().split(/\s+/));

// ------------------------------------------------------------------ scanning

/**
 * Split source into alternating code / string-literal segments.
 * A naive regex over minified JS reports nonsense — an early version of this analysis
 * claimed strings were 87% of the bundle because a greedy pattern spanned the whole
 * single-line file. Anything that scans minified code must be quote-aware.
 */
function segments(src) {
    const out = [];
    let i = 0, codeStart = 0;
    while (i < src.length) {
        const ch = src[i];
        if (ch === '"' || ch === "'" || ch === '`') {
            out.push({ code: true, text: src.slice(codeStart, i) });
            const quote = ch;
            let j = i + 1;
            while (j < src.length) {
                if (src[j] === '\\') { j += 2; continue; }
                if (src[j] === quote) break;
                j++;
            }
            out.push({ code: false, text: src.slice(i, j + 1) });
            i = codeStart = j + 1;
        } else if (ch === '/' && src[i + 1] === '/') {          // line comment
            let j = src.indexOf('\n', i); if (j < 0) j = src.length;
            i = j;
        } else i++;
    }
    out.push({ code: true, text: src.slice(codeStart) });
    return out;
}

const IDENT = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g;

function classify(name) {
    if (WIRE.has(name)) return 'wire-format';
    if (ENGINE.has(name)) return 'schema-engine';
    if (BUILTIN.has(name)) return 'builtin/DOM';
    return 'other';
}

// -------------------------------------------------------------- measurement

const br = buf => brotliCompressSync(Buffer.from(buf), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
}).length;

/** Rewrite every identifier in `names` to a short unique token, skipping strings. */
function shorten(src, names) {
    let n = 0;
    const map = new Map();
    const short = name => {
        if (!map.has(name)) map.set(name, '$z' + (n++).toString(36));
        return map.get(name);
    };
    return segments(src)
        .map(s => (s.code ? s.text.replace(IDENT, m => (names.has(m) ? short(m) : m)) : s.text))
        .join('');
}

// -------------------------------------------------------------------- report

const src = readFileSync(FILE, 'utf8');
const rawSize = Buffer.byteLength(src);
const brSize = br(src);

console.log(`\n${FILE}`);
console.log(`  raw ${rawSize.toLocaleString()}  gzip ${gzipSync(src, { level: 9 }).length.toLocaleString()}  brotli ${brSize.toLocaleString()}\n`);

// --- identifier census
const counts = new Map();
for (const s of segments(src)) {
    if (!s.code) continue;
    for (const m of s.text.match(IDENT) || []) {
        if (KEYWORDS.has(m) || m.length < 3) continue;
        counts.set(m, (counts.get(m) || 0) + 1);
    }
}

const byCat = new Map();
for (const [name, n] of counts) {
    const cat = classify(name);
    if (!byCat.has(cat)) byCat.set(cat, { raw: 0, names: [] });
    const e = byCat.get(cat);
    e.raw += name.length * n;
    e.names.push({ name, n, raw: name.length * n });
}

console.log('CATEGORY                 raw bytes   %raw    WIRE saving   %wire   verdict');
console.log('-'.repeat(84));

const VERDICT = {
    'wire-format': 'IMMOVABLE - it is the file format',
    'schema-engine': 'renameable, but see note below',
    'builtin/DOM': 'IMMOVABLE - standard library',
    'other': 'already mangled by terser where it could be',
};

for (const [cat, e] of [...byCat].sort((a, b) => b[1].raw - a[1].raw)) {
    const names = new Set(e.names.map(x => x.name));
    // Real wire cost: shorten this category only, re-compress, take the brotli delta.
    const delta = brSize - br(shorten(src, names));
    console.log(
        `${cat.padEnd(22)} ${String(e.raw).padStart(9)}  ${(e.raw * 100 / rawSize).toFixed(1).padStart(5)}%  `
        + `${String(delta).padStart(9)} B  ${(delta * 100 / brSize).toFixed(1).padStart(5)}%   ${VERDICT[cat]}`);
}

for (const [cat, e] of [...byCat].sort((a, b) => b[1].raw - a[1].raw)) {
    console.log(`\n  top ${cat}:`);
    for (const x of e.names.sort((a, b) => b.raw - a.raw).slice(0, TOP)) {
        console.log(`    ${String(x.raw).padStart(6)} B  x${String(x.n).padEnd(5)} ${x.name}`);
    }
}

// --- string literals
let strBytes = 0;
const strs = [];
for (const s of segments(src)) {
    if (s.code) continue;
    strBytes += s.text.length;
    if (s.text.length > 30) strs.push(s.text);
}
console.log(`\nSTRING LITERALS  ${strBytes} B raw = ${(strBytes * 100 / rawSize).toFixed(1)}% of bundle`);
console.log(`  longest ${Math.min(8, strs.length)}:`);
for (const s of strs.sort((a, b) => b.length - a.length).slice(0, 8)) {
    console.log(`    ${String(s.length).padStart(4)} B  ${s.slice(0, 88).replace(/\n/g, ' ')}`);
}
console.log(`
NOTE  "WIRE saving" is the brotli delta from shortening a whole category to 2-3 chars —
      an upper bound no real change can beat. Compare it against the risk before acting.
`);
