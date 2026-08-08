/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

import { expect, test } from '@playwright/test';

/**
 * Smoke coverage for the PRE-RENDERED bundles, run against the MINIFIED artifact.
 *
 * Why this exists separately from the other e2e specs: those bootstrap through
 * `loadTagAnimators()` + `data-px-animation-src`, a path the pre-rendered builds
 * deliberately do not contain. This fixture instead mirrors the Editor's SVG+JS export —
 * an already-rendered SVG plus a bindings-only payload.
 *
 * And why minified: property mangling and identifier obfuscation only exist in the
 * minified build, so a mangling regression is invisible to a test that runs against
 * readable output. `npm run e2e:fixtures*` copies the bundle under test to
 * `fixtures/player.js`; see the `test:e2e:*` scripts.
 */

/** Seek, then let the compositor apply it before reading back. */
async function seekAndRead(page: import('@playwright/test').Page, timeMs: number) {
    return page.evaluate(async (t) => {
        const api = (window as any).pxApi;
        api.setCurrentTime(t);
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        const el = document.getElementById('box')!;
        const cs = getComputedStyle(el);
        return { opacity: parseFloat(cs.opacity), transform: cs.transform || el.getAttribute('transform') || '' };
    }, timeMs);
}

test.describe('pre-rendered bundle (minified)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/animate-prerendered.html');
        await page.waitForFunction(() => !!(window as any).pxApi);
    });

    test('binds animations to an already-rendered SVG', async ({ page }) => {
        // The payload has no `children` — if the bundle tried to render the document
        // it would replace or blank the existing SVG instead of driving it.
        await expect(page.locator('#box')).toHaveCount(1);

        const start = await seekAndRead(page, 0);
        expect(start.opacity).toBeGreaterThan(0.9);

        const end = await seekAndRead(page, 1000);
        expect(end.opacity).toBeLessThan(0.1);

        // Mid-point proves interpolation ran, not just endpoint snapping.
        const mid = await seekAndRead(page, 500);
        expect(mid.opacity).toBeGreaterThan(0.3);
        expect(mid.opacity).toBeLessThan(0.7);
    });

    test('animates transform through the mangled build', async ({ page }) => {
        // Transform goes through `composeTransformParts` + the interpolation helpers in
        // `PxAnimatorUtil` — the modules most affected by property mangling.
        const start = await seekAndRead(page, 0);
        const end = await seekAndRead(page, 1000);
        expect(start.transform).not.toBe(end.transform);
        expect(end.transform).toMatch(/100|matrix/);
    });

    test('exposes only the pre-rendered surface', async ({ page }) => {
        const keys = await page.evaluate(() => Object.keys((window as any).PixodeskAnimator).sort());
        expect(keys).toContain('createAnimator');
        // The external-JSON bootstrap belongs to the full build only; its absence is what
        // lets the effects pipeline and schema layer tree-shake away.
        expect(keys).not.toContain('loadTagAnimators');
    });

});
