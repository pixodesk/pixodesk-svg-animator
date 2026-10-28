/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SvgCssAnimationPlayer from './SvgCssAnimator';


describe("SvgCssAnimationPlayer (React)", () => {
    afterEach(() => {
        cleanup();
    });

    it("renders children inside the wrapper div", () => {
        const { container } = render(
            <SvgCssAnimationPlayer>
                <svg data-testid="inner-svg" />
            </SvgCssAnimationPlayer>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.tagName).toBe("DIV");
        expect(div.querySelector("svg[data-testid='inner-svg']")).not.toBeNull();
    });

    it("plays immediately with the default start='load'", () => {
        const { container } = render(
            <SvgCssAnimationPlayer>
                <svg />
            </SvgCssAnimationPlayer>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).toBe("px-anim-enabled px-anim-playing");
    });

    it("joins className correctly ('foo px-anim-enabled px-anim-playing')", () => {
        const { container } = render(
            <SvgCssAnimationPlayer className="foo">
                <svg />
            </SvgCssAnimationPlayer>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).toBe("foo px-anim-enabled px-anim-playing");
    });

    it("has no 'undefined' prefix when className is absent", () => {
        const { container } = render(
            <SvgCssAnimationPlayer>
                <svg />
            </SvgCssAnimationPlayer>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).not.toContain("undefined");
        expect(div.className).toBe("px-anim-enabled px-anim-playing");
    });

    it("applies style to the wrapper div", () => {
        const { container } = render(
            <SvgCssAnimationPlayer style={{ width: '123px' }}>
                <svg />
            </SvgCssAnimationPlayer>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.style.width).toBe("123px");
    });

    it("toggles classes for start 'hoverIn' + pause 'hoverOut'", () => {
        const { container } = render(
            <SvgCssAnimationPlayer triggers={{ start: 'hoverIn', pause: 'hoverOut' }}>
                <svg />
            </SvgCssAnimationPlayer>
        );
        const div = container.firstElementChild as HTMLElement;

        // Idle: no animation classes
        expect(div.className).toBe("");

        // Hover in → playing
        fireEvent.mouseOver(div);
        expect(div.className).toBe("px-anim-enabled px-anim-playing");

        // Hover out → paused (enabled but not playing)
        fireEvent.mouseOut(div);
        expect(div.className).toBe("px-anim-enabled");
    });

    it("resets to idle on mouse-out when hoverOut is a stop", () => {
        const { container } = render(
            <SvgCssAnimationPlayer triggers={{ start: 'hoverIn', stop: 'hoverOut' }}>
                <svg />
            </SvgCssAnimationPlayer>
        );
        const div = container.firstElementChild as HTMLElement;

        fireEvent.mouseOver(div);
        expect(div.className).toBe("px-anim-enabled px-anim-playing");

        fireEvent.mouseOut(div);
        expect(div.className).toBe("");
    });
});
