/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The `state` prop and `onStateChange` (2026-11-20; `segment` 2026-11-15) — the page holds the state; the file's state rules rest.

import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxAnimationPlayerHandle, PxDocument } from '@pixodesk/svg-animator-core';
import SvgAnimationPlayer from './SvgAnimator';

/** Opacity runs 0 → 1 over content 0…3000 ms; a click goes to the next state. */
const DOC: PxDocument = {
    type: 'svg', viewBox: '0 0 10 10',
    animator: {
        timelines: [{ engine: 'js', outTime: 3000 }], states: [{ id: 'intro', inTime: 0, outTime: 1000, whenFinished: { action: 'state.next' } }, { id: 'loop', inTime: 1000, outTime: 2000, iterations: 'infinite' }, { id: 'success', inTime: 2000, outTime: 3000 }],
        actionTriggers: [{ action: 'timeline.start', event: 'load' }, { action: 'state.next', event: 'click' }],
    },
    children: [
        { type: 'rect', id: 'r', width: 10, height: 10,
          animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 3000, value: 1 }] } } },
    ],
};

const click = (container: HTMLElement): void => {
    act(() => { container.querySelector('svg')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
};

describe('SvgAnimationPlayer — the `state` prop (React)', () => {
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
        const { container } = render(<SvgAnimationPlayer document={DOC} state="success" playerRef={ref} />);
        expect(ref.current?.state.get()).toEqual(['success']);
        act(() => { vi.advanceTimersByTime(50); });
        expect(Number(container.querySelector('rect')?.getAttribute('opacity'))).toBeCloseTo(1, 2);
    });

    it('a new value goes there and tells `onStateChange`; the file\'s state rules are not read while held', () => {
        const ref = createRef<PxAnimationPlayerHandle>();
        const onStateChange = vi.fn();
        const { container, rerender } = render(<SvgAnimationPlayer document={DOC} state="success" playerRef={ref} onStateChange={onStateChange} />);
        rerender(<SvgAnimationPlayer document={DOC} state="loop" playerRef={ref} onStateChange={onStateChange} />);
        expect(ref.current?.state.get()).toEqual(['loop']);
        expect(onStateChange).toHaveBeenLastCalledWith('loop', 'success', undefined);
        click(container);
        expect(ref.current?.state.get()).toEqual(['loop']);   // held: the click's `state.next` rests
    });

    it('without the prop the file\'s triggers move it, and `onStateChange` tells the page', () => {
        const ref = createRef<PxAnimationPlayerHandle>();
        const onStateChange = vi.fn();
        const { container } = render(<SvgAnimationPlayer document={DOC} playerRef={ref} onStateChange={onStateChange} />);
        expect(ref.current?.state.get()).toEqual(['intro']);
        click(container);
        expect(ref.current?.state.get()).toEqual(['loop']);
        expect(onStateChange).toHaveBeenCalledWith('loop', 'intro', undefined);
    });
});
