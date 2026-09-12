/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ONE diagnostics channel for every player (API review §5).
//
// Before this, only React Native had an error channel (`onError` + `fallback`). The web player
// sent a failed fetch or an invalid document to `console.error` and then answered
// `isReady() === false` forever, and React and Vue could not offer anything at all because
// `PxAnimatorCallbacksConfig` had no slot for it. Everything else — validation warnings, config
// overrides, unsupported attributes — went straight to `console.warn`, where an embedding app
// could neither see it nor quiet it.
//
// The rule here:
//
//   - a player WARNS and carries on; it does not throw at the caller;
//   - if a handler is given, it receives the message and the console stays out of it —
//     handing it over means taking it over;
//   - with no handler, the console is the fallback, so nothing is lost by default;
//   - `silent` suppresses only that console fallback, never the handlers.

/** Where a player sends what it wants to say. Every field is optional. */
export interface PxDiagnosticsConfig {

    /**
     * Something is off, but the animation still plays — an unknown easing, a config key that
     * could not be applied, an attribute the browser will not animate.
     */
    onWarn?: (message: string, detail?: unknown) => void;

    /**
     * The animation could not be produced at all: a document that failed to load or parse, or
     * a render that threw. The player stays inert rather than throwing at the caller.
     */
    onError?: (error: Error) => void;

    /** Suppress the console FALLBACK. Handlers above still fire — this is not a mute button. */
    silent?: boolean;
}

/** The reporting channel a player writes to. */
export interface PxDiagnostics {
    /** Report something survivable. */
    warn(message: string, detail?: unknown): void;
    /** Report a failure that stopped the animation. */
    error(error: Error | string): void;
}

/** Anything not already an Error becomes one, so handlers get a single shape. */
function asError(error: Error | string): Error {
    return typeof error === 'string' ? new Error(error) : error;
}

/**
 * Builds the channel a player reports through.
 *
 * `prefix` labels the console fallback (e.g. `'[PixodeskSvgAnimator]'`) and is NOT added to the
 * message handed to a handler — a caller that wants to prefix its own log can, and one feeding
 * a UI should not have to strip ours.
 */
export function createDiagnostics(config?: PxDiagnosticsConfig, prefix?: string): PxDiagnostics {
    const tag = prefix ? prefix + ' ' : '';
    return {
        warn: (message: string, detail?: unknown): void => {
            if (config?.onWarn) { config.onWarn(message, detail); return; }
            if (config?.silent) return;
            if (detail === undefined) console.warn(tag + message);
            else console.warn(tag + message, detail);
        },
        error: (error: Error | string): void => {
            const err = asError(error);
            if (config?.onError) { config.onError(err); return; }
            if (config?.silent) return;
            console.error(tag + err.message);
        },
    };
}
