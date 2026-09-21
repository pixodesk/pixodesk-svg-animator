/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { createAnimator, PxAnimatedSvgDocument, type PxNode } from '@pixodesk/svg-animator-web';
import { PxDiagnosticCode } from '@pixodesk/svg-animator-core';
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

        it("renders text content — a leaf <text> and its <tspan> children carry `textContent`", () => {
            const { container } = render(PixodeskSvgAnimator, { props: { doc: getTextJson() } });

            const [leaf, spans] = Array.from(container.querySelectorAll("svg > text"));
            expect(leaf?.textContent).toBe("Leaf");
            expect(spans?.querySelectorAll("tspan")).toHaveLength(2);
            expect(spans?.textContent).toBe("Hello World");
            // content, never an attribute
            expect(container.querySelector("[textcontent]")).toBeNull();
        });

        it("a node with child nodes renders its children, not its own `textContent` too", () => {
            const { container } = render(PixodeskSvgAnimator, { props: { doc: getTextJson() } });

            // the line <tspan> carries BOTH its folded text and the styled child span
            expect(container.querySelector("tspan > tspan")?.parentElement?.textContent).toBe("Hi");
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

        it("applies a node's inline `style` — `display: none` hides the element, like the web player", () => {
            const doc: PxAnimatedSvgDocument = {
                type: 'svg', viewBox: '0 0 2880 1800',
                children: [
                    { type: 'ellipse', fill: '#ff0000', rx: 197.5, ry: 206.5 },
                    { type: 'ellipse', fill: '#007fff', rx: 200, ry: 202.5, style: { display: 'none' } },
                ],
            };
            const { container } = render(PixodeskSvgAnimator, { props: { doc } });

            const [visible, hidden] = Array.from(container.querySelectorAll("ellipse")) as Array<SVGElement>;
            expect(visible.style.display).toBe("");
            expect(hidden.style.display).toBe("none");
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

        it("emits 'cancel' and 'stop' when canceled", () => {
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
        it("renders mid-animation state with time (absolute milliseconds)", () => {
            render(PixodeskSvgAnimator, {
                props: { doc: getTestJson1000(), time: 500 },
            });
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });

        it("treats `progress` as a fraction of duration (progress=0.5, duration=1000 → 500ms)", () => {
            render(PixodeskSvgAnimator, {
                props: { doc: getTestJson1000(), progress: 0.5 },
            });
            const ellipse = document.querySelector("ellipse");
            expect(ellipse?.getAttribute("transform")).toMatch("translate(200,150)");
        });

        it("does not advance on its own in fixed-time mode", () => {
            render(PixodeskSvgAnimator, {
                props: { doc: getTestJson1000(), time: 500 },
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


// A document whose paint comes ONLY from `effects`: the root is `fill: none`, both shapes take
// their fill from `effects.fillGradient`, and the ellipse is `effects.maskedBy` the rect. The web
// player plays it. Vue rendered an EMPTY canvas, because it built its vnodes from the raw
// document — `effects` never became <radialGradient>/<mask> defs, so every shape inherited
// `fill: none`. `createAnimator` did materialize, but only its own copy, after Vue had rendered.
describe("PixodeskSvgAnimator (Vue) — effects", () => {
    afterEach(() => cleanup());

    it("renders the gradients and the mask that `effects` describe", () => {
        const svg = renderSvg(getEffectsOnlyJson());

        expect(svg.querySelectorAll("radialGradient")).toHaveLength(2);
        expect(svg.querySelector("mask")).not.toBeNull();
        expect(svg.querySelector("[effects]")).toBeNull();
    });

    it("every url(#id) reference resolves to an element in the same svg", () => {
        const svg = renderSvg(getEffectsOnlyJson());

        const refs = collectUrlRefs(svg);
        // Nothing BUT references (fill x2, mask) — an empty list means the effects were dropped.
        expect(refs.length).toBeGreaterThanOrEqual(3);
        const ownIds = new Set(Array.from(svg.querySelectorAll("[id]")).map(el => el.id));
        for (const id of refs) expect(ownIds.has(id), 'url(#' + id + ') resolves').toBe(true);
    });

    it("renders the same element structure as the web player", () => {
        // The web player is the reference: it plays this document.
        const host = document.createElement("div");
        document.body.appendChild(host);
        const web = createAnimator({ doc: getEffectsOnlyJson(), container: host });
        const webSvg = host.querySelector("svg");
        expect(webSvg).not.toBeNull();

        const svg = renderSvg(getEffectsOnlyJson());

        expect(tagCensus(svg)).toEqual(tagCensus(webSvg));
        web.destroy();
        host.remove();
    });

    it("two instances on one page do not share def ids", () => {
        // Materialization numbers its defs from zero; ids must be regenerated AFTER it, as the
        // web player does, or two instances mint the same `url(#…)` targets.
        const a = render(PixodeskSvgAnimator, { props: { doc: getEffectsOnlyJson() } });
        const b = render(PixodeskSvgAnimator, { props: { doc: getEffectsOnlyJson() } });

        const ids = [a.container, b.container].flatMap(c =>
            Array.from(c.querySelectorAll("radialGradient, mask")).map(el => el.id));
        expect(ids).toHaveLength(6);
        expect(new Set(ids).size).toBe(ids.length);
    });
});


// Both engines find the root as `#` + the document's root id, so a document whose root `<svg>`
// has no id had NO root here, and `setupAnimationTriggers` returned before wiring anything
// (PX1201): a `load` trigger never fired. The component now hands over the `<svg>` it rendered.
describe("PixodeskSvgAnimator (Vue) — root element", () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        vi.advanceTimersByTime(32); // drain a pending rAF before real timers come back
        cleanup();
        vi.useRealTimers();
    });

    it("a `load` trigger plays when the document's root has no id", () => {
        const onWarn = vi.fn();
        const { container } = render(PixodeskSvgAnimator, {
            props: { doc: getMaskedLoadJson(), autoplay: true, onWarn, timeline: { engine: "js" } },
        });

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

// Vue has no camelCase-to-attribute mapping at all, so it wrote EVERY camelCase name verbatim —
// `stopColor`, `strokeWidth`, `fillOpacity`, `maskType` — and SVG ignores that form: gradients
// lost their colours, strokes their widths, masks their `alpha` mode.
describe("PixodeskSvgAnimator (Vue) — attribute names", () => {
    afterEach(() => cleanup());

    it("`maskType` reaches the DOM as `mask-type`", () => {
        const mask = renderSvg(getMaskedLoadJson()).querySelector("mask");
        expect(mask?.getAttribute("mask-type")).toBe("alpha");
        expect(Array.from(mask?.attributes ?? []).map(a => a.name)).not.toContain("maskType");
    });

    it("gradient stops keep their colour", () => {
        // The effects document: its paint IS these stops.
        const stop = renderSvg(getEffectsOnlyJson()).querySelector("stop");
        expect(stop?.getAttribute("stop-color")).toBeTruthy();
        expect(Array.from(stop?.attributes ?? []).map(a => a.name)).not.toContain("stopColor");
    });

    it("every SVG presentation attribute reaches the DOM under the name the web player uses", () => {
        // `PxNode` carries an index signature for DOM attributes, so the loop below is typed.
        const rect: PxNode = { type: "rect", id: "r", width: 5, height: 5 };
        for (const kebab of SVG_PRESENTATION_ATTRIBUTES) {
            // Reference attributes need a real local reference, or the web writer drops them as
            // unsafe and the two renders differ for a reason that is not the name.
            rect[kebabToCamel(kebab)] = REFERENCE_ATTRIBUTES.has(kebab) ? "url(#r)" : "1";
        }
        const doc: PxAnimatedSvgDocument = { type: "svg", viewBox: "0 0 10 10", animator: { timeline: { duration: 100, engine: "js" } }, children: [rect] };

        const host = document.createElement("div");
        document.body.appendChild(host);
        const web = createAnimator({ doc, container: host });
        const webNames = attributeNames(host.querySelector("rect"));

        expect(attributeNames(renderSvg(doc).querySelector("rect"))).toEqual(webNames);
        web.destroy();
        host.remove();
    });

    it("genuinely camelCase SVG attributes stay camelCase", () => {
        // The other half of the writer rule: `viewBox`, `gradientUnits` must NOT become kebab.
        const svg = renderSvg(getEffectsOnlyJson());
        expect(svg.getAttribute("viewBox")).toBe("0 0 500 500");
        expect(svg.querySelector("radialGradient")?.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    });
});


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

/** The presentation attributes whose value is a `url(#…)` reference. */
const REFERENCE_ATTRIBUTES = new Set(["clip-path", "filter", "marker-end", "marker-mid", "marker-start", "mask"]);

/** `stroke-width` -> `strokeWidth` — the wire's spelling. */
function kebabToCamel(kebab: string): string {
    return kebab.replace(/-([a-z])/g, (_all, c: string) => c.toUpperCase());
}

/** Attribute names on one element, sorted, so two renders compare as a set. */
function attributeNames(el: Element | null): Array<string> {
    return el ? Array.from(el.attributes).map(a => a.name).sort() : [];
}

/** Renders and returns the root `<svg>`, failing the test if there is none. */
function renderSvg(doc: PxAnimatedSvgDocument): SVGSVGElement {
    const svg = render(PixodeskSvgAnimator, { props: { doc } }).container.querySelector("svg");
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

/** Tag name -> count, so two renders can be compared without depending on generated ids. */
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

describe('PixodeskSvgAnimator (Vue) — timeline override', () => {

    /** A WIRE-format document; the flat props this replaced were discarded on this shape. */
    const wireJson = (): any => ({
        type: 'svg', id: '_px_wire', viewBox: '0 0 100 100',
        animator: { timeline: { engine: 'js', duration: 1000, trigger: { start: 'load' } } },
        children: [{
            type: 'rect', id: 'r1', opacity: 0,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
        }],
    });

    // Query INSIDE this render's own container: this describe has no cleanup of its own, so a
    // document-wide selector would find the first rect left behind by an earlier test.
    const opacityIn = (container: Element) => Number(container.querySelector('rect')?.getAttribute('opacity'));

    it("baseline: progress=0.5 of the document's own 1000ms lands mid-animation", () => {
        const { container } = render(PixodeskSvgAnimator, { props: { doc: wireJson(), progress: 0.5 } });
        expect(opacityIn(container)).toBeCloseTo(0.5, 1);
    });

    it('timeline overrides duration ON A WIRE DOCUMENT (the flat props never did)', () => {
        const { container } = render(PixodeskSvgAnimator, { props: { doc: wireJson(), progress: 0.5, timeline: { duration: 4000 } } });
        expect(opacityIn(container)).toBe(1);
    });

    it('the duration SHORTCUT does the same thing', () => {
        const { container } = render(PixodeskSvgAnimator, { props: { doc: wireJson(), progress: 0.5, duration: 4000 } });
        expect(opacityIn(container)).toBe(1);
    });

    it('accepts the JSON-string form of timeline', () => {
        const { container } = render(PixodeskSvgAnimator, { props: { doc: wireJson(), progress: 0.5, timeline: '{"duration":4000}' } });
        expect(opacityIn(container)).toBe(1);
    });
});


/**
 * Paint from `effects` ONLY — reported as an empty canvas in React and Vue while the web player
 * played it. Root `fill: none`; both shapes filled by `effects.fillGradient` (radial); the
 * ellipse `effects.maskedBy` the rect (alpha); a mouse-over trigger with a looping transform.
 * Same document as the React spec's fixture of the same name.
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
 * Vue. The root has no id, so the trigger never fired (static); `maskType: "alpha"` reached the
 * DOM as camelCase, so the mask fell back to luminance and let ~28% of the blue rect through
 * (dark). Same document as the React spec's fixture of the same name.
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
