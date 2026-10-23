/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The trigger defaults live in ONE table (`PX_TRIGGER_DEFAULTS`), applied by ONE helper
// (`resolveTrigger`) that every player calls, and declared by the schema — so a document with no
// trigger means the same thing on the web and on React Native (SCHEMA-NAMING-REVIEW §2.1).
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../schema/PxSchema';
import { PX_TRIGGER_DEFAULTS, resolveTrigger } from './PxAnimatorConstants';
import { PxTriggerSchema } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing trigger starts on load and does NOT run while nobody can see it', () => {
        const expected = {
            start: 'load', outOfView: 'pause', hoverEnd: 'pause',
            inViewThreshold: 0.5, inViewDebounce: 150,
        };
        expect(resolveTrigger(undefined)).toEqual(expected);
        expect(resolveTrigger({})).toEqual(expected);
    });

    it('fills only what is missing', () => {
        expect(resolveTrigger({ outOfView: 'reset' }))
            .toEqual({
                start: 'load', outOfView: 'reset', hoverEnd: 'pause',
                inViewThreshold: 0.5, inViewDebounce: 150,
            });
    });

    it("keeps every value the document states, 'manual' included", () => {
        const stated = {
            start: 'manual', outOfView: 'continue', hoverEnd: 'reverse',
            inViewThreshold: 0.8, inViewDebounce: 0,
        } as const;
        expect(resolveTrigger(stated)).toEqual(stated);
    });

    it('the schema declares the same start default the players apply', () => {
        const trigger = describeSchema(PxTriggerSchema);
        if (trigger.kind !== 'shape') throw new Error('PxTriggerSchema is not an object schema');
        const start = describeSchema(trigger.shape.start);
        if (start.kind !== 'optional') throw new Error('trigger.start is not optional');
        expect(start.inner._default).toBe(PX_TRIGGER_DEFAULTS.start);
    });

    it('the schema declares the same outOfView default — the one that makes `load` safe', () => {
        const trigger = describeSchema(PxTriggerSchema);
        if (trigger.kind !== 'shape') throw new Error('PxTriggerSchema is not an object schema');
        const outOfView = describeSchema(trigger.shape.outOfView);
        if (outOfView.kind !== 'optional') throw new Error('trigger.outOfView is not optional');
        expect(outOfView.inner._default).toBe(PX_TRIGGER_DEFAULTS.outOfView);
    });
});
