import { Redirect } from "expo-router";
import { useAuth } from "@/auth/AuthContext";

/**
 * Entry route — sends the user to the app if signed in, otherwise to login.
 * The biometric lock is handled as an overlay in the root layout, not here.
 */
export default function Index() {
  const { initializing, signedIn } = useAuth();
  if (initializing) return null;
  return <Redirect href={signedIn ? "/(app)" : "/(auth)/login"} />;
}
