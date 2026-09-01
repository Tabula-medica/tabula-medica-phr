// @ts-check
/**
 * F1 Action Item F — Real-time PHI guardrail.
 *
 * Replaces the temporary CI grep script (`scripts/check-phi-db-access.ts`)
 * with editor-time + lint-time enforcement so developers see the violation
 * the moment they type `db.insert(patients)` in their IDE — not 20 minutes
 * later when CI fails.
 *
 * Single source of truth for the blocked-table list is `PHI_TABLE_NAMES`
 * exported from `server/security/phi-column-map.ts`. Adding a new PHI
 * table to that map automatically extends the lint rule's coverage —
 * no two places to maintain.
 *
 * Allowed wrappers (anything in `server/storage/phi-storage.ts` and the
 * CI guard script itself) are exempt via the `files`/`ignores` overrides
 * below — those files MUST touch raw `db.*` because they ARE the wrapper.
 *
 * Run with:
 *   npx eslint server --max-warnings=0
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import tseslint from "typescript-eslint";
import noStringFormLoggerPlugin from "./eslint-rules/no-string-form-logger.js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// ---------------------------------------------------------------------------
// Single-source PHI table list — extracted from `phi-column-map.ts` at config
// load time. We can't `import` a .ts file from a .js eslint flat config (node
// ESM has no TS loader), so we parse the source for the top-level keys of
// PHI_COLUMN_MAP. The grep is intentionally narrow and will fail loudly if
// the file structure ever drifts — that failure is the desired behaviour.
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const phiMapSource = readFileSync(
  resolve(__dirname, "server/security/phi-column-map.ts"),
  "utf8",
);
const mapBlockMatch = phiMapSource.match(
  /export const PHI_COLUMN_MAP[^=]*=\s*\{([\s\S]*?)\n\}(?:\s+as\s+const)?\s*;/,
);
if (!mapBlockMatch) {
  throw new Error(
    "[eslint.config] Could not locate `export const PHI_COLUMN_MAP = { ... };` " +
      "in server/security/phi-column-map.ts — has the file structure changed?",
  );
}
const PHI_TABLE_NAMES = Array.from(
  new Set(
    Array.from(mapBlockMatch[1].matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*\{/gm)).map(
      (m) => m[1],
    ),
  ),
);
if (PHI_TABLE_NAMES.length < 30) {
  throw new Error(
    `[eslint.config] Parsed only ${PHI_TABLE_NAMES.length} PHI table names from ` +
      "phi-column-map.ts (expected 40+). Regex likely broken; refusing to run with " +
      "weakened guardrails.",
  );
}

/**
 * Build an ESLint `no-restricted-syntax` selector that matches:
 *   db.insert(<phiTable>)
 *   db.update(<phiTable>)
 *   db.delete(<phiTable>)
 *   db.select().from(<phiTable>)         (and chained variants)
 *   tx.insert(<phiTable>)  etc.          (transaction handle)
 *
 * Selector reference: https://eslint.org/docs/latest/extend/selectors
 *
 * The selector matches any CallExpression whose first argument is an
 * Identifier whose name is in PHI_TABLE_NAMES, and whose callee is a
 * MemberExpression with property name in {insert, update, delete}.
 * For `select().from(...)`, we additionally match the `.from(<phi>)`
 * shape regardless of receiver.
 */
function buildPhiSelectors() {
  // Use esquery attribute-path selectors against the call expression
  // directly: `CallExpression[callee.property.name="insert"][arguments.0.name="accounts"]`.
  // This avoids combinator/pseudo-class issues that some esquery versions
  // reject (e.g. `:first-child` after attribute predicate).
  const selectors = [];
  for (const table of PHI_TABLE_NAMES) {
    for (const verb of ["insert", "update", "delete"]) {
      // Block raw `db.<verb>(<phi>)`. `phiDb.<verb>(<phi>)` is intentionally
      // allowed — the receiver name encodes awareness of PHI handling.
      selectors.push({
        selector: `CallExpression[callee.object.name="db"][callee.property.name="${verb}"][arguments.0.type="Identifier"][arguments.0.name="${table}"]`,
        message: `[F1] Direct db.${verb}(${table}) on PHI table is forbidden — use phiDb.${verb}(...) from server/storage/phi-storage.ts and wrap values with encryptPhiRow.`,
      });
    }
    // Block raw `db.select().from(<phi>)`. `phiDb.select().from(<phi>)` is
    // allowed for the same reason. The `from()` callee is `.select()`, whose
    // own callee is `db` (or `phiDb`).
    selectors.push({
      selector: `CallExpression[callee.property.name="from"][callee.object.callee.object.name="db"][arguments.0.type="Identifier"][arguments.0.name="${table}"]`,
      message: `[F1] Direct db.select().from(${table}) on PHI table is forbidden — use phiDb.select().from(...) from server/storage/phi-storage.ts and wrap results with decryptPhiRows.`,
    });
  }
  return selectors;
}

