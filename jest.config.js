// Jest config — pure-logic unit suites in a fast Node environment.
//
// Covers: formatters (৳/Dhaka/+880/freshness), the error model, JWT decode,
// AES-256-GCM codec round-trip/tamper/wrong-key, and (as added) offline
// state logic. No RN/Expo runtime needed — these are deterministic and fast.
//
// COMPONENT TESTS (RNTL, *.test.tsx) are DEFERRED: jest-expo (SDK 56) + jest
// 30 + the new-architecture "winter" runtime currently trips jest's module
// scope guard on the lazy global `fetch`. RNTL + `test-renderer` are already
// installed for when that ecosystem issue is resolved; until then the React
// Native component + interaction surface is covered by Maestro E2E on device
// (see docs/05 + e2e/). Re-enable a `projects` split with the jest-expo
// preset once the winter-runtime issue is fixed upstream.

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/api/generated/**'],
};
