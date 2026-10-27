// @px-area config
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * PER-INSTANCE CONFIG OVERRIDE.
 *
 * One document, played twice on a page with different timing — without editing the document.
 * The host supplies a partial `animator` config; this merges it over the document's own.
 *
 * Base semantics are JSON Merge Patch (RFC 7386): objects merge per level, primitives and
 * arrays REPLACE, and `null` DELETES. `null` is the right sentinel because it is not a legal
 * value anywhere in the schema, and deleting is the only way to restore a meaningful ABSENCE
 * (`timeline.type` absent = time, `engine` absent = auto, `playFinishAction` absent = hold).
 *
 * Six places need more than that — see the RULE comments below.
 *
 * WHY THE WIRE FORM, not the flat runtime view: `nestAnimatorTimeline` is a no-op on anything
 * that already carries `timeline`, and the round-trip is lossy (`iterations:'infinite'` on the
 * scroll branch, `pin:false`, and an empty time block emitting no `timeline` at all). Merging
 * on the nested form is the only place those values mean what they say.
 */
import { PX_TIMELINE_SHARED_KEYS, PX_TIME_ONLY_TIMELINE_KEYS } from '../format/PxAnimatorConstants';
import type { PxDocument, PxAnimatorConfig, PxTimeline, PxTrigger } from '../format/PxAnimatorTypes';
import { legacyAnimatorOf } from '../format/PxDocStage';

/**
 * A JSON merge patch over a wire type `T`, the way {@link mergeAnimatorConfig} applies one (RFC 7386):
 * every key optional at every depth, `null` at a key deletes it, arrays and primitives replace.
 * Distributes over a union, so a patch of `PxTimeline` is a patch of the time OR the scroll member —
 * and TypeScript names a misspelled key or a wrong value where a plain record said nothing.
 * @public
 */
export type PxPatch<T> =
    T extends ReadonlyArray<unknown> ? T :
    T extends object ? { [K in keyof T]?: PxPatch<T[K]> | null } :
    T;

/** `Omit` applied to each member of a union, so a discriminated union keeps its members. */
type PxDistributiveOmit<T, K extends PropertyKey> = T extends object ? Omit<T, K> : never;

/** A deep-partial of the WIRE animator config (`timeline` — its `trigger` included at this level —,
 *  `definitions`, `bindings`, `version`), typed from the schema; `null` at any slot deletes it. @public */
export type PxAnimatorConfigPatch = PxPatch<PxAnimatorConfig> | null;

/** @public */
export interface PxAnimatorConfigMergeResult {
    /** The merged WIRE config, or `undefined` when there is nothing left of it. */
    config: PxAnimatorConfig | undefined;
    /** Human-readable problems, `path: what is wrong`. Empty when the merge was clean. */
    warnings: Array<string>;
}

/** Keys that live only on the flat RUNTIME view and have no slot on the wire. */
const FLAT_ONLY_KEYS = [
    'timelineSource', 'scroll', 'trigger', 'delay', 'iterations',
    'direction', 'fill', 'resetOnFinish', 'duration', 'mode', 'frameRate',
];

/** One level of a JSON object — what a merge patch and the configs it merges are made of. */
type JsonRecord = Record<string, unknown>;

const isPlainObject = (v: unknown): v is JsonRecord =>
    !!v && typeof v === 'object' && !Array.isArray(v);

/** Absent `type` means the time-driven timeline, so compare the normalized values (RULE 2). */
const timelineTypeOf = (t: unknown): string =>
    (isPlainObject(t) && typeof t.type === 'string') ? t.type : 'time';

const isScrollish = (type: string): boolean => type === 'scroll' || type === 'view';

/**
 * RFC 7386 merge with no special cases. Used for every sub-object that has no rule of its own
 * (`trigger`, `range`, `definitions.fonts`, …), which is why patching one font leaves its
 * siblings alone. Arrays are values: a patched `bindings` list replaces the document's whole list.
 */
function mergePlain(base: unknown, patch: JsonRecord): JsonRecord {
    const out: JsonRecord = isPlainObject(base) ? { ...base } : {};
    for (const key of Object.keys(patch)) {
        const value = patch[key];
        if (value === null) { delete out[key]; continue; }          // RULE 7: null deletes
        if (isPlainObject(value)) { out[key] = mergePlain(out[key], value); continue; }
        out[key] = value;                                            // RULE 6: arrays/primitives replace
    }
    return out;
}

/**
 * The timeline, which is a discriminated union and therefore cannot be merged blindly.
 *
 * RULE 1 — the patch names a DIFFERENT type: replace the timeline outright, carrying over only
 *          the keys both members share. Merging instead would strand `trigger`/`delay` on a
 *          scroll timeline, where the format has no slot for them.
 * RULE 2 — same type, or the patch does not mention one: merge. A patch that spells
 *          `type: 'time'` against a document with an ABSENT type must count as a match, hence
 *          the normalization above.
 * RULE 3 — time-only keys landing on a scroll/view timeline are dropped with a warning, the
 *          same way the wire has no slot for them.
 * RULE 4 — `iterations: 'infinite'` cannot map onto a scroll range.
 */
