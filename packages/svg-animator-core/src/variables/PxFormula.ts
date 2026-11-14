// @px-area variables
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * BINDINGS — a static value written as a reference to variables (docs/library/variables.md).
 *
 * | Text                        | Meaning                                            |
 * |-----------------------------|----------------------------------------------------|
 * | `variable(name)`            | the variable's value, any type                     |
 * | `calc(variable(x) + 5)`     | a number computed from number variables            |
 *
 * The text is PARSED into a tree of operators once and the tree is evaluated — never `eval`, no code is ever run
 * from a file. Grammar of `calc(…)`: numbers, `variable(name)`, `+ - * /`, brackets, a leading minus.
 */

/** The four operators of `calc(…)`. @public @advanced */
export const PxFormulaOperator = {
    add: '+',
    subtract: '-',
    multiply: '*',
    divide: '/',
} as const;
export type PxFormulaOperator = typeof PxFormulaOperator[keyof typeof PxFormulaOperator];

/** A variable's value: a number, a string (colour, text, image URL, path data), a boolean, or a number list (vector,
 *  number list). @public */
export type PxVariableValue = number | string | boolean | Array<number>;

/** Reads a variable's current value by name; `undefined` when there is none. @public @advanced */
export type PxVariableReader = (name: string) => PxVariableValue | undefined;

/** One node of a parsed formula. @public @advanced */
export abstract class PxFormulaNode {
    /** The value, or `undefined` when a name has no number value or a division by zero happens. */
    abstract evaluate(read: PxVariableReader): number | undefined;
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
    print(): string { return String(this.value); }
    collectNames(): void { /* no names */ }
    rename(): PxFormulaNode { return this; }
}

/** `variable(name)` inside a formula. @public @advanced */
export class PxFormulaVariable extends PxFormulaNode {
    constructor(readonly name: string) { super(); }
    evaluate(read: PxVariableReader): number | undefined {
        const value = read(this.name);
        return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    }
    print(): string { return 'variable(' + this.name + ')'; }
    collectNames(into: Set<string>): void { into.add(this.name); }
    rename(from: string, to: string): PxFormulaNode { return this.name === from ? new PxFormulaVariable(to) : this; }
}

/** A leading minus. @public @advanced */
export class PxFormulaNegate extends PxFormulaNode {
    constructor(readonly operand: PxFormulaNode) { super(); }
    evaluate(read: PxVariableReader): number | undefined {
        const value = this.operand.evaluate(read);
        return value === undefined ? undefined : -value;
    }
    print(): string { return '-' + this.operand.print(); }
    collectNames(into: Set<string>): void { this.operand.collectNames(into); }
    rename(from: string, to: string): PxFormulaNode { return new PxFormulaNegate(this.operand.rename(from, to)); }
}

/** Two operands and an operator. @public @advanced */
export class PxFormulaBinary extends PxFormulaNode {
    constructor(readonly operator: PxFormulaOperator, readonly left: PxFormulaNode, readonly right: PxFormulaNode) { super(); }
    evaluate(read: PxVariableReader): number | undefined {
        const a = this.left.evaluate(read);
        const b = this.right.evaluate(read);
        if (a === undefined || b === undefined) return undefined;
        switch (this.operator) {
            case PxFormulaOperator.add: return a + b;
            case PxFormulaOperator.subtract: return a - b;
            case PxFormulaOperator.multiply: return a * b;
            case PxFormulaOperator.divide: return b === 0 ? undefined : a / b;
        }
    }
    print(): string { return this.printOperand(this.left, false) + ' ' + this.operator + ' ' + this.printOperand(this.right, true); }
    collectNames(into: Set<string>): void { this.left.collectNames(into); this.right.collectNames(into); }
    rename(from: string, to: string): PxFormulaNode {
        return new PxFormulaBinary(this.operator, this.left.rename(from, to), this.right.rename(from, to));
    }
    /** Brackets only where the tree needs them: a looser operator below, or the same level on the right of `-` / `/`. */
    private printOperand(node: PxFormulaNode, isRight: boolean): string {
        if (!(node instanceof PxFormulaBinary)) return node.print();
        const mine = precedenceOf(this.operator);
        const theirs = precedenceOf(node.operator);
        const needs = theirs < mine || (isRight && theirs === mine && (this.operator === PxFormulaOperator.subtract || this.operator === PxFormulaOperator.divide));
        return needs ? '(' + node.print() + ')' : node.print();
    }
}

function precedenceOf(operator: PxFormulaOperator): number {
    return operator === PxFormulaOperator.add || operator === PxFormulaOperator.subtract ? 1 : 2;
}

// ── PARSING ──────────────────────────────────────────────────────────────────────────────────────

