// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // Pin the React version so eslint-plugin-react does not run its
    // filesystem-based "detect" path, which calls the `context.getFilename()`
    // API that was removed in ESLint 10 and crashes the lint run.
    settings: {
      react: {
        version: "19.2.6",
      },
    },
  },
  {
    ignores: [
      "dist/**",
      "server_dist/**",
      "web-build/**",
      ".expo/**",
      ".cache/**",
      ".local/**",
      "web/**",
    ],
  },
]);
