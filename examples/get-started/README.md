# Get started — the examples

One project per section of the [Get started guide](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md). Each folder is complete on its
own — its own `package.json`, the published packages from npm, nothing shared with the rest of
this repository — so it is exactly what the guide describes, ready to run and to change.

| Folder | Guide section |
|---|---|
| [`react/`](./react/) | [React](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#react) |
| [`vue/`](./vue/) | [Vue](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#vue) |
| [`html-bundler/`](./html-bundler/) | [Plain HTML — with a bundler](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#with-a-bundler-vite-webpack) |
| [`html-tag/`](./html-tag/) | [No code — the element names the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#no-code--the-element-names-the-file) |
| [`html-create-animator/`](./html-create-animator/) | [From code — the player fetches the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#from-code--the-player-fetches-the-file) |
| [`html-fetch/`](./html-fetch/) | [From code — you fetch the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#from-code--you-fetch-the-file) |
| [`html-inline-json/`](./html-inline-json/) | [From code — the JSON inside the page](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#from-code--the-json-inside-the-page) |
| [`react-native/`](./react-native/) 🧪 | [React Native](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/get-started/README.md#react-native) |

## Get one

Just the folder you want, without the rest of the repository:

```bash
npx giget@latest gh:pixodesk/pixodesk-svg-animator/examples/get-started/react my-animation
cd my-animation
npm install
npm run dev
```

Or clone the repository and `cd examples/get-started/react`. Each README says what its
project shows and how to run it; `npm start` for the no-build projects, `npm run dev` for the
rest, `npx expo start` for React Native.

Every project here is installed and built on CI from the published packages
(`pnpm check:get-started` does the same locally), so what you download works.
