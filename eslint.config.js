const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
        ecmaVersion: 2022,
      },
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      // TypeScript strict rules
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off", // avoid conflicts with explicit-module-boundary-types - allow for inference of types
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-unused-vars": "off",

      // Null safety and strict checks
      "no-implicit-coercion": "error",
      "no-implicit-globals": "error",
      "eqeqeq": ["error", "always"],
      "no-negated-condition": "error",
      "no-nested-ternary": "error",
      "no-unneeded-ternary": "error",

      // Modern JavaScript practices
      "prefer-const": "error",
      "no-var": "error",
      "prefer-template": "error",
      "prefer-arrow-callback": "error",
      "arrow-body-style": ["error", "as-needed"],
      "object-shorthand": "error",
      "prefer-destructuring": ["error", { object: true, array: false }],
      "prefer-spread": "error",
      "prefer-rest-params": "error",

      // Code quality and safety
      "no-console": "warn",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "consistent-return": "error",
      "no-param-reassign": "error",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": "error",
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "off",

      // Async/await best practices
      "require-await": "off",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/promise-function-async": "off",

      // Import/export best practices
      "sort-imports": ["error", { ignoreDeclarationSort: true }],

      // Code style
      "quotes": ["error", "double", { avoidEscape: true }],

      // Performance and best practices
      "no-loop-func": "error",
      "no-new-wrappers": "error",
      "no-new-func": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "no-console": "off"
    },
  },
  {
    ignores: ["dist/", "node_modules/", "eslint.config.js"],
  },
];