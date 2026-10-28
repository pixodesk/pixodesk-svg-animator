/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The triggers' lists are normalised by ONE helper (`resolveTriggers`) that every player calls; what an
// ABSENT block means (`PX_PLAYBACK_DEFAULTS.start`) and what the actions and gate default to are stated once —
// so a document with no triggers means the same thing on the web and on React Native
// (SCHEMA-NAMING-REVIEW §2.1; dev-docs/plans/playback-layers.md).
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../schema/PxSchema';
import { PX_PLAYBACK_DEFAULTS, PxPlayState, PxTriggerAction, resolveActions, resolveGate, resolveTriggers, triggerActionFor, triggerConflicts, triggerEventList, triggerListsEvent } from './PxAnimatorConstants';
import { PxActionsSchema, PxSuspendActionSchema, PxTimeTimelineSchema, PxTriggersSchema, type PxTriggers } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing triggers block plays on load; an EMPTY block lists nothing — the manual document', () => {
        expect(resolveTriggers(undefined)).toEqual({ start: ['load'], stop: [], pause: [], resume: ['load'] });
        expect(resolveTriggers({})).toEqual({ start: [], stop: [], pause: [], resume: [] });
    });

    it('fills only what is missing: an omitted resume is a copy of start, a stated one stands', () => {
        expect(resolveTriggers({ start: 'hoverIn', pause: 'hoverOut' }))
            .toEqual({ start: ['hoverIn'], stop: [], pause: ['hoverOut'], resume: ['hoverIn'] });
        expect(resolveTriggers({ start: 'click', pause: 'click', resume: [] }))
            .toEqual({ start: ['click'], stop: [], pause: ['click'], resume: [] });
    });

    it('keeps every list the document states — one event or several, always read as a list', () => {
        expect(triggerEventList(undefined)).toEqual([]);
        expect(triggerEventList('click')).toEqual(['click']);
        expect(triggerEventList(['hoverIn', 'click'])).toEqual(['hoverIn', 'click']);
        const stated: PxTriggers = { start: ['load', 'click'], stop: ['hoverOut'], pause: ['click'], resume: ['hoverIn'] };
        expect(resolveTriggers(stated)).toEqual(stated);
    });

    it('togglePlay lists its events under start and stop; togglePause under pause and resume', () => {
        expect(resolveTriggers({ togglePlay: 'click' })).toEqual({ start: ['click'], stop: ['click'], pause: [], resume: [] });
        expect(resolveTriggers({ start: 'load', togglePause: 'click' }))
            .toEqual({ start: ['load'], stop: [], pause: ['click'], resume: ['load', 'click'] });
        // an event already listed is not listed twice
        expect(resolveTriggers({ start: 'click', togglePlay: 'click' }).start).toEqual(['click']);
    });

    it('a togglePlay click while paused STOPS — the resume default copies only the explicit start list', () => {
        const t = resolveTriggers({ start: 'load', pause: 'hoverOut', togglePlay: 'click' });
        expect(t.resume).toEqual(['load']);
        expect(triggerActionFor(t, PxPlayState.stopped, 'click')).toBe(PxTriggerAction.play);
        expect(triggerActionFor(t, PxPlayState.playing, 'click')).toBe(PxTriggerAction.stop);
        expect(triggerActionFor(t, PxPlayState.paused, 'click')).toBe(PxTriggerAction.stop);
    });

    it('a togglePause click pauses while playing and resumes while paused; nothing when stopped', () => {
        const t = resolveTriggers({ start: [], togglePause: 'click' });
        expect(triggerActionFor(t, PxPlayState.stopped, 'click')).toBeUndefined();
        expect(triggerActionFor(t, PxPlayState.playing, 'click')).toBe(PxTriggerAction.pause);
        expect(triggerActionFor(t, PxPlayState.paused, 'click')).toBe(PxTriggerAction.play);
    });

    it('an event in both stop and pause is a conflict the players report; start beside resume is the normal case', () => {
        expect(triggerConflicts(resolveTriggers({ start: 'hoverIn', stop: 'hoverOut', pause: 'hoverOut' }))).toEqual(['hoverOut']);
        expect(triggerConflicts(resolveTriggers({ start: 'click', pause: 'click' }))).toEqual([]);
    });

    it('the state rule: the state picks the list an event is read from; pause and resume win over stop', () => {
        const t = resolveTriggers({ start: 'click', pause: 'click', stop: 'hoverOut' });
        expect(triggerActionFor(t, PxPlayState.stopped, 'click')).toBe(PxTriggerAction.play);
        expect(triggerActionFor(t, PxPlayState.playing, 'click')).toBe(PxTriggerAction.pause);
        expect(triggerActionFor(t, PxPlayState.paused, 'click')).toBe(PxTriggerAction.play);     // resume = start
        expect(triggerActionFor(t, PxPlayState.stopped, 'hoverOut')).toBeUndefined();            // nothing to stop
        expect(triggerActionFor(t, PxPlayState.playing, 'hoverOut')).toBe(PxTriggerAction.stop);
        expect(triggerActionFor(t, PxPlayState.paused, 'hoverOut')).toBe(PxTriggerAction.stop);
        const conflict = resolveTriggers({ start: 'hoverIn', stop: 'hoverOut', pause: 'hoverOut' });
        expect(triggerActionFor(conflict, PxPlayState.playing, 'hoverOut')).toBe(PxTriggerAction.pause);
        expect(triggerListsEvent(t, 'hoverOut')).toBe(true);
        expect(triggerListsEvent(t, 'load')).toBe(false);
    });

    it('the gate defaults from the one table, read off the runtime view', () => {
        expect(resolveGate(undefined)).toEqual({ suspend: 'pause', inViewThreshold: 0.5, inViewDebounce: 150 });
        expect(resolveGate({ actions: { suspend: { transition: 'reset' } }, inViewThreshold: 0 })).toEqual({ suspend: 'reset', inViewThreshold: 0, inViewDebounce: 150 });
    });

    it('the actions default from the one table, each field on its own', () => {
        expect(resolveActions(undefined)).toEqual({
            start: { transition: 'continue' }, stop: { transition: 'reset', completeIteration: false },
            finish: { transition: 'hold' }, suspend: { transition: 'pause' },
        });
        expect(resolveActions({ stop: { completeIteration: true } }).stop).toEqual({ transition: 'reset', completeIteration: true });
        expect(resolveActions({ start: { transition: 'jumpToFinished' } }).start.transition).toBe('jumpToFinished');
    });

    it("the schema states NO default for a list — absent inside a block means 'not listed'; the absent BLOCK is the resolver's rule", () => {
        expect(PxTriggersSchema.defaults).toEqual({});
        expect(resolveTriggers(undefined).start).toEqual([PX_PLAYBACK_DEFAULTS.start]);
    });

    it('the schema declares the same suspend default the players apply — the one that makes `load` safe', () => {
        const suspend = describeSchema(PxSuspendActionSchema);
        if (suspend.kind !== 'shape') throw new Error('PxSuspendActionSchema is not an object schema');
        const transition = describeSchema(suspend.shape.transition);
        if (transition.kind !== 'optional') throw new Error('actions.suspend.transition is not optional');
        expect(transition.inner._default).toBe(PX_PLAYBACK_DEFAULTS.suspendTransition);
        expect(PxSuspendActionSchema.defaults.transition).toBe('pause');
        expect(PxActionsSchema.defaults).toEqual({});
        expect(PxTimeTimelineSchema.defaults.beforeStart).toBe('static');
    });
});
