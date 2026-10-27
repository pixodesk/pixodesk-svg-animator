/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The trigger's lists are normalised by ONE helper (`resolveTrigger`) that every player calls; what an
// ABSENT block means (`PX_PLAYBACK_DEFAULTS.playOn`) and what the gate keys default to are stated once —
// so a document with no trigger means the same thing on the web and on React Native
// (SCHEMA-NAMING-REVIEW §2.1; dev-docs/plans/component-api.md D5).
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../schema/PxSchema';
import { PX_PLAYBACK_DEFAULTS, PxPlayState, PxTriggerAction, resolveGate, resolveTrigger, triggerActionFor, triggerConflicts, triggerEventList, triggerListsEvent } from './PxAnimatorConstants';
import { PxTimeTimelineSchema, PxTriggerSchema, type PxTrigger } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing trigger plays on load; an EMPTY block lists nothing — the manual document', () => {
        expect(resolveTrigger(undefined)).toEqual({ playOn: ['load'], playOff: [], pauseOn: [], pauseOff: ['load'] });
        expect(resolveTrigger({})).toEqual({ playOn: [], playOff: [], pauseOn: [], pauseOff: [] });
    });

    it('fills only what is missing: an omitted pauseOff is a copy of playOn, a stated one stands', () => {
        expect(resolveTrigger({ playOn: 'hoverIn', pauseOn: 'hoverOut' }))
            .toEqual({ playOn: ['hoverIn'], playOff: [], pauseOn: ['hoverOut'], pauseOff: ['hoverIn'] });
        expect(resolveTrigger({ playOn: 'click', pauseOn: 'click', pauseOff: [] }))
            .toEqual({ playOn: ['click'], playOff: [], pauseOn: ['click'], pauseOff: [] });
    });

    it('keeps every list the document states — one event or several, always read as a list', () => {
        expect(triggerEventList(undefined)).toEqual([]);
        expect(triggerEventList('click')).toEqual(['click']);
        expect(triggerEventList(['hoverIn', 'click'])).toEqual(['hoverIn', 'click']);
        const stated: PxTrigger = { playOn: ['load', 'click'], playOff: ['hoverOut'], pauseOn: ['click'], pauseOff: ['hoverIn'] };
        expect(resolveTrigger(stated)).toEqual(stated);
    });

    it('an event in both playOff and pauseOn is a conflict the players report; playOn beside pauseOff is the normal case', () => {
        expect(triggerConflicts(resolveTrigger({ playOn: 'hoverIn', playOff: 'hoverOut', pauseOn: 'hoverOut' }))).toEqual(['hoverOut']);
        expect(triggerConflicts(resolveTrigger({ playOn: 'click', pauseOn: 'click' }))).toEqual([]);
    });

    it('the state rule: the state picks the list an event is read from; pauseOn and pauseOff win over playOff', () => {
        const t = resolveTrigger({ playOn: 'click', pauseOn: 'click', playOff: 'hoverOut' });
        expect(triggerActionFor(t, PxPlayState.stopped, 'click')).toBe(PxTriggerAction.play);
        expect(triggerActionFor(t, PxPlayState.playing, 'click')).toBe(PxTriggerAction.pause);
        expect(triggerActionFor(t, PxPlayState.paused, 'click')).toBe(PxTriggerAction.play);     // pauseOff = playOn
        expect(triggerActionFor(t, PxPlayState.stopped, 'hoverOut')).toBeUndefined();            // nothing to stop
        expect(triggerActionFor(t, PxPlayState.playing, 'hoverOut')).toBe(PxTriggerAction.off);
        expect(triggerActionFor(t, PxPlayState.paused, 'hoverOut')).toBe(PxTriggerAction.off);
        const conflict = resolveTrigger({ playOn: 'hoverIn', playOff: 'hoverOut', pauseOn: 'hoverOut' });
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
        expect(resolveTrigger(undefined).playOn).toEqual([PX_PLAYBACK_DEFAULTS.playOn]);
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
