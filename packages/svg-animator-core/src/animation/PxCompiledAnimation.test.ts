/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// The compiled animation layer (dev-docs/plans/compiled-animation-layer.md): the `plain` stage lowers
// every `animate` entry to `{ kind, keyframes }` with explicit values, IN the document, and the result is
// a valid document of the public schema — so a copy re-prepares like any input.

import { describe, expect, it } from 'vitest';
import { prepareDocument } from '../pipeline/PxPrepareDocument';
import { getAnimatorConfig, PxTimelineEngine, PxValueKind } from '../format/PxAnimatorConstants';
import { isCompiledAnimation, PxAnyPropertyAnimationSchema, validateDocument, type PxDocument, type PxAnyPropertyAnimation, type PxNode } from '../format/PxAnimatorTypes';
import { calcAnimationValues, normalizeBindings } from './PxDefinitions';
import { authorCompiledAnimations } from './PxAuthoredAnimation';

const doc = (inTime = 0): PxDocument => JSON.parse(JSON.stringify({
    type: 'svg',
    animator: { timeline: { inTime, outTime: inTime + 1000 }, definitions: { easings: { smooth: [0.42, 0, 0.58, 1] } } },
    children: [
        { type: 'rect', id: 'box', animate: {
            opacity: { keyframes: [{ time: inTime, value: 1 }, { time: inTime + 500, value: 0.5 }] },
            fill: { keyframes: [{ time: inTime, value: '#ff0000', easing: 'smooth' }, { time: inTime + 400, value: '#0000ff' }], loop: true },
        } },
        { type: 'path', id: 'wave', animate: {
            d: { keyframes: [{ time: inTime, value: { pathData: 'M0 0 L10 0' } }, { time: inTime + 500, value: { pathData: 'M0 0 L10 10' } }], loop: true },
        } },
        { type: 'circle', id: 'dot', animate: {
            transform: { autoOrient: true, keyframes: [
                { time: inTime, value: { translate: [0, 0] }, tangentOut: [50, 0] },
                { time: inTime + 1000, value: { translate: [100, 100] }, tangentIn: [0, -50] },
            ] },
        } },
    ],
}));

/** The `animate` entry `prop` of the child `id`. */
const entryOf = (d: PxDocument, id: string, prop: string): PxAnyPropertyAnimation | undefined => {
    const node = (d.children ?? []).find((n: PxNode) => n.id === id);
    const animate = node?.animate;
    return animate && typeof animate === 'object' && !Array.isArray(animate) ? animate[prop] : undefined;
};

/** What the engine writes, at nine times of the window. */
const framesOf = (d: PxDocument, engine: PxTimelineEngine): string => {
    const duration = getAnimatorConfig(d)?.duration ?? 1000;
    const frames: Array<unknown> = [];
    for (const b of normalizeBindings(d, engine)) for (let i = 0; i <= 8; i++) frames.push([b.id, calcAnimationValues(b.channels, duration * i / 8)]);
    return JSON.stringify(frames);
};

describe('the plain stage lowers every animate entry to its compiled form', () => {

    it('values typed by kind, easings resolved, loops expanded — no `loop`, no names', () => {
        const plain = prepareDocument(doc(), { engine: PxTimelineEngine.native });
        const fill = entryOf(plain, 'box', 'fill');
        const d = entryOf(plain, 'wave', 'd');
        const opacity = entryOf(plain, 'box', 'opacity');
        expect(fill && isCompiledAnimation(fill) && fill.kind).toBe(PxValueKind.color);
        expect(opacity && isCompiledAnimation(opacity) && opacity.kind).toBe(PxValueKind.number);
        expect(d && isCompiledAnimation(d) && d.kind).toBe(PxValueKind.path);
        if (!fill || !isCompiledAnimation(fill) || fill.kind !== PxValueKind.color) throw new Error('fill not compiled');
        expect(fill.keyframes[0]).toEqual({ time: 0, value: [1, 0, 0, 1], easing: [0.42, 0, 0.58, 1] });
        expect(fill.keyframes.every(kf => kf.value.length === 4)).toBe(true);
        expect(fill.keyframes[fill.keyframes.length - 1].time).toBe(1000);   // the loop filled the window
        expect('loop' in fill).toBe(false);
    });

    it('a motion path is sampled for the native engine, kept with its tangents for the frame loop', () => {
        const native = entryOf(prepareDocument(doc(), { engine: PxTimelineEngine.native }), 'dot', 'transform');
        const frames = entryOf(prepareDocument(doc(), { engine: PxTimelineEngine.js }), 'dot', 'transform');
        if (!native || !isCompiledAnimation(native) || native.kind !== PxValueKind.transform) throw new Error('native transform not compiled');
        if (!frames || !isCompiledAnimation(frames) || frames.kind !== PxValueKind.transform) throw new Error('frames transform not compiled');
        expect(native.keyframes.length).toBeGreaterThan(2);
        expect(native.autoOrient).toBeUndefined();
        expect(native.keyframes.some(kf => kf.tangentIn || kf.tangentOut)).toBe(false);
        expect(frames.autoOrient).toBe(true);
        expect(frames.keyframes[0].tangentOut).toEqual([50, 0]);
    });

    it('times stay in CONTENT ms — the bindings are shifted into the window', () => {
        const plain = prepareDocument(doc(200), { engine: PxTimelineEngine.native });
        const opacity = entryOf(plain, 'box', 'opacity');
        expect(opacity && isCompiledAnimation(opacity) ? opacity.keyframes.map(kf => kf.time) : undefined).toEqual([200, 700]);
        const box = normalizeBindings(plain, PxTimelineEngine.native).find(b => b.id === 'box');
        expect(box?.channels.opacity.keyframes.map(kf => kf.time)).toEqual([0, 500]);
    });
});

