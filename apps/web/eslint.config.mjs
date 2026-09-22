import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright artefacts (generated, gitignored).
    "tests/e2e/test-results/**",
    "playwright-report/**",
  ]),
  {
    // Vendored shadcn CLI output. These files are the upstream registry sources
    // and are kept byte-for-byte as `shadcn@4.21.0 add` emitted them, so this
    // repository does not lint them as its own code. Two of them
    // (carousel.tsx, use-mobile.ts) trip react-hooks/set-state-in-effect
    // upstream; editing them would fork the design system. The rule stays on
    // everywhere else, including src/components/app/** and src/features/**.
    files: ["src/components/ui/**/*.tsx", "src/hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
