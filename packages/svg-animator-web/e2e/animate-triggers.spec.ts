import { expect, test } from "@playwright/test";
// Type-only import: value imports from ../src would make Playwright's babel
// transpile the whole library at spec-load time (and choke on TS `declare`
// class fields in PxSchema.ts). The format check is inlined instead.
import type { PxDocument } from "../src/index";

function isPxDocument(json: unknown): json is PxDocument {
    return !!json && typeof json === "object" && !Array.isArray(json) &&
        (("type" in json && json.type === "svg") || ("tagName" in json && json.tagName === "svg"));
}
import _animationJson from "./falling-ball-svga.json" with { type: "json" };


if (!isPxDocument(_animationJson)) {
    throw new Error("Animation does not match PxDocument format");
}
const animationJson: PxDocument = _animationJson;

if (!isPxDocument(_animationJson)) {
    throw new Error("Animation does not match PxDocument format");
}

async function sleep(t: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, t));
}

test.describe("animate-basic", () => {

    test.beforeEach(async ({ page }) => {

        // Log browser console to terminal
        page.on('console', msg => console.log('BROWSER:', msg.text()));

    });

    test("Trigger animation on click", async ({ page }) => {

        // Intercept animation.json requests before navigating
        await page.route('**/animation.json', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(animationJson),
            });
        });

        await page.goto("/animate-basic.html");

        await sleep(500);

        const svg = page.locator("svg").first();

        await expect(svg).toHaveScreenshot("animation-start.png");

        await sleep(500);

        await expect(svg).toHaveScreenshot("animation-start-after-delay.png");

        await svg.click(); // Click on the SVG to trigger animation

        await sleep(1500);

        await expect(svg).toHaveScreenshot("animation-end.png");
    });
});
