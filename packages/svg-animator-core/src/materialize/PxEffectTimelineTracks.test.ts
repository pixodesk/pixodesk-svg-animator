/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Effect parameters on several timelines (2026-11-20, N4): the effects run once per timeline and the animations they
// make carry a `byTimeline` track for every timeline a parameter names.

import { describe, expect, it } from 'vitest';
import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { collectByType, compiledEntry, PxTimelineEngine } from '../effects/effectTestKit';
import { materializeAllInTree } from './PxAnimatorMaterializeAll';
import { effectTrackTimelines } from './PxEffectTimelineTracks';

const doc = (child: PxNode): PxDocument => ({
    type: 'svg',
    animator: { timelines: [{ outTime: 2000 }, { id: 'dip', outTime: 500 }], flowSteps: [{ id: 'pressed', timeline: 'dip' }] },
    children: [child],
});

const trimmed = (offset: unknown): PxNode => ({
    type: 'path', id: 'p', d: 'M0,0 L100,0', stroke: '#000', fill: 'none',
    animate: { opacity: { keyframes: [{ time: 0, value: 1 }, { time: 2000, value: 0.5 }] } },
    effects: { strokeTrim: { range: [0, 0.5], offset } },
} as PxNode);

const pathOf = (input: PxDocument): PxNode => collectByType(materializeAllInTree(input, PxTimelineEngine.js), 'path')[0];

describe('effect parameters on several timelines', () => {
    it('the timelines the parameters name', () => {
        expect(effectTrackTimelines(doc(trimmed({ value: 0, byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: -1 }] }] })))).toEqual(['dip']);
        expect(effectTrackTimelines(doc(trimmed({ keyframes: [{ time: 0, value: 0 }] })))).toEqual([]);
    });

    it('the animation an effect makes carries the other timeline\'s track, compiled with its window', () => {
        const path = pathOf(doc(trimmed({
            keyframes: [{ time: 0, value: 0 }, { time: 2000, value: -1 }],
            byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: 0 }, { time: 500, value: -0.5 }] }],
        })));
        const offset = compiledEntry(path, 'strokeDashoffset');
        expect(offset.keyframes[offset.keyframes.length - 1].time).toBe(2000);
        const tracks = offset.byTimeline ?? [];
        expect(tracks.map(t => t.timeline)).toEqual(['dip']);
        const dip = tracks[0]?.keyframes ?? [];
        expect(dip[dip.length - 1]?.time).toBe(500);
    });

    it('a node\'s own animation gets no track — nothing on the other timeline moves it', () => {
        const path = pathOf(doc(trimmed({
            keyframes: [{ time: 0, value: 0 }, { time: 2000, value: -1 }],
            byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: 0 }, { time: 500, value: -0.5 }] }],
        })));
        expect(compiledEntry(path, 'opacity').byTimeline ?? []).toEqual([]);
    });

    it('a parameter only on the other timeline: still on the first, moving on that one', () => {
        const path = pathOf(doc(trimmed({
            value: 0,
            byTimeline: [{ timeline: 'dip', keyframes: [{ time: 0, value: 0 }, { time: 500, value: -0.5 }] }],
        })));
        const offset = compiledEntry(path, 'strokeDashoffset');
        expect(offset.byTimeline?.map(t => t.timeline)).toEqual(['dip']);
        expect(new Set(offset.keyframes.map(k => k.value)).size).toBeLessThanOrEqual(1);   // still (or empty) on the first
    });
});
