/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The trigger's lists are normalised by ONE helper (`resolveTrigger`) that every player calls; what an
// ABSENT block means (`PX_PLAYBACK_DEFAULTS.playStart`) and what the gate keys default to are stated once —
// so a document with no trigger means the same thing on the web and on React Native
// (SCHEMA-NAMING-REVIEW §2.1; dev-docs/plans/component-api.md D5).
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../schema/PxSchema';
import { PX_PLAYBACK_DEFAULTS, PxPlayState, PxTriggerAction, resolveGate, resolveTrigger, triggerActionFor, triggerConflicts, triggerEventList, triggerListsEvent } from './PxAnimatorConstants';
import { PxTimeTimelineSchema, PxTriggerSchema, type PxTrigger } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing trigger plays on load; an EMPTY block lists nothing — the manual document', () => {
        expect(resolveTrigger(undefined)).toEqual({ playStart: ['load'], playStop: [], pauseStart: [], pauseStop: ['load'] });
        expect(resolveTrigger({})).toEqual({ playStart: [], playStop: [], pauseStart: [], pauseStop: [] });
    });

    it('fills only what is missing: an omitted pauseStop is a copy of playStart, a stated one stands', () => {
        expect(resolveTrigger({ playStart: 'hoverIn', pauseStart: 'hoverOut' }))
            .toEqual({ playStart: ['hoverIn'], playStop: [], pauseStart: ['hoverOut'], pauseStop: ['hoverIn'] });
        expect(resolveTrigger({ playStart: 'click', pauseStart: 'click', pauseStop: [] }))
            .toEqual({ playStart: ['click'], playStop: [], pauseStart: ['click'], pauseStop: [] });
    });

    it('keeps every list the document states — one event or several, always read as a list', () => {
        expect(triggerEventList(undefined)).toEqual([]);
        expect(triggerEventList('click')).toEqual(['click']);
        expect(triggerEventList(['hoverIn', 'click'])).toEqual(['hoverIn', 'click']);
        const stated: PxTrigger = { playStart: ['load', 'click'], playStop: ['hoverOut'], pauseStart: ['click'], pauseStop: ['hoverIn'] };
        expect(resolveTrigger(stated)).toEqual(stated);
    });

    it('an event in both playStop and pauseStart is a conflict the players report; playStart beside pauseStop is the normal case', () => {
        expect(triggerConflicts(resolveTrigger({ playStart: 'hoverIn', playStop: 'hoverOut', pauseStart: 'hoverOut' }))).toEqual(['hoverOut']);
        expect(triggerConflicts(resolveTrigger({ playStart: 'click', pauseStart: 'click' }))).toEqual([]);
    });

    it('the state rule: the state picks the list an event is read from; pauseStart and pauseStop win over playStop', () => {
        const t = resolveTrigger({ playStart: 'click', pauseStart: 'click', playStop: 'hoverOut' });
        expect(triggerActionFor(t, PxPlayState.stopped, 'click')).toBe(PxTriggerAction.play);
        expect(triggerActionFor(t, PxPlayState.playing, 'click')).toBe(PxTriggerAction.pause);
        expect(triggerActionFor(t, PxPlayState.paused, 'click')).toBe(PxTriggerAction.play);     // pauseStop = playStart
        expect(triggerActionFor(t, PxPlayState.stopped, 'hoverOut')).toBeUndefined();            // nothing to stop
        expect(triggerActionFor(t, PxPlayState.playing, 'hoverOut')).toBe(PxTriggerAction.stop);
        expect(triggerActionFor(t, PxPlayState.paused, 'hoverOut')).toBe(PxTriggerAction.stop);
        const conflict = resolveTrigger({ playStart: 'hoverIn', playStop: 'hoverOut', pauseStart: 'hoverOut' });
        expect(triggerActionFor(conflict, PxPlayState.playing, 'hoverOut')).toBe(PxTriggerAction.pause);
        expect(triggerListsEvent(t, 'hoverOut')).toBe(true);
        expect(triggerListsEvent(t, 'load')).toBe(false);
    });

    it('the gate keys default from the one table, read off the runtime view', () => {
        expect(resolveGate(undefined)).toEqual({ outOfViewAction: 'pause', inViewThreshold: 0.5, inViewDebounce: 150 });
        expect(resolveGate({ outOfViewAction: 'reset', inViewThreshold: 0 })).toEqual({ outOfViewAction: 'reset', inViewThreshold: 0, inViewDebounce: 150 });
    });

    it("the schema states NO default for a list — absent inside a block means 'not listed'; the absent BLOCK is the resolver's rule", () => {
        expect(PxTriggerSchema.defaults).toEqual({});
        expect(resolveTrigger(undefined).playStart).toEqual([PX_PLAYBACK_DEFAULTS.playStart]);
    });

    it('the schema declares the same outOfViewAction default the players apply — the one that makes `load` safe', () => {
        const timeline = describeSchema(PxTimeTimelineSchema);
        if (timeline.kind !== 'shape') throw new Error('PxTimeTimelineSchema is not an object schema');
        const outOfView = describeSchema(timeline.shape.outOfViewAction);
        if (outOfView.kind !== 'optional') throw new Error('timeline.outOfViewAction is not optional');
        expect(outOfView.inner._default).toBe(PX_PLAYBACK_DEFAULTS.outOfViewAction);
        expect(PxTimeTimelineSchema.defaults.outOfViewAction).toBe('pause');
    });
});
