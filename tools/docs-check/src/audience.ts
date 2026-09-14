// Who each export is for — the audience tag in the SOURCE, checked against the docs.
// (dev-docs/reviews/api-surface-review.md §8; the tags themselves are stage A of its plan.)
//
// One release tag on every exported declaration is the single source of truth:
//
//   @public             supported. Must be DESCRIBED in a guide, not merely listed in the reference
//   @public @advanced   supported document tooling — the ○ mark: stable, rarely needed
//   @internal           exported so the editor and the sibling packages stay in lockstep.
//                       May change in any release, so no guide may teach it
//
// The ●/○/▪ marks in the export indexes (the tables under `px-check exports`) stay hand-written,
// and are checked against the tags rather than generated from them — the same bargain as every
// other check here.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { ALL_PKGS, DOC_FILES, PKG_NPM_NAME, REPO_ROOT, type Pkg } from './config';
import { parseMarkdown, type MdTable } from './md';
import { parseDocBlock } from './ts-facts';
import type { Finding } from './checks';
import type { TsFacts } from './ts-facts';

/** The export indexes of a page: every table under a `px-check exports` marker. Being listed there is not being described. */
function exportIndexes(doc: ReturnType<typeof parseMarkdown>): Array<MdTable> {
    return doc.markers.filter(m => m.kind === 'exports' && m.block?.kind === 'table').map(m => m.block as MdTable);
}

const ALLOWLIST_FILE = 'tools/docs-check/audience-allowlist.json';

export type Audience = 'public' | 'advanced' | 'internal';
const MARK: Record<Audience, string> = { public: '●', advanced: '○', internal: '▪' };
const TAG: Record<Audience, string> = { public: '@public', advanced: '@public @advanced', internal: '@internal' };

interface Allowlist { undocumented: Record<string, string>; noSignature?: Record<string, string> }

function allowlist(): Allowlist {
    const p = resolve(REPO_ROOT, ALLOWLIST_FILE);
    if (!existsSync(p)) return { undocumented: {} };
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as Partial<Allowlist>;
    return { undocumented: parsed.undocumented ?? {}, noSignature: parsed.noSignature ?? {} };
}

/** Every exported name, once, with the packages that expose it. Aliases are already resolved. */
function surface(facts: TsFacts): Map<string, { sym: ts.Symbol; pkgs: Array<Pkg> }> {
    const out = new Map<string, { sym: ts.Symbol; pkgs: Array<Pkg> }>();
    for (const p of ALL_PKGS) {
        for (const [name, sym] of facts.exports(p)) {
            if (name === 'default') continue;
            const e = out.get(name);
            if (e) e.pkgs.push(p);
            else out.set(name, { sym, pkgs: [p] });
        }
    }
    return out;
}

/** The audience a declaration claims, or why it cannot be read. */
export function audienceOf(sym: ts.Symbol): { audience?: Audience; error?: string } {
    const tags = new Set(sym.getJsDocTags().map(t => t.name));
    const pub = tags.has('public'), int = tags.has('internal'), adv = tags.has('advanced');
    if (pub && int) return { error: 'carries both @public and @internal — pick one' };
    if (adv && !pub) return { error: 'carries @advanced without @public — ○ means "supported, rarely needed"' };
    if (int) return { audience: 'internal' };
    if (pub) return { audience: adv ? 'advanced' : 'public' };
    return {};
}

// ---- 1. every export carries exactly one audience -------------------------------------------

export function tagFindings(facts: TsFacts): Array<Finding> {
    const out: Array<Finding> = [];
    for (const [name, { sym, pkgs }] of surface(facts)) {
        const { audience, error } = audienceOf(sym);
        const where = pkgs.map(p => PKG_NPM_NAME[p]).join(', ');
        if (error) out.push({ line: 0, message: `${name} (${where}) ${error}` });
        else if (!audience) {
            out.push({ line: 0, message: `${name} (${where}) has no audience tag — put @public, @public @advanced or @internal on its declaration` });
        }
    }
    return out;
}

// ---- 2. the reference's ●/○/▪ marks say what the code says -----------------------------------

/**
 * The names a cell DECLARES, as opposed to merely mentions.
 *
 * Walks the backtick spans in order and takes the first identifier of each, where a span starts a
 * new item — the text before it holds a `,` `;` or `+` — and is not a return type, which the `→`
 * before it gives away. Splitting the cell on commas instead would cut
 * `` `f(doc, opts?)` `` in half and lose the name.
 */
