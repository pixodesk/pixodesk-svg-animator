/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The ONE diagnostics channel every player reports through (API review §5, §25.1).
//
// A diagnostic carries a NUMBER, not a sentence: the text is not in the bundle, it is on the
// codes page. So these tests assert the code, the data and the link — never prose.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { PxDiagnosticCode } from './PxDiagnosticCode';
import { createDiagnostics, PxDiagnosticKind, type PxDiagnostic } from './PxDiagnostics';

const warnSpy = () => vi.spyOn(console, 'warn').mockImplementation(() => { });
const errorSpy = () => vi.spyOn(console, 'error').mockImplementation(() => { });

afterEach(() => {
    vi.restoreAllMocks();
});

describe('createDiagnostics — warnings', () => {

    it('falls back to the console when no handler is given, so nothing is lost by default', () => {
        const warn = warnSpy();
        createDiagnostics().warn(PxDiagnosticKind.document, PxDiagnosticCode.effectsShape);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain('PX' + PxDiagnosticCode.effectsShape);
    });

    it('hands over to the handler INSTEAD of the console — taking it means owning it', () => {
        const warn = warnSpy();
        const onWarn = vi.fn();
        createDiagnostics({ onWarn }).warn(PxDiagnosticKind.usage, PxDiagnosticCode.timelineOverrideIgnored, { key: 'duration' });

        const d = onWarn.mock.calls[0][0] as PxDiagnostic;
        expect(d.code).toBe(PxDiagnosticCode.timelineOverrideIgnored);
        expect(d.kind).toBe(PxDiagnosticKind.usage);
        expect(d.data).toEqual([{ key: 'duration' }]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('labels the console fallback with the prefix AND the kind', () => {
        const warn = warnSpy();
        createDiagnostics(undefined, '[PixodeskSvgAnimator]').warn(PxDiagnosticKind.host, PxDiagnosticCode.noRootElement);

        const line = String(warn.mock.calls[0][0]);
        expect(line).toContain('[PixodeskSvgAnimator]');
        expect(line).toContain('host');
    });

    it('does NOT prefix the message handed to a handler', () => {
        // A caller feeding this into its own UI should not have to strip our tag.
        const onWarn = vi.fn();
        createDiagnostics({ onWarn }, '[PixodeskSvgAnimator]').warn(PxDiagnosticKind.host, PxDiagnosticCode.noRootElement);

        const d = onWarn.mock.calls[0][0] as PxDiagnostic;
        expect(d.message).not.toContain('[PixodeskSvgAnimator]');
        expect(d.kind).toBe(PxDiagnosticKind.host);
    });

    it('the message is the code and a link to the page — the description is NOT shipped', () => {
        const onWarn = vi.fn();
        createDiagnostics({ onWarn }).warn(PxDiagnosticKind.host, PxDiagnosticCode.scrollSubjectNoMatch, '#hero');

        const d = onWarn.mock.calls[0][0] as PxDiagnostic;
        expect(d.message).toBe('PX1304 https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/diagnostics.md#px1304');
        // The specifics ride in `data`, where a sentence would once have interpolated them.
        expect(d.data).toEqual(['#hero']);
    });

    it('passes every value the site gave, in order, to the console too', () => {
        const warn = warnSpy();
        createDiagnostics().warn(PxDiagnosticKind.host, PxDiagnosticCode.setAttributeNoElement, '#missing', { tried: 3 });

        expect(warn.mock.calls[0].slice(1)).toEqual(['#missing', { tried: 3 }]);
    });

    it('muteWarn switches the console fallback off — for a host that tolerates the chatter', () => {
        const warn = warnSpy();
        createDiagnostics({ muteWarn: true }).warn(PxDiagnosticKind.platform, PxDiagnosticCode.rnUnsupported);

        expect(warn).not.toHaveBeenCalled();
    });

    it('muteWarn is about the console, not about you — a handler you passed still fires', () => {
        const warn = warnSpy();
        const onWarn = vi.fn();
        createDiagnostics({ onWarn, muteWarn: true }).warn(PxDiagnosticKind.platform, PxDiagnosticCode.rnUnsupported);

        expect(onWarn).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
    });

    it('muteWarn leaves errors audible — the two switches are independent', () => {
        const warn = warnSpy();
        const error = errorSpy();
        const diag = createDiagnostics({ muteWarn: true });

        diag.warn(PxDiagnosticKind.platform, PxDiagnosticCode.rnUnsupported);
        diag.error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, new Error('still heard'));

        expect(warn).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);
    });
});

describe('createDiagnostics — kinds', () => {

    it('carries the kind through to the handler', () => {
        const seen: Array<string> = [];
        const diag = createDiagnostics({ onWarn: d => seen.push(d.kind) });

        diag.warn(PxDiagnosticKind.document, PxDiagnosticCode.effectsShape);
        diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.noRootElement);
        diag.warn(PxDiagnosticKind.platform, PxDiagnosticCode.rnUnsupported);
        diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.rateRejected);
        diag.warn(PxDiagnosticKind.internal, PxDiagnosticCode.animationBuildFailed);

        expect(seen).toEqual(['document', 'host', 'platform', 'usage', 'internal']);
    });

    it('the code is independent of the kind — one code, whichever kind the site chose', () => {
        const onWarn = vi.fn();
        const diag = createDiagnostics({ onWarn });

        diag.warn(PxDiagnosticKind.document, PxDiagnosticCode.scrollSubjectInvalid, 'a');
        diag.warn(PxDiagnosticKind.host, PxDiagnosticCode.scrollSubjectNoMatch, 'a');

        expect(onWarn.mock.calls.map(c => (c[0] as PxDiagnostic).code))
            .toEqual([PxDiagnosticCode.scrollSubjectInvalid, PxDiagnosticCode.scrollSubjectNoMatch]);
    });
});

