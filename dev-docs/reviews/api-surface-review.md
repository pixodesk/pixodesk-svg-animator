# Pixodesk SVG Animator — the export surface: audience, names, and what should be private

A review of WHAT the five packages export, WHO consumes each name, and what the names should be
called. Split out of api-schema-review.md on 2026-09-13, which is now complete; the items keep
their `§26.x` numbers so a `review §26.x` comment in the code still finds its item here.

Checked against the source and against every consumer tree (the editor app, the examples, the
website, the sibling packages, the repo tooling) on 2026-09-13.

## 26. Identifier / interface names — all nine done 2026-09-13 (split out of §25)

Pure renames: the thing stays, the name changes. Cost = files touched in the monorepo, plus the
editor app where it imports the name (the app resolves the packages from this repo, so a rename
lands there in the same pass). Marked ✅ as they land; the old §25 number is kept beside each for
the cross-references that already use it.

| # | Now | Proposed | Why | Cost |
|---|---|---|---|---|
| 26.1 ✅ (was 25.2) | `PxComponentCallbacks` / `PxAnimatorCallbacksConfig` | *Done 2026-09-13:* `PxAnimatorCallbacks` (what every public surface takes, `createAnimator` included) / `PxEngineCallbacks` (what an engine takes, no `onStop`). And one chain in core, each level extending the one above, so a field is spelled once: `PxDiagnosticsConfig` (`onWarn` / `onError` / `muteWarn` / `muteError` — what `createDiagnostics` reads) → `PxEngineCallbacks` (+ the lifecycle) → `PxAnimatorCallbacks` (+ `onStop`). The two old names were already one chain; the duplicate that had crept in was the diagnostics quartet, spelled again on the engine type — now inherited | "Component" became wrong the day `createAnimator` took them inline (§24); "Config" says nothing | 16 files + the reference, 0 app |
| 26.2 ✅ (was 25.3) | `PxAnimatorAPI`, `PxBasicAnimatorAPI` vs `ReactAnimatorApi`, `VueAnimatorApi`, `RnAnimatorApi` | *Done 2026-09-13:* `PxAnimatorApi`, `PxBasicAnimatorApi` — one casing across all five packages and the editor. §6.10 then renamed the second again, to `PxPlaybackApi`: fixing its casing had left "Basic" still naming nothing | one casing for one word | 22 files + 9 app |
| 26.3 ✅ (was 25.4) | `PxTimelineEngineExtra` | *Done 2026-09-13:* `PxTimelineEngineSetting` (what the file sets: auto · native · js) vs `PxTimelineEngine` (what runs) | "Extra" describes the implementation, not the meaning | 14 files + 2 app |
| 26.4 ✅ (was 25.5) | `PxAnimatorConfigShortcuts`; `applyAnimatorConfig(…, { resetDefaults })` | *Done 2026-09-13:* `PxTimelineShortcuts`; `{ resetTimeline }` — the option key now reads the same as the prop every player already takes | the four shortcuts are timeline keys; the prop is already `resetTimeline` | 8 files, 0 app |
| 26.5 ✅ (was 25.6) | `PxPlaybackOverrideProps`, `PxPrerenderedOptions` | *Done 2026-09-13:* `PxPlaybackOverride`, `PxPrerenderedAnimatorOptions` | web options are not props; every other options type says `…AnimatorOptions` | 11 files, 0 app |
| 26.6 ✅ (was 25.7) | `setupAnimationTriggers(api, config, diag?)`; `opts?` on `validateDocument` / `materializeAllInTree` / `applyAnimatorConfig` / `validateNodeEffects` | *Done 2026-09-13:* `trigger`; `options` — parameter names only, so not one call site moved | parameter names show in every IDE hint; `createAnimator(options)` already sets the word | trivial |
| 26.7 ✅ (was 25.8) | web exported core's `getNormalizedBindings` as `normalizeDocument` | *Done 2026-09-13:* stage C renamed the alias to the real name and stage G removed the mirror altogether, so the function now lives in core only — one function, one name, one home | one function, two names | closed by C + G |
| 26.8 ✅ (was 25.9) | `isPxElementFileFormat` / `isPxElementFileFormatDeep(fileJson)` | *Done 2026-09-13:* `isPxDocument` / `isValidPxDocument(doc)`, parameter included | "ElementFileFormat" is pre-rename vocabulary; `fileJson` vs `doc` everywhere else | 11 files + 4 app, + the Electron main |
| 26.9 ✅ (was 25.10) | `PxDefs`, `PxDefsSchema`, `getDefs` | *Done 2026-09-13:* `PxDefinitions`, `PxDefinitionsSchema`, `getDefinitions`. One thing to know: the type now shares a name with core's unrelated `animation/PxDefinitions.ts`, which holds the interpolation engine. Legal, and the imports read fine, but that file is the one to rename if the pair ever reads as one thing | the wire key is `definitions`; the only abbreviated type name in the format | optional |

