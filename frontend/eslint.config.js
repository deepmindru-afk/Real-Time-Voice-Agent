import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),

  // The browser: the app itself.
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // The server: the LiveKit token endpoint and the Vite plugin that mounts it in dev.
  // These run on Node, so they get Node's globals instead of the browser's - the API
  // secret is read from process.env here, and nowhere else.
  {
    files: ["server/**/*.js", "api/**/*.js", "*.config.js", "eslint.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2024 },
    },
  },
]);
