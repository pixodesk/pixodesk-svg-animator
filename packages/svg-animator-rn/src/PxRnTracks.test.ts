/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { generateNewIds, materialiseAllInTree, PxAnimatorEngine, type PxAnimatedSvgDocument } from '@pixodesk/svg-animator-core';
import { compileTracks, sampleProps } from './PxRnTracks';
import { toRnPropName } from './PxRnPropNames';

function makeDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg',
        viewBox: '0 0 200 200',
        animator: { mode: 'frames', duration: 1000, iterations: 2, direction: 'alternate' },
        children: [
            {
                type: 'rect',
                id: 'r1',
                x: 0, y: 0, width: 50, height: 50, fill: '#3b82f6',
                animate: {
                    opacity: { keyframes: [{ time: 0, value: 1 }, { time: 1000, value: 0 }] },
                    fill: { keyframes: [{ time: 0, value: '#3b82f6' }, { time: 1000, value: '#ec4899' }] },
                    'stroke-width': { keyframes: [{ time: 0, value: 1 }, { time: 1000, value: 5 }] },
                },
            },
            {
                type: 'g',
                id: 'g1',
                animate: {
                    translate: { keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [100, 100] }] },
                },
                children: [{ type: 'circle', cx: 0, cy: 0, r: 10, fill: '#000' }],
            },
        ],
    };
}

function compile(doc = makeDoc(), opts?: Parameters<typeof compileTracks>[1]) {
    const materialised = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.frames));
    return compileTracks(materialised, opts);
}

