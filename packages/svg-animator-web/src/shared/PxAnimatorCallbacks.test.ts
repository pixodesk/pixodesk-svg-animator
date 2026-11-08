/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Inline callbacks → the one object the engines take, plus `onStop` (API review §9 / §5).

import { describe, expect, it, vi } from 'vitest';
import { toEngineCallbacks } from './PxAnimatorCallbacks';

describe('toEngineCallbacks', () => {

    it('passes each lifecycle callback through', () => {
        const onPlay = vi.fn(), onPause = vi.fn(), onFinish = vi.fn(), onDestroy = vi.fn();
        const out = toEngineCallbacks({ onPlay, onPause, onFinish, onDestroy });

        out.onPlay?.(); out.onPause?.(); out.onFinish?.(); out.onDestroy?.();

        for (const fn of [onPlay, onPause, onFinish, onDestroy]) expect(fn).toHaveBeenCalledTimes(1);
    });

    it('onStop is carried through untouched — it is the executor\'s to fire (the built-in stop), never a pause, finish or removal', () => {
        const onStop = vi.fn();
        const out = toEngineCallbacks({ onStop, onPause: () => {} });
        expect(out.onStop).toBe(onStop);

        out.onPause?.(); out.onFinish?.(); out.onDestroy?.();
        expect(onStop).not.toHaveBeenCalled();
    });

    it('makes NO wrapper when neither the callback nor onStop is given', () => {
        // The WAAPI engine wires `anim.onfinish` only if `callbacks.onFinish` EXISTS — an
        // always-present function would change what it does. Absence must stay absence.
        const out = toEngineCallbacks({});
        expect(out.onPlay).toBeUndefined();
        expect(out.onPause).toBeUndefined();
        expect(out.onFinish).toBeUndefined();
        expect(out.onDestroy).toBeUndefined();
    });

    it('accepts no options at all', () => {
        expect(() => toEngineCallbacks(undefined)).not.toThrow();
        expect(toEngineCallbacks(undefined).onFinish).toBeUndefined();
    });

    it('passes the diagnostics fields through untouched', () => {
        const onWarning = vi.fn(), onError = vi.fn();
        const out = toEngineCallbacks({ onWarning, onError, suppressWarnings: true, suppressErrors: false });

        expect(out.onWarning).toBe(onWarning);
        expect(out.onError).toBe(onError);
        expect(out.suppressWarnings).toBe(true);
        expect(out.suppressErrors).toBe(false);
    });
});
