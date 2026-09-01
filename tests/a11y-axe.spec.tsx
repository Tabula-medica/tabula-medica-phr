// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import axe, { type Result } from "axe-core";

import { Button } from "../client/src/components/ui/button";
import { Input } from "../client/src/components/ui/input";
import { Textarea } from "../client/src/components/ui/textarea";
import { Label } from "../client/src/components/ui/label";
import { FieldCaption } from "../client/src/components/ui/field-caption";
import { Checkbox } from "../client/src/components/ui/checkbox";
import { clickable } from "../client/src/lib/a11y";

afterEach(cleanup);

/** WCAG 2.2 A + AA, the conformance target of the accessibility statement. */
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violationsOf(container: HTMLElement): Promise<Result[]> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: WCAG_AA_TAGS },
    // Colour contrast needs real layout and computed styles, which jsdom does
    // not provide; it is covered by the Lighthouse job in CI instead.
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations;
}

function describeViolations(violations: Result[]): string {
  return violations
    .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.html).join("\n  ")}`)
    .join("\n");
}

describe("design system primitives", () => {
  it("renders a labelled form with no WCAG A/AA violations", async () => {
    const { container } = render(
      <form>
        <fieldset>
          <legend>Contact preferences</legend>
          <Label htmlFor="pref-email">Email address</Label>
          <Input id="pref-email" type="email" />
          <Label htmlFor="pref-notes">Notes for your care team</Label>
          <Textarea id="pref-notes" />
          <Checkbox id="pref-sms" />
          <Label htmlFor="pref-sms">Text me appointment reminders</Label>
          <Button type="submit">Save preferences</Button>
        </fieldset>
      </form>,
    );
    const violations = await violationsOf(container);
    expect(describeViolations(violations)).toBe("");
  });

  it("does not announce a read-only caption as a form field", async () => {
    // The regression this guards: `<Label>` used to caption static text makes
    // screen readers announce an empty input. `FieldCaption` renders a span.
    const { container } = render(
      <div>
        <FieldCaption>Primary diagnosis</FieldCaption>
        <p>Type 2 diabetes mellitus</p>
      </div>,
    );
    expect(container.querySelector("label")).toBeNull();
    expect(await violationsOf(container)).toEqual([]);
  });

  it("keeps an icon-only button named", async () => {
    const { container } = render(
      <Button size="icon" aria-label="Close dialog">
        <span aria-hidden="true">×</span>
      </Button>,
    );
    const violations = await violationsOf(container);
    expect(describeViolations(violations)).toBe("");
  });
});

describe("clickable wrappers", () => {
  it("must not be spread onto a list item — it would strip list semantics", async () => {
    // Guards the `<li role="button">` shape a codemod could reintroduce: axe
    // reports it because a <ul> whose children are buttons is no longer a list,
    // so screen readers stop announcing "list, 3 items".
    const { container } = render(
      <ul>
        <li {...clickable(() => {}, { label: "Open lab result" })}>Metabolic panel</li>
      </ul>,
    );
    const violations = await violationsOf(container);
    expect(violations.map((v) => v.id)).toContain("list");
  });

  it("keeps list semantics when the control sits inside the list item", async () => {
    const { container } = render(
      <ul>
        <li>
          <button type="button">Metabolic panel</button>
        </li>
      </ul>,
    );
    const violations = await violationsOf(container);
    expect(describeViolations(violations)).toBe("");
  });

  it("passes WCAG A/AA as a named, focusable control", async () => {
    const { container } = render(
      <div {...clickable(() => {}, { label: "Open lab result from 12 March" })}>
        Comprehensive metabolic panel
      </div>,
    );
    const violations = await violationsOf(container);
    expect(describeViolations(violations)).toBe("");
  });

  it("leaves a presentational wrapper out of the accessibility tree", async () => {
    const { container } = render(
      <div role="presentation" onClick={() => {}}>
        <Button type="button">Browse files</Button>
      </div>,
    );
    const violations = await violationsOf(container);
    expect(describeViolations(violations)).toBe("");
  });
});
