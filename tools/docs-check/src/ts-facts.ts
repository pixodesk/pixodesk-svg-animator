// What the packages' bundled `dist/index.d.ts` files say — read with the TypeScript
// compiler API so inherited members, aliases and overloads come out resolved.
import ts from 'typescript';
import { ALL_PKGS, PKG_DTS, type Pkg } from './config';
import { normalizeType, type AliasMap } from './type-text';

export interface Member {
    name: string;
    optional: boolean;
    /** `typeToString` of the member — methods print as `(…) => R` */
    type: string;
    method: boolean;
}

export interface Param { name: string; optional: boolean; type: string; }
export interface CallSig { params: Array<Param>; returnType: string; }

export interface VueComponent {
    props: Array<{ name: string; required: boolean }>;
    emits: Array<string>;
}

const FMT = ts.TypeFormatFlags.NoTruncation
    | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
    | ts.TypeFormatFlags.WriteArrayAsGenericType;

export class TsFacts {
    readonly program: ts.Program;
    readonly checker: ts.TypeChecker;
    private readonly files = new Map<Pkg, ts.SourceFile>();
    private readonly exportsCache = new Map<Pkg, Map<string, ts.Symbol>>();
    private aliasMap?: AliasMap;

    constructor() {
        this.program = ts.createProgram(ALL_PKGS.map(p => PKG_DTS[p]), {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
            jsx: ts.JsxEmit.Preserve,
            types: [],
            strict: true,
            skipLibCheck: true,
            noEmit: true,
        });
        this.checker = this.program.getTypeChecker();
        for (const p of ALL_PKGS) {
            const sf = this.program.getSourceFile(PKG_DTS[p]);
            if (!sf) throw new Error(`docs-check: ${PKG_DTS[p]} is missing — run pnpm build first`);
            this.files.set(p, sf);
        }
    }

    sourceFile(pkg: Pkg): ts.SourceFile { return this.files.get(pkg)!; }

    /** Every export of a package, alias-resolved. */
    exports(pkg: Pkg): Map<string, ts.Symbol> {
        let m = this.exportsCache.get(pkg);
        if (m) return m;
        m = new Map();
        const sf = this.sourceFile(pkg);
        const moduleSym = this.checker.getSymbolAtLocation(sf) ?? (sf as unknown as { symbol?: ts.Symbol }).symbol;
        if (moduleSym) {
            for (const s of this.checker.getExportsOfModule(moduleSym)) {
                const resolved = s.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(s) : s;
                m.set(s.name, resolved);
            }
        }
        this.exportsCache.set(pkg, m);
        return m;
    }

    exportNames(pkg: Pkg): Set<string> { return new Set(this.exports(pkg).keys()); }

    /** Where a name is exported from: the preferred package first, then the others. */
    locate(name: string, preferred?: Pkg): Pkg | undefined {
        const order = preferred ? [preferred, ...ALL_PKGS.filter(p => p !== preferred)] : ALL_PKGS;
        return order.find(p => this.exports(p).has(name));
    }

    symbol(pkg: Pkg, name: string): ts.Symbol | undefined { return this.exports(pkg).get(name); }

