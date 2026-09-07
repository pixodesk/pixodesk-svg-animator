#!/usr/bin/env node
// Renders SCHEMA.md → SCHEMA.html, a self-contained print-oriented page (no JS,
// no external resources, highlighting pre-rendered at build time).
//   node scripts/gen-schema-html.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(resolve(root, 'SCHEMA.md'), 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── inline markdown: code, bold, italics, links ─────────────────────────────
function inline(text) {
  const parts = [];
  text.replace(/`([^`]+)`|([^`]+)/g, (_, code, plain) => {
    if (code !== undefined) parts.push('<code>' + esc(code) + '</code>');
    else parts.push(esc(plain)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'));
    return '';
  });
  return parts.join('');
}

// ── code highlighting (TypeScript / JSON / JS flavours share one tokenizer) ─
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
const lines = md.split('\n');
let html = '';
let i = 0;
let title = 'Schema';
const flushPara = (buf) => { if (buf.length) html += '<p>' + inline(buf.join(' ')) + '</p>\n'; buf.length = 0; };
const para = [];
while (i < lines.length) {
  const line = lines[i];
  if (/^```/.test(line)) {
    flushPara(para);
    const fence = [];
    i++;
    while (i < lines.length && !/^```/.test(lines[i])) fence.push(lines[i++]);
    i++;
    html += '<pre class="code"><code>' + highlight(fence.join('\n')) + '</code></pre>\n';
    continue;
  }
  const h = /^(#{1,3})\s+(.*)$/.exec(line);
  if (h) {
    flushPara(para);
    const level = h[1].length;
    if (level === 1) title = h[2];
    const id = h[2].toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/ /g, '-');
    html += `<h${level} id="${id}">${inline(h[2])}</h${level}>\n`;
    i++; continue;
  }
  if (/^\|/.test(line)) {
    flushPara(para);
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
    const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const head = cells(rows[0]);
    const body = rows.slice(2).map(cells);
    html += '<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'
      + body.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('\n') + '</tbody></table>\n';
    continue;
  }
  if (/^\s*[-*]\s+/.test(line)) {
    flushPara(para);
    const items = [];
    while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
      let item = lines[i++].replace(/^\s*[-*]\s+/, '');
      while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
      items.push(item);
    }
    html += '<ul>' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</ul>\n';
    continue;
  }
  if (/^\s*\d+\.\s+/.test(line)) {
    flushPara(para);
    const items = [];
    while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
    html += '<ol>' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</ol>\n';
    continue;
  }
  if (/^>\s?/.test(line)) {
    flushPara(para);
    const q = [];
    while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
    html += '<blockquote>' + inline(q.join(' ')) + '</blockquote>\n';
    continue;
  }
  if (/^\s*$/.test(line)) { flushPara(para); i++; continue; }
  para.push(line.trim()); i++;
}
flushPara(para);

const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1f2328; background: #ffffff; max-width: 860px; margin: 0 auto; padding: 32px 24px 64px;
}
h1 { font-size: 26px; border-bottom: 1px solid #d1d9e0; padding-bottom: 8px; }
h2 { font-size: 20px; margin-top: 36px; border-bottom: 1px solid #e3e8ee; padding-bottom: 5px; }
h3 { font-size: 16px; margin-top: 24px; }
h1, h2, h3 { break-after: avoid-page; }
p, ul, ol { margin: 10px 0; }
a { color: #0969da; text-decoration: none; }
strong { font-weight: 600; }
code { font: 12px/1.5 "SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; }
pre.code { background: none; border: 1px solid #e3e8ee; border-radius: 6px; padding: 12px 14px; overflow-x: auto; margin: 12px 0; }
pre.code code { background: none; padding: 0; display: block; font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }
.cm  { color: #b3bac2; font-style: italic; }
.str { color: #0a3069; }
.kw  { color: #cf222e; }
.ty  { color: #6639ba; }
.num { color: #0550ae; }
.key { color: #0550ae; }
table { border-collapse: collapse; margin: 12px 0; width: 100%; }
th, td { border: 1px solid #d1d9e0; padding: 5px 10px; text-align: left; vertical-align: top; font-size: 13px; }
th { font-weight: 600; }
td code, th code { font-size: 11.5px; }
blockquote { border-left: 3px solid #d1d9e0; margin: 10px 0; padding: 2px 14px; color: #59636e; }
@page { margin: 16mm 14mm; }
@media print {
  body { max-width: none; padding: 0; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  pre.code { break-inside: auto; }
  table, tr { break-inside: avoid; }
  a { color: inherit; }
  h2 { margin-top: 24px; }
}`;

const page = `<!DOCTYPE html>
<!-- GENERATED from SCHEMA.md by scripts/gen-schema-html.mjs — edit the .md and regenerate; do not edit this file by hand. -->
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
writeFileSync(resolve(root, 'SCHEMA.html'), page);
console.log(`SCHEMA.html written (${(page.length / 1024).toFixed(1)} KB)`);
