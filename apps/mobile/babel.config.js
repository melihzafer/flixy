module.exports = (api) => {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Reanimated v4 split the worklets plugin into its own package.
    // It must remain LAST in the plugins array.
    plugins: ['react-native-worklets/plugin'],
  };
};
