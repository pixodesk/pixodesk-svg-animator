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
 * (`timeline.type` absent = time, `mode` absent = auto, `fillMode` absent = forwards).
 *
 * Six places need more than that — see the RULE comments below.
 *
 * WHY THE WIRE FORM, not the flat runtime view: `nestAnimatorTimeline` is a no-op on anything
 * that already carries `timeline`, and the round-trip is lossy (`iterations:'infinite'` on the
 * scroll branch, `pin:false`, and an empty time block emitting no `timeline` at all). Merging
 * on the nested form is the only place those values mean what they say.
 */
import { PX_TIMELINE_SHARED_KEYS, PX_TIME_ONLY_TIMELINE_KEYS, PxTriggerStart } from '../format/PxAnimatorConstants';
import type { PxHoverEndAction, PxOutOfViewAction } from '../format/PxAnimatorConstants';
import type { PxDocument, PxAnimatorConfig } from '../format/PxAnimatorTypes';
import { legacyAnimatorOf } from '../format/PxDocStage';

/** A deep-partial of the WIRE animator config; `null` at any slot deletes it. @public */
export type PxAnimatorConfigPatch = Record<string, unknown> | null;

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

/** A deep-partial of the WIRE `timeline` block; `null` at any slot deletes it. @public */
export type PxTimelinePatch = Record<string, unknown> | null;

/** The flat shortcuts every surface offers for the keys people reach for most. @public */
export interface PxTimelineShortcuts {
    /** Shortcut for `timeline.inTime` — where the content window begins, ms. Wins over the same key in `timeline`. */
    inTime?: number;
    /** Shortcut for `timeline.outTime` — where the content window ends, ms. */
    outTime?: number;
    /** Shortcut for `timeline.playDuration` — wall ms one pass of the window takes. */
    playDuration?: number;
    /** Shortcut for `timeline.delay` — the wait before the first iteration, ms. */
    delay?: number;
    /** Shortcut for `timeline.iterations`; `'infinite'` never stops. */
    iterations?: number | 'infinite';
    /**
     * Shortcut for `timeline.trigger.start`. Typed from the WIRE, so it includes
     * `'manual'` — "nothing starts this but a `play()` call".
     */
    start?: PxTriggerStart;
    /** Shortcut for `timeline.trigger.outOfView` — what happens while none of it is on screen. */
    outOfView?: PxOutOfViewAction;
    /** Shortcut for `timeline.trigger.hoverEnd` — what the pointer leaving does, for `start: 'hover'`. */
    hoverEnd?: PxHoverEndAction;
    /** Shortcut for `timeline.trigger.inViewThreshold` — how much must be on screen (0–1). */
    inViewThreshold?: number;
    /** Shortcut for `timeline.trigger.inViewDebounce` — ms the visibility must hold. */
    inViewDebounce?: number;
}

/**
 * The playback-override props every surface takes — `createSvgAnimationPlayer` and the three components:
 * the document's `timeline` as a patch, the reset flag, and the four shortcuts above.
 *
 * ONE definition (review §9): React and React Native extend it, Vue derives its internal shape
 * from it, `createSvgAnimationPlayer`'s options extend it.
 * @public
 */
export interface PxPlaybackOverride extends PxTimelineShortcuts {
    /**
     * Per-instance override of the document's `animator.timeline` — the same shape as `timeline`
     * in docs/format/README.md, deep-merged over what the document says, so one file can play twice on a page
     * with different timing. `null` at any slot DELETES that key, restoring the default its
     * absence means. Also accepts a JSON STRING, which survives a build that mangles object keys.
     *
     * `timeline` is the whole useful override surface: the rest of the `animator` block is
     * content (`definitions`, `bindings`), a version stamp and a debug handle — none of which
     * a per-instance override should touch. That is why this is not a wrapper object.
     */
    timeline?: PxTimelinePatch | string;
    /**
     * Ignore the document's own timeline and start from the player's DEFAULT timeline, with
     * `timeline` on top. `definitions` and `bindings` are content and are kept either way.
     */
    resetTimeline?: boolean;
}

/**
 * Folds the four shortcuts into the `timeline` patch, accepts the JSON-STRING form of the patch
 * (immune to property mangling — see docs/library/minification.md), and returns it in the shape
 * `applyAnimatorConfig` takes: an animator-level patch `{ timeline: … }`.
 *
 * A shortcut WINS over the same key inside the object: more specific beats more general, the
 * way an inline style beats a stylesheet. One implementation so every surface agrees.
 * @public
 */
