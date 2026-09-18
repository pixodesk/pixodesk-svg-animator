// Type text comparison. Both sides — the doc's hand-written type and the checker's
// `typeToString` — go through the same normalization, so spelling differences that mean
// nothing never fail a check: whitespace, quote style, `T[]` vs `Array<T>`, union order,
// object-literal member order, parameter names inside function TYPES, `| undefined` on an
// optional member, a `React.` qualifier. Aliases and interfaces are expanded textually from
// a map the real types provide — again on BOTH sides — so a doc may inline
// `'load' | 'click' | …` where the type says `PxTriggerStart`, or `{ motionPath?: … }` where it
// says `PxMaterializeAllOptions`, or keep the name; either passes.

export type AliasMap = ReadonlyMap<string, string>;

export function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

export function normalizeType(text: string): string {
    let t = stripComments(text);
    t = t.replace(/import\("[^"]*"\)\./g, '');
    // `React.RefObject` / `vue.DefineComponent` — the namespace is spelling, not meaning
    t = t.replace(/\b(React|react|Vue|vue|RN)\.(?=[A-Z])/g, '');
    t = t.replace(/"/g, "'");
    t = t.replace(/\s+/g, ' ').trim();
    // spaces survive only between two word characters (`readonly string`, `keyof X`)
    t = t.replace(/(\W) /g, '$1').replace(/ (\W)/g, '$1');
    t = t.replace(/;$/, '');
    t = t.replace(/;/g, ',').replace(/,}/g, '}').replace(/,\)/g, ')');
    t = arraysToGeneric(t);
    t = t.replace(/<unknown>/g, '');
    t = t.replace(/\[[\w$]+:/g, '[_:');
    t = canonical(t);
    // type arguments `typeToString` spells out although they are the declared defaults
    for (const [spelled, bare] of DEFAULT_TYPE_ARGS) t = t.split(spelled).join(bare);
    return t;
}

const DEFAULT_TYPE_ARGS: ReadonlyArray<[string, string]> = [
    ['ReactElement<unknown,JSXElementConstructor<any>|string>', 'ReactElement'],
    ['ReactElement<any,JSXElementConstructor<any>|string>', 'ReactElement'],
];

/** `X[]` → `Array<X>`, `readonly X[]` → `ReadonlyArray<X>`; repeated for `X[][]`. */
function arraysToGeneric(t: string): string {
    for (let guard = 0; guard < 8; guard++) {
        const at = t.indexOf('[]');
        if (at < 0) return t;
        const start = operandStart(t, at);
        let operand = t.slice(start, at);
        let before = t.slice(0, start);
        let wrapper = 'Array';
        if (before.endsWith('readonly ')) { before = before.slice(0, -'readonly '.length); wrapper = 'ReadonlyArray'; }
        if (operand.startsWith('(') && operand.endsWith(')')) operand = operand.slice(1, -1);
        t = `${before}${wrapper}<${operand}>${t.slice(at + 2)}`;
    }
    return t;
}

/** Where the operand of a `[]` at `end` begins: an identifier, a quoted literal, or a balanced group. */
function operandStart(t: string, end: number): number {
    let i = end - 1;
    const closeOf: Record<string, string> = { '>': '<', ')': '(', '}': '{', ']': '[' };
    if (t[i] in closeOf) {
        let depth = 0;
        for (; i >= 0; i--) {
            const c = t[i];
            if (c in closeOf) depth++;
            else if (c === '<' || c === '(' || c === '{' || c === '[') { depth--; if (depth === 0) break; }
        }
        if (t[end - 1] === '>') { i--; while (i >= 0 && /[\w$.]/.test(t[i])) i--; return i + 1; }
        return i;
    }
    if (t[i] === "'") { i--; while (i >= 0 && t[i] !== "'") i--; return i; }
    while (i >= 0 && /[\w$.]/.test(t[i])) i--;
    return i + 1;
}

const OPEN = '<({[';
const CLOSE = '>)}]';

/** Split at top-level occurrences of `sep`, respecting quotes and every kind of bracket (`=>` is not a closer). */
export function splitTopLevel(t: string, sep: string): Array<string> {
    const out: Array<string> = [];
    let depth = 0, cur = '', quote = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (c === "'") quote = !quote;
        if (!quote) {
            if (OPEN.includes(c)) depth++;
            else if (CLOSE.includes(c) && !(c === '>' && t[i - 1] === '=')) depth--;
            else if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
        }
        cur += c;
    }
    out.push(cur);
    return out;
}

