/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PixodeskSvgAnimator, { ReactAnimatorApi } from './PixodeskSvgAnimator';


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
            // The §1 bug: passing `apiRef` forced startOn:'programmatic', so this
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

            const said = warn.mock.calls.map(c => String(c[0])).join("\n");
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

    // -- 2c. The shared diagnostics channel (API review §5) --------------------

    describe("diagnostics channel", () => {
        it("onWarn takes over from the console — handing it over means owning it", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
            const onWarn = vi.fn();

            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay onWarn={onWarn} />);

            expect(onWarn).toHaveBeenCalled();
            expect(String(onWarn.mock.calls[0][0])).toContain("progress/time");
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

        it("silent suppresses the console fallback", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });

            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay silent />);

            expect(warn).not.toHaveBeenCalled();
            warn.mockRestore();
        });

        it("silent is not a mute button — onWarn still fires", () => {
            const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
            const onWarn = vi.fn();

            render(<PixodeskSvgAnimator doc={getTestJson()} progress={0.5} autoplay silent onWarn={onWarn} />);

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

        it("fires onCancel and onStop when cancelled", () => {
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

    // -- Playback override (`config` / shortcuts) -----------------------------

    describe("config override", () => {

        /** A WIRE-format document — nested `timeline`, the spelling every writer emits.
         *  The flat props this replaced were silently discarded on exactly this shape. */
        function wireJson(): PxAnimatedSvgDocument {
            return {
                type: "svg", id: "_px_wire", viewBox: "0 0 100 100",
                animator: {
                    timeline: { engine: "js", duration: 1000, trigger: { startOn: "load" } },
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

        it("config overrides duration ON A WIRE DOCUMENT (the flat props never did)", () => {
            render(<PixodeskSvgAnimator doc={wireJson()} progress={0.5} config={{ timeline: { duration: 4000 } }} />);
            expect(opacityNow()).toBe(1);
        });

        it("the duration SHORTCUT does the same thing", () => {
            render(<PixodeskSvgAnimator doc={wireJson()} progress={0.5} duration={4000} />);
            expect(opacityNow()).toBe(1);
        });

        it("accepts the JSON-string form of config", () => {
            render(<PixodeskSvgAnimator doc={wireJson()} progress={0.5} config={'{"timeline":{"duration":4000}}'} />);
            expect(opacityNow()).toBe(1);
        });

        it("does not mutate the document the caller passed", () => {
            const doc = wireJson();
            const before = JSON.stringify(doc);
            render(<PixodeskSvgAnimator doc={doc} autoplay config={{ timeline: { duration: 9999 } }} />);
            expect(JSON.stringify(doc)).toBe(before);
        });
    });

});


////////////////////////////////////////////////////////////////

/** Frames-mode doc: single ellipse, translate 100 → 200 over 128ms. */
function getTestJson(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        id: "_px_2p4d44pl",
        fill: "none",
        viewBox: "0 0 400 400",

        animator: {
            animateById: {
                '_px_2pp00tnc': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [200, 200] }
                        ]
                    }
                }
            },
            timeline: {
                engine: "js",
                duration: 128,
                fillMode: "forwards",
                direction: "normal",
                trigger: { startOn: "load" },
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
            animateById: {
                '_px_2pp00tnc': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 1000, value: [200, 200] }
                        ]
                    }
                }
            },
            timeline: {
                engine: "js",
                duration: 1000,
                fillMode: "forwards",
                direction: "normal",
                trigger: { startOn: "load" },
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
            animateById: {
                '_px_tree_ell': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [200, 200] }
                        ]
                    }
                }
            },
            timeline: {
                engine: "js",
                duration: 128,
                fillMode: "forwards",
                direction: "normal",
                trigger: { startOn: "load" },
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
            animateById: {
                '_px_rect_b': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [0, 0], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [100, 0] }
                        ]
                    }
                }
            },
            timeline: {
                engine: "js",
                duration: 128,
                fillMode: "forwards",
                direction: "normal",
                trigger: { startOn: "load" },
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
