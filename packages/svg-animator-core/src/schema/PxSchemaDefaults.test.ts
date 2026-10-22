/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// WHAT AN OMITTED FIELD MEANS is stated ONCE, by the schema, and every reader takes it from there:
// the player when it normalises a document, the Editor when it defaults its model. These pin
// (1) the query itself, (2) that every optional choice in the wire format STATES its default
// (an implied "first value" is exactly how `mouseOut` came to mean `continue` to the player and
// `pause` to the Editor), (3) that the runtime's own fallbacks are the schema's.

import { describe, expect, it } from 'vitest';
import { resolveAnimatorTimeline, getAnimatorConfig, PX_DEFAULT_DURATION_MS, PX_DEFAULT_ITERATIONS, PX_DEFAULT_UNITS_PER_EM, PX_TRIGGER_DEFAULTS, PxFinishAction, PxTriggerStart, resolveTrigger } from '../format/PxAnimatorConstants';
import {
    PxAnimatedSvgDocumentSchema, PxAnimatorConfigSchema, PxCloneEffectSchema, PxFillGradientEffectSchema, PxGlyphFontSchema, PxLoopSchema, PxMaskedByEffectSchema,
    PxPropertyAnimationSchema, PxScrollRangePointSchema, PxScrollSchema, PxStrokeTrimEffectSchema, PxTextPathEffectSchema, PxTimelineSchema,
    PxTimeTimelineSchema, PxTriggerSchema, type PxAnimatedSvgDocument, type PxTrigger,
} from '../format/PxAnimatorTypes';
import { describeSchema, px, schemaKeys, type PxAnySchema } from './PxSchema';
import { untyped } from '../effects/effectTestKit';

