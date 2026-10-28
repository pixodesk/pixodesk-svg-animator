// @px-area schema
/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

/**
 * Lightweight Zod-like schema system — type declaration + runtime sanitization.
 *
 * Two operations per schema:
 *   isValid(raw)     — true only when raw already conforms; no repair needed.
 *   sanitize(raw)    — always returns T; fixes or replaces invalid input with defaults.
 *
 * Field rules inside px.object():
 *   required field   → if absent/invalid, field's declared default is used.
 *   optional field   → if absent/invalid (or wrong JS type), field becomes undefined.
 *
 * Array: items that cannot even be attempted are filtered out.
 * Record: values that cannot even be attempted are dropped.
 *
 * The distinction between isValid and _canSanitize:
 *   isValid        — strict; ALL fields must be correct, no repairs accepted.
 *   _canSanitize   — permissive; "is the JS type right enough to attempt repair?"
 *                    For containers (object/array/record) this is a structural check
 *                    so that partially-valid nested objects are sanitized rather than dropped.
 *                    For primitives it equals isValid (a wrong primitive type is unrecoverable).
 *
 * Validation context (optional):
 *   Pass a PxValidationContext as the second arg to isValid() to collect per-field
 *   error and warning messages with their dot-paths.
 *   e.g. schema.isValid(raw, ctx, []) where ctx = { errors: [], warnings: [] }
 *   Path segments are pushed/popped during recursion; join with '.' only when reporting.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The reason text a STRICT closed object reports for an undeclared key — `"<dot.path>: <this>"`.
 *
 * Exported because it is the one validation finding that carries a MEANING beyond "invalid":
 * a key this build does not declare is a key some other build wrote, which is the signal a
 * reader turns into "written for a newer schema — update your player/editor". Callers match on
 * this constant rather than on a copy of the sentence.
 * @internal
 */
export const PX_UNKNOWN_KEY_ERROR = 'unexpected extra key';

/** What a validation error IS, independent of its wording. Code branches on this; the lines in
 *  `errors` are for people. @public @advanced */
export enum PxValidationFindingKind {
    /** A closed object met a key the schema does not declare (`strict`). The one finding that says
     *  "a newer writer produced this document". */
    unknownKey = 'unknownKey',
    /** Not the type the schema wants (string / number / boolean / object / array / tuple…). */
    typeMismatch = 'typeMismatch',
    /** The right type, but not an accepted value (`px.literal`, `px.enum`). */
    invalidValue = 'invalidValue',
    /** A required value is absent. */
    missingValue = 'missingValue',
    /** A NAME that resolves to no definition: a glyph font face with no `definitions.fonts` entry,
     *  an easing name with no `definitions.easings` entry. */
    missingReference = 'missingReference',
    /** No member of a `px.union` / `px.discriminatedUnion` took the value. The best-matching
     *  member's own findings sit in `memberFindings`: a diagnosis of THIS malformed value, nested
     *  so they never read as the document's own findings. */
    unionMismatch = 'unionMismatch',
}

/** One validation error, structured — the twin of the `errors` line, pushed to
 *  `PxValidationContext.findings` at the same moment. @public @advanced */
export interface PxValidationFinding {
    readonly kind: PxValidationFindingKind;
    /** The failing value's path segments (`['children', '[0]', 'opacity']` — rendered as `children[0].opacity`). */
    readonly path: ReadonlyArray<string>;
    /** The reason alone — what the line says after `<path>: `. */
    readonly reason: string;
    /** The `errors` line itself: `<path>: <reason>`. */
    readonly message: string;
    /** `typeMismatch` / `invalidValue`: what was expected, as the reason names it (`finite number`, `one of "a" | "b"`). */
    readonly expected?: string;
    /** `unionMismatch` (`px.union`): the best-matching member's findings, bounded like the text (UNION_MEMBER_ERROR_LIMIT). */
    readonly memberFindings?: ReadonlyArray<PxValidationFinding>;
}

/** Collects structured validation feedback. Pass to isValid() as the second argument. @public @advanced */
export interface PxValidationContext {
    /** Per-field errors — each entry is "<dot.path>: <reason>". */
    errors: Array<string>;
    /** Per-field warnings — same format as errors but non-fatal. */
    warnings: Array<string>;
    /** The structured twin of `errors`, one {@link PxValidationFinding} per line, when the caller
     *  wants to BRANCH on what went wrong (its `kind` and `path`) rather than read it. Optional:
     *  a context without it gets the text only. */
    findings?: Array<PxValidationFinding>;
    /**
     * When true, closed objects (`px.object` / `px.extendedObject`) report any
     * extra (undeclared) keys as errors. Default `false` (or omitted) — extras
     * are ignored, matching `sanitize`'s strip-extras behavior, which is what
     * production app code wants (forward-compat with unknown future fields).
     * Tests that want to lock the wire shape down to its declared schema
     * should pass `strict: true`.
     *
     * Open objects (`px.openObject`) are unaffected by `strict` — they accept
     * extras by design (used for SVG element nodes that carry arbitrary attrs).
     */
    strict?: boolean;
}

/** @public @advanced */
export interface PxSchema<T, IsOptional extends boolean = false, StatesDefault extends boolean = boolean> {
    /** Phantom discriminator — `false` for required schemas, `true` for optional. Used by InferShape. */
    readonly _optional: IsOptional;
    sanitize(raw: unknown): T;
    /**
     * Returns true when raw already conforms to this schema.
     * Pass an optional PxValidationContext to collect per-field error messages.
     * Pass a mutable Array<string> as `path` — segments are pushed/popped during
     * recursion so only a single array allocation is needed per validation call.
     */
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean;
    /** True if raw has the right structure to attempt sanitization (may still need repair). */
    _canSanitize(raw: unknown): boolean;
    readonly _default: T;
    /** Whether `_default` was STATED (`px.enum([...], x)`, `px.number(x)`) rather than implied by
     *  position or type — carried in the type, so an object schema can offer its stated ones as
     *  `defaults`. Only a stated default is what an ABSENT optional field means. */
    readonly _statesDefault: StatesDefault;
    /**
     * What the field means when a document LEAVES IT OUT — the value every reader must fall back
     * to (the player normalises to it, the Editor's model defaults to it). `undefined` when the
     * schema states none: absent then simply means unset. Readers ask the OBJECT schema instead:
     * `PxTimeTimelineSchema.defaults.beforeStart` is typed, and only stated fields are keys of it.
     */
    absentDefault(): T | undefined;
    /** Returns a new schema that marks this field as optional (?: in object shapes). */
    optional(): PxSchema<T | undefined, true, StatesDefault>;
    /** Narrowing guard: true when `raw` is a `T`. A value `castOrFix` stamped answers at once. */
    is(raw: unknown): raw is T;
    /** `raw` as a `T`, or throws {@link PxSchemaCastError} naming every problem with its path. */
    cast(raw: unknown): T;
    /** `raw` as a `T`, or `null`. */
    castOrNull(raw: unknown): T | null;
    /**
     * ONE visit: a NEW tree with every declared value checked and repaired, every object and array in
     * it stamped as checked — later `is` / `cast*` on it answer from the stamp. Lenient: undeclared
     * keys are kept untouched. The input is never modified; a stamped tree comes back as it is.
     */
    castOrFix(raw: unknown): PxCastResult<T>;
    /** The one-visit worker behind `castOrFix` — builds the copy, counts repairs in `run`. @internal */
    _fix(raw: unknown, run: PxFixRun): T;
    /** Its own structure, for walkers — see {@link PxSchemaDesc}. @internal */
    describe(): PxSchemaDesc;
}

