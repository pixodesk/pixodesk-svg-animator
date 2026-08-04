/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Screenshot matrix: attribute-type coverage across both engines + player
 * effects, rendered at 200×200 and sampled at start / middle / end.
 *
 * Assertion model: expected/actual/diff via Playwright `toHaveScreenshot`
 * (baselines live in `__snapshots__/`; failures write actual + diff images).
 * Pixel budget comes from `maxDiffPixelRatio` in playwright.config.ts.
 */

import { expect, Page, test } from "@playwright/test";
import type { PxAnimatedSvgDocument } from "../src/index";


const START_TIME = 100000000;

async function sleep(t: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, t));
}

async function advanceTimeIncrementally(
    page: Page,
    fromTime: number,
    toTime: number,
    stepSize: number = 100,
    pauseBetweenSteps: number = 10
) {
    for (let time = fromTime; time <= toTime; time += stepSize) {
        await page.clock.setFixedTime(time);
        await sleep(stepSize);
        await page.waitForTimeout(pauseBetweenSteps);
    }
}

/** Shared animator config: 1s timeline, hold final state.
 *
 * Frames docs start on load and are driven by the mocked page clock.
 * WAAPI runs on the compositor timeline, which `page.clock` does NOT control —
 * so waapi docs use `startOn: 'programmatic'` and the test drives them
 * deterministically by seeking via the animator API instead. */
function animator(mode: 'auto' | 'waapi' | 'frames') {
    const programmatic = mode === 'waapi';
    return {
        duration: 1000,
        mode,
        fill: 'forwards' as const,
        trigger: {
            startOn: (programmatic ? 'programmatic' : 'load') as 'programmatic' | 'load',
            outAction: 'pause' as const,
        },
    };
}

// ---------------------------------------------------------------------------
// Attribute-type docs (each is run through BOTH engines)
// ---------------------------------------------------------------------------

/** Numeric + colour + position attributes: opacity, fill, cx/cy, r. */
function basicAttrsDoc(mode: 'waapi' | 'frames'): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator(mode),
        children: [
            { // opacity (numeric)
                type: 'rect', id: '_px_op', x: 10, y: 10, width: 50, height: 50, fill: '#6366f1',
                animate: { opacity: { keyframes: [{ time: 0, value: 1 }, { time: 1000, value: 0.2 }] } },
            },
            { // fill colour
                type: 'rect', id: '_px_col', x: 140, y: 10, width: 50, height: 50,
                fill: '#3b82f6',
                animate: { fill: { keyframes: [{ time: 0, value: '#3b82f6' }, { time: 1000, value: '#ec4899' }] } },
            },
            { // position + radius attributes
                type: 'circle', id: '_px_pos', cx: 30, cy: 150, r: 10, fill: '#10b981',
                animate: {
                    cx: { keyframes: [{ time: 0, value: 30 }, { time: 1000, value: 170 }] },
                    r: { keyframes: [{ time: 0, value: 10 }, { time: 1000, value: 25 }] },
                },
            },
        ],
    };
}

/** Transform parts: translate + rotate + scale (nested, one fn per level). */
function transformDoc(mode: 'waapi' | 'frames'): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator(mode),
        children: [{
            type: 'g', id: '_px_tr',
            animate: { translate: { keyframes: [{ time: 0, value: [50, 50] }, { time: 1000, value: [150, 150] }] } },
            children: [{
                type: 'g', id: '_px_rot',
                animate: { rotate: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 180 }] } },
                children: [{
                    type: 'g', id: '_px_sc',
                    animate: { scale: { keyframes: [{ time: 0, value: [1, 1] }, { time: 1000, value: [2, 2] }] } },
                    children: [{ type: 'rect', x: -15, y: -15, width: 30, height: 30, fill: '#f59e0b' }],
                }],
            }],
        }],
    };
}

