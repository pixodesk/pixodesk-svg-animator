/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The triggers' lists are normalised by ONE helper (`resolveTriggers`) that every player calls; what an
// ABSENT block means (`PX_PLAYBACK_DEFAULTS.startPlayback`) and what the actions and gate default to are stated once —
// so a document with no triggers means the same thing on the web and on React Native
// (SCHEMA-NAMING-REVIEW §2.1; dev-docs/plans/playback-layers.md).
import { describe, expect, it } from 'vitest';
import { describeSchema } from '../schema/PxSchema';
import { allowedTriggerEvents, counterpartTriggerEvent, derivedResume, PX_PLAYBACK_DEFAULTS, PxPlaybackState, PxTriggerAction, PxTriggerIssueKind, PxTriggerList, resolveActions, resolveGate, resolveTriggers, triggerActionFor, triggerEventList, triggerIssues, triggerListsEvent } from './PxAnimatorConstants';
import { PxActionsSchema, PxOutOfViewActionSchema, PxTimeTimelineSchema, PxActionTriggersSchema, type PxActionTriggers } from './PxAnimatorTypes';

describe('trigger defaults', () => {

    it('a missing triggers block and an EMPTY one are the same thing — nothing starts it, the manual document (1.17)', () => {
        expect(resolveTriggers(undefined)).toEqual({ startPlayback: [], stopPlayback: [], pausePlayback: [], resumePlayback: [] });
        expect(resolveTriggers({})).toEqual({ startPlayback: [], stopPlayback: [], pausePlayback: [], resumePlayback: [] });
        expect(resolveTriggers({ 'playback.start': 'load' })).toEqual({ startPlayback: ['load'], stopPlayback: [], pausePlayback: [], resumePlayback: ['load'] });
    });

    it('resume is derived when the file does not name it: the counterpart of each pause event plus the start events that do not stop; a named list is used as written', () => {
        expect(resolveTriggers({ 'playback.start': 'hoverIn', 'playback.pause': 'hoverOut' }))
            .toEqual({ startPlayback: ['hoverIn'], stopPlayback: [], pausePlayback: ['hoverOut'], resumePlayback: ['hoverIn'] });
        // the file names the list: used as written — an empty list resumes on nothing (that pause waits for start or stop)
        expect(resolveTriggers({ 'playback.start': 'click', 'playback.pause': 'click', 'playback.resume': [] }))
            .toEqual({ startPlayback: ['click'], stopPlayback: [], pausePlayback: ['click'], resumePlayback: [] });
        // a marquee: plays on load, pauses while the pointer is over it — derived, it resumes when the pointer leaves
        expect(resolveTriggers({ 'playback.start': 'load', 'playback.pause': 'hoverIn' }).resumePlayback).toEqual(['hoverOut', 'load']);
        // named, a click resumes it instead (and `triggerIssues` notes the difference)
        expect(resolveTriggers({ 'playback.start': 'load', 'playback.pause': 'hoverIn', 'playback.resume': 'click' }).resumePlayback).toEqual(['click']);
        expect(counterpartTriggerEvent('hoverIn')).toBe('hoverOut');
        expect(counterpartTriggerEvent('load')).toBeUndefined();
        expect(derivedResume(['click'], ['click'], [])).toEqual([]);   // a start that also stops does not resume
    });

    it('keeps every list the document states — one event or several, always read as a list', () => {
        expect(triggerEventList(undefined)).toEqual([]);
        expect(triggerEventList('click')).toEqual(['click']);
        expect(triggerEventList(['hoverIn', 'click'])).toEqual(['hoverIn', 'click']);
        const stated: PxActionTriggers = { 'playback.start': ['load', 'click'], 'playback.stop': ['hoverOut'], 'playback.pause': ['click'] };
        // the wire's dotted names in, the resolved view's plain fields out
        expect(resolveTriggers(stated)).toEqual({ startPlayback: ['load', 'click'], stopPlayback: ['hoverOut'], pausePlayback: ['click'], resumePlayback: ['click', 'load'] });
    });

    it('click under both start and stop is the start/stop toggle (what `togglePlay` spelled until 1.11) — it resumes nothing', () => {
        expect(resolveTriggers({ 'playback.start': 'click', 'playback.stop': 'click' })).toEqual({ startPlayback: ['click'], stopPlayback: ['click'], pausePlayback: [], resumePlayback: [] });
        // the play/pause toggle is the other pair — start and pause on the same event
        expect(resolveTriggers({ 'playback.start': 'click', 'playback.pause': 'click' })).toEqual({ startPlayback: ['click'], stopPlayback: [], pausePlayback: ['click'], resumePlayback: ['click'] });
    });

    it('a click under both start and stop STOPS while paused — a start event that also stops does not resume', () => {
        const t = resolveTriggers({ 'playback.start': ['load', 'click'], 'playback.stop': 'click', 'playback.pause': 'hoverOut' });
        expect(t.resumePlayback).toEqual(['hoverIn', 'load']);
        expect(triggerActionFor(t, PxPlaybackState.off, 'click')).toBe(PxTriggerAction.startPlayback);
        expect(triggerActionFor(t, PxPlaybackState.playing, 'click')).toBe(PxTriggerAction.stopPlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'click')).toBe(PxTriggerAction.stopPlayback);
        // FINISHED: stop wins over start — a toggle undoes a finished one-shot rather than replaying it
        expect(triggerActionFor(t, PxPlaybackState.finished, 'click')).toBe(PxTriggerAction.stopPlayback);
    });

    it('finished is its own state: stop acts on it (the lid plays back on hover out), start alone replays', () => {
        const lid = resolveTriggers({ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut' });
        expect(triggerActionFor(lid, PxPlaybackState.returning, 'hoverIn')).toBe(PxTriggerAction.startPlayback);   // turns the return around
        expect(triggerActionFor(lid, PxPlaybackState.returning, 'hoverOut')).toBeUndefined();                  // nothing to stop
        expect(triggerActionFor(lid, PxPlaybackState.finished, 'hoverOut')).toBe(PxTriggerAction.stopPlayback);
        expect(triggerActionFor(lid, PxPlaybackState.finished, 'hoverIn')).toBe(PxTriggerAction.startPlayback);
        const replay = resolveTriggers({ 'playback.start': 'click' });
        expect(triggerActionFor(replay, PxPlaybackState.finished, 'click')).toBe(PxTriggerAction.startPlayback);
        expect(triggerActionFor(replay, PxPlaybackState.finished, 'hoverOut')).toBeUndefined();
    });

    it('a pause click pauses while playing and resumes while paused (its counterpart); nothing when stopped', () => {
        const t = resolveTriggers({ 'playback.start': [], 'playback.pause': 'click' });
        expect(triggerActionFor(t, PxPlaybackState.off, 'click')).toBeUndefined();
        expect(triggerActionFor(t, PxPlaybackState.playing, 'click')).toBe(PxTriggerAction.pausePlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'click')).toBe(PxTriggerAction.resumePlayback);
    });

    it('an event in both stop and pause is a collision the players report; start beside resume is the normal case', () => {
        expect(triggerIssues({ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut', 'playback.pause': 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopPlayback, event: 'hoverOut', otherList: PxTriggerList.pausePlayback }]);
        expect(triggerIssues({ 'playback.start': 'click', 'playback.pause': 'click' })).toEqual([]);
        // the Editor's toggle (a click that starts and stops) is no collision, nor the hover pair
        expect(triggerIssues({ 'playback.start': 'click', 'playback.stop': 'click' })).toEqual([]);
        expect(triggerIssues({ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut' })).toEqual([]);
    });

    it('stop on a pause\'s counterpart is a collision too — paused, the resume wins', () => {
        expect(triggerIssues({ 'playback.start': 'load', 'playback.pause': 'hoverIn', 'playback.stop': 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopPlayback, event: 'hoverOut', otherList: PxTriggerList.resumePlayback }]);
        const t = resolveTriggers({ 'playback.start': 'load', 'playback.pause': 'hoverIn', 'playback.stop': 'hoverOut' });
        expect(triggerActionFor(t, PxPlaybackState.paused, 'hoverOut')).toBe(PxTriggerAction.resumePlayback);
    });

    it('each list names only the events that make sense; others are dropped and reported', () => {
        expect(allowedTriggerEvents(PxTriggerList.startPlayback)).toEqual(['load', 'hoverIn', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.stopPlayback)).toEqual(['hoverOut', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.pausePlayback)).toEqual(['hoverIn', 'hoverOut', 'click']);
        expect(allowedTriggerEvents(PxTriggerList.resumePlayback)).toEqual(['hoverIn', 'hoverOut', 'click']);
        const odd: PxActionTriggers = { 'playback.start': ['hoverOut', 'click'], 'playback.stop': 'load', 'playback.pause': 'load' };
        expect(resolveTriggers(odd)).toEqual({ startPlayback: ['click'], stopPlayback: [], pausePlayback: [], resumePlayback: ['click'] });
        expect(triggerIssues(odd)).toEqual([
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.startPlayback, event: 'hoverOut' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.stopPlayback, event: 'load' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.pausePlayback, event: 'load' },
        ]);
    });

    it('a named resume list is honoured; where it differs from the derivation the players are told — an extra event, a pause left without its resume', () => {
        expect(triggerIssues({ 'playback.start': 'load', 'playback.pause': 'hoverIn', 'playback.resume': 'click' })).toEqual([
            { kind: PxTriggerIssueKind.resumeExtra, list: PxTriggerList.resumePlayback, event: 'click' },
            { kind: PxTriggerIssueKind.resumeMissing, list: PxTriggerList.resumePlayback, event: 'hoverOut' },
        ]);
        // the derivation's own answer, spelled out, says nothing (`load` is derived but no resume event — not missed)
        expect(triggerIssues({ 'playback.start': 'load', 'playback.pause': 'hoverIn', 'playback.resume': 'hoverOut' })).toEqual([]);
        expect(triggerIssues(undefined)).toEqual([]);
    });

    it('the document repair drops a disallowed event — never the whole list, never a default in its place', () => {
        expect(PxActionTriggersSchema.castOrFix({ 'playback.start': ['hoverOut', 'click'] }).value).toEqual({ 'playback.start': ['click'] });
        // a lone disallowed event drops the list — absent inside a present block = not listed
        expect(PxActionTriggersSchema.castOrFix({ 'playback.start': 'click', 'playback.stop': 'load' }).value).toEqual({ 'playback.start': 'click' });
        expect(PxActionTriggersSchema.castOrFix({ 'playback.resume': 'load' }).value).toEqual({});
        const clean = PxActionTriggersSchema.castOrFix({ 'playback.start': ['hoverIn', 'click'], 'playback.pause': 'hoverOut' });
        expect(clean.value).toEqual({ 'playback.start': ['hoverIn', 'click'], 'playback.pause': 'hoverOut' });
        expect(clean.problems).toEqual([]);
        expect(PxActionTriggersSchema.castOrFix({ 'playback.start': ['hoverOut', 'click'] }).problems.length).toBe(1);
    });

    it('the schema states the same allowed events — a document naming another fails strict validation', () => {
        expect(PxActionTriggersSchema.isValid({ 'playback.start': 'click', 'playback.stop': ['hoverOut', 'click'], 'playback.pause': 'hoverIn' })).toBe(true);
        expect(PxActionTriggersSchema.isValid({ 'playback.start': 'hoverOut' })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ 'playback.stop': ['click', 'load'] })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ 'playback.resume': 'load' })).toBe(false);
    });

    it('the state rule: the state picks the list an event is read from; pause and resume win over stop', () => {
        const t = resolveTriggers({ 'playback.start': 'click', 'playback.pause': 'click', 'playback.stop': 'hoverOut' });
        expect(triggerActionFor(t, PxPlaybackState.off, 'click')).toBe(PxTriggerAction.startPlayback);
        expect(triggerActionFor(t, PxPlaybackState.playing, 'click')).toBe(PxTriggerAction.pausePlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'click')).toBe(PxTriggerAction.resumePlayback);     // resume = start
        expect(triggerActionFor(t, PxPlaybackState.off, 'hoverOut')).toBeUndefined();            // nothing to stop
        expect(triggerActionFor(t, PxPlaybackState.playing, 'hoverOut')).toBe(PxTriggerAction.stopPlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'hoverOut')).toBe(PxTriggerAction.stopPlayback);
        const conflict = resolveTriggers({ 'playback.start': 'hoverIn', 'playback.stop': 'hoverOut', 'playback.pause': 'hoverOut' });
        expect(triggerActionFor(conflict, PxPlaybackState.playing, 'hoverOut')).toBe(PxTriggerAction.pausePlayback);
        expect(triggerListsEvent(t, 'hoverOut')).toBe(true);
        expect(triggerListsEvent(t, 'load')).toBe(false);
    });

    it('the gate defaults from the one table, read off the runtime view', () => {
        expect(resolveGate(undefined)).toEqual({ outOfView: 'pause', inViewThreshold: 0.5, inViewDebounce: 150 });
        expect(resolveGate({ actions: { outOfView: { behavior: 'jumpToStart' } }, inViewThreshold: 0 })).toEqual({ outOfView: 'jumpToStart', inViewThreshold: 0, inViewDebounce: 150 });
    });

    it('the actions default from the one table, each field on its own', () => {
        expect(resolveActions(undefined)).toEqual({
            startPlayback: { behavior: 'continue' }, stopPlayback: { behavior: 'jumpToStart' },
            outOfView: { behavior: 'pause' }, atEnd: 'hold',
        });
        expect(resolveActions({ 'playback.stop': 'animateToEnd' }).stopPlayback).toEqual({ behavior: 'animateToEnd' });
        expect(resolveActions({ 'playback.start': { behavior: 'jumpToEnd' } }).startPlayback.behavior).toBe('jumpToEnd');
        expect(resolveActions(undefined, 'animateToStart').atEnd).toBe('animateToStart');
    });

    it("the schema states NO default for a list — absent inside a block means 'not listed', and so does the absent BLOCK", () => {
        expect(PxActionTriggersSchema.defaults).toEqual({});
        expect(resolveTriggers(undefined).startPlayback).toEqual([]);
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
