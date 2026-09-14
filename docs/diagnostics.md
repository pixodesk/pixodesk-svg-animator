# Diagnostic codes

<!-- GENERATED from packages/svg-animator-core/src/playback/PxDiagnosticCode.ts by scripts/gen-diagnostics-md.mjs — edit the enum, not this file. -->

Every warning and error a player reports carries a **number**, not a sentence. The player
ships the number; the words are here. That keeps the library small, and gives each
diagnostic a stable identity you can switch on in code and search for.

```js
createAnimator({
  src: '/animation.json',
  container: '#stage',
  onWarn:  d => console.log(d.code, d.data),   // 1204, ['#missing']
  onError: d => report(d.code, d.error),
});
```

Without a handler the player prints the code, the data and a link to this page. The
`kind` beside it says **who can act**: `document` repair the file · `host` fix the page ·
`platform` the browser could not do it · `usage` fix what you passed · `internal` report it.

A code is permanent: numbers are never reused, and a retired one stays listed.

## Building a player

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| **1001** | The player could not be built from this document — a document that passed validation but still broke the builder, or a bug in the player. Report it. | the Error |
| **1002** | The file at `src` loaded, but it is not a Pixodesk animation document. | the `src` URL |
| **1003** | The page could not fetch `src`. The file may be perfect — this is the request failing. | the `src` URL · the fetch error's message |
| **1004** | One element's animation could not be built, so that element stays static; the rest plays. | the Error |

## What the document says

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| **1101** | An `effects` bucket does not match the schema, so that effect is ignored or degraded. | the problem, with the node's path |
| **1102** | Part of the per-instance `timeline` override could not be applied — most often clock-only keys aimed at a scroll timeline. | what could not be applied |
| **1103** | An SVG tag that can execute or load remote content was dropped from the rendered tree. | the tag name |
| **1104** | The browser will not animate these attributes, so the document fell back to the frame loop. | the attribute names |
| **1105** | A bind-by-id document carries no `animator.bindings`, so nothing is animated. | — |
| **1106** | A binding names no element, or names animations that `definitions.animations` does not have. | the binding |

## The mount: elements the player could not find

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| **1201** | `setupAnimationTriggers` was given no root element, so no trigger was wired. | — |
| **1202** | The container selector matched nothing, so there is nothing to render into. | the selector |
| **1203** | No container was given and the document's `id` matched no element already on the page. | — |
| **1206** | A binding's selector matched no element, so that binding animates nothing. | the selector |
| **1207** | An attribute write found no element for this id — the rendered SVG was probably replaced. | the id or selector |

## Scroll-driven playback

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| **1301** | `smoothing` needs the player's own driver, so the browser's scroll timeline was not used. | — |
| **1302** | The browser refused to build a native scroll timeline; the player measures progress itself. | — |
| **1303** | `scroll.subject` is not a valid CSS selector, so the SVG itself is measured instead. | the subject |
| **1304** | `scroll.subject` matched no element, so the SVG itself is measured instead. | the subject |
| **1305** | There is no root element to observe, so a scroll-driven animation stays on its first frame. | — |
| **1306** | `animator.trigger` does not apply to a scroll timeline — the scrollbar is the playhead. | — |

## Playback control

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| **1401** | A playback rate of `0`, or a non-finite one, is rejected everywhere — use `pause()`. | — |

## The props a component was given

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| **1501** | Two control tiers were set at once. The higher one wins and the lower is ignored — see the control-mode rule. | which props conflicted, and which won |

## React Native

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| **1601** | The document could not be compiled into animation tracks, so `fallback` is shown. | the Error |
| **1602** | Rendering the compiled document threw, so `fallback` is shown. | the Error |
| **1603** | The error boundary caught a render failure below this component. | the Error · the React component stack |
| **1604** | `react-native-svg` cannot express part of this document, so it was left out or simplified. | what was left out |

