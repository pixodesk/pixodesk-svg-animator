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
 * Base semantics are a RECURSIVE PARTIAL: objects merge per level, primitives and arrays REPLACE, and a key left
 * out (`undefined`, or `null` from JavaScript) changes nothing. There is no delete: to get a default, set it
 * (`stopPlayback: 'animateToStart'`). WHY no `null` delete (RFC 7386 had it until 1.22): nobody resets one key to "absent" from a
 * page — setting the value wanted is clearer, and React reads `null` as "nothing" anyway.
 *
 * Six places need more than that — see the RULE comments below.
 *
 * WHY THE WIRE FORM, not the flat runtime view: `nestAnimatorTimeline` is a no-op on anything
 * that already carries `timeline`, and the round-trip is lossy (`iterations:'infinite'` on the
 * scroll branch, `pin:false`, and an empty time block emitting no `timeline` at all). Merging
 * on the nested form is the only place those values mean what they say.
 */
import { controlModeTakesOverTrigger, getAnimatorConfig, PX_TIMELINE_SHARED_KEYS, PX_TIME_ONLY_TIMELINE_KEYS, PxControlMode, PxWhenIdle } from '../format/PxAnimatorConstants';
import { isScrollTimeline } from './PxScrollMath';
import type { PxDocument, PxAnimatorConfig, PxTimeline, PxActionTriggersInput, PxActions } from '../format/PxAnimatorTypes';
import { legacyAnimatorOf } from '../format/PxDocStage';

/**
 * A deep partial of a wire type `T`, the way {@link mergeAnimatorConfig} applies one: every key optional at every
 * depth, arrays and primitives replaced whole. Distributes over a union, so a partial of `PxTimeline` is a partial
 * of the time OR the scroll member — and TypeScript names a misspelled key or a wrong value where a plain record
 * said nothing. WHY the name (`PxPatch` until 1.22): it says what the type IS — the common `RecursivePartial`.
 * @public
 */
export type PxRecursivePartial<T> =
    T extends ReadonlyArray<unknown> ? T :
    T extends object ? { [K in keyof T]?: PxRecursivePartial<T[K]> } :
    T;

/** `Omit` applied to each member of a union, so a discriminated union keeps its members. */
type PxDistributiveOmit<T, K extends PropertyKey> = T extends object ? Omit<T, K> : never;

/** A deep-partial of the WIRE animator config (`timeline` — its `actionTriggers` and `actions` included at this level —,
 *  `definitions`, `bindings`, `version`), typed from the schema. @public */
export type PxAnimatorConfigPatch = PxRecursivePartial<PxAnimatorConfig>;

/** @public */
export interface PxAnimatorConfigMergeResult {
    /** The merged WIRE config, or `undefined` when there is nothing left of it. */
    config: PxAnimatorConfig | undefined;
    /** Human-readable problems, `path: what is wrong`. Empty when the merge was clean. */
    warnings: Array<string>;
}

