// One function per marker kind. Each returns findings — plain sentences with a line — and
// nothing else; the test turns them into failures. See README.md for the marker grammar.
import ts from 'typescript';
import { ALL_PKGS, PKG_NPM_NAME, pkgFromText, type Pkg } from './config';
import {
    backtickSpans, isGroupRow, isIdentifier, memberNameFromCell, rowMemberNames, sectionAt,
    type Marker, type MdBlock, type MdCode, type MdDoc, type MdTable,
} from './md';
import { SchemaFacts } from './schema-facts';
import { docImports, parseDocBlock, TsFacts, type DocDecl, type DocMember } from './ts-facts';
import { explainTypes, stripComments, typesEqual } from './type-text';

export interface Finding { line: number; message: string; }

/** `DOCS_CHECK_DEBUG=1` appends the normalized spellings to every type mismatch. */
const DEBUG = !!process.env.DOCS_CHECK_DEBUG;
const why = (docType: string, realType: string, ctx: Ctx): string => (DEBUG ? ` — ${explainTypes(docType, realType, ctx.facts.aliases())}` : '');

export interface Ctx { facts: TsFacts; schemas: SchemaFacts; }

export const KINDS = ['off', 'props', 'signature', 'exports', 'matrix', 'values', 'emits', 'members', 'schema', 'schema-block', 'usage'] as const;

const csv = (v: string | undefined): Set<string> => new Set((v ?? '').split(',').map(s => s.trim()).filter(Boolean));

export function runMarker(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    switch (m.kind) {
        case 'off': return m.opts.reason ? [] : [{ line: m.line, message: 'px-check off needs a reason: <!-- px-check off why this table is prose -->' }];
        case 'props': return checkProps(doc, m, ctx);
        case 'signature': return checkSignature(doc, m, ctx);
        case 'exports': return checkExports(doc, m, ctx);
        case 'matrix': return checkMatrix(doc, m, ctx);
        case 'values': return checkValues(doc, m, ctx);
        case 'emits': return checkEmits(doc, m, ctx);
        case 'members': return checkMembers(doc, m, ctx);
        case 'schema': return checkSchemaTable(doc, m, ctx);
        case 'schema-block': return checkSchemaBlock(doc, m, ctx);
        case 'usage': return m.block?.kind === 'code' ? checkUsage(m.block, ctx) : [need(m, 'a code block')];
        default: return [{ line: m.line, message: `unknown px-check kind "${m.kind}" — one of ${KINDS.join(', ')}` }];
    }
}

/** Tables and reference code blocks without a marker, plus the implicit usage check on import snippets. */
export function coverageFindings(doc: MdDoc, ctx: Ctx): Array<Finding> {
    const out: Array<Finding> = [];
    const marked = new Set(doc.markers.map(m => m.block).filter(Boolean));
    for (const b of doc.blocks) {
        if (marked.has(b)) continue;
        if (b.kind === 'table') {
            out.push({ line: b.line, message: `table without a marker — add <!-- px-check props|schema|values|… --> or <!-- px-check off <why> --> above it` });
        } else if (b.kind === 'code' && isTsLang(b.lang)) {
            if (docImports(b.text).length) out.push(...checkUsage(b, ctx));
            else if (parseDocBlock(b.text, b.line).decls.some(d => d.kind !== 'const' || d.type || d.members)) {
                out.push({ line: b.line, message: `reference code block without a marker — add <!-- px-check signature --> (or schema-block / off) above it` });
            }
        }
    }
    return out;
}

const isTsLang = (lang: string): boolean => /^(ts|tsx|typescript)$/.test(lang);
const need = (m: Marker, what: string): Finding => ({ line: m.line, message: `px-check ${m.kind} must sit directly above ${what}` });

function defaultPkg(doc: MdDoc, m: Marker): Pkg | undefined {
    if (m.opts.pkg) return m.opts.pkg as Pkg;
    return pkgFromText(sectionAt(doc, m.line).heading?.text ?? '') ?? pkgFromText(doc.file);
}

function resolveType(ctx: Ctx, name: string, preferred: Pkg | undefined): { pkg: Pkg } | undefined {
    const pkg = ctx.facts.locate(name, preferred);
    return pkg ? { pkg } : undefined;
}

// ---- props: a table whose first column names the members of a type ----------------------------

