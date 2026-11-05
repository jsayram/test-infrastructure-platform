import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['apps/api/**/*.js', 'scripts/**/*.mjs', 'tests/playwright/**/*.{js,mjs}', 'tests/mobile/run.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
];
