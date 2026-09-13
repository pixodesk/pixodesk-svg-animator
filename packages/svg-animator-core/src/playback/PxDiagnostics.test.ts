/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The ONE diagnostics channel every player reports through (API review §5, §25.1).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiagnostics, PxDiagnosticKind, type PxDiagnostic } from './PxDiagnostics';

const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => { });
const errorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => { });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createDiagnostics — warnings', () => {

    it('falls back to the console when no handler is given, so nothing is lost by default', () => {
        const warn = warnSpy();
        createDiagnostics().warn(PxDiagnosticKind.document, 'easing "bounce" is unknown');

        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('easing "bounce" is unknown');
    });

    it('hands over to the handler INSTEAD of the console — taking it means owning it', () => {
        const warn = warnSpy();
        const onWarn = vi.fn();
        createDiagnostics({ onWarn }).warn(PxDiagnosticKind.usage, 'config override ignored', { key: 'duration' });

        expect(onWarn).toHaveBeenCalledWith({
            kind: PxDiagnosticKind.usage,
            message: 'config override ignored',
            detail: { key: 'duration' },
        });
        expect(warn).not.toHaveBeenCalled();
    });

    it('labels the console fallback with the prefix AND the kind', () => {
        const warn = warnSpy();
        createDiagnostics(undefined, '[PixodeskSvgAnimator]').warn(PxDiagnosticKind.host, 'something odd');

        const line = String(warn.mock.calls[0][0]);
        expect(line).toContain('[PixodeskSvgAnimator]');
        expect(line).toContain('host');
    });

    it('does NOT prefix the message handed to a handler', () => {
        // A caller feeding this into its own UI should not have to strip our tag.
        const onWarn = vi.fn();
        createDiagnostics({ onWarn }, '[PixodeskSvgAnimator]').warn(PxDiagnosticKind.host, 'something odd');

        const d = onWarn.mock.calls[0][0] as PxDiagnostic;
        expect(d.message).toBe('something odd');
        expect(d.kind).toBe(PxDiagnosticKind.host);
    });

    it('muteWarn switches the console fallback off — for a host that tolerates the chatter', () => {
        const warn = warnSpy();
        createDiagnostics({ muteWarn: true }).warn(PxDiagnosticKind.platform, 'quiet please');

        expect(warn).not.toHaveBeenCalled();
    });

    it('muteWarn is about the console, not about you — a handler you passed still fires', () => {
        const warn = warnSpy();
        const onWarn = vi.fn();
        createDiagnostics({ onWarn, muteWarn: true }).warn(PxDiagnosticKind.platform, 'still reported');

        expect(onWarn).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('muteWarn leaves errors audible — the two switches are independent', () => {
        const warn = warnSpy();
        const error = errorSpy();
        const diag = createDiagnostics({ muteWarn: true });

        diag.warn(PxDiagnosticKind.platform, 'muted');
        diag.error(PxDiagnosticKind.internal, new Error('still heard'));

        expect(warn).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);
    });
});

describe('createDiagnostics — kinds', () => {

    it('carries the kind through to the handler', () => {
        const seen: Array<string> = [];
        const diag = createDiagnostics({ onWarn: d => seen.push(d.kind) });

        diag.warn(PxDiagnosticKind.document, 'a');
        diag.warn(PxDiagnosticKind.host, 'b');
        diag.warn(PxDiagnosticKind.platform, 'c');
        diag.warn(PxDiagnosticKind.usage, 'd');
        diag.warn(PxDiagnosticKind.internal, 'e');

        expect(seen).toEqual(['document', 'host', 'platform', 'usage', 'internal']);
    });
});

describe('createDiagnostics — errors', () => {

    it('falls back to console.error when no handler is given', () => {
        const error = errorSpy();
        createDiagnostics().error(PxDiagnosticKind.host, new Error('failed to load "logo.json"'));

        expect(error).toHaveBeenCalledTimes(1);
        expect(String(error.mock.calls[0][0])).toContain('failed to load "logo.json"');
    });

    it('hands over to onError instead of the console, with the kind and the Error', () => {
        const error = errorSpy();
        const onError = vi.fn();
        createDiagnostics({ onError }).error(PxDiagnosticKind.document, new Error('invalid document'));

        const d = onError.mock.calls[0][0] as PxDiagnostic;
        expect(d.kind).toBe(PxDiagnosticKind.document);
        expect(d.message).toBe('invalid document');
        expect(d.error).toBeInstanceOf(Error);
        expect(error).not.toHaveBeenCalled();
    });

    it('normalizes a string into an Error, so a handler always gets one shape', () => {
        const onError = vi.fn();
        createDiagnostics({ onError }).error(PxDiagnosticKind.internal, 'plain string failure');

        const d = onError.mock.calls[0][0] as PxDiagnostic;
        expect(d.error).toBeInstanceOf(Error);
        expect(d.error!.message).toBe('plain string failure');
    });

    it('carries a detail beside the Error — where React Native puts the component stack', () => {
        const onError = vi.fn();
        const thrown = new Error('render failed');
        createDiagnostics({ onError }).error(PxDiagnosticKind.internal, thrown, { componentStack: '  in Rect' });

        const d = onError.mock.calls[0][0] as PxDiagnostic;
        expect(d.error).toBe(thrown);                       // the real Error, stack included
        expect(d.detail).toEqual({ componentStack: '  in Rect' });
    });

    it('muteError switches the console fallback off but not the handler', () => {
        const error = errorSpy();
        const onError = vi.fn();
        createDiagnostics({ onError, muteError: true }).error(PxDiagnosticKind.internal, 'boom');
        createDiagnostics({ muteError: true }).error(PxDiagnosticKind.internal, 'unheard');

        expect(onError).toHaveBeenCalledTimes(1);
        expect(error).not.toHaveBeenCalled();
    });

    it('muteError leaves warnings audible — the two switches are independent', () => {
        const warn = warnSpy();
        const error = errorSpy();
        const diag = createDiagnostics({ muteError: true });

        diag.error(PxDiagnosticKind.internal, new Error('muted'));
        diag.warn(PxDiagnosticKind.usage, 'still heard');

        expect(error).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('warnings and errors are independent channels', () => {
        const warn = warnSpy();
        const error = errorSpy();
        const onWarn = vi.fn();
        const diag = createDiagnostics({ onWarn });   // only warnings are handled

        diag.warn(PxDiagnosticKind.usage, 'handled');
        diag.error(PxDiagnosticKind.internal, new Error('not handled'));

        expect(onWarn).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);       // the error still reaches the console
    });
});