function checkProps(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (m.block?.kind !== 'table') return [need(m, 'a table')];
    if (!m.target) return [{ line: m.line, message: 'px-check props needs the type name: <!-- px-check props PxAnimatorOptions -->' }];
    const loc = resolveType(ctx, m.target, defaultPkg(doc, m));
    if (!loc) return [{ line: m.line, message: `"${m.target}" is not exported by any package` }];
    // a Vue component answers with its props (names + required); types are not compared then
    const real = ctx.facts.members(loc.pkg, m.target)
        ?? ctx.facts.vueComponent(loc.pkg, m.target)?.props.map(p => ({ name: p.name, optional: !p.required, type: '', method: false }));
    if (!real) return [{ line: m.line, message: `"${m.target}" (${loc.pkg}) is not a type with members` }];
    const realByName = new Map(real.map(r => [r.name, r]));
    const omit = csv(m.opts.omit);
    const strictTypes = m.opts.types !== undefined;
    const typeCol = m.block.header.findIndex(h => /^type$/i.test(h.trim()));
    const out: Array<Finding> = [];
    const seen = new Set<string>();

    const col = Number(m.opts.col ?? '1');
    for (const row of m.block.rows) {
        if (row.flags.skip || isGroupRow(row)) continue;
        const names = rowMemberNames(row, col);
        if (!names.length) { out.push({ line: row.line, message: 'row does not name a member in its first cell (use <!-- px skip --> for prose rows, <!-- px name=x --> or names=x,y to point at them)' }); continue; }
        for (const name of names) {
            if (row.flags.extra) {
                if (realByName.has(name)) out.push({ line: row.line, message: `"${name}" is marked extra but IS a member of ${m.target}` });
                continue;
            }
            const r = realByName.get(name);
            if (!r) { out.push({ line: row.line, message: `"${name}" is not a member of ${m.target} (${loc.pkg}) — members: ${real.map(x => x.name).join(', ')}` }); continue; }
            seen.add(name);
            if (strictTypes && typeCol >= 0 && !row.flags.loose && r.type) {
                const docType = backtickSpans(row.cells[typeCol] ?? '').join(' | ');
                if (!typesEqual(docType, r.type, ctx.facts.aliases())) out.push({ line: row.line, message: `"${name}" type: doc says \`${docType}\`, ${m.target} says \`${r.type}\`${why(docType, r.type, ctx)}` });
            }
        }
    }
    for (const o of omit) if (!realByName.has(o)) out.push({ line: m.line, message: `omit=${o}: "${o}" is not a member of ${m.target} — the omission is stale` });
    const missing = real.filter(r => !seen.has(r.name) && !omit.has(r.name));
    if (missing.length) out.push({ line: m.block.line, message: `${m.target} members not in the table: ${missing.map(r => r.name).join(', ')} (document them, or omit=… on the marker)` });
    return out;
}

// ---- signature: a TypeScript block whose declarations mirror exported ones -------------------

function checkSignature(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (m.block?.kind !== 'code') return [need(m, 'a TypeScript code block')];
    const { decls } = parseDocBlock(m.block.text, m.block.line);
    if (!decls.length) return [{ line: m.block.line, message: 'no declarations found in the block' }];
    const pref = defaultPkg(doc, m);
    const omit = csv(m.opts.omit), loose = csv(m.opts.loose), extra = csv(m.opts.extra), skip = csv(m.opts.skip);
    const out: Array<Finding> = [];
    const declared = new Map(decls.map(d => [d.name, d]));

    for (const d of decls) {
        if (skip.has(d.name)) continue;
        const loc = resolveType(ctx, d.name, pref);
        if (!loc) { out.push({ line: d.line, message: `"${d.name}" is not exported by any package (skip=${d.name} if it is a doc-only name)` }); continue; }
        const key = (member: string): string => `${d.name}.${member}`;
        if (d.kind === 'interface') {
            const real = ctx.facts.members(loc.pkg, d.name);
            if (!real) { out.push({ line: d.line, message: `"${d.name}" (${loc.pkg}) is not a type with members` }); continue; }
            const realByName = new Map(real.map(r => [r.name, r]));
            const shown = new Set<string>();
            for (const dm of d.members ?? []) {
                if (extra.has(key(dm.name))) { if (realByName.has(dm.name)) out.push({ line: dm.line, message: `${key(dm.name)} is marked extra but exists on the type` }); continue; }
                const r = realByName.get(dm.name);
                if (!r) { out.push({ line: dm.line, message: `${key(dm.name)} is not a member — the type has: ${real.map(x => x.name).join(', ')}` }); continue; }
                shown.add(dm.name);
                if (dm.optional !== r.optional) out.push({ line: dm.line, message: `${key(dm.name)} is ${r.optional ? 'optional' : 'required'} on the type` });
                if (!loose.has(key(dm.name)) && !typesEqual(dm.type, r.type, ctx.facts.aliases())) {
                    out.push({ line: dm.line, message: `${key(dm.name)} type: doc says \`${stripComments(dm.type).replace(/\s+/g, ' ').trim()}\`, type says \`${r.type}\`${why(dm.type, r.type, ctx)}` });
                }
            }
            // members carried by an `extends` clause count as shown
            for (const ext of d.extends ?? []) {
                const extLoc = resolveType(ctx, ext, loc.pkg);
                const extMembers = extLoc && ctx.facts.members(extLoc.pkg, ext);
                if (!extMembers) { out.push({ line: d.line, message: `${d.name} extends "${ext}" which is not an exported type` }); continue; }
                for (const em of extMembers) shown.add(em.name);
            }
            const missing = real.filter(r => !shown.has(r.name) && !omit.has(key(r.name)));
            if (missing.length) out.push({ line: d.line, message: `${d.name} members not shown: ${missing.map(r => r.name).join(', ')} (omit=${d.name}.x to leave one out on purpose)` });
            for (const o of omit) if (o.startsWith(d.name + '.') && !realByName.has(o.slice(d.name.length + 1))) out.push({ line: m.line, message: `omit=${o}: not a member of ${d.name}` });
        } else if (d.kind === 'type') {
            const exp = ctx.facts.aliasExpansion(loc.pkg, d.name);
            if (exp === undefined) { out.push({ line: d.line, message: `"${d.name}" is not a type alias in ${loc.pkg}` }); continue; }
            if (!loose.has(d.name) && !typesEqual(d.type!, exp, ctx.facts.aliases())) out.push({ line: d.line, message: `type ${d.name}: doc says \`${stripComments(d.type!).replace(/\s+/g, ' ').trim()}\`, ${loc.pkg} says \`${exp}\`` });
        } else if (d.kind === 'function') {
            const sigs = ctx.facts.callSignatures(loc.pkg, d.name);
            if (!sigs.length) { out.push({ line: d.line, message: `"${d.name}" is not a function in ${loc.pkg}` }); continue; }
            if (loose.has(d.name)) continue;
            const problems = sigs.map(sig => sigMismatch(d, sig, ctx));
            if (problems.every(Boolean)) out.push({ line: d.line, message: `function ${d.name}: ${problems[0]}` });
        } else if (d.kind === 'const') {
            if (!ctx.facts.isValue(loc.pkg, d.name)) { out.push({ line: d.line, message: `"${d.name}" is not a value export of ${loc.pkg}` }); continue; }
            if (d.members) {
                const keys = ctx.facts.constKeys(loc.pkg, d.name) ?? [];
                const realKeys = new Set(keys.map(k => k.key));
                for (const dm of d.members) if (!realKeys.has(dm.name)) out.push({ line: dm.line, message: `${key(dm.name)} is not a key of the const — keys: ${[...realKeys].join(', ')}` });
                const shown = new Set(d.members.map(x => x.name));
                const missing = keys.filter(k => !shown.has(k.key) && !omit.has(key(k.key)));
                if (missing.length) out.push({ line: d.line, message: `${d.name} keys not shown: ${missing.map(k => k.key).join(', ')}` });
            } else if (d.typeNode && isDefineComponentLiteral(d.typeNode)) {
                out.push(...checkVueLiteral(d, loc.pkg, ctx, omit, extra));
            } else if (d.type && !loose.has(d.name)) {
                const real = ctx.facts.typeText(ctx.facts.typeOf(loc.pkg, d.name)!, loc.pkg);
                if (!typesEqual(d.type, real, ctx.facts.aliases())) out.push({ line: d.line, message: `const ${d.name}: doc says \`${d.type}\`, ${loc.pkg} says \`${real}\`` });
            }
        }
    }
    void declared;
    return out;
}

