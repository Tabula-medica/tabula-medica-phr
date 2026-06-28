import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

export default function SettingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.brand,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Settings" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy & Data Rights" }} />
    </Stack>
  );
}
