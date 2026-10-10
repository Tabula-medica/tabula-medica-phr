// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useContext } from "react";
import { MotionConfigContext } from "framer-motion";

import { AccessibilityProvider, usePrefersReducedMotion } from "../client/src/components/accessibility-provider";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function Probe() {
  return <span data-testid="reduced">{useContext(MotionConfigContext).reducedMotion ?? "unset"}</span>;
}

function renderWith(settings: Record<string, boolean>) {
  localStorage.setItem("accessibility-settings", JSON.stringify(settings));
  return render(
    <AccessibilityProvider>
      <Probe />
    </AccessibilityProvider>,
  );
}

describe("framer-motion follows the in-app accessibility settings", () => {
  it("reduces motion when the reducedMotion toggle is on", () => {
    const { getByTestId } = renderWith({ reducedMotion: true });
    expect(getByTestId("reduced").textContent).toBe("always");
  });

  it("reduces motion in geriatric mode", () => {
    const { getByTestId } = renderWith({ geriatricMode: true });
    expect(getByTestId("reduced").textContent).toBe("always");
  });

  it("does not force reduced motion when neither is set", () => {
    const { getByTestId } = renderWith({ reducedMotion: false, geriatricMode: false });
    expect(getByTestId("reduced").textContent).not.toBe("always");
  });
});

function PrefProbe() {
  return <span data-testid="pref">{String(usePrefersReducedMotion())}</span>;
}

describe("usePrefersReducedMotion", () => {
  it("is false outside the provider with nothing stored", () => {
    const { getByTestId } = render(<PrefProbe />);
    expect(getByTestId("pref").textContent).toBe("false");
  });

  it("reads the persisted in-app setting outside the provider (logged-out routes)", () => {
    localStorage.setItem("accessibility-settings", JSON.stringify({ reducedMotion: true }));
    const { getByTestId } = render(<PrefProbe />);
    expect(getByTestId("pref").textContent).toBe("true");
  });

  it("follows geriatric mode inside the provider", () => {
    localStorage.setItem("accessibility-settings", JSON.stringify({ geriatricMode: true }));
    const { getByTestId } = render(
      <AccessibilityProvider>
        <PrefProbe />
      </AccessibilityProvider>,
    );
    expect(getByTestId("pref").textContent).toBe("true");
  });
});
