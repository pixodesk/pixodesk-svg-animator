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
import { PxActionsSchema, PxOutOfViewActionSchema, PxTimeTimelineSchema, PxActionTriggersSchema, type PxActionTriggers } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing triggers block plays on load; an EMPTY block lists nothing — the manual document', () => {
        expect(resolveTriggers(undefined)).toEqual({ start: ['load'], stop: [], pause: [], resume: ['load'] });
        expect(resolveTriggers({})).toEqual({ start: [], stop: [], pause: [], resume: [] });
    });

    it('resume is derived when the file does not name it: the counterpart of each pause event plus the start events that do not stop; a named list is used as written', () => {
        expect(resolveTriggers({ start: 'hoverIn', pause: 'hoverOut' }))
            .toEqual({ start: ['hoverIn'], stop: [], pause: ['hoverOut'], resume: ['hoverIn'] });
        // the file names the list: used as written — an empty list resumes on nothing (that pause waits for start or stop)
        expect(resolveTriggers({ start: 'click', pause: 'click', resume: [] }))
            .toEqual({ start: ['click'], stop: [], pause: ['click'], resume: [] });
        // a marquee: plays on load, pauses while the pointer is over it — derived, it resumes when the pointer leaves
        expect(resolveTriggers({ start: 'load', pause: 'hoverIn' }).resume).toEqual(['hoverOut', 'load']);
        // named, a click resumes it instead (and `triggerIssues` notes the difference)
        expect(resolveTriggers({ start: 'load', pause: 'hoverIn', resume: 'click' }).resume).toEqual(['click']);
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

    it('click under both start and stop is the start/stop toggle (what `togglePlay` spelled until 1.11) — it resumes nothing', () => {
        expect(resolveTriggers({ start: 'click', stop: 'click' })).toEqual({ start: ['click'], stop: ['click'], pause: [], resume: [] });
        // the play/pause toggle is the other pair — start and pause on the same event
        expect(resolveTriggers({ start: 'click', pause: 'click' })).toEqual({ start: ['click'], stop: [], pause: ['click'], resume: ['click'] });
    });

    it('a click under both start and stop STOPS while paused — a start event that also stops does not resume', () => {
        const t = resolveTriggers({ start: ['load', 'click'], stop: 'click', pause: 'hoverOut' });
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
        expect(allowedTriggerEvents(PxTriggerList.resume)).toEqual(['hoverIn', 'hoverOut', 'click']);
        const odd: PxActionTriggers = { start: ['hoverOut', 'click'], stop: 'load', pause: 'load' };
        expect(resolveTriggers(odd)).toEqual({ start: ['click'], stop: [], pause: [], resume: ['click'] });
        expect(triggerIssues(odd)).toEqual([
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.start, event: 'hoverOut' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.stop, event: 'load' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.pause, event: 'load' },
        ]);
    });

    it('a named resume list is honoured; where it differs from the derivation the players are told — an extra event, a pause left without its resume', () => {
        expect(triggerIssues({ start: 'load', pause: 'hoverIn', resume: 'click' })).toEqual([
            { kind: PxTriggerIssueKind.resumeExtra, list: PxTriggerList.resume, event: 'click' },
            { kind: PxTriggerIssueKind.resumeMissing, list: PxTriggerList.resume, event: 'hoverOut' },
        ]);
        // the derivation's own answer, spelled out, says nothing (`load` is derived but no resume event — not missed)
        expect(triggerIssues({ start: 'load', pause: 'hoverIn', resume: 'hoverOut' })).toEqual([]);
        expect(triggerIssues(undefined)).toEqual([]);
    });

    it('the document repair drops a disallowed event — never the whole list, never a default in its place', () => {
        expect(PxActionTriggersSchema.castOrFix({ start: ['hoverOut', 'click'] }).value).toEqual({ start: ['click'] });
        // a lone disallowed event drops the list — absent inside a present block = not listed
        expect(PxActionTriggersSchema.castOrFix({ start: 'click', stop: 'load' }).value).toEqual({ start: 'click' });
        expect(PxActionTriggersSchema.castOrFix({ resume: 'load' }).value).toEqual({});
        const clean = PxActionTriggersSchema.castOrFix({ start: ['hoverIn', 'click'], pause: 'hoverOut' });
        expect(clean.value).toEqual({ start: ['hoverIn', 'click'], pause: 'hoverOut' });
        expect(clean.problems).toEqual([]);
        expect(PxActionTriggersSchema.castOrFix({ start: ['hoverOut', 'click'] }).problems.length).toBe(1);
    });

    it('the schema states the same allowed events — a document naming another fails strict validation', () => {
        expect(PxActionTriggersSchema.isValid({ start: 'click', stop: ['hoverOut', 'click'], pause: 'hoverIn' })).toBe(true);
        expect(PxActionTriggersSchema.isValid({ start: 'hoverOut' })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ stop: ['click', 'load'] })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ resume: 'load' })).toBe(false);
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
        expect(resolveGate(undefined)).toEqual({ outOfView: 'pause', inViewThreshold: 0.5, inViewDebounce: 150 });
        expect(resolveGate({ actions: { outOfView: { behavior: 'reset' } }, inViewThreshold: 0 })).toEqual({ outOfView: 'reset', inViewThreshold: 0, inViewDebounce: 150 });
    });

    it('the actions default from the one table, each field on its own', () => {
        expect(resolveActions(undefined)).toEqual({
            start: { behavior: 'continue' }, stop: { behavior: 'reset', completeIteration: false },
            finish: { behavior: 'hold' }, outOfView: { behavior: 'pause' },
        });
        expect(resolveActions({ stop: { completeIteration: true } }).stop).toEqual({ behavior: 'reset', completeIteration: true });
        expect(resolveActions({ start: { behavior: 'jumpToFinished' } }).start.behavior).toBe('jumpToFinished');
    });

    it("the schema states NO default for a list — absent inside a block means 'not listed'; the absent BLOCK is the resolver's rule", () => {
        expect(PxActionTriggersSchema.defaults).toEqual({});
        expect(resolveTriggers(undefined).start).toEqual([PX_PLAYBACK_DEFAULTS.start]);
    });

    it('the schema declares the same outOfView default the players apply — the one that makes `load` safe', () => {
        const outOfView = describeSchema(PxOutOfViewActionSchema);
        if (outOfView.kind !== 'shape') throw new Error('PxOutOfViewActionSchema is not an object schema');
        const transition = describeSchema(outOfView.shape.behavior);
        if (transition.kind !== 'optional') throw new Error('actions.outOfView.behavior is not optional');
        expect(transition.inner._default).toBe(PX_PLAYBACK_DEFAULTS.outOfViewBehavior);
        expect(PxOutOfViewActionSchema.defaults.behavior).toBe('pause');
        expect(PxActionsSchema.defaults).toEqual({});
        expect(PxTimeTimelineSchema.defaults.showWhenStopped).toBe('static');
    });
});
