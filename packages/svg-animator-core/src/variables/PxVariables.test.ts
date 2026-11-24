/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// Variables (schema 1.27; docs/library/variables.md): the binding grammar, where a document reads its
// variables, the document with their values written in, validation, and one player's runtime.

import { describe, expect, it, vi } from 'vitest';
import type { PxDocument, PxNode } from '../format/PxAnimatorTypes';
import { validateDocument } from '../format/PxAnimatorTypes';
import { PxDocStage } from '../format/PxDocStage';
import { prepareDocument } from '../pipeline/PxPrepareDocument';
import { createDiagnostics } from '../playback/PxDiagnostics';
import { PxDiagnosticCode } from '../playback/PxDiagnosticCode';
import { isBindingText, isVariableName, PxFormulaResultType, PxVariableBinding, renameInBinding, type PxVariableValue } from './PxFormula';
import { collectBindingSites, formulaResultTypeOf, nodeAtPath, PX_VARIABLE_NODE_MARK, PxPredefinedVariable, resolveVariableBindings, variableValueFits } from './PxVariableBindings';
import { PxVariablesRuntime } from './PxVariablesRuntime';
import { untyped } from '../effects/effectTestKit';

const parse = (text: string) => {
    const result = PxVariableBinding.parse(text);
    if (!result.binding) throw new Error(result.error);
    return result.binding;
};

describe('the binding grammar — parsed into a tree, never eval', () => {

    it('a bare reference passes any value through', () => {
        const b = parse('var(bg)');
        expect(b.isFormula).toBe(false);
        expect(b.names).toEqual(['bg']);
        expect(b.evaluate(() => '#ff0')).toBe('#ff0');
        expect(b.evaluate(() => [1, 2])).toEqual([1, 2]);
    });

    it('calc: + - * /, brackets, a leading minus, precedence', () => {
        const values: Record<string, number> = { x: 10, y: 4 };
        const read = (n: string) => values[n];
        expect(parse('calc(var(x) + 5)').evaluate(read)).toBe(15);
        expect(parse('calc(var(x) - var(y) * 2)').evaluate(read)).toBe(2);
        expect(parse('calc((var(x) - var(y)) * 2)').evaluate(read)).toBe(12);
        expect(parse('calc(-var(y) / 2)').evaluate(read)).toBe(-2);
        expect(parse('calc(1.5e1 + .5)').evaluate(read)).toBe(15.5);
        expect(parse('calc(var(x) / 0)').evaluate(read)).toBeUndefined();
        expect(parse('calc(var(missing) + 1)').evaluate(read)).toBeUndefined();
    });

    it('a formula reads numbers only — a string variable gives no value', () => {
        expect(parse('calc(var(bg) + 1)').evaluate(() => '#fff')).toBeUndefined();
    });

    it('prints normalised and keeps the brackets the tree needs', () => {
        expect(parse('calc( var(x)+5 )').print()).toBe('calc(var(x) + 5)');
        expect(parse('calc((var(a) + var(b)) * 2)').print()).toBe('calc((var(a) + var(b)) * 2)');
        expect(parse('calc(var(a) - (var(b) - 1))').print()).toBe('calc(var(a) - (var(b) - 1))');
        expect(parse('calc(var(a) * var(b) + 1)').print()).toBe('calc(var(a) * var(b) + 1)');
    });

    it('malformed text is an error with a position — no code is run', () => {
        expect(PxVariableBinding.parse('calc(var(x) +)').error).toMatch(/expected/);
        expect(PxVariableBinding.parse('calc(alert(1))').error).toMatch(/expected/);
        expect(PxVariableBinding.parse('var(1x)').error).toMatch(/not a variable name/);
        expect(PxVariableBinding.parse('var(x) extra').error).toMatch(/unexpected/);
    });

    it('names: a declared one has no dot; predefined ones start with player.', () => {
        expect(isVariableName('ball-Bg_2')).toBe(true);
        expect(isVariableName('player.pointer')).toBe(false);
        expect(parse('var(player.pointer.x)').names).toEqual(['player.pointer.x']);
    });

    it('rename rewrites the names inside a formula and leaves other text alone', () => {
        expect(renameInBinding('calc(var(x) + var(y))', 'x', 'left')).toBe('calc(var(left) + var(y))');
        expect(renameInBinding('var(x)', 'y', 'z')).toBe('var(x)');
        expect(renameInBinding('#fff', 'x', 'y')).toBe('#fff');
        expect(isBindingText('var(x)')).toBe(true);
        expect(isBindingText(' calc (1)')).toBe(true);
        expect(isBindingText('red')).toBe(false);
    });
});

