#!/usr/bin/env node
// Renders the reference .md files at the repo root to .html — self-contained, compact,
// print-oriented pages (no JS, no external resources, highlighting pre-rendered here).
//
//   node scripts/gen-schema-html.mjs                  all four reference docs
//   node scripts/gen-schema-html.mjs API-SCHEMA.md    only the ones named
//
// The .html differs from its .md in LAYOUT ONLY. Every render is checked before it is written:
// the page's text must equal the .md's text word for word, with the markup removed on both
// sides. On any difference the file is not written and the script exits 1, printing where.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = ['SCHEMA.md', 'SCHEMA-NAMING-REVIEW.md', 'API-SCHEMA.md', 'API-SCHEMA-REVIEW.md'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── shared markdown helpers ────────────────────────────────────────────────
const CODE_SPAN = /`([^`]+)`/g;
const HOLE = /\u0001(\d+)\u0002/g;   // placeholder for a code span while the rest is processed

/** Table row → cells. Splits on unescaped `|` only, then unescapes `\|`. */
const splitRow = (row) => row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

const TABLE_SEP = /^\s*\|?\s*:?-{3,}.*\|/;
const HR = /^\s*-{3,}\s*$/;
const BULLET = /^\s*[-*]\s+/;
const NUMBERED = /^\s*(\d+)\.\s+/;
const CONTINUATION = /^\s{2,}\S/;

/** A doc's link to another rendered doc points at its .html twin. */
function rewriteHref(href) {
  const m = /^(\.\/)?([^/#]+)\.md(#.*)?$/.exec(href);
  return m && DOCS.includes(m[2] + '.md') ? m[2] + '.html' + (m[3] ?? '') : href;
}

// ── inline markdown: code, bold, italics, links ─────────────────────────────
function inline(text) {
  const codes = [];
  let s = text.replace(CODE_SPAN, (_, c) => '\u0001' + (codes.push(c) - 1) + '\u0002');
  s = esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => '<a href="' + rewriteHref(href.replace(/&amp;/g, '&')) + '">' + t + '</a>');
  return s.replace(HOLE, (_, n) => '<code>' + esc(codes[+n]) + '</code>');
}

// ── code highlighting (TypeScript / JSON / JS flavors share one tokenizer) ─
const KW = /\b(interface|type|const|let|var|function|return|import|export|from|extends|true|false|null|undefined|number|string|boolean|any|Record|Array|Partial)\b/;
function highlight(code) {
  // De-columnise trailing line comments: one space before `//`, never aligned.
  code = code.replace(/(\S)[ \t]{2,}\/\//g, '$1 //');
  let out = '';
  const re = /(\/\/.*$)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b-?\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][\w$]*\b)|(\s+|.)/gm;
  let m;
  while ((m = re.exec(code))) {
    const [tok, lc, bc, str, num, word] = m;
    if (lc || bc) out += '<span class="cm">' + esc(tok) + '</span>';
    else if (str) out += '<span class="str">' + esc(tok) + '</span>';
    else if (num) out += '<span class="num">' + esc(tok) + '</span>';
    else if (word) {
      const after = code.slice(re.lastIndex).match(/^\s*[?]?:/);
      if (KW.test(word)) out += '<span class="kw">' + esc(tok) + '</span>';
      else if (/^[A-Z][A-Za-z_]*$/.test(word)) out += '<span class="ty">' + esc(tok) + '</span>';
      else if (after) out += '<span class="key">' + esc(tok) + '</span>';
      else out += esc(tok);
    } else out += esc(tok);
  }
  return out;
}

