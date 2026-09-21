/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { createAnimator, PxAnimatedSvgDocument, type PxNode } from '@pixodesk/svg-animator-web';
import { PxDiagnosticCode } from '@pixodesk/svg-animator-core';
import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PixodeskSvgAnimator, { REACT_CAMEL_CASED_SVG_ATTRS, ReactAnimatorApi } from './PixodeskSvgAnimator';


describe("PixodeskSvgAnimator (React)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        // Drain any pending requestAnimationFrame before uninstalling fake
        // timers — a rAF left pending at vi.useRealTimers() permanently breaks
        // rAF faking for all subsequent tests in the file (vitest/sinon/jsdom
        // quirk). Defensive: the engine cancels its own frames on
        // pause/finish/destroy, but a frame scheduled between the last
        // assertion and cleanup would still be in flight.
        vi.advanceTimersByTime(32);
        cleanup();
        vi.useRealTimers();
    });

    // -- 1. Rendering ---------------------------------------------------------

    describe("rendering", () => {
        it("renders the SVG tag tree with attributes", () => {
            const { container } = render(<PixodeskSvgAnimator doc={getTreeJson()} />);

            const svg = container.querySelector("svg");
            expect(svg).not.toBeNull();
            expect(svg?.getAttribute("viewBox")).toBe("0 0 400 400");
            expect(svg?.getAttribute("fill")).toBe("none");

            const ellipse = svg?.querySelector("ellipse");
            expect(ellipse).not.toBeNull();
            expect(ellipse?.parentElement).toBe(svg);
            expect(ellipse?.getAttribute("rx")).toBe("50");
            expect(ellipse?.getAttribute("fill")).toBe("#0087ff");
            expect(ellipse?.getAttribute("transform")).toBe("translate(200,100)");

            // Nested structure survives: svg > g > rect
            const rect = svg?.querySelector("g > rect");
            expect(rect).not.toBeNull();
            expect(rect?.getAttribute("width")).toBe("40");
            expect(rect?.getAttribute("height")).toBe("30");
        });

        it("renders text content — a leaf <text> and its <tspan> children carry `textContent`", () => {
            const { container } = render(<PixodeskSvgAnimator doc={getTextJson()} />);

            const [leaf, spans] = Array.from(container.querySelectorAll("svg > text"));
            expect(leaf?.textContent).toBe("Leaf");
            expect(spans?.querySelectorAll("tspan")).toHaveLength(2);
            expect(spans?.textContent).toBe("Hello World");
            // content, never an attribute
            expect(container.querySelector("[textcontent]")).toBeNull();
        });

        it("a node with child nodes renders its children, not its own `textContent` too", () => {
            const { container } = render(<PixodeskSvgAnimator doc={getTextJson()} />);

            // the line <tspan> carries BOTH its folded text and the styled child span
            expect(container.querySelector("tspan > tspan")?.parentElement?.textContent).toBe("Hi");
        });

        it("regenerates ids (rendered id differs from doc id)", () => {
            const doc = getTreeJson();
            const { container } = render(<PixodeskSvgAnimator doc={doc} />);

            const svg = container.querySelector("svg");
            const renderedRootId = svg?.getAttribute("id");
            expect(renderedRootId).toBeTruthy();
            expect(renderedRootId).not.toBe(doc.id);

            const ellipse = svg?.querySelector("ellipse");
            const renderedEllipseId = ellipse?.getAttribute("id");
            expect(renderedEllipseId).toBeTruthy();
            expect(renderedEllipseId).not.toBe((doc.children![0] as any).id);
        });

        it("applies a node's inline `style` — `display: none` hides the element, like the web player", () => {
            const doc: PxAnimatedSvgDocument = {
                type: 'svg', viewBox: '0 0 2880 1800',
                children: [
                    { type: 'ellipse', fill: '#ff0000', rx: 197.5, ry: 206.5 },
                    { type: 'ellipse', fill: '#007fff', rx: 200, ry: 202.5, style: { display: 'none' } },
                ],
            };
            const { container } = render(<PixodeskSvgAnimator doc={doc} />);

            const [visible, hidden] = Array.from(container.querySelectorAll("ellipse")) as Array<SVGElement>;
            expect(visible.style.display).toBe("");
            expect(hidden.style.display).toBe("none");
        });

        it("merges the root node's inline `style` with the component's `style` prop (the prop wins)", () => {
            const doc: PxAnimatedSvgDocument = { type: 'svg', viewBox: '0 0 100 100', style: { display: 'block', opacity: '0.5' }, children: [] };
            const { container } = render(<PixodeskSvgAnimator doc={doc} style={{ opacity: 1 }} />);

            const svg = container.querySelector("svg") as SVGSVGElement;
            expect(svg.style.display).toBe("block");
            expect(svg.style.opacity).toBe("1");
        });

        it("is static without control props (does not auto-play or auto-finish)", () => {
            const onPlay = vi.fn();
            const onFinish = vi.fn();
            render(<PixodeskSvgAnimator doc={getTestJson()} onPlay={onPlay} onFinish={onFinish} />);

            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toBe("translate(200,100)");

            vi.advanceTimersByTime(300); // well past the 128ms duration

            expect(ellipse?.getAttribute("transform")).toBe("translate(200,100)");
            expect(onPlay).not.toHaveBeenCalled();
            expect(onFinish).not.toHaveBeenCalled();
        });
    });

    // -- 2. Animation smoke ----------------------------------------------------

    describe("animation", () => {
        it("renders and animates with autoplay", () => {
            render(<PixodeskSvgAnimator doc={getTestJson()} autoplay />);

            const ellipse = document.querySelector("ellipse");
            expect(ellipse).not.toBeNull();
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,100)");

            // Trigger frame halfway through animation
            vi.advanceTimersByTime(64);
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");

            // Trigger frame end of animation
            vi.advanceTimersByTime(64);
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,200)");
        });
    });

    // -- 2b. Control-mode precedence (API review §1) ---------------------------

    describe("control-mode precedence", () => {
        it("autoplay still starts when an apiRef is passed — a handle is not a mode", () => {
            // The §1 bug: passing `apiRef` forced start:'none', so this
            // never moved on its own and `autoplay` was silently dead.
            const apiRef = createRef<ReactAnimatorApi>();
            render(<PixodeskSvgAnimator doc={getTestJson()} autoplay apiRef={apiRef} />);

            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,100)");

            vi.advanceTimersByTime(64);
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");

            // ...and the handle is still live in the same mode.
            expect(apiRef.current).not.toBeNull();
            expect(apiRef.current!.isPlaying()).toBe(true);
        });

        it("warns when two control tiers are set, naming both and the winner", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay />);

            const said = warn.mock.calls.map(c => c.map(String).join(" ")).join("\n");
            expect(said).toContain("PX" + PxDiagnosticCode.controlPropsConflict);
            expect(said).toContain("progress/time");
            expect(said).toContain("autoplay");
            expect(said).toContain("ignored");
            warn.mockRestore();
        });

        it("says nothing when only one tier is used", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
            render(<PixodeskSvgAnimator doc={getTestJson()} autoplay />);

            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        });
    });

    // -- 2b′. Declarative play / pause (API review §8) -------------------------

    describe("declarative play={false}", () => {
        it("HOLDS where it is — it no longer jumps to the end (review §8)", () => {
            const onPause = vi.fn();
            const onFinish = vi.fn();
            // ONE document object for both renders: a fresh one would change the `doc`
            // identity, remount the animator, and let a remount satisfy this by accident.
            const doc = getTestJson();
            const { rerender } = render(
                <PixodeskSvgAnimator doc={doc} play onPause={onPause} onFinish={onFinish} />);
            vi.advanceTimersByTime(32);

            rerender(<PixodeskSvgAnimator doc={doc} play={false} onPause={onPause} onFinish={onFinish} />);

            expect(onPause).toHaveBeenCalled();
            expect(onFinish).not.toHaveBeenCalled();   // this used to be finish()
        });
    });

    // -- 2c. The shared diagnostics channel (API review §5) --------------------

    describe("diagnostics channel", () => {
        it("onWarn takes over from the console — handing it over means owning it", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
            const onWarn = vi.fn();

            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay onWarn={onWarn} />);

            expect(onWarn).toHaveBeenCalled();
            const d = onWarn.mock.calls[0][0];
            expect(d.code).toBe(PxDiagnosticCode.controlPropsConflict);
            expect(String(d.data)).toContain("progress/time");
            // A conflict between two control props is the CALLER's to fix, not the file's.
            expect(d.kind).toBe("usage");
            // ...and the console said nothing, so nothing is reported twice.
            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        });

        it("falls back to the console when no handler is given", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });

            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay />);

            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });

        it("muteWarn switches the console fallback off", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });

            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay muteWarn />);

            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        });

        it("muteError does not touch warnings — the two switches are independent", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });

            // The control-mode conflict is a WARNING; muting errors leaves it audible.
            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay muteError />);
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
        });

        it("muteWarn is about the console, not about you — onWarn still fires", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
            const onWarn = vi.fn();

            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay muteWarn onWarn={onWarn} />);

            expect(onWarn).toHaveBeenCalled();
            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        });
    });

    // -- 3. Imperative API -----------------------------------------------------

    describe("imperative API (apiRef)", () => {
        it("exposes play/pause/setCurrentTime/getCurrentTime/setPlaybackRate/isPlaying", () => {
            const apiRef = createRef<ReactAnimatorApi>();
            render(<PixodeskSvgAnimator doc={getTestJson()} apiRef={apiRef} />);

            const api = apiRef.current;
            expect(api).not.toBeNull();

            // Not playing until told to
            expect(api!.isPlaying()).toBe(false);

            api!.play();
            expect(api!.isPlaying()).toBe(true);

            vi.advanceTimersByTime(32);
            api!.pause();
            expect(api!.isPlaying()).toBe(false);
            expect(api!.getCurrentTime()).toBe(32);

            // setCurrentTime / getCurrentTime round-trip
            api!.setCurrentTime(64);
            expect(api!.getCurrentTime()).toBe(64);
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");

            // setPlaybackRate exists and is callable
            expect(typeof api!.setPlaybackRate).toBe("function");
            expect(() => api!.setPlaybackRate(2)).not.toThrow();

            // cancel / finish are also exposed
            expect(typeof api!.cancel).toBe("function");
            expect(typeof api!.finish).toBe("function");
        });
    });

    // -- 4. Callbacks ----------------------------------------------------------

    describe("callbacks", () => {
        function renderWithCallbacks() {
            const apiRef = createRef<ReactAnimatorApi>();
            const spies = {
                onPlay: vi.fn(), onPause: vi.fn(), onCancel: vi.fn(),
                onFinish: vi.fn(), onRemove: vi.fn(), onStop: vi.fn(),
            };
            const utils = render(<PixodeskSvgAnimator doc={getTestJson()} apiRef={apiRef} {...spies} />);
            return { apiRef, spies, ...utils };
        }

        it("fires onPlay when playback starts", () => {
            const { apiRef, spies } = renderWithCallbacks();
            apiRef.current!.play();
            expect(spies.onPlay).toHaveBeenCalledTimes(1);
            expect(spies.onStop).not.toHaveBeenCalled();
        });

        it("fires onPause and onStop when paused", () => {
            const { apiRef, spies } = renderWithCallbacks();
            apiRef.current!.play();
            apiRef.current!.pause();
            expect(spies.onPause).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalledTimes(1);
        });

        it("fires onCancel and onStop when canceled", () => {
            const { apiRef, spies } = renderWithCallbacks();
            apiRef.current!.play();
            apiRef.current!.cancel();
            expect(spies.onCancel).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalledTimes(1);
        });

        it("fires onFinish and onStop when finished", () => {
            const { apiRef, spies } = renderWithCallbacks();
            apiRef.current!.play();
            apiRef.current!.finish();
            expect(spies.onFinish).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalledTimes(1);
        });

        it("fires onRemove and onStop on unmount", () => {
            const { spies, unmount } = renderWithCallbacks();
            expect(spies.onRemove).not.toHaveBeenCalled();
            unmount();
            expect(spies.onRemove).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalled();
        });
    });

    // -- 5. Controlled time ----------------------------------------------------

    describe("controlled time", () => {
        it("renders mid-animation state with time (absolute milliseconds)", () => {
            render(<PixodeskSvgAnimator doc={getTestJson1000()} time={500} />);
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });

        it("treats `progress` as a fraction of duration (progress=0.5, duration=1000 → 500ms)", () => {
            render(<PixodeskSvgAnimator doc={getTestJson1000()} progress={0.5} />);
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });

        it("does not advance on its own in fixed-time mode", () => {
            render(<PixodeskSvgAnimator doc={getTestJson1000()} time={500} />);
            const ellipse = document.querySelector("ellipse");
            vi.advanceTimersByTime(1000);
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });
    });

    // -- 6. className / style --------------------------------------------------

    describe("className / style", () => {
        it("merges className onto the root svg and applies style", () => {
            const { container } = render(
                <PixodeskSvgAnimator doc={getTestJson()} className="my-class" style={{ width: '123px' }} />
            );
            const svg = container.querySelector("svg");
            expect(svg).not.toBeNull();
            expect(svg?.classList.contains("my-class")).toBe(true);
            expect((svg as SVGSVGElement).style.width).toBe("123px");

            // className applied only to root, not to children
            expect(container.querySelector("ellipse")?.classList.contains("my-class")).toBe(false);
        });
    });

    // -- 8. Doc-change remount ---------------------------------------------------

    describe("doc change", () => {
        it("swaps to a new animator when the doc prop changes", () => {
            const { container, rerender } = render(<PixodeskSvgAnimator doc={getTestJson()} autoplay />);
            expect(container.querySelector("ellipse")).not.toBeNull();
            const firstRootId = container.querySelector("svg")?.getAttribute("id");

            rerender(<PixodeskSvgAnimator doc={getRectJson()} autoplay />);

            // Old content replaced by the new doc's content
            expect(container.querySelector("ellipse")).toBeNull();
            const rect = container.querySelector("rect");
            expect(rect).not.toBeNull();
            expect(container.querySelector("svg")?.getAttribute("id")).not.toBe(firstRootId);

            // The new animator drives the new content
            vi.advanceTimersByTime(128);
            expect(rect?.getAttribute("transform")).toMatch("translate(100,0)");
        });
    });

    // -- Playback override (`timeline` / shortcuts) -----------------------------

    describe("timeline override", () => {

        /** A WIRE-format document — nested `timeline`, the spelling every writer emits.
         *  The flat props this replaced were silently discarded on exactly this shape. */
        function wireJson(): PxAnimatedSvgDocument {
            return {
                type: "svg", id: "_px_wire", viewBox: "0 0 100 100",
                animator: {
                    timeline: { engine: "js", duration: 1000, trigger: { start: "load" } },
                },
                children: [{
                    type: "rect", id: "r1", opacity: 0,
                    animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
                }],
            } as PxAnimatedSvgDocument;
        }

        // The observable is the rendered attribute at a controlled time, the same way the
        // existing controlled-time tests assert. `progress` is a fraction of duration x
        // iterations, so an overridden duration lands the playhead somewhere else: at
        // progress 0.5 the document's own 1000ms seeks to 500ms (opacity half way), while a
        // 4000ms override seeks to 2000ms — past the last keyframe, so the value is held at 1.
        // This also proves the seek maths read the WIRE config: they used to read
        // `doc.animator.duration`, which is empty on a wire-format document.

        const opacityNow = () => Number(document.querySelector("rect")?.getAttribute("opacity"));

        it("baseline: progress=0.5 of the document's own 1000ms lands mid-animation", () => {
            render(<PixodeskSvgAnimator doc={wireJson()} progress={0.5} />);
            expect(opacityNow()).toBeCloseTo(0.5, 1);
        });

        it("timeline overrides duration ON A WIRE DOCUMENT (the flat props never did)", () => {
            render(<PixodeskSvgAnimator doc={wireJson()} progress={0.5} timeline={{ duration: 4000 }} />);
            expect(opacityNow()).toBe(1);
        });

        it("the duration SHORTCUT does the same thing", () => {
            render(<PixodeskSvgAnimator doc={wireJson()} progress={0.5} duration={4000} />);
            expect(opacityNow()).toBe(1);
        });

        it("accepts the JSON-string form of timeline", () => {
            render(<PixodeskSvgAnimator doc={wireJson()} progress={0.5} timeline={'{"duration":4000}'} />);
            expect(opacityNow()).toBe(1);
        });

        it("does not mutate the document the caller passed", () => {
            const doc = wireJson();
            const before = JSON.stringify(doc);
            render(<PixodeskSvgAnimator doc={doc} autoplay timeline={{ duration: 9999 }} />);
            expect(JSON.stringify(doc)).toBe(before);
        });
    });

    // -- 12. Effects ----------------------------------------------------------
    //
    // A document whose paint comes ONLY from `effects`: the root is `fill: none`, both shapes
    // take their fill from `effects.fillGradient`, and the ellipse is `effects.maskedBy` the
    // rect. The web player plays it. React rendered an EMPTY canvas, because it built its DOM
    // from the raw document — `effects` never became <radialGradient>/<mask> defs, so every
    // shape inherited `fill: none`. `createAnimator` did materialize, but only its own copy,
    // after React had already rendered.

    describe("effects", () => {
        it("renders the gradients and the mask that `effects` describe", () => {
            const svg = renderSvg(<PixodeskSvgAnimator doc={getEffectsOnlyJson()} />);

            expect(svg.querySelectorAll("radialGradient")).toHaveLength(2);
            expect(svg.querySelector("mask")).not.toBeNull();
            // No wire-format bucket may reach the DOM as an attribute.
            expect(svg.querySelector("[effects]")).toBeNull();
        });

        it("every url(#id) reference resolves to an element in the same svg", () => {
            const svg = renderSvg(<PixodeskSvgAnimator doc={getEffectsOnlyJson()} />);

            const refs = collectUrlRefs(svg);
            // The document is nothing BUT references — fill ×2 and mask — so an empty list
            // would mean the effects were dropped, not that they all resolved.
            expect(refs.length).toBeGreaterThanOrEqual(3);
            // Compared by id rather than via a `#id` selector: no escaping to get wrong (and jsdom
            // has no `CSS.escape`).
            const ownIds = new Set(Array.from(svg.querySelectorAll("[id]")).map(el => el.id));
            for (const id of refs) expect(ownIds.has(id), 'url(#' + id + ') resolves').toBe(true);
        });

        it("renders the same element structure as the web player", () => {
            // The web player is the reference: it plays this document. Whatever it renders,
            // the component must render too — that is the contract that was broken.
            const host = document.createElement("div");
            document.body.appendChild(host);
            // The document's own trigger is mouse-over, so it does not start — nothing to stop.
            const web = createAnimator({ doc: getEffectsOnlyJson(), container: host });
            const webSvg = host.querySelector("svg");
            expect(webSvg).not.toBeNull();

            const svg = renderSvg(<PixodeskSvgAnimator doc={getEffectsOnlyJson()} />);

            expect(tagCensus(svg)).toEqual(tagCensus(webSvg));
            web.destroy();
            host.remove();
        });

        it("the animation drives what React rendered — the ids line up after materializing", () => {
            // Every test above would stay green if the animator bound to NOTHING. This one proves
            // the ids it writes to are the ids React rendered: seeking must move something, and
            // the adapter must never report a write to an element it did not render.
            //
            // Each render is checked on its OWN, before its teardown: a spy shared across renders
            // also records whatever an unmounting instance writes on its way out, which says
            // nothing about whether the ids line up.
            const renderAt = (time: number) => {
                const onWarn = vi.fn();
                // Frames engine: the document sets none, so it would resolve to native (WAAPI),
                // which needs `CSS.supports` — jsdom has none, and the build would fail before
                // anything bound. Every other test in this file pins `js` for the same reason.
                const svg = renderSvg(<PixodeskSvgAnimator doc={getEffectsOnlyJson()} time={time} onWarn={onWarn} timeline={{ engine: "js" }} />);
                const transforms = Array.from(svg.querySelectorAll("[transform]"))
                    .map(el => el.getAttribute("transform")).join(" | ");
                const missed = onWarn.mock.calls.filter(([d]) => d.code === PxDiagnosticCode.setAttributeNoElement);
                cleanup();
                return { transforms, missed };
            };

            const start = renderAt(0);
            const mid = renderAt(200);

            expect(mid.transforms).not.toBe(start.transforms);
            expect(start.missed).toEqual([]);
            expect(mid.missed).toEqual([]);
        });

        it("two instances on one page do not share def ids", () => {
            // Materialization numbers its defs from zero, so two instances would both mint the
            // same gradient/mask ids — and `url(#…)` resolves document-wide, to the FIRST match.
            // The web player regenerates ids AFTER materializing; the component must too.
            const { container } = render(<>
                <PixodeskSvgAnimator doc={getEffectsOnlyJson()} />
                <PixodeskSvgAnimator doc={getEffectsOnlyJson()} />
            </>);

            const ids = Array.from(container.querySelectorAll("radialGradient, mask")).map(el => el.id);
            expect(ids).toHaveLength(6);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    // -- 13. A root with no id ------------------------------------------------
    //
    // Both engines find the root with `document.querySelector('#' + doc.id)`. A document whose
    // root `<svg>` has no id — i.e. most exported ones — therefore has NO root in the component
    // adapters, and `setupAnimationTriggers` returns before wiring anything (PX1201): a `load`
    // trigger never fires, so the animation sits on its first frame. The component rendered that
    // `<svg>` itself, so it hands the element over instead of the player guessing it by id.

    describe("root element", () => {
        it("a `load` trigger plays when the document's root has no id", () => {
            const onWarn = vi.fn();
            const { container } = render(
                <PixodeskSvgAnimator doc={getMaskedLoadJson()} autoplay onWarn={onWarn} timeline={{ engine: "js" }} />);

            // The only animated element is the ellipse INSIDE the mask.
            const moving = container.querySelector("mask ellipse");
            expect(moving).not.toBeNull();
            const before = moving?.getAttribute("transform");

            vi.advanceTimersByTime(200);

            expect(moving?.getAttribute("transform")).not.toBe(before);
            const noRoot = onWarn.mock.calls.filter(([d]) =>
                d.code === PxDiagnosticCode.triggersNoRoot || d.code === PxDiagnosticCode.noRootElement);
            expect(noRoot).toEqual([]);
        });
    });

    // -- 14. Attribute names --------------------------------------------------
    //
    // `toDomProps` hands over camelCase names and leaves the kebab conversion to the writer. The
    // web player's writer converts; React maps only the names IT knows, and `maskType` is not
    // one — so the mask went out as a literal `maskType="alpha"`, which SVG ignores, falling back
    // to LUMINANCE masking. Every name must reach the DOM in the form SVG reads.

    describe("attribute names", () => {
        it("`maskType` reaches the DOM as `mask-type`", () => {
            const svg = renderSvg(<PixodeskSvgAnimator doc={getMaskedLoadJson()} />);
            const mask = svg.querySelector("mask");

            expect(mask?.getAttribute("mask-type")).toBe("alpha");
            expect(Array.from(mask?.attributes ?? []).map(a => a.name)).not.toContain("maskType");
        });

        it("`maskType` from an effect reaches the DOM as `mask-type` too", () => {
            // The effects document: `maskedBy.maskType` is written onto the materialized mask.
            const mask = renderSvg(<PixodeskSvgAnimator doc={getEffectsOnlyJson()} />).querySelector("mask");
            expect(mask?.getAttribute("mask-type")).toBe("alpha");
        });

        it("every SVG presentation attribute reaches the DOM under the name the web player uses", () => {
            // THE guard for this class of bug, and why `REACT_UNMAPPED_SVG_ATTRS` is a list rather
            // than a guess: every SVG 2 presentation attribute, through React AND the web player,
            // compared by name. React maps most camelCase names itself; any it does not, it writes
            // verbatim — and SVG ignores the camelCase form. (A console spy cannot do this job:
            // React reports an unknown prop only ONCE per name per session.)
            // `PxNode` carries an index signature for DOM attributes, so the loop below is typed.
            const rect: PxNode = { type: "rect", id: "r", width: 5, height: 5 };
            // Three groups, all compared against the web player:
            //  - every SVG 2 presentation attribute;
            //  - every name the component camelCases for React (its allowlist must be TRUE);
            //  - names React has no mapping for, real and invented — they must pass verbatim.
            const names = new Set([...SVG_PRESENTATION_ATTRIBUTES, ...REACT_CAMEL_CASED_SVG_ATTRS, ...NAMES_REACT_DOES_NOT_MAP]);
            for (const kebab of names) {
                // Reference attributes need a real local reference, or the web writer drops them
                // as unsafe and the two renders differ for a reason that is not the name.
                rect[kebabToCamel(kebab)] = REFERENCE_ATTRIBUTES.has(kebab) ? "url(#r)" : "1";
            }
            const doc: PxAnimatedSvgDocument = { type: "svg", viewBox: "0 0 10 10", animator: { timeline: { duration: 100, engine: "js" } }, children: [rect] };

            const host = document.createElement("div");
            document.body.appendChild(host);
            const web = createAnimator({ doc, container: host });
            const webNames = attributeNames(host.querySelector("rect"));

            const error = vi.spyOn(console, "error").mockImplementation(() => { });
            const reactNames = attributeNames(renderSvg(<PixodeskSvgAnimator doc={doc} />).querySelector("rect"));
            error.mockRestore();

            expect(reactNames).toEqual(webNames);
            web.destroy();
            host.remove();
        });

        it("names React maps itself keep working — no kebab warnings, still correct in the DOM", () => {
            // The other half of the contract: converting EVERYTHING to kebab would put
            // `stroke-width` in front of React, which warns "did you mean strokeWidth" for each.
            const error = vi.spyOn(console, "error").mockImplementation(() => { });
            const svg = renderSvg(<PixodeskSvgAnimator doc={getEffectsOnlyJson()} />);

            expect(svg.querySelector("stop")?.getAttribute("stop-color")).toBeTruthy();
            expect(svg.querySelector("radialGradient")?.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
            expect(error.mock.calls.filter(args => String(args[0]).includes("Invalid DOM property"))).toEqual([]);
            error.mockRestore();
        });
    });

});


/** Renders and returns the root `<svg>`, failing the test if there is none. */
function renderSvg(ui: React.ReactElement): SVGSVGElement {
    const svg = render(ui).container.querySelector("svg");
    if (!svg) throw new Error("no <svg> rendered");
    return svg;
}

/** Every id referenced as `url(#id)` from any attribute inside `root`. */
function collectUrlRefs(root: Element): Array<string> {
    const ids: Array<string> = [];
    for (const el of Array.from(root.querySelectorAll("*"))) {
        for (const attr of Array.from(el.attributes)) {
            for (const m of attr.value.matchAll(/url\(#([^)]+)\)/g)) ids.push(m[1]);
        }
    }
    return ids;
}

/** SVG 2 presentation attributes — the spec's list, kebab-case as SVG reads them. */
const SVG_PRESENTATION_ATTRIBUTES: ReadonlyArray<string> = ("alignment-baseline baseline-shift clip clip-path clip-rule "
    + "color color-interpolation color-interpolation-filters color-rendering cursor direction display "
    + "dominant-baseline fill fill-opacity fill-rule filter flood-color flood-opacity font-family font-size "
    + "font-size-adjust font-stretch font-style font-variant font-weight image-rendering letter-spacing "
    + "lighting-color marker-end marker-mid marker-start mask mask-type opacity overflow paint-order "
    + "pointer-events shape-rendering stop-color stop-opacity stroke stroke-dasharray stroke-dashoffset "
    + "stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor "
    + "text-decoration text-rendering transform-origin unicode-bidi vector-effect visibility word-spacing "
    + "writing-mode").split(" ");

/** Names React has NO camelCase mapping for. `mask-type` and `offset-distance` both reached the
 *  DOM camelCased (and so dead) before; `x-future-attr` stands in for any name nobody listed. */
const NAMES_REACT_DOES_NOT_MAP: ReadonlyArray<string> = ["mask-type", "offset-distance", "x-future-attr", "data-px-label"];

/** The presentation attributes whose value is a `url(#…)` reference. */
const REFERENCE_ATTRIBUTES = new Set(["clip-path", "filter", "marker-end", "marker-mid", "marker-start", "mask"]);

/** `stroke-width` → `strokeWidth` — the wire's spelling. */
function kebabToCamel(kebab: string): string {
    return kebab.replace(/-([a-z])/g, (_all, c: string) => c.toUpperCase());
}

/** Attribute names on one element, sorted, so two renders compare as a set. */
function attributeNames(el: Element | null): Array<string> {
    return el ? Array.from(el.attributes).map(a => a.name).sort() : [];
}

/** Tag name → count, so two renders can be compared without depending on generated ids. */
function tagCensus(root: Element | null): Record<string, number> {
    const census: Record<string, number> = {};
    if (!root) return census;
    for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
        const tag = el.tagName.toLowerCase();
        census[tag] = (census[tag] ?? 0) + 1;
    }
    return census;
}


////////////////////////////////////////////////////////////////

/** Frames-mode doc: single ellipse, translate 100 → 200 over 128ms. */
function getTestJson(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        id: "_px_2p4d44pl",
        fill: "none",
        viewBox: "0 0 400 400",

        animator: {
            definitions: { animations: { a0: {
                translate: {
                    keyframes: [
                        { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                        { time: 128, value: [200, 200] }
                    ]
                }
            } } },
            bindings: [{ target: '#_px_2pp00tnc', animateWith: ['a0'] }],
            timeline: {
                engine: "js",
                duration: 128,
                fillMode: "forwards",
                direction: "normal",
                trigger: { start: "load" },
            },
        },

        children: [
            {
                type: "ellipse",
                id: "_px_2pp00tnc",
                fill: "#0087ff",
                stroke: "#ffffff",
                transform: "translate(200,100)",
                rx: "50",
                ry: "50"
            }
        ]
    };
}

/** Same as getTestJson but with duration 1000ms (for progress / time semantics). */
function getTestJson1000(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        id: "_px_2p4d44pl",
        fill: "none",
        viewBox: "0 0 400 400",

        animator: {
            definitions: { animations: { a0: {
                translate: {
                    keyframes: [
                        { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                        { time: 1000, value: [200, 200] }
                    ]
                }
            } } },
            bindings: [{ target: '#_px_2pp00tnc', animateWith: ['a0'] }],
            timeline: {
                engine: "js",
                duration: 1000,
                fillMode: "forwards",
                direction: "normal",
                trigger: { start: "load" },
            },
        },

        children: [
            {
                type: "ellipse",
                id: "_px_2pp00tnc",
                fill: "#0087ff",
                stroke: "#ffffff",
                transform: "translate(200,100)",
                rx: "50",
                ry: "50"
            }
        ]
    };
}

/** Doc with text: a leaf <text>, a <text> with two <tspan>s, and a line <tspan> carrying BOTH its
 *  folded text and a styled child span (the shape the editor writes for a one-span line). */
function getTextJson(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        viewBox: "0 0 200 150",
        children: [
            { type: "text", id: "leaf", x: 10, y: 20, textContent: "Leaf" },
            {
                type: "text", id: "spans", x: 10, y: 60,
                children: [
                    { type: "tspan", id: "s1", textContent: "Hello " },
                    { type: "tspan", id: "s2", textContent: "World" },
                ],
            },
            {
                type: "text", id: "lineText", x: 10, y: 100,
                children: [{
                    type: "tspan", id: "line", textContent: "Hi",
                    children: [{ type: "tspan", id: "span", fill: "#ff0000", textContent: "Hi" }],
                }],
            },
        ],
    };
}

/** Doc with a few children (ellipse + g > rect) for tag-tree rendering tests. */
function getTreeJson(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        id: "_px_root_tree",
        fill: "none",
        viewBox: "0 0 400 400",

        animator: {
            definitions: { animations: { a0: {
                translate: {
                    keyframes: [
                        { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                        { time: 128, value: [200, 200] }
                    ]
                }
            } } },
            bindings: [{ target: '#_px_tree_ell', animateWith: ['a0'] }],
            timeline: {
                engine: "js",
                duration: 128,
                fillMode: "forwards",
                direction: "normal",
                trigger: { start: "load" },
            },
        },

        children: [
            {
                type: "ellipse",
                id: "_px_tree_ell",
                fill: "#0087ff",
                stroke: "#ffffff",
                transform: "translate(200,100)",
                rx: "50",
                ry: "50"
            },
            {
                type: "g",
                id: "_px_tree_grp",
                children: [
                    {
                        type: "rect",
                        id: "_px_tree_rect",
                        x: "10",
                        y: "20",
                        width: "40",
                        height: "30",
                        fill: "#ff0000"
                    }
                ]
            }
        ]
    };
}

/** A different doc (animated rect) used to exercise doc-swap remounting. */
function getRectJson(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        id: "_px_root_b",
        fill: "none",
        viewBox: "0 0 400 400",

        animator: {
            definitions: { animations: { a0: {
                translate: {
                    keyframes: [
                        { time: 0, value: [0, 0], easing: [0.167, 0.167, 0.833, 0.833] },
                        { time: 128, value: [100, 0] }
                    ]
                }
            } } },
            bindings: [{ target: '#_px_rect_b', animateWith: ['a0'] }],
            timeline: {
                engine: "js",
                duration: 128,
                fillMode: "forwards",
                direction: "normal",
                trigger: { start: "load" },
            },
        },

        children: [
            {
                type: "rect",
                id: "_px_rect_b",
                x: "50",
                y: "50",
                width: "40",
                height: "40",
                fill: "#00ff00",
                transform: "translate(0,0)"
            }
        ]
    };
}


/**
 * Paint from `effects` ONLY — reported as an empty canvas in React and Vue while the web player
 * played it. Root `fill: none`; both shapes filled by `effects.fillGradient` (radial); the
 * ellipse `effects.maskedBy` the rect (alpha); a mouse-over trigger with a looping transform.
 */
function getEffectsOnlyJson(): PxAnimatedSvgDocument {
    return {
        type: "svg", fill: "none", preserveAspectRatio: "xMaxYMax ", viewBox: "0 0 500 500",
        animator: {
            timeline: {
                duration: 1000,
                trigger: { start: "mouseOver", offScreen: "pause", mouseOut: "pause", visibilityThreshold: 0.5, visibilityDebounce: 150 },
                iterations: "infinite", direction: "normal",
            },
            version: "1.2.1",
        },
        children: [
            {
                type: "rect", id: "_px_3dcddatp", height: 20.3448, width: 20.3448, stroke: "none",
                transform: {
                    translate: [301.23767450628105, 301.23767450628105],
                    scale: [10.142570505804876, 10.142570505804876],
                    origin: [10.17242035308442, 10.17242035308442],
                },
                effects: {
                    fillGradient: {
                        type: "radial",
                        center: [13.029971325206432, 7.091795735321082], focal: [13.029971325206432, 7.091795735321082],
                        radius: 10.17242035308442,
                        stops: [{ offset: 0, color: "#ffffff" }, { offset: 1, color: "#007fff" }],
                        gradientUnits: "userSpaceOnUse",
                    },
                },
            },
            {
                type: "ellipse", rx: 12.1094, ry: 12.1094, stroke: "none",
                transform: { translate: [208.2356, 208.2356], scale: [10.1426, 10.1426] },
                animate: {
                    transform: {
                        keyframes: [
                            { time: 0,   value: { translate: [208.2356, 208.2356], scale: [10.1426, 10.1426] } },
                            { time: 200, value: { translate: [414.5846, 208.2356], scale: [10.1426, 10.1426] } },
                            { time: 400, value: { translate: [414.5846, 414.5846], scale: [10.1426, 10.1426] }, easing: [0.1818, 0.1818, 0.5648, 0.5648] },
                            { time: 468, value: { translate: [344.4277, 414.5846], scale: [10.1426, 10.1426] }, easing: [0.3814, 0.3814, 0.8406, 0.8406] },
                            { time: 600, value: { translate: [208.2356, 414.5846], scale: [10.1426, 10.1426] } },
                            { time: 800, value: { translate: [208.2356, 208.2356], scale: [10.1426, 10.1426] } },
                        ],
                    },
                },
                effects: {
                    fillGradient: {
                        type: "radial", center: [0, 0], focal: [0, 0], radius: 12.109375,
                        stops: [{ offset: 0, color: "#00f76c" }, { offset: 1, color: "#ff00ff" }],
                        gradientUnits: "userSpaceOnUse",
                    },
                    maskedBy: { source: "#_px_3dcddatp", maskType: "alpha" },
                },
            },
        ],
    };
}


/**
 * A MASK document with a `load` trigger — reported as a static dark quarter-circle in React and
 * Vue. Two faults at once: the root has no id, so the trigger never fired (static); and
 * `maskType: "alpha"` reached the DOM as camelCase, so the mask fell back to luminance and the
 * magenta mask ellipse let only ~28% of the blue rect through (dark). The ellipse starts at the
 * rect's corner, so a quarter of it overlaps (quarter-circle).
 */
function getMaskedLoadJson(): PxAnimatedSvgDocument {
    return {
        type: "svg", fill: "none", preserveAspectRatio: "xMaxYMax ", viewBox: "0 0 500 500",
        animator: {
            timeline: {
                duration: 1000,
                trigger: { start: "load", offScreen: "pause", visibilityThreshold: 0.5, visibilityDebounce: 150 },
                iterations: "infinite", direction: "normal",
            },
            version: "1.2.1",
        },
        children: [
            {
                type: "defs",
                children: [{
                    type: "mask", id: "_px_3dcb6iqr", maskType: "alpha",
                    children: [{
                        type: "ellipse", fill: "#ff00ff", rx: 12.1094, ry: 12.1094, stroke: "none",
                        transform: { translate: [0, 0] },
                        animate: {
                            transform: {
                                keyframes: [
                                    { time: 0,   value: { translate: [0, 0] } },
                                    { time: 200, value: { translate: [20.3448, 0] } },
                                    { time: 400, value: { translate: [20.3448, 20.3448] }, easing: [0.1818, 0.1818, 0.5648, 0.5648] },
                                    { time: 468, value: { translate: [13.4278, 20.3448] }, easing: [0.3814, 0.3814, 0.8406, 0.8406] },
                                    { time: 600, value: { translate: [0, 20.3448] } },
                                    { time: 800, value: { translate: [0, 0] } },
                                ],
                            },
                        },
                    }],
                }],
            },
            {
                type: "rect", fill: "#007fff", height: 20.3448, width: 20.3448, mask: "url(#_px_3dcb6iqr)", stroke: "none",
                transform: {
                    translate: [301.23767450628105, 301.23767450628105],
                    scale: [10.142570505804876, 10.142570505804876],
                    origin: [10.17242035308442, 10.17242035308442],
                },
            },
        ],
    };
}