describe('calc(…) — comparisons, and · or · not, a choice, text and true / false (2026-11-24)', () => {
    const values = new Map<string, PxVariableValue>([['x', 10], ['y', 4], ['on', true], ['off', false], ['mode', 'dark'], ['bg', '#fff'], ['at', [1, 2]]]);
    const read = (name: string) => values.get(name);
    const value = (text: string) => parse(text).evaluate(read);

    it('comparisons read two numbers and give true or false', () => {
        expect(value('calc(var(x) > var(y))')).toBe(true);
        expect(value('calc(var(x) < var(y))')).toBe(false);
        expect(value('calc(var(x) >= 10)')).toBe(true);
        expect(value('calc(var(x) <= 9.5)')).toBe(false);
        expect(value('calc(var(mode) > 1)')).toBeUndefined();
    });

    it('== and != compare two of one kind — numbers, text, true-or-false; never lists, never two kinds', () => {
        expect(value('calc(var(x) == 10)')).toBe(true);
        expect(value('calc(var(x) != 10)')).toBe(false);
        expect(value("calc(var(mode) == 'dark')")).toBe(true);
        expect(value("calc(var(mode) != 'dark')")).toBe(false);
        expect(value('calc(var(on) == true)')).toBe(true);
        expect(value("calc(var(x) == '10')")).toBeUndefined();
        expect(value('calc(var(at) == var(at))')).toBeUndefined();
    });

    it('and · or · not read true-or-false; the right side is read only when the left one does not decide', () => {
        expect(value('calc(var(on) and var(off))')).toBe(false);
        expect(value('calc(var(on) or var(off))')).toBe(true);
        expect(value('calc(not var(on))')).toBe(false);
        expect(value('calc(var(off) and var(missing))')).toBe(false);
        expect(value('calc(var(on) or var(missing))')).toBe(true);
        expect(value('calc(var(on) and var(missing))')).toBeUndefined();
        expect(value('calc(var(x) and var(on))')).toBeUndefined();
        expect(value('calc(not var(x))')).toBeUndefined();
    });

    it('the levels: product, sum, comparison, equality, not, and, or, the choice', () => {
        expect(value('calc(1 + 2 * 3 > 6 or false)')).toBe(true);
        expect(value('calc(not var(x) > 5 and var(on))')).toBe(false);          // not (x > 5), then and
        expect(value('calc(var(x) > 5 == var(on))')).toBe(true);                // (x > 5) == on
        expect(value('calc(var(off) or var(on) and var(off))')).toBe(false);    // or is the loosest
        expect(value('calc(var(x) > 5 ? var(x) - 5 : 0)')).toBe(5);
    });

    it('a choice gives one of two values of any kind, and reads only the one it picks', () => {
        expect(value('calc(var(on) ? 10 : 20)')).toBe(10);
        expect(value('calc(var(off) ? 10 : 20)')).toBe(20);
        expect(value('calc(var(off) ? 1 : var(x) > 5 ? 2 : 3)')).toBe(2);
        expect(value("calc(var(mode) == 'dark' ? '#000' : var(bg))")).toBe('#000');
        expect(value("calc(var(mode) == 'light' ? '#000' : var(bg))")).toBe('#fff');
        expect(value('calc(var(on) ? var(at) : var(at))')).toEqual([1, 2]);
        expect(value('calc(var(on) ? 1 : var(missing) + 1)')).toBe(1);
        expect(value('calc(var(x) ? 1 : 2)')).toBeUndefined();                  // a number is not true-or-false
    });

    it('text stands in single quotes; a quote or a backslash inside follows a backslash', () => {
        expect(value("calc('it\\'s')")).toBe("it's");
        expect(parse("calc('a\\\\b' == 'a\\\\b')").evaluate(read)).toBe(true);
        expect(parse("calc( 'it\\'s'=='x' )").print()).toBe("calc('it\\'s' == 'x')");
    });

    it('prints normalised and keeps exactly the brackets the tree needs', () => {
        const same = (text: string) => expect(parse(text).print()).toBe(text);
        expect(parse('calc( var(x)>1?2:3 )').print()).toBe('calc(var(x) > 1 ? 2 : 3)');
        same('calc((var(a) or var(b)) and var(c))');
        same('calc(var(a) or var(b) and var(c))');
        same('calc(not (var(a) and var(b)))');
        same('calc(not var(a) > 1)');
        same('calc((not var(a)) == var(b))');
        same('calc(-(var(a) + 1))');
        same('calc(-var(a) * 2)');
        same('calc((var(a) ? 1 : 2) + 1)');
        same('calc(var(a) ? 1 : var(b) ? 2 : 3)');
        same('calc((var(a) ? var(b) : var(c)) ? 1 : 2)');
        same('calc(var(a) ? (var(b) ? 1 : 2) : 3)');
        same('calc(var(a) < var(b) == var(c) < var(d))');
        same('calc(var(a) == (var(b) == var(c)))');
        expect(parse('calc((var(a) == var(b)) == var(c))').print()).toBe('calc(var(a) == var(b) == var(c))');
        expect(parse('calc(not not true)').print()).toBe('calc(not not true)');
    });

    it('what is printed parses back to the same text', () => {
        for (const text of ["calc(var(a) > 1 and not var(b) or var(c) == 'x')", 'calc(-(var(a) - -var(b)) / (2 + var(c)))',
            'calc(var(a) ? var(b) > 1 ? 1 : 2 : 3)', 'calc((var(a) < 1) == (var(b) >= 2) != false)']) {
            const once = parse(text).print();
            expect(parse(once).print()).toBe(once);
        }
    });

    it('another language\'s operator is an error that says what to write', () => {
        expect(PxVariableBinding.parse('calc(var(a) && var(b))').error).toMatch(/write "and"/);
        expect(PxVariableBinding.parse('calc(var(a) || var(b))').error).toMatch(/write "or"/);
        expect(PxVariableBinding.parse('calc(!var(a))').error).toMatch(/write "not"/);
        expect(PxVariableBinding.parse('calc(var(a) = 1)').error).toMatch(/write "=="/);
        expect(PxVariableBinding.parse('calc(var(a) == "x")').error).toMatch(/single quotes/);
        expect(PxVariableBinding.parse("calc(var(a) == 'x)").error).toMatch(/not closed/);
        expect(PxVariableBinding.parse('calc(var(a) < var(b) < var(c))').error).toMatch(/expected/);
        expect(PxVariableBinding.parse('calc(var(a) ? 1)').error).toMatch(/":" expected/);
        expect(PxVariableBinding.parse('calc(nota)').error).toMatch(/expected/);
    });

    it('rename reaches every part of the new nodes', () => {
        expect(renameInBinding("calc(not var(x) > 1 ? var(x) : var(y) == 'x')", 'x', 'left')).toBe("calc(not var(left) > 1 ? var(left) : var(y) == 'x')");
        expect(parse('calc(var(a) and var(b) ? var(c) : var(d))').names).toEqual(['a', 'b', 'c', 'd']);
    });

    it('the kind of the result is told without evaluating — and what is wrong, operator by operator', () => {
        const kinds = new Map<string, PxFormulaResultType>([['x', PxFormulaResultType.number], ['on', PxFormulaResultType.boolean],
            ['bg', PxFormulaResultType.string], ['at', PxFormulaResultType.list]]);
        const check = (text: string) => { const problems: Array<string> = []; return { kind: parse(text).resultType(n => kinds.get(n), problems), problems }; };

        expect(check('calc(var(x) + 1)')).toEqual({ kind: 'number', problems: [] });
        expect(check('calc(var(x) > 1)')).toEqual({ kind: 'boolean', problems: [] });
        expect(check('calc(not var(on) or var(x) == 2)')).toEqual({ kind: 'boolean', problems: [] });
        expect(check("calc(var(on) ? var(bg) : '#000')")).toEqual({ kind: 'string', problems: [] });
        expect(check('calc(var(on) ? var(at) : var(at))')).toEqual({ kind: 'list', problems: [] });
        expect(check('var(bg)')).toEqual({ kind: 'string', problems: [] });
        // an unknown name: the kind cannot be told, and it is not this check's problem
        expect(check('calc(var(nope) + 1)')).toEqual({ kind: 'number', problems: [] });
        expect(check('calc(var(on) ? var(nope) : var(nope))')).toEqual({ kind: undefined, problems: [] });

        expect(check('calc(var(bg) + 1)').problems).toEqual(['var(bg) is text — "+" in a formula reads numbers']);
        expect(check('calc(var(x) and var(on))').problems).toEqual(['var(x) is a number — "and" in a formula reads true or false']);
        expect(check('calc(not var(x))').problems).toEqual(['var(x) is a number — "not" in a formula reads true or false']);
        expect(check('calc(-var(on))').problems).toEqual(['var(on) is true or false — "-" in a formula reads numbers']);
        expect(check('calc(var(x) ? 1 : 2)').problems).toEqual(['var(x) is a number — "?" in a formula reads true or false']);
        expect(check("calc(var(on) ? 1 : 'a')").problems).toEqual(["1 is a number, 'a' is text — \"? :\" in a formula gives two values of one kind"]);
        expect(check('calc(var(x) == var(bg))').problems).toEqual(['var(x) is a number, var(bg) is text — "==" in a formula compares two of one kind']);
        expect(check('calc(var(at) != var(at))').problems).toEqual(['"!=" in a formula does not compare lists']);
        expect(check('calc((var(x) > 1) + 1)').problems).toEqual(['var(x) > 1 is true or false — "+" in a formula reads numbers']);
    });

    it('a declared type gives a formula one of the four kinds', () => {
        expect(formulaResultTypeOf('number')).toBe('number');
        expect(formulaResultTypeOf('boolean')).toBe('boolean');
        expect(['color', 'string', 'image', 'path'].map(t => formulaResultTypeOf(t as 'color'))).toEqual(['string', 'string', 'string', 'string']);
        expect(formulaResultTypeOf('vector')).toBe('list');
        expect(formulaResultTypeOf('numberList')).toBe('list');
    });

    it('in a document: a choice writes a number or a colour in; validation checks the kinds', () => {
        const doc = card();
        const defs = doc.animator?.definitions;
        if (!defs?.variables) throw new Error('fixture');
        defs.variables['big'] = { type: 'boolean', defaultValue: true };
        defs.variables['mode'] = { type: 'string', defaultValue: 'dark' };
        doc.children = [untyped<PxNode>({ type: 'circle', r: 'calc(var(big) ? var(size) * 2 : var(size))', fill: "calc(var(mode) == 'dark' ? '#000' : var(bg))" })];
        expect(validateDocument(doc).findings).toEqual([]);

        const defaults = new Map<string, PxVariableValue>([['big', true], ['mode', 'dark'], ['size', 40], ['bg', '#2a7fff']]);
        const resolved = resolveVariableBindings(doc, collectBindingSites(doc), { read: name => defaults.get(name) });
        expect(resolved.children?.[0]).toMatchObject({ r: 80, fill: '#000' });
        defaults.set('big', false); defaults.set('mode', 'light');
        expect(resolveVariableBindings(doc, collectBindingSites(doc), { read: name => defaults.get(name) }).children?.[0]).toMatchObject({ r: 40, fill: '#2a7fff' });

        doc.children = [untyped<PxNode>({ type: 'circle', r: 'calc(var(bg) > 1 ? 1 : 2)' })];
        expect(validateDocument(doc).findings.map(f => f.reason)).toEqual([expect.stringContaining('var(bg) is text — ">" in a formula reads numbers')]);
    });
});