describe('createDiagnostics — errors', () => {

    it('falls back to console.error when no handler is given', () => {
        const error = errorSpy();
        createDiagnostics().error(PxDiagnosticKind.host, PxDiagnosticCode.loadFailed, 'logo.json');

        expect(error).toHaveBeenCalledTimes(1);
        expect(String(error.mock.calls[0][0])).toContain('PX' + PxDiagnosticCode.loadFailed);
    });

    it('hands over to onError instead of the console, with the kind and the Error', () => {
        const error = errorSpy();
        const onError = vi.fn();
        createDiagnostics({ onError }).error(PxDiagnosticKind.document, PxDiagnosticCode.invalidDocumentAtSrc, new Error('invalid document'));

        const d = onError.mock.calls[0][0] as PxDiagnostic;
        expect(d.kind).toBe(PxDiagnosticKind.document);
        expect(d.code).toBe(PxDiagnosticCode.invalidDocumentAtSrc);
        expect(d.error).toBeInstanceOf(Error);
        expect(error).not.toHaveBeenCalled();
    });

    it('lifts an Error out of the data, so a handler always finds it on `error`', () => {
        // Was "normalizes a string into an Error": strings are gone, but the guarantee it
        // protected is the same — `error` is one shape, wherever the site put the Error.
        const onError = vi.fn();
        const thrown = new Error('plain failure');
        createDiagnostics({ onError }).error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, 'context first', thrown);

        const d = onError.mock.calls[0][0] as PxDiagnostic;
        expect(d.error).toBe(thrown);
        expect(d.data).toEqual(['context first', thrown]);
    });

    it('carries the component stack beside the Error — where React Native puts it', () => {
        const onError = vi.fn();
        const thrown = new Error('render failed');
        createDiagnostics({ onError }).error(PxDiagnosticKind.internal, PxDiagnosticCode.rnBoundaryCaught, thrown, '  in Rect');

        const d = onError.mock.calls[0][0] as PxDiagnostic;
        expect(d.error).toBe(thrown);                       // the real Error, stack included
        expect(d.data).toEqual([thrown, '  in Rect']);
    });

    it('an error with no Error at all still reports — the code alone is the diagnostic', () => {
        const onError = vi.fn();
        createDiagnostics({ onError }).error(PxDiagnosticKind.document, PxDiagnosticCode.invalidDocumentAtSrc, '/logo.json');

        const d = onError.mock.calls[0][0] as PxDiagnostic;
        expect(d.error).toBeUndefined();
        expect(d.code).toBe(PxDiagnosticCode.invalidDocumentAtSrc);
        expect(d.data).toEqual(['/logo.json']);
    });

    it('muteError switches the console fallback off but not the handler', () => {
        const error = errorSpy();
        const onError = vi.fn();
        createDiagnostics({ onError, muteError: true }).error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed);
        createDiagnostics({ muteError: true }).error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(error).not.toHaveBeenCalled();
    });

    it('muteError leaves warnings audible — the two switches are independent', () => {
        const warn = warnSpy();
        const error = errorSpy();
        const diag = createDiagnostics({ muteError: true });

        diag.error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, new Error('muted'));
        diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.rateRejected);

        expect(error).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('warnings and errors are independent channels', () => {
        const warn = warnSpy();
        const error = errorSpy();
        const onWarn = vi.fn();
        const diag = createDiagnostics({ onWarn });   // only warnings are handled

        diag.warn(PxDiagnosticKind.usage, PxDiagnosticCode.rateRejected);
        diag.error(PxDiagnosticKind.internal, PxDiagnosticCode.buildFailed, new Error('not handled'));

        expect(onWarn).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);       // the error still reaches the console
    });
});
