import { describe, expect, it } from 'vitest';
import { PxEffectsSchema, validateNodeEffects, type PxAnimatedSvgDocument, type PxKeyframe, type PxKeyframeValue, type PxNode, type PxTimeline } from './PxAnimatorTypes';
import { PxTimelineEngine } from './PxAnimatorConstants';
import type { PxValidationContext } from '../schema/PxSchema';
import { materializeAllInTree } from '../materialize/PxAnimatorMaterializeAll';
import { calcAnimationValues, normalizeBindings } from '../animation/PxDefinitions';
import { generateNewIds } from '../util/PxIdUtil';
import { untyped } from '../effects/effectTestKit';

describe('validateNodeEffects', () => {
    it('returns no warnings for empty tree', () => {
        expect(validateNodeEffects({ type: 'svg' })).toEqual([]);
    });
    it('returns no warnings for valid effects', () => {
        expect(validateNodeEffects({
            type: 'svg',
            children: [{
                type: 'rect',
                effects: { transformBy: { translate: [10, 20], rotate: 45 } },
            }],
        })).toEqual([]);
    });
    it('reports warnings for malformed effects (wrong type)', () => {
        const warnings = validateNodeEffects(untyped<PxNode>({
            type: 'svg',
            children: [{
                type: 'rect',
                effects: { transformBy: { translate: 'not-a-vec2' } },
            }],
        }));
        expect(warnings.length).toBeGreaterThan(0);
    });
    it('flags unknown top-level effect key in strict mode', () => {
        const warnings = validateNodeEffects(untyped<PxNode>({
            type: 'svg',
            children: [{ type: 'rect', effects: { madeUpEffect: { foo: 1 } } }],
        }), { strict: true });
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings.join('\n')).toContain('madeUpEffect');
    });
});

// ---------------------------------------------------------------------------
// Keyframe short aliases inside EFFECT payloads
// ---------------------------------------------------------------------------

