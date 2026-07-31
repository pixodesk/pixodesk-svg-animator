/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// GENERATED from the editor's feature-explorer sources (presets.ts,
// modelCoverage.ts DEV_FIXTURE_GROUPS, cases/registry.ts, caseInfo.ts).
// Section order and titles mirror the editor exactly.

import type { SvgaCaseJson } from './caseTypes';

import { attrNumberOpacity } from './cases/attrNumberOpacity.svga';
import { attrNumberStrokeWidth } from './cases/attrNumberStrokeWidth.svga';
import { attrNumberDashoffset } from './cases/attrNumberDashoffset.svga';
import { attrVectorDasharray } from './cases/attrVectorDasharray.svga';
import { attrTransformTranslate } from './cases/attrTransformTranslate.svga';
import { attrTransformRotate } from './cases/attrTransformRotate.svga';
import { attrTransformScale } from './cases/attrTransformScale.svga';
import { attrTransformSkew } from './cases/attrTransformSkew.svga';
import { attrTransformOrigin } from './cases/attrTransformOrigin.svga';
import { attrTransformUnified } from './cases/attrTransformUnified.svga';
import { attrTransformMotionPathLinear } from './cases/attrTransformMotionPathLinear.svga';
import { attrTransformMotionPathCurved } from './cases/attrTransformMotionPathCurved.svga';
import { attrTransformMotionPathAutoOrientRotated } from './cases/attrTransformMotionPathAutoOrientRotated.svga';
import { attrColorFill } from './cases/attrColorFill.svga';
import { attrColorStroke } from './cases/attrColorStroke.svga';
import { attrGradientFillLinear } from './cases/attrGradientFillLinear.svga';
import { attrGradientFillRadial } from './cases/attrGradientFillRadial.svga';
import { attrGradientStrokeLinear } from './cases/attrGradientStrokeLinear.svga';
import { attrGradientStrokeRadial } from './cases/attrGradientStrokeRadial.svga';
import { attrGradientEndpointsLinear } from './cases/attrGradientEndpointsLinear.svga';
import { attrGradientEndpointsRadial } from './cases/attrGradientEndpointsRadial.svga';
import { attrGradientEndpointsLinearAnim } from './cases/attrGradientEndpointsLinearAnim.svga';
import { attrGradientEndpointsRadialAnim } from './cases/attrGradientEndpointsRadialAnim.svga';
import { attrGradientObjectBoundingBox } from './cases/attrGradientObjectBoundingBox.svga';
import { attrPath } from './cases/attrPath.svga';
import { attrPathFillRule } from './cases/attrPathFillRule.svga';
import { attrPathRoundCorner } from './cases/attrPathRoundCorner.svga';
import { attrPathAnim } from './cases/attrPathAnim.svga';
import { attrPathRoundCornerAaa } from './cases/attrPathRoundCornerAaa.svga';
import { attrAppearanceMixBlendMode } from './cases/attrAppearanceMixBlendMode.svga';
import { attrAppearanceVectorEffect } from './cases/attrAppearanceVectorEffect.svga';
import { attrStrokeCaps } from './cases/attrStrokeCaps.svga';
import { elemShapePreset } from './cases/elemShapePreset.svga';
import { elemShapePresetAnim } from './cases/elemShapePresetAnim.svga';
import { elemPolygon } from './cases/elemPolygon.svga';
import { elemRect } from './cases/elemRect.svga';
import { elemEllipse } from './cases/elemEllipse.svga';
import { elemImage } from './cases/elemImage.svga';
import { elemText } from './cases/elemText.svga';
import { elemTextSpacing } from './cases/elemTextSpacing.svga';
import { elemTextAnchor } from './cases/elemTextAnchor.svga';
import { elemTextMixedSpans } from './cases/elemTextMixedSpans.svga';
import { elemTextPathBrowserFont } from './cases/elemTextPathBrowserFont.svga';
import { elemTextPathTextLengthBrowserFont } from './cases/elemTextPathTextLengthBrowserFont.svga';
import { elemTextPathGlyphsOff } from './cases/elemTextPathGlyphsOff.svga';
import { elemTextPathTextLengthGlyphsOff } from './cases/elemTextPathTextLengthGlyphsOff.svga';
import { elemTextPathGlyphsOn } from './cases/elemTextPathGlyphsOn.svga';
import { elemTextPathTextLengthGlyphsOn } from './cases/elemTextPathTextLengthGlyphsOn.svga';
import { elemTextPathStraight } from './cases/elemTextPathStraight.svga';
import { elemTextGradient } from './cases/elemTextGradient.svga';
import { elemTextPattern } from './cases/elemTextPattern.svga';
import { elemMarker } from './cases/elemMarker.svga';
import { elemPattern } from './cases/elemPattern.svga';
import { elemPatternAnim } from './cases/elemPatternAnim.svga';
import { elemFilterBlur } from './cases/elemFilterBlur.svga';
import { elemFilterShadow } from './cases/elemFilterShadow.svga';
import { elemFilterColorMatrix } from './cases/elemFilterColorMatrix.svga';
import { elemMaskDef } from './cases/elemMaskDef.svga';
import { elemMaskTextLongPathBrowserFont } from './cases/elemMaskTextLongPathBrowserFont.svga';
import { elemMaskTextLongPathGlyphsOff } from './cases/elemMaskTextLongPathGlyphsOff.svga';
import { elemMaskTextLongPathGlyphsOn } from './cases/elemMaskTextLongPathGlyphsOn.svga';
import { elemMarkerOrient } from './cases/elemMarkerOrient.svga';
import { elemTextBrowser } from './cases/elemTextBrowser.svga';
import { elemMaskBbb } from './cases/elemMaskBbb.svga';
import { effectRepeaterAlongLine } from './cases/effectRepeaterAlongLine.svga';
import { effectRepeaterRadial } from './cases/effectRepeaterRadial.svga';
import { effectRepeaterCombined } from './cases/effectRepeaterCombined.svga';
import { effectRepeaterAnim } from './cases/effectRepeaterAnim.svga';
import { effectRepeaterAnimParts } from './cases/effectRepeaterAnimParts.svga';
import { effectRepeaterTrim } from './cases/effectRepeaterTrim.svga';
import { effectRepeaterText } from './cases/effectRepeaterText.svga';
import { effectRepeaterShapePreset } from './cases/effectRepeaterShapePreset.svga';
import { effectMaskedByAlphaStatic } from './cases/effectMaskedByAlphaStatic.svga';
import { effectMaskedByBothMoving } from './cases/effectMaskedByBothMoving.svga';
import { effectMaskedByLuminance } from './cases/effectMaskedByLuminance.svga';
import { effectMaskedByRotatingMask } from './cases/effectMaskedByRotatingMask.svga';
import { effectMaskedByByPreset } from './cases/effectMaskedByByPreset.svga';
import { effectMaskedByAlongPath } from './cases/effectMaskedByAlongPath.svga';
import { effectMaskedByTextLongPathBrowserFont } from './cases/effectMaskedByTextLongPathBrowserFont.svga';
import { effectMaskedByTextLongPathGlyphsOff } from './cases/effectMaskedByTextLongPathGlyphsOff.svga';
import { effectMaskedByTextLongPathGlyphsOn } from './cases/effectMaskedByTextLongPathGlyphsOn.svga';
import { effectMaskedByByClone } from './cases/effectMaskedByByClone.svga';
import { effectClipPath } from './cases/effectClipPath.svga';
import { effectTrimPath } from './cases/effectTrimPath.svga';
import { effectTrimPathSubpath } from './cases/effectTrimPathSubpath.svga';
import { effectTrimPathRoundCorner } from './cases/effectTrimPathRoundCorner.svga';
import { effectTrimPathShapePreset } from './cases/effectTrimPathShapePreset.svga';
import { effectTrimPathSubpathTrimAllAsOne } from './cases/effectTrimPathSubpathTrimAllAsOne.svga';
import { effectTrimPathGroup } from './cases/effectTrimPathGroup.svga';
import { effectTrimPathGroupTrimAllAsOne } from './cases/effectTrimPathGroupTrimAllAsOne.svga';
import { effectRetimeStart } from './cases/effectRetimeStart.svga';
import { effectRetimeStretch } from './cases/effectRetimeStretch.svga';
import { effectCloneTextGlyph } from './cases/effectCloneTextGlyph.svga';
import { effectCloneText } from './cases/effectCloneText.svga';
import { effectCloneSimpleRef } from './cases/effectCloneSimpleRef.svga';
import { effectCloneContentRef } from './cases/effectCloneContentRef.svga';
import { effectCloneSymbolInternalTimeline } from './cases/effectCloneSymbolInternalTimeline.svga';
import { effectCloneStatic } from './cases/effectCloneStatic.svga';
import { effectCloneTextBrowserFont } from './cases/effectCloneTextBrowserFont.svga';
import { effectCloneTextGlyphs } from './cases/effectCloneTextGlyphs.svga';
import { effectCloneAnimCloned } from './cases/effectCloneAnimCloned.svga';
import { effectCloneSymbolAlongPath } from './cases/effectCloneSymbolAlongPath.svga';
import { effectCloneSymbolAlongPathAaa } from './cases/effectCloneSymbolAlongPathAaa.svga';
import { animEasingCubic } from './cases/animEasingCubic.svga';
import { animEasingOvershoot } from './cases/animEasingOvershoot.svga';
import { animConfigDirection } from './cases/animConfigDirection.svga';
import { animEasingNamedRef } from './cases/animEasingNamedRef.svga';
import { animTangentInOut } from './cases/animTangentInOut.svga';
import { animLoopCycle } from './cases/animLoopCycle.svga';
import { animLoopPingpong } from './cases/animLoopPingpong.svga';
import { animLoopLoopIn } from './cases/animLoopLoopIn.svga';
import { animLoopSegmentCount } from './cases/animLoopSegmentCount.svga';
import { animLoopAlternateArc } from './cases/animLoopAlternateArc.svga';
import { complexMaskedRepeater } from './cases/complexMaskedRepeater.svga';
import { complexMaskedRepeaterAnim } from './cases/complexMaskedRepeaterAnim.svga';
import { complexFirework } from './cases/complexFirework.svga';
import { complexRepeaterLoader } from './cases/complexRepeaterLoader.svga';
import { complexTrimLoader } from './cases/complexTrimLoader.svga';

