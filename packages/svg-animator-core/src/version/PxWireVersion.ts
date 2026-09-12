/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// WIRE FORMAT VERSION + THE PLAYER'S CONVERSIONS — `svgRoot.animator.version`, `"a.b[.c]"`.
//
//   a.b   THE PLAYER SCHEMA. A reader at `a.b` reads any file at `a.[b' <= b]`, converting
//         it forward through the steps below. `a` is a generation nothing bridges.
//   c     the EDITOR's extension, covering `meta.*` only. The player neither reads nor
//         compares it, and no step here may touch `meta.*`.
//
// WHY THIS LIVES IN THE LIBRARY, not the editor: the player ships standalone. A viewer opening
// a file has no editor to repair it first, so the code that understands the version and moves a
// document forward has to travel with the player. The editor then EXTENDS this — its own fixer
// runs `convertPlayerDocument` first and only afterwards touches `meta.*`:
//
//     editorFixer(json) { json = convertPlayerDocument(json).doc;  /* then meta.* steps */ }
//
// THE VERSION IS A DIAGNOSTIC, NOT A GATE. A gap on its own means nothing and must never warn:
// a bump says the SCHEMA gained something, not that THIS document uses it. A 1.5 file using no
// post-1.1 feature plays correctly and silently in a 1.1 player. The number is consulted in
// exactly two situations — a conversion needs it, or unknown content was actually met, where it
// turns "something is wrong" into "written for 1.5, this player reads 1.1; update the player".
//
// ABSENT means UNKNOWN, never "the oldest": nothing is assumed and nothing is migrated on a guess.
// ============================================================================

import { PX_PLAYER_SCHEMA_VERSION } from './PxSchemaVersion';

/** The wire key, under the animator config block. */
export const WIRE_VERSION_KEY = 'version';

const ANIMATOR_KEY = 'animator';
const META_KEY = 'meta';

/** Parsed form. Compare these, NEVER the strings: `"1.10" < "1.9"` lexically. */
export interface WireVersion {
    /** Generation. A change no conversion can bridge. */
    readonly a: number;
    /** Player schema revision within the generation. */
    readonly b: number;
    /** Editor extension revision, scoped to `(a,b)`. The player ignores it. */
    readonly c: number;
}

/** How a file's version relates to a reader's. */
export enum WireVersionRelation {
    /** No stamp — unknown provenance. Assume nothing, migrate nothing. */
    unstamped = 'unstamped',
    same = 'same',
    /** The file predates this reader. Any conversion its content needs may be applied. */
    older = 'older',
    /** The file is from a later build. Only meaningful once unknown content is actually met. */
    newer = 'newer',
    /** A different generation — no conversion path exists in either direction. */
    otherGeneration = 'otherGeneration',
}

const VERSION_RE = /^(\d+)\.(\d+)(?:\.(\d+))?$/;

/** `"1.2.3"` → `{a:1,b:2,c:3}`; a missing `c` is baseline 0. `undefined` when unparseable —
 *  treated exactly like an absent stamp, never as an error. */
export function parseWireVersion(raw: unknown): WireVersion | undefined {
    if (typeof raw !== 'string') return undefined;
    const m = VERSION_RE.exec(raw.trim());
    if (!m) return undefined;
    return { a: Number(m[1]), b: Number(m[2]), c: m[3] === undefined ? 0 : Number(m[3]) };
}

export function formatWireVersion(v: WireVersion): string {
    return v.a + '.' + v.b + '.' + v.c;
}

/** The version this PLAYER implements, parsed. `c` is 0: the player has no editor extension. */
export const PLAYER_WIRE_VERSION: WireVersion =
    parseWireVersion(PX_PLAYER_SCHEMA_VERSION) ?? { a: 1, b: 1, c: 0 };

/** The animator config block, at either of its two wire addresses: lifted to the top level in
 *  the lightweight JSON, carried under `meta` in a pre-rendered SVG. */
function getAnimatorBlock(doc: unknown): { [key: string]: unknown } | undefined {
    if (!doc || typeof doc !== 'object') return undefined;
    const atRoot = readObjectProp(doc, ANIMATOR_KEY);
    if (atRoot) return atRoot;
    const meta = readObjectProp(doc, META_KEY);
    return meta ? readObjectProp(meta, ANIMATOR_KEY) : undefined;
}

function readObjectProp(obj: object, key: string): { [key: string]: unknown } | undefined {
    const value = (obj as { [k: string]: unknown })[key];
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as { [key: string]: unknown }
        : undefined;
}

/** The version stamped on a document, or `undefined` when it carries none. */
export function readWireVersion(doc: unknown): WireVersion | undefined {
    const animator = getAnimatorBlock(doc);
    return animator ? parseWireVersion(animator[WIRE_VERSION_KEY]) : undefined;
}

