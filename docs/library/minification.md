# Minification & property mangling

Short version: **the published bundles are safe to use as they are.** This page matters only if
your build *property-mangles* third-party code — a rare setting that renames object keys.

[← Playback & triggers](./playback-and-triggers.md) · [Contents](../../README.md#documentation) · Next: [Troubleshooting →](./troubleshooting.md)

## The one thing to know

Minifiers do two different jobs. Renaming **variables** is universal and always safe. Renaming
**properties** — turning `doc.timeline` into `doc.a` — is opt-in, off by default, and unsafe across
any boundary where one side of the rename is not in the same build.

An animation document is exactly such a boundary: it is *data*, loaded at runtime, and its keys are
fixed by the format. If a build renames the property reads inside the player, they no longer match
the keys in the JSON, and the animation silently does nothing. This is why React, and most of the
ecosystem, do no property mangling at all.

## If you use the published packages

Nothing to do. The players are shipped pre-built, and the names that must survive are protected by
the build itself:

- every key of the file format, derived from the schemas themselves — so a new key is protected
  automatically;
- every option, callback and API name the library reads off an object *you* construct;
- the names the library hands to the browser (WAAPI dictionary members) or writes into the DOM.

A test suite loads the shipped minified and unminified bundles side by side and fails if their
behaviour differs, so this is verified per release rather than assumed.

## If you compile the library from source and mangle properties

Feed our reserved-names list to your minifier. It ships inside the web package:

```js
const { reserved } = require('@pixodesk/svg-animator-web/mangle-reserved.json');
```

**terser**

```js
{ mangle: { properties: { regex: /^_/, reserved } } }
```

**esbuild** — quoted properties are preserved by default, and `mangleProps` only touches names
matching your pattern, so a marker-based pattern (the usual convention) is already safe:

```js
{ mangleProps: /_$/, reserveProps: new RegExp(`^(${reserved.join('|')})$`) }
```

**Closure Compiler** (ADVANCED) — quoted property access is never renamed; declare the reserved
names in an externs file.

## What it looks like when it goes wrong

The animation loads without error and then does nothing, or plays with default timing. Because the
keys no longer match, the player sees an empty configuration rather than an invalid one — there is
nothing to throw about.

If you suspect this, validate the document you are passing:

```js
import { validateDocument } from '@pixodesk/svg-animator-web';
console.log(validateDocument(doc));   // [] when the document is sound
```

Against a mangled document this reports keys it does not recognise, which is the signature of the
problem: the file on disk says `timeline`, the object in memory says something else.

## Why we do not simply avoid the issue

We *do* mangle our own internal property names, because it is worth about 2 KB on the main bundle.
The distinction the build enforces is between names that are ours alone and names shared with
something outside the bundle — the file format, your code, and the browser. Only the first group is
ever renamed.

[← Playback & triggers](./playback-and-triggers.md) · [Contents](../../README.md#documentation) · Next: [Troubleshooting →](./troubleshooting.md)
