/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// GENERATED from the editor's feature-explorer sources (presets.ts,
// modelCoverage.ts DEV_FIXTURE_GROUPS, cases/registry.ts, caseInfo.ts).
// Section order and titles mirror the editor exactly.
//
// Fixtures are required lazily — see `ExplorerCase.doc`.

import type { SvgaCaseJson } from './caseTypes';


export interface ExplorerCase {
    /** Dot-namespaced preset id, e.g. `attr.color.fill`. */
    id: string;
    /** One-line intent, inline markdown as authored in the editor. */
    description: string;
    /**
     * The animation document, loaded ON FIRST ACCESS.
     *
     * The 118 fixtures are ~1.2 MB of nested object literals. Importing them
     * eagerly means the JS engine parses and evaluates all of it before the
     * first frame — on a phone that is seconds of blank screen, and this list
     * only ever shows a handful at a time. The getter defers each one to the
     * moment its row renders; Metro's module cache makes repeat access free.
     */
    readonly doc: SvgaCaseJson;
}

export interface ExplorerSection {
    title: string;
    data: Array<ExplorerCase>;
}

export const CASE_SECTIONS: Array<ExplorerSection> = [
    {
        title: '§ 1.1 attr.number',
        data: [
            { id: 'attr.number.opacity', description: 'Breaks if the scalar interpolator **quantises to frame boundaries** or clamps opacity — the static-vs-animated pair makes a frozen or stepped channel obvious.', get doc() { return require('./cases/attrNumberOpacity.svga').attrNumberOpacity; } },
            { id: 'attr.number.strokeWidth', description: 'Breaks if a **plain numeric attribute** channel isn\'t keyframed (only transform/opacity wired) — static `8` vs the `2→16` sweep exposes a dead channel.', get doc() { return require('./cases/attrNumberStrokeWidth.svga').attrNumberStrokeWidth; } },
            { id: 'attr.number.dashoffset', description: 'Breaks if dashoffset animates in the **wrong unit or direction** (ants reverse/stall); also a CSS/WAAPI `stroke-dashoffset` support check.', get doc() { return require('./cases/attrNumberDashoffset.svga').attrNumberDashoffset; } },
        ],
    },
    {
        title: '§ 1.2 attr.vector',
        data: [
            { id: 'attr.vector.dasharray', description: 'Breaks if a **multi-component vector** interpolates as one string — one of `[12,6]→[4,4]` would jump while the other tweens.', get doc() { return require('./cases/attrVectorDasharray.svga').attrVectorDasharray; } },
        ],
    },
    {
        title: '§ 1.3 attr.transform',
        data: [
            { id: 'attr.transform.translate', description: 'Breaks if translate is folded into the **wrong matrix slot/order** — isolating one part means any cross-talk from rotate/scale surfaces here first.', get doc() { return require('./cases/attrTransformTranslate.svga').attrTransformTranslate; } },
            { id: 'attr.transform.rotate', description: 'Breaks if rotation **wraps/normalises** the angle — `0→540°` must spin 1.5 turns, not snap to 180°.', get doc() { return require('./cases/attrTransformRotate.svga').attrTransformRotate; } },
            { id: 'attr.transform.scale', description: 'Breaks if scale **can\'t cross zero** — `100%→−100%` must flip through a degenerate frame without `NaN`/clamp.', get doc() { return require('./cases/attrTransformScale.svga').attrTransformScale; } },
            { id: 'attr.transform.skew', description: 'Breaks if **skew** is dropped from the transform decomposition (rarer than T/R/S).', get doc() { return require('./cases/attrTransformSkew.svga').attrTransformSkew; } },
            { id: 'attr.transform.origin', description: 'Breaks if the transform **origin isn\'t animatable** — the spin must re-centre as the pivot moves, not rotate about a fixed point.', get doc() { return require('./cases/attrTransformOrigin.svga').attrTransformOrigin; } },
            { id: 'attr.transform.unified', description: 'Breaks if the parts **compose in an unstable order** — five animating together surfaces matrix-order bugs the isolated cases hide.', get doc() { return require('./cases/attrTransformUnified.svga').attrTransformUnified; } },
            { id: 'attr.transform.motionPath.linear', description: 'Breaks if the **autoOrient tangent** is miscomputed on straight segments, or applied when off — left must stay flat, right must face travel.', get doc() { return require('./cases/attrTransformMotionPathLinear.svga').attrTransformMotionPathLinear; } },
            { id: 'attr.transform.motionPath.curved', description: 'Breaks if the **bezier tangent is sampled wrong** — orientation jitters or lags the curve.', get doc() { return require('./cases/attrTransformMotionPathCurved.svga').attrTransformMotionPathCurved; } },
            { id: 'attr.transform.motionPath.autoOrientRotated', description: 'Breaks if auto-orient **replaces** instead of **composing** with the base rotation — guards the `base + tangent` compose-order bug.', get doc() { return require('./cases/attrTransformMotionPathAutoOrientRotated.svga').attrTransformMotionPathAutoOrientRotated; } },
        ],
    },
    {
        title: '§ 1.4 attr.color',
        data: [
            { id: 'attr.color.fill', description: 'Breaks if flat colour interpolates in the **wrong space** — `blue→red` should pass through a clean midpoint, not a muddy one.', get doc() { return require('./cases/attrColorFill.svga').attrColorFill; } },
            { id: 'attr.color.stroke', description: 'Same colour-interpolation check on the **stroke** channel — catches stroke paint wired differently from fill.', get doc() { return require('./cases/attrColorStroke.svga').attrColorStroke; } },
        ],
    },
    {
        title: '§ 1.5 attr.gradient',
        data: [
            { id: 'attr.gradient.fill.linear', description: 'Breaks if **gradient stop colours don\'t animate** (geometry-only support) — the linear fill stalls.', get doc() { return require('./cases/attrGradientFillLinear.svga').attrGradientFillLinear; } },
            { id: 'attr.gradient.fill.radial', description: 'Same for **radial** — catches radial stop animation missing while linear works.', get doc() { return require('./cases/attrGradientFillRadial.svga').attrGradientFillRadial; } },
            { id: 'attr.gradient.stroke.linear', description: 'Breaks if a `url(#grad)` **stroke paint** isn\'t resolved the way a gradient fill is.', get doc() { return require('./cases/attrGradientStrokeLinear.svga').attrGradientStrokeLinear; } },
            { id: 'attr.gradient.stroke.radial', description: 'Radial gradient as a **stroke** — catches radial-stroke resolution bugs.', get doc() { return require('./cases/attrGradientStrokeRadial.svga').attrGradientStrokeRadial; } },
            { id: 'attr.gradient.endpoints.linear', description: 'Breaks if **non-default endpoint geometry** (diagonal `p1→e`) is ignored — the gradient renders axis-aligned instead of NW→SE.', get doc() { return require('./cases/attrGradientEndpointsLinear.svga').attrGradientEndpointsLinear; } },
            { id: 'attr.gradient.endpoints.radial', description: 'Breaks if the **focal point (`fp`)** offset is dropped — the highlight sits centred instead of off-centre.', get doc() { return require('./cases/attrGradientEndpointsRadial.svga').attrGradientEndpointsRadial; } },
            { id: 'attr.gradient.endpoints.linear.anim', description: '**Frames-engine only**: breaks if animated gradient geometry is emitted for CSS/WAAPI (which can\'t do it) — a per-format fallback check.', get doc() { return require('./cases/attrGradientEndpointsLinearAnim.svga').attrGradientEndpointsLinearAnim; } },
            { id: 'attr.gradient.endpoints.radial.anim', description: '**Frames-only** animated focal point — breaks if focal animation leaks into a non-frames export.', get doc() { return require('./cases/attrGradientEndpointsRadialAnim.svga').attrGradientEndpointsRadialAnim; } },
            { id: 'attr.gradient.objectBoundingBox', description: 'Breaks if `gradientUnits` isn\'t honoured — `objectBoundingBox` (0–1) coords render at userSpace scale, blowing the gradient out of the shape.', get doc() { return require('./cases/attrGradientObjectBoundingBox.svga').attrGradientObjectBoundingBox; } },
        ],
    },
    {
        title: '§ 1.6 attr.path',
        data: [
            { id: 'attr.path', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', get doc() { return require('./cases/attrPath.svga').attrPath; } },
            { id: 'attr.path.fillRule', description: 'Breaks if **`fillRule`** round-trips wrong — `evenodd` renders solid (no hollow centre) on the self-intersecting path.', get doc() { return require('./cases/attrPathFillRule.svga').attrPathFillRule; } },
            { id: 'attr.path.roundCorner', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', get doc() { return require('./cases/attrPathRoundCorner.svga').attrPathRoundCorner; } },
            { id: 'attr.path.anim', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', get doc() { return require('./cases/attrPathAnim.svga').attrPathAnim; } },
            { id: 'attr.path.roundCorner.aaa', description: 'Breaks if **corner smoothing** (tangent generation) is lost on round-trip — the smooth side renders sharp.', get doc() { return require('./cases/attrPathRoundCornerAaa.svga').attrPathRoundCornerAaa; } },
        ],
    },
    {
        title: '§ 1.7 attr.appearance',
        data: [
            { id: 'attr.appearance.mixBlendMode', description: 'Breaks if `mix-blend-mode` isn\'t composited — each circle shows its own flat blue instead of a blended colour. **It\'s a CSS-only property**: the player must apply it via `element.style`, not `setAttribute` (which the browser ignores), and the blend shape must sit **on top** of an opaque backdrop.', get doc() { return require('./cases/attrAppearanceMixBlendMode.svga').attrAppearanceMixBlendMode; } },
            { id: 'attr.appearance.vectorEffect', description: 'Breaks if **`non-scaling-stroke`** is dropped — the stroke thickens with the scale animation instead of staying constant.', get doc() { return require('./cases/attrAppearanceVectorEffect.svga').attrAppearanceVectorEffect; } },
            { id: 'attr.stroke.caps', description: 'Breaks if **linecap/linejoin** round-trip to default — round/square caps collapse to butt, round/bevel joins collapse to miter. Static side-by-side makes any collapse obvious.', get doc() { return require('./cases/attrStrokeCaps.svga').attrStrokeCaps; } },
        ],
    },
    {
        title: '§ 2 elem',
        data: [
            { id: 'elem.shapePreset', description: 'Breaks if a **parametric preset** (polygon/star/spiral) doesn\'t bake to a path — the shape is missing or has the wrong point count.', get doc() { return require('./cases/elemShapePreset.svga').elemShapePreset; } },
            { id: 'elem.shapePreset.anim', description: '**Not built yet** — will guard animated preset params once implemented (presets re-bake each render; see COVERAGE-GAPS.md).', get doc() { return require('./cases/elemShapePresetAnim.svga').elemShapePresetAnim; } },
            { id: 'elem.polygon', description: 'Breaks if a **closed multi-point path** doesn\'t render/fill.', get doc() { return require('./cases/elemPolygon.svga').elemPolygon; } },
            { id: 'elem.rect', description: 'Breaks if the basic **`<rect>`** element type doesn\'t round-trip or animate.', get doc() { return require('./cases/elemRect.svga').elemRect; } },
            { id: 'elem.ellipse', description: 'Breaks if the basic **`<ellipse>`** element type doesn\'t round-trip or animate.', get doc() { return require('./cases/elemEllipse.svga').elemEllipse; } },
            { id: 'elem.image', description: 'Breaks if an **`<image>`** (embedded raster) isn\'t emitted or its href is dropped.', get doc() { return require('./cases/elemImage.svga').elemImage; } },
            { id: 'elem.text', description: 'Breaks if **multi-line text or per-span colour** is flattened — lines merge or lose colour.', get doc() { return require('./cases/elemText.svga').elemText; } },
            { id: 'elem.text.spacing', description: 'Breaks if **`letter-spacing`** isn\'t animatable — glyphs don\'t spread.', get doc() { return require('./cases/elemTextSpacing.svga').elemTextSpacing; } },
            { id: 'elem.text.anchor', description: 'Breaks if **`text-anchor`** start/middle/end isn\'t honoured — rows won\'t align to the guide.', get doc() { return require('./cases/elemTextAnchor.svga').elemTextAnchor; } },
            { id: 'elem.text.mixedSpans', description: 'Breaks if **per-span styling** or a **span-level animated fill** is lost — the last span won\'t animate red→blue.', get doc() { return require('./cases/elemTextMixedSpans.svga').elemTextMixedSpans; } },
            { id: 'elem.text.path.browserFont', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', get doc() { return require('./cases/elemTextPathBrowserFont.svga').elemTextPathBrowserFont; } },
            { id: 'elem.text.path.textLength.browserFont', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', get doc() { return require('./cases/elemTextPathTextLengthBrowserFont.svga').elemTextPathTextLengthBrowserFont; } },
            { id: 'elem.text.path.glyphsOff', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', get doc() { return require('./cases/elemTextPathGlyphsOff.svga').elemTextPathGlyphsOff; } },
            { id: 'elem.text.path.textLength.glyphsOff', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', get doc() { return require('./cases/elemTextPathTextLengthGlyphsOff.svga').elemTextPathTextLengthGlyphsOff; } },
            { id: 'elem.text.path.glyphsOn', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', get doc() { return require('./cases/elemTextPathGlyphsOn.svga').elemTextPathGlyphsOn; } },
            { id: 'elem.text.path.textLength.glyphsOn', description: 'Breaks if **`startOffset`** along a path doesn\'t animate — glyphs won\'t slide along the curve.', get doc() { return require('./cases/elemTextPathTextLengthGlyphsOn.svga').elemTextPathTextLengthGlyphsOn; } },
            { id: 'elem.text.path.straight', description: 'Breaks on **zero-curvature** textPath layout — catches bugs specific to a straight baseline.', get doc() { return require('./cases/elemTextPathStraight.svga').elemTextPathStraight; } },
            { id: 'elem.text.gradient', description: 'Breaks if **gradient paint doesn\'t ride the baked outline `<g>`** (glyph text has no `<text>` fill) — a known regression target (paint baked away).', get doc() { return require('./cases/elemTextGradient.svga').elemTextGradient; } },
            { id: 'elem.text.pattern', description: 'Breaks if **pattern paint doesn\'t ride the baked outline `<g>`** — the same glyph-baking paint gap as the gradient case.', get doc() { return require('./cases/elemTextPattern.svga').elemTextPattern; } },
            { id: 'elem.marker', description: 'Breaks if **markers** (start/mid/end) or `orient="auto"` don\'t render/orient — arrowheads missing or facing wrong.', get doc() { return require('./cases/elemMarker.svga').elemMarker; } },
            { id: 'elem.pattern', description: 'Breaks if a **`userSpaceOnUse` pattern tile** doesn\'t fill.', get doc() { return require('./cases/elemPattern.svga').elemPattern; } },
            { id: 'elem.pattern.anim', description: 'Breaks if **`patternTransform`** doesn\'t animate — the tile won\'t rotate over time.', get doc() { return require('./cases/elemPatternAnim.svga').elemPatternAnim; } },
            { id: 'elem.filter.blur', description: 'Breaks if **`feGaussianBlur`** isn\'t applied or its radius doesn\'t animate.', get doc() { return require('./cases/elemFilterBlur.svga').elemFilterBlur; } },
            { id: 'elem.filter.shadow', description: 'Breaks if the **drop-shadow** filter isn\'t applied.', get doc() { return require('./cases/elemFilterShadow.svga').elemFilterShadow; } },
            { id: 'elem.filter.colorMatrix', description: '**Not built yet** — will guard an `feColorMatrix` recolour once implemented (see COVERAGE-GAPS.md).', get doc() { return require('./cases/elemFilterColorMatrix.svga').elemFilterColorMatrix; } },
            { id: 'elem.mask.def', description: 'Breaks if the **`<mask>` def form** (`setMask`) diverges from the `maskedBy` effect.', get doc() { return require('./cases/elemMaskDef.svga').elemMaskDef; } },
            { id: 'elem.mask.textLongPath.browserFont', description: '🚧 **TODO** — what can break and why.', get doc() { return require('./cases/elemMaskTextLongPathBrowserFont.svga').elemMaskTextLongPathBrowserFont; } },
            { id: 'elem.mask.textLongPath.glyphsOff', description: '🚧 **TODO** — what can break and why.', get doc() { return require('./cases/elemMaskTextLongPathGlyphsOff.svga').elemMaskTextLongPathGlyphsOff; } },
            { id: 'elem.mask.textLongPath.glyphsOn', description: '🚧 **TODO** — what can break and why.', get doc() { return require('./cases/elemMaskTextLongPathGlyphsOn.svga').elemMaskTextLongPathGlyphsOn; } },
            { id: 'elem.marker.orient', description: 'Breaks if **`orient="auto-start-reverse"`** or a fixed angle isn\'t honoured — the start marker faces the wrong way.', get doc() { return require('./cases/elemMarkerOrient.svga').elemMarkerOrient; } },
            { id: 'elem.text.browser', description: 'Breaks if **multi-line text or per-span colour** is flattened — lines merge or lose colour.', get doc() { return require('./cases/elemTextBrowser.svga').elemTextBrowser; } },
            { id: 'elem.mask.bbb', description: '🚧 **TODO** — what can break and why.', get doc() { return require('./cases/elemMaskBbb.svga').elemMaskBbb; } },
        ],
    },
    {
        title: '§ 3.2 effect.repeater',
        data: [
            { id: 'effect.repeater.alongLine', description: 'Breaks if the repeater **doesn\'t emit N offset copies** — only the source renders.', get doc() { return require('./cases/effectRepeaterAlongLine.svga').effectRepeaterAlongLine; } },
            { id: 'effect.repeater.radial', description: 'Breaks if the **per-copy rotation increment** is wrong — copies stack instead of fanning.', get doc() { return require('./cases/effectRepeaterRadial.svga').effectRepeaterRadial; } },
            { id: 'effect.repeater.combined', description: 'Breaks if **translate + rotate + scale per copy** don\'t compose.', get doc() { return require('./cases/effectRepeaterCombined.svga').effectRepeaterCombined; } },
            { id: 'effect.repeater.anim', description: 'Breaks if the **per-copy transform can\'t animate**.', get doc() { return require('./cases/effectRepeaterAnim.svga').effectRepeaterAnim; } },
            { id: 'effect.repeater.animParts', description: 'Breaks if **animated per-copy rotate / scale / origin** don\'t apply.', get doc() { return require('./cases/effectRepeaterAnimParts.svga').effectRepeaterAnimParts; } },
            { id: 'effect.repeater.trim', description: 'Breaks if **two structural effects don\'t compose** — each repeated copy must carry its own animated trim.', get doc() { return require('./cases/effectRepeaterTrim.svga').effectRepeaterTrim; } },
            { id: 'effect.repeater.text', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', get doc() { return require('./cases/effectRepeaterText.svga').effectRepeaterText; } },
            { id: 'effect.repeater.shapePreset', description: 'Breaks if the **preset\'s flattened path** isn\'t the thing repeated.', get doc() { return require('./cases/effectRepeaterShapePreset.svga').effectRepeaterShapePreset; } },
        ],
    },
    {
        title: '§ 3.3 effect.maskedBy',
        data: [
            { id: 'effect.maskedBy.alpha.static', description: 'Breaks if the **alpha mask doesn\'t clip** — the shape shows outside the mask.', get doc() { return require('./cases/effectMaskedByAlphaStatic.svga').effectMaskedByAlphaStatic; } },
            { id: 'effect.maskedBy.alpha.bothMoving', description: 'Breaks if the **mask transform desyncs** from the masked content when both animate.', get doc() { return require('./cases/effectMaskedByBothMoving.svga').effectMaskedByBothMoving; } },
            { id: 'effect.maskedBy.luminance', description: 'Breaks if **luminance masking falls back to alpha** — brightness must drive the clip.', get doc() { return require('./cases/effectMaskedByLuminance.svga').effectMaskedByLuminance; } },
            { id: 'effect.maskedBy.rotatingMask', description: 'Breaks if the **mask-transform unwind chain** mishandles an animated mask source — a stress test.', get doc() { return require('./cases/effectMaskedByRotatingMask.svga').effectMaskedByRotatingMask; } },
            { id: 'effect.maskedBy.byPreset', description: 'Breaks if a **preset can\'t be a mask source** — earlier this recursed into the svg root (a cycle).', get doc() { return require('./cases/effectMaskedByByPreset.svga').effectMaskedByByPreset; } },
            { id: 'effect.maskedBy.alongPath', description: 'Breaks if **motion-path content under a static mask** doesn\'t reveal as it moves.', get doc() { return require('./cases/effectMaskedByAlongPath.svga').effectMaskedByAlongPath; } },
            { id: 'effect.maskedBy.textLongPath.browserFont', description: '**Not built yet** — will guard text-on-a-long-path under a mask once implemented (see COVERAGE-GAPS.md).', get doc() { return require('./cases/effectMaskedByTextLongPathBrowserFont.svga').effectMaskedByTextLongPathBrowserFont; } },
            { id: 'effect.maskedBy.textLongPath.glyphsOff', description: '**Not built yet** — will guard text-on-a-long-path under a mask once implemented (see COVERAGE-GAPS.md).', get doc() { return require('./cases/effectMaskedByTextLongPathGlyphsOff.svga').effectMaskedByTextLongPathGlyphsOff; } },
            { id: 'effect.maskedBy.textLongPath.glyphsOn', description: '**Not built yet** — will guard text-on-a-long-path under a mask once implemented (see COVERAGE-GAPS.md).', get doc() { return require('./cases/effectMaskedByTextLongPathGlyphsOn.svga').effectMaskedByTextLongPathGlyphsOn; } },
            { id: 'effect.maskedBy.byClone', description: '**Not built yet** — will guard a `<use>`-clone as the mask source once implemented (see COVERAGE-GAPS.md).', get doc() { return require('./cases/effectMaskedByByClone.svga').effectMaskedByByClone; } },
        ],
    },
    {
        title: '§ 3.3b effect.clipPath',
        data: [
            { id: 'effect.clipPath', description: 'Breaks if **`<clipPath>` geometry isn\'t applied** — nothing is clipped.', get doc() { return require('./cases/effectClipPath.svga').effectClipPath; } },
        ],
    },
    {
        title: '§ 3.4 effect.trimPath',
        data: [
            { id: 'effect.trimPath', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', get doc() { return require('./cases/effectTrimPath.svga').effectTrimPath; } },
            { id: 'effect.trimPath.subpath', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', get doc() { return require('./cases/effectTrimPathSubpath.svga').effectTrimPathSubpath; } },
            { id: 'effect.trimPath.roundCorner', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', get doc() { return require('./cases/effectTrimPathRoundCorner.svga').effectTrimPathRoundCorner; } },
            { id: 'effect.trimPath.shapePreset', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', get doc() { return require('./cases/effectTrimPathShapePreset.svga').effectTrimPathShapePreset; } },
            { id: 'effect.trimPath.subpath.trimAllAsOne', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', get doc() { return require('./cases/effectTrimPathSubpathTrimAllAsOne.svga').effectTrimPathSubpathTrimAllAsOne; } },
            { id: 'effect.trimPath.group', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', get doc() { return require('./cases/effectTrimPathGroup.svga').effectTrimPathGroup; } },
            { id: 'effect.trimPath.group.trimAllAsOne', description: 'Breaks if **trim `start`/`end`/`offset`** don\'t map to a dasharray draw-on — the stroke won\'t reveal.', get doc() { return require('./cases/effectTrimPathGroupTrimAllAsOne.svga').effectTrimPathGroupTrimAllAsOne; } },
        ],
    },
    {
        title: '§ 3.5 effect.retime',
        data: [
            { id: 'effect.retime.start', description: 'Breaks if a **materialised clone** holding a nested `<use>` loses its external **animated** content.', get doc() { return require('./cases/effectRetimeStart.svga').effectRetimeStart; } },
            { id: 'effect.retime.stretch', description: 'Breaks if a **materialised clone** holding a nested `<use>` loses its external **animated** content.', get doc() { return require('./cases/effectRetimeStretch.svga').effectRetimeStretch; } },
        ],
    },
    {
        title: '§ 3.6b effect.clone',
        data: [
            { id: 'effect.clone.textGlyph', description: '**Not built yet** — will guard a clone of glyph-mode text once implemented (blocked by the glyph-paint fix; see COVERAGE-GAPS.md).', get doc() { return require('./cases/effectCloneTextGlyph.svga').effectCloneTextGlyph; } },
            { id: 'effect.clone.text', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', get doc() { return require('./cases/effectCloneText.svga').effectCloneText; } },
            { id: 'effect.clone.simpleRef', description: 'Breaks if a basic **`<use>`→def reference** doesn\'t resolve — nothing renders.', get doc() { return require('./cases/effectCloneSimpleRef.svga').effectCloneSimpleRef; } },
            { id: 'effect.clone.contentRef', description: 'Breaks if the **content-ref** (group target) isn\'t materialised — the used group is empty.', get doc() { return require('./cases/effectCloneContentRef.svga').effectCloneContentRef; } },
            { id: 'effect.clone.symbol.internalTimeline', description: 'Breaks if the symbol\'s **own `timeline.duration`** is dropped by the writer (a known drop area) — the nested clock stops.', get doc() { return require('./cases/effectCloneSymbolInternalTimeline.svga').effectCloneSymbolInternalTimeline; } },
            { id: 'effect.clone.static', description: 'Breaks if the **ref effect can\'t target a non-symbol** element.', get doc() { return require('./cases/effectCloneStatic.svga').effectCloneStatic; } },
            { id: 'effect.clone.text.browserFont', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', get doc() { return require('./cases/effectCloneTextBrowserFont.svga').effectCloneTextBrowserFont; } },
            { id: 'effect.clone.text.glyphs', description: 'Breaks if a **text element isn\'t repeatable** by the effect.', get doc() { return require('./cases/effectCloneTextGlyphs.svga').effectCloneTextGlyphs; } },
            { id: 'effect.clone.animCloned', description: 'Breaks if the **ref effect can\'t target a non-symbol** element.', get doc() { return require('./cases/effectCloneAnimCloned.svga').effectCloneAnimCloned; } },
            { id: 'effect.clone.symbol.alongPath', description: 'Breaks if **clone content along a path** doesn\'t move.', get doc() { return require('./cases/effectCloneSymbolAlongPath.svga').effectCloneSymbolAlongPath; } },
            { id: 'effect.clone.symbol.alongPath.aaa', description: 'Breaks if **clone content along a path** doesn\'t move.', get doc() { return require('./cases/effectCloneSymbolAlongPathAaa.svga').effectCloneSymbolAlongPathAaa; } },
        ],
    },
    {
        title: '§ 4 anim',
        data: [
            { id: 'anim.easing.cubic', description: 'Breaks if **cubic-bezier easing collapses to linear** — the three curves would look identical.', get doc() { return require('./cases/animEasingCubic.svga').animEasingCubic; } },
            { id: 'anim.easing.overshoot', description: 'Breaks if **control points past `1` are clamped** — the spring/overshoot flattens.', get doc() { return require('./cases/animEasingOvershoot.svga').animEasingOvershoot; } },
            { id: 'anim.config.direction', description: 'Breaks if **`direction=alternate`** isn\'t honoured — playback won\'t reverse each iteration.', get doc() { return require('./cases/animConfigDirection.svga').animConfigDirection; } },
            { id: 'anim.easing.namedRef', description: '**Not built yet** — will guard a keyframe referencing a named easing from `defs.easings` once implemented (see COVERAGE-GAPS.md).', get doc() { return require('./cases/animEasingNamedRef.svga').animEasingNamedRef; } },
            { id: 'anim.tangentInOut', description: 'Breaks if **per-keyframe `tangentIn`/`tangentOut`** are ignored — the motion path won\'t curve between keys.', get doc() { return require('./cases/animTangentInOut.svga').animTangentInOut; } },
            { id: 'anim.loop.cycle', description: 'Breaks if **`loopOut` (cycle)** doesn\'t restart from the start each pass.', get doc() { return require('./cases/animLoopCycle.svga').animLoopCycle; } },
            { id: 'anim.loop.pingpong', description: 'Breaks if **ping-pong (alternate)** doesn\'t reverse direction each pass.', get doc() { return require('./cases/animLoopPingpong.svga').animLoopPingpong; } },
            { id: 'anim.loop.loopIn', description: 'Breaks if **loop-in loops the wrong segment** (leading kfs `60→100`).', get doc() { return require('./cases/animLoopLoopIn.svga').animLoopLoopIn; } },
            { id: 'anim.loop.segmentCount', description: 'Breaks if a **count-limited loop** repeats the full range instead of the segment.', get doc() { return require('./cases/animLoopSegmentCount.svga').animLoopSegmentCount; } },
            { id: 'anim.loop.alternateArc', description: 'Breaks if the arc **snaps/pops at the loop seam** — a cycle-boundary correctness check (the `TLoop` boundary fix).', get doc() { return require('./cases/animLoopAlternateArc.svga').animLoopAlternateArc; } },
        ],
    },
    {
        title: '§ 5 complex',
        data: [
            { id: 'complex.maskedRepeater', description: 'Breaks if a **mask over a repeater** doesn\'t stack.', get doc() { return require('./cases/complexMaskedRepeater.svga').complexMaskedRepeater; } },
            { id: 'complex.maskedRepeaterAnim', description: 'Breaks if **mask + repeater + animation** don\'t compose in motion (both mask and content move).', get doc() { return require('./cases/complexMaskedRepeaterAnim.svga').complexMaskedRepeaterAnim; } },
            { id: 'complex.firework', description: 'Breaks if a **radial-gradient backdrop + repeated animated particles** don\'t compose — a full real-world scene.', get doc() { return require('./cases/complexFirework.svga').complexFirework; } },
            { id: 'complex.repeaterLoader', description: 'Breaks if a **repeater of per-copy fade/rotate** copies doesn\'t sequence — a real-world loader.', get doc() { return require('./cases/complexRepeaterLoader.svga').complexRepeaterLoader; } },
            { id: 'complex.trimLoader', description: 'Breaks if an **animated strokeTrim draw-on** on a rotating shape doesn\'t reveal — a real-world loader.', get doc() { return require('./cases/complexTrimLoader.svga').complexTrimLoader; } },
        ],
    },
];

export const CASE_COUNT = CASE_SECTIONS.reduce((n, s) => n + s.data.length, 0);
