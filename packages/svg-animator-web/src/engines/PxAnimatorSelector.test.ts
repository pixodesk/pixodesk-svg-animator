/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// `#` + a raw id is not valid CSS when the id starts with a digit, and editor ids often do
// (`2kjrlj4l`) because SVG and HTML allow what CSS does not. Unescaped, `querySelector` THROWS
// instead of returning null, so the animation never starts and nothing in the document explains
// why — a real website asset failed exactly this way.

import { describe, expect, it } from 'vitest';
import { getSelector } from './PxAnimatorFrameLoop';

describe('getSelector — an id as a CSS selector', () => {

    it('an ordinary id is left alone', () => {
        expect(document.querySelectorAll(getSelector('_px_2ka6f2sj'))).toHaveLength(0);
    });

    it('an id STARTING WITH A DIGIT is escaped, so querySelector does not throw', () => {
        const selector = getSelector('2kjrlj4l');
        expect(() => document.querySelector(selector)).not.toThrow();
    });

    it('and it still finds that element', () => {
        const el = document.createElement('div');
        el.id = '2kjrlj4l';
        document.body.appendChild(el);
        try {
            expect(document.querySelector(getSelector('2kjrlj4l'))).toBe(el);
        } finally {
            el.remove();
        }
    });

    it('punctuation is escaped too', () => {
        const el = document.createElement('div');
        el.id = 'a.b:c';
        document.body.appendChild(el);
        try {
            expect(document.querySelector(getSelector('a.b:c'))).toBe(el);
        } finally {
            el.remove();
        }
    });
});
