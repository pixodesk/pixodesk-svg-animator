# Introduction

[← Contents](../../README.md) · Next: [Choosing a format →](./choosing-a-format.md)

Pixodesk SVG Animator is an **editor** that makes SVG animations, a set of **players** that
run them, and the **file format** that connects the two. You make the animation once, save it
as a file, and that file plays anywhere SVG does.

**The editor** is a full-featured vector and animation tool. Draw shapes, paths and text, or
import SVG from Illustrator, Figma, Inkscape and other design tools. Animate any property on a timeline,
add effects, then save. It also imports and exports **Lottie**, and exports to video, GIF and
static images when you need a fallback. It ships as the *Pixodesk Animator Studio* desktop app
for Windows and Mac, from [pixodesk.com](https://pixodesk.com).

**The players** are small, open-source runtime libraries — MIT-licensed, published on npm as
`@pixodesk/svg-animator-*`, and developed in [this repository](../../README.md). Pick the one for
where the animation runs: plain **HTML**, **React**, **Vue** or **React Native**. Control
playback from code — play, pause, speed — or let the animation start itself on
load, click or scroll.

**The format** stays as close to plain SVG as it can, with a wide vector feature set. It comes
in two flavours:

- **JSON** — the source: the SVG tree plus its animation, read by a player.
- **Pre-rendered SVG** — a normal `.svg` with the animation already inside, ready to embed or
  inline straight into a page. Three variants:
  - **SVG + CSS animation** — pure CSS keyframes, no JavaScript at all
  - **SVG + CSS animation + JS triggers** — the same, plus a few inline lines of script (added by the editor app) for click and scroll triggers
  - **SVG + JS animation** — the player embedded in the file, running on the engine you choose, **WAAPI** or **frames**

The two flavours take different routes to the screen:

```mermaid
%%{init: {'theme':'base', 'flowchart':{'nodeSpacing': 40, 'rankSpacing': 55, 'curve': 'basis'}}}%%
flowchart LR
    Editor(["the editor"])
    JSON["<b>JSON</b><br/>SVG tree + animation"]
    Player["a <b>player</b><br/>web · React · Vue<br/>React Native"]
    App["your page or app"]

    Editor -- save --> JSON -- rendered by --> Player --> App
```

```mermaid
%%{init: {'theme':'base', 'flowchart':{'nodeSpacing': 40, 'rankSpacing': 55, 'curve': 'basis'}}}%%
flowchart LR
    Editor(["the editor"])
    SVG["<b>pre-rendered SVG</b><br/>CSS keyframes<br/>CSS + JS triggers<br/>JS player"]
    Page["embed / inline in a page"]
    Browser["the browser plays it"]

    Editor -- save --> SVG -- nothing to install --> Page --> Browser
```

## Use for

- Splash screens
- Animated backgrounds
- Icon animations
- Loaders
- Illustrations that react to hover, click or scroll
- Animated logos


## JSON and pre-rendered SVG

**JSON** is the source format: a small document describing the SVG tree plus its animation.
A player library renders it and gives you complete runtime control — play, pause, jump to any point,
reverse, speed — and supports every animation type on every browser. It is the right choice
for apps (React / Vue / React Native), for complex animations, and whenever you need to drive
the animation from code.

**Pre-rendered SVG** is a normal `.svg` file with the animation built in. Drop it into any
page, CMS or static-site generator and it plays — no library needed for the CSS flavour. It is
the simplest option and the right one for most icons, loaders and decorative animation. Its
one rule: **inline each file only once per page** — its element ids are fixed, so a second copy
collides with the first ([read more](../prerendered-svg/on-the-web.md#one-copy-of-a-file-per-page)). For several instances of one animation, use JSON.

Both JSON and animated SVG have the same features, and the editor converts between them at any time
(**File → Save as JSON / Save as SVG**), so the choice is never final.

## Which file format do I need?

Start from where the animation is going:

- **A page, a CMS, a static site — and you just want it to play.** Use a **pre-rendered SVG**.
  No package to install: paste it in or let your build tool inline it. Start at
  [Pre-rendered SVG on the web](../prerendered-svg/on-the-web.md).
- **An app, or anything you need to control from code.** Use **JSON** with the player for your
  stack. Start at [Installing the players (overview)](../library/installation.md).

| Your stack | Package |
|---|---|
| Vanilla JavaScript | `@pixodesk/svg-animator-web` |
| React / Next.js | `@pixodesk/svg-animator-react` |
| Vue / Nuxt | `@pixodesk/svg-animator-vue` |
| React Native / Expo 🧪 *(in development)* | `@pixodesk/svg-animator-rn` |
| The core every player builds on — the format schema and the shared algorithms | `@pixodesk/svg-animator-core` |

Still unsure? [Choosing a format](./choosing-a-format.md) has the side-by-side
comparison and what each engine can animate.

The React and Vue packages wrap the web player; every player shares the core, so the same
document produces the same frames everywhere:

```mermaid
%%{init: {'theme':'base', 'flowchart':{'nodeSpacing': 40, 'rankSpacing': 55, 'curve': 'basis'}}}%%
flowchart TD
    Core["<b>svg-animator-core</b><br/>schema, utils,<br/><i>no DOM</i>"]
    Web["<b>svg-animator-web</b><br/>DOM"]
    RN["<b>svg-animator-rn</b> 🧪<br/><i>in development</i><br/>Based on <br/>react-native-svg,<br/>reanimated"]
    React["<b>svg-animator-react</b>"]
    Vue["<b>svg-animator-vue</b>"]

    React --> Web
    Vue --> Web
    Web --> Core
    RN --> Core
```

## Where next

- Deciding on a format → [Choosing a format](./choosing-a-format.md)
- Learning the editor → [The editor](./editor.md)
- Embedding a pre-rendered SVG → [Pre-rendered SVG on the web](../prerendered-svg/on-the-web.md)
- Installing a player → [Installing the players (overview)](../library/installation.md)
- Understanding the file → [Format principles](../format/principles.md), [JSON format reference](../format/json-format.md)

[← Contents](../../README.md) · Next: [Choosing a format →](./choosing-a-format.md)
