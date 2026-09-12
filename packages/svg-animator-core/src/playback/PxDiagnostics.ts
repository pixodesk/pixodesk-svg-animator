/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE diagnostics channel for every player (API review §5).
//
// Before this, only React Native had an error channel (`onError` + `fallback`). The web player
// sent a failed fetch or an invalid document to `console.error` and then answered
// `isReady() === false` for ever, and React and Vue could not offer anything at all because
// `PxAnimatorCallbacksConfig` had no slot for it. Everything else — validation warnings, config
// overrides, unsupported attributes — went straight to `console.warn`, where an embedding app
// could neither see it nor quiet it.
//
// The rule:
//
//   - a player WARNS and carries on; it does not throw at the caller;
//   - if a handler is given, it receives the diagnostic and the console stays out of it —
//     handing it over means taking it over;
//   - with no handler, the console is the fallback, so nothing is lost by default;
//   - `silent` suppresses only that console fallback, never the handlers.
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

/** One thing a player has to say. */
export interface PxDiagnostic {
    /** Who can act on it — see {@link PxDiagnosticKind}. */
    readonly kind: PxDiagnosticKind;
    /** Human-readable, and never carries the console prefix. */
    readonly message: string;
    /** Whatever the site had to hand: the offending binding, the element map, the raw error. */
    readonly detail?: unknown;
    /** Present on errors. The same text as `message`. */
    readonly error?: Error;
}

/** Where a player sends what it wants to say. Every field is optional. */
export interface PxDiagnosticsConfig {

    /** Something is off, but the animation still plays. Without this: `console.warn`. */
    onWarn?: (diagnostic: PxDiagnostic) => void;

    /**
     * The animation could not be produced at all. The player stays inert rather than throwing
     * at the caller. Without this: `console.error`.
     */
    onError?: (diagnostic: PxDiagnostic) => void;

    /**
     * Suppress the console FALLBACK — `true` for everything, or just the kinds listed (so you
     * can quiet `platform` chatter and still hear about `document` problems).
     *
     * Handlers above still fire either way: this is not a mute button.
     */
    silent?: boolean | ReadonlyArray<PxDiagnosticKind>;
}

/** The reporting channel a player writes to. */
export interface PxDiagnostics {
    /** Report something survivable. */
    warn(kind: PxDiagnosticKind, message: string, detail?: unknown): void;
    /** Report a failure that stopped the animation. */
    error(kind: PxDiagnosticKind, error: Error | string): void;
}

/** Anything not already an Error becomes one, so handlers get a single shape. */
function asError(error: Error | string): Error {
    return typeof error === 'string' ? new Error(error) : error;
}

/** Is the console fallback switched off for this kind? */
function isSilenced(silent: PxDiagnosticsConfig['silent'], kind: PxDiagnosticKind): boolean {
    if (!silent) return false;
    return silent === true || silent.includes(kind);
}

/**
 * Builds the channel a player reports through.
 *
 * `prefix` labels the console fallback (e.g. `'[PixodeskSvgAnimator]'`) and is NOT added to the
 * diagnostic handed to a handler — a caller that wants to prefix its own log can, and one
 * feeding a UI should not have to strip ours.
 */
export function createDiagnostics(config?: PxDiagnosticsConfig, prefix?: string): PxDiagnostics {
    const tag = prefix ? prefix + ' ' : '';
    return {
        warn: (kind: PxDiagnosticKind, message: string, detail?: unknown): void => {
            if (config?.onWarn) { config.onWarn({ kind, message, detail }); return; }
            if (isSilenced(config?.silent, kind)) return;
            const line = tag + kind + ': ' + message;
            if (detail === undefined) console.warn(line);
            else console.warn(line, detail);
        },
        error: (kind: PxDiagnosticKind, error: Error | string): void => {
            const err = asError(error);
            if (config?.onError) { config.onError({ kind, message: err.message, error: err }); return; }
            if (isSilenced(config?.silent, kind)) return;
            console.error(tag + kind + ': ' + err.message);
        },
    };
}
