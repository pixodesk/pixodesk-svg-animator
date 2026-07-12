/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PixodeskSvgCssAnimator from './PixodeskSvgCssAnimator';


describe("PixodeskSvgCssAnimator (React)", () => {
    afterEach(() => {
        cleanup();
    });

    it("renders children inside the wrapper div", () => {
        const { container } = render(
            <PixodeskSvgCssAnimator>
                <svg data-testid="inner-svg" />
            </PixodeskSvgCssAnimator>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.tagName).toBe("DIV");
        expect(div.querySelector("svg[data-testid='inner-svg']")).not.toBeNull();
    });

    it("plays immediately with the default startOn='load'", () => {
        const { container } = render(
            <PixodeskSvgCssAnimator>
                <svg />
            </PixodeskSvgCssAnimator>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).toBe("px-anim-enabled px-anim-playing");
    });

    it("joins className correctly ('foo px-anim-enabled px-anim-playing')", () => {
        const { container } = render(
            <PixodeskSvgCssAnimator className="foo">
                <svg />
            </PixodeskSvgCssAnimator>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).toBe("foo px-anim-enabled px-anim-playing");
    });

    it("has no 'undefined' prefix when className is absent", () => {
        const { container } = render(
            <PixodeskSvgCssAnimator>
                <svg />
            </PixodeskSvgCssAnimator>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.className).not.toContain("undefined");
        expect(div.className).toBe("px-anim-enabled px-anim-playing");
    });

    it("applies style to the wrapper div", () => {
        const { container } = render(
            <PixodeskSvgCssAnimator style={{ width: '123px' }}>
                <svg />
            </PixodeskSvgCssAnimator>
        );
        const div = container.firstElementChild as HTMLElement;
        expect(div.style.width).toBe("123px");
    });

    it("toggles classes for startOn='mouseOver' + outAction='pause'", () => {
        const { container } = render(
            <PixodeskSvgCssAnimator startOn="mouseOver" outAction="pause">
                <svg />
            </PixodeskSvgCssAnimator>
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

    it("resets to idle on mouse-out when outAction='reset'", () => {
        const { container } = render(
            <PixodeskSvgCssAnimator startOn="mouseOver" outAction="reset">
                <svg />
            </PixodeskSvgCssAnimator>
        );
        const div = container.firstElementChild as HTMLElement;

        fireEvent.mouseOver(div);
        expect(div.className).toBe("px-anim-enabled px-anim-playing");

        fireEvent.mouseOut(div);
        expect(div.className).toBe("");
    });
});
