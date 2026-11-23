/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The 1.27 → 1.28 step: one scroll timeline in plain words. Each case is a row of the old → new table — `view` /
// `scroll` + `source` / `subject` → `follows`, a range point → a moment word (exact for every size) or the exact place
// it is for an element that fits the screen, `pin` → `holdOnScreen`, the axis words, `frameRate` gone.
// Below them: the rules the schema cannot say, checked by `validateDocument`.

import { describe, expect, it } from 'vitest';
import { convertWireDocument } from './PxWireVersion';
import { isRecord } from '../schema/PxSchema';
import { validateDocument, type PxDocument } from '../format/PxAnimatorTypes';
import { getAnimatorConfig } from '../format/PxAnimatorConstants';
import { scrollMomentU } from '../playback/PxScrollMath';
import { untyped } from '../effects/effectTestKit';

/** A 1.27 document with this timeline, stamped so the step is due. */
function doc127(timeline: Record<string, unknown>): Record<string, unknown> {
    return { type: 'svg', animator: { version: '1.27.1', timeline }, children: [] };
}


/** A converted document's rules read back as the map by action the older steps spoke of (2026-11-20: the current
 *  spelling is a list of rules) — so these cases keep testing the older steps' words. A list is turned into
 *  `{ action: event | [events] }`; anything else is returned as it is. */
function asTriggerMap(triggers: unknown): unknown {
    if (!Array.isArray(triggers)) return triggers;
    const map: Record<string, unknown> = {};
    for (const rule of triggers) {
        if (!isRecord(rule) || typeof rule.action !== 'string') continue;
        const { action, ...rest } = rule;
        const entry = Object.keys(rest).length === 1 && typeof rest.event === 'string' ? rest.event : rest;
        const had = map[action];
        map[action] = had === undefined ? entry : Array.isArray(had) ? [...had, entry] : [had, entry];
    }
    return map;
}

/** The first timeline — `animator.timeline` before the 2026-11-20 amendment, `animator.timelines[0]` after it. */
function timelineRecordOf(animator: unknown): unknown {
    if (!isRecord(animator)) return undefined;
    return Array.isArray(animator.timelines) ? animator.timelines[0] : animator.timeline;
}

/** The converted document's first timeline. */
function converted(timeline: Record<string, unknown>): unknown {
    const doc = convertWireDocument(doc127(timeline)).doc;
    const animator = isRecord(doc) ? doc.animator : undefined;
    return timelineRecordOf(animator);
}

describe('1.27 → 1.28: what is followed', () => {
    it.each([
        [{ type: 'view' }, { type: 'scroll' }],
        [{ type: 'view', subject: 'parent' }, { type: 'scroll', follows: 'parentDomElement' }],
        [{ type: 'view', subject: '#chapter-2' }, { type: 'scroll', follows: 'pageDomElement', selector: '#chapter-2' }],
        [{ type: 'view', subject: 'scroller' }, { type: 'scroll' }],   // it never moved
        [{ type: 'scroll', source: 'root' }, { type: 'scroll', follows: 'pageScroll' }],
        [{ type: 'scroll' }, { type: 'scroll', follows: 'containerScroll' }],
        [{ type: 'scroll', source: 'nearest' }, { type: 'scroll', follows: 'containerScroll' }],
    ])('%j → %j', (old, expected) => {
        expect(converted(old)).toEqual(expected);
    });
});

