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
// A PLAIN `enum`, deliberately, and it costs nothing: the bundler inlines every member access and
// then drops the object, because core's entry re-exports this as a TYPE only. Measured through
// this repo's own esbuild — a plain enum and a `const enum` produce byte-identical output
// (`o(1301),o(1302)…`). A `const enum` would additionally force `isolatedModules: false` on every
// package that imports it and would land in the published `.d.ts`, where it breaks consumers who
// have `isolatedModules` on. So: plain enum, type-only on the public door.
//
// Exporting it as a VALUE would undo this — the object could no longer be dropped, and ~27 member
// names would ship. Hosts compare against the number and look it up on the page, as React's do.
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
//
// @public
export enum PxDiagnosticCode {

    // ── 1000 · building a player ─────────────────────────────────────────────────────────────

    /**
     * The player could not be built from this document — a document that passed validation but
     * still broke the builder, or a bug in the player. Report it.
     * @data the Error
     */
    buildFailed = 1001,

    /**
     * The file at `src` loaded, but it is not a Pixodesk animation document.
     * @data the `src` URL
     */
    invalidDocumentAtSrc = 1002,

    /**
     * The page could not fetch `src`. The file may be perfect — this is the request failing.
     * @data the `src` URL · the fetch error's message
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
     * `scroll.subject` is not a valid CSS selector, so the SVG itself is measured instead.
     * @data the subject
     */
    scrollSubjectInvalid = 1303,

    /**
     * `scroll.subject` matched no element, so the SVG itself is measured instead.
     * @data the subject
     */
    scrollSubjectNoMatch = 1304,

    /** There is no root element to observe, so a scroll-driven animation stays on its first frame. */
    scrollNoRootToObserve = 1305,

    /** `animator.trigger` does not apply to a scroll timeline — the scrollbar is the playhead. */
    scrollTriggerIgnored = 1306,

    // ── 1400 · playback control ──────────────────────────────────────────────────────────────

    /** A playback rate of `0`, or a non-finite one, is rejected everywhere — use `pause()`. */
    rateRejected = 1401,

    // ── 1500 · the props a component was given ───────────────────────────────────────────────

    /**
     * Two control tiers were set at once. The higher one wins and the lower is ignored — see the
     * control-mode rule.
     * @data which props conflicted, and which won
     */
    controlPropsConflict = 1501,

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
}