describe('effect keyframes accept the short wire aliases', () => {
    /** Two keyframes, at 0 and 1000 ms, in one of the two spellings. */
    type KeyframePair = (a: PxKeyframeValue, b: PxKeyframeValue) => Array<PxKeyframe<PxKeyframeValue>>;

    const D = (children: Array<PxNode>): PxAnimatedSvgDocument => ({
        // `timeline.duration` is the pre-1.3 spelling: not in the type, still read for old files
        type: 'svg', viewBox: '0 0 100 100', animator: { timeline: untyped<PxTimeline>({ duration: 1000 }) }, children,
    });
    const long: KeyframePair = (a, b) => [{ time: 0, value: a }, { time: 1000, value: b }];
    // the retired short `{t, v}` spelling: not in the type, still read by effect slots
    const short: KeyframePair = (a, b) => untyped<Array<PxKeyframe<PxKeyframeValue>>>([{ t: 0, v: a }, { t: 1000, v: b }]);

    /** Values the frames engine would write at t=0 and t=duration. */
    const sample = (doc: PxAnimatedSvgDocument) => {
        const m = generateNewIds(materializeAllInTree(doc, PxTimelineEngine.native));
        const bindings = normalizeBindings(m, PxTimelineEngine.js) || [];
        return bindings.map(b => [
            calcAnimationValues(b.channels, 0),
            calcAnimationValues(b.channels, 1000),
        ]);
    };

    const cases: Array<[string, (k: KeyframePair) => PxAnimatedSvgDocument]> = [
        ['transformBy.translate', k => D([{ type: 'rect', id: 'a', width: 9, height: 9,
            effects: { transformBy: { translate: { keyframes: k([0, 0], [9, 9]) } } } }])],
        ['transformBy.rotate', k => D([{ type: 'rect', id: 'a', width: 9, height: 9,
            effects: { transformBy: { rotate: { keyframes: k(0, 90) } } } }])],
        ['transformBy.skew', k => D([{ type: 'rect', id: 'a', width: 9, height: 9,
            effects: { transformBy: { skew: { keyframes: k(0, 30) } } } }])],
        ['repeater.translate', k => D([{ type: 'rect', id: 'a', width: 4, height: 4,
            effects: { repeater: { copies: 2, translate: { keyframes: k([2, 0], [6, 0]) } } } }])],
        ['repeater.rotate', k => D([{ type: 'rect', id: 'a', width: 4, height: 4,
            effects: { repeater: { copies: 2, rotate: { keyframes: k(0, 20) } } } }])],
        ['strokeTrim.range', k => D([{ type: 'path', id: 'a', d: 'M0,0 L9,9', stroke: '#000',
            effects: { strokeTrim: { range: { keyframes: k([0, 0], [0, 1]) } } } }])],
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
// Animated gradient GEOMETRY (endpoints / center / focal / radius)
// ---------------------------------------------------------------------------

describe('gradient geometry animation', () => {
    const linearDoc = (): PxAnimatedSvgDocument => ({
        // `timeline.duration` is the pre-1.3 spelling: not in the type, still read for old files
        type: 'svg', viewBox: '0 0 200 200', animator: { timeline: untyped<PxTimeline>({ duration: 1000 }) },
        children: [{
            type: 'ellipse', id: 'a', rx: 50, ry: 50, transform: 'translate(100,100)',
            effects: {
                fillGradient: {
                    type: 'linear',
                    // GRAMMAR-1 slots — the old `animate.gradientY1…` channels were removed.
                    start: { value: [-45, -45], keyframes: [{ time: 0, value: [-45, -45] }, { time: 1000, value: [-45, 45] }] },
                    end: { value: [45, 45], keyframes: [{ time: 0, value: [45, 45] }, { time: 1000, value: [45, -45] }] },
                    stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
                },
            },
        }],
    });

    it('is accepted by STRICT effects validation', () => {
        const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
        const ok = PxEffectsSchema.isValid(linearDoc().children?.[0].effects, ctx, ['n.effects']);
        expect(ctx.errors).toEqual([]);
        expect(ok).toBe(true);
    });

    it('drives the generated gradient def\'s own attributes', () => {
        const m = generateNewIds(materializeAllInTree(linearDoc(), PxTimelineEngine.native));
        const bindings = normalizeBindings(m, PxTimelineEngine.js) || [];
        const geom = bindings
            .map(b => calcAnimationValues(b.channels, 0))
            .find(v => 'y1' in v || 'y2' in v);
        expect(geom).toBeDefined();

        const at = (t: number) => {
            const b = bindings.find(x => 'y1' in calcAnimationValues(x.channels, 0))!;
            return calcAnimationValues(b.channels, t);
        };
        expect(+at(0).y1).toBeCloseTo(-45, 3);
        expect(+at(1000).y1).toBeCloseTo(45, 3);
        expect(+at(0).y2).toBeCloseTo(45, 3);
        expect(+at(1000).y2).toBeCloseTo(-45, 3);
    });

    it('maps every radial channel onto its SVG attribute', () => {
        const doc: PxAnimatedSvgDocument = {
            // `timeline.duration` is the pre-1.3 spelling: not in the type, still read for old files
            type: 'svg', viewBox: '0 0 200 200', animator: { timeline: untyped<PxTimeline>({ duration: 1000 }) },
            children: [{
                type: 'ellipse', id: 'a', rx: 50, ry: 50,
                effects: {
                    fillGradient: {
                        type: 'radial',
                        center: { value: [0, 0], keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [20, 30] }] },
                        focal: { value: [0, 0], keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [10, 15] }] },
                        radius: { value: 50, keyframes: [{ time: 0, value: 50 }, { time: 1000, value: 90 }] },
                        stops: [{ offset: 0, color: '#fff' }, { offset: 1, color: '#000' }],
                    },
                },
            }],
        };
        const ctx: PxValidationContext = { errors: [], warnings: [], strict: true };
        expect(PxEffectsSchema.isValid(doc.children?.[0].effects, ctx, ['n.effects'])).toBe(true);

        const m = generateNewIds(materializeAllInTree(doc, PxTimelineEngine.native));
        const bindings = normalizeBindings(m, PxTimelineEngine.js) || [];
        const end = bindings.map(b => calcAnimationValues(b.channels, 1000)).find(v => 'r' in v)!;
        expect(end).toMatchObject({ cx: '20', cy: '30', fx: '10', fy: '15', r: '90' });
    });
});
