# Get started with the player library — the examples

One project per section of the [Get started with the player library](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md). Each folder is complete on its
own — its own `package.json`, the published packages from npm, nothing shared with the rest of
this repository — so it is exactly what the guide describes, ready to run and to change.

| Folder | Guide section | Try it in the browser |
|---|---|---|
| [`react/`](./react/) | [React](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#react) | [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/react?startScript=dev&title=Get%20started%20%C2%B7%20React) |
| [`vue/`](./vue/) | [Vue](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#vue) | [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/vue?startScript=dev&title=Get%20started%20%C2%B7%20Vue) |
| [`html-bundler/`](./html-bundler/) | [Plain HTML — with a bundler](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#with-a-bundler-vite-webpack) | [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-bundler?startScript=dev&title=Get%20started%20%C2%B7%20Plain%20HTML%2C%20with%20a%20bundler) |
| [`html-tag/`](./html-tag/) | [No code — the element names the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#no-code--the-element-names-the-file) | [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-tag?startScript=start&title=Get%20started%20%C2%B7%20No%20code%2C%20the%20element%20names%20the%20file) |
| [`html-create-animator/`](./html-create-animator/) | [From code — the player fetches the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#from-code--the-player-fetches-the-file) | [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-create-animator?startScript=start&title=Get%20started%20%C2%B7%20From%20code%2C%20the%20player%20fetches%20the%20file) |
| [`html-fetch/`](./html-fetch/) | [From code — you fetch the file](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#from-code--you-fetch-the-file) | [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-fetch?startScript=start&title=Get%20started%20%C2%B7%20From%20code%2C%20you%20fetch%20the%20file) |
| [`html-inline-json/`](./html-inline-json/) | [From code — the JSON inside the page](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#from-code--the-json-inside-the-page) | [Open in StackBlitz](https://stackblitz.com/github/pixodesk/pixodesk-svg-animator/tree/main/examples/get-started/html-inline-json?startScript=start&title=Get%20started%20%C2%B7%20From%20code%2C%20the%20JSON%20inside%20the%20page) |
| [`react-native/`](./react-native/) 🧪 | [React Native](https://github.com/pixodesk/pixodesk-svg-animator/blob/main/docs/library/get-started.md#react-native) | — (a phone or a simulator) |

## Try one in the browser

The **Open in StackBlitz** links run a project in your browser tab — its code, a terminal and
the page, with nothing installed and no account: StackBlitz installs the project's dependencies
and starts it, and you can edit the code and watch the animation change.

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

Every project here is checked end to end on every build — installed with npm, built, and
opened in a browser where the animation has to play — twice over: `pnpm build` runs it against
the packages about to be released (`pnpm check:get-started --local`), and CI runs it against the
published ones, as you get them (`pnpm check:get-started`). A project that breaks fails the build.
