/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// TRANSFORM PRECEDENCE (review §0.4/§1.6) — CSS's composition rule at read time:
// a static `transform` composes UNDER the animated transform instead of being
// clobbered. Pins the merge itself (`mergeStaticTransformIntoAnimDef`), the
// conservative string parser, and the end-to-end normalisation path.

import { describe, expect, it } from 'vitest';
import { getNormalisedBindings, mergeStaticTransformIntoAnimDef } from './PxDefinitions';
import { parseTransformParts } from './PxAnimatorUtil';
import type { PxAnimatedSvgDocument, PxAnimationDefinition } from './PxAnimatorTypes';

describe('parseTransformParts — conservative inverse of composeTransformParts', () => {

    it('parses the canonical shapes', () => {
        expect(parseTransformParts('translate(3,4)')).toEqual({ translate: [3, 4] });
        expect(parseTransformParts('translate(3,4)rotate(45)scale(2,3)'))
            .toEqual({ translate: [3, 4], rotate: 45, scale: [2, 3] });
        expect(parseTransformParts('rotate(45) skewX(10)')).toEqual({ rotate: 45, skew: 10 });
        expect(parseTransformParts('scale(2)')).toEqual({ scale: [2, 2] });
        expect(parseTransformParts('translate(5)')).toEqual({ translate: [5, 0] });
    });

    it('refuses anything it cannot represent as parts', () => {
        expect(parseTransformParts('matrix(1,0,0,1,10,20)')).toBeUndefined();
        expect(parseTransformParts('rotate(45 10 10)')).toBeUndefined();      // pivot form
        expect(parseTransformParts('translate(1,2)translate(3,4)')).toBeUndefined(); // repeat (origin sandwich)
        expect(parseTransformParts('rotate(45)translate(3,4)')).toBeUndefined();     // out of canonical order
        expect(parseTransformParts('translate(3,4) garbage')).toBeUndefined();
        expect(parseTransformParts('')).toBeUndefined();
        expect(parseTransformParts(undefined)).toBeUndefined();
    });
});

describe('mergeStaticTransformIntoAnimDef — the merge rules', () => {

    it('partial transform keyframes inherit the static parts (kf wins per key)', () => {
        const out = mergeStaticTransformIntoAnimDef({
            transform: { keyframes: [
                { time: 0, value: { translate: [0, 0] } },
                { time: 1000, value: { translate: [80, 0], rotate: 90 } },
            ] },
        }, { rotate: 45, scale: [2, 2] });
        const kfs: any = (out.transform as any).keyframes;
        expect(kfs[0].value).toEqual({ rotate: 45, scale: [2, 2], translate: [0, 0] });
        expect(kfs[1].value).toEqual({ rotate: 90, scale: [2, 2], translate: [80, 0] }); // kf rotate wins
    });

    it('a string static transform is parsed before merging', () => {
        const out = mergeStaticTransformIntoAnimDef({
            transform: { keyframes: [{ time: 0, value: { translate: [1, 1] } }] },
        }, 'rotate(45)');
        expect((out.transform as any).keyframes[0].value).toEqual({ rotate: 45, translate: [1, 1] });
    });

    it('ONE individual channel lifts into a unified transform channel carrying the static parts', () => {
        const out = mergeStaticTransformIntoAnimDef({
            translate: { keyframes: [
                { time: 0, value: [0, 0] },
                { time: 1000, value: [80, 0] },
            ] },
            opacity: { keyframes: [{ time: 0, value: 1 }] },   // untouched bystander
        }, { rotate: 45 });
        expect(out.translate).toBeUndefined();
        const kfs: any = (out.transform as any).keyframes;
        expect(kfs[0].value).toEqual({ rotate: 45, translate: [0, 0] });
        expect(kfs[1].value).toEqual({ rotate: 45, translate: [80, 0] });
        expect(out.opacity).toBeDefined();
    });

    it('does NOT merge: no static parts, several individual channels, or unparseable static', () => {
        const twoChannels: PxAnimationDefinition = {
            translate: { keyframes: [{ time: 0, value: [0, 0] }] },
            rotate: { keyframes: [{ time: 0, value: 0 }] },
        };
        expect(mergeStaticTransformIntoAnimDef(twoChannels, { rotate: 45 })).toBe(twoChannels);

        const anim: PxAnimationDefinition = { transform: { keyframes: [{ time: 0, value: { rotate: 1 } }] } };
        expect(mergeStaticTransformIntoAnimDef(anim, undefined)).toBe(anim);
        expect(mergeStaticTransformIntoAnimDef(anim, 'matrix(1,0,0,1,0,0)')).toBe(anim);
    });

    it('keeps loop / autoOrient / tangents through the merge', () => {
        const out = mergeStaticTransformIntoAnimDef({
            transform: {
                autoOrient: true,
                loop: true,
                keyframes: [{ time: 0, value: { translate: [0, 0] }, tangentOut: [10, 0] }],
            },
        }, { rotate: 45 });
        const anim: any = out.transform;
        expect(anim.autoOrient).toBe(true);
        expect(anim.loop).toBe(true);
        expect(anim.keyframes[0].tangentOut).toEqual([10, 0]);
        expect(anim.keyframes[0].value.rotate).toBe(45);
    });
});

describe('end-to-end — getNormalisedBindings composes the static transform under the animation', () => {

    const docWith = (animate: object, staticTransform: unknown): PxAnimatedSvgDocument => ({
        type: 'svg',
        animator: { duration: 1000 },
        children: [{ type: 'rect', id: 'r', width: 10, height: 10, transform: staticTransform, animate }],
    } as unknown as PxAnimatedSvgDocument);

    it('the §0.4 worked example: rect rotated 45° slides AND stays rotated', () => {
        const bindings = getNormalisedBindings(docWith({
            translate: { keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [80, 0] }] },
        }, { rotate: 45 }));
        const anim: any = bindings[0].animate;
        expect(anim.translate).toBeUndefined();                       // lifted into transform
        const kfs = anim.transform.keyframes;
        expect(kfs[0].v).toEqual({ rotate: 45, translate: [0, 0] });
        expect(kfs[1].v).toEqual({ rotate: 45, translate: [80, 0] });
    });

    it('partial transform parts records inherit a STRING static transform', () => {
        const bindings = getNormalisedBindings(docWith({
            transform: { keyframes: [
                { time: 0, value: { translate: [0, 0] } },
                { time: 1000, value: { translate: [80, 0] } },
            ] },
        }, 'translate(10,10)rotate(45)'));
        const kfs: any = (bindings[0].animate as any).transform.keyframes;
        expect(kfs[0].v).toEqual({ translate: [0, 0], rotate: 45 }); // kf translate wins; rotate inherited
        expect(kfs[1].v).toEqual({ translate: [80, 0], rotate: 45 });
    });
});