Checked and left alone: `doc` vs `document` — `doc` is the value on every signature and prop,
`Document` the word in type and function names (`validateDocument(doc)`).

The other half of that note did not survive. The `Player…` prefix was judged consistent *within*
the version API and left alone — then §6.6 read the same family from outside and found three
dialects for one idea, so the prefix is gone: `PX_WIRE_*` and `PxWire*` now. Consistent inside a
corner is not the same as consistent in the surface a reader meets.

**All nine landed on 2026-09-13**, in two passes: first the four with no editor impact (26.4, 26.5),
then the rest across both repos at once. Three consumers a package-only scan misses turned up and
were renamed with them: the Electron main process (`kf-el-app`), the `demo-json-render` sandbox —
which is `file:`-linked straight to this monorepo — and a comment in the editor's schema migration
tool. `kf-el-app` is the one to watch: unlike the editor app it resolves the player from
`kf/node_modules`, so it reads the PUBLISHED package and will only compile again once the next
version is published and installed.

## How the lists below were measured

Every name exported from the five package entries (`src/index*.ts`, the three UMD entries
included), crossed with every consumer we control:

| Consumer | What was counted |
|---|---|
| the editor app (`kf/app`) | `import { … } from '@pixodesk/svg-animator-*'` specifiers, app code and app specs separately |
| the examples | the same, in `examples/*` — the only proxy we have for "a user actually calls this" |
| sibling packages | the same, inside the monorepo. A bare `export … from` (web mirroring a core name) is **not** counted as use — it is a re-export, not a consumer |
| repo tooling | `tools/` + `scripts/` |
| the public docs | the 18 markdown files `docs-check` governs, split into the reference (the API reference (now the guides under docs/library), docs/format/README.md) and the **guides** (the READMEs, `docs/library/*`, `docs/format/README.md`) |
| the website | docs only — it imports no package code, it renders the synced player docs |

Two caveats, stated so the numbers are not over-read. A type does not need an import to be
needed: a user writing `<PixodeskSvgAnimator doc={…} />` uses `PixodeskSvgAnimatorProps` without
ever naming it. And the editor calls the UMD build through `PixodeskAnimator.createAnimator(…)`
inside script strings, which no import scan can see.

### The shape of the surface today

| Package | Exports | ● user-facing | ○ advanced | ▪ internal | no mark | in a guide | used by the editor | used by an example | used by a sibling | used by nobody |
|---|---|---|---|---|---|---|---|---|---|---|
| core | 272 | 79 | 96 | 97 | 0 | 93 | 94 | 5 | 93 | 92 |
| web | 222 | 77 | 82 | 60 | 3 | 86 | 88 | 7 | 44 | 96 |
| react | 5 | 2 | 0 | 0 | 3 | 4 | 1 | 3 | 0 | 2 |
| vue | 3 | 0 | 0 | 0 | 3 | 3 | 1 | 3 | 0 | 0 |
| rn | 16 | 1 | 2 | 11 | 2 | 10 | 1 | 2 | 0 | 14 |

518 export entries, **304 distinct names** — web re-exports 153 core names it never uses itself,
so most of the difference is one surface counted twice. By our own marking, **113 of the 304 are
internal**: more than a third of what we publish is not meant for anyone outside this repo.

## 1. Public — what a user of the library actually calls

The marks come from the API reference (now the guides under docs/library)'s legend: ● user-facing, ○ advanced but supported, ▪ internal.
Filtered to what is *callable* — the rest of the ● values are wire enums, listed in §2.

