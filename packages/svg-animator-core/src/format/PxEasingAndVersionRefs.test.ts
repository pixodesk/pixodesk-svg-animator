/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Two cross-reference checks the schema cannot make on its own:
//
//  §2.9  a keyframe `easing` NAME must exist in `animator.definitions.easings`. CSS keywords
//        are deliberately not built in, so `easing: "ease-in-out"` validates as a string,
//        resolves to nothing and plays LINEAR behind one console.warn.
//  §2.10 `animator.version` is `px.string()`, so `"v1"` validates and is then read as
//        UNSTAMPED — the document loses the diagnostic that says which schema wrote it.

import { describe, expect, it } from 'vitest';
import { validateDocument } from './PxAnimatorTypes';

/** A one-rect document with the given animator block. */
function doc(animator?: Record<string, unknown>) {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        ...(animator ? { animator } : {}),
        children: [{
            type: 'rect', id: 'r',
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    } as never;
}

/** The same document, with `easing` set on its second keyframe. */
function withEasing(easing: unknown, easings?: Record<string, unknown>) {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: {
            timeline: { duration: 1000 },
            ...(easings ? { definitions: { easings } } : {}),
        },
        children: [{
            type: 'rect', id: 'r',
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1, easing }] } },
        }],
    } as never;
}

describe('validateDocument — a named easing must be defined (§2.9)', () => {

    it('accepts a name that IS defined', () => {
        expect(validateDocument(withEasing('softDrop', { softDrop: [0.33, 0, 0.2, 1] }))).toEqual([]);
    });

    it('accepts an inline cubic-bezier array — nothing to cross-check', () => {
        expect(validateDocument(withEasing([0.4, 0, 0.6, 1], { softDrop: [0.33, 0, 0.2, 1] }))).toEqual([]);
    });

    it('reports a CSS keyword, which is exactly the silent mistake', () => {
        const problems = validateDocument(withEasing('ease-in-out', { softDrop: [0.33, 0, 0.2, 1] }));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('ease-in-out');
        expect(problems[0]).toContain('definitions.easings');
        expect(problems[0]).toContain('linear');
    });

    it('reports a name when the document defines NO easings at all', () => {
        expect(validateDocument(withEasing('softDrop'))).toHaveLength(1);
    });

    it('says nothing when no keyframe names an easing', () => {
        expect(validateDocument(doc({ timeline: { duration: 1000 } }))).toEqual([]);
    });
});

describe('validateDocument — the version stamp must parse (§2.10)', () => {

    it('accepts "a.b.c" and "a.b"', () => {
        expect(validateDocument(doc({ version: '1.1.1' }))).toEqual([]);
        expect(validateDocument(doc({ version: '2.0' }))).toEqual([]);
    });

    it('accepts an ABSENT stamp — unstamped is legal', () => {
        expect(validateDocument(doc({ timeline: { duration: 1000 } }))).toEqual([]);
    });

    it('reports a stamp that does not parse', () => {
        const problems = validateDocument(doc({ version: 'v1' }));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('animator.version');
        expect(problems[0]).toContain('unstamped');
    });

    it('reports a nearly-right stamp too', () => {
        expect(validateDocument(doc({ version: '1.1.1-beta' }))).toHaveLength(1);
        expect(validateDocument(doc({ version: '1' }))).toHaveLength(1);
    });
});
