// Metro config for the pnpm monorepo: watch the workspace root and resolve
// modules from both the app's and the root's node_modules (standard Expo
// monorepo setup). The @pixodesk/svg-animator-rn package points its
// "react-native" entry at TS source so 'worklet' directives reach the babel
// worklets plugin intact.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the workspace root so the local @pixodesk/* packages are picked up.
// Everything Metro does at startup scales with how many files this covers, so
// the blockList below is not an optimisation — without it Metro crawls every
// node_modules in the monorepo (~50k files) before it can serve the first
// bundle, and a phone waiting on that request gives up with "The request timed
// out" long before Metro is ready.
config.watchFolders = [workspaceRoot];

const escapedRoot = workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

config.resolver.blockList = [
    // VCS internals and test artefacts — never importable, and `.git` alone is
    // ~2k files of churn for the watcher.
    new RegExp(`${escapedRoot}/\\.git/.*`),
    new RegExp(`${escapedRoot}/(?:[^/]+/)*(?:test-results|playwright-report|coverage)/.*`),
    // The OTHER example apps: siblings with their own node_modules, never
    // imported from here. NB `dist` and `packages/*/node_modules` are NOT
    // blocked — @pixodesk/svg-animator-core resolves through both (its entry
    // is `dist/index.cjs`, reached via a pnpm symlink under the rn package).
    new RegExp(`${escapedRoot}/examples/(?!react-native-feature-explorer/)[^/]+/.*`),
];

config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

// pnpm uses symlinks; Metro follows them by default in RN 0.72+.
config.resolver.unstable_enableSymlinks = true;

// Force a SINGLE instance of every package that owns native state.
//
// pnpm gives each workspace package its own node_modules, and it forks a
// dependency into two physical copies whenever a peer differs (a mismatched
// `@types/react` is enough). Two copies of react-native-svg means the copy our
// renderer imports is not the copy whose native view configs were registered,
// which fails at runtime with:
//   "View config getter callback for component `RNSVGLine` must be a function"
// Redirecting these specifiers at the app's own copy makes that class of bug
// impossible, regardless of how the store is laid out.
const SINGLETONS = [
    'react',
    'react-dom',
    'react-native',
    'react-native-svg',
    'react-native-reanimated',
    'react-native-worklets',
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    const pkg = SINGLETONS.find(
        (name) => moduleName === name || moduleName.startsWith(name + '/')
    );
    if (pkg) {
        // Resolve as if the import came from the app itself, so it always
        // lands in the app's node_modules — never a nested workspace copy.
        return context.resolveRequest(
            { ...context, originModulePath: path.join(projectRoot, 'index.js') },
            moduleName,
            platform
        );
    }
    return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

// NB: do NOT set `transformer.getTransformOptions` with `inlineRequires` here.
// It looks like an easy startup win, but moving requires inline reorders module
// initialisation in a way react-native-worklets cannot survive — every render
// then dies with "[Worklets] createSerializableObject should never be called in
// JSWorklets". Deferred loading belongs in application code instead; see the
// lazy fixture getters in `src/catalog.ts`.

module.exports = config;