| Package | Entry points | Audience |
|---|---|---|
| web | `createAnimator(options)`, `loadTagAnimators()`, `setupAnimationTriggers(api, trigger)` | ● — `setupAnimationTriggers` and `loadTagAnimators` carry no mark today |
| web (pre-rendered UMD) | `createAnimator(options: PxPrerenderedAnimatorOptions)` | ● — same name, narrower options |
| react | `<PixodeskSvgAnimator>`, `<PixodeskSvgCssAnimator>` | ● |
| vue | `<PixodeskSvgAnimator>`, `<PixodeskSvgCssAnimator>` | ● — both unmarked today |
| rn 🧪 | `<PixodeskSvgAnimator>` | ● |
| core / web | `validateDocument(doc)` | ● — the "check it before shipping" call |
| core / web | `applyAnimatorConfig`, `mergeAnimatorConfig`, `foldTimelineOverride` | ● — the playback-override merge |
| core / web | `generateNewIds(doc)`, `getAnimatorConfig(doc)`, `isPxDocument(doc)`, `materializeAllInTree(doc, engine)`, `diagnoseDocument(doc)`, `renderNode(node)`, `createAdapterAnimator(doc, adapter)`, `px` / `schemaKeys` / `describeSchema` | ○ — document tooling |

**That is the whole product surface: about eight functions and four components.** Everything else
we publish — 290 names — is a type, a wire enum, a schema object, or plumbing.

### How to mark public vs internal, in the code

Today the audience exists **only in the reference document**. There is no `@internal`, `@public`,
`@alpha` or `@beta` anywhere in the source (checked: zero occurrences), so nothing stops a new
export from shipping with no audience at all — eight already have.

Proposal: one TSDoc release tag on every exported declaration, and the ●/○/▪ marks become a
*rendering* of it rather than a second source of truth.

| Tag | Means | Marker in the docs |
|---|---|---|
| `@public` | supported. Breaking it is a breaking change of the package | ● |
| `@public @advanced` | supported, but document tooling rather than playback — rarely needed | ○ |
| `@internal` | exported only so the editor and the sibling packages stay in lockstep. May change in any release; must not appear in a guide | ▪ |

`@advanced` is a custom tag (TSDoc allows them); the alternative — reusing `@beta` for ○ — would
say "unstable", which is wrong: these are stable, just not for most people. The check that keeps
the tag and the marker honest is §8.

## 2. Public interfaces

52 types are marked ●. Grouped by what a user holds:

| Group | Types |
|---|---|
| The document | `PxAnimatedSvgDocument`, `PxNode`, `PxSvgNode`, `PxAnimatorConfig`, `PxTimeline`, `PxTimelinePin`, `PxTrigger`, `PxKeyframe`, `PxLoop`, `PxBinding`, `PxDefinitions`, `PxElementAnimation`, `PxPropertyAnimation`, `PxAnimationDefinition`, `PxAttrValue`, `PxTransformValue`, `PxTransformParts`, `PxTransformPartKey`, `PxBezierPath`, `PxGlyph`, `PxGlyphFont`, `PxScroll`, `PxScrollRangePoint`, `PxVec2` |
| Effects | `PxEffects`, `PxAnimatable`, `PxCloneEffect`, `PxRepeaterEffect`, `PxRetimeEffect`, `PxMaskedByEffect`, `PxTransformByEffect`, `PxTextPathEffect`, `PxStrokeTrimEffect`, `PxFillGradientEffect`, `PxStrokeGradientEffect`, `PxGradientStop` |
| Calling a player | `PxAnimatorOptions`, `PxTagAnimatorOptions`, `PxPrerenderedAnimatorOptions`, `PxAnimatorApi`, `PxPlaybackApi`, `PxAnimatorHandle`, `PxAnimatorCallbacks`, `PxEngineCallbacks`, `PxPlaybackOverride`, `PxControlProps`, `PxPlatformAdapter` |
| Diagnostics | `PxDiagnostic`, `PxDiagnostics`, `PxDiagnosticsConfig`, `PxDiagnosticKind` |
| Overrides | `PxAnimatorConfigPatch`, `PxTimelinePatch`, `PxTimelineShortcuts`, `PxAnimatorConfigMergeResult` |
| Components | `PixodeskSvgAnimatorProps` (react, rn), `PixodeskSvgAnimatorCallbacks` (react), `ReactAnimatorApi`, `VueAnimatorApi`, `RnAnimatorApi` |

Two problems visible from the table alone. **`PxPrerenderedAnimatorOptions`, `VueAnimatorApi`,
`RnAnimatorApi`, `PixodeskSvgAnimator` (vue) and `PixodeskSvgAnimatorCallbacks` carry no mark** —
they are public by every other measure. And **48 of the ● names appear in no guide**: they are
listed in the reference index and never explained. For the wire types that is defensible, because
docs/format/README.md documents the *format* they describe; for `PxDiagnostic`, `PxAnimatorHandle`,
`PxAnimatorCallbacks`, `PxPlaybackOverride` and the override types it is a real gap — a user
meets them in a signature with nowhere to read about them.

