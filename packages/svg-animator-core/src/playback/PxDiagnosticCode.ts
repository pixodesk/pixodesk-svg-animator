/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// EVERY THING A PLAYER CAN SAY, AS A NUMBER.
//
// The text of a diagnostic is not shipped. Each code's description lives in the comment on its
// member and nowhere else, so a build carries the bare integer — `1204` — and not one byte of
// prose. The descriptions are compiled into docs/diagnostics.md by
// `node scripts/gen-diagnostics-md.mjs`, which `pnpm build` runs, and every diagnostic links there.
//
// A PLAIN `enum`, deliberately, and it costs almost nothing. Measured through this repo's own
// esbuild, a plain enum and a `const enum` emit byte-identical output (`o(1301),o(1302)…`): in
// bundle mode every member access is inlined to its number, and the object is then tree-shaken
// out of any bundle that does not re-export it. A `const enum` would additionally force
// `isolatedModules: false` on every package that imports it and would land in the published
// `.d.ts`, where it breaks consumers who have `isolatedModules` on.
//
// Core's entry exports it as a VALUE — the players read members at runtime, and a host needs the
// enum to switch on a code it was handed. What that costs, measured on the shipped build:
//
//   - core's own ESM/CJS dist carries the object (that is what a host imports);
//   - the web UMD carries NONE of it — the inlined numbers and one link to the page, and not a
//     single member name — because web's entry deliberately does not re-export it. Re-exporting
//     it there would pin the object into the UMD, so don't.
//
// RULES FOR EDITING THIS FILE
//
//   - A NUMBER IS FOREVER. Codes are a public identity: a host switches on them and users search
//     for them. Never renumber, never reuse. To retire one, keep the member and mark it
//     `@deprecated` in its comment — the page then says so too.
//   - The first line of the comment is the description the page shows. Keep it one sentence, in
//     the voice of the person who has to act on it.
//   - `@data` lines name the values the call site passes after the code, in order. They reach a
//     handler as `diagnostic.data` and are printed after the code on the console. Put the
//     specifics there (a selector, a URL, an inner message) — never in prose, which does not exist.
//   - Ranges group by area, so a reader can tell roughly where a code came from without the page.

/**
 * Every diagnostic a player can report, as a number a host can switch on.
 *
 * The words are not in the build: each code's description lives in the comment on its member and
 * is compiled into `docs/diagnostics.md`, which every diagnostic's `message` links to.
 * @public
 */
export enum PxDiagnosticCode {

    // ── 1000 · building a player ─────────────────────────────────────────────────────────────

    /**
     * The player could not be built from this document — a document that passed validation but
     * still broke the builder, or a bug in the player. Report it.
     * @data the Error
     */
    buildFailed = 1001,

    /**
     * The file at the `document` URL loaded, but it is not a Pixodesk animation document.
     * @data the URL
     */
    invalidDocumentAtSrc = 1002,

    /**
     * The page could not fetch the `document` URL. The file may be perfect — this is the request failing.
     * @data the URL · the fetch error's message
     */
    loadFailed = 1003,

    /**
     * One element's animation could not be built, so that element stays static; the rest plays.
     * @data the Error
     */
    animationBuildFailed = 1004,

    // ── 1100 · what the document says ────────────────────────────────────────────────────────

    /**
     * An `effects` bucket does not match the schema, so that effect is ignored or degraded.
     * @data the problem, with the node's path
     */
    effectsShape = 1101,

    /**
     * Part of the per-instance `timeline` override could not be applied — most often clock-only
     * keys aimed at a scroll timeline.
     * @data what could not be applied
     */
    timelineOverrideIgnored = 1102,

    /**
     * An SVG tag that can execute or load remote content was dropped from the rendered tree.
     * @data the tag name
     */
    blockedTag = 1103,

    /**
     * The browser will not animate these attributes, so the document fell back to the frame loop.
     * @data the attribute names
     */
    unsupportedAnimatedAttrs = 1104,