    /** The type behind a name: an interface / type alias / class → its declared type; a value → its type. */
    typeOf(pkg: Pkg, name: string): ts.Type | undefined {
        const s = this.symbol(pkg, name);
        if (!s) return undefined;
        if (s.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class)) {
            return this.checker.getDeclaredTypeOfSymbol(s);
        }
        return this.checker.getTypeOfSymbol(s);
    }

    isTypeAlias(pkg: Pkg, name: string): boolean {
        const s = this.symbol(pkg, name);
        return !!s && !!(s.flags & ts.SymbolFlags.TypeAlias);
    }

    isValue(pkg: Pkg, name: string): boolean {
        const s = this.symbol(pkg, name);
        return !!s && !!(s.flags & ts.SymbolFlags.Value);
    }

    typeText(t: ts.Type, pkg: Pkg): string {
        return this.checker.typeToString(t, this.sourceFile(pkg), FMT);
    }

    /** A type alias written out — the union members instead of the alias name. */
    aliasExpansion(pkg: Pkg, name: string): string | undefined {
        const t = this.typeOf(pkg, name);
        if (!t || !this.isTypeAlias(pkg, name)) return undefined;
        return this.checker.typeToString(t, this.sourceFile(pkg), FMT | ts.TypeFormatFlags.InTypeAlias);
    }

    /**
     * Every exported type alias and non-generic interface → its normalized expansion text, so a
     * doc may inline either. Self-recursive shapes (`PxNode.children: Array<PxNode>`) are left out.
     */
    aliases(): AliasMap {
        if (this.aliasMap) return this.aliasMap;
        const m = new Map<string, string>();
        for (const p of ALL_PKGS) {
            for (const [name, s] of this.exports(p)) {
                if (m.has(name)) continue;
                let exp: string | undefined;
                if (s.flags & ts.SymbolFlags.TypeAlias) {
                    exp = this.aliasExpansion(p, name);
                } else if (s.flags & ts.SymbolFlags.Interface) {
                    const t = this.checker.getDeclaredTypeOfSymbol(s) as ts.InterfaceType;
                    if (t.typeParameters?.length) continue;
                    const members = this.members(p, name) ?? [];
                    exp = `{ ${members.map(mm => `${mm.name.startsWith('[') ? `[x: ${mm.name.slice(1, -1)}]` : mm.name}${mm.optional ? '?' : ''}: ${mm.type}`).join('; ')} }`;
                }
                if (exp === undefined || exp === name) continue;
                const norm = normalizeType(exp);
                if (new RegExp(`(^|[^\\w$])${name}(?![\\w$])`).test(norm)) continue;
                m.set(name, norm);
            }
        }
        this.aliasMap = m;
        return m;
    }

    /**
     * All members of an object type, inherited ones included; `undefined` when the name is not a type.
     * A component VALUE (`const X: FC<Props>`) answers with the members of its props — the first
     * parameter of its call signature.
     */
    members(pkg: Pkg, name: string): Array<Member> | undefined {
        let t = this.typeOf(pkg, name);
        if (!t) return undefined;
        const s = this.symbol(pkg, name)!;
        if (!(s.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class))) {
            const sig = this.checker.getSignaturesOfType(t, ts.SignatureKind.Call)[0];
            const first = sig?.getParameters()[0];
            if (!first) return undefined;
            t = this.checker.getTypeOfSymbol(first);
        }
        const out: Array<Member> = [];
        for (const p of this.checker.getPropertiesOfType(t)) {
            const pt = this.checker.getTypeOfSymbol(p);
            out.push({
                name: p.name,
                optional: !!(p.flags & ts.SymbolFlags.Optional),
                type: this.typeText(pt, pkg),
                method: !!(p.flags & ts.SymbolFlags.Method),
            });
        }
        for (const info of this.checker.getIndexInfosOfType(t)) {
            out.push({
                name: `[${this.typeText(info.keyType, pkg)}]`,
                optional: false,
                type: this.typeText(info.type, pkg),
                method: false,
            });
        }
        return out;
    }

    callSignatures(pkg: Pkg, name: string): Array<CallSig> {
        const t = this.typeOf(pkg, name);
        if (!t) return [];
        return this.checker.getSignaturesOfType(t, ts.SignatureKind.Call).map(sig => ({
            params: sig.getParameters().map(p => {
                const decl = p.valueDeclaration;
                const optional = !!decl && ts.isParameter(decl) && this.checker.isOptionalParameter(decl);
                return { name: p.name, optional, type: this.typeText(this.checker.getTypeOfSymbol(p), pkg) };
            }),
            returnType: this.typeText(this.checker.getReturnTypeOfSignature(sig), pkg),
        }));
    }

    /** Keys (and literal values, where they are literals) of an exported const object. */
    constKeys(pkg: Pkg, name: string): Array<{ key: string; value?: string | number }> | undefined {
        const s = this.symbol(pkg, name);
        if (!s || !(s.flags & ts.SymbolFlags.Value)) return undefined;
        const t = this.checker.getTypeOfSymbol(s);
        return this.checker.getPropertiesOfType(t).map(p => {
            const pt = this.checker.getTypeOfSymbol(p);
            const value = pt.isStringLiteral() || pt.isNumberLiteral() ? pt.value : undefined;
            return { key: p.name, value };
        });
    }

    /**
     * A Vue component's props and emits, read from its `DefineComponent<ExtractPropTypes<{…}>, …, ("a" | "b")[], …>`
     * declaration syntactically — the generic is too deep to be worth resolving.
     */
    vueComponent(pkg: Pkg, name: string): VueComponent | undefined {
        const sf = this.sourceFile(pkg);
        let result: VueComponent | undefined;
        const visit = (node: ts.Node): void => {
            if (result) return;
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.type) {
                result = readDefineComponent(node.type);
            }
            ts.forEachChild(node, visit);
        };
        visit(sf);
        return result;
    }
}

function readDefineComponent(type: ts.TypeNode): VueComponent | undefined {
    if (!ts.isTypeReferenceNode(type) || !type.typeArguments?.length) return undefined;
    const props: VueComponent['props'] = [];
    let emits: Array<string> | undefined;
    const propsArg = type.typeArguments[0];
    const literal = ts.isTypeReferenceNode(propsArg) && propsArg.typeArguments?.[0];
    if (literal && ts.isTypeLiteralNode(literal)) {
        for (const m of literal.members) {
            if (!ts.isPropertySignature(m) || !m.name) continue;
            const pname = ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) ? m.name.text : m.name.getText();
            let required = false;
            if (m.type && ts.isTypeLiteralNode(m.type)) {
                for (const mm of m.type.members) {
                    if (ts.isPropertySignature(mm) && mm.name && mm.name.getText() === 'required' && mm.type
                        && ts.isLiteralTypeNode(mm.type) && mm.type.literal.kind === ts.SyntaxKind.TrueKeyword) required = true;
                }
            }
            props.push({ name: pname, required });
        }
    }
    for (const arg of type.typeArguments) {
        if (ts.isArrayTypeNode(arg) && ts.isParenthesizedTypeNode(arg.elementType) && ts.isUnionTypeNode(arg.elementType.type)) {
            const names = arg.elementType.type.types
                .filter(ts.isLiteralTypeNode)
                .map(l => (ts.isStringLiteral(l.literal) ? l.literal.text : undefined))
                .filter((s): s is string => !!s);
            if (names.length) { emits = names; break; }
        }
    }
    return { props, emits: emits ?? [] };
}