## 3. Exported, but consumed only inside the player packages

101 entries are imported by a sibling package and by nobody else: core's engine rules
(`resolveTimelineEngine`, `isNativeForced`, `mayUseNativeScrollTimeline`), the scroll maths, the
time contract (`clampSeekMs`, `seekCeilingMs`, `progressSpanMs`, `createRunClock`,
`isValidPlaybackRate`, `PX_RATE_REJECTED`), the diagnostics channel, the control-mode rule, the
shared component shapes (`PxAnimatorHandle`, `PxAnimatorCallbacks`, `PxPlaybackOverride`,
`PxControlProps`), the string/colour/bezier utilities, `PxPlatformAdapter`, `validateNodeEffects`,
`foldTimelineOverride`, `reportDocumentDiagnostics`.

These exist for a good reason — core is where the "one rule, one place" decisions of the API review
live, and web/react/vue/rn import them so they cannot drift. But nothing marks them as *ours*:
`createRunClock` and `createAnimator` look equally public from outside.

## 4. Exported, and consumed by the player and the editor

The lockstep set. 32 entries are used by both the editor and a sibling package — the wire types,
`PxTimelineEngine`, `getDefinitions`, `getAnimatorConfig`, `materializeAllInTree`, `materializeNodeEffects`,
`applyAnimatorConfig`, `toDomProps`, `camelCaseToKebabWordIfNeeded`, `PX_LOOP_JUMP_SHIFT_MS`.
A further **112 entries are used by the editor alone**: every schema object (`PxNodeSchema`,
`PxCloneEffectSchema`, …), the schema toolkit (`px`, `PxInfer`, `PxSchemaDesc`,
`PxValidationContext`), the wire-version API, `flattenAnimatorTimeline` / `nestAnimatorTimeline`,
`mergeStaticTransformIntoAnimDef`, `diffInEffect`, the glyph-text materializer, `renderNode`.

This is the largest single group on the public surface, and it is the one a user should never see.
It is also why "just unexport it" does not work: the editor needs these names. The structural
answer is a second entry point — `@pixodesk/svg-animator-core/internal` — which keeps them
importable for us and off the package's front door. See the plan, stage C.

## 5. Exported, consumed by nobody — candidates to make private

47 names are marked ▪ internal **and** have no consumer anywhere: not the editor, not the
examples, not a sibling package, not the tooling. Several are still used *inside* their own
package, which is precisely why they need not be exported.

| Where | Names |
|---|---|
| core, motion path | `materializeMotionPathsInTree`, `materializeInternalLoopsInTree`, `materializeInternalLoopsInPropAnim`, `evaluateMotionPathSegment`, `propAnimIsMotionPath`, `MotionPathMaterializationOptions`, `MotionPathSample`, `materializeAnimatedUseInstances` |
| core, glyph text | `materializeGlyphTextAlongPath`, `materializeGlyphTextHorizontal`, `MISSING_GLYPH_CLASS_NAME`, `GlyphCharBoxAlongPath`, `GlyphMaterializeOpts`, `PathPoint`, `PathSampler`, `shiftAnimatable`, `ExtendPathOpts`, `ExtendedPath`, `jsonElementFactory` |
| core, effects harness | `ApplyResult`, `collectSampleTimes`, `visualModelAt`, `PxAnimatable` |
| core, misc | `INTERNAL_ATTRS`, `parseTransformParts`, `interpolateBeziers`, `kfTime`, `kfTangentIn`, `kfTangentOut`, `PxResolvedControlMode`, `PxNormalizedBinding`, `SchemaReleasePlan`, `SchemaReleaseRecord` |
| web | `normalizeDocument` (the duplicate alias of `getNormalizedBindings`, §26.7), `createFrameLoopAnimator`, `createWebApiAnimator` |
| rn | `renderRnNode`, `toRnProps`, `RenderRnNodeOptions`, `compileTracks`, `sampleProps`, `CompileTracksOptions`, `PxCompiledTracks`, `PxElementTracks`, `RN_SVG_COMPONENTS`, `toRnPropName`, `openClosedTextPathTargets` |

