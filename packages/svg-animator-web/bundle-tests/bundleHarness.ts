/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Loads a BUILT bundle into a fresh jsdom and returns its global API.
 *
 * Why this exists: every other test in the repo runs against `src/`, so nothing ever
 * exercised property-mangled code — which is how twelve public names came to be renamed
 * in the shipped bundles without a single failure (MINIFICATION-BOUNDARY-PLAN.md §1).
 * These tests run the real artefacts and compare minified against unminified.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';

export const DIST = resolve(__dirname, '..', 'dist');

/** The three bundles we ship as UMD, each in both flavours. */
export const BUNDLE_PAIRS = [
    { name: 'full player',       unmin: 'pixodesk-svg-animator.umd.js', min: 'pixodesk-svg-animator.umd.min.js', renders: true },
    { name: 'pre-rendered',      unmin: 'index.prerendered.umd.js',      min: 'index.prerendered.umd.min.js',      renders: false },
    { name: 'pre-rendered waapi', unmin: 'index.prerendered-waapi.umd.js', min: 'index.prerendered-waapi.umd.min.js', renders: false },
] as const;

export interface LoadedBundle {
    window: any;
    /** The `PixodeskAnimator` UMD global. */
    px: any;
    text: string;
}

export function bundleText(file: string): string {
    return readFileSync(resolve(DIST, file), 'utf8');
}

/** Fresh DOM per load, so one bundle's globals can never leak into another's run. */
export function loadBundle(file: string): LoadedBundle {
    const text = bundleText(file);
    const dom = new JSDOM('<!doctype html><html><body><div id="stage"></div></body></html>', {
        pretendToBeVisual: true,   // gives us requestAnimationFrame for the frame-loop engine
        runScripts: 'outside-only',
    });
    // jsdom has no CSS.supports; the WAAPI engine probes it before accepting a document.
    // Answering "no" keeps every bundle on the frame-loop path, which is the one we can
    // observe here — and it is the same path in both flavours, so parity still holds.
    (dom.window as any).CSS = { supports: () => false };
    // The bundles open with `"use strict"`, and a strict-mode eval keeps its `var`
    // declarations in its OWN variable environment — so the UMD global never lands on
    // `window`. Publish it explicitly from inside the same eval, where it is in scope.
    dom.window.eval(text + '\n;globalThis.PixodeskAnimator = PixodeskAnimator;');
    const px = dom.window.PixodeskAnimator;
    if (!px) throw new Error(`${file}: the UMD global PixodeskAnimator was not defined`);
    return { window: dom.window, px, text };
}

/** A frames-engine document: no WAAPI in jsdom, so the player's own loop is the one we can observe. */
export function framesDoc(extra?: Record<string, unknown>) {
    return {
        type: 'svg',
        viewBox: '0 0 100 100',
        animator: { timeline: { engine: 'js', duration: 320 } },
        children: [
            {
                type: 'rect',
                id: 'r1',
                opacity: 0,
                animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 320, value: 1 }] } },
            },
        ],
        ...extra,
    };
}