/**
 * A schema of SOME value — the type of "any schema" in lists and constraints. Exact, not loose:
 * `PxSchema<T>` only ever PRODUCES a `T` (never takes one in), so every schema is one of these.
 * @public @advanced
 */
export type PxAnySchema = PxSchema<unknown, boolean, boolean>;

/** What {@link PxSchema.castOrFix} returns: the checked value and what had to be repaired. @public @advanced */
export interface PxCastResult<T> {
    readonly value: T;
    /** One finding per repair (empty when the input was already valid). */
    readonly problems: ReadonlyArray<PxValidationFinding>;
    /** The same problems as `<path>: <reason>` lines. */
    readonly errors: ReadonlyArray<string>;
}

/** Repair counter threaded through `_fix`. @internal */
export interface PxFixRun { repairs: number }

/** Thrown by {@link PxSchema.cast}: the value does not match; `errors` / `findings` say where. @public @advanced */
export class PxSchemaCastError extends Error {
    constructor(readonly errors: ReadonlyArray<string>, readonly findings: ReadonlyArray<PxValidationFinding>) {
        super('value does not match the schema' + (errors.length ? ':\n  ' + errors.slice(0, 8).join('\n  ') + (errors.length > 8 ? '\n  …' : '') : ''));
        this.name = 'PxSchemaCastError';
    }
}

/** Extract the TypeScript type from a schema. @public @advanced */
export type PxInfer<S> = S extends PxSchema<infer T, boolean> ? T : never;

/**
 * Removes string/number index signatures from T, leaving only explicitly named properties.
 * Useful for strict property-access checking on types that have an open `[key: string]: unknown`.
 *
 * @example
 * type Strict = PxRemoveIndex<PxDocument>;
 * Strict['animator']   // PxAnimatorConfig | undefined  ✓
 * Strict['anything']   // compile error  ✓
 * @public @advanced
 */
export type PxRemoveIndex<T> = {
    [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K]
};


// ─────────────────────────────────────────────────────────────────────────────
// Internal path helper
// ─────────────────────────────────────────────────────────────────────────────

// Joins path segments into a dot-path string for error messages.
// Segments starting with '[' are appended without a leading dot.
// e.g. ['obj', 'key'] -> 'obj.key'   ['arr', '[0]'] -> 'arr[0]'   [] -> '.'
/** One error, two forms pushed together: the line for people (`errors`) and the finding for code
 *  (`findings`, when the context collects them). No-op without a context; `once` skips a line the
 *  context already holds (the document-level checks report each mistake once). @internal */
export function reportValidationError(ctx: PxValidationContext | undefined, path: ReadonlyArray<string> | undefined, kind: PxValidationFindingKind, reason: string,
    extra?: { expected?: string; memberFindings?: ReadonlyArray<PxValidationFinding>; once?: boolean }): void {
    if (!ctx) return;
    const p = path ? [...path] : [];
    const message = pathStr(p) + ': ' + reason;
    if (extra?.once && ctx.errors.includes(message)) return;
    ctx.errors.push(message);
    ctx.findings?.push({
        kind, path: p, reason, message,
        ...(extra?.expected !== undefined && { expected: extra.expected }),
        ...(extra?.memberFindings && { memberFindings: extra.memberFindings }),
    });
}

/** The `expected <this>, got <that>` family — `expected` also travels on the finding, so a union can
 *  fold its members' expectations without re-reading the text. */
function reportExpected(ctx: PxValidationContext | undefined, path: ReadonlyArray<string> | undefined, kind: PxValidationFindingKind, expected: string, got: string): void {
    reportValidationError(ctx, path, kind, 'expected ' + expected + ', got ' + got, { expected });
}

/** How deep a finding reaches — its own path, or a nested member diagnosis if that goes further. */
function findingDepth(f: PxValidationFinding): number {
    return Math.max(f.path.length, ...(f.memberFindings ?? []).map(findingDepth));
}

function pathStr(path: Array<string>): string {
    if (!path.length) return '.';
    let result = '';
    for (const seg of path) {
        if (seg.startsWith('[')) result += seg;
        else result += (result ? '.' : '') + seg;
    }
    return result;
}


// ─────────────────────────────────────────────────────────────────────────────
// Base — default _canSanitize = isValid (correct for primitives)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Type stamps — "this object was checked against these schemas"
//   - written only on objects/arrays `castOrFix` CREATED (never on an input);
//   - non-enumerable Symbol: invisible to JSON, Object.keys, spread and clones —
//     a copy is unstamped and gets checked again;
//   - `Symbol()` is per module instance: another copy of the library never trusts it.
// ─────────────────────────────────────────────────────────────────────────────

const PX_SCHEMA_STAMP: unique symbol = Symbol('pxSchemaStamp');
type StampHolder = { [PX_SCHEMA_STAMP]?: Array<object> };

/** True when `raw` is an object stamped as checked against `schema`. */
function isStampedFor(raw: unknown, schema: object): boolean {
    return raw !== null && typeof raw === 'object' && !!(raw as StampHolder)[PX_SCHEMA_STAMP]?.includes(schema);
}
/** True when `raw` carries any stamp — i.e. `castOrFix` created it. */
function isStampedObject(raw: unknown): boolean {
    return raw !== null && typeof raw === 'object' && !!(raw as StampHolder)[PX_SCHEMA_STAMP];
}
function stamp(obj: object, schema: object): void {
    const list = (obj as StampHolder)[PX_SCHEMA_STAMP];
    if (list) { if (!list.includes(schema)) list.push(schema); }
    else Object.defineProperty(obj, PX_SCHEMA_STAMP, { value: [schema], enumerable: false, configurable: true });
}

/** Shared base; overrides _canSanitize only when the structural check must differ from isValid. */
abstract class Base<T, IsOptional extends boolean = false, D extends boolean = false> implements PxSchema<T, IsOptional, D> {
    // `declare` emits no runtime code; purely satisfies the interface's phantom _optional property.
    declare readonly _optional: IsOptional;
    abstract sanitize(raw: unknown): T;
    abstract isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean;
    abstract readonly _default: T;
    /** Structural schemas (objects, arrays, unions of objects…) pass `false`: they state no scalar default. */
    constructor(readonly _statesDefault: D) {}

    _canSanitize(raw: unknown): boolean { return this.isValid(raw); }

    /** A REQUIRED field is never absent; its default is the repair value. */
    absentDefault(): T | undefined { return this._default; }

    optional(): PxSchema<T | undefined, true, D> { return new Optional(this); }

    is(raw: unknown): raw is T { return isStampedFor(raw, this) || this.isValid(raw); }

    cast(raw: unknown): T {
        if (this.is(raw)) return raw;
        const ctx = { errors: [] as Array<string>, warnings: [] as Array<string>, findings: [] as Array<PxValidationFinding> };
        this.isValid(raw, ctx, []);
        throw new PxSchemaCastError(ctx.errors, ctx.findings);
    }

    castOrNull(raw: unknown): T | null { return this.is(raw) ? raw : null; }

    castOrFix(raw: unknown): PxCastResult<T> {
        if (isStampedFor(raw, this)) return { value: raw as T, problems: [], errors: [] };
        const run: PxFixRun = { repairs: 0 };
        const value = this._fix(raw, run);
        if (!run.repairs) return { value, problems: [], errors: [] };
        // The rare path: say what was repaired, with the exact findings `isValid` reports.
        const ctx = { errors: [] as Array<string>, warnings: [] as Array<string>, findings: [] as Array<PxValidationFinding> };
        this.isValid(raw, ctx, []);
        return { value, problems: ctx.findings, errors: ctx.errors };
    }