**The React Native package publishes its entire internals**: 14 of its 16 exports have no consumer,
and its own component is the only thing anyone imports. It is 🧪 experimental, so this is the
cheapest moment to cut it back to `PixodeskSvgAnimator`, its props and its handle.

A second, softer group: **39 names marked ● or ○ with no use anywhere and no guide** — among them
`mergeAnimatorConfig`, `PxAnimatorConfigMergeResult`, `applyWireStepsDown`, `WireConversionConfig`,
`WireDowngradeConfig`, `WireDowngradeResult`, `KeysMatch`, `RemoveIndex`, `PxRunClock`,
`PxResolvedTrigger`, `PxDocumentDiagnosis`, and five schema objects (`PxAnimationDefinitionSchema`,
`PxBindingSchema`, `PxEasingOrRefSchema`, `PxTransformValueSchema`, `PxTimelinePinSchema`). These
are not dead by definition — a user may call `mergeAnimatorConfig` — but each one is a promise we
have never had to keep. Each needs a yes/no, not a default yes.

And one contradiction: **25 names marked ▪ internal are named in the user guides** —
`isScrollTimeline`, `scrollViewProgress`, `scrollOffsetProgress`, `scrollTotalDurationMs`,
`cubicBezier`, `splitEasing`, `deepClone`, `sanitizeAttributeValue`, `calcAnimationValues`,
`getNormalizedBindings`, `interpolateValue`, the materializers, `layoutGlyphTextChars`,
`createPathSampler`, `extendedPathForBrowser`, and RN's `renderRnNode`, `compileTracks`,
`sampleProps`, `RN_SVG_COMPONENTS`, `toRnPropName`, `openClosedTextPathTargets`. We tell people not
to rely on them and then show them how. Either the mark is wrong or the guide is.

## 6. Naming — what is inconsistent

§26 above lists the nine renames already agreed. The audit adds a further set, all of them cases
where one idea has two spellings or one spelling covers two ideas.

**All eleven landed on 2026-09-13.** Two rested on a premise that turned out to be false, and both
are corrected in place rather than quietly dropped: 6.3 would have merged two genuinely different
types, and 6.11 would have unexported two functions web's own engine imports.