// ---- The doc side: a hand-written TypeScript block, read with the parser only ----------------

export interface DocMember { name: string; optional: boolean; type: string; line: number; }
export interface DocDecl {
    kind: 'interface' | 'type' | 'function' | 'const' | 'class';
    name: string;
    line: number;
    /** interface: members; const with `{…}` initializer: keys as members with type '' */
    members?: Array<DocMember>;
    /** interface: `extends A, B` names */
    extends?: Array<string>;
    /** type alias / const with a type annotation: the type text */
    type?: string;
    /** the type node of a `const X: T` declaration (for DefineComponent literals) */
    typeNode?: ts.TypeNode;
    /** function: parameters and return type text */
    params?: Array<{ name: string; optional: boolean; type: string }>;
    returnType?: string;
    hasIndexSignature?: boolean;
}

/** Top-level declarations of a doc code block. Errors of the doc's own syntax are reported as a decl-less list. */
export function parseDocBlock(text: string, firstLine: number): { decls: Array<DocDecl>; sourceFile: ts.SourceFile } {
    const sf = ts.createSourceFile('doc-block.ts', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const decls: Array<DocDecl> = [];
    const lineOf = (node: ts.Node): number => firstLine + sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    const typeText = (t: ts.TypeNode | undefined): string => (t ? t.getText(sf) : 'any');

    for (const st of sf.statements) {
        if (ts.isInterfaceDeclaration(st)) {
            const decl: DocDecl = { kind: 'interface', name: st.name.text, line: lineOf(st), members: [], extends: [] };
            for (const h of st.heritageClauses ?? []) for (const t of h.types) decl.extends!.push(t.expression.getText(sf));
            for (const m of st.members) {
                if (ts.isPropertySignature(m) && m.name) {
                    decl.members!.push({ name: nameOf(m.name, sf), optional: !!m.questionToken, type: typeText(m.type), line: lineOf(m) });
                } else if (ts.isMethodSignature(m) && m.name) {
                    const params = m.parameters.map(p => p.getText(sf)).join(', ');
                    decl.members!.push({ name: nameOf(m.name, sf), optional: !!m.questionToken, type: `(${params}) => ${typeText(m.type)}`, line: lineOf(m) });
                } else if (ts.isIndexSignatureDeclaration(m)) {
                    decl.hasIndexSignature = true;
                    const keyType = typeText(m.parameters[0]?.type);
                    decl.members!.push({ name: `[${keyType}]`, optional: false, type: typeText(m.type), line: lineOf(m) });
                }
            }
            decls.push(decl);
        } else if (ts.isTypeAliasDeclaration(st)) {
            decls.push({ kind: 'type', name: st.name.text, line: lineOf(st), type: st.type.getText(sf), typeNode: st.type });
        } else if (ts.isFunctionDeclaration(st) && st.name) {
            decls.push({
                kind: 'function', name: st.name.text, line: lineOf(st),
                params: st.parameters.map(p => ({ name: p.name.getText(sf), optional: !!p.questionToken || !!p.initializer, type: typeText(p.type) })),
                returnType: typeText(st.type),
            });
        } else if (ts.isVariableStatement(st)) {
            for (const d of st.declarationList.declarations) {
                if (!ts.isIdentifier(d.name)) continue;
                const decl: DocDecl = { kind: 'const', name: d.name.text, line: lineOf(d) };
                if (d.type) { decl.type = d.type.getText(sf); decl.typeNode = d.type; }
                if (d.initializer && ts.isObjectLiteralExpression(d.initializer)) {
                    decl.members = d.initializer.properties.map(p => ({
                        name: p.name ? nameOf(p.name, sf) : '',
                        optional: false,
                        type: ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : '',
                        line: lineOf(p),
                    }));
                }
                decls.push(decl);
            }
        } else if (ts.isClassDeclaration(st) && st.name) {
            decls.push({ kind: 'class', name: st.name.text, line: lineOf(st) });
        }
    }
    return { decls, sourceFile: sf };
}

function nameOf(name: ts.PropertyName, sf: ts.SourceFile): string {
    return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : name.getText(sf);
}

/** `import { a, b, type C } from '@pixodesk/svg-animator-x'` statements in a usage snippet. */
export function docImports(text: string): Array<{ pkg: string; names: Array<string>; line: number }> {
    const out: Array<{ pkg: string; names: Array<string>; line: number }> = [];
    const re = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@pixodesk\/svg-animator-[a-z]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const names = m[1].split(',').map(s => s.trim().replace(/^type\s+/, '').replace(/\s+as\s+.*$/, '')).filter(Boolean);
        out.push({ pkg: m[2], names, line: text.slice(0, m.index).split('\n').length });
    }
    return out;
}
