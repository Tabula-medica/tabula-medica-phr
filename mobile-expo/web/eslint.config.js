// Flat ESLint config for the React 18 + Vite web SPA.
// Kept separate from the root Expo (React Native) config in ../eslint.config.js:
// the RN-oriented eslint-config-expo rules are wrong for a browser DOM app.
//
// Formatting (Prettier) is intentionally NOT run as an ESLint rule here — it is
// run separately via the `format` / `check:format` scripts. Running Prettier as
// an ESLint rule over the ~850-file SPA is prohibitively slow. `eslint-config-
// prettier` is applied last only to switch off ESLint's own stylistic rules so
// the two tools never disagree.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
      "client/public/**",
      "**/*.config.js",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["client/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // The unused-vars backlog has been fully cleared, so this is now an
      // `error` to prevent regressions. Unused values intentionally kept (e.g.
      // a destructured field or a caught error) must be `_`-prefixed.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Still a sizable `no-explicit-any` backlog: kept as a warning so CI stays
      // green while it is worked down. Promote to `error` once the count nears
      // zero (each `any` needs a real type plus a type-check pass to verify).
      "@typescript-eslint/no-explicit-any": "warn",
      // TypeScript's own checker already reports undefined identifiers; the core
      // no-undef rule is redundant here and misfires on platform globals
      // (e.g. Web Audio Worklet APIs) it has no way to know about.
      "no-undef": "off",
      // Empty catch blocks are an intentional pattern for best-effort browser
      // APIs (localStorage, navigator.share, optional native plugins).
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Permit `@ts-ignore` when it carries an explanatory description.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description" },
      ],
    },
  },
  {
    // AudioWorklet processor scripts execute in AudioWorkletGlobalScope, where
    // the browser audio engine provides these as ambient globals.
    files: ["client/**/*worklet*.js"],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
        AudioWorkletGlobalScope: "readonly",
        sampleRate: "readonly",
        currentTime: "readonly",
        currentFrame: "readonly",
      },
    },
  },
  prettierConfig,
);