/** Path morph (`d`) + stroke-dasharray draw-on. Frames-only (WAAPI can't morph). */
function shapeDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator('frames'),
        children: [
            {
                type: 'path', id: '_px_morph', fill: '#ec4899', transform: 'translate(60, 60)',
                animate: {
                    d: {
                        keyframes: [
                            { time: 0, value: 'M-40,0 L0,-40 L40,0 L0,40 Z' },
                            { time: 1000, value: 'M-40,-40 L40,-40 L40,40 L-40,40 Z' },
                        ],
                    },
                },
            },
            {
                type: 'path', id: '_px_draw', stroke: '#ef4444', 'stroke-width': 4, fill: 'none',
                d: 'M 10 160 C 70 120 130 200 190 150',
                animate: {
                    'stroke-dasharray': {
                        keyframes: [{ time: 0, value: [0, 300] }, { time: 1000, value: [300, 300] }],
                    },
                },
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Player-effect docs (materialised by the player at runtime; mode auto)
// ---------------------------------------------------------------------------

function transformationEffectDoc(mode: 'waapi' | 'frames'): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator(mode),
        children: [{
            type: 'rect', id: '_px_r', x: -20, y: -20, width: 40, height: 40, fill: '#10b981',
            effects: {
                transformation: {
                    translate: [100, 100],
                    rotate: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 135 }] },
                },
            },
        }],
    };
}

function repeaterEffectDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator('frames'),
        children: [{
            type: 'rect', id: '_px_r', x: 10, y: 85, width: 24, height: 24, fill: '#6366f1',
            animate: { opacity: { keyframes: [{ time: 0, value: 1 }, { time: 1000, value: 0.3 }] } },
            effects: { repeater: { copies: 4, translate: [42, 0], rotate: 10 } },
        }],
    };
}

function trimPathEffectDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator('frames'),
        children: [{
            type: 'path', id: '_px_p', stroke: '#0ea5e9', 'stroke-width': 5, fill: 'none',
            d: 'M 20 100 C 60 20 140 180 180 100',
            effects: {
                trimPath: {
                    range: { keyframes: [{ time: 0, value: [0, 0.1] }, { time: 1000, value: [0, 1] }] },
                },
            },
        }],
    };
}

function gradientEffectDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator('frames'),
        children: [{
            type: 'rect', id: '_px_g', x: 20, y: 20, width: 160, height: 160,
            effects: {
                fillGradient: {
                    type: 'linear', p1: [20, 20], p2: [180, 20],
                    gradientUnits: 'userSpaceOnUse',
                    stops: {
                        keyframes: [
                            { time: 0, value: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#ec4899' }] },
                            { time: 1000, value: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#f59e0b' }] },
                        ],
                    },
                },
            },
        }],
    };
}

function maskedByEffectDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator('frames'),
        children: [
            {
                type: 'defs',
                children: [{
                    type: 'circle', id: '_px_mask', cx: 100, cy: 100, r: 40, fill: '#fff',
                    animate: { r: { keyframes: [{ time: 0, value: 40 }, { time: 1000, value: 90 }] } },
                }],
            },
            {
                type: 'rect', id: '_px_m', x: 0, y: 0, width: 200, height: 200, fill: '#a855f7',
                effects: { maskedBy: { sourceId: '#_px_mask' } },
            },
        ],
    };
}

