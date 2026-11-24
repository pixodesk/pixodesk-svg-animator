// @px-area variables
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * BINDINGS — a static value written as a reference to variables (docs/library/variables.md).
 *
 * | Text                          | Meaning                                    |
 * |-------------------------------|--------------------------------------------|
 * | `var(name)`                   | the variable's value, any type             |
 * | `calc(var(x) + 5)`            | a value computed from variables            |
 * | `calc(var(on) ? 10 : 20)`     | one of two values, picked by a condition   |
 *
 * The text is PARSED into a tree of operators once and the tree is evaluated — never `eval`, no code is ever run
 * from a file.
 *
 * GRAMMAR of `calc(…)`, loosest first (2026-11-24: comparisons, `and` · `or` · `not`, `? :`, text, `true` · `false`):
 *
 * | Level        | Written                                              | Reads → gives                                  |
 * |--------------|------------------------------------------------------|------------------------------------------------|
 * | choice       | `a ? b : c`                                          | true-or-false, two values of one kind → that kind |
 * | or           | `a or b`                                             | two true-or-false → true-or-false              |
 * | and          | `a and b`                                            | the same                                       |
 * | not          | `not a`                                              | true-or-false → true-or-false                  |
 * | equality     | `a == b` · `a != b`                                  | two of one kind (not lists) → true-or-false    |
 * | comparison   | `a < b` · `<=` · `>` · `>=`                          | two numbers → true-or-false                    |
 * | sum          | `a + b` · `a - b`                                    | two numbers → a number                         |
 * | product      | `a * b` · `a / b`                                    | the same                                       |
 * | minus        | `-a`                                                 | a number → a number                            |
 * | a value      | `12.5` · `'text'` · `true` · `false` · `var(name)` · `( … )` |                                        |
 *
 * An operand of the wrong kind gives NO value (`undefined`) — as an unknown name and a division by zero do.
 * {@link PxFormulaNode.resultType} tells the kind, and what is wrong, without evaluating.
 */

/** The operators of `calc(…)` that stand between two operands. @public @advanced */
export const PxFormulaOperator = {
    add: '+',
    subtract: '-',
    multiply: '*',
    divide: '/',
    less: '<',
    lessOrEqual: '<=',
    greater: '>',
    greaterOrEqual: '>=',
    equal: '==',
    notEqual: '!=',
    and: 'and',
    or: 'or',
} as const;
export type PxFormulaOperator = typeof PxFormulaOperator[keyof typeof PxFormulaOperator];

/** The kind of value a formula gives (2026-11-24) — the four kinds a variable's value has: a number, true-or-false,
 *  text (a colour, an image URL and path data are text too), a list of numbers (a vector, a number list).
 *  @public @advanced */
export const PxFormulaResultType = {
    number: 'number',
    boolean: 'boolean',
    string: 'string',
    list: 'list',
} as const;
export type PxFormulaResultType = typeof PxFormulaResultType[keyof typeof PxFormulaResultType];

/** A variable's value: a number, a string (colour, text, image URL, path data), a boolean, or a number list (vector,
 *  number list). @public */
export type PxVariableValue = number | string | boolean | Array<number>;

/** Reads a variable's current value by name; `undefined` when there is none. @public @advanced */
export type PxVariableReader = (name: string) => PxVariableValue | undefined;

/** Says the kind of a variable's value by name; `undefined` — the name is not known. @public @advanced */
export type PxFormulaTypeReader = (name: string) => PxFormulaResultType | undefined;

/** The kind of a value. @public @advanced */
export function formulaResultTypeOfValue(value: PxVariableValue): PxFormulaResultType {
    if (typeof value === 'number') return PxFormulaResultType.number;
    if (typeof value === 'boolean') return PxFormulaResultType.boolean;
    if (typeof value === 'string') return PxFormulaResultType.string;
    return PxFormulaResultType.list;
}

