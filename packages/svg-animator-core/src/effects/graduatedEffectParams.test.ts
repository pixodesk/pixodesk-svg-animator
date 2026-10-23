/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Effect params that GRADUATED from editor-only schema extensions into the
// player wire (SCHEMA-DESIGN §4 catalog): `repeater.skew` (per-copy ×i,
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
import { PxTransformPartsSchema, PxTransformValueWrapperSchema, type PxDocument, type PxKeyframe, type PxKeyframeValue, type PxNode, type PxTimeline, type PxTransformParts } from '../format/PxAnimatorTypes';
import { authoredEntry, collectByType, entryOf, materialize, untyped } from './effectTestKit';

const doc = (child: PxNode): PxDocument =>
    // `timeline.duration` is the pre-1.3 spelling: not in the type, still read for old files
    ({ type: 'svg', animator: { timeline: untyped<PxTimeline>({ duration: 2000 }) }, children: [child] });

/** A per-copy wrapper's structured static `transform: {value: parts}` — its parts. */
const staticParts = (g: PxNode): PxTransformParts | undefined => PxTransformValueWrapperSchema.castOrNull(g.transform)?.value;


describe('repeater.skew — per-copy skew increment ×i', () => {

    it('static skew: copy i gets a transform with skew × i', () => {
        const out = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { repeater: { copies: 3, skew: 4 } },
        }));
        const wrappers = collectByType(out, 'g').filter(g => staticParts(g));
        const skews = wrappers.map(g => staticParts(g)?.skew);
        expect(skews).toEqual([4, 8]);   // copies 1 and 2 (copy 0 is the unmodified base)
    });

    it('animated skew (keyframes + loop): per-copy keyframe values scale ×i', () => {
        const out = materialize(doc({
            type: 'rect', width: 10, height: 10,
            effects: { repeater: {
                copies: 3,
                // short `{t, v}` keyframes: not in the type, still read by effect slots (`readAnimatable`)
                skew: { keyframes: untyped<Array<PxKeyframe<PxKeyframeValue>>>([{ t: 0, v: 0 }, { t: 1000, v: 5 }]), loop: true },
            } },
        }));
        const wrappers = collectByType(out, 'g').filter(g => entryOf(g, 'transform'));
        const lastCopy = authoredEntry(wrappers[wrappers.length - 1], 'transform');
        expect(lastCopy.keyframes?.map(k => PxTransformPartsSchema.cast(k.value).skew)).toEqual([0, 10]);
        expect(lastCopy.loop).toBe(true);
    });
});


describe('maskedBy viewport (x/y/width/height) — explicit mask region', () => {

    it('x/y/width/height land on the generated <mask> verbatim', () => {
        const out = materialize(doc({
            type: 'rect', width: 100, height: 100,
            effects: { maskedBy: {
                source: '#msrc', maskUnits: 'userSpaceOnUse',
                x: -20, y: -20, width: 240, height: 240,
            } },
        }));
        const mask = collectByType(out, 'mask')[0];
        expect(mask.x).toBe('-20');
        expect(mask.y).toBe('-20');
        expect(mask.width).toBe('240');
        expect(mask.height).toBe('240');
        expect(mask.maskUnits).toBe('userSpaceOnUse');
    });

    it('absent viewport → no viewport attrs (SVG implicit −10%…120% region)', () => {
        const out = materialize(doc({
            type: 'rect', width: 100, height: 100,
            effects: { maskedBy: { source: '#msrc' } },
        }));
        const mask = collectByType(out, 'mask')[0];
        expect(mask.x).toBeUndefined();
        expect(mask.width).toBeUndefined();
    });
});