/**
 * How `file` relates to `mine`. `readerReadsEditorPart` separates the two readers: the EDITOR
 * compares all three parts, the PLAYER compares only `a.b` and is blind to `c`.
 */
export function compareWireVersion(
    file: WireVersion | undefined, mine: WireVersion, readerReadsEditorPart: boolean,
): WireVersionRelation {
    if (!file) return WireVersionRelation.unstamped;
    if (file.a !== mine.a) return WireVersionRelation.otherGeneration;
    if (file.b !== mine.b) return file.b > mine.b ? WireVersionRelation.newer : WireVersionRelation.older;
    if (!readerReadsEditorPart || file.c === mine.c) return WireVersionRelation.same;
    return file.c > mine.c ? WireVersionRelation.newer : WireVersionRelation.older;
}

/**
 * What to TELL the user about a version gap — and only ever alongside unknown content actually
 * met. `undefined` means the version explains nothing, so nothing is said.
 *
 * Every gap has one of exactly two remedies: upgrade the file, or upgrade the reader. Neither is
 * a refusal — the reader has already dropped what it could not understand and the rest renders,
 * so the worst case is a document missing a feature plus a sentence saying how to close the gap.
 */
export function versionAdvice(
    relation: WireVersionRelation, file: WireVersion | undefined, mine: WireVersion, isPlayer: boolean,
): string | undefined {
    if (!file) return undefined;
    const target = isPlayer ? 'player' : 'editor';
    const gap = 'written for schema ' + formatWireVersion(file)
        + ', this ' + target + ' reads ' + formatWireVersion(mine);
    switch (relation) {
        case WireVersionRelation.newer:
            return 'This file is ' + gap + '. Update the ' + target + ' to open it fully.';
        case WireVersionRelation.older:
            // The unknown part is a spelling the format has since dropped, so the FILE is what
            // moves. Re-saving from this build rewrites it in the current spelling.
            return 'This file is ' + gap + '. Saving it from this ' + target
                + ' rewrites it in the current format.';
        case WireVersionRelation.otherGeneration:
            // No conversion path exists in either direction — so both remedies are named and the
            // user picks. Still not a refusal: what could be read has been.
            return 'This file is ' + gap + ' \u2014 a different format generation, which no conversion bridges.'
                + ' Open it in a ' + target
                + ' of that generation, or accept this document without the parts named above.';
        default:
            // `same` and `unstamped`: the version accounts for nothing here.
            return undefined;
    }
}


// ═══════════════════════════════════════════════════════════
// THE STEP TABLE
// ═══════════════════════════════════════════════════════════

/** What a step DOES to documents — and therefore whether it needs conversion code. */
export enum WireStepKind {
    /**
     * Only OPTIONAL fields were added. An older reader ignores them; a newer reader finds them
     * absent and defaults. Nothing to convert either way — but it must still be DECLARED, so
     * that "no converter" is a decision on the record rather than an omission.
     */
    additive = 'additive',
    /** A shape or spelling changed. `up` is then mandatory; `down` where it is possible at all. */
    converted = 'converted',
}

/** One `b` step of the player schema. */
export interface WireVersionStep {
    /** The version this step converts FROM, e.g. `'1.1'`. */
    readonly from: string;
    /** …and TO. Must be the `from` of the next step, so the table is one unbroken chain. */
    readonly to: string;
    /** Why the format moved — the sentence a future reader needs, not a commit hash. */
    readonly reason: string;
    readonly kind: WireStepKind;
    /**
     * Older → newer, MUTATING the document in place. Required for {@link WireStepKind.converted}.
     * It may not touch `meta.*`: that subtree is the editor's, and its steps are the `c` part.
     */
    readonly up?: (doc: Record<string, unknown>) => void;
    /** Newer → older. Absent means the step is one-way and down-conversion refuses. */
    readonly down?: (doc: Record<string, unknown>) => void;
}

/** Where the chain starts: the first RELEASED player schema. Everything older is pre-release. */
export const BASELINE_PLAYER_VERSION = '1.1';

/**
 * Every `b` step from {@link BASELINE_PLAYER_VERSION} to {@link PX_PLAYER_SCHEMA_VERSION}.
 *
 * EMPTY IS CORRECT TODAY: 1.1 is the baseline and nothing has moved since. It exists now because
 * the guard spec keys off it — bump `PX_PLAYER_SCHEMA_VERSION` without adding the matching step
 * and the suite fails naming the gap. That is the whole point: the last three renames shipped
 * because nothing forced anyone to say they had happened.
 */
export const PLAYER_WIRE_STEPS: ReadonlyArray<WireVersionStep> = [];


