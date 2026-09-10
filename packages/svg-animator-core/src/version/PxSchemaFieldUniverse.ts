/*---------------------------------------------------------------------------------------
 * Copyright (c) Pixodesk LTD.
 * Licensed under the MIT License. See the LICENSE file in the project root for details.
 *---------------------------------------------------------------------------------------*/

// ============================================================================
// THE PLAYER'S WIRE-KEY INVENTORY — every field the player schema can carry, as a canonical
// path, sorted. The library half of the editor's ship-guard (task 5.1).
//
// Why a committed list at all: A RENAME IS LENGTH-NEUTRAL. One name out, one in, same count,
// green suite — which is how three renames shipped with no compat read, the last one wiping
// the geometry of every shape-preset path on open. Diffing the list names the key that left.
//
// It lives HERE, not only in the editor, because the library ships on its own: a player
// released with a key quietly gone breaks every document using it, editor or not.
//
// CANONICAL PATHS — the same rule as the editor's `collectSchemaFields`, so the two lists speak
// one dialect: each object schema is enumerated ONCE, at the first path it is reached by
// (breadth-first); `[]` marks an array item, `{*}` a record value or open-object value, `|i` /
// `|tag` a union member. Without the once-only rule every recursive `children` re-lists the
// whole node schema and the inventory explodes into thousands of paths that say nothing new.
// ============================================================================

import { describeSchema, type PxSchema } from '../schema/PxSchema';

/** Every field identity `root` can carry, as canonical paths, sorted. */
export function schemaFieldUniverse(root: PxSchema<any, any>): Array<string> {
    const fields = new Set<string>();
    const enumerated = new Set<unknown>();
    const queue: Array<{ schema: PxSchema<any, any>; path: string }> = [{ schema: root, path: '' }];

    while (queue.length) {
        const { schema, path } = queue.shift()!;
        const d = describeSchema(schema);
        switch (d.kind) {
            case 'shape': {
                if (enumerated.has(schema)) break;   // already listed under its canonical path
                enumerated.add(schema);
                for (const key of Object.keys(d.shape)) {
                    const id = path ? path + '.' + key : key;
                    fields.add(id);
                    queue.push({ schema: d.shape[key], path: id });
                }
                if (d.openValue) queue.push({ schema: d.openValue, path: path + '{*}' });
                break;
            }
            case 'optional': queue.push({ schema: d.inner, path }); break;
            case 'array': queue.push({ schema: d.item, path: path + '[]' }); break;
            case 'lazy': queue.push({ schema: d.resolved, path }); break;
            case 'record': queue.push({ schema: d.value, path: path + '{*}' }); break;
            case 'union':
                d.members.forEach((member, i) => queue.push({ schema: member, path: path + '|' + i }));
                break;
            case 'discriminatedUnion':
                for (const member of d.members) queue.push({ schema: member, path: path + '|' + discriminantOf(member, d.key) });
                break;
            default: break;   // tuple / leaf: no named fields
        }
    }
    return [...fields].sort();
}

/** The literal a discriminated-union member carries at its discriminant, unwrapping an
 *  OPTIONAL discriminant (`type?: 'time'`). `?` when it carries none. */
function discriminantOf(member: PxSchema<any, any>, key: string): string {
    const d = describeSchema(member);
    if (d.kind !== 'shape') return '?';
    const keySchema = d.shape[key];
    if (keySchema === undefined) return '?';
    const kd = describeSchema(keySchema);
    return String((kd.kind === 'optional' ? kd.inner : keySchema)._default);
}