function card(): PxDocument {
    // untyped: a binding stands where the TS type says number (`copies`) — the wire allows it, the type does not
    return untyped<PxDocument>({
        type: 'svg', viewBox: '0 0 400 200',
        animator: {
            timelines: [{ outTime: 1000 }],
            definitions: {
                variables: {
                    bg: { type: 'color', defaultValue: '#2a7fff', description: 'Card background' },
                    size: { type: 'number', defaultValue: 40 },
                    x: { type: 'number', defaultValue: 100 },
                    spot: { type: 'vector', defaultValue: [40, 40], defaultSource: 'player.pointer' },
                    count: { type: 'number', defaultValue: 3 },
                },
                variableVariants: { foggyDay: { bg: 'green' }, big: { size: 80 } },
            },
        },
        children: [
            { type: 'circle', id: 'c', r: 'var(size)', fill: 'var(bg)', transform: { translate: ['calc(var(x) + 5)', 60] } },
            { type: 'rect', width: 10, height: 10, effects: { repeater: { copies: 'var(count)', translate: [20, 0] } } },
            { type: 'circle', r: 5, style: { fill: 'var(bg)' } },
        ],
    });
}

describe('where a document reads its variables', () => {

    it('attributes, items of a pair, style declarations, effect settings — in tree order', () => {
        const sites = collectBindingSites(card());
        expect(sites.map(s => [s.nodePath.join('/'), s.keyPath.join('.')])).toEqual([
            ['0', 'r'], ['0', 'fill'], ['0', 'transform.translate.0'],
            ['1', 'effects.repeater.copies'],
            ['2', 'style.fill'],
        ]);
    });

    it('never inside animate / keyframes, never in meta or structural keys', () => {
        const doc: PxDocument = {
            type: 'svg', id: 'var(x)',
            children: [{ type: 'circle', meta: { label: 'var(x)' }, animate: { fill: { keyframes: [{ time: 0, value: 'var(x)' }] } } }],
        };
        expect(collectBindingSites(doc)).toEqual([]);
    });
});

