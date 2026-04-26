/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { px, type PxSchema } from './PxSchema';

export const PxEasingOrRefSchema = px.union([
    px.string(),
    px.tuple([px.number(), px.number(), px.number(), px.number()] as const),
]);

export const PxKeyframeSchema = px.object({
    time:   px.number().optional(),
    t:      px.number().optional(),
    value:  px.any().optional(),
    v:      px.any().optional(),
    easing: PxEasingOrRefSchema.optional(),
    e:      PxEasingOrRefSchema.optional(),
});

export const PxLoopSchema = px.object({
    segmentCount: px.number().optional(),
    before:       px.boolean().optional(),
    alternate:    px.boolean().optional(),
});

export const PxPropertyAnimationSchema = px.object({
    keyframes: px.array(PxKeyframeSchema).optional(),
    kfs:       px.array(PxKeyframeSchema).optional(),
    loop:      px.union([PxLoopSchema, px.boolean()]).optional(),
});

export const PxAnimationDefinitionSchema = px.record(PxPropertyAnimationSchema);

export const PxElementAnimationSchema = px.union([
    px.string(),
    px.array(px.union([px.string(), PxAnimationDefinitionSchema])),
    PxAnimationDefinitionSchema,
]);

export const PxTriggerSchema = px.object({
    startOn:                 px.enum(['load', 'mouseOver', 'click', 'scrollIntoView', 'programmatic'] as const).optional(),
    outAction:               px.enum(['continue', 'pause', 'reset', 'reverse'] as const).optional(),
    scrollIntoViewThreshold: px.number().optional(),
});

export const PxAnimatorConfigSchema = px.object({
    mode:          px.enum(['auto', 'webapi', 'frames'] as const).optional(),
    duration:      px.number().optional(),
    delay:         px.number().optional(),
    iterations:    px.union([px.number(), px.literal('infinite')]).optional(),
    fill:          px.enum(['forwards', 'backwards', 'both', 'none'] as const).optional(),
    direction:     px.enum(['normal', 'reverse', 'alternate', 'alternate-reverse'] as const).optional(),
    frameRate:     px.number().optional(),
    trigger:       PxTriggerSchema.optional(),
    debug:         px.boolean().optional(),
    debugInstName: px.string().optional(),
});

export const PxDefsSchema = px.object({
    easings:    px.record(px.tuple([px.number(), px.number(), px.number(), px.number()] as const)).optional(),
    animations: px.record(PxAnimationDefinitionSchema).optional(),
    styles:     px.record(px.any()).optional(),
});

export const PxBezierPathSchema = px.object({
    v: px.array(px.array(px.number())),
    i: px.array(px.array(px.number())).optional(),
    o: px.array(px.array(px.number())).optional(),
    c: px.boolean().optional(),
});

// Non-recursive base shape for PxNode — used for type extraction via PxInfer.
// Excludes `children` (circular reference) and arbitrary SVG attributes (index signature).
export const PxNodeBase = px.openObject({
    type:    px.string(),
    animate: PxElementAnimationSchema.optional(),
    style:   px.union([px.string(), px.record(px.union([px.string(), px.number()]))]).optional(),
});

// `let` so the lazy closure can capture the variable reference after assignment.
// By the time the lazy resolves (first isValid/sanitize call), PxNodeSchema is assigned.
let PxNodeSchema: PxSchema<any> = px.openObject({
    ...PxNodeBase._shape,
    children: px.lazy(() => px.array(PxNodeSchema), []).optional(),
});
export { PxNodeSchema };

export const PxBindingSchema = px.object({
    id:      px.string(),
    animate: PxElementAnimationSchema,
});

// Extra fields added by PxSvgNode on top of PxNode — used for type extraction via PxInfer.
// Excludes `design` (circular reference to PxNode).
export const PxSvgNodeExtra = px.object({
    width:    px.number().optional(),
    height:   px.number().optional(),
    viewBox:  px.string().optional(),
    animator: PxAnimatorConfigSchema.optional(),
    defs:     PxDefsSchema.optional(),
    bindings: px.array(PxBindingSchema).optional(),
});

/** Root document schema; enforces type === 'svg' to distinguish from child nodes. */
export const PxAnimatedSvgDocumentSchema = px.object({
    ...PxNodeBase._shape,
    ...PxSvgNodeExtra._shape,
    type:     px.literal('svg'),     // override string → literal to require 'svg'
    children: px.array(PxNodeSchema).optional(),
    design:   PxNodeSchema.optional(),
});
