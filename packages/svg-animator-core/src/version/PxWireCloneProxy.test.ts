// A document behind a Proxy (a Vue reactive object) must still migrate: `structuredClone` refuses
// a Proxy, and the conversion falls back to a JSON copy instead of throwing.
import { describe, expect, it } from 'vitest';
import { convertWireDocument } from './PxWireVersion';

describe('convertWireDocument — proxied input', () => {
    it('migrates an older document wrapped in a Proxy', () => {
        const doc = { type: 'svg', animator: { version: '1.2.0', timeline: { duration: 500 } } };
        const proxied = new Proxy(doc, {});
        const { applied, doc: out } = convertWireDocument(proxied);
        expect(applied.length).toBeGreaterThan(0);
        expect(out).not.toBe(proxied);
    });
});
