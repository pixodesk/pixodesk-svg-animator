# Variables

[← Playback settings & triggers](./playback-and-triggers.md) · [Contents](../../README.md#documentation) · Next: [Minification →](./minification.md)

A file can declare **variables** — named, typed values such as a colour, a size or a caption — and bind any
static value to them. The file draws its defaults on its own; your page changes them while it runs: from
code, by picking a named **variant**, or from its **stylesheet**. A change never restarts, seeks or pauses the
animation. Since schema 1.27.

`card.json` — a ball that bounces while its colour, size and caption come from variables:

```json
{
  "type": "svg", "viewBox": "0 0 400 200",
  "animator": {
    "timeline": { "outTime": 1000, "iterations": "infinite", "iterationDirection": "alternate",
                  "actionTriggers": { "playback.start": "load" } },
    "definitions": {
      "variables": {
        "bg":    { "type": "color",  "defaultValue": "#2a7fff", "description": "Ball colour" },
        "size":  { "type": "number", "defaultValue": 40 },
        "title": { "type": "string", "defaultValue": "Hello" }
      },
      "variableVariants": {
        "dark": { "bg": "#111827" },
        "fr":   { "title": "Bonjour" }
      }
    }
  },
  "children": [
    { "type": "circle", "cx": 100, "cy": 100, "r": "variable(size)", "fill": "variable(bg)",
      "animate": { "transform": { "keyframes": [
        { "time": 0, "value": { "translate": [0, 0] } }, { "time": 1000, "value": { "translate": [200, 0] } } ] } } },
    { "type": "text", "x": 200, "y": 190, "fontSize": 24, "textContent": "variable(title)" }
  ]
}
```

How to declare variables and write bindings — `"variable(name)"`, `"calc(variable(size) / 2)"`, where they may
stand, what validation checks — is on the [JSON format page](../format/README.md#variables).

## Giving values

Every player takes the same three options or props — `PxVariablesOptions` — and hands out the same
`variables` API:

<!-- px-check off the three options, prose — their types are checked in the signature block below -->
| Option / prop | What it does | Players |
|---|---|---|
| `variables` | values by name; they win over the file | all |
| `variant` | a named set of defaults from the file's `definitions.variableVariants` | all |
| `cssVariables` | delivers variables as CSS custom properties, so the page's stylesheet can set them — [below](#css-custom-properties--cssvariables) | web player, React, Vue |

### Web player

```js
import { createSvgAnimationPlayer } from '@pixodesk/svg-animator-web';

const player = createSvgAnimationPlayer({
  document: '/card.json',
  container: '#card',
  variables: { bg: '#ef4444', title: 'Hi' },   // applied before the first paint
  variant: 'dark',                             // a named set of defaults from the file
});

player.variables.set('size', 60);                                 // drawn on the next frame
player.variables.setVariables({ bg: '#10b981', title: 'Hey' });   // two at once, one frame; the others stay
player.variables.get('bg');                                       // '#10b981'
player.variables.reset('bg');                                     // back to what the file says; reset() for all
player.variables.setVariant('fr');                                // null: back to the defaults
```

`createSvgAnimationPlayersFromPage(options)` takes the same three options, for every player it creates.

### `player.variables`

<!-- px-check signature pkg=core -->
```typescript
// A variable's value: a number, a string (a colour, text, an image URL, path data), a boolean,
// or a list of numbers (a vector, a number list).
type PxVariableValue = number | string | boolean | Array<number>;

// The options of every player, the props of every component (React Native: no `cssVariables`).
interface PxVariablesOptions {
    variables?: Readonly<Record<string, PxVariableValue>>;   // values by name — they win over the file; a
                                                             //   predefined one too: { 'player.pointer': [50, 50] }
    variant?: string | null;                                 // a set from `definitions.variableVariants`; null: none
    cssVariables?: boolean | Readonly<Record<string, string>>;   // deliver as CSS custom properties — below
}

// `player.variables`, and `variables` on every component handle.
interface PxVariablesApi {
    get(name: string): PxVariableValue | undefined;   // the current value — declared or predefined; undefined: unknown
    set(name: string, value: PxVariableValue): void;  // one value, drawn on the next frame
    setVariables(values: Readonly<Record<string, PxVariableValue>>): void;   // the named ones, in one frame;
                                                      //   the others stay
    getAll(): Record<string, PxVariableValue>;        // every declared variable's current value
    getKeys(): Array<string>;                         // the declared names, in the file's order
    reset(name?: string): void;                       // back to what the file says — one, or (no name) all
    getDefinitions(): Record<string, PxVariableDefinition>;   // the type, default, description and
                                                      //   defaultSource of each declared variable
    setVariant(name: string | null): void;            // show a named set of defaults; null: back to the defaults
    getVariant(): string | null;                      // the variant shown, or null
    getVariantKeys(): Array<string>;                  // the variants the file has
}
```

- `get()` and `getAll()` answer at once; the picture follows on the next frame.
- A value that does not fit the variable's type is ignored with a warning
  ([PX1703](../diagnostics.md#variables)); so is a name the file does not declare and the player does not provide
  ([PX1701](../diagnostics.md#variables)), and a variant the file does not have ([PX1704](../diagnostics.md#variables)).
- A predefined variable is a variable: `get`, `set` and `reset` it by its name (`'player.pointer'`).
  `getAll()` and `getKeys()` list the declared ones only.
- `reset()` keeps the chosen variant: the value goes back to what the file says under it.
- With a URL, writes made before the document has loaded wait, as playback calls do; reads answer empty
  until then (`getVariant()` answers the option). After `destroy()` a write is ignored with a warning
  ([PX1504](../diagnostics.md)).
- Variables are not playback: they work in every control mode — `playback`, `showAtProgress` and
  `showAsStatic` included.

### React

```tsx
import { useRef } from 'react';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-react';
import card from './card.json';

export function Card({ accent, name }: { accent: string; name: string }) {
  const playerRef = useRef<PxAnimationPlayerHandle>(null);
  return (
    <>
      <SvgAnimationPlayer document={card} variables={{ bg: accent, title: name }} variant="dark" playerRef={playerRef} />
      <button onClick={() => playerRef.current?.variables.set('size', 60)}>Bigger</button>
    </>
  );
}
```

- `variables` says what your app gives right now: a changed value is set, a name that leaves the prop goes back
  to what the file says. The compare is per name, so a parent that re-renders sixty times a second costs one
  `setVariables` call per render — no React render of the SVG, no new player, the playback keeps its state and
  time. `variant` switches the same way.
- The first render already carries the values — server rendering included — so the defaults never flash.
- `cssVariables` is read when the player is built; changing it builds the player again.
- `playerRef.current.variables` is the same `PxVariablesApi` the web player hands out.

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SvgAnimationPlayer, type PxAnimationPlayerHandle } from '@pixodesk/svg-animator-vue';
import card from './card.json';
const player = ref<PxAnimationPlayerHandle | null>(null);
const title = ref('Hello');
</script>

<template>
  <SvgAnimationPlayer :document="card" :variables="{ title }" variant="dark" ref="player" />
  <input v-model="title" />
  <button @click="player?.variables.set('size', 60)">Bigger</button>
</template>
```

The props are `variables`, `variant` and `cssVariables` (`:css-variables` in a template), with the React
rules: a watcher hands a changed value to the player, a name that leaves the prop goes back to the file's,
nothing is rendered again. The template ref's `variables` always reaches the current player — a new `document`
or `cssVariables` builds a new one.

### React Native

```tsx
<SvgAnimationPlayer document={card} variables={{ bg: accent }} variant="dark" playerRef={playerRef} />
```

`variables`, `variant` and `playerRef.current.variables` work as in React, with three differences:

- no `cssVariables` — there is no stylesheet;
- a change compiles the document again with the new values on the next frame — the playback keeps running
  (the web writes only the bound attributes);
- the player's own variables (`player.pointer`, `player.playback.…`, `player.prefers.…`) are not fed yet: they
  read their defaults unless your code gives them a value.

## Who wins

For each variable, the first that has a value:

<!-- px-check off precedence, prose -->
| Order | The value from |
|---|---|
| 1 | your code — the `variables` option or prop, `set()`, `setVariables()` |
| 2 | the declaration's `defaultSource`, once the player has a value for it (the pointer has moved) |
| 3 | the chosen variant |
| 4 | the declaration's `defaultValue` |

A predefined variable used directly: your code, then the player's live value, then its predefined default.
With `cssVariables` on, the page's stylesheet comes before all of them —
[below](#css-custom-properties--cssvariables).

## Variants

A variant is a named set of defaults in the file (`definitions.variableVariants`). Pick one with `variant`; a
value from your code still wins over it:

```jsx
<SvgAnimationPlayer document={card} />                                         // blue ball, "Hello"
<SvgAnimationPlayer document={card} variant="dark" />                          // dark ball, "Hello"
<SvgAnimationPlayer document={card} variant="fr" variables={{ bg: '#ff0' }} /> // yellow ball, "Bonjour"
```

```js
player.variables.setVariant('fr');
player.variables.getVariant();       // 'fr'
player.variables.getVariantKeys();   // ['dark', 'fr']
player.variables.setVariant(null);   // back to the defaults
```

Switching never builds a new player: every variable whose default changed is drawn on the next frame. One
variant at a time. What they are for: light and dark, a language, a size or a density, a campaign, an A/B pair.

## CSS custom properties — `cssVariables`

Web player, React and Vue. With `cssVariables`, a variable travels as a CSS custom property, so the page's
stylesheet sets it — themes, dark mode, hover, a site's design tokens — with no code:

```jsx
<div className="card">
  <SvgAnimationPlayer document={card} cssVariables />
</div>
```

```css
.card       { --bg: #111827; }                                 /* this card's ball is dark */
.card:hover { --bg: #ef4444; }                                 /* red while the mouse is over the card */
@media (prefers-color-scheme: dark) { .card { --bg: #000; } }  /* follows the system's dark mode */
```

The player draws `<circle r="40" style="fill: var(--bg, #2a7fff)">` and the browser does the rest: hovering the
card recolours the ball with no render and no player call. With no `--bg` on the page, the file's `#2a7fff`
shows.

**Names.** The value is written without the two dashes; a leading `--` is dropped, so `'--brand-primary'` works
too:

<!-- px-check off the name patterns, prose -->
| `cssVariables` | Custom properties |
|---|---|
| `true` | every declared variable under its own name: `bg` → `--bg` |
| `{ '*': 'card-*' }` | every variable by a pattern, `*` standing for the name: `bg` → `--card-bg`, `size` → `--card-size` |
| `{ bg: 'brand-primary' }` | only `bg`, as `--brand-primary`; the others stay code-only |
| `{ '*': 'card-*', bg: 'brand-primary' }` | `bg` as `--brand-primary`, the rest by the pattern — a named entry beats `*` |

**Places.** A bare `variable(name)` that is the whole value — not a formula, not an item of a pair — on one of
these properties, as an attribute or in `style`: `fill`, `stroke`, `opacity`, `fillOpacity`, `strokeOpacity`,
`strokeWidth`, `stopColor`, `stopOpacity`, `color`. Every other place of the same variable gets the value from
code or the file. Only declared variables travel as CSS, never `player.…`.

**Who wins.** The value from code or the file becomes the fallback — `var(--bg, green)` — and `set()` rewrites
it; the stylesheet has the last word:

<!-- px-check off precedence with CSS, prose -->
| The file says `bg: "#2a7fff"`, and | The ball is |
|---|---|
| nothing else | `#2a7fff` — the file's default |
| `variables={{ bg: 'green' }}` | green — your code replaces the file's default |
| that, and `.card { --bg: blue; }` in the stylesheet | blue — the stylesheet beats both |
| that, and `.card:hover { --bg: red; }` | red while hovered |
| the stylesheet rules removed | green again |

To force a value from code whatever the stylesheet says, leave that variable out of `cssVariables`.

- A page tag gets its own values with no new attribute:
  `<div data-px-document="card.json" style="--bg: #111827"></div>`, read with
  `createSvgAnimationPlayersFromPage({ cssVariables: true })`.
- A value set only in the stylesheet is not seen by `get()`, which answers the value from code or the file.
- An SVG + CSS file exported by the editor writes the same `var(--bg, #2a7fff)`, so the same stylesheet themes
  it when it is inlined in the page — with no player at all. Shown through an `<img>` tag, the file is a
  separate document: the page's CSS cannot reach it.

## Predefined variables

The player provides some variables itself, all named `player.…` — the table is on the
[format page](../format/README.md#predefined-variables--player). Use one directly, or as a declaration's
`defaultSource`:

```json
// a dot that follows the pointer
{ "type": "circle", "r": 20, "fill": "variable(bg)", "transform": { "translate": "variable(player.pointer)" } }

// a progress bar with no keyframes
{ "type": "rect", "x": 0, "y": 196, "height": 4, "width": "calc(variable(player.playback.iterationProgress) * 400)" }
```

<!-- px-check off who feeds the predefined variables, prose -->
| Variables | Web player, React, Vue | React Native |
|---|---|---|
| `player.pointer` · `.x` · `.y` · `.over` · `.down` | pointer events on the rendered drawing, in `viewBox` coordinates; the last position is kept when the pointer leaves | not yet — the defaults |
| `player.playback.currentTime` · `.currentProgress` · `.iterationProgress` | on every frame while it plays | not yet |
| `player.prefers.reducedMotion` · `.colorScheme` | the system's media queries, followed live | not yet |

- The player listens only for what the document uses: no pointer listener on a file that never reads
  `player.pointer`.
- Your code can give one a value — `set('player.pointer', [50, 50])` — for every place that uses it;
  `reset('player.pointer')` hands it back to the pointer.

## How a change is drawn

<!-- px-check off rendering rules, prose -->
| Rule | |
|---|---|
| On the next frame, once | many `set()` calls between two frames cost one write; nothing queues, so a source faster than the screen cannot get ahead |
| Only what is bound | only the places bound to a variable that changed are written; a value set once is written once |
| Never the timeline | a change never seeks, pauses or restarts the animation — an attribute is animated or bound, never both |
| Nothing playing | a change asks for one frame; no loop keeps running |

What a change costs on the web:

<!-- px-check off cost per binding place, prose -->
| Bound to | The player |
|---|---|
| an attribute, a transform part, an item of a pair, a `style` declaration or the text — on a node without `effects` | writes it straight to the rendered element |
| a place delivered as CSS | rewrites the fallback in `var(--name, value)` |
| a `player.playback.…` variable | makes the same writes on every frame while it plays |
| a player effect's setting, or anything on a node with `effects` | builds the player again from the new values — the playback state, time and speed kept, no playback callbacks, `load` triggers not fired again |
| a variable whose default is animated, when your code first gives it a value or resets it | the same rebuild — once, not per frame |

So bind values that change all the time — `player.pointer`, `player.playback.…`, a value your code streams — to
plain attributes, not to effect settings. React Native compiles the document again instead
([above](#react-native)).

## Diagnostics

The mistakes the player reports, once each — the full text is on the
[codes page](../diagnostics.md#variables):

<!-- px-check off diagnostic codes, prose — the codes page is generated from the enum -->
| Code | `kind` | When |
|---|---|---|
| [PX1701](../diagnostics.md#variables) | `document` · `usage` | a binding, or a `set()` call, names a variable that is neither declared nor predefined |
| [PX1702](../diagnostics.md#variables) | `document` | a binding does not parse |
| [PX1703](../diagnostics.md#variables) | `usage` | a value from your code does not fit the variable's type |
| [PX1704](../diagnostics.md#variables) | `usage` | the `variant` asked for is not in the file |

## Accepted limits

<!-- px-check off accepted limits, prose -->
| Limit | |
|---|---|
| The pre-rendered `bind` (an SVG + JS export) | `player.variables` reads the file's declarations and stores values, but does not draw them — the export wrote the values in |
| React Native | a change compiles the document again; no `cssVariables`; the predefined variables are not fed yet |
| A formula reads numbers only | `+ - * /`, brackets and a leading minus — no functions yet; a formula is never delivered as CSS |
| Text that must literally read `variable(x)` | cannot be written — it is read as a binding |
| An animated default bound to an item of a pair or a transform part | shows its first keyframe — only a whole attribute or a whole effect setting animates |
| A rebuild while the playback is finished | comes back paused at the last frame |
| A value set only in the page's CSS | `get()` does not see it |
| One variant at a time | several at once are not planned; a plain string stays valid if they ever are |

## For player authors

`PxVariablesRuntime`, from `@pixodesk/svg-animator-core/engine`, is one player's variables with no platform in
it — the web player, the components and React Native each hold one and draw what it says:

- `new PxVariablesRuntime(document, options, diag)` — `options` is the `PxVariablesOptions`, `diag` a
  `PxDiagnostics` or `undefined`; `runtime.api` is the `PxVariablesApi` the player hands out.
- `runtime.resolvedDocument(markDirectWriteNodes)` is the document with each binding's current value written
  in — what a renderer draws.
- `runtime.attach(requestFlush)` asks to be told when there is something to draw, and returns the detach; the
  platform's next frame calls `runtime.takeChanges()` — a `PxVariableChanges`: the `names` whose value changed,
  and `structural` when an animated default switched on or off (build again).
- `runtime.sitesReading(names)` lists the places to write; `runtime.valueOf(name)` reads a value;
  `runtime.setPredefined(name, value)` feeds the platform's live pointer, playback and system values.

`applyVariablesProp(api, prev, next)` is the components' one rule for the `variables` prop: the changed values
in one `setVariables`, a `reset` for each name that left the prop. React, Vue and React Native all call it. The
binding grammar itself — parsing, evaluating, renaming — is on the format page:
[Variables in a tool of your own](../format/README.md#variables-in-a-tool-of-your-own).

## Why these names

<!-- px-check off naming rationale, prose -->
| Name | Why |
|---|---|
| `"variable(name)"` in place | one rule for every place — an attribute, an item of a pair, a transform part, an effect setting — where a separate map beside the value would need a new key in every kind of object, and could not name one number of a pair. The default lives once, in the declaration |
| `calc(…)` | CSS's own word for a computed value; a formula is parsed into a tree and evaluated, never run |
| `player.…` | the variables this player provides; a declared name has no dot, so the two can never collide, and new ones can be added without breaking a file |
| `defaultSource` | like `defaultValue`, it is what the file gives when your code gives nothing — a value from code makes it irrelevant, and `reset()` brings it back |
| `variant` / `variableVariants` | fits every use — a theme, a language, a size, an A/B pair; `theme` sounds like colours only, `mode` is taken by the control modes, `preset` by the editor's presets |
| `cssVariables` | what it turns on: the variables travel as CSS custom properties. No block in the file — how a variable travels is decided where the animation runs |

[← Playback settings & triggers](./playback-and-triggers.md) · [Contents](../../README.md#documentation) · Next: [Minification →](./minification.md)
