import { describe, expect, it } from 'vitest';
import { PxAnimatorEngine, PxEffectsSchema, validateNodeEffects } from './PxAnimatorTypes';
import type { PxValidationContext } from './PxSchema';
import { materialiseAllInTree } from './PxAnimatorMaterialiseAll';
import { calcAnimationValues, getNormalisedBindings } from './PxDefinitions';
import { generateNewIds } from './PxIdUtil';

describe('validateNodeEffects', () => {
    it('returns no warnings for empty tree', () => {
        expect(validateNodeEffects({ type: 'svg' } as any)).toEqual([]);
    });
    it('returns no warnings for valid effects', () => {
        expect(validateNodeEffects({
            type: 'svg',
            children: [{
                type: 'rect',
                effects: { transformation: { translate: [10, 20], rotate: 45 } },
            }],
        } as any)).toEqual([]);
    });
    it('reports warnings for malformed effects (wrong type)', () => {
        const warnings = validateNodeEffects({
            type: 'svg',
            children: [{
                type: 'rect',
                effects: { transformation: { translate: 'not-a-vec2' } },
            }],
        } as any);
        expect(warnings.length).toBeGreaterThan(0);
    });
    it('flags unknown top-level effect key in strict mode', () => {
        const warnings = validateNodeEffects({
            type: 'svg',
            children: [{ type: 'rect', effects: { madeUpEffect: { foo: 1 } } }],
        } as any, { strict: true });
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings.join('\n')).toContain('madeUpEffect');
    });
});

// ---------------------------------------------------------------------------
// Keyframe short aliases inside EFFECT payloads
// ---------------------------------------------------------------------------

describe('effect keyframes accept the short wire aliases', () => {
    const D = (children: Array<any>): any => ({
        type: 'svg', viewBox: '0 0 100 100', animator: { duration: 1000 }, children,
    });
    const long = (a: any, b: any) => [{ time: 0, value: a }, { time: 1000, value: b }];
    const short = (a: any, b: any) => [{ t: 0, v: a }, { t: 1000, v: b }];

    /** Values the frames engine would write at t=0 and t=duration. */
    const sample = (doc: any) => {
        const m = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.webapi));
        const bindings = getNormalisedBindings(m, PxAnimatorEngine.frames) || [];
        return bindings.map(b => [
            calcAnimationValues(b.animate as any, 0),
            calcAnimationValues(b.animate as any, 1000),
        ]);
    };

    const cases: Array<[string, (k: (a: any, b: any) => any) => any]> = [
        ['transformation.translate', k => D([{ type: 'rect', id: 'a', width: 9, height: 9,
            effects: { transformation: { translate: { keyframes: k([0, 0], [9, 9]) } } } }])],
        ['transformation.rotate', k => D([{ type: 'rect', id: 'a', width: 9, height: 9,
            effects: { transformation: { rotate: { keyframes: k(0, 90) } } } }])],
        ['transformation.skew', k => D([{ type: 'rect', id: 'a', width: 9, height: 9,
            effects: { transformation: { skew: { keyframes: k(0, 30) } } } }])],
        ['repeater.translate', k => D([{ type: 'rect', id: 'a', width: 4, height: 4,
            effects: { repeater: { copies: 2, translate: { keyframes: k([2, 0], [6, 0]) } } } }])],
        ['repeater.rotate', k => D([{ type: 'rect', id: 'a', width: 4, height: 4,
            effects: { repeater: { copies: 2, rotate: { keyframes: k(0, 20) } } } }])],
        ['trimPath.range', k => D([{ type: 'path', id: 'a', d: 'M0,0 L9,9', stroke: '#000',
            effects: { trimPath: { range: { keyframes: k([0, 0], [0, 1]) } } } }])],
    ];

    it.each(cases)('%s: {t,v} behaves exactly like {time,value}', (_name, build) => {
        const withLong = sample(build(long));
        const withShort = sample(build(short));
        expect(withShort).toEqual(withLong);
        // and it must actually move — a frozen animation would trivially "match"
        expect(withLong.some(([a, b]) => JSON.stringify(a) !== JSON.stringify(b))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Animated gradient GEOMETRY (endpoints / centre / focal / radius)
// ---------------------------------------------------------------------------

describe('gradient geometry animation', () => {
    const linearDoc = (): any => ({
        type: 'svg', viewBox: '0 0 200 200', animator: { duration: 1000 },
        children: [{
            type: 'ellipse', id: 'a', rx: 50, ry: 50, transform: 'translate(100,100)',
            effects: {
                fillGradient: {
                    type: 'linear',
                    // GRAMMAR-1 slots — the old `animate.gradientY1…` channels were removed.
                    p1: { value: [-45, -45], keyframes: [{ time: 0, value: [-45, -45] }, { time: 1000, value: [-45, 45] }] },
                    p2: { value: [45, 45], keyframes: [{ time: 0, value: [45, 45] }, { time: 1000, value: [45, -45] }] },
                    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
                },
            },
        }],
    });

    it('is accepted by STRICT effects validation', () => {
        const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
        const ok = PxEffectsSchema.isValid(linearDoc().children[0].effects, ctx, ['n.effects']);
        expect(ctx.errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('drives the minted gradient def\'s own attributes', () => {
        const m = generateNewIds(materialiseAllInTree(linearDoc(), PxAnimatorEngine.webapi));
        const bindings = getNormalisedBindings(m, PxAnimatorEngine.frames) || [];
        const geom = bindings
            .map(b => calcAnimationValues(b.animate as any, 0))
            .find(v => 'y1' in v || 'y2' in v);
        expect(geom).toBeDefined();

        const at = (t: number) => {
            const b = bindings.find(x => 'y1' in calcAnimationValues(x.animate as any, 0))!;
            return calcAnimationValues(b.animate as any, t);
        };
        expect(+at(0).y1).toBeCloseTo(-45, 3);
        expect(+at(1000).y1).toBeCloseTo(45, 3);
        expect(+at(0).y2).toBeCloseTo(45, 3);
        expect(+at(1000).y2).toBeCloseTo(-45, 3);
    });

    it('maps every radial channel onto its SVG attribute', () => {
        const doc: any = {
            type: 'svg', viewBox: '0 0 200 200', animator: { duration: 1000 },
            children: [{
                type: 'ellipse', id: 'a', rx: 50, ry: 50,
                effects: {
                    fillGradient: {
                        type: 'radial',
                        c: { value: [0, 0], keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [20, 30] }] },
                        fp: { value: [0, 0], keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [10, 15] }] },
                        r: { value: 50, keyframes: [{ time: 0, value: 50 }, { time: 1000, value: 90 }] },
                        stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }],
                    },
                },
            }],
        };
        const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxEffectsSchema.isValid(doc.children[0].effects, ctx, ['n.effects'])).toBe(true);

        const m = generateNewIds(materialiseAllInTree(doc, PxAnimatorEngine.webapi));
        const bindings = getNormalisedBindings(m, PxAnimatorEngine.frames) || [];
        const end = bindings.map(b => calcAnimationValues(b.animate as any, 1000)).find(v => 'r' in v)!;
        expect(end).toMatchObject({ cx: '20', cy: '30', fx: '10', fy: '15', r: '90' });
    });
});
