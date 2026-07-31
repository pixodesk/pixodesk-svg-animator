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

config.watchFolders = [workspaceRoot];

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

module.exports = config;
