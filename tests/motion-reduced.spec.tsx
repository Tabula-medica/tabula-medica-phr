// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useContext } from "react";
import { MotionConfigContext } from "framer-motion";

import { AccessibilityProvider } from "../client/src/components/accessibility-provider";

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
