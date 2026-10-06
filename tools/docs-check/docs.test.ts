// Every `<!-- px-check … -->` marker in the public docs becomes one test; every file gets a
// coverage test that fails on an unmarked table or reference block. See README.md.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audienceReport, guideFindings, mainEntryFindings, markFindings, signatureFindings, tagFindings } from './src/audience';
import { coverageFindings, formatFindings, runMarker, type Ctx } from './src/checks';
import { DOC_FILES, REPO_ROOT } from './src/config';
import { externalUrls, linkFindings, reachable } from './src/links';
import { parseMarkdown } from './src/md';
import { SchemaFacts } from './src/schema-facts';
import { TsFacts } from './src/ts-facts';

const ctx: Ctx = { facts: new TsFacts(), schemas: new SchemaFacts() };

// `pnpm report:audience` — package × audience × described, so the gap is visible, not inferred.
if (process.env.DOCS_CHECK_AUDIENCE_REPORT) {
    console.log('\nAudience coverage\n' + audienceReport(ctx.facts) + '\n');
}

// Who each export is for, from the tag on its declaration — see src/audience.ts.
describe('audience', () => {
    it('every export says who it is for', () => {
        expect(formatFindings('audience', tagFindings(ctx.facts))).toBe('');
    });
    it('the reference marks agree with the declarations', () => {
        expect(formatFindings('audience', markFindings(ctx.facts))).toBe('');
    });
    it('public is described in a guide; internal is taught nowhere', () => {
        expect(formatFindings('audience', guideFindings(ctx.facts))).toBe('');
    });
    it('every public call has its signature in a checked block', () => {
        expect(formatFindings('audience', signatureFindings(ctx.facts))).toBe('');
    });
    it('no internal name is exported from a main entry', () => {
        expect(formatFindings('audience', mainEntryFindings(ctx.facts))).toBe('');
    });
});

const docs = DOC_FILES.map(file => parseMarkdown(resolve(REPO_ROOT, file)));

for (const doc of docs) {
    const file = doc.file === resolve(REPO_ROOT, doc.file) ? doc.file.slice(REPO_ROOT.length + 1) : doc.file;
    describe(file, () => {
        it('every table and reference block carries a px-check marker', () => {
            expect(formatFindings(file, coverageFindings(doc, ctx))).toBe('');
        });
        // Relative links, links into this repository on GitHub, StackBlitz links — see src/links.ts.
        it('every link points at something that exists', () => {
            expect(formatFindings(file, linkFindings({ ...doc, file }))).toBe('');
        });
        for (const m of doc.markers) {
            it(`:${m.line} ${m.kind}${m.target ? ' ' + m.target : ''}`, () => {
                expect(formatFindings(file, runMarker(doc, m, ctx))).toBe('');
            });
        }
    });
}

// `DOCS_CHECK_ONLINE=1` (`pnpm check:docs:online`): every external URL must answer. Off by default —
// it needs the network and other people's servers; CI runs it as a job of its own.
describe.skipIf(!process.env.DOCS_CHECK_ONLINE)('online links', () => {
    for (const { url, where } of externalUrls(docs.map(doc => ({ ...doc, file: doc.file.slice(REPO_ROOT.length + 1) })))) {
        it(`${url} (${where})`, async () => {
            expect(await reachable(url), `${where} — ${url}`).toBe('');
        }, 40000);
    }
});
