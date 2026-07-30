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

module.exports = config;
