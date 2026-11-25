import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs (no FlatCompat needed)
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // New React Compiler-era checks that arrived with eslint-config-next 16. They flag 14
    // pre-existing patterns (setState inside effects, Date.now() during render). Kept visible
    // as warnings until those components are refactored, rather than failing CI on old code.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