describe('the document with the values written in', () => {

    it('a copy — the original is untouched, untouched subtrees are shared', () => {
        const doc = card();
        const sites = collectBindingSites(doc);
        const values = new Map<string, string | number>([['bg', 'red'], ['size', 50], ['x', 10], ['count', 4]]);
        const out = resolveVariableBindings(doc, sites, { read: n => values.get(n) });
        expect(nodeAtPath(out, [0])).toMatchObject({ r: 50, fill: 'red', transform: { translate: [15, 60] } });
        expect(nodeAtPath(out, [1])?.effects).toEqual({ repeater: { copies: 4, translate: [20, 0] } });
        expect(nodeAtPath(doc, [0])?.['r']).toBe('var(size)');
        expect(out.animator).toBe(doc.animator);
    });

    it('a value that cannot be computed leaves its place absent', () => {
        const doc = card();
        const out = resolveVariableBindings(doc, collectBindingSites(doc), { read: () => undefined });
        expect(nodeAtPath(out, [0])).not.toHaveProperty('fill');
        expect(nodeAtPath(out, [0])).not.toHaveProperty('transform');   // an item could not be computed: the attribute goes
    });

    it('CSS delivery: var(--name, fallback) in the style, the attribute dropped', () => {
        const doc = card();
        const out = resolveVariableBindings(doc, collectBindingSites(doc), {
            read: n => (n === 'bg' ? 'green' : 1), cssPropertyOf: n => (n === 'bg' ? '--brand' : undefined),
        });
        expect(nodeAtPath(out, [0])).not.toHaveProperty('fill');
        expect(nodeAtPath(out, [0])?.style).toEqual({ fill: 'var(--brand, green)' });
        expect(nodeAtPath(out, [2])?.style).toEqual({ fill: 'var(--brand, green)' });
    });

    it('an animated default becomes the attribute animation', () => {
        const doc = card();
        const pulse = { keyframes: [{ time: 0, value: '#000' }, { time: 1000, value: '#fff' }] };
        const out = resolveVariableBindings(doc, collectBindingSites(doc), {
            read: () => 1, animatedValueOf: n => (n === 'bg' ? pulse : undefined),
        });
        const circle = nodeAtPath(out, [0]);
        expect(circle?.['fill']).toBe('#000');
        expect(circle?.animate).toEqual({ fill: pulse });
    });

    it('marks the nodes whose values the player writes straight to the element — and the mark survives the pipeline', () => {
        const doc = card();
        const out = resolveVariableBindings(doc, collectBindingSites(doc), { read: () => 1, markDirectWriteNodes: true });
        expect(nodeAtPath(out, [0])?.meta).toEqual({ [PX_VARIABLE_NODE_MARK]: '0' });
        expect(nodeAtPath(out, [1])?.meta).toBeUndefined();          // effects: rebuilt, not written
        expect(nodeAtPath(out, [2])?.['id']).toBe('pxv-2');           // an id to find it by
        const plain = prepareDocument(out, { freshIds: true });
        const marked: Array<string> = [];
        const walk = (n: PxNode) => {
            const meta: unknown = n.meta;
            if (meta && typeof meta === 'object' && PX_VARIABLE_NODE_MARK in meta) marked.push(String(n.id));
            n.children?.forEach(walk);
        };
        walk(plain);
        expect(marked).toHaveLength(2);
    });
});

