const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// pnpm symlinks: react-native-youtube-iframe's .web.js variant requires
// react-native-web-webview as an optional peer dep. With disableHierarchicalLookup
// the resolver can't find it from inside the pnpm virtual store, so map it
// explicitly to the hoisted symlink in the workspace root.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-web-webview': path.resolve(workspaceRoot, 'node_modules/react-native-web-webview'),
};

module.exports = withNativeWind(config, { input: './src/theme/global.css' });