export function declaredNames(cell: string): Array<string> {
    const out: Array<string> = [];
    const re = /`([^`]+)`/g;
    let m: RegExpExecArray | null;
    let last = 0;
    let head = true;
    while ((m = re.exec(cell))) {
        const between = cell.slice(last, m.index);
        last = re.lastIndex;
        if (/[,;+]/.test(between)) head = true;
        if (/→/.test(between)) head = false;
        if (head) {
            const id = /[A-Za-z_$][\w$]*/.exec(m[1])?.[0];
            if (id) out.push(id);
        }
        head = false;
    }
    return out;
}

export function markFindings(facts: TsFacts): Array<Finding> {
    const out: Array<Finding> = [];
    for (const file of DOC_FILES) {
        const doc = parseMarkdown(resolve(REPO_ROOT, file));
        for (const table of exportIndexes(doc)) {
            for (const row of table.rows) {
                const cells = row.cells;
                const mark = /[●○▪]/.exec(cells[cells.length - 1] ?? '')?.[0];
                if (!mark) continue;
                for (const cell of cells.slice(0, -1)) {
                    for (const name of declaredNames(cell)) {
                        const pkg = facts.locate(name);
                        if (!pkg) continue;                                  // the exports check reports it
                        const { audience } = audienceOf(facts.symbol(pkg, name)!);
                        if (!audience) continue;                             // tagFindings reports it
                        // a row may mark one of its names differently: `` `toDomProps` (○) ``
                        const own = new RegExp('`' + name + '[^`]*`\\s*\\(([●○▪])\\)').exec(cell)?.[1];
                        const expected = own ?? mark;
                        if (MARK[audience] !== expected) {
                            out.push({ line: 0, message: `${file}:${row.line} — ${name}: this row is marked ${expected}, the declaration says ${TAG[audience]} (${MARK[audience]}) — fix whichever is wrong` });
                        }
                    }
                }
            }
        }
    }
    return out;
}

// ---- 3. public is described, internal is not taught ------------------------------------------

/**
 * Identifier → the pages that name it, in two strengths:
 *
 *   `described` — anywhere on a page, prose backticks included, EXCEPT inside an export index
 *                 (a table under `px-check exports`), which lists every name by design. Writing
 *                 about a name IS documenting it, which is what `@public` owes the reader; being
 *                 one row of an index is not.
 *   `shown`     — inside a fenced code block: the page hands the reader a line to run. That is
 *                 what `@internal` must never be, and a passing mention in prose is not it.
 */
