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

    it('a missing trigger starts on load, continues when the trigger ends, and needs any pixel visible', () => {
        const expected = { startOn: 'load', outAction: 'continue', scrollIntoViewThreshold: 0 };
        expect(resolveTrigger(undefined)).toEqual(expected);
        expect(resolveTrigger({})).toEqual(expected);
    });

    it('fills only what is missing', () => {
        expect(resolveTrigger({ outAction: 'reset' }))
            .toEqual({ startOn: 'load', outAction: 'reset', scrollIntoViewThreshold: 0 });
    });

    it('keeps every value the document states, programmatic included', () => {
        const stated = { startOn: 'programmatic', outAction: 'reverse', scrollIntoViewThreshold: 0.5 } as const;
        expect(resolveTrigger(stated)).toEqual(stated);
    });

    it('the schema declares the same startOn default the players apply', () => {
        const trigger = describeSchema(PxTriggerSchema);
        if (trigger.kind !== 'shape') throw new Error('PxTriggerSchema is not an object schema');
        const startOn = describeSchema(trigger.shape.startOn);
        if (startOn.kind !== 'optional') throw new Error('trigger.startOn is not optional');
        expect(startOn.inner._default).toBe(PX_TRIGGER_DEFAULTS.startOn);
    });
});
