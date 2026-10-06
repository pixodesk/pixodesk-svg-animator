// Every link in the public docs must point at something that exists. Offline, from the repo
// alone: relative links and their `#anchors`, links into this repository on GitHub
// (`github.com/pixodesk/pixodesk-svg-animator/tree|blob/main/…`), and StackBlitz links that
// open a folder of it (`stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/…`,
// whose `startScript=` must be a script of that project). Every other `http(s)` link is
// external; `DOCS_CHECK_ONLINE=1` fetches each one as well — see README.md.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import type { Finding } from './checks';
import { REPO_ROOT } from './config';
import { parseMarkdown, type MdDoc, type MdHeading } from './md';

const REPO_URL = 'https://github.com/pixodesk/pixodesk-svg-animator';
const STACKBLITZ_URL = 'https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/';
const BRANCH = 'main';

export interface DocLink { line: number; url: string; }

/** Every link target in the doc, outside code blocks: `[t](url)`, `![a](url)`, `<a href>`, `<img src>`. */
export function docLinks(doc: MdDoc): Array<DocLink> {
    const inCode = new Set<number>();
    for (const b of doc.blocks) if (b.kind === 'code') for (let l = b.line; l <= b.endLine; l++) inCode.add(l);
    const out: Array<DocLink> = [];
    const MD = /!?\[[^\]]*\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
    const HTML = /<(?:a|img)\b[^>]*\b(?:href|src)="([^"]+)"/g;
    doc.lines.forEach((text, i) => {
        if (inCode.has(i + 1)) return;
        for (const re of [MD, HTML]) {
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(text))) out.push({ line: i + 1, url: m[1] });
        }
    });
    return out;
}

