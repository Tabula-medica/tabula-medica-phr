import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { INDEXABLE_ROUTES } from "../robots-policy";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const page = ts.createSourceFile(
  "geo-landing.tsx",
  read("../../pages/geo-landing.tsx"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const app = ts.createSourceFile(
  "App.tsx",
  read("../../App.tsx"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const sitemap = read("../../../public/sitemap.xml");
const dynamicSitemap = ts.createSourceFile(
  "seo-routes.ts",
  read("../../../../../server/routes/seo-routes.ts"),
  ts.ScriptTarget.Latest,
  true,
);

function initializer(source: ts.SourceFile, name: string): ts.Expression {
  let found: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
}

function property(object: ts.ObjectLiteralExpression, name: string): ts.Expression {
  const field = object.properties.find(
    (node): node is ts.PropertyAssignment =>
      ts.isPropertyAssignment(node) && node.name.getText(page).replace(/["']/g, "") === name,
  );
  if (!field) throw new Error(`Missing property ${name}`);
  return field.initializer;
}

const configs = initializer(page, "STATE_CONFIGS") as ts.ObjectLiteralExpression;
const publicPaths = initializer(app, "publicMarketingRoutes") as ts.ArrayLiteralExpression;
const routes = initializer(dynamicSitemap, "PUBLIC_ROUTES") as ts.ArrayLiteralExpression;
const states = [
  ["georgia", false],
  ["north-carolina", true],
  ["arizona", true],
  ["oklahoma", true],
  ["mississippi", false],
  ["missouri", true],
] as const;

describe("requested state landing pages", () => {
  it("every sitemap state page passes the signed-out public routing gate", () => {
    const statePaths = [...sitemap.matchAll(/<loc>https:\/\/tabulamedica\.health(\/care\/[^<]+)<\/loc>/g)]
      .map((match) => match[1])
      .filter((path) => path !== "/care/find-a-doctor");
    const signedOutPaths = publicPaths.elements.map((node) =>
      (node as ts.StringLiteral).text,
    );
    expect(statePaths).toHaveLength(13);
    for (const path of statePaths) {
      expect(signedOutPaths, `${path} would otherwise render LandingPage when signed out`).toContain(path);
      expect(read("../../App.tsx")).toContain(
        `<Route path="${path}" component={() => <GeoLanding stateSlug="${path.slice("/care/".length)}" />} />`,
      );
    }
  });

  for (const [slug, expanded] of states) {
    it(`${slug} has five FAQs, correct expansion status, and a public discoverable route`, () => {
      const path = `/care/${slug}`;
      const config = property(configs, slug) as ts.ObjectLiteralExpression;
      expect(property(config, "slug").getText(page)).toBe(JSON.stringify(slug));
      expect(property(config, "medicaidExpansion").kind).toBe(
        expanded ? ts.SyntaxKind.TrueKeyword : ts.SyntaxKind.FalseKeyword,
      );
      const faqs = property(config, "faqs") as ts.ArrayLiteralExpression;
      expect(faqs.elements).toHaveLength(5);
      for (const faq of faqs.elements) {
        expect(property(faq as ts.ObjectLiteralExpression, "question").getText(page).length).toBeGreaterThan(15);
        expect(property(faq as ts.ObjectLiteralExpression, "answer").getText(page).length).toBeGreaterThan(80);
      }
      expect(property(config, "sources").kind).toBe(ts.SyntaxKind.ArrayLiteralExpression);
      expect(publicPaths.elements.map((node) => node.getText(app))).toContain(JSON.stringify(path));
      expect(read("../../App.tsx")).toContain(
        `<Route path="${path}" component={() => <GeoLanding stateSlug="${slug}" />} />`,
      );
      expect(INDEXABLE_ROUTES.has(path)).toBe(true);
      expect(sitemap.match(new RegExp(`<loc>https://tabulamedica\\.health${path}</loc>`, "g"))).toHaveLength(1);
      expect(routes.elements.filter((node) =>
        (node as ts.ObjectLiteralExpression).properties.some(
          (field) => ts.isPropertyAssignment(field) &&
            field.name.getText(dynamicSitemap) === "path" &&
            field.initializer.getText(dynamicSitemap) === JSON.stringify(path),
        ),
      )).toHaveLength(1);
    });
  }
});
