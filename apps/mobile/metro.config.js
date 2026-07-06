const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm symlinks: react-native-youtube-iframe's .web.js variant requires
// react-native-web-webview as an optional peer dependency. Keep Expo's default
// monorepo watch/resolution settings and map only this optional web shim.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-web-webview': path.resolve(workspaceRoot, 'node_modules/react-native-web-webview'),
};

module.exports = withNativeWind(config, { input: './src/theme/global.css' });
