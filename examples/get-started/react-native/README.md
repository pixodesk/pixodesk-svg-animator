# Get started — React Native

The [React Native](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#react-native) section of the *Get started with the player library* guide as a project of its own: an Expo app whose `App.js` renders `animation.json`, the file next to it, with `<PixodeskSvgAnimator doc={animation} autoplay />`. 🧪 The React Native player is in development.

```bash
npm install
npx expo start   # then press i (iOS), a (Android), or scan the QR code
```

`babel.config.js` carries the one line Reanimated needs — its Babel plugin, last in the list.

Plain JavaScript, the same code as the guide. In TypeScript, cast the JSON import once —
see [Installing the players › TypeScript](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/installation.md#typescript).
