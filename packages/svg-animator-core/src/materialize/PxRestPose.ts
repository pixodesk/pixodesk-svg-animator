/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// REST POSES — the last stage of the materialization pipeline.
//
// The format's contract: an animated property's initial value is carried as a plain static
// attribute beside its `animate` entry. Both engines build on it — AT REST THEY SHOW THE STATIC
// DOCUMENT. The WAAPI engine creates its animations idle and `cancel()` returns them to idle,
// dropping every effect; the frame loop writes nothing until it is played. So "not yet played"
// and "cancelled" (`mouseOut: 'reset'`) both mean: whatever the static attributes say.
//
// The editor keeps the contract for authored nodes. The effect materializers did not: the
// wrapper `<g>`s they generate (`transformBy`, the inverse chain under a `<mask>`, glyphs on a
// path, …) carried `animate.transform` and NO static transform. Identity until something played
// — an astronaut shrunk into a corner, a solar system collapsed onto its sun, a masked shape
// invisible, every letter of a text stacked on one spot. Under any trigger but `load`, that
// unplayed frame is what the user looks at.
//
// This stage enforces the contract for every node at once: an animated property with no static
// value gets the value of THE FIRST FRAME. It lives in the DOCUMENT and not in the player because
// a frame written at creation would be undone by the first `cancel()`, and would never reach a
// server-rendered or pre-rendered SVG. Here it holds in every engine and every player.
//
// TWO RULES, both learned the hard way:
//
//  1. THE VALUE COMES FROM THE ENGINE, never from a guess about the keyframes. "The first
//     keyframe" is not "the first frame": converted documents carry keyframes at NEGATIVE times
//     (a visibility track `[-280 → 0, -270 → 1, …]` is already `1` at t=0 — writing its first
//     keyframe hid entire documents). So the value is exactly what `calcAnimationValues` yields
//     for the normalized binding at the first frame — the very call the frame loop makes.
//
//  2. IT NEVER CHANGES THE ANIMATION — only the frame shown at rest. A static transform composes
//     UNDER the animated one (`mergeStaticTransformIntoAnimDef`), so a pose could in principle
//     leak into keyframes. Rather than reason about when, the stage VERIFIES: the engine's
//     bindings are computed again with the poses in place, and any node whose binding differs
//     has its poses taken back out.

import { calcAnimationValues, normalizeBindings } from '../animation/PxDefinitions';
import { getAnimatorConfig, type PxTimelineEngine } from '../format/PxAnimatorConstants';
import type { PxAnimatedSvgDocument, PxAnimationDefinition, PxNode } from '../format/PxAnimatorTypes';
import { PX_DEFAULT_DURATION_MS, PX_TRANSFORM_FN_NAMES } from '../util/PxAnimatorUtil';
import { deepClone } from '../util/PxIdUtil';


const TRANSFORM_CHANNEL = 'transform';

/** Timeline directions whose FIRST frame is the END of an iteration. */
const REVERSED_DIRECTIONS: ReadonlySet<string> = new Set(['reverse', 'alternate-reverse']);

/** Marks the scratch copies' animated nodes so they can be matched back to the output tree. */
const SCRATCH_ID_PREFIX = '__px_rest_';


/**
 * Returns a copy of `root` in which every animated property that has no static value carries
 * the value of the first frame. `root` is not mutated. Idempotent.
 * @internal
 */
export function materializeRestPosesInTree(root: PxAnimatedSvgDocument, engine: PxTimelineEngine): PxAnimatedSvgDocument {
    const out: PxAnimatedSvgDocument = deepClone(root);

    // The same first-frame time the frame loop renders: 0, or the end of the iteration when the
    // timeline runs backwards.
    const config = getAnimatorConfig(out) || {};
    const duration = +(config.duration || PX_DEFAULT_DURATION_MS);
    const firstFrameTime = REVERSED_DIRECTIONS.has(String(config.direction)) ? duration : 0;

    const nodes = animatedNodes(out);
    if (!nodes.size) return out;

    const before = bindingsOf(out, engine);
    const added = new Map<string, Array<string>>();

    for (const [key, animate] of before) {
        const node = nodes.get(key);
        if (!node) continue;
        for (const channel of Object.keys(animate)) {
            if (!mayCarryRestPose(node, channel)) continue;
            const value = firstFrameValue(animate, channel, firstFrameTime);
            if (value === undefined) continue;
            node[channel] = value;
            added.set(key, [...(added.get(key) ?? []), channel]);
        }
    }

    // Rule 2: take back any pose that altered what the engine will play.
    if (added.size) {
        const after = bindingsOf(out, engine);
        for (const [key, channels] of added) {
            if (JSON.stringify(after.get(key)) === JSON.stringify(before.get(key))) continue;
            const node = nodes.get(key);
            if (node) for (const channel of channels) delete node[channel];
        }
    }
    return out;
}

function mayCarryRestPose(node: PxNode, channel: string): boolean {
    // Authored — the author's statement of the pre-animation state; the WAAPI `fill` semantics
    // the engines mirror depend on it.
    if (node[channel] !== undefined) return false;

    // The individual transform channels are CSS properties that COMPOSE with `transform` instead
    // of replacing it: a static pose written out as a transform attribute would be applied twice
    // once the animation runs.
    if (PX_TRANSFORM_FN_NAMES.has(channel)) return false;

    // A static individual channel is written to the same `transform` attribute — two writers.
    if (channel === TRANSFORM_CHANNEL) {
        for (const part of PX_TRANSFORM_FN_NAMES) if (node[part] !== undefined) return false;
    }
    return true;
}

/** Rule 1: exactly what the engine writes for this channel at the first frame. */
function firstFrameValue(animate: PxAnimationDefinition, channel: string, timeMs: number): string | undefined {
    const values = Object.values(calcAnimationValues({ [channel]: animate[channel] }, timeMs));
    return values.length === 1 && values[0] !== '' ? values[0] : undefined;
}


// -- Matching the engine's bindings back to the tree ------------------------------------------

/**
 * The engine's normalized bindings for `tree`, keyed by a traversal-order key.
 *
 * `normalizeBindings` assigns an id to every animated node that has none — on the tree it is
 * given. So it runs on a scratch copy, whose animated nodes are first tagged with deterministic
 * ids; the same traversal over the real tree (`animatedNodes`) yields the same keys, and the
 * output document gains no ids it did not have.
 */
function bindingsOf(tree: PxAnimatedSvgDocument, engine: PxTimelineEngine): Map<string, PxAnimationDefinition> {
    const scratch: PxAnimatedSvgDocument = deepClone(tree);
    const keyById = new Map<string, string>();
    for (const [key, node] of animatedNodes(scratch)) {
        if (node.id === undefined) node.id = SCRATCH_ID_PREFIX + key;
        keyById.set(String(node.id), key);
    }
    const out = new Map<string, PxAnimationDefinition>();
    for (const binding of normalizeBindings(scratch, engine)) {
        const key = keyById.get(binding.id);
        if (key !== undefined) out.set(key, binding.animate);
    }
    return out;
}

/** Every node below the root that carries an `animate` bucket, keyed by traversal order. */
function animatedNodes(tree: PxAnimatedSvgDocument): Map<string, PxNode> {
    const out = new Map<string, PxNode>();
    let counter = 0;
    const visit = (node: PxNode): void => {
        if (node.animate) out.set(String(counter++), node);
        if (node.children) for (const child of node.children) visit(child);
    };
    if (tree.children) for (const child of tree.children) visit(child);
    return out;
}