describe('1.27 → 1.28: the range becomes two moments', () => {
    const range = (start: Record<string, unknown> | undefined, end: Record<string, unknown> | undefined) => ({ type: 'view', range: { start, end } });

    it.each([
        // the editor's cases: every one is two words, exact for every size
        ['Enter', range({ phase: 'entry', fraction: 0 }, { phase: 'entry', fraction: 1 }), { type: 'scroll', lastFrameWhen: 'fullyIn' }],
        ['Enter to center', range({ phase: 'entry', fraction: 0 }, { phase: 'cover', fraction: 0.5 }), { type: 'scroll', lastFrameWhen: 'centered' }],
        ['Late enter', range({ phase: 'entry', fraction: 0.5 }, { phase: 'cover', fraction: 0.5 }), { type: 'scroll', firstFrameWhen: 'halfIn', lastFrameWhen: 'centered' }],
        ['On-screen journey', range({ phase: 'contain', fraction: 0 }, { phase: 'contain', fraction: 1 }), { type: 'scroll', firstFrameWhen: 'fullyIn', lastFrameWhen: 'startsToLeave' }],
        ['Long enter', range({ phase: 'entry', fraction: 0 }, { phase: 'contain', fraction: 1 }), { type: 'scroll', lastFrameWhen: 'startsToLeave' }],
        ['Long exit', range({ phase: 'contain', fraction: 0 }, { phase: 'exit', fraction: 1 }), { type: 'scroll', firstFrameWhen: 'fullyIn' }],
        ['Exit', range({ phase: 'exit', fraction: 0 }, { phase: 'exit', fraction: 1 }), { type: 'scroll', firstFrameWhen: 'startsToLeave' }],
        ['Exit from center', range({ phase: 'cover', fraction: 0.5 }, undefined), { type: 'scroll', firstFrameWhen: 'centered' }],
        ['Early exit', range({ fraction: 0.5 }, { phase: 'exit', fraction: 0.5 }), { type: 'scroll', firstFrameWhen: 'centered', lastFrameWhen: 'halfOut' }],
        ['Full journey', range(undefined, undefined), { type: 'scroll' }],
        // a point no word names: the exact place it is for an element that fits the screen
        ['Middle half', range({ fraction: 0.25 }, { fraction: 0.75 }), { type: 'scroll', firstFrameWhen: { domElement: 0.25, screen: 0.75 }, lastFrameWhen: { domElement: 0.75, screen: 0.25 } }],
        ['a crossing', range({ phase: 'entryCrossing', fraction: 0.3 }, { phase: 'exitCrossing', fraction: 0.3 }), { type: 'scroll', firstFrameWhen: { domElement: 0.3, screen: 'bottom' }, lastFrameWhen: { domElement: 0.3, screen: 'top' } }],
    ])('%s', (_name, old, expected) => {
        expect(converted(old)).toEqual(expected);
    });

    it('an exact place is the same point as the old one, for an element that fits the screen', () => {
        // contain 30 % of a 100-tall element on a 400 screen: u = 100 + 0.3 × 300 = 190
        const timeline = converted(range({ phase: 'contain', fraction: 0.3 }, undefined));
        const first = isRecord(timeline) ? timeline.firstFrameWhen : undefined;
        expect(first).toEqual({ domElement: 0.7, screen: 0.7 });
        expect(scrollMomentU({ domElement: 0.7, screen: 0.7 }, 100, 400)).toBeCloseTo(190);
    });

    it('a scroll of the page or a box: the fractions become shares scrolled', () => {
        expect(converted({ type: 'scroll', source: 'root', range: { start: { fraction: 0.2 }, end: { fraction: 0.8 } } }))
            .toEqual({ type: 'scroll', follows: 'pageScroll', firstFrameWhen: { scrolled: 0.2 }, lastFrameWhen: { scrolled: 0.8 } });
    });

    it('a horizontal timeline names its edge lines left and right', () => {
        expect(converted({ type: 'view', axis: 'x', range: { start: { phase: 'entryCrossing', fraction: 0.3 } } }))
            .toEqual({ type: 'scroll', axis: 'horizontal', firstFrameWhen: { domElement: 0.3, screen: 'right' } });
    });
});

