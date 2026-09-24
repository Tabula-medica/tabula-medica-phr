// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { useSEO } from "../client/src/hooks/use-seo";

afterEach(cleanup);

function Page(props: Parameters<typeof useSEO>[0]) {
  useSEO(props);
  return null;
}

function robotsContent(): string | null {
  return document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null;
}

describe("useSEO indexable default", () => {
  // Regression guard for a real bug: every PHI-bearing authenticated page
  // (dashboard, patient detail, connections, settings, ...) calls useSEO
  // without passing `indexable`, and previously got `index, follow` by
  // default. Fail closed — a page must opt IN to being indexed, not opt out.
  it("defaults to noindex, nofollow when indexable is not passed", () => {
    render(<Page title="Patient Dashboard" />);
    expect(robotsContent()).toBe("noindex, nofollow, noarchive");
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it("emits index, follow only when a page explicitly opts in", () => {
    render(<Page title="FAQ" canonicalPath="/faq" indexable={true} />);
    expect(robotsContent()).toContain("index, follow");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://tabulamedica.health/faq",
    );
  });

  it("still fails closed when indexable is explicitly false", () => {
    render(<Page title="Settings" indexable={false} />);
    expect(robotsContent()).toBe("noindex, nofollow, noarchive");
  });
});
