/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The player's schema version, alone in its own file: a bump is a one-line diff that nothing
// else rides along with. It must stay import-free (the pre-rendered builds load it).
// How and when to bump it: dev-docs/versioning.md.

/**
 * THE PLAYER'S WIRE SCHEMA VERSION — the `a.b` of `svgRoot.animator.version`.
 *
 *   `a`  a generation; no conversion bridges one to another.
 *   `b`  a revision within the generation. THIS player reads any file at `a.[b' <= b]`.
 *
 * A document may carry a third part (`a.b.c`) — the EDITOR's extension revision, covering
 * everything under `meta.*`. The player neither reads nor compares it.
 *
 * NOT the library's npm version, and never derived from it: the library ships far more often
 * than the format changes, so tying the two would make every release look like a format change
 * and every format change invisible between releases.
 */
export const PX_PLAYER_SCHEMA_VERSION = '1.1';