describe('schema.defaults — what an absent field means', () => {

    it('a stated default is what absent means; an implied one is not', () => {
        const shape = px.object({
            stated: px.enum(['a', 'b'] as const, 'b').optional(),
            implied: px.enum(['a', 'b'] as const).optional(),
            statedNumber: px.number(7).optional(),
            impliedNumber: px.number().optional(),
            flag: px.boolean(false).optional(),
            tag: px.literal('t').optional(),
            required: px.enum(['x', 'y'] as const),   // never absent — its first value is only the repair value
        });
        // Runtime: only stated fields are keys — an implied default is not what absent means.
        expect(shape.defaults).toEqual({ stated: 'b', statedNumber: 7, flag: false, tag: 't' });
        expect(Object.isFrozen(shape.defaults)).toBe(true);
        // Type level: the same fact — a stated field is typed without `undefined`, an implied one is no key at all.
        const stated: { readonly stated: 'a' | 'b'; readonly statedNumber: number; readonly flag: boolean; readonly tag: 't' } = shape.defaults;
        expect(stated.stated).toBe('b');
        const impliedIsNoKey: 'implied' extends keyof typeof shape.defaults ? false : true = true;
        const requiredIsNoKey: 'required' extends keyof typeof shape.defaults ? false : true = true;
        expect(impliedIsNoKey && requiredIsNoKey).toBe(true);
    });

    /** Optional fields whose absence deliberately means NOTHING (a flag that is simply not set). */
    const ABSENT_MEANS_UNSET = new Set(['clone.without']);

    it('every optional choice in the wire format states what absent means', () => {
        const unstated: Array<string> = [];
        // `_optional` is a compile-time phantom (declared, never set) — an Optional is recognised by
        // the wrapped schema it carries at runtime.
        const innerOf = (field: PxAnySchema) => { const desc = describeSchema(field); return desc.kind === 'optional' ? desc.inner : undefined; };
        const isChoice = (schema: PxAnySchema) => 'values' in schema;
        const visit = (name: string, schema: PxAnySchema) => {
            const desc = describeSchema(schema);
            if (desc.kind !== 'shape') return;
            for (const [key, field] of Object.entries(desc.shape)) {
                const path = `${name}.${key}`;
                const inner = innerOf(field);
                if (inner && isChoice(inner) && field.absentDefault() === undefined && !ABSENT_MEANS_UNSET.has(path)) unstated.push(path);
            }
        };
        let visited = 0;
        const visitCounting = (name: string, schema: PxAnySchema) => { visited++; visit(name, schema); };
        visitCounting('loop', PxLoopSchema);
        visitCounting('propertyAnimation', PxPropertyAnimationSchema);
        visitCounting('trigger', PxTriggerSchema);
        // Every member of the timeline union — time, scroll and view have fields of their own.
        const timeline = describeSchema(PxTimelineSchema);
        for (const member of timeline.kind === 'discriminatedUnion' ? timeline.members : []) visitCounting('timeline', member);
        visitCounting('scroll', PxScrollSchema);
        visitCounting('scrollRangePoint', PxScrollRangePointSchema);
        visitCounting('maskedBy', PxMaskedByEffectSchema);
        visitCounting('strokeTrim', PxStrokeTrimEffectSchema);
        visitCounting('clone', PxCloneEffectSchema);
        visitCounting('fillGradient', PxFillGradientEffectSchema);
        visitCounting('textPath', PxTextPathEffectSchema);
        expect(visited).toBeGreaterThanOrEqual(13);
        // The rule has teeth: the one deliberate flag is the only optional choice without a stated default.
        expect(PxCloneEffectSchema._shape.without.absentDefault()).toBeUndefined();
        expect(unstated, 'optional choices whose schema does not say what absent means').toEqual([]);
    });

    it('the trigger resolver fills exactly the schema\'s stated defaults', () => {
        // The schema states exactly the constants the runtime is built from. `finish` is no
        // longer a trigger key — it moved next to `fillMode` (review §13, wire 1.4).
        expect(PxTriggerSchema.defaults).toEqual(PX_TRIGGER_DEFAULTS);
        expect(resolveTrigger(undefined)).toEqual(PX_TRIGGER_DEFAULTS);
        // `timeline.finish` reaches the engines as the runtime view's `resetOnFinish`,
        // where absent = hold = not set. The PRE-1.4 `trigger.finish` spelling is still read.
        expect(PxTimeTimelineSchema.defaults.finish).toBe(PxFinishAction.hold);
        const flat = resolveAnimatorTimeline({ timeline: { trigger: { start: PxTriggerStart.load } } });
        expect(flat.resetOnFinish).toBeFalsy();
        expect(resolveAnimatorTimeline({ timeline: { finish: PxFinishAction.reset } }).resetOnFinish).toBe(true);
        expect(resolveAnimatorTimeline({ timeline: { trigger: untyped<PxTrigger>({ finish: PxFinishAction.reset }) } }).resetOnFinish).toBe(true);
    });

    it('the timeline numbers the runtime falls back to are the schema\'s', () => {
        // §4: the window replaced `duration`. `inTime` has the stated default; `outTime` and
        // `playDuration` have DERIVED defaults (max keyframe time; window length), so the schema
        // deliberately states none — `PX_DEFAULT_DURATION_MS` survives only as the scan fallback.
        expect(PxTimeTimelineSchema.defaults.inTime).toBe(0);
        expect('outTime' in PxTimeTimelineSchema.defaults).toBe(false);
        expect('playDuration' in PxTimeTimelineSchema.defaults).toBe(false);
        expect(PxTimeTimelineSchema.defaults.iterations).toBe(PX_DEFAULT_ITERATIONS);
        expect(PxTimeTimelineSchema.defaults.delay).toBe(0);
    });

    it('the glyph font units the layout falls back to are the schema\'s', () => {
        expect(PxGlyphFontSchema.defaults.unitsPerEm).toBe(PX_DEFAULT_UNITS_PER_EM);
        const font = { fontFamily: 'F', fontStyle: '', ascent: 800, glyphs: {} };
        expect(PxGlyphFontSchema.isValid(font)).toBe(true);
        expect(PxGlyphFontSchema.isValid({ ...font, unitsPerEm: 2048 })).toBe(true);
    });

    it('the reported document: an omitted mouseOut means `pause`, on hover', () => {
        const doc = {
            type: 'svg', viewBox: '0 0 400 400',
            animator: { timeline: { duration: 1000, iterations: 1, trigger: { start: 'mouseOver' } } },
            children: [],
        } as unknown as PxAnimatedSvgDocument;
        expect(resolveTrigger(getAnimatorConfig(doc)?.trigger).mouseOut).toBe(PxTriggerSchema.defaults.mouseOut);
        expect(PxTriggerSchema.defaults.mouseOut).toBe('pause');
    });

    it('the document and config roots state no scalar defaults of their own (nothing to drift)', () => {
        // Structural roots: their fields are objects / free values; a sanity check that the query
        // works on them without inventing values.
        expect(PxAnimatedSvgDocumentSchema.defaults).not.toHaveProperty(schemaKeys(PxAnimatedSvgDocumentSchema).animator);
        expect(PxAnimatorConfigSchema.defaults).not.toHaveProperty(schemaKeys(PxAnimatorConfigSchema).timeline);
        expect(PxTimelineSchema).toBeTruthy();
    });
});
