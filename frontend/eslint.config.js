import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Regras recomendadas do ESLint e as duas regras clássicas de hooks do React:
// hooks só no topo de componentes e hooks, e dependências completas nos efeitos.
export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // Nomes com inicial maiúscula são componentes usados no JSX, que a regra base não enxerga.
      'no-unused-vars': ['error', { argsIgnorePattern: '^(_|[A-Z])', varsIgnorePattern: '^[A-Z]', caughtErrors: 'none' }],
    },
  },
  { files: ['vite.config.js', 'eslint.config.js'], languageOptions: { globals: globals.node } },
];
