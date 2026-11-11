/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Inline callbacks → the one object the engines take, plus `onStop` (API review §9 / §5).

import { describe, expect, it, vi } from 'vitest';
import { toEngineCallbacks, toPlayerCallbacks } from './PxAnimatorCallbacks';

describe('toPlayerCallbacks / toEngineCallbacks', () => {

    it('toPlayerCallbacks passes each lifecycle callback through', () => {
        const onRunStart = vi.fn(), onRunPause = vi.fn(), onRunResume = vi.fn(), onRunStop = vi.fn(), onFinish = vi.fn(), onDestroy = vi.fn();
        const out = toPlayerCallbacks({ onRunStart, onRunPause, onRunResume, onRunStop, onFinish, onDestroy });

        out.onRunStart?.(); out.onRunPause?.(); out.onRunResume?.(); out.onRunStop?.(); out.onFinish?.(); out.onDestroy?.();

        for (const fn of [onRunStart, onRunPause, onRunResume, onRunStop, onFinish, onDestroy]) expect(fn).toHaveBeenCalledTimes(1);
    });

    it('the run events never reach an ENGINE — they are the executor\'s to fire; the engine gets the end, the teardown and the diagnostics', () => {
        const onRunStart = vi.fn(), onRunStop = vi.fn(), onFinish = vi.fn();
        const out = toEngineCallbacks({ onRunStart, onRunStop, onFinish });
        expect(out.onPlay).toBeUndefined();
        expect(out.onPause).toBeUndefined();
        expect(out.onFinish).toBe(onFinish);
        expect(Object.keys(out)).not.toContain('onRunStart');
        expect(onRunStart).not.toHaveBeenCalled();
        expect(onRunStop).not.toHaveBeenCalled();
    });

    it('makes NO wrapper when the callback is not given', () => {
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
