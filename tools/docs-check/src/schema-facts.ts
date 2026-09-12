// What the runtime schemas say — the wire format's source of truth, read through core's
// `describeSchema` so the walk reaches every field a document may carry.
import * as core from '@pixodesk/svg-animator-core';

type AnySchema = Parameters<typeof core.describeSchema>[0];
export type SchemaDesc = ReturnType<typeof core.describeSchema>;

export interface SchemaShape {
    /** key → the field is optional */
    keys: Map<string, boolean>;
    /** an open object: unknown keys pass through */
    open: boolean;
}

export class SchemaFacts {
    byName(name: string): AnySchema | undefined {
        const v = (core as unknown as Record<string, unknown>)[name];
        return v && typeof v === 'object' && 'isValid' in (v as object) ? (v as AnySchema) : undefined;
    }

    describe(s: AnySchema): SchemaDesc { return core.describeSchema(s); }

    /** Past `optional` and `lazy` wrappers. */
    unwrap(s: AnySchema): AnySchema {
        for (let guard = 0; guard < 16; guard++) {
            const d = this.describe(s);
            if (d.kind === 'optional') s = d.inner;
            else if (d.kind === 'lazy') s = d.resolved;
            else return s;
        }
        return s;
    }

    isOptional(s: AnySchema): boolean {
        for (let guard = 0; guard < 16; guard++) {
            const d = this.describe(s);
            if (d.kind === 'optional') return true;
            if (d.kind === 'lazy') s = d.resolved; else return false;
        }
        return false;
    }

    /** The object shape of a schema; for a (discriminated) union, every member's keys merged. */
    shape(s: AnySchema): SchemaShape | undefined {
        const u = this.unwrap(s);
        const d = this.describe(u);
        if (d.kind === 'shape') {
            const keys = new Map<string, boolean>();
            for (const [k, v] of Object.entries(d.shape)) keys.set(k, this.isOptional(v));
            return { keys, open: '_openSchema' in (u as object) };
        }
        if (d.kind === 'union' || d.kind === 'discriminatedUnion') {
            const keys = new Map<string, boolean>();
            let open = false;
            let any = false;
            for (const m of d.members) {
                const ms = this.shape(m);
                if (!ms) continue;
                any = true;
                open ||= ms.open;
                for (const [k, opt] of ms.keys) keys.set(k, keys.has(k) ? keys.get(k)! || opt : opt);
            }
            return any ? { keys, open } : undefined;
        }
        return undefined;
    }

    /** The members of a (discriminated) union that are object shapes, with the literal value(s) at `key`. */
    variants(s: AnySchema): Array<{ schema: AnySchema; discriminant?: string; values: Array<string | number | boolean> }> {
        const d = this.describe(this.unwrap(s));
        if (d.kind !== 'union' && d.kind !== 'discriminatedUnion') return [];
        const key = d.kind === 'discriminatedUnion' ? d.key : undefined;
        return d.members.map(m => {
            const md = this.describe(this.unwrap(m));
            let values: Array<string | number | boolean> = [];
            if (key && md.kind === 'shape' && md.shape[key]) values = this.literalValues(md.shape[key]);
            return { schema: m, discriminant: key, values };
        });
    }

    /** The literal / enum values a leaf schema accepts, when it is one. */
    literalValues(s: AnySchema): Array<string | number | boolean> {
        const u = this.unwrap(s) as unknown as { value?: unknown; values?: ReadonlyArray<unknown> };
        if (Array.isArray(u.values)) return u.values.filter((v): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v));
        if (u.value !== undefined && ['string', 'number', 'boolean'].includes(typeof u.value)) return [u.value as string | number | boolean];
        const d = this.describe(this.unwrap(s));
        if (d.kind === 'union') return d.members.flatMap(m => this.literalValues(m));
        return [];
    }

    /** The sub-schema at a dotted path, descending through arrays and records. */
    at(s: AnySchema, path: string): AnySchema | undefined {
        let cur: AnySchema | undefined = s;
        for (const seg of path.split('.')) {
            if (!cur) return undefined;
            cur = this.child(cur, seg);
        }
        return cur;
    }

    /** The schema of key `seg` inside `s`, looking through arrays, records and unions. */
    child(s: AnySchema, seg: string): AnySchema | undefined {
        const d = this.describe(this.unwrap(s));
        switch (d.kind) {
            case 'shape': return d.shape[seg];
            case 'array': return this.child(d.item, seg);
            case 'record': return this.child(d.value, seg);
            case 'union':
            case 'discriminatedUnion':
                for (const m of d.members) { const c = this.child(m, seg); if (c) return c; }
                return undefined;
            default: return undefined;
        }
    }

    /** The element schema when `s` is an array / record / a union that contains one, else `s`. */
    element(s: AnySchema): AnySchema {
        const d = this.describe(this.unwrap(s));
        if (d.kind === 'array') return this.element(d.item);
        if (d.kind === 'record') return this.element(d.value);
        return s;
    }
}
