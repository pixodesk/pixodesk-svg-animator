/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The ONE diagnostics channel every player reports through (API review §5).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiagnostics } from './PxDiagnostics';

const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => { });
const errorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => { });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createDiagnostics — warnings', () => {

    it('falls back to the console when no handler is given, so nothing is lost by default', () => {
        const warn = warnSpy();
        createDiagnostics().warn('easing "bounce" is unknown');

        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('easing "bounce" is unknown');
    });

    it('hands over to the handler INSTEAD of the console — taking it means owning it', () => {
        const warn = warnSpy();
        const onWarn = vi.fn();
        createDiagnostics({ onWarn }).warn('config override ignored', { key: 'duration' });

        expect(onWarn).toHaveBeenCalledWith('config override ignored', { key: 'duration' });
        expect(warn).not.toHaveBeenCalled();
    });

    it('labels the console fallback with the prefix', () => {
        const warn = warnSpy();
        createDiagnostics(undefined, '[PixodeskSvgAnimator]').warn('something odd');

        expect(String(warn.mock.calls[0][0])).toContain('[PixodeskSvgAnimator]');
    });

    it('does NOT prefix the message handed to a handler', () => {
        // A caller feeding this into its own UI should not have to strip our tag.
        const onWarn = vi.fn();
        createDiagnostics({ onWarn }, '[PixodeskSvgAnimator]').warn('something odd');

        expect(onWarn).toHaveBeenCalledWith('something odd', undefined);
    });

    it('silent suppresses the console fallback', () => {
        const warn = warnSpy();
        createDiagnostics({ silent: true }).warn('quiet please');

        expect(warn).not.toHaveBeenCalled();
    });

    it('silent is not a mute button — handlers still fire', () => {
        const warn = warnSpy();
        const onWarn = vi.fn();
        createDiagnostics({ onWarn, silent: true }).warn('still reported');

        expect(onWarn).toHaveBeenCalledWith('still reported', undefined);
        expect(warn).not.toHaveBeenCalled();
    });
});

describe('createDiagnostics — errors', () => {

    it('falls back to console.error when no handler is given', () => {
        const error = errorSpy();
        createDiagnostics().error(new Error('failed to load "logo.json"'));

        expect(error).toHaveBeenCalledTimes(1);
        expect(String(error.mock.calls[0][0])).toContain('failed to load "logo.json"');
    });

    it('hands over to onError instead of the console', () => {
        const error = errorSpy();
        const onError = vi.fn();
        createDiagnostics({ onError }).error(new Error('invalid document'));

        expect(onError).toHaveBeenCalledTimes(1);
        expect((onError.mock.calls[0][0] as Error).message).toBe('invalid document');
        expect(error).not.toHaveBeenCalled();
    });

    it('normalises a string into an Error, so a handler always gets one shape', () => {
        const onError = vi.fn();
        createDiagnostics({ onError }).error('plain string failure');

        const received = onError.mock.calls[0][0];
        expect(received).toBeInstanceOf(Error);
        expect((received as Error).message).toBe('plain string failure');
    });

    it('silent suppresses the console fallback but not the handler', () => {
        const error = errorSpy();
        const onError = vi.fn();
        createDiagnostics({ onError, silent: true }).error('boom');
        createDiagnostics({ silent: true }).error('unheard');

        expect(onError).toHaveBeenCalledTimes(1);
        expect(error).not.toHaveBeenCalled();
    });

    it('warnings and errors are independent channels', () => {
        const warn = warnSpy();
        const error = errorSpy();
        const onWarn = vi.fn();
        const diag = createDiagnostics({ onWarn });   // only warnings are handled

        diag.warn('handled');
        diag.error(new Error('not handled'));

        expect(onWarn).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);       // the error still reaches the console
    });
});
