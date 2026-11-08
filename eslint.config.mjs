import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'handpan-app/node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'scripts/chop/out/**',
      'handpan-app/sounds/fixtures/**',
      'package-lock.json',
      '*.lock',
    ],
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2022,
      globals: {
        // Browser globals used by the Pionier app shell.
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        performance: 'readonly',
        AudioContext: 'readonly',
        AudioWorkletNode: 'readonly',
        caches: 'readonly',
        self: 'readonly',
        importScripts: 'readonly',
        requestIdleCallback: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        MediaRecorder: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        XMLHttpRequest: 'readonly',
        matchMedia: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        PointerEvent: 'readonly',
        TouchEvent: 'readonly',
        WheelEvent: 'readonly',
        screen: 'readonly',
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules,
      // Prettier is the formatter; report formatting as lint errors so CI fails.
      'prettier/prettier': 'error',
      // Core rules that are safe for this codebase.
      semi: ['error', 'always'],
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off', // app logs to console intentionally
      'no-constant-condition': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-with': 'error',
      'no-unreachable-loop': 'error',
      'require-await': 'warn',
    },
  },
];
