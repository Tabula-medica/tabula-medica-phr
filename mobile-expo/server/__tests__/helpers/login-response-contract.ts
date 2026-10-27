import ts from "typescript";

/**
 * Read the login handler without importing the server (or needing DB/secrets).
 * Inspect top-level JSON envelope fields, not the storage-owned user schema.
 * Unsupported payload shapes fail closed so a refactor cannot silently drop
 * coverage. Update this reader deliberately if response construction changes.
 */
export function loginResponseFields(source: string): Set<string> {
  const file = ts.createSourceFile("clinical-1.ts", source, ts.ScriptTarget.Latest, true);
  const handlers: ts.Node[] = [];
  function find(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === "app" &&
      node.expression.name.text === "post" &&
      node.arguments[0] && ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "/api/auth/login"
    ) {
      const handler = node.arguments.at(-1);
      if (!handler || (!ts.isArrowFunction(handler) && !ts.isFunctionExpression(handler))) {
        throw new Error("Login handler must be an inline function for response-contract inspection");
      }
      handlers.push(handler.body);
    }
    ts.forEachChild(node, find);
  }
  find(file);
  if (handlers.length !== 1) throw new Error("Expected exactly one POST /api/auth/login handler");

  const fields = new Set<string>();
  function isResponse(node: ts.Expression): boolean {
    if (ts.isIdentifier(node)) return node.text === "res";
    return ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      isResponse(node.expression.expression);
  }
  function inspect(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "json" &&
      isResponse(node.expression.expression)
    ) {
      const payload = node.arguments[0];
      if (node.arguments.length !== 1 || !payload || !ts.isObjectLiteralExpression(payload)) {
        throw new Error("Login JSON response must be an object literal; update the response-contract reader");
      }
      for (const property of payload.properties) {
        if (
          (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) ||
          !property.name ||
          (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))
        ) {
          throw new Error("Login JSON response has a spread/computed field; update the response-contract reader");
        }
        fields.add(property.name.text);
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(handlers[0]);
  if (!fields.size) throw new Error("No login JSON response fields found");
  return fields;
}

/** Explicit field-to-behavior mapping: existing ids need not match JSON casing. */
export const LOGIN_FIELD_CHECKS: Readonly<Record<string, string>> = {
  user: "user-id",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  error: "login-error",
};

export function uncoveredLoginFields(
  source: string,
  checkIds: ReadonlySet<string>,
): string[] {
  return [...loginResponseFields(source)].filter(
    (field) => !Object.hasOwn(LOGIN_FIELD_CHECKS, field) ||
      !checkIds.has(LOGIN_FIELD_CHECKS[field]),
  );
}
