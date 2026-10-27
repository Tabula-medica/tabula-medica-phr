import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";

// Mutable Expo config the hook reads via getExtra(). Tests reassign per case.
let mockExtra: Record<string, unknown> = {};
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

// Simulate expo-auth-session's real behaviour: useIdTokenAuthRequest throws a
// "Client Id ... must be defined" invariant DURING RENDER when the platform's
// client id is undefined. The hook must therefore never be invoked unless a
// client id is configured.
const useIdTokenAuthRequest = jest.fn();
jest.mock("expo-auth-session/providers/google", () => ({
  useIdTokenAuthRequest: (...args: unknown[]) => useIdTokenAuthRequest(...args),
}));

import { Platform } from "react-native";
import { useGcipGoogleAuth } from "@/lib/gcip";

function Harness({
  onReady,
}: {
  onReady: (r: ReturnType<typeof useGcipGoogleAuth>) => void;
}) {
  const r = useGcipGoogleAuth();
  onReady(r);
  return <Text testID="platform">{r.platform}</Text>;
}

describe("useGcipGoogleAuth — launch-crash guard (App Review Guideline 2.1)", () => {
  beforeEach(() => {
    mockExtra = {};
    useIdTokenAuthRequest.mockReset();
    useIdTokenAuthRequest.mockImplementation(
      ({ iosClientId, androidClientId }: { iosClientId?: string; androidClientId?: string }) => {
        const id = Platform.OS === "ios" ? iosClientId : androidClientId;
        if (!id) {
          // Mirrors the real invariant that crashed the app at launch.
          throw new Error(
            "Client Id property `iosClientId` must be defined to use Google auth on this platform.",
          );
        }
        return [{ url: "https://accounts.google.com/o/oauth2/v2/auth" }, undefined, jest.fn()];
      },
    );
  });

  it("does not throw at render when the platform Google client id is missing", () => {
    // No googleIosClientId in extra → useIdTokenAuthRequest must still be called
    // (rules-of-hooks; always called on native) but with a safe "placeholder"
    // fallback so it never receives undefined and never fires its useMemo
    // invariant.  isReady must be false so the Google button stays hidden.
    let result: ReturnType<typeof useGcipGoogleAuth> | undefined;
    expect(() =>
      render(<Harness onReady={(r) => (result = r)} />),
    ).not.toThrow();
    expect(useIdTokenAuthRequest).toHaveBeenCalledTimes(1);
    expect(useIdTokenAuthRequest).toHaveBeenCalledWith(
      expect.objectContaining({ iosClientId: "placeholder" }),
    );
    expect(result?.isReady).toBe(false);
  });

  it("wires the native request when the platform Google client id is present", () => {
    mockExtra = {
      gcipApiKey: "api-key",
      gcipAuthDomain: "tabula.firebaseapp.com",
      gcipProjectId: "tabula",
      googleIosClientId: "1234-abc.apps.googleusercontent.com",
      googleAndroidClientId: "1234-and.apps.googleusercontent.com",
    };
    let result: ReturnType<typeof useGcipGoogleAuth> | undefined;
    expect(() =>
      render(<Harness onReady={(r) => (result = r)} />),
    ).not.toThrow();
    expect(useIdTokenAuthRequest).toHaveBeenCalledTimes(1);
    expect(result?.isReady).toBe(true);
  });

  it("treats an unsubstituted Expo placeholder as a missing client id", () => {
    // A build where the EAS secret was never set leaves the literal
    // "$EXPO_PUBLIC_..." token in extra; cleanExtraValue() strips it to
    // undefined, and the hook falls back to the safe "placeholder" value so
    // it never throws.  isReady must be false so the Google button stays hidden.
    mockExtra = { googleIosClientId: "$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" };
    let result: ReturnType<typeof useGcipGoogleAuth> | undefined;
    expect(() =>
      render(<Harness onReady={(r) => (result = r)} />),
    ).not.toThrow();
    expect(useIdTokenAuthRequest).toHaveBeenCalledTimes(1);
    expect(useIdTokenAuthRequest).toHaveBeenCalledWith(
      expect.objectContaining({ iosClientId: "placeholder" }),
    );
    expect(result?.isReady).toBe(false);
  });
});
