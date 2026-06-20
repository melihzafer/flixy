module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@flixy/shared$': '<rootDir>/../../packages/shared/src',
  },
  collectCoverageFrom: ['src/features/**/*.{ts,tsx}', '!**/*.d.ts', '!**/__tests__/**'],
  coverageThreshold: {
    global: { lines: 60, statements: 60, functions: 60, branches: 50 },
  },
};
