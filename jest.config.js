// Jest config — unit + component tests (jest-expo preset).
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*))',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/api/generated/**'],
  coverageThreshold: {
    // Ratchet: raise as the suite grows. Pure-logic modules carry the floor.
    global: { lines: 0, functions: 0, branches: 0, statements: 0 },
  },
};
