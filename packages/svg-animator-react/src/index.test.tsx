/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { PxAnimatedSvgDocument } from '@pixodesk/svg-animator-web';
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PixodeskSvgAnimator from './PixodeskSvgAnimator';


describe("ReactAnimator", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("renders and animates", async () => {
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


////////////////////////////////////////////////////////////////

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
            trigger: { startOn: "load" }
        },

        bindings: [
            {
                id: '_px_2pp00tnc',
                animate: {
                    translate: {
                        keyframes: [
                            { time: 0, value: [200, 100], easing: [0.167, 0.167, 0.833, 0.833] },
                            { time: 128, value: [200, 200] }
                        ]
                    }
                }
            }
        ],

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