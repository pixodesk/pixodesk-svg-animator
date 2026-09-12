# docs-check — the public docs, checked against the code

Every table, reference code block and export list in the public markdown files carries an HTML
comment that names the TypeScript type, package or runtime schema it documents. `pnpm check:docs`
(part of `pnpm build` and `pnpm test`) reads the packages' `dist/index.d.ts` files with the
TypeScript compiler API, the wire schemas through core's `describeSchema`, and fails when a doc and
its source disagree: a member missing or misspelled, an optional flag wrong, a type inlined
differently, an export nobody documents, a name that is no longer exported.

The docs stay hand-written — prose, ordering, notes columns, the ●/○/▪ audience marks are yours.
The check only proves that what they *say* about names, shapes and exports is still true.

## Running it

```bash
pnpm check:docs                     # from the repo root; needs the packages built (pnpm build does both)
DOCS_CHECK_DEBUG=1 pnpm check:docs  # type mismatches also print the normalized spellings
```

Every marker is one test named `<file>:<line> <kind> <target>`; every file also has a coverage test
that fails on a table or reference block without a marker. A failure prints `file:line — what is
wrong`, and usually what to write.

## The files it covers

Listed in [`src/config.ts`](./src/config.ts) (`DOC_FILES`): the root `README.md`, `API-SCHEMA.md`,
`SCHEMA.md`, `docs/**`, and each package's `README.md`. Internal notes (reviews, plans, `dev-docs/`)
are not covered. Add a new public page to that list.

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
| `values <Const>` | a const object (`PxStartOn`) | a table whose rows are the const's keys or values, all of them |
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

## How types are compared

Both spellings — the doc's and `typeToString`'s — are normalized the same way before they are
compared, so none of these differences fail a check: whitespace and quotes, `T[]` vs `Array<T>`,
the order of union members or object-literal members, parameter names inside function *types*,
`| undefined` on an optional member, a `React.` qualifier, method vs property syntax. Type
aliases and interfaces are expanded textually on both sides too, so a doc may inline
`'load' | 'click' | …` where the type says `PxStartOn`, or `{ motionPath?: … }` where it says
`MaterializeAllOptions`, or keep the name.

Union-typed values in `schema-block` (`"M…" | ANIMATE`, `boolean | { … }`) are matched to the
schema union's object members by their discriminant literal when there is one, else by the member
sharing most keys.

## Adding to the docs

- A new table or reference block: give it a marker, or `off` with a reason — the coverage test
  will remind you.
- A new export: mention it in the package's section of `API-SCHEMA.md` — the `exports` check will
  remind you.
- A new prop, member or schema key: add the row — the `props` / `signature` / `schema` check will
  remind you, and name what is missing.
- A new marker kind or option: [`src/checks.ts`](./src/checks.ts), one function per kind; the type
  facts live in [`src/ts-facts.ts`](./src/ts-facts.ts), the schema facts in
  [`src/schema-facts.ts`](./src/schema-facts.ts), the normalizer in
  [`src/type-text.ts`](./src/type-text.ts).

The HTML comments never reach a reader: GitHub hides them, and `scripts/gen-schema-html.mjs`
strips them.