describe('a prepared document is a valid document', () => {

    for (const engine of [PxTimelineEngine.native, PxTimelineEngine.js]) {
        it('copied through JSON (stamps lost), it re-prepares with no problems and plays the same — ' + engine, () => {
            const plain = prepareDocument(doc(), { engine });
            const copy: PxDocument = JSON.parse(JSON.stringify(plain));
            // strict: every key of the lowered document is one the schema declares
            expect(validateDocument(copy).errors).toEqual([]);
            const problems: Array<unknown> = [];
            const again = prepareDocument(copy, { engine, onProblems: ps => problems.push(...ps) });
            expect(problems).toEqual([]);
            expect(framesOf(again, engine)).toBe(framesOf(JSON.parse(JSON.stringify(plain)), engine));
        });
    }
});

describe('an entry is all authored or all compiled', () => {

    it('takes either form', () => {
        expect(PxAnyPropertyAnimationSchema.is({ keyframes: [{ time: 0, value: '#ff0000', easing: 'smooth' }], loop: true })).toBe(true);
        expect(PxAnyPropertyAnimationSchema.is({ kind: 'color', keyframes: [{ time: 0, value: [1, 0, 0, 1] }] })).toBe(true);
    });

    it('rejects a mix — a compiled kind with authored values, an unknown kind, a compiled keyframe with no time', () => {
        expect(PxAnyPropertyAnimationSchema.is({ kind: 'color', keyframes: [{ time: 0, value: '#ff0000' }] })).toBe(false);
        expect(PxAnyPropertyAnimationSchema.is({ kind: 'color', keyframes: [{ time: 0, value: [1, 0, 0] }] })).toBe(false);
        expect(PxAnyPropertyAnimationSchema.is({ kind: 'bogus', keyframes: [] })).toBe(false);
        expect(PxAnyPropertyAnimationSchema.is({ kind: 'number', keyframes: [{ value: 1 }] })).toBe(false);
    });
});

describe('reading a compiled document back as its authored form', () => {

    it('no `kind` is left, and the authored document plays the same', () => {
        const plain: PxDocument = JSON.parse(JSON.stringify(prepareDocument(doc(), { engine: PxTimelineEngine.js })));
        const authored = authorCompiledAnimations(plain) as PxDocument;
        expect(JSON.stringify(authored)).not.toContain('"kind"');
        const fill = entryOf(authored, 'box', 'fill');
        expect(fill && !isCompiledAnimation(fill) ? fill.keyframes?.[0].value : undefined).toBe('rgba(255,0,0,1)');
        const d = entryOf(authored, 'wave', 'd');
        expect(d && !isCompiledAnimation(d) ? d.keyframes?.[0].value : undefined).toEqual({ pathData: 'M0,0L10,0' });
        expect(framesOf(prepareDocument(authored, { engine: PxTimelineEngine.js }), PxTimelineEngine.js))
            .toBe(framesOf(plain, PxTimelineEngine.js));
    });

    it('a document with nothing compiled comes back as the same object', () => {
        const authored = doc();
        expect(authorCompiledAnimations(authored)).toBe(authored);
    });
});
