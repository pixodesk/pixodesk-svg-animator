/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The pre-rendered builds plan flows as the full player does (2026-11-22): a document bound by id into an SVG already
// on the page — shared animations and bindings, no children — with two flows side by side.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxDocumentJson } from '@pixodesk/svg-animator-core';
import { createPrerenderedAnimator } from '../engines/PxAnimatorBind';
import type { PxAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';

/** The default timeline fades #a in (0 → 1 over 1 s); the flow `pulse` moves #b on the timeline `p` (0 → 8 over 1 s). */
const DOC: PxDocumentJson = {
    id: 'pic', type: 'svg',
    animator: {
        timelines: [{ engine: 'js', outTime: 1000, iterations: 'infinite' }, { id: 'p', engine: 'js', outTime: 1000, iterations: 'infinite' }],
        flowSteps: [{ id: 'beat', flow: 'pulse', timeline: 'p' }],
        actions: [{ action: 'timeline.start', event: 'load' }],
        definitions: { animations: {
            fade: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
            move: { x: { byTimeline: [{ timeline: 'p', keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 8 }] }] } },
        } },
        bindings: [{ element: '#a', animateWith: ['fade'] }, { element: '#b', animateWith: ['move'] }],
    },
};

const attr = (id: string, name: string): number => Number(document.getElementById(id)?.getAttribute(name));

describe('the pre-rendered player — flows side by side (2026-11-22)', () => {
    let api: PxAnimationPlayerApi | undefined;
    beforeEach(() => {
        document.body.innerHTML = '<svg id="pic" viewBox="0 0 10 10"><rect id="a" opacity="0.9"/><rect id="b" x="5"/></svg>';
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        api?.destroy();
        vi.useRealTimers();
    });

    it('both flows move their own element — the default timeline\'s and `pulse`\'s', () => {
        api = createPrerenderedAnimator({ document: DOC });
        vi.advanceTimersByTime(500);
        expect(attr('a', 'opacity')).toBeGreaterThan(0.3);
        expect(attr('a', 'opacity')).toBeLessThan(0.7);
        expect(attr('b', 'x')).toBeGreaterThan(2);
        expect(attr('b', 'x')).toBeLessThan(6);
        expect(api.flow.get()).toEqual(['default', 'beat']);
    });

    it('the page says what runs: `flows: ["pulse"]` — the default timeline holds nothing', () => {
        api = createPrerenderedAnimator({ document: DOC, flows: ['pulse'] });
        vi.advanceTimersByTime(500);
        expect(attr('a', 'opacity')).toBeCloseTo(0.9, 2);
        expect(attr('b', 'x')).toBeGreaterThan(2);
    });
});
