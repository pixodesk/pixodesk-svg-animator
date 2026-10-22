/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The 1.4 → 1.5 step: `animator.debugGlobalName` left the format — a file must not write page globals.

import { describe, expect, it } from 'vitest';
import { convertWireDocument, downgradeWireDocument } from './PxWireVersion';

describe('wire step 1.4 → 1.5 — debugGlobalName removed', () => {

    it('drops the key from the root animator and keeps the rest', () => {
        const out = convertWireDocument({
            type: 'svg', animator: { version: '1.4.1', debugGlobalName: 'hero', timeline: { outTime: 1000 } }, children: [],
        });
        expect(JSON.stringify(out.doc)).not.toContain('debugGlobalName');
        expect(out.doc).toMatchObject({ animator: { timeline: { outTime: 1000 } } });
    });

    it('drops the key from the SVG carrier’s meta.animator', () => {
        const out = convertWireDocument({
            type: 'svg', meta: { animator: { version: '1.4.1', debugGlobalName: 'hero' } }, children: [],
        });
        expect(JSON.stringify(out.doc)).not.toContain('debugGlobalName');
    });

    it('a 1.5 document goes down to 1.4 unchanged — the key was optional', () => {
        const doc15 = { type: 'svg', animator: { version: '1.5.1', timeline: { outTime: 1000 } }, children: [] };
        const down = downgradeWireDocument(doc15, { a: 1, b: 4, c: 0 });
        expect(down.ok).toBe(true);
        if (down.ok) expect(down.doc).toMatchObject({ animator: { timeline: { outTime: 1000 } } });
    });
});
