// prepareDocument — the staged lowering pipeline (dev-docs/plans/prepare-document-pipeline.md).
// The stamp lives on the RESULT only (a non-enumerable Symbol): invisible to JSON / Object.keys /
// validation, dropped by cloning, never written onto the input.
import { describe, expect, it } from 'vitest';
import { prepareDocument, type PxPrepareOptions } from './PxPrepareDocument';
import { PxDocStage, documentStage } from '../format/PxDocStage';
import { getAnimatorConfig, materializeAllInTree, PxTimelineEngine, validateDocument, convertWireDocument, type PxAnimatedSvgDocument } from '../index';
import { PxAnimationDefinitionSchema, PxKeyframeSchema } from '../format/PxAnimatorTypes';

/** A small but real document: an animated rect plus a gradient effect to materialize. */
function makeDoc(): PxAnimatedSvgDocument {
    return JSON.parse(JSON.stringify({
        type: 'svg',
        viewBox: '0 0 100 100',
        children: [{
            type: 'rect', id: 'r1', width: 10, height: 10,
            animate: { opacity: { keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 1 }] } },
            effects: { fillGradient: { type: 'linear', stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] } },
        }],
        animator: { version: '1.5.0', timeline: { outTime: 800 } },
    })) as PxAnimatedSvgDocument;
}
const prep = (doc: PxAnimatedSvgDocument, options?: PxPrepareOptions) => prepareDocument(doc, options);

describe('prepareDocument', () => {
    it('lowers to plain by default, stamps the result, and leaves the input untouched', () => {
        const doc = makeDoc();
        const before = JSON.stringify(doc);
        const out = prep(doc);
        expect(documentStage(out)).toBe(PxDocStage.plain);
        expect(documentStage(doc)).toBeUndefined();          // input never stamped
        expect(JSON.stringify(doc)).toBe(before);            // input never changed
        expect(out).not.toBe(doc);
    });

    it('walks the ladder: current → resolved → plain; re-preparing to a reached stage returns the SAME object', () => {
        const doc = makeDoc();
        const cur = prep(doc, { stage: PxDocStage.current });
        expect(documentStage(cur)).toBe(PxDocStage.current);
        const res = prep(cur, { stage: PxDocStage.resolved });
        expect(documentStage(res)).toBe(PxDocStage.resolved);
        expect(prep(res, { stage: PxDocStage.resolved })).toBe(res);    // trust the stamp — no rework
        expect(prep(res, { stage: PxDocStage.current })).toBe(res);     // a LOWER target is also satisfied
        const plain = prep(res);
        expect(documentStage(plain)).toBe(PxDocStage.plain);
        expect(prep(plain)).toBe(plain);
    });

    it('the stamp is invisible: JSON, Object.keys and validation see a plain document', () => {
        const doc = makeDoc();
        const out = prep(doc, { stage: PxDocStage.resolved });
        expect(Object.keys(out).sort()).toEqual(Object.keys(doc).sort());
        const reparsed = JSON.parse(JSON.stringify(out)) as PxAnimatedSvgDocument;
        expect(documentStage(reparsed)).toBeUndefined();     // a round-tripped doc is raw again
        expect(validateDocument(out, { strict: false }).errors).toEqual([]);
    });

    it('accepts a frozen input (fix is immutable, the stamp goes on the new object)', () => {
        const doc = Object.freeze(makeDoc());
        const out = prep(doc, { stage: PxDocStage.resolved });
        expect(documentStage(out)).toBe(PxDocStage.resolved);
    });

    it('getAnimatorConfig on a prepared doc is the attached view and equals the raw derivation', () => {
        const doc = makeDoc();
        const res = prep(doc, { stage: PxDocStage.resolved });
        const view = getAnimatorConfig(res);
        expect(getAnimatorConfig(res)).toBe(view);           // identity: it is the stamped view
        expect(view).toEqual(getAnimatorConfig(doc));        // same content as deriving from raw
        expect(view?.duration).toBe(800);                    // the window was resolved (not the 1000 ms keyframe end)
    });

    it('plain output equals the composed legacy calls (convert + materialize)', () => {
        const doc = makeDoc();
        const viaPipeline = prep(doc, { engine: PxTimelineEngine.native });
        const legacy = materializeAllInTree(convertWireDocument(makeDoc()).doc as PxAnimatedSvgDocument, PxTimelineEngine.native);
        expect(JSON.parse(JSON.stringify(viaPipeline))).toEqual(JSON.parse(JSON.stringify(legacy)));
    });

    it('a plain doc prepared for ANOTHER engine is re-materialized', () => {
        const doc = makeDoc();
        const js = prep(doc, { engine: PxTimelineEngine.js });
        const native = prep(js, { engine: PxTimelineEngine.native });
        expect(native).not.toBe(js);
        expect(documentStage(native)).toBe(PxDocStage.plain);
        const again = prep(native, { engine: PxTimelineEngine.native });
        expect(again).toBe(native);                          // same engine → trusted
    });

    it('freshIds on an already-plain doc re-mints ids only: same shape, same stamp, new object', () => {
        const plain = prep(makeDoc());
        const fresh = prep(plain, { freshIds: true });
        expect(fresh).not.toBe(plain);
        expect(documentStage(fresh)).toBe(PxDocStage.plain);
        const shape = (d: unknown) => JSON.stringify(d).replace(/"(id|href|xlinkHref)":"[^"]*"|url\(#[^)]*\)/g, 'ID');
        expect(shape(fresh)).toBe(shape(plain));
    });

    it('freshIds rewrites ids INSIDE the animator config too — the attached view follows (no stale bindings)', () => {
        const doc = makeDoc();
        (doc.animator as { bindings?: unknown }).bindings = [{ target: '#r1', animateWith: [] }];
        const out = prep(doc, { freshIds: true });
        const target = (getAnimatorConfig(out)?.bindings ?? [])[0]?.target;
        expect(target).not.toBe('#r1');                                  // the view is not the pre-rename one
        expect(JSON.stringify(out)).toContain('"id":"' + String(target).slice(1) + '"');   // it names a real node
    });

    it('a stamp is only trusted while the document holds the SAME animator config object', () => {
        const res = prep(makeDoc(), { stage: PxDocStage.resolved }) as PxAnimatedSvgDocument;
        const before = getAnimatorConfig(res);
        (res as { animator?: unknown }).animator = { timeline: { outTime: 250 } };   // a convention breach
        expect(getAnimatorConfig(res)).not.toBe(before);
        expect(getAnimatorConfig(res)?.duration).toBe(250);
    });

    it('freshIds mints new ids on the plain output', () => {
        const doc = makeDoc();
        const out = prep(doc, { freshIds: true }) as PxAnimatedSvgDocument;
        const ids = JSON.stringify(out).match(/"id":"[^"]+"/g) || [];
        expect(ids.length).toBeGreaterThan(0);
        expect(JSON.stringify(out)).not.toContain('"id":"r1"');
        expect(documentStage(out)).toBe(PxDocStage.plain);
    });
});