    /** Scalars: the value itself when valid, else the repair `sanitize` makes. Containers override. */
    _fix(raw: unknown, run: PxFixRun): T {
        if (this.isValid(raw)) return raw as T;
        run.repairs++;
        return this.sanitize(raw);
    }

    /** Scalars, literals, enums, `any`: nothing to walk. Containers override. */
    describe(): PxSchemaDesc { return { kind: 'leaf' }; }

    /** Stamps a container `_fix` built — at once when nothing was repaired inside it, else only
     *  after checking the repaired result (so a stamp never vouches for an invalid value). */
    protected _seal<V extends object>(out: V, clean: boolean): V {
        if (clean || this.isValid(out)) stamp(out, this);
        return out;
    }
}

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
/** A plain (non-array) object, read by string key — what object, record and union schemas walk. */
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);


// ─────────────────────────────────────────────────────────────────────────────
// Optional wrapper
// Uses _canSanitize (not isValid) so that partially-valid nested objects are
// repaired rather than dropped entirely.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps any schema to make its value optional.
 * sanitize uses _canSanitize (not isValid) so partially-valid objects are repaired, not dropped.
 */
class Optional<T, D extends boolean> extends Base<T | undefined, true, D> {
    readonly _default = undefined as T | undefined;
    constructor(private readonly inner: PxSchema<T, boolean, D>) { super(inner._statesDefault); }
    /** Absent means the inner schema's STATED default — or nothing at all when it states none. */
    override absentDefault(): T | undefined { return this.inner._statesDefault ? this.inner._default : undefined; }

    sanitize(raw: unknown): T | undefined {
        if (raw === undefined || raw === null) return undefined;
        return this.inner._canSanitize(raw) ? this.inner.sanitize(raw) : undefined;
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (raw === undefined || raw === null) return true;
        return this.inner.isValid(raw, ctx, path);
    }

    override _canSanitize(raw: unknown): boolean {
        return raw === undefined || raw === null || this.inner._canSanitize(raw);
    }

    /** Exact type: `undefined` or an inner value (a wire `null` is repaired to `undefined` by `castOrFix`). */
    override is(raw: unknown): raw is T | undefined { return raw === undefined || this.inner.is(raw); }

    override _fix(raw: unknown, run: PxFixRun): T | undefined {
        if (raw === undefined || raw === null) return undefined;
        if (!this.inner._canSanitize(raw)) { run.repairs++; return undefined; }
        return this.inner._fix(raw, run);
    }

    override describe(): PxSchemaDesc { return { kind: 'optional', inner: this.inner }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Primitives — _canSanitize = isValid (a wrong primitive type is unrecoverable)
// ─────────────────────────────────────────────────────────────────────────────

/** String schema; wrong type is unrecoverable so _canSanitize = isValid (inherited default). */
class Str<D extends boolean> extends Base<string, false, D> {
    constructor(readonly _default: string, statesDefault: D) { super(statesDefault); }
    sanitize(raw: unknown): string { return typeof raw === 'string' ? raw : this._default; }
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (typeof raw === 'string') return true;
        reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'string', typeof raw);
        return false;
    }
}

/** Finite-number schema; rejects NaN and ±Infinity as unrecoverable. */
class Num<D extends boolean> extends Base<number, false, D> {
    constructor(readonly _default: number, statesDefault: D) { super(statesDefault); }
    sanitize(raw: unknown): number {
        return typeof raw === 'number' && isFinite(raw) ? raw : this._default;
    }
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (typeof raw === 'number' && isFinite(raw)) return true;
        reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'finite number', JSON.stringify(raw));
        return false;
    }
}

/** Boolean schema. */
class Bool<D extends boolean> extends Base<boolean, false, D> {
    constructor(readonly _default: boolean, statesDefault: D) { super(statesDefault); }
    sanitize(raw: unknown): boolean { return typeof raw === 'boolean' ? raw : this._default; }
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (typeof raw === 'boolean') return true;
        reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'boolean', typeof raw);
        return false;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Literal — exact value match; default is the literal itself
// ─────────────────────────────────────────────────────────────────────────────

