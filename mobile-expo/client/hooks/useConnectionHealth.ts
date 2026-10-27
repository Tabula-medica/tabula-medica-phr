import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import type { ConnectionHealth } from "@/components/ConnectionHealthNotices";

export const CONNECTION_HEALTH_QUERY_KEY = ["/api/fasten/connected-sources"];

export interface ConnectedSourcesResponse {
  sources: string[];
  health: ConnectionHealth[];
  configured: boolean;
}

export function useConnectionHealth() {
  const query = useQuery<ConnectedSourcesResponse>({
    queryKey: CONNECTION_HEALTH_QUERY_KEY,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    void refetch();
  }, [refetch]));
  return query;
}
