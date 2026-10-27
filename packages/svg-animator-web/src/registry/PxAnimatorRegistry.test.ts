/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The page-wide registry: an animator is listed from creation to `destroy()`, its play /
// pause / cancel / finish are announced, the caller's own callbacks still run first, and
// the same store is reachable by name for tooling that does not import the library.
// Through the public `createSvgAnimationPlayer` (frames mode — jsdom has no WAAPI).

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSvgAnimationPlayer } from '../animator/PxAnimator';
import { getAllSvgAnimationPlayers, onSvgAnimationPlayersChange, type PxAnimationPlayerRegistry, type PxAnimationPlayersEvent } from './PxAnimatorRegistry';
import type { PxDocument } from '@pixodesk/svg-animator-core';
import type { PxAnimationPlayerApi } from '../shared/PxAnimatorWebTypes';

const DUR = 320;

function makeDoc(): PxDocument {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { timeline: { engine: 'js', outTime: DUR, trigger: { playStart: 'load' } } },
        children: [{
            type: 'rect', id: 'r1', opacity: 0,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: DUR, value: 1 }] } },
        }],
    };
}

describe('the page-wide animator registry', () => {

    const made: Array<PxAnimationPlayerApi> = [];
    let container: HTMLDivElement;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        for (const a of made.splice(0)) a.destroy();
        container.remove();
        vi.useRealTimers();
    });

    const make = (): PxAnimationPlayerApi => {
        const api = createSvgAnimationPlayer({ doc: makeDoc(), container });
        made.push(api);
        return api;
    };

    it('lists an animator from creation to destroy()', () => {
        const before = getAllSvgAnimationPlayers().length;
        const api = make();
        expect(getAllSvgAnimationPlayers()).toContain(api);
        expect(getAllSvgAnimationPlayers().length).toBe(before + 1);
        api.destroy();
        expect(getAllSvgAnimationPlayers()).not.toContain(api);
        expect(getAllSvgAnimationPlayers().length).toBe(before);
    });

    it('announces add, play, pause, cancel and remove for the object the caller holds — after its own callbacks', () => {
        const events: Array<string> = [];
        const subjects = new Set<PxAnimationPlayerApi>();
        const own: Array<string> = [];
        // (the listener must not touch `api` — `add` fires while `createSvgAnimationPlayer` is still running)
        const off = onSvgAnimationPlayersChange((event: PxAnimationPlayersEvent, a: PxAnimationPlayerApi) => { events.push(event); subjects.add(a); });
        const api = createSvgAnimationPlayer({
            doc: makeDoc(), container,
            onPlay: () => own.push('play'), onPause: () => own.push('pause'), onCancel: () => own.push('cancel'),
        });
        made.push(api);
        api.play();
        api.pause();
        api.cancel();
        api.destroy();
        off();
        // Listed first, gone last …
        expect(events[0]).toBe('add');
        expect(events[events.length - 1]).toBe('remove');
        // … and in between the registry mirrors the caller's own callbacks exactly, in order
        // (the `load` trigger plays once at creation, `destroy()` cancels once more on its way
        // out — both reach the caller and the registry alike).
        expect(events.slice(1, -1)).toEqual(own);
        expect(own).toContain('play');
        expect(own).toContain('pause');
        expect(own).toContain('cancel');
        // Every event named the proxy `createSvgAnimationPlayer` returned — never the engine behind it.
        expect([...subjects]).toEqual([api]);
    });

    it('announces finish for an animator that has no onFinish of its own', () => {
        const events: Array<string> = [];
        const off = onSvgAnimationPlayersChange(event => { events.push(event); });
        const api = make();
        api.play();
        vi.advanceTimersByTime(DUR + 64);
        off();
        expect(events).toContain('finish');
    });

    it('a listener that throws does not break playback or the other listeners', () => {
        const heard: Array<string> = [];
        const offBad = onSvgAnimationPlayersChange(() => { throw new Error('bad listener'); });
        const offGood = onSvgAnimationPlayersChange(event => { heard.push(event); });
        const api = make();
        expect(() => api.play()).not.toThrow();
        // `add`, then every `play` (the `load` trigger's at creation and the explicit one).
        expect(heard[0]).toBe('add');
        expect(heard.slice(1).every(e => e === 'play')).toBe(true);
        expect(heard.length).toBeGreaterThanOrEqual(2);
        offBad(); offGood();
        // The error surfaces on its own tick, not inside the engine.
        expect(() => vi.runOnlyPendingTimers()).toThrow('bad listener');
    });

    it('unsubscribe stops the announcements', () => {
        const events: Array<string> = [];
        const off = onSvgAnimationPlayersChange(event => { events.push(event); });
        off();
        make().play();
        expect(events).toEqual([]);
    });

    it('is reachable by name — globalThis.__pixodeskSvgAnimationPlayers is the same store', () => {
        // globalThis declares no slot for the name, so it is read through Reflect and given the registry type
        const byName: PxAnimationPlayerRegistry | undefined = Reflect.get(globalThis, '__pixodeskSvgAnimationPlayers');
        expect(byName).toBeDefined();
        const api = make();
        expect(byName?.getAll()).toContain(api);
        expect(byName?.getAll()).toEqual(getAllSvgAnimationPlayers());
        const events: Array<string> = [];
        assert(byName, 'the registry is not reachable by name');
        const off = byName.subscribe(event => { events.push(event); });
        api.pause();
        off();
        expect(events).toEqual(['pause']);
    });
});