describe('validation — a document with bindings validates; the bindings are checked on their own', () => {

    it('a well-formed document with bindings in typed places is valid', () => {
        const result = validateDocument(card());
        expect(result.errors).toEqual([]);
    });

    it('names no declared variable, does not parse, a formula over a colour, bound and animated, a bad default, a bad variant entry', () => {
        const doc = card();
        const defs = doc.animator?.definitions;
        if (!defs?.variables || !defs.variableVariants) throw new Error('fixture');
        defs.variables['bad'] = { type: 'number', defaultValue: 'x' };
        defs.variableVariants['foggyDay'] = { bg: 7, nope: 1 };
        doc.children = [
            { type: 'circle', r: 'var(nope)', cx: 'calc(var(size) +)', cy: 'calc(var(bg) + 1)',
                fill: 'var(bg)', animate: { fill: { keyframes: [{ time: 0, value: '#000' }] } } },
        ];
        const reasons = validateDocument(doc).findings.map(f => f.reason);
        expect(reasons).toEqual(expect.arrayContaining([
            expect.stringContaining('"nope" names no entry'),
            expect.stringContaining('does not parse'),
            expect.stringContaining('a formula reads numbers'),
            expect.stringContaining('both animated and bound'),
            expect.stringContaining('does not fit the type "number"'),
            expect.stringContaining('does not fit the type "color"'),
        ]));
    });
});

