// ESLint (flat config) — Expo preset + project guards.
import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['dist/*', 'src/api/generated/*', '.expo/*'],
  },
  {
    rules: {
      // No PHI in logs (mirrors the web phi-console-leak discipline). A
      // custom rule lands in Phase 1; for now console use is discouraged.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
