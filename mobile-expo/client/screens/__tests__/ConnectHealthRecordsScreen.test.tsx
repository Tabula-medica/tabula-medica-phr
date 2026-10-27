import React from "react";
import { render, waitFor, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback: any) => {
    const React = require("react");
    React.useEffect(callback, [callback]);
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: "Medium", Light: "Light" },
}));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
  openAuthSessionAsync: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { LinearGradient: ({ children, style }: any) => React.createElement(View, { style }, children) };
});

let capturedWebViewProps: any = null;
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      capturedWebViewProps = props;
      return React.createElement(View, { ref, testID: "webview-mock" });
    }),
  };
});

jest.mock("@/components/ThemedText", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { ThemedText: ({ children, style }: any) => React.createElement(Text, { style }, children) };
});
jest.mock("@/components/ThemedView", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { ThemedView: ({ children, style }: any) => React.createElement(View, { style }, children) };
});
jest.mock("@/components/Card", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Card: ({ children, style }: any) => React.createElement(View, { style }, children) };
});

jest.mock("@/components/UpgradePrompt", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => React.createElement(View),
    useFeatureGate: () => ({
      checkFeature: () => mockCheckFeature(),
      promptProps: {},
      isSubscribed: true,
    }),
  };
});

jest.mock("@/lib/query-client", () => ({
  apiRequest: jest.fn(),
}));

import ConnectHealthRecordsScreen from "@/screens/ConnectHealthRecordsScreen";
import { apiRequest } from "@/lib/query-client";
import * as WebBrowser from "expo-web-browser";

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockCheckFeature = jest.fn(() => true);

function renderScreen(reconnectSource?: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }: any) => {
          const url = queryKey.join("/");
          const res = await (apiRequest as any)("GET", url);
          return await res.json();
        },
      },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConnectHealthRecordsScreen route={{ params: { reconnectSource } }} />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: any): any {
  return { json: async () => body };
}