/** Matches one exact primitive value; its _default is the value itself. */
class Literal<T extends string | number | boolean> extends Base<T, false, true> {
    readonly _default: T;
    /** A literal IS its own value: absent means it. */
    constructor(private readonly value: T) { super(true); this._default = value; }
    sanitize(raw: unknown): T { return raw === this.value ? this.value : this._default; }
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (raw === this.value) return true;
        reportExpected(ctx, path, PxValidationFindingKind.invalidValue, JSON.stringify(this.value), JSON.stringify(raw));
        return false;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Enum — union of string/number literals; default is first value
// ─────────────────────────────────────────────────────────────────────────────

/** Union of string/number literals; _default is the first value unless overridden. */
class Enum<T extends string | number, D extends boolean> extends Base<T, false, D> {
    readonly _default: T;
    constructor(private readonly values: readonly T[], defaultVal: T | undefined, statesDefault: D) {
        super(statesDefault);
        this._default = defaultVal ?? values[0];
    }
    sanitize(raw: unknown): T { return this.values.includes(raw as T) ? (raw as T) : this._default; }
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (this.values.includes(raw as T)) return true;
        reportExpected(ctx, path, PxValidationFindingKind.invalidValue, 'one of ' + this.values.map(v => JSON.stringify(v)).join(' | '), JSON.stringify(raw));
        return false;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Union — first matching schema wins
// _canSanitize: true if any member can attempt sanitization
// ─────────────────────────────────────────────────────────────────────────────

/** How many of the best-matching member's errors a failed union appends after its headline
 *  (review §2.8). Enough to name the offending key and its neighbours, short of a wall. */
const UNION_MEMBER_ERROR_LIMIT = 4;

/** Tries member schemas in order; first whose isValid passes wins. sanitize returns _default when none match. */
class Union<T, D extends boolean> extends Base<T, false, D> {
    readonly _default: T;
    constructor(private readonly schemas: ReadonlyArray<PxSchema<T>>, defaultVal: T | undefined, statesDefault: D) {
        super(statesDefault);
        this._default = defaultVal ?? schemas[0]._default;
    }
    sanitize(raw: unknown): T {
        for (const s of this.schemas) {
            if (s.isValid(raw)) return s.sanitize(raw);
        }
        return this._default;
    }
    override _fix(raw: unknown, run: PxFixRun): T {
        if (isStampedFor(raw, this)) return raw as T;   // already checked — reuse, never rebuild
        // ≡ sanitize's "first member whose isValid passes": the first member that fixes with ZERO
        // repairs. A member whose cheap structural check fails cannot be valid — skipped.
        for (const s of this.schemas) {
            if (!s._canSanitize(raw)) continue;
            const trial: PxFixRun = { repairs: 0 };
            const v = s._fix(raw, trial);
            if (!trial.repairs) {
                if (isStampedObject(v)) stamp(v as object, this);   // only objects WE built — never an input passed through
                return v;
            }
        }
        run.repairs++;
        return this._default;
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (!ctx?.strict && isStampedFor(raw, this)) return true;
        // Members see the MODE but NOT the caller's error sink (V6). Two separate
        // things were bundled in `ctx`: passing it whole made every non-matching
        // branch push errors even when a later branch matched; passing nothing at
        // all left `strict` inert inside every union. A scratch ctx carries the
        // flags and swallows the per-branch noise.
        const probe: PxValidationContext | undefined = ctx && { errors: [], warnings: [], strict: ctx.strict };
        if (this.schemas.some(s => s.isValid(raw, probe, path ? [...path] : undefined))) return true;
        if (!ctx) return false;

        const basePath = path ?? [];

        // Say WHY (review §2.8). The headline alone reads the same for a `keyframes`/`keyframe`
        // typo, for short `t`/`v` keys and for a plain type mismatch, so an entry diagnostic — or
        // an LLM repair loop — got no pointer to the fix. Re-run each member into its OWN sink and
        // report the one that got FURTHEST into the value (the deepest finding path): the likeliest
        // intended shape.
        //
        // Not every member's errors: the real unions run to 11 alternatives
        // (`PxKeyframeValueSchema`), so a typo inside one object member would arrive
        // buried under ten "expected string, got object" lines.
        let best: { errors: Array<string>; findings: Array<PxValidationFinding> } | undefined;
        let bestDepth = -1;
        const leafExpectations: Array<string> = [];

        for (const member of this.schemas) {
            const sink = { errors: [] as Array<string>, warnings: [] as Array<string>, findings: [] as Array<PxValidationFinding>, strict: ctx.strict };
            member.isValid(raw, sink, [...basePath]);
            if (!sink.findings.length) continue;   // cannot happen (it failed), but keeps this total

            // How far in did it get? A member that descended reports at a LONGER path than the union's own.
            const depth = Math.max(...sink.findings.map(findingDepth));
            if (depth > bestDepth || (depth === bestDepth && best && sink.findings.length < best.findings.length)) {
                bestDepth = depth;
                best = sink;
            }
            // A member that stayed at the union's own path is a shape mismatch, not a
            // near-miss: collect just its expectation for the folded line below.
            if (depth <= basePath.length) {
                for (const f of sink.findings) {
                    if (f.expected !== undefined && !leafExpectations.includes(f.expected)) leafExpectations.push(f.expected);
                }
            }
        }

        // ONE finding for the union, with the member diagnosis NESTED under it: those findings
        // describe this malformed value, and must never read as the document's own (an "extra
        // key" inside a tried member is not a newer writer).
        const descended = best && bestDepth > basePath.length ? best : undefined;
        reportValidationError(ctx, basePath, PxValidationFindingKind.unionMismatch,
            'no union member matched for value ' + (JSON.stringify(raw) ?? '').slice(0, 240),
            descended ? { memberFindings: descended.findings.slice(0, UNION_MEMBER_ERROR_LIMIT) } : undefined);

        if (descended) {
            // One member reached inside the value — its lines ARE the diagnosis (text only here;
            // the structured form sits on the headline finding).
            for (const e of descended.errors.slice(0, UNION_MEMBER_ERROR_LIMIT)) {
                if (!ctx.errors.includes(e)) ctx.errors.push(e);
            }
        } else if (leafExpectations.length) {
            // Nothing descended: one line naming every shape this slot accepts.
            ctx.errors.push(pathStr(basePath) + ': expected ' + leafExpectations.join(' | '));
        }
        return false;
    }
    override _canSanitize(raw: unknown): boolean { return this.schemas.some(s => s._canSanitize(raw)); }
    override describe(): PxSchemaDesc { return { kind: 'union', members: this.schemas }; }
}

// Infers the union of all member types from a tuple of schemas.
// Mapped-then-indexed, NOT `T extends ReadonlyArray<PxSchema<infer U>>`: the latter
// gives TS one inference site for the whole array, so it collapses a heterogeneous
// union to a single member (in practice the object branch) and the bare statics
// vanish from the inferred type — `px.union([px.number(), px.object(…)])` typed as
// the object alone. Per-position inference unions them properly (V6/Q1).
type UnionMembers<T extends ReadonlyArray<PxAnySchema>> = {
    [K in keyof T]: T[K] extends PxSchema<infer U, boolean> ? U : never
}[number];

/** `UnionMembers<T>` is BY DEFINITION what `T`'s members produce — TypeScript cannot follow the mapped
 *  type back to the array it came from, so the union factories state it here, once. */
function asMembersOf<T extends ReadonlyArray<PxAnySchema>>(schemas: T): ReadonlyArray<PxSchema<UnionMembers<T>>> {
    return schemas as ReadonlyArray<PxSchema<UnionMembers<T>>>;
}

// NOTE: this only works because `px.union` / `px.discriminatedUnion` declare their
// schema list as `const T` (Q1). Without the modifier TS infers the argument as a
// plain ARRAY and unifies the element type to one `PxSchema<…>`, so `keyof T` has a
// single member to map and the union collapses to whichever branch won unification —
// in practice the last object branch, silently dropping every bare-static member
// (`px.union([tuple, …, propAnim])` typed as propAnim alone). Source-level checks and
// the emitted .d.ts both went wrong, so the dist types rejected legal wire values.


// ─────────────────────────────────────────────────────────────────────────────
// DiscriminatedUnion — routes by a literal key field, not first-match order
// ─────────────────────────────────────────────────────────────────────────────

// `undefined` admitted: a member may declare its discriminant `.optional()` (see `_absentMember`).
type AnyDiscriminantShape<K extends string> = Record<K, PxSchema<string | number | boolean | undefined, boolean>>;

/**
 * Reads `raw[key]`, finds the member schema whose literal matches that value,
 * then delegates sanitize/isValid to that member. Falls back to the first
 * member for sanitize when no match is found.
 */
class DiscriminatedUnion<T> extends Base<T> {
    readonly _default: T;
    private readonly _map: Map<string | number | boolean, PxSchema<T>>;
    /** The member an ABSENT discriminant selects — the `absent` member given to the factory (it does not
     *  declare the key at all), else the one whose discriminant slot is `.optional()` (e.g. `timeline.type`
     *  omitted = the time-driven timeline). */
    private readonly _absentMember: PxSchema<T> | undefined;

    private readonly _schemas: ReadonlyArray<PxSchema<T>>;

    constructor(
        private readonly _key: string,
        members: ReadonlyArray<{ schema: PxSchema<T>; shape: AnyDiscriminantShape<string> }>,
        absent?: PxSchema<T>,
    ) {
        super(false);
        // the absent member first: it is also what an unknown discriminant is repaired into
        this._schemas = absent ? [absent, ...members.map(m => m.schema)] : members.map(m => m.schema);
        this._default = this._schemas[0]._default;
        this._map = new Map();
        this._absentMember = absent;
        for (const { schema: s, shape } of members) {
            const keySchema = shape[_key];
            if (!keySchema) continue;
            // The literal's value — what an absent key means for an optional one too (a literal STATES it).
            const value = keySchema.absentDefault();
            if (value !== undefined) this._map.set(value, s);
            // An optional discriminant: this member is the one to use when the key is missing.
            if (!absent && keySchema.describe().kind === 'optional') this._absentMember = s;
        }
    }

    private _findSchema(raw: unknown): PxSchema<T> | undefined {
        if (!isRecord(raw)) return undefined;
        const val = raw[this._key];
        if (val === undefined || val === null) return this._absentMember;
        return typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? this._map.get(val) : undefined;
    }

    sanitize(raw: unknown): T {
        return (this._findSchema(raw) ?? this._schemas[0]).sanitize(raw);
    }