function sigMismatch(d: DocDecl, sig: { params: Array<{ name: string; optional: boolean; type: string }>; returnType: string }, ctx: Ctx): string | undefined {
    const dp = d.params ?? [];
    if (dp.length !== sig.params.length) return `doc shows ${dp.length} parameter(s), the type has ${sig.params.length} (${sig.params.map(p => p.name).join(', ')})`;
    for (let i = 0; i < dp.length; i++) {
        const a = dp[i], b = sig.params[i];
        // `__0` is TypeScript's name for a destructured parameter — the doc may call it anything
        if (a.name !== b.name && !b.name.startsWith('__')) return `parameter ${i + 1} is "${b.name}" on the type, doc says "${a.name}"`;
        if (a.optional !== b.optional) return `parameter "${b.name}" is ${b.optional ? 'optional' : 'required'} on the type`;
        if (!typesEqual(a.type, b.type, ctx.facts.aliases())) return `parameter "${b.name}" type: doc says \`${a.type}\`, type says \`${b.type}\``;
    }
    if (!typesEqual(d.returnType ?? 'any', sig.returnType, ctx.facts.aliases())) return `return type: doc says \`${d.returnType}\`, type says \`${sig.returnType}\``;
    return undefined;
}

function isDefineComponentLiteral(t: ts.TypeNode): boolean {
    return ts.isTypeReferenceNode(t) && /DefineComponent$/.test(t.typeName.getText()) && !!t.typeArguments?.[0] && ts.isTypeLiteralNode(t.typeArguments[0]);
}

