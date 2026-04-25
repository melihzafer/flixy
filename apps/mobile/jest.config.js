module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind))',
  ],
  collectCoverageFrom: ['src/features/**/*.{ts,tsx}', '!**/*.d.ts', '!**/__tests__/**'],
  coverageThreshold: {
    global: { lines: 60, statements: 60, functions: 60, branches: 50 },
  },
};
