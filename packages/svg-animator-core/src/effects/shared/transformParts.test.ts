/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `readAnimatable` casts every value with the slot's grammar (plan schema-cast-and-stamps, step 5):
// a matching value is read as before, a mismatching one never reaches the effect appliers.
import { describe, expect, it } from 'vitest';
import { PxChannelNumberSchema, PxPathValueSchema, PxVec2Schema } from '../../format/PxAnimatorTypes';
import { ReadKind, readAnimatable, staticTransformParts } from './transformParts';

describe('readAnimatable — values cast with the slot grammar', () => {
    it('reads the three forms: bare, {value} and keyframes (long spelling only — a short {t, v} keyframe is skipped)', () => {
        expect(readAnimatable([1, 2], PxVec2Schema)).toEqual({ kind: ReadKind.Static, value: [1, 2] });
        expect(readAnimatable({ value: [1, 2] }, PxVec2Schema)).toEqual({ kind: ReadKind.Static, value: [1, 2] });
        const read = readAnimatable({ keyframes: [{ time: 0, value: [0, 0] }, { t: 500, v: [5, 5] }], value: [1, 1] }, PxVec2Schema);
        expect(read.kind === ReadKind.Animated && read.keyframes.map(k => [k.time, k.value])).toEqual([[0, [0, 0]]]);
        expect(read.kind === ReadKind.Animated && read.base).toEqual([1, 1]);
    });

    it('a keyframe whose value is not the slot grammar is skipped; a mismatching static reads as Absent', () => {
        const read = readAnimatable({ keyframes: [{ time: 0, value: 'red' }, { time: 500, value: 3 }] }, PxChannelNumberSchema);
        expect(read.kind === ReadKind.Animated && read.keyframes.map(k => k.value)).toEqual([3]);
        expect(readAnimatable('red', PxChannelNumberSchema)).toEqual({ kind: ReadKind.Absent });
        expect(readAnimatable({ value: [1, 2, 3] }, PxVec2Schema)).toEqual({ kind: ReadKind.Absent });
    });

    it('a path slot reads both the `d` string and the `{pathData}` object, static or per keyframe', () => {
        expect(readAnimatable({ pathData: 'M0,0' }, PxPathValueSchema)).toEqual({ kind: ReadKind.Static, value: { pathData: 'M0,0' } });
        const read = readAnimatable({ keyframes: [{ time: 0, value: 'M0,0' }, { time: 1, value: { pathData: 'M1,1' } }] }, PxPathValueSchema);
        expect(read.kind === ReadKind.Animated && read.keyframes.length).toBe(2);
    });
});

describe('staticTransformParts', () => {
    it('reads the bare record and the {value} wrapper; not a string or an animation', () => {
        expect(staticTransformParts({ translate: [1, 2] })).toEqual({ translate: [1, 2] });
        expect(staticTransformParts({ value: { rotate: 45 } })).toEqual({ rotate: 45 });
        expect(staticTransformParts('translate(1,2)')).toBeUndefined();
        expect(staticTransformParts({ keyframes: [{ time: 0, value: { rotate: 0 } }] })).toBeUndefined();
    });
});
