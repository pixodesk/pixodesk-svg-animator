/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * A/B parity between the shipped MINIFIED bundles and their unminified twins.
 *
 * The minified builds property-mangle everything on `safeToMangle`
 * (tsup.config.ts -> scripts/collect-identifiers.mjs). A public name that slips into that
 * list is renamed, and the failure is silent: the library keeps running and simply
 * ignores whatever the caller passed. These tests make that loud.
 *
 * Run with `npm run test:bundle` AFTER a build — they read `dist/`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUNDLE_PAIRS, bundleText, framesDoc, loadBundle } from './bundleHarness';

/**
 * Names that MUST survive minification, with what breaks when they do not.
 * See MINIFICATION-BOUNDARY-PLAN.md §1.1 — all twelve were verified broken on 2026-09-08.
 */
const BOUNDARY_NAMES: Array<{ name: string; why: string }> = [
    { name: 'callbacks',      why: 'createAnimator option — the whole callbacks bag is dropped' },
    { name: 'adapter',        why: 'createAnimator option — custom render targets are ignored' },
    { name: 'onPlay',         why: 'documented lifecycle callback' },
    { name: 'onPause',        why: 'documented lifecycle callback' },
    { name: 'onCancel',       why: 'documented lifecycle callback' },
    { name: 'onRemove',       why: 'documented lifecycle callback' },
    { name: 'domType',        why: 'wire key: <feTurbulence domType="fractalNoise"> loses its type attribute' },
    { name: 'rangeName',      why: 'WAAPI TimelineRangeOffset key — a native view timeline scrubs the wrong range' },
    { name: 'class',          why: 'the missing-glyph marker attribute' },
    { name: 'timelineSource', why: 'legacy flat documents: a scroll timeline plays time-driven' },
    { name: 'resetOnFinish',  why: 'legacy flat documents: the finish action is lost' },
];

/**
 * The published contract — every name a minifier must not rename, generated from the runtime
 * schemas plus the members of every exported type (scripts/collect-identifiers.mjs).
 *
 * Checked against the mangle filter rather than against bundle TEXT: a reserved name may also
 * happen to be a local variable name (`defs`, `engine`), and terser mangles variables always
 * and correctly — so grepping the bundle for all 199 names reports false positives. The exact
 * question is whether any reserved name is in the set the property mangler is allowed to touch.
 */
const reservedJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'mangle-reserved.json'), 'utf8'));
const identsJson = JSON.parse(readFileSync(resolve(__dirname, '..', '..', '..', 'scripts', '.identifiers.json'), 'utf8'));

describe('the mangle filter and the published contract cannot disagree', () => {
    it('no reserved name is marked safe to mangle', () => {
        const safe = new Set<string>(identsJson.safeToMangle);
        expect((reservedJson.reserved as Array<string>).filter(n => safe.has(n))).toEqual([]);
    });

    it('the published list covers the whole wire format', () => {
        // Every schema key must be in it; that is what makes a NEW wire key safe by default.
        const reserved = new Set<string>(reservedJson.reserved);
        expect((identsJson.wireKeys as Array<string>).filter(k => !reserved.has(k))).toEqual([]);
    });
});

describe('shipped bundles: boundary names survive minification', () => {
    for (const pair of BUNDLE_PAIRS) {
        for (const { name, why } of BOUNDARY_NAMES) {
            it(`[${pair.name}] keeps "${name}" — ${why}`, () => {
                const min = bundleText(pair.min);
                const unmin = bundleText(pair.unmin);
                // Only assert on names the unminified bundle actually contains: each build is a
                // different slice of the library, and a name absent from both is simply not in
                // this bundle's code paths.
                if (!unmin.includes(name)) return;
                expect(min, `"${name}" is renamed in ${pair.min}`).toContain(name);
            });
        }
    }
});

describe('shipped bundles: behavior is identical minified and unminified', () => {

    /** Runs one scenario against both flavors and returns the two observations. */
    function ab(pair: typeof BUNDLE_PAIRS[number], scenario: (px: any, win: any) => unknown) {
        const a = loadBundle(pair.unmin);
        const b = loadBundle(pair.min);
        return { unmin: scenario(a.px, a.window), min: scenario(b.px, b.window) };
    }

    for (const pair of BUNDLE_PAIRS) {

        it(`[${pair.name}] lifecycle callbacks fire`, () => {
            const scenario = (px: any, win: any) => {
                const fired: string[] = [];
                const api = px.createAnimator({
                    data: framesDoc(),
                    container: win.document.getElementById('stage'),
                    callbacks: {
                        onPlay: () => fired.push('onPlay'),
                        onPause: () => fired.push('onPause'),
                        onCancel: () => fired.push('onCancel'),
                    },
                });
                api.play();
                api.pause();
                api.cancel();
                return fired.join(',');
            };
            const { unmin, min } = ab(pair, scenario);
            expect(unmin, 'the unminified bundle should fire callbacks at all').not.toBe('');
            expect(min, 'callbacks are dropped by the minified bundle').toBe(unmin);
        });

        it(`[${pair.name}] a custom adapter is used`, () => {
            const scenario = (px: any, win: any) => {
                let calls = 0;
                const api = px.createAnimator({
                    data: framesDoc(),
                    container: win.document.getElementById('stage'),
                    adapter: {
                        isConnected: () => true,
                        setAttribute: () => { calls++; },
                    },
                });
                api.play();
                api.setCurrentTime(160);
                return calls > 0;
            };
            const { unmin, min } = ab(pair, scenario);
            expect(min, 'the adapter is ignored by the minified bundle').toBe(unmin);
        });

        if (pair.renders) {
            it(`[${pair.name}] domType becomes a real "type" attribute`, () => {
                const scenario = (px: any, win: any) => {
                    px.createAnimator({
                        data: {
                            type: 'svg',
                            viewBox: '0 0 10 10',
                            children: [{ type: 'feTurbulence', id: 'turb', domType: 'fractalNoise', baseFrequency: 0.05 }],
                        },
                        container: win.document.getElementById('stage'),
                    });
                    // `generateNewIds` rewrites authored ids, so find it by tag.
                    const el = win.document.querySelector('feTurbulence');
                    return el ? `${el.getAttribute('type')}|${el.hasAttribute('dom-type')}` : 'no-element';
                };
                const { unmin, min } = ab(pair, scenario);
                expect(unmin).toBe('fractalNoise|false');
                expect(min, 'domType is mangled, so it lands as a bogus dom-type attribute').toBe(unmin);
            });
        }
    }
});
