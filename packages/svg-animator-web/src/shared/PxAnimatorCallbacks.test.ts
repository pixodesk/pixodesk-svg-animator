/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Inline callbacks → the one object the engines take, plus `onStop` (API review §9 / §5).

import { describe, expect, it, vi } from 'vitest';
import { toEngineCallbacks } from './PxAnimatorCallbacks';

describe('toEngineCallbacks', () => {

    it('passes each lifecycle callback through', () => {
        const onPlay = vi.fn(), onPause = vi.fn(), onCancel = vi.fn(), onFinish = vi.fn(), onRemove = vi.fn();
        const out = toEngineCallbacks({ onPlay, onPause, onCancel, onFinish, onRemove });

        out.onPlay?.(); out.onPause?.(); out.onCancel?.(); out.onFinish?.(); out.onRemove?.();

        for (const fn of [onPlay, onPause, onCancel, onFinish, onRemove]) expect(fn).toHaveBeenCalledTimes(1);
    });

    it('fires onStop after pause / cancel / finish / remove — and never after play', () => {
        const onStop = vi.fn();
        const out = toEngineCallbacks({ onStop });

        out.onPlay?.();
        expect(onStop).not.toHaveBeenCalled();

        out.onPause?.(); out.onCancel?.(); out.onFinish?.(); out.onRemove?.();
        expect(onStop).toHaveBeenCalledTimes(4);
    });

    it('calls the specific callback BEFORE onStop', () => {
        const order: Array<string> = [];
        const out = toEngineCallbacks({ onFinish: () => order.push('finish'), onStop: () => order.push('stop') });

        out.onFinish?.();
        expect(order).toEqual(['finish', 'stop']);
    });

    it('makes NO wrapper when neither the callback nor onStop is given', () => {
        // The WAAPI engine wires `anim.onfinish` only if `callbacks.onFinish` EXISTS — an
        // always-present function would change what it does. Absence must stay absence.
        const out = toEngineCallbacks({});
        expect(out.onPlay).toBeUndefined();
        expect(out.onPause).toBeUndefined();
        expect(out.onCancel).toBeUndefined();
        expect(out.onFinish).toBeUndefined();
        expect(out.onRemove).toBeUndefined();
    });

    it('accepts no options at all', () => {
        expect(() => toEngineCallbacks(undefined)).not.toThrow();
        expect(toEngineCallbacks(undefined).onFinish).toBeUndefined();
    });

    it('passes the diagnostics fields through untouched', () => {
        const onWarn = vi.fn(), onError = vi.fn();
        const out = toEngineCallbacks({ onWarn, onError, silent: ['platform'] });

        expect(out.onWarn).toBe(onWarn);
        expect(out.onError).toBe(onError);
        expect(out.silent).toEqual(['platform']);
    });
});