function guideMentions(): { described: Map<string, Array<string>>; shown: Map<string, Array<string>> } {
    const described = new Map<string, Array<string>>();
    const shown = new Map<string, Array<string>>();
    const add = (m: Map<string, Array<string>>, ids: Set<string>, file: string): void => {
        for (const id of ids) m.set(id, [...(m.get(id) ?? []), file]);
    };
    for (const file of DOC_FILES) {
        const doc = parseMarkdown(resolve(REPO_ROOT, file));
        const indexes = exportIndexes(doc);
        const inAnIndex = (line: number): boolean => indexes.some(t => line >= t.line && line <= t.endLine);
        const text = doc.lines.map((l, i) => (inAnIndex(i + 1) ? '' : l)).join('\n');
        const all = new Set<string>(), code = new Set<string>();
        const collect = (s: string, into: Set<string>): void => {
            for (const id of s.match(/[A-Za-z_$][\w$]*/g) ?? []) { into.add(id); all.add(id); }
        };
        for (const m of text.matchAll(/```[\s\S]*?```/g)) collect(m[0], code);
        for (const m of text.matchAll(/`([^`\n]+)`/g)) collect(m[1], all);
        // A name a marker CHECKS — `props PxTimelineShortcuts`, `schema PxClipPathEffectSchema`
        // — is documented by the table under it, member by member, even when the prose never
        // spells the type. That is a stronger guarantee than a mention, so it counts as described.
        for (const m of text.matchAll(/<!--\s*px-check\s+([\s\S]*?)-->/g)) collect(m[1], all);
        add(described, all, file);
        add(shown, code, file);
    }
    return { described, shown };
}

export function guideFindings(facts: TsFacts): Array<Finding> {
    const { described, shown } = guideMentions();
    const allow = allowlist();
    const out: Array<Finding> = [];
    const publicNames = new Set<string>();

    for (const [name, { sym }] of surface(facts)) {
        const { audience } = audienceOf(sym);
        if (!audience) continue;                                   // tagFindings reports it
        if (audience === 'internal') {
            const taught = shown.get(name);
            if (taught) {
                out.push({ line: 0, message: `${name} is @internal but a guide puts it in an example (${taught.join(', ')}) — mark it @public if it is supported, or take it out of the snippet` });
            }
            continue;
        }
        publicNames.add(name);
        if (!described.has(name) && !(name in allow.undocumented)) {
            out.push({ line: 0, message: `${name} is ${TAG[audience]} but no guide describes it — write it up, or add it to ${ALLOWLIST_FILE} with a reason` });
        }
    }

    // an allowlist entry that is no longer needed is itself a failure, so the list burns down
    for (const [name, reason] of Object.entries(allow.undocumented)) {
        if (!publicNames.has(name)) {
            out.push({ line: 0, message: `${ALLOWLIST_FILE}: "${name}" is not a public export any more — drop the entry ("${reason}")` });
        } else if (described.has(name)) {
            out.push({ line: 0, message: `${ALLOWLIST_FILE}: "${name}" IS described now (${described.get(name)!.join(', ')}) — drop the entry` });
        }
    }
    return out;
}

/** A table for the report: package × audience × described. */
export function audienceReport(facts: TsFacts): string {
    const { described } = guideMentions();
    const rows: Array<string> = ['| package | @public | described | @public @advanced | described | @internal |', '|---|---|---|---|---|---|'];
    for (const p of ALL_PKGS) {
        const names = [...facts.exportNames(p)].filter(n => n !== 'default');
        const of = (a: Audience): Array<string> => names.filter(n => audienceOf(facts.symbol(p, n)!).audience === a);
        const pub = of('public'), adv = of('advanced'), int = of('internal');
        const count = (list: Array<string>): number => list.filter(n => described.has(n)).length;
        rows.push(`| ${p} | ${pub.length} | ${count(pub)} | ${adv.length} | ${count(adv)} | ${int.length} |`);
    }
    return rows.join('\n');
}


// ---- 4. a public CALL shows its shape somewhere a reader can see it ---------------------------

/** Names whose shape a checked block actually shows: a `signature` block's declarations, and the
 *  target of a `props` / `values` / `emits` / `members` / `schema` marker or a `matrix` column. */
function namesUnderACheckedBlock(): Set<string> {
    const shown = new Set<string>();
    for (const file of DOC_FILES) {
        const doc = parseMarkdown(resolve(REPO_ROOT, file));
        for (const m of doc.markers) {
            if (m.kind === 'signature' && m.block?.kind === 'code') {
                for (const d of parseDocBlock(m.block.text, m.block.line).decls) shown.add(d.name);
            }
            if (['props', 'values', 'emits', 'members', 'schema'].includes(m.kind) && m.target) shown.add(m.target);
            if (m.kind === 'matrix' || m.kind === 'schema-block') {
                for (const v of Object.values(m.opts)) {
                    const name = v.includes(':') ? v.split(':')[1] : v;
                    if (/^[A-Za-z_$][\w$]*$/.test(name)) shown.add(name);
                }
            }
        }
    }
    return shown;
}

export function signatureFindings(facts: TsFacts): Array<Finding> {
    const shown = namesUnderACheckedBlock();
    const allow = new Set(Object.keys(allowlist().noSignature ?? {}));
    const out: Array<Finding> = [];
    const seen = new Set<string>();
    for (const [name, { sym, pkgs }] of surface(facts)) {
        if (seen.has(name)) continue;
        seen.add(name);
        const { audience } = audienceOf(sym);
        if (audience !== 'public') continue;                       // advanced is document tooling; types are §8.3's job
        const pkg = pkgs[0];
        if (!facts.isValue(pkg, name)) continue;                   // a type's shape is covered by props/signature elsewhere
        if (!facts.callSignatures(pkg, name).length) continue;     // a const object is not a call
        if (shown.has(name) || allow.has(name)) continue;
        out.push({ line: 0, message: `${name} is @public and callable, but no checked block shows its signature — put it under a px-check signature block, or add it to ${ALLOWLIST_FILE} under "noSignature" with a reason` });
    }
    return out;
}

// ---- 5. an internal name stays off the public door -------------------------------------------

export function mainEntryFindings(facts: TsFacts): Array<Finding> {
    const out: Array<Finding> = [];
    for (const pkg of ALL_PKGS) {
        const sf = facts.sourceFile(pkg);                          // the MAIN entry, not `/internal`
        const mod = facts.checker.getSymbolAtLocation(sf)
            ?? (sf as unknown as { symbol?: ts.Symbol }).symbol;
        if (!mod) continue;
        for (const s of facts.checker.getExportsOfModule(mod)) {
            if (s.name === 'default') continue;
            const r = s.flags & ts.SymbolFlags.Alias ? facts.checker.getAliasedSymbol(s) : s;
            if (audienceOf(r).audience !== 'internal') continue;
            out.push({ line: 0, message: `${PKG_NPM_NAME[pkg]} exports ${s.name} from its MAIN entry, but it is @internal — move it to the package's /internal entry` });
        }
    }
    return out;
}
