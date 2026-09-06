# Library documentation — the players

How to install and use the player libraries that render and control **JSON** animations:
plain HTML, React, Vue and React Native, plus the playback settings and triggers they all
share. (Playing a **pre-rendered SVG** needs no library — see
[Pre-rendered SVG documentation](https://pixodesk.com/docs/svga/prerendered-svg).)

## Contents

1. [Installing the players](./installation.md) — npm packages, the UMD build for pages without a bundler, TypeScript
2. [Web player (`@pixodesk/svg-animator-web`)](./web-player.md) — `createAnimator`, the playback API, callbacks, triggers
3. [React (`@pixodesk/svg-animator-react`)](./react.md) — the player component, its props, control modes, Next.js
4. [Vue (`@pixodesk/svg-animator-vue`)](./vue.md) — the player component, props, events, Nuxt
5. [React Native (`@pixodesk/svg-animator-rn`)](./react-native.md) 🧪 — *in development*; install, props, feature support, limitations
6. [Playback settings & triggers](./playback-and-triggers.md) — the `animator` configuration, and overriding it from props or the player API
7. [Troubleshooting & FAQ](./troubleshooting.md) — nothing plays, React/TypeScript/React Native gotchas, playback behaviour

## See also

- [Which format do I need?](https://pixodesk.com/docs/svga/editor/choosing-a-format)
- [Format documentation](../format/README.md) — the JSON documents the players consume
- [Documentation home](../../README.md#documentation)
