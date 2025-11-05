// ESLint 9 flat config for a React (CRA) project
// Docs: https://eslint.org/docs/latest/use/configure/configuration-files-new

import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        console: "readonly",
        process: "readonly",
        module: "readonly",
        // Browser globals used in the codebase
        Blob: "readonly",
        alert: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        ResizeObserver: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        Image: "readonly",
        File: "readonly",
      },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      // React
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // JS
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true }],
      "no-console": "off",
      // reduce noise for known empty catch/blocks used as placeholders
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
];
