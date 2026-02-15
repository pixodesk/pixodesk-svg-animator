import { expect, Page, test } from "@playwright/test";


async function sleep(t: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, t));
}

test.describe("animate-basic", () => {

    test.beforeEach(async ({ page }) => {

        // Log browser console to terminal
        page.on('console', msg => console.log('BROWSER:', msg.text()));

    });

    test("Trigger animation on click", async ({ page }) => {

        const svg = page.locator("svg").first();

        await page.goto("/animate-triggers-click.html");

        await expect(svg).toHaveScreenshot("animation-start.png");

        await sleep(500);

        await expect(svg).toHaveScreenshot("animation-start-after-delay.png");
        
        await svg.click(); // Click on the SVG to trigger animation

        await sleep(1500);

        await expect(svg).toHaveScreenshot("animation-end.png");
    });
});