/** The index of the bracket closing the one at `open`, or -1. */
function matchingClose(t: string, open: number): number {
    let depth = 0, quote = false;
    for (let i = open; i < t.length; i++) {
        const c = t[i];
        if (c === "'") quote = !quote;
        if (quote) continue;
        if (OPEN.includes(c)) depth++;
        else if (CLOSE.includes(c) && !(c === '>' && t[i - 1] === '=')) { depth--; if (depth === 0) return i; }
    }
    return -1;
}

/**
 * The canonical spelling of an already-flattened type text: unions sorted (and `undefined`
 * dropped), redundant parentheses removed, object-literal members sorted with method
 * syntax rewritten as `name:(…)=>R`, parameter names inside function types replaced by `_`.
 */
function canonical(t: string): string {
    const parts = splitTopLevel(t, '|').map(p => p.trim()).filter(p => p !== '' && p !== 'undefined');
    if (parts.length === 0) return 'undefined';
    const canonParts = parts.map(canonicalPart);
    const flat = canonParts.flatMap(p => splitTopLevel(p, '|'));
    return [...new Set(flat)].sort().join('|');
}

function canonicalPart(p: string): string {
    // `(X)` wrapping the whole part → X
    if (p.startsWith('(') && matchingClose(p, 0) === p.length - 1) return canonical(p.slice(1, -1));
    let out = '';
    for (let i = 0; i < p.length; i++) {
        const c = p[i];
        if (!OPEN.includes(c)) { out += c; continue; }
        const end = matchingClose(p, i);
        if (end < 0) { out += p.slice(i); break; }
        const inner = p.slice(i + 1, end);
        const isFnParams = c === '(' && p.slice(end + 1, end + 3) === '=>';
        let body: string;
        if (c === '{') body = canonicalMembers(inner);
        else if (c === '(' && isFnParams) body = splitTopLevel(inner, ',').map(canonicalParam).join(',');
        else body = splitTopLevel(inner, ',').map(x => canonical(x)).join(',');
        out += c + body + CLOSE[OPEN.indexOf(c)];
        i = end;
    }
    return out;
}

function canonicalParam(param: string): string {
    const m = /^(\.\.\.)?([\w$]+)(\?)?:(.*)$/.exec(param.trim());
    if (!m) return canonical(param);
    return `${m[1] ?? ''}_${m[3] ?? ''}:${canonical(m[4])}`;
}

function canonicalMembers(inner: string): string {
    const members = splitTopLevel(inner, ',').map(m => m.trim()).filter(Boolean).map(m => {
        const method = /^([\w$]+)(\?)?\((.*)\):(.*)$/.exec(m);
        if (method && matchingClose(m, m.indexOf('(')) === m.indexOf('):', 0) ) {
            return `${method[1]}${method[2] ?? ''}:(${splitTopLevel(method[3], ',').map(canonicalParam).join(',')})=>${canonical(method[4])}`;
        }
        const prop = /^(\[?[\w$]+\]?|\[_:[^\]]+\])(\?)?:(.*)$/.exec(m);
        if (prop) return `${prop[1]}${prop[2] ?? ''}:${canonical(prop[3])}`;
        return canonical(m);
    });
    return members.sort().join(',');
}

/** Replace every identifier that names a known alias with its expansion; a few rounds, then re-canonicalize. */
export function expandAliases(t: string, aliases: AliasMap): string {
    let out = t;
    for (let round = 0; round < 3; round++) {
        const next = out.replace(/(^|[^\w$.'])([A-Za-z_$][\w$]*)(?![\w$])/g, (all, pre: string, id: string) => {
            const exp = aliases.get(id);
            return exp === undefined ? all : `${pre}(${exp})`;
        });
        if (next === out) break;
        out = next;
    }
    return canonical(out);
}

export function typesEqual(docText: string, realText: string, aliases: AliasMap): boolean {
    const a = normalizeType(docText), b = normalizeType(realText);
    if (a === b) return true;
    return expandAliases(a, aliases) === expandAliases(b, aliases);
}

/** For messages: how the two spellings look after normalization and expansion. */
export function explainTypes(docText: string, realText: string, aliases: AliasMap): string {
    const a = normalizeType(docText), b = normalizeType(realText);
    return `normalized: \`${expandAliases(a, aliases)}\` vs \`${expandAliases(b, aliases)}\``;
}