    /** A bind-by-id document carries no `animator.bindings`, so nothing is animated. */
    noBindings = 1105,

    /**
     * A transform part is animated as its own `animate` channel (`animate.translate`, …) — the
     * deprecated spelling: several on one node are last-write-wins. Spell it `animate.transform`
     * (record keyframes), or `effects.transformBy` for independently-timed parts.
     * @data the channel(s) and the node
     */
    deprecatedTransformChannel = 1107,

    /**
     * A document value did not match the schema and was repaired before playing — replaced by the
     * schema's default, or dropped when nothing could be kept. The document plays; the value is not
     * what was written.
     * @data the problem, with its path
     */
    documentRepaired = 1108,

    /**
     * Two trigger lists react to one event in the same state: `playback.stop` and `playback.pause` (playing — the pause wins), or
     * `playback.stop` and the counterpart of a `playback.pause` event (paused — the resume wins). The file should name one.
     * @data the event and the two lists
     */
    triggerEventConflict = 1109,

    /**
     * A trigger list names an event it cannot use — `playback.start` on `hoverOut`, `playback.stop` on `load` or `hoverIn`,
     * `playback.pause` or `playback.resume` on `load`. The event is ignored.
     * @data the list and the event
     */
    triggerEventNotAllowed = 1110,

    /**
     * The file's `playback.resume` list differs from what the player would derive — the counterpart of each `playback.pause`
     * event plus the `playback.start` events that do not stop it: it names an event the derivation would not, or leaves out
     * one it would (that pause then waits for `playback.start` or `playback.stop`). The list is honoured as written.
     * @data the list and the event
     */
    triggerResumeDiffers = 1111,

    /**
     * The document has keys or shapes this build's schema does not know — unrecognized keys above all. It plays,
     * with those parts ignored. If you did not author them, the usual cause is a build that MANGLES PROPERTY
     * NAMES: an animation document is data loaded at runtime, so renaming the property reads inside the player
     * stops them matching the keys in the JSON, and the animation silently does nothing. Feed the published
     * reserved-name list to your minifier — `@pixodesk/svg-animator-web/mangle-reserved.json`, see
     * docs/library/minification.md. Reaches `onWarning` like every other diagnostic; `suppressWarnings` silences
     * the console fallback (until 1.15 this report went to the console on its own).
     * @data the problems (path: finding), the first twelve, then the mangling hint
     */
    documentSchemaMismatch = 1112,

    /**
     * A binding names no element, or names animations that `definitions.animations` does not have.
     * @data the binding
     */
    unresolvedBinding = 1106,

    // ── 1200 · the mount: elements the player could not find ─────────────────────────────────

    /** `setupAnimationTriggers` was given no root element, so no trigger was wired. */
    triggersNoRoot = 1201,

    /**
     * The container selector matched nothing, so there is nothing to render into.
     * @data the selector
     */
    noRootForSelector = 1202,

    /** No container was given and the document's `id` matched no element already on the page. */
    noRootElement = 1203,

    /**
     * A binding's selector matched no element, so that binding animates nothing.
     * @data the selector
     */
    noElementsForSelector = 1206,

    /**
     * An attribute write found no element for this id — the rendered SVG was probably replaced.
     * @data the id or selector
     */
    setAttributeNoElement = 1207,

    // ── 1300 · scroll-driven playback ────────────────────────────────────────────────────────

    /** `smoothing` needs the player's own driver, so the browser's scroll timeline was not used. */
    scrollSmoothingNeedsOwnDriver = 1301,

    /** The browser refused to build a native scroll timeline; the player measures progress itself. */
    scrollNativeUnavailable = 1302,

    /**
     * `timeline.subject` is not a valid CSS selector, so the SVG itself is measured instead.
     * @data the subject
     */
    scrollSubjectInvalid = 1303,

    /**
     * `timeline.subject` matched no element, so the SVG itself is measured instead.
     * @data the subject
     */
    scrollSubjectNoMatch = 1304,