/** What a conversion pass did, so a caller can report it. */
export interface PlayerConversionResult {
    /**
     * The document to read. A converted COPY when steps applied, otherwise the input itself,
     * unchanged and identical by reference — the caller's object is never mutated, so a failed
     * or partial conversion can never leave a half-migrated document behind.
     */
    readonly doc: unknown;
    /** The version found on the file, if any. */
    readonly from: WireVersion | undefined;
    readonly relation: WireVersionRelation;
    /** The steps actually applied, oldest first. Empty when nothing was needed. */
    readonly applied: ReadonlyArray<WireVersionStep>;
    /** Set only when the version could not be honored — never a refusal to render. */
    readonly advice?: string;
}

/** Which table to run, and what to bring the document up TO. */
export interface WireConversionConfig {
    /** The step table — the player's, or the editor's `meta.*` one. */
    readonly steps: ReadonlyArray<WireVersionStep>;
    /** The version the document should end up at. */
    readonly target: WireVersion;
    /** `true` for the EDITOR (compares and stamps `c`), `false` for the PLAYER (blind to it). */
    readonly readerReadsEditorPart: boolean;
}

/**
 * THE STEP ENGINE — one implementation, two tables.
 *
 * The player runs it over `PLAYER_WIRE_STEPS`; the editor runs it a second time over its own
 * `meta.*` table, on the document the player pass returned. Keeping it one function is what
 * stops the two halves from drifting into two different ideas of what conversion means.
 *
 * It NEVER refuses and never throws:
 *   · unstamped   → nothing is assumed, nothing is converted; the file is read as it is.
 *   · newer / other generation → no step exists, so nothing is applied; `advice` says which way
 *                  to close the gap, and the caller renders whatever the schema could keep.
 *   · older       → the due steps run on a COPY. A step with no `up` is skipped; a step that
 *                  throws stops the chain, and the ORIGINAL comes back rather than a half-
 *                  converted one.
 */
export function applyWireSteps(doc: unknown, cfg: WireConversionConfig): PlayerConversionResult {
    const from = readWireVersion(doc);
    const relation = compareWireVersion(from, cfg.target, cfg.readerReadsEditorPart);
    if (!from || relation !== WireVersionRelation.older) {
        return {
            doc, from, relation, applied: [],
            advice: versionAdvice(relation, from, cfg.target, !cfg.readerReadsEditorPart),
        };
    }

    // Which steps this document actually needs, decided BEFORE anything is copied so the common
    // "older but nothing to do" case costs nothing. A step is due when the FILE is older than
    // what that step produces — the same comparison the reader itself uses.
    const due: Array<WireVersionStep> = [];
    for (const step of cfg.steps) {
        const stepTo = parseWireVersion(step.to);
        if (!stepTo) continue;
        if (compareWireVersion(from, stepTo, cfg.readerReadsEditorPart) !== WireVersionRelation.older) continue;
        if (!step.up) continue;   // additive, or one-way with no code
        due.push(step);
    }
    if (!due.length || !doc || typeof doc !== 'object') return { doc, from, relation, applied: [] };

    // Work on a COPY: a step that throws mid-way must not leave the caller's document
    // half-migrated, and callers routinely hold the parsed file for other purposes.
    const target = clonePlain(doc) as Record<string, unknown>;
    const applied: Array<WireVersionStep> = [];
    for (const step of due) {
        // One bad step degrades to "that step did not happen" — never to a failed open.
        try {
            step.up!(target);
            applied.push(step);
        } catch {
            break;   // stop at the first failure: later steps assume this one ran
        }
    }
    if (!applied.length) return { doc, from, relation, applied: [] };
    // The document now speaks the target schema, so it says so.
    stampVersion(target, cfg.target, cfg.readerReadsEditorPart);
    return { doc: target, from, relation, applied };
}

/**
 * BRING A DOCUMENT UP TO THIS PLAYER'S SCHEMA — the `playerFixer` half of the pair.
 * Runs {@link applyWireSteps} over {@link PLAYER_WIRE_STEPS}, touching nothing under `meta.*`.
 */
export function convertPlayerDocument(doc: unknown): PlayerConversionResult {
    return applyWireSteps(doc, {
        steps: PLAYER_WIRE_STEPS, target: PLAYER_WIRE_VERSION, readerReadsEditorPart: false,
    });
}

/** A structural copy of a parsed JSON document. `structuredClone` where the runtime has it
 *  (every browser the player targets, and Node 17+), else a JSON round trip — the input is
 *  parsed wire data either way, so both are lossless for it. */