function cloneRetimeEffectDoc(): PxAnimatedSvgDocument {
    return {
        type: 'svg', id: '_px_root', viewBox: '0 0 200 200', width: 200, height: 200,
        animator: animator('frames'),
        children: [
            {
                type: 'defs',
                children: [{
                    type: 'symbol', id: '_px_sym', viewBox: '0 0 100 200',
                    children: [{
                        type: 'circle', cx: 50, cy: 30, r: 20, fill: '#f59e0b',
                        animate: { translate: { keyframes: [{ time: 0, value: [0, 0] }, { time: 1000, value: [0, 140] }] } },
                    }],
                }],
            },
            { type: 'use', id: '_px_u1', href: '#_px_sym', x: 0, y: 0, width: 100, height: 200 },
            {
                type: 'use', id: '_px_u2', href: '#_px_sym', x: 100, y: 0, width: 100, height: 200,
                effects: { clone: { baseId: '_px_sym', retime: { start: -500, stretch: 1 } } },
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Test driver
// ---------------------------------------------------------------------------

/** Serves `doc` as /animation.json and opens the generic fixture page. */
async function openWithDoc(page: Page, doc: PxAnimatedSvgDocument) {
    await page.route('**/animation.json', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(doc),
        });
    });
    await page.goto("/animate-basic.html");
}

// Clock-driven tests: the animation starts on load and the mocked page clock
// advances real playback. Valid for the frames engine (rAF + Date.now are
// mocked by page.clock).
test.describe("animate-matrix (frames, clock-driven)", () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER:', msg.text()));
        await page.clock.install({ time: START_TIME });
        await page.clock.setFixedTime(START_TIME);
    });

    function screenshotTest(name: string, doc: PxAnimatedSvgDocument) {
        test(name, async ({ page }) => {
            await openWithDoc(page, doc);

            const svg = page.locator("svg").first();

            await expect(svg).toHaveScreenshot(name + "-start.png");

            await advanceTimeIncrementally(page, START_TIME, START_TIME + 500);
            await expect(svg).toHaveScreenshot(name + "-middle.png");

            await advanceTimeIncrementally(page, START_TIME + 500, START_TIME + 1000);
            await expect(svg).toHaveScreenshot(name + "-end.png");
        });
    }

    screenshotTest('attrs-frames', basicAttrsDoc('frames'));
    screenshotTest('transform-frames', transformDoc('frames'));
    screenshotTest('shape-frames', shapeDoc());

    // Player effects (materialised at runtime)
    screenshotTest('effect-transformation', transformationEffectDoc('frames'));
    screenshotTest('effect-repeater', repeaterEffectDoc());
    screenshotTest('effect-trimpath', trimPathEffectDoc());
    screenshotTest('effect-gradient', gradientEffectDoc());
    screenshotTest('effect-maskedby', maskedByEffectDoc());
    screenshotTest('effect-clone-retime', cloneRetimeEffectDoc());
});

// Seek-driven tests: WAAPI runs on the compositor timeline, which page.clock
// does NOT control (a mocked clock also breaks WAAPI pause/seek resolution) —
// so these docs start `programmatic`, run WITHOUT the mocked clock, and the
// test seeks to fixed times through the animator API instead.
test.describe("animate-matrix (waapi, seek-driven)", () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER:', msg.text()));
    });

    function seekScreenshotTest(name: string, doc: PxAnimatedSvgDocument) {
        test(name, async ({ page }) => {
            await openWithDoc(page, doc);

            // Wait until loadTagAnimators has attached a ready animator.
            await page.waitForFunction(() => {
                const el = document.querySelector('[data-px-animation-src]') as any;
                return el && el._px_animator && el._px_animator.isReady();
            });

            const seek = async (timeMs: number) => {
                await page.evaluate((t) => {
                    const el = document.querySelector('[data-px-animation-src]') as any;
                    const api = el._px_animator;
                    api.setCurrentTime(t);
                    api.pause();
                }, timeMs);
                // give the compositor a frame to apply the seek
                await page.waitForTimeout(50);
            };

            const svg = page.locator("svg").first();

            // IMPORTANT: `animations: 'allow'` — the default ('disabled')
            // fast-forwards finite WAAPI animations to completion (and cancels
            // infinite ones), which would make every sample show the end state.
            // Our animations are PAUSED at the seeked time, so captures are
            // stable without disabling.
            const shot = { animations: 'allow' as const };

            await seek(0);
            await expect(svg).toHaveScreenshot(name + "-start.png", shot);

            await seek(500);
            await expect(svg).toHaveScreenshot(name + "-middle.png", shot);

            await seek(1000);
            await expect(svg).toHaveScreenshot(name + "-end.png", shot);
        });
    }

    seekScreenshotTest('attrs-waapi', basicAttrsDoc('waapi'));
    seekScreenshotTest('transform-waapi', transformDoc('waapi'));
    seekScreenshotTest('effect-transformation-waapi', transformationEffectDoc('waapi'));
});