| # | The inconsistency | Evidence | Suggested rule |
|---|---|---|---|
| 6.1 ✅ | An options bag is called four things | `ExtendPathOpts`, `GlyphMaterializeOpts` vs `WireConversionConfig`, `WireDowngradeConfig` vs `PxPlaybackOverrideProps` | *Done:* `ExtendPathOptions`, `GlyphMaterializeOptions`; the two wire `…Config` types became `PxWireConversionOptions` / `PxWireDowngradeOptions` under 6.6; `PxPlaybackOverride` came from §26.5. `PxDiagnosticsConfig` KEPT — it is a block a host configures, not a function's options bag |
| 6.2 ✅ | The `Px` prefix is on every type except 26 of them | `GlyphCharBox`, `MaterializeAllOptions`, `RemoveIndex` — stages C–E had already unexported the rest of the 26 | *Done:* `PxGlyphCharBox`, `PxMaterializeAllOptions`, `PxRemoveIndex`; `Vec2` under 6.3 and the `Wire*` family under 6.6. The framework handles (`ReactAnimatorApi`, `VueAnimatorApi`, `RnAnimatorApi`) and `PixodeskSvgAnimatorProps` keep their names on purpose — §26.2 decided each package names its own handle |
| 6.3 ✅ | Two names for one concept | **The premise was wrong.** `Vec2` is `[number, number]`; `PxPoint2D` is `Array<number>`. Two different types, not two names for one | *Done, corrected:* `Vec2` → `PxVec2` under 6.2's rule, and `PxPoint2D` left alone. Merging them would have widened a fixed pair into any-length |
| 6.4 ✅ | Schema objects that do not say `Schema` | `PxNodeBase`, `PxSvgNodeExtra` sat among 37 `…Schema` names | *Done:* `PxNodeBaseSchema` and `PxSvgNodeRootSchema` — the second drops "Extra" as well, which is half of 6.10 |
| 6.5 ✅ | Constants: `PX_` on 8 of 24 | `COLOR_ATTR_NAMES`, `CSS_ONLY_STYLE_PROPS`, `DEFAULT_DURATION_MS`, `DISALLOWED_SVG_TAGS_LOWER`, `LOOP_JUMP_SHIFT_MS`, `PCT_BASED_ATTR_NAMES`, `STYLE_ATTR_NAMES`, `TEXT_CONTENT_ATTR`, `TRANSFORM_FN_NAMES` | *Done:* all nine carry `PX_` now. `INTERNAL_ATTRS`, `MISSING_GLYPH_CLASS_NAME` and `RN_SVG_COMPONENTS` needed nothing — they had stopped being exports in stages C and D |
| 6.6 ✅ | The version family speaks three dialects | `WIRE_VERSION_KEY`, `PLAYER_WIRE_VERSION`, `BASELINE_PLAYER_VERSION`, `PLAYER_WIRE_STEPS`, `PX_PLAYER_SCHEMA_VERSION`, `WireVersion`, `convertPlayerDocument` | *Done — one word (`wire`), one prefix:* `PX_WIRE_VERSION_KEY`, `PX_WIRE_VERSION`, `PX_WIRE_BASELINE_VERSION`, `PX_WIRE_STEPS`, `PX_WIRE_SCHEMA_VERSION`; `PxWireVersion`, `PxWireVersionStep`, `PxWireStepKind`, `PxWireVersionRelation`, `PxWireConversionResult`, `PxWireDowngradeResult`; `convertWireDocument`, `downgradeWireDocument`, `wireVersionAdvice`. The editor keeps its OWN `WIRE_VERSION_KEY`, taken from its schema — the prefix is now what tells the two apart |
| 6.7 ✅ | `get…` means both "read a field" and "compute a view" | `getDefinitions`, `getChildren`, `getBindings`, `getAnimatorConfig` (cheap reads) vs `getNormalizedBindings` (compute) | *Done:* `normalizeBindings`. `get…` now only ever reads a field |
| 6.8 ✅ | "Normalized" means two things | `PxNormalizedBinding` / `PxNormalizedKeyframe` (the runtime view) vs `getNormalizedProps` (sanitised DOM attributes) | *Done:* `toDomProps`, which says where the result goes. `Normalized…` now means the runtime view and nothing else |
| 6.9 ✅ | Pipeline verbs overlap | `materializeAllInTree`, `applyPlayerEffects` (document → document) vs `applyAnimatorConfig`, `applyWireSteps` (patch → document) | *Done:* `materializeNodeEffects`, which also pairs it with `validateNodeEffects`. `apply…` now always means "merge something into a document" |
| 6.10 ✅ | "Basic" and "Extra" each mean two things | `createBasicFrameLoopAnimator` (adapter-driven) vs `PxBasicAnimatorApi` (fewer methods); the `Extra` half closed by §26.3 and 6.4 | *Done:* `createAdapterAnimator` — the obvious `createFrameLoopAnimator` was already web's own engine, and "you give it an adapter" is what the function actually is. `PxBasicAnimatorApi` → `PxPlaybackApi`: play / pause / cancel and state, with `PxAnimatorApi` extending it for seeking, rate and `destroy()` |
| 6.11 ✅ | `kf*` is the only abbreviated function family | **The premise was wrong.** They were not consumerless: web's engine imports `kfEasing` and `kfValue` from core's `/internal`, and unexporting them broke the build | *Done, corrected:* renamed rather than removed — `keyframeTime`, `keyframeValue`, `keyframeEasing`, `keyframeTangentIn`, `keyframeTangentOut`. The abbreviation is gone, which was the point |

## 7. Plan

Ordered so each stage makes the next smaller. Nothing here changes runtime behaviour.

