# docs-check — the public docs, checked against the code

Every table, reference code block and export list in the public markdown files carries an HTML
comment that names the TypeScript type, package or runtime schema it documents. `pnpm check:docs`
(part of `pnpm build` and `pnpm test`) reads the packages' `dist/index.d.ts` files with the
TypeScript compiler API, the wire schemas through core's `describeSchema`, and fails when a doc and
its source disagree: a member missing or misspelled, an optional flag wrong, a type inlined
differently, an export nobody documents, a name that is no longer exported.

The docs stay hand-written — prose, ordering and notes columns are yours. The check only proves
that what they *say* about names, shapes and exports is still true, and that the ●/○/▪ marks still
say what the code says — see [Audience](#audience).

## Running it

```bash
pnpm check:docs                     # from the repo root; needs the packages built (pnpm build does both)
DOCS_CHECK_DEBUG=1 pnpm check:docs  # type mismatches also print the normalized spellings
pnpm report:audience                # print the coverage table: package × audience × described
```

Every marker is one test named `<file>:<line> <kind> <target>`; every file also has a coverage test
that fails on a table or reference block without a marker. A failure prints `file:line — what is
wrong`, and usually what to write.

## The files it covers

`DOC_FILES` in [`src/config.ts`](./src/config.ts): the root `README.md`, **every `.md` under
`docs/`** (found by walking the directory, so a new page is covered the day it is added), and each
package's `README.md`. Internal notes live in `dev-docs/` and are not covered.

## Markers

A marker is a line of its own directly above the block it checks:

```markdown
<!-- px-check <kind> [target] [key=value …] -->
| Prop | Type | Description |
```

| Kind | Target | Checks |
|---|---|---|
| `off <reason>` | — | nothing — the next table or block is prose. The reason is required |
| `props <Type>` | an interface, type alias, or a component (its props) | a table whose first column names the members: every row must be a member, every member must have a row. Add `types` to compare the `Type` column too (`loose` on a row opts out) |
| `signature` | — (every declaration in the block) | a `typescript` block of `interface` / `type` / `function` / `const` declarations, each compared with the export of the same name: members (names, `?`, types), parameters and return type, alias text, const keys. `omit=Type.member` leaves a real member unshown on purpose; `loose=Type.member` compares the name only; `extra=Type.member` allows a doc-only member; `skip=Name` a doc-only declaration |
| `exports <package>` | `@pixodesk/svg-animator-web` … | the enclosing `##` section mentions every export of the package (in code blocks or backticks); a `Symbol(s)` column lists each name once and never a non-export. `except=a,b` for exports deliberately unlisted. With `partial`, only the marked table's names are checked to be exports |
| `matrix col=pkg:Type …` | one `pkg:Type` (or `~` = unchecked) per column after the name column | a props-across-players table: a cell is `—` exactly when that surface lacks the member; `` `@event` `` cells are checked against a Vue component's emits; every member of every column has a row |
| `values <Const>` | a const object (`PxTriggerStart`) | a table whose rows are the const's keys or values, all of them |
| `emits <Component>` | a Vue component | a table of its events, all of them |
| `members <Type>` | an interface | a paragraph or list naming the members in backticks (`play()`, `pause()` …), all of them |
| `schema <PxXSchema>` | a runtime schema from core | a field table: every row a key of the schema (dotted paths like `retime.start` allowed), every key a row. `at=path` descends first; `variant=scroll` picks a discriminated-union member; `values=type` lists a union's discriminant values instead; `partial` skips the completeness check |
| `schema-block A=PxASchema B=PxBSchema …` | doc interface name → schema, shared by every `schema-block` in the file | a `typescript` block that spells the wire format: each mapped interface is walked against its schema — keys, `?`, nested object literals through arrays / records / unions (discriminated by their literal), and references to other mapped names. `interface X extends Y` counts Y's keys as shown; `skip=a.b` leaves a path alone |
| `usage` | — | a snippet's `import { … } from '@pixodesk/…'` names exist — applied automatically to every import snippet, no marker needed |

Options every kind understands: `pkg=web|react|vue|rn|core` names the package when the section
heading does not (`## @pixodesk/svg-animator-web …` sets it); `col=2` reads the names from another
column; `omit=a,b` names members left out on purpose — and an omission of a member that no longer
exists is itself a failure, so a rename cannot hide behind one.

## Row annotations

A row can carry its own comment at the end:

```markdown
| `duration` · `delay` | `number` | … | <!-- px names=duration,delay -->
| any other key | an SVG attribute | <!-- px skip -->
| `apiRef` | the returned API | … | <!-- px web=~ vue=~ -->
```

| Annotation | Meaning |
|---|---|
| `names=a,b` | the row documents several members |
| `name=x` | the member's name, when the first cell is not it |
| `skip` | not a member row (prose, a note) — group-header rows in `**bold**` are skipped by themselves |
| `extra` | documented on purpose, but not a member of the type (it must not be one) |
| `loose` | compare the name only, never the type |
| `<column>=~` | in a `matrix` table, leave that cell unchecked |

## Audience

Who an export is for lives on its **declaration**, as a TSDoc release tag — one source of truth
that an IDE shows on hover and this check reads back out of the built `.d.ts`:

| Tag | Mark in an export index | Means |
|---|---|---|
| `@public` | ● | supported. A page must describe it, not merely list it in an export index |
| `@public @advanced` | ○ | supported document tooling — stable, rarely needed |
| `@internal` | ▪ | exported so the editor and the sibling packages stay in lockstep. May change in any release, so no guide may teach it |

Five checks run under the `audience` group, once for the whole repo rather than per file
([`src/audience.ts`](./src/audience.ts)):

1. **every export says who it is for** — exactly one tag, on the declaration (not the re-export, so
   core's tag is what web mirrors);
2. **the reference marks agree with the declarations** — a row in an export index whose last cell
   carries a mark must match the tag of every name that row declares. A row that groups names by
   topic can mark one of them differently in place: `` `toDomProps` (○) `` in a ▪ row;
3. **public is described, internal is taught nowhere** — a `@public` name is named on some page
   outside an export index (a table under `px-check exports`, which lists every name by design),
   and an `@internal` name is named in none. A name is "described" by prose, a signature block or
   a marker that checks it; "taught" means it appears in a fenced code block, which is what
   `@internal` must never do;
4. **every public call shows its signature** — a `@public` value you can call must appear in a
   `px-check signature` block, or as the target of a `props` / `values` / `members` marker. A type
   is exempt: rule 3 covers it. `@public @advanced` is exempt too, being document tooling;
5. **no internal name is on a main entry** — an `@internal` export must live behind the package's
   `/internal` entry point, never on `.`.

A public name with nothing written about it yet goes in
[`audience-allowlist.json`](./audience-allowlist.json) under `undocumented` with a reason, and one
whose signature is deliberately not spelled out goes under `noSignature`. An entry that is no longer
needed — the name got documented, or stopped being public — fails the check too, so the list can
only shrink.

## How types are compared

Both spellings — the doc's and `typeToString`'s — are normalized the same way before they are
compared, so none of these differences fail a check: whitespace and quotes, `T[]` vs `Array<T>`,
the order of union members or object-literal members, parameter names inside function *types*,
`| undefined` on an optional member, a `React.` qualifier, method vs property syntax. Type
aliases and interfaces are expanded textually on both sides too, so a doc may inline
`'load' | 'click' | …` where the type says `PxTriggerStart`, or `{ motionPath?: … }` where it says
`PxMaterializeAllOptions`, or keep the name.

Union-typed values in `schema-block` (`"M…" | ANIMATE`, `boolean | { … }`) are matched to the
schema union's object members by their discriminant literal when there is one, else by the member
sharing most keys.

## Adding to the docs

- A new table or reference block: give it a marker, or `off` with a reason — the coverage test
  will remind you.
- A new export: mention it in the package's API reference — the `## API reference` section of its
  guide (core's is on the format page) — the `exports` check will remind you.
- A new prop, member or schema key: add the row — the `props` / `signature` / `schema` check will
  remind you, and name what is missing.
- A new marker kind or option: [`src/checks.ts`](./src/checks.ts), one function per kind; the type
  facts live in [`src/ts-facts.ts`](./src/ts-facts.ts), the schema facts in
  [`src/schema-facts.ts`](./src/schema-facts.ts), the normalizer in
  [`src/type-text.ts`](./src/type-text.ts).

The HTML comments never reach a reader: GitHub hides them, and the website's sync strips them.
