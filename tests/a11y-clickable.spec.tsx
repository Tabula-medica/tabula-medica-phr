// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { clickable, onActivateKey } from "../client/src/lib/a11y";

afterEach(cleanup);

describe("clickable", () => {
  it("gives a plain element a role and a tab stop", () => {
    render(<div {...clickable(() => {})}>Open record</div>);
    const el = screen.getByRole("button", { name: "Open record" });
    expect(el.tabIndex).toBe(0);
  });

  it("activates on click, Enter and Space", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<div {...clickable(onActivate)}>Row</div>);
    const el = screen.getByRole("button", { name: "Row" });

    await user.click(el);
    expect(onActivate).toHaveBeenCalledTimes(1);

    el.focus();
    await user.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledTimes(2);

    await user.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("ignores keys that bubbled out of a nested control", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(
      <div {...clickable(onActivate)}>
        <input aria-label="Note" />
      </div>,
    );
    const input = screen.getByLabelText("Note");
    input.focus();
    await user.keyboard("{Enter}");
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("keeps the page from scrolling when Space activates it", () => {
    const onActivate = vi.fn();
    const props = clickable(onActivate);
    const preventDefault = vi.fn();
    const target = document.createElement("div");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props.onKeyDown({ key: " ", target, currentTarget: target, preventDefault } as any);
    expect(preventDefault).toHaveBeenCalled();
    expect(onActivate).toHaveBeenCalled();
  });

  it("follows the anchor contract for role=link: Enter only", () => {
    const onActivate = vi.fn();
    const props = clickable(onActivate, { role: "link" });
    const target = document.createElement("div");
    const evt = (key: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ key, target, currentTarget: target, preventDefault: () => {} }) as any;
    props.onKeyDown(evt(" "));
    expect(onActivate).not.toHaveBeenCalled();
    props.onKeyDown(evt("Enter"));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("takes the element out of the tab order when disabled", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<div {...clickable(onActivate, { disabled: true })}>Row</div>);
    const el = screen.getByRole("button", { name: "Row" });
    expect(el.tabIndex).toBe(-1);
    expect(el).toHaveProperty("ariaDisabled", "true");
    await user.click(el);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("names the element when its own text is not descriptive", () => {
    render(<div {...clickable(() => {}, { label: "Delete allergy" })} />);
    expect(screen.getByRole("button", { name: "Delete allergy" })).toBeTruthy();
  });
});

describe("onActivateKey", () => {
  it("fires on Enter and Space and on nothing else", () => {
    const onActivate = vi.fn();
    const handler = onActivateKey(onActivate);
    const target = document.createElement("div");
    const evt = (key: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ key, target, currentTarget: target, preventDefault: () => {} }) as any;
    handler(evt("Enter"));
    handler(evt(" "));
    handler(evt("a"));
    handler(evt("Tab"));
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});
