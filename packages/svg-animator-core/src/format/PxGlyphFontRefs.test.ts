/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Glyph-font references (review §2.5): a `definitions.fonts` key IS the face name, matched
// against the node's `font-family` verbatim. A name with no entry renders □ placeholder boxes
// behind a console warning, and nothing used to catch it — the schema validates each side's
// SHAPE, never that the two agree.

import { describe, expect, it } from 'vitest';
import { validateDocument } from './PxAnimatorTypes';

const FACE = { fontFamily: 'Roboto', fontStyle: 'Regular', ascent: 750, unitsPerEm: 1000,
    glyphs: { H: { width: 700, pathData: 'M0 0L100 0L100 -700Z' } } };

/** A document whose one <text> is in glyph mode, with the given fonts + span attrs. */
function doc(fonts: Record<string, unknown> | undefined, span: Record<string, unknown>, useGlyphs = true) {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        ...(fonts ? { animator: { definitions: { fonts } } } : {}),
        children: [{
            type: 'text',
            id: 't',
            effects: { text: { useGlyphs } },
            children: [{ type: 'tspan', textContent: 'H', fontSize: 16, ...span }],
        }],
    } as never;
}

describe('validateDocument — glyph-mode text must name an embedded face (§2.5)', () => {

    it('accepts a face that IS embedded', () => {
        expect(validateDocument(doc({ 'Roboto-Regular': FACE }, { fontFamily: 'Roboto-Regular' }))).toEqual([]);
    });

    it('reports a face that is NOT embedded, naming it and where', () => {
        const problems = validateDocument(doc({ 'Roboto-Regular': FACE }, { fontFamily: 'Roboto-Bold' }));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('Roboto-Bold');
        expect(problems[0]).toContain('animator.definitions.fonts');
        expect(problems[0]).toContain('root.children[0].children[0]');
    });

    it('catches a family declared on the <text> itself, reporting it ONCE', () => {
        // The family sits on the <text>; the span carrying the characters inherits it. The
        // problem belongs to the node that declares the name — not to every descendant too.
        const d: any = doc({ 'Roboto-Regular': FACE }, {});
        d.children[0].fontFamily = 'Roboto-Bold';
        const problems = validateDocument(d);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('root.children[0]:');

        d.children[0].fontFamily = 'Roboto-Regular';
        expect(validateDocument(d)).toEqual([]);
    });

    //// ── deliberate silences ────────────────────────────────────────────────

    it('says nothing when the document embeds NO faces (browser-font text)', () => {
        expect(validateDocument(doc(undefined, { fontFamily: 'sans-serif' }))).toEqual([]);
    });

    it('says nothing when a node carries no font-family (the soleFont path)', () => {
        expect(validateDocument(doc({ 'Roboto-Regular': FACE }, {}))).toEqual([]);
    });

    it('says nothing about a face nothing references — keeping it is legal', () => {
        // Glyph mode OFF, outlines retained so toggling it back on needs no font reload.
        expect(validateDocument(doc({ 'Roboto-Regular': FACE }, { fontFamily: 'sans-serif' }, false))).toEqual([]);
    });
});
