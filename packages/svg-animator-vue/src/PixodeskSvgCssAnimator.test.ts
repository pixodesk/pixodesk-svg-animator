/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { cleanup, fireEvent, render } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import PixodeskSvgCssAnimator from './PixodeskSvgCssAnimator';


describe("PixodeskSvgCssAnimator (Vue)", () => {
    afterEach(() => {
        cleanup();
    });

    it("renders slot content inside the wrapper div", () => {
        const { container } = render(PixodeskSvgCssAnimator, {
            slots: { default: '<svg class="inner-svg"></svg>' },
        });
        const div = container.firstElementChild as HTMLElement;
        expect(div.tagName).toBe("DIV");
        expect(div.querySelector("svg.inner-svg")).not.toBeNull();
    });

    it("plays immediately with the default startOn='load'", () => {
        const { container } = render(PixodeskSvgCssAnimator, {
            slots: { default: '<svg></svg>' },
        });
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).toBe("px-anim-enabled px-anim-playing");
    });

    it("joins a fallthrough class correctly ('foo px-anim-enabled px-anim-playing')", () => {
        const { container } = render(PixodeskSvgCssAnimator, {
            attrs: { class: 'foo' },
            slots: { default: '<svg></svg>' },
        });
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).toBe("foo px-anim-enabled px-anim-playing");
    });

    it("has no 'undefined' prefix when no class is passed", () => {
        const { container } = render(PixodeskSvgCssAnimator, {
            slots: { default: '<svg></svg>' },
        });
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).not.toContain("undefined");
        expect(div.className).toBe("px-anim-enabled px-anim-playing");
    });

    it("applies fallthrough style to the wrapper div", () => {
        const { container } = render(PixodeskSvgCssAnimator, {
            attrs: { style: 'width: 123px;' },
            slots: { default: '<svg></svg>' },
        });
        const div = container.firstElementChild as HTMLElement;
        expect(div.style.width).toBe("123px");
    });

    it("toggles classes for startOn='mouseOver' + outAction='pause'", async () => {
        const { container } = render(PixodeskSvgCssAnimator, {
            props: { startOn: 'mouseOver', outAction: 'pause' },
            slots: { default: '<svg></svg>' },
        });
        const div = container.firstElementChild as HTMLElement;

        // Idle: no animation classes
        expect(div.className).toBe("");

        // Hover in → playing
        await fireEvent.mouseEnter(div);
        expect(div.className).toBe("px-anim-enabled px-anim-playing");

        // Hover out → paused (enabled but not playing)
        await fireEvent.mouseLeave(div);
        expect(div.className).toBe("px-anim-enabled");
    });

    it("resets to idle on mouse-out when outAction='reset'", async () => {
        const { container } = render(PixodeskSvgCssAnimator, {
            props: { startOn: 'mouseOver', outAction: 'reset' },
            slots: { default: '<svg></svg>' },
        });
        const div = container.firstElementChild as HTMLElement;

        await fireEvent.mouseEnter(div);
        expect(div.className).toBe("px-anim-enabled px-anim-playing");

        await fireEvent.mouseLeave(div);
        expect(div.className).toBe("");
    });
});
