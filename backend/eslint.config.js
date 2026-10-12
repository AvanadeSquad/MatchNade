import js from '@eslint/js';
import globals from 'globals';

// Regras recomendadas do ESLint para Node.js com módulos ES.
export default [
  { ignores: ['node_modules/', 'reports/', '.stryker-tmp/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
