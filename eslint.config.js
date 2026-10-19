import base from './web/eslint.config.js';
import hooks from 'eslint-plugin-react-hooks';

export default [
  ...base,
  { files: ['web/src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks }, rules: { 'react-hooks/rules-of-hooks': 'error' } },
  { files: ['scripts/*.mjs'], languageOptions: { globals: Object.fromEntries(['process', 'URL', 'console', 'document', 'getComputedStyle', 'innerWidth', 'localStorage', 'matchMedia'].map(name => [name, 'readonly'])) } },
];
