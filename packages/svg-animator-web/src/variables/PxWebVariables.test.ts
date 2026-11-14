/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Variables on the web player (docs/library/variables.md): the first paint has the
// values; a change is written on the next frame, once, only where it is bound; an effect's setting builds the player
// again with its state and time kept.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PxDocument } from '@pixodesk/svg-animator-core';
import { PxDiagnosticCode } from '@pixodesk/svg-animator-core';
import { createSvgAnimationPlayer } from '../animator/PxAnimator';

/** JSON as a file has it: a binding stands where the TS type says number. */
function doc(): PxDocument {
    const json: unknown = JSON.parse(JSON.stringify({
        type: 'svg', viewBox: '0 0 400 200',
        animator: {
            timeline: { engine: 'js', outTime: 1000, iterations: 'infinite', actionTriggers: { 'playback.start': 'load' }, actions: { outOfView: 'continue' } },
            definitions: {
                variables: {
                    bg: { type: 'color', defaultValue: '#2a7fff' },
                    size: { type: 'number', defaultValue: 40 },
                    x: { type: 'number', defaultValue: 100 },
                    count: { type: 'number', defaultValue: 2 },
                },
                variableVariants: { foggyDay: { bg: 'green' } },
            },
        },
        children: [
            { type: 'circle', id: 'ball', r: 'variable(size)', fill: 'variable(bg)', transform: { translate: ['calc(variable(x) + 5)', 60] } },
            { type: 'rect', id: 'tile', width: 10, height: 10, effects: { repeater: { copies: 'variable(count)', translate: [20, 0] } } },
            { type: 'rect', id: 'spin', width: 5, height: 5, animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } } },
        ],
    }));
    return json as PxDocument;
}

const stage = (): HTMLElement => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
};
const circle = (box: Element): Element | null => box.querySelector('circle');
const nextFrame = (): void => { vi.advanceTimersByTime(20); };

describe('variables on the web player', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    });
    afterEach(() => {
        vi.useRealTimers();
        document.body.replaceChildren();
    });

    it('the first paint has the values — the defaults, a variant, the host\'s values', () => {
        const box = stage();
        const player = createSvgAnimationPlayer({ document: doc(), container: box, variant: 'foggyDay', variables: { size: 12 } });
        expect(circle(box)?.getAttribute('fill')).toBe('green');
        expect(circle(box)?.getAttribute('r')).toBe('12');
        expect(circle(box)?.getAttribute('transform')).toContain('translate(105');
        player.destroy();
    });

    it('a change is written on the next frame, not at once; many calls cost one write', () => {
        const box = stage();
        const player = createSvgAnimationPlayer({ document: doc(), container: box });
        const el = circle(box);
        if (!el) throw new Error('no circle');
        const setAttribute = vi.spyOn(el, 'setAttribute');
        player.variables.set('bg', 'red');
        player.variables.set('bg', 'blue');
        player.variables.setVariables({ bg: 'black', size: 30 });
        expect(el.getAttribute('fill')).toBe('#2a7fff');                // not at once
        nextFrame();
        expect(el.getAttribute('fill')).toBe('black');
        expect(el.getAttribute('r')).toBe('30');
        expect(setAttribute.mock.calls.filter(c => c[0] === 'fill')).toHaveLength(1);
        nextFrame();
        expect(setAttribute.mock.calls.filter(c => c[0] === 'fill')).toHaveLength(1);   // set once, written once
        player.destroy();
    });

    it('the same element stays — a direct write, no rebuild; the animation keeps playing', () => {
        const box = stage();
        const player = createSvgAnimationPlayer({ document: doc(), container: box });
        const before = circle(box);
        expect(player.playback.isPlaying()).toBe(true);
        player.variables.set('x', 0);
        nextFrame();
        expect(circle(box)).toBe(before);
        expect(before?.getAttribute('transform')).toContain('translate(5');
        expect(player.playback.isPlaying()).toBe(true);
        player.destroy();
    });

    it('an effect\'s setting builds the player again — the copies change, the playback state and time are kept', () => {
        const box = stage();
        const onPlaybackStart = vi.fn();
        const player = createSvgAnimationPlayer({ document: doc(), container: box, onPlaybackStart });
        vi.advanceTimersByTime(300);
        const time = player.playback.getTotalTime() ?? 0;
        expect(box.querySelectorAll('rect').length).toBe(3);             // 2 copies + the animated rect
        player.variables.set('count', 4);
        nextFrame();
        expect(box.querySelectorAll('rect').length).toBe(5);
        expect(player.playback.isPlaying()).toBe(true);
        expect(player.playback.getTotalTime() ?? 0).toBeGreaterThanOrEqual(time);
        expect(onPlaybackStart).toHaveBeenCalledTimes(1);                // the rebuild's own start is not the caller's event
        player.destroy();
    });

    it('a variant from code; reset; getAll / getKeys / getDefinitions', () => {
        const box = stage();
        const player = createSvgAnimationPlayer({ document: doc(), container: box });
        player.variables.setVariant('foggyDay');
        nextFrame();
        expect(circle(box)?.getAttribute('fill')).toBe('green');
        player.variables.set('bg', '#fff');
        player.variables.reset('bg');
        nextFrame();
        expect(circle(box)?.getAttribute('fill')).toBe('green');
        expect(player.variables.getKeys()).toEqual(['bg', 'size', 'x', 'count']);
        expect(player.variables.getAll()).toMatchObject({ bg: 'green', size: 40 });
        expect(player.variables.getDefinitions()['size']).toEqual({ type: 'number', defaultValue: 40 });
        expect(player.variables.getVariantKeys()).toEqual(['foggyDay']);
        player.destroy();
    });

    it('cssVariables: the value from code is the fallback the page\'s CSS can override', () => {
        const box = stage();
        const player = createSvgAnimationPlayer({ document: doc(), container: box, cssVariables: { bg: 'brand-primary' } });
        const el = circle(box);
        expect(el?.getAttribute('fill')).toBeNull();
        expect(el?.getAttribute('style')).toContain('var(--brand-primary, #2a7fff)');
        player.variables.set('bg', 'green');
        nextFrame();
        expect(el?.getAttribute('style')).toContain('var(--brand-primary, green)');
        player.destroy();
    });

    it('calls made before the document loads land before the first paint', async () => {
        const box = stage();
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve(doc()) })));
        const player = createSvgAnimationPlayer({ document: '/card.json', container: box });
        player.variables.set('bg', 'pink');
        await vi.advanceTimersByTimeAsync(50);   // the fetch resolves; a looping animation never runs out of timers
        expect(circle(box)?.getAttribute('fill')).toBe('pink');
        player.destroy();
        vi.unstubAllGlobals();
    });

    it('a wrong type or an unknown name is ignored with its code', () => {
        const box = stage();
        const codes: Array<number> = [];
        const player = createSvgAnimationPlayer({ document: doc(), container: box, onWarning: d => codes.push(d.code) });
        player.variables.set('size', 'big');
        player.variables.set('nope', 1);
        expect(codes).toEqual([PxDiagnosticCode.variableTypeMismatch, PxDiagnosticCode.variableUnknown]);
        player.destroy();
    });
});
