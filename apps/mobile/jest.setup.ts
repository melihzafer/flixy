jest.mock('expo-constants', () => ({
  expoConfig: { extra: {} },
}));

jest.mock('posthog-react-native', () => jest.fn());

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `flixy:///${path}`,
}));