    /** There is no root element to observe, so a scroll-driven animation stays on its first frame. */
    scrollNoRootToObserve = 1305,

    /** `timeline.triggers` does not apply to a scroll timeline — the scrollbar is the playhead. */
    scrollTriggerIgnored = 1306,

    // ── 1400 · playback control ──────────────────────────────────────────────────────────────

    /** A playback rate of `0`, or a non-finite one, is rejected everywhere — use `playback.pause()`. */
    rateRejected = 1401,

    // ── 1500 · the props a component was given ───────────────────────────────────────────────

    /**
     * Props from more than one control mode were set at once. The higher-priority mode wins and the
     * other props are ignored — see the control-mode rule.
     * @data which props conflicted, and which won
     */
    controlPropsConflict = 1501,

    /**
     * Retired (1.24): `pause` without `play` could be written with two boolean props; the one `playback` lever has no
     * invalid position pair. The number stays reserved so older hosts' switches keep their meaning.
     * @data the explanation
     */
    playModifierIgnored = 1502,

    /**
     * An imperative write call (`playback.start()`, `playback.pause()`, `playback.play()`, …) landed while a declarative
     * driver (the `playback` or the `showAtProgress` / `showAtTime` props) owns playback. The call is applied, and
     * the next prop change reasserts the props.
     * @data the call
     */
    imperativeOverDeclarative = 1503,

    /**
     * A call on a destroyed player — ignored; `playback.getState()` says `destroyed`.
     * @data the call
     */
    callAfterDestroy = 1504,

    /**
     * A playback call (`playback.start()`, `playback.stop()`, `playback.pause()`, `playback.resume()`, `playback.play()`,
     * `playback.setSpeed()`, `playback.setDurationAtSpeed()`) on a
     * scroll- or view-driven player — ignored: the scroll position owns the playhead. Seeks still apply until the next
     * scroll moves it.
     * @data the call
     */
    scrollOwnsPlayhead = 1505,

    /**
     * A playback call (`playback.start()`, `playback.play()`, `playback.stop()`, `playback.pause()`, `playback.resume()`,
     * a seek, `playback.setSpeed()`, `playback.setDurationAtSpeed()`) on a player shown with `showAsStatic` — ignored:
     * the picture stays as drawn. The reads still answer.
     * @data the call
     */
    showAsStaticIgnoresCall = 1506,

    // ── 1600 · React Native ──────────────────────────────────────────────────────────────────

    /**
     * The document could not be compiled into animation tracks, so `fallback` is shown.
     * @data the Error
     */
    rnCompileFailed = 1601,

    /**
     * Rendering the compiled document threw, so `fallback` is shown.
     * @data the Error
     */
    rnRenderFailed = 1602,

    /**
     * The error boundary caught a render failure below this component.
     * @data the Error · the React component stack
     */
    rnBoundaryCaught = 1603,

    /**
     * `react-native-svg` cannot express part of this document, so it was left out or simplified.
     * @data what was left out
     */
    rnUnsupported = 1604,

    // ── 1700 · variables ─────────────────────────────────────────────────────────────────────

    /**
     * A binding (`variable(name)`, `calc(…)`) or a `variables.set()` call names a variable the document does not
     * declare and the player does not provide — ignored; a binding's place reads as if it were not written.
     * @data the name
     */
    variableUnknown = 1701,

    /**
     * A value written as a binding does not parse — its place reads as if it were not written.
     * @data the text · why it does not parse
     */
    variableBindingInvalid = 1702,

    /**
     * A value given for a variable (`variables.set()`, the `variables` option or prop) does not fit its type — ignored.
     * @data the name · the variable's type · the value
     */
    variableTypeMismatch = 1703,

    /**
     * The `variant` the host asked for is not in the document's `definitions.variableVariants` — the defaults are used.
     * @data the variant name
     */
    variantUnknown = 1704,
}
