/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/** A deliberately ill-typed input — what a JS caller or a hand-edited file may hand an API — typed as what the API declares. The ONE cast the tests use, and only for input that is MEANT to be wrong (robustness tests). */
export function untyped<T>(value: unknown): T {
    return value as T;
}
