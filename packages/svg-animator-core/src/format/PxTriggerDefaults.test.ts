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
import { allowedTriggerEvents, counterpartTriggerEvent, PxWhenFinished, derivedResume, PX_PLAYBACK_DEFAULTS, PxPlaybackState, PxTriggerAction, PxTriggerIssueKind, PxTriggerList, resolveActions, resolveGate, resolveTriggers, triggerActionFor, triggerEventList, triggerIssues, triggerListsEvent } from './PxAnimatorConstants';
import { PxActionsSchema, PxOutOfViewActionSchema, PxTimeTimelineSchema, PxActionTriggersSchema, type PxActionTriggers } from './PxAnimatorTypes';

/** The five playback lists of the resolved block — entry keys; a bare word's key is the word. Since 2026-11-15 the
 *  resolved view also carries `segments` and `specs` (the segment triggers, what each key listens for). */
function listsOf(triggers: PxActionTriggers | undefined) {
    const t = resolveTriggers(triggers);
    return { startPlayback: t.startPlayback, playPlayback: t.playPlayback, stopPlayback: t.stopPlayback, pausePlayback: t.pausePlayback, resumePlayback: t.resumePlayback };
}

/** The four pressed events (2026-11-15) — every list may name them. */
const PRESSED = ['pointerDown', 'pointerUp', 'keyDown', 'keyUp'];

