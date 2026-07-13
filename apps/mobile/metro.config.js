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

// zustand v5's ESM build (esm/*.mjs, picked via the "import" exports condition
// on web) contains `import.meta.env` checks in zustand/middleware. Expo's
// static web export loads bundles as classic scripts, where `import.meta` is a
// parse-time SyntaxError — the whole app dies before React mounts (prod black
// screen). Native is unaffected because the "react-native" condition already
// resolves to the CJS build; route web to the same CJS files.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && (moduleName === 'zustand' || moduleName.startsWith('zustand/'))) {
    try {
      return { type: 'sourceFile', filePath: require.resolve(moduleName) };
    } catch {
      // fall through to Metro's resolver for unknown subpaths
    }
  }
  if (defaultResolveRequest) return defaultResolveRequest(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/theme/global.css' });
