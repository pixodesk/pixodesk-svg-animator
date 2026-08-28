# Format principles

[← Static sites & CMS](./12-player--static-sites-and-cms.md) · [Contents](./README.md) · Next: [JSON format reference →](./14-format--json-format.md)

Read this if you want to know *why* the format looks the way it does. You do not need it to
use the format — it is here for tool authors, contributors, and the curious. The complete
design record — every rule, every decision, the editor's unit contract — is
[SCHEMA-DESIGN.md](../SCHEMA-DESIGN.md).

## Plain SVG, with layers on top

Each layer adds one idea, uses only the layers beneath it, and has its own **address on the
node** — that address is the contract.

| Layer | | Address on the node | What it adds | Read by |
|---|---|---|---|---|
| **L0** | plain SVG | `{type, ...attrs, children}` | strings · static attributes · static elements | the browser |
| **L1** | typed values | the same attributes | numbers, vectors, records — seven value kinds | player |
| **L2** | animated attributes | `node.animate[attr]` | a parallel channel per attribute; zero structure | player |
| **L3** | player effects | `node.effects` | declarative generators, expanded at load | player |
| **L4** | editor meta | `node.meta` | everything the player ignores | editor |
| **L5** | pre-rendered SVG | a real `.svg` file | the same model, flattened | the browser (or the player) |

**L0 → L1.** An element is `{type, ...attributes, children}`. The first addition is not
animation but *types*: `opacity: 0.5`, `translate: [96.8, 46.8]`, `transform: {translate,
rotate, scale}`. Units are never written — each property has one fixed implicit unit. A typed
static is byte-for-byte the same shape as a keyframe value, which is what makes the next layer
a one-line addition rather than a second grammar.

**L2.** Any attribute animates through a parallel channel keyed by its name. The static stays
a plain attribute; the animation sits beside it and never touches the element's place in the
tree. Remove every `animate` and you have a valid static SVG.

**L3.** *An attribute is a value the browser consumes as-is; an effect is anything that needs
structure* — generated defs, wrapper nodes, clones, geometry-derived rewrites. The player
expands `effects` into L0–L2 at load. There are ten of them ([Effects reference](./15-format--effects.md)).

**L4.** The player types `meta` as *anything* and ignores it. Everything the editor needs that
the player does not — labels, shape presets, the parametric sources of baked effects, and the
bookkeeping that lets a pre-rendered file be re-opened as the original elements — lives here,
so editor additions can never break a player.

**L5.** A pre-rendered SVG is the same model flattened into a real `.svg`: `meta` becomes a
per-element `data-px-meta` attribute, animation becomes CSS `@keyframes` or an embedded player
plus an id → animation map. Every effect is expanded, which is exactly why L4 has to remember
how to fold the expansion back.

## The five principles

1. **Each layer reduces to the one below.** A document using only L0–L2 is fully playable;
   everything above is expanded into it. That is what keeps the players small.
2. **Address is contract.** What a key *means* is fixed by *where* it sits — `effects` (the
   player will apply these) and `meta.appliedEffects` (these were already applied) are two
   tenses of one idea, told apart by position, not by a flag.
3. **Widen, never narrow.** Every editor schema is the player schema plus named keys; the
   player ignores what it does not know, so the editor can grow freely and old players keep
   playing new files.
4. **Structure is the dividing line.** Attribute or effect? Effect that leaves values behind or
   effect that leaves elements behind? Every split in the design is the same question asked
   again: *does this change the tree?*
5. **Round-trips reach a fixed point.** Save → open → save produces the same file. The first
   save may bake (a shape preset into a path), no later save may grow.

## Where to go deeper

- [SCHEMA-DESIGN.md](../SCHEMA-DESIGN.md) — the full spec: rules R1–R7, the value taxonomy,
  the unit contract for pre-rendered files, naming laws, the corpus that pins the format, and
  the history of every change
- The schemas themselves: [`PxAnimatorTypes.ts`](../packages/svg-animator-core/src/PxAnimatorTypes.ts)
  (player) — every wire type paired with a runtime schema

[← Static sites & CMS](./12-player--static-sites-and-cms.md) · [Contents](./README.md) · Next: [JSON format reference →](./14-format--json-format.md)
