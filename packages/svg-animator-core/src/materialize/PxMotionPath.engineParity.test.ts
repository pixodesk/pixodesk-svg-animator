/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ENGINE PARITY for motion along a path: a document must look the same whichever engine plays
// it. The native engine SAMPLES the path into plain `{translate, rotate}` keyframes up front;
// the `js` engine keeps the parametric form and evaluates it per frame. Two implementations of
// one rule — so they are compared here, frame by frame, rather than trusted to agree.

import { describe, expect, it } from 'vitest';
import { PxTimelineEngine } from '../format/PxAnimatorConstants';
import type { PxAnimatedSvgDocument } from '../format/PxAnimatorTypes';
import { createAdapterAnimator } from '../playback/PxFrameLoop';
import { materializeAllInTree } from './PxAnimatorMaterializeAll';


/** A rect following a curve that starts heading DOWN (tangent 90°) and ends heading RIGHT (0°). */
function curveDoc(engine: 'js' | 'native', rotate: { from?: number; to?: number }, autoOrient: boolean, staticRotate?: number): PxAnimatedSvgDocument {
    const value = (translate: [number, number], r: number | undefined) => (r === undefined ? { translate } : { translate, rotate: r });
    return {
        type: 'svg', viewBox: '0 0 200 200',
        animator: { timeline: { duration: 1000, engine } },
        children: [{
            type: 'rect', id: 'r', width: 10, height: 10,
            ...(staticRotate !== undefined ? { transform: { translate: [0, 0], rotate: staticRotate } } : {}),
            animate: { transform: { autoOrient, keyframes: [
                { time: 0, value: value([0, 0], rotate.from), tangentOut: [0, 60] },
                { time: 1000, value: value([100, 100], rotate.to), tangentIn: [-60, 0] },
            ] } },
        }],
    };
}

/** `{x, y, rotate}` the engine writes for the rect at `timeMs`. */
function poseAt(doc: PxAnimatedSvgDocument, engine: PxTimelineEngine, timeMs: number): { x: number; y: number; rotate: number } {
    let written = '';
    const api = createAdapterAnimator(materializeAllInTree(doc, engine), {
        isConnected: () => true,
        setAttribute: (_id, attr, v) => { if (attr === 'transform') written = String(v); },
    });
    api.setCurrentTime(timeMs);
    const t = /translate\(([-\d.e]+),([-\d.e]+)\)/.exec(written);
    const r = /rotate\(([-\d.e]+)\)/.exec(written);
    return { x: t ? +t[1] : NaN, y: t ? +t[2] : NaN, rotate: r ? +r[1] : 0 };
}

const TIMES = [0, 125, 250, 500, 750, 1000];


describe('motion path — the js and native engines agree', () => {

    it('auto-orient ADDS to the element\'s own rotation, in both engines', () => {
        // REGRESSION: the js engine OVERWROTE the interpolated `rotate` with the tangent angle,
        // so a base rotation was silently dropped — the same document turned 30° less under
        // `engine: 'js'` than under `native`, which sums them (as the editor and Lottie do).
        for (const t of TIMES) {
            const js = poseAt(curveDoc('js', { from: 30, to: 30 }, true), PxTimelineEngine.js, t);
            const native = poseAt(curveDoc('native', { from: 30, to: 30 }, true), PxTimelineEngine.native, t);
            const tangentOnly = poseAt(curveDoc('js', {}, true), PxTimelineEngine.js, t);

            expect(js.rotate, 'js = tangent + base @' + t).toBeCloseTo(tangentOnly.rotate + 30, 3);
            expect(js.rotate, 'js vs native @' + t).toBeCloseTo(native.rotate, 1);
        }
    });

    it('an ANIMATED base rotation rides on top of the tangent, in both engines', () => {
        for (const t of TIMES) {
            const js = poseAt(curveDoc('js', { from: 0, to: 80 }, true), PxTimelineEngine.js, t);
            const native = poseAt(curveDoc('native', { from: 0, to: 80 }, true), PxTimelineEngine.native, t);
            expect(js.rotate, 'rotate @' + t).toBeCloseTo(native.rotate, 0);
        }
        // …and it really is animated on top: at the end the tangent is 0°, the base is 80°.
        expect(poseAt(curveDoc('js', { from: 0, to: 80 }, true), PxTimelineEngine.js, 1000).rotate).toBeCloseTo(80, 3);
    });

    it('a STATIC rotate is the base rotation when the keyframes set none — in both engines', () => {
        // The player's precedence rule: a static transform composes UNDER the animated one, so a
        // static `rotate: 30` is every keyframe's rotation unless a keyframe says otherwise.
        // REGRESSION: the native engine flattened the path BEFORE that merge ran, never saw the
        // static, and played the tangent alone — 30° off from the js engine.
        for (const t of TIMES) {
            const js = poseAt(curveDoc('js', {}, true, 30), PxTimelineEngine.js, t);
            const native = poseAt(curveDoc('native', {}, true, 30), PxTimelineEngine.native, t);
            const tangentOnly = poseAt(curveDoc('js', {}, true), PxTimelineEngine.js, t);

            expect(js.rotate, 'js @' + t).toBeCloseTo(tangentOnly.rotate + 30, 3);
            expect(native.rotate, 'native @' + t).toBeCloseTo(js.rotate, 1);
        }
    });

    it('a keyframe rotate WINS over the static one — the static value then cannot affect playback', () => {
        // What lets a writer put the first-frame pose (tangent included) in the static transform
        // without changing the animation: keyframes that carry `rotate` override it completely.
        for (const t of TIMES) {
            for (const [engine, name] of [[PxTimelineEngine.js, 'js'], [PxTimelineEngine.native, 'native']] as const) {
                const plain = poseAt(curveDoc(name, { from: 30, to: 30 }, true), engine, t);
                const withStatic = poseAt(curveDoc(name, { from: 30, to: 30 }, true, 120), engine, t);
                expect(withStatic.rotate, name + ' @' + t).toBeCloseTo(plain.rotate, 6);
            }
        }
    });

    it('no auto-orient: the base rotation is used as it is, in both engines', () => {
        for (const t of TIMES) {
            const js = poseAt(curveDoc('js', { from: 30, to: 30 }, false), PxTimelineEngine.js, t);
            const native = poseAt(curveDoc('native', { from: 30, to: 30 }, false), PxTimelineEngine.native, t);
            expect(js.rotate, 'js @' + t).toBeCloseTo(30, 3);
            expect(native.rotate, 'native @' + t).toBeCloseTo(30, 3);
        }
    });

    it('the POSITION along the curve agrees too', () => {
        for (const t of TIMES) {
            const js = poseAt(curveDoc('js', { from: 30, to: 30 }, true), PxTimelineEngine.js, t);
            const native = poseAt(curveDoc('native', { from: 30, to: 30 }, true), PxTimelineEngine.native, t);
            expect(js.x, 'x @' + t).toBeCloseTo(native.x, 0);
            expect(js.y, 'y @' + t).toBeCloseTo(native.y, 0);
        }
    });
});
