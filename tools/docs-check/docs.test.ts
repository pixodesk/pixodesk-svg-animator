// Every `<!-- px-check … -->` marker in the public docs becomes one test; every file gets a
// coverage test that fails on an unmarked table or reference block. See README.md.
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { coverageFindings, formatFindings, runMarker, type Ctx } from './src/checks';
import { DOC_FILES, REPO_ROOT } from './src/config';
import { parseMarkdown } from './src/md';
import { SchemaFacts } from './src/schema-facts';
import { TsFacts } from './src/ts-facts';

const ctx: Ctx = { facts: new TsFacts(), schemas: new SchemaFacts() };

for (const file of DOC_FILES) {
    const doc = parseMarkdown(resolve(REPO_ROOT, file));
    describe(file, () => {
        it('every table and reference block carries a px-check marker', () => {
            expect(formatFindings(file, coverageFindings(doc, ctx))).toBe('');
        });
        for (const m of doc.markers) {
            it(`:${m.line} ${m.kind}${m.target ? ' ' + m.target : ''}`, () => {
                expect(formatFindings(file, runMarker(doc, m, ctx))).toBe('');
            });
        }
    });
}
