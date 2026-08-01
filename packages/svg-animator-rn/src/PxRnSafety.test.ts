/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import type { PxNode } from '@pixodesk/svg-animator-core';
import { openClosedTextPathTargets } from './PxRnSafety';

/** Doc with one `<textPath>` following a closed circle-ish path. */
function docWithClosedTarget(): PxNode {
    return {
        type: 'svg',
        children: [
            { type: 'defs', children: [{ type: 'path', id: 'ring', d: 'M0,0C10,0,10,10,0,10z' }] },
            {
                type: 'text',
                children: [{
                    type: 'textPath', id: 'tp', href: '#ring', startOffset: 5,
                    animate: { startOffset: { keyframes: [{ time: 0, value: -20 }, { time: 1000, value: 40 }] } },
                }],
            },
        ],
    } as unknown as PxNode;
}

const find = (n: any, pred: (x: any) => boolean): any => {
    if (pred(n)) return n;
    for (const c of (n.children ?? [])) { const hit = find(c, pred); if (hit) return hit; }
    return undefined;
};
const all = (n: any, pred: (x: any) => boolean, out: Array<any> = []): Array<any> => {
    if (pred(n)) out.push(n);
    for (const c of (n.children ?? [])) all(c, pred, out);
    return out;
};

describe('openClosedTextPathTargets', () => {
    it('repoints the textPath at an OPEN copy of the closed path', () => {
        const out: any = openClosedTextPathTargets(docWithClosedTarget());
        const tp = find(out, (n: any) => n.type === 'textPath');
        const newId = String(tp.href).slice(1);

        expect(newId).not.toBe('ring');
        const copy = find(out, (n: any) => n.id === newId);
        expect(copy).toBeDefined();
        expect(copy.d).toBe('M0,0C10,0,10,10,0,10');   // the `z` is gone
        expect(copy.d).not.toMatch(/[zZ]/);
    });

    it('leaves the ORIGINAL path closed, for anything else that draws it', () => {
        const out: any = openClosedTextPathTargets(docWithClosedTarget());
        const original = find(out, (n: any) => n.id === 'ring');
        expect(original.d).toBe('M0,0C10,0,10,10,0,10z');
    });

    it('puts the copy in <defs> so it is never drawn', () => {
        const out: any = openClosedTextPathTargets(docWithClosedTarget());
        const tp = find(out, (n: any) => n.type === 'textPath');
        const newId = String(tp.href).slice(1);
        const defs = find(out, (n: any) => n.type === 'defs');
        expect((defs.children ?? []).some((c: any) => c.id === newId)).toBe(true);
    });

    it('strips animation from the copy so it cannot animate twice', () => {
        const doc: any = docWithClosedTarget();
        doc.children[0].children[0].animate = { d: { keyframes: [] } };
        const out: any = openClosedTextPathTargets(doc);
        const tp = find(out, (n: any) => n.type === 'textPath');
        const copy = find(out, (n: any) => n.id === String(tp.href).slice(1));
        expect(copy.animate).toBeUndefined();
    });

    it('makes ONE copy for several textPaths sharing a target', () => {
        const doc: any = docWithClosedTarget();
        doc.children[1].children.push({ type: 'textPath', id: 'tp2', href: '#ring' });
        const out: any = openClosedTextPathTargets(doc);

        const hrefs = all(out, (n: any) => n.type === 'textPath').map((n: any) => n.href);
        expect(new Set(hrefs).size).toBe(1);
        expect(all(out, (n: any) => n.type === 'path')).toHaveLength(2);   // original + one copy
    });

    it('does not touch a textPath already following an OPEN path', () => {
        const doc: any = docWithClosedTarget();
        doc.children[0].children[0].d = 'M0,0L10,10';
        const out: any = openClosedTextPathTargets(doc);
        expect(find(out, (n: any) => n.type === 'textPath').href).toBe('#ring');
        expect(all(out, (n: any) => n.type === 'path')).toHaveLength(1);
    });

    it('returns the very same object when there is no textPath at all', () => {
        const doc = { type: 'svg', children: [{ type: 'rect' }] } as unknown as PxNode;
        expect(openClosedTextPathTargets(doc)).toBe(doc);
    });

    it('reports what it did through the warnings channel', () => {
        const warnings: Array<string> = [];
        openClosedTextPathTargets(docWithClosedTarget(), warnings);
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('#ring');
    });

    it('handles xlink:href as well as href', () => {
        const doc: any = docWithClosedTarget();
        const tp = doc.children[1].children[0];
        delete tp.href;
        tp['xlink:href'] = '#ring';
        const out: any = openClosedTextPathTargets(doc);
        expect(find(out, (n: any) => n.type === 'textPath')['xlink:href']).not.toBe('#ring');
    });

    it('ignores a dangling reference instead of throwing', () => {
        const doc: any = docWithClosedTarget();
        doc.children[1].children[0].href = '#nope';
        expect(() => openClosedTextPathTargets(doc)).not.toThrow();
    });
});
