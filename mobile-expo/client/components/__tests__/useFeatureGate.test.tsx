import React from "react";
import { Pressable, Text } from "react-native";
import { render, fireEvent, act } from "@testing-library/react-native";

jest.mock("@/lib/revenuecat", () => ({
  presentPaywall: jest.fn(),
  useSubscription: jest.fn(),
}));

import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";
import { useSubscription } from "@/lib/revenuecat";

const mockedUseSubscription = useSubscription as jest.MockedFunction<
  typeof useSubscription
>;

function setSubscribed(isSubscribed: boolean) {
  mockedUseSubscription.mockReturnValue({ isSubscribed } as any);
}

function Harness({
  featureKey,
  onResult,
}: {
  featureKey: string;
  onResult?: (value: boolean) => void;
}) {
  const { checkFeature, promptProps, isSubscribed } = useFeatureGate();
  return (
    <>
      <Text testID="text-subscribed">{String(isSubscribed)}</Text>
      <Pressable
        testID="button-gated-action"
        onPress={() => {
          const allowed = checkFeature(featureKey);
          onResult?.(allowed);
        }}
      >
        <Text>Trigger</Text>
      </Pressable>
      <UpgradePrompt {...promptProps} />
    </>
  );
}

describe("useFeatureGate", () => {
  beforeEach(() => {
    mockedUseSubscription.mockReset();
  });

  it("returns true and does NOT show the prompt when the user is subscribed", () => {
    setSubscribed(true);
    const onResult = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <Harness featureKey="secure_messaging" onResult={onResult} />,
    );

    expect(getByTestId("text-subscribed").props.children).toBe("true");

    act(() => {
      fireEvent.press(getByTestId("button-gated-action"));
    });

    expect(onResult).toHaveBeenCalledWith(true);
    expect(queryByTestId("button-upgrade-prompt")).toBeNull();
  });

  it("returns false and shows the prompt when the user is NOT subscribed", () => {
    setSubscribed(false);
    const onResult = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <Harness featureKey="secure_messaging" onResult={onResult} />,
    );

    expect(queryByTestId("button-upgrade-prompt")).toBeNull();

    act(() => {
      fireEvent.press(getByTestId("button-gated-action"));
    });

    expect(onResult).toHaveBeenCalledWith(false);
    expect(getByTestId("button-upgrade-prompt")).toBeTruthy();
    expect(getByTestId("button-upgrade-dismiss")).toBeTruthy();
  });

  it("hides the prompt again when onDismiss is called", () => {
    setSubscribed(false);
    const { getByTestId, queryByTestId } = render(
      <Harness featureKey="family_hub" />,
    );

    act(() => {
      fireEvent.press(getByTestId("button-gated-action"));
    });
    expect(getByTestId("button-upgrade-prompt")).toBeTruthy();

    act(() => {
      fireEvent.press(getByTestId("button-upgrade-dismiss"));
    });
    expect(queryByTestId("button-upgrade-prompt")).toBeNull();
  });
});