| Stage | What | Why first | Cost |
|---|---|---|---|
| A ✅ | *Done 2026-09-13:* every export tagged in the source — `@public` / `@public @advanced` / `@internal` — seeded from the ●/○/▪ marks. Where the two package sections disagreed about a name, the MORE public mark won: demoting is a product decision, and belongs to stage D | Every later decision needs a truthful audience; it used to live in a table nobody compiles | 311 declarations in 46 files |
| B ✅ | *Done 2026-09-13:* `docs-check` reads the tags out of the built `.d.ts` and enforces them (§8) — `src/audience.ts`, five checks under an `audience` group, plus `audience-allowlist.json` | Locks stage A in before the surface moves again | ~170 lines + a 134-name allowlist |
| C ✅ | *Done 2026-09-13:* the 47 dead internals unexported, the rn package cut to its component, props and handle, and web's `normalizeDocument` alias renamed to core's `getNormalizedBindings` (§26.7) | Fewer names to tag, document and rename later | 5 packages, 0 app |
| D ✅ | *Done 2026-09-13:* not a judgement call after all — the rule is "if the editor does not use it and it is not declared public API, unexport it". 38 more names went, then 12 came back once four keep-signals showed up (below). The distinct surface is 304 → 230 | They are promises we have not had to keep yet | 5 packages, 0 app |
| E ✅ | *Done 2026-09-13, over releases 1.0.40 and the next one.* Core and web ship `./internal` with the 57 `@internal` names, and those names are now OFF the main entries: the public door is 173 names (83 `@public`, 90 `@public @advanced`), down from 230. Our packages, the release script and the editor's 19 files import from `/internal`; the editor resolves it through explicit tsconfig `paths`, a vitest alias ahead of the bare one, and a jest mapping. A new check (§8.6) fails if an `@internal` name ever reappears on a main entry | Takes 57 names off the front door without breaking the editor | done; needs a publish to reach consumers |
| F ✅ | *Done 2026-09-13, both halves.* §26's nine renames landed first — 26.2 `PxAnimatorApi` / `PxPlaybackApi`, 26.3 `PxTimelineEngineSetting`, 26.4 `PxTimelineShortcuts` + `{ resetTimeline }`, 26.5 `PxPlaybackOverride` / `PxPrerenderedAnimatorOptions`, 26.6 the `trigger` / `options` parameter names, 26.8 `isPxDocument` / `isValidPxDocument`, 26.9 `PxDefinitions*` / `getDefinitions`, on top of 26.1 and 26.7. Then all eleven rules in §6: the `Px` prefix on the three types that still lacked it, `PX_` on nine constants, the version family folded into one `PX_WIRE_*` / `PxWire*` vocabulary, and the `get…` / `normalize…` / `materialize…` verbs separated | Cheapest once the surface is smaller | §26: 44 monorepo + 17 editor files · §6: 71 monorepo + 12 editor files |
| G ✅ | *Done 2026-09-13:* web mirrored 150 core names; it now re-exports the 31 its own API refers to, plus `validateDocument`, which the minification guide teaches. The other 119 are gone. React, Vue and the preview-player example reached core THROUGH web, so they gained a direct core dependency and import from it now — which is the point: one name, one home | Each is a name to tag, document and rename twice | 6 files + 3 package.json, 0 app |

E is the one with a real decision behind it: the alternative is to leave the editor-facing names on
the main entry and rely on the tags plus documentation to say "not for you", which is cheaper but
keeps a front door nobody can read.

**Four keep-signals a "nobody uses it" scan misses.** Stages C and D pulled 12 names back after
removing them, each for a reason worth writing down:

1. **A repo script reaching core through a namespace import.** `scripts/schema-release.mjs` does
   `import * as core` and then `core.planSchemaRelease(…)`, so no named-import scan sees it. Four
   names, and the script would have broken silently.
2. **A name the docs CHECK against.** `px-check signature`, `schema PxClipPathEffectSchema`,
   `props PxTimelineShortcuts` — the table under the marker documents the type member by
   member even when no prose spells its name. `audience.ts` now counts marker targets as described.
3. **`export { X } from '@pixodesk/…'` in the editor.** A re-export is not a use when web mirrors
   core, but it IS one in the app, which re-exports the player's version API so its own call sites
   have a single import. Eight names came back this way.
4. **`tsc` on the editor app is the authority.** It found what every scan had missed; run it before
   believing any of them.

## 8. Proposal — extending `docs-check` so "public" implies "documented"

**Done 2026-09-13 — stages A and B of the plan.** All 311 exported declarations now carry a
release tag, `docs-check` reads them back out of the built `.d.ts` files, and five checks run
under an `audience` group. What the first run turned up is in the last column.

`tools/docs-check/audience-allowlist.json` held the names still owed a write-up, one line and one
reason each, and an entry that stops being needed fails the check too — so the list could only
shrink. **It is now empty.** The last 88 were written up on 2026-09-13, each where it actually
belongs rather than in a dumping ground: the 20 wire types as a "import this to type that part of
the document" table in the format guide; the schema values, the schema toolkit, the wire-version
API and the time contract in core's README; the engine and trigger resolvers, the override merge
and the shared control-mode rule in the playback guide; the player-surface and diagnostics types
in the installation guide; `renderNode` in web's README. Every `@public` name is now named in a
guide, and a new one cannot ship without that.

