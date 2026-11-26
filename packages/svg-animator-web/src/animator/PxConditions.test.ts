/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `when.condition` (1.33, D5) — an entry heard only while its condition is true; an entry with no triggers acts at the
// moment its `when` becomes true.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer as createPlayer } from '../index';
import { createPrerenderedAnimator } from '../engines/PxAnimatorBind';
import type { PxActions, PxDocument, PxDocumentJson } from '@pixodesk/svg-animator-core';

/** Every player a test makes is destroyed after it — a live frame loop otherwise outlives its test's fake timers. */
const made: Array<{ destroy(): void }> = [];
const createSvgAnimationPlayer: typeof createPlayer = (options) => {
    const api = createPlayer(options);
    made.push(api);
    return api;
};

/** Three steps on one timeline (`idle` · `loading` · `done`) and two variables. */
function doc(actions: PxActions): PxDocument {
    return {
        type: 'svg', viewBox: '0 0 10 10',
        animator: {
            timelines: [{ engine: 'js', outTime: 3000 }],
            definitions: { variables: { unlocked: { type: 'boolean', defaultValue: false }, progress: { type: 'number', defaultValue: 0 } } },
            flowSteps: [
                { id: 'idle', segment: { inTime: 0, outTime: 1000 } },
                { id: 'loading', segment: { inTime: 1000, outTime: 2000, iterations: 'infinite' } },
                { id: 'done', segment: { inTime: 2000, outTime: 3000 } },
            ],
            actions,
        },
        children: [{ type: 'rect', id: 'r', width: 10, height: 10 }],
    };
}

const click = (): void => { document.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
/** A few frames — a variable's change and a condition's check each wait for one. */
const frames = (): void => { vi.advanceTimersByTime(100); };

describe('when.condition (1.33)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="box"></div>';
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        made.splice(0).forEach(api => api.destroy());
        vi.useRealTimers();
    });

    it('a trigger is heard only while its condition is true', () => {
        const api = createSvgAnimationPlayer({ container: '#box', document: doc([
            { name: 'timeline.start', triggers: [{ event: 'load' }] },
            { name: 'flow.goTo', with: { flowStep: 'done' }, triggers: [{ event: 'click' }], when: { condition: 'var(unlocked)' } },
        ]) });
        frames();
        click();
        frames();
        expect(api.flow.get()).toEqual(['idle']);
        api.variables.set('unlocked', true);
        frames();
        click();
        frames();
        expect(api.flow.get()).toEqual(['done']);
    });

    it('an entry with no triggers acts when its condition turns true — only at its steps', () => {
        const api = createSvgAnimationPlayer({ container: '#box', document: doc([
            { name: 'timeline.start', triggers: [{ event: 'load' }] },
            { name: 'flow.goTo', with: { flowStep: 'loading' }, triggers: [{ event: 'click' }] },
            { name: 'flow.goTo', with: { flowStep: 'done' }, when: { flowSteps: ['loading'], condition: 'calc(var(progress) >= 1)' } },
        ]) });
        frames();
        // true while the flow is elsewhere — nothing yet
        api.variables.set('progress', 1);
        frames();
        expect(api.flow.get()).toEqual(['idle']);
        // arriving at `loading` with it true already: it acts
        click();
        frames();
        expect(api.flow.get()).toEqual(['done']);
    });

    it('turning true while the flow is at its step', () => {
        const api = createSvgAnimationPlayer({ container: '#box', document: doc([
            { name: 'timeline.start', triggers: [{ event: 'load' }] },
            { name: 'flow.goTo', with: { flowStep: 'loading' }, triggers: [{ event: 'click' }] },
            { name: 'flow.goTo', with: { flowStep: 'done' }, when: { flowSteps: ['loading'], condition: 'calc(var(progress) >= 1)' } },
        ]) });
        frames();
        click();
        frames();
        api.variables.set('progress', 0.5);
        frames();
        expect(api.flow.get()).toEqual(['loading']);
        api.variables.set('progress', 1);
        frames();
        expect(api.flow.get()).toEqual(['done']);
    });

    it('true when the player starts: it acts once', () => {
        const api = createSvgAnimationPlayer({ container: '#box', document: doc([
            { name: 'timeline.start', triggers: [{ event: 'load' }] },
            { name: 'flow.goTo', with: { flowStep: 'done' }, when: { condition: 'calc(1 > 0)' } },
        ]) });
        frames();
        expect(api.flow.get()).toEqual(['done']);
    });

    it('two entries always true cannot spin — one move per frame', () => {
        const changes: Array<string> = [];
        const api = createSvgAnimationPlayer({ container: '#box', onFlowStepChange: step => changes.push(step), document: doc([
            { name: 'flow.goTo', with: { flowStep: 'done' }, when: { flowSteps: ['idle'], condition: 'calc(1 > 0)' } },
            { name: 'flow.goTo', with: { flowStep: 'idle' }, when: { flowSteps: ['done'], condition: 'calc(1 > 0)' } },
        ]) });
        vi.advanceTimersByTime(160);   // about ten frames
        expect(changes.length).toBeGreaterThan(1);
        expect(changes.length).toBeLessThanOrEqual(11);
        expect(['idle', 'done']).toContain(api.flow.get()[0]);
    });

    it('pre-rendered: a trigger reads the player\'s variables too', () => {
        document.body.innerHTML = '<svg id="pic" viewBox="0 0 10 10"><rect id="r"/></svg>';
        const pre: PxDocumentJson = {
            id: 'pic', type: 'svg',
            animator: {
                timelines: [{ engine: 'js', outTime: 2000 }],
                definitions: { variables: { unlocked: { type: 'boolean', defaultValue: false } } },
                flowSteps: [{ id: 'idle', segment: { inTime: 0, outTime: 1000 } }, { id: 'done', segment: { inTime: 1000, outTime: 2000 } }],
                actions: [{ name: 'flow.goTo', with: { flowStep: 'done' }, triggers: [{ event: 'click' }], when: { condition: 'var(unlocked)' } }],
            },
        };
        const api = createPrerenderedAnimator({ document: pre });
        made.push(api);
        frames();
        click();
        frames();
        expect(api.flow.get()).toEqual(['idle']);
        api.variables.set('unlocked', true);
        frames();
        click();
        frames();
        expect(api.flow.get()).toEqual(['done']);
    });
});