/** `const X: DefineComponent<{ a: T; b?: U }>` in a doc ↔ the Vue component's props (names + required) and emits. */
function checkVueLiteral(d: DocDecl, pkg: Pkg, ctx: Ctx, omit: Set<string>, extra: Set<string>): Array<Finding> {
    const comp = ctx.facts.vueComponent(pkg, d.name);
    if (!comp) return [{ line: d.line, message: `"${d.name}" is not a DefineComponent in ${pkg}` }];
    const lit = (d.typeNode as ts.TypeReferenceNode).typeArguments![0] as ts.TypeLiteralNode;
    const sf = lit.getSourceFile();
    const out: Array<Finding> = [];
    const propByName = new Map(comp.props.map(p => [p.name, p]));
    const shown = new Set<string>();
    for (const mem of lit.members) {
        if (!ts.isPropertySignature(mem) || !mem.name) continue;
        const name = mem.name.getText(sf);
        const line = d.line + sf.getLineAndCharacterOfPosition(mem.getStart(sf)).line;
        const key = `${d.name}.${name}`;
        if (extra.has(key)) continue;
        const p = propByName.get(name);
        if (!p) { out.push({ line, message: `${key} is not a prop — props: ${comp.props.map(x => x.name).join(', ')}` }); continue; }
        shown.add(name);
        if (p.required === !!mem.questionToken) out.push({ line, message: `${key} is ${p.required ? 'required' : 'optional'} on the component` });
    }
    const missing = comp.props.filter(p => !shown.has(p.name) && !omit.has(`${d.name}.${p.name}`));
    if (missing.length) out.push({ line: d.line, message: `${d.name} props not shown: ${missing.map(p => p.name).join(', ')}` });
    return out;
}

// ---- exports: a package section must mention every export, and list each once ------------------