/** One node of a parsed formula. @public @advanced */
export abstract class PxFormulaNode {
    /** The value, or `undefined` when a name has no value, an operand is of the wrong kind or a division by zero
     *  happens. */
    abstract evaluate(read: PxVariableReader): PxVariableValue | undefined;
    /** The kind of value it gives, told from the kinds of the variables without evaluating; `undefined` — it cannot
     *  be told (an unknown name). Every operand of a wrong kind adds a line to `problems`. */
    abstract resultType(typeOf: PxFormulaTypeReader, problems?: Array<string>): PxFormulaResultType | undefined;
    /** The text the node is written as. */
    abstract print(): string;
    /** Every variable name the node reads. */
    abstract collectNames(into: Set<string>): void;
    /** The same node with variable `from` called `to`. */
    abstract rename(from: string, to: string): PxFormulaNode;
}

/** A number written in the formula. @public @advanced */
export class PxFormulaNumber extends PxFormulaNode {
    constructor(readonly value: number) { super(); }
    evaluate(): number { return this.value; }
    resultType(): PxFormulaResultType { return PxFormulaResultType.number; }
    print(): string { return String(this.value); }
    collectNames(): void { /* no names */ }
    rename(): PxFormulaNode { return this; }
}

/** `true` or `false` written in the formula. @public @advanced */
export class PxFormulaBoolean extends PxFormulaNode {
    constructor(readonly value: boolean) { super(); }
    evaluate(): boolean { return this.value; }
    resultType(): PxFormulaResultType { return PxFormulaResultType.boolean; }
    print(): string { return this.value ? TRUE_WORD : FALSE_WORD; }
    collectNames(): void { /* no names */ }
    rename(): PxFormulaNode { return this; }
}