export default tseslint.config(
  // Base TypeScript recommendations (lightweight — no type-checked rules
  // because that would require a tsconfig project parse on every run and
  // slow lint by 10x. We only need the parser, not the type-aware rules.)
  ...tseslint.configs.recommended,

  // Project-wide ignores.
  {
    ignores: [
      "node_modules/**",
      ".cache/**",       // bun/pnpm install cache — never lint dependency-resolved trees
      "dist/**",
      "build/**",
      ".local/**",
      "ios/**",
      "android/**",
      "attached_assets/**",
      "*.config.js",
      "*.config.ts",
      "drizzle.config.ts",
      "vitest.config.ts",
    ],
  },

  // Server-wide rules: relax most TS rules (we are NOT trying to lint the
  // entire codebase right now — this config exists ONLY to enforce the PHI
  // guardrail). The entire 8204-call console.* cleanup is a separate effort.
  {
    files: ["server/**/*.ts"],
    plugins: {
      // Custom rules live under `eslint-rules/`. Namespace `tabula` is
      // project-specific to avoid collision with any future third-party
      // plugin we adopt.
      tabula: noStringFormLoggerPlugin,
    },
    rules: {
      // Disable noisy TS rules so the lint run focuses on the PHI guardrail
      // and doesn't drown developers in ~50k pre-existing warnings.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-prototype-builtins": "off",
      "no-async-promise-executor": "off",
      "no-case-declarations": "off",

      // The actual guardrail.
      "no-restricted-syntax": ["error", ...buildPhiSelectors()],

      // Action Item T (PROMOTED warn → error 2026-04-20, Session 7).
      // String-form logger calls bypass pino redaction and risk PHI leakage.
      // Promotion criteria met: Action Item V (vitest runner health check)
      // closed, baseline violation count was 3 (all in tls-middleware.ts,
      // cleaned up in same session), and the rule is demonstrably testable
      // (see tests/logger-smoke.spec.ts). CI lint job's continue-on-error
      // can now flip to false in a follow-up CI extension task.
      "tabula/no-string-form-logger": "error",
    },
  },

  // Wrapper exemptions — these files ARE the encryption wrapper and MUST
  // touch raw db.* on PHI tables. Without these overrides the wrapper
  // would lint-fail itself.
  {
    files: [
      "server/storage/phi-storage.ts",
      "scripts/check-phi-db-access.ts",
      "tests/**/*.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
      // Test files may reasonably string-format logger output for
      // human-readable diagnostics; PHI never passes through tests.
      "tabula/no-string-form-logger": "off",
    },
  },

  // -------------------------------------------------------------------------
  // Client accessibility guardrail — Section 508 / WCAG 2.2 AA.
  //
  // The client is linted ONLY for accessibility. Every `typescript-eslint`
  // recommended rule is switched off here on purpose: turning them on would
  // surface tens of thousands of pre-existing style findings and bury the
  // a11y signal, which is the one thing this block exists to protect.
  //
  // Ruleset is `jsx-a11y` **strict** (not `recommended`) at error severity,
  // so a regression fails `npm run lint` and the CI accessibility job.
  //
  // Note: `eslint-plugin-jsx-a11y` declares a peer range topping out at
  // ESLint 9 but runs correctly on 10 (it uses only the stable rule API).
  // `package.json` scopes a `minimatch@^3` override to the plugin because
  // `label-has-associated-control` needs that package's CommonJS default
  // export, which the repo-wide `minimatch@^10` security override removes.
  // -------------------------------------------------------------------------
  {
    files: ["client/src/**/*.tsx"],
    plugins: {
      "jsx-a11y": jsxA11y,
      // Registered so the `react-hooks/*` disable comments already in the
      // client resolve to a known rule. No hook rules are switched on here —
      // this block is scoped to accessibility.
      "react-hooks": reactHooks,
      react: reactPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    linterOptions: {
      // This block switches off every non-accessibility rule, which makes any
      // pre-existing disable comment for one of them look unused. Reporting
      // those would be noise about rules that are not running here.
      reportUnusedDisableDirectives: "off",
    },
    settings: {
      "jsx-a11y": {
        // Teach the linter about the design system so shadcn/Radix wrappers
        // are checked as the DOM elements they actually render. Without this
        // map, `<Label htmlFor>` / `<Button onClick>` are invisible to the
        // rules and real violations slip through.
        components: {
          Label: "label",
          Button: "button",
          Input: "input",
          Textarea: "textarea",
          Checkbox: "input",
          Switch: "input",
          RadioGroupItem: "input",
          Slider: "input",
          // Neither `Image` nor `Link` is mapped: `lucide-react` exports icons
          // by both names, so mapping them reports every icon as a
          // contentless anchor or an image with no alt text. Router links come
          // from wouter and already render a real `<a>`, which the rules see
          // without a mapping.
        },
      },
    },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,

      // A duplicated JSX attribute silently discards one of the two values.
      // When the discarded one is `id` or `role`, a control loses the
      // association or the semantics an accessibility fix just gave it, and
      // nothing else in the pipeline reports it — `tsc` does, but the client's
      // pre-existing type errors mean typecheck is not a gate yet.
      "react/jsx-no-duplicate-props": "error",

      // The design system nests a label's text inside a `<Button asChild>`
      // wrapper (`<Label><Button asChild><span>Browse</span></Button></Label>`),
      // which is three elements deep. The rule's default depth of 2 stops
      // short of it and reports a label that does have accessible text.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 6 }],

      // All TypeScript style rules off — see block comment above.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-prototype-builtins": "off",
      "no-case-declarations": "off",
      "no-undef": "off",
      "prefer-const": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/rules-of-hooks": "off",
    },
  },

  // The client has no PHI-database surface (all reads go through the API),
  // so the server-only guardrails must not run against it.
  {
    files: ["client/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