describe("ConnectHealthRecordsScreen — connection event handling", () => {
  beforeEach(() => {
    capturedWebViewProps = null;
    jest.clearAllMocks();
    mockCheckFeature.mockReturnValue(true);
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
      type: "success",
      url: "tabulamedica://payer-reconnect?code=authorized-code&state=reauth-state",
    });
    // Default GET /api/fasten/config response so the screen renders past the loader.
    mockedApiRequest.mockImplementation(async (method: any, url: string) => {
      if (method === "GET" && url === "/api/fasten/config") {
        return jsonResponse({
          configured: true,
          publicId: "pub-123",
          tefcaSupported: true,
          coverageCount: 50000,
          connectedSourceCount: 0,
        }) as any;
      }
      if (url === "/api/fasten/connect-nonce") {
        return jsonResponse({ nonce: "nonce-default" }) as any;
      }
      return jsonResponse({}) as any;
    });
  });

  it("forwards a `patient.connection_success` WebView event to /api/fasten/connection-event with the connect nonce", async () => {
    // Override default mock to also return a connect nonce and accept the connection event.
    mockedApiRequest.mockImplementation(async (method: any, url: string, body?: any) => {
      if (method === "GET" && url === "/api/fasten/config") {
        return jsonResponse({
          configured: true,
          publicId: "pub-123",
          tefcaSupported: true,
          coverageCount: 50000,
          connectedSourceCount: 0,
        }) as any;
      }
      if (method === "GET" && url === "/api/fasten/connect-nonce") {
        return jsonResponse({ nonce: "nonce-abc" }) as any;
      }
      if (method === "POST" && url === "/api/fasten/connection-event") {
        return jsonResponse({ ok: true, received: body }) as any;
      }
      return jsonResponse({}) as any;
    });

    const { getByTestId } = renderScreen();
    // wait until config query resolves so the main UI renders
    await waitFor(() => expect(getByTestId("button-auto-discover")).toBeTruthy());

    // Simulate the user opening the Fasten WebView. We do this by calling
    // beginConnectAndOpen via the manual import button path — but the screen
    // does not expose it directly in this state without connectedSourceCount,
    // so simulate via the "import-records" button (which triggers
    // beginConnectAndOpen for free users with 0 connected sources).
    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => {
      fireEvent.press(getByTestId("button-import-records"));
    });

    // After opening, the screen renders the WebView. Wait for our mock to
    // capture its props (including onMessage).
    await waitFor(() => expect(capturedWebViewProps).not.toBeNull());
    expect(typeof capturedWebViewProps.onMessage).toBe("function");

    // Fire a `patient.connection_success` message — this should trigger the
    // connection-event mutation with the captured nonce.
    await act(async () => {
      capturedWebViewProps.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            source: "fasten-stitch",
            event: { type: "patient.connection_success", payload: { sourceId: "epic" } },
          }),
        },
      });
    });

    await waitFor(() => {
      const postCall = mockedApiRequest.mock.calls.find(
        (c) => c[0] === "POST" && c[1] === "/api/fasten/connection-event",
      );
      expect(postCall).toBeDefined();
      expect(postCall![2]).toMatchObject({
        event: { type: "patient.connection_success" },
        connectNonce: "nonce-abc",
      });
    });
  });

  it("ignores WebView messages whose source is not fasten-stitch", async () => {
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId("button-auto-discover")).toBeTruthy());

    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => {
      fireEvent.press(getByTestId("button-import-records"));
    });
    await waitFor(() => expect(capturedWebViewProps).not.toBeNull());

    await act(async () => {
      capturedWebViewProps.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            source: "some-other-widget",
            event: { type: "patient.connection_success" },
          }),
        },
      });
      capturedWebViewProps.onMessage({
        nativeEvent: { data: "not-json{{" },
      });
    });

    // No POST to connection-event should have happened.
    const postCall = mockedApiRequest.mock.calls.find(
      (c) => c[0] === "POST" && c[1] === "/api/fasten/connection-event",
    );
    expect(postCall).toBeUndefined();
  });

  it("closes the WebView when a `widget.complete` event arrives", async () => {
    const { getByTestId, queryByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId("button-auto-discover")).toBeTruthy());

    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => {
      fireEvent.press(getByTestId("button-import-records"));
    });
    await waitFor(() => expect(queryByTestId("webview-mock")).toBeTruthy());

    await act(async () => {
      capturedWebViewProps.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            source: "fasten-stitch",
            event: { type: "widget.complete" },
          }),
        },
      });
    });

    await waitFor(() => expect(queryByTestId("webview-mock")).toBeNull());
  });

  function mockHealthResponse(health: any[], reauthFails = false, widgetConfigured = true) {
    mockedApiRequest.mockImplementation(async (_method: any, url: string) => {
      if (url === "/api/fasten/config") {
        return jsonResponse({ configured: widgetConfigured, publicId: widgetConfigured ? "pub-123" : null, connectedSourceCount: 1 });
      }
      if (url === "/api/fasten/connected-sources") {
        return jsonResponse({ sources: health.map(h => h.sourceType), health, configured: true });
      }
      if (url === "/api/fasten/reauthorize/start") {
        if (reauthFails) throw new Error("offline");
        return jsonResponse({
          authorizationUrl: "https://cigna.example.com/authorize",
          redirectUri: "tabulamedica://payer-reconnect",
          state: "reauth-state",
        });
      }
      if (url === "/api/fasten/reauthorize/complete") {
        return jsonResponse({ sourceType: "cigna", syncStatus: "active", needsReauth: false });
      }
      return jsonResponse({});
    });
  }

  it("shows reauth and transient errors differently and opens the selected source without a paywall", async () => {
    mockHealthResponse([
      { sourceType: "cigna", syncStatus: "needs_reauth", needsReauth: true },
      { sourceType: "epic", syncStatus: "error", needsReauth: false },
      { sourceType: "aetna", syncStatus: "active", needsReauth: false },
    ]);
    mockCheckFeature.mockReturnValue(false);
    const { getByText, getByTestId, queryByTestId } = renderScreen();
    await waitFor(() => expect(getByText("Reconnect needed")).toBeTruthy());
    expect(getByText("Sync temporarily unavailable")).toBeTruthy();
    expect(queryByTestId("reconnect-epic")).toBeNull();
    expect(queryByTestId("reconnect-aetna")).toBeNull();
    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => { fireEvent.press(getByTestId("reconnect-cigna")); });
    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      "https://cigna.example.com/authorize", "tabulamedica://payer-reconnect",
    ));
    expect(mockedApiRequest).toHaveBeenCalledWith("POST", "/api/fasten/reauthorize/complete", {
      sourceType: "cigna", code: "authorized-code", state: "reauth-state",
    });
    expect(capturedWebViewProps).toBeNull();
    expect(mockCheckFeature).not.toHaveBeenCalled();
  });

  it("starts the selected source reconnect flow when arriving from Data Sources", async () => {
    mockHealthResponse([{ sourceType: "cigna", syncStatus: "needs_reauth", needsReauth: true }]);
    renderScreen("cigna");
    await waitFor(() => expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled());
    expect(mockedApiRequest).toHaveBeenCalledWith("POST", "/api/fasten/reauthorize/start", {
      sourceType: "cigna", platform: "native",
    });
  });

  it("keeps the notice and shows an actionable error if a secure session cannot start", async () => {
    mockHealthResponse([{ sourceType: "cigna", syncStatus: "needs_reauth", needsReauth: true }], true);
    const { getByTestId, getByText } = renderScreen();
    await waitFor(() => expect(getByTestId("reconnect-cigna")).toBeTruthy());
    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => { fireEvent.press(getByTestId("reconnect-cigna")); });
    expect(getByText("Could not renew this connection. Reconnecting may be temporarily unavailable. Please try again later.")).toBeTruthy();
    expect(capturedWebViewProps).toBeNull();
    expect(getByTestId("reconnect-cigna")).toBeTruthy();
  });

  it("refreshes health after verified reconnect and removes the resolved notice", async () => {
    const health = [{ sourceType: "cigna", syncStatus: "needs_reauth", needsReauth: true }];
    mockHealthResponse(health);
    const handler = mockedApiRequest.getMockImplementation()!;
    mockedApiRequest.mockImplementation(async (method: any, url: string, body?: any) => {
      if (method === "POST" && url === "/api/fasten/reauthorize/complete") {
        health[0] = { sourceType: "cigna", syncStatus: "active", needsReauth: false };
        return jsonResponse({ received: true });
      }
      return handler(method, url, body);
    });
    const { getByTestId, queryByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId("reconnect-cigna")).toBeTruthy());
    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => { fireEvent.press(getByTestId("reconnect-cigna")); });
    await waitFor(() => expect(health[0].syncStatus).toBe("active"));
    await waitFor(() => {
      expect(queryByTestId("webview-mock")).toBeNull();
      expect(queryByTestId("reconnect-cigna")).toBeNull();
    });
  });

  it("reauthorizes broker connections even when the unrelated Fasten widget is not configured", async () => {
    mockHealthResponse([{ sourceType: "cigna", syncStatus: "needs_reauth", needsReauth: true }], false, false);
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId("reconnect-cigna")).toBeTruthy());
    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => { fireEvent.press(getByTestId("reconnect-cigna")); });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
  });

  it.each([
    { type: "cancel" },
    { type: "success", url: "tabulamedica://payer-reconnect?code=code&state=wrong-state" },
    { type: "success", url: "tabulamedica://payer-reconnect?error=access_denied&state=reauth-state" },
  ])("does not complete a cancelled or invalid OAuth response: %j", async (result) => {
    mockHealthResponse([{ sourceType: "cigna", syncStatus: "needs_reauth", needsReauth: true }]);
    (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue(result);
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId("reconnect-cigna")).toBeTruthy());
    const { fireEvent } = require("@testing-library/react-native");
    await act(async () => { fireEvent.press(getByTestId("reconnect-cigna")); });
    expect(mockedApiRequest.mock.calls.some(call => call[1] === "/api/fasten/reauthorize/complete")).toBe(false);
    expect(getByTestId("reconnect-cigna")).toBeTruthy();
  });
});
