/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE diagnostics channel for every player (API review §5, §25.1).
//
// Before this, only React Native had an error channel (`onError` + `fallback`). The web player
// sent a failed fetch or an invalid document to `console.error` and then answered
// `isReady() === false` for ever, and React and Vue could not offer anything at all because
// the engine callbacks had no slot for it. Everything else — validation warnings, config
// overrides, unsupported attributes — went straight to `console.warn`, where an embedding app
// could neither see it nor quiet it.
//
// THE RULE — two severities, one meaning each, on every player:
//
//   - `onError`: THIS INSTANCE WILL NOT PLAY. Nothing is rendered, `isReady()` stays false,
//     the component shows its `fallback`. The player reports it and stays inert rather than
//     throwing at the caller — a throw would land in a fetch callback or a render, where no
//     one can catch it. (A wrong CALL — `createAnimator()` with neither `src` nor `doc` — still
//     throws: that is a bug at the call site, found the moment the line runs.)
//   - `onWarn`: IT PLAYS, but something was ignored, degraded or misspelled — an unknown
//     easing, an override that could not apply, an attribute the platform will not animate.
//
//   - a handler takes over from the console: give `onWarn` / `onError` and the console stays
//     out of it; give none and the console is the fallback, so nothing is lost by default;
//   - `muteWarn` / `muteError` switch that console fallback off — for a host that knows
//     about the warnings and is prepared to tolerate them. A handler you passed still fires.
//
// Severity (warn vs error) and SOURCE (`kind`) are separate axes on purpose: an invalid document
// is a document problem AND fatal, while an effects-shape warning is a document problem that
// still plays. Splitting the callbacks by source would have produced four handlers and forced
// anyone who just wants everything to wire all of them.
//
// THE TEXT IS NOT SHIPPED. A diagnostic carries a NUMBER (`PxDiagnosticCode`) and the values the
// site had (`data`); the words live in docs/diagnostics.md, generated from the enum's comments,
// and every diagnostic links to it. See PxDiagnosticCode.ts for why, and for the rules on
// adding one.

import type { PxDiagnosticCode } from './PxDiagnosticCode';

/**
 * Who can do something about a diagnostic.
 *
 * A const object rather than a TypeScript `enum`: consumers compare against these values, so
 * they must accept plain string literals too (the same pattern as `PxControlMode`).
 * @public
 */
export const PxDiagnosticKind = {
    /** The document is wrong — regenerate or repair the file. */
    document: 'document',
    /** The page or app cannot provide what the document asks for — fix the mount. */
    host: 'host',
    /** The platform cannot do it and the player degraded — usually nothing to fix. */
    platform: 'platform',
    /** The call is wrong or self-contradictory — fix the options or props you passed. */
    usage: 'usage',
    /** The player failed where it did not expect to — report it to us. */
    internal: 'internal',
} as const;
export type PxDiagnosticKind = typeof PxDiagnosticKind[keyof typeof PxDiagnosticKind];

/** Where the words behind a code live. One string, shared by every diagnostic. */
const DOCS_URL = 'https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/diagnostics.md';

/** `PX1204 https://…/diagnostics.md#px1204` — the code, and where to read what it means. */
function codeLine(code: PxDiagnosticCode): string {
    return 'PX' + code + ' ' + DOCS_URL + '#px' + code;
}

/**
 * One thing a player has to say.
 *
 * The TEXT is not here, and is not in the bundle: `code` identifies the diagnostic and
 * {@link https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/diagnostics.md the
 * codes page} carries the description. That is the trade this library makes — a smaller
 * download, and a stable number you can switch on instead of matching a sentence that may be
 * reworded. The specifics are in `data`.
 * @public
 */
export interface PxDiagnostic {
    /** WHICH diagnostic this is — a permanent number; look it up on the codes page. */
    readonly code: PxDiagnosticCode;
    /** Who can act on it — see {@link PxDiagnosticKind}. */
    readonly kind: PxDiagnosticKind;
    /**
     * What the site had to hand, in the order the code's `@data` lists: a selector, a URL, the
     * offending binding, an inner problem. Everything a sentence would have interpolated.
     */
    readonly data?: ReadonlyArray<unknown>;
    /** The code and a link to its description — NOT the description itself, which is not shipped. */
    readonly message: string;
    /** Present on errors: the Error that stopped the player. */
    readonly error?: Error;
}