/** Text written in the formula, in single quotes — `'dark'`, `'#fff'`. @public @advanced */
export class PxFormulaText extends PxFormulaNode {
    constructor(readonly value: string) { super(); }
    evaluate(): string { return this.value; }
    resultType(): PxFormulaResultType { return PxFormulaResultType.string; }
    print(): string { return QUOTE + this.value.replace(/[\\']/g, ch => ESCAPE + ch) + QUOTE; }
    collectNames(): void { /* no names */ }
    rename(): PxFormulaNode { return this; }
}

/** `var(name)` inside a formula. @public @advanced */
export class PxFormulaVariable extends PxFormulaNode {
    constructor(readonly name: string) { super(); }
    evaluate(read: PxVariableReader): PxVariableValue | undefined {
        const value = read(this.name);
        return typeof value === 'number' && !Number.isFinite(value) ? undefined : value;
    }
    resultType(typeOf: PxFormulaTypeReader): PxFormulaResultType | undefined { return typeOf(this.name); }
    print(): string { return VARIABLE_FN + '(' + this.name + ')'; }
    collectNames(into: Set<string>): void { into.add(this.name); }
    rename(from: string, to: string): PxFormulaNode { return this.name === from ? new PxFormulaVariable(to) : this; }
}

/** A leading minus. @public @advanced */
export class PxFormulaNegate extends PxFormulaNode {
    constructor(readonly operand: PxFormulaNode) { super(); }
    evaluate(read: PxVariableReader): number | undefined {
        const value = this.operand.evaluate(read);
        return typeof value === 'number' ? -value : undefined;
    }
    resultType(typeOf: PxFormulaTypeReader, problems?: Array<string>): PxFormulaResultType {
        expectKind(this.operand, PxFormulaResultType.number, PxFormulaOperator.subtract, typeOf, problems);
        return PxFormulaResultType.number;
    }
    print(): string { return PxFormulaOperator.subtract + printWithin(this.operand, PxFormulaLevel.negate); }
    collectNames(into: Set<string>): void { this.operand.collectNames(into); }
    rename(from: string, to: string): PxFormulaNode { return new PxFormulaNegate(this.operand.rename(from, to)); }
}

/** `not a` — the opposite of a true-or-false. @public @advanced */
export class PxFormulaNot extends PxFormulaNode {
    constructor(readonly operand: PxFormulaNode) { super(); }
    evaluate(read: PxVariableReader): boolean | undefined {
        const value = this.operand.evaluate(read);
        return typeof value === 'boolean' ? !value : undefined;
    }
    resultType(typeOf: PxFormulaTypeReader, problems?: Array<string>): PxFormulaResultType {
        expectKind(this.operand, PxFormulaResultType.boolean, NOT_WORD, typeOf, problems);
        return PxFormulaResultType.boolean;
    }
    print(): string { return NOT_WORD + ' ' + printWithin(this.operand, PxFormulaLevel.not); }
    collectNames(into: Set<string>): void { this.operand.collectNames(into); }
    rename(from: string, to: string): PxFormulaNode { return new PxFormulaNot(this.operand.rename(from, to)); }
}

/** Two operands and an operator. @public @advanced */
export class PxFormulaBinary extends PxFormulaNode {
    constructor(readonly operator: PxFormulaOperator, readonly left: PxFormulaNode, readonly right: PxFormulaNode) { super(); }
    evaluate(read: PxVariableReader): number | boolean | undefined {
        const operator = this.operator;
        if (operator === PxFormulaOperator.and || operator === PxFormulaOperator.or) {
            // the right side is read only when the left one does not decide
            const a = this.left.evaluate(read);
            if (typeof a !== 'boolean') return undefined;
            if (a === (operator === PxFormulaOperator.or)) return a;
            const b = this.right.evaluate(read);
            return typeof b === 'boolean' ? b : undefined;
        }
        const a = this.left.evaluate(read);
        const b = this.right.evaluate(read);
        if (a === undefined || b === undefined) return undefined;
        if (operator === PxFormulaOperator.equal || operator === PxFormulaOperator.notEqual) {
            if (typeof a !== typeof b || typeof a === 'object') return undefined;
            return (a === b) === (operator === PxFormulaOperator.equal);
        }
        if (typeof a !== 'number' || typeof b !== 'number') return undefined;
        switch (operator) {
            case PxFormulaOperator.add: return a + b;
            case PxFormulaOperator.subtract: return a - b;
            case PxFormulaOperator.multiply: return a * b;
            case PxFormulaOperator.divide: return b === 0 ? undefined : a / b;
            case PxFormulaOperator.less: return a < b;
            case PxFormulaOperator.lessOrEqual: return a <= b;
            case PxFormulaOperator.greater: return a > b;
            case PxFormulaOperator.greaterOrEqual: return a >= b;
        }
    }
    resultType(typeOf: PxFormulaTypeReader, problems?: Array<string>): PxFormulaResultType {
        switch (levelOfOperator(this.operator)) {
            case PxFormulaLevel.or:
            case PxFormulaLevel.and:
                expectKind(this.left, PxFormulaResultType.boolean, this.operator, typeOf, problems);
                expectKind(this.right, PxFormulaResultType.boolean, this.operator, typeOf, problems);
                return PxFormulaResultType.boolean;
            case PxFormulaLevel.equality: {
                const a = this.left.resultType(typeOf, problems);
                const b = this.right.resultType(typeOf, problems);
                if (a === PxFormulaResultType.list || b === PxFormulaResultType.list) {
                    problems?.push('"' + this.operator + '" in a formula does not compare lists');
                } else if (a !== undefined && b !== undefined && a !== b) {
                    problems?.push(this.left.print() + ' is ' + kindWords(a) + ', ' + this.right.print() + ' is ' + kindWords(b)
                        + ' — "' + this.operator + '" in a formula compares two of one kind');
                }
                return PxFormulaResultType.boolean;
            }
            case PxFormulaLevel.comparison:
                expectKind(this.left, PxFormulaResultType.number, this.operator, typeOf, problems);
                expectKind(this.right, PxFormulaResultType.number, this.operator, typeOf, problems);
                return PxFormulaResultType.boolean;
            default:
                expectKind(this.left, PxFormulaResultType.number, this.operator, typeOf, problems);
                expectKind(this.right, PxFormulaResultType.number, this.operator, typeOf, problems);
                return PxFormulaResultType.number;
        }
    }
    print(): string { return this.printOperand(this.left, false) + ' ' + this.operator + ' ' + this.printOperand(this.right, true); }
    collectNames(into: Set<string>): void { this.left.collectNames(into); this.right.collectNames(into); }
    rename(from: string, to: string): PxFormulaNode {
        return new PxFormulaBinary(this.operator, this.left.rename(from, to), this.right.rename(from, to));
    }
    /** Brackets only where the tree needs them: a looser level below; the same level on the right of an operator whose
     *  order matters (`-` `/` `==` `!=`); the same level on either side of a comparison (they do not chain). */
    private printOperand(node: PxFormulaNode, isRight: boolean): string {
        const mine = levelOfOperator(this.operator);
        const theirs = levelOf(node);
        const sameLevelNeeds = mine === PxFormulaLevel.comparison || (isRight && !isOrderFree(this.operator));
        return theirs < mine || (theirs === mine && sameLevelNeeds) ? '(' + node.print() + ')' : node.print();
    }
}

/** `test ? whenTrue : whenFalse` — one of two values (2026-11-24). Only the picked one is evaluated. @public @advanced */
export class PxFormulaChoice extends PxFormulaNode {
    constructor(readonly test: PxFormulaNode, readonly whenTrue: PxFormulaNode, readonly whenFalse: PxFormulaNode) { super(); }
    evaluate(read: PxVariableReader): PxVariableValue | undefined {
        const test = this.test.evaluate(read);
        if (typeof test !== 'boolean') return undefined;
        return (test ? this.whenTrue : this.whenFalse).evaluate(read);
    }
    resultType(typeOf: PxFormulaTypeReader, problems?: Array<string>): PxFormulaResultType | undefined {
        expectKind(this.test, PxFormulaResultType.boolean, CHOICE_MARK, typeOf, problems);
        const a = this.whenTrue.resultType(typeOf, problems);
        const b = this.whenFalse.resultType(typeOf, problems);
        if (a !== undefined && b !== undefined && a !== b) {
            problems?.push(this.whenTrue.print() + ' is ' + kindWords(a) + ', ' + this.whenFalse.print() + ' is ' + kindWords(b)
                + ' — "' + CHOICE_MARK + ' ' + CHOICE_ELSE_MARK + '" in a formula gives two values of one kind');
        }
        return a ?? b;
    }
    print(): string {
        // a choice as the test or as the first value is bracketed; as the last value it reads on by itself
        return printWithin(this.test, PxFormulaLevel.or) + ' ' + CHOICE_MARK + ' ' + printWithin(this.whenTrue, PxFormulaLevel.or)
            + ' ' + CHOICE_ELSE_MARK + ' ' + this.whenFalse.print();
    }
    collectNames(into: Set<string>): void { this.test.collectNames(into); this.whenTrue.collectNames(into); this.whenFalse.collectNames(into); }
    rename(from: string, to: string): PxFormulaNode {
        return new PxFormulaChoice(this.test.rename(from, to), this.whenTrue.rename(from, to), this.whenFalse.rename(from, to));
    }
}

// ── LEVELS, KINDS ────────────────────────────────────────────────────────────────────────────────

/** How tightly a node holds its operands — the looser, the smaller; the parser's levels, in its order. */
const PxFormulaLevel = {
    choice: 0,
    or: 1,
    and: 2,
    not: 3,
    equality: 4,
    comparison: 5,
    sum: 6,
    product: 7,
    negate: 8,
    value: 9,
} as const;
type PxFormulaLevel = typeof PxFormulaLevel[keyof typeof PxFormulaLevel];

function levelOfOperator(operator: PxFormulaOperator): PxFormulaLevel {
    switch (operator) {
        case PxFormulaOperator.or: return PxFormulaLevel.or;
        case PxFormulaOperator.and: return PxFormulaLevel.and;
        case PxFormulaOperator.equal:
        case PxFormulaOperator.notEqual: return PxFormulaLevel.equality;
        case PxFormulaOperator.less:
        case PxFormulaOperator.lessOrEqual:
        case PxFormulaOperator.greater:
        case PxFormulaOperator.greaterOrEqual: return PxFormulaLevel.comparison;
        case PxFormulaOperator.add:
        case PxFormulaOperator.subtract: return PxFormulaLevel.sum;
        case PxFormulaOperator.multiply:
        case PxFormulaOperator.divide: return PxFormulaLevel.product;
    }
}

function levelOf(node: PxFormulaNode): PxFormulaLevel {
    if (node instanceof PxFormulaChoice) return PxFormulaLevel.choice;
    if (node instanceof PxFormulaBinary) return levelOfOperator(node.operator);
    if (node instanceof PxFormulaNot) return PxFormulaLevel.not;
    if (node instanceof PxFormulaNegate) return PxFormulaLevel.negate;
    return PxFormulaLevel.value;
}

/** True when `a op (b op c)` is the same as `(a op b) op c` — no brackets needed on the right. */
function isOrderFree(operator: PxFormulaOperator): boolean {
    return operator === PxFormulaOperator.add || operator === PxFormulaOperator.multiply
        || operator === PxFormulaOperator.and || operator === PxFormulaOperator.or;
}

/** The node's text, in brackets when it holds looser than `level`. */
function printWithin(node: PxFormulaNode, level: PxFormulaLevel): string {
    return levelOf(node) < level ? '(' + node.print() + ')' : node.print();
}

/** A kind, in words for a message — "var(bg) is text". */
function kindWords(kind: PxFormulaResultType): string {
    switch (kind) {
        case PxFormulaResultType.number: return 'a number';
        case PxFormulaResultType.boolean: return 'true or false';
        case PxFormulaResultType.string: return 'text';
        case PxFormulaResultType.list: return 'a list of numbers';
    }
}

/** What an operator reads, in words for a message — "reads numbers". */
function readsWords(kind: PxFormulaResultType): string {
    switch (kind) {
        case PxFormulaResultType.number: return 'numbers';
        case PxFormulaResultType.boolean: return 'true or false';
        case PxFormulaResultType.string: return 'text';
        case PxFormulaResultType.list: return 'lists of numbers';
    }
}

/** Notes a problem when `operand` is known to be of another kind than `kind` — the operator `mark` reads `kind`. */
function expectKind(operand: PxFormulaNode, kind: PxFormulaResultType, mark: string, typeOf: PxFormulaTypeReader, problems: Array<string> | undefined): void {
    const actual = operand.resultType(typeOf, problems);
    if (actual === undefined || actual === kind) return;
    problems?.push(operand.print() + ' is ' + kindWords(actual) + ' — "' + mark + '" in a formula reads ' + readsWords(kind));
}

// ── PARSING ──────────────────────────────────────────────────────────────────────────────────────

const VARIABLE_FN = 'var';
const CALC_FN = 'calc';
const NOT_WORD = 'not';
const TRUE_WORD = 'true';
const FALSE_WORD = 'false';
const CHOICE_MARK = '?';
const CHOICE_ELSE_MARK = ':';
const QUOTE = '\'';
const ESCAPE = '\\';
/** A user name: a letter, then letters, digits, `_`, `-`. A predefined name joins such words with dots. */
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/;
/** A user-declared name: no dots — a dotted name belongs to the player (`player.pointer`). */
const USER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
/** What a word operator (`and`, `not`, `true`) must not be followed by — it would be a part of a longer word. */
const WORD_CHAR = /[A-Za-z0-9_]/;
/** `var(` (not CSS's own `var(--x)`: our names start with a letter) or `calc(` — 2026-11-24: `var` (was `variable`). */
const BINDING_START = /^\s*(?:var\s*\((?!\s*--)|calc\s*\()/;

/** True for a valid name of a declared variable: a letter, then letters, digits, `_` or `-`. @public */
export function isVariableName(name: string): boolean {
    return USER_NAME_PATTERN.test(name);
}

/** True for any name a binding may read: a declared one, or a predefined one (`player.pointer.x`). @public @advanced */
export function isVariableReadName(name: string): boolean {
    return NAME_PATTERN.test(name);
}

/** True when a raw value is written as a binding — starts with `var(` or `calc(`. It may still fail to parse.
 *  @public */
export function isBindingText(raw: unknown): raw is string {
    return typeof raw === 'string' && BINDING_START.test(raw);
}

/** A parsed binding — see the module comment. @public @advanced */
export class PxVariableBinding {
    private constructor(
        /** The parsed tree. */
        readonly root: PxFormulaNode,
        /** `calc(…)`: the value is computed. A bare `var(name)` passes any value through. */
        readonly isFormula: boolean,
        /** Every variable the binding reads. */
        readonly names: ReadonlyArray<string>,
    ) { }

    /** The text, normalised: `var(x)`, `calc(var(x) + 5)`. */
    print(): string {
        return this.isFormula ? CALC_FN + '(' + this.root.print() + ')' : this.root.print();
    }

    /** The current value: a bare reference gives the variable's value as it is; a formula gives what it computes, or
     *  `undefined` when one of its names has no value, an operand is of the wrong kind or it divides by zero. */
    evaluate(read: PxVariableReader): PxVariableValue | undefined {
        if (!this.isFormula && this.root instanceof PxFormulaVariable) return read(this.root.name);
        return this.root.evaluate(read);
    }

    /** The kind of value it gives, told from the kinds of the variables — see {@link PxFormulaNode.resultType}. */
    resultType(typeOf: PxFormulaTypeReader, problems?: Array<string>): PxFormulaResultType | undefined {
        return this.root.resultType(typeOf, problems);
    }

    /** The same binding with variable `from` called `to`. */
    rename(from: string, to: string): PxVariableBinding {
        return PxVariableBinding.of(this.root.rename(from, to), this.isFormula);
    }

    /** The binding a bare reference to `name` is. */
    static reference(name: string): PxVariableBinding {
        return PxVariableBinding.of(new PxFormulaVariable(name), false);
    }

    /** Parses binding text; the result says what is wrong when it does not parse. */
    static parse(text: string): PxVariableBindingParseResult {
        try {
            const parser = new FormulaParser(text);
            const result = parser.parseBinding();
            return { binding: PxVariableBinding.of(result.root, result.isFormula) };
        } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
        }
    }

    private static of(root: PxFormulaNode, isFormula: boolean): PxVariableBinding {
        const names = new Set<string>();
        root.collectNames(names);
        return new PxVariableBinding(root, isFormula, [...names]);
    }
}

/** What {@link PxVariableBinding.parse} returns: the binding, or why the text is not one. @public @advanced */
export interface PxVariableBindingParseResult {
    readonly binding?: PxVariableBinding;
    readonly error?: string;
}

/** Renames variable `from` to `to` inside binding text; text that is not a binding, or names neither, comes back
 *  unchanged. @public @advanced */
export function renameInBinding(text: string, from: string, to: string): string {
    if (!isBindingText(text)) return text;
    const parsed = PxVariableBinding.parse(text).binding;
    if (!parsed || !parsed.names.includes(from)) return text;
    return parsed.rename(from, to).print();
}

/** A recursive-descent parser over the text — no regular expression decides the structure, so a malformed formula
 *  is a clear error at a position. One method per level of the grammar, loosest first. */
class FormulaParser {
    private pos = 0;

    constructor(private readonly text: string) { }

    parseBinding(): { root: PxFormulaNode; isFormula: boolean } {
        this.skipSpaces();
        if (this.readWord(CALC_FN)) {
            this.expect('(');
            const root = this.parseChoice();
            this.expect(')');
            this.expectEnd();
            return { root, isFormula: true };
        }
        const root = this.parseVariable();
        this.expectEnd();
        return { root, isFormula: false };
    }

    /** `a ? b : c` — the last value may be a choice again (`a ? 1 : b ? 2 : 3`). */
    private parseChoice(): PxFormulaNode {
        const test = this.parseOr();
        this.skipSpaces();
        if (this.peek() !== CHOICE_MARK) return test;
        this.pos++;
        const whenTrue = this.parseChoice();
        this.expect(CHOICE_ELSE_MARK);
        return new PxFormulaChoice(test, whenTrue, this.parseChoice());
    }

    private parseOr(): PxFormulaNode {
        let node = this.parseAnd();
        while (this.readKeyword(PxFormulaOperator.or)) node = new PxFormulaBinary(PxFormulaOperator.or, node, this.parseAnd());
        return node;
    }

    private parseAnd(): PxFormulaNode {
        let node = this.parseNot();
        while (this.readKeyword(PxFormulaOperator.and)) node = new PxFormulaBinary(PxFormulaOperator.and, node, this.parseNot());
        return node;
    }

    /** `not` holds looser than a comparison: `not var(a) > 1` is `not (var(a) > 1)`. */
    private parseNot(): PxFormulaNode {
        if (this.readKeyword(NOT_WORD)) return new PxFormulaNot(this.parseNot());
        return this.parseEquality();
    }

    private parseEquality(): PxFormulaNode {
        let node = this.parseComparison();
        for (;;) {
            const operator = this.readMark(PxFormulaOperator.equal) ?? this.readMark(PxFormulaOperator.notEqual);
            if (operator === undefined) return node;
            node = new PxFormulaBinary(operator, node, this.parseComparison());
        }
    }

    /** One comparison — they do not chain (`a < b < c` is not written). */
    private parseComparison(): PxFormulaNode {
        const node = this.parseSum();
        // the two-letter marks first, so `<=` is not read as `<`
        const operator = this.readMark(PxFormulaOperator.lessOrEqual) ?? this.readMark(PxFormulaOperator.greaterOrEqual)
            ?? this.readMark(PxFormulaOperator.less) ?? this.readMark(PxFormulaOperator.greater);
        return operator === undefined ? node : new PxFormulaBinary(operator, node, this.parseSum());
    }

    private parseSum(): PxFormulaNode {
        let node = this.parseProduct();
        for (;;) {
            const operator = this.readMark(PxFormulaOperator.add) ?? this.readMark(PxFormulaOperator.subtract);
            if (operator === undefined) return node;
            node = new PxFormulaBinary(operator, node, this.parseProduct());
        }
    }

    private parseProduct(): PxFormulaNode {
        let node = this.parseNegate();
        for (;;) {
            const operator = this.readMark(PxFormulaOperator.multiply) ?? this.readMark(PxFormulaOperator.divide);
            if (operator === undefined) return node;
            node = new PxFormulaBinary(operator, node, this.parseNegate());
        }
    }

    private parseNegate(): PxFormulaNode {
        this.skipSpaces();
        if (this.peek() === PxFormulaOperator.subtract) {
            this.pos++;
            return new PxFormulaNegate(this.parseNegate());
        }
        return this.parseValue();
    }

    private parseValue(): PxFormulaNode {
        this.skipSpaces();
        if (this.peek() === '(') {
            this.pos++;
            const node = this.parseChoice();
            this.expect(')');
            return node;
        }
        const number = NUMBER_PATTERN.exec(this.text.slice(this.pos));
        if (number) {
            this.pos += number[0].length;
            return new PxFormulaNumber(Number(number[0]));
        }
        if (this.peek() === QUOTE) return this.parseText();
        if (this.readKeyword(TRUE_WORD)) return new PxFormulaBoolean(true);
        if (this.readKeyword(FALSE_WORD)) return new PxFormulaBoolean(false);
        return this.parseVariable();
    }

    /** `'text'` — a quote or a backslash inside is written after a backslash. */
    private parseText(): PxFormulaText {
        this.pos++;
        let value = '';
        for (;;) {
            const ch = this.peek();
            if (ch === undefined) throw this.error('"' + QUOTE + '" expected — the text is not closed');
            this.pos++;
            if (ch === QUOTE) return new PxFormulaText(value);
            if (ch === ESCAPE) {
                const next = this.peek();
                if (next === undefined) throw this.error('"' + QUOTE + '" expected — the text is not closed');
                this.pos++;
                value += next;
            } else value += ch;
        }
    }

    private parseVariable(): PxFormulaVariable {
        this.skipSpaces();
        if (!this.readWord(VARIABLE_FN)) throw this.error(this.hint() ?? 'a number, text in quotes, true, false, a bracket or var(name) expected');
        this.expect('(');
        this.skipSpaces();
        const start = this.pos;
        while (this.pos < this.text.length && this.text[this.pos] !== ')' && !/\s/.test(this.text[this.pos])) this.pos++;
        const name = this.text.slice(start, this.pos);
        if (!isVariableReadName(name)) throw this.error('"' + name + '" is not a variable name');
        this.expect(')');
        return new PxFormulaVariable(name);
    }

    /** `word(` — a function's name with its bracket after it. */
    private readWord(word: string): boolean {
        this.skipSpaces();
        if (!this.text.startsWith(word, this.pos)) return false;
        const after = this.text.slice(this.pos + word.length).trimStart();
        if (!after.startsWith('(')) return false;
        this.pos += word.length;
        return true;
    }

    /** A word operator or value (`and`, `not`, `true`) — a whole word, not the start of a longer one. */
    private readKeyword(word: string): boolean {
        this.skipSpaces();
        if (!this.text.startsWith(word, this.pos)) return false;
        const after = this.text[this.pos + word.length];
        if (after !== undefined && WORD_CHAR.test(after)) return false;
        this.pos += word.length;
        return true;
    }

    /** An operator written with marks (`+`, `<=`, `==`): itself when it stands here, else `undefined`. A `<` or `>`
     *  is not read where `<=` / `>=` stands. */
    private readMark<T extends PxFormulaOperator>(mark: T): T | undefined {
        this.skipSpaces();
        if (!this.text.startsWith(mark, this.pos)) return undefined;
        if (mark.length === 1 && (mark === PxFormulaOperator.less || mark === PxFormulaOperator.greater) && this.text[this.pos + 1] === '=') return undefined;
        this.pos += mark.length;
        return mark;
    }

    private expect(ch: string): void {
        this.skipSpaces();
        if (this.peek() !== ch) throw this.error(this.hint() ?? '"' + ch + '" expected');
        this.pos++;
    }

    private expectEnd(): void {
        this.skipSpaces();
        if (this.pos < this.text.length) throw this.error(this.hint() ?? 'unexpected "' + this.text.slice(this.pos) + '"');
    }

    /** What to write instead, when the text goes on with another language's operator. */
    private hint(): string | undefined {
        const rest = this.text.slice(this.pos);
        if (rest.startsWith('&&')) return 'write "' + PxFormulaOperator.and + '", not "&&"';
        if (rest.startsWith('||')) return 'write "' + PxFormulaOperator.or + '", not "||"';
        if (rest.startsWith('!') && !rest.startsWith(PxFormulaOperator.notEqual)) return 'write "' + NOT_WORD + '", not "!"';
        if (rest.startsWith('=') && !rest.startsWith(PxFormulaOperator.equal)) return 'write "' + PxFormulaOperator.equal + '", not "="';
        if (rest.startsWith('"')) return 'text is written in single quotes';
        return undefined;
    }

    private peek(): string | undefined {
        return this.text[this.pos];
    }

    private skipSpaces(): void {
        while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) this.pos++;
    }

    private error(reason: string): Error {
        return new Error(reason + ' at ' + this.pos + ' in "' + this.text + '"');
    }
}