// ── block parser ───────────────────────────────────────────────────────────
function render(md) {
  const lines = md.split('\n');
  let html = '';
  let title = '';
  let i = 0;
  const para = [];
  const flushPara = () => { if (para.length) html += '<p>' + inline(para.join(' ')) + '</p>\n'; para.length = 0; };
  /** One list item: its first line plus any indented continuation lines. */
  const listItem = (marker) => {
    let item = lines[i++].replace(marker, '');
    while (i < lines.length && CONTINUATION.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i])) item += ' ' + lines[i++].trim();
    return item;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara();
      const fence = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) fence.push(lines[i++]);
      i++;
      html += '<pre class="code"><code>' + highlight(fence.join('\n')) + '</code></pre>\n';
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      const level = h[1].length;
      if (level === 1 && !title) title = h[2].replace(/[`*]/g, '');
      const id = h[2].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/ /g, '-');
      html += '<h' + level + ' id="' + id + '">' + inline(h[2]) + '</h' + level + '>\n';
      i++; continue;
    }
    if (HR.test(line)) { flushPara(); html += '<hr>\n'; i++; continue; }
    if (/^\s*\|/.test(line)) {
      flushPara();
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const head = splitRow(rows[0]);
      const body = rows.slice(1).filter((r) => !TABLE_SEP.test(r)).map(splitRow);
      html += '<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'
        + body.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('\n') + '</tbody></table>\n';
      continue;
    }
    if (BULLET.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && BULLET.test(lines[i])) items.push(listItem(BULLET));
      html += '<ul>' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</ul>\n';
      continue;
    }
    if (NUMBERED.test(line)) {
      flushPara();
      const items = [];
      while (i < lines.length && NUMBERED.test(lines[i])) {
        const n = NUMBERED.exec(lines[i])[1];
        items.push('<li value="' + n + '">' + inline(listItem(NUMBERED)) + '</li>');
      }
      html += '<ol>' + items.join('') + '</ol>\n';
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      html += '<blockquote>' + inline(q.join(' ')) + '</blockquote>\n';
      continue;
    }
    if (/^\s*$/.test(line)) { flushPara(); i++; continue; }
    para.push(line.trim()); i++;
  }
  flushPara();
  return { html, title };
}

// ── the text-equivalence check ─────────────────────────────────────────────
// Both sides reduced to their words: markdown loses its markers (#, list bullets, table pipes,
// **, *, backticks, link targets) but keeps list NUMBERS; the page loses its tags. A marker the
// renderer failed to turn into markup therefore shows up as an extra word, and so does anything
// dropped, duplicated or reordered.
/** Inline markers off, code spans kept literally. */
function inlineWords(t) {
  const codes = [];
  return t.replace(CODE_SPAN, (_, c) => '\u0001' + (codes.push(c) - 1) + '\u0002')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*/g, '')
    .replace(HOLE, (_, n) => codes[+n]);
}

function mdWords(md) {
  const out = [];
  let fence = false;
  // Inline markup is read per BLOCK, as the renderer reads it: a code span may wrap a line.
  let block = [];
  const flush = () => { if (block.length) out.push(inlineWords(block.join(' '))); block = []; };
  for (const line of md.split('\n')) {
    if (/^```/.test(line)) { flush(); fence = !fence; continue; }
    if (fence) { out.push(line); continue; }
    if (/^\s*$/.test(line) || TABLE_SEP.test(line) || HR.test(line)) { flush(); continue; }
    // A table row keeps its cells verbatim — a cell may itself start with `#` or `-`.
    if (/^\s*\|/.test(line)) { flush(); out.push(splitRow(line).map(inlineWords).join(' ')); continue; }
    if (/^#{1,6}\s+/.test(line)) { flush(); out.push(inlineWords(line.replace(/^#{1,6}\s+/, ''))); continue; }
    if (BULLET.test(line) || NUMBERED.test(line)) flush();   // each list item is its own block
    block.push(line.replace(BULLET, '').replace(/^\s*(\d+)\.\s+/, '$1. ').replace(/^>\s?/, '').trim());
  }
  flush();
  return out.join('\n').split(/\s+/).filter(Boolean);
}

function pageWords(page) {
  const body = page.slice(page.indexOf('<body>') + '<body>'.length, page.lastIndexOf('</body>'));
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<li value="(\d+)">/g, ' $1. ')
    .replace(/<\/?(code|strong|em|a|span)\b[^>]*>/g, '')   // inline: no word break
    .replace(/<[^>]+>/g, ' ')                               // block: word break
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .split(/\s+/).filter(Boolean);
}

