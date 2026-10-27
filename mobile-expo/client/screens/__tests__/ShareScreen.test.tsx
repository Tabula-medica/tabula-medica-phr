import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  const chain: any = {};
  const make = () => chain;
  chain.duration = make;
  chain.springify = make;
  chain.damping = make;
  chain.stiffness = make;
  chain.delay = make;
  chain.withCallback = make;
  const Passthrough = ({ children, style }: any) =>
    React.createElement(View, { style }, children);
  return {
    __esModule: true,
    default: { View: Passthrough, createAnimatedComponent: (c: any) => c },
    View: Passthrough,
    FadeIn: chain,
    FadeOut: chain,
    FadeInDown: chain,
    SlideInDown: chain,
    SlideOutDown: chain,
    useSharedValue: (v: any) => ({ value: v }),
    useAnimatedStyle: (cb: any) => cb(),
    withTiming: (v: any) => v,
    withSpring: (v: any) => v,
    runOnJS: (fn: any) => fn,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
}));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "Medium", Light: "Light" },
  NotificationFeedbackType: { Success: "Success", Warning: "Warning" },
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: any) => React.createElement(View, null, children),
    Rect: () => null,
  };
});

jest.mock("@/components/ThemedText", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { ThemedText: ({ children, style }: any) => React.createElement(Text, { style }, children) };
});

jest.mock("@/components/UpgradePrompt", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(View),
    useFeatureGate: () => ({
      checkFeature: () => true,
      promptProps: {},
      isSubscribed: true,
    }),
  };
});

jest.mock("@/lib/api", () => ({
  api: {
    shareLinks: {
      list: jest.fn(),
      create: jest.fn(),
      revoke: jest.fn(),
    },
  },
}));

import ShareScreen from "@/screens/ShareScreen";
import { api } from "@/lib/api";

const mockedList = (api.shareLinks as any).list as jest.Mock;
const mockedCreate = (api.shareLinks as any).create as jest.Mock;

describe("ShareScreen — share-link creation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedList.mockResolvedValue([]);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
  });

  it("creates a share link with the default 24-hour expiration and the generated PIN", async () => {
    mockedCreate.mockResolvedValue({
      id: "link-1",
      token: "tok-1",
      shareUrl: "https://example.test/s/tok-1",
      passcode: "1234",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      isRevoked: false,
    });

    const { getByA11yLabel, getByLabelText } = render(<ShareScreen />);
    await waitFor(() => expect(mockedList).toHaveBeenCalled());

    const getByA11y = (label: string) =>
      (getByA11yLabel as any)?.(label) ?? (getByLabelText as any)(label);

    const button = getByA11y("Generate QR Code");
    await act(async () => {
      fireEvent.press(button);
    });

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const [payload] = mockedCreate.mock.calls[0];
    expect(payload.expiresInHours).toBe(24);
    expect(typeof payload.passcode).toBe("string");
    expect(payload.passcode).toMatch(/^\d{4}$/);
  });

  it("uses the selected 1-hour expiration when the user picks it", async () => {
    mockedCreate.mockResolvedValue({
      id: "link-3",
      token: "tok-3",
      shareUrl: "https://example.test/s/tok-3",
      passcode: "5678",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      isRevoked: false,
    });
    const { getByLabelText } = render(<ShareScreen />);
    await waitFor(() => expect(mockedList).toHaveBeenCalled());

    await act(async () => {
      fireEvent.press(getByLabelText("Expires after 1 hour"));
    });
    await act(async () => {
      fireEvent.press(getByLabelText("Generate QR Code"));
    });

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    expect(mockedCreate.mock.calls[0][0].expiresInHours).toBe(1);
  });

  it("omits the passcode when PIN protection is toggled off", async () => {
    mockedCreate.mockResolvedValue({
      id: "link-2",
      token: "tok-2",
      shareUrl: "https://example.test/s/tok-2",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      isRevoked: false,
    });

    const { getByLabelText } = render(<ShareScreen />);
    await waitFor(() => expect(mockedList).toHaveBeenCalled());

    // Pick the 24-hour option (index 1)
    await act(async () => {
      fireEvent.press(getByLabelText("Expires after 24 hours"));
    });
    // Toggle PIN protection off
    await act(async () => {
      fireEvent.press(getByLabelText("PIN Protection"));
    });
    await act(async () => {
      fireEvent.press(getByLabelText("Generate QR Code"));
    });

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const [payload] = mockedCreate.mock.calls[0];
    expect(payload.expiresInHours).toBe(24);
    expect(payload.passcode).toBeUndefined();
  });

  it("alerts the user when the create-share-link API call fails", async () => {
    mockedCreate.mockRejectedValue(new Error("boom"));

    const { getByLabelText } = render(<ShareScreen />);
    await waitFor(() => expect(mockedList).toHaveBeenCalled());

    await act(async () => {
      fireEvent.press(getByLabelText("Generate QR Code"));
    });

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const args = (Alert.alert as jest.Mock).mock.calls[0];
    expect(args[0]).toBe("Error");
    expect(args[1]).toMatch(/share link/i);
  });
});