function mergeTimeline(base: unknown, patch: JsonRecord, warn: (m: string) => void): JsonRecord {
    const baseType = timelineTypeOf(base);
    const patchType = typeof patch.type === 'string' ? patch.type : baseType;

    let merged: JsonRecord;
    if (patchType !== baseType) {
        // RULE 1
        const carried: JsonRecord = {};
        if (isPlainObject(base)) {
            for (const k of PX_TIMELINE_SHARED_KEYS) {
                if (base[k] !== undefined) carried[k] = base[k];
            }
        }
        merged = mergePlain(carried, patch);
    } else {
        merged = mergePlain(base, patch);   // RULE 2
    }

    if (isScrollish(patchType)) {
        for (const k of PX_TIME_ONLY_TIMELINE_KEYS) {                // RULE 3
            if (merged[k] === undefined) continue;
            warn('animator.timeline.' + k + ": no slot on a '" + patchType + "' timeline — dropped");
            delete merged[k];
        }
        if (merged.iterations === 'infinite') {                       // RULE 4
            warn("animator.timeline.iterations: 'infinite' cannot map onto a scroll range — dropped");
            delete merged.iterations;
        }
    }
    return merged;
}

/** `PxTimeline` without its `trigger` block — the timing. On the props the two are separate (the file
 *  nests them): `timeline` patches this, `playOnTrigger` carries the trigger (D4). @public */
export type PxTimelineWithoutTrigger = PxDistributiveOmit<PxTimeline, 'trigger'>;

/** A deep-partial of the WIRE timing block, typed from the schema; `null` at any slot deletes it,
 *  `null` for the whole block deletes the block. No `trigger` here — that is the trigger pair's. @public */
export type PxTimelinePatch = PxPatch<PxTimelineWithoutTrigger> | null;

/**
 * The playback-override props every surface takes — `createSvgAnimationPlayer` and the three components
 * (dev-docs/plans/component-api.md D4): `timeline`, a MERGE over the file's timing block. Corrections —
 * `iterations`, `delay` — never a replacement; whoever needs more edits the document. The trigger is not
 * here: it travels with its driver, `playOnTrigger` ({@link PxControlProps}). ONE definition (review §9).
 * @public
 */
export interface PxPlaybackOverride {
    /**
     * Per-instance adjustment of the document's `animator.timeline` — the same shape as `timeline` in
     * docs/format/README.md minus `trigger`, deep-merged over what the document says, so one file can play
     * twice on a page with different timing. `null` at a slot DELETES that key, restoring the default its
     * absence means (an absent `outTime` is the content's end, an absent `playDuration` natural speed).
     */
    timeline?: PxTimelinePatch;
}

/** What {@link applyPlaybackOverride} reads: the timing patch, and the trigger driver's object form. @public @advanced */
export interface PxPlaybackOverrideInput extends PxPlaybackOverride {
    /** `true` — the document's trigger drives; an object — the WHOLE trigger to use instead (see {@link PxControlProps}). */
    playOnTrigger?: boolean | PxTrigger;
}

/** What {@link applyPlaybackOverride} reports beside the document. @public @advanced */
export interface PxPlaybackOverrideResult {
    doc: PxDocument;
    /** The merge's complaints — a key with no slot, a type change — to report as `timelineOverrideIgnored`. */
    warnings: Array<string>;
}

// @px-area config
/**
 * Applies the playback override to a document — ONE implementation for the web player and the three
 * components (D4): `timeline` merged with the timeline rules (`mergeAnimatorConfig`); then, when
 * `playOnTrigger` is an object, the trigger block SET to it — a REPLACEMENT, because a trigger's keys belong
 * together (hover → click changes the other lists too). PURE: the document is
 * never mutated, untouched subtrees are shared. The caller reports `warnings` through its diagnostics.
 * @public @advanced
 */
export function applyPlaybackOverride(doc: PxDocument, override: PxPlaybackOverrideInput): PxPlaybackOverrideResult {
    const { timeline, playOnTrigger } = override;
    const warnings: Array<string> = [];
    const apply = (patch: PxAnimatorConfigPatch): void => {
        const applied = applyAnimatorConfig(doc, patch);
        warnings.push(...applied.warnings);
        doc = applied.doc;
    };
    if (timeline !== undefined) {
        // a JS caller can still hand over the old JSON string — reported, never written into the document
        if (timeline === null || isPlainObject(timeline)) apply({ timeline });
        else warnings.push('timeline: not an object — ignored');
    }
    if (typeof playOnTrigger === 'object' && playOnTrigger !== null) doc = withTrigger(doc, playOnTrigger);   // a SET, not a merge
    return { doc, warnings };
}

/** A patch assembled from parsed JSON (a record spread) — UNCHECKED like `uncheckedConfig`: the merge validates
 *  nothing, the document's `checked` stage repairs and reports what does not fit. */
const uncheckedPatch = (p: JsonRecord): PxAnimatorConfigPatch => p as PxAnimatorConfigPatch;

/**
 * The document with its `timeline.trigger` SET to `trigger` — not merged: an empty block (`{}`, "nothing starts
 * it") and a replacement that drops keys both need a set, which a merge patch cannot say. Returns a new
 * document sharing every untouched subtree; the animator lives at either of its two addresses.
 * @public @advanced
 */
