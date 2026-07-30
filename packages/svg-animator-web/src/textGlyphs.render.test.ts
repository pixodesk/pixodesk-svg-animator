/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// @vitest-environment jsdom

// Full "materialise → render → serialize" pipeline for glyph text — the exact
// chain the editor's `writeMaterialisedStaticSvg` runs to produce a static,
// font-free SVG string (Step 3). Verifies glyph <text> becomes real <path>
// geometry in the serialized output.

import { describe, expect, it } from 'vitest';
import { applyPlayerEffects } from '@pixodesk/svg-animator-core';
import type { PxNode } from '@pixodesk/svg-animator-core';
import { renderNode } from './PxAnimatorDOM';

const glyphs = {
    F: {
        fFamily: 'F', style: '', ascent: 800, unitsPerEm: 1000,
        glyphs: {
            H: { width: 700, d: 'M0 0L100 0L100 -700Z' },
            i: { width: 300, d: 'M0 0L50 0L50 -500Z' },
        },
    },
};

function scene(): PxNode {
    return {
        type: 'svg',
        viewBox: '0 0 200 100',
        animator: { definitions: { glyphs } },
        children: [{
            type: 'text', id: 't', transform: 'translate(10,50)',
            children: [{ type: 'tspan', text: 'Hi', fontFamily: 'F', fontSize: '100px', fill: '#f00' }],
            effects: { text: { useGlyphs: true } },
        }],
    } as unknown as PxNode;
}

describe('glyph text — materialise → renderNode → serialize (static SVG)', () => {

    it('produces a font-free SVG with <path> geometry and no <text>', () => {
        const { root } = applyPlayerEffects(scene());
        const el = renderNode(root);
        expect(el).toBeTruthy();
        const svg = new XMLSerializer().serializeToString(el!);

        expect(svg).toContain('<svg');
        expect(svg).toContain('<path');
        expect(svg).toContain('viewBox="0 0 200 100"');
        expect(svg).toContain('fill="#f00"');
        expect(svg).not.toContain('<text');
        expect(svg).not.toContain('<tspan');
        // The <text> became a <g> keeping its transform.
        expect(svg).toContain('translate(10,50)');
        // Baked outline coordinates present (H at pen 0 scaled ×0.1).
        expect(svg).toMatch(/d="M0 0L10 0/);
    });
});