function checkExports(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    const pkg = (m.target && pkgFromText(m.target)) ?? (m.target as Pkg | undefined) ?? defaultPkg(doc, m);
    if (!pkg || !ALL_PKGS.includes(pkg)) return [{ line: m.line, message: `px-check exports needs a package: <!-- px-check exports @pixodesk/svg-animator-web -->` }];
    // `partial`: only the marked table's first column is checked — every name must be an export; nothing about completeness
    if (m.opts.partial !== undefined) {
        if (m.block?.kind !== 'table') return [need(m, 'a table (with partial)')];
        const exp = ctx.facts.exportNames(pkg);
        const out: Array<Finding> = [];
        // the column headed "Exports" / "Symbols" when there is one, else the first
        const col = Math.max(0, m.block.header.findIndex(h => /export|symbol/i.test(h)));
        for (const row of m.block.rows) {
            if (row.flags.skip || row.flags.extra) continue;
            for (const span of backtickSpans(row.cells[col] ?? '')) {
                const name = span.replace(/\(.*$/, '').trim();
                if (isIdentifier(name) && !exp.has(name)) out.push({ line: row.line, message: `"${name}" is not exported by ${PKG_NPM_NAME[pkg]}` });
            }
        }
        return out;
    }
    const sec = sectionAt(doc, m.line);
    const except = csv(m.opts.except);
    const mentioned = new Set<string>();
    const listed = new Map<string, Array<number>>();
    const out: Array<Finding> = [];

    for (const b of doc.blocks) {
        if (b.line < sec.start || b.line > sec.end) continue;
        if (b.kind === 'code' && isTsLang(b.lang)) {
            for (const d of parseDocBlock(b.text, b.line).decls) mentioned.add(d.name);
            for (const id of b.text.match(/[A-Za-z_$][\w$]*/g) ?? []) mentioned.add(id);
        } else if (b.kind === 'table') {
            const symCols = b.header.map((h, i) => (/symbol/i.test(h) ? i : -1)).filter(i => i >= 0);
            for (const row of b.rows) {
                row.cells.forEach((cell, ci) => {
                    for (const span of backtickSpans(cell)) {
                        for (const id of span.match(/[A-Za-z_$][\w$]*/g) ?? []) mentioned.add(id);
                        if (symCols.includes(ci) && isIdentifier(span) && !row.flags.extra) {
                            listed.set(span, [...(listed.get(span) ?? []), row.line]);
                        }
                    }
                });
            }
        } else if (b.kind === 'paragraph' || b.kind === 'heading') {
            for (const span of backtickSpans(b.text)) for (const id of span.match(/[A-Za-z_$][\w$]*/g) ?? []) mentioned.add(id);
        }
    }
    const exportsSet = ctx.facts.exportNames(pkg);
    const missing = [...exportsSet].filter(n => !mentioned.has(n) && !except.has(n)).sort();
    if (missing.length) out.push({ line: sec.start, message: `${PKG_NPM_NAME[pkg]} exports not mentioned in this section: ${missing.join(', ')}` });
    for (const [name, lines] of listed) {
        if (!exportsSet.has(name)) out.push({ line: lines[0], message: `"${name}" is listed as a symbol but ${PKG_NPM_NAME[pkg]} does not export it (<!-- px extra --> on the row if it belongs to another package)` });
        else if (lines.length > 1) out.push({ line: lines[1], message: `"${name}" is listed twice (also at line ${lines[0]})` });
    }
    for (const e of except) if (!exportsSet.has(e)) out.push({ line: m.line, message: `except=${e}: not an export of ${pkg}` });
    return out;
}

// ---- matrix: one row per name, one column per surface ---------------------------------------

function checkMatrix(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (m.block?.kind !== 'table') return [need(m, 'a table')];
    const cols = Object.entries(m.opts).filter(([k]) => !['pkg'].includes(k));
    if (!cols.length) return [{ line: m.line, message: 'px-check matrix needs column targets: <!-- px-check matrix web=web:PxAnimatorOptions react=react:Props vue=~ -->' }];
    const out: Array<Finding> = [];
    // column i+1 of the table ↔ cols[i]; a trailing Notes column is ignored
    const targets = cols.map(([key, spec]) => {
        if (spec === '~') return { key, skip: true as const };
        const [pkgName, typeName] = spec.split(':');
        const pkg = pkgName as Pkg;
        const members = ctx.facts.members(pkg, typeName);
        if (members) return { key, skip: false as const, names: new Set(members.map(x => x.name)), emits: new Set<string>() };
        const comp = ctx.facts.vueComponent(pkg, typeName);
        if (comp) return { key, skip: false as const, names: new Set(comp.props.map(p => p.name)), emits: new Set(comp.emits) };
        out.push({ line: m.line, message: `${key}=${spec}: "${typeName}" is not a type or component in ${pkg}` });
        return { key, skip: true as const };
    });
    for (const row of m.block.rows) {
        if (row.flags.skip || (row.cells[0] ?? '').startsWith('**')) continue;
        const name = row.flags.name ?? memberNameFromCell(row.cells[0] ?? '');
        if (!name) { out.push({ line: row.line, message: 'row does not name a member in its first cell' }); continue; }
        targets.forEach((t, i) => {
            if (t.skip || row.flags.cols[t.key] === '~') return;
            const cell = (row.cells[i + 1] ?? '').trim();
            const absent = cell === '—' || cell === '-' || cell === '';
            const has = t.names.has(name);
            if (cell.startsWith('`@')) {
                const ev = cell.slice(2).replace(/`.*$/, '');
                if (!t.emits.has(ev)) out.push({ line: row.line, message: `${t.key}: "@${ev}" is not an event of the component (emits: ${[...t.emits].join(', ')})` });
                return;
            }
            if (absent && has) out.push({ line: row.line, message: `${t.key}: "${name}" IS a member there — the cell says —` });
            if (!absent && !has) out.push({ line: row.line, message: `${t.key}: "${name}" is not a member there — the cell says "${cell}" (<!-- px ${t.key}=~ --> to leave it unchecked)` });
        });
    }
    // every member of every column must have a row
    const rowNames = new Set(m.block.rows.map(r => r.flags.name ?? memberNameFromCell(r.cells[0] ?? '')).filter(Boolean));
    for (const t of targets) {
        if (t.skip) continue;
        const missing = [...t.names].filter(n => !rowNames.has(n) && !csv(m.opts[`omit-${t.key}`]).has(n));
        if (missing.length) out.push({ line: m.block.line, message: `${t.key}: members without a row: ${missing.join(', ')}` });
    }
    return out;
}

// ---- values: a table listing the keys / values of a const object ----------------------------

function checkValues(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (m.block?.kind !== 'table') return [need(m, 'a table')];
    if (!m.target) return [{ line: m.line, message: 'px-check values needs the const name' }];
    const loc = resolveType(ctx, m.target, defaultPkg(doc, m));
    const keys = loc && ctx.facts.constKeys(loc.pkg, m.target);
    if (!keys) return [{ line: m.line, message: `"${m.target}" is not an exported const object` }];
    const col = Number(m.opts.col ?? '1') - 1;
    const accepted = new Set<string>();
    for (const k of keys) { accepted.add(k.key); if (k.value !== undefined) accepted.add(String(k.value)); }
    const out: Array<Finding> = [];
    const seen = new Set<string>();
    for (const row of m.block.rows) {
        if (row.flags.skip) continue;
        const span = backtickSpans(row.cells[col] ?? '')[0];
        const v = row.flags.name ?? span?.replace(/^'|'$/g, '');
        if (!v) { out.push({ line: row.line, message: 'row has no backticked value in the value column' }); continue; }
        if (row.flags.extra) continue;
        if (!accepted.has(v)) { out.push({ line: row.line, message: `"${v}" is not a value of ${m.target} (${[...accepted].join(', ')})` }); continue; }
        const k = keys.find(x => x.key === v || String(x.value) === v)!;
        seen.add(k.key);
    }
    const omit = csv(m.opts.omit);
    const missing = keys.filter(k => !seen.has(k.key) && !omit.has(k.key));
    if (missing.length) out.push({ line: m.block.line, message: `${m.target} values not in the table: ${missing.map(k => k.key).join(', ')}` });
    return out;
}

// ---- emits: a table listing a Vue component's events --------------------------------------------

function checkEmits(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (m.block?.kind !== 'table') return [need(m, 'a table')];
    if (!m.target) return [{ line: m.line, message: 'px-check emits needs the component name' }];
    const pkg = defaultPkg(doc, m) ?? 'vue';
    const comp = ctx.facts.vueComponent(pkg, m.target);
    if (!comp) return [{ line: m.line, message: `"${m.target}" is not a Vue component in ${pkg}` }];
    const out: Array<Finding> = [];
    const seen = new Set<string>();
    for (const row of m.block.rows) {
        if (row.flags.skip || isGroupRow(row)) continue;
        const ev = (row.flags.name ?? backtickSpans(row.cells[0] ?? '')[0] ?? '').replace(/^@/, '');
        if (!ev) { out.push({ line: row.line, message: 'row does not name an event in its first cell' }); continue; }
        if (!comp.emits.includes(ev)) { out.push({ line: row.line, message: `"${ev}" is not an event of ${m.target} (emits: ${comp.emits.join(', ')})` }); continue; }
        seen.add(ev);
    }
    const missing = comp.emits.filter(e => !seen.has(e));
    if (missing.length) out.push({ line: m.block.line, message: `${m.target} events not in the table: ${missing.join(', ')}` });
    return out;
}

// ---- members: a paragraph / list naming the members of a type in backticks -------------------

function checkMembers(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (!m.block || m.block.kind === 'code') return [need(m, 'a paragraph, list or table')];
    if (!m.target) return [{ line: m.line, message: 'px-check members needs the type name' }];
    const loc = resolveType(ctx, m.target, defaultPkg(doc, m));
    const real = loc && ctx.facts.members(loc.pkg, m.target);
    if (!real) return [{ line: m.line, message: `"${m.target}" is not an exported type with members` }];
    const text = m.block.kind === 'table' ? m.block.rows.map(r => r.cells.join(' ')).join('\n') : m.block.text;
    const names = new Set<string>();
    for (const span of backtickSpans(text)) {
        const n = span.replace(/\(.*$/, '').replace(/^[\w$]+\./, '').trim();
        if (isIdentifier(n) && n !== m.target) names.add(n);
    }
    const realNames = new Set(real.map(r => r.name));
    const omit = csv(m.opts.omit), extra = csv(m.opts.extra);
    const out: Array<Finding> = [];
    for (const n of names) if (!realNames.has(n) && !extra.has(n)) out.push({ line: m.block.line, message: `"${n}" is not a member of ${m.target} (extra=${n} if it is not meant to be)` });
    const missing = real.filter(r => !names.has(r.name) && !omit.has(r.name));
    if (missing.length) out.push({ line: m.block.line, message: `${m.target} members not mentioned: ${missing.map(r => r.name).join(', ')}` });
    return out;
}

// ---- usage: import snippets may only import what the package exports -------------------------

function checkUsage(b: MdCode, ctx: Ctx): Array<Finding> {
    const out: Array<Finding> = [];
    for (const imp of docImports(b.text)) {
        const pkg = pkgFromText(imp.pkg);
        if (!pkg) continue;
        const exp = ctx.facts.exportNames(pkg);
        for (const n of imp.names) if (!exp.has(n)) out.push({ line: b.line + imp.line - 1, message: `imports "${n}" from ${imp.pkg}, which does not export it` });
    }
    return out;
}

// ---- schema: a field table ↔ a runtime schema's keys ----------------------------------------

function checkSchemaTable(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (m.block?.kind !== 'table') return [need(m, 'a table')];
    if (!m.target) return [{ line: m.line, message: 'px-check schema needs the schema name: <!-- px-check schema PxTriggerSchema -->' }];
    const root = ctx.schemas.byName(m.target);
    if (!root) return [{ line: m.line, message: `"${m.target}" is not a schema exported by core` }];
    let base = m.opts.at ? ctx.schemas.at(root, m.opts.at) : root;
    if (!base) return [{ line: m.line, message: `at=${m.opts.at}: no such path in ${m.target}` }];
    const where = `${m.target}${m.opts.at ? ' at ' + m.opts.at : ''}`;
    // `values=type`: the table lists the discriminant values of a discriminated union
    if (m.opts.values) {
        const variants = ctx.schemas.variants(base);
        if (!variants.length || variants[0].discriminant !== m.opts.values) return [{ line: m.line, message: `${where} is not a union discriminated by "${m.opts.values}"` }];
        const accepted = new Set(variants.flatMap(v => v.values.map(String)));
        const out: Array<Finding> = [];
        const seen = new Set<string>();
        for (const row of m.block.rows) {
            if (row.flags.skip || isGroupRow(row)) continue;
            const v = row.flags.name ?? backtickSpans(row.cells[0] ?? '')[0]?.replace(/^'|'$/g, '');
            if (!v) { out.push({ line: row.line, message: 'row has no backticked value in its first cell' }); continue; }
            if (!accepted.has(v)) { out.push({ line: row.line, message: `"${v}" is not a value of ${where}.${m.opts.values} (${[...accepted].join(', ')})` }); continue; }
            seen.add(v);
        }
        const missing = [...accepted].filter(v => !seen.has(v));
        if (missing.length) out.push({ line: m.block.line, message: `${where}.${m.opts.values} values not in the table: ${missing.join(', ')}` });
        return out;
    }
    // `variant=scroll`: one member of a discriminated union, picked by its discriminant value
    if (m.opts.variant) {
        const v = ctx.schemas.variants(base).find(x => x.values.map(String).includes(m.opts.variant));
        if (!v) return [{ line: m.line, message: `variant=${m.opts.variant}: no such member in ${where}` }];
        base = v.schema;
    }
    const shape = ctx.schemas.shape(base);
    if (!shape) return [{ line: m.line, message: `${where} is not an object schema` }];
    const omit = csv(m.opts.omit);
    const out: Array<Finding> = [];
    const seen = new Set<string>();
    const col = Number(m.opts.col ?? '1');
    for (const row of m.block.rows) {
        if (row.flags.skip || isGroupRow(row)) continue;
        const names = rowMemberNames(row, col);
        if (!names.length) { out.push({ line: row.line, message: 'row does not name a field in its first cell (<!-- px skip --> for prose rows)' }); continue; }
        if (row.flags.extra) continue;
        for (const name of names) {
            const dot = name.lastIndexOf('.');
            if (dot > 0) {
                // `retime.start` documents `retime` too
                const parent = ctx.schemas.at(base, name.slice(0, dot));
                const pshape = parent && ctx.schemas.shape(parent);
                if (!pshape || !pshape.keys.has(name.slice(dot + 1))) out.push({ line: row.line, message: `"${name}" is not a field of ${where}` });
                else seen.add(name.split('.')[0]);
                continue;
            }
            if (!shape.keys.has(name)) { out.push({ line: row.line, message: `"${name}" is not a field of ${where} — fields: ${[...shape.keys.keys()].join(', ')}` }); continue; }
            seen.add(name);
        }
    }
    if (!m.opts.partial) {
        const missing = [...shape.keys.keys()].filter(k => !seen.has(k) && !omit.has(k));
        if (missing.length) out.push({ line: m.block.line, message: `${m.target} fields not in the table: ${missing.join(', ')} (omit=… or partial on the marker)` });
    }
    return out;
}

// ---- schema-block: a TypeScript block that spells the wire format ↔ the runtime schemas --------

/**
 * Marker: `<!-- px-check schema-block SVG_JSON=PxAnimatedSvgDocumentSchema NODE=PxNodeSchema -->`.
 * Every interface named in the map is walked against its schema: keys, optionality, nested object
 * literals (through arrays, records and discriminated unions), and references to other mapped
 * names. `skip=a.b,c` leaves paths alone; the map is shared by every schema-block marker in a file.
 */
function checkSchemaBlock(doc: MdDoc, m: Marker, ctx: Ctx): Array<Finding> {
    if (m.block?.kind !== 'code') return [need(m, 'a TypeScript code block')];
    const map = new Map<string, string>();
    for (const mk of doc.markers) if (mk.kind === 'schema-block') for (const [k, v] of Object.entries(mk.opts)) if (/^[A-Z_]/.test(k) && /Schema$/.test(v)) map.set(k, v);
    if (mk_target(m)) map.set(mk_target(m)!.split('=')[0], mk_target(m)!.split('=')[1]);
    const skip = csv(m.opts.skip);
    const { decls, sourceFile } = parseDocBlock(m.block.text, m.block.line);
    const declByName = new Map(decls.filter(d => d.kind === 'interface').map(d => [d.name, d]));
    const out: Array<Finding> = [];
    const done = new Set<string>();
    const lineOf = (node: ts.Node): number => m.block!.line + sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;

    const checkInterface = (name: string): void => {
        if (done.has(name)) return;
        done.add(name);
        const d = declByName.get(name);
        const schemaName = map.get(name);
        if (!d || !schemaName) return;
        const schema = ctx.schemas.byName(schemaName);
        if (!schema) { out.push({ line: d.line, message: `${name}: "${schemaName}" is not a schema exported by core` }); return; }
        const node = sourceFile.statements.find((s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === name)!;
        // `interface SVG_JSON extends NODE`: the keys of NODE's schema count as shown
        const inherited = new Set<string>();
        for (const h of node.heritageClauses ?? []) for (const t of h.types) {
            const base = map.get(t.expression.getText(sourceFile));
            const baseSchema = base && ctx.schemas.byName(base);
            const baseShape = baseSchema && ctx.schemas.shape(baseSchema);
            if (!baseShape) { out.push({ line: d.line, message: `${name} extends "${t.expression.getText(sourceFile)}", which is not mapped to a schema` }); continue; }
            for (const k of baseShape.keys.keys()) inherited.add(k);
            checkInterface(t.expression.getText(sourceFile));
        }
        walkObject(node.members, schema, name, d.line, inherited);
    };

    const walkObject = (members: ts.NodeArray<ts.TypeElement>, schema: Parameters<SchemaFacts['shape']>[0], path: string, line: number, inherited = new Set<string>()): void => {
        const shape = ctx.schemas.shape(schema);
        if (!shape) { out.push({ line, message: `${path}: the schema here is not an object` }); return; }
        const shown = new Set<string>(inherited);
        let hasIndex = false;
        for (const mem of members) {
            if (ts.isIndexSignatureDeclaration(mem)) { hasIndex = true; continue; }
            if (!ts.isPropertySignature(mem) || !mem.name) continue;
            const key = mem.name.getText(sourceFile);
            const p = path + '.' + key;
            if (skip.has(p)) { shown.add(key); continue; }
            if (!shape.keys.has(key)) { out.push({ line: lineOf(mem), message: `${p} is not in the schema — keys: ${[...shape.keys.keys()].join(', ')}` }); continue; }
            shown.add(key);
            const optional = shape.keys.get(key)!;
            if (optional !== !!mem.questionToken) out.push({ line: lineOf(mem), message: `${p} is ${optional ? 'optional' : 'required'} in the schema` });
            if (mem.type) walkType(mem.type, ctx.schemas.child(schema, key)!, p);
        }
        if (hasIndex !== shape.open) out.push({ line, message: `${path}: the schema is ${shape.open ? 'OPEN (unknown keys pass through) — show [key: string]: any' : 'closed — no index signature'}` });
        const missing = [...shape.keys.keys()].filter(k => !shown.has(k) && !skip.has(path + '.' + k));
        if (missing.length) out.push({ line, message: `${path}: schema keys not shown: ${missing.join(', ')}` });
    };

    const walkType = (t: ts.TypeNode, schema: Parameters<SchemaFacts['shape']>[0], path: string): void => {
        if (ts.isParenthesizedTypeNode(t)) return walkType(t.type, schema, path);
        if (ts.isTypeLiteralNode(t)) return walkObject(t.members, schema, path, lineOf(t));
        if (ts.isArrayTypeNode(t)) return walkType(t.elementType, ctx.schemas.element(schema), path);
        if (ts.isTypeReferenceNode(t)) {
            const ref = t.typeName.getText(sourceFile);
            if ((ref === 'Array' || ref === 'Record') && t.typeArguments?.length) return walkType(t.typeArguments[t.typeArguments.length - 1], ctx.schemas.element(schema), path);
            if (map.has(ref)) return checkInterface(ref);
            return;
        }
        if (ts.isUnionTypeNode(t)) {
            const members = t.types.map(x => (ts.isParenthesizedTypeNode(x) ? x.type : x));
            const literals = members.filter(ts.isTypeLiteralNode);
            // references inside the union (`… | ANIMATE`) are followed like anywhere else
            for (const x of members) if (!ts.isTypeLiteralNode(x)) walkType(x, schema, path);
            if (!literals.length) return;
            const variants = ctx.schemas.variants(ctx.schemas.element(schema));
            if (variants.length <= 1) { for (const lit of literals) walkObject(lit.members, schema, path, lineOf(lit)); return; }
            const discriminant = variants[0].discriminant;
            // a plain union (`"M…" | { value } | ANIMATE`): each doc literal takes the object member sharing most of its keys
            const shapeVariants = variants.filter(v => ctx.schemas.shape(v.schema));
            const keysOf = (lit: ts.TypeLiteralNode): Array<string> => lit.members.filter(ts.isPropertySignature).map(p => p.name!.getText(sourceFile));
            literals.forEach(lit => {
                if (!discriminant) {
                    const docKeys = keysOf(lit);
                    const scored = shapeVariants.map(v => ({ v, score: docKeys.filter(k => ctx.schemas.shape(v.schema)!.keys.has(k)).length }));
                    const best = scored.sort((a, b) => b.score - a.score)[0];
                    if (!best) { out.push({ line: lineOf(lit), message: `${path}: the schema union has no object member for this literal` }); return; }
                    walkObject(lit.members, best.v.schema, path, lineOf(lit));
                    return;
                }
                const vals = literalValuesOf(lit, discriminant, sourceFile);
                const match = variants.find(v => v.values.some(x => vals.includes(String(x))));
                if (!match) { out.push({ line: lineOf(lit), message: `${path}: no schema variant has ${discriminant} in {${vals.join(', ')}} — variants: ${variants.map(v => v.values.join('|')).join(', ')}` }); return; }
                walkObject(lit.members, match.schema, `${path}<${vals.join('|')}>`, lineOf(lit));
            });
            return;
        }
    };

    for (const d of decls) if (d.kind === 'interface' && map.has(d.name)) checkInterface(d.name);
    return out;
}

const mk_target = (m: Marker): string | undefined => (m.target && m.target.includes('=') ? m.target : undefined);

function literalValuesOf(lit: ts.TypeLiteralNode, key: string, sf: ts.SourceFile): Array<string> {
    for (const mem of lit.members) {
        if (ts.isPropertySignature(mem) && mem.name && mem.name.getText(sf) === key && mem.type) {
            const parts: ReadonlyArray<ts.TypeNode> = ts.isUnionTypeNode(mem.type) ? mem.type.types : [mem.type];
            return parts.filter((x): x is ts.LiteralTypeNode => ts.isLiteralTypeNode(x)).map(l => l.literal.getText(sf).replace(/^['"]|['"]$/g, ''));
        }
    }
    return [];
}

export function formatFindings(file: string, findings: Array<Finding>): string {
    return findings.map(f => `${file}:${f.line} — ${f.message}`).join('\n');
}

export type { MdBlock, DocMember };
