import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/revenuecat", () => ({
  presentPaywall: jest.fn(),
  useSubscription: jest.fn(),
}));

import UpgradePrompt from "@/components/UpgradePrompt";
import { presentPaywall } from "@/lib/revenuecat";

const mockedPresentPaywall = presentPaywall as jest.MockedFunction<
  typeof presentPaywall
>;

describe("UpgradePrompt", () => {
  beforeEach(() => {
    mockedPresentPaywall.mockReset();
  });

  it("renders nothing when visible is false", () => {
    const onDismiss = jest.fn();
    const { queryByTestId } = render(
      <UpgradePrompt
        visible={false}
        featureKey="secure_messaging"
        onDismiss={onDismiss}
      />,
    );
    expect(queryByTestId("button-upgrade-prompt")).toBeNull();
    expect(queryByTestId("button-upgrade-dismiss")).toBeNull();
  });

  it("renders the feature title and description when visible", () => {
    const { getByText, getByTestId } = render(
      <UpgradePrompt
        visible
        featureKey="secure_messaging"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText("Secure Messaging")).toBeTruthy();
    expect(
      getByText(
        "Send HIPAA-compliant messages directly to your care team.",
      ),
    ).toBeTruthy();
    expect(getByTestId("button-upgrade-prompt")).toBeTruthy();
  });

  it("falls back to the default feature info for unknown keys", () => {
    const { getByText } = render(
      <UpgradePrompt
        visible
        featureKey="some_unknown_feature"
        onDismiss={jest.fn()}
      />,
    );
    expect(getByText("Professional Feature")).toBeTruthy();
  });

  it("honors overrideTitle and overrideDescription", () => {
    const { getByText, queryByText } = render(
      <UpgradePrompt
        visible
        featureKey="secure_messaging"
        onDismiss={jest.fn()}
        overrideTitle="Custom Title"
        overrideDescription="Custom description copy."
      />,
    );
    expect(getByText("Custom Title")).toBeTruthy();
    expect(getByText("Custom description copy.")).toBeTruthy();
    expect(queryByText("Secure Messaging")).toBeNull();
  });

  it("invokes onDismiss when Not Now is pressed", () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <UpgradePrompt
        visible
        featureKey="family_hub"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(getByTestId("button-upgrade-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls presentPaywall when the upgrade button is pressed and dismisses on success", async () => {
    mockedPresentPaywall.mockResolvedValueOnce(true);
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <UpgradePrompt
        visible
        featureKey="cds"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(getByTestId("button-upgrade-prompt"));
    await waitFor(() => {
      expect(mockedPresentPaywall).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  it("does NOT dismiss when paywall is closed without purchase", async () => {
    mockedPresentPaywall.mockResolvedValueOnce(false);
    const onDismiss = jest.fn();
    const { getByTestId } = render(
      <UpgradePrompt
        visible
        featureKey="provider_sharing"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.press(getByTestId("button-upgrade-prompt"));
    await waitFor(() => {
      expect(mockedPresentPaywall).toHaveBeenCalledTimes(1);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