/** GitHub's heading anchor: lower-case, markdown stripped, punctuation dropped, spaces to `-`, duplicates numbered. */
export function githubAnchors(headings: Array<MdHeading>): Set<string> {
    const seen = new Map<string, number>();
    const out = new Set<string>();
    for (const h of headings) {
        const text = h.text.replace(/`([^`]*)`/g, '$1').replace(/\*\*|__|\*|_(?=\s|$)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
        let id = text.toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/ /g, '-');
        const n = seen.get(id) ?? 0;
        seen.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        out.add(id);
    }
    return out;
}

const headingsOf = (file: string): Array<MdHeading> => parseMarkdown(file).blocks.filter((b): b is MdHeading => b.kind === 'heading');
const trimDashes = (s: string): string => s.replace(/-+$/, '');

/** Whether `anchor` names a heading of the markdown file (GitHub's own `#readme` on a README counts). */
function hasAnchor(mdFile: string, anchor: string): boolean {
    const want = trimDashes(decodeURIComponent(anchor).toLowerCase());
    if (want === 'readme' && /readme\.md$/i.test(mdFile)) return true;
    for (const id of githubAnchors(headingsOf(mdFile))) if (trimDashes(id) === want) return true;
    return false;
}

const isExternal = (url: string): boolean => /^https?:\/\//i.test(url);
export const isOnlineOnly = (url: string): boolean => isExternal(url) && !url.startsWith(REPO_URL) && !url.startsWith(STACKBLITZ_URL);

/** `path#frag` → both parts; `?query` dropped from the path. */
function split(url: string): { path: string; anchor: string; query: URLSearchParams } {
    const hash = url.indexOf('#');
    const anchor = hash === -1 ? '' : url.slice(hash + 1);
    const rest = hash === -1 ? url : url.slice(0, hash);
    const q = rest.indexOf('?');
    return { path: q === -1 ? rest : rest.slice(0, q), anchor, query: new URLSearchParams(q === -1 ? '' : rest.slice(q + 1)) };
}

/** A repo-relative path must stay inside the repository and exist. */
function repoPath(p: string): string | undefined {
    const abs = resolve(REPO_ROOT, p);
    const rel = relative(REPO_ROOT, abs);
    if (rel.startsWith('..') || rel.startsWith(sep)) return undefined;
    return abs;
}

/** Why a path-with-anchor is broken, or undefined when it resolves. */
function checkPath(abs: string, anchor: string, shown: string): string | undefined {
    if (!existsSync(abs)) return `"${shown}" does not exist`;
    if (!anchor) return undefined;
    if (statSync(abs).isDirectory()) {
        const readme = join(abs, 'README.md');
        if (!existsSync(readme)) return `"${shown}#${anchor}": the folder has no README.md to carry an anchor`;
        return hasAnchor(readme, anchor) ? undefined : `"${shown}#${anchor}": no such heading in its README.md`;
    }
    if (!/\.md$/i.test(abs)) return undefined; // an anchor into a non-markdown file is not ours to judge
    return hasAnchor(abs, anchor) ? undefined : `"${shown}#${anchor}": no such heading`;
}

/** The offline findings for one doc: every link that points at nothing. */
export function linkFindings(doc: MdDoc): Array<Finding> {
    const out: Array<Finding> = [];
    const dir = dirname(resolve(REPO_ROOT, doc.file));
    for (const { line, url } of docLinks(doc)) {
        const problem = checkLink(url, dir, doc.file);
        if (problem) out.push({ line, message: `link ${problem}` });
    }
    return out;
}

function checkLink(url: string, dir: string, file: string): string | undefined {
    if (/^(mailto|tel|javascript):/i.test(url)) return undefined;
    const { path, anchor, query } = split(url);

    if (url.startsWith('#')) {
        return hasAnchor(resolve(REPO_ROOT, file), anchor) ? undefined : `"${url}": no such heading in this file`;
    }

    if (url.startsWith(STACKBLITZ_URL)) {
        const abs = repoPath(path.slice(STACKBLITZ_URL.length));
        if (!abs || !existsSync(abs)) return `"${url}": the folder it opens does not exist in this repository`;
        const pkgFile = join(abs, 'package.json');
        if (!existsSync(pkgFile)) return `"${url}": the folder it opens has no package.json — StackBlitz needs a project`;
        const script = query.get('startScript');
        const scripts = (JSON.parse(readFileSync(pkgFile, 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {};
        if (script && !(script in scripts)) return `"${url}": startScript=${script} is not a script of that project (${Object.keys(scripts).join(', ') || 'none'})`;
        return undefined;
    }

    if (url.startsWith(REPO_URL)) {
        const rest = path.slice(REPO_URL.length);           // '', '/tree/main/x', '/blob/main/x.md', '/actions/…'
        if (rest === '' || rest === '/') return checkPath(join(REPO_ROOT, 'README.md'), anchor, 'README.md');
        const m = /^\/(?:tree|blob)\/([^/]+)\/(.*)$/.exec(rest);
        if (!m) return undefined;                           // actions, releases, issues… — online territory
        if (m[1] !== BRANCH) return `"${url}": links into this repository point at the ${BRANCH} branch`;
        const abs = repoPath(decodeURIComponent(m[2]));
        return abs ? checkPath(abs, anchor, m[2]) : `"${url}": escapes the repository`;
    }

    if (isExternal(url)) return undefined;                 // checked online, when asked

    const abs = repoPath(relative(REPO_ROOT, normalize(join(dir, decodeURIComponent(path || '.')))));
    if (!abs) return `"${url}": escapes the repository`;
    return checkPath(abs, anchor, url);
}

/** Every distinct external URL across the docs, with one place it is used — for the online check. */
export function externalUrls(docs: Array<MdDoc>): Array<{ url: string; where: string }> {
    const seen = new Map<string, string>();
    for (const doc of docs) for (const { line, url } of docLinks(doc)) {
        if (isOnlineOnly(url) && !seen.has(url)) seen.set(url, `${doc.file}:${line}`);
    }
    return [...seen].map(([url, where]) => ({ url, where }));
}

/** Fetches the URL; '' when it answers, else why not. HEAD first, GET when a host refuses HEAD.
 *  A 403 or 429 is the host turning a script away (npmjs.com does), not a missing page — it passes. */
export async function reachable(url: string, timeoutMs = 15000): Promise<string> {
    for (const method of ['HEAD', 'GET']) {
        try {
            const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'pixodesk-docs-check' } });
            if (res.ok || res.status === 403 || res.status === 429) return '';
            if (method === 'HEAD' && (res.status === 405 || res.status === 404)) continue;
            return `HTTP ${res.status}`;
        } catch (e) {
            if (method === 'HEAD') continue;
            return (e as Error).message;
        }
    }
    return 'no answer';
}