describe('trigger defaults', () => {

    it('a missing triggers block and an EMPTY one are the same thing — nothing starts it, the manual document (1.17)', () => {
        expect(listsOf(undefined)).toEqual({ startPlayback: [], playPlayback: [], stopPlayback: [], pausePlayback: [], resumePlayback: [] });
        expect(listsOf({})).toEqual({ startPlayback: [], playPlayback: [], stopPlayback: [], pausePlayback: [], resumePlayback: [] });
        expect(listsOf({ 'timeline.start': 'load' })).toEqual({ startPlayback: ['load'], playPlayback: [], stopPlayback: [], pausePlayback: [], resumePlayback: ['load'] });
        // no segment actions: no segment triggers; a bare word is heard on the whole picture
        expect(resolveTriggers({ 'timeline.start': 'load' }).segments).toEqual([]);
        expect(resolveTriggers({ 'timeline.start': 'load' }).specs.get('load')).toEqual({ key: 'load', event: 'load' });
    });

    it('resume is derived when the file does not name it: the counterpart of each pause event plus the start events that do not stop; a named list is used as written', () => {
        expect(listsOf({ 'timeline.start': 'hoverIn', 'timeline.pause': 'hoverOut' }))
            .toEqual({ startPlayback: ['hoverIn'], playPlayback: [], stopPlayback: [], pausePlayback: ['hoverOut'], resumePlayback: ['hoverIn'] });
        // the file names the list: used as written — an empty list resumes on nothing (that pause waits for start or stop)
        expect(listsOf({ 'timeline.start': 'click', 'timeline.pause': 'click', 'timeline.resume': [] }))
            .toEqual({ startPlayback: ['click'], playPlayback: [], stopPlayback: [], pausePlayback: ['click'], resumePlayback: [] });
        // a marquee: plays on load, pauses while the pointer is over it — derived, it resumes when the pointer leaves
        expect(listsOf({ 'timeline.start': 'load', 'timeline.pause': 'hoverIn' }).resumePlayback).toEqual(['hoverOut', 'load']);
        // named, a click resumes it instead (and `triggerIssues` notes the difference)
        expect(listsOf({ 'timeline.start': 'load', 'timeline.pause': 'hoverIn', 'timeline.resume': 'click' }).resumePlayback).toEqual(['click']);
        expect(counterpartTriggerEvent('hoverIn')).toBe('hoverOut');
        expect(counterpartTriggerEvent('load')).toBeUndefined();
        expect(derivedResume(['click'], ['click'], [])).toEqual([]);   // a start that also stops does not resume
    });

    it('keeps every list the document states — one event or several, always read as a list', () => {
        expect(triggerEventList(undefined)).toEqual([]);
        expect(triggerEventList('click')).toEqual(['click']);
        expect(triggerEventList(['hoverIn', 'click'])).toEqual(['hoverIn', 'click']);
        const stated: PxActionTriggers = { 'timeline.start': ['load', 'click'], 'timeline.stop': ['hoverOut'], 'timeline.pause': ['click'] };
        // the wire's dotted names in, the resolved view's plain fields out
        expect(listsOf(stated)).toEqual({ startPlayback: ['load', 'click'], playPlayback: [], stopPlayback: ['hoverOut'], pausePlayback: ['click'], resumePlayback: ['click', 'load'] });
    });

    it('click under both start and stop is the start/stop toggle (what `togglePlay` spelled until 1.11) — it resumes nothing', () => {
        expect(listsOf({ 'timeline.start': 'click', 'timeline.stop': 'click' })).toEqual({ startPlayback: ['click'], playPlayback: [], stopPlayback: ['click'], pausePlayback: [], resumePlayback: [] });
        // the play/pause toggle is the other pair — start and pause on the same event
        expect(listsOf({ 'timeline.start': 'click', 'timeline.pause': 'click' })).toEqual({ startPlayback: ['click'], playPlayback: [], stopPlayback: [], pausePlayback: ['click'], resumePlayback: ['click'] });
    });

    it('a click under both start and stop STOPS while paused — a start event that also stops does not resume', () => {
        const t = resolveTriggers({ 'timeline.start': ['load', 'click'], 'timeline.stop': 'click', 'timeline.pause': 'hoverOut' });
        expect(t.resumePlayback).toEqual(['hoverIn', 'load']);
        expect(triggerActionFor(t, PxPlaybackState.off, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.startPlayback);
        expect(triggerActionFor(t, PxPlaybackState.playing, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.stopPlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.stopPlayback);
        // FINISHED: stop wins over start — a toggle undoes a finished one-shot rather than replaying it
        expect(triggerActionFor(t, PxPlaybackState.finished, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.stopPlayback);
        // …but once the picture went back (`whenFinished`), the same click plays it again (1.26)
        expect(triggerActionFor(t, PxPlaybackState.finished, 'click', PxWhenFinished.jumpToStart)).toBe(PxTriggerAction.startPlayback);
    });

    it('finished is its own state: stop acts on it (the lid plays back on hover out), start alone replays', () => {
        const lid = resolveTriggers({ 'timeline.start': 'hoverIn', 'timeline.stop': 'hoverOut' });
        expect(triggerActionFor(lid, PxPlaybackState.returning, 'hoverIn', PxWhenFinished.hold)).toBe(PxTriggerAction.startPlayback);   // from the start (1.26)
        expect(triggerActionFor(lid, PxPlaybackState.returning, 'hoverOut', PxWhenFinished.hold)).toBeUndefined();                  // nothing to stop
        expect(triggerActionFor(lid, PxPlaybackState.finished, 'hoverOut', PxWhenFinished.hold)).toBe(PxTriggerAction.stopPlayback);
        expect(triggerActionFor(lid, PxPlaybackState.finished, 'hoverIn', PxWhenFinished.hold)).toBe(PxTriggerAction.startPlayback);
        const replay = resolveTriggers({ 'timeline.start': 'click' });
        expect(triggerActionFor(replay, PxPlaybackState.finished, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.startPlayback);
        expect(triggerActionFor(replay, PxPlaybackState.finished, 'hoverOut', PxWhenFinished.hold)).toBeUndefined();
    });

    it('a pause click pauses while playing and resumes while paused (its counterpart); nothing when stopped', () => {
        const t = resolveTriggers({ 'timeline.start': [], 'timeline.pause': 'click' });
        expect(triggerActionFor(t, PxPlaybackState.off, 'click', PxWhenFinished.hold)).toBeUndefined();
        expect(triggerActionFor(t, PxPlaybackState.playing, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.pausePlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.resumePlayback);
    });

    it('an event in both stop and pause is a collision the players report; start beside resume is the normal case', () => {
        expect(triggerIssues({ 'timeline.start': 'hoverIn', 'timeline.stop': 'hoverOut', 'timeline.pause': 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopPlayback, event: 'hoverOut', otherList: PxTriggerList.pausePlayback }]);
        expect(triggerIssues({ 'timeline.start': 'click', 'timeline.pause': 'click' })).toEqual([]);
        // the Editor's toggle (a click that starts and stops) is no collision, nor the hover pair
        expect(triggerIssues({ 'timeline.start': 'click', 'timeline.stop': 'click' })).toEqual([]);
        expect(triggerIssues({ 'timeline.start': 'hoverIn', 'timeline.stop': 'hoverOut' })).toEqual([]);
    });

    it('stop on a pause\'s counterpart is a collision too — paused, the resume wins', () => {
        expect(triggerIssues({ 'timeline.start': 'load', 'timeline.pause': 'hoverIn', 'timeline.stop': 'hoverOut' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.stopPlayback, event: 'hoverOut', otherList: PxTriggerList.resumePlayback }]);
        const t = resolveTriggers({ 'timeline.start': 'load', 'timeline.pause': 'hoverIn', 'timeline.stop': 'hoverOut' });
        expect(triggerActionFor(t, PxPlaybackState.paused, 'hoverOut', PxWhenFinished.hold)).toBe(PxTriggerAction.resumePlayback);
    });

    it('each list names only the events that make sense; others are dropped and reported', () => {
        expect(allowedTriggerEvents(PxTriggerList.startPlayback)).toEqual(['load', 'hoverIn', 'click', ...PRESSED]);
        expect(allowedTriggerEvents(PxTriggerList.stopPlayback)).toEqual(['hoverOut', 'click', ...PRESSED]);
        expect(allowedTriggerEvents(PxTriggerList.pausePlayback)).toEqual(['hoverIn', 'hoverOut', 'click', ...PRESSED]);
        expect(allowedTriggerEvents(PxTriggerList.resumePlayback)).toEqual(['hoverIn', 'hoverOut', 'click', ...PRESSED]);
        const odd: PxActionTriggers = { 'timeline.start': ['hoverOut', 'click'], 'timeline.stop': 'load', 'timeline.pause': 'load' };
        expect(listsOf(odd)).toEqual({ startPlayback: ['click'], playPlayback: [], stopPlayback: [], pausePlayback: [], resumePlayback: ['click'] });
        expect(triggerIssues(odd)).toEqual([
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.startPlayback, event: 'hoverOut' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.stopPlayback, event: 'load' },
            { kind: PxTriggerIssueKind.eventNotAllowed, list: PxTriggerList.pausePlayback, event: 'load' },
        ]);
    });

    it('a named resume list is honoured; where it differs from the derivation the players are told — an extra event, a pause left without its resume', () => {
        expect(triggerIssues({ 'timeline.start': 'load', 'timeline.pause': 'hoverIn', 'timeline.resume': 'click' })).toEqual([
            { kind: PxTriggerIssueKind.resumeExtra, list: PxTriggerList.resumePlayback, event: 'click' },
            { kind: PxTriggerIssueKind.resumeMissing, list: PxTriggerList.resumePlayback, event: 'hoverOut' },
        ]);
        // the derivation's own answer, spelled out, says nothing (`load` is derived but no resume event — not missed)
        expect(triggerIssues({ 'timeline.start': 'load', 'timeline.pause': 'hoverIn', 'timeline.resume': 'hoverOut' })).toEqual([]);
        expect(triggerIssues(undefined)).toEqual([]);
    });

    it('the document repair drops a disallowed event — never the whole list, never a default in its place', () => {
        expect(PxActionTriggersSchema.castOrFix({ 'timeline.start': ['hoverOut', 'click'] }).value).toEqual({ 'timeline.start': ['click'] });
        // a lone disallowed event drops the list — absent inside a present block = not listed
        expect(PxActionTriggersSchema.castOrFix({ 'timeline.start': 'click', 'timeline.stop': 'load' }).value).toEqual({ 'timeline.start': 'click' });
        expect(PxActionTriggersSchema.castOrFix({ 'timeline.resume': 'load' }).value).toEqual({});
        const clean = PxActionTriggersSchema.castOrFix({ 'timeline.start': ['hoverIn', 'click'], 'timeline.pause': 'hoverOut' });
        expect(clean.value).toEqual({ 'timeline.start': ['hoverIn', 'click'], 'timeline.pause': 'hoverOut' });
        expect(clean.problems).toEqual([]);
        expect(PxActionTriggersSchema.castOrFix({ 'timeline.start': ['hoverOut', 'click'] }).problems.length).toBe(1);
    });

    it('the schema states the same allowed events — a document naming another fails strict validation', () => {
        expect(PxActionTriggersSchema.isValid({ 'timeline.start': 'click', 'timeline.stop': ['hoverOut', 'click'], 'timeline.pause': 'hoverIn' })).toBe(true);
        expect(PxActionTriggersSchema.isValid({ 'timeline.start': 'hoverOut' })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ 'timeline.stop': ['click', 'load'] })).toBe(false);
        expect(PxActionTriggersSchema.isValid({ 'timeline.resume': 'load' })).toBe(false);
    });

    it('the state rule: the state picks the list an event is read from; pause and resume win over stop', () => {
        const t = resolveTriggers({ 'timeline.start': 'click', 'timeline.pause': 'click', 'timeline.stop': 'hoverOut' });
        expect(triggerActionFor(t, PxPlaybackState.off, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.startPlayback);
        expect(triggerActionFor(t, PxPlaybackState.playing, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.pausePlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.resumePlayback);     // resume = start
        expect(triggerActionFor(t, PxPlaybackState.off, 'hoverOut', PxWhenFinished.hold)).toBeUndefined();            // nothing to stop
        expect(triggerActionFor(t, PxPlaybackState.playing, 'hoverOut', PxWhenFinished.hold)).toBe(PxTriggerAction.stopPlayback);
        expect(triggerActionFor(t, PxPlaybackState.paused, 'hoverOut', PxWhenFinished.hold)).toBe(PxTriggerAction.stopPlayback);
        const conflict = resolveTriggers({ 'timeline.start': 'hoverIn', 'timeline.stop': 'hoverOut', 'timeline.pause': 'hoverOut' });
        expect(triggerActionFor(conflict, PxPlaybackState.playing, 'hoverOut', PxWhenFinished.hold)).toBe(PxTriggerAction.pausePlayback);
        expect(triggerListsEvent(t, 'hoverOut')).toBe(true);
        expect(triggerListsEvent(t, 'load')).toBe(false);
    });

    it('1.26: a start event restarts in every state it is read in; a play event starts or carries on', () => {
        const start = resolveTriggers({ 'timeline.start': 'hoverIn' });
        expect(triggerActionFor(start, PxPlaybackState.playing, 'hoverIn', PxWhenFinished.hold)).toBe(PxTriggerAction.startPlayback);
        expect(triggerActionFor(start, PxPlaybackState.paused, 'hoverIn', PxWhenFinished.hold)).toBe(PxTriggerAction.resumePlayback);   // derived resume
        const play = resolveTriggers({ 'timeline.play': 'click' });
        expect(triggerActionFor(play, PxPlaybackState.off, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.playPlayback);
        expect(triggerActionFor(play, PxPlaybackState.playing, 'click', PxWhenFinished.hold)).toBeUndefined();          // nothing to carry on
        expect(triggerActionFor(play, PxPlaybackState.paused, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.playPlayback);
        expect(triggerActionFor(play, PxPlaybackState.returning, 'click', PxWhenFinished.hold)).toBe(PxTriggerAction.playPlayback);
        expect(triggerActionFor(play, PxPlaybackState.finished, 'click', PxWhenFinished.animateToStart)).toBe(PxTriggerAction.playPlayback);
        // start and play on one event: a collision, the start wins from rest
        expect(triggerIssues({ 'timeline.start': 'click', 'timeline.play': 'click' }))
            .toEqual([{ kind: PxTriggerIssueKind.collision, list: PxTriggerList.startPlayback, event: 'click', otherList: PxTriggerList.playPlayback }]);
        expect(allowedTriggerEvents(PxTriggerList.playPlayback)).toEqual(['load', 'hoverIn', 'click', ...PRESSED]);
    });

    it('the gate defaults from the one table, read off the runtime view', () => {
        expect(resolveGate(undefined)).toEqual({ outOfView: 'pause', inViewThreshold: 0.5, inViewDebounce: 150 });
        expect(resolveGate({ actions: { outOfView: { behavior: 'stop' } }, inViewThreshold: 0 })).toEqual({ outOfView: 'stop', inViewThreshold: 0, inViewDebounce: 150 });
    });

    it('the actions default from the one table, each field on its own', () => {
        expect(resolveActions(undefined)).toEqual({
            stopPlayback: { behavior: 'jumpToStart' }, outOfView: { behavior: 'pause' }, whenFinished: 'hold',
        });
        expect(resolveActions({ 'timeline.stop': 'animateToEnd' }).stopPlayback).toEqual({ behavior: 'animateToEnd' });
        expect(resolveActions({ 'timeline.stop': { behavior: 'animateToEndAndBack' } }).stopPlayback.behavior).toBe('animateToEndAndBack');
        expect(resolveActions(undefined, 'animateToStart').whenFinished).toBe('animateToStart');
    });

    it("the schema states NO default for a list — absent inside a block means 'not listed', and so does the absent BLOCK", () => {
        expect(PxActionTriggersSchema.defaults).toEqual({});
        expect(listsOf(undefined).startPlayback).toEqual([]);
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