describe('1.27 → 1.28: holding, the axis, the rest', () => {
    it('pin + the parent + a contain range is holdOnScreen alone', () => {
        expect(converted({
            type: 'view', subject: 'parent', pin: { align: 'center', distance: 3 },
            range: { start: { phase: 'contain', fraction: 0 }, end: { phase: 'contain', fraction: 1 } },
        })).toEqual({ type: 'scroll', holdOnScreen: { at: 'center', forScreens: 3 } });
        expect(converted({ type: 'view', subject: 'parent', pin: { offset: 80 }, range: { start: { phase: 'contain' }, end: { phase: 'contain' } } }))
            .toEqual({ type: 'scroll', holdOnScreen: { offset: 80 } });
    });

    it('the card stack keeps its stretch: the words speak of the section it is held in', () => {
        expect(converted({ type: 'view', subject: 'parent', pin: true, range: { start: { phase: 'cover', fraction: 0.5 }, end: { phase: 'cover', fraction: 1 } } }))
            .toEqual({ type: 'scroll', holdOnScreen: true, firstFrameWhen: 'centered', lastFrameWhen: 'gone' });
    });

    it('a pinned document with no range kept the whole pass — written out, since held now defaults to the held stretch', () => {
        expect(converted({ type: 'view', subject: 'parent', pin: true }))
            .toEqual({ type: 'scroll', holdOnScreen: true, firstFrameWhen: 'appears', lastFrameWhen: 'gone' });
    });

    it('pin on a scroll of the page is not carried — the page\'s CSS sticks an element', () => {
        expect(converted({ type: 'scroll', source: 'root', pin: true })).toEqual({ type: 'scroll', follows: 'pageScroll' });
    });

    it('axis words, the frame rate gone, the shared keys kept', () => {
        expect(converted({ type: 'view', axis: 'y', frameRate: 30, outTime: 3000, inTime: 500, iterations: 2, smoothing: 150, engine: 'js' }))
            .toEqual({ type: 'scroll', axis: 'vertical', outTime: 3000, inTime: 500, iterations: 2, smoothing: 150, engine: 'js' });
        expect(converted({ type: 'view', axis: 'block' })).toEqual({ type: 'scroll' });
        expect(converted({ type: 'view', axis: 'inline' })).toEqual({ type: 'scroll', axis: 'horizontal' });
    });

    it('a time timeline is not touched, and the converted document validates and plays', () => {
        // the time timeline keeps its keys; since the 2026-11-15 amendment its triggers move to the root, renamed
        expect(converted({ outTime: 1000, actionTriggers: { 'playback.start': 'load' } })).toEqual({ outTime: 1000 });
        const moved = convertWireDocument(doc127({ outTime: 1000, actionTriggers: { 'playback.start': 'load' }, actions: { 'playback.stop': 'animateToStart' } })).doc;
        const animator = isRecord(moved) ? moved.animator : undefined;
        // 1.29: the list is `actions`, the stop's manner the timeline's `whenStopped`
        expect(isRecord(animator) ? asTriggerMap(animator.actions) : undefined).toEqual({ 'timeline.start': 'load' });
        const first = timelineRecordOf(animator);
        expect(isRecord(first) ? first.whenStopped : undefined).toBe('animateToStart');
        const doc = convertWireDocument(doc127({ type: 'view', subject: '#a', range: { start: { phase: 'entry', fraction: 0.5 } } })).doc;
        expect(validateDocument(doc).errors).toEqual([]);
        expect(getAnimatorConfig(untyped<PxDocument>(doc))?.scroll).toEqual({ follows: 'pageDomElement', selector: '#a', firstFrameWhen: { moment: 'halfIn' } });
    });
});

describe('the scroll timeline rules validateDocument checks', () => {
    const problems = (timeline: Record<string, unknown>) =>
        validateDocument(untyped<PxDocument>({ type: 'svg', animator: { timelines: [timeline] } })).errors;

    it('a well-formed timeline has none', () => {
        expect(problems({ type: 'scroll', firstFrameWhen: 'halfIn', lastFrameWhen: { domElement: 'top', screen: 0.2 } })).toEqual([]);
        expect(problems({ type: 'scroll', follows: 'pageScroll', firstFrameWhen: { scrolled: 0.2 } })).toEqual([]);
        expect(problems({ type: 'scroll', holdOnScreen: { at: 'center' }, firstFrameWhen: 'centered' })).toEqual([]);
    });

    it.each([
        ['a moment that does not fit what is followed', { type: 'scroll', follows: 'pageScroll', firstFrameWhen: 'fullyIn' }, 'fits only an element'],
        ['{ scrolled } on an element', { type: 'scroll', lastFrameWhen: { scrolled: 0.5 } }, 'fits only follows'],
        ['a share outside 0–1', { type: 'scroll', firstFrameWhen: { domElement: 'top', screen: 1.5 } }, 'a share is 0–1'],
        ['two words in the wrong order', { type: 'scroll', firstFrameWhen: 'gone', lastFrameWhen: 'appears' }, 'taken in scroll order'],
        ['pageDomElement with no selector', { type: 'scroll', follows: 'pageDomElement' }, 'needs a selector'],
        ['holdOnScreen beside follows', { type: 'scroll', holdOnScreen: true, follows: 'pageScroll' }, 'holdOnScreen follows its own held stretch'],
        ['a selector that nothing uses', { type: 'scroll', follows: 'parentDomElement', selector: '#a' }, 'a selector is used only'],
        ['the old view type', { type: 'view' }, ''],
    ])('%s', (_name, timeline, phrase) => {
        const errors = problems(timeline);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.join('\n')).toContain(phrase);
    });
});
