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
import { allowedTriggerEvents, counterpartTriggerEvent, derivedResume, PX_PLAYBACK_DEFAULTS, PxPlayState, PxTriggerAction, PxTriggerIssueKind, PxTriggerList, resolveActions, resolveGate, resolveTriggers, triggerActionFor, triggerEventList, triggerIssues, triggerListsEvent } from './PxAnimatorConstants';
import { PxActionsSchema, PxSuspendActionSchema, PxTimeTimelineSchema, PxActionTriggersSchema, type PxActionTriggers } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing triggers block plays on load; an EMPTY block lists nothing — the manual document', () => {
        expect(resolveTriggers(undefined)).toEqual({ start: ['load'], stop: [], pause: [], resume: ['load'] });
        expect(resolveTriggers({})).toEqual({ start: [], stop: [], pause: [], resume: [] });
    });

    it('resume is derived: the counterpart of each pause event plus the start events that do not stop; an explicit built-in resume is ignored', () => {
        expect(resolveTriggers({ start: 'hoverIn', pause: 'hoverOut' }))
            .toEqual({ start: ['hoverIn'], stop: [], pause: ['hoverOut'], resume: ['hoverIn'] });
        expect(resolveTriggers({ start: 'click', pause: 'click', resume: [] }))
            .toEqual({ start: ['click'], stop: [], pause: ['click'], resume: ['click'] });
        // a marquee: plays on load, pauses while the pointer is over it, resumes when it leaves
        expect(resolveTriggers({ start: 'load', pause: 'hoverIn', resume: 'click' }).resume).toEqual(['hoverOut', 'load']);
        expect(counterpartTriggerEvent('hoverIn')).toBe('hoverOut');
        expect(counterpartTriggerEvent('load')).toBeUndefined();
        expect(derivedResume(['click'], ['click'], [])).toEqual([]);   // a start that also stops does not resume
    });

    it('keeps every list the document states — one event or several, always read as a list', () => {
        expect(triggerEventList(undefined)).toEqual([]);
        expect(triggerEventList('click')).toEqual(['click']);
        expect(triggerEventList(['hoverIn', 'click'])).toEqual(['hoverIn', 'click']);
        const stated: PxActionTriggers = { start: ['load', 'click'], stop: ['hoverOut'], pause: ['click'] };
        expect(resolveTriggers(stated)).toEqual({ ...stated, resume: ['click', 'load'] });
    });

    it('togglePlay lists click under start and stop — and names nothing but click', () => {
        expect(resolveTriggers({ togglePlay: 'click' })).toEqual({ start: ['click'], stop: ['click'], pause: [], resume: [] });
        expect(resolveTriggers({ togglePlay: 'hoverIn' })).toEqual({ start: [], stop: [], pause: [], resume: [] });
        // an event already listed is not listed twice
        expect(resolveTriggers({ start: 'click', togglePlay: 'click' }).start).toEqual(['click']);
    });

    it('a togglePlay click while paused STOPS — a start event that also stops does not resume', () => {
        const t = resolveTriggers({ start: 'load', pause: 'hoverOut', togglePlay: 'click' });
        expect(t.resume).toEqual(['hoverIn', 'load']);
        expect(triggerActionFor(t, PxPlayState.stopped, 'click')).toBe(PxTriggerAction.play);
        expect(triggerActionFor(t, PxPlayState.playing, 'click')).toBe(PxTriggerAction.stop);
        expect(triggerActionFor(t, PxPlayState.paused, 'click')).toBe(PxTriggerAction.stop);
        // FINISHED: stop wins over start — a toggle undoes a finished one-shot rather than replaying it
        expect(triggerActionFor(t, PxPlayState.finished, 'click')).toBe(PxTriggerAction.stop);
    });

    it('finished is its own state: stop acts on it (the lid plays back on hover out), start alone replays', () => {
        const lid = resolveTriggers({ start: 'hoverIn', stop: 'hoverOut' });
        expect(triggerActionFor(lid, PxPlayState.finished, 'hoverOut')).toBe(PxTriggerAction.stop);
        expect(triggerActionFor(lid, PxPlayState.finished, 'hoverIn')).toBe(PxTriggerAction.play);
        const replay = resolveTriggers({ start: 'click' });
        expect(triggerActionFor(replay, PxPlayState.finished, 'click')).toBe(PxTriggerAction.play);
        expect(triggerActionFor(replay, PxPlayState.finished, 'hoverOut')).toBeUndefined();
    });

    it('a pause click pauses while playing and resumes while paused (its counterpart); nothing when stopped', () => {
        const t = resolveTriggers({ start: [], pause: 'click' });
        expect(triggerActionFor(t, PxPlayState.stopped, 'click')).toBeUndefined();
        expect(triggerActionFor(t, PxPlayState.playing, 'click')).toBe(PxTriggerAction.pause);
        expect(triggerActionFor(t, PxPlayState.paused, 'click')).toBe(PxTriggerAction.play);
    });

    it('an event in both stop and pause is a collision the players report; start beside resume is the normal case', () => {
        expect(triggerIssues({ start: 'hoverIn', stop: 'hoverOut', pause: 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stop, event: 'hoverOut', otherList: PxTriggerList.pause }]);
        expect(triggerIssues({ start: 'click', pause: 'click' })).toEqual([]);
        // the Editor's toggle (a click that starts and stops) is no collision, nor the hover pair
        expect(triggerIssues({ start: 'click', stop: 'click' })).toEqual([]);
        expect(triggerIssues({ start: 'hoverIn', stop: 'hoverOut' })).toEqual([]);
    });

    it('stop on a pause\'s counterpart is a collision too — paused, the resume wins', () => {
        expect(triggerIssues({ start: 'load', pause: 'hoverIn', stop: 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stop, event: 'hoverOut', otherList: PxTriggerList.resume }]);
        const t = resolveTriggers({ start: 'load', pause: 'hoverIn', stop: 'hoverOut' });
        expect(triggerActionFor(t, PxPlayState.paused, 'hoverOut')).toBe(PxTriggerAction.play);
    });

    it('each list names only the events that make sense; others are dropped and reported', () => {
        expect(allowedTriggerEvents(PxTriggerList.start)).toEqual(['load', 'hoverIn', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.stop)).toEqual(['hoverOut', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.pause)).toEqual(['hoverIn', 'hoverOut', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.togglePlay)).toEqual(['click']);
        const odd: PxActionTriggers = { start: ['hoverOut', 'click'], stop: 'load', pause: 'load' };
        expect(resolveTriggers(odd)).toEqual({ start: ['click'], stop: [], pause: [], resume: ['click'] });
        expect(triggerIssues(odd)).toEqual([
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.start, event: 'hoverOut' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.stop, event: 'load' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.pause, event: 'load' },
        ]);
    });

    it('an explicit resume naming a built-in event the derivation does not is reported as ignored', () => {
        expect(triggerIssues({ start: 'load', pause: 'hoverIn', resume: ['hoverOut', 'click'] }))
            .toEqual([{ kind: PxTriggerIssueKind.resumeIgnored, list: PxTriggerList.resume, event: 'click' }]);
        expect(triggerIssues(undefined)).toEqual([]);
    });

    it('the document repair drops a disallowed event — never the whole list, never a default in its place', () => {
        expect(PxActionTriggersSchema.castOrFix({ start: ['hoverOut', 'click'] }).value).toEqual({ start: ['click'] });
        // a lone disallowed event drops the list — absent inside a present block = not listed
        expect(PxActionTriggersSchema.castOrFix({ start: 'click', stop: 'load' }).value).toEqual({ start: 'click' });
        expect(PxActionTriggersSchema.castOrFix({ togglePlay: 'hoverIn' }).value).toEqual({});
        const clean = PxActionTriggersSchema.castOrFix({ start: ['hoverIn', 'click'], pause: 'hoverOut' });
        expect(clean.value).toEqual({ start: ['hoverIn', 'click'], pause: 'hoverOut' });
        expect(clean.problems).toEqual([]);
        expect(PxActionTriggersSchema.castOrFix({ start: ['hoverOut', 'click'] }).problems.length).toBe(1);
    });

    it('the schema states the same allowed events — a document naming another fails strict validation', () => {
        expect(PxActionTriggersSchema.isValid({ start: 'click', stop: ['hoverOut', 'click'], pause: 'hoverIn' })).toBe(true);
        expect(PxActionTriggersSchema.isValid({ start: 'hoverOut' })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ stop: ['click', 'load'] })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ togglePlay: 'hoverIn' })).toBe(false);
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
        expect(resolveGate({ actions: { suspend: { do: 'reset' } }, inViewThreshold: 0 })).toEqual({ suspend: 'reset', inViewThreshold: 0, inViewDebounce: 150 });
    });

    it('the actions default from the one table, each field on its own', () => {
        expect(resolveActions(undefined)).toEqual({
            start: { do: 'continue' }, stop: { do: 'reset', completeIteration: false },
            finish: { do: 'hold' }, suspend: { do: 'pause' },
        });
        expect(resolveActions({ stop: { completeIteration: true } }).stop).toEqual({ do: 'reset', completeIteration: true });
        expect(resolveActions({ start: { do: 'jumpToFinished' } }).start.do).toBe('jumpToFinished');
    });

    it("the schema states NO default for a list — absent inside a block means 'not listed'; the absent BLOCK is the resolver's rule", () => {
        expect(PxActionTriggersSchema.defaults).toEqual({});
        expect(resolveTriggers(undefined).start).toEqual([PX_PLAYBACK_DEFAULTS.start]);
    });

    it('the schema declares the same suspend default the players apply — the one that makes `load` safe', () => {
        const suspend = describeSchema(PxSuspendActionSchema);
        if (suspend.kind !== 'shape') throw new Error('PxSuspendActionSchema is not an object schema');
        const transition = describeSchema(suspend.shape.do);
        if (transition.kind !== 'optional') throw new Error('actions.suspend.do is not optional');
        expect(transition.inner._default).toBe(PX_PLAYBACK_DEFAULTS.suspendTransition);
        expect(PxSuspendActionSchema.defaults.do).toBe('pause');
        expect(PxActionsSchema.defaults).toEqual({});
        expect(PxTimeTimelineSchema.defaults.beforeStart).toBe('static');
    });
});