export interface ExplorerCase {
    /** Dot-namespaced preset id, e.g. `attr.color.fill`. */
    id: string;
    /** One-line intent, inline markdown as authored in the editor. */
    description: string;
    doc: SvgaCaseJson;
}

export interface ExplorerSection {
    title: string;
    data: Array<ExplorerCase>;
}

export const CASE_SECTIONS: Array<ExplorerSection> = [
    {
        title: '§ 1.1 attr.number',
        data: [
            { id: 'attr.number.opacity', description: 'Breaks if the scalar interpolator **quantises to frame boundaries** or clamps opacity — the static-vs-animated pair makes a frozen or stepped channel obvious.', doc: attrNumberOpacity },
            { id: 'attr.number.strokeWidth', description: 'Breaks if a **plain numeric attribute** channel isn\'t keyframed (only transform/opacity wired) — static `8` vs the `2→16` sweep exposes a dead channel.', doc: attrNumberStrokeWidth },
            { id: 'attr.number.dashoffset', description: 'Breaks if dashoffset animates in the **wrong unit or direction** (ants reverse/stall); also a CSS/WAAPI `stroke-dashoffset` support check.', doc: attrNumberDashoffset },
        ],
    },
    {
        title: '§ 1.2 attr.vector',
        data: [
            { id: 'attr.vector.dasharray', description: 'Breaks if a **multi-component vector** interpolates as one string — one of `[12,6]→[4,4]` would jump while the other tweens.', doc: attrVectorDasharray },
        ],
    },
    {
        title: '§ 1.3 attr.transform',
        data: [
            { id: 'attr.transform.translate', description: 'Breaks if translate is folded into the **wrong matrix slot/order** — isolating one part means any cross-talk from rotate/scale surfaces here first.', doc: attrTransformTranslate },
            { id: 'attr.transform.rotate', description: 'Breaks if rotation **wraps/normalises** the angle — `0→540°` must spin 1.5 turns, not snap to 180°.', doc: attrTransformRotate },
            { id: 'attr.transform.scale', description: 'Breaks if scale **can\'t cross zero** — `100%→−100%` must flip through a degenerate frame without `NaN`/clamp.', doc: attrTransformScale },
            { id: 'attr.transform.skew', description: 'Breaks if **skew** is dropped from the transform decomposition (rarer than T/R/S).', doc: attrTransformSkew },
            { id: 'attr.transform.origin', description: 'Breaks if the transform **origin isn\'t animatable** — the spin must re-centre as the pivot moves, not rotate about a fixed point.', doc: attrTransformOrigin },
            { id: 'attr.transform.unified', description: 'Breaks if the parts **compose in an unstable order** — five animating together surfaces matrix-order bugs the isolated cases hide.', doc: attrTransformUnified },
            { id: 'attr.transform.motionPath.linear', description: 'Breaks if the **autoOrient tangent** is miscomputed on straight segments, or applied when off — left must stay flat, right must face travel.', doc: attrTransformMotionPathLinear },
            { id: 'attr.transform.motionPath.curved', description: 'Breaks if the **bezier tangent is sampled wrong** — orientation jitters or lags the curve.', doc: attrTransformMotionPathCurved },
            { id: 'attr.transform.motionPath.autoOrientRotated', description: 'Breaks if auto-orient **replaces** instead of **composing** with the base rotation — guards the `base + tangent` compose-order bug.', doc: attrTransformMotionPathAutoOrientRotated },
        ],
    },
    {
        title: '§ 1.4 attr.color',
        data: [
            { id: 'attr.color.fill', description: 'Breaks if flat colour interpolates in the **wrong space** — `blue→red` should pass through a clean midpoint, not a muddy one.', doc: attrColorFill },
            { id: 'attr.color.stroke', description: 'Same colour-interpolation check on the **stroke** channel — catches stroke paint wired differently from fill.', doc: attrColorStroke },
        ],
    },
    {
        title: '§ 1.5 attr.gradient',
        data: [
            { id: 'attr.gradient.fill.linear', description: 'Breaks if **gradient stop colours don\'t animate** (geometry-only support) — the linear fill stalls.', doc: attrGradientFillLinear },
            { id: 'attr.gradient.fill.radial', description: 'Same for **radial** — catches radial stop animation missing while linear works.', doc: attrGradientFillRadial },
            { id: 'attr.gradient.stroke.linear', description: 'Breaks if a `url(#grad)` **stroke paint** isn\'t resolved the way a gradient fill is.', doc: attrGradientStrokeLinear },
            { id: 'attr.gradient.stroke.radial', description: 'Radial gradient as a **stroke** — catches radial-stroke resolution bugs.', doc: attrGradientStrokeRadial },
            { id: 'attr.gradient.endpoints.linear', description: 'Breaks if **non-default endpoint geometry** (diagonal `p1→e`) is ignored — the gradient renders axis-aligned instead of NW→SE.', doc: attrGradientEndpointsLinear },
            { id: 'attr.gradient.endpoints.radial', description: 'Breaks if the **focal point (`fp`)** offset is dropped — the highlight sits centred instead of off-centre.', doc: attrGradientEndpointsRadial },
            { id: 'attr.gradient.endpoints.linear.anim', description: '**Frames-engine only**: breaks if animated gradient geometry is emitted for CSS/WAAPI (which can\'t do it) — a per-format fallback check.', doc: attrGradientEndpointsLinearAnim },
            { id: 'attr.gradient.endpoints.radial.anim', description: '**Frames-only** animated focal point — breaks if focal animation leaks into a non-frames export.', doc: attrGradientEndpointsRadialAnim },
            { id: 'attr.gradient.objectBoundingBox', description: 'Breaks if `gradientUnits` isn\'t honoured — `objectBoundingBox` (0–1) coords render at userSpace scale, blowing the gradient out of the shape.', doc: attrGradientObjectBoundingBox },
        ],
    },
    {
        title: '§ 1.6 attr.path',
        data: [
            { id: 'attr.path', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', doc: attrPath },
            { id: 'attr.path.fillRule', description: 'Breaks if **`fillRule`** round-trips wrong — `evenodd` renders solid (no hollow centre) on the self-intersecting path.', doc: attrPathFillRule },
            { id: 'attr.path.roundCorner', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', doc: attrPathRoundCorner },
            { id: 'attr.path.anim', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', doc: attrPathAnim },
            { id: 'attr.path.roundCorner.aaa', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', doc: attrPathRoundCornerAaa },
        ],
    },
    {
        title: '§ 1.7 attr.appearance',
        data: [
            { id: 'attr.appearance.mixBlendMode', description: 'Breaks if `mix-blend-mode` isn\'t composited — each circle shows its own flat blue instead of a blended colour. **It\'s a CSS-only property**: the player must apply it via `element.style`, not `setAttribute` (which the browser ignores), and the blend shape must sit **on top** of an opaque backdrop.', doc: attrAppearanceMixBlendMode },
            { id: 'attr.appearance.vectorEffect', description: 'Breaks if **`non-scaling-stroke`** is dropped — the stroke thickens with the scale animation instead of staying constant.', doc: attrAppearanceVectorEffect },
            { id: 'attr.stroke.caps', description: 'Breaks if **linecap/linejoin** round-trip to default — round/square caps collapse to butt, round/bevel joins collapse to miter. Static side-by-side makes any collapse obvious.', doc: attrStrokeCaps },
        ],
    },
    {
        title: '§ 2 elem',
        data: [
            { id: 'elem.shapePreset', description: 'Breaks if a **parametric preset** (polygon/star/spiral) doesn\'t bake to a path — the shape is missing or has the wrong point count.', doc: elemShapePreset },
            { id: 'elem.shapePreset.anim', description: '**Not built yet** — will guard animated preset params once implemented (presets re-bake each render; see COVERAGE-GAPS.md).', doc: elemShapePresetAnim },
            { id: 'elem.polygon', description: 'Breaks if a **closed multi-point path** doesn\'t render/fill.', doc: elemPolygon },
            { id: 'elem.rect', description: 'Breaks if the basic **`<rect>`** element type doesn\'t round-trip or animate.', doc: elemRect },
            { id: 'elem.ellipse', description: 'Breaks if the basic **`<ellipse>`** element type doesn\'t round-trip or animate.', doc: elemEllipse },
            { id: 'elem.image', description: 'Breaks if an **`<image>`** (embedded raster) isn\'t emitted or its href is dropped.', doc: elemImage },
            { id: 'elem.text', description: 'Breaks if **multi-line text or per-span colour** is flattened — lines merge or lose colour.', doc: elemText },
            { id: 'elem.text.spacing', description: 'Breaks if **`letter-spacing`** isn\'t animatable — glyphs don\'t spread.', doc: elemTextSpacing },
            { id: 'elem.text.anchor', description: 'Breaks if **`text-anchor`** start/middle/end isn\'t honoured — rows won\'t align to the guide.', doc: elemTextAnchor },
            { id: 'elem.text.mixedSpans', description: 'Breaks if **per-span styling** or a **span-level animated fill** is lost — the last span won\'t animate red→blue.', doc: elemTextMixedSpans },
            { id: 'elem.text.path.browserFont', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', doc: elemTextPathBrowserFont },
            { id: 'elem.text.path.textLength.browserFont', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', doc: elemTextPathTextLengthBrowserFont },
            { id: 'elem.text.path.glyphsOff', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', doc: elemTextPathGlyphsOff },
            { id: 'elem.text.path.textLength.glyphsOff', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', doc: elemTextPathTextLengthGlyphsOff },
            { id: 'elem.text.path.glyphsOn', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', doc: elemTextPathGlyphsOn },
            { id: 'elem.text.path.textLength.glyphsOn', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', doc: elemTextPathTextLengthGlyphsOn },
            { id: 'elem.text.path.straight', description: 'Breaks on **zero-curvature** textPath layout — catches bugs specific to a straight baseline.', doc: elemTextPathStraight },
            { id: 'elem.text.gradient', description: 'Breaks if **gradient paint doesn\'t ride the baked outline `<g>`** (glyph text has no `<text>` fill) — a known regression target (paint baked away).', doc: elemTextGradient },
            { id: 'elem.text.pattern', description: 'Breaks if **pattern paint doesn\'t ride the baked outline `<g>`** — the same glyph-baking paint gap as the gradient case.', doc: elemTextPattern },
            { id: 'elem.marker', description: 'Breaks if **markers** (start/mid/end) or `orient="auto"` don\'t render/orient — arrowheads missing or facing wrong.', doc: elemMarker },
            { id: 'elem.pattern', description: 'Breaks if a **`userSpaceOnUse` pattern tile** doesn\'t fill.', doc: elemPattern },
            { id: 'elem.pattern.anim', description: 'Breaks if **`patternTransform`** doesn\'t animate — the tile won\'t rotate over time.', doc: elemPatternAnim },
            { id: 'elem.filter.blur', description: 'Breaks if **`feGaussianBlur`** isn\'t applied or its radius doesn\'t animate.', doc: elemFilterBlur },
            { id: 'elem.filter.shadow', description: 'Breaks if the **drop-shadow** filter isn\'t applied.', doc: elemFilterShadow },
            { id: 'elem.filter.colorMatrix', description: '**Not built yet** — will guard an `feColorMatrix` recolour once implemented (see COVERAGE-GAPS.md).', doc: elemFilterColorMatrix },
            { id: 'elem.mask.def', description: 'Breaks if the **`<mask>` def form** (`setMask`) diverges from the `maskedBy` effect.', doc: elemMaskDef },
            { id: 'elem.mask.textLongPath.browserFont', description: '🚧 **TODO** — what can break and why.', doc: elemMaskTextLongPathBrowserFont },
            { id: 'elem.mask.textLongPath.glyphsOff', description: '🚧 **TODO** — what can break and why.', doc: elemMaskTextLongPathGlyphsOff },
            { id: 'elem.mask.textLongPath.glyphsOn', description: '🚧 **TODO** — what can break and why.', doc: elemMaskTextLongPathGlyphsOn },
            { id: 'elem.marker.orient', description: 'Breaks if **`orient="auto-start-reverse"`** or a fixed angle isn\'t honoured — the start marker faces the wrong way.', doc: elemMarkerOrient },
            { id: 'elem.text.browser', description: 'Breaks if **multi-line text or per-span colour** is flattened — lines merge or lose colour.', doc: elemTextBrowser },
            { id: 'elem.mask.bbb', description: '🚧 **TODO** — what can break and why.', doc: elemMaskBbb },
        ],
    },
    {
        title: '§ 3.2 effect.repeater',
        data: [
            { id: 'effect.repeater.alongLine', description: 'Breaks if the repeater **doesn\'t emit N offset copies** — only the source renders.', doc: effectRepeaterAlongLine },
            { id: 'effect.repeater.radial', description: 'Breaks if the **per-copy rotation increment** is wrong — copies stack instead of fanning.', doc: effectRepeaterRadial },
            { id: 'effect.repeater.combined', description: 'Breaks if **translate + rotate + scale per copy** don\'t compose.', doc: effectRepeaterCombined },
            { id: 'effect.repeater.anim', description: 'Breaks if the **per-copy transform can\'t animate**.', doc: effectRepeaterAnim },
            { id: 'effect.repeater.animParts', description: 'Breaks if **animated per-copy rotate / scale / origin** don\'t apply.', doc: effectRepeaterAnimParts },
            { id: 'effect.repeater.trim', description: 'Breaks if **two structural effects don\'t compose** — each repeated copy must carry its own animated trim.', doc: effectRepeaterTrim },
            { id: 'effect.repeater.text', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', doc: effectRepeaterText },
            { id: 'effect.repeater.shapePreset', description: 'Breaks if the **preset\'s flattened path** isn\'t the thing repeated.', doc: effectRepeaterShapePreset },
        ],
    },
    {
        title: '§ 3.3 effect.maskedBy',
        data: [
            { id: 'effect.maskedBy.alpha.static', description: 'Breaks if the **alpha mask doesn\'t clip** — the shape shows outside the mask.', doc: effectMaskedByAlphaStatic },
            { id: 'effect.maskedBy.alpha.bothMoving', description: 'Breaks if the **mask transform desyncs** from the masked content when both animate.', doc: effectMaskedByBothMoving },
            { id: 'effect.maskedBy.luminance', description: 'Breaks if **luminance masking falls back to alpha** — brightness must drive the clip.', doc: effectMaskedByLuminance },
            { id: 'effect.maskedBy.rotatingMask', description: 'Breaks if the **mask-transform unwind chain** mishandles an animated mask source — a stress test.', doc: effectMaskedByRotatingMask },
            { id: 'effect.maskedBy.byPreset', description: 'Breaks if a **preset can\'t be a mask source** — earlier this recursed into the svg root (a cycle).', doc: effectMaskedByByPreset },
            { id: 'effect.maskedBy.alongPath', description: 'Breaks if **motion-path content under a static mask** doesn\'t reveal as it moves.', doc: effectMaskedByAlongPath },
            { id: 'effect.maskedBy.textLongPath.browserFont', description: '**Not built yet** — will guard text-on-a-long-path under a mask once implemented (see COVERAGE-GAPS.md).', doc: effectMaskedByTextLongPathBrowserFont },
            { id: 'effect.maskedBy.textLongPath.glyphsOff', description: '**Not built yet** — will guard text-on-a-long-path under a mask once implemented (see COVERAGE-GAPS.md).', doc: effectMaskedByTextLongPathGlyphsOff },
            { id: 'effect.maskedBy.textLongPath.glyphsOn', description: '**Not built yet** — will guard text-on-a-long-path under a mask once implemented (see COVERAGE-GAPS.md).', doc: effectMaskedByTextLongPathGlyphsOn },
            { id: 'effect.maskedBy.byClone', description: '**Not built yet** — will guard a `<use>`-clone as the mask source once implemented (see COVERAGE-GAPS.md).', doc: effectMaskedByByClone },
        ],
    },
    {
        title: '§ 3.3b effect.clipPath',
        data: [
            { id: 'effect.clipPath', description: 'Breaks if **`<clipPath>` geometry isn\'t applied** — nothing is clipped.', doc: effectClipPath },
        ],
    },
    {
        title: '§ 3.4 effect.trimPath',
        data: [
            { id: 'effect.trimPath', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', doc: effectTrimPath },
            { id: 'effect.trimPath.subpath', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', doc: effectTrimPathSubpath },
            { id: 'effect.trimPath.roundCorner', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', doc: effectTrimPathRoundCorner },
            { id: 'effect.trimPath.shapePreset', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', doc: effectTrimPathShapePreset },
            { id: 'effect.trimPath.subpath.trimAllAsOne', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', doc: effectTrimPathSubpathTrimAllAsOne },
            { id: 'effect.trimPath.group', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', doc: effectTrimPathGroup },
            { id: 'effect.trimPath.group.trimAllAsOne', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', doc: effectTrimPathGroupTrimAllAsOne },
        ],
    },
    {
        title: '§ 3.5 effect.retime',
        data: [
            { id: 'effect.retime.start', description: 'Breaks if a **materialised clone** holding a nested `<use>` loses its external **animated** content.', doc: effectRetimeStart },
            { id: 'effect.retime.stretch', description: 'Breaks if a **materialised clone** holding a nested `<use>` loses its external **animated** content.', doc: effectRetimeStretch },
        ],
    },
    {
        title: '§ 3.6b effect.clone',
        data: [
            { id: 'effect.clone.textGlyph', description: '**Not built yet** — will guard a clone of glyph-mode text once implemented (blocked by the glyph-paint fix; see COVERAGE-GAPS.md).', doc: effectCloneTextGlyph },
            { id: 'effect.clone.text', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', doc: effectCloneText },
            { id: 'effect.clone.simpleRef', description: 'Breaks if a basic **`<use>`→def reference** doesn\'t resolve — nothing renders.', doc: effectCloneSimpleRef },
            { id: 'effect.clone.contentRef', description: 'Breaks if the **content-ref** (group target) isn\'t materialised — the used group is empty.', doc: effectCloneContentRef },
            { id: 'effect.clone.symbol.internalTimeline', description: 'Breaks if the symbol\'s **own `timeline.duration`** is dropped by the writer (a known drop area) — the nested clock stops.', doc: effectCloneSymbolInternalTimeline },
            { id: 'effect.clone.static', description: 'Breaks if the **ref effect can\'t target a non-symbol** element.', doc: effectCloneStatic },
            { id: 'effect.clone.text.browserFont', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', doc: effectCloneTextBrowserFont },
            { id: 'effect.clone.text.glyphs', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', doc: effectCloneTextGlyphs },
            { id: 'effect.clone.animCloned', description: 'Breaks if the **ref effect can\'t target a non-symbol** element.', doc: effectCloneAnimCloned },
            { id: 'effect.clone.symbol.alongPath', description: 'Breaks if **clone content along a path** doesn\'t move.', doc: effectCloneSymbolAlongPath },
            { id: 'effect.clone.symbol.alongPath.aaa', description: 'Breaks if **clone content along a path** doesn\'t move.', doc: effectCloneSymbolAlongPathAaa },
        ],
    },
    {
        title: '§ 4 anim',
        data: [
            { id: 'anim.easing.cubic', description: 'Breaks if **cubic-bezier easing collapses to linear** — the three curves would look identical.', doc: animEasingCubic },
            { id: 'anim.easing.overshoot', description: 'Breaks if **control points past `1` are clamped** — the spring/overshoot flattens.', doc: animEasingOvershoot },
            { id: 'anim.config.direction', description: 'Breaks if **`direction=alternate`** isn\'t honoured — playback won\'t reverse each iteration.', doc: animConfigDirection },
            { id: 'anim.easing.namedRef', description: '**Not built yet** — will guard a keyframe referencing a named easing from `defs.easings` once implemented (see COVERAGE-GAPS.md).', doc: animEasingNamedRef },
            { id: 'anim.tangentInOut', description: 'Breaks if **per-keyframe `tangentIn`/`tangentOut`** are ignored — the motion path won\'t curve between keys.', doc: animTangentInOut },
            { id: 'anim.loop.cycle', description: 'Breaks if **`loopOut` (cycle)** doesn\'t restart from the start each pass.', doc: animLoopCycle },
            { id: 'anim.loop.pingpong', description: 'Breaks if **ping-pong (alternate)** doesn\'t reverse direction each pass.', doc: animLoopPingpong },
            { id: 'anim.loop.loopIn', description: 'Breaks if **loop-in loops the wrong segment** (leading kfs `60→100`).', doc: animLoopLoopIn },
            { id: 'anim.loop.segmentCount', description: 'Breaks if a **count-limited loop** repeats the full range instead of the segment.', doc: animLoopSegmentCount },
            { id: 'anim.loop.alternateArc', description: 'Breaks if the arc **snaps/pops at the loop seam** — a cycle-boundary correctness check (the `TLoop` boundary fix).', doc: animLoopAlternateArc },
        ],
    },
    {
        title: '§ 5 complex',
        data: [
            { id: 'complex.maskedRepeater', description: 'Breaks if a **mask over a repeater** doesn\'t stack.', doc: complexMaskedRepeater },
            { id: 'complex.maskedRepeaterAnim', description: 'Breaks if **mask + repeater + animation** don\'t compose in motion (both mask and content move).', doc: complexMaskedRepeaterAnim },
            { id: 'complex.firework', description: 'Breaks if a **radial-gradient backdrop + repeated animated particles** don\'t compose — a full real-world scene.', doc: complexFirework },
            { id: 'complex.repeaterLoader', description: 'Breaks if a **repeater of per-copy fade/rotate** copies doesn\'t sequence — a real-world loader.', doc: complexRepeaterLoader },
            { id: 'complex.trimLoader', description: 'Breaks if an **animated trimPath draw-on** on a rotating shape doesn\'t reveal — a real-world loader.', doc: complexTrimLoader },
        ],
    },
];

export const CASE_COUNT = CASE_SECTIONS.reduce((n, s) => n + s.data.length, 0);
