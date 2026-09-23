/**
 * Custom ESLint rule: no-fallback-identity
 *
 * P0-5 — bans substituting a fallback identity for a missing authenticated user,
 * e.g. `(req as any).userId || "system"` or `x || "patient-001"`. Every such
 * fallback is a potential IDOR: routes MUST reject missing auth context
 * (getUserId(req) throws 401) instead of silently acting as
 * "system" / "patient-001" / "patient-default" / "current-user" / "anonymous".
 *
 * The threat model forbids exactly these identities. This rule keeps the class
 * from regressing once the P0-5 purge lands.
 *
 * Severity: WARN during the purge rollout (there are ~600 pre-existing hits — a
 * hard error would break `npm run lint` before the cleanup is complete). Flip to
 * ERROR once `grep -rF '|| "system"' server/` reaches 0.
 *
 * Detection: a `||` LogicalExpression whose right operand is a string Literal
 * in the banned set. This catches the dominant `<expr> || "system"` form; the
 * few `?? "system"` or deeper-nested forms are caught by the companion grep in
 * the CI gate.
 */

const BANNED = new Set(["system", "patient-001", "patient-default", "current-user", "anonymous"]);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow `|| "system" | "patient-001" | "patient-default" | "current-user" | "anonymous"` ' +
        "fallback identities; reject missing auth with getUserId(req) instead.",
      recommended: false,
    },
    messages: {
      fallback:
        '[P0-5] Fallback identity `|| "{{value}}"` is a potential IDOR — a route must reject ' +
        "missing auth context (use getUserId(req), which 401s), never substitute an identity.",
    },
    schema: [],
  },

  create(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== "||" && node.operator !== "??") return;
        const right = node.right;
        if (
          right &&
          right.type === "Literal" &&
          typeof right.value === "string" &&
          BANNED.has(right.value)
        ) {
          context.report({ node: right, messageId: "fallback", data: { value: right.value } });
        }
      },
    };
  },
};

export default {
  rules: {
    "no-fallback-identity": rule,
  },
};
