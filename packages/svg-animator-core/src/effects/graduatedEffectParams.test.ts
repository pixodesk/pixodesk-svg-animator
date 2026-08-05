/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Effect params that GRADUATED from editor-only schema extensions into the
// player wire (SCHEMA-DESIGN §4 catalogue): `repeater.skew` (per-copy ×i,
// animatable) and the `maskedBy` mask VIEWPORT. Before the graduation the player
// silently ignored both — editor and player rendered differently whenever they
// were set.
//
// B5: the viewport originally graduated under the EDITOR's model field names
// (`start`/`size` pairs) — which the editor never wrote. This test hand-authored
// that spelling, so it passed while the shipped editor→player path stayed broken.
// The wire keys are the SVG `<mask>` attrs themselves: `x/y/width/height`. Values
// below are REAL editor output shape (see `mask-viewport-clip.spec.ts` in the app,
// which drives the editor writer end-to-end rather than hand-authoring).

import { describe, expect, it } from 'vitest';
import type { PxNode } from '../PxAnimatorTypes';
import { collectByType, materialise } from './effectTestKit';

const doc = (child: Record<string, unknown>): PxNode =>
    ({ type: 'svg', animator: { duration: 2000 }, children: [child] } as unknown as PxNode);

const anim = (n: PxNode | undefined): Record<string, any> => ((n as any)?.animate ?? {});


describe('repeater.skew — per-copy skew increment ×i', () => {

    it('static skew: copy i gets a transform with skew × i', () => {
        const out = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { repeater: { copies: 3, skew: 4 } },
        }));
        const wrappers = collectByType(out, 'g').filter(g => (g as any).transform?.value);
        const skews = wrappers.map(g => (g as any).transform.value.skew);
        expect(skews).toEqual([4, 8]);   // copies 1 and 2 (copy 0 is the unmodified base)
    });

    it('animated skew (kfs alias + loop): per-copy keyframe values scale ×i', () => {
        const out = materialise(doc({
            type: 'rect', width: 10, height: 10,
            effects: { repeater: {
                copies: 3,
                skew: { kfs: [{ t: 0, v: 0 }, { t: 1000, v: 5 }], loop: true },
            } },
        }));
        const wrappers = collectByType(out, 'g').filter(g => anim(g).transform);
        const lastCopy = anim(wrappers[wrappers.length - 1]).transform;
        expect(lastCopy.keyframes.map((k: any) => k.value.skew)).toEqual([0, 10]);
        expect(lastCopy.loop).toBe(true);
    });
});


describe('maskedBy viewport (x/y/width/height) — explicit mask region', () => {

    it('x/y/width/height land on the minted <mask> verbatim', () => {
        const out = materialise(doc({
            type: 'rect', width: 100, height: 100,
            effects: { maskedBy: {
                sourceId: '#msrc', maskUnits: 'userSpaceOnUse',
                x: -20, y: -20, width: 240, height: 240,
            } },
        }));
        const mask = collectByType(out, 'mask')[0] as any;
        expect(mask.x).toBe('-20');
        expect(mask.y).toBe('-20');
        expect(mask.width).toBe('240');
        expect(mask.height).toBe('240');
        expect(mask.maskUnits).toBe('userSpaceOnUse');
    });

    it('absent viewport → no viewport attrs (SVG implicit −10%…120% region)', () => {
        const out = materialise(doc({
            type: 'rect', width: 100, height: 100,
            effects: { maskedBy: { sourceId: '#msrc' } },
        }));
        const mask = collectByType(out, 'mask')[0] as any;
        expect(mask.x).toBeUndefined();
        expect(mask.width).toBeUndefined();
    });
});
