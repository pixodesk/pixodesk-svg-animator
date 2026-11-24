# Player diagnostic codes

<!-- GENERATED from packages/svg-animator-core/src/playback/PxDiagnosticCode.ts by scripts/gen-diagnostics-md.mjs — edit the enum, not this file. -->

Every warning and error a player reports carries a **number**, not a sentence. The player
ships the number; the words are here. That keeps the library small, and gives each
diagnostic a stable identity you can switch on in code and search for.

```js
createSvgAnimationPlayer({
  document: '/animation.json',
  container: '#stage',
  onWarning: d => console.log(d.code, d.data),   // 1204, ['#missing']
  onError:   d => report(d.code, d.error),
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
| <a id="px1001"></a>**1001** | The player could not be built from this document — a document that passed validation but still broke the builder, or a bug in the player. Report it. | the Error |
| <a id="px1002"></a>**1002** | The file at the `document` URL loaded, but it is not a Pixodesk animation document. | the URL |
| <a id="px1003"></a>**1003** | The page could not fetch the `document` URL. The file may be perfect — this is the request failing. | the URL · the fetch error's message |
| <a id="px1004"></a>**1004** | One element's animation could not be built, so that element stays static; the rest plays. | the Error |

## What the document says

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| <a id="px1101"></a>**1101** | An `effects` bucket does not match the schema, so that effect is ignored or degraded. | the problem, with the node's path |
| <a id="px1102"></a>**1102** | Part of the per-instance `timeline` override could not be applied — most often clock-only keys aimed at a scroll timeline. | what could not be applied |
| <a id="px1103"></a>**1103** | An SVG tag that can execute or load remote content was dropped from the rendered tree. | the tag name |
| <a id="px1104"></a>**1104** | The browser will not animate these attributes, so the document fell back to the frame loop. | the attribute names |
| <a id="px1105"></a>**1105** | A bind-by-id document carries no `animator.bindings`, so nothing is animated. | — |
| <a id="px1107"></a>**1107** | A transform part is animated as its own `animate` channel (`animate.translate`, …) — the deprecated spelling: several on one node are last-write-wins. Spell it `animate.transform` (record keyframes), or `effects.transformBy` for independently-timed parts. | the channel(s) and the node |
| <a id="px1108"></a>**1108** | A document value did not match the schema and was repaired before playing — replaced by the schema's default, or dropped when nothing could be kept. The document plays; the value is not what was written. | the problem, with its path |
| <a id="px1109"></a>**1109** | Two trigger lists react to one event in the same state: `timeline.stop` and `timeline.pause` (playing — the pause wins), or `timeline.stop` and the counterpart of a `timeline.pause` event (paused — the resume wins). The file should name one. | the event and the two lists |
| <a id="px1110"></a>**1110** | A trigger list names an event it cannot use — `timeline.start` on `hoverOut`, `timeline.stop` on `load` or `hoverIn`, `timeline.pause` or `timeline.resume` on `load`. The event is ignored. | the list and the event |
| <a id="px1111"></a>**1111** | The file's `timeline.resume` list differs from what the player would derive — the counterpart of each `timeline.pause` event plus the `timeline.start` events that do not stop it: it names an event the derivation would not, or leaves out one it would (that pause then waits for `timeline.start` or `timeline.stop`). The list is honoured as written. | the list and the event |
| <a id="px1112"></a>**1112** | The document has keys or shapes this build's schema does not know — unrecognized keys above all. It plays, with those parts ignored. If you did not author them, the usual cause is a build that MANGLES PROPERTY NAMES: an animation document is data loaded at runtime, so renaming the property reads inside the player stops them matching the keys in the JSON, and the animation silently does nothing. Feed the published reserved-name list to your minifier — `@pixodesk/svg-animator-web/mangle-reserved.json`, see docs/library/minification.md. Reaches `onWarning` like every other diagnostic; `suppressWarnings` silences the console fallback (until 1.15 this report went to the console on its own). | the problems (path: finding), the first twelve, then the mangling hint |
| <a id="px1113"></a>**1113** | An event names an `element` (2026-11-15) that the picture does not have — a typo, or an element the file lost. The event is never heard. | the element reference |
| <a id="px1114"></a>**1114** | A `flow.goTo` names a flow step the file does not have (flows 2026-11-22; states 11-20, segments 11-15) — in a rule of `actions`, also one for a step's end (`finished`) — or a rule's `from` does (1.29). It is ignored. | the step it names, the step whose end it is (a `finished` rule's `from`), and the ids the file has |
| <a id="px1115"></a>**1115** | Two flow steps have the same id (flows 2026-11-22; states 11-20, segments 11-15) — the first in the list is played, the later one is ignored: a rule or a go-to cannot tell them apart. | the id |
| <a id="px1116"></a>**1116** | A finding about timelines, flows and flow steps (2026-11-20; flows 2026-11-22): a repeated timeline or flow id, a reference that names nothing, one timeline in two flows, a step on a part of a scroll-driven timeline, an attribute two flows move, plain keyframes in a file with no default timeline. The file plays — the first one wins. | the finding: `{ kind, key?, id?, at?, attribute? }` (`timelineIssues`) |
| <a id="px1106"></a>**1106** | A binding names no element, or names animations that `definitions.animations` does not have. | the binding |

## The mount: elements the player could not find

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| <a id="px1201"></a>**1201** | `setupAnimationTriggers` was given no root element, so no trigger was wired. | — |
| <a id="px1202"></a>**1202** | The container selector matched nothing, so there is nothing to render into. | the selector |
| <a id="px1203"></a>**1203** | No container was given and the document's `id` matched no element already on the page. | — |
| <a id="px1206"></a>**1206** | A binding's selector matched no element, so that binding animates nothing. | the selector |
| <a id="px1207"></a>**1207** | An attribute write found no element for this id — the rendered SVG was probably replaced. | the id or selector |

## Scroll-driven playback

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| <a id="px1301"></a>**1301** | `smoothing` needs the player's own driver, so the browser's scroll timeline was not used. | — |
| <a id="px1302"></a>**1302** | The browser refused to build a native scroll timeline; the player measures progress itself. | — |
| <a id="px1303"></a>**1303** | `timeline.selector` is not a valid CSS selector, so the animation itself is followed instead (`containerScroll`: the scrolling box around it). | the selector |
| <a id="px1304"></a>**1304** | `timeline.selector` matched no element in the page, so the animation itself is followed instead (`containerScroll`: the scrolling box around it). | the selector |
| <a id="px1305"></a>**1305** | There is no root element to observe, so a scroll-driven animation stays on its first frame. | — |
| <a id="px1306"></a>**1306** | `timeline.triggers` does not apply to a scroll timeline — the scrollbar is the playhead. | — |
| <a id="px1307"></a>**1307** | `engine: "native"` asked for the browser's scroll timeline, but a moment is an exact place (`{ element, screen }`), which the browser cannot be given with its order known — the player measures by itself. | the moment |

## Playback control

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| <a id="px1401"></a>**1401** | A playback rate of `0`, or a non-finite one, is rejected everywhere — use `timeline.pause()`. | — |

## The props a component was given

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| <a id="px1501"></a>**1501** | Props from more than one control mode were set at once. The higher-priority mode wins and the other props are ignored — see the control-mode rule. | which props conflicted, and which won |
| <a id="px1502"></a>**1502** | Retired (1.24): `pause` without `play` could be written with two boolean props; the one `playback` lever has no invalid position pair. The number stays reserved so older hosts' switches keep their meaning. | the explanation |
| <a id="px1503"></a>**1503** | An imperative write call (`timeline.start()`, `timeline.pause()`, `timeline.play()`, …) landed while a declarative driver (the `playback` or the `showAtProgress` / `showAtTime` props) owns playback. The call is applied, and the next prop change reasserts the props. | the call |
| <a id="px1504"></a>**1504** | A call on a destroyed player — ignored; `timeline.getState()` says `destroyed`. | the call |
| <a id="px1505"></a>**1505** | A playback call on a scroll timeline — a button (`timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()`), the speed (`timeline.setSpeed()`, `timeline.setDurationAtSpeed()`) or a seek (`timeline.setCurrentTime()`, `timeline.setCurrentProgress()`, `timeline.setTotalTime()`, and the components' `showAtProgress` / `showAtTime`, which seek through them) — ignored: the scrolling owns the playhead. The reads still answer. To drive it from code, make it a clock timeline: `timelineOptions: { type: 'time' }`. | the call |
| <a id="px1506"></a>**1506** | A playback call (`timeline.start()`, `timeline.play()`, `timeline.stop()`, `timeline.pause()`, `timeline.resume()`, a seek, `timeline.setSpeed()`, `timeline.setDurationAtSpeed()`) on a player shown with `showAsStatic` — ignored: the picture stays as drawn. The reads still answer. | the call |
| <a id="px1507"></a>**1507** | A name in the `flows` or `timelines` option or prop that the file does not have (2026-11-22) — ignored. `default` names the flow `default` and the timeline with no id. | the list (`flows` or `timelines`) · the name |

## React Native

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| <a id="px1601"></a>**1601** | The document could not be compiled into animation tracks, so `fallback` is shown. | the Error |
| <a id="px1602"></a>**1602** | Rendering the compiled document threw, so `fallback` is shown. | the Error |
| <a id="px1603"></a>**1603** | The error boundary caught a render failure below this component. | the Error · the React component stack |
| <a id="px1604"></a>**1604** | `react-native-svg` cannot express part of this document, so it was left out or simplified. | what was left out |
| <a id="px1605"></a>**1605** | React Native plays ONE flow (2026-11-22): the first that runs; the others are not played. Its steps go one to the next at once — a step's `whenLeaving` is not played on React Native. | the flows not played |

## Variables

<!-- px-check off generated from the PxDiagnosticCode enum -->
| Code | What it means | Data |
|---|---|---|
| <a id="px1701"></a>**1701** | A binding (`var(name)`, `calc(…)`) or a `variables.set()` call names a variable the document does not declare and the player does not provide — ignored; a binding's place reads as if it were not written. | the name |
| <a id="px1702"></a>**1702** | A value written as a binding does not parse — its place reads as if it were not written. | the text · why it does not parse |
| <a id="px1703"></a>**1703** | A value given for a variable (`variables.set()`, the `variables` option or prop) does not fit its type — ignored. | the name · the variable's type · the value |
| <a id="px1704"></a>**1704** | The `variant` the host asked for is not in the document's `definitions.variableVariants` — the defaults are used. | the variant name |

