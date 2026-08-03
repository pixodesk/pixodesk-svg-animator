/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Effect params that GRADUATED from editor-only schema extensions into the
// player wire (SCHEMA-ANALYSIS §4 catalogue): `repeater.skew` (per-copy ×i,
// animatable) and `maskedBy.start`/`size` (explicit mask viewport). Before the
// graduation the player silently ignored both — editor and player rendered
// differently whenever they were set.

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


describe('maskedBy.start/size — explicit mask viewport', () => {

    it('start/size land on the minted <mask> as x/y/width/height', () => {
        const out = materialise(doc({
            type: 'rect', width: 100, height: 100,
            effects: { maskedBy: {
                sourceId: '#msrc', maskUnits: 'userSpaceOnUse',
                start: [-20, -20], size: [240, 240],
            } },
        }));
        const mask = collectByType(out, 'mask')[0] as any;
        expect(mask.x).toBe('-20');
        expect(mask.y).toBe('-20');
        expect(mask.width).toBe('240');
        expect(mask.height).toBe('240');
        expect(mask.maskUnits).toBe('userSpaceOnUse');
    });

    it('absent start/size → no viewport attrs (SVG implicit −10%…120% region)', () => {
        const out = materialise(doc({
            type: 'rect', width: 100, height: 100,
            effects: { maskedBy: { sourceId: '#msrc' } },
        }));
        const mask = collectByType(out, 'mask')[0] as any;
        expect(mask.x).toBeUndefined();
        expect(mask.width).toBeUndefined();
    });
});
