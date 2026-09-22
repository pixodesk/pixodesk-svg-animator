/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { normalizeBindings } from '../animation/PxDefinitions';
import { PxTimelineEngine } from '../format/PxAnimatorConstants';
import type { PxAnimatedSvgDocument, PxNode } from '../format/PxAnimatorTypes';
import { createAdapterAnimator } from '../playback/PxFrameLoop';
import { toDomProps } from '../util/PxNodeProps';
import { PX_TRANSFORM_FN_NAMES } from '../util/PxAnimatorUtil';
import { materializeAllInTree } from './PxAnimatorMaterializeAll';
import { materializeRestPosesInTree } from './PxRestPose';


const JS = PxTimelineEngine.js;
const kf = <V>(time: number, value: V): { time: number; value: V } => ({ time, value });
const docOf = (children: Array<PxNode>, timeline: Record<string, unknown> = {}): PxAnimatedSvgDocument =>
    ({ type: 'svg', viewBox: '0 0 100 100', animator: { timeline: { duration: 1000, engine: 'js', ...timeline } }, children });
const first = (doc: PxAnimatedSvgDocument): PxNode => (doc.children ?? [])[0];

/** What the ENGINE writes at its first frame — `id` → attribute → value. The reference. */
function engineFirstFrame(doc: PxAnimatedSvgDocument): Map<string, Map<string, string>> {
    const written = new Map<string, Map<string, string>>();
    const api = createAdapterAnimator(doc, {
        isConnected: () => true,
        setAttribute: (id, attr, value) => {
            const attrs = written.get(id) ?? new Map<string, string>();
            attrs.set(attr, String(value));
            written.set(id, attrs);
        },
    });
    api.setCurrentTime(0);
    return written;
}

/** The static attribute a player renders for `node[key]`. */
const staticAttr = (node: PxNode, key: string): string | undefined => toDomProps({ [key]: node[key] })[key];