/** Keys that live only on the flat RUNTIME view and have no slot on the wire. */
const FLAT_ONLY_KEYS = [
    'timelineSource', 'scroll', 'actionTriggers', 'actions', 'whenIdle', 'delay', 'iterations',
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
        if (value === null || value === undefined) continue;        // RULE 7: left out changes nothing (no delete)
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
/** An `actions` block with every string slot expanded to its settings — `'animateToStart'` is exactly
 *  `{ behavior: 'animateToStart' }` (RULE 5), so a merge over it keeps the slot's other settings. */
function expandActionSlots(actions: unknown): unknown {
    if (!isPlainObject(actions)) return actions;
    const out: JsonRecord = {};
    for (const key of Object.keys(actions)) out[key] = typeof actions[key] === 'string' ? { behavior: actions[key] } : actions[key];
    return out;
}

/** The canonical spelling back: a slot that says only `behavior` is the word itself. */
function compactActionSlots(actions: unknown): unknown {
    if (!isPlainObject(actions)) return actions;
    const out: JsonRecord = {};
    for (const key of Object.keys(actions)) {
        const slot = actions[key];
        const keys = isPlainObject(slot) ? Object.keys(slot) : [];
        out[key] = keys.length === 1 && keys[0] === 'behavior' && isPlainObject(slot) ? slot.behavior : slot;
    }
    return out;
}

/** A timeline with its `actions` slots expanded (base and patch alike), so the plain merge sees objects. */
function withExpandedActions(timeline: unknown): unknown {
    if (!isPlainObject(timeline) || timeline.actions === undefined) return timeline;
    return { ...timeline, actions: expandActionSlots(timeline.actions) };
}

function mergeTimeline(base: unknown, patch: JsonRecord, warn: (m: string) => void): JsonRecord {
    const baseType = timelineTypeOf(base);
    const patchType = typeof patch.type === 'string' ? patch.type : baseType;
    base = withExpandedActions(base);
    const patchExpanded = withExpandedActions(patch);
    patch = isPlainObject(patchExpanded) ? patchExpanded : patch;

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
    if (merged.actions !== undefined) merged.actions = compactActionSlots(merged.actions);   // RULE 5

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

/** `PxTimeline` without its `actionTriggers` and `actions` blocks — the timing. On the props the three are separate
 *  (the file nests them): `timelineOptions` patches this, `actionTriggers` replaces the triggers, `actions` the actions. @public */
export type PxTimelineTiming = PxDistributiveOmit<PxTimeline, 'actionTriggers' | 'actions'>;

/** The `timelineOptions` prop: a deep-partial of the WIRE timing block, typed from the schema, merged over the file's.
 *  No `actionTriggers` / `actions` here — those are their props'. WHY the name (`PxTimelinePatch` until 1.22): the
 *  prop's own word. @public */
export type PxTimelineOptions = PxRecursivePartial<PxTimelineTiming>;

/** The `actions` prop: the timeline's `actions` block to use INSTEAD of the file's — a replacement, like
 *  `actionTriggers`: a slot left out reads as its default, never as the file's value (one slot changed against the
 *  file's others could make no sense). A slot may be the preset word (`'playback.stop': 'animateToStart'`): it is exactly
 *  `{ behavior: 'animateToStart' }`. (`PxActionsOptions` until 2026-11-13, a deep-partial merged over the file's.) @public */
export type PxActionsInput = PxActions;

/**
 * The playback-override props every surface takes — `createSvgAnimationPlayer` and the three components
 * (dev-docs/plans/component-api.md D4, playback-layers.md): `timelineOptions`, a MERGE over the file's timing block
 * ("options": corrections — `iterations`, `delay`, `playbackSpeed`), and `actions`, a REPLACEMENT of its actions
 * block. The triggers are not here: they travel with the other control props, `actionTriggers`
 * ({@link PxCommonControlProps}), also a replacement. ONE definition (review §9).
 * @public
 */
export interface PxPlaybackOverride {
    /**
     * Per-instance adjustment of the document's `animator.timeline` — its shape minus `actionTriggers` and
     * `actions` (docs/format/README.md), deep-merged over what the document says, so one file can play twice on a
     * page with different timing. A key left out keeps the file's value; to get a default, set it
     * (`{ playbackSpeed: 1 }`).
     *
     * WHY `timelineOptions`, not `timeline`: it is NOT the file's `timeline` object — two of its keys live on other
     * props — and a prop that shares a file key's name promises the same shape (outside review 2026-11-01, §2.5).
     * `actions` keeps the file's name because it IS a partial of that block.
     *
     * MERGE vs REPLACE, the one rule for the three override props: `timelineOptions` is a recursive partial (objects
     * merge, values replace) — the word "options" says so; `actions` and `actionTriggers` are BLOCKS that replace
     * the file's as a whole — their slots belong together.
     */
    timelineOptions?: PxTimelineOptions;
    /**
     * HOW the buttons move the playhead, instead of the document's `timeline.actions` — `{ 'playback.stop':
     * 'animateToStart' }`, or `{ 'playback.stop': 'animateToEndAndBack' }` ("stop after this pass, then play back").
     * The WHOLE block: a slot left out (`outOfView`, say) reads as its default, not as the file's value.
     */
    actions?: PxActionsInput;
}

/** What {@link applyPlaybackOverride} reads: the patches, and the triggers block given instead of the file's. @public @advanced */
export interface PxPlaybackOverrideInput extends PxPlaybackOverride {
    /** An object — the WHOLE block to use instead of the file's; `null` — no triggers (an empty block); left out — the
     *  file's own (see {@link PxCommonControlProps}). */
    actionTriggers?: PxActionTriggersInput | null;
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
 * components (D4): `timelineOptions` merged with the timeline rules (`mergeAnimatorConfig`); then the `actions` block
 * and the `actionTriggers` block, each SET when given — REPLACEMENTS, because their slots belong together (hover →
 * click changes the other lists too; one action slot against the file's others can make no sense). `actionTriggers:
 * null` is left to the control mode (`manual` → {@link withoutTriggerDriver}). PURE: the document is never mutated,
 * untouched subtrees are shared. The caller reports `warnings` through its diagnostics.
 * @public @advanced
 */
export function applyPlaybackOverride(doc: PxDocument, override: PxPlaybackOverrideInput): PxPlaybackOverrideResult {
    const { timelineOptions: timeline, actions, actionTriggers } = override;
    const warnings: Array<string> = [];
    const apply = (patch: PxAnimatorConfigPatch): void => {
        const applied = applyAnimatorConfig(doc, patch);
        warnings.push(...applied.warnings);
        doc = applied.doc;
    };
    if (timeline !== undefined) {
        // a JS caller can still hand over the old JSON string — reported, never written into the document
        if (isPlainObject(timeline)) apply({ timeline });
        else if (timeline !== null) warnings.push('timelineOptions: not an object — ignored');
    }
    if (actions !== undefined) {
        if (isPlainObject(actions)) doc = withActions(doc, actions);   // a SET, not a merge
        else if (actions !== null) warnings.push('actions: not an object — ignored');
    }
    // `null` (no triggers) is the control mode's to apply — `manual`, which spares a scroll-driven document
    if (isPlainObject(actionTriggers)) doc = withActionTriggers(doc, actionTriggers);   // a SET, not a merge
    else if (actionTriggers !== undefined && actionTriggers !== null) warnings.push('actionTriggers: not an object — ignored');
    return { doc, warnings };
}

/** A patch assembled from parsed JSON (a record spread) — UNCHECKED like `uncheckedConfig`: the merge validates
 *  nothing, the document's `checked` stage repairs and reports what does not fit. */
const uncheckedPatch = (p: JsonRecord): PxAnimatorConfigPatch => p as PxAnimatorConfigPatch;

/**
 * The document with its `timeline.actionTriggers` SET to `actionTriggers` — not merged: an empty block (`{}`,
 * "nothing starts it") and a replacement that drops keys both need a set, which a merge patch cannot say. Returns
 * a new document sharing every untouched subtree; the animator lives at either of its two addresses.
 * @public @advanced
 */
export function withActionTriggers(doc: PxDocument, actionTriggers: PxActionTriggersInput): PxDocument {
    return withTimelineBlock(doc, timeline => ({ ...timeline, actionTriggers: { ...actionTriggers } }));
}

/**
 * The document with its `timeline.actions` SET to `actions` — the `actions` prop's replacement (see
 * {@link withActionTriggers} for why a set, not a merge).
 * @public @advanced
 */
export function withActions(doc: PxDocument, actions: PxActionsInput): PxDocument {
    return withTimelineBlock(doc, timeline => ({ ...timeline, actions: { ...actions } }));
}

/** A new document whose wire `timeline` is `edit(timeline)` — the animator at either of its two addresses. */
function withTimelineBlock(doc: PxDocument, edit: (timeline: JsonRecord) => JsonRecord): PxDocument {
    const legacy = legacyAnimatorOf(doc);
    const atRoot = isPlainObject(doc.animator);
    const current: unknown = atRoot ? doc.animator : legacy;
    const base: JsonRecord = isPlainObject(current) ? current : {};
    const timeline: JsonRecord = isPlainObject(base.timeline) ? base.timeline : {};
    const animator: JsonRecord = { ...base, timeline: edit(timeline) };
    if (!atRoot && legacy !== undefined) {
        const meta = isPlainObject(doc.meta) ? doc.meta : {};
        return { ...doc, meta: { ...meta, animator } };
    }
    return { ...doc, animator: uncheckedConfig(animator) };
}

/**
 * Manual: the document's `actionTriggers` replaced by an EMPTY block — no event starts it — on top of the caller's
 * override, so the document cannot start itself. One spelling for `disableActionTriggers` / `actionTriggers: null`
 * and the components' other control modes (`playback`, `showAtProgress` / `showAtTime`).
 * @public @advanced
 */
export function withoutTriggerDriver(doc: PxDocument): PxDocument {
    return withActionTriggers(doc, {});
}

/**
 * `showAsStatic`: the picture as drawn — on a time timeline the triggers taken over ({@link withoutTriggerDriver}) and
 * `whenIdle: static`, so even a file saved with `firstFrame` shows its static SVG. A scroll- or view-driven document is
 * returned as it is: it has no triggers, and the player simply does not attach its scroll (an engine never played
 * rests on the static SVG — see the rest-pose stage).
 * @public @advanced
 */
export function withStaticPicture(doc: PxDocument): PxDocument {
    if (isScrollTimeline(getAnimatorConfig(doc))) return doc;
    return applyAnimatorConfig(withoutTriggerDriver(doc), { timeline: { whenIdle: PxWhenIdle.static } }).doc;
}

/**
 * The document as a control mode plays it — applied AFTER the caller's override, so nothing re-arms what the mode
 * switched off: `static` → {@link withStaticPicture}; the modes that take the triggers over → the EMPTY block
 * ({@link withoutTriggerDriver}), except on a scroll-driven document (scroll is not an action trigger, and a clock
 * trigger pushed into a scroll timeline would only be reported as an ignored override); `actionTriggers` → as it is.
 * The web player and the pre-rendered builds call it; the components apply their own pose rules beside it.
 * @public @advanced
 */
export function withControlMode(doc: PxDocument, mode: PxControlMode): PxDocument {
    if (mode === PxControlMode.static) return withStaticPicture(doc);
    if (controlModeTakesOverTrigger(mode) && !isScrollTimeline(getAnimatorConfig(doc))) return withoutTriggerDriver(doc);
    return doc;
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
    // `timeline`, so a flat `delay` would win over the patch's `timeline.delay`.
    const out: JsonRecord = isPlainObject(base) ? { ...base } : {};
    const flatInBase = FLAT_ONLY_KEYS.filter(k => out[k] !== undefined);
    if (flatInBase.length) {
        warn('animator: the base carries the flat runtime spelling (' + flatInBase.join(', ') + '); '
            + 'the patch merges the wire spelling only');
    }

    for (const key of Object.keys(patch)) {
        const value = patch[key];
        if (value === null || value === undefined) continue;          // left out changes nothing (no delete)
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
    if (!doc || !isPlainObject(patch) || !Object.keys(patch).length) {
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
