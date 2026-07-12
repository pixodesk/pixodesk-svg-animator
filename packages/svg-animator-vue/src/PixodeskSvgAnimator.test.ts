/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import { cleanup, render } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import PixodeskSvgAnimator, { type VueAnimatorApi } from './PixodeskSvgAnimator';


/**
 * Renders the animator inside a small host component so the test can grab the
 * exposed imperative API through a template ref, and optionally listen to
 * emitted events via `onX` listener props. The host forwards its `doc` prop so
 * `rerender({ doc })` reaches the animator.
 */
function renderWithApi(doc: PxAnimatedSvgDocument, listeners: Record<string, (...args: any[]) => void> = {}) {
    const api = ref<VueAnimatorApi | null>(null);
    const utils = render(defineComponent({
        props: { doc: { type: Object, required: true } },
        setup(props) {
            return () => h(PixodeskSvgAnimator, { doc: props.doc as PxAnimatedSvgDocument, ref: api as any, ...listeners });
        },
    }), {
        props: { doc },
    });
    return { api, ...utils };
}

describe("PixodeskSvgAnimator (Vue)", () => {
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
            const { container } = render(PixodeskSvgAnimator, {
                props: { doc: getTreeJson() },
            });

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

        it("regenerates ids (rendered id differs from doc id)", () => {
            const doc = getTreeJson();
            const { container } = render(PixodeskSvgAnimator, { props: { doc } });

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
            renderWithApi(getTestJson(), { onPlay, onFinish });

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
            render(PixodeskSvgAnimator, {
                props: { doc: getTestJson(), autoplay: true },
            });

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

    // -- 3. Imperative API (template ref / expose) ------------------------------

    describe("imperative API (template ref)", () => {
        it("exposes play/pause/setCurrentTime/getCurrentTime/setPlaybackRate/isPlaying", () => {
            const { api } = renderWithApi(getTestJson());

            expect(api.value).not.toBeNull();

            // Not playing until told to
            expect(api.value!.isPlaying()).toBe(false);

            api.value!.play();
            expect(api.value!.isPlaying()).toBe(true);

            vi.advanceTimersByTime(32);
            api.value!.pause();
            expect(api.value!.isPlaying()).toBe(false);
            expect(api.value!.getCurrentTime()).toBe(32);

            // setCurrentTime / getCurrentTime round-trip
            api.value!.setCurrentTime(64);
            expect(api.value!.getCurrentTime()).toBe(64);
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");

            // setPlaybackRate exists and is callable
            expect(typeof api.value!.setPlaybackRate).toBe("function");
            expect(() => api.value!.setPlaybackRate(2)).not.toThrow();

            // cancel / finish are also exposed
            expect(typeof api.value!.cancel).toBe("function");
            expect(typeof api.value!.finish).toBe("function");
        });
    });

    // -- 4. Events ---------------------------------------------------------------

    describe("events", () => {
        function renderWithListeners() {
            const spies = {
                onPlay: vi.fn(), onPause: vi.fn(), onCancel: vi.fn(),
                onFinish: vi.fn(), onRemove: vi.fn(), onStop: vi.fn(),
            };
            const utils = renderWithApi(getTestJson(), spies);
            return { spies, ...utils };
        }

        it("emits 'play' when playback starts", () => {
            const { api, spies } = renderWithListeners();
            api.value!.play();
            expect(spies.onPlay).toHaveBeenCalledTimes(1);
            expect(spies.onStop).not.toHaveBeenCalled();
        });

        it("emits 'pause' and 'stop' when paused", () => {
            const { api, spies } = renderWithListeners();
            api.value!.play();
            api.value!.pause();
            expect(spies.onPause).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalledTimes(1);
        });

        it("emits 'cancel' and 'stop' when cancelled", () => {
            const { api, spies } = renderWithListeners();
            api.value!.play();
            api.value!.cancel();
            expect(spies.onCancel).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalledTimes(1);
        });

        it("emits 'finish' and 'stop' when finished", () => {
            const { api, spies } = renderWithListeners();
            api.value!.play();
            api.value!.finish();
            expect(spies.onFinish).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalledTimes(1);
        });

        it("emits 'remove' and 'stop' on unmount", () => {
            const { spies, unmount } = renderWithListeners();
            expect(spies.onRemove).not.toHaveBeenCalled();
            unmount();
            expect(spies.onRemove).toHaveBeenCalledTimes(1);
            expect(spies.onStop).toHaveBeenCalled();
        });
    });

    // -- 5. Controlled time ----------------------------------------------------

    describe("controlled time", () => {
        it("renders mid-animation state with timeMs (absolute milliseconds)", () => {
            render(PixodeskSvgAnimator, {
                props: { doc: getTestJson1000(), timeMs: 500 },
            });
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });

        it("treats `time` as a fraction of duration (time=0.5, duration=1000 → 500ms)", () => {
            render(PixodeskSvgAnimator, {
                props: { doc: getTestJson1000(), time: 0.5 },
            });
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });

        it("does not advance on its own in fixed-time mode", () => {
            render(PixodeskSvgAnimator, {
                props: { doc: getTestJson1000(), timeMs: 500 },
            });
            const ellipse = document.querySelector("ellipse");
            vi.advanceTimersByTime(1000);
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });
    });

    // -- 6. Attribute fallthrough (class / style) --------------------------------

    describe("attrs fallthrough", () => {
        it("passes class and style through to the root svg", () => {
            const { container } = render(PixodeskSvgAnimator, {
                props: { doc: getTestJson() },
                attrs: { class: 'my-class', style: 'width: 123px;' },
            });
            const svg = container.querySelector("svg");
            expect(svg).not.toBeNull();
            expect(svg?.classList.contains("my-class")).toBe(true);
            expect((svg as SVGSVGElement).style.width).toBe("123px");

            // class lands only on the root, not on children
            expect(container.querySelector("ellipse")?.classList.contains("my-class")).toBe(false);
        });
    });

    // -- 8. Doc-change remount ---------------------------------------------------

    describe("doc change", () => {
        it("swaps to a new animator when the doc prop changes", async () => {
            const { api, container, rerender } = renderWithApi(getTestJson());
            expect(container.querySelector("ellipse")).not.toBeNull();
            const firstRootId = container.querySelector("svg")?.getAttribute("id");
            const firstApi = api.value;

            await rerender({ doc: getRectJson() });

            // Old content replaced by the new doc's content
            expect(container.querySelector("ellipse")).toBeNull();
            const rect = container.querySelector("rect");
            expect(rect).not.toBeNull();
            expect(container.querySelector("svg")?.getAttribute("id")).not.toBe(firstRootId);

            // The animator is recreated with `flush: 'post'` (after the DOM is
            // patched) so the new root element is found and triggers re-attach.
            // Drive the swapped animator imperatively to prove the swap happened:
            api.value!.play();
            vi.advanceTimersByTime(128);
            expect(rect?.getAttribute("transform")).toMatch("translate(100,0)");

            // The exposed API is backed by the new animator instance state
            // (finished, not the old animator's idle state).
            expect(api.value!.getCurrentTime()).toBe(128);
            expect(firstApi!.isPlaying()).toBe(false);
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
            mode: "frames",
            duration: 128,
            fill: "forwards",
            direction: "normal",
            trigger: { startOn: "load" },
            animate: {
                '_px_2pp00tnc': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [200, 200] }
                        ]
                    }
                }
            }
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

/** Same as getTestJson but with duration 1000ms (for time / timeMs semantics). */
function getTestJson1000(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        id: "_px_2p4d44pl",
        fill: "none",
        viewBox: "0 0 400 400",

        animator: {
            mode: "frames",
            duration: 1000,
            fill: "forwards",
            direction: "normal",
            trigger: { startOn: "load" },
            animate: {
                '_px_2pp00tnc': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 1000, value: [200, 200] }
                        ]
                    }
                }
            }
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

/** Doc with a few children (ellipse + g > rect) for tag-tree rendering tests. */
function getTreeJson(): PxAnimatedSvgDocument {
    return {
        type: "svg",
        id: "_px_root_tree",
        fill: "none",
        viewBox: "0 0 400 400",

        animator: {
            mode: "frames",
            duration: 128,
            fill: "forwards",
            direction: "normal",
            trigger: { startOn: "load" },
            animate: {
                '_px_tree_ell': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [200, 200] }
                        ]
                    }
                }
            }
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
            mode: "frames",
            duration: 128,
            fill: "forwards",
            direction: "normal",
            trigger: { startOn: "load" },
            animate: {
                '_px_rect_b': {
                    translate: {
                        keyframes: [
                            { time: 0, value: [0, 0], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [100, 0] }
                        ]
                    }
                }
            }
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