describe('prepareDocument — the checked stage', () => {
    it('sits between current and resolved, and is trusted once reached', () => {
        const checked = prep(makeDoc(), { stage: PxDocStage.checked });
        expect(documentStage(checked)).toBe(PxDocStage.checked);
        expect(prep(checked, { stage: PxDocStage.checked })).toBe(checked);
        expect(documentStage(prep(checked, { stage: PxDocStage.resolved }))).toBe(PxDocStage.resolved);
    });

    it('repairs what does not match the schema, reports it, and plays the rest', () => {
        const doc = makeDoc();
        (doc.animator as { timeline: Record<string, unknown> }).timeline.trigger = { start: 'onLoad' };
        const seen: Array<string> = [];
        const out = prep(doc, { stage: PxDocStage.checked, onProblems: ps => ps.forEach(p => seen.push(p.message)) });
        expect(seen.length).toBe(1);
        expect(seen[0]).toContain('trigger.start');
        expect((out.animator as { timeline: { trigger: Record<string, unknown> } }).timeline.trigger).toEqual({});   // the bad value is gone
        expect((doc.animator as { timeline: { trigger: { start: string } } }).timeline.trigger.start).toBe('onLoad');   // input untouched
    });

    it('a valid document reports nothing and comes out type-stamped', () => {
        let called = false;
        const out = prep(makeDoc(), { stage: PxDocStage.checked, onProblems: () => { called = true; } });
        expect(called).toBe(false);
        const animate = PxAnimationDefinitionSchema.cast(out.children?.[0]?.animate);   // the element's inline definition
        const kf = PxKeyframeSchema.cast(animate.opacity?.keyframes?.[0]);
        Object.assign(kf, { time: 'broken' });           // a deliberate breach: only a stamp can still say "valid"
        expect(PxKeyframeSchema.is(kf)).toBe(true);
    });
});