What exists today: `<!-- px-check … -->` markers tie a table or code block to a type, and the
`exports` kind already guarantees that every export of a package is *mentioned* somewhere in its
reference section. That is why no export is missing from the API reference (now the guides under docs/library). The gap is that a mention
is not a description, and no rule connects an audience to an obligation — which is how 132
supported names came to be listed and never explained, and a pair of internals came to be handed
to readers in a guide's example.

The tags from stage A close it, because the check can then read the *intent* from the code:

| # | Check | Fails when | What the first run found |
|---|---|---|---|
| 8.1 ✅ | every export carries exactly one release tag | a new export ships untagged | 311 declarations tagged, none left untagged. 17 names carried a mark the parser could not attribute (it sat past a `→`, or mid-cell) and 14 more were documented in prose rather than an index row — each read off the reference by hand |
| 8.2 ✅ | the tag and the reference's ●/○/▪ agree | someone edits one of the two | 19 disagreements, every one of them the web section and the core section marking the SAME name differently. All fixed: two rows split by audience, seven names marked in place. A row may now mark one of its names differently — `` `getNormalizedProps` (○) `` inside a ▪ row |
| 8.3 ✅ | `@public` ⇒ named in a **guide**, not only the reference index | a supported name is listed and never explained | 132 names, every one allowlisted with a reason. That number is the honest headline of this review: we tag far more as supported than we explain. Stages C–G then took the list from 132 to 88 without a word being written — those names simply stopped being public — and the remaining 88 were written up on 2026-09-13, leaving the allowlist empty |
| 8.4 ✅ | `@public` on a function or component ⇒ its shape is under a `px-check signature` or `props` block | the signature can drift silently | *Built 2026-09-13:* of the 11 public callables, 9 were already shown. The two it caught — `resolveControlMode` and `controlModeTakesOverTrigger` — were named in the export index and spelled out nowhere; both now have a signature in core's block. A type is exempt (8.3 covers it), and so is `@public @advanced`, being document tooling |
| 8.5 ✅ | `@internal` ⇒ never put in a guide's **code example** | we hand someone a line to run against what we may break | 25 at first, but 23 were passing prose mentions rather than teaching. Counting fenced code blocks only left two real ones — `calcAnimationValues` and `getNormalizedBindings`, both in a promoted "values at any time, no renderer involved" example in two guides. Promoted to `@public @advanced` rather than gutting the example |
| 8.6 ✅ | `@internal` ⇒ not exported from a public entry | after stage E, enforces the boundary | *Built 2026-09-13:* passes, which is an independent confirmation that stage E was complete — it reads the built `.d.ts` of each main entry rather than the source list the names were moved out of |

Plus a coverage report — `audienceReport()` prints package × audience × described, so the gap is
visible instead of inferred, the way this review had to infer it. **Wired 2026-09-13** as
`pnpm report:audience`, which sets `DOCS_CHECK_AUDIENCE_REPORT=1` and prints the table alongside the
run. Today every row reads the same on both sides — core 71 of 71 `@public` described and 89 of 89
advanced, web 29 and 14, react 4, vue 3, rn 3 — which is the allowlist being empty, seen from the
other direction.

**How it was built.** `tools/docs-check/src/audience.ts`, ~280 lines, plus five `it`s in
`docs.test.ts`; nothing else in the checker changed. Tags are read with `symbol.getJsDocTags()`
off the existing program over each package's `dist/index.d.ts` — JSDoc survives that build, and no
`stripInternal` is set. Because web re-exports core, the tag is read from the *declaring* symbol
(`getAliasedSymbol`, which `TsFacts.exports` already resolves), so a mirrored name reads its
origin's tag rather than none. Two parser lessons worth keeping: a cell must be split on backtick
spans, not commas, or `` `f(doc, opts?)` `` is cut in half and the name is lost; and a name after
a `→` is a return type, not what the row declares.

**Optional, once the tags are in — measured on 2026-09-13, and the answer is no.** The idea was to
set `stripInternal: true` in the d.ts build so `@internal` names disappear from the published types.
Tried it: core's main entry carried 147 names and its `/internal` entry 40, both with the flag on
and with it off. It changes nothing here, because the entries are bundled `.d.ts` files that
re-export through a hashed chunk rather than emitted per declaration. Stage E already moved every
internal name off the main entry, which is the boundary this was reaching for — and unlike a build
flag it is enforced, by check 8.6. Not enabled.