describe('one player\'s runtime', () => {

    const runtime = (options?: ConstructorParameters<typeof PxVariablesRuntime>[1]) =>
        new PxVariablesRuntime(card(), options, createDiagnostics({ suppressWarnings: true }, '[test]'));

    it('who wins: the host → the default source → the variant → defaultValue', () => {
        const rt = runtime({ variant: 'foggyDay' });
        expect(rt.api.get('bg')).toBe('green');                   // the variant
        rt.api.set('bg', '#ff0');
        expect(rt.api.get('bg')).toBe('#ff0');                    // the host
        rt.api.reset('bg');
        expect(rt.api.get('bg')).toBe('green');
        expect(rt.api.get('spot')).toEqual([40, 40]);             // before the pointer first moves: the default
        rt.setPredefined(PxPredefinedVariable.pointer, [7, 8]);
        expect(rt.api.get('spot')).toEqual([7, 8]);               // its default source
        expect(rt.api.get(PxPredefinedVariable.pointerX)).toBe(200);   // a predefined default: the viewBox centre
    });

    it('setVariables sets the named ones in one change; getAll / getKeys list the declared ones', () => {
        const rt = runtime();
        const flush = vi.fn();
        rt.attach(flush);
        rt.api.setVariables({ size: 60, x: 1 });
        expect(flush).toHaveBeenCalled();
        expect(rt.takeChanges().names).toEqual(new Set(['size', 'x']));
        expect(rt.api.getKeys()).toEqual(['bg', 'size', 'x', 'spot', 'count']);
        expect(rt.api.getAll()).toMatchObject({ bg: '#2a7fff', size: 60, x: 1 });
        expect(rt.api.getVariantKeys()).toEqual(['foggyDay', 'big']);
    });

    it('an equal value marks nothing; a variant marks only what it changes', () => {
        const rt = runtime();
        rt.api.set('size', 40);
        expect(rt.takeChanges().names.size).toBe(0);
        rt.api.reset('size');                                     // the host's value would win over the variant
        expect(rt.takeChanges().names.size).toBe(0);
        rt.api.setVariant('big');
        expect(rt.takeChanges().names).toEqual(new Set(['size']));
    });

    it('the pointer moving marks the variables that follow it', () => {
        const rt = runtime();
        rt.setPredefined(PxPredefinedVariable.pointer, [1, 2]);
        expect(rt.takeChanges().names).toEqual(new Set([PxPredefinedVariable.pointer, 'spot']));
    });

    it('a wrong type, an unknown name or variant is ignored with its code', () => {
        const warnings: Array<number> = [];
        const rt = new PxVariablesRuntime(card(), undefined, createDiagnostics({ onWarning: d => warnings.push(d.code) }, '[test]'));
        rt.api.set('size', 'big');
        rt.api.set('nope', 1);
        rt.api.setVariant('winter');
        expect(rt.api.get('size')).toBe(40);
        expect(warnings).toEqual([PxDiagnosticCode.variableTypeMismatch, PxDiagnosticCode.variableUnknown, PxDiagnosticCode.variantUnknown]);
    });

    it('an animated default switching on or off is a structural change', () => {
        const doc = card();
        const vars = doc.animator?.definitions?.variables;
        if (!vars) throw new Error('fixture');
        vars['bg'] = { type: 'color', defaultValue: { keyframes: [{ time: 0, value: '#000' }, { time: 1000, value: '#fff' }] } };
        const rt = new PxVariablesRuntime(doc, undefined, undefined);
        expect(rt.api.get('bg')).toBe('#000');
        rt.api.set('bg', 'red');
        expect(rt.takeChanges().structural).toBe(true);
    });

    it('CSS names: true = the same names; a map with "*"; a leading -- is dropped', () => {
        expect(runtime({ cssVariables: true }).cssPropertyOf('bg')).toBe('--bg');
        const rt = runtime({ cssVariables: { '*': 'card-*', bg: '--brand-primary' } });
        expect(rt.cssPropertyOf('bg')).toBe('--brand-primary');
        expect(rt.cssPropertyOf('size')).toBe('--card-size');
        expect(runtime({ cssVariables: { bg: 'brand' } }).cssPropertyOf('size')).toBeUndefined();
    });

    it('the resolved document is version-migrated and has every value written in', () => {
        const rt = runtime({ variables: { size: 12 } });
        const doc = rt.resolvedDocument(false);
        expect(nodeAtPath(doc, [0])?.['r']).toBe(12);
        expect(prepareDocument(doc, { stage: PxDocStage.checked })).toBeTruthy();
    });

    it('a vector fits 2 (or 3) numbers; a colour is a string', () => {
        expect(variableValueFits('vector', [1, 2])).toBe(true);
        expect(variableValueFits('vector', [1])).toBe(false);
        expect(variableValueFits('color', '#fff')).toBe(true);
        expect(variableValueFits('number', Number.NaN)).toBe(false);
    });
});

describe('the spelling: var(…) (2026-11-24; variable(…) until then)', () => {
    it('var(name) and calc(…) are bindings; CSS\'s own var(--x) is not — it passes through as text', () => {
        expect(isBindingText('var(size)')).toBe(true);
        expect(isBindingText('calc(var(size) * 2)')).toBe(true);
        expect(isBindingText('var(--brand)')).toBe(false);
        expect(isBindingText(' var( --brand, red)')).toBe(false);
        expect(PxVariableBinding.parse('calc(var(x) + 1)').binding?.print()).toBe('calc(var(x) + 1)');
        // the old spelling is plain text now (no conversion — nothing was published with it)
        expect(isBindingText('variable(size)')).toBe(false);
    });
});