export function withTrigger(doc: PxDocument, trigger: PxTrigger): PxDocument {
    const legacy = legacyAnimatorOf(doc);
    const atRoot = isPlainObject(doc.animator);
    const current: unknown = atRoot ? doc.animator : legacy;
    const base: JsonRecord = isPlainObject(current) ? current : {};
    const timeline: JsonRecord = isPlainObject(base.timeline) ? base.timeline : {};
    const animator: JsonRecord = { ...base, timeline: { ...timeline, trigger: { ...trigger } } };
    if (!atRoot && legacy !== undefined) {
        const meta = isPlainObject(doc.meta) ? doc.meta : {};
        return { ...doc, meta: { ...meta, animator } };
    }
    return { ...doc, animator: uncheckedConfig(animator) };
}

/**
 * The "nobody named a driver" rule (first-use review §1+2): the document's trigger is replaced by an EMPTY one —
 * no event starts it — on top of the caller's override, so the document cannot start itself. One spelling for
 * the web player's missing `playOnTrigger` option and the components' non-`playOnTrigger` control modes.
 * @public @advanced
 */
export function withoutTriggerDriver(doc: PxDocument): PxDocument {
    return withTrigger(doc, {});
}

/**
 * Merge a patch over an animator config. PURE — neither argument is mutated, and the result is
 * always a NEW object, which also matters because a prepared document trusts its stamped runtime
 * view only while it holds the SAME config object: a new object makes readers resolve afresh.
 * @public
 */
export function mergeAnimatorConfig(
    base: PxAnimatorConfig | undefined,
    patch: PxAnimatorConfigPatch,
): PxAnimatorConfigMergeResult {
    const warnings: Array<string> = [];
    if (patch === null) return { config: undefined, warnings };
    if (!isPlainObject(patch) || Object.keys(patch).length === 0) {
        return { config: base, warnings };                            // nothing to do: same identity
    }
    return { config: uncheckedConfig(mergeConfigRecord(base, patch, m => warnings.push(m))), warnings };
}

/** The merge's result — UNCHECKED: the document it lands in is checked at its `checked` stage, which repairs and reports what does not fit. */
const uncheckedConfig = (merged: JsonRecord): PxAnimatorConfig => merged as PxAnimatorConfig;

/** The JSON level of {@link mergeAnimatorConfig}: RULE 5, then the per-key merge. */
function mergeConfigRecord(base: unknown, patch: JsonRecord, warn: (m: string) => void): JsonRecord {
    // RULE 5 — a base in the flat runtime spelling cannot take a wire patch soundly:
    // `resolveAnimatorTimeline` copies the flat keys first and then overwrites them from
    // `timeline`, so a flat `delay` would survive a `timeline.delay: null` deletion.
    const out: JsonRecord = isPlainObject(base) ? { ...base } : {};
    const flatInBase = FLAT_ONLY_KEYS.filter(k => out[k] !== undefined);
    if (flatInBase.length) {
        warn('animator: the base carries the flat runtime spelling (' + flatInBase.join(', ') + '); '
            + 'the patch merges the wire spelling only');
    }

    for (const key of Object.keys(patch)) {
        const value = patch[key];
        if (value === null) { delete out[key]; continue; }
        if (key === 'timeline') {
            out.timeline = isPlainObject(value) ? mergeTimeline(out.timeline, value, warn) : value;
            continue;
        }
        if (isPlainObject(value)) { out[key] = mergePlain(out[key], value); continue; }
        out[key] = value;
    }
    return out;
}

/**
 * Document level: resolves the two canonical addresses of the animator config and returns a NEW
 * document that shares every untouched subtree by reference.
 *
 * (To play a file "as if it said nothing about timing", REPLACE its timing block: the `timeline`
 * prop, `applyPlaybackOverride`.)
 * @public
 */
export function applyAnimatorConfig(
    doc: PxDocument,
    patch: PxAnimatorConfigPatch,
): { doc: PxDocument; warnings: Array<string> } {
    if (!doc || patch === undefined || patch === null || !isPlainObject(patch) || !Object.keys(patch).length) {
        return { doc, warnings: [] };
    }

    const legacy = legacyAnimatorOf(doc);
    const atRoot = isPlainObject(doc.animator);
    const atMeta = !atRoot && legacy !== undefined;
    const current = atRoot ? doc.animator : legacy;

    const warnings: Array<string> = [];
    if (atRoot && legacy) {
        warnings.push('animator: doc.meta.animator is shadowed by doc.animator and was not patched');
    }

    const base: JsonRecord | undefined = isPlainObject(current) ? current : undefined;
    const merged = mergeConfigRecord(base, patch, m => warnings.push(m));
    if (merged === current) return { doc, warnings };

    if (atMeta) {
        const meta = isPlainObject(doc.meta) ? doc.meta : {};
        return { doc: { ...doc, meta: { ...meta, animator: merged } }, warnings };
    }
    return { doc: { ...doc, animator: uncheckedConfig(merged) }, warnings };
}
