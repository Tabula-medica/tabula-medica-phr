import { Stack } from "expo-router";
import { colors } from "@/theme/tokens";

export default function RecordsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.brand,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Records" }} />
      <Stack.Screen name="[id]" options={{ title: "Record" }} />
    </Stack>
  );
}
