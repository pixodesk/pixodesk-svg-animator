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
// Severity (warn vs error) and SOURCE (`kind`) are separate axes on purpose: `invalid animation
// document format` is a document problem AND fatal, while an effects-shape warning is a document
// problem that still plays. Splitting the callbacks by source would have produced four handlers
// and forced anyone who just wants everything to wire all of them.

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

/** One thing a player has to say. @public */
export interface PxDiagnostic {
    /** Who can act on it — see {@link PxDiagnosticKind}. */
    readonly kind: PxDiagnosticKind;
    /** Human-readable, and never carries the console prefix. */
    readonly message: string;
    /**
     * Whatever the site had to hand: the offending binding, the element map, the raw error —
     * or, for a React Native render failure, `{ componentStack }`.
     */
    readonly detail?: unknown;
    /** Present on errors: the Error that stopped the player. Its message is `message`. */
    readonly error?: Error;
}

/**
 * Where a player sends what it wants to say. Every field is optional.
 *
 * The SHARED base of every callbacks object (API-SURFACE-REVIEW.md §26.1): `createDiagnostics` reads it directly,
 * `PxEngineCallbacks` extends it with the playback lifecycle, `PxAnimatorCallbacks` adds `onStop`
 * on top — so the four diagnostics fields are spelled once, here.
 * @public
 */
export interface PxDiagnosticsConfig {

    /**
     * IT PLAYS, but something was ignored, degraded or misspelled — an unknown easing, an
     * override that could not apply, an attribute the platform will not animate. Each
     * diagnostic says WHO can act on it via `kind` (`document` / `host` / `platform` / `usage` /
     * `internal`). Without this: `console.warn`.
     */
    onWarn?: (diagnostic: PxDiagnostic) => void;

    /**
     * THIS INSTANCE WILL NOT PLAY — the document failed to load, parse or build, or the render
     * threw: nothing rendered, `isReady()` false, the component's `fallback` shown. The player
     * stays inert rather than throwing at the caller. `diagnostic.error` is the Error; on React
     * Native `diagnostic.detail` carries `{ componentStack }` when the error boundary caught it.
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
    /** Report something survivable — it plays. */
    warn(kind: PxDiagnosticKind, message: string, detail?: unknown): void;
    /** Report a failure that stopped this instance — it will not play. */
    error(kind: PxDiagnosticKind, error: Error | string, detail?: unknown): void;
}

/** Anything not already an Error becomes one, so handlers get a single shape. */
function asError(error: Error | string): Error {
    return typeof error === 'string' ? new Error(error) : error;
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
        warn: (kind: PxDiagnosticKind, message: string, detail?: unknown): void => {
            if (config?.onWarn) { config.onWarn({ kind, message, detail }); return; }
            if (config?.muteWarn) return;
            const line = tag + kind + ': ' + message;
            if (detail === undefined) console.warn(line);
            else console.warn(line, detail);
        },
        error: (kind: PxDiagnosticKind, error: Error | string, detail?: unknown): void => {
            const err = asError(error);
            if (config?.onError) { config.onError({ kind, message: err.message, error: err, detail }); return; }
            if (config?.muteError) return;
            const line = tag + kind + ': ' + err.message;
            if (detail === undefined) console.error(line);
            else console.error(line, detail);
        },
    };
}
