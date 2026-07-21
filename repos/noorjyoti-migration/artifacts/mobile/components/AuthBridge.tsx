import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";

import { useAuthState } from "@/lib/auth";
import { getIdToken } from "@/lib/firebaseAuth";

// Wires the GCIP (Firebase) ID token into the api-client as a Bearer token, and
// clears the react-query cache when the signed-in user changes.
export function AuthBridge() {
  const { user, isLoaded } = useAuthState();
  const qc = useQueryClient();
  const prevUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(() => getIdToken());
    return () => setAuthTokenGetter(null);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    const uid = user?.uid ?? null;
    if (prevUserId.current === undefined) {
      prevUserId.current = uid;
      return;
    }
    if (prevUserId.current !== uid) {
      prevUserId.current = uid;
      qc.clear();
    }
  }, [isLoaded, user, qc]);

  return null;
}
