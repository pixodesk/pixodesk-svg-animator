/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// §5 (dev-docs/reviews/first-use-review.md): `import animation from './animation.json'` types
// every literal as `string` and every tuple as an array, so the STRICT wire type rejects the
// get-started snippet. The `doc` inputs take `PxDocumentInput` (the widened shape) instead and
// the runtime validates values as always. The type half runs in `pnpm typecheck`.
import { describe, expect, it } from 'vitest';
import type { PxAnimatedSvgDocument, PxDocumentInput } from '../index';
import { getAnimatorConfig, toAnimatedSvgDocument } from '../index';

/** Exactly how TypeScript types a JSON import of this document: literals widened, tuples → arrays. */
interface AsJsonImport {
    type: string;
    animator: { timeline: { outTime: number; engine: string; trigger: { start: string } } };
    children: Array<{
        type: string; width: number;
        animate: { opacity: { keyframes: Array<{ time: number; value: number; easing: Array<number> }> } };
    }>;
}
const fromJsonImport: AsJsonImport = {
    type: 'svg',
    animator: { timeline: { outTime: 1200, engine: 'auto', trigger: { start: 'click' } } },
    children: [{
        type: 'rect', width: 50,
        animate: { opacity: { keyframes: [{ time: 0, value: 0, easing: [0.4, 0, 0.2, 1] }] } },
    }],
};

describe('the doc inputs take what a JSON import produces (§5)', () => {
    it('a JSON import is a PxDocumentInput with no cast; the strict type stays for authors in code', () => {
        const input: PxDocumentInput = fromJsonImport;    // the get-started line — no cast
        // @ts-expect-error — the strict wire type still rejects widened strings (that was §5's trap)
        const strict: PxAnimatedSvgDocument = fromJsonImport;
        expect(strict).toBe(fromJsonImport);
        // one named type-level narrowing to the internals, runtime-validated as before
        expect(getAnimatorConfig(toAnimatedSvgDocument(input))?.duration).toBe(1200);
    });
});
