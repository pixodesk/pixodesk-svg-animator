/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/
// The document's `animator` is typed as WRITTEN (dev-docs/reviews/first-use-review.md §3): a flat playback key at its
// root (`duration`, `trigger`, …) does not type-check, because the player drops it. The flat runtime view the players
// read is `PxAnimatorRuntimeConfig` — what `getAnimatorConfig` returns.
// The type half of this guard runs in `pnpm typecheck` (an unused `@ts-expect-error` is an error there).
import { describe, expect, it } from 'vitest';
import type { PxAnimatedSvgDocument, PxAnimatorConfig, PxAnimatorRuntimeConfig } from '../index';
import { getAnimatorConfig, nestAnimatorTimeline } from '../index';

describe('the animator type is the written shape', () => {
    it('a nested timeline type-checks and reaches the players', () => {
        const doc: PxAnimatedSvgDocument = { type: 'svg', animator: { timeline: { duration: 2000 } } };
        expect(getAnimatorConfig(doc)?.duration).toBe(2000);
    });

    it('a flat key at the animator root does not type-check, and the player drops it', () => {
        // @ts-expect-error — `duration` belongs inside `timeline`; at the root the player drops it
        const doc: PxAnimatedSvgDocument = { type: 'svg', animator: { duration: 2000 } };
        expect(getAnimatorConfig(doc)?.duration).toBeUndefined();
    });

    it('the runtime view goes back to the written shape through nestAnimatorTimeline', () => {
        const flat: PxAnimatorRuntimeConfig = { duration: 2000, trigger: { start: 'click' } };
        const written: PxAnimatorConfig = nestAnimatorTimeline(flat);
        expect(written).toEqual({ timeline: { duration: 2000, trigger: { start: 'click' } } });
    });
});
