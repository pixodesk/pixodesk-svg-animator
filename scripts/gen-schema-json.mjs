#!/usr/bin/env node
// Generates SCHEMA.json — a JSON Schema (draft 2020-12) for the Pixodesk animation
// document — from the runtime `px` schemas in @pixodesk/svg-animator-core, so the
// published schema can never drift from what the player validates.
//
//   node scripts/gen-schema-json.mjs        (build core first: pnpm --filter @pixodesk/svg-animator-core build)
//
// The px schema classes are introspected by shape (describeSchema + a few
// duck-typed leaf fields), not by class name, so a minified build works too.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '../packages/svg-animator-core/dist/index.js';

const { describeSchema, PxAnimatedSvgDocumentSchema } = core;

// Named, reusable definitions: recursive/shared schemas become `$ref`s.
const NAMED = new Map([
  [core.PxNodeSchema, 'Node'],
  [core.PxAnimatorConfigSchema, 'AnimatorConfig'],
  [core.PxTimelineSchema, 'Timeline'],
  [core.PxTriggerSchema, 'Trigger'],
  [core.PxDefsSchema, 'Definitions'],
  [core.PxElementAnimationSchema, 'ElementAnimation'],
  [core.PxPropertyAnimationSchema, 'PropertyAnimation'],
  [core.PxKeyframeSchema, 'Keyframe'],
  [core.PxLoopSchema, 'Loop'],
  [core.PxEffectsSchema, 'Effects'],
  [core.PxTransformPartsSchema, 'TransformParts'],
]);

const defs = {};
const inProgress = new Set();

function leaf(s) {
  if (Array.isArray(s.values)) return { enum: [...s.values] };
  if ('value' in s && s.value !== undefined && !s.item) return { const: s.value };
  switch (typeof s._default) {
    case 'string': return { type: 'string' };
    case 'number': return { type: 'number' };
    case 'boolean': return { type: 'boolean' };
    default: return {}; // any / defined
  }
}

function convert(schema) {
  const name = NAMED.get(schema);
  if (name) {
    if (!(name in defs)) {
      if (inProgress.has(name)) return { $ref: `#/$defs/${name}` };
      inProgress.add(name);
      defs[name] = build(schema);
      inProgress.delete(name);
    }
    return { $ref: `#/$defs/${name}` };
  }
  return build(schema);
}

function build(schema) {
  const d = describeSchema(schema);
  switch (d.kind) {
    case 'shape': {
      const properties = {};
      const required = [];
      for (const [key, sub] of Object.entries(d.shape)) {
        const sd = describeSchema(sub);
        if (sd.kind === 'optional') properties[key] = convert(sd.inner);
        else { properties[key] = convert(sub); required.push(key); }
      }
      const out = { type: 'object', properties };
      if (required.length) out.required = required;
      // Open objects (SVG nodes, the document root) pass unknown keys through as
      // attributes — typed by the open-value schema when the object declares one.
      out.additionalProperties = isOpen(schema) ? (d.openValue ? convert(d.openValue) : true) : false;
      return out;
    }
    case 'array':    return { type: 'array', items: convert(d.item) };
    case 'optional': return convert(d.inner);
    case 'lazy':     return convert(d.resolved);
    case 'union':    return { anyOf: d.members.map(convert) };
    case 'discriminatedUnion': return { oneOf: d.members.map(convert) };
    case 'record':   return { type: 'object', additionalProperties: convert(d.value) };
    case 'tuple':    return { type: 'array', prefixItems: d.items.map(convert), minItems: d.items.length, maxItems: d.items.length };
    default:         return leaf(schema);
  }
}

// Open objects: `px.openObject` instances carry `_openSchema` (possibly undefined) —
// detect by the presence of the property rather than its value.
function isOpen(schema) { return Object.prototype.hasOwnProperty.call(schema, '_openSchema'); }

const root = convert(PxAnimatedSvgDocumentSchema);
const out = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://pixodesk.com/schema/svg-animator-document.json',
  title: 'Pixodesk SVG Animator document',
  description: 'The JSON animation document played by @pixodesk/svg-animator-*. Generated from the runtime schemas — see SCHEMA.md for the readable version.',
  ...root,
  $defs: defs,
};
const target = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'SCHEMA.json');
writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`SCHEMA.json written: ${Object.keys(defs).length} definitions, ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`);
