// The `any` budget (first-use review §17c, dev-docs/plans/schema-cast-and-stamps.md): document data
// is EARNED as a type — schema casts on the checked document — never declared `any`. Each package's
// shipped source may hold at most its budget of explicit `any`; the budget is a RATCHET — when a
// change removes some, lower the number here to the new count. It never goes up.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** What is left is outside the document: the schema DSL internals, the interpolator's runtime values,
 *  the element-factory generic, platform globals (DOM, React components), the effects test kit. */
const BUDGET: ReadonlyArray<{ pkg: string; max: number }> = [
    { pkg: 'svg-animator-core', max: 99 },
    { pkg: 'svg-animator-web', max: 4 },
    { pkg: 'svg-animator-react', max: 8 },
    { pkg: 'svg-animator-vue', max: 0 },
    { pkg: 'svg-animator-rn', max: 15 },
];

function sources(dir: string, out: Array<string> = []): Array<string> {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== 'dist') sources(p, out); }
        else if (/\.tsx?$/.test(name) && !/\.test\.|\.d\.ts$/.test(name)) out.push(p);
    }
    return out;
}

/** Every explicit `any` keyword (types, casts, generics) in a package's shipped source, as `file:line`. */
function anySites(pkg: string): Array<string> {
    const sites: Array<string> = [];
    for (const file of sources(join(PACKAGES, pkg, 'src'))) {
        const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, kind);
        const visit = (n: ts.Node): void => {
            if (n.kind === ts.SyntaxKind.AnyKeyword) sites.push(relative(PACKAGES, file) + ':' + (sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1));
            ts.forEachChild(n, visit);
        };
        visit(sf);
    }
    return sites;
}

describe('the any budget', () => {
    for (const { pkg, max } of BUDGET) {
        it(pkg + ' holds at most ' + max + ' explicit `any` — and the budget follows every removal', () => {
            const sites = anySites(pkg);
            expect(sites.length <= max ? [] : sites, 'over budget — earn the type with a schema cast').toEqual([]);
            expect(sites.length, 'under budget — lower ' + pkg + ' to ' + sites.length + ' (a ratchet)').toBe(max);
        });
    }
});
