import { useAuthState } from "@/lib/auth";
import { Redirect, Stack } from "expo-router";
import React from "react";

import colors from "@/constants/colors";

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuthState();
  if (isLoaded && isSignedIn) {
    return <Redirect href="/(tabs)/profile" />;
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.light.background },
        headerTintColor: colors.light.foreground,
        contentStyle: { backgroundColor: colors.light.background },
        headerShadowVisible: false,
        title: "",
      }}
    />
  );
}
