import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/auth/AuthContext";

export default function AuthLayout() {
  const { initializing, signedIn } = useAuth();
  if (initializing) return null;
  // Already authenticated — bounce to the app.
  if (signedIn) return <Redirect href="/(app)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