describe('materializeRestPosesInTree — the static document IS the first frame', () => {

    it('an animated transform with no static value rests where the engine starts it', () => {
        // The shape every generated wrapper has: `animate.transform`, no `transform`. At rest both
        // engines show the STATIC document (WAAPI goes idle on cancel and drops its effects), so
        // such a wrapper is the identity — and the picture is wrong until something plays.
        const out = materializeRestPosesInTree(docOf([
            { type: 'g', id: 'w', animate: { transform: { keyframes: [kf(0, { rotate: -12 }), kf(500, { rotate: 30 })] } } },
        ]), JS);
        expect(first(out).transform).toBeDefined();
        expect(staticAttr(first(out), 'transform')).toBe(engineFirstFrame(out).get('w')?.get('transform'));
    });

    it('keyframes that start BEFORE time 0 — the first frame is not the first keyframe', () => {
        // REGRESSION, and the reason the value comes from the engine. A converted document's
        // visibility track is already `1` at t=0; resting it on its first keyframe (`0`) hid
        // entire documents — a solar system rendered as a blank canvas.
        const out = materializeRestPosesInTree(docOf([
            { type: 'g', id: 'layer', animate: { opacity: { keyframes: [kf(-280, 0), kf(-270, 1), kf(60830, 1), kf(60840, 0)] } } },
        ]), JS);
        expect(Number(first(out).opacity)).toBe(1);
        expect(staticAttr(first(out), 'opacity')).toBe(engineFirstFrame(out).get('layer')?.get('opacity'));
    });

    it('keyframes that STRADDLE time 0 rest on the interpolated value', () => {
        const out = materializeRestPosesInTree(docOf([
            { type: 'rect', id: 'r', animate: { opacity: { keyframes: [kf(-500, 0), kf(500, 1)] } } },
        ]), JS);
        const rest = Number(first(out).opacity);
        expect(rest).toBeGreaterThan(0);
        expect(rest).toBeLessThan(1);
        expect(staticAttr(first(out), 'opacity')).toBe(engineFirstFrame(out).get('r')?.get('opacity'));
    });

    it('holds the first keyframe when the track starts AFTER time 0', () => {
        const out = materializeRestPosesInTree(docOf([
            { type: 'rect', id: 'r', animate: { opacity: { keyframes: [kf(200, 0.25), kf(800, 1)] } } },
        ]), JS);
        expect(Number(first(out).opacity)).toBe(0.25);
    });

    it('a reversed timeline rests on the END of the iteration', () => {
        for (const direction of ['reverse', 'alternate-reverse']) {
            const out = materializeRestPosesInTree(docOf([
                { type: 'rect', id: 'r', animate: { opacity: { keyframes: [kf(0, 0.1), kf(1000, 0.9)] } } },
            ], { direction }), JS);
            expect(Number(first(out).opacity), direction).toBe(0.9);
            expect(staticAttr(first(out), 'opacity'), direction).toBe(engineFirstFrame(out).get('r')?.get('opacity'));
        }
    });

    it('resolves a NAMED animation through the definitions', () => {
        const doc = docOf([{ type: 'rect', id: 'r', animate: 'fade' }]);
        (doc.animator ?? {}).definitions = { animations: { fade: { opacity: { keyframes: [kf(0, 0.3), kf(1000, 1)] } } } };
        expect(Number(first(materializeRestPosesInTree(doc, JS)).opacity)).toBe(0.3);
    });

    // -- What it must NOT touch ------------------------------------------------

    it('leaves an authored static value alone — even when it differs from the first frame', () => {
        // The author's statement of the pre-animation state; WAAPI `fill` semantics depend on it.
        const out = materializeRestPosesInTree(docOf([
            { type: 'rect', opacity: 0.4, transform: { rotate: 5 }, animate: {
                opacity: { keyframes: [kf(0, 0), kf(500, 1)] },
                transform: { keyframes: [kf(0, { rotate: -12 }), kf(500, { rotate: 30 })] },
            } },
        ]), JS);
        expect(first(out).opacity).toBe(0.4);
        expect(first(out).transform).toEqual({ rotate: 5 });
    });

    it('an individual channel rests through the transform slot, never as a static channel of its own', () => {
        // Both engines write an individual channel to the ONE `transform` slot (frame loop: the
        // attribute; WAAPI: the property), and either REPLACES what is there — so the pose goes
        // into `transform` as the canonical parts record, and NOT into a static `rotate`, which
        // the renderer would fold into the same attribute a second time.
        const out = materializeRestPosesInTree(docOf([
            { type: 'g', id: 'r', animate: { rotate: { keyframes: [kf(0, 30), kf(500, 60)] } } },
        ]), JS);
        expect(first(out).rotate).toBeUndefined();
        expect(first(out).transform).toEqual({ rotate: 30 });
        expect(staticAttr(first(out), 'transform')).toBe('rotate(30)');
    });

    // A HAND-WRITTEN document (the docs' own examples are): an authored node animating ONE
    // individual channel and stating no static value. The editor never writes this shape — it
    // folds the channel into `animate.transform` and writes `transform: {translate: first}`
    // beside it — so only hand-written files ever hit it: they sat at the identity until played.
    it('an authored node animating one individual channel rests where the engine starts it', () => {
        const out = materializeRestPosesInTree(docOf([
            { type: 'ellipse', id: 'e', rx: 64, ry: 64,
              animate: { translate: { keyframes: [kf(0, [139, 163]), kf(1000, [139, 310])] } } },
        ], { trigger: { start: 'none' } }), JS);
        // The pose is the canonical static form the editor writes, rendered like it.
        expect(first(out).transform).toEqual({ translate: [139, 163] });
        expect(staticAttr(first(out), 'transform')).toBe('translate(139,163)');
    });

    it('every kind of animated attribute rests on its first frame when no static value is authored', () => {
        // One node per attribute kind: scalar, colour, number list, unified transform, and each
        // individual transform channel. Whatever the engine writes at frame 0 must be what the
        // static document renders — for ALL of them, not only the ones a wrapper happens to use.
        const cases: Array<[string, PxNode]> = [
            ['opacity',         { type: 'rect', id: 'a', animate: { opacity:         { keyframes: [kf(0, 0.25), kf(1000, 1)] } } }],
            ['r',               { type: 'circle', id: 'b', animate: { r:             { keyframes: [kf(0, 7), kf(1000, 30)] } } }],
            ['fill',            { type: 'rect', id: 'c', animate: { fill:            { keyframes: [kf(0, '#ff0000'), kf(1000, '#0000ff')] } } }],
            ['strokeDasharray', { type: 'path', id: 'd', animate: { strokeDasharray: { keyframes: [kf(0, [4, 2]), kf(1000, [8, 8])] } } }],
            ['transform',       { type: 'g', id: 'e', animate: { transform:          { keyframes: [kf(0, { rotate: 15 }), kf(1000, { rotate: 90 })] } } }],
            ['translate',       { type: 'g', id: 'f', animate: { translate:          { keyframes: [kf(0, [10, 20]), kf(1000, [50, 60])] } } }],
            ['rotate',          { type: 'g', id: 'g', animate: { rotate:             { keyframes: [kf(0, 30), kf(1000, 60)] } } }],
            ['scale',           { type: 'g', id: 'h', animate: { scale:              { keyframes: [kf(0, [2, 2]), kf(1000, [1, 1])] } } }],
        ];
        // Lists render "4 2" statically and "4,2" from the engine — same numbers, one comparison.
        const numbers = (text: string | undefined): string | undefined => text?.replace(/[\s,]+/g, ' ').trim();
        for (const [label, node] of cases) {
            const out = materializeRestPosesInTree(docOf([node]), JS);
            const engine = engineFirstFrame(out).get(String(node.id));
            // The engine writes individual channels and the unified transform to ONE attribute.
            const attr = PX_TRANSFORM_FN_NAMES.has(label) ? 'transform' : label;
            const rendered = staticAttr(first(out), attr);
            expect(rendered, `${label}: has a rest pose at all`).toBeDefined();
            expect(numbers(rendered), `${label}: static document vs engine's first frame`).toBe(numbers(engine?.get(attr)));
        }
    });

    it('skips a transform when the node already carries a static individual channel', () => {
        const out = materializeRestPosesInTree(docOf([
            { type: 'g', rotate: 45, animate: { transform: { keyframes: [kf(0, { translate: [1, 2] }), kf(500, { translate: [5, 6] })] } } },
        ]), JS);
        expect(first(out).transform).toBeUndefined();
    });

    it('adds no ids to the document', () => {
        // The engine's binding pass ids every animated node it meets — on a scratch copy here.
        const out = materializeRestPosesInTree(docOf([
            { type: 'rect', animate: { opacity: { keyframes: [kf(0, 0.5), kf(500, 1)] } } },
        ]), JS);
        expect(Number(first(out).opacity)).toBe(0.5);
        expect(first(out).id).toBeUndefined();
    });

    // -- The guarantees --------------------------------------------------------

    it('never changes the ANIMATION — the engines get identical bindings', () => {
        // Verified by the stage itself, not assumed: a static transform composes UNDER the
        // keyframes, so the second node's pose (a `rotate` its later keyframe does not set) is
        // exactly the kind that could leak. Whatever the stage decides, the bindings must match.
        const doc = docOf([
            { type: 'g', id: 'a', animate: { transform: { keyframes: [kf(0, { translate: [10, 20], rotate: -12 }), kf(600, { translate: [90, 20], rotate: 40 })] } } },
            { type: 'g', id: 'b', animate: { transform: { keyframes: [kf(0, { translate: [1, 2], rotate: 10 }), kf(500, { translate: [5, 6] })] } } },
            { type: 'rect', id: 'c', animate: { opacity: { keyframes: [kf(-100, 0.2), kf(1000, 1)] }, transform: { keyframes: [kf(0, { scale: [4, 4] }), kf(1000, { scale: [1, 1] })] } } },
        ]);
        for (const engine of [PxTimelineEngine.js, PxTimelineEngine.native]) {
            expect(normalizeBindings(materializeRestPosesInTree(doc, engine), engine), String(engine))
                .toEqual(normalizeBindings(doc, engine));
        }
    });

    it('does not mutate its input, and is idempotent', () => {
        const doc = docOf([{ type: 'g', id: 'w', animate: { transform: { keyframes: [kf(0, { rotate: -12 }), kf(500, { rotate: 30 })] } } }]);
        const before = JSON.stringify(doc);
        const once = materializeRestPosesInTree(doc, JS);
        expect(JSON.stringify(doc)).toBe(before);
        expect(materializeRestPosesInTree(once, JS)).toEqual(once);
    });

    it('as the last pipeline stage: every generated wrapper rests exactly where the engine starts it', () => {
        // `transformBy` expands into animated wrapper <g>s — the commonest generated node. Its
        // keyframes start before 0 here, as converted documents' do.
        const doc = docOf([{
            type: 'rect', id: 'r', width: 10, height: 10,
            effects: { transformBy: {
                translate: { keyframes: [kf(-200, [10, 40]), kf(1000, [80, 40])] },
                rotate: { keyframes: [kf(0, -12), kf(1000, 30)] },
            } },
        }]);
        const out = materializeAllInTree(doc, JS);
        const engine = engineFirstFrame(out);

        let checked = 0;
        const walk = (n: PxNode): void => {
            const track = (n.animate as { transform?: { keyframes?: Array<unknown> } } | undefined)?.transform;
            if (track?.keyframes?.length && n.id) {
                expect(staticAttr(n, 'transform'), 'rest pose of ' + n.id).toBe(engine.get(String(n.id))?.get('transform'));
                checked++;
            }
            (n.children ?? []).forEach(walk);
        };
        walk(out);
        // The scene must actually produce animated wrappers, or the loop above checked nothing.
        expect(checked).toBeGreaterThanOrEqual(2);
    });
});