    override _fix(raw: unknown, run: PxFixRun): T {
        if (isStampedFor(raw, this)) return raw as T;   // already checked — reuse, never rebuild
        const schema = this._findSchema(raw);
        if (!schema) run.repairs++;
        const v = (schema ?? this._schemas[0])._fix(raw, run);
        if (schema && isStampedFor(v, schema)) stamp(v as object, this);
        return v;
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (!ctx?.strict && isStampedFor(raw, this)) return true;
        const schema = this._findSchema(raw);
        if (!schema) {
            const val = isRecord(raw) ? raw[this._key] : undefined;
            reportValidationError(ctx, path, PxValidationFindingKind.unionMismatch,
                'no discriminated union member matched ' + this._key + '=' + JSON.stringify(val));
            return false;
        }
        return schema.isValid(raw, ctx, path);
    }

    override _canSanitize(raw: unknown): boolean {
        if (!isRecord(raw)) return false;
        const schema = this._findSchema(raw);
        return schema ? schema._canSanitize(raw) : this._schemas[0]._canSanitize(raw);
    }

    override describe(): PxSchemaDesc { return { kind: 'discriminatedUnion', key: this._key, members: this._schemas }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Object — strips unknown keys; required fields use default, optional → undefined
// _canSanitize: true when raw is a plain (non-array) object
// ─────────────────────────────────────────────────────────────────────────────

type AnyShape = Record<string, PxAnySchema>;

/** The keys of a shape whose schema STATES what absent means. */
type StatedKeys<S extends AnyShape> = { [K in keyof S]: S[K] extends PxSchema<unknown, boolean, true> ? K : never }[keyof S];

/**
 * WHAT EACH FIELD MEANS WHEN A DOCUMENT LEAVES IT OUT — one entry per field whose schema states it
 * (`px.enum([...], x)`, `px.number(x)`, a literal), typed without `undefined`. A field that states
 * none (absent = unset, e.g. `clone.without`) is not a key, so asking for it does not compile — and
 * neither does a key the schema has since renamed. The ONE source every reader shares: the player
 * normalises an absent field to it, the Editor's model defaults to it.
 */
type InferDefaults<S extends AnyShape> = { readonly [K in StatedKeys<S>]: Exclude<PxInfer<S[K]>, undefined> };

/** A closed or open object schema, with its shape and its stated {@link InferDefaults}. */
type ObjectSchema<T, S extends AnyShape> = PxSchema<T> & { readonly _shape: S; readonly defaults: InferDefaults<S> };

function statedDefaults<S extends AnyShape>(shape: S): InferDefaults<S> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) if (shape[key]._statesDefault) out[key] = shape[key].absentDefault();
    return Object.freeze(out) as InferDefaults<S>;
}

// Required keys: IsOptional=false → plain property.
// Optional keys: IsOptional=true  → ?:, with Exclude<T,undefined> (?: already adds undefined).
type InferShape<S extends AnyShape> =
    { [K in keyof S as S[K] extends PxSchema<unknown, true> ? never : K]: PxInfer<S[K]> } &
    { [K in keyof S as S[K] extends PxSchema<unknown, true> ? K : never]?: Exclude<PxInfer<S[K]>, undefined> };

/** The ONE place an object is built key by key from a shape — a loop cannot prove to TypeScript that it
 *  produced the mapped type, so the builders state it here. */
const asBuilt = <T>(built: Record<string, unknown>): T => built as T;

/** Each declared key's schema default — an object schema's own `_default`. */
function shapeDefaults(shape: AnyShape): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) d[key] = shape[key]._default;
    return d;
}

/**
 * Typed object schema; strips unknown keys, repairs required fields via their defaults.
 * _canSanitize checks structure only (non-array object) so partially-valid objects are repaired.
 */
class Obj<S extends AnyShape> extends Base<InferShape<S>> {
    readonly _default: InferShape<S>;
    /** What each field means when a document leaves it out — see {@link InferDefaults}. */
    readonly defaults: InferDefaults<S>;

    constructor(readonly _shape: S) {
        super(false);
        this._default = asBuilt(shapeDefaults(_shape));
        this.defaults = statedDefaults(_shape);
    }