function clonePlain<T>(value: T): T {
    const structured = (globalThis as { structuredClone?: (v: unknown) => unknown }).structuredClone;
    return structured ? structured(value) as T : JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Re-stamp a converted document with the version it now conforms to.
 *
 * A PLAYER pass moves `a.b` and PRESERVES the file's `c`: it did not touch `meta.*`, so it has
 * no business claiming the editor's extension moved with it. An EDITOR pass stamps all three.
 */
function stampVersion(doc: Record<string, unknown>, target: WireVersion, readerReadsEditorPart: boolean): void {
    const animator = getAnimatorBlock(doc);
    if (!animator) return;
    const previous = parseWireVersion(animator[WIRE_VERSION_KEY]);
    animator[WIRE_VERSION_KEY] = formatWireVersion({
        a: target.a, b: target.b,
        c: readerReadsEditorPart ? target.c : (previous ? previous.c : 0),
    });
}


// ═══════════════════════════════════════════════════════════
// DOWN-CONVERSION (task 6.7)
// ═══════════════════════════════════════════════════════════

/**
 * What an EXPLICIT down-conversion did. Unlike reading, this may refuse — it is an output the
 * user asked for ("save for an older player"), and handing back a file that silently lacks what
 * the older schema cannot say would be worse than saying no.
 */
export type WireDowngradeResult =
    | { readonly ok: true; readonly doc: unknown; readonly applied: ReadonlyArray<WireVersionStep> }
    | { readonly ok: false; readonly reason: string; readonly blocking: ReadonlyArray<WireVersionStep> };

/** Which table to walk BACK through, from the version the document is at to the one wanted. */
export interface WireDowngradeConfig {
    readonly steps: ReadonlyArray<WireVersionStep>;
    /** The version the document must end up at. */
    readonly target: WireVersion;
    /** `true` for the editor table (`c` steps), `false` for the player table (`b` steps). */
    readonly readerReadsEditorPart: boolean;
}

/**
 * BRING A DOCUMENT DOWN TO AN OLDER SCHEMA — only when EVERY step in between can be undone.
 *
 * All or nothing: if even one step on the way back has no `down` (the shape rework never will —
 * its old shell had one clock and cannot express per-parameter animation), the whole request is
 * refused and the reason names those steps. A partial downgrade is never produced, and the
 * caller's document is never mutated — the work happens on a copy.
 */
export function applyWireStepsDown(doc: unknown, cfg: WireDowngradeConfig): WireDowngradeResult {
    const from = readWireVersion(doc);
    if (!from) {
        return { ok: false, blocking: [], reason: 'The document carries no version, so there is nothing to convert down from.' };
    }
    const relation = compareWireVersion(from, cfg.target, cfg.readerReadsEditorPart);
    if (relation === WireVersionRelation.otherGeneration) {
        return {
            ok: false, blocking: [],
            reason: 'Schema ' + formatWireVersion(from) + ' and ' + formatWireVersion(cfg.target)
                + ' are different generations; no conversion bridges them.',
        };
    }
    // Already at (or older than) the target: nothing to undo.
    if (relation !== WireVersionRelation.newer) return { ok: true, doc, applied: [] };

    // Every step whose RESULT is newer than the target must be undone, newest first.
    const toUndo: Array<WireVersionStep> = [];
    for (const step of cfg.steps) {
        const stepTo = parseWireVersion(step.to);
        if (!stepTo) continue;
        if (compareWireVersion(stepTo, cfg.target, cfg.readerReadsEditorPart) !== WireVersionRelation.newer) continue;
        if (compareWireVersion(stepTo, from, cfg.readerReadsEditorPart) === WireVersionRelation.newer) continue;
        toUndo.push(step);
    }
    toUndo.reverse();

    // Additive steps need no `down`: an older reader simply ignores what they added.
    const blocking = toUndo.filter(s => s.kind === WireStepKind.converted && !s.down);
    if (blocking.length) {
        return {
            ok: false, blocking,
            reason: 'Cannot convert down to ' + formatWireVersion(cfg.target) + ': '
                + blocking.map(s => s.from + ' → ' + s.to + ' (' + s.reason + ')').join('; ')
                + ' cannot be undone.',
        };
    }

    const target = clonePlain(doc) as Record<string, unknown>;
    const applied: Array<WireVersionStep> = [];
    for (const step of toUndo) {
        if (!step.down) continue;   // additive
        try {
            step.down(target);
            applied.push(step);
        } catch (e) {
            // Output path: a half-downgraded file is exactly what this function exists to avoid.
            return {
                ok: false, blocking: [step],
                reason: 'Undoing ' + step.from + ' → ' + step.to + ' failed: ' + String(e),
            };
        }
    }
    stampVersion(target, cfg.target, cfg.readerReadsEditorPart);
    return { ok: true, doc: target, applied };
}

/** Down-convert through the PLAYER table only — `meta.*` is untouched, as on the way up. */
export function downgradePlayerDocument(doc: unknown, target: WireVersion): WireDowngradeResult {
    return applyWireStepsDown(doc, { steps: PLAYER_WIRE_STEPS, target, readerReadsEditorPart: false });
}