/** `undefined` when equal, else a description of the first difference. */
function textDifference(a, b) {
  const n = Math.min(a.length, b.length);
  let k = 0;
  while (k < n && a[k] === b[k]) k++;
  if (k === n && a.length === b.length) return undefined;
  const around = (w) => w.slice(Math.max(0, k - 6), k + 6).join(' ');
  return 'first difference at word ' + k + ' (md has ' + a.length + ' words, html ' + b.length + ')\n'
    + '    md:   … ' + around(a) + ' …\n'
    + '    html: … ' + around(b) + ' …';
}

// ── page ───────────────────────────────────────────────────────────────────
const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font: 12.5px/1.42 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1f2328; background: #ffffff; max-width: 1040px; margin: 0 auto; padding: 20px 20px 40px;
}
h1 { font-size: 20px; margin: 0 0 10px; border-bottom: 1px solid #d1d9e0; padding-bottom: 5px; }
h2 { font-size: 16px; margin: 20px 0 6px; border-bottom: 1px solid #e3e8ee; padding-bottom: 3px; }
h3 { font-size: 13.5px; margin: 14px 0 4px; }
h4, h5, h6 { font-size: 12.5px; margin: 10px 0 3px; }
h1, h2, h3, h4 { break-after: avoid-page; }
p, ul, ol, blockquote { margin: 5px 0; }
ul, ol { padding-left: 20px; }
li { margin: 1px 0; }
hr { border: 0; border-top: 1px solid #e3e8ee; margin: 12px 0; }
a { color: #0969da; text-decoration: none; }
strong { font-weight: 600; }
code { font: 11px/1.4 "SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; }
pre.code { border: 1px solid #e3e8ee; border-radius: 4px; padding: 6px 9px; margin: 6px 0; overflow-x: auto; }
pre.code code { display: block; font-size: 10.5px; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
.cm  { color: #8c959f; font-style: italic; }
.str { color: #0a3069; }
.kw  { color: #cf222e; }
.ty  { color: #6639ba; }
.num { color: #0550ae; }
.key { color: #0550ae; }
table { border-collapse: collapse; margin: 6px 0; width: 100%; }
thead { display: table-header-group; }
th, td { border: 1px solid #d1d9e0; padding: 2px 6px; text-align: left; vertical-align: top; font-size: 11.5px; overflow-wrap: anywhere; }
th { font-weight: 600; background: #f6f8fa; }
td code, th code { font-size: 10.5px; }
blockquote { border-left: 3px solid #d1d9e0; padding: 1px 10px; color: #59636e; }
@page { margin: 11mm 10mm; }
@media print {
  body { max-width: none; padding: 0; font-size: 10.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 16px; }
  h2 { font-size: 13.5px; margin-top: 14px; }
  h3 { font-size: 11.5px; margin-top: 10px; }
  code, td code, th code { font-size: 9px; }
  pre.code code { font-size: 8.8px; }
  th, td { font-size: 9.5px; padding: 1px 5px; }
  pre.code { break-inside: auto; }
  tr, li { break-inside: avoid; }
  a { color: inherit; }
}`;

function page(title, html, source) {
  return `<!DOCTYPE html>
<!-- GENERATED from ${source} by scripts/gen-schema-html.mjs — edit the .md and regenerate; do not edit this file by hand. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${css}
</style>
</head>
<body>
${html}</body>
</html>
`;
}

// ── main ───────────────────────────────────────────────────────────────────
const targets = process.argv.slice(2).length ? process.argv.slice(2) : DOCS;
let failed = 0;
for (const name of targets) {
  const md = readFileSync(resolve(root, name), 'utf8');
  const { html, title } = render(md);
  const out = page(title || name, html, name);
  const diff = textDifference(mdWords(md), pageWords(out));
  const target = name.replace(/\.md$/, '.html');
  if (diff) {
    console.error(target + ' NOT written — its text differs from ' + name + ':\n  ' + diff);
    failed++;
    continue;
  }
  writeFileSync(resolve(root, target), out);
  console.log(target + ' written (' + (out.length / 1024).toFixed(1) + ' KB) — text identical to ' + name);
}
process.exit(failed ? 1 : 0);