    sanitize(raw: unknown): InferShape<S> {
        const src = isRecord(raw) ? raw : {};
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(this._shape)) {
            const v = this._shape[key].sanitize(src[key]);
            // An OPTIONAL key that was absent sanitizes to `undefined`. Writing it anyway
            // produced a "phantom" own key — invisible to JSON, but NOT to `Object.keys`,
            // and consumers branch on that: `PxOffsetPathMaterializer` bails when a transform
            // carries keys beyond translate/origin, so phantoms silently disabled the CSS
            // Motion Path path, and `contentRefSplit` emitted `transform=""`. Measured across
            // 135 real documents: 16,367 phantoms, changing the render of 10 of them.
            if (v !== undefined) out[key] = v;
        }
        return asBuilt(out);
    }

    /** One visit: declared keys checked and repaired, undeclared keys KEPT as they are (lenient —
     *  unlike `sanitize`), input key order preserved; no phantom `undefined` keys. */
    override _fix(raw: unknown, run: PxFixRun): InferShape<S> {
        if (isStampedFor(raw, this)) return raw as InferShape<S>;   // already checked — reuse, never rebuild
        const before = run.repairs;
        if (!isRecord(raw)) run.repairs++;
        const src = isRecord(raw) ? raw : {};
        const shape: AnyShape = this._shape;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(src)) {
            const v = hasOwn(shape, key) ? shape[key]._fix(src[key], run) : src[key];
            if (v !== undefined) out[key] = v;
        }
        for (const key of Object.keys(shape)) {
            if (hasOwn(src, key)) continue;
            const v = shape[key]._fix(undefined, run);
            if (v !== undefined) out[key] = v;
        }
        return asBuilt(this._seal(out, run.repairs === before));
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (!ctx?.strict && isStampedFor(raw, this)) return true;
        if (!isRecord(raw)) {
            reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'object', Array.isArray(raw) ? 'array' : typeof raw);
            return false;
        }
        const obj = raw;
        const p = path ?? [];
        let ok = true;
        for (const key of Object.keys(this._shape)) {
            p.push(key);
            if (!this._shape[key].isValid(obj[key], ctx, p)) ok = false;
            p.pop();
        }
        // Strict mode: closed objects reject extra (undeclared) keys.
        // Default mode silently ignores them (matching `sanitize`'s strip-extras).
        if (ctx?.strict) {
            for (const key of Object.keys(obj)) {
                if (key in this._shape) continue;
                // An undefined-valued key is indistinguishable from an absent one for
                // every consumer, and JSON.stringify drops it — strict judges the
                // DOCUMENT, not the in-memory object that produced it (V6). Without
                // this, validating a freshly-built (pre-serialization) object flags
                // phantom keys that cannot exist on the wire.
                if (obj[key] === undefined) continue;
                p.push(key);
                reportValidationError(ctx, p, PxValidationFindingKind.unknownKey, PX_UNKNOWN_KEY_ERROR);
                p.pop();
                ok = false;
            }
        }
        return ok;
    }

    override _canSanitize(raw: unknown): boolean { return isRecord(raw); }

    override describe(): PxSchemaDesc { return { kind: 'shape', shape: this._shape }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// OpenObj — like Obj but passes unknown keys through unchanged (or validates/sanitizes
// them against an optional open-value schema).
// Known keys are validated/sanitized; unknown keys are passed through as-is when no
// open schema is given, or validated/sanitized against the open schema when one is provided.
// Inferred type: InferShape<S> & { [key: string]: unknown } — an undeclared key is KEPT, not typed:
// read it through the open-value schema (`PxAttrValueSchema.castOrNull(node.fill)`). `unknown`, not
// `V`: TypeScript would demand that every DECLARED key's value also fit `V`. (It used to be `any`,
// which made even the declared keys read as `any` — `T & any` is `any`.)
// ─────────────────────────────────────────────────────────────────────────────

type InferOpenShape<S extends AnyShape> = InferShape<S> & { [key: string]: unknown };

/**
 * Open object schema; validates/repairs known keys, passes unknown keys through unchanged.
 * Use when the object may carry arbitrary extra properties (e.g. SVG element attributes).
 *
 * @param shape        Known key schemas (validated and type-inferred).
 * @param openSchema   Optional schema applied to every unknown key's value.
 *                     When omitted, unknown values are passed through as-is (`any`).
 */
class OpenObj<S extends AnyShape> extends Base<InferOpenShape<S>> {
    readonly _default: InferOpenShape<S>;
    /** What each declared field means when a document leaves it out — see {@link InferDefaults}. */
    readonly defaults: InferDefaults<S>;

    constructor(readonly _shape: S, private readonly _openSchema?: PxAnySchema) {
        super(false);
        this._default = asBuilt(shapeDefaults(_shape));
        this.defaults = statedDefaults(_shape);
    }

    sanitize(raw: unknown): InferOpenShape<S> {
        const src = isRecord(raw) ? raw : {};
        const out: Record<string, unknown> = { ...src };
        for (const key of Object.keys(this._shape)) {
            const v = this._shape[key].sanitize(src[key]);
            if (v !== undefined) out[key] = v;   // no phantom keys — see Obj.sanitize
        }
        if (this._openSchema) {
            for (const key of Object.keys(src)) {
                if (!(key in this._shape)) out[key] = this._openSchema.sanitize(src[key]);
            }
        }
        return asBuilt(out);
    }

    /** One visit: declared keys checked and repaired, the others through the open-value schema
     *  (or kept as they are without one), input key order preserved. */
    override _fix(raw: unknown, run: PxFixRun): InferOpenShape<S> {
        if (isStampedFor(raw, this)) return raw as InferOpenShape<S>;   // already checked — reuse, never rebuild
        const before = run.repairs;
        if (!isRecord(raw)) run.repairs++;
        const src = isRecord(raw) ? raw : {};
        const shape: AnyShape = this._shape;
        const open = this._openSchema;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(src)) {
            const v = hasOwn(shape, key) ? shape[key]._fix(src[key], run) : open ? open._fix(src[key], run) : src[key];
            if (v !== undefined) out[key] = v;
        }
        for (const key of Object.keys(shape)) {
            if (hasOwn(src, key)) continue;
            const v = shape[key]._fix(undefined, run);
            if (v !== undefined) out[key] = v;
        }
        return asBuilt(this._seal(out, run.repairs === before));
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (!ctx?.strict && isStampedFor(raw, this)) return true;
        if (!isRecord(raw)) {
            reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'object', Array.isArray(raw) ? 'array' : typeof raw);
            return false;
        }
        const obj = raw;
        const p = path ?? [];
        let ok = true;
        for (const key of Object.keys(this._shape)) {
            p.push(key);
            if (!this._shape[key].isValid(obj[key], ctx, p)) ok = false;
            p.pop();
        }
        if (this._openSchema) {
            for (const key of Object.keys(obj)) {
                if (key in this._shape) continue;
                p.push(key);
                if (!this._openSchema.isValid(obj[key], ctx, p)) ok = false;
                p.pop();
            }
        }
        return ok;
    }

    override _canSanitize(raw: unknown): boolean { return isRecord(raw); }

    override describe(): PxSchemaDesc { return { kind: 'shape', shape: this._shape, openValue: this._openSchema }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Array — items that cannot be attempted are filtered out; default is []
// Uses _canSanitize for filtering so partially-valid objects are repaired, not dropped.
// ─────────────────────────────────────────────────────────────────────────────

/** Array schema; items failing _canSanitize are filtered out rather than blocking the whole array. */
class Arr<T> extends Base<Array<T>> {
    readonly _default: Array<T> = [];
    constructor(private readonly item: PxSchema<T>) { super(false); }

    sanitize(raw: unknown): Array<T> {
        if (!Array.isArray(raw)) return [];
        const out: Array<T> = [];
        for (const el of raw) {
            if (this.item._canSanitize(el)) out.push(this.item.sanitize(el));
        }
        return out;
    }

    override _fix(raw: unknown, run: PxFixRun): Array<T> {
        if (isStampedFor(raw, this)) return raw as Array<T>;   // already checked — reuse, never rebuild
        const before = run.repairs;
        const out: Array<T> = [];
        if (!Array.isArray(raw)) run.repairs++;
        else for (const el of raw) {
            if (this.item._canSanitize(el)) out.push(this.item._fix(el, run));
            else run.repairs++;                                  // dropped, as sanitize drops it
        }
        return this._seal(out, run.repairs === before);
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (!ctx?.strict && isStampedFor(raw, this)) return true;
        if (!Array.isArray(raw)) {
            reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'array', typeof raw);
            return false;
        }
        const p = path ?? [];
        let ok = true;
        for (let i = 0; i < raw.length; i++) {
            p.push('[' + i + ']');
            if (!this.item.isValid(raw[i], ctx, p)) ok = false;
            p.pop();
        }
        return ok;
    }

    override _canSanitize(raw: unknown): boolean { return Array.isArray(raw); }
    override describe(): PxSchemaDesc { return { kind: 'array', item: this.item }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Record — invalid values are dropped; default is {}
// ─────────────────────────────────────────────────────────────────────────────

/** String-keyed record; values failing _canSanitize are dropped rather than blocking the whole record. */
class Rec<T> extends Base<Record<string, T>> {
    readonly _default: Record<string, T> = {};
    constructor(private readonly value: PxSchema<T>) { super(false); }

    sanitize(raw: unknown): Record<string, T> {
        if (!isRecord(raw)) return {};
        const out: Record<string, T> = {};
        for (const [k, v] of Object.entries(raw)) {
            if (this.value._canSanitize(v)) out[k] = this.value.sanitize(v);
        }
        return out;
    }

    override _fix(raw: unknown, run: PxFixRun): Record<string, T> {
        if (isStampedFor(raw, this)) return raw as Record<string, T>;   // already checked — reuse, never rebuild
        const before = run.repairs;
        const out: Record<string, T> = {};
        if (!isRecord(raw)) run.repairs++;
        else for (const [k, v] of Object.entries(raw)) {
            if (this.value._canSanitize(v)) out[k] = this.value._fix(v, run);
            else run.repairs++;                                  // dropped, as sanitize drops it
        }
        return this._seal(out, run.repairs === before);
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (!ctx?.strict && isStampedFor(raw, this)) return true;
        if (!isRecord(raw)) {
            reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'object/record', Array.isArray(raw) ? 'array' : typeof raw);
            return false;
        }
        const p = path ?? [];
        let ok = true;
        for (const [k, v] of Object.entries(raw)) {
            p.push(k);
            if (!this.value.isValid(v, ctx, p)) ok = false;
            p.pop();
        }
        return ok;
    }

    override _canSanitize(raw: unknown): boolean { return isRecord(raw); }
    override describe(): PxSchemaDesc { return { kind: 'record', value: this.value }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Any — passes raw through unchanged, always valid
// ─────────────────────────────────────────────────────────────────────────────

/** Passes any value through unchanged; always valid. Useful for opaque blobs with no schema. */
class Any extends Base<unknown> {
    readonly _default: unknown = undefined;
    constructor() { super(false); }
    sanitize(raw: unknown): unknown { return raw; }
    isValid(_raw: unknown, _ctx?: PxValidationContext, _path?: Array<string>): boolean { return true; }
    override _canSanitize(_raw: unknown): boolean { return true; }
}


/**
 * Like {@link Any} but REQUIRES the value to be present: anything except `undefined`.
 *
 * Use it for a key whose type is open but whose PRESENCE is what identifies the
 * shape — e.g. the structured-static branch `{value: …}` (V6). With `px.any()`
 * there, the branch matched EVERY object, because `any` accepts `undefined` and
 * an absent key is indistinguishable from one holding `undefined`.
 */
class Defined extends Base<unknown> {
    readonly _default: unknown = undefined;
    constructor() { super(false); }
    sanitize(raw: unknown): unknown { return raw; }
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (raw !== undefined) return true;
        reportValidationError(ctx, path, PxValidationFindingKind.missingValue, 'required value is missing');
        return false;
    }
    override _canSanitize(raw: unknown): boolean { return raw !== undefined; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Lazy — resolves schema on first use, required for recursive types
// ─────────────────────────────────────────────────────────────────────────────

/** Defers schema resolution to first use; required to break circular references in recursive types. */
class Lazy<T> extends Base<T> {
    private resolved: PxSchema<T> | null = null;
    constructor(private readonly fn: () => PxSchema<T>, readonly _default: T) { super(false); }

    private get schema(): PxSchema<T> {
        return this.resolved ?? (this.resolved = this.fn());
    }

    sanitize(raw: unknown): T { return this.schema.sanitize(raw); }
    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean { return this.schema.isValid(raw, ctx, path); }
    override _canSanitize(raw: unknown): boolean { return this.schema._canSanitize(raw); }
    override is(raw: unknown): raw is T { return this.schema.is(raw); }
    override _fix(raw: unknown, run: PxFixRun): T { return this.schema._fix(raw, run); }
    /** Resolved once and cached, so two walks agree on the schema's identity. */
    override describe(): PxSchemaDesc { return { kind: 'lazy', resolved: this.schema }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// Tuple — fixed-length array with per-position schemas; default is defaults of each position
// _canSanitize: true only when raw is an array of the exact expected length
// ─────────────────────────────────────────────────────────────────────────────

// Maps a tuple of schemas to a tuple of their inferred types.
type TupleItems<T extends ReadonlyArray<PxAnySchema>> =
    { -readonly [K in keyof T]: T[K] extends PxSchema<infer U, boolean> ? U : never };

/** Positional items, built one per schema of `T` — the tuple TypeScript cannot follow through `map`. */
function asTupleItems<T extends ReadonlyArray<PxAnySchema>>(items: Array<unknown>): TupleItems<T> {
    return items as TupleItems<T>;
}

/** Fixed-length array schema; validates element count and each position individually. */
class Tuple<T extends ReadonlyArray<PxAnySchema>> extends Base<TupleItems<T>> {
    readonly _default: TupleItems<T>;

    constructor(private readonly schemas: T) {
        super(false);
        this._default = asTupleItems<T>(schemas.map(s => s._default));
    }

    sanitize(raw: unknown): TupleItems<T> {
        if (!Array.isArray(raw) || raw.length !== this.schemas.length) return this._default;
        return asTupleItems<T>(this.schemas.map((s, i) => s.sanitize(raw[i])));
    }

    override _fix(raw: unknown, run: PxFixRun): TupleItems<T> {
        if (isStampedFor(raw, this)) return raw as TupleItems<T>;   // already checked — reuse, never rebuild
        if (!Array.isArray(raw) || raw.length !== this.schemas.length) { run.repairs++; return this._default; }
        const before = run.repairs;
        const out = this.schemas.map((s, i) => s._fix(raw[i], run));
        return asTupleItems<T>(this._seal(out, run.repairs === before));
    }

    isValid(raw: unknown, ctx?: PxValidationContext, path?: Array<string>): boolean {
        if (!ctx?.strict && isStampedFor(raw, this)) return true;
        if (!Array.isArray(raw) || raw.length !== this.schemas.length) {
            reportExpected(ctx, path, PxValidationFindingKind.typeMismatch, 'tuple of length ' + this.schemas.length, Array.isArray(raw) ? 'array[' + (raw as unknown[]).length + ']' : typeof raw);
            return false;
        }
        const p = path ?? [];
        let ok = true;
        for (let i = 0; i < this.schemas.length; i++) {
            p.push('[' + i + ']');
            if (!this.schemas[i].isValid(raw[i], ctx, p)) ok = false;
            p.pop();
        }
        return ok;
    }

    // Require exact length so wrong-length arrays are dropped rather than repaired to default.
    override _canSanitize(raw: unknown): boolean {
        return Array.isArray(raw) && raw.length === this.schemas.length;
    }

    override describe(): PxSchemaDesc { return { kind: 'tuple', items: this.schemas }; }
}


// ─────────────────────────────────────────────────────────────────────────────
// implementsInterface — compile-time lock between a schema and an interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a pass-through wrapper that enforces at compile time that the schema's
 * inferred type is structurally assignable to `T`. Catches type mismatches on
 * required fields and value-type mismatches on optional fields.
 *
 * For key-level equality (catching optional field renames), pair with a
 * `KeysMatch` assertion after the inferred type alias:
 * ```ts
 * const _ck: KeysMatch<PxFoo, _PxFoo> = true;
 * ```
 *
 * @example
 * export const PxLoopSchema = implementsInterface<_PxLoop>()(px.object({ ... }));
 */
export function implementsInterface<T>() {
    return <S extends PxSchema<T>>(schema: S): S => schema;
}

/**
 * Evaluates to `true` when A and B have exactly the same set of keys; `false` otherwise.
 * Use with a `const` assertion to get a compile-time error on key renames:
 * ```ts
 * const _ck: KeysMatch<PxFoo, _PxFoo> = true;
 * ```
 * @public @advanced
 */
export type KeysMatch<A, B> =
    [Exclude<keyof A, keyof B>] extends [never]
        ? [Exclude<keyof B, keyof A>] extends [never] ? true : false
        : false;

/**
 * Builds a `{ key: 'key', ... }` object from a schema's shape.
 * Each value is typed as the literal key name, so `schemaKeys(PxFooSchema).bar`
 * is typed as `'bar'` — use in @serializable calls to get a compile-time error
 * if the field is renamed in the schema.
 * @public @advanced
 */
export function schemaKeys<S extends { readonly _shape: Record<string, unknown> }>(schema: S) {
    return Object.fromEntries(
        Object.keys(schema['_shape']).map(k => [k, k])
    ) as { [K in keyof S['_shape']]: K };
}

/**
 * Describes the structural kind of a schema for traversal purposes.
 * Use with `getMissingCoveragePaths` or similar tree-walking utilities.
 *
 * Every composite kind is reported, so a walker can reach EVERY field a document
 * may legally carry — that is what makes schema-coverage checking possible
 * (see the app's `collectSchemaFieldUniverse`).
 *
 * - `shape`             — object schema (Obj/OpenObj); `shape` maps key → sub-schema.
 *                         `openValue` is set for open objects: the schema unknown keys
 *                         are validated against (undefined ⇒ unknown keys pass through as-is)
 * - `array`             — array schema; `item` is the element schema
 * - `optional`          — optional wrapper; `inner` is the wrapped schema
 * - `lazy`              — lazy/recursive schema; `resolved` is the resolved schema (cached)
 * - `union`             — `px.union`; `members` are the alternatives, tried in order
 * - `discriminatedUnion`— `px.discriminatedUnion`; `key` is the discriminant field and
 *                         `members` the alternatives (each an object schema with a literal at `key`)
 * - `record`            — `px.record`; `value` is the schema every entry's value must match
 * - `tuple`             — `px.tuple`; `items` are the positional element schemas
 * - `leaf`              — primitive, literal, enum, any — no traversable children
 * @public @advanced
 */
export type PxSchemaDesc =
    | { kind: 'shape';    shape: Record<string, PxAnySchema>; openValue?: PxAnySchema }
    | { kind: 'array';    item: PxAnySchema }
    | { kind: 'optional'; inner: PxAnySchema }
    | { kind: 'lazy';     resolved: PxAnySchema }
    | { kind: 'union';    members: ReadonlyArray<PxAnySchema> }
    | { kind: 'discriminatedUnion'; key: string; members: ReadonlyArray<PxAnySchema> }
    | { kind: 'record';   value: PxAnySchema }
    | { kind: 'tuple';    items: ReadonlyArray<PxAnySchema> }
    | { kind: 'leaf' };

/** A schema's structure — each schema class describes itself. @public @advanced */
export function describeSchema(schema: PxAnySchema): PxSchemaDesc {
    return schema.describe();
}


// ─────────────────────────────────────────────────────────────────────────────
// Public factory
// ─────────────────────────────────────────────────────────────────────────────

// Scalar factories are overloaded so that STATING a default (`px.number(1)`) is a fact of the
// schema's TYPE, not just of its value — that is what lets an object schema type its `defaults`.

/** Matches a string. Absent means the stated value; without one, '' is only the repair value. */
function string(): PxSchema<string, false, false>;
function string(defaultVal: string): PxSchema<string, false, true>;
function string(defaultVal?: string): PxSchema<string, false, boolean> {
    return defaultVal === undefined ? new Str('', false) : new Str(defaultVal, true);
}

/** Matches a finite number. Absent means the stated value; without one, 0 is only the repair value. */
function number(): PxSchema<number, false, false>;
function number(defaultVal: number): PxSchema<number, false, true>;
function number(defaultVal?: number): PxSchema<number, false, boolean> {
    return defaultVal === undefined ? new Num(0, false) : new Num(defaultVal, true);
}

/** Matches a boolean. Absent means the stated value; without one, false is only the repair value. */
function boolean(): PxSchema<boolean, false, false>;
function boolean(defaultVal: boolean): PxSchema<boolean, false, true>;
function boolean(defaultVal?: boolean): PxSchema<boolean, false, boolean> {
    return defaultVal === undefined ? new Bool(false, false) : new Bool(defaultVal, true);
}

/** Matches one of a fixed set of string/number values. Absent means the stated value; without one,
 *  the first value is only the repair value. */
function oneOf<T extends string | number>(values: readonly T[]): PxSchema<T, false, false>;
function oneOf<T extends string | number>(values: readonly T[], defaultVal: T): PxSchema<T, false, true>;
function oneOf<T extends string | number>(values: readonly T[], defaultVal?: T): PxSchema<T, false, boolean> {
    return defaultVal === undefined ? new Enum(values, undefined, false) : new Enum(values, defaultVal, true);
}

/**
 * Returns the first schema whose isValid passes; TypeScript infers the union of all member types.
 * Absent means the stated value; without one, the first member's default is only the repair value.
 */
function unionOf<const T extends ReadonlyArray<PxAnySchema>>(schemas: T): PxSchema<UnionMembers<T>, false, false>;
function unionOf<const T extends ReadonlyArray<PxAnySchema>>(schemas: T, defaultVal: UnionMembers<T>): PxSchema<UnionMembers<T>, false, true>;
function unionOf<const T extends ReadonlyArray<PxAnySchema>>(schemas: T, defaultVal?: UnionMembers<T>): PxSchema<UnionMembers<T>, false, boolean> {
    return defaultVal === undefined
        ? new Union<UnionMembers<T>, false>(asMembersOf(schemas), undefined, false)
        : new Union<UnionMembers<T>, true>(asMembersOf(schemas), defaultVal, true);
}

/** @public @advanced */
export const px = {
    string,
    number,
    boolean,

    /** Matches one exact primitive value; absent means the value itself. */
    literal: <T extends string | number | boolean>(value: T): PxSchema<T, false, true> =>
        new Literal(value),

    enum: oneOf,
    union: unionOf,

    /**
     * Discriminated union — reads `raw[key]`, finds the member schema whose
     * literal at `key` matches, then delegates sanitize/isValid to that member.
     * Each member must be an object schema with a `px.literal(...)` at `key`.
     * `absent` (optional) is the member a value WITHOUT the key selects — an object schema that
     * does not declare it (an authored animation, which has no `kind`). A value WITH the key never
     * reaches it. TypeScript infers the union of all member types automatically.
     */
    discriminatedUnion: <
        K extends string,
        const T extends ReadonlyArray<PxAnySchema & { readonly _shape: AnyDiscriminantShape<K> }>,
        A = never,
    >(key: K, schemas: T, absent?: PxSchema<A>): PxSchema<UnionMembers<T> | A> =>
        new DiscriminatedUnion<UnionMembers<T> | A>(key, schemas.map((s, i) => ({ schema: asMembersOf(schemas)[i], shape: s._shape })), absent),

    /** Typed object — unknown keys are stripped. Required fields fall back to their default.
     *  Its `defaults` say what each stated field means when a document leaves it out. */
    object: <S extends AnyShape>(shape: S): ObjectSchema<InferShape<S>, S> =>
        new Obj(shape),

    /**
     * Open object — validates known keys; passes unknown keys through as-is,
     * or validates/sanitizes them against `openSchema` when provided.
     */
    openObject: <S extends AnyShape>(
        shape: S,
        openSchema?: PxAnySchema
    ): ObjectSchema<InferOpenShape<S>, S> =>
        new OpenObj(shape, openSchema),

    /**
     * Creates a new closed object schema by merging a base schema's shape with additional fields.
     * The base can be the result of px.object() or px.openObject() — anything with a _shape property.
     *
     * @example
     * const PxSvgNodeSchema = px.extendedObject(PxNodeBaseSchema, { width: px.number().optional() });
     */
    extendedObject: <B extends AnyShape, E extends AnyShape>(
        base: { readonly _shape: B },
        extra: E
    ): ObjectSchema<InferShape<B & E>, B & E> =>
        new Obj({ ...base._shape, ...extra } as B & E),

    /** Array whose unrecoverable items are filtered out. Default: []. */
    array: <T>(item: PxSchema<T>): PxSchema<Array<T>> =>
        new Arr(item),

    /** String-keyed record whose unrecoverable values are dropped. Default: {}. */
    record: <T>(value: PxSchema<T>): PxSchema<Record<string, T>> =>
        new Rec(value),

    /** Passes anything through unchanged — always valid. */
    any: (): PxSchema<unknown> => new Any(),

    /** Anything EXCEPT `undefined` — an open type whose presence is required (V6). */
    defined: (): PxSchema<unknown> => new Defined(),

    /** Fixed-length tuple — validates element count and each position individually. */
    tuple: <T extends ReadonlyArray<PxAnySchema>>(schemas: T): PxSchema<TupleItems<T>> =>
        new Tuple(schemas),

    /** Defers schema creation — required for recursive types. Must supply a default value. */
    lazy: <T>(fn: () => PxSchema<T>, defaultVal: T): PxSchema<T> =>
        new Lazy(fn, defaultVal),
} as const;