export function foldTimelineOverride(
    timeline: PxTimelinePatch | string | undefined,
    shortcuts: PxTimelineShortcuts,
): PxAnimatorConfigPatch | undefined {
    let base: PxTimelinePatch | undefined;
    if (typeof timeline === 'string') {
        try {
            const parsed: unknown = JSON.parse(timeline);
            base = isPlainObject(parsed) || parsed === null ? parsed : undefined;
            if (base === undefined) console.warn('timeline override: not a JSON object — ignored');
        } catch (e) {
            console.warn('timeline override: not valid JSON — ignored', e);
            base = undefined;
        }
    } else {
        base = timeline ?? undefined;
    }

    const { inTime, outTime, playDuration, delay, iterations, start, outOfView, hoverEnd, inViewThreshold, inViewDebounce } = shortcuts;
    if (inTime === undefined && outTime === undefined && playDuration === undefined
        && delay === undefined && iterations === undefined && start === undefined
        && outOfView === undefined && hoverEnd === undefined
        && inViewThreshold === undefined && inViewDebounce === undefined) {
        return base === undefined ? undefined : { timeline: base };
    }

    const out: JsonRecord = isPlainObject(base) ? { ...base } : {};
    if (inTime !== undefined) out.inTime = inTime;
    if (outTime !== undefined) out.outTime = outTime;
    if (playDuration !== undefined) out.playDuration = playDuration;
    if (delay !== undefined) out.delay = delay;
    if (iterations !== undefined) out.iterations = iterations;
    // the trigger shortcuts — the SAME flat names the CSS component takes (review §12)
    const trigger: JsonRecord = isPlainObject(out.trigger) ? { ...out.trigger } : {};
    if (start !== undefined) trigger.start = start;
    if (outOfView !== undefined) trigger.outOfView = outOfView;
    if (hoverEnd !== undefined) trigger.hoverEnd = hoverEnd;
    if (inViewThreshold !== undefined) trigger.inViewThreshold = inViewThreshold;
    if (inViewDebounce !== undefined) trigger.inViewDebounce = inViewDebounce;
    if (Object.keys(trigger).length) out.trigger = trigger;
    return { timeline: out };
}

/**
 * The "nobody named a driver" patch (first-use review §1+2): forces `trigger.start: 'manual'` ON TOP
 * of the caller's own override, so the document cannot start itself. One spelling for the web
 * player's missing `playOnTrigger` option and the components' non-`playOnTrigger` control modes.
 * @public @advanced
 */
export function suppressTriggerStart(patch?: PxAnimatorConfigPatch): PxAnimatorConfigPatch {
    const base = patch ?? {};
    const timeline = isPlainObject(base.timeline) ? base.timeline : {};
    const trigger = isPlainObject(timeline.trigger) ? timeline.trigger : {};
    return { ...base, timeline: { ...timeline, trigger: { ...trigger, start: PxTriggerStart.manual } } };
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
 * `resetTimeline` starts from the player's own defaults instead of the document's playback
 * settings — "play this file as if it said nothing about timing". The lookup tables are kept
 * either way: resetting `definitions`/`bindings` would leave an animation with nothing to
 * animate, which is never what a caller means.
 * @public
 */
export function applyAnimatorConfig(
    doc: PxDocument,
    patch: PxAnimatorConfigPatch,
    options?: { resetTimeline?: boolean },
): { doc: PxDocument; warnings: Array<string> } {
    const reset = !!options?.resetTimeline;
    if (!doc || (patch === undefined || (!reset && (patch === null || !isPlainObject(patch) || !Object.keys(patch).length)))) {
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

    let base: JsonRecord | undefined = isPlainObject(current) ? current : undefined;
    if (reset) {
        // Keep only the content — the lookup tables and the bindings, never reset; everything else starts from the player's defaults.
        const kept: JsonRecord = {};
        if (base?.definitions !== undefined) kept.definitions = base.definitions;
        if (base?.bindings !== undefined) kept.bindings = base.bindings;
        base = kept;
    }

    const p = patch ?? {};
    const merged = isPlainObject(p) && Object.keys(p).length ? mergeConfigRecord(base, p, m => warnings.push(m)) : base;
    if (merged === current || !merged) return { doc, warnings };

    if (atMeta) {
        const meta = isPlainObject(doc.meta) ? doc.meta : {};
        return { doc: { ...doc, meta: { ...meta, animator: merged } }, warnings };
    }
    return { doc: { ...doc, animator: uncheckedConfig(merged) }, warnings };
}
