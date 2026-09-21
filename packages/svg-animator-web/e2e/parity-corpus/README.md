# Parity corpus

Documents every DOM player must render **identically**. The React and Vue packages each run
`parity.test` over this folder (and the sample documents one level up): every document goes
through the web renderer and through the component, and the resulting DOM is compared element
by element, attribute by attribute.

All three players render through one function — core's `renderPxTree` — and differ only in how
an element is created, so a difference here means that contract was broken.

Each file is a real document that once rendered differently in React / Vue than in the web player:

| File | What it caught |
|---|---|
| `effects-gradient-and-mask.json` | Paint from `effects` only — the components rendered the raw document, so no gradient or mask defs existed and the canvas was empty |
| `mask-alpha-load-trigger.json` | A root `<svg>` with no id left the triggers with nothing to attach to (static), and `maskType` reached the DOM camelCased, so the mask fell back to luminance (dark) |
| `text-on-path-animated.json` | Animated glyphs on a path had no static pose, so every letter sat stacked on one spot until a frame was applied |

Add a document here whenever one renders differently between players.
