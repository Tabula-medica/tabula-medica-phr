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

/**
 * Smoke tests for the gated control in each Pro screen. Rather than booting
 * the full screen (which requires React Navigation, dozens of contexts, and a
 * live query client), we replay the *exact* `useFeatureGate` + gated-`onPress`
 * pattern each screen uses. This keeps the test fast and stable while still
 * asserting the contract: when an unsubscribed user taps the gated control on
 * a given screen, the upgrade prompt for that screen's feature shows up and
 * the underlying handler does NOT fire.
 *
 * Feature keys mirror the call sites in:
 *   - client/screens/SecureMessagingScreen.tsx     -> "secure_messaging"
 *   - client/screens/FamilyHubScreen.tsx           -> "family_hub"
 *   - client/screens/ProviderCollaborationScreen.tsx -> "cds"
 *   - client/screens/ShareScreen.tsx               -> "provider_sharing"
 */

const SCREENS: Array<{
  name: string;
  featureKey: string;
  expectedTitle: string;
}> = [
  {
    name: "SecureMessagingScreen",
    featureKey: "secure_messaging",
    expectedTitle: "Secure Messaging",
  },
  {
    name: "FamilyHubScreen",
    featureKey: "family_hub",
    expectedTitle: "Family Health Hub",
  },
  {
    name: "ProviderCollaborationScreen",
    featureKey: "cds",
    expectedTitle: "Clinical Decision Support",
  },
  {
    name: "ShareScreen",
    featureKey: "provider_sharing",
    expectedTitle: "Provider Sharing",
  },
];

function GatedScreenHarness({
  featureKey,
  onProceed,
}: {
  featureKey: string;
  onProceed: () => void;
}) {
  const { checkFeature, promptProps } = useFeatureGate();
  return (
    <>
      <Pressable
        testID="button-gated-control"
        onPress={() => {
          if (!checkFeature(featureKey)) return;
          onProceed();
        }}
      >
        <Text>Gated Action</Text>
      </Pressable>
      <UpgradePrompt {...promptProps} />
    </>
  );
}

describe("Gated screen smoke tests", () => {
  beforeEach(() => {
    mockedUseSubscription.mockReset();
  });

  describe.each(SCREENS)(
    "$name (featureKey=$featureKey)",
    ({ featureKey, expectedTitle }) => {
      it("shows the upgrade prompt and blocks the handler for unsubscribed users", () => {
        mockedUseSubscription.mockReturnValue({ isSubscribed: false } as any);
        const onProceed = jest.fn();
        const { getByTestId, getByText, queryByTestId } = render(
          <GatedScreenHarness
            featureKey={featureKey}
            onProceed={onProceed}
          />,
        );

        expect(queryByTestId("button-upgrade-prompt")).toBeNull();

        act(() => {
          fireEvent.press(getByTestId("button-gated-control"));
        });

        expect(onProceed).not.toHaveBeenCalled();
        expect(getByTestId("button-upgrade-prompt")).toBeTruthy();
        expect(getByText(expectedTitle)).toBeTruthy();
      });

      it("runs the handler and does NOT show the prompt for subscribed users", () => {
        mockedUseSubscription.mockReturnValue({ isSubscribed: true } as any);
        const onProceed = jest.fn();
        const { getByTestId, queryByTestId } = render(
          <GatedScreenHarness
            featureKey={featureKey}
            onProceed={onProceed}
          />,
        );

        act(() => {
          fireEvent.press(getByTestId("button-gated-control"));
        });

        expect(onProceed).toHaveBeenCalledTimes(1);
        expect(queryByTestId("button-upgrade-prompt")).toBeNull();
      });
    },
  );
});
