// Jest config — split into projects:
//   - "node": fast pure-logic suites (formatters, errors, jwt, offline logic)
//     run in a Node environment with babel-transformed TS. No RN/Expo runtime.
//   - "rn": component/integration suites (*.test.tsx) under the jest-expo
//     preset for the React Native runtime.
//
// Pure-logic tests carry the coverage floor; component + Maestro E2E cover
// the RN/native surface (docs/05).

const alias = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@app/(.*)$': '<rootDir>/app/$1',
};

module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
      transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
      moduleNameMapper: alias,
    },
    {
      displayName: 'rn',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
      moduleNameMapper: alias,
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|@sentry/.*|native-base))',
      ],
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/api/generated/**'],
};
