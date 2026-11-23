/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The `flowStep` prop and `onFlowStepChange` (2026-11-20; `segment` 2026-11-15) — the page holds the state; the file's state rules rest.

import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxAnimationPlayerHandle, PxDocument } from '@pixodesk/svg-animator-core';
import SvgAnimationPlayer from './SvgAnimator';

/** Opacity runs 0 → 1 over content 0…3000 ms; a click goes to the next state. */
const DOC: PxDocument = {
    type: 'svg', viewBox: '0 0 10 10',
    animator: {
        timelines: [{ engine: 'js', outTime: 3000 }], flowSteps: [{ id: 'intro', inTime: 0, outTime: 1000, whenFinished: { action: 'flow.next' } }, { id: 'loop', inTime: 1000, outTime: 2000, iterations: 'infinite' }, { id: 'success', inTime: 2000, outTime: 3000 }],
        actions: [{ action: 'timeline.start', event: 'load' }, { action: 'flow.next', event: 'click' }],
    },
    children: [
        { type: 'rect', id: 'r', width: 10, height: 10,
          animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
    ],
};

const click = (container: HTMLElement): void => {
    act(() => { container.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('SvgAnimationPlayer — the `flowStep` prop (React)', () => {
    beforeEach(() => {
        // 'performance' faked with requestAnimationFrame: jsdom's rAF stops firing from the second test otherwise
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });
    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('holds the named state from the first frame — one that ends is shown at its end', () => {
        const ref = createRef<PxAnimationPlayerHandle>();
        const { container } = render(<SvgAnimationPlayer document={DOC} flowStep="success" playerRef={ref} />);
        expect(ref.current?.flow.get()).toEqual(['success']);
        act(() => { vi.advanceTimersByTime(50); });
        expect(Number(container.querySelector('rect')?.getAttribute('opacity'))).toBeCloseTo(1, 2);
    });

    it('a new value goes there and tells `onFlowStepChange`; the file\'s state rules are not read while held', () => {
        const ref = createRef<PxAnimationPlayerHandle>();
        const onFlowStepChange = vi.fn();
        const { container, rerender } = render(<SvgAnimationPlayer document={DOC} flowStep="success" playerRef={ref} onFlowStepChange={onFlowStepChange} />);
        rerender(<SvgAnimationPlayer document={DOC} flowStep="loop" playerRef={ref} onFlowStepChange={onFlowStepChange} />);
        expect(ref.current?.flow.get()).toEqual(['loop']);
        expect(onFlowStepChange).toHaveBeenLastCalledWith('loop', 'success', 'default');
        click(container);
        expect(ref.current?.flow.get()).toEqual(['loop']);   // held: the click's `flow.next` rests
    });

    it('without the prop the file\'s triggers move it, and `onFlowStepChange` tells the page', () => {
        const ref = createRef<PxAnimationPlayerHandle>();
        const onFlowStepChange = vi.fn();
        const { container } = render(<SvgAnimationPlayer document={DOC} playerRef={ref} onFlowStepChange={onFlowStepChange} />);
        expect(ref.current?.flow.get()).toEqual(['intro']);
        click(container);
        expect(ref.current?.flow.get()).toEqual(['loop']);
        expect(onFlowStepChange).toHaveBeenCalledWith('loop', 'intro', 'default');
    });

    it('a changed `flows` prop plans again over the SAME picture — no remount; what stops running lets go (2026-11-22)', () => {
        // two flows side by side: the default timeline (the shine, no step names it) and `pulse` on its own timeline
        const two: PxDocument = {
            type: 'svg', viewBox: '0 0 10 10',
            animator: {
                timelines: [{ engine: 'js', outTime: 1000, iterations: 'infinite' }, { id: 'p', engine: 'js', outTime: 1000, iterations: 'infinite' }],
                flowSteps: [{ id: 'beat', flow: 'pulse', timeline: 'p' }],
                actions: [{ action: 'timeline.start', event: 'load' }],
            },
            children: [
                { type: 'rect', id: 'a', width: 2, height: 2, opacity: 0.9, animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } } },
                { type: 'rect', id: 'b', width: 2, height: 2, x: 5, animate: { x: { byTimeline: [{ timeline: 'p', keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 8 }] }] } } },
            ],
        };
        const { container, rerender } = render(<SvgAnimationPlayer document={two} />);
        const root = container.querySelector('svg');
        act(() => { vi.advanceTimersByTime(300); });
        expect(Number(container.querySelectorAll('rect')[0]?.getAttribute('opacity'))).toBeLessThan(0.6);   // the shine plays
        rerender(<SvgAnimationPlayer document={two} flows={['pulse']} />);
        expect(container.querySelector('svg')).toBe(root);                                         // the same element
        expect(Number(container.querySelectorAll('rect')[0]?.getAttribute('opacity'))).toBeCloseTo(0.9, 2);   // let go: its own value
    });
});

