import React from "react";
import { Text, Pressable } from "react-native";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: "FULL_NAME", EMAIL: "EMAIL" },
}));

jest.mock("@/lib/api", () => ({
  api: {
    auth: {
      login: jest.fn(),
      register: jest.fn(),
      apple: jest.fn(),
      gcip: jest.fn(),
    },
    users: { get: jest.fn() },
  },
  getUserId: jest.fn(async () => null),
  clearUserId: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));

jest.mock("@/lib/gcip", () => ({
  isGcipConfigured: jest.fn(() => false),
  gcipSignInWithEmail: jest.fn(),
  gcipSignUpWithEmail: jest.fn(),
  gcipSendPasswordReset: jest.fn(),
  gcipSignOut: jest.fn(async () => {}),
  useGcipGoogleAuth: jest.fn(() => ({
    signInWithGoogle: jest.fn(),
    isReady: false,
    platform: "ios",
  })),
}));

import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import * as gcip from "@/lib/gcip";
import * as Apple from "expo-apple-authentication";

const mockedApi = api as any;
const mockedGcip = gcip as any;
const mockedApple = Apple as any;

function Harness({
  onReady,
  action,
}: {
  onReady: (a: ReturnType<typeof useAuth>) => void;
  action?: (a: ReturnType<typeof useAuth>) => Promise<void>;
}) {
  const auth = useAuth();
  return (
    <>
      <Text testID="text-loading">{String(auth.isLoading)}</Text>
      <Text testID="text-authed">{String(auth.isAuthenticated)}</Text>
      <Text testID="text-user-id">{auth.user?.id ?? ""}</Text>
      <Pressable
        testID="button-trigger"
        onPress={async () => {
          if (action) await action(auth);
          onReady(auth);
        }}
      >
        <Text>go</Text>
      </Pressable>
    </>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGcip.isGcipConfigured.mockReturnValue(false);
    mockedApple.isAvailableAsync.mockResolvedValue(false);
  });

  it("starts in loading state and finishes when no userId is stored", async () => {
    const { getByTestId } = render(<Harness onReady={() => {}} />);
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    expect(getByTestId("text-authed").props.children).toBe("false");
  });

  it("signInWithEmail uses the legacy login endpoint when GCIP is not configured", async () => {
    mockedApi.auth.login.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
    let result: any;
    const { getByTestId } = render(
      <Harness
        onReady={() => {}}
        action={async (a) => {
          result = await a.signInWithEmail("a@b.c", "pw");
        }}
      />,
    );
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    await act(async () => {
      fireEvent.press(getByTestId("button-trigger"));
    });
    expect(mockedApi.auth.login).toHaveBeenCalledWith({
      email: "a@b.c",
      password: "pw",
    });
    expect(mockedGcip.gcipSignInWithEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "u1", email: "a@b.c" });
    expect(getByTestId("text-user-id").props.children).toBe("u1");
    expect(getByTestId("text-authed").props.children).toBe("true");
  });

  it("signInWithEmail routes through GCIP exchange when GCIP is configured", async () => {
    mockedGcip.isGcipConfigured.mockReturnValue(true);
    mockedGcip.gcipSignInWithEmail.mockResolvedValue("firebase-id-token");
    mockedApi.auth.gcip.mockResolvedValue({ user: { id: "u-gcip", email: "g@b.c" } });

    const { getByTestId } = render(
      <Harness
        onReady={() => {}}
        action={async (a) => {
          await a.signInWithEmail("g@b.c", "pw");
        }}
      />,
    );
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    await act(async () => {
      fireEvent.press(getByTestId("button-trigger"));
    });

    expect(mockedGcip.gcipSignInWithEmail).toHaveBeenCalledWith("g@b.c", "pw");
    expect(mockedApi.auth.gcip).toHaveBeenCalledWith({ idToken: "firebase-id-token" });
    expect(mockedApi.auth.login).not.toHaveBeenCalled();
    expect(getByTestId("text-user-id").props.children).toBe("u-gcip");
  });

  it("signUpWithEmail routes through GCIP when configured", async () => {
    mockedGcip.isGcipConfigured.mockReturnValue(true);
    mockedGcip.gcipSignUpWithEmail.mockResolvedValue("firebase-signup-token");
    mockedApi.auth.gcip.mockResolvedValue({ user: { id: "u-new" } });

    const { getByTestId } = render(
      <Harness
        onReady={() => {}}
        action={async (a) => {
          await a.signUpWithEmail("new@b.c", "pw", "Full Name");
        }}
      />,
    );
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    await act(async () => {
      fireEvent.press(getByTestId("button-trigger"));
    });

    expect(mockedGcip.gcipSignUpWithEmail).toHaveBeenCalledWith(
      "new@b.c",
      "pw",
      "Full Name",
    );
    expect(mockedApi.auth.gcip).toHaveBeenCalledWith({ idToken: "firebase-signup-token" });
    expect(mockedApi.auth.register).not.toHaveBeenCalled();
  });

  it("sendPasswordReset throws when GCIP is not configured", async () => {
    let err: any = null;
    const { getByTestId } = render(
      <Harness
        onReady={() => {}}
        action={async (a) => {
          try {
            await a.sendPasswordReset("x@y.z");
          } catch (e) {
            err = e;
          }
        }}
      />,
    );
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    await act(async () => {
      fireEvent.press(getByTestId("button-trigger"));
    });
    expect(err).toBeInstanceOf(Error);
    expect(mockedGcip.gcipSendPasswordReset).not.toHaveBeenCalled();
  });

  it("signInWithApple posts the credential and sets the user", async () => {
    mockedApple.signInAsync.mockResolvedValue({
      user: "apple-user-id",
      email: "apple@b.c",
      fullName: { givenName: "Jane", familyName: "Doe" },
      identityToken: "apple-id-token",
    });
    mockedApi.auth.apple.mockResolvedValue({ user: { id: "u-apple" } });

    const { getByTestId } = render(
      <Harness
        onReady={() => {}}
        action={async (a) => {
          await a.signInWithApple();
        }}
      />,
    );
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    await act(async () => {
      fireEvent.press(getByTestId("button-trigger"));
    });
    expect(mockedApi.auth.apple).toHaveBeenCalledWith({
      appleId: "apple-user-id",
      email: "apple@b.c",
      fullName: "Jane Doe",
      identityToken: "apple-id-token",
    });
    expect(getByTestId("text-user-id").props.children).toBe("u-apple");
  });

  it("signInWithApple returns null on user cancellation", async () => {
    const err: any = new Error("cancelled");
    err.code = "ERR_REQUEST_CANCELED";
    mockedApple.signInAsync.mockRejectedValue(err);

    let result: any = "unset";
    const { getByTestId } = render(
      <Harness
        onReady={() => {}}
        action={async (a) => {
          result = await a.signInWithApple();
        }}
      />,
    );
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    await act(async () => {
      fireEvent.press(getByTestId("button-trigger"));
    });
    expect(result).toBeNull();
    expect(mockedApi.auth.apple).not.toHaveBeenCalled();
  });

  it("signOut clears tokens, user id, and (when GCIP is on) Firebase state", async () => {
    mockedGcip.isGcipConfigured.mockReturnValue(true);
    const { getByTestId } = render(
      <Harness
        onReady={() => {}}
        action={async (a) => {
          await a.signOut();
        }}
      />,
    );
    await waitFor(() =>
      expect(getByTestId("text-loading").props.children).toBe("false"),
    );
    await act(async () => {
      fireEvent.press(getByTestId("button-trigger"));
    });
    const apiModule = require("@/lib/api");
    expect(mockedGcip.gcipSignOut).toHaveBeenCalled();
    expect(apiModule.clearTokens).toHaveBeenCalled();
    expect(apiModule.clearUserId).toHaveBeenCalled();
  });
});