const VARIABLE_FN = 'variable';
const CALC_FN = 'calc';
/** A user name: a letter, then letters, digits, `_`, `-`. A predefined name joins such words with dots. */
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/;
/** A user-declared name: no dots — a dotted name belongs to the player (`player.pointer`). */
const USER_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const NUMBER_PATTERN = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const BINDING_START = /^\s*(?:variable|calc)\s*\(/;

/** True for a valid name of a declared variable: a letter, then letters, digits, `_` or `-`. @public */
export function isVariableName(name: string): boolean {
    return USER_NAME_PATTERN.test(name);
}

/** True for any name a binding may read: a declared one, or a predefined one (`player.pointer.x`). @public @advanced */
export function isVariableReadName(name: string): boolean {
    return NAME_PATTERN.test(name);
}

/** True when a raw value is written as a binding — starts with `variable(` or `calc(`. It may still fail to parse.
 *  @public */
export function isBindingText(raw: unknown): raw is string {
    return typeof raw === 'string' && BINDING_START.test(raw);
}

/** A parsed binding — see the module comment. @public @advanced */
export class PxVariableBinding {
    private constructor(
        /** The parsed tree. */
        readonly root: PxFormulaNode,
        /** `calc(…)`: the result is a number. A bare `variable(name)` passes any value through. */
        readonly isFormula: boolean,
        /** Every variable the binding reads. */
        readonly names: ReadonlyArray<string>,
    ) { }

    /** The text, normalised: `variable(x)`, `calc(variable(x) + 5)`. */
    print(): string {
        return this.isFormula ? CALC_FN + '(' + this.root.print() + ')' : this.root.print();
    }

    /** The current value: a bare reference gives the variable's value as it is; a formula gives a number, or
     *  `undefined` when one of its names has no number value (or it divides by zero). */
    evaluate(read: PxVariableReader): PxVariableValue | undefined {
        if (!this.isFormula && this.root instanceof PxFormulaVariable) return read(this.root.name);
        return this.root.evaluate(read);
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
 *  is a clear error at a position. */
class FormulaParser {
    private pos = 0;

    constructor(private readonly text: string) { }

    parseBinding(): { root: PxFormulaNode; isFormula: boolean } {
        this.skipSpaces();
        if (this.readWord(CALC_FN)) {
            this.expect('(');
            const root = this.parseExpression();
            this.expect(')');
            this.expectEnd();
            return { root, isFormula: true };
        }
        const root = this.parseVariable();
        this.expectEnd();
        return { root, isFormula: false };
    }

    private parseExpression(): PxFormulaNode {
        let node = this.parseTerm();
        for (;;) {
            this.skipSpaces();
            const ch = this.peek();
            if (ch === PxFormulaOperator.add || ch === PxFormulaOperator.subtract) {
                this.pos++;
                node = new PxFormulaBinary(ch, node, this.parseTerm());
            } else return node;
        }
    }

    private parseTerm(): PxFormulaNode {
        let node = this.parseUnary();
        for (;;) {
            this.skipSpaces();
            const ch = this.peek();
            if (ch === PxFormulaOperator.multiply || ch === PxFormulaOperator.divide) {
                this.pos++;
                node = new PxFormulaBinary(ch, node, this.parseUnary());
            } else return node;
        }
    }

    private parseUnary(): PxFormulaNode {
        this.skipSpaces();
        if (this.peek() === PxFormulaOperator.subtract) {
            this.pos++;
            return new PxFormulaNegate(this.parseUnary());
        }
        return this.parsePrimary();
    }

    private parsePrimary(): PxFormulaNode {
        this.skipSpaces();
        if (this.peek() === '(') {
            this.pos++;
            const node = this.parseExpression();
            this.expect(')');
            return node;
        }
        const number = NUMBER_PATTERN.exec(this.text.slice(this.pos));
        if (number) {
            this.pos += number[0].length;
            return new PxFormulaNumber(Number(number[0]));
        }
        return this.parseVariable();
    }

    private parseVariable(): PxFormulaVariable {
        this.skipSpaces();
        if (!this.readWord(VARIABLE_FN)) throw this.error('a number, a bracket or variable(name) expected');
        this.expect('(');
        this.skipSpaces();
        const start = this.pos;
        while (this.pos < this.text.length && this.text[this.pos] !== ')' && !/\s/.test(this.text[this.pos])) this.pos++;
        const name = this.text.slice(start, this.pos);
        if (!isVariableReadName(name)) throw this.error('"' + name + '" is not a variable name');
        this.expect(')');
        return new PxFormulaVariable(name);
    }

    private readWord(word: string): boolean {
        this.skipSpaces();
        if (!this.text.startsWith(word, this.pos)) return false;
        const after = this.text.slice(this.pos + word.length).trimStart();
        if (!after.startsWith('(')) return false;
        this.pos += word.length;
        return true;
    }

    private expect(ch: string): void {
        this.skipSpaces();
        if (this.peek() !== ch) throw this.error('"' + ch + '" expected');
        this.pos++;
    }

    private expectEnd(): void {
        this.skipSpaces();
        if (this.pos < this.text.length) throw this.error('unexpected "' + this.text.slice(this.pos) + '"');
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