describe('compileTracks', () => {
    it('captures animator config (duration, iterations, direction, fill default)', () => {
        const tracks = compile();
        expect(tracks.duration).toBe(1000);
        expect(tracks.iterations).toBe(2);
        expect(tracks.direction).toBe('alternate');
        expect(tracks.fill).toBe('forwards');
        expect(tracks.sampleCount).toBeGreaterThanOrEqual(2);
        expect(tracks.stepMs * (tracks.sampleCount - 1)).toBeCloseTo(1000, 6);
    });

    it('produces one track set per animated element', () => {
        const tracks = compile();
        expect(tracks.elements.length).toBe(2);
    });

    it('samples numeric props with endpoint accuracy (opacity 1 → 0)', () => {
        const tracks = compile();
        const rect = tracks.elements.find(e => 'opacity' in e.props)!;
        const op = rect.props.opacity;
        expect(op[0]).toBe(1);
        expect(op[op.length - 1]).toBe(0);
        // midpoint ≈ 0.5 (linear)
        expect(+op[Math.floor(op.length / 2)]).toBeCloseTo(0.5, 1);
    });

    it('converts attr names to react-native-svg prop names (stroke-width → strokeWidth)', () => {
        const tracks = compile();
        const rect = tracks.elements.find(e => 'opacity' in e.props)!;
        expect(rect.props.strokeWidth).toBeDefined();
        expect(rect.props['stroke-width']).toBeUndefined();
        expect(+rect.props.strokeWidth[0]).toBe(1);
        expect(+rect.props.strokeWidth[rect.props.strokeWidth.length - 1]).toBe(5);
    });

    it('samples colour props as rgba strings', () => {
        const tracks = compile();
        const rect = tracks.elements.find(e => 'fill' in e.props)!;
        expect(String(rect.props.fill[0])).toMatch(/^rgba\(/);
        expect(String(rect.props.fill[rect.props.fill.length - 1])).toMatch(/^rgba\(/);
        expect(rect.props.fill[0]).not.toBe(rect.props.fill[rect.props.fill.length - 1]);
    });

    it('samples transforms as composed transform strings', () => {
        const tracks = compile();
        const g = tracks.elements.find(e => 'transform' in e.props)!;
        expect(String(g.props.transform[0])).toContain('translate(0');
        expect(String(g.props.transform[g.props.transform.length - 1])).toContain('translate(100');
    });

    it('respects sampleRate and maxSamples options', () => {
        const coarse = compile(makeDoc(), { sampleRate: 10 });
        expect(coarse.sampleCount).toBe(11); // 1s at 10/s + endpoint
        const capped = compile(makeDoc(), { sampleRate: 1000, maxSamples: 50 });
        expect(capped.sampleCount).toBe(50);
    });

    it('every track array is fully populated (no holes)', () => {
        const tracks = compile();
        for (const el of tracks.elements) {
            for (const arr of Object.values(el.props)) {
                expect(arr.length).toBe(tracks.sampleCount);
                expect(arr.every(v => v !== undefined)).toBe(true);
            }
        }
    });
});

describe('sampleProps', () => {
    it('indexes the nearest sample and clamps at both ends', () => {
        const tracks = compile();
        const rect = tracks.elements.find(e => 'opacity' in e.props)!;
        const { stepMs, sampleCount } = tracks;

        expect(sampleProps(rect, 0, stepMs, sampleCount).opacity).toBe(1);
        expect(sampleProps(rect, 1000, stepMs, sampleCount).opacity).toBe(0);
        // out-of-range clamps
        expect(sampleProps(rect, -50, stepMs, sampleCount).opacity).toBe(1);
        expect(sampleProps(rect, 5000, stepMs, sampleCount).opacity).toBe(0);
        // midpoint
        expect(+sampleProps(rect, 500, stepMs, sampleCount).opacity).toBeCloseTo(0.5, 1);
    });
});

describe('toRnPropName', () => {
    it('camelCases kebab attrs and maps known overrides', () => {
        expect(toRnPropName('stroke-width')).toBe('strokeWidth');
        expect(toRnPropName('fill')).toBe('fill');
        expect(toRnPropName('xlink:href')).toBe('href');
    });
    it('drops web-only props', () => {
        expect(toRnPropName('class')).toBeUndefined();
        expect(toRnPropName('style')).toBeUndefined();
    });
});

describe('length-list props (stroke-dasharray)', () => {
    it('compiles stroke-dasharray into number arrays (rn-svg native shape)', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg', viewBox: '0 0 100 100',
            animator: { mode: 'frames', duration: 1000 },
            children: [{
                type: 'path', id: 'p', d: 'M 0 50 L 100 50', stroke: '#000', fill: 'none',
                effects: { trimPath: { range: { keyframes: [{ time: 0, value: [0, 0.1] }, { time: 1000, value: [0, 1] }] } } },
            }],
        };
        const materialised = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.webapi));
        const tracks = compileTracks(materialised);
        const el = tracks.elements.find(e => 'strokeDasharray' in e.props)!;
        expect(el).toBeDefined();
        const first = el.props.strokeDasharray[0];
        expect(Array.isArray(first)).toBe(true);
        expect((first as number[]).every(n => typeof n === 'number' && Number.isFinite(n))).toBe(true);
        expect((first as number[]).length % 2).toBe(0);
    });
});

describe('animated <use> flattening (webapi materialisation)', () => {
    it('inlines animated <use> clones so no live references remain', () => {
        const doc: PxAnimatedSvgDocument = {
            type: 'svg', viewBox: '0 0 300 200',
            animator: { mode: 'frames', duration: 2000 },
            children: [
                { type: 'defs', children: [{ type: 'g', id: 'sym', children: [{
                    type: 'circle', id: 'c', cx: 30, cy: 40, r: 16, fill: '#f59e0b',
                    animate: { cy: { keyframes: [{ time: 0, value: 40 }, { time: 2000, value: 160 }] } },
                }] }] },
                { type: 'use', id: 'u1', href: '#sym' },
                { type: 'use', id: 'u2', href: '#sym', x: 80, effects: { clone: { baseId: 'sym', retime: { start: -600 } } } },
            ],
        };
        const materialised = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.webapi));
        const countUse = (n: any): number =>
            (n.type === 'use' ? 1 : 0) + (n.children || []).reduce((s: number, c: any) => s + countUse(c), 0);
        expect(countUse(materialised)).toBe(0);

        const tracks = compileTracks(materialised);
        const cyTracks = tracks.elements.filter(e => 'cy' in e.props);
        expect(cyTracks.length).toBe(2);
        expect(cyTracks[0].props.cy[0]).not.toBe(cyTracks[1].props.cy[0]);
    });
});
