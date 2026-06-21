/**
 * Custom ESLint rule: no-string-form-logger
 *
 * Action Item T (warn-mode rollout) — companion to Action Item K cleanup.
 *
 * Pino structured logging only redacts PHI when the call site uses the
 * OBJECT-FORM signature:
 *
 *   logger.info({ patientId, vitalId }, "vital sign recorded")     // ✅ redacted
 *
 * The STRING-FORM signature bypasses redaction entirely:
 *
 *   logger.info(`vital ${vitalId} recorded for ${patientId}`)      // ❌ leaks
 *   logger.info("vital " + vitalId + " for " + patientId)          // ❌ leaks
 *   logger.warn(`failed for ${err.message}`)                       // ❌ leaks
 *
 * This rule flags the bypassing patterns. It does NOT flag:
 *
 *   logger.info("static message")                                  // safe — no interp
 *   logger.info({ ctx }, "static message")                         // ✅ object form
 *   logger.info({ ctx }, `template ${someConst}`)                  // ⚠️ msg arg only,
 *                                                                  //   PHI is in ctx
 *
 * Severity: WARN initially (do not break CI before Action Item K is fully
 * resolved across all unmigrated files). Upgrade to ERROR when Action Item
 * T's trigger fires (zero string-form hits across server/**).
 *
 * Detection scope:
 *   - Direct `logger.<level>(...)` calls where receiver is the literal
 *     `logger` Identifier and level ∈ {info, warn, error, debug, fatal, trace}
 *   - First argument is TemplateLiteral with at least one ${expression}
 *   - First argument is BinaryExpression with `+` operator (string concat)
 *
 * Out of scope (separately tracked under Action Item K-extension):
 *   - `helperWrapper(args)` style internal logging where the wrapper itself
 *     calls logger in string-form. Detect by greppable pattern, not AST.
 *   - `logger.child(...).info(...)` chained logger calls. Future extension
 *     if the pattern proves common enough.
 */

const LOGGER_LEVELS = new Set(["info", "warn", "error", "debug", "fatal", "trace"]);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow string-form logger calls (template literals with interpolation, " +
        "or string concatenation) that bypass pino redaction and risk PHI leakage. " +
        "Use object-form: logger.info({ ctx }, 'message')",
      recommended: false,
    },
    messages: {
      templateLiteral:
        "[F1/T] String-form logger call bypasses pino redaction — PHI in ${{}} interpolations is logged in plaintext. " +
        "Move all variables into the first-arg object: logger.{{level}}({ {{vars}} }, \"static message\")",
      binaryConcat:
        "[F1/T] String-form logger call bypasses pino redaction — PHI in `+` concatenation is logged in plaintext. " +
        "Move all variables into the first-arg object: logger.{{level}}({ ...ctx }, \"static message\")",
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") return;

        // Receiver must be the literal Identifier `logger`. Chained calls
        // (e.g. logger.child(...).info) and aliased loggers are out of
        // scope for v1 — covered by Action Item K-extension.
        if (
          callee.object?.type !== "Identifier" ||
          callee.object.name !== "logger"
        ) {
          return;
        }

        // Property must be one of the known pino levels.
        if (
          callee.property?.type !== "Identifier" ||
          !LOGGER_LEVELS.has(callee.property.name)
        ) {
          return;
        }

        const firstArg = node.arguments[0];
        if (!firstArg) return;

        const level = callee.property.name;

        // Case 1: TemplateLiteral with interpolation.
        // Pure string templates with no expressions (e.g. `static message`)
        // are SAFE and intentionally not flagged — they're equivalent to
        // a string Literal in pino's eyes.
        if (
          firstArg.type === "TemplateLiteral" &&
          firstArg.expressions.length > 0
        ) {
          // Extract a hint of which variables the developer was trying to
          // log, so the auto-message is more actionable than a generic
          // "move variables into context".
          const varHints = firstArg.expressions
            .map((expr) => {
              if (expr.type === "Identifier") return expr.name;
              if (expr.type === "MemberExpression" && expr.property?.type === "Identifier") {
                return expr.property.name;
              }
              return null;
            })
            .filter(Boolean)
            .slice(0, 3); // cap hint length

          context.report({
            node,
            messageId: "templateLiteral",
            data: {
              level,
              vars: varHints.length > 0 ? varHints.join(", ") : "...ctx",
            },
          });
          return;
        }

        // Case 2: BinaryExpression with `+` operator (string concat).
        // Recursively walks left/right operands isn't needed — any top-
        // level `+` BinaryExpression as the first argument to a logger
        // call is the bypass pattern, regardless of operand depth.
        if (firstArg.type === "BinaryExpression" && firstArg.operator === "+") {
          context.report({
            node,
            messageId: "binaryConcat",
            data: { level },
          });
          return;
        }
      },
    };
  },
};

export default {
  rules: {
    "no-string-form-logger": rule,
  },
};