/**
 * Where a player sends what it wants to say. Every field is optional.
 *
 * The SHARED base of every callbacks object (dev-docs/reviews/api-surface-review.md §26.1): `createDiagnostics` reads it directly,
 * `PxEngineCallbacks` extends it with the playback lifecycle, `PxAnimatorCallbacks` adds `onStop`
 * on top — so the four diagnostics fields are spelled once, here.
 * @public
 */
export interface PxDiagnosticsConfig {

    /**
     * IT PLAYS, but something was ignored, degraded or misspelled — an unknown easing, an
     * override that could not apply, an attribute the platform will not animate. Each
     * diagnostic says WHAT happened via `code` (a number — look it up on the codes page) and
     * WHO can act on it via `kind` (`document` / `host` / `platform` / `usage` / `internal`);
     * `data` carries the values the site had. Without this: `console.warn`.
     */
    onWarn?: (diagnostic: PxDiagnostic) => void;

    /**
     * THIS INSTANCE WILL NOT PLAY — the document failed to load, parse or build, or the render
     * threw: nothing rendered, `isReady()` false, the component's `fallback` shown. The player
     * stays inert rather than throwing at the caller. `diagnostic.error` is the Error; on React
     * Native `diagnostic.data` carries the component stack when the error boundary caught it.
     * Without this: `console.error`.
     */
    onError?: (diagnostic: PxDiagnostic) => void;

    /**
     * Switch the `console.warn` fallback off. For a host that knows the player has something
     * to say about this document and is prepared to tolerate it — a chatty player is not what
     * an end user's console is for. A handler you passed (`onWarn`) still fires: mute is
     * about the console, not about you.
     */
    muteWarn?: boolean;

    /** The same switch for the `console.error` fallback. `onError` still fires. */
    muteError?: boolean;
}

/** The reporting channel a player writes to. @public */
export interface PxDiagnostics {
    /** Report something survivable — it plays. `data` is whatever the code's `@data` names. */
    warn(kind: PxDiagnosticKind, code: PxDiagnosticCode, ...data: Array<unknown>): void;
    /**
     * Report a failure that stopped this instance — it will not play. An `Error` anywhere in
     * `data` becomes the diagnostic's `error`, so a site can pass it wherever it reads best.
     */
    error(kind: PxDiagnosticKind, code: PxDiagnosticCode, ...data: Array<unknown>): void;
}

/** The Error a site passed, if it passed one — handlers get it on `error` as well as in `data`. */
function errorIn(data: ReadonlyArray<unknown>): Error | undefined {
    return data.find((d): d is Error => d instanceof Error);
}

/**
 * Builds the channel a player reports through.
 *
 * `prefix` labels the console fallback (e.g. `'[PixodeskSvgAnimator]'`) and is NOT added to the
 * diagnostic handed to a handler — a caller that wants to prefix its own log can, and one
 * feeding a UI should not have to strip ours.
 * @internal
 */
export function createDiagnostics(config?: PxDiagnosticsConfig, prefix?: string): PxDiagnostics {
    const tag = prefix ? prefix + ' ' : '';
    return {
        warn: (kind: PxDiagnosticKind, code: PxDiagnosticCode, ...data: Array<unknown>): void => {
            const message = codeLine(code);
            if (config?.onWarn) { config.onWarn({ code, kind, data, message }); return; }
            if (config?.muteWarn) return;
            console.warn(tag + kind + ' ' + message, ...data);
        },
        error: (kind: PxDiagnosticKind, code: PxDiagnosticCode, ...data: Array<unknown>): void => {
            const message = codeLine(code);
            const error = errorIn(data);
            if (config?.onError) { config.onError({ code, kind, data, message, error }); return; }
            if (config?.muteError) return;
            console.error(tag + kind + ' ' + message, ...data);
        },
    };
}
