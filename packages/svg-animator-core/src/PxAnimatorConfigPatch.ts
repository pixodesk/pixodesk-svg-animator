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
import { PX_TIMELINE_SHARED_KEYS, PX_TIME_ONLY_TIMELINE_KEYS } from './PxAnimatorConstants';
import type { PxAnimatedSvgDocument, PxAnimatorConfig } from './PxAnimatorTypes';

/** A deep-partial of the WIRE animator config; `null` at any slot deletes it. */
export type PxAnimatorConfigPatch = Record<string, any> | null;

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

/** The lookup tables. They are animation CONTENT, not playback, and are never reset. */
const CONTENT_KEYS = ['definitions', 'animateById'];

const isPlainObject = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === 'object' && !Array.isArray(v);

/** Absent `type` means the time-driven timeline, so compare the normalised values (RULE 2). */
const timelineTypeOf = (t: unknown): string =>
    (isPlainObject(t) && typeof t.type === 'string') ? t.type : 'time';

const isScrollish = (type: string): boolean => type === 'scroll' || type === 'view';

/**
 * RFC 7386 merge with no special cases. Used for every sub-object that has no rule of its own
 * (`trigger`, `range`, `definitions.fonts`, `animateById`, …), which is why patching one font
 * or one element's animation leaves its siblings alone.
 */
function mergePlain(base: unknown, patch: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = isPlainObject(base) ? { ...base } : {};
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
 *          the normalisation above.
 * RULE 3 — time-only keys landing on a scroll/view timeline are dropped with a warning, the
 *          same way the wire has no slot for them.
 * RULE 4 — `iterations: 'infinite'` cannot map onto a scroll range.
 */
function mergeTimeline(base: unknown, patch: Record<string, any>, warn: (m: string) => void): Record<string, any> {
    const baseType = timelineTypeOf(base);
    const patchNamesType = isPlainObject(patch) && typeof patch.type === 'string';
    const patchType = patchNamesType ? String(patch.type) : baseType;

    let merged: Record<string, any>;
    if (patchType !== baseType) {
        // RULE 1
        const carried: Record<string, any> = {};
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

/** The four flat shortcuts every surface offers for the keys people reach for most. */
export interface PxAnimatorConfigShortcuts {
    duration?: number;
    delay?: number;
    iterations?: number | 'infinite';
    startOn?: string;
}

/**
 * Folds the shortcuts into a config patch, and accepts the JSON-STRING form of the patch
 * (immune to property mangling — see docs/library/minification.md).
 *
 * A shortcut WINS over the same key inside the object: more specific beats more general, the
 * way an inline style beats a stylesheet. One implementation so every surface agrees.
 */
export function foldAnimatorConfigShortcuts(
    config: PxAnimatorConfigPatch | string | undefined,
    shortcuts: PxAnimatorConfigShortcuts,
): PxAnimatorConfigPatch | undefined {
    let base: PxAnimatorConfigPatch | undefined;
    if (typeof config === 'string') {
        try {
            base = JSON.parse(config);
        } catch (e) {
            console.warn('animator config: not valid JSON — ignored', e);
            base = undefined;
        }
    } else {
        base = config ?? undefined;
    }

    const { duration, delay, iterations, startOn } = shortcuts;
    if (duration === undefined && delay === undefined && iterations === undefined && startOn === undefined) {
        return base;
    }

    const out: Record<string, any> = isPlainObject(base) ? { ...base } : {};
    const timeline: Record<string, any> = { ...(out.timeline as Record<string, any> | undefined) };
    if (duration !== undefined) timeline.duration = duration;
    if (delay !== undefined) timeline.delay = delay;
    if (iterations !== undefined) timeline.iterations = iterations;
    if (startOn !== undefined) {
        timeline.trigger = { ...(timeline.trigger as Record<string, any> | undefined), startOn };
    }
    out.timeline = timeline;
    return out;
}

/**
 * Merge a patch over an animator config. PURE — neither argument is mutated, and the result is
 * always a NEW object, which also matters because `flattenAnimatorTimeline` memoises on config
 * identity: mutating in place would hand every later reader the pre-merge view.
 */
export function mergeAnimatorConfig(
    base: PxAnimatorConfig | undefined,
    patch: PxAnimatorConfigPatch,
): PxAnimatorConfigMergeResult {
    const warnings: Array<string> = [];
    const warn = (m: string) => warnings.push(m);

    if (patch === null) return { config: undefined, warnings };
    if (!isPlainObject(patch) || Object.keys(patch).length === 0) {
        return { config: base, warnings };                            // nothing to do: same identity
    }

    // RULE 5 — a base in the flat runtime spelling cannot take a wire patch soundly:
    // `flattenAnimatorTimeline` copies the flat keys first and then overwrites them from
    // `timeline`, so a flat `delay` would survive a `timeline.delay: null` deletion.
    const flatInBase = isPlainObject(base) ? FLAT_ONLY_KEYS.filter(k => (base as any)[k] !== undefined) : [];
    if (flatInBase.length) {
        warn('animator: the base carries the flat runtime spelling (' + flatInBase.join(', ') + '); '
            + 'the patch merges the wire spelling only');
    }

    const out: Record<string, any> = isPlainObject(base) ? { ...base } : {};
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
    return { config: out as PxAnimatorConfig, warnings };
}

/**
 * Document level: resolves the two canonical addresses of the animator config and returns a NEW
 * document that shares every untouched subtree by reference.
 *
 * `resetDefaults` starts from the player's own defaults instead of the document's playback
 * settings — "play this file as if it said nothing about timing". The lookup tables are kept
 * either way: resetting `definitions`/`animateById` would leave an animation with nothing to
 * animate, which is never what a caller means.
 */
export function applyAnimatorConfig(
    doc: PxAnimatedSvgDocument,
    patch: PxAnimatorConfigPatch,
    opts?: { resetDefaults?: boolean },
): { doc: PxAnimatedSvgDocument; warnings: Array<string> } {
    const reset = !!opts?.resetDefaults;
    if (!doc || (patch === undefined || (!reset && (patch === null || !isPlainObject(patch) || !Object.keys(patch).length)))) {
        return { doc, warnings: [] };
    }

    const anyDoc = doc as any;
    const atRoot = isPlainObject(anyDoc.animator);
    const atMeta = !atRoot && isPlainObject(anyDoc.meta?.animator);
    const current: PxAnimatorConfig | undefined = atRoot ? anyDoc.animator
        : atMeta ? anyDoc.meta.animator
        : undefined;

    const warnings: Array<string> = [];
    if (atRoot && isPlainObject(anyDoc.meta?.animator)) {
        warnings.push('animator: doc.meta.animator is shadowed by doc.animator and was not patched');
    }

    let base = current;
    if (reset) {
        // Keep only the content tables; everything else starts from the player's defaults.
        const kept: Record<string, any> = {};
        for (const k of CONTENT_KEYS) {
            if (isPlainObject(current) && (current as any)[k] !== undefined) kept[k] = (current as any)[k];
        }
        base = kept as PxAnimatorConfig;
    }

    const merged = mergeAnimatorConfig(base, patch ?? {});
    warnings.push(...merged.warnings);
    if (merged.config === current) return { doc, warnings };

    if (atMeta) {
        return {
            doc: { ...anyDoc, meta: { ...anyDoc.meta, animator: merged.config } } as PxAnimatedSvgDocument,
            warnings,
        };
    }
    return { doc: { ...anyDoc, animator: merged.config } as PxAnimatedSvgDocument, warnings };
}
