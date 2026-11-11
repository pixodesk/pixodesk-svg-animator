/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The triggers' lists are normalised by ONE helper (`resolveTriggers`) that every player calls; what an
// ABSENT block means (`PX_PLAYBACK_DEFAULTS.startRun`) and what the actions and gate default to are stated once —
// so a document with no triggers means the same thing on the web and on React Native
// (SCHEMA-NAMING-REVIEW §2.1; dev-docs/plans/playback-layers.md).
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../schema/PxSchema';
import { allowedTriggerEvents, counterpartTriggerEvent, derivedResume, PX_PLAYBACK_DEFAULTS, PxRunState, PxTriggerAction, PxTriggerIssueKind, PxTriggerList, resolveActions, resolveGate, resolveTriggers, triggerActionFor, triggerEventList, triggerIssues, triggerListsEvent } from './PxAnimatorConstants';
import { PxActionsSchema, PxOutOfViewActionSchema, PxTimeTimelineSchema, PxActionTriggersSchema, type PxActionTriggers } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing triggers block and an EMPTY one are the same thing — nothing starts it, the manual document (1.17)', () => {
        expect(resolveTriggers(undefined)).toEqual({ startRun: [], stopRun: [], pauseRun: [], resumeRun: [] });
        expect(resolveTriggers({})).toEqual({ startRun: [], stopRun: [], pauseRun: [], resumeRun: [] });
        expect(resolveTriggers({ startRun: 'load' })).toEqual({ startRun: ['load'], stopRun: [], pauseRun: [], resumeRun: ['load'] });
    });

    it('resume is derived when the file does not name it: the counterpart of each pause event plus the start events that do not stop; a named list is used as written', () => {
        expect(resolveTriggers({ startRun: 'hoverIn', pauseRun: 'hoverOut' }))
            .toEqual({ startRun: ['hoverIn'], stopRun: [], pauseRun: ['hoverOut'], resumeRun: ['hoverIn'] });
        // the file names the list: used as written — an empty list resumes on nothing (that pause waits for start or stop)
        expect(resolveTriggers({ startRun: 'click', pauseRun: 'click', resumeRun: [] }))
            .toEqual({ startRun: ['click'], stopRun: [], pauseRun: ['click'], resumeRun: [] });
        // a marquee: plays on load, pauses while the pointer is over it — derived, it resumes when the pointer leaves
        expect(resolveTriggers({ startRun: 'load', pauseRun: 'hoverIn' }).resumeRun).toEqual(['hoverOut', 'load']);
        // named, a click resumes it instead (and `triggerIssues` notes the difference)
        expect(resolveTriggers({ startRun: 'load', pauseRun: 'hoverIn', resumeRun: 'click' }).resumeRun).toEqual(['click']);
        expect(counterpartTriggerEvent('hoverIn')).toBe('hoverOut');
        expect(counterpartTriggerEvent('load')).toBeUndefined();
        expect(derivedResume(['click'], ['click'], [])).toEqual([]);   // a start that also stops does not resume
    });

    it('keeps every list the document states — one event or several, always read as a list', () => {
        expect(triggerEventList(undefined)).toEqual([]);
        expect(triggerEventList('click')).toEqual(['click']);
        expect(triggerEventList(['hoverIn', 'click'])).toEqual(['hoverIn', 'click']);
        const stated: PxActionTriggers = { startRun: ['load', 'click'], stopRun: ['hoverOut'], pauseRun: ['click'] };
        expect(resolveTriggers(stated)).toEqual({ ...stated, resumeRun: ['click', 'load'] });
    });

    it('click under both start and stop is the start/stop toggle (what `togglePlay` spelled until 1.11) — it resumes nothing', () => {
        expect(resolveTriggers({ startRun: 'click', stopRun: 'click' })).toEqual({ startRun: ['click'], stopRun: ['click'], pauseRun: [], resumeRun: [] });
        // the play/pause toggle is the other pair — start and pause on the same event
        expect(resolveTriggers({ startRun: 'click', pauseRun: 'click' })).toEqual({ startRun: ['click'], stopRun: [], pauseRun: ['click'], resumeRun: ['click'] });
    });

    it('a click under both start and stop STOPS while paused — a start event that also stops does not resume', () => {
        const t = resolveTriggers({ startRun: ['load', 'click'], stopRun: 'click', pauseRun: 'hoverOut' });
        expect(t.resumeRun).toEqual(['hoverIn', 'load']);
        expect(triggerActionFor(t, PxRunState.off, 'click')).toBe(PxTriggerAction.startRun);
        expect(triggerActionFor(t, PxRunState.playing, 'click')).toBe(PxTriggerAction.stopRun);
        expect(triggerActionFor(t, PxRunState.paused, 'click')).toBe(PxTriggerAction.stopRun);
        // FINISHED: stop wins over start — a toggle undoes a finished one-shot rather than replaying it
        expect(triggerActionFor(t, PxRunState.finished, 'click')).toBe(PxTriggerAction.stopRun);
    });

    it('finished is its own state: stop acts on it (the lid plays back on hover out), start alone replays', () => {
        const lid = resolveTriggers({ startRun: 'hoverIn', stopRun: 'hoverOut' });
        expect(triggerActionFor(lid, PxRunState.returning, 'hoverIn')).toBe(PxTriggerAction.startRun);   // turns the return around
        expect(triggerActionFor(lid, PxRunState.returning, 'hoverOut')).toBeUndefined();                  // nothing to stop
        expect(triggerActionFor(lid, PxRunState.finished, 'hoverOut')).toBe(PxTriggerAction.stopRun);
        expect(triggerActionFor(lid, PxRunState.finished, 'hoverIn')).toBe(PxTriggerAction.startRun);
        const replay = resolveTriggers({ startRun: 'click' });
        expect(triggerActionFor(replay, PxRunState.finished, 'click')).toBe(PxTriggerAction.startRun);
        expect(triggerActionFor(replay, PxRunState.finished, 'hoverOut')).toBeUndefined();
    });

    it('a pause click pauses while playing and resumes while paused (its counterpart); nothing when stopped', () => {
        const t = resolveTriggers({ startRun: [], pauseRun: 'click' });
        expect(triggerActionFor(t, PxRunState.off, 'click')).toBeUndefined();
        expect(triggerActionFor(t, PxRunState.playing, 'click')).toBe(PxTriggerAction.pauseRun);
        expect(triggerActionFor(t, PxRunState.paused, 'click')).toBe(PxTriggerAction.resumeRun);
    });

    it('an event in both stop and pause is a collision the players report; start beside resume is the normal case', () => {
        expect(triggerIssues({ startRun: 'hoverIn', stopRun: 'hoverOut', pauseRun: 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopRun, event: 'hoverOut', otherList: PxTriggerList.pauseRun }]);
        expect(triggerIssues({ startRun: 'click', pauseRun: 'click' })).toEqual([]);
        // the Editor's toggle (a click that starts and stops) is no collision, nor the hover pair
        expect(triggerIssues({ startRun: 'click', stopRun: 'click' })).toEqual([]);
        expect(triggerIssues({ startRun: 'hoverIn', stopRun: 'hoverOut' })).toEqual([]);
    });

    it('stop on a pause\'s counterpart is a collision too — paused, the resume wins', () => {
        expect(triggerIssues({ startRun: 'load', pauseRun: 'hoverIn', stopRun: 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopRun, event: 'hoverOut', otherList: PxTriggerList.resumeRun }]);
        const t = resolveTriggers({ startRun: 'load', pauseRun: 'hoverIn', stopRun: 'hoverOut' });
        expect(triggerActionFor(t, PxRunState.paused, 'hoverOut')).toBe(PxTriggerAction.resumeRun);
    });

    it('each list names only the events that make sense; others are dropped and reported', () => {
        expect(allowedTriggerEvents(PxTriggerList.startRun)).toEqual(['load', 'hoverIn', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.stopRun)).toEqual(['hoverOut', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.pauseRun)).toEqual(['hoverIn', 'hoverOut', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.resumeRun)).toEqual(['hoverIn', 'hoverOut', 'click']);
        const odd: PxActionTriggers = { startRun: ['hoverOut', 'click'], stopRun: 'load', pauseRun: 'load' };
        expect(resolveTriggers(odd)).toEqual({ startRun: ['click'], stopRun: [], pauseRun: [], resumeRun: ['click'] });
        expect(triggerIssues(odd)).toEqual([
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.startRun, event: 'hoverOut' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.stopRun, event: 'load' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.pauseRun, event: 'load' },
        ]);
    });

    it('a named resume list is honoured; where it differs from the derivation the players are told — an extra event, a pause left without its resume', () => {
        expect(triggerIssues({ startRun: 'load', pauseRun: 'hoverIn', resumeRun: 'click' })).toEqual([
            { kind: PxTriggerIssueKind.resumeExtra, list: PxTriggerList.resumeRun, event: 'click' },
            { kind: PxTriggerIssueKind.resumeMissing, list: PxTriggerList.resumeRun, event: 'hoverOut' },
        ]);
        // the derivation's own answer, spelled out, says nothing (`load` is derived but no resume event — not missed)
        expect(triggerIssues({ startRun: 'load', pauseRun: 'hoverIn', resumeRun: 'hoverOut' })).toEqual([]);
        expect(triggerIssues(undefined)).toEqual([]);
    });

    it('the document repair drops a disallowed event — never the whole list, never a default in its place', () => {
        expect(PxActionTriggersSchema.castOrFix({ startRun: ['hoverOut', 'click'] }).value).toEqual({ startRun: ['click'] });
        // a lone disallowed event drops the list — absent inside a present block = not listed
        expect(PxActionTriggersSchema.castOrFix({ startRun: 'click', stopRun: 'load' }).value).toEqual({ startRun: 'click' });
        expect(PxActionTriggersSchema.castOrFix({ resumeRun: 'load' }).value).toEqual({});
        const clean = PxActionTriggersSchema.castOrFix({ startRun: ['hoverIn', 'click'], pauseRun: 'hoverOut' });
        expect(clean.value).toEqual({ startRun: ['hoverIn', 'click'], pauseRun: 'hoverOut' });
        expect(clean.problems).toEqual([]);
        expect(PxActionTriggersSchema.castOrFix({ startRun: ['hoverOut', 'click'] }).problems.length).toBe(1);
    });

    it('the schema states the same allowed events — a document naming another fails strict validation', () => {
        expect(PxActionTriggersSchema.isValid({ startRun: 'click', stopRun: ['hoverOut', 'click'], pauseRun: 'hoverIn' })).toBe(true);
        expect(PxActionTriggersSchema.isValid({ startRun: 'hoverOut' })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ stopRun: ['click', 'load'] })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ resumeRun: 'load' })).toBe(false);
    });

    it('the state rule: the state picks the list an event is read from; pause and resume win over stop', () => {
        const t = resolveTriggers({ startRun: 'click', pauseRun: 'click', stopRun: 'hoverOut' });
        expect(triggerActionFor(t, PxRunState.off, 'click')).toBe(PxTriggerAction.startRun);
        expect(triggerActionFor(t, PxRunState.playing, 'click')).toBe(PxTriggerAction.pauseRun);
        expect(triggerActionFor(t, PxRunState.paused, 'click')).toBe(PxTriggerAction.resumeRun);     // resume = start
        expect(triggerActionFor(t, PxRunState.off, 'hoverOut')).toBeUndefined();            // nothing to stop
        expect(triggerActionFor(t, PxRunState.playing, 'hoverOut')).toBe(PxTriggerAction.stopRun);
        expect(triggerActionFor(t, PxRunState.paused, 'hoverOut')).toBe(PxTriggerAction.stopRun);
        const conflict = resolveTriggers({ startRun: 'hoverIn', stopRun: 'hoverOut', pauseRun: 'hoverOut' });
        expect(triggerActionFor(conflict, PxRunState.playing, 'hoverOut')).toBe(PxTriggerAction.pauseRun);
        expect(triggerListsEvent(t, 'hoverOut')).toBe(true);
        expect(triggerListsEvent(t, 'load')).toBe(false);
    });

    it('the gate defaults from the one table, read off the runtime view', () => {
        expect(resolveGate(undefined)).toEqual({ outOfView: 'pause', inViewThreshold: 0.5, inViewDebounce: 150 });
        expect(resolveGate({ actions: { outOfView: { behavior: 'jumpToStart' } }, inViewThreshold: 0 })).toEqual({ outOfView: 'jumpToStart', inViewThreshold: 0, inViewDebounce: 150 });
    });

    it('the actions default from the one table, each field on its own', () => {
        expect(resolveActions(undefined)).toEqual({
            startRun: { behavior: 'continue' }, stopRun: { behavior: 'jumpToStart' },
            outOfView: { behavior: 'pause' }, atEnd: 'hold',
        });
        expect(resolveActions({ stopRun: 'animateToEnd' }).stopRun).toEqual({ behavior: 'animateToEnd' });
        expect(resolveActions({ startRun: { behavior: 'jumpToEnd' } }).startRun.behavior).toBe('jumpToEnd');
        expect(resolveActions(undefined, 'animateToStart').atEnd).toBe('animateToStart');
    });

    it("the schema states NO default for a list — absent inside a block means 'not listed', and so does the absent BLOCK", () => {
        expect(PxActionTriggersSchema.defaults).toEqual({});
        expect(resolveTriggers(undefined).startRun).toEqual([]);
    });

    it('the schema declares the same outOfView default the players apply — the one that makes `load` safe', () => {
        const outOfView = describeSchema(PxOutOfViewActionSchema);
        if (outOfView.kind !== 'shape') throw new Error('PxOutOfViewActionSchema is not an object schema');
        const transition = describeSchema(outOfView.shape.behavior);
        if (transition.kind !== 'optional') throw new Error('actions.outOfView.behavior is not optional');
        expect(transition.inner._default).toBe(PX_PLAYBACK_DEFAULTS.outOfViewBehavior);
        expect(PxOutOfViewActionSchema.defaults.behavior).toBe('pause');
        expect(PxActionsSchema.defaults).toEqual({});
        expect(PxTimeTimelineSchema.defaults.whenIdle).toBe('static');
    });
});
